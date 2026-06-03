export interface ScanDirectoryOptions {
  root: string;
  sessionId?: string;
  sessionPath?: string;
  cleanupPlanPath?: string;
  mediaType?: 'all' | 'photo' | 'video';
  progress?: boolean;
  videoFrameTimeoutMs?: number;
  videoFrameCache?: boolean;
}

export interface ScanDirectoryResult {
  mode: 'napi';
  sessionId: string;
  session: string;
  cleanupPlan: string;
  assetCount: number;
  clusterCount: number;
  cleanupPlanCount: number;
  diagnosticCount: number;
}

export function analyzeRequest(request: unknown): unknown;
export function scanDirectory(options: ScanDirectoryOptions): ScanDirectoryResult;
