export interface DesktopBridge {
  version?: () => Promise<string>;
  rendererMode?: () => Promise<string>;
  updateCheck?: () => Promise<UpdateCheckResult>;
  notificationStatus?: () => Promise<NotificationStatusResult>;
  openNotificationSettings?: () => Promise<boolean>;
  openHome?: () => Promise<void>;
  chooseDirectories?: () => Promise<string[] | { paths?: string[]; directories?: string[]; filePaths?: string[] }>;
  directoriesList?: (input: { path?: string }) => Promise<unknown>;
  scanStart?: (input: ScanStartInput) => Promise<ScanJob[] | ScanJob | { jobs?: ScanJob[] }>;
  scanList?: () => Promise<ScanJob[] | { jobs?: ScanJob[]; items?: ScanJob[] }>;
  scanCancel?: (jobId: string) => Promise<ScanJob>;
  scanSubscribe?: (listener: (jobs: ScanJob[]) => void) => () => void;
  sessionsList?: (input?: { limit?: number }) => Promise<SessionRecord[] | { sessions?: SessionRecord[]; items?: SessionRecord[] }>;
  sessionsDelete?: (input: { sessionId?: string | null; sessionPath?: string | null }) => Promise<void>;
  reportLoad?: (input: ReportInput) => Promise<ReportPayload>;
  trashConfirm?: (input: TrashInput) => Promise<TrashResult>;
  trayState?: () => Promise<TrayState>;
  trayOpenWorkbench?: () => Promise<TrayState>;
  trayOpenReview?: () => Promise<TrayState>;
  trayOpenJobReview?: (input: ReportInput) => Promise<TrayState>;
  trayChooseAndScan?: () => Promise<TrayState>;
  trayPause?: () => Promise<TrayState>;
  trayNotificationStatus?: () => Promise<NotificationStatusResult>;
  trayOpenNotificationSettings?: () => Promise<boolean>;
  trayQuit?: () => Promise<void>;
  trayClose?: () => Promise<boolean>;
  traySubscribe?: (listener: (state: TrayState) => void) => () => void;
  mediaUrl?: (assetId: string) => string;
  posterUrl?: (assetId: string) => string;
}

export interface UpdateCheckResult {
  source: 'electron-app' | (string & {});
  status?: 'reserved' | 'current' | 'available' | 'unavailable';
  provider?: string;
  releaseChannel?: string;
  workflow?: string | null;
  repo?: string | null;
  currentVersion: string;
  latestVersion?: string | null;
  latestTag?: string | null;
  releaseUrl?: string | null;
  canUpdate: boolean;
  checkedAt: string;
  message: string;
  error?: string;
}

export interface NotificationStatusResult {
  source: 'electron-notification';
  channel: 'scan';
  mode: 'dry-run';
  supported: boolean;
  canShow: boolean;
  suppressed: boolean;
  suppressedInSmoke: boolean;
  suppressedReason: 'smoke' | 'ci' | 'disabled' | 'unsupported' | null;
  appBundleId?: string | null;
  settingsTarget?: string | null;
  clickTarget: 'review-result-or-workbench';
  title: string;
}

export interface ScanStartInput {
  roots: string[];
  mediaType: string;
  sessionId: string;
}

export interface ScanJob {
  jobId?: string;
  id?: string;
  sessionId?: string;
  root?: string;
  path?: string;
  directory?: string;
  mediaType?: string;
  status?: string;
  phase?: string;
  session?: string;
  sessionPath?: string;
  cleanupPlan?: string;
  cleanupPlanPath?: string;
  progress?: {
    processed?: number;
    total?: number;
    percent?: number;
  };
  processed?: number;
  total?: number;
  percent?: number;
  assetCount?: number;
  clusterCount?: number;
  cleanupPlanCount?: number;
  diagnosticCount?: number;
  workerMode?: string;
  error?: string;
  logs?: string[];
  startedAt?: string;
  updatedAt?: string;
  completedAt?: string;
}

export interface TrayState {
  source: 'listScanJobs';
  updatedAt: string;
  jobs: ScanJob[];
  activeJobs: ScanJob[];
  completedJobs: ScanJob[];
  failedJobs: ScanJob[];
  activeCount: number;
  completedCount: number;
  failedCount: number;
  scanJobs: number;
  aggregatePercent: number;
  isScanning: boolean;
  canPause: boolean;
  canReview: boolean;
  latestCompletedJob?: ScanJob | null;
  trayIcon?: TrayIconSummary;
}

export interface TrayIconSummary {
  source: 'desktop-tray-icon';
  mode: 'brand';
  taskCount: number;
  jobs: Array<{
    jobId: string;
    status: 'active' | 'completed' | 'failed' | 'idle';
    percent: number;
  }>;
  key: string;
  assetPath?: string | null;
  fallback?: boolean;
}

export interface SessionRecord {
  id?: string;
  sessionId?: string;
  path?: string;
  sessionPath?: string;
  cleanupPlanPath?: string;
  planPath?: string;
  root?: string;
  sourceRoot?: string;
  source?: string;
  platform?: string;
  generatedAt?: string;
  createdAt?: string;
  assetCount?: number;
  clusterCount?: number;
  cleanupPlanCount?: number;
  diagnosticCount?: number;
  cleanupHistory?: {
    assetCount?: number;
    fileSize?: number;
  };
}

export interface ReportInput {
  sessionId?: string | null;
  sessionPath?: string | null;
  cleanupPlanPath?: string | null;
}

export interface ReportPayload {
  session?: {
    sessionId?: string;
    source?: {
      root?: string;
    };
    assets?: MediaAsset[];
    clusters?: MediaCluster[];
    cleanupPlans?: CleanupPlan[];
    diagnostics?: unknown[];
  };
  paths?: {
    session?: string;
    cleanupPlan?: string;
  };
  assets?: MediaAsset[];
  clusters?: MediaCluster[];
  cleanupPlan?: {
    plans?: CleanupPlan[];
  };
  candidates?: ReviewCandidate[];
  cleanupHistory?: {
    assetCount?: number;
    fileSize?: number;
  };
  summary?: {
    assetCount?: number;
    clusterCount?: number;
    cleanupPlanCount?: number;
    diagnosticCount?: number;
  };
}

export interface MediaAsset {
  id?: string;
  assetId?: string;
  uri?: string;
  path?: string;
  contentUri?: string;
  mediaType?: string;
  type?: string;
  fileSize?: number;
  size?: number;
  width?: number;
  height?: number;
  duration?: number;
  metrics?: {
    brightness?: number;
    blur?: number;
  };
}

export interface MediaCluster {
  id?: string;
  category?: string;
  assetIds?: string[];
  reasons?: string[];
  score?: number;
}

export interface CleanupPlan {
  id?: string;
  clusterId?: string;
  category?: string;
  action?: string;
  assetIds?: string[];
  reasons?: string[];
  score?: number;
}

export interface ReviewCandidate {
  id?: string;
  candidateId?: string;
  category?: string;
  primaryIssueType?: string;
  type?: string;
  title?: string;
  description?: string;
  assets?: MediaAsset[];
  assetIds?: string[];
  reasons?: string[];
  reasonCodes?: string[];
  score?: number;
  cleanupPlan?: CleanupPlan;
}

export interface NormalizedAsset extends MediaAsset {
  id: string;
  uri: string;
  mediaType: string;
  fileSize: number;
}

export interface NormalizedCandidate {
  id: string;
  category: string;
  title: string;
  description: string;
  assets: NormalizedAsset[];
  reasons: string[];
  score?: number;
  cleanupPlan?: CleanupPlan | null;
}

export interface TrashInput {
  sessionId?: string | null;
  sessionPath?: string | null;
  cleanupPlanPath?: string | null;
  assetIds: string[];
  confirm: boolean;
  mode?: 'trash' | 'delete' | 'dry-run';
  permanent?: boolean;
}

export interface TrashResult {
  mode?: string;
  planCount?: number;
  assetCount?: number;
  actions?: Array<{
    assetId?: string;
    assetIds?: string[];
    status?: string;
    error?: string;
  }>;
}

declare global {
  interface Window {
    mediaCleanDesktop?: DesktopBridge;
    mediaClean?: DesktopBridge;
  }
}
