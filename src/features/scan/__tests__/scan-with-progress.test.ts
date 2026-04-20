import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

// ============================================================================
// Types
// ============================================================================

interface ScanProgress {
  current: number;
  total: number;
  currentFileName: string;
  isScanning: boolean;
  percentage: number;
}

interface ScanResult {
  id: string;
  fileName: string;
  hasIssues: boolean;
  issueType?: 'accidental' | 'abnormal' | 'duplicate';
}

interface ScanWithProgressOptions {
  total: number;
  onProgress: (progress: ScanProgress) => void;
  onComplete: (results: { scanned: number; found: number; items: ScanResult[] }) => void;
  onCancel: () => void;
  onError?: (error: Error) => void;
}

// ============================================================================
// Scan With Progress Implementation
// ============================================================================

function createScanWithProgress() {
  let isCancelled = false;
  let isScanning = false;
  let analyzedCount = 0;
  let currentProgress: ScanProgress | null = null;

  const generateFileName = (index: number) => {
    const date = new Date(2024, 0, 1, 12, 0, index);
    const timestamp = date.toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const isPhoto = index % 3 !== 0;
    return isPhoto ? `IMG_${timestamp}.jpg` : `VID_${timestamp}.mp4`;
  };

  const analyzeItem = (index: number): ScanResult => {
    const fileName = generateFileName(index);
    // Simulate finding issues every 25 items
    const hasIssues = index % 25 === 0 && index > 0;
    const issueTypes: Array<'accidental' | 'abnormal' | 'duplicate'> = ['accidental', 'abnormal', 'duplicate'];

    return {
      id: `item-${index}`,
      fileName,
      hasIssues,
      issueType: hasIssues ? issueTypes[(index / 25) % 3] : undefined,
    };
  };

  return {
    isScanning: () => isScanning,
    isCancelled: () => isCancelled,
    getProgress: () => currentProgress,
    getAnalyzedCount: () => analyzedCount,

    async start(options: ScanWithProgressOptions) {
      isCancelled = false;
      isScanning = true;
      analyzedCount = 0;
      const results: ScanResult[] = [];

      try {
        for (let i = 0; i < options.total; i++) {
          if (isCancelled) {
            isScanning = false;
            options.onCancel();
            return {
              cancelled: true,
              analyzedCount,
              results,
            };
          }

          // Simulate analysis
          analyzedCount++;
          const result = analyzeItem(i);

          if (result.hasIssues) {
            results.push(result);
          }

          currentProgress = {
            current: analyzedCount,
            total: options.total,
            currentFileName: result.fileName,
            isScanning: true,
            percentage: Math.round((analyzedCount / options.total) * 100),
          };

          options.onProgress(currentProgress);

          // Simulate async analysis time
          await new Promise((resolve) => setTimeout(resolve, 1));
        }

        isScanning = false;
        options.onComplete({
          scanned: analyzedCount,
          found: results.length,
          items: results,
        });

        return {
          cancelled: false,
          analyzedCount,
          results,
        };
      } catch (error) {
        isScanning = false;
        options.onError?.(error as Error);
        throw error;
      }
    },

    cancel() {
      isCancelled = true;
    },

    reset() {
      isCancelled = false;
      isScanning = false;
      analyzedCount = 0;
      currentProgress = null;
    },
  };
}

// ============================================================================
// Tests - Scenario: Start Scan
// ============================================================================

describe('Scenario: Start scan with progress', () => {
  let scanner: ReturnType<typeof createScanWithProgress>;

  beforeEach(() => {
    vi.useFakeTimers();
    scanner = createScanWithProgress();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should initialize in non-scanning state', () => {
    expect(scanner.isScanning()).toBe(false);
    expect(scanner.isCancelled()).toBe(false);
    expect(scanner.getAnalyzedCount()).toBe(0);
  });

  it('should set isScanning to true when started', async () => {
    const scanPromise = scanner.start({
      total: 10,
      onProgress: vi.fn(),
      onComplete: vi.fn(),
      onCancel: vi.fn(),
    });

    expect(scanner.isScanning()).toBe(true);

    await vi.advanceTimersByTimeAsync(50);
    await scanPromise;
  });

  it('should report progress starting at 0/total', async () => {
    const onProgress = vi.fn();

    const scanPromise = scanner.start({
      total: 100,
      onProgress,
      onComplete: vi.fn(),
      onCancel: vi.fn(),
    });

    await vi.advanceTimersByTimeAsync(5);

    const firstCall = onProgress.mock.calls[0][0] as ScanProgress;
    expect(firstCall.current).toBe(1);
    expect(firstCall.total).toBe(100);
    expect(firstCall.isScanning).toBe(true);

    await vi.advanceTimersByTimeAsync(200);
    await scanPromise;
  });

  it('should report current file name being analyzed', async () => {
    const onProgress = vi.fn();

    const scanPromise = scanner.start({
      total: 5,
      onProgress,
      onComplete: vi.fn(),
      onCancel: vi.fn(),
    });

    await vi.advanceTimersByTimeAsync(50);
    await scanPromise;

    const calls = onProgress.mock.calls;
    expect(calls[0][0].currentFileName).toMatch(/IMG_.*\.jpg|VID_.*\.mp4/);
  });
});

// ============================================================================
// Tests - Scenario: Progress Updates
// ============================================================================

describe('Scenario: Progress updates during scan', () => {
  let scanner: ReturnType<typeof createScanWithProgress>;

  beforeEach(() => {
    vi.useFakeTimers();
    scanner = createScanWithProgress();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should update progress counter for each item', async () => {
    const onProgress = vi.fn();

    const scanPromise = scanner.start({
      total: 10,
      onProgress,
      onComplete: vi.fn(),
      onCancel: vi.fn(),
    });

    await vi.advanceTimersByTimeAsync(50);
    await scanPromise;

    expect(onProgress).toHaveBeenCalledTimes(10);

    // Verify sequential progress
    for (let i = 0; i < 10; i++) {
      expect(onProgress.mock.calls[i][0].current).toBe(i + 1);
    }
  });

  it('should calculate percentage correctly at 50%', async () => {
    const onProgress = vi.fn();

    const scanPromise = scanner.start({
      total: 100,
      onProgress,
      onComplete: vi.fn(),
      onCancel: vi.fn(),
    });

    await vi.advanceTimersByTimeAsync(60);

    const callAt50 = onProgress.mock.calls[49][0] as ScanProgress;
    expect(callAt50.percentage).toBe(50);

    await vi.advanceTimersByTimeAsync(100);
    await scanPromise;
  });

  it('should reach 100% at completion', async () => {
    const onProgress = vi.fn();

    const scanPromise = scanner.start({
      total: 50,
      onProgress,
      onComplete: vi.fn(),
      onCancel: vi.fn(),
    });

    await vi.advanceTimersByTimeAsync(100);
    await scanPromise;

    const lastCall = onProgress.mock.calls[onProgress.mock.calls.length - 1][0] as ScanProgress;
    expect(lastCall.percentage).toBe(100);
  });

  it('should update file name for each item', async () => {
    const onProgress = vi.fn();

    const scanPromise = scanner.start({
      total: 5,
      onProgress,
      onComplete: vi.fn(),
      onCancel: vi.fn(),
    });

    await vi.advanceTimersByTimeAsync(50);
    await scanPromise;

    const fileNames = onProgress.mock.calls.map((call) => call[0].currentFileName);

    // Each file name should be unique
    const uniqueNames = new Set(fileNames);
    expect(uniqueNames.size).toBe(5);
  });
});

// ============================================================================
// Tests - Scenario: Scan Complete
// ============================================================================

describe('Scenario: Scan completion', () => {
  let scanner: ReturnType<typeof createScanWithProgress>;

  beforeEach(() => {
    vi.useFakeTimers();
    scanner = createScanWithProgress();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should call onComplete when all items are scanned', async () => {
    const onComplete = vi.fn();

    const scanPromise = scanner.start({
      total: 10,
      onProgress: vi.fn(),
      onComplete,
      onCancel: vi.fn(),
    });

    await vi.advanceTimersByTimeAsync(50);
    await scanPromise;

    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('should report correct scan results', async () => {
    const onComplete = vi.fn();

    const scanPromise = scanner.start({
      total: 100,
      onProgress: vi.fn(),
      onComplete,
      onCancel: vi.fn(),
    });

    await vi.advanceTimersByTimeAsync(150);
    await scanPromise;

    // Every 25th item (except 0) has issues: 25, 50, 75 = 3 items
    expect(onComplete).toHaveBeenCalledWith({
      scanned: 100,
      found: 3,
      items: expect.any(Array),
    });
  });

  it('should set isScanning to false on completion', async () => {
    const scanPromise = scanner.start({
      total: 10,
      onProgress: vi.fn(),
      onComplete: vi.fn(),
      onCancel: vi.fn(),
    });

    await vi.advanceTimersByTimeAsync(50);
    await scanPromise;

    expect(scanner.isScanning()).toBe(false);
  });

  it('should include issue details in results', async () => {
    const onComplete = vi.fn();

    const scanPromise = scanner.start({
      total: 100,
      onProgress: vi.fn(),
      onComplete,
      onCancel: vi.fn(),
    });

    await vi.advanceTimersByTimeAsync(150);
    await scanPromise;

    const results = onComplete.mock.calls[0][0];
    expect(results.items.length).toBeGreaterThan(0);

    const firstIssue = results.items[0];
    expect(firstIssue).toHaveProperty('id');
    expect(firstIssue).toHaveProperty('fileName');
    expect(firstIssue).toHaveProperty('hasIssues', true);
    expect(firstIssue).toHaveProperty('issueType');
  });
});

// ============================================================================
// Tests - Scenario: Cancel Scan
// ============================================================================

describe('Scenario: Cancel scan', () => {
  let scanner: ReturnType<typeof createScanWithProgress>;

  beforeEach(() => {
    vi.useFakeTimers();
    scanner = createScanWithProgress();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should call onCancel when cancelled', async () => {
    const onCancel = vi.fn();

    const scanPromise = scanner.start({
      total: 100,
      onProgress: vi.fn(),
      onComplete: vi.fn(),
      onCancel,
    });

    // Cancel after a short delay
    setTimeout(() => scanner.cancel(), 10);

    await vi.advanceTimersByTimeAsync(50);
    await scanPromise;

    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('should stop scanning immediately when cancelled', async () => {
    const onProgress = vi.fn();

    const scanPromise = scanner.start({
      total: 100,
      onProgress,
      onComplete: vi.fn(),
      onCancel: vi.fn(),
    });

    scanner.cancel();

    const progressCountBefore = onProgress.mock.calls.length;

    await vi.advanceTimersByTimeAsync(100);
    await scanPromise;

    // Should not have processed all items
    expect(scanner.getAnalyzedCount()).toBeLessThan(100);
    expect(onProgress.mock.calls.length).toBe(progressCountBefore);
  });

  it('should set isCancelled to true when cancelled', async () => {
    const scanPromise = scanner.start({
      total: 50,
      onProgress: vi.fn(),
      onComplete: vi.fn(),
      onCancel: vi.fn(),
    });

    scanner.cancel();

    await vi.advanceTimersByTimeAsync(50);
    await scanPromise;

    expect(scanner.isCancelled()).toBe(true);
  });

  it('should not call onComplete when cancelled', async () => {
    const onComplete = vi.fn();
    const onCancel = vi.fn();

    const scanPromise = scanner.start({
      total: 50,
      onProgress: vi.fn(),
      onComplete,
      onCancel,
    });

    scanner.cancel();

    await vi.advanceTimersByTimeAsync(50);
    await scanPromise;

    expect(onComplete).not.toHaveBeenCalled();
    expect(onCancel).toHaveBeenCalled();
  });

  it('should retain partial results when cancelled', async () => {
    const onCancel = vi.fn();

    const scanPromise = scanner.start({
      total: 100,
      onProgress: vi.fn(),
      onComplete: vi.fn(),
      onCancel,
    });

    // Cancel after some progress
    setTimeout(() => scanner.cancel(), 30);

    await vi.advanceTimersByTimeAsync(100);
    const result = await scanPromise;

    expect(result.cancelled).toBe(true);
    expect(result.analyzedCount).toBeGreaterThan(0);
    expect(result.analyzedCount).toBeLessThan(100);
  });
});

// ============================================================================
// Tests - Scenario: Error Handling
// ============================================================================

describe('Scenario: Error handling', () => {
  let scanner: ReturnType<typeof createScanWithProgress>;

  beforeEach(() => {
    vi.useFakeTimers();
    scanner = createScanWithProgress();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should call onError when an error occurs', async () => {
    const onError = vi.fn();

    // Override the scanner to simulate an error
    const faultyScanner = {
      ...scanner,
      start: async (options: ScanWithProgressOptions) => {
        options.onError?.(new Error('Test error'));
        throw new Error('Test error');
      },
    };

    await expect(
      faultyScanner.start({
        total: 10,
        onProgress: vi.fn(),
        onComplete: vi.fn(),
        onCancel: vi.fn(),
        onError,
      })
    ).rejects.toThrow('Test error');

    expect(onError).toHaveBeenCalledWith(expect.any(Error));
  });
});

// ============================================================================
// Tests - Edge Cases
// ============================================================================

describe('Edge cases', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should handle scan with 0 items', async () => {
    const scanner = createScanWithProgress();
    const onComplete = vi.fn();

    const scanPromise = scanner.start({
      total: 0,
      onProgress: vi.fn(),
      onComplete,
      onCancel: vi.fn(),
    });

    await vi.advanceTimersByTimeAsync(10);
    await scanPromise;

    expect(onComplete).toHaveBeenCalledWith({
      scanned: 0,
      found: 0,
      items: [],
    });
  });

  it('should handle single item scan', async () => {
    const scanner = createScanWithProgress();
    const onProgress = vi.fn();
    const onComplete = vi.fn();

    const scanPromise = scanner.start({
      total: 1,
      onProgress,
      onComplete,
      onCancel: vi.fn(),
    });

    await vi.advanceTimersByTimeAsync(10);
    await scanPromise;

    expect(onProgress).toHaveBeenCalledTimes(1);
    expect(onProgress.mock.calls[0][0].percentage).toBe(100);
    expect(onComplete).toHaveBeenCalled();
  });

  it('should handle large scan counts', async () => {
    const scanner = createScanWithProgress();
    const onComplete = vi.fn();

    const scanPromise = scanner.start({
      total: 500,
      onProgress: vi.fn(),
      onComplete,
      onCancel: vi.fn(),
    });

    await vi.advanceTimersByTimeAsync(600);
    await scanPromise;

    expect(onComplete).toHaveBeenCalledWith(expect.objectContaining({
      scanned: 500,
    }));
  });

  it('should allow multiple scan cycles', async () => {
    const scanner = createScanWithProgress();

    // First scan
    const firstPromise = scanner.start({
      total: 10,
      onProgress: vi.fn(),
      onComplete: vi.fn(),
      onCancel: vi.fn(),
    });

    await vi.advanceTimersByTimeAsync(50);
    await firstPromise;

    scanner.reset();

    // Second scan
    const secondPromise = scanner.start({
      total: 20,
      onProgress: vi.fn(),
      onComplete: vi.fn(),
      onCancel: vi.fn(),
    });

    await vi.advanceTimersByTimeAsync(50);
    await secondPromise;

    expect(scanner.getAnalyzedCount()).toBe(20);
  });

  it('should handle rapid cancel/start cycles', async () => {
    const scanner = createScanWithProgress();
    const onCancel = vi.fn();

    // Start and immediately cancel
    const scanPromise = scanner.start({
      total: 100,
      onProgress: vi.fn(),
      onComplete: vi.fn(),
      onCancel,
    });

    scanner.cancel();

    await vi.advanceTimersByTimeAsync(50);
    await scanPromise;

    expect(onCancel).toHaveBeenCalled();

    // Start new scan
    scanner.reset();
    const newPromise = scanner.start({
      total: 50,
      onProgress: vi.fn(),
      onComplete: vi.fn(),
      onCancel: vi.fn(),
    });

    await vi.advanceTimersByTimeAsync(100);
    await newPromise;

    expect(scanner.getAnalyzedCount()).toBe(50);
  });
});
