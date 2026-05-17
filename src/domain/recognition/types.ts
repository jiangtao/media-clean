export type MediaType = 'photo' | 'video';

export interface MediaAssetSnapshot {
  id: string;
  uri: string;
  previewUri?: string;
  mediaType: MediaType;
  width: number;
  height: number;
  duration: number;
  fileSize: number;
  creationTime: number;
}

export interface VisualMetrics {
  brightness: number;
  contrast: number;
  edgeDensity: number;
}

export interface MediaComparisonSignals {
  contentHash?: string | null;
}

export type CleanupConfidence = 'low' | 'medium' | 'high';
export type CleanupIssueType = 'accidental' | 'abnormal' | 'duplicate';
export type CleanupKind =
  | 'accidental-photo'
  | 'accidental-video'
  | 'abnormal-photo'
  | 'abnormal-video'
  | 'duplicate-photo'
  | 'duplicate-video';

export interface DuplicateGroup {
  groupId: string;
  representativeId: string;
  relation: 'exact' | 'near';
  size: number;
  similarity: number;
  representativeReason: 'higher-resolution' | 'larger-file' | 'newer-capture';
  representativeWidth: number;
  representativeHeight: number;
  representativeFileSize: number;
  representativeCreationTime: number;
}

export interface CleanupCandidateScanBatchRange {
  startAt: number | null;
  endAt: number | null;
}

export interface CleanupCandidate {
  id: string;
  asset: MediaAssetSnapshot;
  score: number;
  confidence: CleanupConfidence;
  kind: CleanupKind;
  primaryIssueType: CleanupIssueType;
  issueTypes: CleanupIssueType[];
  reasons: string[];
  duplicateGroup?: DuplicateGroup;
  scanBatchRange?: CleanupCandidateScanBatchRange;
}
