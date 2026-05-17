# app-cleaner v0.4 设计稿驱动重构执行计划

## 目标

本计划用于执行 [docs/goal/v0.4.md](/Users/jt/places/personal/app-cleaner/docs/goal/v0.4.md) 所定义的 UI 重构与体验一致性目标。

本轮不是局部页面美化，也不是只拆 `PhotoGridScreen`。本轮目标是：

1. 按设计稿重构整体产品功能流与用户体验。
2. 统一 `Landing -> Photos -> RecycleBin -> Settings` 当前主流程的视觉层级、文案层级、主题映射与交互节奏。
3. 保留 Android-first 的扫描恢复、通知和持久化语义，不以“还原视觉”为理由破坏运行时正确性。
4. 当前最高优先级先聚焦 `Photos(01-04)` 与 `RecycleBin(05)` 的交互闭环；`Splash` 沿用既有启动体验，不再作为本轮主改造项。
5. `Settings(06)` 设计稿已稳定，当前恢复为本轮后续收口面；完成运行态证据、护栏和签收前仍是未完成项。

## 设计真值源

本轮视觉真值源固定为以下两个目录：

1. 浅色主真值目录：
   [light](/Users/jt/places/personal/cleaner-app/preview-frames/final-screens/light)
2. 深色映射真值目录：
   [dark](/Users/jt/places/personal/cleaner-app/preview-frames/final-screens/dark)

执行口径：

1. `light/` 负责结构、信息架构、层级、组件编排、间距、主叙事。
2. `dark/` 负责同页暗色主题映射，不允许实现完浅色后再临时猜暗色。
3. 总览板 [media-clean-light-simple-flow-boss-v5-tightened.png](/Users/jt/places/personal/app-cleaner/design/assets/media-clean-light-simple-flow-boss-v5-tightened.png) 只作为流程总览辅助，不是逐屏裁决主依据。
4. 逐屏稿是 SE 尺寸参考稿，实测导出图约 `941 x 1672 px`，其纵横比对应 iPhone SE 级别窄屏画布；实现时以 SE 逻辑布局为基准，而不是按图片像素硬编码 RN 尺寸。

## RN 适配策略

本轮执行必须把“还原设计稿”和“适配真实 RN 设备”同时处理：

1. SE 稿是基准画布：在窄屏手机上，页面结构、信息密度、折叠关系、底部操作区应优先贴近 SE 稿。
2. RN 实现使用逻辑尺寸和响应式规则：不得把设计稿导出像素直接写成固定宽高。
3. 页面布局必须通过 `useWindowDimensions`、`useSafeAreaInsets`、现有 `screen-layout.ts` 与 `features/compatibility` 能力适配不同设备。
4. 大屏、横屏、折叠屏不是简单放大 SE 稿；应保持内容宽度、媒体网格列数、底部操作区和设置分组的可读性。
5. Photos、RecycleBin、Settings 是本轮适配重点，因为当前实现与 SE 稿差异最大，且这三页承载主要操作。
6. 任何页面还原时都必须记录“SE 签收”和“非 SE 响应式签收”两个结果，避免只在一种设备上看起来正确。

### 逐屏绑定

| 设计态 | Light | Dark | 当前归属 |
| --- | --- | --- | --- |
| 00 Splash | `media-clean-se-00-splash-light.png` | `media-clean-se-00-splash-dark.png` | App 壳 / 启动体验 |
| 01 Landing / 授权入口 | `media-clean-se-01-landing-light.png` | `media-clean-se-01-landing-dark.png` | Landing + Photos 进入前叙事 |
| 02 Scanning / 扫描中 | `media-clean-se-02-scanning-light.png` | `media-clean-se-02-scanning-dark.png` | Photos 子态 |
| 03 Result / 结果摘要 | `media-clean-se-03-result-light.png` | `media-clean-se-03-result-dark.png` | Photos 子态 |
| 04 Filtering / 批量筛选 | `media-clean-se-04-filtering-light.png` | `media-clean-se-04-filtering-dark.png` | Photos 子态 |
| 05 Recycle / 确认清理 | `media-clean-se-05-recycle-light.png` | `media-clean-se-05-recycle-dark.png` | RecycleBin tab |
| 06 Settings / 设置 | `media-clean-se-06-settings-light.png` | `media-clean-se-06-settings-dark.png` | Settings tab（设计稿已稳定，待运行态证据与签收） |

## 范围冻结

### 本轮要做

1. 按设计稿重构整体产品体验。
2. 重构 `Photos` 页面内 `01-04` 的整体结构、结果呈现、筛选方式、详情流、批量操作体验。
3. 重构 `RecycleBin` 的信息架构与层级，并与 `Settings(06)` 定稿后的分组、设置项和底栏语言保持一致。
4. 统一主题 token、文案真值、按钮层级、底栏语言和页面节奏。
5. 补齐设计图人工签收、设备验证和 `clarify` 文案终验。

### 本轮不做

1. 不改 `docs/goal/v0.4.md`。
2. 不把扫描算法重写成 Rust。
3. 不引入云端依赖或 Firebase 主链路。
4. 第一波不引入新的 RN 全局状态管理库。
5. 不把 `04` 单独拆成新导航 route。
6. `Splash` 沿用现有启动壳，不单独作为本轮体验重构页面推进。
7. 不在缺少 `Settings(06)` 运行态证据和设计签收前宣称 06 完成。

## 核心架构决策

1. `Photos` 继续保留为单 route，但内部重构为 `01/02/03/04` 四个设计态。
2. `RecycleBin` 继续是独立 tab，对应设计态 `05`。
3. `Settings` 继续是独立 tab，对应设计态 `06`；设计稿已稳定，恢复为本轮后续 UI 还原与签收对象，同时必须保留既有语言、主题、提醒等偏好语义。
4. [`src/ui/screens/PhotoGridScreen.tsx`](/Users/jt/places/personal/app-cleaner/src/ui/screens/PhotoGridScreen.tsx) 必须降级为容器层，不再同时承担扫描编排、工作台、详情流和批量操作。
5. SQLite、native scan snapshot、checkpoint 仍是真值；JS UI 状态只负责承载工作台和体验层。
6. 开发期默认使用 Expo / React Native dev mode 做 UI 重构联调与 smoke，不把打 APK 作为每一轮开发迭代前置条件。
7. APK 或 Android verify lane 只在里程碑验证、设备链路验证和最终放行时启用，不作为日常 UI 调整的默认成本。

## 开发模式口径

开发阶段默认工作方式：

1. 使用 `npm run start` 启动 Expo dev server。
2. 使用 `npm run android` 进入 RN / Expo 开发联调。
3. 页面结构、交互、文案、主题调整优先在 dev mode 下完成。
4. 只有当改动触及 Android 扫描恢复、通知、权限、回收站删除链路或最终验收时，才进入 APK / agent-device 级别验证。

## 执行元数据

- 执行模式：Agent Team
- Lead：包拯
- 架构裁决：公孙策
- 主路径实现：展昭
- 页面重构执行：张龙、赵虎、王朝、马汉
- 终验：八贤王

## 文档入口

1. [Team Mode 工作板](./team-mode-board.md)
2. [BDD 场景规格](./bdd-specs.md)
3. [验收矩阵](./acceptance-matrix.md)
4. [设计差异矩阵](./design-diff-matrix.md)
5. [完成状态清单](./completion-status.md)
6. [设计签收记录](./design-signoff.md)
7. [文案 Clarify 终验](./clarify-review.md)
8. [特殊屏抽检记录](./special-screen-spot-check.md)
9. [RN 适配策略](./rn-adaptation-strategy.md)
10. [Completion Audit](./completion-audit.md)

## 执行顺序

1. 先完成设计差异冻结与计划落盘。
2. 先打一致性基础层，再拆 `Photos` 控制边界。
3. 在 Expo dev mode 下按设计稿重构 `01-04` 的整体体验。
4. 在 Expo dev mode 下优先收口 `05 RecycleBin` 与必要的入口连贯性；随后恢复 `06 Settings` 的设计还原、偏好回归和签收证据。
5. 最后再做设备验收、设计图签收和 `clarify` 终验。

## 依赖链

1. `WP0 计划落盘` -> 所有后续工作包。
2. `WP1 一致性基础层` -> `WP3 Photos 体验重构`、`WP4 RecycleBin 交互重构`、`WP5 App 壳一致性`。
3. `WP2 Photos 控制器拆分` -> `WP3 Photos 体验重构`。
4. `WP3/WP4/WP5` -> `WP6 适配与验证接线`。
5. `WP6` -> `WP7 八贤王终验`。

## 工作包总览

1. `WP0` 计划落盘与设计差异矩阵
2. `WP1` App Shell 与一致性基础层
3. `WP2` Photos 控制面与运行时边界重构
4. `WP3` `01-04` Photos 整体体验重构
5. `WP4` `05` RecycleBin 交互重构；`WP4b` `06` Settings 设计恢复、偏好回归与签收
6. `WP5` Landing、导航壳一致性
7. `WP6` 适配、设备验证、设计签收
8. `WP7` `clarify` 文案终验与收口

## BDD 覆盖

BDD 规格见 [bdd-specs.md](./bdd-specs.md)。

本轮至少覆盖以下类型：

1. 当前活动范围以设计态 `01-06` 的逐屏体验场景为主；`00 Splash` 只保留旧版基线约束。
2. 扫描恢复、通知行为、回收站动作和既有设置偏好不回归。
3. 浅色/深色、中文/英文、异形屏/横屏的体验一致性。

## 完成定义

本波次只有在以下条件同时满足时才算完成：

1. 当前活动范围设计稿已逐屏签收；`00 Splash` 保持旧版基线，`06 Settings` 完成运行态签收前本波次不算全部完成。
2. 静态门禁通过。
3. Android 设备验证通过。
4. 没有已知 runtime/build error。
5. `clarify` 文案终验通过。
6. 当前波次无阻断性 TODO 残留。

Plan complete. Continue with superpowers:executing-plans to execute the plan to verified completion.
