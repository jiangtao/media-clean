# P2 多语言、多主题重构执行方案

## 背景

多语言、多主题重构是 P2 架构治理任务。它对 Android UI 长期维护和 Electron renderer 未来复用有价值，但不阻塞 P0 Rust Core / CLI。

本 goal 依据：

1. [i18n 资源目录方案](../i18n-resource-layout.md)
2. [主题 Token 与 Tailwind 复用方案](../theme-token-tailwind-strategy.md)
3. [v0.5 后续目标拆分决策记录](../v0-5-follow-up-goal-split.md)

## 目标

在不改变 main 分支功能的前提下，完成：

1. i18n 一种语言一个目录。
2. 一个业务域一个 namespace 文件。
3. `getAppCopy(language)` 保持 compatibility facade。
4. 主题从 `AppThemePalette` 源头迁到 token-first。
5. 生成 React Native theme、Tailwind / NativeWind output、Electron CSS variables。
6. 清理硬编码 copy、raw color、测试 full mock theme。

## 非目标

1. 不新增产品功能。
2. 不改变扫描 / 清理业务逻辑。
3. 不引入完整 i18next runtime。
4. 不全量改 NativeWind。
5. 不阻塞 P0 Rust Core / CLI。

## 依赖

硬依赖：

1. main 分支当前功能 baseline。
2. 现有 `src/i18n/app-copy.ts` 和 `src/theme/app-theme.ts`。

软依赖：

1. Electron renderer 未来 token / i18n 消费需求。
2. UI tests 和 settings signoff。

不依赖：

1. Rust Core。
2. CLI。
3. Electron main process。

## 目录方案

### i18n

```text
src/i18n/
  index.ts
  locale.ts
  schema.ts
  resources.ts
  formatters.ts
  app-copy.ts
  locales/
    zh-CN/
      common.ts
      landing.ts
      photoGrid.ts
      recycleBin.ts
      settings.ts
      reminders.ts
      scan.ts
      errors.ts
    en-US/
      common.ts
      landing.ts
      photoGrid.ts
      recycleBin.ts
      settings.ts
      reminders.ts
      scan.ts
      errors.ts
```

### Theme

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
  app-theme.ts
  theme-version.ts

scripts/i18n/
  verify-i18n-resources.mjs
  find-hardcoded-copy.mjs

scripts/theme/
  generate-theme-artifacts.mjs
  verify-theme-tokens.mjs
```

## 分阶段执行

### Phase P2.1: baseline freeze

写文件范围：

1. docs / tests only。
2. 不大改 UI。

完成定义：

1. 明确 main 功能 baseline。
2. 记录当前 language / theme behavior。
3. 确认目标测试列表。

建议验证：

```bash
npm run typecheck -- --pretty false
npm run test -- --run src/i18n src/theme
```

### Phase P2.2: i18n namespace scaffold

写文件范围：

1. `src/i18n/schema.ts`
2. `src/i18n/resources.ts`
3. `src/i18n/locales/`
4. `src/i18n/app-copy.ts`
5. `src/i18n/app-copy.test.ts`

迁移策略：

1. 先 scaffold，不改调用方。
2. `app-copy.ts` 继续导出旧 facade。
3. 新 resource 使用 `satisfies` 保证 key 完整。

完成定义：

1. `zh-CN` 和 `en-US` namespace 对齐。
2. `getAppCopy(language)` 输出不回归。
3. unsupported locale fallback 正常。

### Phase P2.3: i18n migration waves

Wave：

1. `common`、`settings`。
2. `landing`、`photoGrid`。
3. `recycleBin`。
4. `reminders`、`scan`、`errors`。
5. hardcoded copy scanner。

完成定义：

1. UI 调用逐步转向 namespace resource 或 facade。
2. 不继续扩大单体 `app-copy.ts`。
3. scanner 能拦截新增裸中文 / 英文 UI copy。

### Phase P2.4: theme token scaffold

写文件范围：

1. `src/theme/tokens/`
2. `src/theme/generated/`
3. `src/theme/adapters/`
4. `scripts/theme/`
5. `src/theme/app-theme.ts`

完成定义：

1. primitives / semantic / component aliases 分层。
2. `AppThemePalette` 变成 compatibility facade。
3. RN theme output 从 token 生成。
4. Electron CSS variables 和 Tailwind `@theme` 可生成。

### Phase P2.5: theme migration waves

Wave：

1. Settings / Landing 基础颜色。
2. PhotoGrid 高频语义色。
3. RecycleBin / Detail / Preview。
4. tests mock theme 收敛到 `createMockTheme()`。
5. raw color scanner。

完成定义：

1. 不新增 raw hex / rgba 业务颜色。
2. `theme.scheme === 'dark' ? ...` 分支逐步替换为 semantic token。
3. 媒体蒙层、白色图标等必要视觉色可保留局部常量，但必须命名解释。

### Phase P2.6: AppPreferences ownership

写文件范围：

1. `src/application/MediaCleanerApp.tsx`
2. `src/application/AppPreferencesContext` 相关文件，如存在。
3. theme / language preference storage tests。

目标：

1. 语言和主题状态由同一 preference owner 解析。
2. `useAppTheme()` 可作为轻量 facade。
3. system theme / language active resume 行为不变。

完成定义：

1. light / dark / system 行为不变。
2. language preference 行为不变。
3. Settings tests 通过。

## 验收命令

最终 P2 关闭前至少需要：

```bash
npm run typecheck -- --pretty false
npm run test -- --run src/i18n src/theme
npm run test -- --run src/ui/screens/__tests__/SettingsScreen.test.tsx
npm run verify:i18n:resources
npm run verify:theme:tokens
```

如涉及主要屏幕样式，还需要：

```bash
npm run verify:android:settings-signoff
```

## 工作包建议

### Work Packet: p2-i18n-scaffold

- Owner: 张龙
- Goal: 建立 locale / namespace / schema 结构。
- Write Scope: `src/i18n/`, `scripts/i18n/`
- Verification: i18n tests + resource verifier。
- Done When: `zh-CN` / `en-US` key 完整，facade 不回归。

### Work Packet: p2-theme-tokens

- Owner: 马汉
- Goal: 建立 token source 和 generated outputs。
- Write Scope: `src/theme/`, `scripts/theme/`
- Verification: theme tests + token verifier。
- Done When: RN / Tailwind / Electron CSS 输出来自同一 token。

### Work Packet: p2-ui-cleanup

- Owner: 赵虎
- Goal: 清理高频 hardcoded copy / raw color。
- Write Scope: selected `src/ui/` files and tests。
- Verification: targeted screen tests。
- Done When: 用户可见行为不变，新增 scanner 通过。

### Work Packet: p2-governance-review

- Owner: 八贤王
- Goal: 验收功能等价和治理边界。
- Write Scope: docs / tests only if gaps found。
- Verification: typecheck + i18n/theme tests + settings signoff。
- Done When: P2 不影响 P0，不改变产品功能。
