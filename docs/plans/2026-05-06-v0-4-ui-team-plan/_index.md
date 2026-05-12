# app-cleaner v0.4 UI Team Plan

本目录用于把 [docs/goal/v0.4.md](/Users/jt/places/personal/app-cleaner/docs/goal/v0.4.md:1) 和 [docs/goal/v0.4.plan.md](/Users/jt/places/personal/app-cleaner/docs/goal/v0.4.plan.md:1) 收敛成一套可持续执行、可审计、可回归验证的 v0.4 执行真值源。

## Source Of Truth

- 目标真值：`docs/goal/v0.4.md`
- 执行计划真值：`docs/goal/v0.4.plan.md`
- Android-first 约束真值：`design/recognition-scan-android-first/_index.md`

## 规格冻结

1. `01/02/03/04` 全部保留在 `Photos` 单 route 内，以不同子态表达，不新增独立详情 route。
2. `05` 继续是 `RecycleBin` tab，`06` 继续是 `Settings` tab。
3. 通知逻辑保持现有业务语义，不因 UI 重构改变触发条件、恢复语义或提醒协议。
4. v0.4 第一波不引入新的全局状态库；优先把 `PhotoGridScreen` 里的控制面拆成局部边界。
5. 默认以手机单栏为先；大屏、横屏、折叠态以“安全区正确、无遮挡、操作可达”为验收目标。
6. `docs/goal/*` 只读，不在执行过程中修改。

## Design Documents

- [团队分工与波次看板](./team-mode-board.md)
- [BDD 场景规格](./bdd-specs.md)
- [验收矩阵](./acceptance-matrix.md)

## Wave 摘要

1. `Wave 0`：把执行文档落盘，冻结规格与验收口径。
2. `Wave 1`：拆出 `PhotoGrid` 控制面，守住 Android resume/checkpoint/notification 语义。
3. `Wave 2`：统一 `Landing + Photos` 顶部产品叙事与入口卡 copy。
4. `Wave 3`：拆出结果工作台和详情流，降低 `PhotoGridScreen` 耦合度。
5. `Wave 4`：统一 `RecycleBin + Settings + theme + i18n` 的视觉层级和 copy 真值。
6. `Wave 5`：把 safe-area / notch / foldable 能力真正接到目标页，并补设备验证口径。
7. `Wave 6`：集成收口、文案 clarity 终验、静态门禁与设备门禁闭环。

## Done 定义

1. `01/02/03/04/05/06` 六个设计态都有真实 UI 对应实现。
2. `PhotoGridScreen` 不再承担主路径全部编排，控制面、入口卡、工作台、详情流边界清晰。
3. `Landing / RecycleBin / Settings` 使用统一 `theme + i18n` 真值源，中文与英文都可切换。
4. `typecheck + 定向 vitest + android lanes + 特殊屏 spot-check` 具备真实证据，而不是只有计划描述。
5. `runtime error / build error / resume regression / notification regression` 为零容忍项。
