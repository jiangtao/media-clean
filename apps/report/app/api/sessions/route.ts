import fsp from 'node:fs/promises';
import path from 'node:path';

import { NextResponse } from 'next/server';

import type { MediaCleanSession } from '@/lib/report-contract';
import { inferCleanupPlanPath, repoRoot } from '@/lib/local-paths';
import { readTrashedAssetIdsForPlan, readTrashedAssetIdsForSession } from '@/lib/report-state';

export const runtime = 'nodejs';

interface SessionHistoryItem {
  sessionPath: string;
  cleanupPlanPath: string | null;
  sessionId: string;
  generatedAt: string;
  root: string;
  platform: string;
  assetCount: number;
  clusterCount: number;
  cleanupPlanCount: number;
  diagnosticCount: number;
  cleanupHistory: {
    assetCount: number;
    fileSize: number;
  };
  source: 'mc' | 'artifact';
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const limit = Number(url.searchParams.get('limit') ?? 30);
    const safeLimit = Number.isFinite(limit) ? Math.min(Math.max(Math.floor(limit), 1), 100) : 30;
    const root = repoRoot();
    const sessionPaths = await findSessionPaths(root);
    const sessions = (
      await Promise.all(sessionPaths.map((sessionPath) => readSessionHistoryItem(sessionPath)))
    )
      .filter((session): session is SessionHistoryItem => Boolean(session))
      .sort((left, right) => Date.parse(right.generatedAt) - Date.parse(left.generatedAt))
      .slice(0, safeLimit);

    return NextResponse.json({ sessions });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const body = (await request.json()) as { sessionPath?: string };
    const root = repoRoot();
    const sessionPath = resolveDeletableSessionPath(body.sessionPath, root);
    const sessionDir = path.dirname(sessionPath);

    await fsp.access(sessionPath);
    await fsp.rm(sessionDir, { recursive: true, force: true });

    return NextResponse.json({ deleted: true, sessionPath, sessionDir });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 400 },
    );
  }
}

async function findSessionPaths(root: string) {
  const searchRoots = [
    { dir: path.join(root, '.mc'), source: 'mc' as const, depth: 2 },
    { dir: path.join(root, 'artifacts', 'scan'), source: 'artifact' as const, depth: 3 },
  ];
  const sessionPaths = new Map<string, 'mc' | 'artifact'>();

  for (const searchRoot of searchRoots) {
    for (const sessionPath of await walkForSessionFiles(searchRoot.dir, searchRoot.depth)) {
      sessionPaths.set(sessionPath, searchRoot.source);
    }
  }

  return [...sessionPaths.entries()].map(([sessionPath, source]) => ({ sessionPath, source }));
}

function resolveDeletableSessionPath(input: string | undefined, root: string) {
  if (!input) throw new Error('Missing sessionPath');

  const sessionPath = path.normalize(path.isAbsolute(input) ? input : path.resolve(root, input));
  if (path.basename(sessionPath) !== 'session.json') {
    throw new Error('Only session.json records can be deleted');
  }

  const sessionDir = path.dirname(sessionPath);
  const allowedRoots = [path.join(root, '.mc'), path.join(root, 'artifacts', 'scan')].map((allowedRoot) =>
    path.resolve(allowedRoot),
  );
  const insideAllowedRoot = allowedRoots.some((allowedRoot) => isPathInside(allowedRoot, sessionPath));
  if (!insideAllowedRoot) {
    throw new Error('Session record is outside deletable history roots');
  }
  if (allowedRoots.some((allowedRoot) => path.resolve(sessionDir) === allowedRoot)) {
    throw new Error('Refusing to delete a history root directory');
  }

  return sessionPath;
}

function isPathInside(parent: string, child: string) {
  const relative = path.relative(parent, child);
  return relative === '' || (relative.length > 0 && !relative.startsWith('..') && !path.isAbsolute(relative));
}

async function walkForSessionFiles(dir: string, depth: number): Promise<string[]> {
  if (depth < 0) return [];
  let entries;
  try {
    entries = await fsp.readdir(dir, { withFileTypes: true });
  } catch (error) {
    if (isNodeError(error) && error.code === 'ENOENT') return [];
    throw error;
  }

  const found: string[] = [];
  for (const entry of entries) {
    const entryPath = path.join(dir, entry.name);
    if (entry.isFile() && entry.name === 'session.json') {
      found.push(entryPath);
      continue;
    }
    if (entry.isDirectory()) {
      found.push(...(await walkForSessionFiles(entryPath, depth - 1)));
    }
  }
  return found;
}

async function readSessionHistoryItem(candidate: {
  sessionPath: string;
  source: 'mc' | 'artifact';
}): Promise<SessionHistoryItem | null> {
  try {
    const session = JSON.parse(await fsp.readFile(candidate.sessionPath, 'utf8')) as MediaCleanSession;
    const cleanupPlanPath = await optionalExistingPath(inferCleanupPlanPath(candidate.sessionPath));
    const cleanupHistory = await summarizeCleanupHistory(candidate.sessionPath, cleanupPlanPath, session);

    return {
      sessionPath: candidate.sessionPath,
      cleanupPlanPath,
      sessionId: session.sessionId,
      generatedAt: session.generatedAt,
      root: session.source.root,
      platform: session.source.platform,
      assetCount: session.assets.length,
      clusterCount: session.clusters.length,
      cleanupPlanCount: session.cleanupPlans.length,
      diagnosticCount: session.diagnostics?.length ?? 0,
      cleanupHistory,
      source: candidate.source,
    };
  } catch {
    return null;
  }
}

async function summarizeCleanupHistory(
  sessionPath: string,
  cleanupPlanPath: string | null,
  session: MediaCleanSession,
) {
  const trashedAssetIds = await readTrashedAssetIdsForSession(sessionPath);
  if (cleanupPlanPath) {
    for (const assetId of await readTrashedAssetIdsForPlan(cleanupPlanPath)) trashedAssetIds.add(assetId);
  }
  const assets = session.assets.filter((asset) => trashedAssetIds.has(asset.id));
  return {
    assetCount: assets.length,
    fileSize: assets.reduce((total, asset) => total + asset.fileSize, 0),
  };
}

async function optionalExistingPath(filePath: string) {
  try {
    await fsp.access(filePath);
    return filePath;
  } catch {
    return null;
  }
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error;
}
