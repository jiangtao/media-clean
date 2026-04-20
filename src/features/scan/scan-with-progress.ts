import { useState, useCallback, useRef } from 'react';

export interface ScanProgress {
  current: number;
  total: number;
  currentFileName: string;
  isScanning: boolean;
  percentage: number;
}

export interface ScanResult {
  id: string;
  fileName: string;
  hasIssues: boolean;
  issueType?: 'accidental' | 'abnormal' | 'duplicate';
}

export interface ScanWithProgressOptions {
  total: number;
  onProgress: (progress: ScanProgress) => void;
  onComplete: (results: { scanned: number; found: number; items: ScanResult[] }) => void;
  onCancel: () => void;
  onError?: (error: Error) => void;
}

export interface ScanWithProgressState {
  isScanning: boolean;
  isCancelled: boolean;
  currentProgress: ScanProgress | null;
}

export interface ScanWithProgressReturn {
  isScanning: () => boolean;
  isCancelled: () => boolean;
  getProgress: () => ScanProgress | null;
  getAnalyzedCount: () => number;
  start: (options: ScanWithProgressOptions) => Promise<{
    cancelled: boolean;
    analyzedCount: number;
    results: ScanResult[];
  }>;
  cancel: () => void;
  reset: () => void;
}

export function createScanWithProgress(): ScanWithProgressReturn {
  let isCancelled = false;
  let isScanning = false;
  let analyzedCount = 0;
  let currentProgress: ScanProgress | null = null;

  const generateFileName = (index: number): string => {
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

export function useScanWithProgress() {
  const scannerRef = useRef(createScanWithProgress());

  const [state, setState] = useState<ScanWithProgressState>({
    isScanning: false,
    isCancelled: false,
    currentProgress: null,
  });

  const start = useCallback(
    async (options: ScanWithProgressOptions) => {
      setState((prev) => ({
        ...prev,
        isScanning: true,
        isCancelled: false,
      }));

      const result = await scannerRef.current.start({
        ...options,
        onProgress: (progress) => {
          setState((prev) => ({ ...prev, currentProgress: progress }));
          options.onProgress(progress);
        },
        onComplete: (results) => {
          setState((prev) => ({ ...prev, isScanning: false }));
          options.onComplete(results);
        },
        onCancel: () => {
          setState((prev) => ({ ...prev, isScanning: false, isCancelled: true }));
          options.onCancel();
        },
      });

      return result;
    },
    []
  );

  const cancel = useCallback(() => {
    scannerRef.current.cancel();
    setState((prev) => ({ ...prev, isCancelled: true }));
  }, []);

  const reset = useCallback(() => {
    scannerRef.current.reset();
    setState({
      isScanning: false,
      isCancelled: false,
      currentProgress: null,
    });
  }, []);

  return {
    ...state,
    start,
    cancel,
    reset,
    scanner: scannerRef.current,
  };
}
