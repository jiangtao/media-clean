import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { CleanupCandidate } from '../../../domain/recognition/types';
import { getAppTheme } from '../../../theme/app-theme';
import { COMPONENT_TOKENS } from '../../../theme/generated/component-tokens.generated';
import { DuplicateCarousel, DUPLICATE_CAROUSEL_STYLE_TOKENS } from '../DuplicateCarousel';

const imageLifecycle = vi.hoisted(() => ({
  mounts: new Map<string, number>(),
  unmounts: new Map<string, number>(),
  nextInstanceId: 0,
}));
const videoLifecycle = vi.hoisted(() => ({
  mounts: new Map<string, number>(),
  unmounts: new Map<string, number>(),
  nextInstanceId: 0,
}));

vi.mock('react-native', () => ({
  View: 'View',
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
  Image: ({ source, ...props }: { source?: { uri?: string }; [key: string]: unknown }) => {
    const ReactModule = require('react') as typeof import('react');
    const uri = source?.uri ?? 'unknown';
    const instanceIdRef = ReactModule.useRef<number | null>(null);

    if (instanceIdRef.current === null) {
      imageLifecycle.nextInstanceId += 1;
      instanceIdRef.current = imageLifecycle.nextInstanceId;
    }

    ReactModule.useEffect(() => {
      imageLifecycle.mounts.set(uri, (imageLifecycle.mounts.get(uri) ?? 0) + 1);

      return () => {
        imageLifecycle.unmounts.set(uri, (imageLifecycle.unmounts.get(uri) ?? 0) + 1);
      };
    }, []);

    return ReactModule.createElement('Image', {
      ...props,
      source,
      mockInstanceId: instanceIdRef.current,
    });
  },
}));

vi.mock('@expo/vector-icons', () => ({
  Ionicons: ({ name }: { name: string }) => React.createElement('Text', null, name),
}));

vi.mock('../VideoPlayer', () => ({
  VideoPlayer: ({ uri, isActive }: { uri: string; isActive?: boolean }) => {
    const ReactModule = require('react') as typeof import('react');
    const instanceIdRef = ReactModule.useRef<number | null>(null);

    if (instanceIdRef.current === null) {
      videoLifecycle.nextInstanceId += 1;
      instanceIdRef.current = videoLifecycle.nextInstanceId;
    }

    ReactModule.useEffect(() => {
      videoLifecycle.mounts.set(uri, (videoLifecycle.mounts.get(uri) ?? 0) + 1);

      return () => {
        videoLifecycle.unmounts.set(uri, (videoLifecycle.unmounts.get(uri) ?? 0) + 1);
      };
    }, []);

    return ReactModule.createElement('View', {
      testID: 'mock-video-player',
      uri,
      isActive,
      mockInstanceId: instanceIdRef.current,
    });
  },
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
  score: 86,
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
  issueTypes: ['duplicate'],
};

function createCarouselCandidate(id: string, mediaType: CleanupCandidate['asset']['mediaType'] = 'photo'): CleanupCandidate {
  return {
    ...duplicateCandidate,
    id,
    asset: {
      ...duplicateCandidate.asset,
      id,
      uri: `file:///${id}.${mediaType === 'video' ? 'mp4' : 'jpg'}`,
      previewUri: `file:///${id}-preview.jpg`,
      mediaType,
      duration: mediaType === 'video' ? 12 : 0,
    },
  };
}

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function renderCarousel(overrides: Partial<React.ComponentProps<typeof DuplicateCarousel>> = {}) {
  const onActiveIdChange = vi.fn();
  let renderer!: ReturnType<typeof TestRenderer.create>;

  act(() => {
    renderer = TestRenderer.create(
      <DuplicateCarousel
        candidate={duplicateCandidate}
        duplicateCandidates={[duplicateCandidate, duplicateSiblingCandidate]}
        language="zh-CN"
        theme={theme}
        selectedIds={[]}
        onSelectionChange={vi.fn()}
        onActiveIdChange={onActiveIdChange}
        {...overrides}
      />,
    );
  });

  return { renderer, onActiveIdChange };
}

function renderControlledCarousel(activeId: string) {
  const onActiveIdChange = vi.fn();
  let renderer!: ReturnType<typeof TestRenderer.create>;

  act(() => {
    renderer = TestRenderer.create(
      <DuplicateCarousel
        candidate={duplicateSiblingCandidate}
        duplicateCandidates={[duplicateCandidate, duplicateSiblingCandidate]}
        language="zh-CN"
        theme={theme}
        selectedIds={[]}
        onSelectionChange={vi.fn()}
        activeId={activeId}
        onActiveIdChange={onActiveIdChange}
      />,
    );
  });

  return { renderer, onActiveIdChange };
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

function findImageInstanceId(
  renderer: ReturnType<typeof TestRenderer.create>,
  uri: string,
) {
  const imageNode = renderer.root.find(
    (node: { type: unknown; props: { source?: { uri?: string }; mockInstanceId?: number } }) =>
      node.type === 'Image' && node.props.source?.uri === uri,
  );

  return imageNode.props.mockInstanceId;
}

function findVideoPlayerNode(
  renderer: ReturnType<typeof TestRenderer.create>,
  uri: string,
) {
  return renderer.root.find(
    (node: { props: { testID?: unknown; uri?: string } }) =>
      node.props.testID === 'mock-video-player' && node.props.uri === uri,
  );
}

describe('DuplicateCarousel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    imageLifecycle.mounts.clear();
    imageLifecycle.unmounts.clear();
    imageLifecycle.nextInstanceId = 0;
    videoLifecycle.mounts.clear();
    videoLifecycle.unmounts.clear();
    videoLifecycle.nextInstanceId = 0;
  });

  it('shares the generated duplicate carousel token facade', () => {
    expect(DUPLICATE_CAROUSEL_STYLE_TOKENS).toBe(COMPONENT_TOKENS.duplicateCarousel);
  });

  it('renders a full-stage high-fidelity image viewer for duplicate items', () => {
    const { renderer } = renderCarousel();

    const stageImage = renderer.root.findAllByType('Image')[0];

    expect(renderer.root.findByProps({ testID: 'detail-duplicate-carousel' })).toBeTruthy();
    expect(renderer.root.findByProps({ testID: 'duplicate-stage' })).toBeTruthy();
    expect(stageImage.props.source).toMatchObject({
      uri: 'file:///duplicate-item.jpg',
      scale: 3,
    });
    expect(stageImage.props.source.width).toBe(390);
    expect(stageImage.props.source.height).toBeGreaterThan(450);
    expect(stageImage.props.cachePolicy).toBe('memory-disk');
    expect(stageImage.props.priority).toBe('high');
    expect(stageImage.props.allowDownscaling).toBe(true);
  });

  it('uses a full-width paging interval so the edge page cannot expose a second image', () => {
    const { renderer } = renderCarousel();
    const stageScroll = renderer.root.findByProps({ testID: 'duplicate-stage-scroll' });

    expect(stageScroll.props.pagingEnabled).toBe(true);
    expect(stageScroll.props.snapToInterval).toBe(390);
    expect(stageScroll.props.disableIntervalMomentum).toBe(true);
    expect(stageScroll.props.bounces).toBe(false);
    expect(stageScroll.props.overScrollMode).toBe('never');
  });

  it('rotates media with explicit orientation metadata while keeping the slide centered', () => {
    const rotatedCandidate: CleanupCandidate = {
      ...duplicateCandidate,
      id: 'rotated-item',
      asset: {
        ...duplicateCandidate.asset,
        id: 'rotated-item',
        uri: 'file:///rotated-item.jpg',
        width: 3024,
        height: 4032,
        orientation: 90,
      },
    };
    const { renderer } = renderCarousel({
      candidate: rotatedCandidate,
      duplicateCandidates: [rotatedCandidate],
    });
    const image = renderer.root
      .findByProps({ testID: 'duplicate-stage-media-rotated-item' })
      .findByProps({ testID: 'zoomable-image-content' });
    const imageStyle = flattenStyle(image.props.style);

    expect(image.props.source).toMatchObject({
      uri: 'file:///rotated-item.jpg',
      width: Math.round(390 * DUPLICATE_CAROUSEL_STYLE_TOKENS.defaultStage.heightRatio),
      height: 390,
    });
    expect(imageStyle.width).toBe(Math.round(390 * DUPLICATE_CAROUSEL_STYLE_TOKENS.defaultStage.heightRatio));
    expect(imageStyle.height).toBe(390);
    expect(imageStyle.transform).toEqual([{ rotate: '90deg' }]);
  });

  it('moves left and right between duplicate candidates and reports the focused id', () => {
    const { renderer, onActiveIdChange } = renderCarousel();
    const nextNav = renderer.root.findByProps({ testID: 'duplicate-nav-next' });
    const nextNavSize = nextNav.props.size;
    const nextNavStyle = flattenStyle(nextNav.props.style);

    expect(renderer.root.findAllByProps({ testID: 'duplicate-nav-prev' })).toHaveLength(0);

    act(() => {
      renderer.root.findByProps({ testID: 'duplicate-nav-next' }).props.onPress();
    });

    expect(nextNavSize).toBe(DUPLICATE_CAROUSEL_STYLE_TOKENS.nav.buttonSize);
    expect(nextNavStyle.backgroundColor).toBe(DUPLICATE_CAROUSEL_STYLE_TOKENS.nav.background);
    expect(onActiveIdChange).toHaveBeenCalledWith('duplicate-item-2');
    expect(renderer.root.findAllByProps({ testID: 'duplicate-nav-next' })).toHaveLength(0);
    expect(renderer.root.findByProps({ testID: 'duplicate-nav-prev' })).toBeTruthy();
  });

  it('hides navigation controls when there is only one reviewable item', () => {
    const { renderer } = renderCarousel({
      duplicateCandidates: [duplicateCandidate],
    });

    expect(renderer.root.findAllByProps({ testID: 'duplicate-nav-next' })).toHaveLength(0);
    expect(renderer.root.findAllByProps({ testID: 'duplicate-nav-prev' })).toHaveLength(0);
  });

  it('respects the provided duplicate order when a controlled active id starts on the last item', () => {
    const { renderer, onActiveIdChange } = renderControlledCarousel('duplicate-item-2');

    expect(renderer.root.findAllByProps({ testID: 'duplicate-nav-next' })).toHaveLength(0);
    expect(renderer.root.findByProps({ testID: 'duplicate-nav-prev' })).toBeTruthy();

    act(() => {
      renderer.root.findByProps({ testID: 'duplicate-nav-prev' }).props.onPress();
    });

    expect(onActiveIdChange).toHaveBeenCalledWith('duplicate-item');
  });

  it('renders only the active sliding window instead of mounting every media item', () => {
    const duplicateCandidates = Array.from({ length: 100 }, (_, index) =>
      createCarouselCandidate(`window-item-${index}`, index % 7 === 0 ? 'video' : 'photo'),
    );
    const activeCandidate = duplicateCandidates[50]!;
    const { renderer } = renderCarousel({
      candidate: activeCandidate,
      duplicateCandidates,
      activeId: activeCandidate.id,
    });

    const renderedSlides = renderer.root.findAll(
      (node: { props: { testID?: unknown } }) =>
        typeof node.props.testID === 'string' &&
        node.props.testID.startsWith('duplicate-stage-slide-'),
    );

    expect(renderedSlides).toHaveLength(3);
    expect(renderer.root.findByProps({ testID: 'duplicate-stage-slide-window-item-49' })).toBeTruthy();
    expect(renderer.root.findByProps({ testID: 'duplicate-stage-slide-window-item-50' })).toBeTruthy();
    expect(renderer.root.findByProps({ testID: 'duplicate-stage-slide-window-item-51' })).toBeTruthy();
    expect(renderer.root.findAllByProps({ testID: 'duplicate-stage-slide-window-item-0' })).toHaveLength(0);
    expect(renderer.root.findAllByProps({ testID: 'duplicate-stage-slide-window-item-99' })).toHaveLength(0);
  });

  it('keeps overlapping image views attached to the same native image slot when the active window advances', () => {
    const duplicateCandidates = Array.from({ length: 100 }, (_, index) =>
      createCarouselCandidate(`window-item-${index}`, 'photo'),
    );
    const firstActiveCandidate = duplicateCandidates[50]!;
    const nextActiveCandidate = duplicateCandidates[51]!;
    const { renderer } = renderCarousel({
      candidate: firstActiveCandidate,
      duplicateCandidates,
      activeId: firstActiveCandidate.id,
    });
    const beforeFocusedNextInstanceId = findImageInstanceId(
      renderer,
      'file:///window-item-51.jpg',
    );

    act(() => {
      renderer.update(
        <DuplicateCarousel
          candidate={nextActiveCandidate}
          duplicateCandidates={duplicateCandidates}
          language="zh-CN"
          theme={theme}
          selectedIds={[]}
          onSelectionChange={vi.fn()}
          activeId={nextActiveCandidate.id}
          onActiveIdChange={vi.fn()}
        />,
      );
    });

    expect(findImageInstanceId(renderer, 'file:///window-item-51.jpg')).toBe(beforeFocusedNextInstanceId);
    expect(renderer.root.findAllByType('Image')).toHaveLength(3);
    expect(renderer.root.findByProps({ testID: 'duplicate-stage-media-window-item-52' })).toBeTruthy();
  });

  it('keeps a swiped-away video mounted but inactive so playback pauses without recreating the player', () => {
    const previousPhoto = createCarouselCandidate('video-before', 'photo');
    const activeVideo = createCarouselCandidate('video-current', 'video');
    const nextPhoto = createCarouselCandidate('video-after', 'photo');
    const duplicateCandidates = [previousPhoto, activeVideo, nextPhoto];
    const { renderer } = renderCarousel({
      candidate: activeVideo,
      duplicateCandidates,
      activeId: activeVideo.id,
    });
    const activeVideoUri = 'file:///video-current.mp4';
    const initialVideoNode = findVideoPlayerNode(renderer, activeVideoUri);
    const initialInstanceId = initialVideoNode.props.mockInstanceId;

    expect(initialVideoNode.props.isActive).toBe(true);
    expect(videoLifecycle.mounts.get(activeVideoUri)).toBe(1);

    act(() => {
      renderer.update(
        <DuplicateCarousel
          candidate={nextPhoto}
          duplicateCandidates={duplicateCandidates}
          language="zh-CN"
          theme={theme}
          selectedIds={[]}
          onSelectionChange={vi.fn()}
          activeId={nextPhoto.id}
          onActiveIdChange={vi.fn()}
        />,
      );
    });

    const inactiveVideoNode = findVideoPlayerNode(renderer, activeVideoUri);

    expect(inactiveVideoNode.props.isActive).toBe(false);
    expect(inactiveVideoNode.props.mockInstanceId).toBe(initialInstanceId);
    expect(videoLifecycle.mounts.get(activeVideoUri)).toBe(1);
    expect(videoLifecycle.unmounts.get(activeVideoUri) ?? 0).toBe(0);
  });
});
