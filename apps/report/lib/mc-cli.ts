import { execFile, spawn } from 'node:child_process';
import path from 'node:path';
import { promisify } from 'node:util';

import { repoRoot } from '@/lib/local-paths';

const execFileAsync = promisify(execFile);

export async function runMc(args: string[], options?: { maxBuffer?: number }) {
  const invocation = resolveMcInvocation(args);
  const { stdout, stderr } = await execFileAsync(invocation.command, invocation.args, {
    cwd: repoRoot(),
    maxBuffer: options?.maxBuffer ?? 64 * 1024 * 1024,
  });
  return {
    ...invocation,
    stdout,
    stderr,
  };
}

export function spawnMc(args: string[]) {
  const invocation = resolveMcInvocation(args);
  const child = spawn(invocation.command, invocation.args, {
    cwd: repoRoot(),
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  return {
    ...invocation,
    child,
  };
}

export function resolveMcInvocation(args: string[]) {
  if (process.env.MC_CLI_BIN) {
    return { command: process.env.MC_CLI_BIN, args };
  }

  return {
    command: 'cargo',
    args: [
      'run',
      '--quiet',
      '--manifest-path',
      path.join(repoRoot(), 'engines/recognition/Cargo.toml'),
      '-p',
      'mc-cli',
      '--',
      ...args,
    ],
  };
}
