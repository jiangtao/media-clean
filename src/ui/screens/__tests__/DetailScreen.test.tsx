import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { CleanupCandidate } from '../../../domain/recognition/types';
import { getAppTheme } from '../../../theme/app-theme';
import { DetailScreen } from '../DetailScreen';

vi.mock('react-native', () => ({
  View: 'View',
  Text: 'Text',
  Pressable: 'Pressable',
  ScrollView: 'ScrollView',
  StyleSheet: {
    create: (styles: Record<string, unknown>) => styles,
  },
  Dimensions: {
    get: () => ({ width: 390, height: 844 }),
  },
  PixelRatio: {
    get: () => 3,
  },
}));

vi.mock('expo-image', () => ({
  Image: 'Image',
}));

vi.mock('@expo/vector-icons', () => ({
  Ionicons: ({ name, testID }: { name: string; testID?: string }) =>
    React.createElement('Text', { testID }, name),
}));

vi.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 32, bottom: 12, left: 8, right: 8 }),
}));

vi.mock('../../components/VideoPlayer', () => ({
  VideoPlayer: () => React.createElement('View', { testID: 'mock-video-player' }),
}));

const theme = getAppTheme('light');

const duplicateCandidate: CleanupCandidate = {
  id: 'duplicate-item',
  asset: {
    id: 'duplicate-item',
    uri: 'file:///duplicate-item.jpg',
    previewUri: 'file:///duplicate-item-preview.jpg',
    mediaType: 'photo',
    width: 1080,
    height: 1440,
    duration: 0,
    fileSize: 680_000,
    creationTime: new Date('2026-04-16T08:00:00+08:00').getTime(),
  },
  score: 91,
  confidence: 'high',
  kind: 'duplicate-photo',
  primaryIssueType: 'duplicate',
  issueTypes: ['duplicate', 'abnormal'],
  reasons: ['与其他媒体高度相似', '已保留一份更高质量副本'],
  duplicateGroup: {
    groupId: 'duplicate-a-b-c',
    representativeId: 'keep-best',
    relation: 'exact',
    size: 3,
    similarity: 0.98,
    representativeReason: 'higher-resolution',
    representativeWidth: 3024,
    representativeHeight: 4032,
    representativeFileSize: 4_200_000,
    representativeCreationTime: new Date('2026-04-15T08:00:00+08:00').getTime(),
  },
};

const duplicateSiblingCandidate: CleanupCandidate = {
  ...duplicateCandidate,
  id: 'duplicate-item-2',
  asset: {
    ...duplicateCandidate.asset,
    id: 'duplicate-item-2',
    uri: 'file:///duplicate-item-2.jpg',
    previewUri: 'file:///duplicate-item-2-preview.jpg',
    width: 960,
    height: 1280,
    fileSize: 520_000,
    creationTime: new Date('2026-04-16T08:10:00+08:00').getTime(),
  },
  duplicateGroup: {
    ...duplicateCandidate.duplicateGroup!,
    relation: 'near',
    similarity: 0.85,
  },
  issueTypes: ['duplicate'],
};

const abnormalCandidate: CleanupCandidate = {
  id: 'abnormal-item',
  asset: {
    id: 'abnormal-item',
    uri: 'file:///abnormal-item.jpg',
    previewUri: 'file:///abnormal-item-preview.jpg',
    mediaType: 'photo',
    width: 1200,
    height: 1600,
    duration: 0,
    fileSize: 180_000,
    creationTime: new Date('2026-04-16T09:00:00+08:00').getTime(),
  },
  score: 78,
  confidence: 'high',
  kind: 'abnormal-photo',
  primaryIssueType: 'abnormal',
  issueTypes: ['abnormal'],
  reasons: ['分辨率较低', '边缘信息很少', '曝光过度'],
};

const videoCandidate: CleanupCandidate = {
  id: 'video-item',
  asset: {
    id: 'video-item',
    uri: 'file:///video-item.mov',
    mediaType: 'video',
    width: 1920,
    height: 1080,
    duration: 14,
    fileSize: 2_200_000,
    creationTime: new Date('2026-04-16T09:00:00+08:00').getTime(),
  },
  score: 65,
  confidence: 'medium',
  kind: 'abnormal-video',
  primaryIssueType: 'abnormal',
  issueTypes: ['abnormal'],
  reasons: ['媒体时长异常短'],
};

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

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

function collectTexts(renderer: ReturnType<typeof TestRenderer.create>) {
  return renderer.root
    .findAllByType('Text')
    .map((node: { props: { children?: React.ReactNode } }) => flattenText(node.props.children))
    .filter(Boolean);
}

function flattenStyle(style: unknown): Record<string, unknown> {
  if (Array.isArray(style)) {
    return style.reduce<Record<string, unknown>>(
      (acc, entry) => ({ ...acc, ...flattenStyle(entry) }),
      {},
    );
  }

  if (style && typeof style === 'object') {
    return style as Record<string, unknown>;
  }

  return {};
}

function findTextNode(
  renderer: ReturnType<typeof TestRenderer.create>,
  value: string,
) {
  return renderer.root
    .findAllByType('Text')
    .find(
      (node: { props: { children?: React.ReactNode } }) =>
        flattenText(node.props.children) === value,
    );
}

function collectActionSwitchLabels(
  renderer: ReturnType<typeof TestRenderer.create>,
  testID = 'detail-action-switch',
) {
  return renderer.root
    .findByProps({ testID })
    .findAllByType('Text')
    .map((node: { props: { children?: React.ReactNode } }) => flattenText(node.props.children))
    .filter((label: string) => ['保留', '清理', '删除'].includes(label));
}

function renderDetailScreen(
  candidate: CleanupCandidate | null = duplicateCandidate,
  mode: 'suggestions' | 'recycle' = 'suggestions',
  browseCandidates?: CleanupCandidate[],
) {
  const onClose = vi.fn();
  const onPrimaryAction = vi.fn();
  const onHardDelete = vi.fn();
  const onKeep = vi.fn();
  let renderer!: ReturnType<typeof TestRenderer.create>;

  act(() => {
    renderer = TestRenderer.create(
      <DetailScreen
        candidate={candidate}
        browseCandidates={browseCandidates}
        duplicateCandidates={[duplicateCandidate, duplicateSiblingCandidate]}
        language="zh-CN"
        theme={theme}
        mode={mode}
        onClose={onClose}
        onPrimaryAction={onPrimaryAction}
        onHardDelete={onHardDelete}
        onKeep={onKeep}
      />,
    );
  });

  return { renderer, onClose, onPrimaryAction, onHardDelete, onKeep };
}

describe('DetailScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders null when no candidate is provided', () => {
    const { renderer } = renderDetailScreen(null);

    expect(renderer.toJSON()).toBeNull();
  });

  it('renders the simplified immersive viewer with index, tags, actions, and no pagination dots', () => {
    const { renderer } = renderDetailScreen();
    const texts = collectTexts(renderer);
    const closeButtonStyle = flattenStyle(
      renderer.root.findByProps({ testID: 'detail-close-button' }).props.style,
    );
    const stageWrapStyle = flattenStyle(
      renderer.root.findByProps({ testID: 'detail-stage-wrap' }).props.style,
    );
    const floatingFooterStyle = flattenStyle(
      renderer.root.findByProps({ testID: 'detail-floating-footer' }).props.style,
    );
    const tagRowStyle = flattenStyle(
      renderer.root.findByProps({ testID: 'detail-tag-row' }).props.style,
    );
    const nextNavStyle = flattenStyle(
      renderer.root.findByProps({ testID: 'duplicate-nav-next' }).props.style,
    );
    const duplicateTagText = findTextNode(renderer, '重复');
    const primaryActionText = findTextNode(renderer, '清理');
    const primaryActionStyle = flattenStyle(
      renderer.root.findByProps({ testID: 'detail-primary-action' }).props.style,
    );
    const secondaryActionStyle = flattenStyle(
      renderer.root.findByProps({ testID: 'detail-keep-action' }).props.style,
    );

    expect(renderer.root.findByProps({ testID: 'detail-viewer' })).toBeTruthy();
    expect(
      flattenText(renderer.root.findByProps({ testID: 'detail-viewer-index' }).props.children),
    ).toBe('1 / 2');
    expect(renderer.root.findByProps({ testID: 'detail-viewer-tag-重复' })).toBeTruthy();
    expect(renderer.root.findByProps({ testID: 'detail-viewer-tag-完全相同' })).toBeTruthy();
    expect(renderer.root.findByProps({ testID: 'detail-viewer-tag-已保留最佳副本' })).toBeTruthy();
    expect(renderer.root.findAllByProps({ testID: 'detail-viewer-tag-高度相似' })).toHaveLength(0);
    expect(renderer.root.findByProps({ testID: 'detail-primary-action' })).toBeTruthy();
    expect(renderer.root.findByProps({ testID: 'detail-keep-action' })).toBeTruthy();
    expect(renderer.root.findByProps({ testID: 'detail-action-switch' })).toBeTruthy();
    expect(renderer.root.findAllByProps({ testID: 'detail-pagination' })).toHaveLength(0);
    expect(texts).toContain('清理');
    expect(texts).toContain('保留');
    expect(closeButtonStyle.width).toBe(44);
    expect(closeButtonStyle.height).toBe(44);
    expect(closeButtonStyle.zIndex).toBe(11);
    expect(stageWrapStyle.width).toBe('100%');
    expect(floatingFooterStyle.position).toBe('absolute');
    expect(tagRowStyle.flexWrap).toBe('nowrap');
    expect(nextNavStyle.width).toBe(46);
    expect(nextNavStyle.height).toBe(46);
    expect(flattenStyle(duplicateTagText?.props.style).fontSize).toBe(8);
    expect(flattenStyle(primaryActionText?.props.style).fontSize).toBe(12);
    expect(primaryActionStyle.backgroundColor).toBe('#d8646a');
    expect(secondaryActionStyle.backgroundColor).toBeUndefined();
  });

  it('keeps the focused duplicate when the user swipes to the next item and taps keep', () => {
    const { renderer, onKeep } = renderDetailScreen();

    act(() => {
      renderer.root.findByProps({ testID: 'duplicate-nav-next' }).props.onPress();
    });

    expect(
      flattenText(renderer.root.findByProps({ testID: 'detail-viewer-index' }).props.children),
    ).toBe('2 / 2');
    expect(renderer.root.findByProps({ testID: 'detail-viewer-tag-相似' })).toBeTruthy();
    expect(renderer.root.findByProps({ testID: 'detail-viewer-tag-相似度85%' })).toBeTruthy();
    expect(renderer.root.findByProps({ testID: 'detail-viewer-tag-已保留最佳副本' })).toBeTruthy();
    expect(renderer.root.findAllByProps({ testID: 'duplicate-nav-next' })).toHaveLength(0);
    expect(renderer.root.findByProps({ testID: 'duplicate-nav-prev' })).toBeTruthy();

    act(() => {
      renderer.root.findByProps({ testID: 'detail-keep-action' }).props.onPress();
    });

    expect(onKeep).toHaveBeenCalledWith(['duplicate-item-2']);
  });

  it('keeps the suggestions detail actions ordered as keep on the left and cleanup on the right', () => {
    const { renderer, onKeep, onPrimaryAction } = renderDetailScreen();
    const keepAction = renderer.root.findByProps({ testID: 'detail-keep-action' });
    const cleanupAction = renderer.root.findByProps({ testID: 'detail-primary-action' });

    expect(collectActionSwitchLabels(renderer)).toEqual(['保留', '清理']);

    act(() => {
      keepAction.props.onPress();
    });
    act(() => {
      cleanupAction.props.onPress();
    });

    expect(onKeep).toHaveBeenCalledWith(['duplicate-item']);
    expect(onPrimaryAction).toHaveBeenCalledWith(['duplicate-item']);
  });

  it('keeps next and prev navigation in sync when opening on the second related item', () => {
    const onClose = vi.fn();
    const onPrimaryAction = vi.fn();
    const onHardDelete = vi.fn();
    const onKeep = vi.fn();
    let renderer!: ReturnType<typeof TestRenderer.create>;

    act(() => {
      renderer = TestRenderer.create(
        <DetailScreen
          candidate={duplicateSiblingCandidate}
          duplicateCandidates={[duplicateCandidate, duplicateSiblingCandidate]}
          language="zh-CN"
          theme={theme}
          mode="suggestions"
          onClose={onClose}
          onPrimaryAction={onPrimaryAction}
          onHardDelete={onHardDelete}
          onKeep={onKeep}
        />,
      );
    });

    expect(
      flattenText(renderer.root.findByProps({ testID: 'detail-viewer-index' }).props.children),
    ).toBe('2 / 2');
    expect(renderer.root.findAllByProps({ testID: 'duplicate-nav-next' })).toHaveLength(0);
    expect(renderer.root.findByProps({ testID: 'duplicate-nav-prev' })).toBeTruthy();

    act(() => {
      renderer.root.findByProps({ testID: 'duplicate-nav-prev' }).props.onPress();
    });

    expect(
      flattenText(renderer.root.findByProps({ testID: 'detail-viewer-index' }).props.children),
    ).toBe('1 / 2');
    expect(renderer.root.findByProps({ testID: 'duplicate-nav-next' })).toBeTruthy();
    expect(renderer.root.findAllByProps({ testID: 'duplicate-nav-prev' })).toHaveLength(0);
  });

  it('clears the currently focused duplicate item', () => {
    const { renderer, onPrimaryAction } = renderDetailScreen();

    act(() => {
      renderer.root.findByProps({ testID: 'duplicate-nav-next' }).props.onPress();
    });

    act(() => {
      renderer.root.findByProps({ testID: 'detail-primary-action' }).props.onPress();
    });

    expect(onPrimaryAction).toHaveBeenCalledWith(['duplicate-item-2']);
  });

  it('lets non-duplicate media browse the supplied result list', () => {
    const { renderer, onKeep } = renderDetailScreen(abnormalCandidate, 'suggestions', [
      abnormalCandidate,
      duplicateSiblingCandidate,
    ]);

    expect(
      flattenText(renderer.root.findByProps({ testID: 'detail-viewer-index' }).props.children),
    ).toBe('1 / 2');
    expect(renderer.root.findByProps({ testID: 'duplicate-nav-next' })).toBeTruthy();
    expect(renderer.root.findAllByProps({ testID: 'duplicate-nav-prev' })).toHaveLength(0);

    act(() => {
      renderer.root.findByProps({ testID: 'detail-keep-action' }).props.onPress();
    });

    expect(onKeep).toHaveBeenCalledWith(['abnormal-item']);
  });

  it('shows compact abnormal tags for non-duplicate media and keeps a safely sized stage image', () => {
    const { renderer } = renderDetailScreen(abnormalCandidate);

    const stageImage = renderer.root.findByType('Image');

    expect(renderer.root.findByProps({ testID: 'detail-viewer-tag-低质量' })).toBeTruthy();
    expect(renderer.root.findByProps({ testID: 'detail-viewer-tag-模糊' })).toBeTruthy();
    expect(renderer.root.findByProps({ testID: 'detail-viewer-tag-曝光过度' })).toBeTruthy();
    expect(stageImage.props.source).toMatchObject({
      uri: 'file:///abnormal-item.jpg',
      scale: 3,
    });
    expect(stageImage.props.source.width).toBeGreaterThan(320);
    expect(stageImage.props.source.height).toBeGreaterThan(500);
    expect(stageImage.props.allowDownscaling).toBe(true);
    expect(stageImage.props.priority).toBe('high');
  });

  it('shows keep and delete actions in recycle mode', () => {
    const { renderer } = renderDetailScreen(abnormalCandidate, 'recycle');

    expect(renderer.root.findByProps({ testID: 'detail-primary-action' })).toBeTruthy();
    expect(renderer.root.findByProps({ testID: 'detail-hard-delete' })).toBeTruthy();
    expect(renderer.root.findByProps({ testID: 'detail-action-switch' })).toBeTruthy();
    expect(collectTexts(renderer)).toContain('保留');
    expect(collectTexts(renderer)).toContain('删除');
  });

  it('renders the video player for video candidates', () => {
    const { renderer } = renderDetailScreen(videoCandidate);

    expect(renderer.root.findByProps({ testID: 'mock-video-player' })).toBeTruthy();
  });

  it('wires the close button for photo and video detail viewers', () => {
    const photo = renderDetailScreen(abnormalCandidate);
    const video = renderDetailScreen(videoCandidate);

    act(() => {
      photo.renderer.root.findByProps({ testID: 'detail-close-button' }).props.onPress();
      video.renderer.root.findByProps({ testID: 'detail-close-button' }).props.onPress();
    });

    expect(photo.onClose).toHaveBeenCalledTimes(1);
    expect(video.onClose).toHaveBeenCalledTimes(1);
  });

  it('swallows async action failures instead of throwing from detail button presses', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const rejectedKeep = vi.fn().mockRejectedValue(new Error('keep failed'));
    let renderer!: ReturnType<typeof TestRenderer.create>;

    act(() => {
      renderer = TestRenderer.create(
        <DetailScreen
          candidate={duplicateCandidate}
          duplicateCandidates={[duplicateCandidate, duplicateSiblingCandidate]}
          language="zh-CN"
          theme={theme}
          mode="suggestions"
          onClose={vi.fn()}
          onPrimaryAction={vi.fn()}
          onHardDelete={vi.fn()}
          onKeep={rejectedKeep}
        />,
      );
    });

    act(() => {
      renderer.root.findByProps({ testID: 'detail-keep-action' }).props.onPress();
    });

    await Promise.resolve();

    expect(rejectedKeep).toHaveBeenCalledWith(['duplicate-item']);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Detail action failed:',
      expect.any(Error),
    );

    consoleErrorSpy.mockRestore();
  });
});
