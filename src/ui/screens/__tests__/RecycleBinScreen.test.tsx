import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { CleanupCandidate } from '../../../domain/recognition/types';
import { getAppCopy } from '../../../i18n/app-copy';
import {
  buildBottomActionLayout,
  buildFloatingActionBarInsets,
  buildRecycleBinHeaderInsets,
  buildRecycleBinTexts,
  RECYCLE_BIN_DESIGN_CONTENT_WIDTH,
} from '../screen-layout';

const loadRecycleBinIdsMock = vi.hoisted(() => vi.fn());
const loadRecycleBinCandidateCacheMock = vi.hoisted(() => vi.fn());
const loadCleanupReportSnapshotMock = vi.hoisted(() => vi.fn());
const loadRecycleBinSnapshotCacheMock = vi.hoisted(() => vi.fn());
const saveRecycleBinIdsMock = vi.hoisted(() => vi.fn());
const saveRecycleBinCandidateCacheMock = vi.hoisted(() => vi.fn());
const saveRecycleBinSnapshotCacheMock = vi.hoisted(() => vi.fn());
const syncPersistedMediaLedgerMock = vi.hoisted(() => vi.fn());
const scanMediaLibraryMock = vi.hoisted(() => vi.fn());
const deleteAssetsAsyncMock = vi.hoisted(() => vi.fn());
const ensureMediaLibraryDeletePermissionsAsyncMock = vi.hoisted(() => vi.fn());
const alertMock = vi.hoisted(() => vi.fn());
const hardwareBackApi = vi.hoisted(() => {
  let listeners: Array<() => boolean> = [];

  return {
    addEventListener: vi.fn((_eventType: string, listener: () => boolean) => {
      listeners.push(listener);

      return {
        remove: vi.fn(() => {
          listeners = listeners.filter((current) => current !== listener);
        }),
      };
    }),
    emit() {
      for (const listener of [...listeners].reverse()) {
        if (listener()) {
          return true;
        }
      }

      return false;
    },
    reset() {
      listeners = [];
      this.addEventListener.mockClear();
    },
  };
});

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

  class AnimatedValue {
    value: number;

    constructor(value: number) {
      this.value = value;
    }

    setValue(value: number) {
      this.value = value;
    }
  }

  return {
    Alert: {
      alert: alertMock,
    },
    ActivityIndicator: 'ActivityIndicator',
    BackHandler: hardwareBackApi,
    View: 'View',
    Text: 'Text',
    Pressable,
    Animated: {
      Value: AnimatedValue,
      View: 'Animated.View',
      loop: () => ({
        start: () => undefined,
        stop: () => undefined,
      }),
      sequence: (animations: unknown[]) => animations,
      timing: () => ({}),
    },
    Easing: {
      ease: 'ease',
      inOut: (easing: unknown) => easing,
    },
    Dimensions: {
      get: () => ({ width: 375, height: 812, scale: 3, fontScale: 1 }),
      addEventListener: () => ({ remove: vi.fn() }),
    },
    useWindowDimensions: () => ({ width: 375, height: 812, scale: 3, fontScale: 1 }),
    StyleSheet: {
      absoluteFill: {
        position: 'absolute',
        left: 0,
        right: 0,
        top: 0,
        bottom: 0,
      },
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
    language: 'zh-CN',
    copy: getAppCopy('zh-CN'),
    theme: {
      scheme: 'light',
      safeArea: '#f3ecdf',
      pageTextPrimary: '#18212f',
      pageTextSecondary: '#546272',
      pageTextMuted: '#7c8595',
      cardBackground: '#fffaf1',
      cardBorder: '#e7dcc7',
      cardMutedBackground: '#f6f7fb',
      cardMutedBorder: '#d8dce8',
      thumbnailBackground: '#d8d2c5',
      actionBarBackground: '#142a33',
      actionBarText: '#fff7ec',
      buttonPrimaryBackground: '#173944',
      buttonSecondaryBackground: '#efe6d6',
      buttonSecondaryText: '#28404c',
      buttonPrimaryText: '#ffffff',
      buttonDangerBackground: '#b34f2f',
      buttonDangerText: '#ffffff',
    },
  }),
}));

vi.mock('../../../services/storage/app-storage', () => ({
  loadCleanupReportSnapshot: loadCleanupReportSnapshotMock,
  loadRecycleBinCandidateCache: loadRecycleBinCandidateCacheMock,
  loadRecycleBinIds: loadRecycleBinIdsMock,
  loadRecycleBinSnapshotCache: loadRecycleBinSnapshotCacheMock,
  saveRecycleBinCandidateCache: saveRecycleBinCandidateCacheMock,
  saveRecycleBinIds: saveRecycleBinIdsMock,
  saveRecycleBinSnapshotCache: saveRecycleBinSnapshotCacheMock,
  syncPersistedMediaLedger: syncPersistedMediaLedgerMock,
}));

vi.mock('../../../features/scan/scan-media-library', () => ({
  scanMediaLibrary: scanMediaLibraryMock,
}));

vi.mock('expo-media-library', () => ({
  deleteAssetsAsync: deleteAssetsAsyncMock,
}));

vi.mock('../../../services/media-library-permissions', () => ({
  ensureMediaLibraryDeletePermissionsAsync: ensureMediaLibraryDeletePermissionsAsyncMock,
}));

vi.mock('../../components/PhotoGrid', () => {
  const ReactModule = require('react') as typeof import('react');

  function MockPhotoGrid({
    candidates,
    selectedIds,
    selectionMode,
    onSelect,
    onSelectionChange,
    onItemPress,
    onItemLongPress,
  }: {
    candidates: CleanupCandidate[];
    selectedIds: string[];
    selectionMode?: boolean;
    onSelect: (id: string) => void;
    onSelectionChange?: (
      nextIds: string[],
      reason: {
        source: 'swipe-selection';
        action: 'add' | 'remove';
        anchorId: string;
        rangeIds: string[];
      },
    ) => void;
    onItemPress: (candidate: CleanupCandidate) => void;
    onItemLongPress?: (candidate: CleanupCandidate) => void;
  }) {
    return ReactModule.createElement(
      'View',
      { testID: 'mock-photo-grid' },
      ReactModule.createElement('Text', { testID: 'mock-photo-grid-selection-mode' }, String(Boolean(selectionMode))),
      ReactModule.createElement('Text', { testID: 'mock-photo-grid-selected-count' }, String(selectedIds.length)),
      ReactModule.createElement('Pressable', {
        testID: 'mock-recycle-grid-swipe-select-first-two',
        onPress: () =>
          onSelectionChange?.(
            candidates.slice(0, 2).map((candidate) => candidate.id),
            {
              source: 'swipe-selection',
              action: 'add',
              anchorId: candidates[0]?.id ?? '',
              rangeIds: candidates.slice(0, 2).map((candidate) => candidate.id),
            },
          ),
      }),
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
          onLongPress: () => (onItemLongPress ? onItemLongPress(candidate) : onSelect(candidate.id)),
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
    browseCandidates,
    duplicateCandidates,
    mode,
    onClose,
    onPrimaryAction,
    onHardDelete,
  }: {
    candidate: CleanupCandidate | null;
    browseCandidates?: CleanupCandidate[];
    duplicateCandidates?: CleanupCandidate[];
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
      ReactModule.createElement(
        'Text',
        { testID: 'detail-browse-count' },
        String(browseCandidates?.length ?? 0),
      ),
      ReactModule.createElement(
        'Text',
        { testID: 'detail-duplicate-count' },
        String(duplicateCandidates?.length ?? 0),
      ),
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

function pressLastAlertAction() {
  const buttons = alertMock.mock.calls.at(-1)?.[2] as
    | Array<{ onPress?: () => void; style?: string }>
    | undefined;
  const destructiveButton = buttons?.find((button) => button.style === 'destructive');
  destructiveButton?.onPress?.();
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
    loadCleanupReportSnapshotMock.mockResolvedValue({
      cleanedItemCount: 0,
      cleanedBytes: 0,
      lastCleanedAt: null,
    });
    loadRecycleBinSnapshotCacheMock.mockResolvedValue(null);
    saveRecycleBinIdsMock.mockResolvedValue(undefined);
    saveRecycleBinCandidateCacheMock.mockResolvedValue(undefined);
    saveRecycleBinSnapshotCacheMock.mockResolvedValue(undefined);
    scanMediaLibraryMock.mockResolvedValue(createScanResult([]));
    deleteAssetsAsyncMock.mockResolvedValue(undefined);
    ensureMediaLibraryDeletePermissionsAsyncMock.mockResolvedValue({ granted: true });
    alertMock.mockReset();
    hardwareBackApi.reset();
  });

  it('keeps the high-risk RecycleBin boundary markers in the screen source', () => {
    const source = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), '../RecycleBinScreen.tsx'),
      'utf8',
    );

    expect(source).toContain('createInitialCleanupState');
    expect(source).toContain('applyCleanupAction');
    expect(source).toContain('RecycleBinSkeleton');
    expect(source).toContain('DetailScreen');
    expect(source).toContain("BackHandler.addEventListener('hardwareBackPress'");
    expect(source).toContain('ensureMediaLibraryDeletePermissionsAsync');
    expect(source).toContain('MediaLibrary.deleteAssetsAsync');
    expect(source).toContain('requestDeleteConfirmation');
    expect(source).toContain('handleRestore');
    expect(source).toContain('onSelectionChange={handleSelectionChange}');
    expect(source).toContain('recycle-restore-selected-button');
    expect(source).toContain('recycle-delete-selected-button');
  });

  it('uses English recycle-bin copy from the shared app copy', () => {
    const copy = {
      screens: {
        recycleBin: {
          title: 'Recycle bin',
          emptyTitle: 'Nothing is waiting for a final decision yet',
          emptyBody:
            'Items moved into the app recycle bin by auto cleanup or manual cleanup are finalized here: keep or delete forever.',
        },
      },
    };

    expect(buildRecycleBinTexts(copy as never)).toEqual({
      title: 'Recycle bin',
      emptyTitle: 'Nothing is waiting for a final decision yet',
      emptyBody:
        'Items moved into the app recycle bin by auto cleanup or manual cleanup are finalized here: keep or delete forever.',
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

  it('keeps recycle-bin action chrome on the SE design width for wider phones', () => {
    expect(
      buildBottomActionLayout(
        { top: 0, bottom: 0, left: 0, right: 0 },
        { width: 393, height: 852, scale: 3, fontScale: 1 },
        { maxContentWidth: RECYCLE_BIN_DESIGN_CONTENT_WIDTH },
      ),
    ).toEqual({
      bottom: 8,
      left: 27,
      right: 27,
      contentWidth: 339,
      isSELike: true,
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
    expect(renderer.root.findByProps({ testID: 'recycle-bin-header-title' }).props.children).toBe('回收站');
    expect(renderer.root.findByProps({ testID: 'mock-photo-grid' })).toBeTruthy();
    expect(renderer.root.findByProps({ testID: 'candidate-label-recycle-1' })).toBeTruthy();
    expect(renderer.root.findByProps({ testID: 'mock-photo-grid-selection-mode' }).props.children).toBe('false');
    expect(renderer.root.findByProps({ testID: 'mock-photo-grid-selected-count' }).props.children).toBe('0');
    expect(renderer.root.findByProps({ testID: 'recycle-pending-bytes' }).props.children).toBe('664 KB');
    expect(findTextNode(renderer, '全不选')).toBeUndefined();
    expect(renderer.root.findAllByProps({ testID: 'recycle-restore-selected-button' })).toHaveLength(0);
    expect(renderer.root.findAllByProps({ testID: 'recycle-delete-selected-button' })).toHaveLength(0);
    expect(renderer.root.findAllByProps({ testID: 'recycle-restore-selected-icon' })).toHaveLength(0);
    expect(renderer.root.findAllByProps({ testID: 'recycle-delete-selected-icon' })).toHaveLength(0);
  });

  it('uses the header back button as a direct path back to photos when provided', async () => {
    const onBackToPhotos = vi.fn();
    const renderer = await renderRecycleBinScreen({ onBackToPhotos });

    await act(async () => {
      renderer.root.findByProps({ testID: 'recycle-back-button' }).props.onPress();
    });

    expect(onBackToPhotos).toHaveBeenCalledTimes(1);
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
    expect(findTextNode(renderer, '加载保留和清理…')).toBeUndefined();
  });

  it('renders stable loading and empty-state anchors for device observability', async () => {
    const idsDeferred = createDeferred<string[]>();
    loadRecycleBinIdsMock.mockReturnValueOnce(idsDeferred.promise);
    const loadingRenderer = await renderRecycleBinScreen();

    expect(loadingRenderer.root.findByProps({ testID: 'recycle-bin-skeleton' })).toBeTruthy();
    expect(
      loadingRenderer.root.findByProps({ testID: 'recycle-bin-skeleton-summary-title' }).props
        .accessibilityLabel,
    ).toBe('正在加载回收站');
    expect(loadingRenderer.root.findAllByProps({ testID: 'recycle-bin-loading-state' })).toHaveLength(0);
    expect(findTextNode(loadingRenderer, '加载保留和清理…')).toBeUndefined();
    expect(loadingRenderer.root.findAllByProps({ testID: 'recycle-bin-loading-fallback' })).toHaveLength(0);

    await act(async () => {
      idsDeferred.resolve([]);
      await Promise.resolve();
    });
    loadingRenderer.unmount();

    loadRecycleBinIdsMock.mockResolvedValueOnce([]);
    const emptyRenderer = await renderRecycleBinScreen();

    expect(emptyRenderer.root.findByProps({ testID: 'recycle-bin-empty-title' }).props.children).toBe(
      '这里还没有待最终处理的项目',
    );
    expect(emptyRenderer.root.findAllByProps({ testID: 'recycle-bin-skeleton' })).toHaveLength(0);
  });

  it('shows cleanup history under the empty-state icon when the recycle bin is empty', async () => {
    loadRecycleBinIdsMock.mockResolvedValueOnce([]);
    loadCleanupReportSnapshotMock.mockResolvedValueOnce({
      cleanedItemCount: 4,
      cleanedBytes: 50.5 * 1024 * 1024,
      lastCleanedAt: 1_710_000_000_000,
    });

    const renderer = await renderRecycleBinScreen();
    const historyNode = renderer.root.findByProps({ testID: 'recycle-cleanup-history-released' });
    const historyChildren = historyNode.props.children as Array<React.ReactElement<{ style?: unknown }>>;
    const historyValueNode = historyChildren[1];

    expect(renderer.root.findAllByProps({ testID: 'recycle-cleanup-history-footer' })).toHaveLength(0);
    expect(renderer.root.findByProps({ testID: 'recycle-bin-empty-state' })).toBeTruthy();
    expect(flattenText(historyNode.props.children)).toBe('历史清理： 共释放 50.5 MB');
    expect(historyNode.props.style).toEqual(
      expect.objectContaining({
        fontSize: 14,
        lineHeight: 20,
      }),
    );
    expect(historyValueNode.props.style).toEqual(
      expect.objectContaining({
        fontSize: 16,
        lineHeight: 22,
      }),
    );
    expect(renderer.root.findAllByProps({ testID: 'cleanup-report-card' })).toHaveLength(0);
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

  it('does not shrink persisted recycle-bin ids when hydrate cannot rehydrate every stored item', async () => {
    const recoveredCandidate = createCandidate('recycle-1');
    loadRecycleBinIdsMock.mockResolvedValueOnce(['recycle-1', 'recycle-2']);
    scanMediaLibraryMock.mockResolvedValueOnce(createScanResult([recoveredCandidate]));

    const onRecycleBinIdsChange = vi.fn();
    const renderer = await renderRecycleBinScreen({ onRecycleBinIdsChange });

    expect(scanMediaLibraryMock.mock.calls[0]?.[0]).toEqual(['recycle-1', 'recycle-2']);
    expect(renderer.root.findByProps({ testID: 'recycle-bin-summary-title' }).props.children).toBe(
      '清理 2 项',
    );
    expect(saveRecycleBinIdsMock).not.toHaveBeenCalledWith(['recycle-1']);
    expect(onRecycleBinIdsChange).not.toHaveBeenCalledWith(['recycle-1']);
    expect(renderer.root.findByProps({ testID: 'candidate-label-recycle-1' })).toBeTruthy();
  });

  it('refreshes all persisted recycle-bin ids after apk update and keeps the tapped-in list at the same count', async () => {
    const cachedCandidates = Array.from({ length: 9 }, (_, index) =>
      createCandidate(`recycle-${index + 1}`),
    );
    const persistedIds = cachedCandidates.map((candidate) => candidate.id);
    loadRecycleBinIdsMock.mockResolvedValueOnce(persistedIds);
    loadRecycleBinSnapshotCacheMock.mockResolvedValueOnce({
      ids: persistedIds,
      candidates: cachedCandidates,
      updatedAt: new Date('2026-04-19T08:00:00+08:00').getTime(),
      source: 'manual',
    });
    scanMediaLibraryMock.mockResolvedValueOnce(createScanResult(cachedCandidates));

    const renderer = await renderRecycleBinScreen();

    expect(scanMediaLibraryMock.mock.calls[0]?.[0]).toEqual(persistedIds);
    expect(renderer.root.findByProps({ testID: 'recycle-bin-summary-title' }).props.children).toBe(
      '清理 9 项',
    );
    for (const id of persistedIds) {
      expect(renderer.root.findByProps({ testID: `candidate-label-${id}` })).toBeTruthy();
    }
  });

  it('does not let an abnormal partial refresh shrink the tapped-in recycle-bin list', async () => {
    const first = createCandidate('recycle-1');
    const second = createCandidate('recycle-2');
    loadRecycleBinIdsMock.mockResolvedValueOnce(['recycle-1', 'recycle-2']);
    loadRecycleBinSnapshotCacheMock.mockResolvedValueOnce({
      ids: ['recycle-1', 'recycle-2'],
      candidates: [first, second],
      updatedAt: new Date('2026-04-19T08:00:00+08:00').getTime(),
      source: 'manual',
    });
    scanMediaLibraryMock.mockResolvedValueOnce(createScanResult([first]));

    const renderer = await renderRecycleBinScreen();

    expect(renderer.root.findByProps({ testID: 'recycle-bin-summary-title' }).props.children).toBe(
      '清理 2 项',
    );
    expect(renderer.root.findByProps({ testID: 'candidate-label-recycle-1' })).toBeTruthy();
    expect(renderer.root.findByProps({ testID: 'candidate-label-recycle-2' })).toBeTruthy();
  });

  it('does not let an abnormal partial refresh shrink nine persisted recycle-bin photos', async () => {
    const cachedCandidates = Array.from({ length: 9 }, (_, index) =>
      createCandidate(`recycle-${index + 1}`),
    );
    const persistedIds = cachedCandidates.map((candidate) => candidate.id);
    loadRecycleBinIdsMock.mockResolvedValueOnce(persistedIds);
    loadRecycleBinSnapshotCacheMock.mockResolvedValueOnce({
      ids: persistedIds,
      candidates: cachedCandidates,
      updatedAt: new Date('2026-04-19T08:00:00+08:00').getTime(),
      source: 'manual',
    });
    scanMediaLibraryMock.mockResolvedValueOnce(createScanResult(cachedCandidates.slice(0, 7)));

    const renderer = await renderRecycleBinScreen();

    expect(renderer.root.findByProps({ testID: 'recycle-bin-summary-title' }).props.children).toBe(
      '清理 9 项',
    );
    for (const id of persistedIds) {
      expect(renderer.root.findByProps({ testID: `candidate-label-${id}` })).toBeTruthy();
    }
  });

  it('updates the recycle-bin list after selection keep and clean actions', async () => {
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
    expect(alertMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      pressLastAlertAction();
    });

    expect(() => renderer.root.findByProps({ testID: 'candidate-label-recycle-2' })).toThrow();
    expect(syncPersistedMediaLedgerMock).toHaveBeenLastCalledWith(
      expect.objectContaining({
        activeCandidates: [first],
        recycleBinCandidates: [],
        deletedIds: ['recycle-2'],
      }),
    );
    expect(saveRecycleBinSnapshotCacheMock).toHaveBeenLastCalledWith(
      expect.objectContaining({
        ids: [],
        candidates: [],
      }),
    );
  });

  it('matches photo-grid selection behavior: tap opens detail and long press enters selection mode', async () => {
    const trashedCandidate = createCandidate('recycle-1');
    const secondCandidate = createCandidate('recycle-2');
    loadRecycleBinIdsMock.mockResolvedValueOnce(['recycle-1', 'recycle-2']);
    scanMediaLibraryMock.mockResolvedValueOnce(createScanResult([trashedCandidate, secondCandidate]));

    const renderer = await renderRecycleBinScreen();

    await act(async () => {
      renderer.root.findByProps({ testID: 'candidate-press-recycle-1' }).props.onPress();
    });

    expect(renderer.root.findByProps({ testID: 'mock-detail-screen' })).toBeTruthy();
    expect(findTextNode(renderer, 'recycle')).toBeTruthy();
    expect(findTextNode(renderer, 'recycle-1')).toBeTruthy();
    expect(renderer.root.findByProps({ testID: 'detail-browse-count' }).props.children).toBe('2');

    await act(async () => {
      renderer.root.findByProps({ testID: 'detail-close' }).props.onPress();
    });

    await act(async () => {
      renderer.root.findByProps({ testID: 'candidate-press-recycle-1' }).props.onLongPress();
    });

    expect(renderer.root.findAllByProps({ testID: 'mock-detail-screen' })).toHaveLength(0);
    expect(renderer.root.findByProps({ testID: 'mock-photo-grid-selection-mode' }).props.children).toBe('true');
    expect(renderer.root.findByProps({ testID: 'mock-photo-grid-selected-count' }).props.children).toBe('1');
    expect(findTextNode(renderer, '全选')).toBeTruthy();
  });

  it('lets recycle-bin detail browse the full recycle-bin list, not only duplicate groups', async () => {
    const first = {
      ...createCandidate('recycle-1'),
      duplicateGroup: undefined,
      primaryIssueType: 'abnormal' as const,
      issueTypes: ['abnormal' as const],
      kind: 'abnormal-photo' as const,
    };
    const second = createCandidate('recycle-2');
    const third = createCandidate('recycle-3');
    loadRecycleBinIdsMock.mockResolvedValueOnce(['recycle-1', 'recycle-2', 'recycle-3']);
    scanMediaLibraryMock.mockResolvedValueOnce(createScanResult([first, second, third]));

    const renderer = await renderRecycleBinScreen();

    await act(async () => {
      renderer.root.findByProps({ testID: 'candidate-press-recycle-1' }).props.onPress();
    });

    expect(renderer.root.findByProps({ testID: 'detail-browse-count' }).props.children).toBe('3');
    expect(renderer.root.findByProps({ testID: 'detail-duplicate-count' }).props.children).toBe('0');

    await act(async () => {
      renderer.root.findByProps({ testID: 'detail-primary-action' }).props.onPress();
    });

    expect(renderer.root.findAllByProps({ testID: 'mock-detail-screen' })).toHaveLength(1);
    expect(renderer.root.findByProps({ testID: 'detail-candidate-id' }).props.children).toBe('recycle-2');
    expect(renderer.root.findByProps({ testID: 'detail-browse-count' }).props.children).toBe('2');
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
    expect(renderer.root.findByProps({ testID: 'detail-candidate-id' }).props.children).toBe('recycle-2');
    expect(saveRecycleBinSnapshotCacheMock).toHaveBeenCalledWith(
      expect.objectContaining({
        ids: ['recycle-2'],
        candidates: [second],
      }),
    );

    await act(async () => {
      renderer.root.findByProps({ testID: 'detail-hard-delete' }).props.onPress();
    });
    expect(alertMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      pressLastAlertAction();
    });

    expect(ensureMediaLibraryDeletePermissionsAsyncMock).toHaveBeenCalledTimes(1);
    expect(() => renderer.root.findByProps({ testID: 'candidate-label-recycle-2' })).toThrow();
    expect(syncPersistedMediaLedgerMock).toHaveBeenLastCalledWith(
      expect.objectContaining({
        activeCandidates: [first],
        recycleBinCandidates: [],
        deletedIds: ['recycle-2'],
      }),
    );
    expect(saveRecycleBinSnapshotCacheMock).toHaveBeenLastCalledWith(
      expect.objectContaining({
        ids: [],
        candidates: [],
      }),
    );
  });

  it('blocks hard delete when media-library write permission is not granted', async () => {
    const candidate = createCandidate('recycle-1');
    loadRecycleBinIdsMock.mockResolvedValueOnce(['recycle-1']);
    scanMediaLibraryMock.mockResolvedValueOnce(createScanResult([candidate]));
    ensureMediaLibraryDeletePermissionsAsyncMock.mockResolvedValueOnce({ granted: false });

    const renderer = await renderRecycleBinScreen();

    await act(async () => {
      renderer.root.findByProps({ testID: 'candidate-press-recycle-1' }).props.onPress();
    });
    await act(async () => {
      renderer.root.findByProps({ testID: 'detail-hard-delete' }).props.onPress();
    });
    expect(alertMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      pressLastAlertAction();
    });

    expect(ensureMediaLibraryDeletePermissionsAsyncMock).toHaveBeenCalledTimes(1);
    expect(deleteAssetsAsyncMock).not.toHaveBeenCalled();
    expect(renderer.root.findByProps({ testID: 'mock-detail-screen' })).toBeTruthy();
    expect(findTextNode(renderer, 'recycle-1')).toBeTruthy();
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

  it('starts outside selection mode, then keeps taps inside selection after long press', async () => {
    const first = createCandidate('recycle-1');
    const second = createCandidate('recycle-2');
    loadRecycleBinIdsMock.mockResolvedValueOnce(['recycle-1', 'recycle-2']);
    scanMediaLibraryMock.mockResolvedValueOnce(createScanResult([first, second]));

    const renderer = await renderRecycleBinScreen();

    expect(renderer.root.findByProps({ testID: 'mock-photo-grid-selection-mode' }).props.children).toBe('false');
    expect(renderer.root.findByProps({ testID: 'mock-photo-grid-selected-count' }).props.children).toBe('0');
    expect(renderer.root.findAllByProps({ testID: 'recycle-restore-selected-button' })).toHaveLength(0);
    expect(renderer.root.findAllByProps({ testID: 'recycle-delete-selected-button' })).toHaveLength(0);
    expect(renderer.root.findAllByProps({ testID: 'mock-detail-screen' })).toHaveLength(0);

    await act(async () => {
      renderer.root.findByProps({ testID: 'candidate-press-recycle-1' }).props.onLongPress();
    });

    expect(renderer.root.findByProps({ testID: 'mock-photo-grid-selection-mode' }).props.children).toBe('true');
    expect(renderer.root.findByProps({ testID: 'mock-photo-grid-selected-count' }).props.children).toBe('1');
    expect(findTextNode(renderer, '保留')).toBeTruthy();
    expect(findTextNode(renderer, '清理')).toBeTruthy();

    await act(async () => {
      renderer.root.findByProps({ testID: 'candidate-press-recycle-2' }).props.onPress();
    });

    expect(renderer.root.findByProps({ testID: 'mock-photo-grid-selected-count' }).props.children).toBe('2');
    expect(renderer.root.findAllByProps({ testID: 'mock-detail-screen' })).toHaveLength(0);
  });

  it('toggles select all and deselect all for recycle-bin selection mode', async () => {
    const first = createCandidate('recycle-1');
    const second = createCandidate('recycle-2');
    loadRecycleBinIdsMock.mockResolvedValueOnce(['recycle-1', 'recycle-2']);
    scanMediaLibraryMock.mockResolvedValueOnce(createScanResult([first, second]));

    const renderer = await renderRecycleBinScreen();

    expect(renderer.root.findByProps({ testID: 'mock-photo-grid-selection-mode' }).props.children).toBe('false');
    expect(renderer.root.findByProps({ testID: 'mock-photo-grid-selected-count' }).props.children).toBe('0');
    expect(renderer.root.findByProps({ testID: 'recycle-bin-summary-title' }).props.children).toBe('清理 2 项');

    await act(async () => {
      renderer.root.findByProps({ testID: 'candidate-press-recycle-1' }).props.onLongPress();
    });

    expect(findTextNode(renderer, '全选')).toBeTruthy();
    expect(renderer.root.findByProps({ testID: 'mock-photo-grid-selected-count' }).props.children).toBe('1');

    await act(async () => {
      renderer.root.findByProps({ testID: 'recycle-selection-toggle-button' }).props.onPress();
    });

    expect(renderer.root.findByProps({ testID: 'mock-photo-grid-selection-mode' }).props.children).toBe('true');
    expect(renderer.root.findByProps({ testID: 'mock-photo-grid-selected-count' }).props.children).toBe('2');
    expect(findTextNode(renderer, '全不选')).toBeTruthy();
    expect(renderer.root.findByProps({ testID: 'recycle-restore-selected-button' })).toBeTruthy();
    expect(renderer.root.findByProps({ testID: 'recycle-delete-selected-button' })).toBeTruthy();
    expect(renderer.root.findByProps({ testID: 'recycle-bin-summary-title' }).props.children).toBe('清理 2 项');

    await act(async () => {
      renderer.root.findByProps({ testID: 'recycle-selection-toggle-button' }).props.onPress();
    });

    expect(renderer.root.findByProps({ testID: 'mock-photo-grid-selection-mode' }).props.children).toBe('true');
    expect(renderer.root.findByProps({ testID: 'mock-photo-grid-selected-count' }).props.children).toBe('0');
    expect(renderer.root.findByProps({ testID: 'recycle-restore-selected-button' })).toBeTruthy();
    expect(renderer.root.findByProps({ testID: 'recycle-delete-selected-button' })).toBeTruthy();
    expect(renderer.root.findAllByProps({ testID: 'recycle-restore-selected-icon' })).toHaveLength(0);
    expect(renderer.root.findAllByProps({ testID: 'recycle-delete-selected-icon' })).toHaveLength(0);
    expect(findTextNode(renderer, '全不选')).toBeUndefined();
    expect(findTextNode(renderer, '全选')).toBeTruthy();

    await act(async () => {
      renderer.root.findByProps({ testID: 'recycle-back-button' }).props.onPress();
    });

    expect(renderer.root.findByProps({ testID: 'mock-photo-grid-selection-mode' }).props.children).toBe('false');
    expect(renderer.root.findAllByProps({ testID: 'recycle-restore-selected-button' })).toHaveLength(0);
    expect(renderer.root.findAllByProps({ testID: 'recycle-delete-selected-button' })).toHaveLength(0);
  });

  it('keeps recycle-bin batch actions wired to swipe selection changes', async () => {
    const first = createCandidate('recycle-1');
    const second = createCandidate('recycle-2');
    const third = createCandidate('recycle-3');
    loadRecycleBinIdsMock.mockResolvedValueOnce(['recycle-1', 'recycle-2', 'recycle-3']);
    scanMediaLibraryMock.mockResolvedValueOnce(createScanResult([first, second, third]));

    const renderer = await renderRecycleBinScreen();

    await act(async () => {
      renderer.root.findByProps({ testID: 'candidate-press-recycle-1' }).props.onLongPress();
    });

    expect(renderer.root.findByProps({ testID: 'mock-photo-grid-selected-count' }).props.children).toBe('1');

    await act(async () => {
      renderer.root.findByProps({ testID: 'mock-recycle-grid-swipe-select-first-two' }).props.onPress();
    });

    expect(renderer.root.findByProps({ testID: 'mock-photo-grid-selection-mode' }).props.children).toBe('true');
    expect(renderer.root.findByProps({ testID: 'mock-photo-grid-selected-count' }).props.children).toBe('2');
    expect(renderer.root.findByProps({ testID: 'recycle-restore-selected-button' })).toBeTruthy();
    expect(renderer.root.findByProps({ testID: 'recycle-delete-selected-button' })).toBeTruthy();
  });

  it('closes detail back to the recycle-bin grid', async () => {
    const trashedCandidate = createCandidate('recycle-1');
    loadRecycleBinIdsMock.mockResolvedValueOnce(['recycle-1']);
    scanMediaLibraryMock.mockResolvedValueOnce(createScanResult([trashedCandidate]));

    const renderer = await renderRecycleBinScreen();

    await act(async () => {
      renderer.root.findByProps({ testID: 'candidate-press-recycle-1' }).props.onPress();
    });

    expect(renderer.root.findByProps({ testID: 'recycle-bin-detail-overlay' })).toBeTruthy();
    expect(renderer.root.findByProps({ testID: 'mock-detail-screen' })).toBeTruthy();
    expect(renderer.root.findByProps({ testID: 'mock-photo-grid' })).toBeTruthy();

    await act(async () => {
      renderer.root.findByProps({ testID: 'detail-close' }).props.onPress();
    });

    expect(renderer.root.findByProps({ testID: 'mock-photo-grid' })).toBeTruthy();
    expect(renderer.root.findAllByProps({ testID: 'mock-detail-screen' })).toHaveLength(0);
  });

  it('closes recycle-bin detail when Android hardware back is pressed', async () => {
    const trashedCandidate = createCandidate('recycle-1');
    loadRecycleBinIdsMock.mockResolvedValueOnce(['recycle-1']);
    scanMediaLibraryMock.mockResolvedValueOnce(createScanResult([trashedCandidate]));

    const renderer = await renderRecycleBinScreen();

    await act(async () => {
      renderer.root.findByProps({ testID: 'candidate-press-recycle-1' }).props.onPress();
    });

    expect(renderer.root.findByProps({ testID: 'mock-detail-screen' })).toBeTruthy();

    let consumed = false;
    await act(async () => {
      consumed = hardwareBackApi.emit();
      await flushEffects();
    });

    expect(consumed).toBe(true);
    expect(renderer.root.findByProps({ testID: 'mock-photo-grid' })).toBeTruthy();
    expect(renderer.root.findAllByProps({ testID: 'mock-detail-screen' })).toHaveLength(0);
  });

  it('uses Android hardware back like the recycle-bin header back button', async () => {
    const onBackToPhotos = vi.fn();
    const trashedCandidate = createCandidate('recycle-1');
    loadRecycleBinIdsMock.mockResolvedValueOnce(['recycle-1']);
    scanMediaLibraryMock.mockResolvedValueOnce(createScanResult([trashedCandidate]));

    const renderer = await renderRecycleBinScreen({ onBackToPhotos });

    let consumed = false;
    await act(async () => {
      consumed = hardwareBackApi.emit();
      await flushEffects();
    });

    expect(consumed).toBe(true);
    expect(onBackToPhotos).toHaveBeenCalledTimes(1);
    expect(renderer.root.findByProps({ testID: 'mock-photo-grid' })).toBeTruthy();
  });

  it('exits recycle-bin selection mode before leaving on Android hardware back', async () => {
    const onBackToPhotos = vi.fn();
    const first = createCandidate('recycle-1');
    const second = createCandidate('recycle-2');
    loadRecycleBinIdsMock.mockResolvedValueOnce(['recycle-1', 'recycle-2']);
    scanMediaLibraryMock.mockResolvedValueOnce(createScanResult([first, second]));

    const renderer = await renderRecycleBinScreen({ onBackToPhotos });

    await act(async () => {
      renderer.root.findByProps({ testID: 'candidate-press-recycle-1' }).props.onLongPress();
    });

    expect(renderer.root.findByProps({ testID: 'mock-photo-grid-selection-mode' }).props.children).toBe('true');

    let consumed = false;
    await act(async () => {
      consumed = hardwareBackApi.emit();
      await flushEffects();
    });

    expect(consumed).toBe(true);
    expect(onBackToPhotos).not.toHaveBeenCalled();
    expect(renderer.root.findByProps({ testID: 'mock-photo-grid-selection-mode' }).props.children).toBe('false');
  });
});
