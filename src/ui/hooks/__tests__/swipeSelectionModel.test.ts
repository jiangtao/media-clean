import { describe, expect, it } from 'vitest';
import type { CleanupCandidate } from '../../../domain/recognition/types';
import type { MediaGridLayout } from '../../screens/screen-layout';
import {
  applySwipeSelection,
  createSwipeSelectionSession,
  getIndicesInRect,
  getItemAtPosition,
  resolveSwipeSelectionGestureDecision,
  resolveSwipeSelectionIntent,
} from '../swipeSelectionModel';

const layout: MediaGridLayout = {
  columns: 3,
  itemSize: 100,
  spacing: 10,
  sidePadding: 16,
  contentWidth: 360,
  isSELike: false,
};

function candidate(id: string): CleanupCandidate {
  return {
    id,
    asset: {
      id,
      uri: `file://${id}.jpg`,
      width: 100,
      height: 100,
      mediaType: 'photo',
      creationTime: 1,
      duration: 0,
      fileSize: 1000,
    },
    score: 80,
    confidence: 'high',
    kind: 'accidental-photo',
    primaryIssueType: 'duplicate',
    issueTypes: ['duplicate'],
    reasons: [],
  };
}

const candidates = Array.from({ length: 12 }, (_, index) => candidate(String(index)));

describe('swipeSelectionModel', () => {
  describe('getItemAtPosition', () => {
    it('maps coordinates inside a grid item to the candidate index and id', () => {
      expect(getItemAtPosition(20, 10, 0, layout, candidates)).toEqual({
        id: '0',
        index: 0,
      });
      expect(getItemAtPosition(130, 10, 0, layout, candidates)).toEqual({
        id: '1',
        index: 1,
      });
    });

    it('accounts for scroll offset when mapping y coordinates', () => {
      expect(getItemAtPosition(20, 10, 110, layout, candidates)).toEqual({
        id: '3',
        index: 3,
      });
    });

    it('accounts for top content padding before the first grid item', () => {
      expect(getItemAtPosition(20, 10, 0, layout, candidates, { top: 12 })).toBeNull();
      expect(getItemAtPosition(20, 12, 0, layout, candidates, { top: 12 })).toEqual({
        id: '0',
        index: 0,
      });
      expect(getItemAtPosition(20, 122, 0, layout, candidates, { top: 12 })).toEqual({
        id: '3',
        index: 3,
      });
    });

    it('returns null for side padding, spacing, and out-of-bounds coordinates', () => {
      expect(getItemAtPosition(10, 10, 0, layout, candidates)).toBeNull();
      expect(getItemAtPosition(120, 10, 0, layout, candidates)).toBeNull();
      expect(getItemAtPosition(20, 105, 0, layout, candidates)).toBeNull();
      expect(getItemAtPosition(400, 10, 0, layout, candidates)).toBeNull();
      expect(getItemAtPosition(20, 900, 0, layout, candidates)).toBeNull();
    });
  });

  describe('getIndicesInRect', () => {
    it('returns continuous indices for a same-row horizontal selection', () => {
      expect(getIndicesInRect(0, 2, 3, candidates.length)).toEqual([0, 1, 2]);
    });

    it('returns the full rectangular area for diagonal selection', () => {
      expect(getIndicesInRect(0, 8, 3, candidates.length)).toEqual([
        0, 1, 2,
        3, 4, 5,
        6, 7, 8,
      ]);
    });

    it('clips rectangular indices to candidate count', () => {
      expect(getIndicesInRect(3, 11, 3, 10)).toEqual([3, 4, 5, 6, 7, 8, 9]);
    });
  });

  describe('resolveSwipeSelectionIntent', () => {
    it('keeps short movement as a tap candidate', () => {
      expect(resolveSwipeSelectionIntent(3, 4)).toEqual({ type: 'tap-candidate' });
    });

    it('classifies dominant vertical movement as scroll', () => {
      expect(resolveSwipeSelectionIntent(8, 36)).toEqual({ type: 'scroll' });
    });

    it('classifies horizontal and diagonal movement as selection drag', () => {
      expect(resolveSwipeSelectionIntent(18, 4)).toEqual({ type: 'selection-drag' });
      expect(resolveSwipeSelectionIntent(30, 24)).toEqual({ type: 'selection-drag' });
    });
  });

  describe('resolveSwipeSelectionGestureDecision', () => {
    it('keeps short movement pending so taps are handled by the item', () => {
      expect(resolveSwipeSelectionGestureDecision(3, 4, true)).toEqual({ type: 'pending' });
    });

    it('activates selection for horizontal, vertical, or diagonal drags that start on an item', () => {
      expect(resolveSwipeSelectionGestureDecision(18, 2, true)).toEqual({
        type: 'activate-selection',
      });
      expect(resolveSwipeSelectionGestureDecision(2, 18, true)).toEqual({
        type: 'activate-selection',
      });
      expect(resolveSwipeSelectionGestureDecision(16, 16, true)).toEqual({
        type: 'activate-selection',
      });
    });

    it('passes movement that starts outside items back to list scrolling', () => {
      expect(resolveSwipeSelectionGestureDecision(2, 18, false)).toEqual({
        type: 'pass-to-scroll',
      });
    });
  });

  describe('applySwipeSelection', () => {
    it('adds range ids from an unselected anchor using the original baseline', () => {
      const session = createSwipeSelectionSession({ id: '1', index: 1 }, ['9']);

      expect(applySwipeSelection(session, ['1', '2', '3'])).toEqual(['9', '1', '2', '3']);
    });

    it('removes range ids from a selected anchor using the original baseline', () => {
      const session = createSwipeSelectionSession({ id: '1', index: 1 }, ['1', '2', '3', '9']);

      expect(applySwipeSelection(session, ['1', '2', '3'])).toEqual(['9']);
    });

    it('restores baseline state when a later drag rectangle is smaller', () => {
      const session = createSwipeSelectionSession({ id: '1', index: 1 }, ['9']);

      expect(applySwipeSelection(session, ['1', '2', '3', '4'])).toEqual([
        '9',
        '1',
        '2',
        '3',
        '4',
      ]);
      expect(applySwipeSelection(session, ['1', '2'])).toEqual(['9', '1', '2']);
    });
  });
});
