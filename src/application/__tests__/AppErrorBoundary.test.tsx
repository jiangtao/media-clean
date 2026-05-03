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
  Pressable: ({ children, onPress }: { children: React.ReactNode; onPress?: () => void }) =>
    React.createElement('Pressable', { onPress }, children),
  StyleSheet: {
    create: (styles: Record<string, unknown>) => styles,
  },
  Text: ({ children }: { children: React.ReactNode }) => React.createElement('Text', null, children),
  View: ({ children }: { children: React.ReactNode }) => React.createElement('View', null, children),
}));

import { AppErrorBoundary } from '../AppErrorBoundary';

function Boom(): React.ReactElement | null {
  throw new Error('render boom');
  return null;
}

describe('AppErrorBoundary', () => {
  it('records render failures through observability and shows a fallback screen', async () => {
    let renderer: any = null;

    await act(async () => {
      renderer = TestRenderer.create(
        <AppErrorBoundary>
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
    expect(renderer?.toJSON()).toMatchObject({
      children: expect.arrayContaining([
        expect.objectContaining({ children: ['应用遇到渲染错误'] }),
      ]),
    });
  });
});
