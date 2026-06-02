import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

import { getDesktopCopy, normalizeDesktopLocale, type DesktopLocale } from './desktop-i18n';
import type {
  CleanupPlan,
  MediaAsset,
  MediaCluster,
  NormalizedAsset,
  NormalizedCandidate,
  ReportPayload,
  ReviewCandidate,
  ScanJob,
  SessionRecord,
  TrashResult,
} from './types';

export const CATEGORY_COPY: Record<string, { label: string; tone: string; description: string }> = {
  all: { label: '全部', tone: 'blue', description: '全部候选' },
  duplicate: { label: '重复文件', tone: 'green', description: '内容 hash 完全一致，适合优先确认。' },
  near_similar: { label: '相似图片', tone: 'blue', description: '视觉 hash 接近，需要人工复核。' },
  low_value: { label: '低价值', tone: 'amber', description: '低亮度、低对比、模糊或信息量偏低。' },
  video: { label: '视频', tone: 'blue', description: '视频 metadata 与代表帧分析结果。' },
};

const CATEGORY_LOCALE_COPY: Record<DesktopLocale, Record<string, { label: string; description: string }>> = {
  'zh-CN': {
    all: { label: '全部', description: '全部候选' },
    duplicate: { label: '重复文件', description: '内容 hash 完全一致，适合优先确认。' },
    near_similar: { label: '相似图片', description: '视觉 hash 接近，需要人工复核。' },
    low_value: { label: '低价值', description: '低亮度、低对比、模糊或信息量偏低。' },
    video: { label: '视频', description: '视频 metadata 与代表帧分析结果。' },
    cleanup: { label: '清理计划', description: '来自 cleanup plan 的候选资产' },
    other: { label: '候选', description: '待人工确认的清理候选。' },
  },
  'en-US': {
    all: { label: 'All', description: 'All candidates' },
    duplicate: { label: 'Duplicates', description: 'Files with identical content hashes. Review these first.' },
    near_similar: { label: 'Similar Photos', description: 'Images with nearby visual hashes that need review.' },
    low_value: { label: 'Low Quality', description: 'Low-light, low-contrast, blurry, or low-information media.' },
    video: { label: 'Videos', description: 'Video metadata and representative frame analysis.' },
    cleanup: { label: 'Cleanup Plan', description: 'Candidate assets from the cleanup plan.' },
    other: { label: 'Candidate', description: 'Cleanup candidate awaiting review.' },
  },
};

let desktopLocale: DesktopLocale = normalizeDesktopLocale(
  typeof navigator === 'undefined' ? Intl.DateTimeFormat().resolvedOptions().locale : navigator.language,
);

export function setDesktopLocale(locale: string | DesktopLocale) {
  desktopLocale = normalizeDesktopLocale(locale);
}

export function getDesktopLocale() {
  return desktopLocale;
}

export function cn(...values: ClassValue[]) {
  return twMerge(clsx(values));
}

export function normalizeDirectories(result: unknown) {
  const raw = Array.isArray(result)
    ? result
    : isRecord(result)
      ? result.filePaths || result.paths || result.directories || []
      : [];
  return uniqueStrings(
    (Array.isArray(raw) ? raw : [])
      .map((item) => (typeof item === 'string' ? item : isRecord(item) ? item.path || item.uri || '' : ''))
      .filter(Boolean),
  );
}

export function normalizeJobs(result: unknown): ScanJob[] {
  const raw = Array.isArray(result)
    ? result
    : isRecord(result)
      ? result.jobs || result.items || (result ? [result] : [])
      : [];
  return (Array.isArray(raw) ? raw : []).filter(Boolean) as ScanJob[];
}

export function normalizeSessions(result: unknown): SessionRecord[] {
  const raw = Array.isArray(result) ? result : isRecord(result) ? result.sessions || result.items || [] : [];
  return (Array.isArray(raw) ? raw : []).filter(Boolean) as SessionRecord[];
}

export function mergeJobs(current: ScanJob[], next: ScanJob[]) {
  const byId = new Map<string, ScanJob>();
  for (const job of current) byId.set(jobKey(job), job);
  for (const job of next) byId.set(jobKey(job), { ...byId.get(jobKey(job)), ...job });
  return Array.from(byId.values());
}

export function jobKey(job: ScanJob) {
  return String(job.jobId || job.id || job.sessionId || job.root || Math.random().toString(36));
}

export function isRunning(status?: string) {
  return ['queued', 'scanning', 'analyzing', 'planning', 'running'].includes(String(status || '').toLowerCase());
}

export function jobPercent(job: ScanJob) {
  const progress = job.progress || {};
  if (Number.isFinite(Number(progress.percent))) return clampPercent(Number(progress.percent));
  if (Number.isFinite(Number(job.percent))) return clampPercent(Number(job.percent));
  const processed = Number(progress.processed ?? job.processed ?? 0);
  const total = Number(progress.total ?? job.total ?? 0);
  if (total > 0) return clampPercent(Math.round((processed / total) * 100));
  if (String(job.status) === 'completed') return 100;
  return isRunning(job.status) ? 5 : 0;
}

export function aggregateJobPercent(jobs: ScanJob[]) {
  const total = sumJobs(jobs, 'total');
  const processed = sumJobs(jobs, 'processed');
  if (total > 0) return clampPercent(Math.round((processed / total) * 100));
  if (jobs.length === 0) return 0;
  return clampPercent(jobs.reduce((sum, job) => sum + jobPercent(job), 0) / jobs.length);
}

export function sumJobs(jobs: ScanJob[], key: 'processed' | 'total') {
  return jobs.reduce((sum, job) => {
    const progress = job.progress || {};
    return sum + Math.max(0, Number(progress[key] ?? job[key] ?? 0));
  }, 0);
}

export function deriveCandidates(payload: ReportPayload | null): NormalizedCandidate[] {
  if (!payload) return [];
  const direct = Array.isArray(payload.candidates) ? payload.candidates : [];
  if (direct.length > 0) {
    return direct.map((candidate, index) => normalizeCandidate(candidate, payload, index)).filter((candidate) => candidate.assets.length > 0);
  }

  const assets = reportAssets(payload);
  const assetsById = new Map(assets.map((asset) => [asset.id || asset.assetId || asset.uri || asset.path, normalizeAsset(asset)]));
  const cleanupPlans = reportCleanupPlans(payload);
  const planByCluster = new Map(cleanupPlans.map((plan) => [plan.clusterId, plan]));
  const clusters = reportClusters(payload);

  const candidates = clusters
    .map((cluster: MediaCluster) => {
      const category = cluster.category || 'other';
      const candidateAssets = (cluster.assetIds || []).map((assetId) => assetsById.get(assetId)).filter(Boolean) as NormalizedAsset[];
      return {
        id: cluster.id || `cluster-${Math.random().toString(36).slice(2)}`,
        category,
        title: categoryLabel(category),
        description: categoryDescription(category),
        assets: candidateAssets,
        reasons: cluster.reasons || [],
        score: cluster.score,
        cleanupPlan: planByCluster.get(cluster.id || '') || null,
      };
    })
    .filter((candidate) => candidate.assets.length > 0);

  if (candidates.length > 0) return candidates;

  return cleanupPlans
    .map((plan: CleanupPlan, index) => ({
      id: plan.id || `plan-${index + 1}`,
      category: plan.category || 'cleanup',
      title: plan.action || getDesktopCopy(desktopLocale).detail.cleanupPlan,
      description: getDesktopCopy(desktopLocale).detail.cleanupAsset,
      assets: (plan.assetIds || []).map((assetId) => assetsById.get(assetId)).filter(Boolean) as NormalizedAsset[],
      reasons: plan.reasons || [plan.action || 'cleanup-plan'],
      score: plan.score,
      cleanupPlan: plan,
    }))
    .filter((candidate) => candidate.assets.length > 0);
}

export function normalizeCandidate(candidate: ReviewCandidate, payload: ReportPayload, index: number): NormalizedCandidate {
  const assets = reportAssets(payload);
  const assetsById = new Map(assets.map((asset) => [asset.id || asset.assetId || asset.uri || asset.path, normalizeAsset(asset)]));
  const category = candidate.category || candidate.primaryIssueType || candidate.type || 'other';
  const candidateAssets = Array.isArray(candidate.assets)
    ? candidate.assets.map(normalizeAsset)
    : (candidate.assetIds || []).map((assetId) => assetsById.get(assetId)).filter(Boolean) as NormalizedAsset[];

  return {
    id: candidate.id || candidate.candidateId || `candidate-${index + 1}`,
    category,
    title: candidate.title || categoryLabel(category),
    description: candidate.description || categoryDescription(category),
    assets: candidateAssets,
    reasons: candidate.reasons || candidate.reasonCodes || [],
    score: candidate.score,
    cleanupPlan: candidate.cleanupPlan || null,
  };
}

export function normalizeAsset(asset: MediaAsset): NormalizedAsset {
  return {
    ...asset,
    id: String(asset.id || asset.assetId || asset.uri || asset.path || ''),
    uri: String(asset.uri || asset.path || asset.contentUri || asset.id || asset.assetId || ''),
    mediaType: String(asset.mediaType || asset.type || 'photo'),
    fileSize: Number(asset.fileSize || asset.size || 0),
  };
}

export function reportSummary(payload: ReportPayload | null, candidates: NormalizedCandidate[]) {
  if (!payload) return { assetCount: 0, clusterCount: 0, cleanupPlanCount: 0, diagnosticCount: 0 };
  return {
    assetCount: Number(payload.summary?.assetCount ?? reportAssets(payload).length ?? 0),
    clusterCount: Number(payload.summary?.clusterCount ?? reportClusters(payload).length ?? candidates.length ?? 0),
    cleanupPlanCount: Number(payload.summary?.cleanupPlanCount ?? reportCleanupPlans(payload).length ?? 0),
    diagnosticCount: Number(payload.summary?.diagnosticCount ?? reportDiagnostics(payload).length ?? 0),
  };
}

export function successfulActionAssetIds(result: TrashResult) {
  const removed = new Set<string>();
  const successStatuses = new Set(['ok', 'completed', 'trashed', 'success', 'deleted']);
  for (const action of result.actions || []) {
    const status = String(action.status || '').toLowerCase();
    if (status && !successStatuses.has(status)) continue;
    if (action.assetId) removed.add(action.assetId);
    for (const assetId of action.assetIds || []) removed.add(assetId);
  }
  return removed;
}

export function removeAssetsFromPayload(payload: ReportPayload | null, removedAssetIds: Set<string>) {
  if (!payload || removedAssetIds.size === 0) return payload;
  const session = payload.session || {};
  const assets = reportAssets(payload);
  const removedAssets = assets.filter((asset) => removedAssetIds.has(String(asset.id || asset.assetId || asset.uri || asset.path)));
  const nextAssets = assets.filter((asset) => !removedAssetIds.has(String(asset.id || asset.assetId || asset.uri || asset.path)));
  const nextClusters = reportClusters(payload)
    .map((cluster) => ({
      ...cluster,
      assetIds: (cluster.assetIds || []).filter((assetId) => !removedAssetIds.has(assetId)),
    }))
    .filter((cluster) => (cluster.assetIds || []).length > 0);
  const nextPlans = reportCleanupPlans(payload)
    .map((plan) => ({
      ...plan,
      assetIds: (plan.assetIds || []).filter((assetId) => !removedAssetIds.has(assetId)),
    }))
    .filter((plan) => (plan.assetIds || []).length > 0);

  return {
    ...payload,
    ...(payload.session
      ? {
          session: {
            ...session,
            assets: nextAssets,
            clusters: nextClusters,
            cleanupPlans: nextPlans,
          },
        }
      : {
          assets: nextAssets,
          clusters: nextClusters,
          cleanupPlan: {
            ...(payload.cleanupPlan || {}),
            plans: nextPlans,
          },
        }),
    cleanupHistory: {
      ...(payload.cleanupHistory || {}),
      assetCount: Number(payload.cleanupHistory?.assetCount || 0) + removedAssets.length,
      fileSize: Number(payload.cleanupHistory?.fileSize || 0) + removedAssets.reduce((sum, asset) => sum + Number(asset.fileSize || asset.size || 0), 0),
    },
    summary: {
      assetCount: nextAssets.length,
      clusterCount: nextClusters.length,
      cleanupPlanCount: nextPlans.length,
      diagnosticCount: reportDiagnostics(payload).length,
    },
  };
}

function reportAssets(payload: ReportPayload): MediaAsset[] {
  if (Array.isArray(payload.session?.assets)) return payload.session.assets;
  if (Array.isArray(payload.assets)) return payload.assets;
  return [];
}

function reportClusters(payload: ReportPayload): MediaCluster[] {
  if (Array.isArray(payload.session?.clusters)) return payload.session.clusters;
  if (Array.isArray(payload.clusters)) return payload.clusters;
  return [];
}

function reportCleanupPlans(payload: ReportPayload): CleanupPlan[] {
  if (Array.isArray(payload.session?.cleanupPlans)) return payload.session.cleanupPlans;
  if (Array.isArray(payload.cleanupPlan?.plans)) return payload.cleanupPlan.plans;
  return [];
}

function reportDiagnostics(payload: ReportPayload): unknown[] {
  return Array.isArray(payload.session?.diagnostics) ? payload.session.diagnostics : [];
}

export function categoryLabel(category: string) {
  const fallback = getDesktopCopy(desktopLocale).detail.fallbackCandidate;
  return CATEGORY_LOCALE_COPY[desktopLocale][category]?.label || CATEGORY_COPY[category]?.label || String(category || fallback);
}

function categoryDescription(category: string) {
  return CATEGORY_LOCALE_COPY[desktopLocale][category]?.description
    || CATEGORY_COPY[category]?.description
    || getDesktopCopy(desktopLocale).detail.manualReview;
}

export function fileName(uri?: string) {
  const value = String(uri || '');
  try {
    const decoded = decodeURIComponent(value);
    return decoded.slice(decoded.lastIndexOf('/') + 1) || decoded;
  } catch {
    return value.slice(value.lastIndexOf('/') + 1) || value;
  }
}

export function createSessionId() {
  return `mc-desktop-${new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '')}`;
}

export function formatBytes(value: number) {
  if (!Number.isFinite(value) || value <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let next = value;
  let unit = 0;
  while (next >= 1024 && unit < units.length - 1) {
    next /= 1024;
    unit += 1;
  }
  return `${next.toFixed(unit === 0 ? 0 : 1)} ${units[unit]}`;
}

export function formatNumber(value?: number) {
  const number = Number(value || 0);
  if (!Number.isFinite(number)) return '0';
  return new Intl.NumberFormat(desktopLocale).format(number);
}

export function formatDate(value?: string) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat(desktopLocale, {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export function formatDuration(value?: number) {
  const seconds = Number(value || 0);
  if (!Number.isFinite(seconds) || seconds <= 0) return '--:--';
  const minutes = Math.floor(seconds / 60);
  const rest = Math.floor(seconds % 60);
  return `${minutes}:${String(rest).padStart(2, '0')}`;
}

export function formatMetric(value?: number) {
  const number = Number(value);
  if (!Number.isFinite(number)) return '--';
  return number.toFixed(3);
}

export function progressText(job: ScanJob) {
  const progress = job.progress || {};
  const processed = Number(progress.processed ?? job.processed ?? 0);
  const total = Number(progress.total ?? job.total ?? 0);
  const percent = jobPercent(job);
  if (total > 0) return `${formatNumber(processed)} / ${formatNumber(total)} · ${percent}%`;
  return `${percent}%`;
}

export function uniqueStrings(values: unknown[]) {
  return Array.from(new Set(values.map((value) => String(value).trim()).filter(Boolean)));
}

export function readableError(error: unknown) {
  if (!error) return desktopLocale === 'en-US' ? 'Unknown error' : '未知错误';
  if (error instanceof Error) return error.message;
  return String(error);
}

function clampPercent(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function isRecord(value: unknown): value is Record<string, any> {
  return typeof value === 'object' && value !== null;
}
