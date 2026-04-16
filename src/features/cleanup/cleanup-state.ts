import type { CleanupCandidate } from '../../domain/recognition/types';
import { sortCandidatesByScore } from '../../domain/recognition/scoring';

export interface CleanupState {
  activeCandidates: CleanupCandidate[];
  recycleBin: CleanupCandidate[];
  selectedIds: string[];
}

export type CleanupAction =
  | {
      type: 'hydrate';
      activeCandidates: CleanupCandidate[];
      recycleBin: CleanupCandidate[];
    }
  | { type: 'set-candidates'; candidates: CleanupCandidate[] }
  | { type: 'toggle-select'; id: string }
  | { type: 'clear-selection' }
  | { type: 'soft-delete'; ids: string[] }
  | { type: 'auto-soft-delete' }
  | { type: 'restore'; ids: string[] }
  | { type: 'hard-delete'; ids: string[] };

function uniqueById(candidates: CleanupCandidate[]) {
  return Array.from(new Map(candidates.map((candidate) => [candidate.id, candidate])).values());
}

function removeIds(candidates: CleanupCandidate[], ids: Set<string>) {
  return candidates.filter((candidate) => !ids.has(candidate.id));
}

function pickIds(candidates: CleanupCandidate[], ids: Set<string>) {
  return candidates.filter((candidate) => ids.has(candidate.id));
}

function mergeSorted(candidates: CleanupCandidate[]) {
  return sortCandidatesByScore(uniqueById(candidates));
}

export function createInitialCleanupState(candidates: CleanupCandidate[]): CleanupState {
  return {
    activeCandidates: sortCandidatesByScore(candidates),
    recycleBin: [],
    selectedIds: [],
  };
}

export function applyCleanupAction(state: CleanupState, action: CleanupAction): CleanupState {
  switch (action.type) {
    case 'hydrate':
      return {
        activeCandidates: sortCandidatesByScore(action.activeCandidates),
        recycleBin: sortCandidatesByScore(action.recycleBin),
        selectedIds: [],
      };
    case 'set-candidates':
      return {
        ...state,
        activeCandidates: sortCandidatesByScore(action.candidates),
      };
    case 'toggle-select': {
      const selected = new Set(state.selectedIds);
      if (selected.has(action.id)) {
        selected.delete(action.id);
      } else {
        selected.add(action.id);
      }

      return {
        ...state,
        selectedIds: [...selected],
      };
    }
    case 'clear-selection':
      return {
        ...state,
        selectedIds: [],
      };
    case 'soft-delete': {
      const ids = new Set(action.ids);
      return {
        activeCandidates: removeIds(state.activeCandidates, ids),
        recycleBin: mergeSorted([...state.recycleBin, ...pickIds(state.activeCandidates, ids)]),
        selectedIds: state.selectedIds.filter((id) => !ids.has(id)),
      };
    }
    case 'auto-soft-delete': {
      const ids = new Set(
        state.activeCandidates
          .filter((candidate) => candidate.confidence === 'high')
          .map((candidate) => candidate.id),
      );

      return {
        activeCandidates: removeIds(state.activeCandidates, ids),
        recycleBin: mergeSorted([...state.recycleBin, ...pickIds(state.activeCandidates, ids)]),
        selectedIds: state.selectedIds.filter((id) => !ids.has(id)),
      };
    }
    case 'restore': {
      const ids = new Set(action.ids);
      return {
        activeCandidates: mergeSorted([...state.activeCandidates, ...pickIds(state.recycleBin, ids)]),
        recycleBin: removeIds(state.recycleBin, ids),
        selectedIds: state.selectedIds.filter((id) => !ids.has(id)),
      };
    }
    case 'hard-delete': {
      const ids = new Set(action.ids);
      return {
        activeCandidates: removeIds(state.activeCandidates, ids),
        recycleBin: removeIds(state.recycleBin, ids),
        selectedIds: state.selectedIds.filter((id) => !ids.has(id)),
      };
    }
    default:
      return state;
  }
}
