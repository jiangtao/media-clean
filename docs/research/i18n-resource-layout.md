# i18n 资源目录方案

[English Version](./i18n-resource-layout.en.md)

## 背景

v0.5 目标指出当前国际化仍有硬编码和本地语言包规范不足的问题。现有 `src/i18n/app-copy.ts` 把所有中文、英文、格式化函数和业务文案集中在一个文件里，短期可用，但随着 Settings、PhotoGrid、RecycleBin、Landing、reminder、scan 等文案增长，会变成难维护的单体。

社区主流做法更接近 i18next / react-i18next 的 locale + namespace 拆分：每种语言一个目录，每个业务域一个文件。react-i18next 官方也明确支持 multiple translation files / namespaces；i18next 的 fallback 机制支持语言和 namespace fallback。Expo 侧继续通过 `expo-localization` 获取系统 locale。

参考：

1. react-i18next multiple translation files：[Multiple Translation Files](https://react.i18next.com/guides/multiple-translation-files)。
2. i18next fallback 机制：[Fallback](https://www.i18next.com/principles/fallback)。
3. Expo localization 获取系统 locale：[Localization](https://docs.expo.dev/guides/localization/)。

## 目标

1. 一种语言一个目录。
2. 一个业务域一个 namespace 文件。
3. 静态文案、格式化函数、语言偏好解析分离。
4. TypeScript 保持 key 完整性检查。
5. 迁移时保留 `getAppCopy(language)` facade，避免一次性改爆调用方。
6. 默认跟随系统，用户可手动切换。
7. 当前先支持 LTR；未来增加 RTL 时通过 locale metadata 扩展。

## 目标目录

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

说明：

1. `schema.ts` 定义 `AppMessages`、各 namespace 类型和 `AppLocaleMeta`。
2. `resources.ts` 汇总所有 locale 目录，导出 `APP_I18N_RESOURCES`。
3. `formatters.ts` 放日期、数量、容量、时长、confidence / issue type 等格式化函数。
4. `app-copy.ts` 暂时作为兼容层，内部从 `resources.ts` 和 `formatters.ts` 组装旧的 `LocalizedCopy`。
5. 新代码优先使用 namespace resource，不再直接扩大 `app-copy.ts`。

## Namespace 划分

| Namespace | 内容 |
| --- | --- |
| `common` | cancel、close、deleteConfirm、unknownSize、通用状态 |
| `landing` | 首屏、权限入口、产品叙事 |
| `photoGrid` | 扫描入口、进度、筛选、selection、结果摘要 |
| `recycleBin` | 回收站列表、恢复、永久删除确认 |
| `settings` | 语言、主题、提醒、存储、通知设置 |
| `reminders` | 提醒文案、频率、weekday、通知 channel |
| `scan` | 扫描状态、识别维度、错误和 checkpoint 文案 |
| `errors` | 权限、系统错误、恢复失败、外部交互失败 |

## TypeScript 约束

每个 locale 文件应使用 `satisfies` 保持 key 完整：

```ts
import type { PhotoGridMessages } from '../../schema';

export default {
  state: {
    scanReady: '准备扫描',
    scanning: '扫描中',
  },
} satisfies PhotoGridMessages;
```

`en-US` 与 `zh-CN` 必须实现相同 schema。测试需要覆盖：

1. 每个 supported language 都有完整 namespace。
2. 每个 namespace key 在所有语言中一致。
3. `system` preference 能解析到当前系统语言。
4. unsupported locale fallback 到默认语言。
5. 旧 `getAppCopy(language)` facade 输出不回归。

## 迁移策略

1. Wave 1：只新增目录结构、schema、resources、formatters，不改调用方。
2. Wave 2：把 `common`、`settings`、`appearance`、`languageOptions` 从 `app-copy.ts` 迁出。
3. Wave 3：迁出 `photoGrid`、`recycleBin`、`landing`。
4. Wave 4：迁出 reminder、scan、errors，并把格式化函数移入 `formatters.ts`。
5. Wave 5：新增 hardcoded copy scanner，防止 UI screen 继续引入中文 / 英文裸字符串。

## 决策

1. 不继续扩大单文件 `app-copy.ts`。
2. 不在当前阶段强行引入完整 i18next runtime；先采用 i18next 风格的 resource layout 和 TypeScript 类型约束。
3. 保留当前 preference 存储协议，避免影响设置页和已有测试。
4. 后续如果需要异步加载、远程翻译或第三方翻译平台，再评估 i18next / react-i18next runtime。
