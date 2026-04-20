import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { CleanupCandidate } from '../../../domain/recognition/types';
import { getAppTheme } from '../../../theme/app-theme';
import { DuplicateCarousel } from '../DuplicateCarousel';

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
  Image: 'Image',
}));

vi.mock('@expo/vector-icons', () => ({
  Ionicons: ({ name }: { name: string }) => React.createElement('Text', null, name),
}));

vi.mock('../VideoPlayer', () => ({
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

describe('DuplicateCarousel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
    expect(stageImage.props.source.width).toBeGreaterThan(300);
    expect(stageImage.props.source.height).toBeGreaterThan(450);
    expect(stageImage.props.cachePolicy).toBe('memory-disk');
    expect(stageImage.props.priority).toBe('high');
    expect(stageImage.props.allowDownscaling).toBe(true);
  });

  it('moves left and right between duplicate candidates and reports the focused id', () => {
    const { renderer, onActiveIdChange } = renderCarousel();
    const nextNavStyle = flattenStyle(
      renderer.root.findByProps({ testID: 'duplicate-nav-next' }).props.style,
    );

    expect(renderer.root.findAllByProps({ testID: 'duplicate-nav-prev' })).toHaveLength(0);

    act(() => {
      renderer.root.findByProps({ testID: 'duplicate-nav-next' }).props.onPress();
    });

    expect(nextNavStyle.width).toBe(46);
    expect(nextNavStyle.height).toBe(46);
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
});
