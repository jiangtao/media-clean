#!/usr/bin/env node

import { pathToFileURL } from 'node:url';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import process from 'node:process';

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const defaultFixturePath = path.join(repoRoot, 'fixtures/scan-core/analyzed-inputs.json');

function parseArgs(argv) {
  const args = {
    input: defaultFixturePath,
    output: null,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--input') {
      args.input = path.resolve(argv[index + 1] ?? '');
      index += 1;
      continue;
    }

    if (arg === '--output') {
      args.output = path.resolve(argv[index + 1] ?? '');
      index += 1;
      continue;
    }

    if (arg === '--help' || arg === '-h') {
      args.help = true;
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return args;
}

function printHelp() {
  process.stdout.write(`Usage:
  npm run scan:fixture
  npm run scan:fixture -- --input fixtures/scan-core/analyzed-inputs.json
  npm run scan:fixture -- --input <fixture.json> --output <output.json>

Input shape:
  {
    "analyzedInputs": [...],
    "recycleBinIds": [],
    "falsePositiveIds": [],
    "recycleBinCandidateCache": [],
    "scannedAt": 1710000000999,
    "scannedCount": 2
  }
`);
}

async function loadPortableCore() {
  const { build } = await import('vite');
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'app-cleaner-scan-core-'));
  const outfile = path.join(tempDir, 'portable-scan-core.mjs');

  await build({
    configFile: false,
    logLevel: 'silent',
    build: {
      emptyOutDir: true,
      lib: {
        entry: path.join(repoRoot, 'src/features/scan/portable-scan-core.ts'),
        formats: ['es'],
        fileName: () => 'portable-scan-core.mjs',
      },
      outDir: tempDir,
      target: 'node24',
    },
  });

  const module = await import(`${pathToFileURL(outfile).href}?t=${Date.now()}`);

  return {
    module,
    dispose: () => rm(tempDir, { recursive: true, force: true }),
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }

  const fixture = JSON.parse(await readFile(args.input, 'utf8'));
  const {
    analyzedInputs = [],
    recycleBinIds = [],
    falsePositiveIds = [],
    recycleBinCandidateCache = [],
    scannedAt,
    scannedCount,
  } = fixture;

  const runtime = await loadPortableCore();
  try {
    const output = runtime.module.buildPortableScanOutput(analyzedInputs, recycleBinIds, {
      falsePositiveIds,
      recycleBinCandidateCache,
      scannedAt,
      scannedCount,
    });
    const payload = `${JSON.stringify(output, null, 2)}\n`;

    if (args.output) {
      await writeFile(args.output, payload);
      return;
    }

    process.stdout.write(payload);
  } finally {
    await runtime.dispose();
  }
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
