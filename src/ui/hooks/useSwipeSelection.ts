import { useCallback, useEffect, useRef } from 'react';
import {
  Gesture,
  type PanGesture,
} from 'react-native-gesture-handler';
import { runOnJS, useSharedValue } from 'react-native-reanimated';
import type { CleanupCandidate } from '../../domain/recognition/types';
import type { MediaGridLayout } from '../screens/screen-layout';
import {
  applySwipeSelection,
  createSwipeSelectionSession,
  getIndicesInRect,
  getItemAtPosition as getModelItemAtPosition,
  type SwipeSelectionReason,
  type SwipeSelectionSession,
} from './swipeSelectionModel';

export type {
  SwipeSelectionAction,
  SwipeSelectionGestureDecision,
  SwipeSelectionIntent,
  SwipeSelectionReason,
} from './swipeSelectionModel';

export interface SwipeSelectionOptions {
  candidates: CleanupCandidate[];
  selectedIds: string[];
  onSelectionChange?: (nextIds: string[], reason: SwipeSelectionReason) => void;
  gridLayout: MediaGridLayout;
  scrollOffset: number;
  contentTopOffset?: number;
  isSelectionMode: boolean;
}

export interface SwipeSelectionResult {
  panGesture: PanGesture;
  isSwiping: boolean;
  getItemAtPosition: (x: number, y: number, scrollOffset: number) => string | null;
}

const TAP_DISTANCE = 8;

export function useSwipeSelection({
  candidates,
  selectedIds,
  onSelectionChange,
  gridLayout,
  scrollOffset,
  contentTopOffset = 0,
  isSelectionMode,
}: SwipeSelectionOptions): SwipeSelectionResult {
  const isSwipingRef = useRef(false);
  const selectedIdsRef = useRef(selectedIds);
  const scrollOffsetRef = useRef(scrollOffset);
  const sessionRef = useRef<SwipeSelectionSession | null>(null);
  const lastRangeKeyRef = useRef<string | null>(null);
  const gestureStartX = useSharedValue(0);
  const gestureStartY = useSharedValue(0);
  const gestureHasStart = useSharedValue(false);
  const gestureStartsOnItem = useSharedValue(false);
  const gestureScrollOffset = useSharedValue(scrollOffset);

  selectedIdsRef.current = selectedIds;
  scrollOffsetRef.current = scrollOffset;

  useEffect(() => {
    gestureScrollOffset.value = scrollOffset;
  }, [gestureScrollOffset, scrollOffset]);

  const getItemAtPosition = useCallback(
    (x: number, y: number, currentScrollOffset: number) =>
      getModelItemAtPosition(x, y, currentScrollOffset, gridLayout, candidates, {
        top: contentTopOffset,
      }),
    [candidates, contentTopOffset, gridLayout],
  );

  const resetSwipeSession = useCallback(() => {
    isSwipingRef.current = false;
    sessionRef.current = null;
    lastRangeKeyRef.current = null;
  }, []);

  const updateSelectionFromPosition = useCallback(
    (x: number, y: number) => {
      const session = sessionRef.current;
      if (!session || !onSelectionChange) {
        return;
      }

      const currentItem = getItemAtPosition(x, y, scrollOffsetRef.current);
      if (!currentItem) {
        return;
      }

      const indices = getIndicesInRect(
        session.anchorIndex,
        currentItem.index,
        gridLayout.columns,
        candidates.length,
      );
      const rangeIds = indices
        .map((index) => candidates[index]?.id)
        .filter((id): id is string => Boolean(id));
      const rangeKey = `${session.action}:${rangeIds.join('|')}`;

      if (lastRangeKeyRef.current === rangeKey) {
        return;
      }

      lastRangeKeyRef.current = rangeKey;

      const nextIds = applySwipeSelection(session, rangeIds);

      onSelectionChange(nextIds, {
        source: 'swipe-selection',
        action: session.action,
        anchorId: session.anchorId,
        rangeIds,
      });
    },
    [candidates, getItemAtPosition, gridLayout.columns, onSelectionChange],
  );

  const startSwipeSelection = useCallback(
    (x: number, y: number) => {
      if (!isSelectionMode || !onSelectionChange) {
        return;
      }

      const anchorItem = getItemAtPosition(x, y, scrollOffsetRef.current);
      if (!anchorItem) {
        resetSwipeSession();
        return;
      }

      isSwipingRef.current = true;
      sessionRef.current = createSwipeSelectionSession(anchorItem, selectedIdsRef.current);
      lastRangeKeyRef.current = null;
      updateSelectionFromPosition(x, y);
    },
    [
      getItemAtPosition,
      isSelectionMode,
      onSelectionChange,
      resetSwipeSession,
      updateSelectionFromPosition,
    ],
  );

  const panGesture = Gesture.Pan()
    .enabled(isSelectionMode && Boolean(onSelectionChange))
    .manualActivation(true)
    .onTouchesDown((event) => {
      const touch = event.allTouches[0] ?? event.changedTouches[0] ?? null;
      if (touch) {
        const stride = gridLayout.itemSize + gridLayout.spacing;
        const relativeX = touch.x - gridLayout.sidePadding;
        const relativeY = touch.y + gestureScrollOffset.value - contentTopOffset;
        let startsOnItem = false;

        if (relativeX >= 0 && relativeY >= 0) {
          const xInItem = relativeX % stride;
          const yInItem = relativeY % stride;
          const col = Math.floor(relativeX / stride);
          const row = Math.floor(relativeY / stride);
          const index = row * gridLayout.columns + col;

          startsOnItem =
            xInItem >= 0 &&
            xInItem < gridLayout.itemSize &&
            yInItem >= 0 &&
            yInItem < gridLayout.itemSize &&
            col >= 0 &&
            col < gridLayout.columns &&
            index >= 0 &&
            index < candidates.length;
        }

        gestureStartX.value = touch.x;
        gestureStartY.value = touch.y;
        gestureHasStart.value = true;
        gestureStartsOnItem.value = startsOnItem;
      }
    })
    .onTouchesMove((event, stateManager) => {
      const touch = event.allTouches[0] ?? event.changedTouches[0] ?? null;
      if (touch) {
        if (!gestureHasStart.value) {
          gestureStartX.value = touch.x;
          gestureStartY.value = touch.y;
          gestureHasStart.value = true;
          return;
        }

        const deltaX = touch.x - gestureStartX.value;
        const deltaY = touch.y - gestureStartY.value;
        const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

        if (distance <= TAP_DISTANCE) {
          return;
        }

        if (gestureStartsOnItem.value) {
          stateManager.activate();
        } else {
          stateManager.fail();
          gestureHasStart.value = false;
        }
      }
    })
    .onStart((event) => {
      const startX = gestureHasStart.value ? gestureStartX.value : event.x;
      const startY = gestureHasStart.value ? gestureStartY.value : event.y;
      runOnJS(startSwipeSelection)(startX, startY);
    })
    .onUpdate((event) => {
      runOnJS(updateSelectionFromPosition)(event.x, event.y);
    })
    .onEnd(() => {
      gestureHasStart.value = false;
      runOnJS(resetSwipeSession)();
    })
    .onFinalize(() => {
      gestureHasStart.value = false;
      runOnJS(resetSwipeSession)();
    });

  return {
    panGesture,
    isSwiping: isSwipingRef.current,
    getItemAtPosition: useCallback(
      (x: number, y: number, currentScrollOffset: number) =>
        getItemAtPosition(x, y, currentScrollOffset)?.id ?? null,
      [getItemAtPosition],
    ),
  };
}
