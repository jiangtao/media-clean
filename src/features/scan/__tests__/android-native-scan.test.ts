import { beforeEach, describe, expect, it, vi } from 'vitest';

const platformState = vi.hoisted(() => ({
  os: 'ios' as 'ios' | 'android',
  reset() {
    this.os = 'ios';
  },
}));

const nativeModulesState = vi.hoisted(() => ({
  modules: {} as Record<string, unknown>,
  reset() {
    Object.keys(this.modules).forEach((key) => {
      delete this.modules[key];
    });
  },
}));

const nativeEventsState = vi.hoisted(() => {
  const listeners = new Map<string, Set<(payload: unknown) => void>>();

  return {
    addListener(eventName: string, listener: (payload: unknown) => void) {
      if (!listeners.has(eventName)) {
        listeners.set(eventName, new Set());
      }

      listeners.get(eventName)?.add(listener);

      return {
        remove: vi.fn(() => {
          listeners.get(eventName)?.delete(listener);
        }),
      };
    },
    emit(eventName: string, payload: unknown) {
      listeners.get(eventName)?.forEach((listener) => listener(payload));
    },
    reset() {
      listeners.clear();
    },
  };
});

vi.mock('react-native', () => ({
  Platform: {
    get OS() {
      return platformState.os;
    },
    select: <T,>(options: { ios?: T; android?: T; default?: T }) =>
      options[platformState.os] ?? options.default,
  },
  NativeModules: nativeModulesState.modules,
  NativeEventEmitter: class MockNativeEventEmitter {
    addListener(eventName: string, listener: (payload: unknown) => void) {
      return nativeEventsState.addListener(eventName, listener);
    }
  },
  PixelRatio: {
    get: () => 1,
  },
  TurboModuleRegistry: {
    get: vi.fn(() => null),
  },
}));

vi.mock('expo-file-system/src/legacy', () => ({
  getInfoAsync: vi.fn(),
}));

vi.mock('expo-media-library', () => ({
  MediaType: {
    photo: 'photo',
    video: 'video',
  },
  SortBy: {
    creationTime: 'creationTime',
  },
}));

vi.mock('../../../services/media/analyze-visuals', () => ({
  analyzeVisualsForAsset: vi.fn(),
}));

vi.mock('../../../services/storage/app-storage', () => ({
  loadFalsePositiveCandidateIds: vi.fn(),
  loadMediaAnalysisCache: vi.fn(),
  saveMediaAnalysisCache: vi.fn(),
}));

const scanApi = vi.hoisted(() => ({
  scanMediaLibrary: vi.fn(),
}));

vi.mock('../scan-media-library', async (importActual) => {
  const actual = await importActual<typeof import('../scan-media-library')>();

  return {
    ...actual,
    scanMediaLibrary: scanApi.scanMediaLibrary,
  };
});

import {
  attachToRunningAndroidNativeScan,
  executeAndroidNativeFirstScan,
  isAndroidNativeScanSupported,
  loadActiveAndroidNativeScanSnapshot,
  stopAndroidNativeScan,
} from '../android-native-scan';
import type { CleanupCandidate } from '../../../domain/recognition/types';

const mockScanMediaLibrary = vi.mocked(scanApi.scanMediaLibrary);

function createAnalyzedInput(id: string) {
  return {
    asset: {
      id,
      uri: `file:///${id}.jpg`,
      previewUri: `file:///${id}.jpg`,
      mediaType: 'photo' as const,
      width: 640,
      height: 640,
      duration: 0,
      fileSize: 80_000,
      creationTime: 1_710_000_000_000,
    },
    metrics: {
      brightness: 0.03,
      contrast: 0.04,
      edgeDensity: 0.02,
    },
    fingerprint: null,
    analysisStatus: 'ok' as const,
  };
}

function createSourceCandidate(id: string): CleanupCandidate {
  const analyzedInput = createAnalyzedInput(id);

  return {
    id,
    asset: analyzedInput.asset,
    score: 82,
    confidence: 'high' as const,
    kind: 'abnormal-photo' as const,
    primaryIssueType: 'abnormal' as const,
    issueTypes: ['abnormal'],
    reasons: ['测试命中'],
  };
}

describe('android native scan facade', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    platformState.reset();
    nativeModulesState.reset();
    nativeEventsState.reset();
    mockScanMediaLibrary.mockResolvedValue({
      state: {
        activeCandidates: [],
        recycleBin: [],
        selectedIds: [],
      },
      summary: {
        scannedAt: 1_710_000_000_000,
        scannedCount: 0,
        candidateCount: 0,
        highConfidenceCount: 0,
        mediumConfidenceCount: 0,
        recycleBinCount: 0,
      },
    });
  });

  it('falls back to the legacy pipeline outside Android', async () => {
    const result = await executeAndroidNativeFirstScan({
      jobId: 'scan-job-1',
      recycleBinIds: ['recycle-1'],
      sourceCandidates: [],
      language: 'zh-CN',
      legacyOptions: {},
    });

    expect(result.mode).toBe('legacy');
    expect(result.fallbackReason).toBe('non-android-platform');
    expect(mockScanMediaLibrary).toHaveBeenCalledWith(['recycle-1'], {});
  });

  it('uses the native bridge on Android and reassembles the scan output from checkpoint chunks', async () => {
    platformState.os = 'android';
    const start = vi.fn((options: {
      jobId: string;
      assets: readonly { id: string }[];
      language: string;
      resumeAfterAssetId?: string | null;
      executionProfile: {
        pipelineVersion: string;
        requiresEmbeddings: boolean;
        recognitionDimensions: readonly string[];
      };
    }) => {
      expect(options.jobId).toBe('scan-job-2');
      expect(options.language).toBe('zh-CN');
      expect(options.assets).toHaveLength(2);
      expect(options.resumeAfterAssetId).toBe('photo-0');
      expect(options.executionProfile).toEqual({
        pipelineVersion: 'android-v1-non-ai',
        requiresEmbeddings: false,
        recognitionDimensions: ['blur', 'duplicate', 'near-similar', 'accidental', 'quality'],
      });

      nativeEventsState.emit('AndroidNativeScanExecutorProgress', {
        jobId: 'scan-job-2',
        current: 1,
        total: 2,
        currentFileName: 'IMG_001.jpg',
        isScanning: true,
        percentage: 50,
      });
      nativeEventsState.emit('AndroidNativeScanExecutorCheckpoint', {
        jobId: 'scan-job-2',
        current: 1,
        total: 2,
        currentFileName: 'IMG_001.jpg',
        processedCount: 1,
        lastProcessedAssetId: 'photo-1',
        analyzedInputs: [createAnalyzedInput('photo-1'), createAnalyzedInput('recycle-1')],
      });
      nativeEventsState.emit('AndroidNativeScanExecutorComplete', {
        jobId: 'scan-job-2',
        scannedCount: 2,
        scannedAt: 1_710_000_000_123,
      });

      return undefined;
    });
    const stop = vi.fn();

    nativeModulesState.modules.AndroidNativeScanExecutor = {
      isSupported: vi.fn(async () => true),
      start,
      stop,
    };

    const onProgress = vi.fn();
    const onCheckpoint = vi.fn();

    const result = await executeAndroidNativeFirstScan({
      jobId: 'scan-job-2',
      recycleBinIds: ['recycle-1'],
      sourceCandidates: [createSourceCandidate('photo-1'), createSourceCandidate('recycle-1')],
      language: 'zh-CN',
      legacyOptions: {
        falsePositiveIds: ['photo-1'],
        recycleBinCandidateCache: [
          {
            id: 'recycle-1',
            asset: {
              id: 'recycle-1',
              uri: 'file:///recycle-1.jpg',
              previewUri: 'file:///recycle-1.jpg',
              mediaType: 'photo',
              width: 640,
              height: 640,
              duration: 0,
              fileSize: 80_000,
              creationTime: 1_710_000_000_000,
            },
            score: 90,
            confidence: 'high',
            kind: 'abnormal-photo',
            primaryIssueType: 'abnormal',
            issueTypes: ['abnormal'],
            reasons: ['测试命中'],
          },
        ],
        resumeAfterAssetId: 'photo-0',
        onProgress,
        onCheckpoint,
      },
    });

    expect(await isAndroidNativeScanSupported()).toBe(true);
    expect(start).toHaveBeenCalledTimes(1);
    expect(stop).toHaveBeenCalledTimes(1);
    expect(mockScanMediaLibrary).not.toHaveBeenCalled();
    expect(onProgress).toHaveBeenCalledWith(
      expect.objectContaining({
        current: 1,
        total: 2,
        currentFileName: 'IMG_001.jpg',
        isScanning: true,
      }),
    );
    expect(onCheckpoint).toHaveBeenCalledWith(
      expect.objectContaining({
        current: 1,
        total: 2,
        lastProcessedAssetId: 'photo-1',
      }),
    );
    expect(result.mode).toBe('native');
    expect(result.fallbackReason).toBeNull();
    expect(result.output.summary.scannedAt).toBe(1_710_000_000_123);
    expect(result.output.summary.scannedCount).toBe(2);
    expect(result.output.state.activeCandidates).toHaveLength(0);
    expect(result.output.state.recycleBin).toHaveLength(1);
  });

  it('passes the display progress contract to the native runner separately from dirty assets', async () => {
    platformState.os = 'android';
    const start = vi.fn((options: {
      jobId: string;
      assets: readonly { id: string }[];
      displayProgressTotal?: number;
      displayProgressCurrent?: number;
      displayProgressCompletedOffset?: number;
    }) => {
      expect(options.jobId).toBe('scan-job-display-progress');
      expect(options.assets).toHaveLength(2);
      expect(options.displayProgressCurrent).toBe(3);
      expect(options.displayProgressTotal).toBe(5);
      expect(options.displayProgressCompletedOffset).toBe(3);

      nativeEventsState.emit('AndroidNativeScanExecutorProgress', {
        jobId: 'scan-job-display-progress',
        current: 1,
        total: 2,
        currentFileName: 'IMG_003.jpg',
        isScanning: true,
        percentage: 50,
        analyzedAssetId: 'photo-3',
        analyzedInput: createAnalyzedInput('photo-3'),
      });
      nativeEventsState.emit('AndroidNativeScanExecutorCheckpoint', {
        jobId: 'scan-job-display-progress',
        current: 1,
        total: 2,
        currentFileName: 'IMG_003.jpg',
        processedCount: 1,
        lastProcessedAssetId: 'photo-3',
        analyzedInputs: [createAnalyzedInput('photo-3')],
      });
      nativeEventsState.emit('AndroidNativeScanExecutorComplete', {
        jobId: 'scan-job-display-progress',
        scannedCount: 2,
        scannedAt: 1_710_000_000_456,
      });
    });

    nativeModulesState.modules.AndroidNativeScanExecutor = {
      isSupported: vi.fn(async () => true),
      start,
      stop: vi.fn(),
    };

    const onProgress = vi.fn();
    const onCheckpoint = vi.fn();
    const result = await executeAndroidNativeFirstScan({
      jobId: 'scan-job-display-progress',
      recycleBinIds: [],
      sourceCandidates: [createSourceCandidate('photo-3'), createSourceCandidate('photo-4')],
      language: 'zh-CN',
      displayProgressCurrent: 3,
      displayProgressTotal: 5,
      displayProgressCompletedOffset: 3,
      legacyOptions: {
        onProgress,
        onCheckpoint,
      },
    });

    expect(start).toHaveBeenCalledTimes(1);
    expect(onProgress).toHaveBeenCalledWith(
      expect.objectContaining({
        current: 4,
        total: 5,
        percentage: 80,
      }),
    );
    expect(onCheckpoint).toHaveBeenCalledWith(
      expect.objectContaining({
        current: 4,
        total: 5,
        processedCount: 1,
      }),
    );
    expect(result.mode).toBe('native');
    expect(result.output.summary.scannedCount).toBe(2);
  });

  it('completes an empty Android dirty-work batch without starting native or legacy scanning', async () => {
    platformState.os = 'android';
    const start = vi.fn();
    const stop = vi.fn();
    const dateNowSpy = vi.spyOn(Date, 'now').mockReturnValue(1_710_000_999_000);

    nativeModulesState.modules.AndroidNativeScanExecutor = {
      isSupported: vi.fn(async () => true),
      start,
      stop,
    };

    const onProgress = vi.fn();
    const onCheckpoint = vi.fn();

    try {
      const result = await executeAndroidNativeFirstScan({
        jobId: 'scan-job-empty-dirty-work',
        recycleBinIds: [],
        sourceCandidates: [],
        language: 'zh-CN',
        displayProgressTotal: 261,
        displayProgressCompletedOffset: 261,
        legacyOptions: {
          onProgress,
          onCheckpoint,
        },
      });

      expect(result.mode).toBe('native');
      expect(result.fallbackReason).toBeNull();
      expect(result.output.summary.scannedAt).toBe(1_710_000_999_000);
      expect(result.output.summary.scannedCount).toBe(0);
      expect(start).not.toHaveBeenCalled();
      expect(stop).not.toHaveBeenCalled();
      expect(mockScanMediaLibrary).not.toHaveBeenCalled();
      expect(onProgress).toHaveBeenCalledWith(
        expect.objectContaining({
          current: 261,
          total: 261,
          isScanning: false,
          percentage: 100,
        }),
      );
      expect(onCheckpoint).toHaveBeenCalledWith(
        expect.objectContaining({
          current: 261,
          total: 261,
          processedCount: 0,
          lastProcessedAssetId: null,
          analyzedInputs: [],
        }),
      );
    } finally {
      dateNowSpy.mockRestore();
    }
  });

  it('completes a 0/0 empty Android time-window batch without touching native or legacy scanning', async () => {
    platformState.os = 'android';
    const isSupported = vi.fn(async () => true);
    const start = vi.fn();
    const runNativeScan = vi.fn(async () => ({
      state: {
        activeCandidates: [],
        recycleBin: [],
        selectedIds: [],
      },
      summary: {
        scannedAt: 1_710_000_123_000,
        scannedCount: 99,
        candidateCount: 0,
        highConfidenceCount: 0,
        mediumConfidenceCount: 0,
        recycleBinCount: 0,
      },
    }));
    const runLegacyScan = vi.fn(async () => ({
      state: {
        activeCandidates: [],
        recycleBin: [],
        selectedIds: [],
      },
      summary: {
        scannedAt: 1_710_000_124_000,
        scannedCount: 42,
        candidateCount: 0,
        highConfidenceCount: 0,
        mediumConfidenceCount: 0,
        recycleBinCount: 0,
      },
    }));
    const dateNowSpy = vi.spyOn(Date, 'now').mockReturnValue(1_710_000_999_111);

    nativeModulesState.modules.AndroidNativeScanExecutor = {
      isSupported,
      start,
    };

    const onProgress = vi.fn();
    const onCheckpoint = vi.fn();

    try {
      const result = await executeAndroidNativeFirstScan({
        jobId: 'scan-job-empty-time-window',
        recycleBinIds: [],
        sourceCandidates: [],
        language: 'zh-CN',
        displayProgressTotal: 0,
        displayProgressCompletedOffset: 0,
        legacyOptions: {
          onProgress,
          onCheckpoint,
        },
        runNativeScan,
        runLegacyScan,
      });

      expect(result.mode).toBe('native');
      expect(result.fallbackReason).toBeNull();
      expect(result.output.summary.scannedAt).toBe(1_710_000_999_111);
      expect(result.output.summary.scannedCount).toBe(0);
      expect(isSupported).not.toHaveBeenCalled();
      expect(start).not.toHaveBeenCalled();
      expect(runNativeScan).not.toHaveBeenCalled();
      expect(runLegacyScan).not.toHaveBeenCalled();
      expect(mockScanMediaLibrary).not.toHaveBeenCalled();
      expect(onProgress).toHaveBeenCalledWith(
        expect.objectContaining({
          current: 0,
          total: 0,
          isScanning: false,
          percentage: 0,
        }),
      );
      expect(onCheckpoint).toHaveBeenCalledWith(
        expect.objectContaining({
          current: 0,
          total: 0,
          processedCount: 0,
          lastProcessedAssetId: null,
          analyzedInputs: [],
        }),
      );
    } finally {
      dateNowSpy.mockRestore();
    }
  });

  it('attaches to a running native scan without restarting it', async () => {
    platformState.os = 'android';
    const start = vi.fn();
    const stop = vi.fn();
    const getSnapshot = vi.fn(async () => ({
      status: {
        jobId: 'scan-job-live',
        phase: 'running',
        current: 5,
        total: 9,
        processedCount: 3,
        currentFileName: 'IMG_005.jpg',
        lastProcessedAssetId: 'photo-3',
        startedAt: 1_710_000_000_000,
        updatedAt: 1_710_000_000_500,
      },
      analyzedInputs: [createAnalyzedInput('photo-1')],
    }));

    nativeModulesState.modules.AndroidNativeScanExecutor = {
      isSupported: vi.fn(async () => true),
      getSnapshot,
      start,
      stop,
    };

    const onProgress = vi.fn();
    const onCheckpoint = vi.fn();
    const attachPromise = attachToRunningAndroidNativeScan({
      jobId: 'scan-job-live',
      recycleBinIds: [],
      sourceCandidates: [createSourceCandidate('photo-1')],
      language: 'zh-CN',
      falsePositiveIds: [],
      recycleBinCandidateCache: [],
      onProgress,
      onCheckpoint,
    });

    await Promise.resolve();
    await Promise.resolve();

    expect(await loadActiveAndroidNativeScanSnapshot()).toMatchObject({
      status: {
        jobId: 'scan-job-live',
        current: 5,
        total: 9,
      },
    });

    expect(start).not.toHaveBeenCalled();
    expect(onProgress).toHaveBeenCalledWith(
      expect.objectContaining({
        current: 5,
        total: 9,
        isScanning: true,
      }),
    );
    expect(onCheckpoint).toHaveBeenCalledWith(
      expect.objectContaining({
        processedCount: 3,
        lastProcessedAssetId: 'photo-3',
      }),
    );

    nativeEventsState.emit('AndroidNativeScanExecutorComplete', {
      jobId: 'scan-job-live',
      scannedCount: 9,
      scannedAt: 1_710_000_000_900,
    });

    const output = await attachPromise;
    expect(output.summary.scannedCount).toBe(9);
  });

  it('falls back to the legacy pipeline when Android native support is unavailable', async () => {
    platformState.os = 'android';

    const result = await executeAndroidNativeFirstScan({
      jobId: 'scan-job-3',
      recycleBinIds: ['recycle-1'],
      sourceCandidates: [],
      language: 'zh-CN',
      legacyOptions: { analysisConcurrency: 2 },
    });

    expect(result.mode).toBe('legacy');
    expect(result.fallbackReason).toBe('native-module-unavailable');
    expect(mockScanMediaLibrary).toHaveBeenCalledWith(['recycle-1'], {
      analysisConcurrency: 2,
    });
  });

  it('falls back to the legacy pipeline when the native runner is marked supported but start is missing', async () => {
    platformState.os = 'android';
    nativeModulesState.modules.AndroidNativeScanExecutor = {
      isSupported: vi.fn(async () => true),
    };

    const result = await executeAndroidNativeFirstScan({
      jobId: 'scan-job-4',
      recycleBinIds: ['recycle-1'],
      sourceCandidates: [createSourceCandidate('photo-1')],
      language: 'zh-CN',
      legacyOptions: {},
    });

    expect(result.mode).toBe('legacy');
    expect(result.fallbackReason).toBe('native-runner-missing');
    expect(mockScanMediaLibrary).toHaveBeenCalledWith(['recycle-1'], {});
  });

  it('keeps progress-streamed analyzed inputs in the final output even when the checkpoint chunk is empty', async () => {
    platformState.os = 'android';
    nativeModulesState.modules.AndroidNativeScanExecutor = {
      isSupported: vi.fn(async () => true),
      start: vi.fn(() => {
        nativeEventsState.emit('AndroidNativeScanExecutorProgress', {
          jobId: 'scan-job-5',
          current: 1,
          total: 1,
          currentFileName: 'IMG_005.jpg',
          isScanning: true,
          percentage: 100,
          analyzedAssetId: 'photo-1',
          analyzedInput: createAnalyzedInput('photo-1'),
        });
        nativeEventsState.emit('AndroidNativeScanExecutorCheckpoint', {
          jobId: 'scan-job-5',
          current: 1,
          total: 1,
          currentFileName: 'IMG_005.jpg',
          processedCount: 1,
          lastProcessedAssetId: 'photo-1',
          analyzedInputs: [],
        });
        nativeEventsState.emit('AndroidNativeScanExecutorComplete', {
          jobId: 'scan-job-5',
          scannedCount: 1,
          scannedAt: 1_710_000_001_000,
        });
      }),
      stop: vi.fn(),
    };

    const result = await executeAndroidNativeFirstScan({
      jobId: 'scan-job-5',
      recycleBinIds: [],
      sourceCandidates: [createSourceCandidate('photo-1')],
      language: 'zh-CN',
      legacyOptions: {},
    });

    expect(result.mode).toBe('native');
    expect(result.output.summary.scannedCount).toBe(1);
    expect(result.output.state.activeCandidates).toEqual([
      expect.objectContaining({
        id: 'photo-1',
      }),
    ]);
  });

  it('rethrows native stopped events instead of silently falling back to the legacy pipeline', async () => {
    platformState.os = 'android';
    const stop = vi.fn();

    nativeModulesState.modules.AndroidNativeScanExecutor = {
      isSupported: vi.fn(async () => true),
      start: vi.fn(() => {
        nativeEventsState.emit('AndroidNativeScanExecutorStopped', {
          jobId: 'scan-job-stop',
          message: 'User cancelled the scan.',
        });
      }),
      stop,
    };

    await expect(
      executeAndroidNativeFirstScan({
        jobId: 'scan-job-stop',
        recycleBinIds: [],
        sourceCandidates: [createSourceCandidate('photo-1')],
        language: 'zh-CN',
        legacyOptions: {},
      }),
    ).rejects.toMatchObject({
      name: 'AndroidNativeScanStoppedError',
      message: 'User cancelled the scan.',
    });

    expect(mockScanMediaLibrary).not.toHaveBeenCalled();
    expect(stop).toHaveBeenCalledTimes(1);
  });

  it('stops the native executor through the public helper', async () => {
    platformState.os = 'android';
    const stop = vi.fn();
    nativeModulesState.modules.AndroidNativeScanExecutor = {
      isSupported: vi.fn(async () => true),
      start: vi.fn(),
      stop,
    };

    await stopAndroidNativeScan();

    expect(stop).toHaveBeenCalledTimes(1);
  });
});
