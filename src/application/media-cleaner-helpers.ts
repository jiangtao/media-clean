import type { CleanupAction, CleanupState } from '../features/cleanup/cleanup-state';
import type { ScanSummary } from '../features/scan/scan-media-library';
import type { LastScanMeta } from '../services/storage/app-storage';

type ViewMode = 'suggestions' | 'recycle';
type PreviewPrimaryActionMode = 'soft-delete' | 'restore';

function normalizeIds(ids: string[]) {
  return Array.from(new Set(ids)).sort();
}

export function resolvePreviewPrimaryActionMode(viewMode: ViewMode): PreviewPrimaryActionMode {
  return viewMode === 'recycle' ? 'restore' : 'soft-delete';
}

export function derivePersistedRecycleBinIds(
  currentIds: string[],
  nextVisibleIds: string[],
  action: CleanupAction,
) {
  const ids = new Set([...currentIds, ...nextVisibleIds]);

  if (action.type === 'restore' || action.type === 'hard-delete') {
    for (const id of action.ids) {
      ids.delete(id);
    }
  }

  return normalizeIds([...ids]);
}

export function createSummaryFromState(
  state: CleanupState,
  previous: LastScanMeta | null,
): ScanSummary {
  const allCandidates = [...state.activeCandidates, ...state.recycleBin];

  return {
    scannedAt: previous?.scannedAt ?? Date.now(),
    scannedCount: previous?.scannedCount ?? 0,
    candidateCount: allCandidates.length > 0 ? allCandidates.length : previous?.candidateCount ?? 0,
    highConfidenceCount: allCandidates.filter((candidate) => candidate.confidence === 'high').length,
    mediumConfidenceCount: allCandidates.filter((candidate) => candidate.confidence === 'medium').length,
    recycleBinCount: state.recycleBin.length,
  };
}
