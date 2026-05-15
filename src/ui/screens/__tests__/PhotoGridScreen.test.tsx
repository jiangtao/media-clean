import { beforeEach, describe, expect, it, vi } from 'vitest';
import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';

const platformState = vi.hoisted(() => ({
  os: 'ios' as 'ios' | 'android',
  version: 34,
  reset() {
    this.os = 'ios';
    this.version = 34;
  },
}));

const appStateApi = vi.hoisted(() => {
  let changeListener: ((nextState: string) => void) | undefined;

  return {
    currentState: 'active',
    addEventListener: vi.fn((_eventType: string, listener: (nextState: string) => void) => {
      changeListener = listener;
      return {
        remove: vi.fn(() => {
          if (changeListener === listener) {
            changeListener = undefined;
          }
        }),
      };
    }),
    emit(nextState: string) {
      this.currentState = nextState;
      changeListener?.(nextState);
    },
    reset() {
      this.currentState = 'active';
      changeListener = undefined;
      this.addEventListener.mockClear();
    },
  };
});

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
  class AnimatedValue {
    constructor(private value: number) {}

    setValue(nextValue: number) {
      this.value = nextValue;
    }

    stopAnimation() {}
  }

  const animation = {
    start: (callback?: () => void) => callback?.(),
    stop: () => {},
  };

  return {
    View: 'View',
    Text: 'Text',
    Pressable: 'Pressable',
    Platform: {
      get OS() {
        return platformState.os;
      },
      get Version() {
        return platformState.version;
      },
      select: <T,>(options: { ios?: T; android?: T; default?: T }) =>
        options[platformState.os] ?? options.default,
    },
    NativeModules: {},
    BackHandler: hardwareBackApi,
    StyleSheet: {
      create: (styles: Record<string, unknown>) => styles,
      hairlineWidth: 1,
    },
    AppState: appStateApi,
    Animated: {
      View: 'Animated.View',
      Value: AnimatedValue,
      timing: () => animation,
      sequence: () => animation,
      loop: () => animation,
    },
    PixelRatio: {
      get: () => 1,
    },
    useWindowDimensions: () => ({ width: 375, height: 812, scale: 3, fontScale: 1 }),
    TurboModuleRegistry: {
      get: vi.fn(() => null),
    },
  };
});

const mediaLibraryApi = vi.hoisted(() => ({
  getAssetsAsync: vi.fn(),
  getPermissionsAsync: vi.fn(),
  requestPermissionsAsync: vi.fn(),
  MediaType: {
    photo: 'photo',
    video: 'video',
  },
  SortBy: {
    creationTime: 'creationTime',
  },
}));

const storageApi = vi.hoisted(() => ({
  appendFalsePositiveCandidateIds: vi.fn(),
  loadAssetManifestEntries: vi.fn(),
  loadPhotoScanBatch: vi.fn(),
  loadFalsePositiveCandidateIds: vi.fn(),
  loadLatestCompletedPhotoScanBatch: vi.fn(),
  loadLatestPhotoScanBatch: vi.fn(),
  loadMediaAnalysisCache: vi.fn(),
  loadPhotoScanBatchItems: vi.fn(),
  loadRecycleBinIds: vi.fn(),
  loadRecycleBinCandidateCache: vi.fn(),
  loadPhotoScanResultCache: vi.fn(),
  saveRecycleBinIds: vi.fn(),
  saveRecycleBinCandidateCache: vi.fn(),
  savePhotoScanResultCache: vi.fn(),
  savePhotoScanBatch: vi.fn(),
  savePhotoScanBatchItems: vi.fn(),
  clearPhotoScanResultCache: vi.fn(),
  saveLastScanMeta: vi.fn(),
  saveLastValidScanBaseline: vi.fn(),
  syncPersistedMediaLedger: vi.fn(),
  upsertAssetManifestEntries: vi.fn(),
}));

const scanApi = vi.hoisted(() => ({
  DEFAULT_SCAN_LIMIT: 0,
  ACTIONABLE_SCAN_THRESHOLD: 55,
  scanMediaLibrary: vi.fn(),
  loadRecentScanAssets: vi.fn(async (options?: {
    limit?: number;
    excludedAssetIds?: readonly string[];
  }) => {
    const page = await mediaLibraryApi.getAssetsAsync({
      first: options?.limit ?? 360,
      mediaType: [mediaLibraryApi.MediaType.photo, mediaLibraryApi.MediaType.video],
      sortBy: [[mediaLibraryApi.SortBy.creationTime, false]],
    });
    const excludedAssetIds = new Set(options?.excludedAssetIds ?? []);
    return page.assets.filter((asset: { id: string }) => !excludedAssetIds.has(asset.id));
  }),
}));

const notificationApi = vi.hoisted(() => ({
  notifyScanCompletionIfNeeded: vi.fn(),
}));

const cleanupReminderApi = vi.hoisted(() => ({
  captureLastValidScanBaseline: vi.fn(),
}));

const reminderRuntimeApi = vi.hoisted(() => ({
  reconcileReminderRuntimeOnLaunch: vi.fn(),
  reconcileReminderRuntimeInForeground: vi.fn(),
}));

const photoScanSessionRuntimeApi = vi.hoisted(() => {
  const state = {
    snapshot: null as any,
  };

  return {
    getPhotoScanSessionRuntimeSnapshot: vi.fn(() => state.snapshot),
    hydratePhotoScanSessionRuntimeSnapshot: vi.fn(async () => state.snapshot),
    persistPhotoScanSessionRuntimeSnapshot: vi.fn(async (snapshot) => {
      state.snapshot = snapshot;
    }),
    stagePhotoScanSessionRuntimeSnapshot: vi.fn((snapshot) => {
      state.snapshot = snapshot;
    }),
    clearPhotoScanSessionRuntimeSnapshot: vi.fn(async () => {
      state.snapshot = null;
    }),
    reset() {
      state.snapshot = null;
      this.getPhotoScanSessionRuntimeSnapshot.mockReset();
      this.getPhotoScanSessionRuntimeSnapshot.mockImplementation(() => state.snapshot);
      this.hydratePhotoScanSessionRuntimeSnapshot.mockReset();
      this.hydratePhotoScanSessionRuntimeSnapshot.mockImplementation(async () => state.snapshot);
      this.persistPhotoScanSessionRuntimeSnapshot.mockReset();
      this.persistPhotoScanSessionRuntimeSnapshot.mockImplementation(async (snapshot) => {
        state.snapshot = snapshot;
      });
      this.stagePhotoScanSessionRuntimeSnapshot.mockReset();
      this.stagePhotoScanSessionRuntimeSnapshot.mockImplementation((snapshot) => {
        state.snapshot = snapshot;
      });
      this.clearPhotoScanSessionRuntimeSnapshot.mockReset();
      this.clearPhotoScanSessionRuntimeSnapshot.mockImplementation(async () => {
        state.snapshot = null;
      });
    },
  };
});

const backgroundScanApi = vi.hoisted(() => ({
  syncAndroidBackgroundScanForegroundService: vi.fn(async () => false),
}));

const androidNativeScanApi = vi.hoisted(() => ({
  isAndroidNativeScanSupported: vi.fn(async () => true),
  loadActiveAndroidNativeScanSnapshot: vi.fn(async () => null as any),
  stopAndroidNativeScan: vi.fn(async () => undefined),
  executeAndroidNativeFirstScan: vi.fn(),
}));

const androidMediaStoreApi = vi.hoisted(() => ({
  enumerateAndroidMediaStoreAssets: vi.fn(async (_options?: unknown) => [] as any[]),
}));

const scanRangeStorageApi = vi.hoisted(() => ({
  loadScanRange: vi.fn(async () => 12),
}));

const scanJobStorageApi = vi.hoisted(() => ({
  loadPhotoScanJobCheckpoint: vi.fn(async () => null as any),
  savePhotoScanJobCheckpoint: vi.fn(async () => undefined),
  clearPhotoScanJobCheckpoint: vi.fn(async () => undefined),
}));

const appPreferencesState = vi.hoisted(() => ({
  language: 'zh-CN',
  theme: {
    safeArea: '#f3ecdf',
    cardBackground: '#fffaf1',
    cardBorder: '#e7dcc7',
    pageTextPrimary: '#18212f',
    pageTextSecondary: '#546272',
    pageTextMuted: '#7c8595',
    buttonPrimaryBackground: '#173944',
    buttonPrimaryText: '#ffffff',
    buttonSecondaryBackground: '#efe6d6',
    buttonSecondaryText: '#28404c',
    noticeBackground: '#fff1e8',
    noticeBorder: '#efc9b4',
    noticeTitle: '#7d3f22',
    noticeText: '#965a3a',
    cardMutedBackground: '#f6f7fb',
    cardMutedBorder: '#d8dce8',
    heroAccent: '#9ed3c7',
    actionBarBackground: '#142a33',
    actionBarText: '#fff7ec',
    buttonDangerBackground: '#b34f2f',
    buttonDangerText: '#ffffff',
    shadowColor: '#0f172a',
  },
  copy: {
    common: {
      statusTitle: '当前状态',
    },
    alerts: {
      scanFailed: '扫描失败，请稍后重试。',
      deleteFailedBody: '删除失败，请稍后重试。',
    },
    controls: {
      rescan: '重新扫描',
      scanning: '扫描中...',
    },
    permission: {
      title: '需要相册权限',
      body: '请先授权读取最近媒体，扫描仅在本地进行。',
      action: '开启权限',
    },
    summary: {
      scannedLabel: '本次扫描',
      scannedCaption: '最近媒体总数',
      candidatesLabel: '识别结果',
      candidatesCaption: '待人工确认处理',
      blurryLabel: '模糊照片',
      duplicateLabel: '重复照片',
      similarLabel: '相似照片',
      suggestedCleanupLabel: '建议清理',
      suggestedCleanupCaption: '优先复核处理',
      recycleLabel: '回收站',
      recycleCaption: '应用内软删除',
    },
    screens: {
      photoGrid: {
        filterAll: '全部',
        filterPhoto: '照片',
        filterVideo: '视频',
        permissionChecking: '正在检查权限...',
        scanPromptTitle: '本地扫描',
        scanPromptBody: '最近媒体会在本地分批做模糊、重复、近相似、误触和差质检查，结果直接留在本页。',
        startScan: '开始扫描',
        scanScopeSummary: (count: number) => `已选择 ${count} 个媒体`,
        scanScopeHint: '默认先扫描最近 12 个月，之后会继续向更早媒体回填；离开再回来会自动接回进度。',
        scanProgressTitle: '本地扫描',
        scanProgressValue: (current: number, total: number) => `${current}/${total}`,
        scanProgressFootnote: '模糊、重复、近相似、误触和差质候选会持续留在下方，正常媒体会逐步退场。',
        scanCurrentBatchRange: (start: string, end: string) => `当前扫描批次：${start} - ${end}`,
        scanBatchRange: (start: string, end: string) => `已扫描范围：${start} - ${end}`,
        scanCompleteTitle: '本地扫描',
        scanExhaustedTitle: '当前这一批已处理完成',
        scanExhaustedBody: '继续扫描会从上一批之前的更早媒体接着回填；整库已覆盖时，只处理新增或变化媒体。',
        scanResultSummary: (count: number) => `发现 ${count} 个待处理媒体`,
        scanResultFootnote: '结果已按本地规则留在当前页面，可继续筛选、查看并决定清理或保留。',
        scanAllCompleteTitle: '全部媒体已扫描完成',
        scanAllCompleteBody: '当前媒体库已经完整覆盖；后续只有新增或变化媒体需要重新进入扫描。',
        continueScan: '继续扫描',
        selectedItems: (count: number) => `已选 ${count} 项`,
        cleanupSelected: '清理所选',
        keepSelected: '保留',
      },
    },
    reminder: {
      channelName: '定期清理提醒',
      channelDescription: '提醒你重新扫描最近媒体并清理重复、模糊与相似内容。',
    },
  },
}));

vi.mock('expo-media-library', () => mediaLibraryApi);
vi.mock('@react-navigation/native', () => {
  const ReactModule = require('react') as typeof import('react');

  return {
    useFocusEffect: (callback: () => void | (() => void)) => {
      ReactModule.useEffect(() => callback(), [callback]);
    },
  };
});
vi.mock('../../../application/AppPreferencesContext', () => ({
  useAppPreferences: () => ({
    copy: appPreferencesState.copy,
    theme: appPreferencesState.theme,
    language: appPreferencesState.language,
  }),
}));
vi.mock('../../../services/storage/app-storage', () => storageApi);
vi.mock('../../../features/scan/scan-media-library', () => scanApi);
vi.mock('../../../services/notifications/cleanup-reminders', () => cleanupReminderApi);
vi.mock('../../../services/notifications/scan-completion-notifications', () => notificationApi);
vi.mock('../../../features/reminders/reminder-runtime', () => reminderRuntimeApi);
vi.mock('../../../features/scan/photo-scan-session-runtime', () => photoScanSessionRuntimeApi);
vi.mock('../../../features/scan/android-background-scan', () => backgroundScanApi);
vi.mock('../../../features/scan/android-native-scan', () => androidNativeScanApi);
vi.mock('../../../features/scan/android-media-store', () => androidMediaStoreApi);
vi.mock('../../../services/storage/scan-job-storage', () => scanJobStorageApi);
vi.mock('../../../services/storage/scan-range-storage', async () => {
  const actual = await vi.importActual<typeof import('../../../services/storage/scan-range-storage')>(
    '../../../services/storage/scan-range-storage',
  );

  return {
    ...actual,
    loadScanRange: scanRangeStorageApi.loadScanRange,
  };
});
vi.mock('../../components/PhotoGrid', () => ({
  PhotoGrid: ({
    candidates,
    selectedIds,
    selectionMode,
    mediaType,
    onItemPress,
    onSelect,
    onSelectionChange,
  }: {
    candidates: Array<{ id: string; asset?: { mediaType?: string } }>;
    selectedIds?: string[];
    selectionMode?: boolean;
    mediaType: 'all' | 'photo' | 'video';
    onItemPress: (candidate: { id: string; asset?: { mediaType?: string } }) => void;
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
  }) => {
    const filteredCandidates =
      mediaType === 'all'
        ? candidates
        : candidates.filter((candidate) => candidate.asset?.mediaType === mediaType);
    const swipeRangeIds = filteredCandidates.slice(0, 2).map((candidate) => candidate.id);

    return React.createElement(
      'View',
      { testID: 'mock-photo-grid' },
      React.createElement('Text', null, `grid-count:${filteredCandidates.length}`),
      React.createElement('Text', { testID: 'mock-photo-grid-selected-count' }, `selected-count:${selectedIds?.length ?? 0}`),
      React.createElement(
        'Pressable',
        {
          testID: 'mock-photo-grid-swipe-select-first-two',
          onPress: () =>
            onSelectionChange?.(swipeRangeIds, {
              source: 'swipe-selection',
              action: 'add',
              anchorId: swipeRangeIds[0] ?? '',
              rangeIds: swipeRangeIds,
            }),
        },
        React.createElement('Text', null, 'swipe-select-first-two'),
      ),
      ...filteredCandidates.flatMap((candidate) => [
        React.createElement('Text', { key: `${candidate.id}-label` }, candidate.id),
        React.createElement(
          'Pressable',
          {
            key: `${candidate.id}-press`,
            testID: `mock-photo-grid-press-${candidate.id}`,
            onPress: () => (selectionMode ? onSelect(candidate.id) : onItemPress(candidate)),
            onLongPress: () => onSelect(candidate.id),
          },
          React.createElement('Text', null, `press:${candidate.id}`),
        ),
      ]),
    );
  },
}));
vi.mock('../DetailScreen', () => {
  function MockDetailScreen({
    candidate,
    duplicateCandidates,
    onClose,
    onKeep,
    onPrimaryAction,
    onHardDelete,
  }: {
    candidate: { id: string } | null;
    duplicateCandidates?: { id: string }[];
    onClose: () => void;
    onKeep?: (ids?: string[]) => void;
    onPrimaryAction: (ids?: string[]) => void;
    onHardDelete: (ids?: string[]) => void;
  }) {
    const detailScopeCount = candidate ? Math.max(1, duplicateCandidates?.length ?? 0) : 0;

    return React.createElement(
      'View',
      { testID: 'mock-detail-screen' },
      React.createElement('Text', null, `detail:${candidate?.id ?? 'none'}`),
      React.createElement('Text', null, `detail-scope:${detailScopeCount}`),
      React.createElement(
        'Pressable',
        { testID: 'mock-detail-close', onPress: onClose },
        React.createElement('Text', null, 'close-detail'),
      ),
      React.createElement(
        'Pressable',
        { testID: 'mock-detail-keep', onPress: () => onKeep?.() },
        React.createElement('Text', null, 'keep-detail'),
      ),
      React.createElement(
        'Pressable',
        { testID: 'mock-detail-primary', onPress: () => onPrimaryAction() },
        React.createElement('Text', null, 'primary-detail'),
      ),
      React.createElement(
        'Pressable',
        { testID: 'mock-detail-hard-delete', onPress: () => onHardDelete() },
        React.createElement('Text', null, 'hard-delete-detail'),
      ),
    );
  }

  return { DetailScreen: MockDetailScreen };
});
vi.mock('../../components/SegmentedControl', () => ({
  SegmentedControl: ({
    options,
  }: {
    options: readonly { value: string; label: string; count?: number }[];
  }) =>
    React.createElement(
      'View',
      { testID: 'mock-segmented-control' },
      ...options.map((option) =>
        React.createElement(
          'Text',
          { key: option.value },
          typeof option.count === 'number' ? `${option.label} ${option.count}` : option.label,
        ),
      ),
    ),
}));
vi.mock('../../components/ScanProgress', () => ({
  ScanProgress: ({
    current,
    total,
    resultsCount,
  }: {
    current: number;
    total: number;
    resultsCount?: number;
  }) =>
    React.createElement(
      'View',
      { testID: 'scan-progress-inline' },
      React.createElement('Text', null, current >= total ? '扫描完成' : '扫描中'),
      React.createElement('Text', null, `${current}/${total}`),
      resultsCount
        ? React.createElement('Text', null, `发现 ${resultsCount} 个待处理媒体`)
        : null,
    ),
}));

import { getAppCopy } from '../../../i18n/app-copy';
import { buildScanRangeStartAt } from '../../../services/storage/scan-range-storage';
import { PhotoGridScreen, resolveConfiguredScanWindow } from '../PhotoGridScreen';
import {
  buildFilterWrapInsets,
  buildFloatingActionBarInsets,
  buildPhotoGridContentPadding,
  buildPhotoGridEntryCopy,
  buildPhotoGridEntryInsets,
  buildPhotoGridFilterOptions,
  buildPhotoGridScopeBreakdown,
  buildPhotoGridTabOptions,
  buildMediaGridLayout,
  PHOTO_GRID_ENTRY_INTERACTION_STANDARD,
} from '../screen-layout';

const mockGetAssetsAsync = vi.mocked(mediaLibraryApi.getAssetsAsync);
const mockGetPermissionsAsync = vi.mocked(mediaLibraryApi.getPermissionsAsync);
const mockRequestPermissionsAsync = vi.mocked(mediaLibraryApi.requestPermissionsAsync);
const mockLoadRecycleBinIds = vi.mocked(storageApi.loadRecycleBinIds);
const mockLoadRecycleBinCandidateCache = vi.mocked(storageApi.loadRecycleBinCandidateCache);
const mockLoadPhotoScanResultCache = vi.mocked(storageApi.loadPhotoScanResultCache);
const mockLoadFalsePositiveCandidateIds = vi.mocked(storageApi.loadFalsePositiveCandidateIds);
const mockAppendFalsePositiveCandidateIds = vi.mocked(storageApi.appendFalsePositiveCandidateIds);
const mockLoadAssetManifestEntries = vi.mocked(storageApi.loadAssetManifestEntries);
const mockLoadPhotoScanBatch = vi.mocked(storageApi.loadPhotoScanBatch);
const mockLoadLatestCompletedPhotoScanBatch = vi.mocked(
  storageApi.loadLatestCompletedPhotoScanBatch,
);
const mockLoadLatestPhotoScanBatch = vi.mocked(storageApi.loadLatestPhotoScanBatch);
const mockLoadMediaAnalysisCache = vi.mocked(storageApi.loadMediaAnalysisCache);
const mockLoadPhotoScanBatchItems = vi.mocked(storageApi.loadPhotoScanBatchItems);
const mockSaveRecycleBinIds = vi.mocked(storageApi.saveRecycleBinIds);
const mockSaveRecycleBinCandidateCache = vi.mocked(storageApi.saveRecycleBinCandidateCache);
const mockSavePhotoScanResultCache = vi.mocked(storageApi.savePhotoScanResultCache);
const mockClearPhotoScanResultCache = vi.mocked(storageApi.clearPhotoScanResultCache);
const mockSavePhotoScanBatch = vi.mocked(storageApi.savePhotoScanBatch);
const mockSavePhotoScanBatchItems = vi.mocked(storageApi.savePhotoScanBatchItems);
const mockSaveLastScanMeta = vi.mocked(storageApi.saveLastScanMeta);
const mockSaveLastValidScanBaseline = vi.mocked(storageApi.saveLastValidScanBaseline);
const mockUpsertAssetManifestEntries = vi.mocked(storageApi.upsertAssetManifestEntries);
const mockScanMediaLibrary = vi.mocked(scanApi.scanMediaLibrary);
const mockNotifyScanCompletionIfNeeded = vi.mocked(notificationApi.notifyScanCompletionIfNeeded);
const mockCaptureLastValidScanBaseline = vi.mocked(cleanupReminderApi.captureLastValidScanBaseline);
const mockReconcileReminderRuntimeOnLaunch = vi.mocked(
  reminderRuntimeApi.reconcileReminderRuntimeOnLaunch,
);
const mockReconcileReminderRuntimeInForeground = vi.mocked(
  reminderRuntimeApi.reconcileReminderRuntimeInForeground,
);
const mockSyncAndroidBackgroundScanForegroundService = vi.mocked(
  backgroundScanApi.syncAndroidBackgroundScanForegroundService,
);
const mockExecuteAndroidNativeFirstScan = vi.mocked(
  androidNativeScanApi.executeAndroidNativeFirstScan,
);
const mockEnumerateAndroidMediaStoreAssets = vi.mocked(
  androidMediaStoreApi.enumerateAndroidMediaStoreAssets,
);
const mockLoadScanRange = vi.mocked(scanRangeStorageApi.loadScanRange);
const mockLoadActiveAndroidNativeScanSnapshot = vi.mocked(
  androidNativeScanApi.loadActiveAndroidNativeScanSnapshot,
);
const mockStopAndroidNativeScan = vi.mocked(androidNativeScanApi.stopAndroidNativeScan);
const mockLoadPhotoScanJobCheckpoint = vi.mocked(scanJobStorageApi.loadPhotoScanJobCheckpoint);
const mockSavePhotoScanJobCheckpoint = vi.mocked(scanJobStorageApi.savePhotoScanJobCheckpoint);
const mockClearPhotoScanJobCheckpoint = vi.mocked(scanJobStorageApi.clearPhotoScanJobCheckpoint);
const ReactTestRenderer = TestRenderer;

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function flattenTextChildren(children: React.ReactNode): string {
  if (typeof children === 'string' || typeof children === 'number') {
    return String(children);
  }

  if (Array.isArray(children)) {
    return children.map(flattenTextChildren).join('');
  }

  if (React.isValidElement<{ children?: React.ReactNode }>(children)) {
    return flattenTextChildren(children.props.children);
  }

  return '';
}

function collectRenderedTexts(renderer: ReturnType<typeof ReactTestRenderer.create>) {
  return renderer.root
    .findAllByType('Text')
    .map((node: { props: { children?: React.ReactNode } }) => flattenTextChildren(node.props.children))
    .filter(Boolean);
}

function flattenStyle(style: unknown): Record<string, unknown> {
  if (Array.isArray(style)) {
    return style.reduce<Record<string, unknown>>(
      (mergedStyle, stylePart) => ({
        ...mergedStyle,
        ...flattenStyle(stylePart),
      }),
      {},
    );
  }

  if (style && typeof style === 'object') {
    return style as Record<string, unknown>;
  }

  return {};
}

async function flushPromises() {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
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

async function renderScreen(props: React.ComponentProps<typeof PhotoGridScreen> = {}) {
  let renderer: ReturnType<typeof ReactTestRenderer.create>;

  await act(async () => {
    renderer = ReactTestRenderer.create(<PhotoGridScreen {...props} />);
    await flushPromises();
  });

  return renderer!;
}

async function pressPrimaryButton(renderer: ReturnType<typeof ReactTestRenderer.create>) {
  await act(async () => {
    const target =
      renderer.root.findAllByProps({ testID: 'photo-grid-start-scan-button' })[0] ??
      renderer.root.findByProps({ testID: 'photo-grid-request-permission-button' });
    target.props.onPress();
    await flushPromises();
  });
}

async function pressByTestId(
  renderer: ReturnType<typeof ReactTestRenderer.create>,
  testID: string,
) {
  await act(async () => {
    renderer.root.findByProps({ testID }).props.onPress();
    await flushPromises();
  });
}

async function longPressByTestId(
  renderer: ReturnType<typeof ReactTestRenderer.create>,
  testID: string,
) {
  await act(async () => {
    renderer.root.findByProps({ testID }).props.onLongPress();
    await flushPromises();
  });
}

function createAsset(id: string, mediaType: string) {
  return {
    id,
    filename: `${id}.${mediaType === mediaLibraryApi.MediaType.video ? 'mp4' : 'jpg'}`,
    uri: `file:///${id}.${mediaType === mediaLibraryApi.MediaType.video ? 'mp4' : 'jpg'}`,
    mediaType,
    width: mediaType === mediaLibraryApi.MediaType.video ? 1920 : 3024,
    height: mediaType === mediaLibraryApi.MediaType.video ? 1080 : 4032,
    duration: mediaType === mediaLibraryApi.MediaType.video ? 12 : 0,
    creationTime: 1_710_000_000_000,
  };
}

function setPlatformOS(nextOs: 'ios' | 'android') {
  platformState.os = nextOs;
}

function createCleanupCandidate(id: string, mediaType: 'photo' | 'video' = 'photo') {
  return {
    id,
    asset: {
      id,
      uri: `file:///${id}.${mediaType === 'video' ? 'mp4' : 'jpg'}`,
      previewUri:
        mediaType === 'video'
          ? `file:///${id}-preview.jpg`
          : `file:///${id}.jpg`,
      mediaType,
      width: mediaType === 'video' ? 1920 : 3024,
      height: mediaType === 'video' ? 1080 : 4032,
      duration: mediaType === 'video' ? 12 : 0,
      fileSize: mediaType === 'video' ? 2_400_000 : 280_000,
      creationTime: 1_710_000_000_000,
    },
    score: 82,
    confidence: 'high',
    kind: mediaType === 'video' ? 'abnormal-video' : 'abnormal-photo',
    primaryIssueType: 'abnormal',
    issueTypes: ['abnormal'],
    reasons: ['测试命中'],
  } as const;
}

function createDuplicateCleanupCandidate(
  id: string,
  relation: 'exact' | 'near' = 'exact',
) {
  const candidate = createCleanupCandidate(id);

  return {
    ...candidate,
    kind: 'duplicate-photo',
    primaryIssueType: 'duplicate',
    issueTypes: ['duplicate'],
    reasons: ['重复内容'],
    duplicateGroup: {
      groupId: `${id}-group`,
      representativeId: id,
      relation,
      size: 2,
      similarity: relation === 'exact' ? 1 : 0.92,
      representativeReason: 'larger-file',
      representativeWidth: candidate.asset.width,
      representativeHeight: candidate.asset.height,
      representativeFileSize: candidate.asset.fileSize,
      representativeCreationTime: candidate.asset.creationTime,
    },
  } as const;
}

function createAnalyzedInput(
  id: string,
  options: {
    mediaType?: 'photo' | 'video';
    width?: number;
    height?: number;
    fileSize?: number;
    duration?: number;
    brightness?: number;
    contrast?: number;
    edgeDensity?: number;
    fingerprint?: string | null;
  } = {},
) {
  const mediaType = options.mediaType ?? 'photo';

  return {
    asset: {
      id,
      uri: `file:///${id}.${mediaType === 'video' ? 'mp4' : 'jpg'}`,
      previewUri:
        mediaType === 'video'
          ? `file:///${id}-preview.jpg`
          : `file:///${id}.jpg`,
      mediaType,
      width: options.width ?? (mediaType === 'video' ? 1920 : 3024),
      height: options.height ?? (mediaType === 'video' ? 1080 : 4032),
      duration: options.duration ?? (mediaType === 'video' ? 12 : 0),
      fileSize: options.fileSize ?? (mediaType === 'video' ? 2_400_000 : 280_000),
      creationTime: 1_710_000_000_000,
    },
    metrics: {
      brightness: options.brightness ?? 0.56,
      contrast: options.contrast ?? 0.32,
      edgeDensity: options.edgeDensity ?? 0.28,
    },
    fingerprint: options.fingerprint ?? null,
    analysisStatus: 'ok',
  } as const;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function createAndroidMediaStoreAsset(
  assetId: string,
  options: {
    mediaType?: 'photo' | 'video';
    dateTaken?: number | null;
    dateModified?: number | null;
  } = {},
) {
  const mediaType = options.mediaType ?? 'photo';

  return {
    assetId,
    contentUri: `content://media/${mediaType}/${assetId}`,
    mediaType,
    width: mediaType === 'video' ? 1920 : 3024,
    height: mediaType === 'video' ? 1080 : 4032,
    durationMs: mediaType === 'video' ? 12_000 : 0,
    fileSizeBytes: mediaType === 'video' ? 2_400_000 : 280_000,
    dateTaken: options.dateTaken ?? 1_710_000_000_000,
    dateModified: options.dateModified ?? options.dateTaken ?? 1_710_000_000_000,
    bucketId: 'bucket-1',
    bucketName: 'Camera',
    mimeType: mediaType === 'video' ? 'video/mp4' : 'image/jpeg',
    isScreenshot: false,
    bitrate: mediaType === 'video' ? 8_000_000 : null,
    frameRate: mediaType === 'video' ? 30 : null,
    codec: mediaType === 'video' ? 'video/avc' : null,
    orientation: 0,
    aspectRatio: mediaType === 'video' ? 1.7777777778 : 0.75,
  } as const;
}

function createManifestEntryFromAndroidAsset(
  asset: ReturnType<typeof createAndroidMediaStoreAsset>,
  options: {
    dirtyReason?: 'new' | 'modified' | 'missing-analysis' | null;
    observedAt?: number;
  } = {},
) {
  const observedAt = options.observedAt ?? 1_710_000_100_000;

  return {
    assetId: asset.assetId,
    contentUri: asset.contentUri,
    mediaType: asset.mediaType,
    mimeType: asset.mimeType,
    width: asset.width,
    height: asset.height,
    orientation: asset.orientation,
    aspectRatio: asset.aspectRatio,
    durationMs: asset.durationMs,
    fileSizeBytes: asset.fileSizeBytes,
    dateTaken: asset.dateTaken,
    dateModified: asset.dateModified,
    bucketId: asset.bucketId,
    bucketName: asset.bucketName,
    isScreenshot: asset.isScreenshot,
    bitrate: asset.bitrate,
    frameRate: asset.frameRate,
    codec: asset.codec,
    firstSeenAt: observedAt,
    lastSeenAt: observedAt,
    isDeleted: false,
    dirtyReason: options.dirtyReason ?? null,
    updatedAt: observedAt,
  } as const;
}

describe('resolveConfiguredScanWindow', () => {
  it('continues backfill from the earliest completed batch boundary instead of resetting to the rolling window', () => {
    const now = Date.UTC(2026, 3, 24, 0, 0, 0);
    const rollingRangeStartAt = buildScanRangeStartAt(12, now);
    const previousBackfillRangeStartAt = buildScanRangeStartAt(12, rollingRangeStartAt);
    const expectedNextBackfillRangeStartAt = buildScanRangeStartAt(12, previousBackfillRangeStartAt);

    expect(
      resolveConfiguredScanWindow({
        scanRangeMonths: 12,
        latestCompletedBatch: {
          batchId: 'batch-backfill-1',
          mode: 'backfill',
          phase: 'completed',
          windowDays: Math.round((rollingRangeStartAt - previousBackfillRangeStartAt) / DAY_MS),
          rangeStartAt: previousBackfillRangeStartAt,
          rangeEndAt: rollingRangeStartAt,
          progressCurrent: 42,
          progressTotal: 42,
          enumeratedCount: 42,
          dirtyCount: 9,
          analyzedCount: 9,
          candidateCount: 0,
          startedAt: rollingRangeStartAt,
          lastHeartbeatAt: rollingRangeStartAt,
          completedAt: rollingRangeStartAt,
          lastError: null,
          updatedAt: rollingRangeStartAt,
        },
        nowInput: now,
      }),
    ).toEqual({
      status: 'ready',
      mode: 'backfill',
      rangeStartAt: expectedNextBackfillRangeStartAt,
      rangeEndAt: previousBackfillRangeStartAt,
      windowDays: Math.round(
        (previousBackfillRangeStartAt - expectedNextBackfillRangeStartAt) / DAY_MS,
      ),
    });
  });

  it('resets to the configured rolling window when the completed batch was created with a different window size', () => {
    const now = Date.UTC(2026, 3, 24, 0, 0, 0);
    const rollingRangeStartAt = buildScanRangeStartAt(12, now);

    expect(
      resolveConfiguredScanWindow({
        scanRangeMonths: 12,
        latestCompletedBatch: {
          batchId: 'batch-rolling-1',
          mode: 'rolling-window',
          phase: 'completed',
          windowDays: 180,
          rangeStartAt: buildScanRangeStartAt(6, now),
          rangeEndAt: now,
          progressCurrent: 20,
          progressTotal: 20,
          enumeratedCount: 20,
          dirtyCount: 5,
          analyzedCount: 5,
          candidateCount: 0,
          startedAt: now,
          lastHeartbeatAt: now,
          completedAt: now,
          lastError: null,
          updatedAt: now,
        },
        nowInput: now,
      }),
    ).toEqual({
      status: 'ready',
      mode: 'rolling-window',
      rangeStartAt: rollingRangeStartAt,
      rangeEndAt: now,
      windowDays: Math.round((now - rollingRangeStartAt) / DAY_MS),
    });
  });

  it('treats a completed full batch as terminal instead of restarting the rolling window', () => {
    const now = Date.UTC(2026, 3, 24, 0, 0, 0);
    const rollingRangeStartAt = buildScanRangeStartAt(12, now);

    expect(
      resolveConfiguredScanWindow({
        scanRangeMonths: 12,
        latestCompletedBatch: {
          batchId: 'batch-full-1',
          mode: 'full',
          phase: 'completed',
          windowDays: Math.round((now - rollingRangeStartAt) / DAY_MS),
          rangeStartAt: rollingRangeStartAt,
          rangeEndAt: now,
          progressCurrent: 261,
          progressTotal: 261,
          enumeratedCount: 261,
          dirtyCount: 0,
          analyzedCount: 0,
          candidateCount: 0,
          startedAt: now,
          lastHeartbeatAt: now,
          completedAt: now,
          lastError: null,
          updatedAt: now,
        },
        nowInput: now,
      }),
    ).toEqual({
      status: 'complete',
      mode: 'complete',
      rangeStartAt: null,
      rangeEndAt: now,
      windowDays: null,
    });
  });

  it('does not treat a zero-denominator completed full batch as terminal coverage', () => {
    const now = Date.UTC(2026, 3, 24, 0, 0, 0);
    const rollingRangeStartAt = buildScanRangeStartAt(12, now);

    expect(
      resolveConfiguredScanWindow({
        scanRangeMonths: 12,
        latestCompletedBatch: {
          batchId: 'batch-full-zero',
          mode: 'full',
          phase: 'completed',
          windowDays: Math.round((now - rollingRangeStartAt) / DAY_MS),
          rangeStartAt: rollingRangeStartAt,
          rangeEndAt: now,
          progressCurrent: 0,
          progressTotal: 0,
          enumeratedCount: 0,
          dirtyCount: 0,
          analyzedCount: 0,
          candidateCount: 0,
          startedAt: now,
          lastHeartbeatAt: now,
          completedAt: now,
          lastError: null,
          updatedAt: now,
        },
        nowInput: now,
      }),
    ).toEqual({
      status: 'ready',
      mode: 'rolling-window',
      rangeStartAt: rollingRangeStartAt,
      rangeEndAt: now,
      windowDays: Math.round((now - rollingRangeStartAt) / DAY_MS),
    });
  });
});

describe('PhotoGridScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    platformState.reset();
    mockGetAssetsAsync.mockResolvedValue({
      assets: [
        createAsset('photo-1', mediaLibraryApi.MediaType.photo),
        createAsset('photo-2', mediaLibraryApi.MediaType.photo),
        createAsset('video-1', mediaLibraryApi.MediaType.video),
      ],
      hasNextPage: false,
      endCursor: undefined,
    });
    mockGetPermissionsAsync.mockResolvedValue({ granted: true });
    mockRequestPermissionsAsync.mockResolvedValue({ granted: true });
    mockLoadRecycleBinIds.mockResolvedValue([]);
    mockLoadRecycleBinCandidateCache.mockResolvedValue([]);
    mockLoadPhotoScanResultCache.mockResolvedValue(null);
    mockLoadFalsePositiveCandidateIds.mockResolvedValue([]);
    mockLoadAssetManifestEntries.mockResolvedValue([]);
    mockLoadPhotoScanBatch.mockResolvedValue(null);
    mockLoadLatestCompletedPhotoScanBatch.mockResolvedValue(null);
    mockLoadLatestPhotoScanBatch.mockResolvedValue(null);
    mockLoadMediaAnalysisCache.mockResolvedValue({});
    mockLoadPhotoScanBatchItems.mockResolvedValue([]);
    mockAppendFalsePositiveCandidateIds.mockImplementation(async (ids) => [...new Set(ids)].sort());
    mockSaveRecycleBinIds.mockResolvedValue(undefined);
    mockSaveRecycleBinCandidateCache.mockResolvedValue(undefined);
    mockSavePhotoScanResultCache.mockResolvedValue(undefined);
    mockClearPhotoScanResultCache.mockResolvedValue(undefined);
    mockSavePhotoScanBatch.mockResolvedValue(undefined);
    mockSavePhotoScanBatchItems.mockResolvedValue(undefined);
    mockSaveLastScanMeta.mockResolvedValue(undefined);
    mockSaveLastValidScanBaseline.mockResolvedValue(undefined);
    mockUpsertAssetManifestEntries.mockResolvedValue(undefined);
    mockNotifyScanCompletionIfNeeded.mockResolvedValue(true);
    mockSyncAndroidBackgroundScanForegroundService.mockResolvedValue(false);
    mockLoadActiveAndroidNativeScanSnapshot.mockResolvedValue(null);
    mockExecuteAndroidNativeFirstScan.mockImplementation(async () => ({
      mode: 'native',
      fallbackReason: null,
      output: {
        state: {
          activeCandidates: [],
          recycleBin: [],
          selectedIds: [],
        },
        summary: {
          scannedAt: 1_710_000_000_000,
          scannedCount: 0,
          candidateCount: 0,
          highConfidenceCount: 0,
          mediumConfidenceCount: 0,
          recycleBinCount: 0,
        },
      },
    }));
    mockLoadPhotoScanJobCheckpoint.mockResolvedValue(null);
    mockSavePhotoScanJobCheckpoint.mockResolvedValue(undefined);
    mockClearPhotoScanJobCheckpoint.mockResolvedValue(undefined);
    mockCaptureLastValidScanBaseline.mockResolvedValue({
      scannedAt: 1_710_000_000_000,
      scannedCount: 0,
      candidateCount: 0,
      scanRangeMonths: 12,
      latestEligibleAssetAt: 1_710_000_000_000,
      ledgerUpdatedAt: 1_710_000_000_000,
    });
    mockEnumerateAndroidMediaStoreAssets.mockResolvedValue([]);
    mockLoadScanRange.mockResolvedValue(12);
    mockReconcileReminderRuntimeOnLaunch.mockResolvedValue({
      settings: {
        enabled: false,
        frequency: 'weekly',
        weekday: 1,
        hour: 20,
        minute: 30,
        notificationId: null,
        nextTriggerAt: null,
        summary: '定期检查最近拍摄的照片和视频，优先清理重复、模糊与相似内容。',
      },
      permissionGranted: false,
    });
    mockReconcileReminderRuntimeInForeground.mockResolvedValue({
      settings: {
        enabled: false,
        frequency: 'weekly',
        weekday: 1,
        hour: 20,
        minute: 30,
        notificationId: null,
        nextTriggerAt: null,
        summary: '定期检查最近拍摄的照片和视频，优先清理重复、模糊与相似内容。',
      },
      permissionGranted: false,
    });
    mockScanMediaLibrary.mockResolvedValue({
      state: {
        activeCandidates: [],
        recycleBin: [],
        selectedIds: [],
      },
      summary: {
        scannedAt: 1_710_000_000_000,
        scannedCount: 0,
        candidateCount: 0,
        highConfidenceCount: 0,
        mediumConfidenceCount: 0,
        recycleBinCount: 0,
      },
    });
    appStateApi.reset();
    hardwareBackApi.reset();
    photoScanSessionRuntimeApi.reset();
  });

  it('uses English filter labels from the shared app copy', () => {
    const copy = getAppCopy('en-US');

    expect(buildPhotoGridFilterOptions(copy)).toEqual([
      { value: 'all', label: 'All', icon: 'apps-outline' },
      { value: 'photo', label: 'Photos', icon: 'image-outline' },
      { value: 'video', label: 'Videos', icon: 'videocam-outline' },
    ]);
  });

  it('shows a loading prompt while the permission status is being checked', () => {
    const copy = getAppCopy('zh-CN');

    expect(buildPhotoGridEntryCopy(copy, { permissionState: 'loading' })).toEqual({
      eyebrow: copy.screens.photoGrid.permissionChecking,
      title: copy.screens.photoGrid.scanScopeSummary(
        PHOTO_GRID_ENTRY_INTERACTION_STANDARD.defaultScanScopeCount,
      ),
      body: null,
      action: null,
      progress: null,
      note: null,
      result: null,
    });
  });

  it('shows the permission prompt when access is denied', () => {
    const copy = getAppCopy('en-US');

    expect(buildPhotoGridEntryCopy(copy, { permissionState: 'denied' })).toEqual({
      eyebrow: copy.permission.title,
      title: copy.screens.photoGrid.scanScopeSummary(
        PHOTO_GRID_ENTRY_INTERACTION_STANDARD.defaultScanScopeCount,
      ),
      body: copy.permission.body,
      action: copy.permission.action,
      progress: null,
      note: null,
      result: null,
    });
  });

  it('shows the scan prompt when access is granted', () => {
    const copy = getAppCopy('zh-CN');

    expect(buildPhotoGridEntryCopy(copy, { permissionState: 'granted' })).toEqual({
      eyebrow: copy.screens.photoGrid.scanPromptTitle,
      title: copy.screens.photoGrid.scanScopeSummary(
        PHOTO_GRID_ENTRY_INTERACTION_STANDARD.defaultScanScopeCount,
      ),
      body: null,
      action: copy.screens.photoGrid.startScan,
      progress: null,
      note: null,
      result: null,
    });
  });

  it('builds a compact scope breakdown for all, photos, and videos', () => {
    const copy = getAppCopy('zh-CN');

    expect(
      buildPhotoGridScopeBreakdown(copy, {
        total: 360,
        photo: 240,
        video: 120,
      }),
    ).toEqual([
      { key: 'all', label: '全部', count: 360 },
      { key: 'photo', label: '照片', count: 240 },
      { key: 'video', label: '视频', count: 120 },
    ]);
  });

  it('moves scope counts into the lower tab labels after scan completion', () => {
    const copy = getAppCopy('zh-CN');

    expect(
      buildPhotoGridTabOptions(copy, {
        total: 360,
        photo: 339,
        video: 21,
      }),
    ).toEqual([
      { value: 'all', label: '全部', count: 360, icon: 'apps-outline' },
      { value: 'photo', label: '照片', count: 339, icon: 'image-outline' },
      { value: 'video', label: '视频', count: 21, icon: 'videocam-outline' },
    ]);
  });

  it('uses inline rail progress and completion summaries for the granted state', () => {
    const copy = getAppCopy('zh-CN');

    expect(
      buildPhotoGridEntryCopy(copy, {
        permissionState: 'granted',
        isScanning: true,
        progressCurrent: 40,
        progressTotal: 360,
        currentFileName: 'IMG_040.jpg',
      }),
    ).toEqual({
      eyebrow: copy.screens.photoGrid.scanProgressTitle,
      title: copy.screens.photoGrid.scanScopeSummary(
        PHOTO_GRID_ENTRY_INTERACTION_STANDARD.defaultScanScopeCount,
      ),
      body: copy.screens.photoGrid.scanProgressFootnote,
      action: copy.controls.scanning,
      progress: {
        current: 40,
        total: 360,
        value: '40/360',
      },
      note: null,
      result: null,
    });

    expect(
      buildPhotoGridEntryCopy(copy, {
        permissionState: 'granted',
        hasCompletedScan: true,
        progressCurrent: 360,
        progressTotal: 360,
        resultCount: 12,
      }),
    ).toEqual({
      eyebrow: copy.screens.photoGrid.scanCompleteTitle,
      title: copy.screens.photoGrid.scanScopeSummary(
        PHOTO_GRID_ENTRY_INTERACTION_STANDARD.defaultScanScopeCount,
      ),
      body: copy.screens.photoGrid.scanResultFootnote,
      action: copy.controls.rescan,
      progress: {
        current: 360,
        total: 360,
        value: '360/360',
      },
      note: null,
      result: copy.screens.photoGrid.scanResultSummary(12),
    });
  });

  it('shows the active scan batch range when entry copy has a range label', () => {
    const copy = getAppCopy('zh-CN');
    const scanRangeLabel = copy.screens.photoGrid.scanCurrentBatchRange('2025.04.24', '2026.04.24');

    expect(
      buildPhotoGridEntryCopy(copy, {
        permissionState: 'granted',
        isScanning: true,
        progressCurrent: 40,
        progressTotal: 360,
        scanRangeLabel,
      }),
    ).toMatchObject({
      action: copy.controls.scanning,
      note: scanRangeLabel,
      progress: {
        current: 40,
        total: 360,
        value: '40/360',
      },
    });
  });

  it('builds a completed scan breakdown from live candidates', () => {
    const copy = getAppCopy('zh-CN');

    expect(
      buildPhotoGridEntryCopy(copy, {
        permissionState: 'granted',
        hasCompletedScan: true,
        progressCurrent: 4,
        progressTotal: 4,
        resultCount: 4,
        liveCandidates: [
          { primaryIssueType: 'accidental' },
          { primaryIssueType: 'abnormal' },
          { primaryIssueType: 'duplicate' },
          {
            primaryIssueType: 'duplicate',
            duplicateGroup: {
              groupId: 'near-group',
              representativeId: 'near-1',
              relation: 'near',
              size: 2,
              similarity: 0.92,
              representativeReason: 'higher-resolution',
              representativeWidth: 1200,
              representativeHeight: 900,
              representativeFileSize: 1000,
              representativeCreationTime: 1,
            },
          },
        ],
      }),
    ).toMatchObject({
      result: copy.screens.photoGrid.scanResultSummary(4),
      resultBreakdown: [
        { key: 'duplicate', label: copy.summary.duplicateLabel, count: 1 },
        { key: 'blurry', label: copy.summary.blurryLabel, count: 2 },
        { key: 'similar', label: copy.summary.similarLabel, count: 1 },
      ],
    });
  });

  it('shows a continue-scan empty state once the current batch is fully processed', () => {
    const copy = getAppCopy('zh-CN');

    expect(
      buildPhotoGridEntryCopy(copy, {
        permissionState: 'granted',
        hasCompletedScan: true,
        progressCurrent: 360,
        progressTotal: 360,
        resultCount: 0,
      }),
    ).toEqual({
      eyebrow: copy.screens.photoGrid.scanCompleteTitle,
      title: copy.screens.photoGrid.scanExhaustedTitle,
      body: copy.screens.photoGrid.scanExhaustedBody,
      action: copy.screens.photoGrid.continueScan,
      progress: {
        current: 360,
        total: 360,
        value: '360/360',
      },
      note: null,
      result: null,
    });
  });

  it('shows a terminal all-scanned state once full library coverage is complete', () => {
    const copy = getAppCopy('zh-CN');

    expect(
      buildPhotoGridEntryCopy(copy, {
        permissionState: 'granted',
        hasCompletedScan: true,
        hasCompletedFullScan: true,
        progressCurrent: 261,
        progressTotal: 261,
        resultCount: 0,
      }),
    ).toEqual({
      eyebrow: copy.screens.photoGrid.scanCompleteTitle,
      title: copy.screens.photoGrid.scanAllCompleteTitle,
      body: copy.screens.photoGrid.scanAllCompleteBody,
      action: null,
      progress: {
        current: 261,
        total: 261,
        value: '261/261',
      },
      note: null,
      result: null,
    });
  });

  it('derives safe-area aware content padding for a special-screen layout', () => {
    const insets = { top: 26, bottom: 24, left: 30, right: 26 };

    expect(buildFilterWrapInsets(insets)).toEqual({
      top: 8,
      left: 46,
      right: 42,
    });
    expect(buildPhotoGridEntryInsets(insets)).toEqual({
      top: 38,
      left: 46,
      right: 42,
    });
    expect(buildPhotoGridContentPadding(insets)).toEqual({
      left: 30,
      right: 26,
      bottom: 112,
    });
    expect(buildFloatingActionBarInsets(insets)).toEqual({
      bottom: 104,
      left: 46,
      right: 42,
    });
  });

  it('maps the SE design grid onto RN logical dimensions without exported pixel values', () => {
    const layout = buildMediaGridLayout(
      { top: 0, bottom: 0, left: 0, right: 0 },
      { width: 375, height: 812, scale: 3, fontScale: 1 },
    );

    expect(layout).toEqual({
      columns: 3,
      itemSize: 109,
      spacing: 8,
      sidePadding: 16,
      contentWidth: 375,
      isSELike: true,
    });
  });

  it('does not upscale SE design grid tiles on slightly wider phones', () => {
    const layout = buildMediaGridLayout(
      { top: 0, bottom: 0, left: 0, right: 0 },
      { width: 393, height: 852, scale: 3, fontScale: 1 },
    );

    expect(layout).toEqual({
      columns: 3,
      itemSize: 109,
      spacing: 8,
      sidePadding: 25,
      contentWidth: 375,
      isSELike: true,
    });
  });

  it('adds columns on non-SE widths while keeping thumbnails readable', () => {
    expect(
      buildMediaGridLayout(
        { top: 0, bottom: 0, left: 0, right: 0 },
        { width: 640, height: 900, scale: 2, fontScale: 1 },
      ),
    ).toMatchObject({
      columns: 5,
      spacing: 10,
      isSELike: false,
    });
  });

  it('keeps the top inset clamped on an edge-case special screen', () => {
    const insets = { top: 4, bottom: 0, left: 0, right: 0 };

    expect(buildFilterWrapInsets(insets)).toEqual({
      top: 8,
      left: 16,
      right: 16,
    });
    expect(buildPhotoGridEntryInsets(insets)).toEqual({
      top: 16,
      left: 16,
      right: 16,
    });
  });

  it('requests permission and starts scanning from the same CTA', async () => {
    mockGetPermissionsAsync.mockResolvedValue({ granted: false });
    mockRequestPermissionsAsync.mockResolvedValueOnce({ granted: true });

    const renderer = await renderScreen();

    expect(collectRenderedTexts(renderer)).toContain(appPreferencesState.copy.permission.title);
    expect(collectRenderedTexts(renderer)).not.toContain(
      appPreferencesState.copy.screens.photoGrid.scanPromptTitle,
    );
    expect(
      renderer.root.findByProps({ testID: 'photo-grid-request-permission-button' }),
    ).toBeTruthy();
    const permissionStatusStyle = flattenStyle(
      renderer.root.findByProps({ testID: 'photo-grid-permission-status-card' }).props.style,
    );
    const permissionHeroStyle = flattenStyle(
      renderer.root.findByProps({ testID: 'photo-grid-permission-hero-card' }).props.style,
    );
    expect(permissionStatusStyle.backgroundColor).toBe('transparent');
    expect(permissionStatusStyle.borderWidth).toBe(0);
    expect(permissionStatusStyle.shadowOpacity).toBe(0);
    expect(permissionStatusStyle.elevation).toBe(0);
    expect(permissionHeroStyle.backgroundColor).toBe('transparent');
    expect(permissionHeroStyle.borderWidth).toBe(0);
    expect(permissionHeroStyle.shadowOpacity).toBe(0);
    expect(permissionHeroStyle.elevation).toBe(0);

    await pressPrimaryButton(renderer);

    expect(mockRequestPermissionsAsync).toHaveBeenCalledWith(false);
    expect(mockGetAssetsAsync).toHaveBeenCalled();
    expect(mockScanMediaLibrary).toHaveBeenCalledWith(
      [],
      expect.objectContaining({
        onProgress: expect.any(Function),
      }),
    );
    expect(renderer.root.findAllByProps({ testID: 'photo-grid-scope-breakdown' })).toHaveLength(0);
    expect(collectRenderedTexts(renderer)).toContain(
      appPreferencesState.copy.screens.photoGrid.scanExhaustedTitle,
    );
    expect(renderer.root.findAllByProps({ testID: 'photo-grid-start-scan-button' })).toHaveLength(1);
  });

  it('auto-starts scanning after the landing page grants permission', async () => {
    mockGetPermissionsAsync.mockResolvedValueOnce({ granted: true });

    const renderer = await renderScreen({ autoStartScan: true });

    expect(mockScanMediaLibrary).toHaveBeenCalledWith(
      [],
      expect.objectContaining({
        onProgress: expect.any(Function),
      }),
    );
    expect(collectRenderedTexts(renderer)).toContain(
      appPreferencesState.copy.screens.photoGrid.scanExhaustedTitle,
    );
  });

  it('does not show an extra permission-granted state before starting a scan', async () => {
    mockGetPermissionsAsync.mockResolvedValueOnce({ granted: true });

    const renderer = await renderScreen();
    const texts = collectRenderedTexts(renderer);

    expect(texts).toContain('识别重复、模糊与相似内容，结果留在当前页面继续判断。');
    expect(texts).toContain('开始扫描');
    expect(texts).not.toContain('准备开始扫描');
    expect(texts).not.toContain('授权已完成');
    expect(texts).not.toContain('可开始扫描相册');
  });

  it('left-aligns ready-state support icons in one vertical column', async () => {
    mockGetPermissionsAsync.mockResolvedValueOnce({ granted: true });

    const renderer = await renderScreen();
    const supportListStyle = flattenStyle(
      renderer.root.findByProps({ testID: 'photo-grid-support-list' }).props.style,
    );
    const supportPromptStyle = flattenStyle(
      renderer.root.findByProps({ testID: 'photo-grid-support-prompt' }).props.style,
    );
    const readySurfaceStyle = flattenStyle(
      renderer.root.findByProps({ testID: 'photo-grid-ready-surface' }).props.style,
    );
    const readyStaticFileIcon = renderer.root.findByProps({
      testID: 'photo-grid-ready-static-file-icon',
    });
    const supportIconTestIds = [
      'photo-grid-ready-support-icon-hint',
      'photo-grid-ready-support-icon-local',
      'photo-grid-ready-support-icon-media',
    ];

    expect(readySurfaceStyle.marginTop).toBe(34);
    expect(readyStaticFileIcon.props).toMatchObject({
      width: 87,
      height: 87,
    });
    expect(supportListStyle.alignSelf).toBe('flex-start');
    expect(supportPromptStyle).toMatchObject({
      alignSelf: 'flex-start',
      justifyContent: 'flex-start',
      maxWidth: supportListStyle.maxWidth,
      width: supportListStyle.width,
    });
    for (const testID of supportIconTestIds) {
      expect(
        flattenStyle(renderer.root.findByProps({ testID }).props.style),
      ).toMatchObject({
        width: 24,
        height: 24,
        alignItems: 'flex-start',
        flexShrink: 0,
        overflow: 'visible',
      });
    }
  });

  it('starts a scan after permission is granted and keeps progress and result summary inline', async () => {
    mockGetPermissionsAsync.mockResolvedValueOnce({ granted: true });
    mockLoadRecycleBinIds.mockResolvedValueOnce(['recycle-1']);
    mockScanMediaLibrary.mockImplementationOnce(async (_recycleBinIds, options) => {
      const onProgress = (options as { onProgress?: (progress: any) => void })?.onProgress;

      onProgress?.({
        current: 1,
        total: 3,
        currentFileName: 'IMG_001.jpg',
        isScanning: true,
        percentage: 33,
        analyzedAssetId: 'photo-1',
        analyzedInput: null,
        analyzedMediaType: 'photo',
      });
      onProgress?.({
        current: 2,
        total: 3,
        currentFileName: 'IMG_002.jpg',
        isScanning: true,
        percentage: 67,
        analyzedAssetId: 'photo-2',
        analyzedInput: createAnalyzedInput('photo-2', {
          width: 640,
          height: 640,
          fileSize: 80_000,
          brightness: 0.03,
          contrast: 0.04,
          edgeDensity: 0.02,
        }),
        analyzedMediaType: 'photo',
      });
      onProgress?.({
        current: 3,
        total: 3,
        currentFileName: 'VID_001.mp4',
        isScanning: true,
        percentage: 100,
        analyzedAssetId: 'video-1',
        analyzedInput: null,
        analyzedMediaType: 'video',
      });

      return {
        state: {
          activeCandidates: [createCleanupCandidate('photo-2')],
          recycleBin: [],
          selectedIds: [],
        },
        summary: {
          scannedAt: 1_710_000_000_000,
          scannedCount: 3,
          candidateCount: 1,
          highConfidenceCount: 1,
          mediumConfidenceCount: 0,
          recycleBinCount: 0,
        },
      };
    });

    const renderer = await renderScreen();

    expect(collectRenderedTexts(renderer)).toContain(
      appPreferencesState.copy.screens.photoGrid.startScan,
    );
    expect(collectRenderedTexts(renderer)).toContain('已选择 3 个媒体');
    expect(collectRenderedTexts(renderer)).toContain('grid-count:3');

    await pressPrimaryButton(renderer);

    expect(mockLoadRecycleBinIds).toHaveBeenCalledTimes(1);
    expect(mockGetAssetsAsync).toHaveBeenCalled();
    expect(mockScanMediaLibrary).toHaveBeenCalledWith(
      ['recycle-1'],
      expect.objectContaining({
        onProgress: expect.any(Function),
      }),
    );

    const renderedTexts = collectRenderedTexts(renderer);

    expect(renderer.root.findAllByProps({ testID: 'photo-grid-inline-progress' })).toHaveLength(0);
    expect(renderer.root.findAllByProps({ testID: 'photo-grid-loading-overlay' })).toHaveLength(0);
    expect(renderer.root.findAllByProps({ testID: 'photo-grid-scope-breakdown' })).toHaveLength(0);
    expect(renderedTexts).toContain('发现 1 个待处理媒体');
    expect(renderedTexts).toContain(appPreferencesState.copy.screens.photoGrid.scanResultFootnote);
    expect(renderedTexts).toContain('全部 3');
    expect(renderedTexts).toContain('照片 2');
    expect(renderedTexts).toContain('视频 1');
    expect(renderer.root.findAllByProps({ testID: 'photo-grid-scan-summary' })).toHaveLength(1);
    const abnormalBreakdownStyle = flattenStyle(
      renderer.root.findByProps({ testID: 'photo-grid-result-breakdown-blurry' }).props.style,
    );
    expect(abnormalBreakdownStyle.backgroundColor).toBe('transparent');
    expect(abnormalBreakdownStyle.shadowOpacity).toBe(0);
    expect(abnormalBreakdownStyle.elevation).toBe(0);
    expect(
      flattenStyle(
        renderer.root.findByProps({ testID: 'photo-grid-result-breakdown-blurry-icon-shell' })
          .props.style,
      ),
    ).toMatchObject({
      flexShrink: 0,
      alignItems: 'center',
      overflow: 'visible',
    });
    expect(renderedTexts).toContain('重复照片 0');
    expect(renderedTexts).toContain('模糊照片 1');
    expect(renderedTexts).toContain('相似照片 0');
    expect(renderedTexts).not.toContain('IMG_001.jpg');
    expect(renderedTexts).not.toContain('IMG_002.jpg');
    expect(mockSavePhotoScanResultCache).toHaveBeenCalledTimes(1);
    expect(mockSaveLastScanMeta).toHaveBeenCalledTimes(1);
    expect(mockSaveLastValidScanBaseline).toHaveBeenCalledTimes(1);
    expect(mockReconcileReminderRuntimeInForeground).toHaveBeenCalledTimes(1);
    expect(
      mockSaveLastScanMeta.mock.invocationCallOrder[0],
    ).toBeLessThan(mockReconcileReminderRuntimeInForeground.mock.invocationCallOrder[0]);
    expect(
      mockSaveLastValidScanBaseline.mock.invocationCallOrder[0],
    ).toBeLessThan(mockReconcileReminderRuntimeInForeground.mock.invocationCallOrder[0]);
  });

  it('hides the continue scan action when completed full-scan results are still pending', async () => {
    const now = Date.UTC(2026, 4, 4, 0, 0, 0);
    const candidate = createCleanupCandidate('full-result-pending');
    photoScanSessionRuntimeApi.stagePhotoScanSessionRuntimeSnapshot({
      permissionState: 'granted',
      phase: 'completed',
      authorizedCandidates: [candidate],
      visibleCandidates: [candidate],
      scanResultsCount: 1,
      scanProgress: {
        current: 1,
        total: 1,
        currentFileName: null,
      },
      scanScopeSelection: {
        total: 1,
        photo: 1,
        video: 0,
      },
      summary: {
        scannedAt: now,
        scannedCount: 1,
        recycleBinCount: 0,
      },
      hasCompletedFullScan: true,
      errorMessage: null,
      updatedAt: now,
    });

    const renderer = await renderScreen();
    const renderedTexts = collectRenderedTexts(renderer);

    expect(renderedTexts).toContain('发现 1 个待处理媒体');
    expect(renderedTexts).not.toContain(appPreferencesState.copy.screens.photoGrid.continueScan);
    expect(renderer.root.findAllByProps({ testID: 'photo-grid-start-scan-button' })).toHaveLength(0);
  });

  it('switches the continue scan CTA to scanning immediately and ignores duplicate taps', async () => {
    mockGetPermissionsAsync.mockResolvedValueOnce({ granted: true });

    let resolveScan: ((value: any) => void) | undefined;
    mockScanMediaLibrary.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveScan = resolve;
        }),
    );

    const renderer = await renderScreen();
    const button = renderer.root.findAllByType('Pressable')[0];

    await act(async () => {
      button.props.onPress();
      button.props.onPress();
      await flushPromises();
    });

    expect(mockScanMediaLibrary).toHaveBeenCalledTimes(1);
    expect(collectRenderedTexts(renderer)).toContain('扫描中');
    expect(
      renderer.root.findAllByProps({ testID: 'photo-grid-start-scan-button' }),
    ).toHaveLength(0);
    expect(renderer.root.findAllByProps({ testID: 'photo-grid-circular-progress' }).length).toBeGreaterThan(0);
    for (const testID of [
      'photo-grid-scanning-support-icon-local',
      'photo-grid-scanning-support-icon-media',
      'photo-grid-scanning-support-icon-fast',
    ]) {
      expect(
        flattenStyle(renderer.root.findByProps({ testID }).props.style),
      ).toMatchObject({
        width: 24,
        height: 24,
        alignItems: 'flex-start',
        flexShrink: 0,
        overflow: 'visible',
      });
    }

    await act(async () => {
      resolveScan?.({
        state: {
          activeCandidates: [],
          recycleBin: [],
          selectedIds: [],
        },
        summary: {
          scannedAt: 1_710_000_000_000,
          scannedCount: 3,
          candidateCount: 0,
          highConfidenceCount: 0,
          mediumConfidenceCount: 0,
          recycleBinCount: 0,
        },
      });
      await flushPromises();
    });
  });

  it('continues scanning from the Android completed-result summary CTA', async () => {
    setPlatformOS('android');
    const flaggedCandidate = createCleanupCandidate('flagged-result');
    mockEnumerateAndroidMediaStoreAssets.mockResolvedValueOnce([
      {
        assetId: 'older-photo',
        uri: 'content://media/external/images/media/older-photo',
        previewUri: 'content://media/external/images/media/older-photo',
        mediaType: 'photo',
        width: 1080,
        height: 1440,
        duration: 0,
        fileSize: 420_000,
        creationTime: 1_690_000_000_000,
      },
    ]);
    mockExecuteAndroidNativeFirstScan.mockImplementationOnce(
      () =>
        new Promise(() => {
          // Keep the scan in-flight so the test can assert the immediate UI transition.
        }),
    );
    photoScanSessionRuntimeApi.stagePhotoScanSessionRuntimeSnapshot({
      permissionState: 'granted',
      phase: 'completed',
      authorizedCandidates: [flaggedCandidate],
      visibleCandidates: [flaggedCandidate],
      scanResultsCount: 1,
      scanProgress: {
        current: 1,
        total: 1,
        currentFileName: null,
      },
      scanScopeSelection: {
        total: 1,
        photo: 1,
        video: 0,
      },
      scanBatchRange: {
        startAt: 1_700_000_000_000,
        endAt: 1_710_000_000_000,
      },
      summary: {
        scannedAt: 1_710_000_000_000,
        scannedCount: 1,
        recycleBinCount: 0,
      },
      hasCompletedFullScan: false,
      errorMessage: null,
      updatedAt: Date.now(),
    });

    const renderer = await renderScreen();

    expect(collectRenderedTexts(renderer)).toContain('继续扫描');

    await pressByTestId(renderer, 'photo-grid-start-scan-button');

    expect(mockExecuteAndroidNativeFirstScan).toHaveBeenCalledTimes(1);
    expect(collectRenderedTexts(renderer)).toContain('正在扫描照片');
    expect(
      renderer.root.findAllByProps({ testID: 'photo-grid-start-scan-button' }),
    ).toHaveLength(0);
  });

  it('merges unresolved results from previous batches with the newly completed Android batch', async () => {
    setPlatformOS('android');
    const previousDuplicate = createDuplicateCleanupCandidate('previous-duplicate');
    const currentBlurry = createCleanupCandidate('current-blurry');
    const now = 1_710_000_000_000;

    mockEnumerateAndroidMediaStoreAssets
      .mockResolvedValueOnce([createAndroidMediaStoreAsset('current-blurry')])
      .mockResolvedValueOnce([]);
    mockExecuteAndroidNativeFirstScan.mockImplementationOnce(async () => ({
      mode: 'native',
      fallbackReason: null,
      output: {
        state: {
          activeCandidates: [currentBlurry],
          recycleBin: [],
          selectedIds: [],
        },
        summary: {
          scannedAt: now,
          scannedCount: 1,
          candidateCount: 1,
          highConfidenceCount: 1,
          mediumConfidenceCount: 0,
          recycleBinCount: 0,
        },
      },
    }));
    photoScanSessionRuntimeApi.stagePhotoScanSessionRuntimeSnapshot({
      permissionState: 'granted',
      phase: 'completed',
      authorizedCandidates: [previousDuplicate],
      visibleCandidates: [previousDuplicate],
      scanResultsCount: 1,
      scanProgress: {
        current: 1,
        total: 1,
        currentFileName: null,
      },
      scanScopeSelection: {
        total: 1,
        photo: 1,
        video: 0,
      },
      scanBatchRange: {
        startAt: now - DAY_MS,
        endAt: now,
      },
      summary: {
        scannedAt: now,
        scannedCount: 1,
        recycleBinCount: 0,
      },
      hasCompletedFullScan: false,
      errorMessage: null,
      updatedAt: now,
    });

    const renderer = await renderScreen();

    expect(collectRenderedTexts(renderer)).toContain('重复照片 1');

    await pressByTestId(renderer, 'photo-grid-start-scan-button');

    const savedResult = mockSavePhotoScanResultCache.mock.calls.at(-1)?.[0];
    const savedActiveCandidateIds = (savedResult?.activeCandidates ?? [])
      .map((candidate: { id: string }) => candidate.id)
      .sort();
    expect(savedActiveCandidateIds).toEqual([
      'current-blurry',
      'previous-duplicate',
    ]);
    expect(savedResult?.summary).toEqual(
      expect.objectContaining({
        candidateCount: 2,
        highConfidenceCount: 2,
      }),
    );

    const renderedTexts = collectRenderedTexts(renderer);
    expect(renderedTexts).toContain('发现 2 个待处理媒体');
    expect(renderedTexts).toContain('重复照片 1');
    expect(renderedTexts).toContain('模糊照片 1');
    expect(renderedTexts).toContain('grid-count:2');
  });

  it('opens a dedicated filtering workspace with count and interaction guidance from the result summary', async () => {
    photoScanSessionRuntimeApi.stagePhotoScanSessionRuntimeSnapshot({
      permissionState: 'granted',
      phase: 'completed',
      authorizedCandidates: [createCleanupCandidate('flagged-1')],
      visibleCandidates: [createCleanupCandidate('flagged-1')],
      scanResultsCount: 1,
      scanProgress: {
        current: 1,
        total: 1,
        currentFileName: null,
      },
      scanScopeSelection: {
        total: 1,
        photo: 1,
        video: 0,
      },
      summary: {
        scannedAt: 1_710_000_000_000,
        scannedCount: 1,
        recycleBinCount: 0,
      },
      errorMessage: null,
      updatedAt: Date.now(),
    });

    const renderer = await renderScreen();

    await pressByTestId(renderer, 'photo-grid-result-breakdown-blurry');

    const renderedTexts = collectRenderedTexts(renderer);

    expect(renderer.root.findByProps({ testID: 'photo-grid-workspace-title' })).toBeTruthy();
    expect(renderedTexts).toContain('模糊照片 (1)');
  });

  it('updates visible media and all-photo-video tab counts while normal items stream out during scanning', async () => {
    mockGetPermissionsAsync.mockResolvedValueOnce({ granted: true });
    mockLoadRecycleBinIds.mockResolvedValueOnce([]);

    let resolveScan: ((value: any) => void) | undefined;
    mockScanMediaLibrary.mockImplementationOnce(
      (_recycleBinIds, options) =>
        new Promise((resolve) => {
          resolveScan = resolve;
          const onProgress = (options as { onProgress?: (progress: any) => void })?.onProgress;

          onProgress?.({
            current: 1,
            total: 3,
            currentFileName: 'IMG_001.jpg',
            isScanning: true,
            percentage: 33,
            analyzedAssetId: 'photo-1',
            analyzedInput: null,
            analyzedMediaType: 'photo',
          });
        }),
    );

    const renderer = await renderScreen();

    await pressPrimaryButton(renderer);

    let renderedTexts = collectRenderedTexts(renderer);

    expect(renderer.root.findByProps({ testID: 'photo-grid-loading-overlay' })).toBeTruthy();
    expect(renderer.root.findByProps({ testID: 'photo-grid-loading-overlay' }).props.pointerEvents).toBe('none');
    expect(
      renderer.root.findByProps({ testID: 'photo-grid-loading-overlay' }).findAllByType('Text'),
    ).toHaveLength(0);
    expect(renderedTexts).toContain('扫描中');
    expect(renderedTexts).toContain('1/3');
    expect(renderedTexts).toContain('全部 2');
    expect(renderedTexts).toContain('照片 1');
    expect(renderedTexts).toContain('视频 1');
    expect(renderedTexts).toContain('grid-count:2');

    await act(async () => {
      resolveScan?.({
        state: {
          activeCandidates: [createCleanupCandidate('photo-2')],
          recycleBin: [],
          selectedIds: [],
        },
        summary: {
          scannedAt: 1_710_000_000_000,
          scannedCount: 3,
          candidateCount: 1,
          highConfidenceCount: 1,
          mediumConfidenceCount: 0,
          recycleBinCount: 0,
        },
      });
      await flushPromises();
    });

    renderedTexts = collectRenderedTexts(renderer);

    expect(renderer.root.findAllByProps({ testID: 'photo-grid-loading-overlay' })).toHaveLength(0);
    expect(renderedTexts).toContain('扫描完成，发现异常结果');
    expect(renderedTexts).toContain('全部 3');
    expect(renderedTexts).toContain('照片 2');
    expect(renderedTexts).toContain('视频 1');
    expect(renderedTexts).toContain('grid-count:1');
  });

  it('delegates Android scans to the Android-first facade before entering the legacy fallback path', async () => {
    setPlatformOS('android');
    mockGetPermissionsAsync.mockResolvedValueOnce({ granted: true });
    const assets = [
      createAndroidMediaStoreAsset('photo-1'),
      createAndroidMediaStoreAsset('photo-2'),
      createAndroidMediaStoreAsset('video-1', { mediaType: 'video' }),
    ];
    mockEnumerateAndroidMediaStoreAssets
      .mockResolvedValueOnce(assets)
      .mockResolvedValueOnce(assets)
      .mockResolvedValueOnce([]);

    const renderer = await renderScreen();

    await pressPrimaryButton(renderer);

    expect(mockExecuteAndroidNativeFirstScan).toHaveBeenCalledTimes(1);
    expect(mockExecuteAndroidNativeFirstScan).toHaveBeenCalledWith(
      expect.objectContaining({
        recycleBinIds: [],
        sourceCandidates: expect.arrayContaining([
          expect.objectContaining({ id: 'photo-1' }),
          expect.objectContaining({ id: 'photo-2' }),
          expect.objectContaining({ id: 'video-1' }),
        ]),
        language: appPreferencesState.language,
        legacyOptions: expect.objectContaining({
          onProgress: expect.any(Function),
          onCheckpoint: expect.any(Function),
        }),
      }),
    );
    expect(mockScanMediaLibrary).not.toHaveBeenCalled();
  });

  it('uses the Android batch total as the scan denominator while scanning only dirty media', async () => {
    setPlatformOS('android');
    const assets = [
      createAndroidMediaStoreAsset('batch-photo-1'),
      createAndroidMediaStoreAsset('batch-photo-2'),
      createAndroidMediaStoreAsset('batch-photo-3'),
      createAndroidMediaStoreAsset('batch-video-1', { mediaType: 'video' }),
      createAndroidMediaStoreAsset('batch-video-2', { mediaType: 'video' }),
    ];
    const manifestEntries = assets.map((asset) => createManifestEntryFromAndroidAsset(asset));
    mockEnumerateAndroidMediaStoreAssets
      .mockResolvedValueOnce(assets)
      .mockResolvedValueOnce(assets)
      .mockResolvedValueOnce([]);
    mockLoadAssetManifestEntries.mockResolvedValue(manifestEntries);
    mockLoadMediaAnalysisCache.mockResolvedValue({
      'batch-photo-1': createAnalyzedInput('batch-photo-1'),
      'batch-photo-2': createAnalyzedInput('batch-photo-2'),
      'batch-video-1': createAnalyzedInput('batch-video-1', { mediaType: 'video' }),
    });

    let resolveScan: ((value: any) => void) | undefined;
    mockExecuteAndroidNativeFirstScan.mockImplementationOnce(async (options: any) => ({
      mode: 'native',
      fallbackReason: null,
      output: await new Promise((resolve) => {
        expect(
          options.sourceCandidates.map((candidate: any) => candidate.asset.id),
        ).toEqual(['batch-photo-3', 'batch-video-2']);
        expect(options.displayProgressTotal).toBe(5);
        expect(options.displayProgressCompletedOffset).toBe(3);
        options.legacyOptions.onProgress?.({
          current: 4,
          total: 5,
          currentFileName: 'IMG_003.jpg',
          isScanning: true,
          percentage: 80,
          analyzedAssetId: 'batch-photo-3',
          analyzedInput: createAnalyzedInput('batch-photo-3'),
          analyzedMediaType: 'photo',
        });
        resolveScan = resolve as (value: any) => void;
      }),
    }));

    const renderer = await renderScreen();

    await pressPrimaryButton(renderer);

    const renderedTexts = collectRenderedTexts(renderer);
    expect(renderedTexts).toContain('扫描中');
    expect(renderedTexts).toContain('4/5');
    expect(renderedTexts).toContain('已选择 5 个媒体');
    expect(mockSavePhotoScanBatch.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({
        progressCurrent: 3,
        progressTotal: 5,
        enumeratedCount: 5,
        dirtyCount: 2,
      }),
    );

    await act(async () => {
      resolveScan?.({
        state: {
          activeCandidates: [],
          recycleBin: [],
          selectedIds: [],
        },
        summary: {
          scannedAt: 1_710_000_000_000,
          scannedCount: 2,
          candidateCount: 0,
          highConfidenceCount: 0,
          mediumConfidenceCount: 0,
          recycleBinCount: 0,
        },
      });
      await flushPromises();
    });

    expect(mockSavePhotoScanBatch).toHaveBeenLastCalledWith(
      expect.objectContaining({
        phase: 'completed',
        progressCurrent: 5,
        progressTotal: 5,
        enumeratedCount: 5,
        dirtyCount: 2,
        analyzedCount: 2,
      }),
    );
    expect(mockSaveLastScanMeta).toHaveBeenCalledWith(
      expect.objectContaining({
        scannedCount: 5,
      }),
    );
    expect(collectRenderedTexts(renderer)).toContain('全部 5');
    expect(collectRenderedTexts(renderer)).toContain('照片 3');
    expect(collectRenderedTexts(renderer)).toContain('视频 2');
  });

  it('ignores a late Android checkpoint after completion so the batch denominator stays authoritative', async () => {
    setPlatformOS('android');
    const assets = [
      createAndroidMediaStoreAsset('batch-photo-1'),
      createAndroidMediaStoreAsset('batch-photo-2'),
      createAndroidMediaStoreAsset('batch-photo-3'),
      createAndroidMediaStoreAsset('batch-video-1', { mediaType: 'video' }),
      createAndroidMediaStoreAsset('batch-video-2', { mediaType: 'video' }),
    ];
    const manifestEntries = assets.map((asset) => createManifestEntryFromAndroidAsset(asset));
    mockEnumerateAndroidMediaStoreAssets
      .mockResolvedValueOnce(assets)
      .mockResolvedValueOnce(assets)
      .mockResolvedValueOnce([]);
    mockLoadAssetManifestEntries.mockResolvedValue(manifestEntries);
    mockLoadMediaAnalysisCache.mockResolvedValue({
      'batch-photo-1': createAnalyzedInput('batch-photo-1'),
      'batch-photo-2': createAnalyzedInput('batch-photo-2'),
      'batch-video-1': createAnalyzedInput('batch-video-1', { mediaType: 'video' }),
    });

    let lateCheckpoint:
      | ((checkpoint: {
          current: number;
          total: number;
          currentFileName: string | null;
          processedCount: number;
          lastProcessedAssetId: string | null;
          analyzedInputs: readonly ReturnType<typeof createAnalyzedInput>[];
        }) => Promise<void>)
      | undefined;
    mockExecuteAndroidNativeFirstScan.mockImplementationOnce(async (options: any) => {
      lateCheckpoint = options.legacyOptions.onCheckpoint;
      return {
        mode: 'native',
        fallbackReason: null,
        output: {
          state: {
            activeCandidates: [createCleanupCandidate('batch-photo-3')],
            recycleBin: [],
            selectedIds: [],
          },
          summary: {
            scannedAt: 1_710_000_000_000,
            scannedCount: 2,
            candidateCount: 1,
            highConfidenceCount: 1,
            mediumConfidenceCount: 0,
            recycleBinCount: 0,
          },
        },
      };
    });

    const renderer = await renderScreen();

    await pressPrimaryButton(renderer);

    expect(collectRenderedTexts(renderer)).toContain('全部 5');
    expect(collectRenderedTexts(renderer)).toContain('照片 3');
    expect(collectRenderedTexts(renderer)).toContain('视频 2');
    expect(collectRenderedTexts(renderer)).toContain('grid-count:1');

    await act(async () => {
      await lateCheckpoint?.({
        current: 2,
        total: 2,
        currentFileName: null,
        processedCount: 2,
        lastProcessedAssetId: 'batch-video-2',
        analyzedInputs: [
          createAnalyzedInput('batch-photo-3', {
            width: 640,
            height: 640,
            fileSize: 80_000,
            brightness: 0.03,
            contrast: 0.04,
            edgeDensity: 0.02,
          }),
          createAnalyzedInput('batch-video-2', { mediaType: 'video' }),
        ],
      });
      await flushPromises();
    });

    expect(collectRenderedTexts(renderer)).toContain('全部 5');
    expect(collectRenderedTexts(renderer)).toContain('照片 3');
    expect(collectRenderedTexts(renderer)).toContain('视频 2');
    expect(collectRenderedTexts(renderer)).toContain('grid-count:1');
  });

  it('does not start another Android scan once the latest completed batch already covers the full library', async () => {
    setPlatformOS('android');
    const now = Date.UTC(2026, 3, 24, 0, 0, 0);
    const rollingRangeStartAt = buildScanRangeStartAt(12, now);
    const dateNowSpy = vi.spyOn(Date, 'now').mockReturnValue(now);
    const assets = [
      createAndroidMediaStoreAsset('clean-photo-1', { dateTaken: now - DAY_MS }),
      createAndroidMediaStoreAsset('clean-photo-2', { dateTaken: now - 2 * DAY_MS }),
    ];

    mockLoadLatestCompletedPhotoScanBatch.mockResolvedValue({
      batchId: 'batch-full-clean-previous',
      mode: 'full',
      phase: 'completed',
      windowDays: Math.round((now - rollingRangeStartAt) / DAY_MS),
      rangeStartAt: rollingRangeStartAt,
      rangeEndAt: now,
      progressCurrent: 2,
      progressTotal: 2,
      enumeratedCount: 2,
      dirtyCount: 0,
      analyzedCount: 0,
      candidateCount: 0,
      startedAt: now,
      lastHeartbeatAt: now,
      completedAt: now,
      lastError: null,
      updatedAt: now,
    });
    const manifestEntries = assets.map((asset) => createManifestEntryFromAndroidAsset(asset));
    mockLoadAssetManifestEntries.mockResolvedValue(manifestEntries);
    mockLoadMediaAnalysisCache.mockResolvedValue({
      'clean-photo-1': createAnalyzedInput('clean-photo-1'),
      'clean-photo-2': createAnalyzedInput('clean-photo-2'),
    });
    mockEnumerateAndroidMediaStoreAssets
      .mockResolvedValueOnce(assets)
      .mockResolvedValueOnce(assets);

    try {
      const renderer = await renderScreen();

      await pressPrimaryButton(renderer);

      expect(mockExecuteAndroidNativeFirstScan).not.toHaveBeenCalled();
      expect(mockSavePhotoScanBatch).not.toHaveBeenCalled();
      expect(mockSaveLastScanMeta).not.toHaveBeenCalled();
      const renderedTexts = collectRenderedTexts(renderer);
      expect(renderedTexts).toContain('2/2');
      expect(renderedTexts).toContain(appPreferencesState.copy.screens.photoGrid.scanAllCompleteTitle);
      expect(renderedTexts).toContain(appPreferencesState.copy.screens.photoGrid.scanAllCompleteBody);
      expect(renderedTexts).not.toContain(appPreferencesState.copy.screens.photoGrid.continueScan);
      expect(renderer.root.findAllByProps({ testID: 'photo-grid-scan-all-complete-state' })).toHaveLength(1);
      expect(renderer.root.findAllByProps({ testID: 'photo-grid-scan-all-complete-title' })).toHaveLength(1);
    } finally {
      dateNowSpy.mockRestore();
    }
  });

  it('keeps JS fallback foreground progress on the same Android batch denominator as the UI', async () => {
    setPlatformOS('android');
    mockSyncAndroidBackgroundScanForegroundService.mockResolvedValue(true);
    const assets = [
      createAndroidMediaStoreAsset('fallback-photo-1'),
      createAndroidMediaStoreAsset('fallback-photo-2'),
      createAndroidMediaStoreAsset('fallback-photo-3'),
      createAndroidMediaStoreAsset('fallback-video-1', { mediaType: 'video' }),
      createAndroidMediaStoreAsset('fallback-video-2', { mediaType: 'video' }),
    ];
    const manifestEntries = assets.map((asset) => createManifestEntryFromAndroidAsset(asset));
    mockEnumerateAndroidMediaStoreAssets
      .mockResolvedValueOnce(assets)
      .mockResolvedValueOnce(assets)
      .mockResolvedValueOnce([]);
    mockLoadAssetManifestEntries.mockResolvedValue(manifestEntries);
    mockLoadMediaAnalysisCache.mockResolvedValue({
      'fallback-photo-1': createAnalyzedInput('fallback-photo-1'),
      'fallback-photo-2': createAnalyzedInput('fallback-photo-2'),
      'fallback-video-1': createAnalyzedInput('fallback-video-1', { mediaType: 'video' }),
    });

    let resolveScan: ((value: any) => void) | undefined;
    mockScanMediaLibrary.mockImplementationOnce(
      (_recycleBinIds, options) =>
        new Promise((resolve) => {
          resolveScan = resolve;
          const onProgress = (options as { onProgress?: (progress: any) => void })?.onProgress;

          onProgress?.({
            current: 1,
            total: 2,
            currentFileName: 'IMG_003.jpg',
            isScanning: true,
            percentage: 50,
            analyzedAssetId: 'fallback-photo-3',
            analyzedInput: createAnalyzedInput('fallback-photo-3'),
            analyzedMediaType: 'photo',
          });
        }),
    );
    mockExecuteAndroidNativeFirstScan.mockImplementationOnce(async (options: any) => ({
      mode: 'legacy',
      fallbackReason: 'native-execution-failed',
      output: await options.runLegacyScan(options.recycleBinIds, options.legacyOptions),
    }));

    const renderer = await renderScreen();

    await pressPrimaryButton(renderer);

    expect(mockSyncAndroidBackgroundScanForegroundService).toHaveBeenCalledWith({
      language: 'zh-CN',
      isScanning: true,
      progressCurrent: 3,
      progressTotal: 5,
      currentFileName: null,
    });
    expect(mockSyncAndroidBackgroundScanForegroundService).toHaveBeenCalledWith({
      language: 'zh-CN',
      isScanning: true,
      progressCurrent: 4,
      progressTotal: 5,
      currentFileName: 'IMG_003.jpg',
    });
    expect(collectRenderedTexts(renderer)).toContain('4/5');

    await act(async () => {
      resolveScan?.({
        state: {
          activeCandidates: [],
          recycleBin: [],
          selectedIds: [],
        },
        summary: {
          scannedAt: 1_710_000_000_000,
          scannedCount: 2,
          candidateCount: 0,
          highConfidenceCount: 0,
          mediumConfidenceCount: 0,
          recycleBinCount: 0,
        },
      });
      await flushPromises();
    });

    expect(collectRenderedTexts(renderer)).toContain('全部 5');
    expect(collectRenderedTexts(renderer)).toContain('照片 3');
    expect(collectRenderedTexts(renderer)).toContain('视频 2');
  });

  it('slices Android backfill from the previous earliest boundary and keeps reminder baselines on the configured recent window', async () => {
    setPlatformOS('android');
    const now = Date.UTC(2026, 3, 24, 0, 0, 0);
    const rollingRangeStartAt = buildScanRangeStartAt(12, now);
    const expectedBackfillRangeStartAt = buildScanRangeStartAt(12, rollingRangeStartAt);
    const dateNowSpy = vi.spyOn(Date, 'now').mockReturnValue(now);

    mockLoadLatestCompletedPhotoScanBatch.mockResolvedValue({
      batchId: 'batch-window-1',
      mode: 'rolling-window',
      phase: 'completed',
      windowDays: Math.round((now - rollingRangeStartAt) / DAY_MS),
      rangeStartAt: rollingRangeStartAt,
      rangeEndAt: now,
      progressCurrent: 40,
      progressTotal: 40,
      enumeratedCount: 40,
      dirtyCount: 4,
      analyzedCount: 4,
      candidateCount: 0,
      startedAt: now,
      lastHeartbeatAt: now,
      completedAt: now,
      lastError: null,
      updatedAt: now,
    });
    mockEnumerateAndroidMediaStoreAssets
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        createAndroidMediaStoreAsset('older-photo-1', {
          dateTaken: expectedBackfillRangeStartAt + DAY_MS,
        }),
      ])
      .mockResolvedValueOnce([
        createAndroidMediaStoreAsset('older-photo-0', {
          dateTaken: expectedBackfillRangeStartAt - DAY_MS,
        }),
      ]);
    mockExecuteAndroidNativeFirstScan.mockImplementationOnce(async () => ({
      mode: 'native',
      fallbackReason: null,
      output: {
        state: {
          activeCandidates: [],
          recycleBin: [],
          selectedIds: [],
        },
        summary: {
          scannedAt: now,
          scannedCount: 1,
          candidateCount: 0,
          highConfidenceCount: 0,
          mediumConfidenceCount: 0,
          recycleBinCount: 0,
        },
      },
    }));

    try {
      const renderer = await renderScreen();

      await pressPrimaryButton(renderer);

      expect(mockEnumerateAndroidMediaStoreAssets).toHaveBeenNthCalledWith(1, {
        createdAfter: rollingRangeStartAt,
      });
      expect(mockEnumerateAndroidMediaStoreAssets).toHaveBeenNthCalledWith(2, {
        createdAfter: expectedBackfillRangeStartAt,
        createdBefore: rollingRangeStartAt,
      });
      expect(mockEnumerateAndroidMediaStoreAssets).toHaveBeenNthCalledWith(3, {
        createdBefore: expectedBackfillRangeStartAt,
        limit: 1,
      });
      expect(mockSavePhotoScanBatch.mock.calls[0]?.[0]).toEqual(
        expect.objectContaining({
          mode: 'backfill',
          rangeStartAt: expectedBackfillRangeStartAt,
          rangeEndAt: rollingRangeStartAt,
          windowDays: Math.round(
            (rollingRangeStartAt - expectedBackfillRangeStartAt) / DAY_MS,
          ),
        }),
      );
      expect(mockExecuteAndroidNativeFirstScan).toHaveBeenCalledWith(
        expect.objectContaining({
          sourceCandidates: [expect.objectContaining({ id: 'older-photo-1' })],
          legacyOptions: expect.objectContaining({
            createdAfter: expectedBackfillRangeStartAt,
            createdBefore: rollingRangeStartAt,
          }),
        }),
      );
      expect(mockCaptureLastValidScanBaseline).toHaveBeenCalledWith(
        expect.objectContaining({
          scannedAt: now,
          scannedCount: 1,
        }),
        {
          scanRangeMonths: 12,
          createdAfter: rollingRangeStartAt,
        },
      );
      expect(collectRenderedTexts(renderer)).toContain('已扫描范围：2024.04.24 - 2025.04.24');
    } finally {
      dateNowSpy.mockRestore();
    }
  });

  it('uses the latest completed Android batch for planning even when a newer failed batch exists', async () => {
    setPlatformOS('android');
    const now = Date.UTC(2026, 3, 24, 0, 0, 0);
    const rollingRangeStartAt = buildScanRangeStartAt(12, now);
    const expectedBackfillRangeStartAt = buildScanRangeStartAt(12, rollingRangeStartAt);
    const dateNowSpy = vi.spyOn(Date, 'now').mockReturnValue(now);

    mockLoadLatestPhotoScanBatch.mockResolvedValue({
      batchId: 'batch-failed-newer',
      mode: 'rolling-window',
      phase: 'failed',
      windowDays: Math.round((now - rollingRangeStartAt) / DAY_MS),
      rangeStartAt: rollingRangeStartAt,
      rangeEndAt: now,
      progressCurrent: 12,
      progressTotal: 73,
      enumeratedCount: 73,
      dirtyCount: 12,
      analyzedCount: 12,
      candidateCount: 0,
      startedAt: now,
      lastHeartbeatAt: now + 1_000,
      completedAt: null,
      lastError: 'native worker failed',
      updatedAt: now + 1_000,
    });
    mockLoadLatestCompletedPhotoScanBatch.mockResolvedValue({
      batchId: 'batch-completed-older',
      mode: 'rolling-window',
      phase: 'completed',
      windowDays: Math.round((now - rollingRangeStartAt) / DAY_MS),
      rangeStartAt: rollingRangeStartAt,
      rangeEndAt: now,
      progressCurrent: 73,
      progressTotal: 73,
      enumeratedCount: 73,
      dirtyCount: 0,
      analyzedCount: 0,
      candidateCount: 0,
      startedAt: now,
      lastHeartbeatAt: now,
      completedAt: now,
      lastError: null,
      updatedAt: now,
    });
    mockEnumerateAndroidMediaStoreAssets
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        createAndroidMediaStoreAsset('older-photo-1', {
          dateTaken: expectedBackfillRangeStartAt + DAY_MS,
        }),
      ])
      .mockResolvedValueOnce([
        createAndroidMediaStoreAsset('older-photo-0', {
          dateTaken: expectedBackfillRangeStartAt - DAY_MS,
        }),
      ]);

    try {
      const renderer = await renderScreen();

      await pressPrimaryButton(renderer);

      expect(mockLoadLatestPhotoScanBatch).toHaveBeenCalledTimes(1);
      expect(mockLoadLatestCompletedPhotoScanBatch).toHaveBeenCalled();
      expect(mockEnumerateAndroidMediaStoreAssets).toHaveBeenNthCalledWith(2, {
        createdAfter: expectedBackfillRangeStartAt,
        createdBefore: rollingRangeStartAt,
      });
      expect(mockSavePhotoScanBatch.mock.calls[0]?.[0]).toEqual(
        expect.objectContaining({
          mode: 'backfill',
          rangeStartAt: expectedBackfillRangeStartAt,
          rangeEndAt: rollingRangeStartAt,
        }),
      );
    } finally {
      dateNowSpy.mockRestore();
    }
  });

  it('keeps an empty Android backfill window empty instead of scanning hydrated UI candidates', async () => {
    setPlatformOS('android');
    const now = Date.UTC(2026, 3, 24, 0, 0, 0);
    const rollingRangeStartAt = buildScanRangeStartAt(12, now);
    const expectedBackfillRangeStartAt = buildScanRangeStartAt(12, rollingRangeStartAt);
    const dateNowSpy = vi.spyOn(Date, 'now').mockReturnValue(now);

    mockLoadLatestCompletedPhotoScanBatch.mockResolvedValue({
      batchId: 'batch-window-empty-previous',
      mode: 'rolling-window',
      phase: 'completed',
      windowDays: Math.round((now - rollingRangeStartAt) / DAY_MS),
      rangeStartAt: rollingRangeStartAt,
      rangeEndAt: now,
      progressCurrent: 73,
      progressTotal: 73,
      enumeratedCount: 73,
      dirtyCount: 0,
      analyzedCount: 0,
      candidateCount: 0,
      startedAt: now,
      lastHeartbeatAt: now,
      completedAt: now,
      lastError: null,
      updatedAt: now,
    });
    mockEnumerateAndroidMediaStoreAssets
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        createAndroidMediaStoreAsset('older-photo-0', {
          dateTaken: expectedBackfillRangeStartAt - DAY_MS,
        }),
      ]);
    mockExecuteAndroidNativeFirstScan.mockImplementationOnce(async (options: any) => {
      expect(options.sourceCandidates).toEqual([]);
      expect(options.displayProgressTotal).toBe(0);
      expect(options.displayProgressCompletedOffset).toBe(0);
      return {
        mode: 'native',
        fallbackReason: null,
        output: {
          state: {
            activeCandidates: [],
            recycleBin: [],
            selectedIds: [],
          },
          summary: {
            scannedAt: now,
            scannedCount: 0,
            candidateCount: 0,
            highConfidenceCount: 0,
            mediumConfidenceCount: 0,
            recycleBinCount: 0,
          },
        },
      };
    });

    try {
      const renderer = await renderScreen();

      await pressPrimaryButton(renderer);

      expect(mockSavePhotoScanBatch.mock.calls[0]?.[0]).toEqual(
        expect.objectContaining({
          mode: 'backfill',
          rangeStartAt: expectedBackfillRangeStartAt,
          rangeEndAt: rollingRangeStartAt,
          progressCurrent: 0,
          progressTotal: 0,
          enumeratedCount: 0,
          dirtyCount: 0,
        }),
      );
      expect(mockSavePhotoScanBatchItems.mock.calls[0]?.[1]).toEqual([]);
      expect(collectRenderedTexts(renderer)).toContain('0/0');
    } finally {
      dateNowSpy.mockRestore();
    }
  });

  it('continues with dirty new Android media after full coverage without reopening historical backfill', async () => {
    setPlatformOS('android');
    const now = Date.UTC(2026, 3, 24, 0, 0, 0);
    const rollingRangeStartAt = buildScanRangeStartAt(12, now);
    const dateNowSpy = vi.spyOn(Date, 'now').mockReturnValue(now);
    const newAsset = createAndroidMediaStoreAsset('new-after-full-1', {
      dateTaken: now - DAY_MS,
    });

    mockLoadLatestCompletedPhotoScanBatch.mockResolvedValue({
      batchId: 'batch-full-previous',
      mode: 'full',
      phase: 'completed',
      windowDays: Math.round((now - rollingRangeStartAt) / DAY_MS),
      rangeStartAt: rollingRangeStartAt,
      rangeEndAt: now,
      progressCurrent: 261,
      progressTotal: 261,
      enumeratedCount: 261,
      dirtyCount: 0,
      analyzedCount: 0,
      candidateCount: 0,
      startedAt: now,
      lastHeartbeatAt: now,
      completedAt: now,
      lastError: null,
      updatedAt: now,
    });
    mockEnumerateAndroidMediaStoreAssets
      .mockResolvedValueOnce([newAsset])
      .mockResolvedValueOnce([newAsset]);
    mockExecuteAndroidNativeFirstScan.mockImplementationOnce(async (options: any) => {
      expect(options.sourceCandidates.map((candidate: any) => candidate.asset.id)).toEqual([
        'new-after-full-1',
      ]);
      expect(options.legacyOptions).toEqual(
        expect.objectContaining({
          createdAfter: rollingRangeStartAt,
          createdBefore: now,
        }),
      );
      return {
        mode: 'native',
        fallbackReason: null,
        output: {
          state: {
            activeCandidates: [],
            recycleBin: [],
            selectedIds: [],
          },
          summary: {
            scannedAt: now,
            scannedCount: 1,
            candidateCount: 0,
            highConfidenceCount: 0,
            mediumConfidenceCount: 0,
            recycleBinCount: 0,
          },
        },
      };
    });

    try {
      await pressPrimaryButton(await renderScreen());

      expect(mockSavePhotoScanBatch.mock.calls[0]?.[0]).toEqual(
        expect.objectContaining({
          mode: 'full',
          rangeStartAt: rollingRangeStartAt,
          rangeEndAt: now,
          enumeratedCount: 1,
          dirtyCount: 1,
        }),
      );
      expect(mockEnumerateAndroidMediaStoreAssets).not.toHaveBeenCalledWith({
        createdBefore: rollingRangeStartAt,
        limit: 1,
      });
    } finally {
      dateNowSpy.mockRestore();
    }
  });

  it('marks the Android batch as full once no older media exists before the current scan window', async () => {
    setPlatformOS('android');
    const now = Date.UTC(2026, 3, 24, 0, 0, 0);
    const rollingRangeStartAt = buildScanRangeStartAt(12, now);
    const dateNowSpy = vi.spyOn(Date, 'now').mockReturnValue(now);

    mockEnumerateAndroidMediaStoreAssets
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        createAndroidMediaStoreAsset('recent-photo-1', {
          dateTaken: now - DAY_MS,
        }),
      ])
      .mockResolvedValueOnce([]);

    try {
      const renderer = await renderScreen();

      await pressPrimaryButton(renderer);

      expect(mockSavePhotoScanBatch.mock.calls[0]?.[0]).toEqual(
        expect.objectContaining({
          mode: 'full',
          rangeStartAt: rollingRangeStartAt,
          rangeEndAt: now,
        }),
      );
    } finally {
      dateNowSpy.mockRestore();
    }
  });

  it('falls back to MediaLibrary assets when Android metadata enumeration returns empty during scan startup', async () => {
    setPlatformOS('android');
    const now = Date.UTC(2026, 3, 24, 0, 0, 0);
    const dateNowSpy = vi.spyOn(Date, 'now').mockReturnValue(now);
    mockGetAssetsAsync.mockResolvedValue({
      assets: [
        { ...createAsset('photo-1', mediaLibraryApi.MediaType.photo), creationTime: now - DAY_MS },
        { ...createAsset('photo-2', mediaLibraryApi.MediaType.photo), creationTime: now - 2 * DAY_MS },
        { ...createAsset('video-1', mediaLibraryApi.MediaType.video), creationTime: now - 3 * DAY_MS },
      ],
      hasNextPage: false,
      endCursor: undefined,
    });
    mockEnumerateAndroidMediaStoreAssets
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    try {
      const renderer = await renderScreen();

      await pressPrimaryButton(renderer);

      expect(mockExecuteAndroidNativeFirstScan).toHaveBeenCalledTimes(1);
      expect(mockLoadAssetManifestEntries).toHaveBeenCalledWith(['photo-1', 'photo-2', 'video-1']);
      expect(mockSavePhotoScanBatch.mock.calls[0]?.[0]).toEqual(
        expect.objectContaining({
          enumeratedCount: 3,
          dirtyCount: 3,
          progressTotal: 3,
        }),
      );
    } finally {
      dateNowSpy.mockRestore();
    }
  });

  it('switches Android foreground sync ownership back to the JS legacy path when native-first falls back', async () => {
    setPlatformOS('android');
    mockGetPermissionsAsync.mockResolvedValueOnce({ granted: true });
    mockSyncAndroidBackgroundScanForegroundService.mockResolvedValue(true);
    const assets = [
      createAndroidMediaStoreAsset('photo-1'),
      createAndroidMediaStoreAsset('photo-2'),
      createAndroidMediaStoreAsset('video-1', { mediaType: 'video' }),
    ];
    mockEnumerateAndroidMediaStoreAssets
      .mockResolvedValueOnce(assets)
      .mockResolvedValueOnce(assets)
      .mockResolvedValueOnce([]);
    mockScanMediaLibrary.mockImplementationOnce(async (_recycleBinIds, options) => {
      const onProgress = (options as { onProgress?: (progress: any) => void })?.onProgress;

      onProgress?.({
        current: 3,
        total: 3,
        currentFileName: 'IMG_003.jpg',
        isScanning: true,
        percentage: 100,
        analyzedAssetId: 'photo-2',
        analyzedInput: createAnalyzedInput('photo-2', {
          width: 640,
          height: 640,
          fileSize: 80_000,
          brightness: 0.03,
          contrast: 0.04,
          edgeDensity: 0.02,
        }),
        analyzedMediaType: 'photo',
      });

      return {
        state: {
          activeCandidates: [createCleanupCandidate('photo-2')],
          recycleBin: [],
          selectedIds: [],
        },
        summary: {
          scannedAt: 1_710_000_000_000,
          scannedCount: 3,
          candidateCount: 1,
          highConfidenceCount: 1,
          mediumConfidenceCount: 0,
          recycleBinCount: 0,
        },
      };
    });
    mockExecuteAndroidNativeFirstScan.mockImplementationOnce(async (options: any) => ({
      mode: 'legacy',
      fallbackReason: 'native-execution-failed',
      output: await options.runLegacyScan(options.recycleBinIds, options.legacyOptions),
    }));

    const renderer = await renderScreen();

    await pressPrimaryButton(renderer);

    expect(mockExecuteAndroidNativeFirstScan).toHaveBeenCalledTimes(1);
    expect(mockScanMediaLibrary).toHaveBeenCalledTimes(1);
    expect(mockSyncAndroidBackgroundScanForegroundService).toHaveBeenCalledWith({
      language: 'zh-CN',
      isScanning: true,
      progressCurrent: 0,
      progressTotal: 3,
      currentFileName: null,
    });
    expect(mockSyncAndroidBackgroundScanForegroundService).toHaveBeenLastCalledWith({
      language: 'zh-CN',
      isScanning: false,
      progressCurrent: 3,
      progressTotal: 3,
      currentFileName: null,
    });
    expect(collectRenderedTexts(renderer)).toContain('发现 1 个待处理媒体');
  });

  it('on Android only updates visible candidates after a checkpoint boundary instead of every analyzed asset', async () => {
    setPlatformOS('android');
    mockGetPermissionsAsync.mockResolvedValueOnce({ granted: true });
    const assets = [
      createAndroidMediaStoreAsset('photo-1'),
      createAndroidMediaStoreAsset('photo-2'),
      createAndroidMediaStoreAsset('video-1', { mediaType: 'video' }),
    ];
    mockEnumerateAndroidMediaStoreAssets
      .mockResolvedValueOnce(assets)
      .mockResolvedValueOnce(assets)
      .mockResolvedValueOnce([]);

    let resolveScan: ((value: any) => void) | undefined;
    let onProgress: ((progress: any) => void) | undefined;
    let onCheckpoint: ((checkpoint: any) => Promise<void>) | undefined;
    mockExecuteAndroidNativeFirstScan.mockImplementationOnce(async (options: any) => ({
      mode: 'native',
      fallbackReason: null,
      output: await new Promise((resolve) => {
        resolveScan = resolve;
        onProgress = options.legacyOptions.onProgress;
        onCheckpoint = options.legacyOptions.onCheckpoint;
      }),
    }));

    const renderer = await renderScreen();

    await pressPrimaryButton(renderer);

    await act(async () => {
      onProgress?.({
        current: 1,
        total: 3,
        currentFileName: 'IMG_001.jpg',
        isScanning: true,
        percentage: 33,
      });
      onProgress?.({
        current: 2,
        total: 3,
        currentFileName: 'IMG_002.jpg',
        isScanning: true,
        percentage: 67,
      });
      await flushPromises();
    });

    let renderedTexts = collectRenderedTexts(renderer);

    expect(renderedTexts).toContain('扫描中');
    expect(renderedTexts).toContain('2/3');
    expect(renderedTexts).toContain('grid-count:3');
    expect(renderedTexts).toContain('全部 3');
    expect(renderedTexts).toContain('照片 2');
    expect(renderedTexts).toContain('视频 1');

    await act(async () => {
      await onCheckpoint?.({
        current: 2,
        total: 3,
        currentFileName: 'IMG_002.jpg',
        processedCount: 2,
        lastProcessedAssetId: 'photo-2',
        analyzedInputs: [
          createAnalyzedInput('photo-1'),
          createAnalyzedInput('photo-2', {
            width: 640,
            height: 640,
            fileSize: 80_000,
            brightness: 0.03,
            contrast: 0.04,
            edgeDensity: 0.02,
          }),
        ],
      });
      await flushPromises();
    });

    renderedTexts = collectRenderedTexts(renderer);

    expect(renderedTexts).toContain('grid-count:2');
    expect(renderedTexts).toContain('全部 2');
    expect(renderedTexts).toContain('照片 1');
    expect(renderedTexts).toContain('视频 1');

    await act(async () => {
      resolveScan?.({
        state: {
          activeCandidates: [createCleanupCandidate('photo-2')],
          recycleBin: [],
          selectedIds: [],
        },
        summary: {
          scannedAt: 1_710_000_000_000,
          scannedCount: 3,
          candidateCount: 1,
          highConfidenceCount: 1,
          mediumConfidenceCount: 0,
          recycleBinCount: 0,
        },
      });
      await flushPromises();
    });
  });

  it('does not mirror native scan progress into the JS foreground sync path while native owns the notification', async () => {
    setPlatformOS('android');
    mockGetPermissionsAsync.mockResolvedValueOnce({ granted: true });
    mockSyncAndroidBackgroundScanForegroundService.mockResolvedValue(true);

    let resolveScan: ((value: any) => void) | undefined;
    let onProgress: ((progress: any) => void) | undefined;
    mockExecuteAndroidNativeFirstScan.mockImplementationOnce(async (options: any) => ({
      mode: 'native',
      fallbackReason: null,
      output: await new Promise((resolve) => {
        resolveScan = resolve;
        onProgress = options.legacyOptions.onProgress;
      }),
    }));

    const renderer = await renderScreen();

    await pressPrimaryButton(renderer);

    await act(async () => {
      onProgress?.({
        current: 4,
        total: 9,
        currentFileName: 'IMG_004.jpg',
        isScanning: true,
        percentage: 44,
      });
      await flushPromises();
    });

    expect(mockSyncAndroidBackgroundScanForegroundService).not.toHaveBeenCalled();

    await act(async () => {
      resolveScan?.({
        state: {
          activeCandidates: [],
          recycleBin: [],
          selectedIds: [],
        },
        summary: {
          scannedAt: 1_710_000_000_000,
          scannedCount: 9,
          candidateCount: 0,
          highConfidenceCount: 0,
          mediumConfidenceCount: 0,
          recycleBinCount: 0,
        },
      });
      await flushPromises();
    });
  });

  it('keeps the displayed Android native scan progress monotonic when a later checkpoint lags behind the last progress event', async () => {
    setPlatformOS('android');
    mockGetPermissionsAsync.mockResolvedValueOnce({ granted: true });
    mockSyncAndroidBackgroundScanForegroundService.mockResolvedValue(true);

    let resolveScan: ((value: any) => void) | undefined;
    let onProgress: ((progress: any) => void) | undefined;
    let onCheckpoint: ((checkpoint: any) => Promise<void> | void) | undefined;
    mockExecuteAndroidNativeFirstScan.mockImplementationOnce(async (options: any) => ({
      mode: 'native',
      fallbackReason: null,
      output: await new Promise((resolve) => {
        resolveScan = resolve;
        onProgress = options.legacyOptions.onProgress;
        onCheckpoint = options.legacyOptions.onCheckpoint;
      }),
    }));

    const renderer = await renderScreen();

    await pressPrimaryButton(renderer);

    await act(async () => {
      onProgress?.({
        current: 5,
        total: 9,
        currentFileName: 'IMG_005.jpg',
        isScanning: true,
        percentage: 55,
      });
      await flushPromises();
    });

    await act(async () => {
      await onCheckpoint?.({
        current: 4,
        total: 9,
        currentFileName: 'IMG_004.jpg',
        processedCount: 3,
        lastProcessedAssetId: 'photo-3',
        analyzedInputs: [createAnalyzedInput('photo-1')],
      });
      await flushPromises();
    });

    const renderedTexts = collectRenderedTexts(renderer);
    expect(renderedTexts).toContain('扫描中');
    expect(renderedTexts).toContain('5/9');
    expect(mockSavePhotoScanJobCheckpoint).toHaveBeenCalledWith(
      expect.objectContaining({
        progressCurrent: 5,
        progressTotal: 9,
      }),
    );

    await act(async () => {
      resolveScan?.({
        state: {
          activeCandidates: [],
          recycleBin: [],
          selectedIds: [],
        },
        summary: {
          scannedAt: 1_710_000_000_000,
          scannedCount: 9,
          candidateCount: 0,
          highConfidenceCount: 0,
          mediumConfidenceCount: 0,
          recycleBinCount: 0,
        },
      });
      await flushPromises();
    });
  });

  it('does not let a delayed final running checkpoint overwrite the completed batch record', async () => {
    setPlatformOS('android');
    mockGetPermissionsAsync.mockResolvedValueOnce({ granted: true });
    mockSyncAndroidBackgroundScanForegroundService.mockResolvedValue(true);

    let resolveScan: ((value: any) => void) | undefined;
    let onProgress: ((progress: any) => void) | undefined;
    const finalRunningCheckpoint = createDeferred<void>();

    mockSavePhotoScanJobCheckpoint.mockImplementation(
      (async (checkpoint: any) => {
        if (
          checkpoint.phase === 'running' &&
          checkpoint.progressCurrent === 3 &&
          checkpoint.progressTotal === 3
        ) {
          await finalRunningCheckpoint.promise;
        }
      }) as any,
    );

    mockExecuteAndroidNativeFirstScan.mockImplementationOnce(async (options: any) => ({
      mode: 'native',
      fallbackReason: null,
      output: await new Promise((resolve) => {
        resolveScan = resolve;
        onProgress = options.legacyOptions.onProgress;
      }),
    }));

    const renderer = await renderScreen();

    await pressPrimaryButton(renderer);

    await act(async () => {
      onProgress?.({
        current: 3,
        total: 3,
        currentFileName: 'IMG_003.jpg',
        isScanning: true,
        percentage: 100,
        analyzedAssetId: 'photo-3',
      });
      await flushPromises();
    });

    await act(async () => {
      resolveScan?.({
        state: {
          activeCandidates: [createCleanupCandidate('photo-3')],
          recycleBin: [],
          selectedIds: [],
        },
        summary: {
          scannedAt: 1_710_000_000_000,
          scannedCount: 3,
          candidateCount: 1,
          highConfidenceCount: 1,
          mediumConfidenceCount: 0,
          recycleBinCount: 0,
        },
      });
      await flushPromises();
    });

    expect(mockSavePhotoScanBatch.mock.calls.at(-1)?.[0]).toEqual(
      expect.objectContaining({
        phase: 'completed',
        candidateCount: 1,
        progressCurrent: 3,
        progressTotal: 3,
      }),
    );

    await act(async () => {
      finalRunningCheckpoint.resolve();
      await flushPromises();
    });

    expect(mockSavePhotoScanBatch.mock.calls.at(-1)?.[0]).toEqual(
      expect.objectContaining({
        phase: 'completed',
        candidateCount: 1,
        progressCurrent: 3,
        progressTotal: 3,
      }),
    );
  });

  it('restores the active scan session after leaving and re-entering the tab', async () => {
    mockGetPermissionsAsync.mockResolvedValue({ granted: true });

    mockScanMediaLibrary.mockImplementationOnce(
      (_recycleBinIds, options) =>
        new Promise(() => {
          const onProgress = (options as { onProgress?: (progress: any) => void })?.onProgress;

          onProgress?.({
            current: 1,
            total: 3,
            currentFileName: 'IMG_001.jpg',
            isScanning: true,
            percentage: 33,
            analyzedAssetId: 'photo-1',
            analyzedInput: null,
            analyzedMediaType: 'photo',
          });
        }),
    );

    const firstRenderer = await renderScreen();

    await pressPrimaryButton(firstRenderer);

    expect(collectRenderedTexts(firstRenderer)).toContain('扫描中');
    expect(collectRenderedTexts(firstRenderer)).toContain('1/3');

    await act(async () => {
      firstRenderer.unmount();
      await flushPromises();
    });

    expect(photoScanSessionRuntimeApi.persistPhotoScanSessionRuntimeSnapshot).toHaveBeenCalled();

    const secondRenderer = await renderScreen();
    const restoredTexts = collectRenderedTexts(secondRenderer);

    expect(restoredTexts).toContain('扫描中');
    expect(restoredTexts).toContain('1/3');
    expect(restoredTexts).toContain('grid-count:2');
    expect(photoScanSessionRuntimeApi.hydratePhotoScanSessionRuntimeSnapshot).toHaveBeenCalled();
  });

  it('drops an incoherent persisted completed snapshot on cold start and rehydrates authorized media', async () => {
    setPlatformOS('android');
    const assets = [
      createAndroidMediaStoreAsset('photo-1'),
      createAndroidMediaStoreAsset('photo-2'),
      createAndroidMediaStoreAsset('video-1', { mediaType: 'video' }),
    ];
    mockEnumerateAndroidMediaStoreAssets.mockResolvedValueOnce(assets);
    photoScanSessionRuntimeApi.getPhotoScanSessionRuntimeSnapshot.mockReturnValue(null);
    photoScanSessionRuntimeApi.hydratePhotoScanSessionRuntimeSnapshot.mockResolvedValue({
      permissionState: 'granted',
      phase: 'completed',
      authorizedCandidates: [
        createCleanupCandidate('photo-1'),
        createCleanupCandidate('photo-2'),
        createCleanupCandidate('video-1', 'video'),
      ],
      visibleCandidates: [],
      scanResultsCount: 0,
      scanProgress: {
        current: 0,
        total: 0,
        currentFileName: null,
      },
      scanScopeSelection: {
        total: 0,
        photo: 0,
        video: 0,
      },
      scanBatchRange: {
        startAt: 1_709_000_000_000,
        endAt: 1_710_000_000_000,
      },
      summary: {
        scannedAt: 1_710_000_000_000,
        scannedCount: 0,
        recycleBinCount: 0,
      },
      hasCompletedFullScan: true,
      errorMessage: null,
      updatedAt: Date.now(),
    });

    const renderer = await renderScreen();
    await act(async () => {
      await flushPromises();
      await flushPromises();
    });
    const renderedTexts = collectRenderedTexts(renderer);

    expect(photoScanSessionRuntimeApi.clearPhotoScanSessionRuntimeSnapshot).toHaveBeenCalledTimes(1);
    expect(mockEnumerateAndroidMediaStoreAssets).toHaveBeenCalledTimes(1);
    expect(renderedTexts).toContain('全部 3');
    expect(renderedTexts).toContain('grid-count:3');
  });

  it('ignores a stale completed scan cache when current authorized media exceeds its denominator', async () => {
    setPlatformOS('android');
    const assets = [
      createAndroidMediaStoreAsset('photo-1'),
      createAndroidMediaStoreAsset('photo-2'),
      createAndroidMediaStoreAsset('video-1', { mediaType: 'video' }),
    ];
    mockEnumerateAndroidMediaStoreAssets.mockResolvedValueOnce(assets);
    mockLoadPhotoScanResultCache.mockResolvedValue({
      activeCandidates: [],
      summary: {
        scannedAt: 1_710_000_000_000,
        scannedCount: 0,
        candidateCount: 0,
        highConfidenceCount: 0,
        mediumConfidenceCount: 0,
        recycleBinCount: 0,
      },
    });
    mockLoadLatestCompletedPhotoScanBatch.mockResolvedValue({
      batchId: 'batch-zero-completed',
      mode: 'full',
      phase: 'completed',
      windowDays: 365,
      rangeStartAt: 1_709_000_000_000,
      rangeEndAt: 1_710_000_000_000,
      progressCurrent: 0,
      progressTotal: 0,
      enumeratedCount: 0,
      dirtyCount: 0,
      analyzedCount: 0,
      candidateCount: 0,
      startedAt: 1_710_000_000_000,
      lastHeartbeatAt: 1_710_000_000_000,
      completedAt: 1_710_000_000_000,
      lastError: null,
      updatedAt: 1_710_000_000_000,
    });

    const renderer = await renderScreen();
    await act(async () => {
      await flushPromises();
    });
    expect(mockEnumerateAndroidMediaStoreAssets).toHaveBeenCalledTimes(1);
    expect(mockClearPhotoScanResultCache).toHaveBeenCalledTimes(1);
    expect(renderer.root.findAllByProps({ testID: 'mock-photo-grid' })).toHaveLength(1);
  });

  it('rebuilds Android resume state from the latest scan batch when no active scan job exists', async () => {
    setPlatformOS('android');
    mockLoadLatestPhotoScanBatch.mockResolvedValue({
      batchId: 'batch-restore-1',
      mode: 'rolling-window',
      phase: 'analysis',
      windowDays: 90,
      rangeStartAt: 1_709_200_000_000,
      rangeEndAt: 1_710_000_000_000,
      progressCurrent: 5,
      progressTotal: 9,
      enumeratedCount: 9,
      dirtyCount: 9,
      analyzedCount: 3,
      candidateCount: 0,
      startedAt: 1_710_000_000_000,
      lastHeartbeatAt: 1_710_000_000_500,
      completedAt: null,
      lastError: null,
      updatedAt: 1_710_000_000_500,
    });
    mockLoadPhotoScanBatchItems.mockResolvedValue([
      {
        batchId: 'batch-restore-1',
        assetId: 'photo-1',
        stage: 'completed',
        mediaType: 'photo',
        dirtyReason: 'new',
        attemptCount: 1,
        workerSlot: null,
        lastHeartbeatAt: 1_710_000_000_100,
        lastError: null,
        updatedAt: 1_710_000_000_100,
      },
      {
        batchId: 'batch-restore-1',
        assetId: 'photo-2',
        stage: 'completed',
        mediaType: 'photo',
        dirtyReason: null,
        attemptCount: 1,
        workerSlot: null,
        lastHeartbeatAt: 1_710_000_000_200,
        lastError: null,
        updatedAt: 1_710_000_000_200,
      },
      {
        batchId: 'batch-restore-1',
        assetId: 'video-1',
        stage: 'queued',
        mediaType: 'video',
        dirtyReason: null,
        attemptCount: 0,
        workerSlot: null,
        lastHeartbeatAt: null,
        lastError: null,
        updatedAt: 1_710_000_000_200,
      },
    ]);
    mockLoadPhotoScanJobCheckpoint.mockResolvedValue(null);

    let resolveScan: ((value: any) => void) | undefined;
    mockExecuteAndroidNativeFirstScan.mockImplementationOnce(async (options: any) => ({
      mode: 'native',
      fallbackReason: null,
      output: await new Promise((resolve) => {
        expect(options.jobId).toMatch(/^photo-scan-/);
        expect(options.legacyOptions.resumeAfterAssetId).toBe('photo-2');
        resolveScan = resolve;
      }),
    }));

    const renderer = await renderScreen();
    await act(async () => {
      await flushPromises();
      await flushPromises();
    });
    const renderedTexts = collectRenderedTexts(renderer);

    expect(mockLoadLatestPhotoScanBatch).toHaveBeenCalledTimes(1);
    expect(mockLoadPhotoScanBatchItems).toHaveBeenCalledWith('batch-restore-1');
    expect(renderedTexts).toContain('扫描中');
    expect(renderedTexts).toContain('5/9');
    expect(mockExecuteAndroidNativeFirstScan).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveScan?.({
        state: {
          activeCandidates: [],
          recycleBin: [],
          selectedIds: [],
        },
        summary: {
          scannedAt: 1_710_000_000_000,
          scannedCount: 9,
          candidateCount: 0,
          highConfidenceCount: 0,
          mediumConfidenceCount: 0,
          recycleBinCount: 0,
        },
      });
      await flushPromises();
    });
  });

  it('rebuilds Android full-batch recovery from the persisted batch range instead of hydrated recent-window candidates', async () => {
    setPlatformOS('android');
    const now = Date.UTC(2026, 4, 4, 0, 0, 0);
    const rollingRangeStartAt = buildScanRangeStartAt(12, now);
    const expectedBackfillRangeStartAt = buildScanRangeStartAt(12, rollingRangeStartAt);
    const dateNowSpy = vi.spyOn(Date, 'now').mockReturnValue(now);
    const recoveryBatch = {
      batchId: 'batch-recovery-full-1',
      mode: 'full' as const,
      phase: 'analysis' as const,
      windowDays: Math.round((rollingRangeStartAt - expectedBackfillRangeStartAt) / DAY_MS),
      rangeStartAt: expectedBackfillRangeStartAt,
      rangeEndAt: rollingRangeStartAt,
      progressCurrent: 0,
      progressTotal: 5,
      enumeratedCount: 5,
      dirtyCount: 5,
      analyzedCount: 0,
      candidateCount: 0,
      startedAt: now,
      lastHeartbeatAt: now + 500,
      completedAt: null,
      lastError: null,
      updatedAt: now + 500,
    };

    mockLoadLatestPhotoScanBatch.mockResolvedValue(recoveryBatch);
    mockLoadPhotoScanBatch.mockResolvedValue(recoveryBatch);
    mockLoadPhotoScanBatchItems.mockResolvedValue([
      {
        batchId: 'batch-recovery-full-1',
        assetId: 'older-photo-1',
        stage: 'queued',
        mediaType: 'photo',
        dirtyReason: 'new',
        attemptCount: 0,
        workerSlot: null,
        lastHeartbeatAt: null,
        lastError: null,
        updatedAt: now + 500,
      },
    ]);
    mockEnumerateAndroidMediaStoreAssets
      .mockResolvedValueOnce([
        createAndroidMediaStoreAsset('recent-photo-1', {
          dateTaken: now - DAY_MS,
          dateModified: now - DAY_MS,
        }),
      ])
      .mockResolvedValueOnce([
        createAndroidMediaStoreAsset('older-photo-1', {
          dateTaken: expectedBackfillRangeStartAt + DAY_MS,
          dateModified: expectedBackfillRangeStartAt + DAY_MS,
        }),
        createAndroidMediaStoreAsset('older-photo-2', {
          dateTaken: expectedBackfillRangeStartAt + 2 * DAY_MS,
          dateModified: expectedBackfillRangeStartAt + 2 * DAY_MS,
        }),
      ]);

    let resolveScan: ((value: any) => void) | undefined;
    mockExecuteAndroidNativeFirstScan.mockImplementationOnce(async (options: any) => ({
      mode: 'native',
      fallbackReason: null,
      output: await new Promise((resolve) => {
        expect(options.sourceCandidates).toEqual([
          expect.objectContaining({ id: 'older-photo-1' }),
          expect.objectContaining({ id: 'older-photo-2' }),
        ]);
        expect(options.legacyOptions).toEqual(
          expect.objectContaining({
            createdAfter: expectedBackfillRangeStartAt,
            createdBefore: rollingRangeStartAt,
          }),
        );
        resolveScan = resolve;
      }),
    }));

    try {
      const renderer = await renderScreen();
      await act(async () => {
        await flushPromises();
        await flushPromises();
      });

      expect(mockLoadPhotoScanBatch).toHaveBeenCalledWith('batch-recovery-full-1');
      expect(mockEnumerateAndroidMediaStoreAssets).toHaveBeenNthCalledWith(2, {
        createdAfter: expectedBackfillRangeStartAt,
        createdBefore: rollingRangeStartAt,
      });
      expect(mockExecuteAndroidNativeFirstScan).toHaveBeenCalledTimes(1);
      expect(collectRenderedTexts(renderer)).toContain('扫描中');
      expect(collectRenderedTexts(renderer)).toContain('0/5');

      await act(async () => {
        resolveScan?.({
          state: {
            activeCandidates: [],
            recycleBin: [],
            selectedIds: [],
          },
          summary: {
            scannedAt: now,
            scannedCount: 5,
            candidateCount: 0,
            highConfidenceCount: 0,
            mediumConfidenceCount: 0,
            recycleBinCount: 0,
          },
        });
        await flushPromises();
      });
    } finally {
      dateNowSpy.mockRestore();
    }
  });

  it('does not resume past a gap in completed batch items when rebuilding Android resume state', async () => {
    setPlatformOS('android');
    mockLoadLatestPhotoScanBatch.mockResolvedValue({
      batchId: 'batch-gap-restore-1',
      mode: 'rolling-window',
      phase: 'analysis',
      windowDays: 90,
      rangeStartAt: 1_709_200_000_000,
      rangeEndAt: 1_710_000_000_000,
      progressCurrent: 5,
      progressTotal: 9,
      enumeratedCount: 9,
      dirtyCount: 9,
      analyzedCount: 3,
      candidateCount: 0,
      startedAt: 1_710_000_000_000,
      lastHeartbeatAt: 1_710_000_000_500,
      completedAt: null,
      lastError: null,
      updatedAt: 1_710_000_000_500,
    });
    mockLoadPhotoScanBatchItems.mockResolvedValue([
      {
        batchId: 'batch-gap-restore-1',
        assetId: 'photo-1',
        stage: 'completed',
        mediaType: 'photo',
        dirtyReason: 'new',
        attemptCount: 1,
        workerSlot: null,
        lastHeartbeatAt: 1_710_000_000_100,
        lastError: null,
        updatedAt: 1_710_000_000_100,
      },
      {
        batchId: 'batch-gap-restore-1',
        assetId: 'photo-2',
        stage: 'queued',
        mediaType: 'photo',
        dirtyReason: null,
        attemptCount: 0,
        workerSlot: null,
        lastHeartbeatAt: null,
        lastError: null,
        updatedAt: 1_710_000_000_150,
      },
      {
        batchId: 'batch-gap-restore-1',
        assetId: 'video-1',
        stage: 'completed',
        mediaType: 'video',
        dirtyReason: null,
        attemptCount: 1,
        workerSlot: null,
        lastHeartbeatAt: 1_710_000_000_200,
        lastError: null,
        updatedAt: 1_710_000_000_200,
      },
    ]);
    mockLoadPhotoScanJobCheckpoint.mockResolvedValue(null);

    let resolveScan: ((value: any) => void) | undefined;
    mockExecuteAndroidNativeFirstScan.mockImplementationOnce(async (options: any) => ({
      mode: 'native',
      fallbackReason: null,
      output: await new Promise((resolve) => {
        expect(options.jobId).toMatch(/^photo-scan-/);
        expect(options.legacyOptions.resumeAfterAssetId).toBe('photo-1');
        resolveScan = resolve;
      }),
    }));

    const renderer = await renderScreen();
    await act(async () => {
      await flushPromises();
    });
    const renderedTexts = collectRenderedTexts(renderer);

    expect(mockLoadPhotoScanBatchItems).toHaveBeenCalledWith('batch-gap-restore-1');
    expect(renderedTexts).toContain('扫描中');
    expect(renderedTexts).toContain('5/9');
    expect(mockExecuteAndroidNativeFirstScan).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveScan?.({
        state: {
          activeCandidates: [],
          recycleBin: [],
          selectedIds: [],
        },
        summary: {
          scannedAt: 1_710_000_000_000,
          scannedCount: 9,
          candidateCount: 0,
          highConfidenceCount: 0,
          mediumConfidenceCount: 0,
          recycleBinCount: 0,
        },
      });
      await flushPromises();
    });
  });

  it('prefers the active scan job over a resumable batch during Android dual-write recovery', async () => {
    setPlatformOS('android');
    mockLoadLatestPhotoScanBatch.mockResolvedValue({
      batchId: 'batch-restore-1',
      mode: 'rolling-window',
      phase: 'analysis',
      windowDays: 90,
      rangeStartAt: 1_709_200_000_000,
      rangeEndAt: 1_710_000_000_000,
      progressCurrent: 5,
      progressTotal: 9,
      enumeratedCount: 9,
      dirtyCount: 9,
      analyzedCount: 5,
      candidateCount: 0,
      startedAt: 1_710_000_000_000,
      lastHeartbeatAt: 1_710_000_000_500,
      completedAt: null,
      lastError: null,
      updatedAt: 1_710_000_000_500,
    });
    mockLoadPhotoScanJobCheckpoint.mockResolvedValue({
      jobId: 'legacy-job-1',
      phase: 'running',
      progressCurrent: 2,
      progressTotal: 3,
      processedCount: 2,
      candidateCount: 0,
      startedAt: 1_710_000_000_000,
      lastHeartbeatAt: 1_710_000_000_400,
      currentFileName: 'IMG_002.jpg',
      lastProcessedAssetId: 'photo-2',
      lastError: null,
      updatedAt: 1_710_000_000_400,
    });

    let resolveScan: ((value: any) => void) | undefined;
    mockExecuteAndroidNativeFirstScan.mockImplementationOnce(async (options: any) => ({
      mode: 'native',
      fallbackReason: null,
      output: await new Promise((resolve) => {
        expect(options.jobId).toMatch(/^photo-scan-/);
        expect(options.legacyOptions.resumeAfterAssetId).toBe('photo-2');
        resolveScan = resolve;
      }),
    }));

    const renderer = await renderScreen();
    const renderedTexts = collectRenderedTexts(renderer);

    expect(mockLoadLatestPhotoScanBatch).toHaveBeenCalledTimes(1);
    expect(mockLoadPhotoScanBatchItems).not.toHaveBeenCalled();
    expect(renderedTexts).toContain('扫描中');
    expect(renderedTexts).toContain('2/3');
    expect(renderedTexts).not.toContain('5/9');
    expect(mockExecuteAndroidNativeFirstScan).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveScan?.({
        state: {
          activeCandidates: [],
          recycleBin: [],
          selectedIds: [],
        },
        summary: {
          scannedAt: 1_710_000_000_000,
          scannedCount: 3,
          candidateCount: 0,
          highConfidenceCount: 0,
          mediumConfidenceCount: 0,
          recycleBinCount: 0,
        },
      });
      await flushPromises();
    });
  });

  it('automatically resumes an interrupted scan after relaunch when a running scan job exists', async () => {
    mockLoadPhotoScanJobCheckpoint.mockResolvedValue({
      jobId: 'photo-scan-1710000000000-1',
      phase: 'running',
      progressCurrent: 2,
      progressTotal: 3,
      processedCount: 2,
      candidateCount: 0,
      startedAt: 1_710_000_000_000,
      lastHeartbeatAt: 1_710_000_000_500,
      currentFileName: 'IMG_002.jpg',
      lastProcessedAssetId: 'photo-2',
      lastError: null,
      updatedAt: 1_710_000_000_500,
    });
    mockScanMediaLibrary.mockImplementationOnce(
      (_recycleBinIds, options) =>
        new Promise(() => {
          const onProgress = (options as { onProgress?: (progress: any) => void })?.onProgress;

          onProgress?.({
            current: 1,
            total: 3,
            currentFileName: 'IMG_001.jpg',
            isScanning: true,
            percentage: 33,
            analyzedAssetId: 'photo-1',
            analyzedInput: null,
            analyzedMediaType: 'photo',
          });
        }),
    );

    const renderer = await renderScreen();
    const renderedTexts = collectRenderedTexts(renderer);

    expect(mockLoadPhotoScanJobCheckpoint).toHaveBeenCalled();
    expect(mockScanMediaLibrary).toHaveBeenCalledTimes(1);
    expect(mockScanMediaLibrary.mock.calls[0]?.[1]).toMatchObject({
      resumeAfterAssetId: 'photo-2',
    });
    expect(renderedTexts).toContain('扫描中');
    expect(renderedTexts).toContain('2/3');
    expect(renderedTexts).toContain('检测到 Android 本地扫描仍在继续，已自动接回当前批次。');
  });

  it('uses persisted progressCurrent and progressTotal for resume display on Android while still resuming from lastProcessedAssetId', async () => {
    setPlatformOS('android');
    mockLoadPhotoScanJobCheckpoint.mockResolvedValue({
      jobId: 'photo-scan-1710000000000-1',
      phase: 'running',
      progressCurrent: 5,
      progressTotal: 9,
      processedCount: 3,
      candidateCount: 0,
      startedAt: 1_710_000_000_000,
      lastHeartbeatAt: 1_710_000_000_500,
      currentFileName: 'IMG_005.jpg',
      lastProcessedAssetId: 'photo-3',
      lastError: null,
      updatedAt: 1_710_000_000_500,
    });

    let resolveScan: ((value: any) => void) | undefined;
    mockExecuteAndroidNativeFirstScan.mockImplementationOnce(async (options: any) => ({
      mode: 'native',
      fallbackReason: null,
      output: await new Promise((resolve) => {
        expect(options.legacyOptions.resumeAfterAssetId).toBe('photo-3');
        resolveScan = resolve;
      }),
    }));

    const renderer = await renderScreen();
    const renderedTexts = collectRenderedTexts(renderer);

    expect(mockExecuteAndroidNativeFirstScan).toHaveBeenCalledTimes(1);
    expect(renderedTexts).toContain('扫描中');
    expect(renderedTexts).toContain('5/9');
    expect(renderedTexts).toContain('检测到 Android 本地扫描仍在继续，已自动接回当前批次。');

    await act(async () => {
      resolveScan?.({
        state: {
          activeCandidates: [],
          recycleBin: [],
          selectedIds: [],
        },
        summary: {
          scannedAt: 1_710_000_000_000,
          scannedCount: 9,
          candidateCount: 0,
          highConfidenceCount: 0,
          mediumConfidenceCount: 0,
          recycleBinCount: 0,
        },
      });
      await flushPromises();
    });
  });

  it('persists a contiguous resume cursor instead of the latest out-of-order analyzed asset on Android', async () => {
    setPlatformOS('android');
    const assets = [
      createAndroidMediaStoreAsset('photo-1'),
      createAndroidMediaStoreAsset('photo-2'),
      createAndroidMediaStoreAsset('video-1', { mediaType: 'video' }),
    ];
    mockEnumerateAndroidMediaStoreAssets
      .mockResolvedValueOnce(assets)
      .mockResolvedValueOnce(assets)
      .mockResolvedValueOnce([]);

    let onProgress: ((progress: any) => void) | undefined;
    let onCheckpoint: ((checkpoint: any) => Promise<void> | void) | undefined;
    let resolveScan: ((value: any) => void) | undefined;
    mockExecuteAndroidNativeFirstScan.mockImplementationOnce(async (options: any) => ({
      mode: 'native',
      fallbackReason: null,
      output: await new Promise((resolve) => {
        onProgress = options.legacyOptions.onProgress;
        onCheckpoint = options.legacyOptions.onCheckpoint;
        resolveScan = resolve;
      }),
    }));

    const renderer = await renderScreen();

    await pressPrimaryButton(renderer);

    await act(async () => {
      onProgress?.({
        current: 1,
        total: 3,
        currentFileName: 'IMG_001.jpg',
        isScanning: true,
        percentage: 33,
        analyzedAssetId: 'photo-1',
        analyzedInput: createAnalyzedInput('photo-1'),
        analyzedMediaType: 'photo',
      });
      onProgress?.({
        current: 2,
        total: 3,
        currentFileName: 'VID_001.mp4',
        isScanning: true,
        percentage: 66,
        analyzedAssetId: 'video-1',
        analyzedInput: createAnalyzedInput('video-1'),
        analyzedMediaType: 'video',
      });
      await onCheckpoint?.({
        current: 2,
        total: 3,
        currentFileName: 'VID_001.mp4',
        processedCount: 2,
        lastProcessedAssetId: 'video-1',
        analyzedInputs: [createAnalyzedInput('photo-1'), createAnalyzedInput('video-1')],
      });
      await flushPromises();
    });

    expect(mockSavePhotoScanJobCheckpoint).toHaveBeenLastCalledWith(
      expect.objectContaining({
        progressCurrent: 2,
        progressTotal: 3,
        processedCount: 1,
        lastProcessedAssetId: 'photo-1',
      }),
    );
    expect(mockSavePhotoScanBatch).toHaveBeenLastCalledWith(
      expect.objectContaining({
        progressCurrent: 2,
        progressTotal: 3,
        analyzedCount: 2,
      }),
    );

    await act(async () => {
      resolveScan?.({
        state: {
          activeCandidates: [],
          recycleBin: [],
          selectedIds: [],
        },
        summary: {
          scannedAt: 1_710_000_000_000,
          scannedCount: 3,
          candidateCount: 0,
          highConfidenceCount: 0,
          mediumConfidenceCount: 0,
          recycleBinCount: 0,
        },
      });
      await flushPromises();
    });
  });

  it('ignores no-payload checkpoints when deriving the Android resume cursor across a gap', async () => {
    setPlatformOS('android');
    const assets = [
      createAndroidMediaStoreAsset('photo-1'),
      createAndroidMediaStoreAsset('photo-2'),
      createAndroidMediaStoreAsset('video-1', { mediaType: 'video' }),
    ];
    mockEnumerateAndroidMediaStoreAssets
      .mockResolvedValueOnce(assets)
      .mockResolvedValueOnce(assets)
      .mockResolvedValueOnce([]);

    let onProgress: ((progress: any) => void) | undefined;
    let onCheckpoint: ((checkpoint: any) => Promise<void> | void) | undefined;
    let resolveScan: ((value: any) => void) | undefined;
    mockExecuteAndroidNativeFirstScan.mockImplementationOnce(async (options: any) => ({
      mode: 'native',
      fallbackReason: null,
      output: await new Promise((resolve) => {
        onProgress = options.legacyOptions.onProgress;
        onCheckpoint = options.legacyOptions.onCheckpoint;
        resolveScan = resolve;
      }),
    }));

    const renderer = await renderScreen();

    await pressPrimaryButton(renderer);

    await act(async () => {
      onProgress?.({
        current: 1,
        total: 3,
        currentFileName: 'IMG_001.jpg',
        isScanning: true,
        percentage: 33,
        analyzedAssetId: 'photo-1',
        analyzedInput: createAnalyzedInput('photo-1'),
        analyzedMediaType: 'photo',
      });
      onProgress?.({
        current: 2,
        total: 3,
        currentFileName: 'VID_001.mp4',
        isScanning: true,
        percentage: 66,
        analyzedAssetId: 'video-1',
        analyzedInput: createAnalyzedInput('video-1'),
        analyzedMediaType: 'video',
      });
      await onCheckpoint?.({
        current: 2,
        total: 3,
        currentFileName: 'VID_001.mp4',
        processedCount: 2,
        lastProcessedAssetId: 'video-1',
        analyzedInputs: [],
      });
      await flushPromises();
    });

    expect(mockSavePhotoScanJobCheckpoint).toHaveBeenLastCalledWith(
      expect.objectContaining({
        progressCurrent: 2,
        progressTotal: 3,
        processedCount: 1,
        lastProcessedAssetId: 'photo-1',
      }),
    );
    expect(mockSavePhotoScanBatch).toHaveBeenLastCalledWith(
      expect.objectContaining({
        progressCurrent: 2,
        progressTotal: 3,
        analyzedCount: 2,
      }),
    );

    await act(async () => {
      resolveScan?.({
        state: {
          activeCandidates: [],
          recycleBin: [],
          selectedIds: [],
        },
        summary: {
          scannedAt: 1_710_000_000_000,
          scannedCount: 3,
          candidateCount: 0,
          highConfidenceCount: 0,
          mediumConfidenceCount: 0,
          recycleBinCount: 0,
        },
      });
      await flushPromises();
    });
  });

  it('attaches to the running Android native scan snapshot instead of restarting it on restore', async () => {
    setPlatformOS('android');
    mockLoadActiveAndroidNativeScanSnapshot.mockResolvedValue({
      status: {
        jobId: 'native-scan-job-1',
        phase: 'running',
        current: 5,
        total: 9,
        processedCount: 3,
        currentFileName: 'IMG_005.jpg',
        lastProcessedAssetId: 'photo-3',
        startedAt: 1_710_000_000_000,
        updatedAt: 1_710_000_000_500,
      },
      analyzedInputs: [],
    });

    let resolveScan: ((value: any) => void) | undefined;
    mockExecuteAndroidNativeFirstScan.mockImplementationOnce(async (options: any) => ({
      mode: 'native',
      fallbackReason: null,
      output: await new Promise((resolve) => {
        expect(options.jobId).toBe('native-scan-job-1');
        expect(options.attachToRunningIfPresent).toBe(true);
        expect(options.nativeRuntimeSnapshot?.status?.jobId).toBe('native-scan-job-1');
        expect(options.legacyOptions.resumeAfterAssetId).toBeNull();
        resolveScan = resolve;
      }),
    }));

    const renderer = await renderScreen();
    const renderedTexts = collectRenderedTexts(renderer);

    expect(renderedTexts).toContain('扫描中');
    expect(renderedTexts).toContain('5/9');
    expect(mockExecuteAndroidNativeFirstScan).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveScan?.({
        state: {
          activeCandidates: [],
          recycleBin: [],
          selectedIds: [],
        },
        summary: {
          scannedAt: 1_710_000_000_000,
          scannedCount: 9,
          candidateCount: 0,
          highConfidenceCount: 0,
          mediumConfidenceCount: 0,
          recycleBinCount: 0,
        },
      });
      await flushPromises();
    });
  });

  it('keeps the in-process session restore path ahead of the persisted scan job fallback', async () => {
    photoScanSessionRuntimeApi.stagePhotoScanSessionRuntimeSnapshot({
      permissionState: 'granted',
      phase: 'scanning',
      authorizedCandidates: [
        createCleanupCandidate('photo-1'),
        createCleanupCandidate('photo-2'),
      ],
      visibleCandidates: [
        createCleanupCandidate('photo-1'),
        createCleanupCandidate('photo-2'),
      ],
      scanResultsCount: 0,
      scanProgress: {
        current: 1,
        total: 3,
        currentFileName: 'IMG_001.jpg',
      },
      scanScopeSelection: {
        total: 2,
        photo: 2,
        video: 0,
      },
      summary: {
        scannedAt: 0,
        scannedCount: 3,
        recycleBinCount: 0,
      },
      errorMessage: null,
      updatedAt: Date.now(),
    });
    mockLoadPhotoScanJobCheckpoint.mockResolvedValue({
      jobId: 'photo-scan-1710000000000-1',
      phase: 'running',
      progressCurrent: 2,
      progressTotal: 3,
      processedCount: 2,
      candidateCount: 0,
      startedAt: 1_710_000_000_000,
      lastHeartbeatAt: 1_710_000_000_500,
      currentFileName: 'IMG_002.jpg',
      lastProcessedAssetId: 'photo-2',
      lastError: null,
      updatedAt: 1_710_000_000_500,
    });

    const renderer = await renderScreen();
    const renderedTexts = collectRenderedTexts(renderer);

    expect(mockScanMediaLibrary).not.toHaveBeenCalled();
    expect(renderedTexts).toContain('扫描中');
    expect(renderedTexts).toContain('1/3');
    expect(renderedTexts).toContain('grid-count:2');
    expect(renderedTexts).not.toContain('检测到 Android 本地扫描仍在继续，已自动接回当前批次。');
  });

  it('renders the granted idle runtime snapshot immediately on remount without flashing the permission card', async () => {
    photoScanSessionRuntimeApi.stagePhotoScanSessionRuntimeSnapshot({
      permissionState: 'granted',
      phase: 'idle',
      authorizedCandidates: [
        createCleanupCandidate('photo-1'),
        createCleanupCandidate('photo-2'),
      ],
      visibleCandidates: [
        createCleanupCandidate('photo-1'),
        createCleanupCandidate('photo-2'),
      ],
      scanResultsCount: 0,
      scanProgress: {
        current: 0,
        total: 3,
        currentFileName: null,
      },
      scanScopeSelection: {
        total: 2,
        photo: 2,
        video: 0,
      },
      summary: {
        scannedAt: 0,
        scannedCount: 3,
        recycleBinCount: 0,
      },
      errorMessage: null,
      updatedAt: Date.now(),
    });

    const renderer = await renderScreen();
    const renderedTexts = collectRenderedTexts(renderer);

    expect(renderer.root.findAllByProps({ testID: 'mock-photo-grid' })).toHaveLength(1);
    expect(renderer.root.findAllByProps({ testID: 'photo-grid-loading-overlay' })).toHaveLength(0);
    expect(renderedTexts).not.toContain(appPreferencesState.copy.permission.title);
  });

  it('keeps a granted idle runtime snapshot staged after an authorized idle render so tab switching does not fall back to the permission card', async () => {
    const renderer = await renderScreen();

    expect(renderer.root.findAllByProps({ testID: 'mock-photo-grid' })).toHaveLength(1);
    expect(photoScanSessionRuntimeApi.stagePhotoScanSessionRuntimeSnapshot).toHaveBeenLastCalledWith(
      expect.objectContaining({
        permissionState: 'granted',
        phase: 'idle',
      }),
    );
  });

  it('shows the continue-scan empty state after a scan finishes with no remaining flagged media', async () => {
    const renderer = await renderScreen();

    await pressPrimaryButton(renderer);

    const renderedTexts = collectRenderedTexts(renderer);

    expect(renderedTexts).toContain(appPreferencesState.copy.screens.photoGrid.scanExhaustedTitle);
    expect(renderedTexts).toContain(appPreferencesState.copy.screens.photoGrid.scanExhaustedBody);
    expect(renderedTexts).toContain(appPreferencesState.copy.screens.photoGrid.continueScan);
    expect(renderedTexts).not.toContain('发现 0 个待处理媒体');
    expect(renderer.root.findAllByProps({ testID: 'photo-grid-scan-summary' })).toHaveLength(0);
    expect(renderer.root.findAllByProps({ testID: 'photo-grid-scan-exhausted-state' })).toHaveLength(1);
    expect(renderer.root.findAllByProps({ testID: 'photo-grid-scan-exhausted-title' })).toHaveLength(1);
    expect(renderedTexts).toContain('重复照片 0');
    expect(renderedTexts).toContain('模糊照片 0');
    expect(renderedTexts).toContain('相似照片 0');
  });

  it('preserves the granted completed-empty state on remount when permission refresh transiently misreports denied', async () => {
    photoScanSessionRuntimeApi.stagePhotoScanSessionRuntimeSnapshot({
      permissionState: 'granted',
      phase: 'completed',
      authorizedCandidates: [
        createCleanupCandidate('photo-1'),
        createCleanupCandidate('photo-2'),
      ],
      visibleCandidates: [],
      scanResultsCount: 0,
      scanProgress: {
        current: 2,
        total: 2,
        currentFileName: null,
      },
      scanScopeSelection: {
        total: 2,
        photo: 2,
        video: 0,
      },
      summary: {
        scannedAt: 1_710_000_000_000,
        scannedCount: 2,
        recycleBinCount: 0,
      },
      errorMessage: null,
      updatedAt: Date.now(),
    });
    mockGetPermissionsAsync.mockResolvedValueOnce({ granted: false });

    const renderer = await renderScreen();
    const renderedTexts = collectRenderedTexts(renderer);

    expect(renderedTexts).toContain(appPreferencesState.copy.screens.photoGrid.scanExhaustedTitle);
    expect(renderedTexts).toContain(appPreferencesState.copy.screens.photoGrid.scanExhaustedBody);
    expect(renderedTexts).not.toContain(appPreferencesState.copy.permission.title);
  });

  it('preserves the granted completed state with flagged results on remount when permission refresh transiently misreports denied', async () => {
    photoScanSessionRuntimeApi.stagePhotoScanSessionRuntimeSnapshot({
      permissionState: 'granted',
      phase: 'completed',
      authorizedCandidates: [
        createCleanupCandidate('photo-1'),
        createCleanupCandidate('photo-2'),
      ],
      visibleCandidates: [createCleanupCandidate('flagged-1')],
      scanResultsCount: 1,
      scanProgress: {
        current: 2,
        total: 2,
        currentFileName: null,
      },
      scanScopeSelection: {
        total: 2,
        photo: 2,
        video: 0,
      },
      summary: {
        scannedAt: 1_710_000_000_000,
        scannedCount: 2,
        recycleBinCount: 0,
      },
      errorMessage: null,
      updatedAt: Date.now(),
    });
    mockGetPermissionsAsync.mockResolvedValueOnce({ granted: false });

    const renderer = await renderScreen();
    const renderedTexts = collectRenderedTexts(renderer);

    expect(renderedTexts).toContain('发现 1 个待处理媒体');
    expect(renderedTexts).not.toContain(appPreferencesState.copy.permission.title);
  });

  it('preserves the granted scanning state on remount when permission refresh transiently misreports denied', async () => {
    photoScanSessionRuntimeApi.stagePhotoScanSessionRuntimeSnapshot({
      permissionState: 'granted',
      phase: 'scanning',
      authorizedCandidates: [
        createCleanupCandidate('photo-1'),
        createCleanupCandidate('photo-2'),
      ],
      visibleCandidates: [
        createCleanupCandidate('photo-1'),
        createCleanupCandidate('photo-2'),
      ],
      scanResultsCount: 0,
      scanProgress: {
        current: 1,
        total: 3,
        currentFileName: 'IMG_001.jpg',
      },
      scanScopeSelection: {
        total: 2,
        photo: 2,
        video: 0,
      },
      summary: {
        scannedAt: 0,
        scannedCount: 3,
        recycleBinCount: 0,
      },
      errorMessage: null,
      updatedAt: Date.now(),
    });
    mockGetPermissionsAsync.mockResolvedValueOnce({ granted: false });

    const renderer = await renderScreen();
    const renderedTexts = collectRenderedTexts(renderer);

    expect(renderedTexts).toContain('扫描中');
    expect(renderedTexts).toContain('1/3');
    expect(renderedTexts).not.toContain(appPreferencesState.copy.permission.title);
    expect(photoScanSessionRuntimeApi.clearPhotoScanSessionRuntimeSnapshot).not.toHaveBeenCalled();
  });

  it('stops a stale Android native background scan snapshot when it is no longer running', async () => {
    setPlatformOS('android');
    mockLoadActiveAndroidNativeScanSnapshot.mockResolvedValue({
      status: {
        jobId: 'native-scan-job-1',
        phase: 'completed',
        current: 9,
        total: 9,
        processedCount: 9,
        currentFileName: null,
        lastProcessedAssetId: 'photo-9',
        startedAt: 1_710_000_000_000,
        updatedAt: 1_710_000_000_500,
      },
      analyzedInputs: [],
    });

    await renderScreen();

    expect(mockStopAndroidNativeScan).toHaveBeenCalledTimes(1);
    expect(mockExecuteAndroidNativeFirstScan).not.toHaveBeenCalled();
  });

  it('notifies locally when a scan finishes while the app is not active', async () => {
    const renderer = await renderScreen();

    await act(async () => {
      appStateApi.emit('background');
      await flushPromises();
    });

    await pressPrimaryButton(renderer);

    expect(mockNotifyScanCompletionIfNeeded).toHaveBeenCalledWith({
      language: 'zh-CN',
      scannedCount: 0,
      resultCount: 0,
    });
  });

  it('does not notify when a scan finishes while the app remains active', async () => {
    const renderer = await renderScreen();

    await pressPrimaryButton(renderer);

    expect(mockNotifyScanCompletionIfNeeded).not.toHaveBeenCalled();
  });

  it('freezes the current detail snapshot during scanning and flushes buffered list updates on close', async () => {
    mockGetAssetsAsync.mockResolvedValueOnce({
      assets: [
        createAsset('photo-1', mediaLibraryApi.MediaType.photo),
        createAsset('photo-2', mediaLibraryApi.MediaType.photo),
        createAsset('photo-3', mediaLibraryApi.MediaType.photo),
        createAsset('photo-4', mediaLibraryApi.MediaType.photo),
      ],
      hasNextPage: false,
      endCursor: undefined,
    });

    let resolveScan:
      | ((
          value: {
            state: { activeCandidates: readonly unknown[]; recycleBin: readonly unknown[]; selectedIds: readonly string[] };
            summary: {
              scannedAt: number;
              scannedCount: number;
              candidateCount: number;
              highConfidenceCount: number;
              mediumConfidenceCount: number;
              recycleBinCount: number;
            };
          },
        ) => void)
      | undefined;
    let onProgress: ((progress: any) => void) | undefined;

    mockScanMediaLibrary.mockImplementationOnce(
      (_recycleBinIds, options) =>
        new Promise((resolve) => {
          resolveScan = resolve;
          onProgress = (options as { onProgress?: (progress: any) => void })?.onProgress;
        }),
    );

    const duplicateFingerprint = '0'.repeat(16);
    const renderer = await renderScreen();

    await pressPrimaryButton(renderer);

    await act(async () => {
      onProgress?.({
        current: 1,
        total: 4,
        currentFileName: 'IMG_001.jpg',
        isScanning: true,
        percentage: 25,
        analyzedAssetId: 'photo-1',
        analyzedInput: createAnalyzedInput('photo-1', {
          width: 3024,
          height: 4032,
          fileSize: 4_200_000,
          fingerprint: duplicateFingerprint,
        }),
        analyzedMediaType: 'photo',
      });
      onProgress?.({
        current: 2,
        total: 4,
        currentFileName: 'IMG_002.jpg',
        isScanning: true,
        percentage: 50,
        analyzedAssetId: 'photo-2',
        analyzedInput: createAnalyzedInput('photo-2', {
          width: 1440,
          height: 1920,
          fileSize: 420_000,
          fingerprint: duplicateFingerprint,
        }),
        analyzedMediaType: 'photo',
      });
      onProgress?.({
        current: 3,
        total: 4,
        currentFileName: 'IMG_003.jpg',
        isScanning: true,
        percentage: 75,
        analyzedAssetId: 'photo-3',
        analyzedInput: createAnalyzedInput('photo-3', {
          width: 1080,
          height: 1440,
          fileSize: 360_000,
          fingerprint: duplicateFingerprint,
        }),
        analyzedMediaType: 'photo',
      });
      await flushPromises();
    });

    expect(collectRenderedTexts(renderer)).toContain('grid-count:3');

    await pressByTestId(renderer, 'mock-photo-grid-press-photo-2');

    let renderedTexts = collectRenderedTexts(renderer);

    expect(renderedTexts).toContain('detail:photo-2');
    expect(renderedTexts).toContain('detail-scope:2');
    expect(renderer.root.findAllByProps({ testID: 'photo-grid-loading-overlay' })).toHaveLength(0);

    await act(async () => {
      onProgress?.({
        current: 4,
        total: 4,
        currentFileName: 'IMG_004.jpg',
        isScanning: true,
        percentage: 100,
        analyzedAssetId: 'photo-4',
        analyzedInput: null,
        analyzedMediaType: 'photo',
      });
      await flushPromises();
    });

    renderedTexts = collectRenderedTexts(renderer);

    expect(renderedTexts).toContain('detail:photo-2');
    expect(renderedTexts).toContain('detail-scope:2');
    expect(renderer.root.findAllByProps({ testID: 'photo-grid-loading-overlay' })).toHaveLength(0);

    await pressByTestId(renderer, 'mock-detail-close');

    renderedTexts = collectRenderedTexts(renderer);

    expect(renderer.root.findByProps({ testID: 'photo-grid-loading-overlay' })).toBeTruthy();
    expect(renderedTexts).toContain('grid-count:2');
    expect(renderedTexts).toContain('全部 2');
    expect(renderedTexts).toContain('照片 2');
    expect(renderedTexts).toContain('视频 0');

    await act(async () => {
      resolveScan?.({
        state: {
          activeCandidates: [createCleanupCandidate('photo-2'), createCleanupCandidate('photo-3')],
          recycleBin: [],
          selectedIds: [],
        },
        summary: {
          scannedAt: 1_710_000_000_000,
          scannedCount: 4,
          candidateCount: 2,
          highConfidenceCount: 2,
          mediumConfidenceCount: 0,
          recycleBinCount: 0,
        },
      });
      await flushPromises();
    });
  });

  it('hydrates cached scan results on re-entry instead of forcing a fresh rescan', async () => {
    mockLoadPhotoScanResultCache.mockResolvedValueOnce({
      activeCandidates: [
        {
          id: 'cached-candidate',
          asset: {
            id: 'cached-candidate',
            uri: 'file:///cached-candidate.jpg',
            previewUri: 'file:///cached-preview.jpg',
            mediaType: 'photo',
            width: 3024,
            height: 4032,
            duration: 0,
            fileSize: 120_000,
            creationTime: 1_710_000_000_000,
          },
          score: 78,
          confidence: 'high',
          kind: 'abnormal-photo',
          primaryIssueType: 'abnormal',
          issueTypes: ['abnormal'],
          reasons: ['缓存命中'],
        },
      ],
      summary: {
        scannedAt: 1_710_000_000_000,
        scannedCount: 3,
        candidateCount: 1,
        highConfidenceCount: 1,
        mediumConfidenceCount: 0,
        recycleBinCount: 0,
      },
    });

    const renderer = await renderScreen();
    const renderedTexts = collectRenderedTexts(renderer);

    expect(mockLoadPhotoScanResultCache).toHaveBeenCalledTimes(1);
    expect(mockScanMediaLibrary).not.toHaveBeenCalled();
    expect(renderedTexts).toContain('发现 1 个待处理媒体');
    expect(renderedTexts).toContain('全部 3');
    expect(renderedTexts).toContain('照片 2');
    expect(renderedTexts).toContain('视频 1');
    expect(renderedTexts).toContain('grid-count:1');
  });

  it('filters persisted false-positive media out of hydrated cache results', async () => {
    mockLoadFalsePositiveCandidateIds.mockResolvedValueOnce(['cached-hidden']);
    mockLoadPhotoScanResultCache.mockResolvedValueOnce({
      activeCandidates: [
        {
          id: 'cached-hidden',
          asset: {
            id: 'cached-hidden',
            uri: 'file:///cached-hidden.jpg',
            previewUri: 'file:///cached-hidden-preview.jpg',
            mediaType: 'photo',
            width: 3024,
            height: 4032,
            duration: 0,
            fileSize: 180_000,
            creationTime: 1_710_000_000_000,
          },
          score: 77,
          confidence: 'high',
          kind: 'abnormal-photo',
          primaryIssueType: 'abnormal',
          issueTypes: ['abnormal'],
          reasons: ['误报已保留'],
        },
        {
          id: 'cached-visible',
          asset: {
            id: 'cached-visible',
            uri: 'file:///cached-visible.jpg',
            previewUri: 'file:///cached-visible-preview.jpg',
            mediaType: 'photo',
            width: 3024,
            height: 4032,
            duration: 0,
            fileSize: 220_000,
            creationTime: 1_710_000_100_000,
          },
          score: 81,
          confidence: 'high',
          kind: 'abnormal-photo',
          primaryIssueType: 'abnormal',
          issueTypes: ['abnormal'],
          reasons: ['缓存命中'],
        },
      ],
      summary: {
        scannedAt: 1_710_000_000_000,
        scannedCount: 3,
        candidateCount: 2,
        highConfidenceCount: 2,
        mediumConfidenceCount: 0,
        recycleBinCount: 0,
      },
    });

    const renderer = await renderScreen();
    const renderedTexts = collectRenderedTexts(renderer);

    expect(renderedTexts).toContain('grid-count:1');
    expect(renderedTexts).toContain('全部 3');
    expect(renderedTexts).toContain('照片 2');
    expect(renderedTexts).toContain('视频 1');
    expect(renderedTexts).toContain('cached-visible');
    expect(renderedTexts).not.toContain('cached-hidden');
    expect(mockSavePhotoScanResultCache).toHaveBeenCalledWith(
      expect.objectContaining({
        activeCandidates: [
          expect.objectContaining({
            id: 'cached-visible',
          }),
        ],
        summary: expect.objectContaining({
          candidateCount: 1,
          scannedCount: 3,
        }),
      }),
    );
  });

  it('opens the detail view when a media thumbnail is tapped', async () => {
    const renderer = await renderScreen();

    await pressByTestId(renderer, 'mock-photo-grid-press-photo-1');

    expect(renderer.root.findByProps({ testID: 'mock-detail-screen' })).toBeTruthy();
    expect(collectRenderedTexts(renderer)).toContain('detail:photo-1');
    expect(collectRenderedTexts(renderer)).toContain('detail-scope:1');
  });

  it('closes the open detail view when Android hardware back is pressed', async () => {
    setPlatformOS('android');
    const renderer = await renderScreen();

    await pressByTestId(renderer, 'mock-photo-grid-press-photo-1');
    expect(renderer.root.findByProps({ testID: 'mock-detail-screen' })).toBeTruthy();

    let consumed = false;
    await act(async () => {
      consumed = hardwareBackApi.emit();
      await flushPromises();
    });

    expect(consumed).toBe(true);
    expect(renderer.root.findAllByProps({ testID: 'mock-detail-screen' })).toHaveLength(0);
    expect(renderer.root.findByProps({ testID: 'mock-photo-grid' })).toBeTruthy();
  });

  it('uses Android hardware back like the issue workspace header back button', async () => {
    setPlatformOS('android');
    photoScanSessionRuntimeApi.stagePhotoScanSessionRuntimeSnapshot({
      permissionState: 'granted',
      phase: 'completed',
      authorizedCandidates: [createCleanupCandidate('flagged-1')],
      visibleCandidates: [createCleanupCandidate('flagged-1')],
      scanResultsCount: 1,
      scanProgress: {
        current: 1,
        total: 1,
        currentFileName: null,
      },
      scanScopeSelection: {
        total: 1,
        photo: 1,
        video: 0,
      },
      summary: {
        scannedAt: 1_710_000_000_000,
        scannedCount: 1,
        recycleBinCount: 0,
      },
      errorMessage: null,
      updatedAt: Date.now(),
    });

    const renderer = await renderScreen();

    await pressByTestId(renderer, 'photo-grid-result-breakdown-blurry');
    expect(renderer.root.findByProps({ testID: 'photo-grid-workspace-title' })).toBeTruthy();

    let consumed = false;
    await act(async () => {
      consumed = hardwareBackApi.emit();
      await flushPromises();
    });

    const renderedTexts = collectRenderedTexts(renderer);
    expect(consumed).toBe(true);
    expect(renderer.root.findAllByProps({ testID: 'photo-grid-workspace-title' })).toHaveLength(0);
    expect(renderedTexts).toContain('发现 1 个待处理媒体');
  });

  it('opens duplicate detail with only the current related group instead of the whole result list', async () => {
    mockLoadPhotoScanResultCache.mockResolvedValueOnce({
      activeCandidates: [
        {
          id: 'duplicate-1',
          asset: {
            id: 'duplicate-1',
            uri: 'file:///duplicate-1.jpg',
            previewUri: 'file:///duplicate-1-preview.jpg',
            mediaType: 'photo',
            width: 1080,
            height: 1440,
            duration: 0,
            fileSize: 680_000,
            creationTime: 1_710_000_000_000,
          },
          score: 91,
          confidence: 'high',
          kind: 'duplicate-photo',
          primaryIssueType: 'duplicate',
          issueTypes: ['duplicate'],
          reasons: ['与其他媒体高度相似'],
          duplicateGroup: {
            groupId: 'duplicate-group-a',
            representativeId: 'keep-best',
            relation: 'exact',
            size: 3,
            similarity: 0.98,
            representativeReason: 'higher-resolution',
            representativeWidth: 3024,
            representativeHeight: 4032,
            representativeFileSize: 4_200_000,
            representativeCreationTime: 1_709_999_000_000,
          },
        },
        {
          id: 'duplicate-2',
          asset: {
            id: 'duplicate-2',
            uri: 'file:///duplicate-2.jpg',
            previewUri: 'file:///duplicate-2-preview.jpg',
            mediaType: 'photo',
            width: 960,
            height: 1280,
            duration: 0,
            fileSize: 520_000,
            creationTime: 1_710_000_100_000,
          },
          score: 88,
          confidence: 'medium',
          kind: 'duplicate-photo',
          primaryIssueType: 'duplicate',
          issueTypes: ['duplicate'],
          reasons: ['与其他媒体高度相似'],
          duplicateGroup: {
            groupId: 'duplicate-group-a',
            representativeId: 'keep-best',
            relation: 'near',
            size: 3,
            similarity: 0.85,
            representativeReason: 'higher-resolution',
            representativeWidth: 3024,
            representativeHeight: 4032,
            representativeFileSize: 4_200_000,
            representativeCreationTime: 1_709_999_000_000,
          },
        },
        {
          id: 'abnormal-1',
          asset: {
            id: 'abnormal-1',
            uri: 'file:///abnormal-1.jpg',
            previewUri: 'file:///abnormal-1-preview.jpg',
            mediaType: 'photo',
            width: 1200,
            height: 1600,
            duration: 0,
            fileSize: 340_000,
            creationTime: 1_710_000_200_000,
          },
          score: 73,
          confidence: 'high',
          kind: 'abnormal-photo',
          primaryIssueType: 'abnormal',
          issueTypes: ['abnormal'],
          reasons: ['缓存命中'],
        },
      ],
      summary: {
        scannedAt: 1_710_000_000_000,
        scannedCount: 3,
        candidateCount: 3,
        highConfidenceCount: 2,
        mediumConfidenceCount: 1,
        recycleBinCount: 0,
      },
    });

    const renderer = await renderScreen();

    await pressByTestId(renderer, 'mock-photo-grid-press-duplicate-1');

    expect(collectRenderedTexts(renderer)).toContain('detail:duplicate-1');
    expect(collectRenderedTexts(renderer)).toContain('detail-scope:2');
    expect(collectRenderedTexts(renderer)).not.toContain('detail-scope:3');
  });

  it('enters selection mode inside the active issue workspace and turns later taps into selection toggles instead of detail opens', async () => {
    mockLoadPhotoScanResultCache.mockResolvedValueOnce({
      activeCandidates: [
        {
          id: 'abnormal-1',
          asset: {
            id: 'abnormal-1',
            uri: 'file:///abnormal-1.jpg',
            previewUri: 'file:///abnormal-1-preview.jpg',
            mediaType: 'photo',
            width: 1200,
            height: 1600,
            duration: 0,
            fileSize: 340_000,
            creationTime: 1_710_000_200_000,
          },
          score: 73,
          confidence: 'high',
          kind: 'abnormal-photo',
          primaryIssueType: 'abnormal',
          issueTypes: ['abnormal'],
          reasons: ['缓存命中'],
        },
        {
          id: 'abnormal-2',
          asset: {
            id: 'abnormal-2',
            uri: 'file:///abnormal-2.jpg',
            previewUri: 'file:///abnormal-2-preview.jpg',
            mediaType: 'photo',
            width: 1160,
            height: 1540,
            duration: 0,
            fileSize: 360_000,
            creationTime: 1_710_000_300_000,
          },
          score: 75,
          confidence: 'high',
          kind: 'abnormal-photo',
          primaryIssueType: 'abnormal',
          issueTypes: ['abnormal'],
          reasons: ['缓存命中'],
        },
      ],
      summary: {
        scannedAt: 1_710_000_000_000,
        scannedCount: 3,
        candidateCount: 2,
        highConfidenceCount: 2,
        mediumConfidenceCount: 0,
        recycleBinCount: 0,
      },
    });

    const renderer = await renderScreen();

    await pressByTestId(renderer, 'photo-grid-result-breakdown-blurry');
    await longPressByTestId(renderer, 'mock-photo-grid-press-abnormal-1');

    expect(collectRenderedTexts(renderer)).toContain('清理所选');
    expect(renderer.root.findAllByProps({ testID: 'mock-detail-screen' })).toHaveLength(0);

    await pressByTestId(renderer, 'mock-photo-grid-press-abnormal-2');

    const renderedTexts = collectRenderedTexts(renderer);

    expect(renderedTexts).toContain('清理所选');
    expect(renderer.root.findAllByProps({ testID: 'mock-detail-screen' })).toHaveLength(0);
  });

  it('lets batch selection reuse the keep action so selected false positives disappear immediately', async () => {
    mockLoadPhotoScanResultCache.mockResolvedValueOnce({
      activeCandidates: [
        {
          id: 'keep-batch-1',
          asset: {
            id: 'keep-batch-1',
            uri: 'file:///keep-batch-1.jpg',
            previewUri: 'file:///keep-batch-1-preview.jpg',
            mediaType: 'photo',
            width: 3024,
            height: 4032,
            duration: 0,
            fileSize: 200_000,
            creationTime: 1_710_000_000_000,
          },
          score: 79,
          confidence: 'high',
          kind: 'abnormal-photo',
          primaryIssueType: 'abnormal',
          issueTypes: ['abnormal'],
          reasons: ['可能误报'],
        },
        {
          id: 'keep-batch-2',
          asset: {
            id: 'keep-batch-2',
            uri: 'file:///keep-batch-2.jpg',
            previewUri: 'file:///keep-batch-2-preview.jpg',
            mediaType: 'photo',
            width: 1440,
            height: 1920,
            duration: 0,
            fileSize: 150_000,
            creationTime: 1_710_000_100_000,
          },
          score: 70,
          confidence: 'medium',
          kind: 'abnormal-photo',
          primaryIssueType: 'abnormal',
          issueTypes: ['abnormal'],
          reasons: ['可能误报'],
        },
      ],
      summary: {
        scannedAt: 1_710_000_000_000,
        scannedCount: 3,
        candidateCount: 2,
        highConfidenceCount: 1,
        mediumConfidenceCount: 1,
        recycleBinCount: 0,
      },
    });
    mockAppendFalsePositiveCandidateIds.mockResolvedValueOnce(['keep-batch-1']);

    const renderer = await renderScreen();

    await pressByTestId(renderer, 'photo-grid-result-breakdown-blurry');
    await longPressByTestId(renderer, 'mock-photo-grid-press-keep-batch-1');

    expect(collectRenderedTexts(renderer)).toContain('保留');

    await pressByTestId(renderer, 'keep-selected-button');

    const renderedTexts = collectRenderedTexts(renderer);

    expect(mockAppendFalsePositiveCandidateIds).toHaveBeenCalledWith(['keep-batch-1']);
    expect(renderedTexts).toContain('grid-count:1');
    expect(renderedTexts).toContain('keep-batch-2');
    expect(renderedTexts).not.toContain('keep-batch-1');
    expect(mockSavePhotoScanResultCache).toHaveBeenLastCalledWith(
      expect.objectContaining({
        activeCandidates: [
          expect.objectContaining({
            id: 'keep-batch-2',
          }),
        ],
        summary: expect.objectContaining({
          candidateCount: 1,
          scannedCount: 3,
        }),
      }),
    );
  });

  it('persists keep-as-false-positive actions so the current candidate disappears immediately', async () => {
    mockLoadPhotoScanResultCache.mockResolvedValueOnce({
      activeCandidates: [
        {
          id: 'kept-candidate',
          asset: {
            id: 'kept-candidate',
            uri: 'file:///kept-candidate.jpg',
            previewUri: 'file:///kept-candidate-preview.jpg',
            mediaType: 'photo',
            width: 3024,
            height: 4032,
            duration: 0,
            fileSize: 200_000,
            creationTime: 1_710_000_000_000,
          },
          score: 79,
          confidence: 'high',
          kind: 'abnormal-photo',
          primaryIssueType: 'abnormal',
          issueTypes: ['abnormal'],
          reasons: ['可能误报'],
        },
        {
          id: 'remaining-candidate',
          asset: {
            id: 'remaining-candidate',
            uri: 'file:///remaining-candidate.jpg',
            previewUri: 'file:///remaining-candidate-preview.jpg',
            mediaType: 'photo',
            width: 1440,
            height: 1920,
            duration: 0,
            fileSize: 150_000,
            creationTime: 1_710_000_100_000,
          },
          score: 70,
          confidence: 'medium',
          kind: 'duplicate-photo',
          primaryIssueType: 'duplicate',
          issueTypes: ['duplicate'],
          reasons: ['与其他媒体高度相似'],
        },
      ],
      summary: {
        scannedAt: 1_710_000_000_000,
        scannedCount: 3,
        candidateCount: 2,
        highConfidenceCount: 1,
        mediumConfidenceCount: 1,
        recycleBinCount: 0,
      },
    });
    mockAppendFalsePositiveCandidateIds.mockResolvedValueOnce(['kept-candidate']);

    const renderer = await renderScreen();

    await pressByTestId(renderer, 'mock-photo-grid-press-kept-candidate');
    expect(collectRenderedTexts(renderer)).toContain('detail:kept-candidate');

    await pressByTestId(renderer, 'mock-detail-keep');

    const renderedTexts = collectRenderedTexts(renderer);

    expect(mockAppendFalsePositiveCandidateIds).toHaveBeenCalledWith(['kept-candidate']);
    expect(renderedTexts).toContain('grid-count:1');
    expect(renderedTexts).toContain('remaining-candidate');
    expect(renderedTexts).not.toContain('kept-candidate');
    expect(mockSavePhotoScanResultCache).toHaveBeenLastCalledWith(
      expect.objectContaining({
        activeCandidates: [
          expect.objectContaining({
            id: 'remaining-candidate',
          }),
        ],
        summary: expect.objectContaining({
          candidateCount: 1,
          scannedCount: 3,
        }),
      }),
    );
  });

  it('keeps detail open on the remaining related candidate after clearing the current duplicate item', async () => {
    mockLoadPhotoScanResultCache.mockResolvedValueOnce({
      activeCandidates: [
        {
          id: 'duplicate-1',
          asset: {
            id: 'duplicate-1',
            uri: 'file:///duplicate-1.jpg',
            previewUri: 'file:///duplicate-1-preview.jpg',
            mediaType: 'photo',
            width: 1080,
            height: 1440,
            duration: 0,
            fileSize: 680_000,
            creationTime: 1_710_000_000_000,
          },
          score: 91,
          confidence: 'high',
          kind: 'duplicate-photo',
          primaryIssueType: 'duplicate',
          issueTypes: ['duplicate'],
          reasons: ['与其他媒体高度相似'],
          duplicateGroup: {
            groupId: 'duplicate-group-a',
            representativeId: 'keep-best',
            relation: 'exact',
            size: 3,
            similarity: 0.98,
            representativeReason: 'higher-resolution',
            representativeWidth: 3024,
            representativeHeight: 4032,
            representativeFileSize: 4_200_000,
            representativeCreationTime: 1_709_999_000_000,
          },
        },
        {
          id: 'duplicate-2',
          asset: {
            id: 'duplicate-2',
            uri: 'file:///duplicate-2.jpg',
            previewUri: 'file:///duplicate-2-preview.jpg',
            mediaType: 'photo',
            width: 960,
            height: 1280,
            duration: 0,
            fileSize: 520_000,
            creationTime: 1_710_000_100_000,
          },
          score: 88,
          confidence: 'medium',
          kind: 'duplicate-photo',
          primaryIssueType: 'duplicate',
          issueTypes: ['duplicate'],
          reasons: ['与其他媒体高度相似'],
          duplicateGroup: {
            groupId: 'duplicate-group-a',
            representativeId: 'keep-best',
            relation: 'exact',
            size: 3,
            similarity: 0.98,
            representativeReason: 'higher-resolution',
            representativeWidth: 3024,
            representativeHeight: 4032,
            representativeFileSize: 4_200_000,
            representativeCreationTime: 1_709_999_000_000,
          },
        },
        {
          id: 'abnormal-1',
          asset: {
            id: 'abnormal-1',
            uri: 'file:///abnormal-1.jpg',
            previewUri: 'file:///abnormal-1-preview.jpg',
            mediaType: 'photo',
            width: 1200,
            height: 1600,
            duration: 0,
            fileSize: 340_000,
            creationTime: 1_710_000_200_000,
          },
          score: 73,
          confidence: 'high',
          kind: 'abnormal-photo',
          primaryIssueType: 'abnormal',
          issueTypes: ['abnormal'],
          reasons: ['缓存命中'],
        },
      ],
      summary: {
        scannedAt: 1_710_000_000_000,
        scannedCount: 3,
        candidateCount: 3,
        highConfidenceCount: 2,
        mediumConfidenceCount: 1,
        recycleBinCount: 0,
      },
    });

    const renderer = await renderScreen();

    await pressByTestId(renderer, 'mock-photo-grid-press-duplicate-1');
    expect(collectRenderedTexts(renderer)).toContain('detail:duplicate-1');
    expect(collectRenderedTexts(renderer)).toContain('detail-scope:2');

    await pressByTestId(renderer, 'mock-detail-primary');

    const renderedTexts = collectRenderedTexts(renderer);

    expect(renderedTexts).toContain('detail:duplicate-2');
    expect(renderedTexts).toContain('detail-scope:1');
    expect(renderer.root.findAllByProps({ testID: 'mock-detail-screen' })).toHaveLength(1);
    expect(renderedTexts).not.toContain('detail:duplicate-1');
    expect(mockSaveRecycleBinIds).toHaveBeenCalledWith(['duplicate-1']);
    expect(mockSavePhotoScanResultCache).toHaveBeenLastCalledWith(
      expect.objectContaining({
        activeCandidates: [
          expect.objectContaining({
            id: 'duplicate-2',
          }),
          expect.objectContaining({
            id: 'abnormal-1',
          }),
        ],
        summary: expect.objectContaining({
          candidateCount: 2,
          scannedCount: 3,
        }),
      }),
    );
  });

  it('appends newly cleaned scan results to an existing recycle bin without replacing the prior items', async () => {
    const existingRecycleBin = Array.from({ length: 9 }, (_, index) =>
      createCleanupCandidate(`recycle-${index + 1}`),
    );
    const newFirst = createCleanupCandidate('new-cleanup-1');
    const newSecond = createCleanupCandidate('new-cleanup-2');
    const existingRecycleBinIds = existingRecycleBin.map((candidate) => candidate.id);
    const onRecycleBinIdsChange = vi.fn();

    mockLoadRecycleBinCandidateCache.mockResolvedValueOnce(existingRecycleBin);
    mockLoadPhotoScanResultCache.mockResolvedValueOnce({
      activeCandidates: [newFirst, newSecond],
      summary: {
        scannedAt: 1_710_000_000_000,
        scannedCount: 11,
        candidateCount: 2,
        highConfidenceCount: 2,
        mediumConfidenceCount: 0,
        recycleBinCount: existingRecycleBin.length,
      },
    });

    const renderer = await renderScreen({
      recycleBinIds: existingRecycleBinIds,
      onRecycleBinIdsChange,
    });

    await longPressByTestId(renderer, 'mock-photo-grid-press-new-cleanup-1');
    await pressByTestId(renderer, 'mock-photo-grid-press-new-cleanup-2');
    await pressByTestId(renderer, 'cleanup-selected-button');

    const expectedRecycleBinIds = [...existingRecycleBinIds, newFirst.id, newSecond.id];

    expect(mockSaveRecycleBinIds).toHaveBeenCalledWith(expectedRecycleBinIds);
    expect(onRecycleBinIdsChange).toHaveBeenCalledWith(expectedRecycleBinIds);
    expect(mockSaveRecycleBinCandidateCache).toHaveBeenCalledWith(
      expectedRecycleBinIds.map((id) => expect.objectContaining({ id })),
    );
  });

  it('toggles select all and deselect all for the current visible photo-grid selection mode', async () => {
    mockLoadPhotoScanResultCache.mockResolvedValueOnce({
      activeCandidates: [
        createCleanupCandidate('select-all-1'),
        createCleanupCandidate('select-all-2'),
        createCleanupCandidate('select-all-3', 'video'),
      ],
      summary: {
        scannedAt: 1_710_000_000_000,
        scannedCount: 3,
        candidateCount: 3,
        highConfidenceCount: 3,
        mediumConfidenceCount: 0,
        recycleBinCount: 0,
      },
    });

    const renderer = await renderScreen();

    await pressByTestId(renderer, 'photo-grid-result-breakdown-blurry');
    await longPressByTestId(renderer, 'mock-photo-grid-press-select-all-1');
    expect(collectRenderedTexts(renderer)).toContain('清理所选');
    expect(collectRenderedTexts(renderer)).toContain('全选');

    await pressByTestId(renderer, 'photo-selection-toggle-button');

    let renderedTexts = collectRenderedTexts(renderer);
    expect(renderedTexts).toContain('清理所选');
    expect(renderedTexts).toContain('保留');
    expect(renderedTexts).toContain('全不选');

    await pressByTestId(renderer, 'photo-selection-toggle-button');

    renderedTexts = collectRenderedTexts(renderer);
    expect(renderedTexts).toContain('全选');
    expect(() => renderer.root.findByProps({ testID: 'cleanup-selected-button' })).not.toThrow();
    expect(() => renderer.root.findByProps({ testID: 'keep-selected-button' })).not.toThrow();
    expect(() => renderer.root.findByProps({ testID: 'photo-selection-toggle-button' })).not.toThrow();
  });

  it('keeps swipe batch selection in selection mode and updates the workspace count', async () => {
    mockLoadPhotoScanResultCache.mockResolvedValueOnce({
      activeCandidates: [
        createCleanupCandidate('swipe-select-1'),
        createCleanupCandidate('swipe-select-2'),
        createCleanupCandidate('swipe-select-3'),
      ],
      summary: {
        scannedAt: 1_710_000_000_000,
        scannedCount: 3,
        candidateCount: 3,
        highConfidenceCount: 3,
        mediumConfidenceCount: 0,
        recycleBinCount: 0,
      },
    });

    const renderer = await renderScreen();

    await pressByTestId(renderer, 'photo-grid-result-breakdown-blurry');
    await pressByTestId(renderer, 'mock-photo-grid-swipe-select-first-two');

    const renderedTexts = collectRenderedTexts(renderer);
    expect(renderedTexts).toContain('已选 2 项');
    expect(renderedTexts).toContain('全选');
    expect(renderer.root.findByProps({ testID: 'mock-photo-grid-selected-count' }).props.children).toBe('selected-count:2');
    expect(() => renderer.root.findByProps({ testID: 'cleanup-selected-button' })).not.toThrow();
    expect(() => renderer.root.findByProps({ testID: 'keep-selected-button' })).not.toThrow();
  });

  it('retains zero-count issue categories after cleaning the final full-batch results', async () => {
    const now = Date.UTC(2026, 4, 4, 0, 0, 0);
    const rollingRangeStartAt = buildScanRangeStartAt(12, now);
    mockLoadPhotoScanResultCache.mockResolvedValueOnce({
      activeCandidates: [
        {
          ...createCleanupCandidate('duplicate-final-1'),
          duplicateGroup: {
            groupId: 'duplicate-final-group',
            representativeId: 'duplicate-final-1',
            relation: 'exact',
            size: 2,
            similarity: 1,
            representativeReason: 'higher-resolution',
            representativeWidth: 3024,
            representativeHeight: 4032,
            representativeFileSize: 280_000,
            representativeCreationTime: 1_710_000_000_000,
          },
        },
        {
          ...createCleanupCandidate('duplicate-final-2'),
          duplicateGroup: {
            groupId: 'duplicate-final-group',
            representativeId: 'duplicate-final-1',
            relation: 'exact',
            size: 2,
            similarity: 1,
            representativeReason: 'higher-resolution',
            representativeWidth: 3024,
            representativeHeight: 4032,
            representativeFileSize: 280_000,
            representativeCreationTime: 1_710_000_000_000,
          },
        },
      ],
      summary: {
        scannedAt: now,
        scannedCount: 5,
        candidateCount: 2,
        highConfidenceCount: 2,
        mediumConfidenceCount: 0,
        recycleBinCount: 0,
      },
    });
    mockLoadLatestCompletedPhotoScanBatch.mockResolvedValueOnce({
      batchId: 'batch-full-final',
      mode: 'full',
      phase: 'completed',
      windowDays: Math.round((now - rollingRangeStartAt) / DAY_MS),
      rangeStartAt: rollingRangeStartAt,
      rangeEndAt: now,
      progressCurrent: 5,
      progressTotal: 5,
      enumeratedCount: 5,
      dirtyCount: 5,
      analyzedCount: 5,
      candidateCount: 2,
      startedAt: now,
      lastHeartbeatAt: now,
      completedAt: now,
      lastError: null,
      updatedAt: now,
    });

    const renderer = await renderScreen();

    await pressByTestId(renderer, 'photo-grid-result-breakdown-blurry');
    await longPressByTestId(renderer, 'mock-photo-grid-press-duplicate-final-1');
    await pressByTestId(renderer, 'photo-selection-toggle-button');
    await pressByTestId(renderer, 'cleanup-selected-button');

    let renderedTexts = collectRenderedTexts(renderer);
    expect(renderedTexts).toContain('模糊照片 (0)');
    expect(renderedTexts).toContain('暂无该类型媒体');
    expect(renderer.root.findAllByProps({ testID: 'photo-grid-issue-empty-state' })).toHaveLength(1);
    expect(renderer.root.findAllByProps({ testID: 'photo-grid-scan-all-complete-state' })).toHaveLength(0);

    await pressByTestId(renderer, 'photo-grid-back-button');

    renderedTexts = collectRenderedTexts(renderer);
    expect(renderer.root.findAllByProps({ testID: 'photo-grid-result-breakdown-blurry' })).toHaveLength(1);
    expect(renderer.root.findAllByProps({ testID: 'photo-grid-result-breakdown-duplicate' })).toHaveLength(1);
    expect(renderer.root.findAllByProps({ testID: 'photo-grid-result-breakdown-similar' })).toHaveLength(1);
    expect(renderedTexts).toContain('模糊照片');
    expect(renderedTexts).toContain('重复照片');
    expect(renderedTexts).toContain('相似照片');
    expect(renderedTexts.filter((text: string) => text === '0 项')).toHaveLength(3);
    expect(renderedTexts).toContain(appPreferencesState.copy.screens.photoGrid.scanAllCompleteTitle);
    expect(renderedTexts).toContain(appPreferencesState.copy.screens.photoGrid.scanAllCompleteBody);
    expect(renderedTexts).not.toContain(appPreferencesState.copy.screens.photoGrid.continueScan);
    expect(renderer.root.findAllByProps({ testID: 'photo-grid-start-scan-button' })).toHaveLength(0);

    await pressByTestId(renderer, 'photo-grid-result-breakdown-blurry');

    renderedTexts = collectRenderedTexts(renderer);
    expect(renderedTexts).toContain('模糊照片 (0)');
    expect(renderedTexts).toContain('暂无该类型媒体');
    expect(mockSavePhotoScanResultCache).toHaveBeenLastCalledWith(
      expect.objectContaining({
        activeCandidates: [],
        summary: expect.objectContaining({
          candidateCount: 0,
          scannedCount: 5,
        }),
      }),
    );
  });

  it('filters persisted false-positive media out of fresh scan results before showing them', async () => {
    mockLoadFalsePositiveCandidateIds.mockResolvedValue(['scan-hidden']);
    mockLoadRecycleBinIds.mockResolvedValueOnce(['recycle-1']);
    mockScanMediaLibrary.mockResolvedValueOnce({
      state: {
        activeCandidates: [
          {
            id: 'scan-hidden',
            asset: {
              id: 'scan-hidden',
              uri: 'file:///scan-hidden.jpg',
              previewUri: 'file:///scan-hidden-preview.jpg',
              mediaType: 'photo',
              width: 1280,
              height: 1700,
              duration: 0,
              fileSize: 150_000,
              creationTime: 1_710_000_000_000,
            },
            score: 71,
            confidence: 'medium',
            kind: 'abnormal-photo',
            primaryIssueType: 'abnormal',
            issueTypes: ['abnormal'],
            reasons: ['误报已保留'],
          },
          {
            id: 'scan-visible',
            asset: {
              id: 'scan-visible',
              uri: 'file:///scan-visible.jpg',
              previewUri: 'file:///scan-visible-preview.jpg',
              mediaType: 'photo',
              width: 1280,
              height: 1700,
              duration: 0,
              fileSize: 190_000,
              creationTime: 1_710_000_100_000,
            },
            score: 88,
            confidence: 'high',
            kind: 'abnormal-photo',
            primaryIssueType: 'abnormal',
            issueTypes: ['abnormal'],
            reasons: ['新扫描命中'],
          },
        ],
        recycleBin: [],
        selectedIds: [],
      },
      summary: {
        scannedAt: 1_710_000_000_000,
        scannedCount: 2,
        candidateCount: 2,
        highConfidenceCount: 1,
        mediumConfidenceCount: 1,
        recycleBinCount: 0,
      },
    });

    const renderer = await renderScreen();

    await pressPrimaryButton(renderer);

    const renderedTexts = collectRenderedTexts(renderer);

    expect(renderedTexts).toContain('grid-count:1');
    expect(renderedTexts).toContain('scan-visible');
    expect(renderedTexts).not.toContain('scan-hidden');
    expect(mockSavePhotoScanResultCache).toHaveBeenLastCalledWith(
      expect.objectContaining({
        activeCandidates: [
          expect.objectContaining({
            id: 'scan-visible',
          }),
        ],
        summary: expect.objectContaining({
          candidateCount: 1,
          scannedCount: 2,
        }),
      }),
    );
  });

  it('cleans the whole duplicate candidate group when one duplicate is selected directly from the grid', async () => {
    mockLoadPhotoScanResultCache.mockResolvedValueOnce({
      activeCandidates: [
        {
          id: 'duplicate-1',
          asset: {
            id: 'duplicate-1',
            uri: 'file:///duplicate-1.jpg',
            previewUri: 'file:///duplicate-1-preview.jpg',
            mediaType: 'photo',
            width: 1080,
            height: 1440,
            duration: 0,
            fileSize: 680_000,
            creationTime: 1_710_000_000_000,
          },
          score: 91,
          confidence: 'high',
          kind: 'duplicate-photo',
          primaryIssueType: 'duplicate',
          issueTypes: ['duplicate'],
          reasons: ['与其他媒体高度相似'],
          duplicateGroup: {
            groupId: 'duplicate-group-a',
            representativeId: 'keep-best',
            relation: 'exact',
            size: 3,
            similarity: 0.98,
            representativeReason: 'higher-resolution',
            representativeWidth: 3024,
            representativeHeight: 4032,
            representativeFileSize: 4_200_000,
            representativeCreationTime: 1_709_999_000_000,
          },
        },
        {
          id: 'duplicate-2',
          asset: {
            id: 'duplicate-2',
            uri: 'file:///duplicate-2.jpg',
            previewUri: 'file:///duplicate-2-preview.jpg',
            mediaType: 'photo',
            width: 960,
            height: 1280,
            duration: 0,
            fileSize: 520_000,
            creationTime: 1_710_000_100_000,
          },
          score: 88,
          confidence: 'medium',
          kind: 'duplicate-photo',
          primaryIssueType: 'duplicate',
          issueTypes: ['duplicate'],
          reasons: ['与其他媒体高度相似'],
          duplicateGroup: {
            groupId: 'duplicate-group-a',
            representativeId: 'keep-best',
            relation: 'exact',
            size: 3,
            similarity: 0.98,
            representativeReason: 'higher-resolution',
            representativeWidth: 3024,
            representativeHeight: 4032,
            representativeFileSize: 4_200_000,
            representativeCreationTime: 1_709_999_000_000,
          },
        },
        {
          id: 'abnormal-1',
          asset: {
            id: 'abnormal-1',
            uri: 'file:///abnormal-1.jpg',
            previewUri: 'file:///abnormal-1-preview.jpg',
            mediaType: 'photo',
            width: 1200,
            height: 1600,
            duration: 0,
            fileSize: 340_000,
            creationTime: 1_710_000_200_000,
          },
          score: 73,
          confidence: 'high',
          kind: 'abnormal-photo',
          primaryIssueType: 'abnormal',
          issueTypes: ['abnormal'],
          reasons: ['缓存命中'],
        },
      ],
      summary: {
        scannedAt: 1_710_000_000_000,
        scannedCount: 3,
        candidateCount: 3,
        highConfidenceCount: 2,
        mediumConfidenceCount: 1,
        recycleBinCount: 0,
      },
    });

    const renderer = await renderScreen();

    expect(collectRenderedTexts(renderer)).toContain('grid-count:3');

    await pressByTestId(renderer, 'photo-grid-result-breakdown-duplicate');
    await longPressByTestId(renderer, 'mock-photo-grid-press-duplicate-1');
    expect(collectRenderedTexts(renderer)).toContain('清理所选');

    await pressByTestId(renderer, 'cleanup-selected-button');

    const renderedTexts = collectRenderedTexts(renderer);

    expect(renderedTexts).toContain('重复照片 (0)');
    expect(renderedTexts).toContain('暂无该类型媒体');
    expect(renderedTexts).not.toContain('abnormal-1');
    expect(renderedTexts).not.toContain('duplicate-1');
    expect(renderedTexts).not.toContain('duplicate-2');
    expect(renderer.root.findAllByProps({ testID: 'photo-grid-issue-empty-state' })).toHaveLength(1);
    expect(mockSavePhotoScanResultCache).toHaveBeenCalledWith(
      expect.objectContaining({
        activeCandidates: [
          expect.objectContaining({
            id: 'abnormal-1',
          }),
        ],
        summary: expect.objectContaining({
          candidateCount: 1,
          scannedCount: 3,
        }),
      }),
    );
  });

  it('retains zero-count issue categories and offers continue scan when older batches remain', async () => {
    const now = Date.UTC(2026, 4, 4, 0, 0, 0);
    const duplicateGroup = {
      groupId: 'continue-scan-group',
      representativeId: 'continue-final-1',
      relation: 'exact' as const,
      size: 2,
      similarity: 1,
      representativeReason: 'higher-resolution' as const,
      representativeWidth: 3024,
      representativeHeight: 4032,
      representativeFileSize: 280_000,
      representativeCreationTime: 1_710_000_000_000,
    };
    const candidates = [
      {
        ...createCleanupCandidate('continue-final-1'),
        kind: 'duplicate-photo',
        primaryIssueType: 'duplicate',
        issueTypes: ['duplicate'],
        duplicateGroup,
      },
      {
        ...createCleanupCandidate('continue-final-2'),
        kind: 'duplicate-photo',
        primaryIssueType: 'duplicate',
        issueTypes: ['duplicate'],
        duplicateGroup,
      },
    ];
    photoScanSessionRuntimeApi.stagePhotoScanSessionRuntimeSnapshot({
      permissionState: 'granted',
      phase: 'completed',
      authorizedCandidates: candidates,
      visibleCandidates: candidates,
      scanResultsCount: 2,
      scanProgress: {
        current: 2,
        total: 2,
        currentFileName: null,
      },
      scanScopeSelection: {
        total: 2,
        photo: 2,
        video: 0,
      },
      summary: {
        scannedAt: now,
        scannedCount: 2,
        recycleBinCount: 0,
      },
      hasCompletedFullScan: false,
      errorMessage: null,
      updatedAt: now,
    });

    const renderer = await renderScreen();

    await pressByTestId(renderer, 'photo-grid-result-breakdown-duplicate');
    await longPressByTestId(renderer, 'mock-photo-grid-press-continue-final-1');
    await pressByTestId(renderer, 'cleanup-selected-button');

    let renderedTexts = collectRenderedTexts(renderer);
    expect(renderedTexts).toContain('重复照片 (0)');
    expect(renderedTexts).toContain('暂无该类型媒体');

    await pressByTestId(renderer, 'photo-grid-back-button');

    renderedTexts = collectRenderedTexts(renderer);
    expect(renderedTexts.filter((text: string) => text === '0 项')).toHaveLength(3);
    expect(renderedTexts).toContain(appPreferencesState.copy.screens.photoGrid.scanExhaustedTitle);
    expect(renderedTexts).toContain(appPreferencesState.copy.screens.photoGrid.scanExhaustedBody);
    expect(renderedTexts).toContain(appPreferencesState.copy.screens.photoGrid.continueScan);
    expect(renderer.root.findAllByProps({ testID: 'photo-grid-start-scan-button' })).toHaveLength(1);
    expect(renderedTexts).not.toContain(appPreferencesState.copy.screens.photoGrid.scanAllCompleteTitle);
  });
});
