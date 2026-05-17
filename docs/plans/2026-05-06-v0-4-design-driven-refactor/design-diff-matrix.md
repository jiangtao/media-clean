# 设计差异矩阵

## 使用说明

本表记录“当前实现 vs 设计稿真值源”的主要差异，并把差异映射到执行工作包。

## 差异矩阵

| 页面/态 | 设计真值 | 当前实现概况 | 主要差异 | 对应工作包 |
| --- | --- | --- | --- | --- |
| 00 Splash | `light/dark` 中 `00 splash` | 用户已明确要求本轮沿用既有启动体验 | 当前不再把 `Splash` 作为主改造项，也不把它视为当前阻塞 | 暂缓 |
| 01 Landing | `01 landing` | 当前 [LandingScreen.tsx](/Users/jt/places/personal/app-cleaner/src/ui/screens/LandingScreen.tsx) 已收口入口叙事，RN 原生截图已补 | 非阻断；`Splash` 不纳入本轮 | `WP5`、`WP6` |
| 02 Scanning | `02 scanning` | 扫描态已收敛到 `photo-grid` 子组件和 [screen-layout.ts](/Users/jt/places/personal/app-cleaner/src/ui/screens/screen-layout.ts) 的适配规则 | 原生运行态已补，见 [20260507-022318](/Users/jt/places/personal/app-cleaner/artifacts/agent-device/20260507-022318/steps/06-scan-started/screen.png) | `WP3`、`WP6` |
| 03 Result | `03 result` | 结果摘要、分类 breakdown 与继续扫描动作已由 `PhotoGridEntryCard` 承载 | 原生结果态已补，见 [20260507-025058](/Users/jt/places/personal/app-cleaner/artifacts/agent-device/20260507-025058/steps/07-scan-exhausted/screen.png) | `WP3`、`WP6` |
| 04 Filtering | `04 filtering` | [PhotoGrid.tsx](/Users/jt/places/personal/app-cleaner/src/ui/components/PhotoGrid.tsx) 已改为窗口尺寸驱动，支持响应式列数、尺寸和 padding | 原生选择态已补，见物理真机 [20260507-024507](/Users/jt/places/personal/app-cleaner/artifacts/agent-device/20260507-024507/steps/08-filtering-selection-mode/screen.png) | `WP3`、`WP6` |
| 05 Recycle | `05 recycle` | [RecycleBinScreen.tsx](/Users/jt/places/personal/app-cleaner/src/ui/screens/RecycleBinScreen.tsx) 已接入媒体网格和底部操作布局 | 原生选择态已补，见物理真机 [20260507-024802](/Users/jt/places/personal/app-cleaner/artifacts/agent-device/20260507-024802/steps/05-recycle-selection-mode/screen.png) | `WP4`、`WP6` |
| 06 Settings | `06 settings` | [SettingsScreen.tsx](/Users/jt/places/personal/app-cleaner/src/ui/screens/SettingsScreen.tsx) 已接入最大内容宽度、卡片间距和 chip 尺寸规则 | 原生截图、语言/主题 smoke 与真机签收已补，见 [20260507-024910](/Users/jt/places/personal/app-cleaner/artifacts/agent-device/20260507-024910/steps/08-settings-cache/screen.png) | `WP4b`、`WP6`、`WP7` |
| 全局主题 | `light` 与 `dark` 全部 | 主题 token 已从旧暖色系切到设计稿导向的浅色冷白蓝、深色蓝黑体系 | 浅/深运行态已补，见 `design-signoff.md` 物理真机签收 | `WP1`、`WP6` |
| 全局文案 | `01-06` 全部 | 当前 `app-copy` 完整度高，但 Landing 和部分 Recycle 文案仍散落本地 | 文案来源不够统一，不利于整体体验一致性 | `WP1`、`WP4`、`WP7` |
| 全局适配 | `01-06` 全部 | `Photos / RecycleBin / Settings` 已接入窗口尺寸、安全区、最大宽度与媒体网格规则 | AVD、SE override、cutout overlay 与物理真机 current-size 已形成运行态闭环 | `WP6` |
| RN 尺寸映射 | SE 尺寸设计稿 | 当前已明确“SE 为基准、RN 用逻辑尺寸和响应式规则映射”，并完成核心页面接线 | 运行态截图已证明没有继续按导出像素硬编码 | `WP1`、`WP3`、`WP4`、`WP4b`、`WP6` |

## 当前最高优先级差异

1. `Photos / RecycleBin / Settings` 代码侧已完成 SE/RN 适配接线，原生运行态签收已完成。
2. 旧 `agent-device` 截图早于本轮重来，只能作为历史业务链路参考。
3. `light/dark` 双主题已进入 token 层，并已补逐屏浅/深截图验证。
4. 设计稿是 SE 级别尺寸，当前签收以 RN 原生 SE/非 SE/物理真机证据为准，web 代理截图只作辅助。
5. 设备环境不再阻塞当前 Android-first v0.4 收口。

## 执行提示

1. 后续不要继续大幅改视觉，先拿原生截图验证当前实现。
2. 如果原生截图仍明显偏离设计稿，再按页面局部回流，而不是重新推倒。
3. 任何“当前代码已经这样写了”的理由，都不能直接否决设计稿改造，除非涉及运行时正确性。
4. 任何“设计稿是固定尺寸”的理由，都不能直接导出固定 RN 像素；必须先过 `rn-adaptation-strategy.md` 的适配规则。
