import { beforeEach, describe, expect, it, vi } from 'vitest';

const sqliteState = vi.hoisted(() => ({
  activeRunStatements: 0,
  maxActiveRunStatements: 0,
  openDatabaseAsync: vi.fn(),
}));

vi.mock('expo-sqlite', () => ({
  openDatabaseAsync: sqliteState.openDatabaseAsync,
}));

import {
  __resetOperationalStoreForTests,
  clearOperationalPersistentScanCache,
  clearOperationalPhotoScanResultCache,
  deleteOperationalAssetRecords,
  hasOperationalStoreImportedLegacyAsyncStorage,
  loadOperationalPhotoScanResultCache,
  loadOperationalRecognitionGroups,
  loadOperationalUserDecisions,
  recordOperationalUserDecisions,
  saveOperationalPhotoScanResultCache,
  saveOperationalScanBatch,
  upsertOperationalAssetManifestEntries,
  type OperationalAssetManifestRecord,
  type OperationalScanBatchRecord,
} from './operational-store';
import type { PhotoScanResultCache } from '../app-storage';

function delay(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}

function createFakeDatabase() {
  let candidateViewMeta: { summary_json: string } | null = null;
  let candidateViewRows: Array<{
    asset_id: string;
    rank: number;
    candidate_json: string;
    updated_at: number;
  }> = [];
  let recognitionGroupRows: Array<{
    group_id: string;
    relation: string;
    size: number;
    similarity: number;
    representative_asset_id: string;
    representative_reason: string;
    representative_width: number;
    representative_height: number;
    representative_file_size: number;
    representative_creation_time: number;
    updated_at: number;
  }> = [];
  let recognitionMemberRows: Array<{
    group_id: string;
    asset_id: string;
    candidate_id: string;
    role: string;
    updated_at: number;
  }> = [];
  let userDecisionRows: Array<{
    asset_id: string;
    candidate_id: string | null;
    decision: string;
    source: string;
    reason: string | null;
    decided_at: number;
    updated_at: number;
    snapshot_json: string | null;
  }> = [];

  const database = {
    execAsync: vi.fn(async () => undefined),
    getAllAsync: vi.fn(async (sql: string) => {
      if (sql.includes('FROM candidate_view')) {
        return [...candidateViewRows].sort(
          (left, right) =>
            left.rank - right.rank ||
            right.updated_at - left.updated_at ||
            left.asset_id.localeCompare(right.asset_id),
        );
      }
      if (sql.includes('FROM recognition_group')) {
        return [...recognitionGroupRows].sort(
          (left, right) =>
            right.updated_at - left.updated_at || left.group_id.localeCompare(right.group_id),
        );
      }
      if (sql.includes('FROM recognition_member')) {
        return [...recognitionMemberRows].sort(
          (left, right) =>
            left.group_id.localeCompare(right.group_id) ||
            left.asset_id.localeCompare(right.asset_id),
        );
      }
      if (sql.includes('FROM user_decision')) {
        return [...userDecisionRows].sort(
          (left, right) =>
            right.decided_at - left.decided_at ||
            left.asset_id.localeCompare(right.asset_id),
        );
      }

      return [];
    }),
    getFirstAsync: vi.fn(async (sql: string) => {
      if (sql.includes('FROM candidate_view_meta')) {
        return candidateViewMeta;
      }

      return null;
    }),
    runAsync: vi.fn(async (sql: string, ...params: unknown[]) => {
      sqliteState.activeRunStatements += 1;
      sqliteState.maxActiveRunStatements = Math.max(
        sqliteState.maxActiveRunStatements,
        sqliteState.activeRunStatements,
      );

      await delay(5);

      if (sql.includes('DELETE FROM candidate_view_meta')) {
        candidateViewMeta = null;
      } else if (sql.includes('DELETE FROM candidate_view')) {
        candidateViewRows = [];
      } else if (sql.includes('DELETE FROM recognition_member')) {
        if (sql.includes('WHERE asset_id')) {
          const ids = new Set(params.map(String));
          recognitionMemberRows = recognitionMemberRows.filter(
            (row) => !ids.has(row.asset_id) && !ids.has(row.candidate_id),
          );
        } else {
          recognitionMemberRows = [];
        }
      } else if (sql.includes('DELETE FROM recognition_group')) {
        if (sql.includes('representative_asset_id')) {
          const ids = new Set(params.map(String));
          recognitionGroupRows = recognitionGroupRows.filter(
            (row) => !ids.has(row.representative_asset_id),
          );
        } else if (sql.includes('NOT IN')) {
          const memberGroupIds = new Set(recognitionMemberRows.map((row) => row.group_id));
          recognitionGroupRows = recognitionGroupRows.filter((row) =>
            memberGroupIds.has(row.group_id),
          );
        } else {
          recognitionGroupRows = [];
        }
      } else if (sql.includes('INSERT INTO candidate_view_meta')) {
        candidateViewMeta = {
          summary_json: String(params[1]),
        };
      } else if (sql.includes('INSERT INTO candidate_view')) {
        candidateViewRows.push({
          asset_id: String(params[0]),
          rank: Number(params[2]),
          candidate_json: String(params[6]),
          updated_at: Number(params[7]),
        });
      } else if (sql.includes('INSERT INTO recognition_group')) {
        recognitionGroupRows.push({
          group_id: String(params[0]),
          relation: String(params[1]),
          size: Number(params[2]),
          similarity: Number(params[3]),
          representative_asset_id: String(params[4]),
          representative_reason: String(params[5]),
          representative_width: Number(params[6]),
          representative_height: Number(params[7]),
          representative_file_size: Number(params[8]),
          representative_creation_time: Number(params[9]),
          updated_at: Number(params[10]),
        });
      } else if (sql.includes('INSERT INTO recognition_member')) {
        recognitionMemberRows.push({
          group_id: String(params[0]),
          asset_id: String(params[1]),
          candidate_id: String(params[2]),
          role: String(params[3]),
          updated_at: Number(params[4]),
        });
      } else if (sql.includes('INSERT INTO user_decision')) {
        const row = {
          asset_id: String(params[0]),
          candidate_id: params[1] === null ? null : String(params[1]),
          decision: String(params[2]),
          source: String(params[3]),
          reason: params[4] === null ? null : String(params[4]),
          decided_at: Number(params[5]),
          updated_at: Number(params[6]),
          snapshot_json: params[7] === null ? null : String(params[7]),
        };
        userDecisionRows = [
          ...userDecisionRows.filter((existing) => existing.asset_id !== row.asset_id),
          row,
        ];
      }

      sqliteState.activeRunStatements -= 1;
    }),
    withExclusiveTransactionAsync: vi.fn(async (callback: (transaction: typeof database) => Promise<void>) => {
      await callback(database);
    }),
    __replaceCandidateViewRows: (rows: typeof candidateViewRows) => {
      candidateViewRows = rows;
    },
  };

  return database;
}

const samplePhotoScanResultCache: PhotoScanResultCache = {
  activeCandidates: [
    {
      id: 'candidate-1',
      asset: {
        id: 'asset-1',
        uri: 'file:///camera/asset-1.jpg',
        mediaType: 'photo',
        width: 1280,
        height: 960,
        duration: 0,
        fileSize: 120_000,
        creationTime: 1_710_000_000_000,
      },
      score: 88,
      confidence: 'high',
      kind: 'duplicate-photo',
      primaryIssueType: 'duplicate',
      issueTypes: ['duplicate'],
      reasons: ['Reference copy'],
      duplicateGroup: {
        groupId: 'group-1',
        representativeId: 'asset-1',
        relation: 'near',
        size: 2,
        similarity: 0.93,
        representativeReason: 'higher-resolution',
        representativeWidth: 1280,
        representativeHeight: 960,
        representativeFileSize: 120_000,
        representativeCreationTime: 1_710_000_000_000,
      },
    },
    {
      id: 'candidate-2',
      asset: {
        id: 'asset-2',
        uri: 'file:///camera/asset-2.jpg',
        mediaType: 'photo',
        width: 1280,
        height: 960,
        duration: 0,
        fileSize: 121_000,
        creationTime: 1_710_000_100_000,
      },
      score: 64,
      confidence: 'medium',
      kind: 'duplicate-photo',
      primaryIssueType: 'duplicate',
      issueTypes: ['duplicate'],
      reasons: ['Near duplicate'],
      duplicateGroup: {
        groupId: 'group-1',
        representativeId: 'asset-1',
        relation: 'near',
        size: 2,
        similarity: 0.93,
        representativeReason: 'higher-resolution',
        representativeWidth: 1280,
        representativeHeight: 960,
        representativeFileSize: 120_000,
        representativeCreationTime: 1_710_000_000_000,
      },
    },
  ],
  summary: {
    scannedAt: 1_710_000_300_000,
    scannedCount: 24,
    candidateCount: 2,
    highConfidenceCount: 1,
    mediumConfidenceCount: 1,
    recycleBinCount: 0,
  },
};

function createBatch(batchId: string, updatedAt: number): OperationalScanBatchRecord {
  return {
    batchId,
    mode: 'rolling-window',
    windowDays: 90,
    rangeStartAt: 1_709_000_000_000,
    rangeEndAt: 1_710_000_000_000,
    phase: 'analysis',
    progressCurrent: 0,
    progressTotal: 3,
    enumeratedCount: 3,
    dirtyCount: 3,
    analyzedCount: 0,
    candidateCount: 0,
    startedAt: 1_710_000_000_000,
    lastHeartbeatAt: updatedAt,
    completedAt: null,
    lastError: null,
    updatedAt,
  };
}

function createManifestEntry(assetId: string): OperationalAssetManifestRecord {
  return {
    assetId,
    contentUri: `file:///camera/${assetId}.jpg`,
    mediaType: 'photo',
    mimeType: 'image/jpeg',
    width: 1280,
    height: 960,
    orientation: null,
    aspectRatio: 4 / 3,
    durationMs: 0,
    fileSizeBytes: 120_000,
    dateTaken: 1_710_000_000_000,
    dateModified: 1_710_000_000_000,
    bucketId: null,
    bucketName: null,
    isScreenshot: false,
    bitrate: null,
    frameRate: null,
    codec: null,
    firstSeenAt: 1_710_000_000_000,
    lastSeenAt: 1_710_000_000_000,
    isDeleted: false,
    dirtyReason: 'new',
    updatedAt: 1_710_000_000_000,
  };
}

describe('SQLite operational store queue', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sqliteState.activeRunStatements = 0;
    sqliteState.maxActiveRunStatements = 0;
    sqliteState.openDatabaseAsync.mockResolvedValue(createFakeDatabase());
    __resetOperationalStoreForTests();
  });

  it('serializes concurrent native statements on the shared Expo SQLite database', async () => {
    await hasOperationalStoreImportedLegacyAsyncStorage();
    sqliteState.activeRunStatements = 0;
    sqliteState.maxActiveRunStatements = 0;

    await Promise.all([
      saveOperationalScanBatch(createBatch('batch-1', 1_710_000_000_100)),
      saveOperationalScanBatch(createBatch('batch-2', 1_710_000_000_200)),
      upsertOperationalAssetManifestEntries([
        createManifestEntry('asset-1'),
        createManifestEntry('asset-2'),
      ]),
    ]);

    expect(sqliteState.maxActiveRunStatements).toBe(1);
  });

  it('persists photo scan results through candidate_view rows and meta', async () => {
    await saveOperationalPhotoScanResultCache(samplePhotoScanResultCache);

    await expect(loadOperationalPhotoScanResultCache()).resolves.toEqual(
      samplePhotoScanResultCache,
    );
  });

  it('persists duplicate groups through recognition_group and recognition_member rows', async () => {
    await saveOperationalPhotoScanResultCache(samplePhotoScanResultCache);

    await expect(loadOperationalRecognitionGroups()).resolves.toEqual([
      {
        groupId: 'group-1',
        relation: 'near',
        size: 2,
        similarity: 0.93,
        representativeAssetId: 'asset-1',
        representativeReason: 'higher-resolution',
        representativeWidth: 1280,
        representativeHeight: 960,
        representativeFileSize: 120_000,
        representativeCreationTime: 1_710_000_000_000,
        memberAssetIds: ['asset-1', 'asset-2'],
        updatedAt: samplePhotoScanResultCache.summary.scannedAt,
      },
    ]);
  });

  it('clears duplicate groups with the photo scan result cache', async () => {
    await saveOperationalPhotoScanResultCache(samplePhotoScanResultCache);
    await expect(loadOperationalRecognitionGroups()).resolves.toHaveLength(1);

    await clearOperationalPhotoScanResultCache();

    await expect(loadOperationalRecognitionGroups()).resolves.toEqual([]);
  });

  it('prunes duplicate group members during asset deletion', async () => {
    await saveOperationalPhotoScanResultCache(samplePhotoScanResultCache);

    await deleteOperationalAssetRecords(['asset-2']);

    await expect(loadOperationalRecognitionGroups()).resolves.toEqual([
      {
        groupId: 'group-1',
        relation: 'near',
        size: 2,
        similarity: 0.93,
        representativeAssetId: 'asset-1',
        representativeReason: 'higher-resolution',
        representativeWidth: 1280,
        representativeHeight: 960,
        representativeFileSize: 120_000,
        representativeCreationTime: 1_710_000_000_000,
        memberAssetIds: ['asset-1'],
        updatedAt: samplePhotoScanResultCache.summary.scannedAt,
      },
    ]);
  });

  it('upserts durable user decisions independently from scan cache records', async () => {
    await recordOperationalUserDecisions([
      {
        assetId: 'asset-1',
        candidateId: 'candidate-1',
        decision: 'recycled',
        source: 'manual',
        reason: 'move-to-recycle-bin',
        decidedAt: 1_710_000_300_000,
        updatedAt: 1_710_000_300_000,
        snapshotJson: JSON.stringify(samplePhotoScanResultCache.activeCandidates[0]),
      },
      {
        assetId: 'asset-1',
        candidateId: 'candidate-1',
        decision: 'kept',
        source: 'manual',
        reason: 'marked-false-positive',
        decidedAt: 1_710_000_400_000,
        updatedAt: 1_710_000_400_000,
        snapshotJson: JSON.stringify(samplePhotoScanResultCache.activeCandidates[0]),
      },
      {
        assetId: 'asset-2',
        candidateId: 'candidate-2',
        decision: 'restored',
        source: 'manual',
        reason: 'restore-from-recycle-bin',
        decidedAt: 1_710_000_410_000,
        updatedAt: 1_710_000_410_000,
        snapshotJson: JSON.stringify(samplePhotoScanResultCache.activeCandidates[1]),
      },
      {
        assetId: 'asset-3',
        candidateId: 'candidate-3',
        decision: 'deleted',
        source: 'manual',
        reason: 'hard-delete',
        decidedAt: 1_710_000_420_000,
        updatedAt: 1_710_000_420_000,
        snapshotJson: null,
      },
      {
        assetId: 'asset-4',
        candidateId: 'candidate-4',
        decision: 'failed',
        source: 'manual',
        reason: 'analysis failed',
        decidedAt: 1_710_000_430_000,
        updatedAt: 1_710_000_430_000,
        snapshotJson: null,
      },
      {
        assetId: 'asset-5',
        candidateId: 'candidate-5',
        decision: 'recycled',
        source: 'manual',
        reason: 'move-to-recycle-bin',
        decidedAt: 1_710_000_440_000,
        updatedAt: 1_710_000_440_000,
        snapshotJson: null,
      },
    ]);

    await expect(loadOperationalUserDecisions()).resolves.toEqual([
      {
        assetId: 'asset-5',
        candidateId: 'candidate-5',
        decision: 'recycled',
        source: 'manual',
        reason: 'move-to-recycle-bin',
        decidedAt: 1_710_000_440_000,
        updatedAt: 1_710_000_440_000,
        snapshotJson: null,
      },
      {
        assetId: 'asset-4',
        candidateId: 'candidate-4',
        decision: 'failed',
        source: 'manual',
        reason: 'analysis failed',
        decidedAt: 1_710_000_430_000,
        updatedAt: 1_710_000_430_000,
        snapshotJson: null,
      },
      {
        assetId: 'asset-3',
        candidateId: 'candidate-3',
        decision: 'deleted',
        source: 'manual',
        reason: 'hard-delete',
        decidedAt: 1_710_000_420_000,
        updatedAt: 1_710_000_420_000,
        snapshotJson: null,
      },
      {
        assetId: 'asset-2',
        candidateId: 'candidate-2',
        decision: 'restored',
        source: 'manual',
        reason: 'restore-from-recycle-bin',
        decidedAt: 1_710_000_410_000,
        updatedAt: 1_710_000_410_000,
        snapshotJson: JSON.stringify(samplePhotoScanResultCache.activeCandidates[1]),
      },
      {
        assetId: 'asset-1',
        candidateId: 'candidate-1',
        decision: 'kept',
        source: 'manual',
        reason: 'marked-false-positive',
        decidedAt: 1_710_000_400_000,
        updatedAt: 1_710_000_400_000,
        snapshotJson: JSON.stringify(samplePhotoScanResultCache.activeCandidates[0]),
      },
    ]);
  });

  it('keeps durable user decisions when persistent scan cache is cleared', async () => {
    const decision = {
      assetId: 'asset-1',
      candidateId: 'candidate-1',
      decision: 'recycled' as const,
      source: 'manual' as const,
      reason: 'move-to-recycle-bin',
      decidedAt: 1_710_000_300_000,
      updatedAt: 1_710_000_300_000,
      snapshotJson: JSON.stringify(samplePhotoScanResultCache.activeCandidates[0]),
    };

    await recordOperationalUserDecisions([decision]);
    await clearOperationalPersistentScanCache();

    await expect(loadOperationalUserDecisions()).resolves.toEqual([decision]);
  });

  it('filters malformed candidate_view rows and recomputes summary counts', async () => {
    const database = createFakeDatabase();
    sqliteState.openDatabaseAsync.mockResolvedValue(database);
    __resetOperationalStoreForTests();

    await saveOperationalPhotoScanResultCache(samplePhotoScanResultCache);
    database.__replaceCandidateViewRows([
      {
        asset_id: samplePhotoScanResultCache.activeCandidates[0].asset.id,
        rank: 0,
        candidate_json: JSON.stringify(samplePhotoScanResultCache.activeCandidates[0]),
        updated_at: samplePhotoScanResultCache.summary.scannedAt,
      },
      {
        asset_id: 'broken-row',
        rank: 1,
        candidate_json: '{broken-json',
        updated_at: samplePhotoScanResultCache.summary.scannedAt,
      },
    ]);

    await expect(loadOperationalPhotoScanResultCache()).resolves.toEqual({
      activeCandidates: [samplePhotoScanResultCache.activeCandidates[0]],
      summary: {
        ...samplePhotoScanResultCache.summary,
        candidateCount: 1,
        highConfidenceCount: 1,
        mediumConfidenceCount: 0,
      },
    });
  });
});
