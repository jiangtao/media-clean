import crypto from 'node:crypto';
import { execFile } from 'node:child_process';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

import { fileUriToPath } from '@/lib/local-paths';

export const runtime = 'nodejs';

const execFileAsync = promisify(execFile);
const POSTER_CACHE_DIR = path.join(os.tmpdir(), 'mc-report-video-posters');

export async function GET(request: Request) {
  const url = new URL(request.url);
  const uri = url.searchParams.get('uri');
  if (!uri) {
    return new Response('missing uri', { status: 400 });
  }

  let filePath: string;
  try {
    filePath = fileUriToPath(uri);
  } catch (error) {
    return new Response(error instanceof Error ? error.message : 'invalid uri', { status: 400 });
  }

  if (!fs.existsSync(filePath)) {
    return new Response('media not found', { status: 404 });
  }

  const timestampSeconds = normalizeTimestamp(url.searchParams.get('time'));
  const posterPath = await cachedPosterPath(filePath, timestampSeconds);
  if (!fs.existsSync(posterPath)) {
    try {
      await extractPoster(filePath, posterPath, timestampSeconds);
    } catch (error) {
      return new Response(error instanceof Error ? error.message : 'poster unavailable', { status: 503 });
    }
  }

  const bytes = await fsp.readFile(posterPath);
  return new Response(bytes, {
    headers: {
      'Cache-Control': 'public, max-age=86400',
      'Content-Length': String(bytes.length),
      'Content-Type': 'image/jpeg',
    },
  });
}

function normalizeTimestamp(input: string | null) {
  const parsed = input ? Number(input) : 0.5;
  if (!Number.isFinite(parsed) || parsed < 0) return 0.5;
  return parsed;
}

async function cachedPosterPath(filePath: string, timestampSeconds: number) {
  const stat = await fsp.stat(filePath);
  const key = crypto
    .createHash('sha256')
    .update(`${filePath}:${stat.size}:${stat.mtimeMs}:${timestampSeconds.toFixed(3)}`)
    .digest('hex');
  await fsp.mkdir(POSTER_CACHE_DIR, { recursive: true });
  return path.join(POSTER_CACHE_DIR, `${key}.jpg`);
}

async function extractPoster(filePath: string, posterPath: string, timestampSeconds: number) {
  const tempPath = `${posterPath}.part-${process.pid}.jpg`;
  await fsp.rm(tempPath, { force: true });
  const seconds = timestampSeconds.toFixed(3);
  try {
    await execFileAsync(
      'ffmpeg',
      ['-v', 'error', '-ss', seconds, '-i', filePath, '-frames:v', '1', '-q:v', '3', '-y', tempPath],
      { timeout: 15_000 },
    );
    await fsp.rename(tempPath, posterPath);
  } catch (error) {
    await fsp.rm(tempPath, { force: true });
    throw error;
  }
}
