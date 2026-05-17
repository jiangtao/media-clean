'use client';

import { ArrowUp, ChevronRight, Folder, FolderSearch, Loader2, Play, Square } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface ScanWorkbenchProps {
  onOpenReport: (sessionPath: string, cleanupPlanPath: string) => void;
}

interface ScanJob {
  jobId: string;
  sessionId: string;
  root: string;
  mediaType: string;
  status: 'queued' | 'scanning' | 'analyzing' | 'planning' | 'completed' | 'failed' | 'canceled';
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
}

interface DirectoryListing {
  current: string;
  parent: string | null;
  roots: Array<{ label: string; path: string }>;
  directories: Array<{ name: string; path: string }>;
}

export function ScanWorkbench({ onOpenReport }: ScanWorkbenchProps) {
  const defaultSessionId = useMemo(() => `mc-${new Date().toISOString().slice(0, 19).replaceAll(/[-:T]/g, '')}`, []);
  const [root, setRoot] = useState('/Users/jt/places/personal/mc-test-assets');
  const [sessionId, setSessionId] = useState(defaultSessionId);
  const [mediaType, setMediaType] = useState('all');
  const [pending, setPending] = useState(false);
  const [job, setJob] = useState<ScanJob | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  useEffect(() => {
    if (!job || !isRunning(job.status)) return;

    const timer = window.setInterval(async () => {
      try {
        const response = await fetch(`/api/scan/${job.jobId}`, { cache: 'no-store' });
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error ?? '读取扫描任务失败');
        }
        const nextJob = data as ScanJob;
        setJob(nextJob);
        if (nextJob.status === 'completed') {
          setPending(false);
          toast.success('扫描和 cleanup plan 已完成');
          onOpenReport(nextJob.session, nextJob.cleanupPlan);
        }
        if (nextJob.status === 'failed') {
          setPending(false);
          toast.error(nextJob.error ?? '扫描失败');
        }
        if (nextJob.status === 'canceled') {
          setPending(false);
          toast.info('扫描已取消');
        }
      } catch (error) {
        setPending(false);
        toast.error(error instanceof Error ? error.message : String(error));
      }
    }, 1000);

    return () => window.clearInterval(timer);
  }, [job, onOpenReport]);

  const runScan = async () => {
    setPending(true);
    setJob(null);
    try {
      const response = await fetch('/api/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ root, sessionId, mediaType }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? '扫描失败');
      }
      const nextJob = data as ScanJob;
      setJob(nextJob);
      toast.success('扫描任务已启动');
    } catch (error) {
      setPending(false);
      toast.error(error instanceof Error ? error.message : String(error));
    }
  };

  const cancelScan = async () => {
    if (!job || !isRunning(job.status)) return;
    const response = await fetch(`/api/scan/${job.jobId}`, { method: 'DELETE' });
    const data = await response.json();
    if (!response.ok) {
      toast.error(data.error ?? '取消失败');
      return;
    }
    setJob(data as ScanJob);
    setPending(false);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <FolderSearch data-icon="inline-start" />
              本地扫描
            </CardTitle>
            <CardDescription>Next.js 调用 mc CLI 生成 session 和 cleanup plan，然后回到审阅页。</CardDescription>
          </div>
          <Badge variant="secondary">Next.js API -&gt; mc scan -&gt; mc plan</Badge>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="grid grid-cols-[minmax(0,1fr)_260px] gap-3 max-lg:grid-cols-1">
          <label className="flex flex-col gap-2 text-sm font-medium">
            扫描目录
            <div className="flex gap-2">
              <Input value={root} onChange={(event) => setRoot(event.target.value)} />
              <Button type="button" variant="outline" onClick={() => setPickerOpen(true)}>
                <Folder data-icon="inline-start" />
                选择目录
              </Button>
            </div>
          </label>
          <label className="flex flex-col gap-2 text-sm font-medium">
            Session ID
            <Input value={sessionId} onChange={(event) => setSessionId(event.target.value)} />
          </label>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Tabs value={mediaType} onValueChange={setMediaType}>
            <TabsList>
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="photo">图片</TabsTrigger>
              <TabsTrigger value="video">视频</TabsTrigger>
            </TabsList>
          </Tabs>
          <Button onClick={runScan} disabled={pending || !root.trim()}>
            {pending ? <Loader2 data-icon="inline-start" className="animate-spin" /> : <Play data-icon="inline-start" />}
            开始扫描
          </Button>
        </div>
        {job ? <ScanJobCard job={job} onCancel={cancelScan} /> : null}
      </CardContent>
      <DirectoryPickerDialog
        open={pickerOpen}
        initialPath={root}
        onOpenChange={setPickerOpen}
        onSelect={(path) => {
          setRoot(path);
          setPickerOpen(false);
        }}
      />
    </Card>
  );
}

function DirectoryPickerDialog({
  open,
  initialPath,
  onOpenChange,
  onSelect,
}: {
  open: boolean;
  initialPath: string;
  onOpenChange: (open: boolean) => void;
  onSelect: (path: string) => void;
}) {
  const [listing, setListing] = useState<DirectoryListing | null>(null);
  const [pathValue, setPathValue] = useState(initialPath);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setPathValue(initialPath);
      void loadDirectory(initialPath);
    }
  }, [initialPath, open]);

  const loadDirectory = async (nextPath: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/directories?path=${encodeURIComponent(nextPath)}`, { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? '读取目录失败');
      }
      setListing(data as DirectoryListing);
      setPathValue((data as DirectoryListing).current);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : String(nextError));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>选择扫描目录</DialogTitle>
          <DialogDescription>从本机目录中选择一个绝对路径，选中后会写回扫描目录输入框。</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="flex gap-2">
            <Input value={pathValue} onChange={(event) => setPathValue(event.target.value)} />
            <Button variant="outline" onClick={() => loadDirectory(pathValue)} disabled={loading}>
              {loading ? <Loader2 data-icon="inline-start" className="animate-spin" /> : <FolderSearch data-icon="inline-start" />}
              打开
            </Button>
          </div>
          {listing ? (
            <div className="flex flex-wrap gap-2">
              {listing.roots.map((root) => (
                <Button key={root.path} variant="outline" size="sm" onClick={() => loadDirectory(root.path)}>
                  {root.label}
                </Button>
              ))}
            </div>
          ) : null}
          <Separator />
          <div className="flex items-center justify-between gap-3">
            <p className="min-w-0 truncate text-sm text-muted-foreground">{listing?.current ?? pathValue}</p>
            <Button onClick={() => onSelect(listing?.current ?? pathValue)}>使用此目录</Button>
          </div>
          {error ? <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</p> : null}
          <ScrollArea className="h-[420px] rounded-md border">
            <div className="flex flex-col p-2">
              {listing?.parent ? (
                <button
                  className="flex items-center gap-2 rounded-md px-3 py-2 text-left text-sm hover:bg-muted"
                  onClick={() => loadDirectory(listing.parent!)}
                >
                  <ArrowUp data-icon="inline-start" />
                  上一级
                </button>
              ) : null}
              {listing?.directories.map((directory) => (
                <button
                  key={directory.path}
                  className="flex items-center justify-between gap-3 rounded-md px-3 py-2 text-left text-sm hover:bg-muted"
                  onClick={() => loadDirectory(directory.path)}
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <Folder data-icon="inline-start" />
                    <span className="truncate">{directory.name}</span>
                  </span>
                  <ChevronRight data-icon="inline-end" />
                </button>
              ))}
              {!listing?.directories.length && !loading ? (
                <p className="p-4 text-sm text-muted-foreground">当前目录下没有可进入的子目录。</p>
              ) : null}
            </div>
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ScanJobCard({ job, onCancel }: { job: ScanJob; onCancel: () => void }) {
  return (
    <div className="flex flex-col gap-3 rounded-md bg-muted p-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={job.status === 'failed' ? 'destructive' : 'secondary'}>{statusLabel(job.status)}</Badge>
            <Badge variant="outline">{phaseLabel(job.phase)}</Badge>
          </div>
          <p className="mt-2 break-all text-xs text-muted-foreground">Job: {job.jobId}</p>
        </div>
        {isRunning(job.status) ? (
          <Button variant="outline" size="sm" onClick={onCancel}>
            <Square data-icon="inline-start" />
            取消
          </Button>
        ) : null}
      </div>
      <div className="flex flex-col gap-2">
        <Progress value={job.progress.percent} />
        <p className="text-xs text-muted-foreground">
          {job.progress.percent}% · {job.progress.processed} / {job.progress.total || '-'}
          {job.status === 'analyzing' ? ' · 文件探测已完成，正在识别/聚类' : ''}
        </p>
      </div>
      <div className="grid grid-cols-4 gap-2 text-xs max-lg:grid-cols-2">
        <Metric label="Assets" value={job.assetCount} />
        <Metric label="Clusters" value={job.clusterCount} />
        <Metric label="Plans" value={job.cleanupPlanCount} />
        <Metric label="Diagnostics" value={job.diagnosticCount} />
      </div>
      {job.error ? <p className="break-all text-xs text-destructive">{job.error}</p> : null}
      <div className="rounded-md bg-background p-3 text-xs">
        <p className="mb-2 font-medium">日志</p>
        <ScrollArea className="h-36">
          <div className="flex flex-col gap-1 pr-3 font-mono text-muted-foreground">
            {job.logs.length ? job.logs.map((line, index) => <p key={`${line}-${index}`}>{line}</p>) : <p>等待 mc 输出...</p>}
          </div>
        </ScrollArea>
      </div>
      {job.status === 'completed' ? (
        <div className="rounded-md bg-background p-3 text-xs text-muted-foreground">
          <p className="break-all">Session: {job.session}</p>
          <p className="mt-1 break-all">Cleanup plan: {job.cleanupPlan}</p>
        </div>
      ) : null}
    </div>
  );
}

function Metric({ label, value }: { label: string; value?: number }) {
  return (
    <div className="rounded-md bg-background p-2">
      <p className="text-muted-foreground">{label}</p>
      <p className="mt-1 font-medium">{value ?? '-'}</p>
    </div>
  );
}

function isRunning(status: ScanJob['status']) {
  return status === 'queued' || status === 'scanning' || status === 'analyzing' || status === 'planning';
}

function statusLabel(status: ScanJob['status']) {
  const labels: Record<ScanJob['status'], string> = {
    queued: '排队中',
    scanning: '扫描文件',
    analyzing: '识别聚类',
    planning: '生成计划',
    completed: '已完成',
    failed: '失败',
    canceled: '已取消',
  };
  return labels[status];
}

function phaseLabel(phase: string) {
  const labels: Record<string, string> = {
    queued: '等待开始',
    scanning: '读取媒体',
    analyzing: 'Rust Core 识别中',
    planning: '生成 cleanup plan',
    completed: '完成',
    failed: '失败',
    canceled: '取消',
  };
  return labels[phase] ?? phase;
}
