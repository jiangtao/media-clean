import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const runtime = vi.hoisted(() => ({
  replace: vi.fn(),
}));

vi.mock('react-native', () => ({
  View: 'View',
  Text: 'Text',
  Pressable: 'Pressable',
  StyleSheet: {
    create: (styles: Record<string, unknown>) => styles,
  },
}));

vi.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 24, bottom: 16, left: 0, right: 0 }),
}));

vi.mock('@expo/vector-icons', () => ({
  Ionicons: ({ name, testID }: { name: string; testID?: string }) =>
    React.createElement('Text', { testID }, name),
}));

vi.mock('../../../application/AppPreferencesContext', () => ({
  useAppPreferences: () => ({
    language: 'zh-CN',
    theme: {
      scheme: 'light',
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
      heroAccent: '#9ed3c7',
      noticeBackground: '#fff1e8',
      noticeBorder: '#efc9b4',
      noticeTitle: '#7d3f22',
      noticeText: '#965a3a',
      actionBarBackground: '#142a33',
      actionBarText: '#fff7ec',
      shadowColor: '#0f172a',
      statusBarStyle: 'dark',
    },
    copy: {},
  }),
}));

import { LandingScreen } from '../LandingScreen';

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

describe('LandingScreen', () => {
  beforeEach(() => {
    runtime.replace.mockReset();
  });

  it('renders a restrained media-cleanup landing page', () => {
    let renderer!: ReturnType<typeof TestRenderer.create>;

    act(() => {
      renderer = TestRenderer.create(
        <LandingScreen
          navigation={{
            replace: runtime.replace,
          }}
        />,
      );
    });

    const texts = collectTexts(renderer);

    expect(texts).toContain('MediaClean');
    expect(texts).toContain('媒体清理');
    expect(texts).toContain('进入媒体清理');
    expect(texts).toContain('先看结果，再做决定。扫描、筛选、保留都在本机完成。');
    expect(renderer.root.findByProps({ testID: 'landing-screen' })).toBeTruthy();
    expect(renderer.root.findByProps({ testID: 'landing-primary-action' })).toBeTruthy();
  });

  it('replaces the landing page with the main workspace when the CTA is pressed', () => {
    let renderer!: ReturnType<typeof TestRenderer.create>;

    act(() => {
      renderer = TestRenderer.create(
        <LandingScreen
          navigation={{
            replace: runtime.replace,
          }}
        />,
      );
    });

    act(() => {
      renderer.root.findByProps({ testID: 'landing-primary-action' }).props.onPress();
    });

    expect(runtime.replace).toHaveBeenCalledWith('Main');
  });
});
