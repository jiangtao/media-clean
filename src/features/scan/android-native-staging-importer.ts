import {
  buildCleanupCandidates,
  sortCandidatesByScore,
  type AnalyzedMediaInput,
} from '../../domain/recognition/scoring';
import type { CleanupCandidate } from '../../domain/recognition/types';

import type { ScanCheckpoint, ScanProgress } from './scan-media-library';

const ACTIONABLE_SCAN_THRESHOLD = 55;

export interface AndroidNativeStagingScopeSelection {
  total: number;
  photo: number;
  video: number;
}

export interface AndroidNativeStagingImportResult {
  didImport: boolean;
  chunkKey: string;
  visibleCandidates: CleanupCandidate[];
  scopeSelection: AndroidNativeStagingScopeSelection;
}

function buildAnalyzedInputSignature(analyzedInput: AnalyzedMediaInput) {
  return JSON.stringify({
    id: analyzedInput.asset.id,
    metrics: analyzedInput.metrics,
    fingerprint: analyzedInput.fingerprint ?? null,
    differenceHash: analyzedInput.differenceHash ?? null,
    contentHash: analyzedInput.contentHash ?? null,
    frameFingerprints: analyzedInput.frameFingerprints ?? [],
    analysisStatus: analyzedInput.analysisStatus ?? 'ok',
  });
}

function buildScopeSelectionFromCandidates(
  candidates: CleanupCandidate[],
): AndroidNativeStagingScopeSelection {
  return candidates.reduce<AndroidNativeStagingScopeSelection>(
    (summary, candidate) => {
      summary.total += 1;

      if (candidate.asset.mediaType === 'photo') {
        summary.photo += 1;
      }

      if (candidate.asset.mediaType === 'video') {
        summary.video += 1;
      }

      return summary;
    },
    { total: 0, photo: 0, video: 0 },
  );
}

function buildStreamingVisibleCandidates(
  baseCandidates: CleanupCandidate[],
  resolvedAssetIds: ReadonlySet<string>,
  analyzedInputsById: ReadonlyMap<string, AnalyzedMediaInput>,
  falsePositiveIds: readonly string[],
) {
  const falsePositiveIdSet = new Set(falsePositiveIds);
  const recognizedById = new Map(
    sortCandidatesByScore(
      buildCleanupCandidates([...analyzedInputsById.values()]).filter(
        (candidate) =>
          candidate.score >= ACTIONABLE_SCAN_THRESHOLD && !falsePositiveIdSet.has(candidate.id),
      ),
    ).map((candidate) => [candidate.id, candidate]),
  );

  return baseCandidates.flatMap((candidate) => {
    if (!resolvedAssetIds.has(candidate.id)) {
      return [candidate];
    }

    const recognizedCandidate = recognizedById.get(candidate.id);
    return recognizedCandidate ? [recognizedCandidate] : [];
  });
}

export function buildAndroidNativeStagingChunkKey(
  checkpoint: ScanCheckpoint,
  stateRevision = 0,
) {
  return `${checkpoint.processedCount}:${checkpoint.lastProcessedAssetId ?? 'none'}:${stateRevision}`;
}

export function createAndroidNativeStagingImporter(options: {
  sourceCandidates: CleanupCandidate[];
  falsePositiveIds: readonly string[];
}) {
  const state = {
    resolvedAssetIds: new Set<string>(),
    analyzedInputsById: new Map<string, AnalyzedMediaInput>(),
    analyzedInputSignaturesById: new Map<string, string>(),
    importedChunkKeys: new Set<string>(),
    visibleCandidates: options.sourceCandidates,
    resolvedRevision: 0,
  };

  const recordAnalyzedInputs = (analyzedInputs: readonly AnalyzedMediaInput[]) => {
    let didChange = false;

    analyzedInputs.forEach((analyzedInput) => {
      const nextSignature = buildAnalyzedInputSignature(analyzedInput);
      const previousSignature = state.analyzedInputSignaturesById.get(analyzedInput.asset.id);

      state.resolvedAssetIds.add(analyzedInput.asset.id);
      state.analyzedInputsById.set(analyzedInput.asset.id, analyzedInput);
      state.analyzedInputSignaturesById.set(analyzedInput.asset.id, nextSignature);

      if (previousSignature !== nextSignature) {
        didChange = true;
      }
    });

    if (didChange) {
      state.resolvedRevision += 1;
    }
  };

  return {
    recordProgress(progress: Pick<ScanProgress, 'analyzedAssetId' | 'analyzedInput'>) {
      if (!progress.analyzedAssetId || !progress.analyzedInput) {
        return;
      }

      recordAnalyzedInputs([progress.analyzedInput]);
    },

    importCheckpoint(checkpoint: ScanCheckpoint): AndroidNativeStagingImportResult {
      if (checkpoint.analyzedInputs?.length) {
        recordAnalyzedInputs(checkpoint.analyzedInputs);
      }

      const chunkKey = buildAndroidNativeStagingChunkKey(checkpoint, state.resolvedRevision);
      const didImport = !state.importedChunkKeys.has(chunkKey);

      if (didImport) {
        state.importedChunkKeys.add(chunkKey);
        state.visibleCandidates = buildStreamingVisibleCandidates(
          options.sourceCandidates,
          state.resolvedAssetIds,
          state.analyzedInputsById,
          options.falsePositiveIds,
        );
      }

      return {
        didImport,
        chunkKey,
        visibleCandidates: state.visibleCandidates,
        scopeSelection: buildScopeSelectionFromCandidates(state.visibleCandidates),
      };
    },
  };
}
