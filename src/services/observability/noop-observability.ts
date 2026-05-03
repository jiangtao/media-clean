import type {
  ObservabilityAdapter,
  ObservabilityLogger,
} from './observability';

export function createNoopObservabilityAdapter(
  _logger: ObservabilityLogger = console,
): ObservabilityAdapter {
  return {
    trackScreen: () => undefined,
    trackEvent: () => undefined,
    trackError: () => undefined,
  };
}
