import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { describe, expect, it, vi } from 'vitest';

import { getAppTheme } from '../../../theme/app-theme';
import { ActivityLoadingFallback } from '../ActivityLoadingFallback';

vi.mock('react-native', () => ({
  ActivityIndicator: 'ActivityIndicator',
  View: 'View',
  StyleSheet: {
    create: (styles: Record<string, unknown>) => styles,
  },
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

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
    expect(renderer.root.findByType('ActivityIndicator').props.color).toBe('#ffffff');
  });
});
