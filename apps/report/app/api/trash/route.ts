import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { NextResponse } from 'next/server';

import { runMc } from '@/lib/mc-cli';
import type { CleanupPlanDocument } from '@/lib/report-contract';
import { inferCleanupPlanPath, resolveInputPath } from '@/lib/local-paths';
import { markTrashedAssetsForPlan, successfulTrashAssetIds } from '@/lib/report-state';

export const runtime = 'nodejs';

interface TrashRequest {
  session?: string;
  plan?: string;
  planIds?: string[];
  assetIds?: string[];
  confirm?: boolean;
}

interface CliQuarantineResult {
  mode: string;
  dryRun: boolean;
  actions: Array<{
    planId: string;
    mode: string;
    status: string;
    assetIds: string[];
    error?: string;
  }>;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as TrashRequest;
    const planPath = resolvePlanPath(body);
    const cleanupPlan = JSON.parse(await fsp.readFile(planPath, 'utf8')) as CleanupPlanDocument;
    const selected = body.assetIds?.length
      ? await buildManualSelectionPlan(cleanupPlan, body.assetIds)
      : {
          planPath,
          planIds: body.planIds ?? cleanupPlan.plans.map((plan) => plan.id),
          plans: cleanupPlan.plans.filter((plan) =>
            new Set(body.planIds ?? cleanupPlan.plans.map((nextPlan) => nextPlan.id)).has(plan.id),
          ),
        };
    const requestedPlanIds = selected.planIds;
    const selectedPlanIds = new Set(requestedPlanIds);
    const selectedPlans = selected.plans.filter((plan) => selectedPlanIds.has(plan.id));
    if (selectedPlans.length !== requestedPlanIds.length) {
      const found = new Set(selectedPlans.map((plan) => plan.id));
      const missing = requestedPlanIds.filter((planId) => !found.has(planId));
      throw new Error(`cleanup plan does not contain plan ids: ${missing.join(', ')}`);
    }

    const assetCount = new Set(selectedPlans.flatMap((plan) => plan.assetIds)).size;
    const cli = await runMcQuarantine(selected.planPath, requestedPlanIds, Boolean(body.confirm));
    const trashedAssetIds = body.confirm ? successfulTrashAssetIds(cli.actions) : new Set<string>();
    const statePath = trashedAssetIds.size > 0 ? await markTrashedAssetsForPlan(planPath, trashedAssetIds) : null;

    return NextResponse.json({
      mode: cli.mode,
      planPath: selected.planPath,
      statePath,
      planCount: selectedPlans.length,
      assetCount,
      actions: cli.actions,
      cli,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}

function resolvePlanPath(body: TrashRequest) {
  if (body.plan) {
    return resolveInputPath(body.plan);
  }
  if (body.session) {
    return inferCleanupPlanPath(resolveInputPath(body.session));
  }
  throw new Error('trash bridge requires a cleanup plan path or session path');
}

async function runMcQuarantine(planPath: string, planIds: string[], confirm: boolean) {
  const mcArgs = [
    'quarantine',
    planPath,
    confirm ? '--trash' : '--dry-run',
    '--format',
    'json',
    ...planIds.flatMap((planId) => ['--plan-id', planId]),
  ];
  const { stdout } = await runMc(mcArgs);
  return JSON.parse(stdout) as CliQuarantineResult;
}

async function buildManualSelectionPlan(cleanupPlan: CleanupPlanDocument, assetIds: string[]) {
  const selectedAssetIds = [...new Set(assetIds)];
  const assetById = new Map(cleanupPlan.assets.map((asset) => [asset.id, asset]));
  const assets = selectedAssetIds.map((assetId) => assetById.get(assetId));
  const missing = selectedAssetIds.filter((assetId, index) => !assets[index]);
  if (missing.length > 0) {
    throw new Error(`cleanup plan does not contain asset ids: ${missing.join(', ')}`);
  }

  const planId = `manual-selection-${Date.now()}`;
  const manualPlan: CleanupPlanDocument = {
    schemaVersion: cleanupPlan.schemaVersion,
    sourceSessionId: cleanupPlan.sourceSessionId,
    generatedAt: new Date().toISOString(),
    plans: [
      {
        id: planId,
        clusterId: 'manual-selection',
        action: 'trash',
        assetIds: selectedAssetIds,
        requiresConfirmation: true,
      },
    ],
    assets: assets.filter(Boolean) as CleanupPlanDocument['assets'],
  };
  const dir = await fsp.mkdtemp(path.join(os.tmpdir(), 'mc-report-trash-'));
  const selectedPlanPath = path.join(dir, 'cleanup-plan.json');
  await fsp.writeFile(selectedPlanPath, JSON.stringify(manualPlan, null, 2));
  return {
    planPath: selectedPlanPath,
    planIds: [planId],
    plans: manualPlan.plans,
  };
}
