import { Clock3, Folder, FolderOpen, FolderSearch, Play, RefreshCw, Search, Trash2 } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

const METRIC_LABELS = ['Assets', 'Clusters', 'Cleanup Plans', 'Diagnostics'];
const TAB_LABELS = ['All', '重复文件', '相似图片', '低价值', '视频'];

export function ReportLoadingSkeleton() {
  return (
    <main className="mx-auto flex min-h-screen max-w-[1440px] flex-col gap-5 px-5 pb-28 pt-6">
      <Card className="shadow-sm">
        <CardContent className="flex items-center justify-between gap-4 p-6 max-sm:flex-col max-sm:items-start">
          <div className="flex min-w-0 items-center gap-4">
            <div className="flex size-14 shrink-0 items-center justify-center rounded-lg border bg-background shadow-sm">
              <img src="/api/brand/logo" alt="Media Clean" className="size-10 rounded-md" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-primary">Media Clean · Local Review</p>
              <Skeleton className="mt-3 h-8 w-72 max-sm:w-56" />
              <Skeleton className="mt-3 h-4 w-96 max-sm:w-64" />
            </div>
          </div>
          <Button variant="outline" disabled>
            <RefreshCw data-icon="inline-start" />
            刷新
          </Button>
        </CardContent>
      </Card>

      <div className="flex items-center gap-1">
        <Skeleton className="h-8 w-14 rounded-md" />
        <Skeleton className="h-8 w-14 rounded-md" />
      </div>

      <section className="grid grid-cols-4 gap-3 max-lg:grid-cols-2 max-sm:grid-cols-1">
        {METRIC_LABELS.map((label) => (
          <Card key={label} className="shadow-sm">
            <CardContent className="p-5">
              <p className="text-sm text-muted-foreground">{label}</p>
              <Skeleton className="mt-3 h-9 w-24" />
              <Skeleton className="mt-3 h-4 w-28" />
            </CardContent>
          </Card>
        ))}
      </section>

      <Card className="gap-3 py-3 shadow-sm">
        <CardContent className="flex flex-wrap items-center justify-between gap-3 px-3">
          <div className="flex flex-wrap gap-1 rounded-md bg-muted p-1">
            {TAB_LABELS.map((label, index) => (
              <div key={label} className="flex h-8 items-center gap-2 rounded-md bg-background px-3">
                <span className="text-sm text-muted-foreground">{label}</span>
                <Badge variant="secondary">{index === 0 ? '----' : '--'}</Badge>
              </div>
            ))}
          </div>
          <div className="flex h-10 min-w-[280px] items-center gap-2 rounded-md border bg-background px-3 text-muted-foreground max-sm:min-w-full">
            <Search data-icon="inline-start" />
            <Skeleton className="h-4 flex-1" />
          </div>
        </CardContent>
      </Card>

      <PaginationSkeleton />

      <section className="grid grid-cols-[minmax(0,1fr)_340px] gap-4 max-xl:grid-cols-1">
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-[repeat(auto-fill,minmax(236px,1fr))] gap-3">
            {Array.from({ length: 8 }, (_, index) => (
              <ReviewCardSkeleton key={index} />
            ))}
          </div>
        </div>

        <aside className="flex flex-col gap-4">
          <Card className="shadow-sm">
            <CardContent className="p-5">
              <Skeleton className="h-5 w-20" />
              <Skeleton className="mt-3 h-4 w-56" />
              <div className="mt-5 flex flex-col gap-2">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            </CardContent>
          </Card>
        </aside>
      </section>

      <div className="fixed inset-x-0 bottom-4 z-40 flex justify-center px-4">
        <div className="flex w-full max-w-3xl flex-wrap items-center justify-between gap-3 rounded-lg border bg-card/95 px-4 py-3 text-card-foreground shadow-lg backdrop-blur">
          <div className="flex min-w-0 flex-wrap items-center gap-3">
            <p className="text-sm font-medium">确认与清理</p>
            <Skeleton className="h-4 w-48" />
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-6 w-36 rounded-full" />
            <Button disabled>
              <Trash2 data-icon="inline-start" />
              打开清理
            </Button>
          </div>
        </div>
      </div>
    </main>
  );
}

export function HomeLoadingSkeleton() {
  return (
    <main className="mx-auto flex min-h-screen max-w-[1440px] flex-col gap-5 px-5 py-6">
      <header className="rounded-lg border bg-card/95 p-5 text-card-foreground shadow-sm">
        <div className="flex min-w-0 items-center gap-4">
          <div className="flex size-14 shrink-0 items-center justify-center rounded-lg border bg-background shadow-sm">
            <img src="/api/brand/logo" alt="Media Clean" className="size-10 rounded-md" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-primary">Media Clean · Local Workbench</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-normal">扫描与审阅工作台</h1>
            <p className="mt-2 text-sm text-muted-foreground">从本地目录生成 session，再继续确认和清理候选。</p>
          </div>
        </div>
      </header>

      <div className="flex items-center gap-1">
        <div className="flex h-9 items-center rounded-md bg-muted p-1">
          <div className="flex h-7 items-center rounded-sm bg-background px-3 text-sm font-medium shadow-sm">扫描</div>
          <div className="flex h-7 items-center px-3 text-sm text-muted-foreground opacity-60">审阅</div>
        </div>
      </div>

      <Card className="shadow-sm">
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
            <div className="flex flex-col gap-2">
              <p className="text-sm font-medium">扫描目录</p>
              <div className="flex gap-2">
                <Skeleton className="h-10 flex-1 rounded-md" />
                <Button type="button" variant="outline" disabled>
                  <Folder data-icon="inline-start" />
                  选择目录
                </Button>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <p className="text-sm font-medium">Session ID</p>
              <Skeleton className="h-10 w-full rounded-md" />
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex h-9 items-center rounded-md bg-muted p-1">
              {['All', '图片', '视频'].map((label, index) => (
                <div
                  key={label}
                  className={index === 0 ? 'flex h-7 items-center rounded-sm bg-background px-3 text-sm shadow-sm' : 'flex h-7 items-center px-3 text-sm text-muted-foreground'}
                >
                  {label}
                </div>
              ))}
            </div>
            <Button disabled>
              <Play data-icon="inline-start" />
              开始扫描
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-sm">
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Clock3 data-icon="inline-start" />
                历史记录
              </CardTitle>
              <CardDescription>从本仓库 .mc 和 scan artifacts 中打开或删除已生成的记录。</CardDescription>
            </div>
            <Button variant="outline" size="sm" disabled>
              <RefreshCw data-icon="inline-start" />
              刷新
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(320px,1fr))] gap-3">
            {Array.from({ length: 4 }, (_, index) => (
              <HistoryCardSkeleton key={index} />
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>打开已有 session</CardTitle>
          <CardDescription>发布后通过 mc CLI 打开本地审阅工作台。</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="rounded-md bg-muted p-3">
            <Skeleton className="h-5 w-[360px] max-w-full" />
          </div>
          <Skeleton className="h-4 w-[420px] max-w-full" />
        </CardContent>
      </Card>
    </main>
  );
}

function PaginationSkeleton() {
  return (
    <Card className="gap-3 py-3 shadow-sm">
      <CardContent className="flex flex-wrap items-center justify-between gap-3 px-3">
        <Skeleton className="h-5 w-52" />
        <div className="flex flex-wrap items-center gap-2">
          <Skeleton className="h-9 w-12 rounded-md" />
          <Skeleton className="h-9 w-14 rounded-md" />
          <Skeleton className="h-9 w-14 rounded-md" />
          <Skeleton className="h-9 w-16 rounded-md" />
          <Skeleton className="h-9 w-20 rounded-md" />
          <Skeleton className="h-9 w-20 rounded-md" />
        </div>
      </CardContent>
    </Card>
  );
}

function ReviewCardSkeleton() {
  return (
    <Card className="shadow-sm">
      <CardContent className="flex flex-col gap-3 p-3">
        <div className="grid grid-cols-2 gap-2">
          <Skeleton className="aspect-square w-full rounded-md" />
          <Skeleton className="aspect-square w-full rounded-md" />
          <Skeleton className="aspect-square w-full rounded-md" />
          <Skeleton className="aspect-square w-full rounded-md" />
        </div>
        <div className="flex items-center justify-between gap-2">
          <div className="flex gap-2">
            <Skeleton className="h-6 w-16 rounded-full" />
            <Skeleton className="h-6 w-20 rounded-full" />
          </div>
          <Skeleton className="size-5 rounded-sm" />
        </div>
        <Skeleton className="h-5 w-36" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-4/5" />
        <div className="flex items-center justify-between gap-2 pt-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-9 w-16 rounded-md" />
        </div>
      </CardContent>
    </Card>
  );
}

function HistoryCardSkeleton() {
  return (
    <div className="flex flex-col gap-3 rounded-lg border bg-background p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Skeleton className="h-6 w-12 rounded-full" />
            <Skeleton className="h-6 w-16 rounded-full" />
          </div>
          <Skeleton className="mt-3 h-5 w-44" />
          <Skeleton className="mt-2 h-4 w-full" />
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button size="sm" disabled>
            <FolderOpen data-icon="inline-start" />
            打开
          </Button>
          <Button size="sm" variant="outline" disabled>
            <Trash2 data-icon="inline-start" />
            删除
          </Button>
        </div>
      </div>
      <div className="grid grid-cols-4 gap-2">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="rounded-md bg-muted p-2">
            <Skeleton className="h-3 w-12" />
            <Skeleton className="mt-2 h-4 w-8" />
          </div>
        ))}
      </div>
      <Skeleton className="h-4 w-24" />
    </div>
  );
}
