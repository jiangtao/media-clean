import type { CleanupCandidate } from '../../domain/recognition/types';
import type { MediaGridLayout } from '../screens/screen-layout';

export type SwipeSelectionAction = 'add' | 'remove';

export type SwipeSelectionIntent =
  | { type: 'tap-candidate' }
  | { type: 'scroll' }
  | { type: 'selection-drag' };

export type SwipeSelectionGestureDecision =
  | { type: 'pending' }
  | { type: 'activate-selection' }
  | { type: 'pass-to-scroll' };

export interface SwipeSelectionReason {
  source: 'swipe-selection';
  action: SwipeSelectionAction;
  anchorId: string;
  rangeIds: string[];
}

export interface SwipeSelectionSession {
  baselineIds: Set<string>;
  anchorIndex: number;
  anchorId: string;
  action: SwipeSelectionAction;
}

export interface SwipeSelectionPositionResult {
  id: string;
  index: number;
}

export interface SwipeSelectionIntentThresholds {
  tapDistance: number;
  selectionDragX: number;
  scrollY: number;
}

export interface SwipeSelectionGridOffsets {
  top?: number;
}

const DEFAULT_INTENT_THRESHOLDS: SwipeSelectionIntentThresholds = {
  tapDistance: 8,
  selectionDragX: 14,
  scrollY: 36,
};

function isInsideItemAxis(relativeValue: number, itemSize: number, spacing: number) {
  const stride = itemSize + spacing;
  const axisOffset = relativeValue % stride;

  return axisOffset >= 0 && axisOffset < itemSize;
}

export function getItemAtPosition(
  x: number,
  y: number,
  scrollOffset: number,
  layout: MediaGridLayout,
  candidates: readonly CleanupCandidate[],
  offsets: SwipeSelectionGridOffsets = {},
): SwipeSelectionPositionResult | null {
  const stride = layout.itemSize + layout.spacing;
  const relativeX = x - layout.sidePadding;
  const relativeY = y + scrollOffset - (offsets.top ?? 0);

  if (relativeX < 0 || relativeY < 0) {
    return null;
  }

  if (
    !isInsideItemAxis(relativeX, layout.itemSize, layout.spacing) ||
    !isInsideItemAxis(relativeY, layout.itemSize, layout.spacing)
  ) {
    return null;
  }

  const col = Math.floor(relativeX / stride);
  const row = Math.floor(relativeY / stride);

  if (col < 0 || col >= layout.columns) {
    return null;
  }

  const index = row * layout.columns + col;
  const candidate = candidates[index];

  if (!candidate) {
    return null;
  }

  return { id: candidate.id, index };
}

export function getIndicesInRect(
  anchorIndex: number,
  currentIndex: number,
  columns: number,
  candidateCount: number,
) {
  if (
    anchorIndex < 0 ||
    currentIndex < 0 ||
    columns <= 0 ||
    candidateCount <= 0
  ) {
    return [];
  }

  const startRow = Math.floor(anchorIndex / columns);
  const startCol = anchorIndex % columns;
  const endRow = Math.floor(currentIndex / columns);
  const endCol = currentIndex % columns;
  const minRow = Math.min(startRow, endRow);
  const maxRow = Math.max(startRow, endRow);
  const minCol = Math.min(startCol, endCol);
  const maxCol = Math.max(startCol, endCol);
  const indices: number[] = [];

  for (let row = minRow; row <= maxRow; row += 1) {
    for (let col = minCol; col <= maxCol; col += 1) {
      const index = row * columns + col;

      if (index >= 0 && index < candidateCount) {
        indices.push(index);
      }
    }
  }

  return indices;
}

export function resolveSwipeSelectionIntent(
  deltaX: number,
  deltaY: number,
  thresholds: Partial<SwipeSelectionIntentThresholds> = {},
): SwipeSelectionIntent {
  const resolvedThresholds = {
    ...DEFAULT_INTENT_THRESHOLDS,
    ...thresholds,
  };
  const absX = Math.abs(deltaX);
  const absY = Math.abs(deltaY);
  const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

  if (distance <= resolvedThresholds.tapDistance) {
    return { type: 'tap-candidate' };
  }

  if (
    absY >= resolvedThresholds.scrollY &&
    absY > absX
  ) {
    return { type: 'scroll' };
  }

  if (absX >= resolvedThresholds.selectionDragX) {
    return { type: 'selection-drag' };
  }

  return { type: 'tap-candidate' };
}

export function resolveSwipeSelectionGestureDecision(
  deltaX: number,
  deltaY: number,
  hasAnchorItem: boolean,
  thresholds: Partial<SwipeSelectionIntentThresholds> = {},
): SwipeSelectionGestureDecision {
  const resolvedThresholds = {
    ...DEFAULT_INTENT_THRESHOLDS,
    ...thresholds,
  };
  const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

  if (distance <= resolvedThresholds.tapDistance) {
    return { type: 'pending' };
  }

  if (hasAnchorItem) {
    return { type: 'activate-selection' };
  }

  return { type: 'pass-to-scroll' };
}

export function createSwipeSelectionSession(
  anchor: SwipeSelectionPositionResult,
  selectedIds: readonly string[],
): SwipeSelectionSession {
  const baselineIds = new Set(selectedIds);

  return {
    baselineIds,
    anchorIndex: anchor.index,
    anchorId: anchor.id,
    action: baselineIds.has(anchor.id) ? 'remove' : 'add',
  };
}

export function applySwipeSelection(
  session: SwipeSelectionSession,
  rangeIds: readonly string[],
) {
  const nextIds = new Set(session.baselineIds);

  for (const id of rangeIds) {
    if (session.action === 'add') {
      nextIds.add(id);
    } else {
      nextIds.delete(id);
    }
  }

  return [...nextIds];
}
