import { NextResponse } from 'next/server';

import { listScanJobs, startScanJob } from '@/lib/scan-jobs';

export const runtime = 'nodejs';

interface ScanRequest {
  root?: string;
  sessionId?: string;
  mediaType?: 'all' | 'photo' | 'video';
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as ScanRequest;
    if (!body.root?.trim()) {
      return NextResponse.json({ error: 'scan root is required' }, { status: 400 });
    }
    const job = await startScanJob({
      root: body.root.trim(),
      sessionId: body.sessionId,
      mediaType: body.mediaType,
    });
    return NextResponse.json(job, { status: 202 });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}

export function GET() {
  return NextResponse.json({
    jobs: listScanJobs(),
  });
}
