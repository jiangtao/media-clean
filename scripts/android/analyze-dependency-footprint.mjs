#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const SOURCE_ROOTS = ['src', 'index.ts'];

const ALLOWED_ZERO_IMPORT_DEPENDENCIES = new Map([
  [
    'expo-splash-screen',
    'Used by the Expo config plugin in app.json to generate native splash resources.',
  ],
  [
    'react-native-screens',
    'Runtime peer for React Navigation native stack and bottom tabs.',
  ],
  [
    'expo-system-ui',
    'Required by app.json expo.userInterfaceStyle=automatic to generate native system UI behavior.',
  ],
  [
    'react-native-worklets',
    'Runtime peer for react-native-reanimated 4 worklets on native builds.',
  ],
  [
    'nativewind',
    'Consumed by Babel, Metro, Tailwind preset, generated CSS, and NativeWind types rather than direct app-source imports.',
  ],
  [
    '@rn-primitives/slot',
    'Baseline RNR runtime dependency required by registry-compatible primitives when slot-based components are added.',
  ],
  [
    '@rn-primitives/types',
    'Baseline RNR type contract dependency required by registry-compatible primitive source.',
  ],
  [
    'class-variance-authority',
    'Baseline RNR variant utility dependency for shadcn/RNR-compatible primitive source.',
  ],
  [
    'lucide-react-native',
    'Baseline icon dependency for RNR-compatible primitive and action-button implementations.',
  ],
]);

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function walkSourceFiles(repoRoot, relativePath, files) {
  const absolutePath = path.join(repoRoot, relativePath);
  if (!fs.existsSync(absolutePath)) {
    return;
  }

  const stat = fs.statSync(absolutePath);
  if (stat.isFile()) {
    if (/\.[cm]?[jt]sx?$/.test(relativePath)) {
      files.push(relativePath);
    }
    return;
  }

  for (const entry of fs.readdirSync(absolutePath)) {
    if (entry === 'node_modules' || entry === 'android' || entry === 'ios') {
      continue;
    }
    walkSourceFiles(repoRoot, path.join(relativePath, entry), files);
  }
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function countRuntimeImports(repoRoot, dependencyName, files) {
  const escaped = escapeRegExp(dependencyName);
  const importPattern = new RegExp(
    `(?:from\\s+['"]${escaped}(?:/[^'"]*)?['"]|import\\(['"]${escaped}(?:/[^'"]*)?['"]\\)|require\\(['"]${escaped}(?:/[^'"]*)?['"]\\))`,
  );
  const hits = [];

  for (const relativePath of files) {
    const source = fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
    if (importPattern.test(source)) {
      hits.push(relativePath);
    }
  }

  return hits;
}

function collectExpoPlugins(repoRoot) {
  const appJsonPath = path.join(repoRoot, 'app.json');
  if (!fs.existsSync(appJsonPath)) {
    return new Set();
  }

  const appJson = readJson(appJsonPath);
  const plugins = appJson.expo?.plugins ?? [];
  const pluginNames = plugins
    .map((plugin) => (Array.isArray(plugin) ? plugin[0] : plugin))
    .filter((plugin) => typeof plugin === 'string');

  return new Set(pluginNames);
}

function main() {
  const repoRoot = process.cwd();
  const packageJson = readJson(path.join(repoRoot, 'package.json'));
  const dependencies = Object.keys(packageJson.dependencies ?? {}).sort();
  const files = [];
  const expoPlugins = collectExpoPlugins(repoRoot);

  for (const root of SOURCE_ROOTS) {
    walkSourceFiles(repoRoot, root, files);
  }

  const rows = dependencies.map((name) => {
    const hits = countRuntimeImports(repoRoot, name, files);
    const configPluginUsed = expoPlugins.has(name);
    const allowedReason = ALLOWED_ZERO_IMPORT_DEPENDENCIES.get(name);

    return {
      name,
      importCount: hits.length,
      hits,
      configPluginUsed,
      allowedReason: allowedReason ?? null,
      ok: hits.length > 0 || configPluginUsed || Boolean(allowedReason),
    };
  });

  const suspicious = rows.filter((row) => !row.ok);

  console.log(
    JSON.stringify(
      {
        ok: suspicious.length === 0,
        sourceFileCount: files.length,
        dependencies: rows,
        suspicious,
      },
      null,
      2,
    ),
  );

  if (suspicious.length > 0) {
    console.error('\nSuspicious direct dependencies with no runtime import or allowlist reason:');
    for (const row of suspicious) {
      console.error(`  - ${row.name}`);
    }
    process.exit(1);
  }
}

main();
