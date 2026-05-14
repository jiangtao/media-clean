# Theme Tokens and Tailwind Reuse Strategy

[中文版本](./theme-token-tailwind-strategy.md)

## Background

The current theme code supports light / dark / system, but the structure is becoming hard to maintain:

1. `src/theme/app-theme.ts` is a flat `AppThemePalette` that mixes global semantics, component semantics, and page-specific semantics.
2. Many components still contain hardcoded colors such as `#2f80ff`, `#ffffff`, `rgba(...)`, and `theme.scheme === 'dark' ? ... : ...`.
3. `MediaCleanerApp` and `AppPreferencesContext` both contain theme resolution logic, so legacy entrypoints are not fully converged.
4. Tests manually define full mock themes, which makes token additions expensive.
5. The current theme only covers colors. It lacks spacing, radius, typography, shadow, opacity, and motion tokens.
6. Electron First means desktop UI should reuse the same theme instead of creating a separate CSS theme.

In the community direction, Tailwind v4 uses theme variables as the source for design tokens and utility classes. NativeWind supports Tailwind CLI theming and recommends CSS variables / `vars()` for dynamic themes. React Native still benefits from `StyleSheet.create()` for native style type checking and clear style organization. So this project should not replace everything with `className`; it should adopt **token-first + Tailwind-compatible output**.

References:

1. Tailwind theme variables: [Tailwind CSS Theme Variables](https://tailwindcss.com/docs/theme).
2. NativeWind theme guide: [NativeWind Themes](https://www.nativewind.dev/docs/guides/themes).
3. NativeWind v5 dark mode: [NativeWind Dark Mode](https://www.nativewind.dev/v5/core-concepts/dark-mode).
4. React Native StyleSheet: [React Native StyleSheet](https://reactnative.dev/docs/stylesheet).

## Decision

Use **Token-first + Tailwind-compatible + NativeWind optional**:

```text
Design Tokens
  primitives
  semantic tokens
  component aliases

Generated Outputs
  React Native theme object
  NativeWind vars / tailwind config
  Electron Tailwind CSS @theme
  documentation tables

Product Usage
  RN StyleSheet for complex/native/dynamic styles
  NativeWind className for simple layout and new shared components
  Electron Tailwind classes + CSS variables
```

Core principles:

1. `tokens` is the single source of truth.
2. `AppThemePalette` becomes a compatibility layer, not the design source.
3. Tailwind / NativeWind are output layers, not the source of theme data.
4. Existing complex RN components continue using `StyleSheet.create()` while reading from tokens.
5. New components may use NativeWind `className`, but colors must come from tokens / CSS variables.
6. Electron uses the same tokens to generate Tailwind CSS `@theme` and CSS variables.

## Layering

Recommended layout:

```text
src/theme/
  tokens/
    primitives.ts
    semantic.ts
    components.ts
    modes.ts
  generated/
    app-theme.generated.ts
    nativewind-vars.generated.ts
    tailwind-theme.generated.ts
    theme.css
  adapters/
    react-native-theme.ts
    nativewind-theme.ts
    electron-theme.ts
  app-theme.ts              # compatibility facade
  theme-version.ts

scripts/theme/
  generate-theme-artifacts.mjs
  verify-theme-tokens.mjs
```

### Primitive tokens

The lowest-level tokens. Business components should not use them directly:

```ts
colors.blue.500
colors.slate.900
colors.red.500
spacing.4
radius.md
shadow.sm
fontSize.body
lineHeight.body
opacity.disabled
```

Naming should align with Tailwind namespaces:

```text
--color-*
--spacing-*
--radius-*
--shadow-*
--text-*
--font-weight-*
```

### Semantic tokens

Business components should primarily use this layer:

```ts
color.background.canvas
color.background.surface
color.background.surfaceMuted
color.text.primary
color.text.secondary
color.text.muted
color.border.subtle
color.action.primary.background
color.action.primary.foreground
color.action.danger.background
color.status.success
color.status.warning
color.status.danger
```

### Component aliases

Add these only when semantic tokens cannot express component intent:

```ts
component.photoGrid.selectionBadge.background
component.scanProgress.activeFill
component.tabBar.activeIndicator
component.hero.orbTop
component.preview.backdrop
```

Rule: component aliases must point to primitive or semantic tokens. They must not directly contain raw hex values.

## Tailwind / NativeWind Reuse

### Tailwind CSS / Electron

Generate CSS for Electron:

```css
@theme {
  --color-bg-canvas: var(--mc-color-background-canvas);
  --color-text-primary: var(--mc-color-text-primary);
  --radius-card: var(--mc-radius-card);
  --spacing-screen-x: var(--mc-spacing-screen-x);
}

:root[data-theme="light"] {
  --mc-color-background-canvas: #f5f7fb;
}

:root[data-theme="dark"] {
  --mc-color-background-canvas: #0a1020;
}
```

Electron UI can use:

```html
<main class="bg-bg-canvas text-text-primary">
```

### NativeWind / RN

NativeWind can be used for new components and simple styles:

```tsx
<View className="bg-bg-canvas px-screen-x">
  <Text className="text-text-primary text-body">...</Text>
</View>
```

Dynamic themes are injected through generated vars:

```tsx
<View style={nativeWindThemeVars[resolvedThemeScheme]}>
  {children}
</View>
```

Do not migrate everything to NativeWind immediately:

1. Existing RN components rely heavily on `StyleSheet.create(theme)`, dynamic sizes, safe area, foldable, and compact logic.
2. Adding NativeWind introduces Babel / Metro / className rules, which increases short-term risk.
3. Complex components such as `PhotoGrid`, `ScanProgress`, and `PhotoGridEntryCard` should stay on typed StyleSheet for now.

## React Native Usage Rules

Keep `StyleSheet.create()`, but values must come from token adapters:

```ts
function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    screen: {
      backgroundColor: theme.color.background.canvas,
      paddingHorizontal: theme.spacing.screenX,
    },
    title: {
      color: theme.color.text.primary,
      fontSize: theme.typography.title.fontSize,
      lineHeight: theme.typography.title.lineHeight,
    },
  });
}
```

Do not add:

```ts
backgroundColor: '#2f80ff'
color: theme.scheme === 'dark' ? '#fff' : '#000'
```

Allowed exceptions:

1. Image / video overlays such as `rgba(0,0,0,0.74)`, but they must move to `overlay` tokens.
2. Third-party icon default colors, but they should converge through wrapper tokens.
3. Test fixture mock colors, but they should move to `createMockTheme()`.

## Current Code Migration Mapping

Map the current `AppThemePalette` into new tokens first:

| Current field | New token |
| --- | --- |
| `safeArea` | `color.background.canvas` |
| `pageTextPrimary` | `color.text.primary` |
| `pageTextSecondary` | `color.text.secondary` |
| `pageTextMuted` | `color.text.muted` |
| `cardBackground` | `color.surface.default` |
| `cardBorder` | `color.border.subtle` |
| `cardMutedBackground` | `color.surface.muted` |
| `buttonPrimaryBackground` | `color.action.primary.background` |
| `buttonPrimaryText` | `color.action.primary.foreground` |
| `buttonDangerBackground` | `color.action.danger.background` |
| `noticeBackground` | `color.status.warning.background` |
| `infoBackground` | `color.status.info.background` |
| `thumbnailBackground` | `component.media.thumbnail.background` |
| `previewBackground` | `component.preview.background` |
| `hero*` / `orb*` | `component.landing.*` |

## Theme State Management

Keep the current preference model:

```text
themePreference: system | light | dark
resolvedThemeScheme: light | dark
```

But converge theme provider ownership into `AppPreferencesContext`:

1. `MediaCleanerApp` should no longer read `useColorScheme()` and storage directly.
2. Keep only one top-level `AppPreferencesProvider`.
3. `useAppTheme()` can be a light facade over `useAppPreferences().theme`.
4. NativeWind vars / Electron CSS `data-theme` are both driven by the same resolved scheme.

## Versions and Verification

Add:

```text
themeVersion
  token schema / theme behavior version
```

Verification gates:

```bash
npm run verify:theme:tokens
npm run test -- src/theme
npm run typecheck
```

`verify:theme:tokens` checks:

1. light / dark token keys are identical.
2. semantic tokens do not leak primitive names into business components.
3. component aliases do not contain raw hex directly.
4. `src/ui` must not add raw hex / rgba outside token files and test fixtures.
5. generated Tailwind / NativeWind / RN theme output matches source tokens.

## Migration Phases

### Phase A: Token foundation

1. Add `src/theme/tokens`.
2. Migrate the current `AppThemePalette` into primitive + semantic + component aliases.
3. Generate a compatibility `AppThemePalette` so UI behavior does not change.
4. Add `createMockTheme()` and remove full handwritten mock themes from tests.

### Phase B: Hardcoded color cleanup

1. Clean up hardcoded colors in `src/ui`.
2. Move overlays / media badges / risk colors into component tokens.
3. Replace `theme.scheme === 'dark' ? ...` branches with semantic tokens.

### Phase C: Tailwind-compatible output

1. Generate `tailwind-theme.generated.ts`.
2. Generate Electron `theme.css`.
3. Introduce NativeWind as an optional pilot for new components or low-risk base components.

### Phase D: Shared components

1. Rebuild Button, Card, Chip, SegmentedControl, Tab, and Badge around tokens.
2. New components may support `className`, but colors still come from tokens.
3. Complex screens keep using the StyleSheet adapter.

### Phase E: Electron reuse

1. Electron renderer uses Tailwind CSS + generated `@theme`.
2. Electron main/preload only passes `resolvedThemeScheme`; they do not own visual theme logic.
3. Desktop and RN share the token source, not concrete StyleSheet files.

## Decision

Current recommendation:

1. Do not fully rewrite existing UI with NativeWind.
2. Build token source of truth and generated outputs first.
3. RN keeps `StyleSheet.create()` through a typed token adapter.
4. Electron uses Tailwind CSS `@theme` + CSS variables.
5. NativeWind is a utility layer for new RN components / low-risk components.
6. Preserve light/dark behavior first, then gradually clean up hardcoded colors.

## Explicit TODO

1. Add `docs/research/theme-token-tailwind-strategy.md` as the theme strategy entrypoint.
2. Add `src/theme/tokens` and generated theme facade.
3. Add `verify:theme:tokens`.
4. Downgrade `AppThemePalette` into a compatibility facade.
5. Clean up hardcoded colors and test mock themes.
6. Pilot NativeWind / Tailwind output without replacing all StyleSheet usage.
