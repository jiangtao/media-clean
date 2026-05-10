import { useCallback, useRef } from 'react';
import { Gesture, PanGesture } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import type { CleanupCandidate } from '../../domain/recognition/types';
import type { MediaGridLayout } from '../screens/screen-layout';

export interface SwipeSelectionOptions {
  candidates: CleanupCandidate[];
  selectedIds: string[];
  onSelect: (id: string) => void;
  gridLayout: MediaGridLayout;
  scrollOffset: number;
  isSelectionMode: boolean;
}

export interface SwipeSelectionResult {
  panGesture: PanGesture;
  isSwiping: boolean;
  getItemAtPosition: (x: number, y: number, scrollOffset: number) => string | null;
}

const HEADER_HEIGHT = 0; // Adjust based on actual header height if needed

export function useSwipeSelection({
  candidates,
  selectedIds,
  onSelect,
  gridLayout,
  scrollOffset,
  isSelectionMode,
}: SwipeSelectionOptions): SwipeSelectionResult {
  const isSwipingRef = useRef(false);
  const lastSelectedRef = useRef<Set<string>>(new Set());

  const getItemAtPosition = useCallback(
    (x: number, y: number, currentScrollOffset: number): string | null => {
      const relativeX = x - gridLayout.sidePadding;
      const relativeY = y + currentScrollOffset - HEADER_HEIGHT;

      // Boundary check
      if (relativeX < 0 || relativeY < 0) {
        return null;
      }

      const col = Math.floor(relativeX / (gridLayout.itemSize + gridLayout.spacing));
      const row = Math.floor(relativeY / (gridLayout.itemSize + gridLayout.spacing));

      // Column boundary check
      if (col < 0 || col >= gridLayout.columns) {
        return null;
      }

      const index = row * gridLayout.columns + col;

      if (index < 0 || index >= candidates.length) {
        return null;
      }

      return candidates[index]?.id ?? null;
    },
    [candidates, gridLayout]
  );

  const panGesture = Gesture.Pan()
    .enabled(isSelectionMode)
    .onBegin((event) => {
      isSwipingRef.current = true;
      lastSelectedRef.current.clear();

      const itemId = getItemAtPosition(event.absoluteX, event.absoluteY, scrollOffset);
      if (itemId && !lastSelectedRef.current.has(itemId)) {
        lastSelectedRef.current.add(itemId);
        runOnJS(onSelect)(itemId);
      }
    })
    .onUpdate((event) => {
      if (!isSelectionMode) {
        return;
      }

      const itemId = getItemAtPosition(event.absoluteX, event.absoluteY, scrollOffset);
      if (itemId && !lastSelectedRef.current.has(itemId)) {
        lastSelectedRef.current.add(itemId);
        runOnJS(onSelect)(itemId);
      }
    })
    .onEnd(() => {
      isSwipingRef.current = false;
      lastSelectedRef.current.clear();
    })
    .onFinalize(() => {
      isSwipingRef.current = false;
      lastSelectedRef.current.clear();
    });

  return {
    panGesture,
    isSwiping: isSwipingRef.current,
    getItemAtPosition,
  };
}
