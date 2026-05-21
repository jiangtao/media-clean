import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

const failures = [];

function fail(message) {
  failures.push(message);
}

function read(relativePath) {
  const absolutePath = path.join(repoRoot, relativePath);
  if (!existsSync(absolutePath)) {
    fail(`Missing required file: ${relativePath}`);
    return '';
  }
  return readFileSync(absolutePath, 'utf8');
}

function assertIncludes(source, needle, message) {
  if (!source.includes(needle)) {
    fail(message);
  }
}

function normalizePlugin(plugin) {
  if (typeof plugin === 'string') {
    return plugin;
  }
  if (Array.isArray(plugin)) {
    return normalizePlugin(plugin[0]);
  }
  return '';
}

function normalizePreset(preset) {
  if (typeof preset === 'string') {
    return { name: preset, options: undefined };
  }
  if (Array.isArray(preset)) {
    const [name, options] = preset;
    return { name: normalizePlugin(name), options };
  }
  return { name: '', options: undefined };
}

const requiredFiles = [
  'package.json',
  'package-lock.json',
  'metro.config.js',
  'babel.config.js',
  'tailwind.config.js',
  'global.css',
  'nativewind-env.d.ts',
  'components.json',
  'index.ts',
  'src/ui/lib/utils.ts',
  'src/theme/generated/nativewind-theme.generated.css',
  'src/theme/generated/tailwind-theme.generated.cjs',
  'src/theme/generated/nativewind-vars.generated.ts',
];

for (const filePath of requiredFiles) {
  if (!existsSync(path.join(repoRoot, filePath))) {
    fail(`Missing required file: ${filePath}`);
  }
}

const packageJson = JSON.parse(read('package.json') || '{}');
const packageLock = JSON.parse(read('package-lock.json') || '{}');
const packageDeps = {
  ...(packageJson.dependencies ?? {}),
  ...(packageJson.devDependencies ?? {}),
};
const lockRootDeps = {
  ...(packageLock.packages?.['']?.dependencies ?? {}),
  ...(packageLock.packages?.['']?.devDependencies ?? {}),
};

if (packageJson.scripts?.['verify:nativewind-rnr'] !== 'node scripts/verify/verify-nativewind-rnr-infra.mjs') {
  fail('package.json must define verify:nativewind-rnr with the infra verifier.');
}

const requiredPackages = [
  'nativewind',
  'tailwindcss',
  'tailwindcss-animate',
  '@react-native-reusables/cli',
  '@rn-primitives/slot',
  '@rn-primitives/types',
  'class-variance-authority',
  'clsx',
  'tailwind-merge',
  'lucide-react-native',
];

for (const packageName of requiredPackages) {
  if (!packageDeps[packageName]) {
    fail(`package.json missing NativeWind/RNR dependency: ${packageName}`);
  }
  if (!lockRootDeps[packageName]) {
    fail(`package-lock.json root package missing dependency: ${packageName}`);
  }
}

const tailwindConfig = read('tailwind.config.js');
assertIncludes(
  tailwindConfig,
  "require('./src/theme/generated/tailwind-theme.generated.cjs')",
  'tailwind.config.js must import src/theme/generated/tailwind-theme.generated.cjs.',
);
assertIncludes(
  tailwindConfig,
  "require('nativewind/preset')",
  'tailwind.config.js must use the NativeWind Tailwind preset.',
);
assertIncludes(
  tailwindConfig,
  'theme: generatedTheme.theme',
  'tailwind.config.js must consume generatedTheme.theme instead of duplicating tokens.',
);

try {
  const generatedTheme = require(path.join(repoRoot, 'src/theme/generated/tailwind-theme.generated.cjs'));
  const config = require(path.join(repoRoot, 'tailwind.config.js'));
  if (config.theme !== generatedTheme.theme) {
    fail('tailwind.config.js theme must be the generated token theme object.');
  }
  if (!generatedTheme.cssVariables?.light?.['--app-safe-area']) {
    fail('generated Tailwind theme must expose cssVariables from token generation.');
  }
  if (generatedTheme.theme?.extend?.colors?.primary?.DEFAULT !== 'var(--app-button-primary-background)') {
    fail('generated Tailwind theme must expose shadcn/RNR-compatible primary color aliases.');
  }
  if (generatedTheme.theme?.extend?.colors?.background !== 'var(--app-safe-area)') {
    fail('generated Tailwind theme must expose shadcn/RNR-compatible background color alias.');
  }
} catch (error) {
  fail(`Unable to load Tailwind generated config: ${error.message}`);
}

const metroConfig = read('metro.config.js');
assertIncludes(metroConfig, "require('nativewind/metro')", 'metro.config.js must import nativewind/metro.');
assertIncludes(
  metroConfig,
  "withNativeWind(config, { input: './global.css' })",
  'metro.config.js must wrap the already-mutated Metro config with NativeWind and global.css input.',
);
for (const marker of [
  'call-bind/callBound',
  'expo-image',
  'object.assign/polyfill',
  'object-is/polyfill',
  'react-native-reanimated/scripts/validate-worklets-version',
  'react-native-worklets',
  'context.resolveRequest(context, moduleName, platform)',
  'config.resolver.resolveRequest',
]) {
  assertIncludes(metroConfig, marker, `metro.config.js lost resolver patch marker: ${marker}`);
}

const babelConfig = require(path.join(repoRoot, 'babel.config.js'));
const babelPlugins = (babelConfig.plugins ?? []).map(normalizePlugin);
const babelPresets = (babelConfig.presets ?? []).map(normalizePreset);
const expoPreset = babelPresets.find((preset) => preset.name === 'babel-preset-expo');
if (!expoPreset) {
  fail('babel.config.js must include babel-preset-expo.');
} else if (expoPreset.options?.jsxImportSource !== 'nativewind') {
  fail("babel.config.js must configure babel-preset-expo with jsxImportSource: 'nativewind'.");
}
if (!babelPresets.some((preset) => preset.name === 'nativewind/babel')) {
  fail('babel.config.js must include nativewind/babel as a preset.');
}
if (babelPlugins.includes('nativewind/babel')) {
  fail('babel.config.js must not configure nativewind/babel as a plugin.');
}

const globalCss = read('global.css');
for (const directive of ['@tailwind base;', '@tailwind components;', '@tailwind utilities;']) {
  assertIncludes(globalCss, directive, `global.css missing NativeWind directive: ${directive}`);
}
assertIncludes(
  globalCss,
  "@import './src/theme/generated/nativewind-theme.generated.css';",
  'global.css must import generated NativeWind CSS variables.',
);
assertIncludes(
  globalCss,
  'src/theme/generated/nativewind-vars.generated.ts',
  'global.css must reference generated NativeWind CSS variables.',
);
assertIncludes(
  globalCss,
  'src/theme/generated/tailwind-theme.generated.cjs',
  'global.css must reference generated Tailwind token output.',
);

const nativewindEnv = read('nativewind-env.d.ts');
assertIncludes(
  nativewindEnv,
  '/// <reference types="nativewind/types" />',
  'nativewind-env.d.ts must include NativeWind types.',
);

const componentsJson = JSON.parse(read('components.json') || '{}');
if (componentsJson.tailwind?.config !== 'tailwind.config.js' || componentsJson.tailwind?.css !== 'global.css') {
  fail('components.json must point RNR tooling at tailwind.config.js and global.css.');
}
if (componentsJson.aliases?.ui !== '@/src/ui/primitives') {
  fail('components.json must route RNR primitives to src/ui/primitives.');
}

const indexSource = read('index.ts');
const shimImports = [
  "import './shims/formdata-shim';",
  "import './shims/immediate-shim';",
  "import './shims/websocket-shim';",
  "import './shims/window-shim';",
  "import './shims/performance-shim';",
  "import './src/features/reminders/reminder-background-task';",
];
const globalCssIndex = indexSource.indexOf("import './global.css';");
if (globalCssIndex === -1) {
  fail("index.ts must import './global.css'.");
} else {
  for (const shimImport of shimImports) {
    const shimIndex = indexSource.indexOf(shimImport);
    if (shimIndex === -1) {
      fail(`index.ts missing existing ordered import: ${shimImport}`);
    } else if (shimIndex > globalCssIndex) {
      fail(`index.ts imports global.css before shim/background import: ${shimImport}`);
    }
  }
  for (const appWireImport of ["import { registerRootComponent } from 'expo';", "import App from './App';"]) {
    const appWireIndex = indexSource.indexOf(appWireImport);
    if (appWireIndex === -1) {
      fail(`index.ts missing app wiring import: ${appWireImport}`);
    } else if (globalCssIndex > appWireIndex) {
      fail(`index.ts imports global.css after app wiring import: ${appWireImport}`);
    }
  }
}

if (failures.length > 0) {
  console.error('NativeWind/RNR infra verification failed:');
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log('NativeWind/RNR infra verification passed.');
