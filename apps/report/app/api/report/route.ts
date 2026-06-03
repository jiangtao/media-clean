import fs from 'node:fs/promises';

import { NextResponse } from 'next/server';

import type { CleanupPlanDocument, MediaCleanSession, ReportPayload } from '@/lib/report-contract';
import { inferCleanupPlanPath, optionalExistingPath, resolveInputPath } from '@/lib/local-paths';
import {
  pruneReportDocuments,
  readTrashedAssetIdsForPlan,
  readTrashedAssetIdsForSession,
} from '@/lib/report-state';
import {
  loadReportDocumentsFromStore,
  persistReportRuntime,
  readTrashedAssetIdsFromStore,
} from '@/lib/report-store';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const sessionParam = url.searchParams.get('session') ?? process.env.MC_REPORT_SESSION;

  if (!sessionParam) {
    return NextResponse.json(
      {
        error:
          'Missing session. Start with `mc report .mc/<session-id>/session.json --open`.',
      },
      { status: 400 },
    );
  }

  const sessionPath = resolveInputPath(sessionParam);
  const planPath =
    optionalExistingPath(url.searchParams.get('plan') ?? process.env.MC_REPORT_PLAN ?? '') ??
    optionalExistingPath(inferCleanupPlanPath(sessionPath));

  const stored = loadReportDocumentsFromStore(sessionPath);
  const { session, cleanupPlan } =
    stored && (!planPath || stored.paths.cleanupPlan === planPath || stored.cleanupPlan)
      ? {
          session: stored.session,
          cleanupPlan: stored.cleanupPlan,
        }
      : await readAndPersistReportDocuments(sessionPath, planPath);

  const trashedAssetIds = readTrashedAssetIdsFromStore();
  for (const assetId of await readTrashedAssetIdsForSession(sessionPath)) trashedAssetIds.add(assetId);
  if (planPath) {
    for (const assetId of await readTrashedAssetIdsForPlan(planPath)) trashedAssetIds.add(assetId);
  }
  const cleanupHistory = summarizeCleanupHistory(session, trashedAssetIds);
  const shouldCheckFiles = url.searchParams.get('checkFiles') === '1' || trashedAssetIds.size > 0;
  const missingAssetIds =
    shouldCheckFiles
      ? await import('@/lib/report-state').then(({ collectMissingLocalAssetIds }) =>
          collectMissingLocalAssetIds(session.assets, trashedAssetIds),
        )
      : new Set<string>();
  const omittedAssetIds = new Set([...trashedAssetIds, ...missingAssetIds]);
  const pruned = pruneReportDocuments(session, cleanupPlan, omittedAssetIds);
  const clientSession = cleanupPlan
    ? {
        ...pruned.session,
        cleanupPlans: [],
      }
    : pruned.session;
  const clientCleanupPlan = pruned.cleanupPlan
    ? {
        ...pruned.cleanupPlan,
        assets: [],
      }
    : null;

  const payload: ReportPayload = {
    session: clientSession,
    cleanupPlan: clientCleanupPlan,
    paths: {
      session: sessionPath,
      cleanupPlan: planPath,
    },
    cleanupHistory,
    summary: {
      assetCount: clientSession.assets.length,
      clusterCount: clientSession.clusters.length,
      cleanupPlanCount: clientCleanupPlan?.plans.length ?? clientSession.cleanupPlans.length,
      diagnosticCount: clientSession.diagnostics?.length ?? 0,
    },
  };

  return NextResponse.json(payload, {
    headers: {
      'Cache-Control': 'no-store',
    },
  });
}

function summarizeCleanupHistory(session: MediaCleanSession, trashedAssetIds: Set<string>) {
  const assets = session.assets.filter((asset) => trashedAssetIds.has(asset.id));
  return {
    assetCount: assets.length,
    fileSize: assets.reduce((total, asset) => total + asset.fileSize, 0),
  };
}

async function readAndPersistReportDocuments(sessionPath: string, planPath: string | null) {
  const session = JSON.parse(await fs.readFile(sessionPath, 'utf8')) as MediaCleanSession;
  const cleanupPlan = planPath
    ? (JSON.parse(await fs.readFile(planPath, 'utf8')) as CleanupPlanDocument)
    : null;
  persistReportRuntime({
    sessionPath,
    cleanupPlanPath: planPath,
    session,
    cleanupPlan,
    source: sessionPath.includes('/artifacts/scan/') ? 'artifact' : 'mc',
    cleanupHistory: {
      assetCount: 0,
      fileSize: 0,
    },
  });
  return { session, cleanupPlan };
}
