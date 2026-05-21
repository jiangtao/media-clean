import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { describe, expect, it, vi } from 'vitest';

const trackError = vi.hoisted(() => vi.fn());

vi.mock('../observability', () => ({
  getAppObservability: () => ({
    status: {
      mode: 'noop',
      reason: 'firebase-service-files-missing',
    },
    trackScreen: vi.fn(),
    trackEvent: vi.fn(),
    trackError,
  }),
}));

vi.mock('react-native', () => ({
  StyleSheet: {
    create: (styles: Record<string, unknown>) => styles,
  },
  Text: ({ children }: { children: React.ReactNode }) => React.createElement('Text', null, children),
  View: ({ children }: { children: React.ReactNode }) => React.createElement('View', null, children),
}));

vi.mock('../../ui/primitives', () => ({
  Button: ({
    children,
    onPress,
  }: {
    children: React.ReactNode;
    onPress?: () => void;
  }) => React.createElement('Pressable', { onPress }, children),
  Card: ({ children }: { children: React.ReactNode }) => React.createElement('View', null, children),
  Text: ({ children }: { children: React.ReactNode }) => React.createElement('Text', null, children),
}));

import { AppErrorBoundary } from '../AppErrorBoundary';

function Boom(): React.ReactElement | null {
  throw new Error('render boom');
  return null;
}

type RenderNode = {
  children?: Array<RenderNode | string | null>;
} | null;

function collectText(node: RenderNode | RenderNode[]): string[] {
  if (!node) {
    return [];
  }

  if (Array.isArray(node)) {
    return node.flatMap(collectText);
  }

  return (node.children ?? []).flatMap((child): string[] => {
    if (typeof child === 'string') {
      return [child];
    }

    return child ? collectText(child) : [];
  });
}

describe('AppErrorBoundary', () => {
  it('records render failures through observability and shows a fallback screen', async () => {
    let renderer: any = null;

    await act(async () => {
      renderer = TestRenderer.create(
        <AppErrorBoundary language="zh-CN">
          {React.createElement(Boom)}
        </AppErrorBoundary>,
      );
    });

    expect(trackError).toHaveBeenCalledWith(
      'app_render_error',
      expect.any(Error),
      expect.objectContaining({
        has_component_stack: 'true',
      }),
    );
    expect(collectText(renderer?.toJSON())).toEqual(
      expect.arrayContaining(['应用遇到渲染错误', '当前版本未接入远程监控。请重试，或稍后重新打开应用。', '重试']),
    );
  });
});
