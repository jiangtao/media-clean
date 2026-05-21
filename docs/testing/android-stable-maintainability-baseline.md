# Android 稳定后可维护性升级基线

## 背景

本基线服务于 `docs/plans/2026-05-17-android-stable-maintainability-plan` 的 Task 001。后续 RNR / Tailwind / tokens / i18n / skeleton 重构必须先证明这些行为没有被意外改变。

## 当前基线

1. `getAppTheme('light')` 和 `getAppTheme('dark')` 暴露的 `AppThemePalette` 字段全集必须保持兼容。
2. 主题关键值保持当前 Android 稳定态：safe area、page text、card、button、chip、tab、thumbnail、preview 颜色不得在 token 迁移中漂移。
3. `getAppCopy(language)` 暴露的旧 facade 必须保持兼容，尤其是 Landing、Settings、PhotoGrid、RecycleBin 的当前 zh-CN / en-US 文案。
4. 动态 copy 函数在迁移为 JSON template 前必须保持当前输出语义。
5. Root navigation 在 workspace entry 解析中仍显示当前 themed loading fallback。
6. Landing、Settings、PhotoGrid、RecycleBin、Detail 的现有 screen tests 是后续 UI 和 skeleton 迁移的最低回归门禁。

## 基线命令

```bash
npm run test -- --run src/theme/app-theme.test.ts src/i18n/app-copy.test.ts src/ui/screens/__tests__/LandingScreen.test.tsx src/ui/screens/__tests__/SettingsScreen.test.tsx src/ui/screens/__tests__/PhotoGridScreen.test.tsx src/ui/screens/__tests__/RecycleBinScreen.test.tsx src/ui/screens/__tests__/DetailScreen.test.tsx
npm run typecheck -- --pretty false
```

## 当前证据

2026-05-17 在 `refactor/ui` 上完成基线目标测试：

```text
Test Files  7 passed (7)
Tests       149 passed (149)
```

随后补充 theme / i18n facade baseline 断言，后续任务必须复跑上述命令。

## 不可碰边界

1. Task 001 不引入新依赖。
2. Task 001 不改变 UI 视觉、不改变 navigation、不改变 storage 和 scan 数据流。
3. PhotoGrid / RecycleBin / Detail 在高风险 wave 前只允许增加测试或基线说明。
