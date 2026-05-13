import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getAppCopy } from '../../../i18n/app-copy';

const runtime = vi.hoisted(() => ({
  replace: vi.fn(),
  saveHasEnteredWorkspace: vi.fn(),
  getMediaLibraryPermissionsAsync: vi.fn(),
  requestMediaLibraryPermissionsAsync: vi.fn(),
}));

vi.mock('react-native', () => ({
  View: 'View',
  Text: 'Text',
  Pressable: 'Pressable',
  ScrollView: 'ScrollView',
  useWindowDimensions: () => ({ width: 375, height: 812, scale: 3, fontScale: 1 }),
  StyleSheet: {
    create: (styles: Record<string, unknown>) => styles,
    hairlineWidth: 1,
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
      orbTop: '#d8e7df',
      orbBottom: '#f2d4c6',
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
    copy: getAppCopy('zh-CN'),
  }),
}));

vi.mock('../../../services/storage/workspace-entry-storage', () => ({
  saveHasEnteredWorkspace: (...args: unknown[]) => runtime.saveHasEnteredWorkspace(...args),
}));

vi.mock('../../../services/media-library-permissions', () => ({
  getMediaLibraryPermissionsAsync: (...args: unknown[]) => runtime.getMediaLibraryPermissionsAsync(...args),
  requestMediaLibraryPermissionsAsync: (...args: unknown[]) =>
    runtime.requestMediaLibraryPermissionsAsync(...args),
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

function flattenStyle(style: unknown): Record<string, unknown> {
  if (Array.isArray(style)) {
    return style.reduce<Record<string, unknown>>(
      (mergedStyle, stylePart) => ({
        ...mergedStyle,
        ...flattenStyle(stylePart),
      }),
      {},
    );
  }

  if (style && typeof style === 'object') {
    return style as Record<string, unknown>;
  }

  return {};
}

async function flushPromises() {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

describe('LandingScreen', () => {
  beforeEach(() => {
    runtime.replace.mockReset();
    runtime.saveHasEnteredWorkspace.mockReset();
    runtime.saveHasEnteredWorkspace.mockResolvedValue(undefined);
    runtime.getMediaLibraryPermissionsAsync.mockReset();
    runtime.getMediaLibraryPermissionsAsync.mockResolvedValue({ granted: true });
    runtime.requestMediaLibraryPermissionsAsync.mockReset();
    runtime.requestMediaLibraryPermissionsAsync.mockResolvedValue({ granted: true });
  });

  it('renders the compact scan entry experience instead of a productized multi-step landing page', async () => {
    let renderer!: ReturnType<typeof TestRenderer.create>;

    await act(async () => {
      renderer = TestRenderer.create(
        <LandingScreen
          navigation={{
            replace: runtime.replace,
          }}
        />,
      );
      await flushPromises();
    });

    const texts = collectTexts(renderer);

    expect(texts).toContain('授权已完成');
    expect(texts).toContain('可开始扫描相册');
    expect(texts).toContain('本地扫描');
    expect(texts).toContain('识别重复、模糊与相似内容');
    expect(texts).toContain('开始扫描');
    expect(texts).toContain('即将扫描照片与视频');
    expect(texts).toContain('仅在本地分析，不上传任何数据');
    expect(texts).toContain('支持照片与视频');
    expect(texts).not.toContain('主流程');
    expect(texts).not.toContain('识别');
    expect(texts).not.toContain('筛选');
    expect(texts).not.toContain('报告');
    expect(texts).not.toContain('五步完成清理');
    expect(texts).not.toContain('五步流程');
    expect(renderer.root.findByProps({ testID: 'landing-screen' })).toBeTruthy();
    expect(renderer.root.findByProps({ testID: 'landing-scroll-view' })).toBeTruthy();
    const statusCardStyle = flattenStyle(
      renderer.root.findByProps({ testID: 'landing-status-card' }).props.style,
    );
    expect(statusCardStyle.backgroundColor).toBe('transparent');
    expect(statusCardStyle.borderWidth).toBe(0);
    expect(statusCardStyle.shadowOpacity).toBe(0);
    expect(statusCardStyle.elevation).toBe(0);
    expect(renderer.root.findAllByProps({ testID: 'landing-feature-row' })).toHaveLength(2);
    expect(renderer.root.findByProps({ testID: 'landing-primary-action' })).toBeTruthy();
  });

  it('persists workspace entry and replaces the landing page when the CTA is pressed', async () => {
    let renderer!: ReturnType<typeof TestRenderer.create>;

    await act(async () => {
      renderer = TestRenderer.create(
        <LandingScreen
          navigation={{
            replace: runtime.replace,
          }}
        />,
      );
      await flushPromises();
    });

    await act(async () => {
      await renderer.root.findByProps({ testID: 'landing-primary-action' }).props.onPress();
    });

    expect(runtime.saveHasEnteredWorkspace).toHaveBeenCalledWith(true);
    expect(runtime.requestMediaLibraryPermissionsAsync).not.toHaveBeenCalled();
    expect(runtime.replace).toHaveBeenCalledWith('Main', {
      screen: 'Photos',
      params: { autoStartScan: true },
    });
  });

  it('uses accurate pending-permission copy and starts the scan flow after one CTA tap', async () => {
    runtime.getMediaLibraryPermissionsAsync.mockResolvedValue({ granted: false });
    let renderer!: ReturnType<typeof TestRenderer.create>;

    await act(async () => {
      renderer = TestRenderer.create(
        <LandingScreen
          navigation={{
            replace: runtime.replace,
          }}
        />,
      );
      await flushPromises();
    });

    const texts = collectTexts(renderer);

    expect(texts).toContain('需要媒体权限');
    expect(texts).toContain('进入工作区后授权即可开始扫描');
    expect(texts).toContain('进入工作区后授权，即可识别重复、模糊与相似内容');
    expect(texts).toContain('进入工作区并授权');

    await act(async () => {
      await renderer.root.findByProps({ testID: 'landing-primary-action' }).props.onPress();
    });

    expect(runtime.requestMediaLibraryPermissionsAsync).toHaveBeenCalledTimes(1);
    expect(runtime.saveHasEnteredWorkspace).toHaveBeenCalledWith(true);
    expect(runtime.replace).toHaveBeenCalledWith('Main', {
      screen: 'Photos',
      params: { autoStartScan: true },
    });
  });
});
