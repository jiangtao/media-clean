# v0.4 特殊屏抽检记录

## 当前口径

本文件在本轮 `$impeccable` 重来后只保留可复用结论，不再把旧截图当作当前视觉签收。

原因：`Photos / RecycleBin / Settings` 已重新调整主题、媒体网格、底部操作区和 Settings 响应式布局；旧 `agent-device` 截图早于这些改动。

## 历史设备证据

历史上曾用以下设备拿到过竖屏链路证据：

1. `d28739dc`
2. `Xiaomi M2102J2SC`
3. `Android 11 / MIUI`

这些证据可以说明旧版本主路径曾经在打孔屏竖屏上运行，但不能证明本轮重来后的最终视觉贴近设计稿。

## 横屏策略

历史尝试显示 App 未能进入横屏，直接原因是 [app.json](/Users/jt/places/personal/app-cleaner/app.json:6) 当前配置 `"orientation": "portrait"`。

当前决策口径：

1. 如果产品继续坚持 portrait，横屏应记录为产品策略豁免。
2. 如果 `v0.4` 必须覆盖横屏，需要先调整 Expo orientation，再重建并补横屏验收。
3. 在未做产品决策前，不把横屏记为通过。

## 本轮已补抽检

本轮已经重新补以下证据：

1. `Photos 04 Filtering`：SE 级别窄屏、非 SE 宽屏或高屏、浅色/深色。
2. `RecycleBin 05`：默认态与选择态，底部操作区避开安全区。
3. `Settings 06`：内容最大宽度、卡片分组、语言/主题 chip、提醒开关。
4. 打孔屏或刘海屏：顶部标题、返回按钮、底部 tab 和浮动操作栏不被遮挡。
5. 大屏逻辑尺寸：媒体列数增加但缩略图仍可判断，Settings 不无限拉伸。

## 自动化护栏

本轮静态适配护栏仍应保留：

1. [screen-adaptation.test.ts](/Users/jt/places/personal/app-cleaner/src/features/compatibility/__tests__/screen-adaptation.test.ts:1)
2. [FoldableLayout.test.tsx](/Users/jt/places/personal/app-cleaner/src/ui/components/FoldableLayout.test.tsx:1)

## 结论

当前可以记录为：**适配规则代码侧已接线，Android emulator 非 SE、SE `wm` override、display cutout overlay 与 `d28739dc` 物理真机 current-size light/dark 抽检通过**。

本轮新增证据：

1. 默认 AVD 非 SE：`1080x2400 / density 420`，见 [20260506-185128](/Users/jt/places/personal/app-cleaner/artifacts/agent-device/20260506-185128)、[20260506-185324](/Users/jt/places/personal/app-cleaner/artifacts/agent-device/20260506-185324)、[20260506-185406](/Users/jt/places/personal/app-cleaner/artifacts/agent-device/20260506-185406)。
2. SE override：`wm size 750x1334 / density 326`，见 [20260506-185511](/Users/jt/places/personal/app-cleaner/artifacts/agent-device/20260506-185511)、[20260506-185700](/Users/jt/places/personal/app-cleaner/artifacts/agent-device/20260506-185700)、[20260506-185739](/Users/jt/places/personal/app-cleaner/artifacts/agent-device/20260506-185739)。
3. SE dark：`cmd uimode night yes`，见 [20260506-185840](/Users/jt/places/personal/app-cleaner/artifacts/agent-device/20260506-185840)、[20260506-190028](/Users/jt/places/personal/app-cleaner/artifacts/agent-device/20260506-190028)、[20260506-190106](/Users/jt/places/personal/app-cleaner/artifacts/agent-device/20260506-190106)。
4. Display cutout overlay：`com.android.internal.display.cutout.emulation.hole`，见 [20260506-142130](/Users/jt/places/personal/app-cleaner/artifacts/agent-device/20260506-142130)；抽检 `Photos 04` 顶部返回/标题、右上动作、底部操作和 tab。
5. v0.4 包装器复验：`npm run verify:android:v0-4-design-signoff -- --serial emulator-5554 --skip-maestro --skip-scan-complete` 已再次跑过 display cutout overlay，见 [20260506-190208](/Users/jt/places/personal/app-cleaner/artifacts/agent-device/20260506-190208)。
6. 回收站选择态脚本复验：当前最终口径是默认非选中、长按进入选择态，最新真机证据见 [20260507-114414](/Users/jt/places/personal/app-cleaner/artifacts/agent-device/20260507-114414/steps/05-recycle-selection-mode/screen.png)。
7. cutout overlay 恢复逻辑已修复：`cmd overlay list` 的 disabled 行格式为 `[ ] package`，脚本现在只禁用当前 `[x]` 的 cutout overlay，并去除 `adb shell` 输出末尾 `\r`。
8. 回收站 SE 选择态二次复验：`wm size 750x1334 / density 326` 下重新采集 9 图中文多选网格，见 [20260506-192804](/Users/jt/places/personal/app-cleaner/artifacts/agent-device/20260506-192804/steps/05-recycle-selection-mode/screen.png)；当前尺寸复验见 [20260506-192913](/Users/jt/places/personal/app-cleaner/artifacts/agent-device/20260506-192913/steps/05-recycle-selection-mode/screen.png)。
9. 物理真机 `d28739dc` current-size light/dark 签收已补：light [04](/Users/jt/places/personal/app-cleaner/artifacts/agent-device/20260507-024507/steps/08-filtering-selection-mode/screen.png)、[05](/Users/jt/places/personal/app-cleaner/artifacts/agent-device/20260507-024802/steps/05-recycle-selection-mode/screen.png)、[06](/Users/jt/places/personal/app-cleaner/artifacts/agent-device/20260507-024910/steps/08-settings-cache/screen.png)；dark [04](/Users/jt/places/personal/app-cleaner/artifacts/agent-device/20260507-025230/steps/08-filtering-selection-mode/screen.png)、[05](/Users/jt/places/personal/app-cleaner/artifacts/agent-device/20260507-025527/steps/05-recycle-selection-mode/screen.png)、[06](/Users/jt/places/personal/app-cleaner/artifacts/agent-device/20260507-025635/steps/08-settings-cache/screen.png)。

仍未覆盖的是 iOS SE simulator；本机 `simctl` 仍不可用。当前 Android-first v0.4 收口不以 iOS simulator 为阻断。
