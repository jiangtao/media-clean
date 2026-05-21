import { NativeEventEmitter, NativeModules, Platform } from 'react-native';

import type { CleanupCandidate } from '../../domain/recognition/types';
import type { AnalyzedMediaInput } from '../../domain/recognition/scoring';

import {
  buildScanOutputFromAnalyzedInputs,
  scanMediaLibrary,
  type ScanCheckpoint,
  type ScanMediaLibraryOptions,
  type ScanOutput,
  type ScanProgress,
} from './scan-media-library';

export type AndroidNativeScanExecutionMode = 'native' | 'legacy';

export type AndroidNativeScanFallbackReason =
  | 'non-android-platform'
  | 'feature-flag-disabled'
  | 'native-module-unavailable'
  | 'native-runner-missing'
  | 'native-execution-failed';

class AndroidNativeScanStoppedError extends Error {
  constructor(message = 'Android native scan was stopped.') {
    super(message);
    this.name = 'AndroidNativeScanStoppedError';
  }
}

export interface AndroidNativeScanStartOptions {
  jobId: string;
  recycleBinIds: readonly string[];
  sourceCandidates: readonly CleanupCandidate[];
  language: string;
  falsePositiveIds: readonly string[];
  recycleBinCandidateCache: readonly CleanupCandidate[];
  resumeAfterAssetId?: string | null;
  displayProgressCurrent?: number;
  displayProgressTotal?: number;
  displayProgressCompletedOffset?: number;
}

interface AndroidNativeScanExecutionProfile {
  pipelineVersion: 'android-v1-non-ai';
  requiresEmbeddings: false;
  recognitionDimensions: readonly [
    'blur',
    'duplicate',
    'near-similar',
    'accidental',
    'quality',
  ];
}

interface AndroidNativeScanProgressEvent extends Partial<ScanProgress> {
  jobId?: string;
  analyzedAssetId?: string;
  analyzedInput?: AnalyzedMediaInput | null;
  analyzedMediaType?: ScanProgress['analyzedMediaType'];
}

interface AndroidNativeScanCheckpointEvent extends ScanCheckpoint {
  jobId?: string;
}

interface AndroidNativeScanCompleteEvent {
  jobId?: string;
  scannedCount?: number;
  scannedAt?: number;
  completedCount?: number;
}

interface AndroidNativeScanErrorEvent {
  jobId?: string;
  message?: string;
  error?: string;
  stack?: string;
}

interface AndroidNativeScanStoppedEvent {
  jobId?: string;
  message?: string;
}

export interface AndroidNativeScanRuntimeStatus {
  jobId: string;
  phase: 'running' | 'completed' | 'failed' | 'stopped' | string;
  current: number;
  total: number;
  processedCount: number;
  currentFileName: string | null;
  lastProcessedAssetId: string | null;
  startedAt: number;
  updatedAt: number;
  lastHeartbeatAt?: number;
  lastError?: string | null;
}

export interface AndroidNativeScanRuntimeSnapshot {
  status: AndroidNativeScanRuntimeStatus;
  analyzedInputs: AnalyzedMediaInput[];
}

export interface AndroidNativeRunningScanRuntime {
  status: AndroidNativeScanRuntimeStatus;
  snapshot: AndroidNativeScanRuntimeSnapshot | null;
}

interface AndroidNativeScanModule {
  isSupported?: () => Promise<boolean> | boolean;
  getStatus?: () => Promise<AndroidNativeScanRuntimeStatus | null> | AndroidNativeScanRuntimeStatus | null;
  getSnapshot?: () => Promise<AndroidNativeScanRuntimeSnapshot | null> | AndroidNativeScanRuntimeSnapshot | null;
  start?: (options: {
    jobId: string;
    language: string;
    resumeAfterAssetId?: string | null;
    displayProgressCurrent?: number;
    displayProgressTotal?: number;
    displayProgressCompletedOffset?: number;
    executionProfile: AndroidNativeScanExecutionProfile;
    assets: readonly Record<string, unknown>[];
  }) => Promise<void> | void;
  stop?: () => Promise<void> | void;
  addListener?: (eventName: string) => void;
  removeListeners?: (count: number) => void;
}

export interface AndroidNativeScanBridgeOptions extends AndroidNativeScanStartOptions {
  onProgress?: ScanMediaLibraryOptions['onProgress'];
  onCheckpoint?: ScanMediaLibraryOptions['onCheckpoint'];
}

export interface AndroidNativeScanFacadeOptions {
  jobId: string;
  recycleBinIds: string[];
  sourceCandidates: readonly CleanupCandidate[];
  language: string;
  displayProgressCurrent?: number;
  displayProgressTotal?: number;
  displayProgressCompletedOffset?: number;
  legacyOptions: ScanMediaLibraryOptions;
  runLegacyScan?: (
    recycleBinIds: string[],
    options: ScanMediaLibraryOptions,
  ) => Promise<ScanOutput>;
  runNativeScan?: (options: AndroidNativeScanBridgeOptions) => Promise<ScanOutput>;
  attachToRunningIfPresent?: boolean;
  nativeRunningScan?: AndroidNativeRunningScanRuntime | null;
  nativeRuntimeSnapshot?: AndroidNativeScanRuntimeSnapshot | null;
  featureFlagEnabled?: boolean;
}

export interface AndroidNativeScanExecutionResult {
  mode: AndroidNativeScanExecutionMode;
  fallbackReason: AndroidNativeScanFallbackReason | null;
  output: ScanOutput;
}

interface AndroidNativeDisplayProgressInput {
  current: number;
  total: number;
  dirtyAssetCount: number;
  displayProgressCurrent?: number;
  displayProgressTotal?: number;
  displayProgressCompletedOffset?: number;
}

const ANDROID_NATIVE_SCAN_PROGRESS_EVENT = 'AndroidNativeScanExecutorProgress';
const ANDROID_NATIVE_SCAN_CHECKPOINT_EVENT = 'AndroidNativeScanExecutorCheckpoint';
const ANDROID_NATIVE_SCAN_COMPLETE_EVENT = 'AndroidNativeScanExecutorComplete';
const ANDROID_NATIVE_SCAN_ERROR_EVENT = 'AndroidNativeScanExecutorError';
const ANDROID_NATIVE_SCAN_STOPPED_EVENT = 'AndroidNativeScanExecutorStopped';
const ANDROID_NATIVE_SCAN_EXECUTION_PROFILE: AndroidNativeScanExecutionProfile = {
  pipelineVersion: 'android-v1-non-ai',
  requiresEmbeddings: false,
  recognitionDimensions: ['blur', 'duplicate', 'near-similar', 'accidental', 'quality'],
};

function getAndroidNativeScanModule() {
  return (NativeModules.AndroidNativeScanExecutor as AndroidNativeScanModule | undefined) ?? null;
}

function createNativeScanError(event: AndroidNativeScanErrorEvent | unknown) {
  if (event instanceof Error) {
    return event;
  }

  if (typeof event === 'string') {
    return new Error(event);
  }

  if (event && typeof event === 'object') {
    const payload = event as AndroidNativeScanErrorEvent;
    return new Error(payload.message ?? payload.error ?? 'Android native scan failed.');
  }

  return new Error('Android native scan failed.');
}

function runStopIfAvailable(nativeModule: AndroidNativeScanModule | null) {
  if (!nativeModule?.stop) {
    return;
  }

  void Promise.resolve(nativeModule.stop()).catch(() => undefined);
}

function canStartAndroidNativeScan(nativeModule: AndroidNativeScanModule | null) {
  return Boolean(nativeModule?.start);
}

function buildNativeAssetDescriptors(sourceCandidates: readonly CleanupCandidate[]) {
  return sourceCandidates.map((candidate) => ({
    id: candidate.id,
    uri: candidate.asset.uri,
    previewUri: candidate.asset.previewUri ?? null,
    mediaType: candidate.asset.mediaType,
    width: candidate.asset.width,
    height: candidate.asset.height,
    orientation: candidate.asset.orientation ?? null,
    duration: candidate.asset.duration,
    fileSize: candidate.asset.fileSize,
    creationTime: candidate.asset.creationTime,
  }));
}

function normalizeProgressCount(value: number | null | undefined) {
  return Math.max(0, Math.floor(value ?? 0));
}

function resolveAndroidNativeDisplayProgress(input: AndroidNativeDisplayProgressInput) {
  const current = normalizeProgressCount(input.current);
  const total = normalizeProgressCount(input.total);
  const dirtyAssetCount = normalizeProgressCount(input.dirtyAssetCount);
  const displayTotal = normalizeProgressCount(input.displayProgressTotal);
  const completedOffset = normalizeProgressCount(
    input.displayProgressCurrent ?? input.displayProgressCompletedOffset,
  );
  const shouldApplyDisplayOffset = displayTotal > total && total === dirtyAssetCount;

  if (!shouldApplyDisplayOffset) {
    return {
      current: Math.min(current, total > 0 ? total : current),
      total,
    };
  }

  return {
    current: Math.min(completedOffset + current, displayTotal),
    total: displayTotal,
  };
}

function buildProgressPercentage(progress: { current: number; total: number }) {
  return progress.total > 0 ? (progress.current / progress.total) * 100 : 0;
}

export async function isAndroidNativeScanSupported() {
  if (Platform.OS !== 'android') {
    return false;
  }

  const nativeModule = getAndroidNativeScanModule();
  if (!nativeModule?.isSupported) {
    return false;
  }

  return Promise.resolve(nativeModule.isSupported()).catch(() => false);
}

export async function stopAndroidNativeScan() {
  runStopIfAvailable(getAndroidNativeScanModule());
}

export async function loadActiveAndroidNativeScanSnapshot() {
  if (Platform.OS !== 'android') {
    return null;
  }

  const nativeModule = getAndroidNativeScanModule();
  if (!nativeModule?.getSnapshot) {
    return null;
  }

  return Promise.resolve(nativeModule.getSnapshot()).catch(() => null);
}

export async function loadActiveAndroidNativeScanRuntime() {
  if (Platform.OS !== 'android') {
    return null;
  }

  const nativeModule = getAndroidNativeScanModule();
  if (!nativeModule?.getStatus && !nativeModule?.getSnapshot) {
    return null;
  }

  const [status, snapshot] = await Promise.all([
    nativeModule.getStatus
      ? Promise.resolve(nativeModule.getStatus()).catch(() => null)
      : Promise.resolve(null),
    nativeModule.getSnapshot
      ? Promise.resolve(nativeModule.getSnapshot()).catch(() => null)
      : Promise.resolve(null),
  ]);

  const resolvedSnapshot = snapshot ?? null;
  const resolvedStatus =
    status ??
    resolvedSnapshot?.status ??
    null;

  if (!resolvedStatus) {
    return null;
  }

  return {
    status: resolvedStatus,
    snapshot: resolvedSnapshot,
  } satisfies AndroidNativeRunningScanRuntime;
}

function buildOutputFromAnalyzedInputs(
  options: AndroidNativeScanBridgeOptions,
  analyzedInputsById: ReadonlyMap<string, AnalyzedMediaInput>,
  scannedAt?: number,
  scannedCount?: number,
) {
  return buildScanOutputFromAnalyzedInputs(
    [...analyzedInputsById.values()],
    options.recycleBinIds,
    {
      falsePositiveIds: options.falsePositiveIds,
      recycleBinCandidateCache: options.recycleBinCandidateCache,
      scannedAt,
      scannedCount,
    },
  );
}

async function completeEmptyAndroidNativeScan(
  options: AndroidNativeScanBridgeOptions,
): Promise<ScanOutput> {
  const completedAt = Date.now();
  const progressTotal = Math.max(0, Math.floor(options.displayProgressTotal ?? 0));

  options.onProgress?.({
    current: progressTotal,
    total: progressTotal,
    currentFileName: '',
    isScanning: false,
    percentage: progressTotal > 0 ? 100 : 0,
  });

  await Promise.resolve(
    options.onCheckpoint?.({
      current: progressTotal,
      total: progressTotal,
      currentFileName: null,
      processedCount: 0,
      lastProcessedAssetId: null,
      analyzedInputs: [],
    }),
  );

  return buildOutputFromAnalyzedInputs(options, new Map(), completedAt, 0);
}

async function observeAndroidNativeScan(
  options: AndroidNativeScanBridgeOptions,
  observeOptions?: {
    startNative?: boolean;
    initialRuntime?: AndroidNativeRunningScanRuntime | null;
  },
): Promise<ScanOutput> {
  const nativeModule = getAndroidNativeScanModule();
  if (!nativeModule || (observeOptions?.startNative !== false && !nativeModule.start)) {
    throw new Error('Android native scan executor is unavailable.');
  }
  const nativeStart = nativeModule.start;

  const emitter = new NativeEventEmitter(nativeModule as never);

  return new Promise<ScanOutput>((resolve, reject) => {
    let settled = false;
    const analyzedInputsById = new Map<string, AnalyzedMediaInput>();
    const shouldStartNative = observeOptions?.startNative !== false;

    const cleanup = (shouldStop = false) => {
      progressSubscription.remove();
      checkpointSubscription.remove();
      completeSubscription.remove();
      errorSubscription.remove();
      stoppedSubscription.remove();

      if (shouldStop) {
        runStopIfAvailable(nativeModule);
      }
    };

    const resolveOnce = (output: ScanOutput) => {
      if (settled) {
        return;
      }

      settled = true;
      cleanup(shouldStartNative);
      resolve(output);
    };

    const rejectOnce = (error: unknown) => {
      if (settled) {
        return;
      }

      settled = true;
      cleanup(shouldStartNative);
      reject(createNativeScanError(error));
    };

    const progressSubscription = emitter.addListener(
      ANDROID_NATIVE_SCAN_PROGRESS_EVENT,
      (event: AndroidNativeScanProgressEvent) => {
        if (event.jobId && event.jobId !== options.jobId) {
          return;
        }

        if (event.analyzedAssetId && event.analyzedInput) {
          analyzedInputsById.set(event.analyzedAssetId, event.analyzedInput);
        }

        const displayProgress = resolveAndroidNativeDisplayProgress({
          current: event.current ?? 0,
          total: event.total ?? 0,
          dirtyAssetCount: options.sourceCandidates.length,
          displayProgressCurrent: options.displayProgressCurrent,
          displayProgressTotal: options.displayProgressTotal,
          displayProgressCompletedOffset: options.displayProgressCompletedOffset,
        });

        options.onProgress?.({
          current: displayProgress.current,
          total: displayProgress.total,
          currentFileName: event.currentFileName ?? '',
          isScanning: event.isScanning ?? true,
          percentage: buildProgressPercentage(displayProgress),
          analyzedAssetId: event.analyzedAssetId,
          analyzedInput: event.analyzedInput ?? null,
          analyzedMediaType: event.analyzedMediaType,
        });
      },
    );

    const checkpointSubscription = emitter.addListener(
      ANDROID_NATIVE_SCAN_CHECKPOINT_EVENT,
      (event: AndroidNativeScanCheckpointEvent) => {
        if (event.jobId && event.jobId !== options.jobId) {
          return;
        }

        event.analyzedInputs?.forEach((analyzedInput) => {
          analyzedInputsById.set(analyzedInput.asset.id, analyzedInput);
        });

        const displayProgress = resolveAndroidNativeDisplayProgress({
          current: event.current,
          total: event.total,
          dirtyAssetCount: options.sourceCandidates.length,
          displayProgressCurrent: options.displayProgressCurrent,
          displayProgressTotal: options.displayProgressTotal,
          displayProgressCompletedOffset: options.displayProgressCompletedOffset,
        });

        void Promise.resolve(
          options.onCheckpoint?.({
            ...event,
            current: displayProgress.current,
            total: displayProgress.total,
          }),
        ).catch(rejectOnce);
      },
    );

    const completeSubscription = emitter.addListener(
      ANDROID_NATIVE_SCAN_COMPLETE_EVENT,
      (event: AndroidNativeScanCompleteEvent) => {
        if (event.jobId && event.jobId !== options.jobId) {
          return;
        }

        const output = buildOutputFromAnalyzedInputs(
          options,
          analyzedInputsById,
          event.scannedAt,
          event.scannedCount ?? event.completedCount,
        );

        resolveOnce(output);
      },
    );

    const errorSubscription = emitter.addListener(
      ANDROID_NATIVE_SCAN_ERROR_EVENT,
      (event: AndroidNativeScanErrorEvent) => {
        if (event.jobId && event.jobId !== options.jobId) {
          return;
        }

        rejectOnce(event);
      },
    );

    const stoppedSubscription = emitter.addListener(
      ANDROID_NATIVE_SCAN_STOPPED_EVENT,
      (event: AndroidNativeScanStoppedEvent) => {
        if (event.jobId && event.jobId !== options.jobId) {
          return;
        }

        rejectOnce(new AndroidNativeScanStoppedError(event.message));
      },
    );

    const applyInitialRuntime = (runtime: AndroidNativeRunningScanRuntime) => {
      runtime.snapshot?.analyzedInputs.forEach((analyzedInput) => {
        analyzedInputsById.set(analyzedInput.asset.id, analyzedInput);
      });

      const displayProgress = resolveAndroidNativeDisplayProgress({
        current: runtime.status.current,
        total: runtime.status.total,
        dirtyAssetCount: options.sourceCandidates.length,
        displayProgressCurrent: options.displayProgressCurrent,
        displayProgressTotal: options.displayProgressTotal,
        displayProgressCompletedOffset: options.displayProgressCompletedOffset,
      });

      options.onProgress?.({
        current: displayProgress.current,
        total: displayProgress.total,
        currentFileName: runtime.status.currentFileName ?? '',
        isScanning: runtime.status.phase === 'running',
        percentage: buildProgressPercentage(displayProgress),
      });

      if (runtime.snapshot?.analyzedInputs.length) {
        void Promise.resolve(
          options.onCheckpoint?.({
            current: displayProgress.current,
            total: displayProgress.total,
            currentFileName: runtime.status.currentFileName ?? null,
            processedCount: runtime.status.processedCount,
            lastProcessedAssetId: runtime.status.lastProcessedAssetId,
            analyzedInputs: runtime.snapshot.analyzedInputs,
          }),
        ).catch(rejectOnce);
      }

      if (runtime.status.phase === 'completed') {
        resolveOnce(
          buildOutputFromAnalyzedInputs(
            options,
            analyzedInputsById,
            runtime.status.updatedAt,
            runtime.status.total,
          ),
        );
      }
    };

    try {
      if (!shouldStartNative) {
        void Promise.resolve(
          observeOptions?.initialRuntime ?? loadActiveAndroidNativeScanRuntime(),
        )
          .then((runtime) => {
            if (!runtime || runtime.status.phase !== 'running') {
              throw new Error('No running Android native scan is available to attach.');
            }

            applyInitialRuntime(runtime);
          })
          .catch(rejectOnce);
        return;
      }

      if (shouldStartNative) {
        void Promise.resolve(
          nativeStart?.({
            jobId: options.jobId,
            language: options.language,
            resumeAfterAssetId: options.resumeAfterAssetId ?? null,
            displayProgressCurrent: options.displayProgressCurrent,
            displayProgressTotal: options.displayProgressTotal,
            displayProgressCompletedOffset: options.displayProgressCompletedOffset,
            executionProfile: ANDROID_NATIVE_SCAN_EXECUTION_PROFILE,
            assets: buildNativeAssetDescriptors(options.sourceCandidates),
          }),
        ).catch(rejectOnce);
      }
    } catch (error) {
      rejectOnce(error);
    }
  });
}

async function startAndroidNativeScan(
  options: AndroidNativeScanBridgeOptions,
): Promise<ScanOutput> {
  return observeAndroidNativeScan(options, { startNative: true });
}

export async function attachToRunningAndroidNativeScan(
  options: AndroidNativeScanBridgeOptions,
  runtime?: AndroidNativeRunningScanRuntime | null,
): Promise<ScanOutput> {
  const initialRuntime =
    runtime ??
    (await loadActiveAndroidNativeScanRuntime()) ??
    null;

  if (!initialRuntime || initialRuntime.status.phase !== 'running') {
    throw new Error('No running Android native scan is available to attach.');
  }

  return observeAndroidNativeScan(options, {
    startNative: false,
    initialRuntime,
  });
}

export async function executeAndroidNativeFirstScan(
  options: AndroidNativeScanFacadeOptions,
): Promise<AndroidNativeScanExecutionResult> {
  const runLegacyScan = options.runLegacyScan ?? scanMediaLibrary;
  const runLegacyFallback = async (
    fallbackReason: AndroidNativeScanFallbackReason,
  ): Promise<AndroidNativeScanExecutionResult> => ({
    mode: 'legacy',
    fallbackReason,
    output: await runLegacyScan(options.recycleBinIds, options.legacyOptions),
  });

  const nativeScanOptions: AndroidNativeScanBridgeOptions = {
    jobId: options.jobId,
    recycleBinIds: options.recycleBinIds,
    sourceCandidates: options.sourceCandidates,
    language: options.language,
    falsePositiveIds: [...(options.legacyOptions.falsePositiveIds ?? [])],
    recycleBinCandidateCache: [...(options.legacyOptions.recycleBinCandidateCache ?? [])],
    resumeAfterAssetId: options.legacyOptions.resumeAfterAssetId ?? null,
    displayProgressCurrent: options.displayProgressCurrent,
    displayProgressTotal: options.displayProgressTotal,
    displayProgressCompletedOffset: options.displayProgressCompletedOffset,
    onProgress: options.legacyOptions.onProgress,
    onCheckpoint: options.legacyOptions.onCheckpoint,
  };
  const nativeRunningScan =
    options.nativeRunningScan ??
    (options.nativeRuntimeSnapshot
      ? {
          status: options.nativeRuntimeSnapshot.status,
          snapshot: options.nativeRuntimeSnapshot,
        }
      : null);

  if (Platform.OS !== 'android') {
    return runLegacyFallback('non-android-platform');
  }

  if (
    options.sourceCandidates.length === 0 &&
    typeof options.displayProgressTotal === 'number' &&
    options.displayProgressTotal >= 0
  ) {
    return {
      mode: 'native',
      fallbackReason: null,
      output: await completeEmptyAndroidNativeScan(nativeScanOptions),
    };
  }

  if (options.featureFlagEnabled === false) {
    return runLegacyFallback('feature-flag-disabled');
  }

  const nativeSupported = await isAndroidNativeScanSupported();
  if (!nativeSupported) {
    return runLegacyFallback('native-module-unavailable');
  }

  if (
    !options.runNativeScan &&
    !(options.attachToRunningIfPresent && nativeRunningScan?.status.phase === 'running') &&
    !canStartAndroidNativeScan(getAndroidNativeScanModule())
  ) {
    return runLegacyFallback('native-runner-missing');
  }

  if (
    options.attachToRunningIfPresent &&
    nativeRunningScan?.status.phase === 'running'
  ) {
    try {
      return {
        mode: 'native',
        fallbackReason: null,
        output: await attachToRunningAndroidNativeScan(nativeScanOptions, nativeRunningScan),
      };
    } catch {
      return runLegacyFallback('native-execution-failed');
    }
  }

  const runNativeScan = options.runNativeScan ?? startAndroidNativeScan;

  try {
    return {
      mode: 'native',
      fallbackReason: null,
      output: await runNativeScan(nativeScanOptions),
    };
  } catch (error) {
    if (error instanceof AndroidNativeScanStoppedError) {
      throw error;
    }

    return runLegacyFallback('native-execution-failed');
  }
}
