import type {
  FirebaseObservabilityConfig,
  ObservabilityAdapter,
  ObservabilityLogger,
  ObservabilityParams,
} from './observability';

type NativeRequire = NodeJS.Require;

function sanitizeParams(
  params?: ObservabilityParams,
): Record<string, string | number | boolean | null> | undefined {
  if (!params) {
    return undefined;
  }

  const sanitizedEntries = Object.entries(params).flatMap(([key, value]) => {
    if (value === undefined) {
      return [];
    }

    return [[key, value]] as const;
  });

  if (sanitizedEntries.length === 0) {
    return undefined;
  }

  return Object.fromEntries(sanitizedEntries);
}

function toStringAttributes(
  params?: ObservabilityParams,
): Record<string, string> | undefined {
  const sanitized = sanitizeParams(params);

  if (!sanitized) {
    return undefined;
  }

  return Object.fromEntries(
    Object.entries(sanitized).map(([key, value]) => [key, String(value)]),
  );
}

function normalizeError(error: unknown): Error {
  if (error instanceof Error) {
    return error;
  }

  if (typeof error === 'string') {
    return new Error(error);
  }

  try {
    return new Error(JSON.stringify(error));
  } catch {
    return new Error(String(error));
  }
}

function resolveCallableModule<T extends (...args: Array<unknown>) => unknown>(
  moduleValue: unknown,
): T | null {
  if (typeof moduleValue === 'function') {
    return moduleValue as T;
  }

  if (moduleValue && typeof moduleValue === 'object' && 'default' in moduleValue) {
    const defaultExport = (moduleValue as { default?: unknown }).default;
    if (typeof defaultExport === 'function') {
      return defaultExport as T;
    }
  }

  return null;
}

function loadNativeModule<T = unknown>(requireFn: NativeRequire, moduleName: string): T {
  return requireFn(moduleName) as T;
}

export function createFirebaseObservabilityAdapter(
  config: FirebaseObservabilityConfig,
  logger: ObservabilityLogger = console,
): ObservabilityAdapter | null {
  if (!config.serviceFilesAvailable) {
    return null;
  }

  try {
    const requireFn = require as NativeRequire;
    const firebaseAppModule = loadNativeModule<{
      getApps?: () => Array<unknown>;
    }>(requireFn, '@react-native-firebase/app');
    const analyticsFactory = resolveCallableModule<() => {
      logScreenView?: (params: Record<string, string | number | boolean | null>) => void;
      logEvent?: (name: string, params?: Record<string, string | number | boolean | null>) => void;
    }>(loadNativeModule(requireFn, '@react-native-firebase/analytics'));
    const crashlyticsFactory = resolveCallableModule<() => {
      setAttributes?: (attributes: Record<string, string>) => void;
      log?: (message: string) => void;
      recordError?: (error: Error) => void;
    }>(loadNativeModule(requireFn, '@react-native-firebase/crashlytics'));

    if (!analyticsFactory || !crashlyticsFactory) {
      logger.warn(
        'Firebase observability native modules are not fully available; falling back to noop observability.',
      );
      return null;
    }

    if (typeof firebaseAppModule.getApps === 'function' && firebaseAppModule.getApps().length === 0) {
      logger.warn(
        'Firebase default app is not initialized yet; falling back to noop observability.',
      );
      return null;
    }

    const analytics = analyticsFactory();
    const crashlytics = crashlyticsFactory();

    return {
      trackScreen(name, params) {
        analytics.logScreenView?.({
          screen_name: name,
          screen_class: name,
          ...sanitizeParams(params),
        });
      },
      trackEvent(name, params) {
        analytics.logEvent?.(name, sanitizeParams(params));
      },
      trackError(name, error, context) {
        const normalizedError = normalizeError(error);
        const sanitizedContext = sanitizeParams(context);
        const stringAttributes = toStringAttributes(context);

        analytics.logEvent?.(name, {
          ...sanitizedContext,
          error_name: normalizedError.name,
          error_message: normalizedError.message,
        });

        if (stringAttributes) {
          crashlytics.setAttributes?.({
            ...stringAttributes,
            error_name: normalizedError.name,
          });
        }

        crashlytics.log?.(name);
        crashlytics.recordError?.(normalizedError);
      },
    };
  } catch (error) {
    logger.warn(
      'Firebase observability native modules are unavailable; falling back to noop observability.',
      error,
    );
    return null;
  }
}
