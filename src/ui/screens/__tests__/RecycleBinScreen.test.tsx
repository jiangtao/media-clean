import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { CleanupCandidate } from '../../../domain/recognition/types';
import {
  buildFloatingActionBarInsets,
  buildRecycleBinHeaderInsets,
  buildRecycleBinTexts,
} from '../screen-layout';

const loadRecycleBinIdsMock = vi.hoisted(() => vi.fn());
const loadRecycleBinCandidateCacheMock = vi.hoisted(() => vi.fn());
const loadRecycleBinSnapshotCacheMock = vi.hoisted(() => vi.fn());
const saveRecycleBinIdsMock = vi.hoisted(() => vi.fn());
const saveRecycleBinCandidateCacheMock = vi.hoisted(() => vi.fn());
const saveRecycleBinSnapshotCacheMock = vi.hoisted(() => vi.fn());
const scanMediaLibraryMock = vi.hoisted(() => vi.fn());
const deleteAssetsAsyncMock = vi.hoisted(() => vi.fn());

vi.mock('react-native', () => {
  const ReactModule = require('react') as typeof import('react');

  function Pressable({
    children,
    ...props
  }: {
    children?: React.ReactNode;
    [key: string]: unknown;
  }) {
    return ReactModule.createElement('Pressable', props, children);
  }

  return {
    View: 'View',
    Text: 'Text',
    Pressable,
    StyleSheet: {
      create: (styles: Record<string, unknown>) => styles,
    },
  };
});

vi.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 26, bottom: 24, left: 30, right: 26 }),
}));

vi.mock('@react-navigation/native', () => {
  const ReactModule = require('react') as typeof import('react');

  return {
    useFocusEffect: (effect: () => void | (() => void) | Promise<void | (() => void)>) => {
      ReactModule.useEffect(() => {
        let cleanup: void | (() => void);

        void Promise.resolve(effect()).then((result) => {
          if (typeof result === 'function') {
            cleanup = result;
          }
        });

        return () => {
          cleanup?.();
        };
      }, [effect]);
    },
  };
});

vi.mock('../../../application/AppPreferencesContext', () => ({
  useAppPreferences: () => ({
    copy: {
      alerts: {
        scanFailed: '扫描失败',
        deleteFailedBody: '删除失败',
      },
      common: {
        statusTitle: '状态',
      },
      screens: {
        recycleBin: {
          title: '回收站',
          emptyTitle: '回收站还是空的',
          emptyBody: '自动清理或手动清理的媒体会在这里集中管理。',
          expireHint: (days: number) => `移入回收站的媒体会在 ${days} 天后彻底删除。`,
          selectedItems: (count: number) => `已选择 ${count} 项`,
          cancel: '取消',
          restore: '恢复',
          delete: '删除',
        },
      },
    },
    theme: {
      safeArea: '#f3ecdf',
      pageTextPrimary: '#18212f',
      pageTextMuted: '#7c8595',
      pageTextSecondary: '#546272',
      actionBarBackground: '#142a33',
      actionBarText: '#fff7ec',
      buttonSecondaryBackground: '#efe6d6',
      buttonSecondaryText: '#28404c',
      buttonPrimaryBackground: '#173944',
      buttonPrimaryText: '#ffffff',
      buttonDangerBackground: '#b34f2f',
      buttonDangerText: '#ffffff',
    },
  }),
}));

vi.mock('../../../services/storage/app-storage', () => ({
  loadRecycleBinCandidateCache: loadRecycleBinCandidateCacheMock,
  loadRecycleBinIds: loadRecycleBinIdsMock,
  loadRecycleBinSnapshotCache: loadRecycleBinSnapshotCacheMock,
  saveRecycleBinCandidateCache: saveRecycleBinCandidateCacheMock,
  saveRecycleBinIds: saveRecycleBinIdsMock,
  saveRecycleBinSnapshotCache: saveRecycleBinSnapshotCacheMock,
}));

vi.mock('../../../features/scan/scan-media-library', () => ({
  scanMediaLibrary: scanMediaLibraryMock,
}));

vi.mock('expo-media-library', () => ({
  deleteAssetsAsync: deleteAssetsAsyncMock,
}));

vi.mock('../../components/PhotoGrid', () => {
  const ReactModule = require('react') as typeof import('react');

  function MockPhotoGrid({
    candidates,
    selectionMode,
    onSelect,
    onItemPress,
  }: {
    candidates: CleanupCandidate[];
    selectionMode?: boolean;
    onSelect: (id: string) => void;
    onItemPress: (candidate: CleanupCandidate) => void;
  }) {
    return ReactModule.createElement(
      'View',
      { testID: 'mock-photo-grid' },
      ...candidates.flatMap((candidate) => [
        ReactModule.createElement(
          'Text',
          { key: `label-${candidate.id}`, testID: `candidate-label-${candidate.id}` },
          candidate.id,
        ),
        ReactModule.createElement('Pressable', {
          key: `press-${candidate.id}`,
          testID: `candidate-press-${candidate.id}`,
          onPress: () => (selectionMode ? onSelect(candidate.id) : onItemPress(candidate)),
          onLongPress: () => onSelect(candidate.id),
        }),
      ]),
    );
  }

  return {
    PhotoGrid: MockPhotoGrid,
  };
});

vi.mock('../DetailScreen', () => {
  const ReactModule = require('react') as typeof import('react');

  function MockDetailScreen({
    candidate,
    mode,
    onClose,
    onPrimaryAction,
    onHardDelete,
  }: {
    candidate: CleanupCandidate | null;
    mode: 'suggestions' | 'recycle';
    onClose: () => void;
    onPrimaryAction: (ids?: string[]) => void | Promise<void>;
    onHardDelete: (ids?: string[]) => void | Promise<void>;
  }) {
    if (!candidate) {
      return null;
    }

    return ReactModule.createElement(
      'View',
      { testID: 'mock-detail-screen' },
      ReactModule.createElement('Text', { testID: 'detail-mode' }, mode),
      ReactModule.createElement('Text', { testID: 'detail-candidate-id' }, candidate.id),
      ReactModule.createElement('Pressable', {
        testID: 'detail-primary-action',
        onPress: () => onPrimaryAction([candidate.id]),
      }),
      ReactModule.createElement('Pressable', {
        testID: 'detail-hard-delete',
        onPress: () => onHardDelete([candidate.id]),
      }),
      ReactModule.createElement('Pressable', {
        testID: 'detail-close',
        onPress: onClose,
      }),
    );
  }

  return {
    DetailScreen: MockDetailScreen,
  };
});

import { RecycleBinScreen } from '../RecycleBinScreen';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function createCandidate(id: string): CleanupCandidate {
  return {
    id,
    asset: {
      id,
      uri: `file:///${id}.jpg`,
      previewUri: `file:///${id}-preview.jpg`,
      mediaType: 'photo',
      width: 1080,
      height: 1440,
      duration: 0,
      fileSize: 680_000,
      creationTime: new Date('2026-04-18T08:00:00+08:00').getTime(),
    },
    score: 88,
    confidence: 'high',
    kind: 'duplicate-photo',
    primaryIssueType: 'duplicate',
    issueTypes: ['duplicate'],
    reasons: ['与其他媒体高度相似'],
    duplicateGroup: {
      groupId: `group-${id}`,
      representativeId: `keep-${id}`,
      relation: 'exact',
      size: 2,
      similarity: 0.98,
      representativeReason: 'higher-resolution',
      representativeWidth: 3024,
      representativeHeight: 4032,
      representativeFileSize: 4_200_000,
      representativeCreationTime: new Date('2026-04-18T08:00:00+08:00').getTime(),
    },
  };
}

function createScanResult(recycleBin: CleanupCandidate[]) {
  return {
    state: {
      activeCandidates: [],
      recycleBin,
      selectedIds: [],
    },
    summary: {
      scannedAt: new Date('2026-04-19T08:00:00+08:00').getTime(),
      scannedCount: recycleBin.length,
      candidateCount: recycleBin.length,
      highConfidenceCount: recycleBin.length,
      mediumConfidenceCount: 0,
      recycleBinCount: recycleBin.length,
    },
  };
}

function flattenText(children: React.ReactNode): string {
  if (typeof children === 'string' || typeof children === 'number') {
    return String(children);
  }

  if (Array.isArray(children)) {
    return children.map((child) => flattenText(child)).join('');
  }

  if (React.isValidElement<{ children?: React.ReactNode }>(children)) {
    return flattenText(children.props.children);
  }

  return '';
}

function findTextNode(renderer: ReturnType<typeof TestRenderer.create>, value: string) {
  return renderer.root
    .findAllByType('Text')
    .find(
      (node: { props: { children?: React.ReactNode } }) =>
        flattenText(node.props.children) === value,
    );
}

async function flushEffects() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((innerResolve, innerReject) => {
    resolve = innerResolve;
    reject = innerReject;
  });

  return { promise, resolve, reject };
}

async function renderRecycleBinScreen(props: React.ComponentProps<typeof RecycleBinScreen> = {}) {
  let renderer!: ReturnType<typeof TestRenderer.create>;

  await act(async () => {
    renderer = TestRenderer.create(<RecycleBinScreen {...props} />);
  });

  await flushEffects();
  return renderer;
}

describe('RecycleBinScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    loadRecycleBinIdsMock.mockResolvedValue([]);
    loadRecycleBinCandidateCacheMock.mockResolvedValue([]);
    loadRecycleBinSnapshotCacheMock.mockResolvedValue(null);
    saveRecycleBinIdsMock.mockResolvedValue(undefined);
    saveRecycleBinCandidateCacheMock.mockResolvedValue(undefined);
    saveRecycleBinSnapshotCacheMock.mockResolvedValue(undefined);
    scanMediaLibraryMock.mockResolvedValue(createScanResult([]));
    deleteAssetsAsyncMock.mockResolvedValue(undefined);
  });

  it('uses English recycle-bin copy from the shared app copy', () => {
    const copy = {
      screens: {
        recycleBin: {
          title: 'Recycle Bin',
          emptyTitle: 'The recycle bin is still empty',
          emptyBody: 'Items moved by auto cleanup or manual cleanup will be managed here.',
          expireHint: (days: number) =>
            `Items in the recycle bin will be permanently deleted after ${days} days.`,
        },
      },
    };

    expect(buildRecycleBinTexts(copy as never, 30)).toEqual({
      title: 'Recycle Bin',
      emptyTitle: 'The recycle bin is still empty',
      emptyBody: 'Items moved by auto cleanup or manual cleanup will be managed here.',
      expireHint: 'Items in the recycle bin will be permanently deleted after 30 days.',
    });
  });

  it('derives safe-area aware header and action-bar offsets for the target device', () => {
    const insets = { top: 26, bottom: 24, left: 30, right: 26 };

    expect(buildRecycleBinHeaderInsets(insets)).toEqual({
      top: 42,
      left: 30,
      right: 26,
    });
    expect(buildFloatingActionBarInsets(insets)).toEqual({
      bottom: 104,
      left: 46,
      right: 42,
    });
  });

  it('hydrates a real recycle-bin list from recycleBinIds and scanMediaLibrary on focus', async () => {
    const trashedCandidate = createCandidate('recycle-1');
    loadRecycleBinIdsMock.mockResolvedValueOnce(['recycle-1']);
    scanMediaLibraryMock.mockResolvedValueOnce(createScanResult([trashedCandidate]));

    const renderer = await renderRecycleBinScreen();

    expect(loadRecycleBinIdsMock).toHaveBeenCalledTimes(1);
    expect(scanMediaLibraryMock).toHaveBeenCalledTimes(1);
    expect(scanMediaLibraryMock.mock.calls[0]?.[0]).toEqual(['recycle-1']);
    expect(renderer.root.findByProps({ testID: 'mock-photo-grid' })).toBeTruthy();
    expect(renderer.root.findByProps({ testID: 'candidate-label-recycle-1' })).toBeTruthy();
  });

  it('renders persisted recycle-bin snapshots immediately while the heavy refresh is still in flight', async () => {
    const cachedCandidate = createCandidate('recycle-1');
    loadRecycleBinIdsMock.mockResolvedValueOnce(['recycle-1']);
    loadRecycleBinSnapshotCacheMock.mockResolvedValueOnce({
      ids: ['recycle-1'],
      candidates: [cachedCandidate],
      updatedAt: new Date('2026-04-19T08:00:00+08:00').getTime(),
      source: 'manual',
    });
    scanMediaLibraryMock.mockImplementationOnce(
      () =>
        new Promise(() => {
          // Keep the refresh pending so the test can assert the immediate cached render.
        }),
    );

    const renderer = await renderRecycleBinScreen();

    expect(renderer.root.findByProps({ testID: 'mock-photo-grid' })).toBeTruthy();
    expect(renderer.root.findByProps({ testID: 'candidate-label-recycle-1' })).toBeTruthy();
    expect(findTextNode(renderer, '加载回收站…')).toBeUndefined();
  });

  it('renders the persisted recycle-bin snapshot before recycle-bin ids finish loading, then refreshes in the background', async () => {
    const cachedCandidate = createCandidate('recycle-1');
    const refreshedCandidate = createCandidate('recycle-2');
    const idsDeferred = createDeferred<string[]>();
    const scanDeferred = createDeferred<ReturnType<typeof createScanResult>>();

    loadRecycleBinSnapshotCacheMock.mockResolvedValueOnce({
      ids: ['recycle-1', 'recycle-2'],
      candidates: [cachedCandidate],
      updatedAt: new Date('2026-04-19T08:00:00+08:00').getTime(),
      source: 'manual',
    });
    loadRecycleBinIdsMock.mockReturnValueOnce(idsDeferred.promise);
    scanMediaLibraryMock.mockReturnValueOnce(scanDeferred.promise);

    const renderer = await renderRecycleBinScreen();

    expect(renderer.root.findByProps({ testID: 'mock-photo-grid' })).toBeTruthy();
    expect(renderer.root.findByProps({ testID: 'candidate-label-recycle-1' })).toBeTruthy();
    expect(() => renderer.root.findByProps({ testID: 'candidate-label-recycle-2' })).toThrow();

    await act(async () => {
      idsDeferred.resolve(['recycle-1', 'recycle-2']);
      await Promise.resolve();
    });

    expect(scanMediaLibraryMock).toHaveBeenCalledWith(['recycle-1', 'recycle-2'], expect.any(Object));

    await act(async () => {
      scanDeferred.resolve(createScanResult([cachedCandidate, refreshedCandidate]));
      await Promise.resolve();
    });
    await flushEffects();

    expect(renderer.root.findByProps({ testID: 'candidate-label-recycle-2' })).toBeTruthy();
  });

  it('falls back to persisted recycle-bin ids when the live navigator passes an empty array before refresh', async () => {
    const trashedCandidate = createCandidate('recycle-1');
    loadRecycleBinIdsMock.mockResolvedValueOnce(['recycle-1']);
    scanMediaLibraryMock.mockResolvedValueOnce(createScanResult([trashedCandidate]));

    const renderer = await renderRecycleBinScreen({ recycleBinIds: [] });

    expect(loadRecycleBinIdsMock).toHaveBeenCalledTimes(1);
    expect(scanMediaLibraryMock).toHaveBeenCalledTimes(1);
    expect(scanMediaLibraryMock.mock.calls[0]?.[0]).toEqual(['recycle-1']);
    expect(renderer.root.findByProps({ testID: 'candidate-label-recycle-1' })).toBeTruthy();
  });

  it('updates the recycle-bin list after selection restore and delete actions', async () => {
    const first = createCandidate('recycle-1');
    const second = createCandidate('recycle-2');
    loadRecycleBinIdsMock.mockResolvedValueOnce(['recycle-1', 'recycle-2']);
    scanMediaLibraryMock.mockResolvedValueOnce(createScanResult([first, second]));

    const renderer = await renderRecycleBinScreen();

    await act(async () => {
      renderer.root.findByProps({ testID: 'candidate-press-recycle-1' }).props.onLongPress();
    });
    await act(async () => {
      renderer.root.findByProps({ testID: 'recycle-restore-selected-button' }).props.onPress();
    });

    expect(() => renderer.root.findByProps({ testID: 'candidate-label-recycle-1' })).toThrow();
    expect(renderer.root.findByProps({ testID: 'candidate-label-recycle-2' })).toBeTruthy();
    expect(saveRecycleBinSnapshotCacheMock).toHaveBeenCalledWith(
      expect.objectContaining({
        ids: ['recycle-2'],
        candidates: [second],
      }),
    );

    await act(async () => {
      renderer.root.findByProps({ testID: 'candidate-press-recycle-2' }).props.onLongPress();
    });
    await act(async () => {
      renderer.root.findByProps({ testID: 'recycle-delete-selected-button' }).props.onPress();
    });

    expect(() => renderer.root.findByProps({ testID: 'candidate-label-recycle-2' })).toThrow();
    expect(saveRecycleBinSnapshotCacheMock).toHaveBeenLastCalledWith(
      expect.objectContaining({
        ids: [],
        candidates: [],
      }),
    );
  });

  it('opens recycle-bin media in detail instead of staying in the grid only', async () => {
    const trashedCandidate = createCandidate('recycle-1');
    loadRecycleBinIdsMock.mockResolvedValueOnce(['recycle-1']);
    scanMediaLibraryMock.mockResolvedValueOnce(createScanResult([trashedCandidate]));

    const renderer = await renderRecycleBinScreen();

    await act(async () => {
      renderer.root.findByProps({ testID: 'candidate-press-recycle-1' }).props.onPress();
    });

    expect(renderer.root.findByProps({ testID: 'mock-detail-screen' })).toBeTruthy();
    expect(findTextNode(renderer, 'recycle')).toBeTruthy();
    expect(findTextNode(renderer, 'recycle-1')).toBeTruthy();
  });

  it('applies restore and hard-delete from detail to the current recycle-bin item', async () => {
    const first = createCandidate('recycle-1');
    const second = createCandidate('recycle-2');
    loadRecycleBinIdsMock.mockResolvedValueOnce(['recycle-1', 'recycle-2']);
    scanMediaLibraryMock.mockResolvedValueOnce(createScanResult([first, second]));

    const renderer = await renderRecycleBinScreen();

    await act(async () => {
      renderer.root.findByProps({ testID: 'candidate-press-recycle-1' }).props.onPress();
    });
    await act(async () => {
      renderer.root.findByProps({ testID: 'detail-primary-action' }).props.onPress();
    });

    expect(() => renderer.root.findByProps({ testID: 'candidate-label-recycle-1' })).toThrow();
    expect(renderer.root.findByProps({ testID: 'candidate-label-recycle-2' })).toBeTruthy();
    expect(saveRecycleBinSnapshotCacheMock).toHaveBeenCalledWith(
      expect.objectContaining({
        ids: ['recycle-2'],
        candidates: [second],
      }),
    );

    await act(async () => {
      renderer.root.findByProps({ testID: 'candidate-press-recycle-2' }).props.onPress();
    });
    await act(async () => {
      renderer.root.findByProps({ testID: 'detail-hard-delete' }).props.onPress();
    });

    expect(() => renderer.root.findByProps({ testID: 'candidate-label-recycle-2' })).toThrow();
    expect(saveRecycleBinSnapshotCacheMock).toHaveBeenLastCalledWith(
      expect.objectContaining({
        ids: [],
        candidates: [],
      }),
    );
  });

  it('keeps detail open on the remaining related recycle-bin item after restoring the current one', async () => {
    const first = {
      ...createCandidate('recycle-1'),
      duplicateGroup: {
        groupId: 'recycle-group-a',
        representativeId: 'keep-best',
        relation: 'exact' as const,
        size: 3,
        similarity: 0.98,
        representativeReason: 'higher-resolution' as const,
        representativeWidth: 3024,
        representativeHeight: 4032,
        representativeFileSize: 4_200_000,
        representativeCreationTime: new Date('2026-04-18T08:00:00+08:00').getTime(),
      },
    };
    const second = {
      ...createCandidate('recycle-2'),
      duplicateGroup: {
        groupId: 'recycle-group-a',
        representativeId: 'keep-best',
        relation: 'exact' as const,
        size: 3,
        similarity: 0.98,
        representativeReason: 'higher-resolution' as const,
        representativeWidth: 3024,
        representativeHeight: 4032,
        representativeFileSize: 4_200_000,
        representativeCreationTime: new Date('2026-04-18T08:00:00+08:00').getTime(),
      },
    };
    loadRecycleBinIdsMock.mockResolvedValueOnce(['recycle-1', 'recycle-2']);
    scanMediaLibraryMock.mockResolvedValueOnce(createScanResult([first, second]));

    const renderer = await renderRecycleBinScreen();

    await act(async () => {
      renderer.root.findByProps({ testID: 'candidate-press-recycle-1' }).props.onPress();
    });

    expect(findTextNode(renderer, 'recycle-1')).toBeTruthy();

    await act(async () => {
      renderer.root.findByProps({ testID: 'detail-primary-action' }).props.onPress();
    });

    expect(renderer.root.findAllByProps({ testID: 'mock-detail-screen' })).toHaveLength(1);
    expect(findTextNode(renderer, 'recycle-2')).toBeTruthy();
    expect(() => renderer.root.findByProps({ testID: 'candidate-label-recycle-1' })).toThrow();
  });

  it('enters selection mode on long press and keeps later taps inside selection instead of opening detail', async () => {
    const first = createCandidate('recycle-1');
    const second = createCandidate('recycle-2');
    loadRecycleBinIdsMock.mockResolvedValueOnce(['recycle-1', 'recycle-2']);
    scanMediaLibraryMock.mockResolvedValueOnce(createScanResult([first, second]));

    const renderer = await renderRecycleBinScreen();

    await act(async () => {
      renderer.root.findByProps({ testID: 'candidate-press-recycle-1' }).props.onLongPress();
    });

    expect(findTextNode(renderer, '恢复 (1)')).toBeTruthy();
    expect(renderer.root.findAllByProps({ testID: 'mock-detail-screen' })).toHaveLength(0);

    await act(async () => {
      renderer.root.findByProps({ testID: 'candidate-press-recycle-2' }).props.onPress();
    });

    expect(findTextNode(renderer, '恢复 (2)')).toBeTruthy();
    expect(renderer.root.findAllByProps({ testID: 'mock-detail-screen' })).toHaveLength(0);
  });

  it('closes detail back to the recycle-bin grid', async () => {
    const trashedCandidate = createCandidate('recycle-1');
    loadRecycleBinIdsMock.mockResolvedValueOnce(['recycle-1']);
    scanMediaLibraryMock.mockResolvedValueOnce(createScanResult([trashedCandidate]));

    const renderer = await renderRecycleBinScreen();

    await act(async () => {
      renderer.root.findByProps({ testID: 'candidate-press-recycle-1' }).props.onPress();
    });

    expect(renderer.root.findByProps({ testID: 'mock-detail-screen' })).toBeTruthy();

    await act(async () => {
      renderer.root.findByProps({ testID: 'detail-close' }).props.onPress();
    });

    expect(renderer.root.findByProps({ testID: 'mock-photo-grid' })).toBeTruthy();
    expect(renderer.root.findAllByProps({ testID: 'mock-detail-screen' })).toHaveLength(0);
  });
});
