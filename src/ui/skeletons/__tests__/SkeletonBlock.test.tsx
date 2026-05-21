import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { describe, expect, it, vi } from 'vitest';

vi.unmock('../../../theme/generated/skeleton-tokens.generated');
vi.unmock('../../../i18n/resource-loader');
vi.unmock('../../../i18n/resources.generated');

import { loadI18nResources } from '../../../i18n/resource-loader';
import { SKELETON_TOKENS } from '../../../theme/generated/skeleton-tokens.generated';
import { SkeletonBlock } from '../SkeletonBlock';

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

function renderSkeleton(props: React.ComponentProps<typeof SkeletonBlock>) {
  let renderer!: ReturnType<typeof TestRenderer.create>;
  act(() => {
    renderer = TestRenderer.create(<SkeletonBlock {...props} />);
  });
  return renderer;
}

function findHostByTestID(renderer: ReturnType<typeof TestRenderer.create>, testID: string) {
  return renderer.root.findAll(
    (node: { props?: Record<string, unknown> }) =>
      node.props?.testID === testID && node.props.style !== undefined,
  )[0];
}

describe('SkeletonBlock', () => {
  it('uses localized accessibility labels supplied from zh and en i18n resources', () => {
    const zhLabel = loadI18nResources('zh-CN').app.skeleton.loadingLabel;
    const enLabel = loadI18nResources('en-US').app.skeleton.loadingLabel;

    const zhRenderer = renderSkeleton({
      accessibilityLabel: zhLabel,
      testID: 'skeleton-zh',
    });
    const enRenderer = renderSkeleton({
      accessibilityLabel: enLabel,
      testID: 'skeleton-en',
    });

    expect(zhLabel).toBe('正在加载内容');
    expect(enLabel).toBe('Loading content');
    expect(findHostByTestID(zhRenderer, 'skeleton-zh').props).toMatchObject({
      accessibilityLabel: zhLabel,
      accessibilityRole: 'progressbar',
      accessibilityState: { busy: true },
      accessible: true,
    });
    expect(findHostByTestID(enRenderer, 'skeleton-en').props.accessibilityLabel).toBe(enLabel);
  });

  it('maps block color, radius, height, and shimmer to generated skeleton tokens without borders', () => {
    const label = loadI18nResources('zh-CN').app.skeleton.loadingLabel;
    const renderer = renderSkeleton({
      accessibilityLabel: label,
      height: 24,
      scheme: 'dark',
      testID: 'skeleton-token',
      width: '75%',
    });

    expect(flattenStyle(findHostByTestID(renderer, 'skeleton-token').props.style)).toMatchObject({
      backgroundColor: SKELETON_TOKENS.colors.dark.base,
      borderWidth: 0,
      borderRadius: SKELETON_TOKENS.layout.blockRadius,
      height: 24,
      width: '75%',
    });
    expect(flattenStyle(findHostByTestID(renderer, 'skeleton-token-block').props.style)).toMatchObject({
      backgroundColor: SKELETON_TOKENS.colors.dark.base,
      borderRadius: SKELETON_TOKENS.layout.blockRadius,
    });
    expect(
      flattenStyle(findHostByTestID(renderer, 'skeleton-token-highlight').props.style),
    ).toMatchObject({
      backgroundColor: SKELETON_TOKENS.colors.dark.highlight,
    });
  });

  it('disables animated opacity when reduced motion is requested', () => {
    const label = loadI18nResources('en-US').app.skeleton.loadingLabel;
    const renderer = renderSkeleton({
      accessibilityLabel: label,
      reduceMotion: true,
      testID: 'skeleton-reduced-motion',
    });

    expect(
      flattenStyle(
        findHostByTestID(renderer, 'skeleton-reduced-motion-highlight').props.style,
      ),
    ).toMatchObject({
      opacity: SKELETON_TOKENS.motion.maxOpacity,
    });
  });

  it('keeps animation opt-out independent from reduced motion', () => {
    const label = loadI18nResources('zh-CN').app.skeleton.loadingLabel;
    const renderer = renderSkeleton({
      accessibilityLabel: label,
      animated: false,
      testID: 'skeleton-no-animation',
    });

    expect(
      flattenStyle(findHostByTestID(renderer, 'skeleton-no-animation-highlight').props.style),
    ).toMatchObject({
      opacity: SKELETON_TOKENS.motion.maxOpacity,
    });
  });
});
