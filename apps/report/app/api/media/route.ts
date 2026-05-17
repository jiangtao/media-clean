import fs from 'node:fs';
import { Readable } from 'node:stream';

import { contentTypeForPath, fileUriToPath } from '@/lib/local-paths';

export const runtime = 'nodejs';

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

  const stat = fs.statSync(filePath);
  const range = request.headers.get('range');
  const contentType = contentTypeForPath(filePath);

  if (range) {
    const match = /bytes=(\d+)-(\d*)/.exec(range);
    if (!match) {
      return new Response('invalid range', { status: 416 });
    }
    const start = Number(match[1]);
    const end = match[2] ? Number(match[2]) : stat.size - 1;
    if (start >= stat.size || end >= stat.size || start > end) {
      return new Response('range not satisfiable', {
        status: 416,
        headers: {
          'Content-Range': `bytes */${stat.size}`,
        },
      });
    }
    const stream = fs.createReadStream(filePath, { start, end });
    return new Response(Readable.toWeb(stream) as ReadableStream, {
      status: 206,
      headers: {
        'Accept-Ranges': 'bytes',
        'Content-Length': String(end - start + 1),
        'Content-Range': `bytes ${start}-${end}/${stat.size}`,
        'Content-Type': contentType,
      },
    });
  }

  const stream = fs.createReadStream(filePath);
  return new Response(Readable.toWeb(stream) as ReadableStream, {
    headers: {
      'Accept-Ranges': 'bytes',
      'Content-Length': String(stat.size),
      'Content-Type': contentType,
    },
  });
}
