import { beforeEach, describe, expect, it, vi } from 'vitest';
import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';

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
  loadFalsePositiveCandidateIds: vi.fn(),
  loadRecycleBinIds: vi.fn(),
  loadRecycleBinCandidateCache: vi.fn(),
  loadPhotoScanResultCache: vi.fn(),
  saveRecycleBinIds: vi.fn(),
  saveRecycleBinCandidateCache: vi.fn(),
  savePhotoScanResultCache: vi.fn(),
  clearPhotoScanResultCache: vi.fn(),
  saveLastScanMeta: vi.fn(),
}));

const scanApi = vi.hoisted(() => ({
  DEFAULT_SCAN_LIMIT: 360,
  ACTIONABLE_SCAN_THRESHOLD: 55,
  scanMediaLibrary: vi.fn(),
}));

const notificationApi = vi.hoisted(() => ({
  notifyScanCompletionIfNeeded: vi.fn(),
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
    screens: {
      photoGrid: {
        filterAll: '全部',
        filterPhoto: '照片',
        filterVideo: '视频',
        permissionChecking: '正在检查权限...',
        scanPromptTitle: '准备开始扫描',
        scanPromptBody: '授权后即可在本地扫描最近媒体，找出可清理内容。',
        startScan: '开始扫描',
        scanScopeSummary: (count: number) => `已选择 ${count} 个媒体`,
        scanScopeHint: '默认扫描最近媒体，尽量把空间留给下方展示区。',
        scanProgressTitle: '扫描流水线',
        scanProgressValue: (current: number, total: number) => `${current}/${total}`,
        scanProgressFootnote: '识别中的异常媒体会持续写入下方列表。',
        scanCompleteTitle: '扫描完成',
        scanExhaustedTitle: '当前这一批已处理完成',
        scanExhaustedBody: '可以继续扫描最近媒体，或等待新的媒体进入这一批范围。',
        scanResultSummary: (count: number) => `发现 ${count} 个异常媒体`,
        scanResultFootnote: '结果已留在当前页面，可直接继续筛选和清理。',
        continueScan: '继续扫描',
        selectedItems: (count: number) => `已选 ${count} 项`,
        cleanupSelected: '清理所选',
        keepSelected: '保留',
      },
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
vi.mock('../../../services/notifications/scan-completion-notifications', () => notificationApi);
vi.mock('../../components/PhotoGrid', () => ({
  PhotoGrid: ({
    candidates,
    selectionMode,
    mediaType,
    onItemPress,
    onSelect,
  }: {
    candidates: Array<{ id: string; asset?: { mediaType?: string } }>;
    selectionMode?: boolean;
    mediaType: 'all' | 'photo' | 'video';
    onItemPress: (candidate: { id: string; asset?: { mediaType?: string } }) => void;
    onSelect: (id: string) => void;
  }) => {
    const filteredCandidates =
      mediaType === 'all'
        ? candidates
        : candidates.filter((candidate) => candidate.asset?.mediaType === mediaType);

    return React.createElement(
      'View',
      { testID: 'mock-photo-grid' },
      React.createElement('Text', null, `grid-count:${filteredCandidates.length}`),
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
vi.mock('/Users/jt/places/personal/app-cleaner/src/ui/screens/DetailScreen', () => {
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
        ? React.createElement('Text', null, `发现 ${resultsCount} 个异常媒体`)
        : null,
    ),
}));

import { getAppCopy } from '../../../i18n/app-copy';
import { PhotoGridScreen } from '../PhotoGridScreen';
import {
  buildFilterWrapInsets,
  buildFloatingActionBarInsets,
  buildPhotoGridContentPadding,
  buildPhotoGridEntryCopy,
  buildPhotoGridEntryInsets,
  buildPhotoGridFilterOptions,
  buildPhotoGridScopeBreakdown,
  buildPhotoGridTabOptions,
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
const mockSaveRecycleBinIds = vi.mocked(storageApi.saveRecycleBinIds);
const mockSaveRecycleBinCandidateCache = vi.mocked(storageApi.saveRecycleBinCandidateCache);
const mockSavePhotoScanResultCache = vi.mocked(storageApi.savePhotoScanResultCache);
const mockSaveLastScanMeta = vi.mocked(storageApi.saveLastScanMeta);
const mockScanMediaLibrary = vi.mocked(scanApi.scanMediaLibrary);
const mockNotifyScanCompletionIfNeeded = vi.mocked(notificationApi.notifyScanCompletionIfNeeded);
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

async function flushPromises() {
  await Promise.resolve();
  await Promise.resolve();
}

async function renderScreen() {
  let renderer: ReturnType<typeof ReactTestRenderer.create>;

  await act(async () => {
    renderer = ReactTestRenderer.create(<PhotoGridScreen />);
    await flushPromises();
  });

  return renderer!;
}

async function pressPrimaryButton(renderer: ReturnType<typeof ReactTestRenderer.create>) {
  const button = renderer.root.findAllByType('Pressable')[0];

  await act(async () => {
    await button.props.onPress();
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

describe('PhotoGridScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
    mockAppendFalsePositiveCandidateIds.mockImplementation(async (ids) => [...new Set(ids)].sort());
    mockSaveRecycleBinIds.mockResolvedValue(undefined);
    mockSaveRecycleBinCandidateCache.mockResolvedValue(undefined);
    mockSavePhotoScanResultCache.mockResolvedValue(undefined);
    mockSaveLastScanMeta.mockResolvedValue(undefined);
    mockNotifyScanCompletionIfNeeded.mockResolvedValue(true);
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

  it('prompts for permission first and only shows the scan CTA after access is granted', async () => {
    mockGetPermissionsAsync.mockResolvedValue({ granted: false });
    mockRequestPermissionsAsync.mockResolvedValueOnce({ granted: true });

    const renderer = await renderScreen();

    expect(collectRenderedTexts(renderer)).toContain(appPreferencesState.copy.permission.title);
    expect(collectRenderedTexts(renderer)).not.toContain(
      appPreferencesState.copy.screens.photoGrid.scanPromptTitle,
    );

    await pressPrimaryButton(renderer);

    expect(mockRequestPermissionsAsync).toHaveBeenCalledWith(false, ['photo', 'video']);
    expect(mockGetAssetsAsync).toHaveBeenCalled();
    expect(collectRenderedTexts(renderer)).toContain('已选择 3 个媒体');
    expect(collectRenderedTexts(renderer)).not.toContain(
      appPreferencesState.copy.screens.photoGrid.scanPromptBody,
    );
    expect(renderer.root.findAllByProps({ testID: 'photo-grid-scope-breakdown' })).toHaveLength(0);
    expect(collectRenderedTexts(renderer)).toContain('全部 3');
    expect(collectRenderedTexts(renderer)).toContain('照片 2');
    expect(collectRenderedTexts(renderer)).toContain('视频 1');
    expect(collectRenderedTexts(renderer)).toContain('grid-count:3');
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

    expect(renderer.root.findAllByProps({ testID: 'photo-grid-inline-progress' })).toHaveLength(1);
    expect(renderer.root.findAllByProps({ testID: 'photo-grid-loading-overlay' })).toHaveLength(0);
    expect(renderer.root.findAllByProps({ testID: 'photo-grid-scope-breakdown' })).toHaveLength(0);
    expect(renderedTexts).toContain('发现 1 个异常媒体');
    expect(renderedTexts).toContain(appPreferencesState.copy.screens.photoGrid.scanCompleteTitle);
    expect(renderedTexts).toContain('全部 1');
    expect(renderedTexts).toContain('照片 1');
    expect(renderedTexts).toContain('视频 0');
    expect(renderedTexts).toContain('grid-count:1');
    expect(renderedTexts).not.toContain('IMG_001.jpg');
    expect(renderedTexts).not.toContain('IMG_002.jpg');
    expect(mockSavePhotoScanResultCache).toHaveBeenCalledTimes(1);
    expect(mockSaveLastScanMeta).toHaveBeenCalledTimes(1);
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
    expect(renderer.root.findByProps({ testID: 'photo-grid-loading-overlay' }).props.pointerEvents).toBe('auto');
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
    expect(renderedTexts).toContain('扫描完成');
    expect(renderedTexts).toContain('全部 1');
    expect(renderedTexts).toContain('照片 1');
    expect(renderedTexts).toContain('视频 0');
    expect(renderedTexts).toContain('grid-count:1');
  });

  it('shows the continue-scan empty state after a scan finishes with no remaining flagged media', async () => {
    const renderer = await renderScreen();

    await pressPrimaryButton(renderer);

    const renderedTexts = collectRenderedTexts(renderer);

    expect(renderedTexts).toContain(appPreferencesState.copy.screens.photoGrid.scanExhaustedTitle);
    expect(renderedTexts).toContain(appPreferencesState.copy.screens.photoGrid.scanExhaustedBody);
    expect(renderedTexts).toContain(appPreferencesState.copy.screens.photoGrid.continueScan);
    expect(renderedTexts).not.toContain('发现 0 个异常媒体');
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
    expect(renderedTexts).toContain('发现 1 个异常媒体');
    expect(renderedTexts).toContain('全部 1');
    expect(renderedTexts).toContain('照片 1');
    expect(renderedTexts).toContain('视频 0');
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
    expect(renderedTexts).toContain('全部 1');
    expect(renderedTexts).toContain('照片 1');
    expect(renderedTexts).toContain('视频 0');
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

  it('enters selection mode on long press and turns later taps into selection toggles instead of detail opens', async () => {
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
        scannedCount: 2,
        candidateCount: 2,
        highConfidenceCount: 2,
        mediumConfidenceCount: 0,
        recycleBinCount: 0,
      },
    });

    const renderer = await renderScreen();

    await longPressByTestId(renderer, 'mock-photo-grid-press-duplicate-1');

    expect(collectRenderedTexts(renderer)).toContain('清理所选 (1)');
    expect(renderer.root.findAllByProps({ testID: 'mock-detail-screen' })).toHaveLength(0);

    await pressByTestId(renderer, 'mock-photo-grid-press-abnormal-1');

    const renderedTexts = collectRenderedTexts(renderer);

    expect(renderedTexts).toContain('清理所选 (2)');
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
          kind: 'duplicate-photo',
          primaryIssueType: 'duplicate',
          issueTypes: ['duplicate'],
          reasons: ['与其他媒体高度相似'],
        },
      ],
      summary: {
        scannedAt: 1_710_000_000_000,
        scannedCount: 2,
        candidateCount: 2,
        highConfidenceCount: 1,
        mediumConfidenceCount: 1,
        recycleBinCount: 0,
      },
    });
    mockAppendFalsePositiveCandidateIds.mockResolvedValueOnce(['keep-batch-1']);

    const renderer = await renderScreen();

    await longPressByTestId(renderer, 'mock-photo-grid-press-keep-batch-1');

    expect(collectRenderedTexts(renderer)).toContain('保留 (1)');

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
          scannedCount: 2,
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
        scannedCount: 2,
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
          scannedCount: 2,
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

    await longPressByTestId(renderer, 'mock-photo-grid-press-duplicate-1');
    expect(collectRenderedTexts(renderer)).toContain('清理所选 (1)');

    await pressByTestId(renderer, 'cleanup-selected-button');

    const renderedTexts = collectRenderedTexts(renderer);

    expect(renderedTexts).toContain('grid-count:1');
    expect(renderedTexts).toContain('abnormal-1');
    expect(renderedTexts).not.toContain('duplicate-1');
    expect(renderedTexts).not.toContain('duplicate-2');
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
});
