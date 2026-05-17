import { NextResponse } from 'next/server';

import { cancelScanJob, getScanJob } from '@/lib/scan-jobs';

export const runtime = 'nodejs';

export async function GET(_request: Request, { params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  const job = getScanJob(jobId);
  if (!job) {
    return NextResponse.json({ error: `scan job not found: ${jobId}` }, { status: 404 });
  }
  return NextResponse.json(job, {
    headers: {
      'Cache-Control': 'no-store',
    },
  });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  const job = cancelScanJob(jobId);
  if (!job) {
    return NextResponse.json({ error: `scan job not found: ${jobId}` }, { status: 404 });
  }
  return NextResponse.json(job);
}
