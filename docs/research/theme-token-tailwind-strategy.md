# 主题 Token 与 Tailwind 复用方案

[English Version](./theme-token-tailwind-strategy.en.md)

## 背景

当前主题代码已经能支持 light / dark / system，但结构开始变乱：

1. `src/theme/app-theme.ts` 是一个扁平 `AppThemePalette`，混合了全局语义、组件语义和具体页面语义。
2. 多处组件仍有硬编码颜色，例如 `#2f80ff`、`#ffffff`、`rgba(...)`、`theme.scheme === 'dark' ? ... : ...`。
3. `MediaCleanerApp` 和 `AppPreferencesContext` 都有主题解析逻辑，历史入口还没有完全收敛。
4. 测试里手写完整 mock theme，导致 token 增减时测试维护成本高。
5. 只有颜色 token，缺少 spacing、radius、typography、shadow、opacity、motion 等系统 token。
6. 未来 Electron First 后，桌面端也需要复用同一套主题，而不是再写一套 CSS theme。

社区方向上，Tailwind v4 已把 theme variables 作为设计 token 与 utility class 的来源；NativeWind 支持 Tailwind CLI 的主题能力，并建议通过 CSS variables / `vars()` 做动态主题。React Native 官方仍建议用 `StyleSheet.create()` 获得 native style 的类型检查和更清晰的样式组织。因此本项目不应全量抛弃 StyleSheet，而应做 **token-first + Tailwind-compatible output**。

参考资料：

1. Tailwind theme variables: [Tailwind CSS Theme Variables](https://tailwindcss.com/docs/theme)。
2. NativeWind theme guide: [NativeWind Themes](https://www.nativewind.dev/docs/guides/themes)。
3. NativeWind v5 dark mode: [NativeWind Dark Mode](https://www.nativewind.dev/v5/core-concepts/dark-mode)。
4. React Native StyleSheet: [React Native StyleSheet](https://reactnative.dev/docs/stylesheet)。

## 决策

采用 **Token-first + Tailwind-compatible + NativeWind optional**：

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

核心原则：

1. `tokens` 是唯一主题来源。
2. `AppThemePalette` 只是兼容层，不再作为设计源头。
3. Tailwind / NativeWind 是输出层，不是主题数据源头。
4. RN 现有复杂组件继续用 `StyleSheet.create()`，逐步从 token 取值。
5. 新组件可以使用 NativeWind `className`，但颜色必须来自 token / CSS variables。
6. Electron 使用同一份 token 生成 Tailwind CSS `@theme` 和 CSS variables。

## 分层设计

推荐目录：

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

最底层 token，不直接在业务组件中使用：

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

命名尽量贴近 Tailwind namespace，便于生成：

```text
--color-*
--spacing-*
--radius-*
--shadow-*
--text-*
--font-weight-*
```

### Semantic tokens

业务组件优先使用这一层：

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

只有当语义 token 不能表达特定组件意图时才增加：

```ts
component.photoGrid.selectionBadge.background
component.scanProgress.activeFill
component.tabBar.activeIndicator
component.hero.orbTop
component.preview.backdrop
```

规则：组件 alias 必须指向 primitive 或 semantic token，不能直接写 raw hex。

## Tailwind / NativeWind 复用方式

### Tailwind CSS / Electron

Electron 端生成 CSS：

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

Electron UI 可以使用：

```html
<main class="bg-bg-canvas text-text-primary">
```

### NativeWind / RN

NativeWind 可用于新组件和简单样式：

```tsx
<View className="bg-bg-canvas px-screen-x">
  <Text className="text-text-primary text-body">...</Text>
</View>
```

动态主题通过 generated vars 注入：

```tsx
<View style={nativeWindThemeVars[resolvedThemeScheme]}>
  {children}
</View>
```

但当前阶段不建议全量迁移到 NativeWind，原因：

1. 现有 RN 组件大量依赖 `StyleSheet.create(theme)`、动态尺寸、safe area、foldable / compact 逻辑。
2. NativeWind 引入 Babel / Metro / className 规则后，短期风险大于收益。
3. 复杂组件如 `PhotoGrid`、`ScanProgress`、`PhotoGridEntryCard` 更适合继续保留 typed StyleSheet。

## React Native 使用规则

保留 `StyleSheet.create()`，但样式取值必须从 token adapter 来：

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

禁止新增：

```ts
backgroundColor: '#2f80ff'
color: theme.scheme === 'dark' ? '#fff' : '#000'
```

允许例外：

1. 图片 / 视频遮罩，如 `rgba(0,0,0,0.74)`，但必须迁到 `overlay` token。
2. 第三方图标默认色，但应通过 wrapper token 收敛。
3. 测试 fixture 中的 mock color，但应改用 `createMockTheme()`。

## 当前代码迁移映射

现有 `AppThemePalette` 可先映射到新 token：

| 当前字段 | 新 token |
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

## 主题状态管理

保留当前 preference 模型：

```text
themePreference: system | light | dark
resolvedThemeScheme: light | dark
```

但主题 Provider 应统一到 `AppPreferencesContext`：

1. `MediaCleanerApp` 不再自己读取 `useColorScheme()` 和 storage。
2. 顶层只保留一个 `AppPreferencesProvider`。
3. `useAppTheme()` 可作为 `useAppPreferences().theme` 的轻量 facade。
4. NativeWind vars / Electron CSS data-theme 都由同一个 resolved scheme 驱动。

## 版本与验证

新增：

```text
themeVersion
  token schema / theme behavior version
```

验证门禁：

```bash
npm run verify:theme:tokens
npm run test -- src/theme
npm run typecheck
```

`verify:theme:tokens` 检查：

1. light / dark token key 完全一致。
2. semantic token 不直接漏 primitive 命名到业务组件。
3. component alias 不直接写 raw hex。
4. `src/ui` 中除 token 文件和测试 fixture 外，不允许新增 raw hex / rgba。
5. generated Tailwind / NativeWind / RN theme output 与 source token 一致。

## 迁移阶段

### Phase A: Token foundation

1. 新增 `src/theme/tokens`。
2. 从当前 `AppThemePalette` 迁移成 primitive + semantic + component aliases。
3. 生成兼容版 `AppThemePalette`，保持 UI 行为不变。
4. 新增 `createMockTheme()`，清理测试手写完整 theme。

### Phase B: Hardcoded color cleanup

1. 清理 `src/ui` 中硬编码颜色。
2. 将 overlays / media badges / risk colors 收敛到 component tokens。
3. 对 `theme.scheme === 'dark' ? ...` 增加 semantic token。

### Phase C: Tailwind-compatible output

1. 生成 `tailwind-theme.generated.ts`。
2. 生成 Electron `theme.css`。
3. 引入 NativeWind 作为可选试点，只用于新组件或低风险基础组件。

### Phase D: Shared components

1. 按 token 重建 Button、Card、Chip、SegmentedControl、Tab、Badge。
2. 新组件可支持 `className`，但颜色仍来自 token。
3. 复杂屏幕继续使用 StyleSheet adapter。

### Phase E: Electron reuse

1. Electron renderer 使用 Tailwind CSS + generated `@theme`。
2. Electron main/preload 不处理视觉主题，只传 `resolvedThemeScheme`。
3. 桌面端与 RN 共用 token source，不共用具体 StyleSheet。

## 决策

当前推荐：

1. 不直接全量引入 NativeWind 重写现有 UI。
2. 先做 token source of truth 和 generated outputs。
3. RN 继续使用 `StyleSheet.create()`，通过 typed token adapter 取值。
4. Electron 使用 Tailwind CSS `@theme` + CSS variables。
5. NativeWind 作为 RN 新组件 / 低风险组件的 utility layer。
6. 主题迁移必须先保证 light/dark 行为不变，再逐步清理硬编码颜色。

## 明确 TODO

1. 新增 `docs/research/theme-token-tailwind-strategy.md` 作为主题方案入口。
2. 新增 `src/theme/tokens` 和 generated theme facade。
3. 新增 `verify:theme:tokens`。
4. 将 `AppThemePalette` 降级为兼容 facade。
5. 清理硬编码颜色和测试 mock theme。
6. 试点 NativeWind / Tailwind output，但不全量替换 StyleSheet。
