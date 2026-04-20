import * as FileSystem from 'expo-file-system/legacy';
import * as MediaLibrary from 'expo-media-library';

import {
  buildCleanupCandidates,
  createFallbackCandidate,
  sortCandidatesByScore,
  type AnalyzedMediaInput,
} from '../../domain/recognition/scoring';
import type { CleanupCandidate, MediaAssetSnapshot, MediaType } from '../../domain/recognition/types';
import type { CleanupState } from '../cleanup/cleanup-state';
import { analyzeVisualsForAsset } from '../../services/media/analyze-visuals';
import {
  loadMediaAnalysisCache,
  saveMediaAnalysisCache,
  type MediaAnalysisCache,
  type MediaAnalysisCacheEntry,
} from '../../services/storage/app-storage';
import { DEFAULT_SCAN_LIMIT } from './scan-config';

const PAGE_SIZE = 60;
const MAX_SCAN_ASSETS = DEFAULT_SCAN_LIMIT;
const ANALYSIS_CONCURRENCY = 4;
export const ACTIONABLE_SCAN_THRESHOLD = 55;
const ANALYSIS_CACHE_SIGNATURE_VERSION = 'v1';
// Expo/RN in this repo does not have a dedicated worker pipeline wired in yet,
// so scan analysis must fall back to cooperative yielding on the JS thread.
export const SCAN_ANALYSIS_EXECUTION_STRATEGY = 'cooperative-yield' as const;

export interface ScanSummary {
  scannedAt: number;
  scannedCount: number;
  candidateCount: number;
  highConfidenceCount: number;
  mediumConfidenceCount: number;
  recycleBinCount: number;
}

export interface ScanOutput {
  state: CleanupState;
  summary: ScanSummary;
}

export interface ScanProgress {
  current: number;
  total: number;
  currentFileName: string;
  isScanning: boolean;
  percentage: number;
  analyzedAssetId?: string;
  analyzedInput?: AnalyzedMediaInput | null;
  analyzedMediaType?: MediaType | null;
}

export type ScanProgressCallback = (progress: ScanProgress) => void;

export interface ScanMediaLibraryOptions {
  onProgress?: ScanProgressCallback;
  analysisConcurrency?: number;
  yieldToMainThread?: () => Promise<void>;
  falsePositiveIds?: readonly string[];
  recycleBinCandidateCache?: readonly CleanupCandidate[];
}

function normalizeMediaType(value: MediaLibrary.MediaTypeValue): MediaType | null {
  if (value === MediaLibrary.MediaType.photo) {
    return 'photo';
  }

  if (value === MediaLibrary.MediaType.video) {
    return 'video';
  }

  return null;
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<R>,
  onItemComplete?: (item: T, result: R) => void,
  yieldToMainThread?: () => Promise<void>,
): Promise<R[]> {
  const results: R[] = [];

  for (let index = 0; index < items.length; index += concurrency) {
    const chunk = items.slice(index, index + concurrency);
    const chunkResults = await Promise.all(
      chunk.map(async (item) => {
        const result = await worker(item);
        onItemComplete?.(item, result);
        return result;
      }),
    );
    results.push(...chunkResults);

    if (index + concurrency < items.length) {
      await yieldToMainThread?.();
    }
  }

  return results;
}

function defaultYieldToMainThread() {
  return new Promise<void>((resolve) => {
    if (typeof globalThis.requestAnimationFrame === 'function') {
      globalThis.requestAnimationFrame(() => resolve());
      return;
    }

    setTimeout(resolve, 0);
  });
}

async function fetchRecentAssets() {
  const assets: MediaLibrary.Asset[] = [];
  let cursor: string | undefined;

  while (assets.length < MAX_SCAN_ASSETS) {
    const page = await MediaLibrary.getAssetsAsync({
      first: Math.min(PAGE_SIZE, MAX_SCAN_ASSETS - assets.length),
      after: cursor,
      mediaType: [MediaLibrary.MediaType.photo, MediaLibrary.MediaType.video],
      sortBy: [[MediaLibrary.SortBy.creationTime, false]],
    });

    assets.push(...page.assets);

    if (!page.hasNextPage) {
      break;
    }

    cursor = page.endCursor;
  }

  return assets;
}

async function fetchPinnedRecycleBinAssets(
  recycleBinIds: string[],
  existingAssets: MediaLibrary.Asset[],
) {
  const existingIds = new Set(existingAssets.map((asset) => asset.id));
  const missingIds = recycleBinIds.filter((id) => !existingIds.has(id));

  if (missingIds.length === 0) {
    return [];
  }

  const recovered = await Promise.all(
    missingIds.map(async (id) => {
      try {
        return await MediaLibrary.getAssetInfoAsync(id, {
          shouldDownloadFromNetwork: false,
        });
      } catch {
        return null;
      }
    }),
  );

  return recovered.filter((asset): asset is MediaLibrary.AssetInfo => Boolean(asset));
}

async function readFileInfo(uri: string) {
  try {
    const info = await FileSystem.getInfoAsync(uri);
    return {
      size: info.exists ? info.size : 0,
      md5: 'md5' in info && typeof info.md5 === 'string' ? info.md5 : null,
    };
  } catch {
    return { size: 0, md5: null };
  }
}

async function readFileContentHash(uri: string) {
  try {
    const info = await FileSystem.getInfoAsync(uri, { md5: true });
    return 'md5' in info && typeof info.md5 === 'string' ? info.md5 : null;
  } catch {
    return null;
  }
}

function resolveAssetFileName(asset: MediaLibrary.Asset) {
  return asset.filename || asset.uri.split('/').pop() || asset.id;
}

function buildAnalysisCacheSignature(
  asset: MediaLibrary.Asset,
  mediaType: MediaType,
  fileSize: number,
) {
  return [
    ANALYSIS_CACHE_SIGNATURE_VERSION,
    mediaType,
    asset.creationTime,
    asset.width,
    asset.height,
    Math.round((asset.duration ?? 0) * 1000),
    fileSize,
  ].join(':');
}

interface AssetAnalysisContext {
  mediaType: MediaType;
  localUri: string;
  fileSize: number;
  contentHash: string | null;
  snapshot: MediaAssetSnapshot;
  signature: string;
}

async function buildAssetAnalysisContext(
  asset: MediaLibrary.Asset,
): Promise<AssetAnalysisContext | null> {
  const mediaType = normalizeMediaType(asset.mediaType);
  if (!mediaType) {
    return null;
  }

  const assetInfo = await MediaLibrary.getAssetInfoAsync(asset, {
    shouldDownloadFromNetwork: false,
  }).catch(() => null);

  const localUri = assetInfo?.localUri ?? asset.uri;

  if (!localUri) {
    return null;
  }

  const fileInfo = await readFileInfo(localUri);
  const snapshot: MediaAssetSnapshot = {
    id: asset.id,
    uri: localUri,
    mediaType,
    width: asset.width,
    height: asset.height,
    duration: asset.duration ?? 0,
    fileSize: fileInfo.size,
    creationTime: asset.creationTime,
  };

  return {
    mediaType,
    localUri,
    fileSize: fileInfo.size,
    contentHash: fileInfo.md5,
    snapshot,
    signature: buildAnalysisCacheSignature(asset, mediaType, fileInfo.size),
  };
}

function buildAnalyzedInputFromCache(
  context: AssetAnalysisContext,
  entry: MediaAnalysisCacheEntry,
): AnalyzedMediaInput {
  return {
    asset: {
      ...context.snapshot,
      previewUri: entry.previewUri || context.localUri,
    },
    metrics: entry.metrics,
    fingerprint: entry.fingerprint,
    differenceHash: entry.differenceHash ?? entry.fingerprint,
    contentHash: entry.contentHash ?? context.contentHash,
    frameFingerprints: entry.frameFingerprints,
    analysisStatus: entry.status,
  };
}

function buildMediaAnalysisCacheEntry(
  analyzedInput: AnalyzedMediaInput,
  signature: string,
): MediaAnalysisCacheEntry {
  return {
    assetId: analyzedInput.asset.id,
    signature,
    previewUri: analyzedInput.asset.previewUri ?? analyzedInput.asset.uri,
    fingerprint: analyzedInput.fingerprint,
    differenceHash: analyzedInput.differenceHash ?? null,
    contentHash: analyzedInput.contentHash ?? null,
    frameFingerprints: analyzedInput.frameFingerprints ?? [],
    status: analyzedInput.analysisStatus ?? 'ok',
    metrics: analyzedInput.metrics,
  };
}

function areAnalysisCacheEntriesEqual(
  left: MediaAnalysisCacheEntry | undefined,
  right: MediaAnalysisCacheEntry,
) {
  if (!left) {
    return false;
  }

  return (
    left.assetId === right.assetId &&
    left.signature === right.signature &&
    left.previewUri === right.previewUri &&
    left.fingerprint === right.fingerprint &&
    (left.differenceHash ?? null) === (right.differenceHash ?? null) &&
    (left.contentHash ?? null) === (right.contentHash ?? null) &&
    left.status === right.status &&
    JSON.stringify(left.metrics) === JSON.stringify(right.metrics) &&
    JSON.stringify(left.frameFingerprints ?? []) === JSON.stringify(right.frameFingerprints ?? [])
  );
}

async function analyzeAsset(
  asset: MediaLibrary.Asset,
  analysisCache: MediaAnalysisCache,
): Promise<AnalyzedMediaInput | null> {
  const context = await buildAssetAnalysisContext(asset);
  if (!context) {
    return null;
  }

  const cachedEntry = analysisCache[asset.id];
  if (cachedEntry?.signature === context.signature) {
    return buildAnalyzedInputFromCache(context, cachedEntry);
  }

  const analysis = await analyzeVisualsForAsset(
    context.localUri,
    context.mediaType,
    asset.duration ?? 0,
  );
  const contentHash =
    analysis.status === 'fallback' || !analysis.fingerprint
      ? context.contentHash ?? (await readFileContentHash(context.localUri))
      : context.contentHash;

  return {
    asset: {
      ...context.snapshot,
      previewUri: analysis.previewUri,
    },
    metrics: analysis.metrics,
    fingerprint: analysis.fingerprint,
    differenceHash: analysis.differenceHash,
    contentHash,
    frameFingerprints: analysis.frameFingerprints,
    analysisStatus: analysis.status,
  };
}

function pruneAnalysisCacheEntries(
  analysisCache: MediaAnalysisCache,
  activeAssetIds: Set<string>,
) {
  let pruned = false;

  Object.keys(analysisCache).forEach((assetId) => {
    if (activeAssetIds.has(assetId)) {
      return;
    }

    delete analysisCache[assetId];
    pruned = true;
  });

  return pruned;
}

function mergeRecycleBinCandidates(
  recycleBinIds: readonly string[],
  cachedCandidates: readonly CleanupCandidate[],
  analyzedCandidates: CleanupCandidate[],
) {
  const merged = new Map<string, CleanupCandidate>();

  for (const candidate of cachedCandidates) {
    merged.set(candidate.id, candidate);
  }

  for (const candidate of analyzedCandidates) {
    merged.set(candidate.id, candidate);
  }

  return recycleBinIds
    .map((id) => merged.get(id))
    .filter((candidate): candidate is CleanupCandidate => Boolean(candidate));
}

export async function scanMediaLibrary(recycleBinIds: string[]): Promise<ScanOutput>;
export async function scanMediaLibrary(
  recycleBinIds: string[],
  onProgress: ScanProgressCallback,
): Promise<ScanOutput>;
export async function scanMediaLibrary(
  recycleBinIds: string[],
  options: ScanMediaLibraryOptions,
): Promise<ScanOutput>;
export async function scanMediaLibrary(
  recycleBinIds: string[],
  onProgressOrOptions: ScanProgressCallback | ScanMediaLibraryOptions = {},
): Promise<ScanOutput> {
  const onProgress =
    typeof onProgressOrOptions === 'function'
      ? onProgressOrOptions
      : onProgressOrOptions.onProgress;
  const analysisConcurrency =
    typeof onProgressOrOptions === 'function'
      ? ANALYSIS_CONCURRENCY
      : onProgressOrOptions.analysisConcurrency ?? ANALYSIS_CONCURRENCY;
  const yieldToMainThread =
    typeof onProgressOrOptions === 'function'
      ? defaultYieldToMainThread
      : onProgressOrOptions.yieldToMainThread ?? defaultYieldToMainThread;
  const falsePositiveIds =
    typeof onProgressOrOptions === 'function'
      ? []
      : [...(onProgressOrOptions.falsePositiveIds ?? [])];
  const recycleBinCandidateCache =
    typeof onProgressOrOptions === 'function'
      ? []
      : [...(onProgressOrOptions.recycleBinCandidateCache ?? [])];

  const recentAssets = await fetchRecentAssets();
  const recycleBinAssets = await fetchPinnedRecycleBinAssets(recycleBinIds, recentAssets);
  const assets = Array.from(
    new Map([...recentAssets, ...recycleBinAssets].map((asset) => [asset.id, asset])).values(),
  );
  const analysisCache = await loadMediaAnalysisCache();
  let analysisCacheDirty = false;
  const total = assets.length;
  let completed = 0;
  let lastFileName = '';
  const recycleBinSet = new Set(recycleBinIds);
  const falsePositiveSet = new Set(falsePositiveIds);
  const recycleBinCandidateCacheMap = new Map(
    recycleBinCandidateCache.map((candidate) => [candidate.id, candidate]),
  );
  const analyzed = await mapWithConcurrency(
    assets,
    analysisConcurrency,
    async (asset) => {
      if (falsePositiveSet.has(asset.id)) {
        return null;
      }

      if (recycleBinSet.has(asset.id) && recycleBinCandidateCacheMap.has(asset.id)) {
        return null;
      }

      const analyzedInput = await analyzeAsset(asset, analysisCache);

      if (!analyzedInput) {
        return null;
      }

      const nextCacheEntry = buildMediaAnalysisCacheEntry(
        analyzedInput,
        buildAnalysisCacheSignature(asset, analyzedInput.asset.mediaType, analyzedInput.asset.fileSize),
      );

      if (!areAnalysisCacheEntriesEqual(analysisCache[asset.id], nextCacheEntry)) {
        analysisCache[asset.id] = nextCacheEntry;
        analysisCacheDirty = true;
      }

      return analyzedInput;
    },
    (asset, result) => {
      completed += 1;
      lastFileName = resolveAssetFileName(asset);

      onProgress?.({
        current: completed,
        total,
        currentFileName: lastFileName,
        isScanning: true,
        percentage: total > 0 ? Math.min(Math.round((completed / total) * 100), 100) : 0,
        analyzedAssetId: asset.id,
        analyzedInput: result,
        analyzedMediaType: normalizeMediaType(asset.mediaType),
      });
    },
    yieldToMainThread,
  );
  if (pruneAnalysisCacheEntries(analysisCache, new Set(assets.map((asset) => asset.id)))) {
    analysisCacheDirty = true;
  }
  if (analysisCacheDirty) {
    await saveMediaAnalysisCache(analysisCache);
  }
  const analyzedAssets = analyzed.filter((candidate): candidate is AnalyzedMediaInput => Boolean(candidate));
  const recognizedById = new Map(
    buildCleanupCandidates(analyzedAssets).map((candidate) => [candidate.id, candidate]),
  );
  const allCandidates = analyzedAssets.map(({ asset }) =>
    recognizedById.get(asset.id) ?? createFallbackCandidate(asset),
  );
  const activeCandidates = sortCandidatesByScore(
    allCandidates.filter((candidate): candidate is CleanupCandidate => {
      return (
        candidate.score >= ACTIONABLE_SCAN_THRESHOLD &&
        !recycleBinSet.has(candidate.id) &&
        !falsePositiveSet.has(candidate.id)
      );
    }),
  );
  const recycleBin = sortCandidatesByScore(
    mergeRecycleBinCandidates(
      recycleBinIds,
      recycleBinCandidateCache.filter((candidate) => !falsePositiveSet.has(candidate.id)),
      allCandidates.filter((candidate) => recycleBinSet.has(candidate.id)),
    ),
  );
  const candidates = [...activeCandidates, ...recycleBin];
  const scannedAt = Date.now();

  if (onProgress) {
    onProgress({
      current: total,
      total,
      currentFileName: lastFileName,
      isScanning: false,
      percentage: total > 0 ? 100 : 0,
    });
  }

  return {
    state: {
      activeCandidates,
      recycleBin,
      selectedIds: [],
    },
    summary: {
      scannedAt,
      scannedCount: assets.length,
      candidateCount: candidates.length,
      highConfidenceCount: candidates.filter((candidate) => candidate.confidence === 'high').length,
      mediumConfidenceCount: candidates.filter((candidate) => candidate.confidence === 'medium').length,
      recycleBinCount: recycleBin.length,
    },
  };
}
