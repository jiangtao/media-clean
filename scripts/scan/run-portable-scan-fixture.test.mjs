import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const execFileAsync = promisify(execFile);
const repoRoot = path.resolve(import.meta.dirname, '../..');

describe('run-portable-scan-fixture', () => {
  it('runs the real portable scan core against a fixture for CLI/desktop adapter validation', async () => {
    const { stdout } = await execFileAsync(
      process.execPath,
      ['scripts/scan/run-portable-scan-fixture.mjs'],
      { cwd: repoRoot },
    );

    const output = JSON.parse(stdout);

    expect(output.summary).toMatchObject({
      scannedAt: 1_710_000_000_999,
      scannedCount: 2,
      candidateCount: 1,
      recycleBinCount: 0,
    });
    expect(output.state.activeCandidates.map((candidate) => candidate.id)).toEqual(['dark-photo']);
  });
});
