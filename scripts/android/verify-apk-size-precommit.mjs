#!/usr/bin/env node
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const DEFAULT_APK_PATH = 'android/app/build/outputs/apk/release/app-release.apk';
const DEFAULT_OUT_DIR = 'artifacts/android-precommit';

const APK_CRITICAL_PATTERNS = [
  /^package(?:-lock)?\.json$/,
  /^app\.json$/,
  /^app\.config\.[cm]?[jt]s$/,
  /^android\//,
  /^plugins\/withAndroid/,
  /^scripts\/android\/(?:analyze-apk-size|build-release-apk|collect-release-metadata|prepare-keystore|verify-apk-size-precommit|verify-release-artifact)\.(?:mjs|sh)$/,
  /^scripts\/release\/verify-android-release-page-contract\.mjs$/,
  /^\.github\/workflows\/android-release\.yml$/,
  /^assets\/(?:icon|adaptive-icon|splash-brand)/,
];

function parseArgs(argv) {
  const parsed = {
    apkPath: process.env.ANDROID_APK_SIZE_PRECOMMIT_APK || DEFAULT_APK_PATH,
    outDir: process.env.ANDROID_APK_SIZE_PRECOMMIT_OUT_DIR || DEFAULT_OUT_DIR,
    requireApk: process.env.ANDROID_APK_SIZE_PRECOMMIT_REQUIRE_APK === '1',
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--apk') {
      parsed.apkPath = argv[++index];
      continue;
    }

    if (arg === '--out-dir') {
      parsed.outDir = argv[++index];
      continue;
    }

    if (arg === '--require-apk') {
      parsed.requireApk = true;
      continue;
    }

    if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    }

    console.error(`Unknown argument: ${arg}`);
    printHelp();
    process.exit(2);
  }

  return parsed;
}

function printHelp() {
  console.log(`Usage: node scripts/android/verify-apk-size-precommit.mjs [options]

Options:
  --apk <path>       APK to analyze. Default: ${DEFAULT_APK_PATH}
  --out-dir <dir>    Report directory. Default: ${DEFAULT_OUT_DIR}
  --require-apk      Fail if the APK is missing, even when no APK-critical files are staged.

Environment:
  ANDROID_APK_SIZE_PRECOMMIT_APK
  ANDROID_APK_SIZE_PRECOMMIT_OUT_DIR
  ANDROID_APK_SIZE_PRECOMMIT_REQUIRE_APK=1
  SKIP_ANDROID_APK_SIZE_PRECOMMIT=1`);
}

function runGit(gitArgs, options = {}) {
  return execFileSync('git', gitArgs, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', options.ignoreError ? 'ignore' : 'pipe'],
  }).trim();
}

function resolveRepoRoot() {
  try {
    return runGit(['rev-parse', '--show-toplevel']);
  } catch (error) {
    return process.cwd();
  }
}

function getStagedFiles() {
  try {
    const output = runGit(['diff', '--cached', '--name-only', '--diff-filter=ACMRT'], {
      ignoreError: true,
    });
    return output ? output.split('\n').filter(Boolean) : [];
  } catch (error) {
    return [];
  }
}

function isApkCriticalFile(filePath) {
  return APK_CRITICAL_PATTERNS.some((pattern) => pattern.test(filePath));
}

function runNodeCheck(repoRoot) {
  const result = spawnSync(process.execPath, ['--check', 'scripts/android/analyze-apk-size.mjs'], {
    cwd: repoRoot,
    stdio: 'inherit',
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function runSizeAnalyzer(repoRoot, apkPath, outDir) {
  const result = spawnSync(
    process.execPath,
    [
      'scripts/android/analyze-apk-size.mjs',
      apkPath,
      '--out-dir',
      outDir,
      '--profile',
      'user-arm-only',
      '--fail-on-budget',
    ],
    {
      cwd: repoRoot,
      stdio: 'inherit',
    },
  );

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function printMissingApkFailure({ apkPath, criticalFiles, requireApk }) {
  const reason = requireApk
    ? 'This run requires an APK size report.'
    : 'APK-critical files are staged, so this commit must refresh the APK size report before CI.';

  console.error(`\nAndroid APK size pre-commit gate failed.`);
  console.error(reason);
  console.error(`Missing APK: ${apkPath}`);

  if (criticalFiles.length > 0) {
    console.error('\nAPK-critical staged files:');
    for (const filePath of criticalFiles) {
      console.error(`  - ${filePath}`);
    }
  }

  console.error(`\nBuild and analyze a local release smoke APK first:`);
  console.error(`  npm run build:android:release:smoke`);
  console.error(`  npm run verify:precommit:android-size`);
  console.error(`\nFor doc-only or emergency commits, set SKIP_ANDROID_APK_SIZE_PRECOMMIT=1 and record why.`);
}

const options = parseArgs(process.argv.slice(2));

if (process.env.SKIP_ANDROID_APK_SIZE_PRECOMMIT === '1') {
  console.log('Skipping Android APK size pre-commit gate because SKIP_ANDROID_APK_SIZE_PRECOMMIT=1.');
  process.exit(0);
}

const repoRoot = resolveRepoRoot();
const stagedFiles = getStagedFiles();
const criticalFiles = stagedFiles.filter(isApkCriticalFile);
const apkPath = path.resolve(repoRoot, options.apkPath);
const outDir = path.resolve(repoRoot, options.outDir);

runNodeCheck(repoRoot);

if (!existsSync(apkPath)) {
  if (options.requireApk || criticalFiles.length > 0) {
    printMissingApkFailure({
      apkPath: path.relative(repoRoot, apkPath),
      criticalFiles,
      requireApk: options.requireApk,
    });
    process.exit(1);
  }

  console.log(
    `Android APK size pre-commit gate: ${path.relative(
      repoRoot,
      apkPath,
    )} is missing, and no APK-critical files are staged. Static analyzer syntax check passed.`,
  );
  process.exit(0);
}

runSizeAnalyzer(repoRoot, path.relative(repoRoot, apkPath), path.relative(repoRoot, outDir));
