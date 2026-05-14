import { RefreshCw, Search, Trash2 } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
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
