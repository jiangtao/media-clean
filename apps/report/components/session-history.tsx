'use client';

import { Clock3, FileWarning, FolderOpen, Loader2, RefreshCw, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';

interface SessionHistoryProps {
  onOpenReport: (sessionPath: string, cleanupPlanPath: string) => void;
}

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

export function SessionHistory({ onOpenReport }: SessionHistoryProps) {
  const [sessions, setSessions] = useState<SessionHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingSessionPath, setDeletingSessionPath] = useState<string | null>(null);

  const loadSessions = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/sessions?limit=40', { cache: 'no-store' });
      const data = (await response.json()) as { sessions?: SessionHistoryItem[]; error?: string };
      if (!response.ok) {
        throw new Error(data.error ?? '读取历史记录失败');
      }
      setSessions(data.sessions ?? []);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
    } finally {
      setLoading(false);
    }
  };

  const deleteSession = async (sessionPath: string) => {
    setDeletingSessionPath(sessionPath);
    try {
      const response = await fetch('/api/sessions', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionPath }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(data.error ?? '删除历史记录失败');
      }
      setSessions((current) => current.filter((session) => session.sessionPath !== sessionPath));
      toast.success('历史记录已删除');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
    } finally {
      setDeletingSessionPath(null);
    }
  };

  useEffect(() => {
    void loadSessions();
  }, []);

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Clock3 data-icon="inline-start" />
              历史记录
            </CardTitle>
            <CardDescription>从本仓库 .mc 和 scan artifacts 中打开或删除已生成的记录。</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={loadSessions} disabled={loading}>
            {loading ? <Loader2 data-icon="inline-start" className="animate-spin" /> : <RefreshCw data-icon="inline-start" />}
            刷新
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[360px] pr-3">
          <div className="grid grid-cols-[repeat(auto-fill,minmax(320px,1fr))] gap-3">
            {sessions.map((session) => (
              <SessionHistoryCard
                key={session.sessionPath}
                session={session}
                deleting={deletingSessionPath === session.sessionPath}
                onOpenReport={onOpenReport}
                onDelete={() => deleteSession(session.sessionPath)}
              />
            ))}
            {!loading && sessions.length === 0 ? (
              <div className="col-span-full flex min-h-32 items-center justify-center rounded-md border text-sm text-muted-foreground">
                暂无历史记录。
              </div>
            ) : null}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

function SessionHistoryCard({
  session,
  deleting,
  onOpenReport,
  onDelete,
}: {
  session: SessionHistoryItem;
  deleting: boolean;
  onOpenReport: (sessionPath: string, cleanupPlanPath: string) => void;
  onDelete: () => void;
}) {
  const canOpen = Boolean(session.cleanupPlanPath);
  return (
    <div className="flex flex-col gap-3 rounded-lg border bg-background p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={session.source === 'mc' ? 'secondary' : 'outline'}>
              {session.source === 'mc' ? '.mc' : 'artifact'}
            </Badge>
            <Badge variant="outline">{session.platform}</Badge>
            {session.cleanupHistory.assetCount > 0 ? (
              <Badge variant="outline" className="border-destructive/30 bg-destructive/10 text-destructive">
                已清理 {session.cleanupHistory.assetCount} 个 · {formatBytes(session.cleanupHistory.fileSize)}
              </Badge>
            ) : null}
          </div>
          <h3 className="mt-2 truncate text-sm font-semibold">{session.sessionId}</h3>
          <p className="mt-1 truncate text-xs text-muted-foreground">{session.root}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button
            size="sm"
            variant={canOpen ? 'default' : 'outline'}
            disabled={!canOpen || deleting}
            onClick={() => {
              if (session.cleanupPlanPath) onOpenReport(session.sessionPath, session.cleanupPlanPath);
            }}
          >
            {canOpen ? <FolderOpen data-icon="inline-start" /> : <FileWarning data-icon="inline-start" />}
            {canOpen ? '打开' : '无计划'}
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button size="sm" variant="outline" disabled={deleting}>
                {deleting ? <Loader2 data-icon="inline-start" className="animate-spin" /> : <Trash2 data-icon="inline-start" />}
                删除
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>删除这条历史记录？</AlertDialogTitle>
                <AlertDialogDescription>
                  将删除该扫描会话目录里的 session、cleanup plan 和审阅状态文件，不会删除原始图片或视频。
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>取消</AlertDialogCancel>
                <AlertDialogAction variant="destructive" onClick={onDelete}>
                  确认删除
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
      <div className="grid grid-cols-4 gap-2 text-xs">
        <Metric label="Assets" value={session.assetCount} />
        <Metric label="Clusters" value={session.clusterCount} />
        <Metric label="Plans" value={session.cleanupPlanCount} />
        <Metric label="Diag" value={session.diagnosticCount} />
      </div>
      <p className="truncate text-xs text-muted-foreground">{formatDate(session.generatedAt)}</p>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md bg-muted p-2">
      <p className="text-muted-foreground">{label}</p>
      <p className="mt-1 font-medium">{value}</p>
    </div>
  );
}

function formatDate(value: string) {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return value || '-';
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(timestamp));
}

function formatBytes(value: number) {
  if (!Number.isFinite(value) || value <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let next = value;
  let unit = 0;
  while (next >= 1024 && unit < units.length - 1) {
    next /= 1024;
    unit += 1;
  }
  return `${next.toFixed(unit === 0 ? 0 : 1)} ${units[unit]}`;
}
