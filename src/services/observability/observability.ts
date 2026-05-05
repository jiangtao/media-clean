import { createFirebaseObservabilityAdapter } from './firebase-observability';
import { createNoopObservabilityAdapter } from './noop-observability';

export type ObservabilityPrimitive = string | number | boolean | null;
export type ObservabilityParams = Record<string, ObservabilityPrimitive | undefined>;

export interface ObservabilityLogger {
  warn: Console['warn'];
  error: Console['error'];
}

export interface FirebaseObservabilityConfig {
  serviceFilesAvailable: boolean;
  androidGoogleServicesFile: string;
  iosGoogleServicesFile: string;
  useFrameworks: 'static';
}

export interface ObservabilityAdapter {
  trackScreen: (name: string, params?: ObservabilityParams) => void;
  trackEvent: (name: string, params?: ObservabilityParams) => void;
  trackError: (name: string, error: unknown, context?: ObservabilityParams) => void;
}

export type ObservabilityMode = 'firebase' | 'noop';
export type ObservabilityReason =
  | 'firebase-ready'
  | 'firebase-config-missing'
  | 'firebase-service-files-missing'
  | 'firebase-native-module-unavailable'
  | 'firebase-native-app-missing';

export interface ObservabilityStatus {
  mode: ObservabilityMode;
  reason: ObservabilityReason;
  detail?: string;
}

export interface ObservabilityFacade extends ObservabilityAdapter {
  status: ObservabilityStatus;
}

export interface ObservabilityFactoryOptions {
  firebase?: FirebaseObservabilityConfig;
  logger?: ObservabilityLogger;
  firebaseAdapterFactory?: (
    config: FirebaseObservabilityConfig,
    logger: ObservabilityLogger,
  ) => ObservabilityAdapter | null;
}

export const OBSERVABILITY_EVENTS = Object.freeze({
  appLaunch: 'app_launch',
  appReady: 'app_ready',
  appRenderError: 'app_render_error',
  appPreferencesLoadFailed: 'app_preferences_load_failed',
  appPreferencesSaveFailed: 'app_preferences_save_failed',
  cleanupReminderReconcileFailed: 'cleanup_reminder_reconcile_failed',
  landingView: 'landing_view',
  landingEnterWorkspace: 'landing_enter_workspace',
  scanStart: 'scan_start',
  scanComplete: 'scan_complete',
  scanFailed: 'scan_failed',
  cleanupKeep: 'cleanup_keep',
  cleanupHardDelete: 'cleanup_hard_delete',
} as const);

function createFacade(adapter: ObservabilityAdapter, status: ObservabilityStatus): ObservabilityFacade {
  return {
    status,
    trackScreen: adapter.trackScreen,
    trackEvent: adapter.trackEvent,
    trackError: adapter.trackError,
  };
}

export function createObservabilityFacade(
  options: ObservabilityFactoryOptions = {},
): ObservabilityFacade {
  const logger = options.logger ?? console;

  if (!options.firebase) {
    return createFacade(createNoopObservabilityAdapter(logger), {
      mode: 'noop',
      reason: 'firebase-config-missing',
      detail: 'Firebase observability config has not been reserved yet.',
    });
  }

  if (!options.firebase.serviceFilesAvailable) {
    return createFacade(createNoopObservabilityAdapter(logger), {
      mode: 'noop',
      reason: 'firebase-service-files-missing',
      detail:
        'google-services.json and GoogleService-Info.plist are still missing, so observability stays on noop fallback.',
    });
  }

  const firebaseAdapterFactory =
    options.firebaseAdapterFactory ?? createFirebaseObservabilityAdapter;
  const firebaseAdapter = firebaseAdapterFactory(options.firebase, logger);

  if (firebaseAdapter) {
    return createFacade(firebaseAdapter, {
      mode: 'firebase',
      reason: 'firebase-ready',
    });
  }

  return createFacade(createNoopObservabilityAdapter(logger), {
    mode: 'noop',
    reason: 'firebase-native-module-unavailable',
    detail: 'React Native Firebase native modules are not available yet.',
  });
}
