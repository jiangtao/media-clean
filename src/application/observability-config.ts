import type { FirebaseObservabilityConfig } from '../services/observability/observability';

// v0.3 Android-first does not ship remote observability. Keep Firebase disabled
// deliberately instead of warning about missing service files at runtime.
export const firebaseObservabilityConfig: FirebaseObservabilityConfig = {
  serviceFilesAvailable: false,
  androidGoogleServicesFile: './google-services.json',
  iosGoogleServicesFile: './GoogleService-Info.plist',
  useFrameworks: 'static',
};
