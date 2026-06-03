'use client';

import { Activity, lazy, Suspense } from 'react';

import { HomeLoadingSkeleton, ReportLoadingSkeleton } from '@/components/report-loading-skeleton';

const LazyReportWorkbench = lazy(() =>
  import('@/components/report-workbench').then((module) => ({
    default: module.ReportWorkbench,
  })),
);

interface ReportWorkbenchActivityProps {
  initialSessionPath?: string | null;
  initialPlanPath?: string | null;
}

export function ReportWorkbenchActivity({ initialSessionPath = null, initialPlanPath = null }: ReportWorkbenchActivityProps) {
  const fallback = initialSessionPath ? <ReportLoadingSkeleton /> : <HomeLoadingSkeleton />;
  return (
    <Activity name="ReportWorkbench" mode="visible">
      <Suspense fallback={fallback}>
        <LazyReportWorkbench initialSessionPath={initialSessionPath} initialPlanPath={initialPlanPath} />
      </Suspense>
    </Activity>
  );
}
