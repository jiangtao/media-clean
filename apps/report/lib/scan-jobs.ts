import type { ChildProcess } from 'node:child_process';
import fsp from 'node:fs/promises';
import path from 'node:path';

import { spawnMc } from '@/lib/mc-cli';
import { repoRoot, resolveInputPath } from '@/lib/local-paths';
import type { CleanupPlanDocument, MediaCleanSession } from '@/lib/report-contract';

export type ScanJobStatus =
  | 'queued'
  | 'scanning'
  | 'analyzing'
  | 'planning'
  | 'completed'
  | 'failed'
  | 'canceled';

export interface ScanJobSnapshot {
  jobId: string;
  sessionId: string;
  root: string;
  mediaType: string;
  status: ScanJobStatus;
  phase: string;
  session: string;
  cleanupPlan: string;
  progress: {
    processed: number;
    total: number;
    percent: number;
  };
  assetCount?: number;
  clusterCount?: number;
  cleanupPlanCount?: number;
  diagnosticCount?: number;
  error?: string;
  logs: string[];
  startedAt: string;
  updatedAt: string;
  completedAt?: string;
}

interface ScanJob extends ScanJobSnapshot {
  child?: ChildProcess;
  cancelRequested?: boolean;
}

interface StartScanJobInput {
  root: string;
  sessionId?: string;
  mediaType?: 'all' | 'photo' | 'video';
}

const globalForJobs = globalThis as typeof globalThis & {
  __mcScanJobs?: Map<string, ScanJob>;
};

const jobs = globalForJobs.__mcScanJobs ?? new Map<string, ScanJob>();
globalForJobs.__mcScanJobs = jobs;

export async function startScanJob(input: StartScanJobInput) {
  const root = resolveInputPath(input.root.trim());
  const stat = await fsp.stat(root);
  if (!stat.isDirectory()) {
    throw new Error(`scan root must be a directory: ${root}`);
  }

  const sessionId = safeSessionId(input.sessionId?.trim() || `scan-${Date.now()}`);
  const jobId = `job-${sessionId}-${Date.now().toString(36)}`;
  const sessionDir = path.join(repoRoot(), '.mc', sessionId);
  const sessionPath = path.join(sessionDir, 'session.json');
  const cleanupPlanPath = path.join(sessionDir, 'cleanup-plan.json');
  const now = new Date().toISOString();
  const job: ScanJob = {
    jobId,
    sessionId,
    root,
    mediaType: input.mediaType ?? 'all',
    status: 'queued',
    phase: 'queued',
    session: sessionPath,
    cleanupPlan: cleanupPlanPath,
    progress: {
      processed: 0,
      total: 0,
      percent: 0,
    },
    logs: [],
    startedAt: now,
    updatedAt: now,
  };

  jobs.set(jobId, job);
  trimOldJobs();
  void runScanJob(job, sessionDir);
  return snapshot(job);
}

export function listScanJobs() {
  return [...jobs.values()]
    .sort((left, right) => right.startedAt.localeCompare(left.startedAt))
    .map(snapshot);
}

export function getScanJob(jobId: string) {
  const job = jobs.get(jobId);
  return job ? snapshot(job) : null;
}

export function cancelScanJob(jobId: string) {
  const job = jobs.get(jobId);
  if (!job) return null;

  if (job.status === 'completed' || job.status === 'failed' || job.status === 'canceled') {
    return snapshot(job);
  }

  job.cancelRequested = true;
  job.status = 'canceled';
  job.phase = 'canceled';
  job.completedAt = new Date().toISOString();
  touch(job);
  job.child?.kill('SIGTERM');
  appendLog(job, '[mc report] scan job canceled by user');
  return snapshot(job);
}

async function runScanJob(job: ScanJob, sessionDir: string) {
  try {
    await fsp.mkdir(sessionDir, { recursive: true });
    job.status = 'scanning';
    job.phase = 'scanning';
    touch(job);
    await runProcess(job, [
      'scan',
      job.root,
      '--format',
      'json',
      '--out',
      job.session,
      '--session-id',
      job.sessionId,
      '--media-type',
      job.mediaType,
    ]);

    if (job.cancelRequested) return;

    job.status = 'planning';
    job.phase = 'planning';
    touch(job);
    await runProcess(job, ['plan', job.session, '--out', job.cleanupPlan]);

    if (job.cancelRequested) return;

    const [session, cleanupPlan] = await Promise.all([
      readJson<MediaCleanSession>(job.session),
      readJson<CleanupPlanDocument>(job.cleanupPlan),
    ]);
    job.assetCount = session.assets.length;
    job.clusterCount = session.clusters.length;
    job.cleanupPlanCount = cleanupPlan.plans.length;
    job.diagnosticCount = session.diagnostics?.length ?? 0;
    job.progress = {
      processed: session.assets.length,
      total: session.assets.length,
      percent: 100,
    };
    job.status = 'completed';
    job.phase = 'completed';
    job.completedAt = new Date().toISOString();
    touch(job);
    appendLog(job, `[mc report] scan job completed assets=${job.assetCount} clusters=${job.clusterCount}`);
  } catch (error) {
    if (job.cancelRequested) return;
    job.status = 'failed';
    job.phase = 'failed';
    job.error = error instanceof Error ? error.message : String(error);
    job.completedAt = new Date().toISOString();
    touch(job);
    appendLog(job, `[mc report] scan job failed: ${job.error}`);
  } finally {
    job.child = undefined;
  }
}

function runProcess(job: ScanJob, args: string[]) {
  return new Promise<void>((resolve, reject) => {
    const { child } = spawnMc(args);
    job.child = child;
    touch(job);

    const stdout = createLineReader((line) => handleProcessLine(job, line));
    const stderr = createLineReader((line) => handleProcessLine(job, line));

    child.stdout?.on('data', stdout);
    child.stderr?.on('data', stderr);
    child.on('error', reject);
    child.on('close', (code, signal) => {
      stdout.flush();
      stderr.flush();
      job.child = undefined;
      if (job.cancelRequested) {
        resolve();
        return;
      }
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`mc ${args[0]} failed with code ${code ?? 'unknown'}${signal ? ` signal ${signal}` : ''}`));
    });
  });
}

function handleProcessLine(job: ScanJob, line: string) {
  appendLog(job, line);

  const rootMatch = line.match(/\[mc scan\].*assets=(\d+)/);
  if (rootMatch) {
    const total = Number(rootMatch[1]);
    if (Number.isFinite(total) && total > 0) {
      job.progress = {
        processed: job.progress.processed,
        total,
        percent: progressPercent(job.progress.processed, total),
      };
      touch(job);
    }
  }

  const analyzeMatch = line.match(/\[mc scan\] build request complete assets=(\d+) diagnostics=(\d+)/);
  if (analyzeMatch) {
    const total = Number(analyzeMatch[1]);
    job.assetCount = total;
    job.diagnosticCount = Number(analyzeMatch[2]);
    job.status = 'analyzing';
    job.phase = 'analyzing';
    job.progress = {
      processed: total,
      total,
      percent: total > 0 ? 99 : 0,
    };
    touch(job);
  }

  const processedMatch = line.match(/processed=(\d+)\/(\d+).*assets=(\d+).*diagnostics=(\d+)/);
  if (processedMatch) {
    const processed = Number(processedMatch[1]);
    const total = Number(processedMatch[2]);
    job.assetCount = Number(processedMatch[3]);
    job.diagnosticCount = Number(processedMatch[4]);
    job.progress = {
      processed,
      total,
      percent: progressPercent(processed, total),
    };
    touch(job);
  }
}

function createLineReader(onLine: (line: string) => void) {
  let buffer = '';
  const read = (chunk: Buffer | string) => {
    buffer += chunk.toString();
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      if (line.trim()) onLine(line.trim());
    }
  };
  read.flush = () => {
    if (buffer.trim()) onLine(buffer.trim());
    buffer = '';
  };
  return read;
}

function snapshot(job: ScanJob): ScanJobSnapshot {
  const normalized = normalizeVisibleJobState(job);
  return {
    jobId: job.jobId,
    sessionId: job.sessionId,
    root: job.root,
    mediaType: job.mediaType,
    status: normalized.status,
    phase: normalized.phase,
    session: job.session,
    cleanupPlan: job.cleanupPlan,
    progress: normalized.progress,
    assetCount: job.assetCount,
    clusterCount: job.clusterCount,
    cleanupPlanCount: job.cleanupPlanCount,
    diagnosticCount: job.diagnosticCount,
    error: job.error,
    logs: job.logs,
    startedAt: job.startedAt,
    updatedAt: job.updatedAt,
    completedAt: job.completedAt,
  };
}

function normalizeVisibleJobState(job: ScanJob) {
  if (
    job.status === 'scanning' &&
    job.progress.percent >= 100 &&
    job.logs.some((line) => line.includes('[mc scan] build request complete'))
  ) {
    return {
      status: 'analyzing' as const,
      phase: 'analyzing',
      progress: {
        ...job.progress,
        percent: 99,
      },
    };
  }

  return {
    status: job.status,
    phase: job.phase,
    progress: job.progress,
  };
}

function appendLog(job: ScanJob, line: string) {
  job.logs.push(line);
  if (job.logs.length > 120) job.logs.splice(0, job.logs.length - 120);
  touch(job);
}

function touch(job: ScanJob) {
  job.updatedAt = new Date().toISOString();
}

function progressPercent(processed: number, total: number) {
  if (!total) return 0;
  return Math.max(0, Math.min(100, Math.round((processed / total) * 100)));
}

async function readJson<T>(filePath: string) {
  return JSON.parse(await fsp.readFile(filePath, 'utf8')) as T;
}

function trimOldJobs() {
  const completed = [...jobs.values()]
    .filter((job) => job.status === 'completed' || job.status === 'failed' || job.status === 'canceled')
    .sort((left, right) => left.startedAt.localeCompare(right.startedAt));
  while (jobs.size > 30 && completed.length) {
    const job = completed.shift();
    if (job) jobs.delete(job.jobId);
  }
}

function safeSessionId(value: string) {
  const sanitized = value
    .split('')
    .map((character) => {
      if (/^[a-zA-Z0-9_.-]$/.test(character)) return character;
      return '-';
    })
    .join('');
  return sanitized || 'session';
}
