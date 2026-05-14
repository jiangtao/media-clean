'use client';

import { Activity, lazy, Suspense } from 'react';

import { ReportLoadingSkeleton } from '@/components/report-loading-skeleton';

const LazyReportWorkbench = lazy(() =>
  import('@/components/report-workbench').then((module) => ({
    default: module.ReportWorkbench,
  })),
);

export function ReportWorkbenchActivity() {
  return (
    <Activity name="ReportWorkbench" mode="visible">
      <Suspense fallback={<ReportLoadingSkeleton />}>
        <LazyReportWorkbench />
      </Suspense>
    </Activity>
  );
}
