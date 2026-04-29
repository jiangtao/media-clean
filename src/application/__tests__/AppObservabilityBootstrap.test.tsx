import TestRenderer, { act } from 'react-test-renderer';
import { describe, expect, it, vi } from 'vitest';

const trackEvent = vi.hoisted(() => vi.fn());
const warn = vi.hoisted(() => vi.fn());

vi.mock('../observability', () => ({
  getAppObservability: () => ({
    status: {
      mode: 'noop',
      reason: 'firebase-service-files-missing',
    },
    trackScreen: vi.fn(),
    trackEvent,
    trackError: vi.fn(),
  }),
}));

import { AppObservabilityBootstrap } from '../AppObservabilityBootstrap';

describe('AppObservabilityBootstrap', () => {
  it('stays silent while Firebase observability is intentionally out of scope for this version', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(warn);

    await act(async () => {
      TestRenderer.create(<AppObservabilityBootstrap />);
    });

    expect(trackEvent).not.toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});
