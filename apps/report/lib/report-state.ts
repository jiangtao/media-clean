import fsp from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import type {
  CleanupPlanDocument,
  ClusterCategory,
  MediaCleanSession,
  SessionAsset,
} from '@/lib/report-contract';

const REPORT_STATE_FILE = 'report-state.json';
const REPORT_STATE_SCHEMA_VERSION = 'media-clean-report-state/v0.1';
const FILE_CHECK_CONCURRENCY = 64;

interface ReportState {
  schemaVersion: string;
  updatedAt: string;
  trashedAssetIds: string[];
}

export function reportStatePathForSession(sessionPath: string) {
  return path.join(path.dirname(sessionPath), REPORT_STATE_FILE);
}

export function reportStatePathForPlan(planPath: string) {
  return path.join(path.dirname(planPath), REPORT_STATE_FILE);
}

export async function readTrashedAssetIdsForSession(sessionPath: string) {
  const state = await readReportState(reportStatePathForSession(sessionPath));
  return new Set(state.trashedAssetIds);
}

export async function readTrashedAssetIdsForPlan(planPath: string) {
  const state = await readReportState(reportStatePathForPlan(planPath));
  return new Set(state.trashedAssetIds);
}

export async function markTrashedAssetsForPlan(planPath: string, assetIds: Iterable<string>) {
  const statePath = reportStatePathForPlan(planPath);
  const state = await readReportState(statePath);
  const nextAssetIds = new Set(state.trashedAssetIds);
  for (const assetId of assetIds) nextAssetIds.add(assetId);

  const nextState: ReportState = {
    schemaVersion: REPORT_STATE_SCHEMA_VERSION,
    updatedAt: new Date().toISOString(),
    trashedAssetIds: [...nextAssetIds].sort(),
  };
  await fsp.writeFile(statePath, `${JSON.stringify(nextState, null, 2)}\n`);
  return statePath;
}

export async function collectMissingLocalAssetIds(assets: SessionAsset[], ignoredAssetIds = new Set<string>()) {
  const missing = new Set<string>();
  let index = 0;

  await Promise.all(
    Array.from({ length: FILE_CHECK_CONCURRENCY }, async () => {
      while (index < assets.length) {
        const asset = assets[index];
        index += 1;
        if (!asset || ignoredAssetIds.has(asset.id)) continue;
        if (!(await localAssetExists(asset))) missing.add(asset.id);
      }
    }),
  );

  return missing;
}

export function pruneReportDocuments(
  session: MediaCleanSession,
  cleanupPlan: CleanupPlanDocument | null,
  omittedAssetIds: Set<string>,
) {
  if (omittedAssetIds.size === 0) {
    return { session, cleanupPlan };
  }

  const assets = session.assets.filter((asset) => !omittedAssetIds.has(asset.id));
  const clusters = session.clusters
    .map((cluster) => {
      const assetIds = cluster.assetIds.filter((assetId) => !omittedAssetIds.has(assetId));
      return {
        ...cluster,
        assetIds,
        representativeAssetId: assetIds.includes(cluster.representativeAssetId)
          ? cluster.representativeAssetId
          : assetIds[0] ?? cluster.representativeAssetId,
      };
    })
    .filter((cluster) => cluster.assetIds.length >= minimumClusterAssetCount(cluster.category));
  const keptClusterIds = new Set(clusters.map((cluster) => cluster.id));
  const cleanupPlans = session.cleanupPlans
    .map((plan) => ({
      ...plan,
      assetIds: plan.assetIds.filter((assetId) => !omittedAssetIds.has(assetId)),
    }))
    .filter((plan) => plan.assetIds.length > 0 && keptClusterIds.has(plan.clusterId));
  const nextCleanupPlan = cleanupPlan
    ? {
        ...cleanupPlan,
        assets: cleanupPlan.assets.filter((asset) => !omittedAssetIds.has(asset.id)),
        plans: cleanupPlan.plans
          .map((plan) => ({
            ...plan,
            assetIds: plan.assetIds.filter((assetId) => !omittedAssetIds.has(assetId)),
          }))
          .filter((plan) => plan.assetIds.length > 0 && keptClusterIds.has(plan.clusterId)),
      }
    : null;

  return {
    session: {
      ...session,
      assets,
      clusters,
      cleanupPlans,
    },
    cleanupPlan: nextCleanupPlan,
  };
}

export function successfulTrashAssetIds(
  actions: Array<{
    status: string;
    assetIds?: string[];
  }>,
) {
  const successStatuses = new Set(['completed', 'trashed']);
  const assetIds = new Set<string>();
  for (const action of actions) {
    if (!successStatuses.has(action.status.toLowerCase())) continue;
    for (const assetId of action.assetIds ?? []) assetIds.add(assetId);
  }
  return assetIds;
}

async function readReportState(statePath: string): Promise<ReportState> {
  try {
    const state = JSON.parse(await fsp.readFile(statePath, 'utf8')) as Partial<ReportState>;
    return {
      schemaVersion: state.schemaVersion ?? REPORT_STATE_SCHEMA_VERSION,
      updatedAt: state.updatedAt ?? '',
      trashedAssetIds: Array.isArray(state.trashedAssetIds) ? state.trashedAssetIds : [],
    };
  } catch (error) {
    if (isNodeError(error) && error.code === 'ENOENT') {
      return {
        schemaVersion: REPORT_STATE_SCHEMA_VERSION,
        updatedAt: '',
        trashedAssetIds: [],
      };
    }
    throw error;
  }
}

async function localAssetExists(asset: SessionAsset) {
  if (!asset.uri.startsWith('file://')) return true;
  try {
    await fsp.access(fileURLToPath(asset.uri));
    return true;
  } catch {
    return false;
  }
}

function minimumClusterAssetCount(category: ClusterCategory) {
  return category === 'duplicate' || category === 'near_similar' ? 2 : 1;
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error;
}
