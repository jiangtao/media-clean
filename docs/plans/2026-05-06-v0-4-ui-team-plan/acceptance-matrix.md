# v0.4 Acceptance Matrix

## 硬门槛

| 类别 | 验证 | 说明 |
| --- | --- | --- |
| 静态门禁 | `npm run typecheck -- --pretty false` | 全量类型检查必须通过 |
| 定向单测 | `npm run test -- --run src/ui/screens/__tests__/LandingScreen.test.tsx src/ui/screens/__tests__/PhotoGridScreen.test.tsx src/ui/screens/__tests__/DetailScreen.test.tsx src/ui/screens/__tests__/RecycleBinScreen.test.tsx src/ui/screens/__tests__/SettingsScreen.test.tsx src/i18n/app-copy.test.ts src/theme/app-theme.test.ts src/features/compatibility/__tests__/screen-adaptation.test.ts src/ui/components/FoldableLayout.test.tsx` | 覆盖 v0.4 UI 主路径 |
| Android lane | `npm run verify:android:acceptance` | 主 acceptance lane |
| Android lane | `npm run verify:android:permission-denied` | 权限拒绝路径 |
| Android lane | `npm run verify:android:scan-complete` | 扫描完成路径 |
| Android lane | `npm run verify:android:continue-scan` | 继续扫描路径 |
| Android lane | `npm run verify:android:recycle` | 回收站路径 |
| Android lane | `npm run verify:android:recycle-delete` | 回收站永久删除路径 |
| 次级 smoke | `npm run test:maestro:smoke` | 仅作为 fallback，不替代 agent-device |

## 页面验收

| 页面/态 | 目标 | 关键证据 |
| --- | --- | --- |
| `01` Photos 初始态 | 权限、未扫描、授权后待扫描都由统一入口卡承接 | `PhotoGridScreen` / `app-copy` / `LandingScreen` 定向测试 |
| `02` Photos 扫描态 | 进度、批次范围、恢复提示、foreground service 语义保持正确 | `PhotoGridScreen` 定向测试 + Android lane |
| `03` Photos 结果态 | 顶部摘要、breakdown、继续扫描/已完成文案正确 | `PhotoGridScreen` 定向测试 |
| `04` Photos 工作台态 | 筛选、选中、详情流解耦 | `PhotoGrid` / `DetailScreen` / `PhotoGridScreen` 测试 |
| `05` RecycleBin | 空态、批量操作、SQLite 累计清理报告与 copy 统一 | `RecycleBinScreen` 测试 |
| `06` Settings | 语言/主题/扫描范围/提醒设置文案统一并可切换 | `SettingsScreen` / `app-copy` / `app-theme` 测试 |

## 人工设计对照

1. 每个页面至少对照 `light` / `dark` 两套视觉。
2. 每个页面至少对照 `zh-CN` / `en-US` 两种语言。
3. `Landing`、`Photos`、`RecycleBin`、`Settings` 需要核对信息层级、主 CTA、说明文案是否与 v0.4 叙事一致。
4. `PhotoGrid` 需要核对 `01/02/03/04` 是否仍在单 route 内，不出现额外 route 漏出。

## 特殊屏抽检

| 设备类型 | 页面 | 关注点 | 证据 |
| --- | --- | --- | --- |
| 打孔/刘海屏 | `Photos` | 顶部入口卡与筛选控件不被状态栏遮挡 | 截图或 agent-device artifact |
| 打孔/刘海屏 | `RecycleBin` | 头部标题、清理报告、底部操作栏可见 | 截图或 agent-device artifact |
| 横屏/大屏/折叠态 | `Photos` | Grid、筛选、详情入口不越界，不误触 | 页面级适配测试 + 截图 |
| 横屏/大屏/折叠态 | `Settings` | 分组内容、切换项和底部留白稳定 | 页面级适配测试 + 截图 |

## 当前缺口记录

1. `docs/plans/2026-05-06-v0-4-ui-team-plan/` 已作为 v0.4 文档真值源创建，但页面级适配证据仍需在后续波次补齐。
2. 现有 `screen-adaptation.test.ts` 更偏 detector 规则验证，后续需要追加至少一个页面级适配测试。
3. 真机 lane 若仍失败，不能把 emulator 通过视为 v0.4 设备验收已完成。
