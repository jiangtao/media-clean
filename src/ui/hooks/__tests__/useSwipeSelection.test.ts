import { beforeAll, describe, expect, it, vi } from 'vitest';
import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import type { CleanupCandidate } from '../../../domain/recognition/types';
import type { MediaGridLayout } from '../../screens/screen-layout';
import {
  applySwipeSelection,
  createSwipeSelectionSession,
  getIndicesInRect,
  getItemAtPosition as getItemAtGridPosition,
  resolveSwipeSelectionIntent,
  type SwipeSelectionSession,
} from '../swipeSelectionModel';

interface SwipeSelectionOptions {
  candidates: CleanupCandidate[];
  selectedIds: string[];
  onSelectionChange?: (
    nextIds: string[],
    reason: {
      source: 'swipe-selection';
      action: 'add' | 'remove';
      anchorId: string;
      rangeIds: string[];
    },
  ) => void;
  gridLayout: MediaGridLayout;
  scrollOffset: number;
  contentTopOffset?: number;
  isSelectionMode: boolean;
}

type SwipeSelectionHook = (options: SwipeSelectionOptions) => {
  panGesture: unknown;
  isSwiping: boolean;
  getItemAtPosition: (x: number, y: number, scrollOffset: number) => string | null;
};

type SwipeSelectionResult = ReturnType<SwipeSelectionHook>;
type GestureHandlerEvent = {
  x?: number;
  y?: number;
  allTouches?: Array<{ x: number; y: number }>;
  changedTouches?: Array<{ x: number; y: number }>;
};
type MockGestureStateManager = {
  activate: ReturnType<typeof vi.fn>;
  fail: ReturnType<typeof vi.fn>;
};
type GestureHandlers = Record<
  string,
  (event?: GestureHandlerEvent, stateManager?: MockGestureStateManager) => void
>;

let useSwipeSelection: SwipeSelectionHook;

const createGestureHandlerMock = () => {
  const createPanGesture = () => {
    const handlers: Record<string, unknown> = {};
    const methodCache = new Map<string, ReturnType<typeof vi.fn>>();
    const target = {
      handlers,
    };

    const gesture = new Proxy(target, {
      get(proxyTarget, prop: string) {
        if (prop in proxyTarget) {
          return proxyTarget[prop as keyof typeof proxyTarget];
        }

        if (!methodCache.has(prop)) {
          methodCache.set(
            prop,
            vi.fn((handler: unknown) => {
              if (typeof handler === 'function') {
                handlers[prop] = handler;
              }

              return gesture;
            }),
          );
        }

        return methodCache.get(prop);
      },
    });

    return gesture;
  };

  return {
    Gesture: {
      Pan: createPanGesture,
    },
  };
};

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('useSwipeSelection', () => {
  beforeAll(async () => {
    vi.doMock('react-native-gesture-handler', createGestureHandlerMock);
    const module = await import('../useSwipeSelection');
    useSwipeSelection = module.useSwipeSelection;
  });

  const createCandidate = (index: number): CleanupCandidate => ({
    id: `item-${index}`,
    asset: {
      id: `asset-${index}`,
      uri: `photo${index}.jpg`,
      width: 100,
      height: 100,
      mediaType: 'photo',
      creationTime: Date.now(),
      duration: 0,
      fileSize: 1000,
    },
    score: 80,
    confidence: 'high',
    kind: 'accidental-photo',
    primaryIssueType: 'duplicate',
    issueTypes: ['duplicate'],
    reasons: ['blurry image detected'],
  });

  const mockCandidates: CleanupCandidate[] = Array.from(
    { length: 9 },
    (_, index) => createCandidate(index),
  );

  const mockGridLayout: MediaGridLayout = {
    columns: 3,
    itemSize: 100,
    spacing: 10,
    sidePadding: 16,
    contentWidth: 300,
    isSELike: false,
  };
  const candidateIds = mockCandidates.map((candidate) => candidate.id);
  const createSession = (
    action: 'add' | 'remove',
    baselineIds: string[],
    anchorId = 'item-1',
    anchorIndex = 1,
  ): SwipeSelectionSession => ({
    action,
    baselineIds: new Set(baselineIds),
    anchorId,
    anchorIndex,
  });

  const renderSwipeSelection = (
    overrides: Partial<SwipeSelectionOptions> = {},
  ) => {
    const onSelectionChange = vi.fn();
    let current: SwipeSelectionResult | undefined;

    function HookHarness() {
      current = useSwipeSelection({
          candidates: mockCandidates,
          selectedIds: [],
          onSelectionChange,
          gridLayout: mockGridLayout,
          scrollOffset: 0,
          isSelectionMode: true,
          ...overrides,
      });

      return null;
    }

    act(() => {
      TestRenderer.create(React.createElement(HookHarness));
    });

    if (!current) {
      throw new Error('useSwipeSelection did not render');
    }

    return {
      onSelectionChange,
      result: {
        current,
      },
    };
  };
  const getGestureHandlers = (panGesture: unknown): GestureHandlers => {
    const handlers = (panGesture as { handlers?: GestureHandlers }).handlers;

    if (!handlers) {
      throw new Error('pan gesture handlers were not captured');
    }

    return handlers;
  };
  const touchEvent = (x: number, y: number): GestureHandlerEvent => ({
    allTouches: [{ x, y }],
    changedTouches: [{ x, y }],
  });
  const createStateManager = (): MockGestureStateManager => ({
    activate: vi.fn(),
    fail: vi.fn(),
  });

  it('should return panGesture when selection mode is enabled', async () => {
    const { result } = renderSwipeSelection();

    expect(result.current.panGesture).toBeDefined();
    expect(result.current.isSwiping).toBe(false);
  });

  it('getItemAtGridPosition maps coordinates to item ids and indices', () => {
    expect(getItemAtGridPosition(16, 0, 0, mockGridLayout, mockCandidates)).toEqual({
      id: 'item-0',
      index: 0,
    });
    expect(getItemAtGridPosition(115, 99, 0, mockGridLayout, mockCandidates)).toEqual({
      id: 'item-0',
      index: 0,
    });
    expect(getItemAtGridPosition(126, 0, 0, mockGridLayout, mockCandidates)).toEqual({
      id: 'item-1',
      index: 1,
    });
    expect(getItemAtGridPosition(236, 110, 0, mockGridLayout, mockCandidates)).toEqual({
      id: 'item-5',
      index: 5,
    });
  });

  it('should calculate correct item index from position', async () => {
    const { result } = renderSwipeSelection();

    expect(result.current.getItemAtPosition(16, 0, 0)).toBe('item-0');
    expect(result.current.getItemAtPosition(115, 99, 0)).toBe('item-0');
    expect(result.current.getItemAtPosition(126, 0, 0)).toBe('item-1');
    expect(result.current.getItemAtPosition(236, 110, 0)).toBe('item-5');
  });

  it('getItemAtGridPosition returns null in padding, spacing, or outside the grid', () => {
    expect(getItemAtGridPosition(15, 0, 0, mockGridLayout, mockCandidates)).toBeNull();
    expect(getItemAtGridPosition(116, 10, 0, mockGridLayout, mockCandidates)).toBeNull();
    expect(getItemAtGridPosition(20, 100, 0, mockGridLayout, mockCandidates)).toBeNull();
    expect(getItemAtGridPosition(346, 0, 0, mockGridLayout, mockCandidates)).toBeNull();
    expect(getItemAtGridPosition(20, -1, 0, mockGridLayout, mockCandidates)).toBeNull();
  });

  it('returns null when the point is in padding, spacing, or outside the grid through the hook adapter', async () => {
    const { result } = renderSwipeSelection();

    expect(result.current.getItemAtPosition(15, 0, 0)).toBeNull();
    expect(result.current.getItemAtPosition(116, 10, 0)).toBeNull();
    expect(result.current.getItemAtPosition(20, 100, 0)).toBeNull();
    expect(result.current.getItemAtPosition(346, 0, 0)).toBeNull();
    expect(result.current.getItemAtPosition(20, -1, 0)).toBeNull();
  });

  it('getItemAtGridPosition considers scroll offset in calculation', () => {
    expect(getItemAtGridPosition(16, 0, 110, mockGridLayout, mockCandidates)).toEqual({
      id: 'item-3',
      index: 3,
    });
    expect(getItemAtGridPosition(126, 0, 110, mockGridLayout, mockCandidates)).toEqual({
      id: 'item-4',
      index: 4,
    });
  });

  it('should consider scroll offset in calculation', async () => {
    const { result } = renderSwipeSelection({ scrollOffset: 110 });

    expect(result.current.getItemAtPosition(16, 0, 110)).toBe('item-3');
    expect(result.current.getItemAtPosition(126, 0, 110)).toBe('item-4');
  });

  it('should consider content top offset in calculation', async () => {
    const { result } = renderSwipeSelection({ contentTopOffset: 12 });

    expect(result.current.getItemAtPosition(16, 10, 0)).toBeNull();
    expect(result.current.getItemAtPosition(16, 12, 0)).toBe('item-0');
  });

  it('should return null for out-of-bounds coordinates', async () => {
    const { result } = renderSwipeSelection();

    const itemId = result.current.getItemAtPosition(-100, -100, 0);
    expect(itemId).toBeNull();
  });

  it('should handle empty candidates array', async () => {
    const { result } = renderSwipeSelection({ candidates: [] });

    expect(result.current.panGesture).toBeDefined();
  });

  it('should not swipe when selection mode is disabled', async () => {
    const { result } = renderSwipeSelection({ isSelectionMode: false });

    expect(result.current.panGesture).toBeDefined();
  });

  it('records the touch start without selecting until the pan gesture activates', () => {
    const { onSelectionChange, result } = renderSwipeSelection();
    const handlers = getGestureHandlers(result.current.panGesture);

    handlers.onTouchesDown?.(touchEvent(106, 0));

    expect(onSelectionChange).not.toHaveBeenCalled();

    handlers.onStart?.({ x: 126, y: 0 });

    expect(onSelectionChange).toHaveBeenCalledWith(
      ['item-0'],
      {
        source: 'swipe-selection',
        action: 'add',
        anchorId: 'item-0',
        rangeIds: ['item-0'],
      },
    );
  });

  it('activates swipe selection for vertical drags that start on a grid item', () => {
    const { onSelectionChange, result } = renderSwipeSelection();
    const handlers = getGestureHandlers(result.current.panGesture);
    const stateManager = createStateManager();

    handlers.onTouchesDown?.(touchEvent(16, 0));
    handlers.onTouchesMove?.(touchEvent(16, 120), stateManager);
    handlers.onStart?.({ x: 16, y: 0 });
    handlers.onUpdate?.({ x: 16, y: 120 });

    expect(stateManager.activate).toHaveBeenCalled();
    expect(stateManager.fail).not.toHaveBeenCalled();
    expect(onSelectionChange).toHaveBeenLastCalledWith(
      ['item-0', 'item-3'],
      {
        source: 'swipe-selection',
        action: 'add',
        anchorId: 'item-0',
        rangeIds: ['item-0', 'item-3'],
      },
    );
  });

  it('fails the pan gesture so FlatList can scroll when movement starts in grid spacing', () => {
    const { onSelectionChange, result } = renderSwipeSelection();
    const handlers = getGestureHandlers(result.current.panGesture);
    const stateManager = createStateManager();

    handlers.onTouchesDown?.(touchEvent(116, 0));
    handlers.onTouchesMove?.(touchEvent(116, 120), stateManager);

    expect(stateManager.fail).toHaveBeenCalled();
    expect(stateManager.activate).not.toHaveBeenCalled();
    expect(onSelectionChange).not.toHaveBeenCalled();
  });

  it('updates selection from the baseline as the drag rectangle grows', () => {
    const { onSelectionChange, result } = renderSwipeSelection({ selectedIds: ['item-4'] });
    const handlers = getGestureHandlers(result.current.panGesture);

    handlers.onBegin?.({ x: 16, y: 0 });
    handlers.onStart?.({ x: 30, y: 0 });
    handlers.onUpdate?.({ x: 236, y: 0 });

    expect(onSelectionChange).toHaveBeenLastCalledWith(
      ['item-4', 'item-0', 'item-1', 'item-2'],
      {
        source: 'swipe-selection',
        action: 'add',
        anchorId: 'item-0',
        rangeIds: ['item-0', 'item-1', 'item-2'],
      },
    );
  });

  it('removes ids from the baseline when dragging from an already selected anchor', () => {
    const { onSelectionChange, result } = renderSwipeSelection({
      selectedIds: ['item-0', 'item-1', 'item-2', 'item-4'],
    });
    const handlers = getGestureHandlers(result.current.panGesture);

    handlers.onBegin?.({ x: 16, y: 0 });
    handlers.onStart?.({ x: 30, y: 0 });
    handlers.onUpdate?.({ x: 236, y: 0 });

    expect(onSelectionChange).toHaveBeenLastCalledWith(
      ['item-4'],
      {
        source: 'swipe-selection',
        action: 'remove',
        anchorId: 'item-0',
        rangeIds: ['item-0', 'item-1', 'item-2'],
      },
    );
  });

  it('resolveSwipeSelectionIntent keeps taps, vertical scroll, and selection drag distinct', () => {
    expect(resolveSwipeSelectionIntent(2, 3)).toEqual({ type: 'tap-candidate' });
    expect(resolveSwipeSelectionIntent(4, 36)).toEqual({ type: 'scroll' });
    expect(resolveSwipeSelectionIntent(16, 8)).toEqual({ type: 'selection-drag' });
  });

  it('getIndicesInRect returns a continuous row range for horizontal same-row drags', () => {
    expect(getIndicesInRect(3, 5, 3, mockCandidates.length)).toEqual([3, 4, 5]);
    expect(getIndicesInRect(5, 3, 3, mockCandidates.length)).toEqual([3, 4, 5]);
  });

  it('getIndicesInRect returns every item in the diagonal rectangle, not only the diagonal path', () => {
    expect(getIndicesInRect(0, 8, 3, mockCandidates.length)).toEqual([
      0, 1, 2,
      3, 4, 5,
      6, 7, 8,
    ]);
  });

  it('applySwipeSelection adds covered ids when the anchor item starts unselected', () => {
    const nextIds = applySwipeSelection(
      createSwipeSelectionSession(
        getItemAtGridPosition(16, 0, 0, mockGridLayout, mockCandidates)!,
        ['item-4'],
      ),
      ['item-0', 'item-1', 'item-2'],
    );

    expect(new Set(nextIds)).toEqual(new Set(['item-0', 'item-1', 'item-2', 'item-4']));
  });

  it('applySwipeSelection removes covered ids when the anchor item starts selected', () => {
    const nextIds = applySwipeSelection(
      createSession('remove', ['item-1', 'item-2', 'item-3', 'item-4', 'item-5']),
      ['item-1', 'item-2', 'item-3'],
    );

    expect(nextIds).toEqual(['item-4', 'item-5']);
  });

  it('applySwipeSelection restores baseline selection for ids that leave a shrinking drag rect', () => {
    const baselineIds = ['item-3', 'item-4', 'external-album-item'];
    const session = createSession('add', baselineIds);

    expect(new Set(applySwipeSelection(session, ['item-1', 'item-2', 'item-3', 'item-4', 'item-5']))).toEqual(
      new Set(['item-1', 'item-2', 'item-3', 'item-4', 'item-5', 'external-album-item']),
    );

    expect(new Set(applySwipeSelection(session, ['item-1', 'item-2']))).toEqual(
      new Set(['item-1', 'item-2', 'item-3', 'item-4', 'external-album-item']),
    );
    expect(applySwipeSelection(session, ['item-1', 'item-2'])).not.toContain('item-5');
  });
});
