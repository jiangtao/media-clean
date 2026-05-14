#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '..');
const MiB = 1024 * 1024;
const simulatorAbis = new Set(['x86', 'x86_64']);
const knownNativeAbis = ['armeabi-v7a', 'arm64-v8a', 'x86', 'x86_64'];

const profiles = {
  'user-arm64': {
    label: '用户侧 arm64 APK',
    expectedAbis: ['arm64-v8a'],
    warnMiB: 50,
    failMiB: 60,
    failOnSimulatorAbi: true,
  },
  'user-arm-only': {
    label: '用户侧 ARM APK',
    expectedAbis: ['armeabi-v7a', 'arm64-v8a'],
    warnMiB: 60,
    failMiB: 70,
    failOnSimulatorAbi: true,
  },
  'internal-universal': {
    label: '内部 universal APK',
    expectedAbis: knownNativeAbis,
    warnMiB: 100,
    failMiB: 120,
    failOnSimulatorAbi: false,
  },
};

function usage() {
  console.log(`用法:
  node scripts/android/analyze-apk-size.mjs <apk-path> [options]

Options:
  --out-dir <dir>              输出目录，默认 artifacts/android-apk-size
  --json <path>                JSON report 输出路径
  --markdown <path>            Markdown report 输出路径
  --profile <name>             user-arm-only | user-arm64 | internal-universal，默认 user-arm-only
  --expected-abis <csv>        期望 ABI 列表，例如 armeabi-v7a,arm64-v8a
  --warn-size-mib <number>     覆盖 warning 阈值
  --fail-size-mib <number>     覆盖 failure 阈值
  --fail-on-budget             超出预算、ABI 不匹配或含模拟器 ABI 时返回非 0
  --allow-simulator-abi        用户侧 profile 下允许 x86 / x86_64
  --skip-apkanalyzer           不尝试调用 apkanalyzer
  --help                       显示帮助
`);
}

function parseArgs(argv) {
  const args = {
    apkPath: null,
    outDir: path.join(repoRoot, 'artifacts', 'android-apk-size'),
    jsonPath: null,
    markdownPath: null,
    profile: 'user-arm-only',
    expectedAbis: null,
    warnSizeMiB: null,
    failSizeMiB: null,
    failOnBudget: false,
    allowSimulatorAbi: false,
    skipApkanalyzer: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    switch (arg) {
      case '--help':
      case '-h':
        usage();
        process.exit(0);
        break;
      case '--apk':
        args.apkPath = argv[++index];
        break;
      case '--out-dir':
        args.outDir = argv[++index];
        break;
      case '--json':
        args.jsonPath = argv[++index];
        break;
      case '--markdown':
        args.markdownPath = argv[++index];
        break;
      case '--profile':
        args.profile = argv[++index];
        break;
      case '--expected-abis':
        args.expectedAbis = parseCsv(argv[++index]);
        break;
      case '--warn-size-mib':
        args.warnSizeMiB = Number(argv[++index]);
        break;
      case '--fail-size-mib':
        args.failSizeMiB = Number(argv[++index]);
        break;
      case '--fail-on-budget':
        args.failOnBudget = true;
        break;
      case '--allow-simulator-abi':
        args.allowSimulatorAbi = true;
        break;
      case '--skip-apkanalyzer':
        args.skipApkanalyzer = true;
        break;
      default:
        if (arg.startsWith('--')) {
          throw new Error(`未知参数: ${arg}`);
        }
        if (args.apkPath) {
          throw new Error(`重复 APK 路径: ${arg}`);
        }
        args.apkPath = arg;
    }
  }

  if (!args.apkPath) {
    throw new Error('缺少 APK 路径');
  }

  if (!profiles[args.profile]) {
    throw new Error(`未知 profile: ${args.profile}`);
  }

  return args;
}

function parseCsv(value) {
  return String(value ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function formatMiB(bytes) {
  return `${(bytes / MiB).toFixed(2)} MiB`;
}

function percent(part, total) {
  if (total === 0) return '0.0%';
  return `${((part / total) * 100).toFixed(1)}%`;
}

function sha256(filePath) {
  const hash = crypto.createHash('sha256');
  const fd = fs.openSync(filePath, 'r');
  const buffer = Buffer.allocUnsafe(1024 * 1024);

  try {
    let bytesRead = 0;
    do {
      bytesRead = fs.readSync(fd, buffer, 0, buffer.length, null);
      if (bytesRead > 0) {
        hash.update(buffer.subarray(0, bytesRead));
      }
    } while (bytesRead > 0);
  } finally {
    fs.closeSync(fd);
  }

  return hash.digest('hex');
}

function findEndOfCentralDirectory(buffer) {
  const minOffset = Math.max(0, buffer.length - 65557);
  for (let offset = buffer.length - 22; offset >= minOffset; offset -= 1) {
    if (buffer.readUInt32LE(offset) === 0x06054b50) {
      return offset;
    }
  }
  throw new Error('不是有效 ZIP/APK：找不到 End Of Central Directory');
}

function readZipEntries(apkPath) {
  const buffer = fs.readFileSync(apkPath);
  const eocdOffset = findEndOfCentralDirectory(buffer);
  const entryCount = buffer.readUInt16LE(eocdOffset + 10);
  const centralDirectorySize = buffer.readUInt32LE(eocdOffset + 12);
  const centralDirectoryOffset = buffer.readUInt32LE(eocdOffset + 16);

  if (
    entryCount === 0xffff ||
    centralDirectorySize === 0xffffffff ||
    centralDirectoryOffset === 0xffffffff
  ) {
    throw new Error('暂不支持 ZIP64 APK，请改用 apkanalyzer 或 unzip 生成报告');
  }

  const entries = [];
  let offset = centralDirectoryOffset;

  for (let index = 0; index < entryCount; index += 1) {
    if (buffer.readUInt32LE(offset) !== 0x02014b50) {
      throw new Error(`Central Directory 损坏，offset=${offset}`);
    }

    const method = buffer.readUInt16LE(offset + 10);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const uncompressedSize = buffer.readUInt32LE(offset + 24);
    const fileNameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const nameStart = offset + 46;
    const nameEnd = nameStart + fileNameLength;
    const name = buffer.subarray(nameStart, nameEnd).toString('utf8');

    if (!name.endsWith('/')) {
      entries.push({
        name,
        method,
        compressedSize,
        uncompressedSize,
      });
    }

    offset = nameEnd + extraLength + commentLength;
  }

  return entries;
}

function addStat(map, key, entry) {
  if (!map.has(key)) {
    map.set(key, {
      name: key,
      files: 0,
      compressedBytes: 0,
      uncompressedBytes: 0,
    });
  }

  const stat = map.get(key);
  stat.files += 1;
  stat.compressedBytes += entry.compressedSize;
  stat.uncompressedBytes += entry.uncompressedSize;
}

function categoryFor(name) {
  if (name.startsWith('lib/')) return 'lib';
  if (/^classes[0-9]*\.dex$/.test(name)) return 'dex';
  if (name.startsWith('assets/')) return 'assets';
  if (name.startsWith('res/')) return 'res';
  if (name === 'resources.arsc') return 'resources.arsc';
  if (name.startsWith('META-INF/')) return 'META-INF';
  return 'other';
}

function extensionFor(name) {
  const extension = path.extname(name).toLowerCase().replace(/^\./, '');
  return extension || '<none>';
}

function sortByCompressedDesc(items) {
  return [...items].sort((left, right) => right.compressedBytes - left.compressedBytes);
}

function analyzeEntries(entries) {
  const categories = new Map();
  const abiStats = new Map();
  const nativeLibStats = new Map();
  const extensionStats = new Map();
  const imageStats = new Map();
  const fontStats = new Map();
  const jsBundles = [];
  const dexEntries = [];
  const nativeStoredEntries = [];

  for (const entry of entries) {
    addStat(categories, categoryFor(entry.name), entry);
    addStat(extensionStats, extensionFor(entry.name), entry);

    if (entry.name.startsWith('lib/')) {
      const [, abi, libraryName] = entry.name.split('/');
      addStat(abiStats, abi, entry);
      addStat(nativeLibStats, libraryName, entry);
      if (entry.method === 0) {
        nativeStoredEntries.push(entry);
      }
    }

    if (/^classes[0-9]*\.dex$/.test(entry.name)) {
      dexEntries.push(entry);
    }

    if (entry.name.startsWith('assets/') && entry.name.endsWith('.bundle')) {
      jsBundles.push(entry);
    }

    if (/\.(png|webp|jpe?g)$/i.test(entry.name)) {
      addStat(imageStats, extensionFor(entry.name), entry);
    }

    if (/\.(ttf|otf)$/i.test(entry.name)) {
      addStat(fontStats, extensionFor(entry.name), entry);
    }
  }

  const abis = [...abiStats.keys()].sort();
  const isUniversal = knownNativeAbis.every((abi) => abiStats.has(abi));
  const simulatorAbiCompressedBytes = [...abiStats.values()]
    .filter((stat) => simulatorAbis.has(stat.name))
    .reduce((total, stat) => total + stat.compressedBytes, 0);
  const arm32CompressedBytes = abiStats.get('armeabi-v7a')?.compressedBytes ?? 0;

  return {
    categories: sortByCompressedDesc(categories.values()),
    abiStats: sortByCompressedDesc(abiStats.values()),
    nativeLibStats: sortByCompressedDesc(nativeLibStats.values()),
    extensionStats: sortByCompressedDesc(extensionStats.values()),
    imageStats: sortByCompressedDesc(imageStats.values()),
    fontStats: sortByCompressedDesc(fontStats.values()),
    largestEntries: entries
      .map((entry) => ({
        name: entry.name,
        compressedBytes: entry.compressedSize,
        uncompressedBytes: entry.uncompressedSize,
        method: entry.method,
      }))
      .sort((left, right) => right.compressedBytes - left.compressedBytes)
      .slice(0, 30),
    jsBundles,
    dexEntries,
    abis,
    isUniversal,
    nativeStoredEntryCount: nativeStoredEntries.length,
    simulatorAbiCompressedBytes,
    arm32CompressedBytes,
  };
}

function runApkAnalyzer(apkPath, skip) {
  if (skip) {
    return {
      available: false,
      skipped: true,
      reason: 'skip requested',
    };
  }

  const result = spawnSync('apkanalyzer', ['apk', 'summary', apkPath], {
    encoding: 'utf8',
    timeout: 30_000,
  });

  if (result.error) {
    return {
      available: false,
      error: result.error.message,
    };
  }

  if (result.status !== 0) {
    return {
      available: false,
      status: result.status,
      error: [result.stdout, result.stderr].filter(Boolean).join('\n').trim(),
    };
  }

  return {
    available: true,
    summary: result.stdout.trim(),
  };
}

function compareSets(actual, expected) {
  const actualSet = new Set(actual);
  const expectedSet = new Set(expected);
  const missing = expected.filter((item) => !actualSet.has(item));
  const unexpected = actual.filter((item) => !expectedSet.has(item));
  return { missing, unexpected };
}

function evaluateBudget({ args, profile, fileSizeBytes, analysis }) {
  const warnMiB = Number.isFinite(args.warnSizeMiB) ? args.warnSizeMiB : profile.warnMiB;
  const failMiB = Number.isFinite(args.failSizeMiB) ? args.failSizeMiB : profile.failMiB;
  const expectedAbis = args.expectedAbis ?? profile.expectedAbis;
  const warnings = [];
  const failures = [];
  const fileSizeMiB = fileSizeBytes / MiB;

  if (fileSizeMiB > warnMiB) {
    warnings.push(`APK size ${fileSizeMiB.toFixed(2)} MiB exceeds warning budget ${warnMiB} MiB`);
  }

  if (fileSizeMiB > failMiB) {
    failures.push(`APK size ${fileSizeMiB.toFixed(2)} MiB exceeds failure budget ${failMiB} MiB`);
  }

  const simulatorAbisInApk = analysis.abis.filter((abi) => simulatorAbis.has(abi));
  if (profile.failOnSimulatorAbi && !args.allowSimulatorAbi && simulatorAbisInApk.length > 0) {
    failures.push(`用户侧 APK 不应包含模拟器 ABI: ${simulatorAbisInApk.join(', ')}`);
  }

  if (expectedAbis?.length > 0) {
    const { missing, unexpected } = compareSets(analysis.abis, expectedAbis);
    if (missing.length > 0) {
      failures.push(`APK 缺少期望 ABI: ${missing.join(', ')}`);
    }
    if (unexpected.length > 0) {
      failures.push(`APK 包含非期望 ABI: ${unexpected.join(', ')}`);
    }
  }

  return {
    profile: args.profile,
    profileLabel: profile.label,
    warnMiB,
    failMiB,
    expectedAbis,
    warnings,
    failures,
    pass: failures.length === 0,
  };
}

function statToReport(stat) {
  return {
    name: stat.name,
    files: stat.files,
    compressedBytes: stat.compressedBytes,
    compressedMiB: Number((stat.compressedBytes / MiB).toFixed(3)),
    uncompressedBytes: stat.uncompressedBytes,
    uncompressedMiB: Number((stat.uncompressedBytes / MiB).toFixed(3)),
  };
}

function entryToReport(entry) {
  return {
    name: entry.name,
    compressedBytes: entry.compressedSize ?? entry.compressedBytes,
    compressedMiB: Number(((entry.compressedSize ?? entry.compressedBytes) / MiB).toFixed(3)),
    uncompressedBytes: entry.uncompressedSize ?? entry.uncompressedBytes,
    uncompressedMiB: Number(((entry.uncompressedSize ?? entry.uncompressedBytes) / MiB).toFixed(3)),
    method: entry.method,
  };
}

function makeReport({ apkPath, fileSizeBytes, checksum, entries, analysis, budget, apkAnalyzer }) {
  const totalEntryCompressedBytes = entries.reduce((total, entry) => total + entry.compressedSize, 0);
  const totalEntryUncompressedBytes = entries.reduce((total, entry) => total + entry.uncompressedSize, 0);
  const libBytes = analysis.categories.find((item) => item.name === 'lib')?.compressedBytes ?? 0;
  const estimatedArmOnlyBytes = Math.max(0, fileSizeBytes - analysis.simulatorAbiCompressedBytes);
  const estimatedArm64OnlyBytes = Math.max(
    0,
    fileSizeBytes - analysis.simulatorAbiCompressedBytes - analysis.arm32CompressedBytes,
  );

  return {
    generatedAt: new Date().toISOString(),
    host: os.hostname(),
    artifact: {
      path: path.relative(repoRoot, apkPath),
      absolutePath: apkPath,
      sizeBytes: fileSizeBytes,
      sizeMiB: Number((fileSizeBytes / MiB).toFixed(3)),
      sha256: checksum,
      entryCount: entries.length,
      totalEntryCompressedBytes,
      totalEntryCompressedMiB: Number((totalEntryCompressedBytes / MiB).toFixed(3)),
      totalEntryUncompressedBytes,
      totalEntryUncompressedMiB: Number((totalEntryUncompressedBytes / MiB).toFixed(3)),
    },
    classification: {
      abis: analysis.abis,
      isUniversal: analysis.isUniversal,
      nativeLibCompressedBytes: libBytes,
      nativeLibPercentOfEntries: Number(((libBytes / Math.max(totalEntryCompressedBytes, 1)) * 100).toFixed(1)),
      nativeStoredEntryCount: analysis.nativeStoredEntryCount,
      simulatorAbiCompressedBytes: analysis.simulatorAbiCompressedBytes,
      simulatorAbiCompressedMiB: Number((analysis.simulatorAbiCompressedBytes / MiB).toFixed(3)),
      estimatedArmOnlySizeBytes: estimatedArmOnlyBytes,
      estimatedArmOnlySizeMiB: Number((estimatedArmOnlyBytes / MiB).toFixed(3)),
      estimatedArm64OnlySizeBytes: estimatedArm64OnlyBytes,
      estimatedArm64OnlySizeMiB: Number((estimatedArm64OnlyBytes / MiB).toFixed(3)),
    },
    budget,
    apkAnalyzer,
    sections: {
      categories: analysis.categories.map(statToReport),
      abiStats: analysis.abiStats.map(statToReport),
      nativeLibStats: analysis.nativeLibStats.slice(0, 30).map(statToReport),
      dexEntries: analysis.dexEntries.map(entryToReport),
      jsBundles: analysis.jsBundles.map(entryToReport),
      imageStats: analysis.imageStats.map(statToReport),
      fontStats: analysis.fontStats.map(statToReport),
      largestEntries: analysis.largestEntries.map(entryToReport),
    },
  };
}

function markdownTable(headers, rows) {
  if (rows.length === 0) {
    return '_无数据_\n';
  }

  return [
    `| ${headers.join(' |')} |`,
    `| ${headers.map(() => '---').join(' |')} |`,
    ...rows.map((row) => `| ${row.join(' |')} |`),
    '',
  ].join('\n');
}

function makeMarkdown(report) {
  const failureLines = report.budget.failures.length
    ? report.budget.failures.map((item) => `- ${item}`).join('\n')
    : '- 无';
  const warningLines = report.budget.warnings.length
    ? report.budget.warnings.map((item) => `- ${item}`).join('\n')
    : '- 无';

  return `# Android APK Size Report

## Summary

- Artifact: \`${report.artifact.path}\`
- Size: ${formatMiB(report.artifact.sizeBytes)} (${report.artifact.sizeBytes} bytes)
- SHA256: \`${report.artifact.sha256}\`
- Profile: \`${report.budget.profile}\` (${report.budget.profileLabel})
- ABIs: ${report.classification.abis.length ? report.classification.abis.map((abi) => `\`${abi}\``).join(', ') : '无 native ABI'}
- Universal APK: ${report.classification.isUniversal ? 'yes' : 'no'}
- Native lib share: ${formatMiB(report.classification.nativeLibCompressedBytes)} (${report.classification.nativeLibPercentOfEntries}% of compressed entries)
- x86/x86_64 savings estimate: ${formatMiB(report.classification.simulatorAbiCompressedBytes)}
- Estimated arm-only APK size: ${formatMiB(report.classification.estimatedArmOnlySizeBytes)}
- Estimated arm64-only APK size: ${formatMiB(report.classification.estimatedArm64OnlySizeBytes)}
- apkanalyzer available: ${report.apkAnalyzer.available ? 'yes' : 'no'}

## Budget

- Warning threshold: ${report.budget.warnMiB} MiB
- Failure threshold: ${report.budget.failMiB} MiB
- Expected ABIs: ${report.budget.expectedAbis.map((abi) => `\`${abi}\``).join(', ') || '未限制'}
- Pass: ${report.budget.pass ? 'yes' : 'no'}

### Failures

${failureLines}

### Warnings

${warningLines}

## Top-Level Composition

${markdownTable(
  ['Category', 'Files', 'Compressed', 'Uncompressed', 'Share'],
  report.sections.categories.map((item) => [
    `\`${item.name}\``,
    String(item.files),
    formatMiB(item.compressedBytes),
    formatMiB(item.uncompressedBytes),
    percent(item.compressedBytes, report.artifact.totalEntryCompressedBytes),
  ]),
)}
## ABI Composition

${markdownTable(
  ['ABI', 'Files', 'Compressed', 'Uncompressed'],
  report.sections.abiStats.map((item) => [
    `\`${item.name}\``,
    String(item.files),
    formatMiB(item.compressedBytes),
    formatMiB(item.uncompressedBytes),
  ]),
)}
## Largest Native Libraries

${markdownTable(
  ['Library', 'ABIs', 'Compressed', 'Uncompressed'],
  report.sections.nativeLibStats.slice(0, 20).map((item) => [
    `\`${item.name}\``,
    String(item.files),
    formatMiB(item.compressedBytes),
    formatMiB(item.uncompressedBytes),
  ]),
)}
## JavaScript Bundles

${markdownTable(
  ['Path', 'Compressed', 'Uncompressed'],
  report.sections.jsBundles.map((item) => [
    `\`${item.name}\``,
    formatMiB(item.compressedBytes),
    formatMiB(item.uncompressedBytes),
  ]),
)}
## DEX

${markdownTable(
  ['Path', 'Compressed', 'Uncompressed'],
  report.sections.dexEntries.map((item) => [
    `\`${item.name}\``,
    formatMiB(item.compressedBytes),
    formatMiB(item.uncompressedBytes),
  ]),
)}
## Fonts

${markdownTable(
  ['Extension', 'Files', 'Compressed', 'Uncompressed'],
  report.sections.fontStats.map((item) => [
    `\`${item.name}\``,
    String(item.files),
    formatMiB(item.compressedBytes),
    formatMiB(item.uncompressedBytes),
  ]),
)}
## Largest Entries

${markdownTable(
  ['Path', 'Compressed', 'Uncompressed'],
  report.sections.largestEntries.slice(0, 20).map((item) => [
    `\`${item.name}\``,
    formatMiB(item.compressedBytes),
    formatMiB(item.uncompressedBytes),
  ]),
)}
`;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const apkPath = path.resolve(args.apkPath);

  if (!fs.existsSync(apkPath)) {
    throw new Error(`APK 不存在: ${apkPath}`);
  }

  const profile = profiles[args.profile];
  const entries = readZipEntries(apkPath);
  const fileSizeBytes = fs.statSync(apkPath).size;
  const checksum = sha256(apkPath);
  const analysis = analyzeEntries(entries);
  const budget = evaluateBudget({ args, profile, fileSizeBytes, analysis });
  const apkAnalyzer = runApkAnalyzer(apkPath, args.skipApkanalyzer);
  const report = makeReport({
    apkPath,
    fileSizeBytes,
    checksum,
    entries,
    analysis,
    budget,
    apkAnalyzer,
  });

  const outDir = path.resolve(args.outDir);
  const jsonPath = path.resolve(args.jsonPath ?? path.join(outDir, 'apk-size-report.json'));
  const markdownPath = path.resolve(args.markdownPath ?? path.join(outDir, 'apk-size-report.md'));
  fs.mkdirSync(path.dirname(jsonPath), { recursive: true });
  fs.mkdirSync(path.dirname(markdownPath), { recursive: true });

  const markdown = makeMarkdown(report);
  fs.writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`);
  fs.writeFileSync(markdownPath, markdown);

  console.log(
    JSON.stringify(
      {
        ok: budget.pass,
        profile: budget.profile,
        sizeMiB: report.artifact.sizeMiB,
        abis: report.classification.abis,
        isUniversal: report.classification.isUniversal,
        nativeLibMiB: Number((report.classification.nativeLibCompressedBytes / MiB).toFixed(3)),
        simulatorAbiMiB: report.classification.simulatorAbiCompressedMiB,
        estimatedArmOnlyMiB: report.classification.estimatedArmOnlySizeMiB,
        estimatedArm64OnlyMiB: report.classification.estimatedArm64OnlySizeMiB,
        warnings: budget.warnings,
        failures: budget.failures,
        jsonPath: path.relative(repoRoot, jsonPath),
        markdownPath: path.relative(repoRoot, markdownPath),
      },
      null,
      2,
    ),
  );

  if (args.failOnBudget && !budget.pass) {
    process.exitCode = 1;
  }
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
