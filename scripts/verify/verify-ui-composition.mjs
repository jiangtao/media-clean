#!/usr/bin/env node

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire(import.meta.url);
const root = process.cwd();
const failures = [];

function fail(message) {
  failures.push(message);
}

function read(relativePath) {
  const absolutePath = path.join(root, relativePath);
  if (!existsSync(absolutePath)) {
    fail(`Missing required file: ${relativePath}`);
    return '';
  }

  return readFileSync(absolutePath, 'utf8');
}

function listFiles(directory, predicate, files = []) {
  const absoluteDirectory = path.join(root, directory);
  if (!existsSync(absoluteDirectory)) {
    return files;
  }

  for (const entry of readdirSync(absoluteDirectory, { withFileTypes: true })) {
    const relativePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      listFiles(relativePath, predicate, files);
      continue;
    }

    if (predicate(relativePath)) {
      files.push(relativePath);
    }
  }

  return files;
}

function assertIncludes(source, marker, message) {
  if (!source.includes(marker)) {
    fail(message);
  }
}

function assertExcludes(source, marker, message) {
  if (source.includes(marker)) {
    fail(message);
  }
}

function assertNoRenderedUi(filePath, source, reason) {
  const uiMarkers = [
    { pattern: /return\s*\(\s*</s, label: 'JSX return' },
    { pattern: /=>\s*\(\s*</s, label: 'JSX arrow return' },
    { pattern: /testID=/, label: 'rendered testID' },
    { pattern: /StyleSheet\.create\s*\(/, label: 'StyleSheet UI styles' },
  ];

  for (const marker of uiMarkers) {
    if (marker.pattern.test(source)) {
      fail(`${filePath} is categorized as ${reason} but includes ${marker.label}.`);
    }
  }
}

const requiredPrimitiveFiles = [
  'src/ui/lib/utils.ts',
  'src/ui/primitives/Badge.tsx',
  'src/ui/primitives/Button.tsx',
  'src/ui/primitives/Card.tsx',
  'src/ui/primitives/FoldableLayout.tsx',
  'src/ui/primitives/IconButton.tsx',
  'src/ui/primitives/MediaFrame.tsx',
  'src/ui/primitives/Progress.tsx',
  'src/ui/primitives/Separator.tsx',
  'src/ui/primitives/Skeleton.tsx',
  'src/ui/primitives/Switch.tsx',
  'src/ui/primitives/Text.tsx',
  'src/ui/primitives/TouchSurface.tsx',
];

for (const filePath of requiredPrimitiveFiles) {
  if (!existsSync(path.join(root, filePath))) {
    fail(`Missing RNR-style primitive source: ${filePath}`);
  }
}

const primitiveIndex = read('src/ui/primitives/index.ts');
for (const exportName of [
  'Badge',
  'Button',
  'Card',
  'FoldableLayout',
  'IconButton',
  'MediaFrame',
  'Progress',
  'Separator',
  'Skeleton',
  'Switch',
  'Text',
  'TouchSurface',
]) {
  if (!new RegExp(`\\b${exportName}\\b`).test(primitiveIndex)) {
    fail(`src/ui/primitives/index.ts must export ${exportName}.`);
  }
}

const productionUiFiles = listFiles('src/ui', (relativePath) =>
  /\.(ts|tsx)$/.test(relativePath) &&
  !relativePath.includes('/__tests__/') &&
  !relativePath.includes('.test.') &&
  !relativePath.includes('/primitives/') &&
  !relativePath.includes('/icons/'),
);

const primitiveImportPattern = /from ['"][^'"]*\/primitives(?:\/[^'"]+)?['"]/;
const primitiveConsumers = productionUiFiles.filter((filePath) =>
  primitiveImportPattern.test(read(filePath)),
);
const categorizedNonConsumerFiles = new Map([
  ['src/ui/components/image-source.ts', { kind: 'helper', reason: 'image source sizing' }],
  ['src/ui/components/media-viewer-tokens.ts', { kind: 'helper', reason: 'media viewer token facade' }],
  ['src/ui/hooks/swipeSelectionModel.ts', { kind: 'helper', reason: 'selection model' }],
  ['src/ui/hooks/useSwipeSelection.ts', { kind: 'hook', reason: 'gesture selection state' }],
  ['src/ui/lib/utils.ts', { kind: 'helper', reason: 'class name merging' }],
  [
    'src/ui/screens/photo-grid/PhotoGridDetailFlow.tsx',
    { kind: 'thin-wrapper', reason: 'delegates to DetailScreen' },
  ],
  [
    'src/ui/screens/photo-grid/selection-mode-labels.ts',
    { kind: 'helper', reason: 'i18n labels' },
  ],
  [
    'src/ui/screens/photo-grid/usePhotoGridSessionController.ts',
    { kind: 'controller', reason: 'business state' },
  ],
  ['src/ui/screens/screen-layout.ts', { kind: 'helper', reason: 'layout calculation' }],
  ['src/ui/skeletons/index.ts', { kind: 'barrel', reason: 'skeleton exports' }],
]);
const categorizedNonConsumerSet = new Set(categorizedNonConsumerFiles.keys());
const actualNonConsumers = productionUiFiles.filter((filePath) => !primitiveConsumers.includes(filePath));
const uncategorizedNonConsumers = actualNonConsumers.filter(
  (filePath) => !categorizedNonConsumerSet.has(filePath),
);
const staleNonConsumerCategories = [...categorizedNonConsumerSet].filter(
  (filePath) => !actualNonConsumers.includes(filePath),
);
const visualPrimitiveFiles = productionUiFiles.filter(
  (filePath) => !categorizedNonConsumerSet.has(filePath),
);
const visualPrimitiveConsumers = visualPrimitiveFiles.filter((filePath) =>
  primitiveConsumers.includes(filePath),
);

for (const filePath of uncategorizedNonConsumers) {
  fail(
    `${filePath} is a production UI file without src/ui/primitives usage and without an explicit non-consumer category.`,
  );
}

for (const filePath of staleNonConsumerCategories) {
  fail(`${filePath} is categorized as a non-consumer but now consumes primitives or no longer exists.`);
}

for (const [filePath, category] of categorizedNonConsumerFiles) {
  const source = read(filePath);
  const reason = `${category.kind}: ${category.reason}`;

  if (category.kind === 'helper' || category.kind === 'hook' || category.kind === 'controller') {
    assertNoRenderedUi(filePath, source, reason);
  }

  if (category.kind === 'thin-wrapper') {
    assertIncludes(
      source,
      "import { DetailScreen } from '../DetailScreen';",
      `${filePath} thin-wrapper category must keep an explicit DetailScreen delegation import.`,
    );
    assertIncludes(
      source,
      '<DetailScreen',
      `${filePath} thin-wrapper category must render DetailScreen directly.`,
    );
    assertExcludes(
      source,
      "from 'react-native'",
      `${filePath} thin-wrapper category must not add raw React Native UI surfaces.`,
    );
  }

  if (category.kind === 'barrel') {
    const nonExportLines = source
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .filter((line) => !line.startsWith('export '));

    if (nonExportLines.length > 0) {
      fail(`${filePath} barrel category must contain only export statements.`);
    }
  }
}

if (visualPrimitiveConsumers.length !== visualPrimitiveFiles.length) {
  fail(
    `Visual primitive coverage is incomplete: ${visualPrimitiveConsumers.length}/${visualPrimitiveFiles.length}.`,
  );
}

const requiredConsumers = [
  'src/ui/CandidateCard.tsx',
  'src/ui/PreviewModal.tsx',
  'src/ui/components/ActionSwitch.tsx',
  'src/ui/components/ActivityLoadingFallback.tsx',
  'src/ui/components/DuplicateCarousel.tsx',
  'src/ui/components/PhotoGrid.tsx',
  'src/ui/components/ScanCounter.tsx',
  'src/ui/components/ScanProgress.tsx',
  'src/ui/components/SegmentedControl.tsx',
  'src/ui/components/SelectionBar.tsx',
  'src/ui/components/TabBar.tsx',
  'src/ui/components/VideoPlayer.tsx',
  'src/ui/components/ZoomableImage.tsx',
  'src/ui/screens/DetailScreen.tsx',
  'src/ui/screens/LandingScreen.tsx',
  'src/ui/screens/PhotoGridScreen.tsx',
  'src/ui/screens/photo-grid/PhotoGridEntryCard.tsx',
  'src/ui/screens/photo-grid/PhotoGridWorkspace.tsx',
  'src/ui/screens/RecycleBinScreen.tsx',
  'src/ui/screens/SettingsScreen.tsx',
  'src/ui/skeletons/AppBootstrapSkeleton.tsx',
  'src/ui/skeletons/DetailSkeleton.tsx',
  'src/ui/skeletons/LandingSkeleton.tsx',
  'src/ui/skeletons/PhotoGridSkeleton.tsx',
  'src/ui/skeletons/RecycleBinSkeleton.tsx',
  'src/ui/skeletons/SettingsSkeleton.tsx',
  'src/ui/skeletons/SkeletonBlock.tsx',
];

for (const filePath of requiredConsumers) {
  if (!primitiveConsumers.includes(filePath)) {
    fail(`${filePath} must consume src/ui/primitives instead of only raw React Native primitives.`);
  }
}

if (primitiveConsumers.length < requiredConsumers.length) {
  fail(
    `Primitive consumer coverage is too low: ${primitiveConsumers.length}/${productionUiFiles.length}; expected at least ${requiredConsumers.length}.`,
  );
}

const appErrorBoundary = read('src/application/AppErrorBoundary.tsx');
assertIncludes(
  appErrorBoundary,
  "from '../ui/primitives'",
  'src/application/AppErrorBoundary.tsx must consume shared primitives for the fallback surface.',
);
assertIncludes(
  appErrorBoundary,
  '<Card',
  'src/application/AppErrorBoundary.tsx must render the fallback surface through Card.',
);
assertIncludes(
  appErrorBoundary,
  '<Button',
  'src/application/AppErrorBoundary.tsx must render the retry action through Button.',
);
assertExcludes(
  appErrorBoundary,
  'Pressable',
  'src/application/AppErrorBoundary.tsx must not use raw Pressable for the retry action.',
);

const mediaCleanerApp = read('src/application/MediaCleanerApp.tsx');
assertIncludes(
  mediaCleanerApp,
  'useManagedAppPreferencesState()',
  'src/application/MediaCleanerApp.tsx must reuse the shared app preference owner instead of duplicating theme/language state.',
);
for (const marker of [
  'useColorScheme',
  'loadAppLanguage',
  'saveAppLanguage',
  'loadThemePreference',
  'saveThemePreference',
]) {
  assertExcludes(
    mediaCleanerApp,
    marker,
    `src/application/MediaCleanerApp.tsx must not reintroduce duplicated preference ownership marker: ${marker}.`,
  );
}

const noHardcodedChineseCopyFiles = [
  'src/ui/CandidateCard.tsx',
  'src/ui/PreviewModal.tsx',
  'src/ui/components/SelectionBar.tsx',
  'src/ui/components/ScanCounter.tsx',
  'src/ui/components/ScanProgress.tsx',
  'src/ui/screens/PhotoGridScreen.tsx',
  'src/ui/screens/photo-grid/PhotoGridEntryCard.tsx',
  'src/ui/screens/photo-grid/PhotoGridWorkspace.tsx',
  'src/ui/screens/RecycleBinScreen.tsx',
];

for (const filePath of noHardcodedChineseCopyFiles) {
  const source = read(filePath);
  if (/[\u4e00-\u9fff]/.test(source)) {
    fail(`${filePath} must not hard-code Chinese UI copy; use src/i18n/locales/**/*.json.`);
  }
}

const i18nFacadeMarkers = new Map([
  ['src/ui/CandidateCard.tsx', 'getAppCopy'],
  ['src/ui/PreviewModal.tsx', 'getAppCopy'],
  ['src/ui/components/SelectionBar.tsx', 'getAppCopy'],
  ['src/ui/components/ScanCounter.tsx', 'getAppCopy'],
  ['src/ui/components/ScanProgress.tsx', 'getAppCopy'],
  ['src/ui/screens/PhotoGridScreen.tsx', 'copy.screens.photoGrid'],
  ['src/ui/screens/photo-grid/PhotoGridEntryCard.tsx', 'getAppCopy'],
  ['src/ui/screens/photo-grid/PhotoGridWorkspace.tsx', 'getAppCopy'],
  ['src/ui/screens/RecycleBinScreen.tsx', 'copy.screens.recycleBin'],
]);

for (const [filePath, marker] of i18nFacadeMarkers) {
  const source = read(filePath);
  if (!source.includes(marker)) {
    fail(`${filePath} must read UI copy through the i18n facade marker: ${marker}.`);
  }
}

const resources = require(path.join(root, 'src/theme/generated/tailwind-theme.generated.cjs'));
if (resources.theme?.extend?.colors?.primary?.DEFAULT !== 'var(--app-button-primary-background)') {
  fail('Tailwind generated theme must expose RNR/shadcn primary aliases.');
}
if (resources.theme?.extend?.colors?.background !== 'var(--app-safe-area)') {
  fail('Tailwind generated theme must expose RNR/shadcn background alias.');
}

const i18nNamespaces = read('src/i18n/resources.generated.ts');
assertIncludes(i18nNamespaces, '"components"', 'Generated i18n resources must include components namespace.');

const photoGridScreen = read('src/ui/screens/PhotoGridScreen.tsx');
assertIncludes(
  photoGridScreen,
  "const showLoadingPrompt = permissionState === 'loading';",
  'PhotoGridScreen must keep skeleton fallback tied to permission loading.',
);
assertIncludes(
  photoGridScreen,
  '{showLoadingPrompt ? <PhotoGridSkeleton variant="permissionChecking" /> : null}',
  'PhotoGridScreen must render the permission-checking skeleton only for showLoadingPrompt.',
);
assertExcludes(
  photoGridScreen,
  'showGrantedHydrationSkeleton',
  'PhotoGridScreen must not add a second granted-media skeleton that flashes before the ready state.',
);
assertExcludes(
  photoGridScreen,
  '<PhotoGridSkeleton variant="scanReady"',
  'PhotoGridScreen must keep granted-media hydration on the stable scan-ready business surface.',
);
for (const state of ['scanning', 'scanResult', 'scanEmpty', 'scanAllComplete']) {
  assertIncludes(
    photoGridScreen,
    `'${state}'`,
    `PhotoGridScreen must keep explicit business state variant: ${state}.`,
  );
}
if (/isScanning\s*\?\s*<PhotoGridSkeleton/.test(photoGridScreen)) {
  fail('PhotoGridScreen must not fallback scanning state to PhotoGridSkeleton.');
}
if (/recognizing/.test(photoGridScreen)) {
  fail('PhotoGridScreen must not insert a post-scan recognizing transition before results.');
}

const photoGridEntryCard = read('src/ui/screens/photo-grid/PhotoGridEntryCard.tsx');
assertIncludes(
  photoGridEntryCard,
  'function StageFrame',
  'PhotoGridEntryCard must keep entry-card state changes as a stable frame.',
);
assertIncludes(
  photoGridEntryCard,
  'COMPONENT_TOKENS.photoGrid.entryCard',
  'PhotoGridEntryCard progress/result visual contract must come from generated photoGrid entry-card tokens.',
);
assertExcludes(
  photoGridEntryCard,
  'Animated.View',
  'PhotoGridEntryCard must not animate cards out/in between album states.',
);
for (const marker of [
  "'#23b58f'",
  "'#1e3769'",
  "'#d8e6ff'",
  "'#ff9f2e'",
  "'#ff5b4d'",
  "'#6b4dff'",
  "'#fff3e1'",
  "'#fff0f2'",
  "'#f1eaff'",
  "'#dce8ff'",
  "'#e7d9ff'",
]) {
  assertExcludes(
    photoGridEntryCard,
    marker,
    `PhotoGridEntryCard must not reintroduce hard-coded entry-card color marker: ${marker}.`,
  );
}

const detailScreenTokens = read('src/ui/screens/DetailScreen.tsx');
assertIncludes(
  detailScreenTokens,
  'COMPONENT_TOKENS.detail',
  'DetailScreen overlay colors must come from component detail tokens.',
);
for (const marker of [
  "'#000000'",
  "'#ff3b30'",
  "'#ffb800'",
  "'#6b7280'",
  'rgba(255, 255, 255, 0.14)',
  'rgba(255, 255, 255, 0.22)',
]) {
  assertExcludes(
    detailScreenTokens,
    marker,
    `DetailScreen must not reintroduce hard-coded detail color marker: ${marker}.`,
  );
}

const detailSkeleton = read('src/ui/skeletons/DetailSkeleton.tsx');
assertIncludes(
  detailSkeleton,
  'COMPONENT_TOKENS.detail',
  'DetailSkeleton background must come from component detail tokens.',
);
assertExcludes(
  detailSkeleton,
  "'#000000'",
  'DetailSkeleton must not reintroduce a hard-coded detail background.',
);

const settingsScreen = read('src/ui/screens/SettingsScreen.tsx');
assertIncludes(
  settingsScreen,
  'COMPONENT_TOKENS.settings',
  'SettingsScreen surface colors and chip states must come from component settings tokens.',
);
for (const marker of [
  "'#f7f9fd'",
  "'#edf2fa'",
  "'#1a2a4f'",
  "'#e9efff'",
  "'#174b3f'",
  "'#dcf7ec'",
  "'#34274d'",
  "'#efe6ff'",
  "'#4a242c'",
  "'#ffe8eb'",
]) {
  assertExcludes(
    settingsScreen,
    marker,
    `SettingsScreen must not reintroduce hard-coded settings color marker: ${marker}.`,
  );
}

const settingsSkeleton = read('src/ui/skeletons/SettingsSkeleton.tsx');
assertIncludes(
  settingsSkeleton,
  'COMPONENT_TOKENS.settings',
  'SettingsSkeleton background and shadow contract must come from component settings tokens.',
);
for (const marker of ["'#f7f9fd'", '0.045']) {
  assertExcludes(
    settingsSkeleton,
    marker,
    `SettingsSkeleton must not reintroduce hard-coded settings marker: ${marker}.`,
  );
}

const landingScreen = read('src/ui/screens/LandingScreen.tsx');
assertIncludes(
  landingScreen,
  'COMPONENT_TOKENS.landing',
  'LandingScreen decorative colors must come from component landing tokens.',
);
for (const marker of [
  "'#18bf63'",
  'rgba(64, 92, 175, 0.12)',
  'rgba(136, 158, 255, 0.12)',
  'rgba(89, 104, 192, 0.16)',
  'rgba(185, 196, 255, 0.18)',
  'rgba(105, 138, 255, 0.2)',
  'rgba(114, 142, 255, 0.18)',
  'rgba(105, 138, 255, 0.14)',
  'rgba(114, 142, 255, 0.12)',
  'rgba(53, 83, 171, 0.14)',
  'rgba(100, 132, 255, 0.12)',
  'rgba(139, 165, 255, 0.5)',
  'rgba(128, 153, 255, 0.42)',
]) {
  assertExcludes(
    landingScreen,
    marker,
    `LandingScreen must not reintroduce hard-coded decorative color marker: ${marker}.`,
  );
}

const landingSkeleton = read('src/ui/skeletons/LandingSkeleton.tsx');
assertIncludes(
  landingSkeleton,
  'COMPONENT_TOKENS.landing',
  'LandingSkeleton decorative colors must come from component landing tokens.',
);
for (const marker of [
  'rgba(64, 92, 175, 0.12)',
  'rgba(136, 158, 255, 0.12)',
  'rgba(89, 104, 192, 0.16)',
  'rgba(185, 196, 255, 0.18)',
]) {
  assertExcludes(
    landingSkeleton,
    marker,
    `LandingSkeleton must not reintroduce hard-coded decorative color marker: ${marker}.`,
  );
}

const videoPlayer = read('src/ui/components/VideoPlayer.tsx');
assertIncludes(
  videoPlayer,
  '<MediaFrame theme={theme} style={styles.container} testID="video-player-media-frame">',
  'VideoPlayer must use the MediaFrame primitive as its media frame container.',
);
assertIncludes(
  videoPlayer,
  'MEDIA_VIEWER_STYLE_TOKENS',
  'VideoPlayer sizing contract must come from shared file-backed media viewer tokens.',
);
for (const marker of ['16 / 9', 'Math.max(aspectRatio, 0.5)']) {
  assertExcludes(
    videoPlayer,
    marker,
    `VideoPlayer must not reintroduce local hard-coded media sizing marker: ${marker}`,
  );
}

const mediaViewerTokens = read('src/ui/components/media-viewer-tokens.ts');
assertIncludes(
  mediaViewerTokens,
  'COMPONENT_TOKENS.mediaViewer',
  'Media viewer component tokens must be a shared generated token facade.',
);

const designIcon = read('src/ui/icons/DesignIcon.tsx');
for (const marker of ['#2563EB', '#FFFFFF', '#EFF6FF']) {
  assertExcludes(
    designIcon,
    marker,
    `DesignIcon must not reintroduce hard-coded icon default marker: ${marker}.`,
  );
}

const mediaFrame = read('src/ui/primitives/MediaFrame.tsx');
assertIncludes(
  mediaFrame,
  'PRIMITIVE_TOKENS.radius.media',
  'MediaFrame media radius must come from file-backed primitive tokens.',
);

const zoomableImage = read('src/ui/components/ZoomableImage.tsx');
assertIncludes(
  zoomableImage,
  'MEDIA_VIEWER_STYLE_TOKENS',
  'ZoomableImage gesture limits must come from shared file-backed media viewer tokens.',
);
assertIncludes(
  zoomableImage,
  'Animated.createAnimatedComponent(MediaFrame)',
  'ZoomableImage must adapt the MediaFrame primitive for its animated gesture root.',
);
assertIncludes(
  zoomableImage,
  'variant="transparent"',
  'ZoomableImage must preserve its transparent full-stage media behavior while consuming MediaFrame.',
);
for (const marker of ['maxScale = 3', 'minScale = 1', '* 0.5', '* 1.1', 'duration: 150']) {
  assertExcludes(
    zoomableImage,
    marker,
    `ZoomableImage must not reintroduce local hard-coded gesture marker: ${marker}`,
  );
}

const iconButton = read('src/ui/primitives/IconButton.tsx');
assertIncludes(
  iconButton,
  'PRIMITIVE_TOKENS.spacing.iconButtonSize',
  'IconButton default size must come from file-backed primitive tokens.',
);
assertIncludes(
  iconButton,
  'PRIMITIVE_TOKENS.radius.iconButton',
  'IconButton radius must come from file-backed primitive tokens.',
);
for (const marker of [
  'PRIMITIVE_TOKENS.color.iconButtonOverlayBackground',
  'PRIMITIVE_TOKENS.color.iconButtonOverlayPressedBackground',
]) {
  assertIncludes(
    iconButton,
    marker,
    `IconButton overlay variant must consume primitive color token: ${marker}.`,
  );
}
for (const marker of ['rgba(255, 255, 255, 0.14)', 'rgba(255, 255, 255, 0.22)']) {
  assertExcludes(
    iconButton,
    marker,
    `IconButton must not reintroduce hard-coded overlay marker: ${marker}.`,
  );
}

const badgePrimitive = read('src/ui/primitives/Badge.tsx');
for (const marker of [
  'PRIMITIVE_TOKENS.spacing.badgeMinHeight',
  'PRIMITIVE_TOKENS.spacing.badgePaddingHorizontal',
  'PRIMITIVE_TOKENS.spacing.badgePaddingVertical',
  'PRIMITIVE_TOKENS.spacing.badgeBorderWidth',
]) {
  assertIncludes(
    badgePrimitive,
    marker,
    `Badge primitive sizing must come from file-backed primitive token: ${marker}.`,
  );
}
for (const marker of ['minHeight: 24', 'paddingHorizontal: 8', 'paddingVertical: 3']) {
  assertExcludes(
    badgePrimitive,
    marker,
    `Badge primitive must not reintroduce local hard-coded style marker: ${marker}`,
  );
}

const progressPrimitive = read('src/ui/primitives/Progress.tsx');
assertIncludes(
  progressPrimitive,
  'PRIMITIVE_TOKENS.spacing.progressHeight',
  'Progress primitive height must come from file-backed primitive tokens.',
);
assertIncludes(
  progressPrimitive,
  'PRIMITIVE_TOKENS.spacing.progressBorderWidth',
  'Progress primitive border width must come from file-backed primitive tokens.',
);
for (const marker of ['height: 10', 'borderWidth: 1']) {
  assertExcludes(
    progressPrimitive,
    marker,
    `Progress primitive must not reintroduce local hard-coded style marker: ${marker}`,
  );
}

const touchSurfacePrimitive = read('src/ui/primitives/TouchSurface.tsx');
assertIncludes(
  touchSurfacePrimitive,
  'PRIMITIVE_TOKENS.interaction.pressRetentionOffset',
  'TouchSurface press retention offset must come from file-backed primitive interaction tokens.',
);
assertIncludes(
  touchSurfacePrimitive,
  'PRIMITIVE_TOKENS.interaction.touchSurfacePressed',
  'TouchSurface pressed feedback must come from file-backed primitive interaction tokens.',
);
for (const marker of [
  'scale: 0.92',
  'scale: 0.986',
  'scale: 0.972',
  'scale: 0.976',
  'opacity: 0.88',
  'opacity: 0.96',
  'opacity: 0.94',
  'opacity: 0.95',
]) {
  assertExcludes(
    touchSurfacePrimitive,
    marker,
    `TouchSurface primitive must not reintroduce local hard-coded interaction marker: ${marker}`,
  );
}

const skeletonPrimitive = read('src/ui/primitives/Skeleton.tsx');
assertIncludes(
  skeletonPrimitive,
  'borderWidth: 0',
  'Skeleton primitive blocks must be borderless.',
);
assertExcludes(
  skeletonPrimitive,
  'borderWidth: 1',
  'Skeleton primitive must not reintroduce borders around skeleton blocks.',
);
assertIncludes(
  skeletonPrimitive,
  'translateX: shimmerTranslateX',
  'Skeleton primitive must keep a directional shimmer instead of a static block.',
);

const skeletonFiles = listFiles(
  'src/ui/skeletons',
  (filePath) => filePath.endsWith('.tsx') && !filePath.includes('__tests__'),
);
for (const filePath of skeletonFiles) {
  const source = read(filePath);
  for (const match of source.matchAll(/borderWidth:\s*([^,\n}]+)/g)) {
    const value = match[1].trim();
    if (value !== '0') {
      fail(`${filePath} must keep skeleton UI borderless; found borderWidth: ${value}.`);
    }
  }

  if (source.includes('<Card') && !source.includes('borderWidth: 0')) {
    fail(`${filePath} uses Card and must explicitly override Card's default borderWidth to 0.`);
  }
}

const photoGridWorkspace = read('src/ui/screens/photo-grid/PhotoGridWorkspace.tsx');
assertIncludes(
  photoGridWorkspace,
  '<IconButton',
  'PhotoGridWorkspace header buttons must use the IconButton primitive.',
);
assertExcludes(
  photoGridWorkspace,
  'Pressable',
  'PhotoGridWorkspace must not hand-roll header Pressable icon buttons.',
);

const detailScreen = read('src/ui/screens/DetailScreen.tsx');
assertIncludes(
  detailScreen,
  'variant="overlay"',
  'DetailScreen close action must use the overlay IconButton primitive variant.',
);

const recycleBinScreen = read('src/ui/screens/RecycleBinScreen.tsx');
assertIncludes(
  recycleBinScreen,
  'COMPONENT_TOKENS.recycleBin',
  'RecycleBinScreen summary shadow colors must come from component recycleBin tokens.',
);
for (const marker of [
  'rgba(248, 250, 252, 0.16)',
  'rgba(255, 255, 255, 0.92)',
]) {
  assertExcludes(
    recycleBinScreen,
    marker,
    `RecycleBinScreen must not reintroduce hard-coded summary shadow marker: ${marker}.`,
  );
}
assertIncludes(
  recycleBinScreen,
  '<IconButton',
  'RecycleBinScreen back/close action must use the IconButton primitive.',
);
assertIncludes(
  recycleBinScreen,
  '<Button\n              style={[styles.selectionActionButton, styles.selectionRestoreButton]}',
  'RecycleBinScreen restore action must use the Button primitive.',
);
assertExcludes(
  recycleBinScreen,
  'TouchSurface',
  'RecycleBinScreen must use Button/IconButton primitives instead of composing TouchSurface directly.',
);

const activityLoadingFallback = read('src/ui/components/ActivityLoadingFallback.tsx');
assertIncludes(
  activityLoadingFallback,
  'COMPONENT_TOKENS.activityLoadingFallback',
  'ActivityLoadingFallback skeleton fallback contract must come from generated file-backed component tokens.',
);
for (const marker of [
  "surface === 'detail' ? 44 : 40",
  "surface === 'detail' ? 96 : 120",
  "surface === 'detail' ? '#ffffff'",
  "surface === 'detail' ? '#000000'",
]) {
  assertExcludes(
    activityLoadingFallback,
    marker,
    `ActivityLoadingFallback must not reintroduce local hard-coded style marker: ${marker}`,
  );
}

const candidateCard = read('src/ui/CandidateCard.tsx');
assertIncludes(
  candidateCard,
  'COMPONENT_TOKENS.candidateCard',
  'CandidateCard visual contract must come from generated file-backed component tokens.',
);
for (const marker of [
  'buildSizedImageSource(candidate.asset.previewUri ?? candidate.asset.uri, 92, 92)',
  'candidate.reasons.slice(0, 3)',
  'borderRadius: 28',
  'width: 92',
  "fontWeight: '700'",
  "fontWeight: '600'",
]) {
  assertExcludes(
    candidateCard,
    marker,
    `CandidateCard must not reintroduce local hard-coded style marker: ${marker}`,
  );
}

const previewModal = read('src/ui/PreviewModal.tsx');
assertIncludes(
  previewModal,
  'COMPONENT_TOKENS.previewModal',
  'PreviewModal visual contract must come from generated file-backed component tokens.',
);
assertIncludes(
  previewModal,
  '<MediaFrame',
  'PreviewModal media preview must use the MediaFrame primitive.',
);
for (const marker of [
  "Dimensions.get('window').width - 40",
  'aspectRatio: 0.9',
  'borderRadius: 28',
  'borderRadius: 26',
  'padding: 20',
  "fontWeight: '800'",
  "fontWeight: '700'",
]) {
  assertExcludes(
    previewModal,
    marker,
    `PreviewModal must not reintroduce local hard-coded style marker: ${marker}`,
  );
}

const duplicateCarousel = read('src/ui/components/DuplicateCarousel.tsx');
assertIncludes(
  duplicateCarousel,
  'COMPONENT_TOKENS.duplicateCarousel',
  'DuplicateCarousel visual and windowing contract must come from generated file-backed component tokens.',
);
assertIncludes(
  duplicateCarousel,
  '<IconButton',
  'DuplicateCarousel navigation controls must use the IconButton primitive.',
);
for (const marker of [
  "import { TouchSurface } from '../primitives';",
  'width - 32',
  '* 1.45',
  'const WINDOWED_VIEW_REUSE_SLOT_COUNT = 3',
  'marginTop: -23',
  'width: 46',
  'height: 46',
  'borderRadius: 23',
  'left: 12',
  'right: 12',
  'size={18}',
  "backgroundColor: 'rgba(14, 30, 38, 0.76)'",
  "backgroundColor: 'rgba(14, 30, 38, 0.92)'",
]) {
  assertExcludes(
    duplicateCarousel,
    marker,
    `DuplicateCarousel must not reintroduce local hard-coded carousel marker: ${marker}`,
  );
}

const photoGrid = read('src/ui/components/PhotoGrid.tsx');
assertIncludes(
  photoGrid,
  'COMPONENT_TOKENS.photoGrid',
  'PhotoGrid tile visual contract must come from generated file-backed component tokens.',
);
for (const marker of [
  'const SIZE_SMALL = 12;',
  'const selectionIndicatorSize = isCompact ? 18 : 24;',
  'const selectionIndicatorOffset = isCompact ? 7 : 10;',
  'const selectionIndicatorBorderWidth = isCompact ? 1.5 : 2;',
  'const itemRadius = isCompact ? 16 : 18;',
  'const videoBadgeHeight = isCompact ? 23 : 25;',
  'gridContentTopOffset = (contentPadding?.top ?? 0) + 6',
  "backgroundColor: 'rgba(15, 23, 42, 0.74)'",
  "backgroundColor: '#df676d'",
  "backgroundColor: '#2f80ff'",
  "color: '#ffffff'",
  "borderColor: isCompact ? 'rgba(255, 255, 255, 0.98)'",
]) {
  assertExcludes(
    photoGrid,
    marker,
    `PhotoGrid must not reintroduce local hard-coded tile marker: ${marker}`,
  );
}

const actionSwitch = read('src/ui/components/ActionSwitch.tsx');
assertIncludes(
  actionSwitch,
  'COMPONENT_TOKENS.actionSwitch',
  'ActionSwitch style contract must come from generated file-backed component tokens.',
);
assertExcludes(
  actionSwitch,
  'export const ACTION_SWITCH_STYLE_TOKENS = {',
  'ActionSwitch must not reintroduce local hard-coded style tokens.',
);

const segmentedControl = read('src/ui/components/SegmentedControl.tsx');
assertIncludes(
  segmentedControl,
  'COMPONENT_TOKENS.segmentedControl',
  'SegmentedControl style contract must come from generated file-backed component tokens.',
);
assertExcludes(
  segmentedControl,
  'const SIZE_LARGE',
  'SegmentedControl must not reintroduce local hard-coded size constants.',
);
assertExcludes(
  segmentedControl,
  "color: 'rgba(255,255,255,0.88)'",
  'SegmentedControl selected count text color must come from component tokens.',
);

const scanCounter = read('src/ui/components/ScanCounter.tsx');
assertIncludes(
  scanCounter,
  'COMPONENT_TOKENS.scanCounter',
  'ScanCounter style contract must come from generated file-backed component tokens.',
);
assertExcludes(
  scanCounter,
  'export const SCAN_COUNTER_STYLE_TOKENS = {',
  'ScanCounter must not reintroduce local hard-coded style tokens.',
);

const selectionBar = read('src/ui/components/SelectionBar.tsx');
assertIncludes(
  selectionBar,
  'COMPONENT_TOKENS.selectionBar',
  'SelectionBar style contract must come from generated file-backed component tokens.',
);
for (const marker of [
  'export const SELECTION_BAR_STYLE_TOKENS = {',
  'disabledOpacity: 0.5',
  'borderWidth: 1',
]) {
  assertExcludes(
    selectionBar,
    marker,
    `SelectionBar must not reintroduce local hard-coded style marker: ${marker}`,
  );
}

const tabBar = read('src/ui/components/TabBar.tsx');
assertIncludes(
  tabBar,
  'COMPONENT_TOKENS.tabBar',
  'TabBar style contract must come from generated file-backed component tokens.',
);
assertIncludes(
  tabBar,
  'minHeight: TAB_BAR_STYLE_TOKENS.badge.minHeight',
  'TabBar badge must use a tokenized minimum height instead of a fixed badge height.',
);
assertIncludes(
  tabBar,
  'paddingHorizontal: TAB_BAR_STYLE_TOKENS.badge.paddingHorizontal',
  'TabBar badge must use tokenized horizontal padding so multi-digit counts remain visible.',
);
for (const marker of [
  'width={24}',
  'height: 56',
  'height: TAB_BAR_STYLE_TOKENS.badge.height',
  "fontWeight: '800'",
  'tab.badge > 99',
]) {
  assertExcludes(
    tabBar,
    marker,
    `TabBar must not reintroduce local hard-coded style marker: ${marker}`,
  );
}

const scanProgress = read('src/ui/components/ScanProgress.tsx');
assertIncludes(
  scanProgress,
  'COMPONENT_TOKENS.scanProgress',
  'ScanProgress visual and motion contract must come from generated file-backed component tokens.',
);
for (const marker of [
  "theme.scheme === 'dark' ? '#82cfc1'",
  'const PIPELINE_SEGMENT_WIDTH = 40;',
  "fontWeight: '700'",
]) {
  assertExcludes(
    scanProgress,
    marker,
    `ScanProgress must not reintroduce local hard-coded style marker: ${marker}`,
  );
}

if (failures.length > 0) {
  console.error('UI composition verification failed:');
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log(`UI composition verified: ${primitiveConsumers.length}/${productionUiFiles.length} production UI files consume primitives.`);
console.log(`Visual primitive coverage: ${visualPrimitiveConsumers.length}/${visualPrimitiveFiles.length}.`);
console.log(`Categorized non-consumers: ${categorizedNonConsumerFiles.size}.`);
console.log('RNR-compatible primitive exports, component i18n, and skeleton state boundaries are present.');
