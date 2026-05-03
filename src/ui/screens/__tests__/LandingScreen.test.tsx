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
  ScrollView: 'ScrollView',
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

  it('renders the five-step product flow and trust points', () => {
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
    const stepCards = renderer.root.findAllByProps({ testID: 'landing-step' });
    const trustCards = renderer.root.findAllByProps({ testID: 'landing-trust-point' });

    expect(texts).toContain('本地相册助手');
    expect(texts).toContain('五步完成清理');
    expect(texts).toContain('扫描、识别、筛选、清理、报告，一条清晰的本地处理流程。');
    expect(texts).toContain('扫描');
    expect(texts).toContain('识别');
    expect(texts).toContain('筛选');
    expect(texts).toContain('清理');
    expect(texts).toContain('报告');
    expect(texts).toContain('本地优先');
    expect(texts).toContain('安全清理');
    expect(texts).toContain('后台处理');
    expect(texts).toContain('继续进入 Main');
    expect(renderer.root.findByProps({ testID: 'landing-screen' })).toBeTruthy();
    expect(renderer.root.findByProps({ testID: 'landing-scroll-view' })).toBeTruthy();
    expect(renderer.root.findByProps({ testID: 'landing-step-list' })).toBeTruthy();
    expect(renderer.root.findByProps({ testID: 'landing-trust-list' })).toBeTruthy();
    expect(stepCards).toHaveLength(5);
    expect(trustCards).toHaveLength(3);
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
