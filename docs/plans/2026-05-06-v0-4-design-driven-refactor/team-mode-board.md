# Team Mode 工作板

## 角色映射

| 角色 | 承担者 | 职责 |
| --- | --- | --- |
| 包拯 | 主线程 | 总控、裁决、冻结或放行波次 |
| 公孙策 | 架构裁决 | 设计图、目标、交互标准与实现真值之间的冲突裁决 |
| 展昭 | 主路径实现 | 高风险控制器拆分与跨模块集成 |
| 张龙 | 页面执行 | Landing / 顶部状态区 / 产品壳 |
| 赵虎 | 页面执行 | Photos 结果工作台 / 详情流 / 批量筛选 |
| 王朝 | 页面执行 | RecycleBin / Settings / theme+i18n 收口 |
| 马汉 | 验证与适配 | 适配接线、设备 lane、设计图签收 |
| 八贤王 | 终验 | 拒绝无证据完成，维护未收口风险 |

## 工作包

### Work Packet: wp0-plan-freeze
- Owner: 包拯 / 公孙策
- Goal: 落盘执行计划，并冻结设计真值源与逐屏差异矩阵
- Write Scope:
  - `docs/plans/2026-05-06-v0-4-design-driven-refactor/_index.md`
  - `docs/plans/2026-05-06-v0-4-design-driven-refactor/team-mode-board.md`
  - `docs/plans/2026-05-06-v0-4-design-driven-refactor/bdd-specs.md`
  - `docs/plans/2026-05-06-v0-4-design-driven-refactor/acceptance-matrix.md`
  - `docs/plans/2026-05-06-v0-4-design-driven-refactor/design-diff-matrix.md`
- Read Context:
  - `docs/goal/v0.4.md`
  - `docs/standards/agent-team-mode.md`
  - `docs/standards/execution-standards.md`
  - `docs/standards/interaction-standards.md`
  - `../cleaner-app/preview-frames/final-screens/light`
  - `../cleaner-app/preview-frames/final-screens/dark`
- Verification:
  - 文档互链完整
  - 设计真值源地址完整
  - 每个工作包有 owner、写范围、验证命令、完成定义
- Done When:
  - 后续执行者无需再猜“按哪张图做”
- Blockers:
  - 无

### Work Packet: wp1-shell-foundation
- Owner: 王朝
- Goal: 统一主题 token、通用组件层级、RN 适配 token、文案真值和底栏视觉语言
- Write Scope:
  - `src/theme/app-theme.ts`
  - `src/i18n/app-copy.ts`
  - `src/ui/components/TabBar.tsx`
  - `src/ui/components/ActionSwitch.tsx`
  - `src/ui/components/SegmentedControl.tsx`
  - `src/ui/screens/screen-layout.ts`
  - `docs/plans/2026-05-06-v0-4-design-driven-refactor/rn-adaptation-strategy.md`
- Read Context:
  - `light/` 与 `dark/` 全部页面
  - `docs/plans/2026-05-06-v0-4-design-driven-refactor/rn-adaptation-strategy.md`
  - `src/application/AppPreferencesContext.tsx`
  - `src/navigation/MainTabNavigator.tsx`
- Verification:
  - `npm run test -- --run src/theme/app-theme.test.ts src/i18n/app-copy.test.ts src/navigation/__tests__/TabBar.test.tsx src/ui/components/__tests__/ActionSwitch.test.tsx src/ui/components/__tests__/SegmentedControl.test.tsx`
  - `npm run typecheck -- --pretty false`
- Done When:
  - 后续页面实现不再各自定义一套视觉语言、copy 结构和 SE 到 RN 的适配口径
- Blockers:
  - 设计稿与现有主题 token 映射冲突需公孙策裁决

### Work Packet: wp2-photo-controller
- Owner: 展昭
- Goal: 抽离 Photos 运行时控制器，保住 Android scan/resume/checkpoint 语义
- Write Scope:
  - `src/ui/screens/photo-grid/usePhotoGridSessionController.ts`
  - `src/ui/screens/PhotoGridScreen.tsx`
  - 必要时 `src/features/scan/**`
  - 必要时 `src/services/storage/**`
- Read Context:
  - `src/ui/screens/PhotoGridScreen.tsx`
  - `src/features/scan/**`
  - `src/services/storage/**`
  - `src/ui/screens/__tests__/PhotoGridScreen.test.tsx`
  - 设计态 `02/03/04`
- Verification:
  - `npm run typecheck -- --pretty false`
  - `npm run test -- --run src/ui/screens/__tests__/PhotoGridScreen.test.tsx`
- Done When:
  - `PhotoGridScreen` 降级为容器层
  - 扫描编排、native attach、resume 路径仍通过现有护栏
- Blockers:
  - 任何 resume/checkpoint 回归都必须先修复，不得继续推进 UI polish

### Work Packet: wp3-photos-experience
- Owner: 张龙 / 赵虎
- Goal: 按 SE 设计稿重构 `01-04` Photos 整体体验，并通过 RN 适配机制映射到其他机型
- Write Scope:
  - `src/ui/screens/photo-grid/PhotoGridEntryCard.tsx`
  - `src/ui/screens/photo-grid/PhotoGridWorkspace.tsx`
  - `src/ui/screens/photo-grid/PhotoGridDetailFlow.tsx`
  - `src/ui/components/PhotoGrid.tsx`
  - 必要时 `src/ui/screens/DetailScreen.tsx`
  - 必要时 `src/ui/components/ScanProgress.tsx`
- Read Context:
  - 设计态 `01/02/03/04`
  - `docs/plans/2026-05-06-v0-4-design-driven-refactor/rn-adaptation-strategy.md`
  - `src/ui/screens/PhotoGridScreen.tsx`
  - `src/ui/components/**`
  - `src/ui/screens/__tests__/PhotoGridScreen.test.tsx`
  - `src/ui/screens/__tests__/DetailScreen.test.tsx`
- Verification:
  - `npm run test -- --run src/ui/screens/__tests__/PhotoGridScreen.test.tsx src/ui/screens/__tests__/DetailScreen.test.tsx src/ui/components/__tests__/PhotoGrid.test.tsx src/ui/components/__tests__/PhotoGridItem-selection.test.tsx src/ui/components/__tests__/ScanProgress.test.tsx`
  - `npm run typecheck -- --pretty false`
- Done When:
  - `01` 授权/准备扫描态、`02` 扫描态、`03` 结果摘要态、`04` 批量筛选态都可在同一 Photos route 内清晰切换
  - SE 签收贴近设计稿，非 SE 设备通过宽度、安全区和网格列数规则正常适配
- Blockers:
  - 若设计态与恢复语义冲突，先交给公孙策裁决

### Work Packet: wp4-recycle-experience
- Owner: 王朝
- Goal: 按 SE 设计稿重构 `05` RecycleBin，并通过 RN 适配规则保持其他机型可用
- Write Scope:
  - `src/ui/screens/RecycleBinScreen.tsx`
  - 必要时 `src/i18n/app-copy.ts`
  - 必要时 `src/theme/app-theme.ts`
- Read Context:
  - 设计态 `05`
  - `docs/plans/2026-05-06-v0-4-design-driven-refactor/rn-adaptation-strategy.md`
  - `src/ui/screens/__tests__/RecycleBinScreen.test.tsx`
- Verification:
  - `npm run test -- --run src/ui/screens/__tests__/RecycleBinScreen.test.tsx src/application/AppPreferencesContext.test.tsx`
  - `npm run typecheck -- --pretty false`
- Done When:
  - 回收站不再保留明显旧版 IA 痕迹，且 SE / 非 SE 下选择、清理、恢复工作台证据完整
- Blockers:
  - 设计稿若要求新功能而当前目标未覆盖，需 Lead 决定是否纳入

### Work Packet: wp4b-settings-experience
- Owner: 王朝 / 马汉
- Goal: 按 SE 设计稿恢复 `06` Settings 设计还原，并保留语言、主题、提醒、扫描范围、缓存清理等既有偏好语义
- Write Scope:
  - `src/ui/screens/SettingsScreen.tsx`
  - `src/ui/screens/__tests__/SettingsScreen.test.tsx`
  - `src/i18n/app-copy.ts`
  - `scripts/android/run-agent-device-observability.sh`
  - `package.json`
- Read Context:
  - 设计态 `06`
  - `docs/plans/2026-05-06-v0-4-design-driven-refactor/rn-adaptation-strategy.md`
  - `src/application/AppPreferencesContext.tsx`
  - `src/features/reminders/**`
  - `src/services/storage/scan-range-storage.ts`
- Verification:
  - `npm run test -- --run src/ui/screens/__tests__/SettingsScreen.test.tsx`
  - `npm run typecheck -- --pretty false`
  - `npm run verify:android:settings-signoff`
- Done When:
  - 设置页呈现与 SE 稿一致的分组结构，并在非 SE 设备上保持最大宽度、分组关系和可扫读性
- Blockers:
  - 如果设计稿压缩了既有业务语义，必须优先保留运行时正确性并在签收文档记录偏差

### Work Packet: wp5-app-shell
- Owner: 张龙
- Goal: 收口 Landing、Root/MainTab 导航壳与进入主流程的第一印象；`Splash` 保持既有行为
- Write Scope:
  - `src/ui/screens/LandingScreen.tsx`
  - `src/navigation/RootNavigator.tsx`
  - `src/navigation/MainTabNavigator.tsx`
  - 必要时启动壳相关资源接线
- Read Context:
  - 设计态 `01`
  - `src/navigation/__tests__/RootNavigator.test.tsx`
  - `src/navigation/__tests__/MainTabNavigator.test.tsx`
- Verification:
  - `npm run test -- --run src/ui/screens/__tests__/LandingScreen.test.tsx src/navigation/__tests__/RootNavigator.test.tsx src/navigation/__tests__/MainTabNavigator.test.tsx`
  - `npm run typecheck -- --pretty false`
- Done When:
  - 从 Landing 到进入主流程的体验连续，不再显著割裂；`Splash` 不新增本轮改造任务
- Blockers:
  - 首次路由判断若影响进入主流程语义，需要单独记录偏差

### Work Packet: wp6-adaptation-validation
- Owner: 马汉
- Goal: 把 SE 到 RN 的适配能力接入真实页面，并建立设备验收与设计签收矩阵
- Write Scope:
  - `src/features/compatibility/**`
  - `src/ui/components/FoldableLayout.tsx`
  - `docs/plans/2026-05-06-v0-4-design-driven-refactor/acceptance-matrix.md`
- Read Context:
  - 设计态 `01-06`
  - `docs/plans/2026-05-06-v0-4-design-driven-refactor/rn-adaptation-strategy.md`
  - `docs/release/agent-device.md`
  - `docs/release/device-validation-lanes.md`
  - `docs/release/maestro.md`
- Verification:
  - 开发期默认：
    - `npm run start`
    - `npm run android`
  - `npm run test -- --run src/features/compatibility/__tests__/screen-adaptation.test.ts src/ui/components/FoldableLayout.test.tsx`
  - `npm run verify:android:acceptance`
  - `npm run verify:android:scan-complete`
  - `npm run verify:android:continue-scan`
  - `npm run verify:android:recycle`
  - `npm run verify:android:settings-signoff`
  - `npm run verify:android:recycle-delete`
  - `npm run test:maestro:smoke`
- Done When:
  - 有可重复执行的静态 + 设备 + 人工签收闭环
- Blockers:
  - 设备环境问题要与代码回归问题分开记录
  - 开发期不得把“尚未打 APK”误判为功能未完成；只有进入设备链路验证阶段才要求 APK / verify lane

### Work Packet: wp7-clarify-signoff
- Owner: 八贤王
- Goal: 在功能和设计签收通过后，对文案与信息架构做 `clarify` 终验
- Write Scope:
  - 仅允许回流到 `src/i18n/app-copy.ts`
  - 必要时轻微调整页面内文案承载位置
- Read Context:
  - `.impeccable.md`
  - `src/i18n/app-copy.ts`
  - 设计态 `01-06`
  - `docs/standards/interaction-standards.md`
- Verification:
  - 人工 clarity checklist
  - 必要时补文案断言测试
- Done When:
  - 扫描说明、结果说明、回收站空态、Settings 设置项与高风险动作说明都达到“看得清、判得准、删得安心”
- Blockers:
  - 若发现文案问题由结构问题引起，必须回退相应工作包，不得只改字面文案掩盖

## 汇报格式

每个子成员汇报必须包含：

1. 改动范围
2. 验证证据
3. 未收口风险
4. 建议下一步

无验证证据者，不得宣称完成。
