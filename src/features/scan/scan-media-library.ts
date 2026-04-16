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

const PAGE_SIZE = 60;
const MAX_SCAN_ASSETS = 360;
const ANALYSIS_CONCURRENCY = 4;
const CANDIDATE_THRESHOLD = 55;
export const DEFAULT_SCAN_LIMIT = MAX_SCAN_ASSETS;

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
): Promise<R[]> {
  const results: R[] = [];

  for (let index = 0; index < items.length; index += concurrency) {
    const chunk = items.slice(index, index + concurrency);
    const chunkResults = await Promise.all(chunk.map(worker));
    results.push(...chunkResults);
  }

  return results;
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

async function readFileSize(uri: string) {
  try {
    const info = await FileSystem.getInfoAsync(uri);
    return info.exists ? info.size : 0;
  } catch {
    return 0;
  }
}

async function analyzeAsset(asset: MediaLibrary.Asset): Promise<AnalyzedMediaInput | null> {
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

  const [analysis, fileSize] = await Promise.all([
    analyzeVisualsForAsset(localUri, mediaType, asset.duration ?? 0),
    readFileSize(localUri),
  ]);

  const snapshot: MediaAssetSnapshot = {
    id: asset.id,
    uri: localUri,
    previewUri: analysis.previewUri,
    mediaType,
    width: asset.width,
    height: asset.height,
    duration: asset.duration ?? 0,
    fileSize,
    creationTime: asset.creationTime,
  };

  return {
    asset: snapshot,
    metrics: analysis.metrics,
    fingerprint: analysis.fingerprint,
    frameFingerprints: analysis.frameFingerprints,
    analysisStatus: analysis.status,
  };
}

export async function scanMediaLibrary(recycleBinIds: string[]): Promise<ScanOutput> {
  const recentAssets = await fetchRecentAssets();
  const recycleBinAssets = await fetchPinnedRecycleBinAssets(recycleBinIds, recentAssets);
  const assets = Array.from(
    new Map([...recentAssets, ...recycleBinAssets].map((asset) => [asset.id, asset])).values(),
  );
  const recycleBinSet = new Set(recycleBinIds);
  const analyzed = await mapWithConcurrency(assets, ANALYSIS_CONCURRENCY, analyzeAsset);
  const analyzedAssets = analyzed.filter((candidate): candidate is AnalyzedMediaInput => Boolean(candidate));
  const recognizedById = new Map(
    buildCleanupCandidates(analyzedAssets).map((candidate) => [candidate.id, candidate]),
  );
  const allCandidates = analyzedAssets.map(({ asset }) =>
    recognizedById.get(asset.id) ?? createFallbackCandidate(asset),
  );
  const candidates = sortCandidatesByScore(
    allCandidates.filter((candidate): candidate is CleanupCandidate => {
      return candidate.score >= CANDIDATE_THRESHOLD || recycleBinSet.has(candidate.id);
    }),
  );

  const activeCandidates = candidates.filter((candidate) => !recycleBinSet.has(candidate.id));
  const recycleBin = candidates.filter((candidate) => recycleBinSet.has(candidate.id));
  const scannedAt = Date.now();

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
