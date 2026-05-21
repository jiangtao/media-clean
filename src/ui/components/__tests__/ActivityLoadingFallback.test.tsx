import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { describe, expect, it, vi } from 'vitest';

import { getAppTheme } from '../../../theme/app-theme';
import { COMPONENT_TOKENS } from '../../../theme/generated/component-tokens.generated';
import {
  ActivityLoadingFallback,
  ACTIVITY_LOADING_FALLBACK_STYLE_TOKENS,
} from '../ActivityLoadingFallback';

vi.mock('react-native', () => ({
  ActivityIndicator: 'ActivityIndicator',
  Animated: {
    Value: vi.fn(function Value(this: Record<string, unknown>, value: number) {
      this.value = value;
      this.setValue = vi.fn();
    }),
    View: 'Animated.View',
    loop: vi.fn(() => ({ start: vi.fn(), stop: vi.fn() })),
    sequence: vi.fn((animations: unknown[]) => animations),
    timing: vi.fn(() => ({ start: vi.fn(), stop: vi.fn() })),
  },
  Easing: {
    inOut: vi.fn((value: unknown) => value),
    ease: 'ease',
  },
  View: 'View',
  StyleSheet: {
    absoluteFill: {},
    create: (styles: Record<string, unknown>) => styles,
  },
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

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

describe('ActivityLoadingFallback', () => {
  it('renders only a themed loading indicator for regular screens', () => {
    const theme = getAppTheme('light');
    let renderer!: ReturnType<typeof TestRenderer.create>;

    act(() => {
      renderer = TestRenderer.create(
        <ActivityLoadingFallback theme={theme} testID="screen-loading" />,
      );
    });

    expect(renderer.root.findByProps({ testID: 'screen-loading' })).toBeTruthy();
    const skeleton = renderer.root.findByProps({ testID: 'screen-loading-skeleton' });
    expect(skeleton.props.height).toBe(
      ACTIVITY_LOADING_FALLBACK_STYLE_TOKENS.skeleton.screenHeight,
    );
    expect(skeleton.props.width).toBe(
      ACTIVITY_LOADING_FALLBACK_STYLE_TOKENS.skeleton.screenWidth,
    );
    expect(renderer.root.findByType('ActivityIndicator').props.color).toBe(
      theme.buttonPrimaryBackground,
    );
  });

  it('uses the dark detail surface for fullscreen media loading', () => {
    const theme = getAppTheme('dark');
    let renderer!: ReturnType<typeof TestRenderer.create>;

    act(() => {
      renderer = TestRenderer.create(
        <ActivityLoadingFallback theme={theme} testID="detail-loading-fallback" surface="detail" />,
      );
    });

    expect(renderer.root.findByProps({ testID: 'detail-loading-fallback' })).toBeTruthy();
    const detailContainer = renderer.root
      .findAllByProps({ testID: 'detail-loading-fallback' })
      .find((node: { props: { style?: unknown } }) => node.props.style);
    const containerStyle = flattenStyle(detailContainer?.props.style);
    const skeleton = renderer.root.findByProps({ testID: 'detail-loading-fallback-skeleton' });
    expect(ACTIVITY_LOADING_FALLBACK_STYLE_TOKENS).toBe(
      COMPONENT_TOKENS.activityLoadingFallback,
    );
    expect(containerStyle.backgroundColor).toBe(
      ACTIVITY_LOADING_FALLBACK_STYLE_TOKENS.color.detailBackground,
    );
    expect(skeleton.props.height).toBe(
      ACTIVITY_LOADING_FALLBACK_STYLE_TOKENS.skeleton.detailHeight,
    );
    expect(skeleton.props.width).toBe(
      ACTIVITY_LOADING_FALLBACK_STYLE_TOKENS.skeleton.detailWidth,
    );
    expect(renderer.root.findByType('ActivityIndicator').props.color).toBe(
      ACTIVITY_LOADING_FALLBACK_STYLE_TOKENS.color.detailIndicator,
    );
  });
});
