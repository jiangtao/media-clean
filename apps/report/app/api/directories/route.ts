import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { NextResponse } from 'next/server';

import { repoRoot, resolveInputPath } from '@/lib/local-paths';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const requestedPath = url.searchParams.get('path');
    const currentPath = requestedPath ? resolveInputPath(requestedPath) : defaultDirectory();
    const entries = await fsp.readdir(currentPath, { withFileTypes: true });
    const directories = entries
      .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.'))
      .map((entry) => ({
        name: entry.name,
        path: path.join(currentPath, entry.name),
      }))
      .sort((left, right) => left.name.localeCompare(right.name));

    return NextResponse.json({
      current: currentPath,
      parent: path.dirname(currentPath) === currentPath ? null : path.dirname(currentPath),
      roots: quickRoots(),
      directories,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}

function defaultDirectory() {
  const preferred = path.join(os.homedir(), 'places', 'personal', 'mc-test-assets');
  return preferred;
}

function quickRoots() {
  return [
    { label: 'mc-test-assets', path: path.join(os.homedir(), 'places', 'personal', 'mc-test-assets') },
    { label: 'personal', path: path.join(os.homedir(), 'places', 'personal') },
    { label: 'places', path: path.join(os.homedir(), 'places') },
    { label: 'home', path: os.homedir() },
    { label: 'repo', path: repoRoot() },
  ];
}
