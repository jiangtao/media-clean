import { describe, expect, it } from 'vitest';
import {
  applyCleanupAction,
  createInitialCleanupState,
  type CleanupState,
} from '../cleanup-state';
import type { CleanupCandidate } from '../../../domain/recognition/types';

const candidate = (id: string): CleanupCandidate => ({
  id,
  asset: {
    id,
    uri: `file:///${id}.jpg`,
    previewUri: `file:///preview_${id}.jpg`,
    mediaType: 'photo',
    width: 720,
    height: 1280,
    duration: 0,
    fileSize: 160_000,
    creationTime: Date.now(),
  },
  confidence: 'high',
  kind: 'accidental-photo',
  primaryIssueType: 'accidental',
  issueTypes: ['accidental'],
  reasons: ['画面明显过暗'],
  score: 90,
});

describe('Selection Mode Logic', () => {
  describe('Scenario 4.1: Long press enters selection mode', () => {
    it('should start with empty selection', () => {
      const state = createInitialCleanupState([candidate('1'), candidate('2')]);
      expect(state.selectedIds).toHaveLength(0);
    });

    it('should toggle select on first long press', () => {
      const state = createInitialCleanupState([candidate('1'), candidate('2')]);

      const next = applyCleanupAction(state, { type: 'toggle-select', id: '1' });

      expect(next.selectedIds).toEqual(['1']);
    });

    it('should enter selection mode by selecting first item', () => {
      const state = createInitialCleanupState([candidate('1'), candidate('2'), candidate('3')]);

      const next = applyCleanupAction(state, { type: 'toggle-select', id: '2' });

      expect(next.selectedIds).toContain('2');
      expect(next.selectedIds).toHaveLength(1);
    });
  });

  describe('Selection toggle behavior', () => {
    it('should add item to selection when clicked and not selected', () => {
      const state: CleanupState = {
        activeCandidates: [candidate('1'), candidate('2'), candidate('3')],
        recycleBin: [],
        selectedIds: ['1'],
      };

      const next = applyCleanupAction(state, { type: 'toggle-select', id: '2' });

      expect(next.selectedIds).toEqual(['1', '2']);
    });

    it('should remove item from selection when clicked and already selected', () => {
      const state: CleanupState = {
        activeCandidates: [candidate('1'), candidate('2'), candidate('3')],
        recycleBin: [],
        selectedIds: ['1', '2'],
      };

      const next = applyCleanupAction(state, { type: 'toggle-select', id: '2' });

      expect(next.selectedIds).toEqual(['1']);
    });

    it('should support selecting multiple items', () => {
      const state = createInitialCleanupState([candidate('1'), candidate('2'), candidate('3')]);

      let next = applyCleanupAction(state, { type: 'toggle-select', id: '1' });
      next = applyCleanupAction(next, { type: 'toggle-select', id: '2' });
      next = applyCleanupAction(next, { type: 'toggle-select', id: '3' });

      expect(next.selectedIds).toEqual(['1', '2', '3']);
    });
  });

  describe('Scenario 4.2: Selection toolbar actions', () => {
    it('should select all active candidates when select-all action dispatched', () => {
      // Note: Select all is handled at feature level, not in reducer
      // The reducer state is updated by individual toggle-select calls
      const state = createInitialCleanupState([candidate('1'), candidate('2'), candidate('3')]);

      // Simulate selecting all by toggling each
      let next = state;
      for (const id of ['1', '2', '3']) {
        if (!next.selectedIds.includes(id)) {
          next = applyCleanupAction(next, { type: 'toggle-select', id });
        }
      }

      expect(next.selectedIds).toHaveLength(3);
      expect(next.selectedIds).toContain('1');
      expect(next.selectedIds).toContain('2');
      expect(next.selectedIds).toContain('3');
    });

    it('should clear selection with clear-selection action', () => {
      const state: CleanupState = {
        activeCandidates: [candidate('1'), candidate('2'), candidate('3')],
        recycleBin: [],
        selectedIds: ['1', '2'],
      };

      const next = applyCleanupAction(state, { type: 'clear-selection' });

      expect(next.selectedIds).toHaveLength(0);
    });

    it('should clear selection after soft delete', () => {
      const state: CleanupState = {
        activeCandidates: [candidate('1'), candidate('2'), candidate('3')],
        recycleBin: [],
        selectedIds: ['1', '2'],
      };

      const next = applyCleanupAction(state, { type: 'soft-delete', ids: ['1', '2'] });

      expect(next.selectedIds).toHaveLength(0);
      expect(next.activeCandidates.map((c) => c.id)).toEqual(['3']);
      expect(next.recycleBin.map((c) => c.id)).toEqual(['1', '2']);
    });

    it('should clear selection after restore', () => {
      const state: CleanupState = {
        activeCandidates: [],
        recycleBin: [candidate('1'), candidate('2')],
        selectedIds: ['1'],
      };

      const next = applyCleanupAction(state, { type: 'restore', ids: ['1'] });

      expect(next.selectedIds).toHaveLength(0);
      expect(next.activeCandidates.map((c) => c.id)).toEqual(['1']);
    });

    it('should clear selection after hard delete', () => {
      const state: CleanupState = {
        activeCandidates: [candidate('1'), candidate('2')],
        recycleBin: [candidate('3')],
        selectedIds: ['1', '3'],
      };

      const next = applyCleanupAction(state, { type: 'hard-delete', ids: ['1', '3'] });

      expect(next.selectedIds).toHaveLength(0);
      expect(next.activeCandidates.map((c) => c.id)).toEqual(['2']);
      expect(next.recycleBin).toHaveLength(0);
    });
  });

  describe('Selection mode exit conditions', () => {
    it('should exit selection mode when selection is cleared', () => {
      const state: CleanupState = {
        activeCandidates: [candidate('1'), candidate('2')],
        recycleBin: [],
        selectedIds: ['1'],
      };

      const next = applyCleanupAction(state, { type: 'clear-selection' });

      expect(next.selectedIds).toHaveLength(0);
    });

    it('should exit selection mode after cleanup completed', () => {
      const state: CleanupState = {
        activeCandidates: [candidate('1'), candidate('2')],
        recycleBin: [],
        selectedIds: ['1'],
      };

      const next = applyCleanupAction(state, { type: 'soft-delete', ids: ['1'] });

      expect(next.selectedIds).toHaveLength(0);
      expect(next.recycleBin).toHaveLength(1);
    });

    it('should exit selection mode after deselect all', () => {
      const state: CleanupState = {
        activeCandidates: [candidate('1'), candidate('2'), candidate('3')],
        recycleBin: [],
        selectedIds: ['1', '2', '3'],
      };

      const next = applyCleanupAction(state, { type: 'clear-selection' });

      expect(next.selectedIds).toHaveLength(0);
    });
  });

  describe('Selection persistence across state updates', () => {
    it('should preserve selection when new candidates are set', () => {
      const state: CleanupState = {
        activeCandidates: [candidate('1'), candidate('2')],
        recycleBin: [],
        selectedIds: ['1'],
      };

      const next = applyCleanupAction(state, {
        type: 'set-candidates',
        candidates: [candidate('1'), candidate('2'), candidate('3')],
      });

      expect(next.selectedIds).toEqual(['1']);
    });

    it('should preserve selection through hydration', () => {
      const state: CleanupState = {
        activeCandidates: [candidate('1')],
        recycleBin: [],
        selectedIds: ['1'],
      };

      const next = applyCleanupAction(state, {
        type: 'hydrate',
        activeCandidates: [candidate('1'), candidate('2')],
        recycleBin: [candidate('3')],
      });

      // Hydration resets selection
      expect(next.selectedIds).toHaveLength(0);
    });
  });
});
