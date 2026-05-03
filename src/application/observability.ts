import { createObservabilityFacade, type ObservabilityFacade } from '../services/observability/observability';
import { firebaseObservabilityConfig } from './observability-config';

const appObservability = createObservabilityFacade({
  firebase: firebaseObservabilityConfig,
});

export function getAppObservability(): ObservabilityFacade {
  return appObservability;
}
