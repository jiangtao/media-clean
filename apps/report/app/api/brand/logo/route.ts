import fsp from 'node:fs/promises';
import path from 'node:path';

import { repoRoot } from '@/lib/local-paths';

export const runtime = 'nodejs';

export async function GET() {
  const logoPath = path.join(repoRoot(), 'assets', 'icon.png');
  const bytes = await fsp.readFile(logoPath);
  return new Response(bytes, {
    headers: {
      'Cache-Control': 'public, max-age=3600',
      'Content-Type': 'image/png',
    },
  });
}
