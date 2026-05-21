#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptPath = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(scriptPath), '../..');
const tokenPath = path.join(repoRoot, 'src/theme/tokens/app.tokens.json');
const generatedDir = path.join(repoRoot, 'src/theme/generated');

const outputPaths = {
  appTheme: path.join(generatedDir, 'app-theme.generated.ts'),
  componentTokens: path.join(generatedDir, 'component-tokens.generated.ts'),
  nativewindCss: path.join(generatedDir, 'nativewind-theme.generated.css'),
  nativewindVars: path.join(generatedDir, 'nativewind-vars.generated.ts'),
  primitiveTokens: path.join(generatedDir, 'primitive-tokens.generated.ts'),
  skeletonTokens: path.join(generatedDir, 'skeleton-tokens.generated.ts'),
  tailwindTheme: path.join(generatedDir, 'tailwind-theme.generated.cjs'),
};

const schemes = ['light', 'dark'];

const paletteTokenPaths = [
  ['scheme', ['system', 'scheme'], false],
  ['statusBarStyle', ['system', 'statusBarStyle'], false],
  ['safeArea', ['surfaces', 'safeArea'], true],
  ['orbTop', ['surfaces', 'orbTop'], true],
  ['orbBottom', ['surfaces', 'orbBottom'], true],
  ['heroBackground', ['surfaces', 'heroBackground'], true],
  ['heroSurface', ['surfaces', 'heroSurface'], true],
  ['heroAccent', ['brand', 'heroAccent'], true],
  ['heroTitle', ['text', 'heroTitle'], true],
  ['heroText', ['text', 'heroText'], true],
  ['heroHint', ['text', 'heroHint'], true],
  ['pageTextPrimary', ['text', 'pageTextPrimary'], true],
  ['pageTextSecondary', ['text', 'pageTextSecondary'], true],
  ['pageTextMuted', ['text', 'pageTextMuted'], true],
  ['cardBackground', ['surfaces', 'cardBackground'], true],
  ['cardBorder', ['surfaces', 'cardBorder'], true],
  ['cardMutedBackground', ['surfaces', 'cardMutedBackground'], true],
  ['cardMutedBorder', ['surfaces', 'cardMutedBorder'], true],
  ['infoBackground', ['feedback', 'info', 'background'], true],
  ['infoBorder', ['feedback', 'info', 'border'], true],
  ['noticeBackground', ['feedback', 'notice', 'background'], true],
  ['noticeBorder', ['feedback', 'notice', 'border'], true],
  ['noticeTitle', ['feedback', 'notice', 'title'], true],
  ['noticeText', ['feedback', 'notice', 'text'], true],
  ['inputBackground', ['input', 'background'], true],
  ['inputBorder', ['input', 'border'], true],
  ['inputText', ['input', 'text'], true],
  ['buttonPrimaryBackground', ['buttons', 'primary', 'background'], true],
  ['buttonPrimaryText', ['buttons', 'primary', 'text'], true],
  ['buttonSuccessBackground', ['buttons', 'success', 'background'], true],
  ['buttonSuccessPressedBackground', ['buttons', 'success', 'pressedBackground'], true],
  ['buttonSecondaryBackground', ['buttons', 'secondary', 'background'], true],
  ['buttonSecondaryText', ['buttons', 'secondary', 'text'], true],
  ['buttonTertiaryBackground', ['buttons', 'tertiary', 'background'], true],
  ['buttonTertiaryText', ['buttons', 'tertiary', 'text'], true],
  ['buttonDangerBackground', ['buttons', 'danger', 'background'], true],
  ['buttonDangerPressedBackground', ['buttons', 'danger', 'pressedBackground'], true],
  ['buttonDangerText', ['buttons', 'danger', 'text'], true],
  ['chipBackground', ['chips', 'background'], true],
  ['chipBorder', ['chips', 'border'], true],
  ['chipText', ['chips', 'text'], true],
  ['chipActiveBackground', ['chips', 'activeBackground'], true],
  ['chipActiveText', ['chips', 'activeText'], true],
  ['tabBackground', ['tabs', 'background'], true],
  ['tabText', ['tabs', 'text'], true],
  ['tabActiveBackground', ['tabs', 'activeBackground'], true],
  ['tabActiveText', ['tabs', 'activeText'], true],
  ['actionBarBackground', ['actionBar', 'background'], true],
  ['actionBarText', ['actionBar', 'text'], true],
  ['shadowColor', ['effects', 'shadowColor'], true],
  ['thumbnailBackground', ['surfaces', 'thumbnailBackground'], true],
  ['previewBackground', ['surfaces', 'previewBackground'], true],
];

const skeletonTokenPaths = [
  ['base', ['skeleton', 'base']],
  ['highlight', ['skeleton', 'highlight']],
  ['surface', ['skeleton', 'surface']],
  ['border', ['skeleton', 'border']],
];

const primitiveRadiusTokenPaths = [
  ['button', ['radius', 'button']],
  ['card', ['radius', 'card']],
  ['iconButton', ['radius', 'iconButton']],
  ['media', ['radius', 'media']],
  ['separator', ['radius', 'separator']],
  ['switchTrack', ['radius', 'switchTrack']],
  ['switchThumb', ['radius', 'switchThumb']],
];

const primitiveSpacingTokenPaths = [
  ['buttonPaddingHorizontal', ['spacing', 'buttonPaddingHorizontal']],
  ['buttonPaddingVertical', ['spacing', 'buttonPaddingVertical']],
  ['badgeMinHeight', ['spacing', 'badgeMinHeight']],
  ['badgePaddingHorizontal', ['spacing', 'badgePaddingHorizontal']],
  ['badgePaddingVertical', ['spacing', 'badgePaddingVertical']],
  ['badgeBorderWidth', ['spacing', 'badgeBorderWidth']],
  ['cardPadding', ['spacing', 'cardPadding']],
  ['iconButtonSize', ['spacing', 'iconButtonSize']],
  ['progressHeight', ['spacing', 'progressHeight']],
  ['progressBorderWidth', ['spacing', 'progressBorderWidth']],
  ['separatorThickness', ['spacing', 'separatorThickness']],
  ['switchWidth', ['spacing', 'switchWidth']],
  ['switchHeight', ['spacing', 'switchHeight']],
  ['switchThumbSize', ['spacing', 'switchThumbSize']],
  ['switchThumbInset', ['spacing', 'switchThumbInset']],
];

const primitiveColorTokenPaths = [
  ['iconButtonOverlayBackground', ['color', 'iconButtonOverlayBackground']],
  ['iconButtonOverlayPressedBackground', ['color', 'iconButtonOverlayPressedBackground']],
];

const primitiveSkeletonTokenPaths = [
  ['blockRadius', ['skeleton', 'blockRadius']],
  ['blockGap', ['skeleton', 'blockGap']],
  ['blockPadding', ['skeleton', 'blockPadding']],
  ['defaultHeight', ['skeleton', 'defaultHeight']],
  ['animationDurationMs', ['skeleton', 'animationDurationMs']],
  ['minOpacity', ['skeleton', 'minOpacity']],
  ['maxOpacity', ['skeleton', 'maxOpacity']],
];

const primitiveInteractionPressRetentionTokenPaths = [
  ['top', ['interaction', 'pressRetentionOffset', 'top']],
  ['bottom', ['interaction', 'pressRetentionOffset', 'bottom']],
  ['left', ['interaction', 'pressRetentionOffset', 'left']],
  ['right', ['interaction', 'pressRetentionOffset', 'right']],
];

const primitiveInteractionTouchSurfaceTokenPaths = [
  ['iconScale', ['interaction', 'touchSurfacePressed', 'iconScale']],
  ['iconOpacity', ['interaction', 'touchSurfacePressed', 'iconOpacity']],
  ['tileScale', ['interaction', 'touchSurfacePressed', 'tileScale']],
  ['tileOpacity', ['interaction', 'touchSurfacePressed', 'tileOpacity']],
  ['tabScale', ['interaction', 'touchSurfacePressed', 'tabScale']],
  ['tabOpacity', ['interaction', 'touchSurfacePressed', 'tabOpacity']],
  ['pillScale', ['interaction', 'touchSurfacePressed', 'pillScale']],
  ['pillOpacity', ['interaction', 'touchSurfacePressed', 'pillOpacity']],
];

const primitiveTypographyTokenPaths = [
  ['title', ['typography', 'title']],
  ['body', ['typography', 'body']],
  ['caption', ['typography', 'caption']],
  ['label', ['typography', 'label']],
  ['button', ['typography', 'button']],
];

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, 'utf8'));
}

function getPath(source, keyPath) {
  return keyPath.reduce((value, key) => (value == null ? undefined : value[key]), source);
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function assertColor(value, label) {
  assert(typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value), `${label} must be a #rrggbb color.`);
}

function assertColorString(value, label) {
  assert(
    typeof value === 'string' &&
      (/^#[0-9a-fA-F]{6}$/.test(value) ||
        /^rgba\([0-9]{1,3}, [0-9]{1,3}, [0-9]{1,3}, (0|1|0?\.[0-9]+)\)$/.test(value)),
    `${label} must be a #rrggbb or rgba(r, g, b, a) color.`,
  );
}

function assertNonNegativeNumber(value, label) {
  assert(typeof value === 'number' && Number.isFinite(value) && value >= 0, `${label} must be a non-negative number.`);
}

function assertPositiveInteger(value, label) {
  assert(
    typeof value === 'number' && Number.isInteger(value) && value > 0,
    `${label} must be a positive integer.`,
  );
}

function assertOpacity(value, label) {
  assert(typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1, `${label} must be between 0 and 1.`);
}

function assertFontWeight(value, label) {
  assert(
    value === '400' || value === '500' || value === '600' || value === '700' || value === '800',
    `${label} must be a supported React Native font weight.`,
  );
}

function assertTextStyle(value, label) {
  assert(value && typeof value === 'object' && !Array.isArray(value), `${label} must be a text style object.`);
  assertNonNegativeNumber(value.fontSize, `${label}.fontSize`);
  assertFontWeight(value.fontWeight, `${label}.fontWeight`);
  assertNonNegativeNumber(value.lineHeight, `${label}.lineHeight`);
}

function validateTokens(tokens) {
  assert(tokens && typeof tokens === 'object', 'Token document must be an object.');
  assert(tokens.$schema === './app-tokens.schema.json', 'Token document must reference app-tokens.schema.json.');
  assert(tokens.primitives && typeof tokens.primitives === 'object', 'Token document must include primitives.');
  assert(tokens.components && typeof tokens.components === 'object', 'Token document must include components.');
  assert(tokens.themes && typeof tokens.themes === 'object', 'Token document must include themes.');

  for (const [tokenKey, keyPath] of primitiveRadiusTokenPaths) {
    assertNonNegativeNumber(getPath(tokens.primitives, keyPath), `primitives.radius.${tokenKey}`);
  }

  for (const [tokenKey, keyPath] of primitiveSpacingTokenPaths) {
    assertNonNegativeNumber(getPath(tokens.primitives, keyPath), `primitives.spacing.${tokenKey}`);
  }

  for (const [tokenKey, keyPath] of primitiveColorTokenPaths) {
    assertColorString(getPath(tokens.primitives, keyPath), `primitives.color.${tokenKey}`);
  }

  for (const [tokenKey, keyPath] of primitiveSkeletonTokenPaths) {
    if (tokenKey === 'minOpacity' || tokenKey === 'maxOpacity') {
      assertOpacity(getPath(tokens.primitives, keyPath), `primitives.skeleton.${tokenKey}`);
    } else {
      assertNonNegativeNumber(getPath(tokens.primitives, keyPath), `primitives.skeleton.${tokenKey}`);
    }
  }

  assert(
    tokens.primitives.skeleton.minOpacity <= tokens.primitives.skeleton.maxOpacity,
    'primitives.skeleton.minOpacity must be less than or equal to primitives.skeleton.maxOpacity.',
  );

  for (const [tokenKey, keyPath] of primitiveInteractionPressRetentionTokenPaths) {
    assertNonNegativeNumber(
      getPath(tokens.primitives, keyPath),
      `primitives.interaction.pressRetentionOffset.${tokenKey}`,
    );
  }

  for (const [tokenKey, keyPath] of primitiveInteractionTouchSurfaceTokenPaths) {
    if (tokenKey.endsWith('Opacity')) {
      assertOpacity(
        getPath(tokens.primitives, keyPath),
        `primitives.interaction.touchSurfacePressed.${tokenKey}`,
      );
    } else {
      assertNonNegativeNumber(
        getPath(tokens.primitives, keyPath),
        `primitives.interaction.touchSurfacePressed.${tokenKey}`,
      );
    }
  }

  for (const [tokenKey, keyPath] of primitiveTypographyTokenPaths) {
    assertTextStyle(getPath(tokens.primitives, keyPath), `primitives.typography.${tokenKey}`);
  }

  validateActivityLoadingFallbackTokens(tokens.components.activityLoadingFallback);
  validateDetailTokens(tokens.components.detail);
  validateRecycleBinTokens(tokens.components.recycleBin);
  validateSettingsTokens(tokens.components.settings);
  validateCandidateCardTokens(tokens.components.candidateCard);
  validatePreviewModalTokens(tokens.components.previewModal);
  validateMediaViewerTokens(tokens.components.mediaViewer);
  validateDuplicateCarouselTokens(tokens.components.duplicateCarousel);
  validatePhotoGridTokens(tokens.components.photoGrid);
  validateActionSwitchTokens(tokens.components.actionSwitch);
  validateSegmentedControlTokens(tokens.components.segmentedControl);
  validateScanCounterTokens(tokens.components.scanCounter);
  validateSelectionBarTokens(tokens.components.selectionBar);
  validateTabBarTokens(tokens.components.tabBar);
  validateScanProgressTokens(tokens.components.scanProgress);
  validateLandingTokens(tokens.components.landing);

  for (const scheme of schemes) {
    const theme = tokens.themes[scheme];
    assert(theme && typeof theme === 'object', `Theme "${scheme}" is missing.`);

    for (const [paletteKey, keyPath, isColor] of paletteTokenPaths) {
      const value = getPath(theme, keyPath);
      assert(typeof value === 'string', `${scheme}.${paletteKey} must be a string.`);
      if (paletteKey === 'scheme') {
        assert(value === scheme, `${scheme}.scheme must match its theme key.`);
      } else if (paletteKey === 'statusBarStyle') {
        assert(value === 'dark' || value === 'light', `${scheme}.statusBarStyle must be dark or light.`);
      } else if (isColor) {
        assertColor(value, `${scheme}.${paletteKey}`);
      }
    }

    for (const [skeletonKey, keyPath] of skeletonTokenPaths) {
      assertColor(getPath(theme, keyPath), `${scheme}.skeleton.${skeletonKey}`);
    }
  }
}

function validateScanProgressTokens(scanProgress) {
  assert(
    scanProgress && typeof scanProgress === 'object' && !Array.isArray(scanProgress),
    'components.scanProgress must be an object.',
  );

  for (const key of [
    'activeFillLight',
    'activeFillDark',
    'doneFillLight',
    'doneFillDark',
    'glowLight',
    'glowDark',
    'wakeLight',
    'wakeDark',
    'shimmerLight',
    'shimmerDark',
  ]) {
    assertColorString(scanProgress.color?.[key], `components.scanProgress.color.${key}`);
  }

  for (const key of ['card', 'pill']) {
    assertNonNegativeNumber(scanProgress.radius?.[key], `components.scanProgress.radius.${key}`);
  }

  for (const key of [
    'containerMarginTop',
    'containerPaddingHorizontal',
    'containerPaddingVertical',
    'containerMarginHorizontal',
    'shadowOffsetY',
    'shadowRadius',
    'elevation',
  ]) {
    assertNonNegativeNumber(scanProgress.layout?.[key], `components.scanProgress.layout.${key}`);
  }

  for (const key of ['container', 'headerRow', 'headerTextGroup', 'headerMetaGroup']) {
    assertNonNegativeNumber(scanProgress.gap?.[key], `components.scanProgress.gap.${key}`);
  }

  for (const key of [
    'segmentWidth',
    'wakeWidth',
    'travelWidth',
    'height',
    'borderWidth',
    'edgeInset',
    'minimumFillPercent',
    'preparingFillPercent',
  ]) {
    assertNonNegativeNumber(scanProgress.pipeline?.[key], `components.scanProgress.pipeline.${key}`);
  }

  for (const key of ['paddingHorizontal', 'paddingVertical', 'borderWidth']) {
    assertNonNegativeNumber(scanProgress.badge?.[key], `components.scanProgress.badge.${key}`);
  }

  for (const key of ['paddingHorizontal', 'paddingVertical']) {
    assertNonNegativeNumber(scanProgress.cancelButton?.[key], `components.scanProgress.cancelButton.${key}`);
  }

  for (const key of ['statusSize', 'statusLetterSpacing', 'resultBadgeSize', 'countSize', 'cancelSize']) {
    assertNonNegativeNumber(scanProgress.typography?.[key], `components.scanProgress.typography.${key}`);
  }
  for (const key of ['statusWeight', 'resultBadgeWeight', 'countWeight', 'cancelWeight']) {
    assertFontWeight(scanProgress.typography?.[key], `components.scanProgress.typography.${key}`);
  }

  for (const key of [
    'flowDurationMs',
    'flowPauseDurationMs',
    'breathInDurationMs',
    'breathOutDurationMs',
    'breathPauseDurationMs',
    'settleDurationMs',
    'resultRevealDurationMs',
    'resultRevealDelayMs',
  ]) {
    assertNonNegativeNumber(scanProgress.motion?.[key], `components.scanProgress.motion.${key}`);
  }
  for (const key of [
    'breathInitialOpacity',
    'breathDoneOpacity',
    'breathMaxOpacity',
    'breathMinOpacity',
  ]) {
    assertOpacity(scanProgress.motion?.[key], `components.scanProgress.motion.${key}`);
  }
}

function validateLandingTokens(landing) {
  assert(
    landing && typeof landing === 'object' && !Array.isArray(landing),
    'components.landing must be an object.',
  );

  for (const key of [
    'waveLeftLight',
    'waveLeftDark',
    'waveRightLight',
    'waveRightDark',
    'heroRingOuterLight',
    'heroRingOuterDark',
    'heroRingInnerLight',
    'heroRingInnerDark',
    'heroTileBackgroundLight',
    'heroTileBackgroundDark',
    'heroTileBorderLight',
    'heroTileBorderDark',
    'sparkleLight',
    'sparkleDark',
  ]) {
    assertColorString(landing.color?.[key], `components.landing.color.${key}`);
  }

  for (const key of ['orbTopLight', 'orbTopDark', 'orbBottomLight', 'orbBottomDark', 'glow']) {
    assertOpacity(landing.opacity?.[key], `components.landing.opacity.${key}`);
  }
}

function validateActivityLoadingFallbackTokens(activityLoadingFallback) {
  assert(
    activityLoadingFallback &&
      typeof activityLoadingFallback === 'object' &&
      !Array.isArray(activityLoadingFallback),
    'components.activityLoadingFallback must be an object.',
  );

  for (const key of ['detailBackground', 'detailIndicator']) {
    assertColorString(
      activityLoadingFallback.color?.[key],
      `components.activityLoadingFallback.color.${key}`,
    );
  }

  for (const key of ['screenHeight', 'screenWidth', 'detailHeight', 'detailWidth']) {
    assertNonNegativeNumber(
      activityLoadingFallback.skeleton?.[key],
      `components.activityLoadingFallback.skeleton.${key}`,
    );
  }
}

function validateDetailTokens(detail) {
  assert(
    detail && typeof detail === 'object' && !Array.isArray(detail),
    'components.detail must be an object.',
  );

  for (const key of [
    'background',
    'indicator',
    'closeButtonBackground',
    'closeButtonPressedBackground',
    'tagDanger',
    'tagWarning',
    'tagNeutral',
    'tagText',
  ]) {
    assertColorString(detail.color?.[key], `components.detail.color.${key}`);
  }
}

function validateRecycleBinTokens(recycleBin) {
  assert(
    recycleBin && typeof recycleBin === 'object' && !Array.isArray(recycleBin),
    'components.recycleBin must be an object.',
  );

  for (const key of ['summaryShadowLight', 'summaryShadowDark']) {
    assertColorString(recycleBin.color?.[key], `components.recycleBin.color.${key}`);
  }
}

function validateSettingsTokens(settings) {
  assert(
    settings && typeof settings === 'object' && !Array.isArray(settings),
    'components.settings must be an object.',
  );

  for (const key of [
    'screenBackgroundLight',
    'cardBorderLight',
    'scanIconLight',
    'scanIconDark',
    'reminderIconLight',
    'reminderIconDark',
    'languageIconLight',
    'languageIconDark',
    'cacheIconLight',
    'cacheIconDark',
    'scanChipActiveBackgroundLight',
    'scanChipActiveBackgroundDark',
    'scanChipActiveBorderLight',
    'scanChipActiveBorderDark',
    'scanChipActiveText',
    'reminderChipActiveBackgroundLight',
    'reminderChipActiveBackgroundDark',
    'reminderChipActiveBorderLight',
    'reminderChipActiveBorderDark',
    'languageChipActiveBackgroundLight',
    'languageChipActiveBackgroundDark',
    'languageChipActiveBorderLight',
    'languageChipActiveBorderDark',
    'languageChipActiveTextLight',
    'languageChipActiveTextDark',
    'clearButtonBackgroundLight',
    'clearButtonBackgroundDark',
    'clearButtonTextLight',
    'clearButtonTextDark',
  ]) {
    assertColorString(settings.color?.[key], `components.settings.color.${key}`);
  }

  for (const key of [
    'cardShadowLight',
    'cardShadowDark',
    'overviewShadowLight',
    'overviewShadowDark',
  ]) {
    assertOpacity(settings.opacity?.[key], `components.settings.opacity.${key}`);
  }
}

function validateCandidateCardTokens(candidateCard) {
  assert(
    candidateCard && typeof candidateCard === 'object' && !Array.isArray(candidateCard),
    'components.candidateCard must be an object.',
  );

  for (const key of [
    'cardRadius',
    'cardBorderWidth',
    'cardPadding',
    'cardGap',
    'shadowRadius',
    'shadowOffsetY',
    'elevation',
    'heroGap',
    'thumbnailSize',
    'thumbnailRadius',
    'bodyGap',
    'headerGap',
    'headerTextGap',
    'pillGap',
    'footerGap',
    'reasonLimit',
  ]) {
    assertNonNegativeNumber(candidateCard.layout?.[key], `components.candidateCard.layout.${key}`);
  }
  assertOpacity(candidateCard.layout?.shadowOpacity, 'components.candidateCard.layout.shadowOpacity');

  for (const key of ['radius', 'paddingHorizontal', 'paddingVertical', 'borderWidth']) {
    assertNonNegativeNumber(candidateCard.pill?.[key], `components.candidateCard.pill.${key}`);
  }

  for (const key of ['minHeight', 'radius', 'paddingHorizontal', 'paddingVertical']) {
    assertNonNegativeNumber(
      candidateCard.actionButton?.[key],
      `components.candidateCard.actionButton.${key}`,
    );
  }

  for (const key of [
    'titleSize',
    'subtitleSize',
    'badgeSize',
    'metaSize',
    'issueSize',
    'reasonSize',
    'duplicateSummarySize',
    'duplicateSummaryLineHeight',
    'footerSize',
    'footerLineHeight',
    'actionSize',
  ]) {
    assertNonNegativeNumber(candidateCard.typography?.[key], `components.candidateCard.typography.${key}`);
  }

  for (const key of [
    'titleWeight',
    'badgeWeight',
    'issueWeight',
    'reasonWeight',
    'duplicateSummaryWeight',
    'actionWeight',
  ]) {
    assertFontWeight(candidateCard.typography?.[key], `components.candidateCard.typography.${key}`);
  }
}

function validatePreviewModalTokens(previewModal) {
  assert(
    previewModal && typeof previewModal === 'object' && !Array.isArray(previewModal),
    'components.previewModal must be an object.',
  );

  for (const key of [
    'previewHorizontalInset',
    'previewMinSize',
    'previewAspectRatio',
    'headerPaddingHorizontal',
    'headerPaddingTop',
    'headerPaddingBottom',
    'headerSubtitleMarginTop',
    'contentPadding',
    'contentGap',
    'panelPadding',
    'panelGap',
    'issueGap',
    'reasonGap',
    'statGap',
    'actionGap',
  ]) {
    assertNonNegativeNumber(previewModal.layout?.[key], `components.previewModal.layout.${key}`);
  }
  assert(
    previewModal.layout.previewAspectRatio > 0,
    'components.previewModal.layout.previewAspectRatio must be greater than 0.',
  );

  for (const key of ['button', 'media', 'panel', 'duplicateStrip', 'pill']) {
    assertNonNegativeNumber(previewModal.radius?.[key], `components.previewModal.radius.${key}`);
  }

  for (const key of ['panelWidth', 'duplicateStripWidth']) {
    assertNonNegativeNumber(previewModal.border?.[key], `components.previewModal.border.${key}`);
  }

  for (const key of ['paddingHorizontal', 'paddingVertical']) {
    assertNonNegativeNumber(previewModal.pill?.[key], `components.previewModal.pill.${key}`);
  }

  for (const key of ['paddingHorizontal', 'paddingVertical', 'lineHeight']) {
    assertNonNegativeNumber(
      previewModal.duplicateStrip?.[key],
      `components.previewModal.duplicateStrip.${key}`,
    );
  }

  for (const key of [
    'closePaddingHorizontal',
    'closePaddingVertical',
    'actionPaddingHorizontal',
    'actionPaddingVertical',
  ]) {
    assertNonNegativeNumber(previewModal.button?.[key], `components.previewModal.button.${key}`);
  }

  for (const key of ['headerTitleSize', 'panelTitleSize', 'panelValueSize', 'pillSize', 'statLabelSize']) {
    assertNonNegativeNumber(previewModal.typography?.[key], `components.previewModal.typography.${key}`);
  }
  for (const key of [
    'headerTitleWeight',
    'closeButtonWeight',
    'panelTitleWeight',
    'panelValueWeight',
    'pillWeight',
    'duplicateReasonWeight',
    'statValueWeight',
    'actionWeight',
  ]) {
    assertFontWeight(previewModal.typography?.[key], `components.previewModal.typography.${key}`);
  }
}

function validateMediaViewerTokens(mediaViewer) {
  assert(
    mediaViewer && typeof mediaViewer === 'object' && !Array.isArray(mediaViewer),
    'components.mediaViewer must be an object.',
  );
  assert(
    mediaViewer.video && typeof mediaViewer.video === 'object' && !Array.isArray(mediaViewer.video),
    'components.mediaViewer.video must be an object.',
  );
  assert(
    mediaViewer.zoom && typeof mediaViewer.zoom === 'object' && !Array.isArray(mediaViewer.zoom),
    'components.mediaViewer.zoom must be an object.',
  );

  for (const key of ['fallbackAspectRatio', 'minAspectRatio']) {
    assertNonNegativeNumber(mediaViewer.video?.[key], `components.mediaViewer.video.${key}`);
  }
  assert(
    mediaViewer.video.fallbackAspectRatio > 0,
    'components.mediaViewer.video.fallbackAspectRatio must be greater than 0.',
  );
  assert(
    mediaViewer.video.minAspectRatio > 0,
    'components.mediaViewer.video.minAspectRatio must be greater than 0.',
  );

  for (const key of [
    'defaultMinScale',
    'defaultMaxScale',
    'underScaleFactor',
    'overScaleFactor',
    'clampDurationMs',
  ]) {
    assertNonNegativeNumber(mediaViewer.zoom?.[key], `components.mediaViewer.zoom.${key}`);
  }
  assert(
    mediaViewer.zoom.defaultMaxScale >= mediaViewer.zoom.defaultMinScale,
    'components.mediaViewer.zoom.defaultMaxScale must be greater than or equal to defaultMinScale.',
  );
  assert(
    mediaViewer.zoom.underScaleFactor > 0,
    'components.mediaViewer.zoom.underScaleFactor must be greater than 0.',
  );
  assert(
    mediaViewer.zoom.overScaleFactor >= 1,
    'components.mediaViewer.zoom.overScaleFactor must be greater than or equal to 1.',
  );
}

function validateDuplicateCarouselTokens(duplicateCarousel) {
  assert(
    duplicateCarousel && typeof duplicateCarousel === 'object' && !Array.isArray(duplicateCarousel),
    'components.duplicateCarousel must be an object.',
  );
  assert(
    duplicateCarousel.defaultStage &&
      typeof duplicateCarousel.defaultStage === 'object' &&
      !Array.isArray(duplicateCarousel.defaultStage),
    'components.duplicateCarousel.defaultStage must be an object.',
  );
  assert(
    duplicateCarousel.windowing &&
      typeof duplicateCarousel.windowing === 'object' &&
      !Array.isArray(duplicateCarousel.windowing),
    'components.duplicateCarousel.windowing must be an object.',
  );
  assert(
    duplicateCarousel.nav &&
      typeof duplicateCarousel.nav === 'object' &&
      !Array.isArray(duplicateCarousel.nav),
    'components.duplicateCarousel.nav must be an object.',
  );

  for (const key of ['windowHorizontalInset', 'minWidth', 'heightRatio', 'minHeight']) {
    assertNonNegativeNumber(
      duplicateCarousel.defaultStage?.[key],
      `components.duplicateCarousel.defaultStage.${key}`,
    );
  }
  assert(
    duplicateCarousel.defaultStage.heightRatio > 0,
    'components.duplicateCarousel.defaultStage.heightRatio must be greater than 0.',
  );
  assertPositiveInteger(
    duplicateCarousel.windowing?.reuseSlotCount,
    'components.duplicateCarousel.windowing.reuseSlotCount',
  );
  for (const key of ['buttonSize', 'buttonInset', 'iconSize']) {
    assertNonNegativeNumber(duplicateCarousel.nav?.[key], `components.duplicateCarousel.nav.${key}`);
  }
  assertColorString(duplicateCarousel.nav?.background, 'components.duplicateCarousel.nav.background');
  assertColorString(
    duplicateCarousel.nav?.pressedBackground,
    'components.duplicateCarousel.nav.pressedBackground',
  );
}

function validatePhotoGridTokens(photoGrid) {
  assert(
    photoGrid && typeof photoGrid === 'object' && !Array.isArray(photoGrid),
    'components.photoGrid must be an object.',
  );

  for (const section of ['list', 'entryCard', 'item', 'videoBadge', 'duplicateBadge', 'selection']) {
    assert(
      photoGrid[section] && typeof photoGrid[section] === 'object' && !Array.isArray(photoGrid[section]),
      `components.photoGrid.${section} must be an object.`,
    );
  }

  assertNonNegativeNumber(photoGrid.list?.edgePadding, 'components.photoGrid.list.edgePadding');

  for (const key of [
    'progressTrackLight',
    'progressTrackDark',
    'breakdownDuplicate',
    'breakdownBlurry',
    'breakdownSimilar',
    'breakdownDuplicateBackground',
    'breakdownBlurryBackground',
    'breakdownSimilarBackground',
    'sparklePrimary',
    'sparkleSecondary',
  ]) {
    assertColorString(photoGrid.entryCard?.color?.[key], `components.photoGrid.entryCard.color.${key}`);
  }
  for (const key of [
    'progressAccentShadowLight',
    'progressAccentShadowDark',
    'sparkle',
    'genericShadowLight',
    'genericShadowDark',
  ]) {
    assertOpacity(photoGrid.entryCard?.opacity?.[key], `components.photoGrid.entryCard.opacity.${key}`);
  }

  for (const key of [
    'radiusCompact',
    'radiusRegular',
    'darkBorderWidth',
    'pressedShadowOffsetY',
    'pressedShadowRadius',
    'pressedElevation',
  ]) {
    assertNonNegativeNumber(photoGrid.item?.[key], `components.photoGrid.item.${key}`);
  }
  assertColorString(photoGrid.item?.lightBorderColor, 'components.photoGrid.item.lightBorderColor');
  assertOpacity(photoGrid.item?.pressedShadowOpacityLight, 'components.photoGrid.item.pressedShadowOpacityLight');
  assertOpacity(photoGrid.item?.pressedShadowOpacityDark, 'components.photoGrid.item.pressedShadowOpacityDark');

  for (const key of [
    'leftCompact',
    'leftRegular',
    'bottomCompact',
    'bottomRegular',
    'gapCompact',
    'gapRegular',
    'paddingLeftCompact',
    'paddingLeftRegular',
    'paddingRightCompact',
    'paddingRightRegular',
    'heightCompact',
    'heightRegular',
    'radius',
    'iconWidthCompact',
    'iconWidthRegular',
    'iconHeightRatio',
    'textSizeCompact',
    'textSizeRegular',
    'textLineHeightCompact',
    'textLineHeightRegular',
  ]) {
    assertNonNegativeNumber(photoGrid.videoBadge?.[key], `components.photoGrid.videoBadge.${key}`);
  }
  assert(
    photoGrid.videoBadge.iconHeightRatio > 0,
    'components.photoGrid.videoBadge.iconHeightRatio must be greater than 0.',
  );
  assertColorString(photoGrid.videoBadge?.background, 'components.photoGrid.videoBadge.background');
  assertColorString(photoGrid.videoBadge?.foreground, 'components.photoGrid.videoBadge.foreground');
  assertFontWeight(photoGrid.videoBadge?.textWeight, 'components.photoGrid.videoBadge.textWeight');

  for (const key of [
    'bottom',
    'right',
    'minWidth',
    'height',
    'radius',
    'paddingHorizontal',
    'contentHeight',
    'textSize',
  ]) {
    assertNonNegativeNumber(photoGrid.duplicateBadge?.[key], `components.photoGrid.duplicateBadge.${key}`);
  }
  assertColorString(photoGrid.duplicateBadge?.background, 'components.photoGrid.duplicateBadge.background');
  assertColorString(photoGrid.duplicateBadge?.foreground, 'components.photoGrid.duplicateBadge.foreground');
  assertFontWeight(photoGrid.duplicateBadge?.textWeight, 'components.photoGrid.duplicateBadge.textWeight');

  for (const key of [
    'sizeCompact',
    'sizeRegular',
    'offsetCompact',
    'offsetRegular',
    'borderWidthCompact',
    'borderWidthRegular',
    'shadowOffsetYCompact',
    'shadowOffsetYRegular',
    'shadowRadiusCompact',
    'shadowRadiusRegular',
    'elevationCompact',
    'elevationRegular',
    'checkIconSizeCompact',
    'checkIconSizeRegular',
  ]) {
    assertNonNegativeNumber(photoGrid.selection?.[key], `components.photoGrid.selection.${key}`);
  }
  for (const key of [
    'emptyBackgroundCompact',
    'emptyBackgroundRegular',
    'borderColorCompact',
    'borderColorRegular',
    'filledBackground',
    'foreground',
  ]) {
    assertColorString(photoGrid.selection?.[key], `components.photoGrid.selection.${key}`);
  }
  for (const key of ['shadowOpacityCompact', 'shadowOpacityDark', 'shadowOpacityLight']) {
    assertOpacity(photoGrid.selection?.[key], `components.photoGrid.selection.${key}`);
  }
}

function validateScanCounterTokens(scanCounter) {
  assert(
    scanCounter && typeof scanCounter === 'object' && !Array.isArray(scanCounter),
    'components.scanCounter must be an object.',
  );

  assertNonNegativeNumber(
    scanCounter.typography?.statusSize,
    'components.scanCounter.typography.statusSize',
  );
  assertFontWeight(
    scanCounter.typography?.statusWeight,
    'components.scanCounter.typography.statusWeight',
  );
}

function validateSelectionBarTokens(selectionBar) {
  assert(
    selectionBar && typeof selectionBar === 'object' && !Array.isArray(selectionBar),
    'components.selectionBar must be an object.',
  );

  for (const key of ['horizontal', 'vertical', 'buttonHorizontal', 'buttonVertical', 'buttonGap']) {
    assertNonNegativeNumber(selectionBar.spacing?.[key], `components.selectionBar.spacing.${key}`);
  }

  assertNonNegativeNumber(selectionBar.radius?.button, 'components.selectionBar.radius.button');
  assertNonNegativeNumber(selectionBar.border?.buttonWidth, 'components.selectionBar.border.buttonWidth');
  assertNonNegativeNumber(selectionBar.size?.buttonMinHeight, 'components.selectionBar.size.buttonMinHeight');

  for (const key of ['countSize', 'buttonSize']) {
    assertNonNegativeNumber(selectionBar.typography?.[key], `components.selectionBar.typography.${key}`);
  }
  for (const key of ['countWeight', 'buttonWeight']) {
    assertFontWeight(selectionBar.typography?.[key], `components.selectionBar.typography.${key}`);
  }

  assertOpacity(selectionBar.state?.disabledOpacity, 'components.selectionBar.state.disabledOpacity');
}

function validateTabBarTokens(tabBar) {
  assert(
    tabBar && typeof tabBar === 'object' && !Array.isArray(tabBar),
    'components.tabBar must be an object.',
  );

  for (const key of [
    'minimumBottomPadding',
    'height',
    'marginHorizontal',
    'paddingHorizontal',
    'tabMinHeight',
    'tabMinWidth',
    'iconSize',
    'iconBottomMargin',
  ]) {
    assertNonNegativeNumber(tabBar.layout?.[key], `components.tabBar.layout.${key}`);
  }

  for (const key of [
    'offsetTop',
    'offsetRight',
    'radius',
    'minWidth',
    'minHeight',
    'paddingHorizontal',
    'paddingVertical',
    'borderWidth',
    'maxDisplayCount',
  ]) {
    assertNonNegativeNumber(tabBar.badge?.[key], `components.tabBar.badge.${key}`);
  }

  for (const key of ['labelSize', 'badgeSize']) {
    assertNonNegativeNumber(tabBar.typography?.[key], `components.tabBar.typography.${key}`);
  }
  for (const key of ['labelWeight', 'activeLabelWeight', 'badgeWeight']) {
    assertFontWeight(tabBar.typography?.[key], `components.tabBar.typography.${key}`);
  }
}

function validateSegmentedControlTokens(segmentedControl) {
  assert(
    segmentedControl && typeof segmentedControl === 'object' && !Array.isArray(segmentedControl),
    'components.segmentedControl must be an object.',
  );

  assertColorString(
    segmentedControl.color?.selectedCountText,
    'components.segmentedControl.color.selectedCountText',
  );
  assertNonNegativeNumber(segmentedControl.radius?.button, 'components.segmentedControl.radius.button');

  for (const key of ['container', 'buttonContent', 'textGroup']) {
    assertNonNegativeNumber(segmentedControl.gap?.[key], `components.segmentedControl.gap.${key}`);
  }

  for (const key of [
    'icon',
    'buttonMinHeight',
    'buttonPaddingHorizontal',
    'buttonPaddingVertical',
    'buttonBorderWidth',
  ]) {
    assertNonNegativeNumber(segmentedControl.size?.[key], `components.segmentedControl.size.${key}`);
  }

  assertNonNegativeNumber(
    segmentedControl.typography?.labelFontSize,
    'components.segmentedControl.typography.labelFontSize',
  );
  assertFontWeight(
    segmentedControl.typography?.labelFontWeight,
    'components.segmentedControl.typography.labelFontWeight',
  );
  assertFontWeight(
    segmentedControl.typography?.selectedLabelFontWeight,
    'components.segmentedControl.typography.selectedLabelFontWeight',
  );
  assertNonNegativeNumber(
    segmentedControl.typography?.countFontSize,
    'components.segmentedControl.typography.countFontSize',
  );
  assertFontWeight(
    segmentedControl.typography?.countFontWeight,
    'components.segmentedControl.typography.countFontWeight',
  );
}

function validateActionSwitchTokens(actionSwitch) {
  assert(
    actionSwitch && typeof actionSwitch === 'object' && !Array.isArray(actionSwitch),
    'components.actionSwitch must be an object.',
  );

  for (const key of [
    'activeText',
    'inactiveText',
    'inactiveIcon',
    'dangerBackground',
    'keepBackground',
    'neutralBackground',
  ]) {
    assertColorString(actionSwitch.color?.[key], `components.actionSwitch.color.${key}`);
  }

  for (const key of ['regular', 'compact']) {
    assertNonNegativeNumber(actionSwitch.radius?.[key], `components.actionSwitch.radius.${key}`);
  }

  for (const key of ['regular', 'compact', 'contentRegular', 'contentCompact']) {
    assertNonNegativeNumber(actionSwitch.gap?.[key], `components.actionSwitch.gap.${key}`);
  }

  for (const key of [
    'iconRegular',
    'iconCompact',
    'segmentMinWidthRegular',
    'segmentMinWidthCompact',
    'segmentHeightRegular',
    'segmentHeightCompact',
    'segmentPaddingHorizontalRegular',
    'segmentPaddingHorizontalCompact',
  ]) {
    assertNonNegativeNumber(actionSwitch.size?.[key], `components.actionSwitch.size.${key}`);
  }

  for (const key of ['fontSizeRegular', 'fontSizeCompact', 'letterSpacingRegular', 'letterSpacingCompact']) {
    assertNonNegativeNumber(actionSwitch.typography?.[key], `components.actionSwitch.typography.${key}`);
  }
  assertFontWeight(actionSwitch.typography?.fontWeight, 'components.actionSwitch.typography.fontWeight');
}

function buildPalette(tokens, scheme) {
  const theme = tokens.themes[scheme];
  return Object.fromEntries(
    paletteTokenPaths.map(([paletteKey, keyPath]) => [paletteKey, getPath(theme, keyPath)]),
  );
}

function buildPalettes(tokens) {
  return Object.fromEntries(schemes.map((scheme) => [scheme, buildPalette(tokens, scheme)]));
}

function toKebab(value) {
  return value.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
}

function buildThemeVars(tokens, scheme) {
  const palette = buildPalette(tokens, scheme);
  const vars = {};

  for (const [paletteKey, , isColor] of paletteTokenPaths) {
    if (isColor) {
      vars[`--app-${toKebab(paletteKey)}`] = palette[paletteKey];
    }
  }

  for (const [skeletonKey, keyPath] of skeletonTokenPaths) {
    vars[`--app-skeleton-${toKebab(skeletonKey)}`] = getPath(tokens.themes[scheme], keyPath);
  }

  return vars;
}

function buildThemeVarSet(tokens) {
  return Object.fromEntries(schemes.map((scheme) => [scheme, buildThemeVars(tokens, scheme)]));
}

function buildCssBlock(selector, vars) {
  const lines = Object.entries(vars).map(([name, value]) => `  ${name}: ${value};`);
  return `${selector} {\n${lines.join('\n')}\n}`;
}

function buildTailwindColors() {
  const colors = {};

  for (const [paletteKey, , isColor] of paletteTokenPaths) {
    if (isColor) {
      colors[paletteKey] = `var(--app-${toKebab(paletteKey)})`;
    }
  }

  colors.skeleton = Object.fromEntries(
    skeletonTokenPaths.map(([skeletonKey]) => [
      skeletonKey,
      `var(--app-skeleton-${toKebab(skeletonKey)})`,
    ]),
  );

  return colors;
}

function buildShadcnTailwindColorAliases() {
  return {
    border: 'var(--app-card-border)',
    input: 'var(--app-input-border)',
    ring: 'var(--app-button-primary-background)',
    background: 'var(--app-safe-area)',
    foreground: 'var(--app-page-text-primary)',
    primary: {
      DEFAULT: 'var(--app-button-primary-background)',
      foreground: 'var(--app-button-primary-text)',
    },
    secondary: {
      DEFAULT: 'var(--app-button-secondary-background)',
      foreground: 'var(--app-button-secondary-text)',
    },
    destructive: {
      DEFAULT: 'var(--app-button-danger-background)',
      foreground: 'var(--app-button-danger-text)',
    },
    muted: {
      DEFAULT: 'var(--app-card-muted-background)',
      foreground: 'var(--app-page-text-muted)',
    },
    accent: {
      DEFAULT: 'var(--app-chip-active-background)',
      foreground: 'var(--app-chip-active-text)',
    },
    popover: {
      DEFAULT: 'var(--app-card-background)',
      foreground: 'var(--app-page-text-primary)',
    },
    card: {
      DEFAULT: 'var(--app-card-background)',
      foreground: 'var(--app-page-text-primary)',
    },
  };
}

function asJson(value) {
  return JSON.stringify(value, null, 2);
}

function generatedHeader() {
  return [
    '/*',
    ' * This file is generated by scripts/theme/generate-theme-tokens.mjs.',
    ' * Do not edit by hand.',
    ' */',
    '',
  ].join('\n');
}

function buildAppThemeGenerated(tokens) {
  return `${generatedHeader()}import type { AppThemePalette } from '../app-theme';

export const GENERATED_APP_THEMES: Record<'light' | 'dark', AppThemePalette> = ${asJson(
    buildPalettes(tokens),
  )};
`;
}

function buildNativeWindVarsGenerated(tokens) {
  const themeVars = buildThemeVarSet(tokens);
  const cssVariables = {
    light: buildCssBlock(':root, .theme-light', themeVars.light),
    dark: buildCssBlock('.theme-dark', themeVars.dark),
  };

  return `${generatedHeader()}export const NATIVEWIND_THEME_VARS = ${asJson(themeVars)} as const;

export const THEME_CSS_VARIABLES = ${asJson(cssVariables)} as const;
`;
}

function buildNativeWindCssGenerated(tokens) {
  const themeVars = buildThemeVarSet(tokens);

  return `${generatedHeader()}${buildCssBlock(':root, .theme-light', themeVars.light)}

${buildCssBlock('.theme-dark', themeVars.dark)}
`;
}

function buildTailwindThemeGenerated(tokens) {
  const themeVars = buildThemeVarSet(tokens);
  const tailwindConfigFragment = {
    theme: {
      extend: {
        colors: {
          ...buildShadcnTailwindColorAliases(),
          app: buildTailwindColors(),
        },
      },
    },
    cssVariables: themeVars,
  };

  return `${generatedHeader()}const tailwindConfigFragment = ${asJson(tailwindConfigFragment)};

module.exports = tailwindConfigFragment;
`;
}

function buildComponentTokens(tokens) {
  return {
    activityLoadingFallback: tokens.components.activityLoadingFallback,
    detail: tokens.components.detail,
    recycleBin: tokens.components.recycleBin,
    settings: tokens.components.settings,
    candidateCard: tokens.components.candidateCard,
    previewModal: tokens.components.previewModal,
    mediaViewer: tokens.components.mediaViewer,
    duplicateCarousel: tokens.components.duplicateCarousel,
    photoGrid: tokens.components.photoGrid,
    actionSwitch: tokens.components.actionSwitch,
    segmentedControl: tokens.components.segmentedControl,
    scanCounter: tokens.components.scanCounter,
    selectionBar: tokens.components.selectionBar,
    tabBar: tokens.components.tabBar,
    scanProgress: tokens.components.scanProgress,
    landing: tokens.components.landing,
  };
}

function buildPrimitiveTokens(tokens) {
  return {
    radius: Object.fromEntries(
      primitiveRadiusTokenPaths.map(([tokenKey, keyPath]) => [
        tokenKey,
        getPath(tokens.primitives, keyPath),
      ]),
    ),
    spacing: Object.fromEntries(
      primitiveSpacingTokenPaths.map(([tokenKey, keyPath]) => [
        tokenKey,
        getPath(tokens.primitives, keyPath),
      ]),
    ),
    color: Object.fromEntries(
      primitiveColorTokenPaths.map(([tokenKey, keyPath]) => [
        tokenKey,
        getPath(tokens.primitives, keyPath),
      ]),
    ),
    interaction: {
      pressRetentionOffset: Object.fromEntries(
        primitiveInteractionPressRetentionTokenPaths.map(([tokenKey, keyPath]) => [
          tokenKey,
          getPath(tokens.primitives, keyPath),
        ]),
      ),
      touchSurfacePressed: Object.fromEntries(
        primitiveInteractionTouchSurfaceTokenPaths.map(([tokenKey, keyPath]) => [
          tokenKey,
          getPath(tokens.primitives, keyPath),
        ]),
      ),
    },
    typography: Object.fromEntries(
      primitiveTypographyTokenPaths.map(([tokenKey, keyPath]) => [
        tokenKey,
        getPath(tokens.primitives, keyPath),
      ]),
    ),
  };
}

function buildSkeletonTokens(tokens) {
  return {
    colors: Object.fromEntries(
      schemes.map((scheme) => [
        scheme,
        Object.fromEntries(
          skeletonTokenPaths.map(([tokenKey, keyPath]) => [
            tokenKey,
            getPath(tokens.themes[scheme], keyPath),
          ]),
        ),
      ]),
    ),
    layout: {
      blockRadius: getPath(tokens.primitives, ['skeleton', 'blockRadius']),
      blockGap: getPath(tokens.primitives, ['skeleton', 'blockGap']),
      blockPadding: getPath(tokens.primitives, ['skeleton', 'blockPadding']),
      defaultHeight: getPath(tokens.primitives, ['skeleton', 'defaultHeight']),
    },
    motion: {
      animationDurationMs: getPath(tokens.primitives, ['skeleton', 'animationDurationMs']),
      minOpacity: getPath(tokens.primitives, ['skeleton', 'minOpacity']),
      maxOpacity: getPath(tokens.primitives, ['skeleton', 'maxOpacity']),
    },
  };
}

function buildPrimitiveTokensGenerated(tokens) {
  return `${generatedHeader()}export const PRIMITIVE_TOKENS = ${asJson(buildPrimitiveTokens(tokens))} as const;

export type PrimitiveTokens = typeof PRIMITIVE_TOKENS;
`;
}

function buildComponentTokensGenerated(tokens) {
  return `${generatedHeader()}export const COMPONENT_TOKENS = ${asJson(buildComponentTokens(tokens))} as const;

export type ComponentTokens = typeof COMPONENT_TOKENS;
`;
}

function buildSkeletonTokensGenerated(tokens) {
  return `${generatedHeader()}export const SKELETON_TOKENS = ${asJson(buildSkeletonTokens(tokens))} as const;

export type SkeletonTokens = typeof SKELETON_TOKENS;
`;
}

function buildGeneratedFiles(tokens) {
  return {
    [outputPaths.appTheme]: buildAppThemeGenerated(tokens),
    [outputPaths.componentTokens]: buildComponentTokensGenerated(tokens),
    [outputPaths.nativewindCss]: buildNativeWindCssGenerated(tokens),
    [outputPaths.nativewindVars]: buildNativeWindVarsGenerated(tokens),
    [outputPaths.primitiveTokens]: buildPrimitiveTokensGenerated(tokens),
    [outputPaths.skeletonTokens]: buildSkeletonTokensGenerated(tokens),
    [outputPaths.tailwindTheme]: buildTailwindThemeGenerated(tokens),
  };
}

function normalizeGenerated(content) {
  return content.endsWith('\n') ? content : `${content}\n`;
}

function writeGeneratedFiles(files) {
  mkdirSync(generatedDir, { recursive: true });
  for (const [filePath, content] of Object.entries(files)) {
    writeFileSync(filePath, normalizeGenerated(content));
  }
}

function checkGeneratedFiles(files) {
  const mismatched = [];

  for (const [filePath, content] of Object.entries(files)) {
    if (!existsSync(filePath)) {
      mismatched.push(path.relative(repoRoot, filePath));
      continue;
    }

    const actual = readFileSync(filePath, 'utf8');
    if (actual !== normalizeGenerated(content)) {
      mismatched.push(path.relative(repoRoot, filePath));
    }
  }

  if (mismatched.length > 0) {
    throw new Error(
      `Generated theme token outputs are stale or missing:\n${mismatched
        .map((filePath) => `- ${filePath}`)
        .join('\n')}\nRun: node scripts/theme/generate-theme-tokens.mjs`,
    );
  }
}

export function generateThemeTokenOutputs({ check = false } = {}) {
  const tokens = readJson(tokenPath);
  validateTokens(tokens);
  const files = buildGeneratedFiles(tokens);

  if (check) {
    checkGeneratedFiles(files);
  } else {
    writeGeneratedFiles(files);
  }

  return {
    files: Object.keys(files).map((filePath) => path.relative(repoRoot, filePath)),
  };
}

function main() {
  const check = process.argv.includes('--check');
  const result = generateThemeTokenOutputs({ check });
  const action = check ? 'Verified' : 'Generated';
  for (const filePath of result.files) {
    console.log(`${action} ${filePath}`);
  }
}

if (process.argv[1] === scriptPath) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
