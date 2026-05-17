#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

function printHelp() {
  console.log(`Usage: node scripts/android/compare-apk-size-reports.mjs [options] <label=report.json>...

Options:
  --markdown <path>  Write the comparison table to a Markdown file.
  --help            Show this help.

Example:
  npm run compare:android:apk-size -- \\
    baseline=artifacts/baseline/apk-size-report.json \\
    arm-only=artifacts/arm-only/apk-size-report.json \\
    --markdown artifacts/apk-size-stage-comparison.md`);
}

function parseArgs(argv) {
  const entries = [];
  const parsed = { markdownPath: null, entries };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    }

    if (arg === '--markdown') {
      parsed.markdownPath = argv[++index];
      continue;
    }

    const separatorIndex = arg.indexOf('=');
    if (separatorIndex <= 0 || separatorIndex === arg.length - 1) {
      console.error(`Invalid report argument: ${arg}`);
      printHelp();
      process.exit(2);
    }

    entries.push({
      label: arg.slice(0, separatorIndex),
      reportPath: arg.slice(separatorIndex + 1),
    });
  }

  if (entries.length === 0) {
    console.error('At least one report is required.');
    printHelp();
    process.exit(2);
  }

  return parsed;
}

function readReport(entry) {
  const absolutePath = path.resolve(entry.reportPath);
  if (!fs.existsSync(absolutePath)) {
    throw new Error(`Report does not exist: ${entry.reportPath}`);
  }

  const report = JSON.parse(fs.readFileSync(absolutePath, 'utf8'));
  const category = (name) =>
    report.sections?.categories?.find((candidate) => candidate.name === name)?.compressedMiB ?? null;
  const jsBundleMiB = report.sections?.jsBundles?.reduce(
    (total, bundle) => total + (bundle.compressedMiB ?? 0),
    0,
  );
  const fontMiB = report.sections?.fontStats?.reduce(
    (total, font) => total + (font.compressedMiB ?? 0),
    0,
  );

  return {
    label: entry.label,
    path: entry.reportPath,
    sizeMiB: report.artifact?.sizeMiB ?? null,
    sizeBytes: report.artifact?.sizeBytes ?? null,
    abis: report.classification?.abis ?? [],
    nativeLibMiB: category('lib'),
    dexMiB: category('dex'),
    resMiB: category('res'),
    assetsMiB: category('assets'),
    jsBundleMiB: jsBundleMiB ?? null,
    fontMiB: fontMiB ?? null,
    sha256: report.artifact?.sha256 ?? null,
  };
}

function formatMiB(value) {
  return typeof value === 'number' ? value.toFixed(3) : 'n/a';
}

function formatDelta(value) {
  if (typeof value !== 'number') {
    return 'n/a';
  }

  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(3)}`;
}

function formatPercent(value) {
  if (typeof value !== 'number') {
    return 'n/a';
  }

  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(1)}%`;
}

function buildMarkdown(rows) {
  const baseline = rows[0];
  const lines = [
    '| Stage | APK MiB | Delta vs baseline | Delta % | ABI | Native lib MiB | Dex MiB | JS bundle MiB | Fonts MiB |',
    '| --- | ---: | ---: | ---: | --- | ---: | ---: | ---: | ---: |',
  ];

  for (const row of rows) {
    const delta =
      typeof row.sizeMiB === 'number' && typeof baseline.sizeMiB === 'number'
        ? row.sizeMiB - baseline.sizeMiB
        : null;
    const deltaPercent =
      typeof delta === 'number' && typeof baseline.sizeMiB === 'number' && baseline.sizeMiB > 0
        ? (delta / baseline.sizeMiB) * 100
        : null;

    lines.push(
      [
        row.label,
        formatMiB(row.sizeMiB),
        formatDelta(delta),
        formatPercent(deltaPercent),
        row.abis.join(', ') || 'n/a',
        formatMiB(row.nativeLibMiB),
        formatMiB(row.dexMiB),
        formatMiB(row.jsBundleMiB),
        formatMiB(row.fontMiB),
      ].join(' | ').replace(/^/, '| ').replace(/$/, ' |'),
    );
  }

  return `${lines.join('\n')}\n`;
}

const options = parseArgs(process.argv.slice(2));
const rows = options.entries.map(readReport);
const markdown = buildMarkdown(rows);

process.stdout.write(markdown);

if (options.markdownPath) {
  const outputPath = path.resolve(options.markdownPath);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, markdown);
}
