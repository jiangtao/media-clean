import { describe, expect, it, vi } from 'vitest';

import { createObservabilityFacade, OBSERVABILITY_EVENTS } from '../observability';

describe('observability facade', () => {
  it('falls back to noop when Firebase service files are missing', () => {
    const logger = {
      warn: vi.fn(),
      error: vi.fn(),
    };

    const observability = createObservabilityFacade({
      firebase: {
        serviceFilesAvailable: false,
        androidGoogleServicesFile: './google-services.json',
        iosGoogleServicesFile: './GoogleService-Info.plist',
        useFrameworks: 'static',
      },
      logger,
    });

    expect(observability.status.mode).toBe('noop');
    expect(observability.status.reason).toBe('firebase-service-files-missing');

    expect(() =>
      observability.trackEvent(OBSERVABILITY_EVENTS.scanStart, {
        session_id: 'session-1',
      }),
    ).not.toThrow();
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('routes through a supplied Firebase adapter when configuration is ready', () => {
    const adapter = {
      trackScreen: vi.fn(),
      trackEvent: vi.fn(),
      trackError: vi.fn(),
    };
    const logger = {
      warn: vi.fn(),
      error: vi.fn(),
    };

    const observability = createObservabilityFacade({
      firebase: {
        serviceFilesAvailable: true,
        androidGoogleServicesFile: './google-services.json',
        iosGoogleServicesFile: './GoogleService-Info.plist',
        useFrameworks: 'static',
      },
      logger,
      firebaseAdapterFactory: () => adapter,
    });

    observability.trackScreen(OBSERVABILITY_EVENTS.landingView, {
      source: 'landing',
    });
    observability.trackEvent(OBSERVABILITY_EVENTS.landingEnterWorkspace, {
      source: 'landing-cta',
    });
    observability.trackError(OBSERVABILITY_EVENTS.appRenderError, new Error('boom'), {
      source: 'boundary',
    });

    expect(observability.status.mode).toBe('firebase');
    expect(observability.status.reason).toBe('firebase-ready');
    expect(adapter.trackScreen).toHaveBeenCalledWith(OBSERVABILITY_EVENTS.landingView, {
      source: 'landing',
    });
    expect(adapter.trackEvent).toHaveBeenCalledWith(OBSERVABILITY_EVENTS.landingEnterWorkspace, {
      source: 'landing-cta',
    });
    expect(adapter.trackError).toHaveBeenCalledWith(
      OBSERVABILITY_EVENTS.appRenderError,
      expect.any(Error),
      {
        source: 'boundary',
      },
    );
    expect(logger.warn).not.toHaveBeenCalled();
  });
});
