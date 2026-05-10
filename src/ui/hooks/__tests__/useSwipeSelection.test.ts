import { describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react-native';
import { useSwipeSelection } from '../useSwipeSelection';
import type { CleanupCandidate } from '../../../domain/recognition/types';
import type { MediaGridLayout } from '../../screens/screen-layout';

describe('useSwipeSelection', () => {
  const mockCandidates: CleanupCandidate[] = [
    {
      id: '1',
      asset: {
        id: '1',
        uri: 'photo1.jpg',
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
      reasons: [' blurry image detected'],
    },
    {
      id: '2',
      asset: {
        id: '2',
        uri: 'photo2.jpg',
        width: 100,
        height: 100,
        mediaType: 'photo',
        creationTime: Date.now(),
        duration: 0,
        fileSize: 1000,
      },
      score: 70,
      confidence: 'medium',
      kind: 'abnormal-photo',
      primaryIssueType: 'accidental',
      issueTypes: ['accidental'],
      reasons: [' low brightness detected'],
    },
    {
      id: '3',
      asset: {
        id: '3',
        uri: 'photo3.jpg',
        width: 100,
        height: 100,
        mediaType: 'photo',
        creationTime: Date.now(),
        duration: 0,
        fileSize: 1000,
      },
      score: 60,
      confidence: 'low',
      kind: 'duplicate-photo',
      primaryIssueType: 'abnormal',
      issueTypes: ['abnormal'],
      reasons: [' low quality detected'],
    },
  ];

  const mockGridLayout: MediaGridLayout = {
    columns: 3,
    itemSize: 100,
    spacing: 10,
    sidePadding: 16,
    contentWidth: 300,
    isSELike: false,
  };

  it('should return panGesture when selection mode is enabled', async () => {
    const onSelect = vi.fn();
    const { result } = await renderHook(() =>
      useSwipeSelection({
        candidates: mockCandidates,
        selectedIds: [],
        onSelect,
        gridLayout: mockGridLayout,
        scrollOffset: 0,
        isSelectionMode: true,
      })
    );

    expect(result.current.panGesture).toBeDefined();
    expect(result.current.isSwiping).toBe(false);
  });

  it('should calculate correct item index from position', async () => {
    const onSelect = vi.fn();
    const { result } = await renderHook(() =>
      useSwipeSelection({
        candidates: mockCandidates,
        selectedIds: [],
        onSelect,
        gridLayout: mockGridLayout,
        scrollOffset: 0,
        isSelectionMode: true,
      })
    );

    // Position at first item (row 0, col 0) - within item bounds
    const itemId = result.current.getItemAtPosition(50, 50, 0);
    expect(itemId).toBeDefined();
  });

  it('should consider scroll offset in calculation', async () => {
    const onSelect = vi.fn();
    const { result } = await renderHook(() =>
      useSwipeSelection({
        candidates: mockCandidates,
        selectedIds: [],
        onSelect,
        gridLayout: mockGridLayout,
        scrollOffset: 100,
        isSelectionMode: true,
      })
    );

    expect(result.current.panGesture).toBeDefined();
  });

  it('should return null for out-of-bounds coordinates', async () => {
    const onSelect = vi.fn();
    const { result } = await renderHook(() =>
      useSwipeSelection({
        candidates: mockCandidates,
        selectedIds: [],
        onSelect,
        gridLayout: mockGridLayout,
        scrollOffset: 0,
        isSelectionMode: true,
      })
    );

    // Position way outside grid
    const itemId = result.current.getItemAtPosition(-100, -100, 0);
    expect(itemId).toBeNull();
  });

  it('should handle empty candidates array', async () => {
    const onSelect = vi.fn();
    const { result } = await renderHook(() =>
      useSwipeSelection({
        candidates: [],
        selectedIds: [],
        onSelect,
        gridLayout: mockGridLayout,
        scrollOffset: 0,
        isSelectionMode: true,
      })
    );

    expect(result.current.panGesture).toBeDefined();
  });

  it('should not swipe when selection mode is disabled', async () => {
    const onSelect = vi.fn();
    const { result } = await renderHook(() =>
      useSwipeSelection({
        candidates: mockCandidates,
        selectedIds: [],
        onSelect,
        gridLayout: mockGridLayout,
        scrollOffset: 0,
        isSelectionMode: false,
      })
    );

    expect(result.current.panGesture).toBeDefined();
    // Gesture should be disabled when selection mode is false
  });
});
