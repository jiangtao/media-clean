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
  loadFalsePositiveCandidateIds,
  loadMediaAnalysisCache,
  saveMediaAnalysisCache,
  type MediaAnalysisCache,
  type MediaAnalysisCacheEntry,
} from '../../services/storage/app-storage';
import { DEFAULT_SCAN_LIMIT } from './scan-config';

const PAGE_SIZE = 60;
const ANALYSIS_CONCURRENCY = 4;
export const ACTIONABLE_SCAN_THRESHOLD = 55;
const ANALYSIS_CACHE_SIGNATURE_VERSION = 'v1';
// Scan analysis still runs through the JS pipeline in this repo.
// Android may keep that pipeline alive in the background via a native foreground
// service, but the analysis work itself still uses cooperative yielding here.
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

export interface ScanCheckpoint {
  current: number;
  total: number;
  currentFileName: string | null;
  processedCount: number;
  lastProcessedAssetId: string | null;
  analyzedInputs?: readonly AnalyzedMediaInput[];
}

export interface ScanMediaLibraryOptions {
  onProgress?: ScanProgressCallback;
  onCheckpoint?: (checkpoint: ScanCheckpoint) => Promise<void> | void;
  analysisConcurrency?: number;
  yieldToMainThread?: () => Promise<void>;
  falsePositiveIds?: readonly string[];
  recycleBinCandidateCache?: readonly CleanupCandidate[];
  resumeAfterAssetId?: string | null;
  createdAfter?: number | null;
  createdBefore?: number | null;
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
  onChunkComplete?: (chunk: T[], results: R[]) => Promise<void> | void,
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

    await onChunkComplete?.(chunk, chunkResults);

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

export async function loadRecentScanAssets(options?: {
  limit?: number;
  excludedAssetIds?: readonly string[];
  createdAfter?: number | null;
  createdBefore?: number | null;
}) {
  const assets: MediaLibrary.Asset[] = [];
  const excludedAssetIds = new Set(options?.excludedAssetIds ?? []);
  const requestedLimit = options?.limit ?? DEFAULT_SCAN_LIMIT;
  const hasBoundedLimit = Number.isFinite(requestedLimit) && requestedLimit > 0;
  const limit = hasBoundedLimit ? requestedLimit : null;
  const createdAfter = options?.createdAfter ?? null;
  const createdBefore = options?.createdBefore ?? null;
  let cursor: string | undefined;
  let reachedWindowBoundary = false;

  while (!reachedWindowBoundary && (limit === null || assets.length < limit)) {
    const remaining = limit === null ? PAGE_SIZE : Math.max(limit - assets.length, 0);
    const page = await MediaLibrary.getAssetsAsync({
      first: Math.max(1, Math.min(PAGE_SIZE, remaining)),
      after: cursor,
      mediaType: [MediaLibrary.MediaType.photo, MediaLibrary.MediaType.video],
      sortBy: [[MediaLibrary.SortBy.creationTime, false]],
    });

    for (const asset of page.assets) {
      if (
        createdBefore !== null &&
        Number.isFinite(asset.creationTime) &&
        asset.creationTime >= createdBefore
      ) {
        continue;
      }

      if (
        createdAfter !== null &&
        Number.isFinite(asset.creationTime) &&
        asset.creationTime < createdAfter
      ) {
        reachedWindowBoundary = true;
        break;
      }

      if (excludedAssetIds.has(asset.id)) {
        continue;
      }

      assets.push(asset);
      if (limit !== null && assets.length >= limit) {
        break;
      }
    }

    if (reachedWindowBoundary || !page.hasNextPage) {
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
      previewUri: context.localUri,
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
    previewUri: analyzedInput.asset.uri,
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
      previewUri: context.localUri,
    },
    metrics: analysis.metrics,
    fingerprint: analysis.fingerprint,
    differenceHash: analysis.differenceHash,
    contentHash,
    frameFingerprints: analysis.frameFingerprints,
    analysisStatus: analysis.status,
  };
}

async function hydrateAnalyzedInputFromCache(
  asset: MediaLibrary.Asset,
  analysisCache: MediaAnalysisCache,
): Promise<AnalyzedMediaInput | null> {
  const context = await buildAssetAnalysisContext(asset);
  if (!context) {
    return null;
  }

  const cachedEntry = analysisCache[asset.id];
  if (!cachedEntry?.signature || cachedEntry.signature !== context.signature) {
    return null;
  }

  return buildAnalyzedInputFromCache(context, cachedEntry);
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

export interface BuildScanOutputFromAnalyzedInputsOptions {
  falsePositiveIds?: readonly string[];
  recycleBinCandidateCache?: readonly CleanupCandidate[];
  scannedAt?: number;
  scannedCount?: number;
}

export function buildScanOutputFromAnalyzedInputs(
  analyzedInputs: readonly AnalyzedMediaInput[],
  recycleBinIds: readonly string[],
  options: BuildScanOutputFromAnalyzedInputsOptions = {},
): ScanOutput {
  const falsePositiveSet = new Set(options.falsePositiveIds ?? []);
  const recycleBinSet = new Set(recycleBinIds);
  const recognizedById = new Map(
    buildCleanupCandidates([...analyzedInputs]).map((candidate) => [candidate.id, candidate]),
  );
  const allCandidates = [...analyzedInputs].map(({ asset }) =>
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
      (options.recycleBinCandidateCache ?? []).filter((candidate) => !falsePositiveSet.has(candidate.id)),
      allCandidates.filter((candidate) => recycleBinSet.has(candidate.id)),
    ),
  );
  const candidates = [...activeCandidates, ...recycleBin];
  const scannedAt = options.scannedAt ?? Date.now();
  const scannedCount = options.scannedCount ?? analyzedInputs.length;

  return {
    state: {
      activeCandidates,
      recycleBin,
      selectedIds: [],
    },
    summary: {
      scannedAt,
      scannedCount,
      candidateCount: candidates.length,
      highConfidenceCount: candidates.filter((candidate) => candidate.confidence === 'high').length,
      mediumConfidenceCount: candidates.filter((candidate) => candidate.confidence === 'medium').length,
      recycleBinCount: recycleBin.length,
    },
  };
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
      ? await loadFalsePositiveCandidateIds()
      : onProgressOrOptions.falsePositiveIds
        ? [...onProgressOrOptions.falsePositiveIds]
        : await loadFalsePositiveCandidateIds();
  const onCheckpoint =
    typeof onProgressOrOptions === 'function'
      ? undefined
      : onProgressOrOptions.onCheckpoint;
  const recycleBinCandidateCache =
    typeof onProgressOrOptions === 'function'
      ? []
      : [...(onProgressOrOptions.recycleBinCandidateCache ?? [])];
  const resumeAfterAssetId =
    typeof onProgressOrOptions === 'function'
      ? null
      : onProgressOrOptions.resumeAfterAssetId ?? null;

  const recentAssets = await loadRecentScanAssets({
    excludedAssetIds: falsePositiveIds,
    createdAfter:
      typeof onProgressOrOptions === 'function'
        ? null
        : onProgressOrOptions.createdAfter ?? null,
    createdBefore:
      typeof onProgressOrOptions === 'function'
        ? null
        : onProgressOrOptions.createdBefore ?? null,
  });
  const recycleBinAssets = await fetchPinnedRecycleBinAssets(recycleBinIds, recentAssets);
  const assets = Array.from(
    new Map([...recentAssets, ...recycleBinAssets].map((asset) => [asset.id, asset])).values(),
  );
  const analysisCache = await loadMediaAnalysisCache();
  let analysisCacheDirty = false;
  const total = assets.length;
  let completed = 0;
  let lastFileName = '';
  let lastProcessedAssetId: string | null = null;
  const recycleBinSet = new Set(recycleBinIds);
  const falsePositiveSet = new Set(falsePositiveIds);
  const recycleBinCandidateCacheMap = new Map(
    recycleBinCandidateCache.map((candidate) => [candidate.id, candidate]),
  );
  const resumeIndex =
    resumeAfterAssetId === null
      ? -1
      : assets.findIndex((asset) => asset.id === resumeAfterAssetId);
  const resumePrefix = resumeIndex >= 0 ? assets.slice(0, resumeIndex + 1) : [];
  const warmStartAnalyzedInputs: AnalyzedMediaInput[] = [];

  if (resumePrefix.length > 0) {
    for (const asset of resumePrefix) {
      const cachedInput = await hydrateAnalyzedInputFromCache(asset, analysisCache);

      if (!cachedInput) {
        break;
      }

      warmStartAnalyzedInputs.push(cachedInput);
    }

    completed = warmStartAnalyzedInputs.length;

    if (completed > 0) {
      const lastWarmAsset = resumePrefix[completed - 1];
      lastFileName = resolveAssetFileName(lastWarmAsset);
      lastProcessedAssetId = lastWarmAsset.id;

      onProgress?.({
        current: completed,
        total,
        currentFileName: lastFileName,
        isScanning: completed < total,
        percentage: total > 0 ? Math.min(Math.round((completed / total) * 100), 100) : 0,
        analyzedAssetId: lastProcessedAssetId,
        analyzedInput: warmStartAnalyzedInputs[completed - 1] ?? null,
        analyzedMediaType: normalizeMediaType(lastWarmAsset.mediaType),
      });
    }
  }

  const remainingAssets = assets.slice(completed);
  const analyzed = await mapWithConcurrency(
    remainingAssets,
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
      lastProcessedAssetId = asset.id;

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
    async () => {
      if (analysisCacheDirty) {
        await saveMediaAnalysisCache(analysisCache);
        analysisCacheDirty = false;
      }

      await onCheckpoint?.({
        current: completed,
        total,
        currentFileName: lastFileName || null,
        processedCount: completed,
        lastProcessedAssetId,
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
  const analyzedAssets = [
    ...warmStartAnalyzedInputs,
    ...analyzed.filter((candidate): candidate is AnalyzedMediaInput => Boolean(candidate)),
  ];
  const output = buildScanOutputFromAnalyzedInputs(analyzedAssets, recycleBinIds, {
    falsePositiveIds,
    recycleBinCandidateCache,
    scannedAt: Date.now(),
    scannedCount: total,
  });

  if (onProgress) {
    onProgress({
      current: total,
      total,
      currentFileName: lastFileName,
      isScanning: false,
      percentage: total > 0 ? 100 : 0,
    });
  }

  return output;
}
