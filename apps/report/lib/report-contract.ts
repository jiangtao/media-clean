export type MediaType = 'photo' | 'video';
export type ClusterCategory = 'duplicate' | 'near_similar' | 'low_value' | string;

export interface Metrics {
  brightness: number;
  contrast: number;
  edgeDensity: number;
  blurScore: number;
}

export interface Hashes {
  contentHash?: string | null;
  perceptualHash?: string | null;
  differenceHash?: string | null;
  frameHashes?: string[];
}

export interface SessionAsset {
  id: string;
  uri: string;
  mediaType: MediaType;
  width: number;
  height: number;
  duration?: number | null;
  fileSize: number;
  createdAt: string;
  metrics: Metrics;
  hashes: Hashes;
}

export interface Cluster {
  id: string;
  category: ClusterCategory;
  assetIds: string[];
  representativeAssetId: string;
  score: number;
  reasons: string[];
}

export interface CleanupPlan {
  id: string;
  clusterId: string;
  action: string;
  assetIds: string[];
  requiresConfirmation: boolean;
}

export interface CleanupPlanAsset {
  id: string;
  uri: string;
  mediaType: MediaType;
  fileSize: number;
}

export interface CleanupPlanDocument {
  schemaVersion: string;
  sourceSessionId: string;
  generatedAt: string;
  plans: CleanupPlan[];
  assets: CleanupPlanAsset[];
}

export interface Diagnostic {
  code: string;
  severity: string;
  assetId?: string | null;
  message: string;
}

export interface MediaCleanSession {
  schemaVersion: string;
  sessionId: string;
  generatedAt: string;
  source: {
    kind: string;
    root: string;
    platform: string;
  };
  engine: {
    kind: string;
    name: string;
    version: string;
  };
  assets: SessionAsset[];
  clusters: Cluster[];
  cleanupPlans: CleanupPlan[];
  diagnostics: Diagnostic[];
}

export interface ReportPayload {
  session: MediaCleanSession;
  cleanupPlan: CleanupPlanDocument | null;
  paths: {
    session: string;
    cleanupPlan: string | null;
  };
  cleanupHistory: {
    assetCount: number;
    fileSize: number;
  };
  summary: {
    assetCount: number;
    clusterCount: number;
    cleanupPlanCount: number;
    diagnosticCount: number;
  };
}
