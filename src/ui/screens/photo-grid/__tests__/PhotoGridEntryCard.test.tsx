import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { describe, expect, it, vi } from 'vitest';

import { getAppTheme } from '../../../../theme/app-theme';
import { COMPONENT_TOKENS } from '../../../../theme/generated/component-tokens.generated';
import {
  PhotoGridEntryCard,
  PHOTO_GRID_ENTRY_CARD_STYLE_TOKENS,
} from '../PhotoGridEntryCard';

vi.mock('react-native', () => ({
  View: 'View',
  Text: 'Text',
  Pressable: 'Pressable',
  StyleSheet: {
    create: (styles: Record<string, unknown>) => styles,
    hairlineWidth: 1,
  },
}));

vi.mock('../../../icons/AppIcon', () => ({
  AppIcon: 'AppIcon',
}));

vi.mock('../../../icons/DesignIcon', () => ({
  DesignIcon: 'DesignIcon',
  SvgProcessRing: 'SvgProcessRing',
}));

vi.mock('../../../primitives', () => ({
  Text: 'Text',
}));

vi.mock('../../../../i18n/app-copy', () => ({
  getAppCopy: () => ({
    screens: {
      photoGrid: {
        entryUnit: '项',
        entryPermissionGrantedTitle: '已授权',
        entryPermissionGrantedBody: '可以开始扫描',
        entryLocalOnly: '仅本地分析',
        entrySupportsPhotosAndVideos: '支持照片和视频',
        entryFastLocalScan: '快速本地扫描',
        entryScanningInstrumentationLabel: '扫描中',
        entryLoadingTitle: '载入中',
        entryLoadingBody: '准备媒体',
        entryReadyHint: '准备完成',
        entryLocalOnlyCaption: '不上传云端',
        entrySupportsPhotosAndVideosCaption: '支持两种媒体',
      },
    },
  }),
}));

const lightTheme = getAppTheme('light');
const darkTheme = getAppTheme('dark');

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function flattenStyle(style: unknown): Record<string, unknown> {
  if (Array.isArray(style)) {
    return style.reduce<Record<string, unknown>>(
      (combined, entry) => ({ ...combined, ...flattenStyle(entry) }),
      {},
    );
  }

  if (style && typeof style === 'object') {
    return style as Record<string, unknown>;
  }

  return {};
}

function renderEntryCard(
  overrides: Partial<React.ComponentProps<typeof PhotoGridEntryCard>> = {},
) {
  let renderer!: ReturnType<typeof TestRenderer.create>;

  act(() => {
    renderer = TestRenderer.create(
      <PhotoGridEntryCard
        variant="scanResult"
        title="发现 3 个待处理媒体"
        theme={lightTheme}
        resultBreakdown={[
          { key: 'blurry', label: '模糊照片', count: 1 },
          { key: 'duplicate', label: '重复照片', count: 1 },
          { key: 'similar', label: '相似照片', count: 1 },
        ]}
        {...overrides}
      />,
    );
  });

  return renderer;
}

describe('PhotoGridEntryCard', () => {
  it('shares the generated photo grid entry-card token facade', () => {
    expect(PHOTO_GRID_ENTRY_CARD_STYLE_TOKENS).toBe(COMPONENT_TOKENS.photoGrid.entryCard);
  });

  it('uses token-backed breakdown icon colors and backgrounds in the result state', () => {
    const renderer = renderEntryCard();
    const blurryIcon = renderer.root.findByProps({ name: 'blurry-drop' });
    const blurryShell = renderer.root.findByProps({
      testID: 'photo-grid-result-breakdown-blurry-icon-shell',
    });
    const similarIcon = renderer.root.findByProps({ name: 'similar-people' });

    expect(flattenStyle(blurryShell.props.style).backgroundColor).toBe(
      PHOTO_GRID_ENTRY_CARD_STYLE_TOKENS.color.breakdownBlurryBackground,
    );
    expect(blurryIcon.props.color).toBe(
      PHOTO_GRID_ENTRY_CARD_STYLE_TOKENS.color.breakdownBlurry,
    );
    expect(similarIcon.props.color).toBe(
      PHOTO_GRID_ENTRY_CARD_STYLE_TOKENS.color.breakdownSimilar,
    );
    expect(renderer.root.findByProps({ testID: 'photo-grid-result-check-icon' }).props.color).toBe(
      lightTheme.buttonSuccessBackground,
    );
  });

  it('uses token-backed progress-track colors for both light and dark themes', () => {
    const lightRenderer = renderEntryCard({
      variant: 'scanning',
      title: '扫描中',
      progress: { current: 24, total: 100 },
      resultBreakdown: undefined,
      note: '快速本地扫描',
    });
    const darkRenderer = renderEntryCard({
      variant: 'scanning',
      title: '扫描中',
      theme: darkTheme,
      progress: { current: 24, total: 100 },
      resultBreakdown: undefined,
      note: '快速本地扫描',
    });

    expect(
      lightRenderer.root.findByProps({ testID: 'photo-grid-circular-progress' }).props.trackColor,
    ).toBe(PHOTO_GRID_ENTRY_CARD_STYLE_TOKENS.color.progressTrackLight);
    expect(
      darkRenderer.root.findByProps({ testID: 'photo-grid-circular-progress' }).props.trackColor,
    ).toBe(PHOTO_GRID_ENTRY_CARD_STYLE_TOKENS.color.progressTrackDark);
  });

  it('uses token-backed generic shadow opacity for fallback cards', () => {
    const lightRenderer = renderEntryCard({
      variant: 'scanEmpty',
      title: '暂无待处理媒体',
      resultBreakdown: undefined,
    });
    const darkRenderer = renderEntryCard({
      variant: 'scanEmpty',
      title: '暂无待处理媒体',
      theme: darkTheme,
      resultBreakdown: undefined,
    });
    const lightGenericCard = lightRenderer.root
      .findAllByType('View')
      .find((node: { props: { style?: unknown } }) => flattenStyle(node.props.style).shadowOpacity !== undefined);
    const darkGenericCard = darkRenderer.root
      .findAllByType('View')
      .find((node: { props: { style?: unknown } }) => flattenStyle(node.props.style).shadowOpacity !== undefined);

    expect(lightGenericCard).toBeTruthy();
    expect(darkGenericCard).toBeTruthy();
    expect(flattenStyle(lightGenericCard?.props.style).shadowOpacity).toBe(
      PHOTO_GRID_ENTRY_CARD_STYLE_TOKENS.opacity.genericShadowLight,
    );
    expect(flattenStyle(darkGenericCard?.props.style).shadowOpacity).toBe(
      PHOTO_GRID_ENTRY_CARD_STYLE_TOKENS.opacity.genericShadowDark,
    );
  });
});
