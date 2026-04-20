import { beforeEach, describe, expect, it, vi } from 'vitest';
import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';

import { getAppTheme } from '../../../theme/app-theme';
import { ScanProgress } from '../ScanProgress';

const theme = getAppTheme('light');
const darkTheme = getAppTheme('dark');

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

function renderScanProgress(
  overrides: Partial<React.ComponentProps<typeof ScanProgress>> = {},
) {
  let renderer!: ReturnType<typeof TestRenderer.create>;

  act(() => {
    renderer = TestRenderer.create(
      <ScanProgress
        isVisible
        current={40}
        total={360}
        currentFileName="IMG_0040.JPG"
        resultsCount={0}
        theme={theme}
        locale="zh-CN"
        {...overrides}
      />,
    );
  });

  return renderer;
}

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

describe('ScanProgress', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it('renders nothing when hidden and incomplete', () => {
    const renderer = renderScanProgress({
      isVisible: false,
      current: 0,
      total: 0,
      currentFileName: null,
    });

    expect(renderer.toJSON()).toBeNull();
  });

  it('renders an inline progress pipeline while scanning', () => {
    const renderer = renderScanProgress();
    const texts = collectTexts(renderer);

    expect(renderer.root.findByProps({ testID: 'scan-progress-inline' })).toBeTruthy();
    expect(renderer.root.findByProps({ testID: 'scan-progress-track' })).toBeTruthy();
    expect(renderer.root.findByProps({ testID: 'scan-progress-fill' })).toBeTruthy();
    expect(renderer.root.findByProps({ testID: 'scan-progress-motion-layer' })).toBeTruthy();
    expect(renderer.root.findByProps({ testID: 'scan-progress-wake' })).toBeTruthy();
    expect(renderer.root.findByProps({ testID: 'scan-progress-shimmer' })).toBeTruthy();
    expect(texts).toContain('扫描中');
    expect(texts).toContain('40/360');
    expect(texts).not.toContain('IMG_0040.JPG');
    expect(texts).toContain('取消');
  });

  it('renders the completion summary in the same inline block and places the abnormal result between title and progress', () => {
    const renderer = renderScanProgress({
      current: 360,
      total: 360,
      currentFileName: 'IMG_0360.JPG',
      resultsCount: 18,
    });
    const texts = collectTexts(renderer);
    const statusIndex = texts.indexOf('扫描完成');
    const resultIndex = texts.indexOf('发现 18 个异常媒体');
    const countIndex = texts.indexOf('360/360');

    expect(texts).toContain('扫描完成');
    expect(texts).toContain('360/360');
    expect(texts).toContain('发现 18 个异常媒体');
    expect(statusIndex).toBeGreaterThanOrEqual(0);
    expect(resultIndex).toBeGreaterThan(statusIndex);
    expect(countIndex).toBeGreaterThan(resultIndex);
    expect(texts).not.toContain('取消');
  });

  it('does not render the abnormal badge when the scan completes without abnormal media', () => {
    const renderer = renderScanProgress({
      current: 360,
      total: 360,
      resultsCount: 0,
    });

    expect(collectTexts(renderer)).not.toContain('发现 0 个异常媒体');
    expect(
      renderer.root.findAllByProps({ testID: 'scan-progress-result-badge' }),
    ).toHaveLength(0);
  });

  it('keeps the completion summary visible even if visibility is toggled off later', () => {
    const renderer = renderScanProgress({
      current: 360,
      total: 360,
      resultsCount: 9,
    });

    act(() => {
      renderer.update(
        <ScanProgress
          isVisible={false}
          current={360}
          total={360}
          currentFileName={null}
          resultsCount={9}
          theme={theme}
          locale="zh-CN"
        />,
      );
    });

    expect(renderer.root.findByProps({ testID: 'scan-progress-inline' })).toBeTruthy();
    expect(collectTexts(renderer)).toContain('发现 9 个异常媒体');
  });

  it('uses theme-aware abnormal colors for the completion hint', () => {
    const renderer = renderScanProgress({
      current: 360,
      total: 360,
      resultsCount: 9,
      theme: darkTheme,
    });

    const badge = renderer.root.findByProps({ testID: 'scan-progress-result-badge' });
    const badgeText = renderer.root.findByProps({ testID: 'scan-progress-result-text' });
    const badgeStyle = flattenStyle(badge.props.style);
    const badgeTextStyle = flattenStyle(badgeText.props.style);

    expect(badgeStyle.backgroundColor).toBe(darkTheme.noticeBackground);
    expect(badgeStyle.borderColor).toBe(darkTheme.noticeBorder);
    expect(badgeTextStyle.color).toBe(darkTheme.noticeTitle);
  });

  it('calls onCancel from the inline action button', () => {
    const onCancel = vi.fn();
    const renderer = renderScanProgress({ onCancel });

    act(() => {
      renderer.root.findByProps({ testID: 'cancel-scan-button' }).props.onPress();
    });

    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('does not auto-call onComplete in inline mode', async () => {
    const onComplete = vi.fn();

    renderScanProgress({
      current: 360,
      total: 360,
      resultsCount: 5,
      onComplete,
    });

    await vi.advanceTimersByTimeAsync(2_000);

    expect(onComplete).not.toHaveBeenCalled();
  });
});
