# v0.4 设计签收记录

## 签收口径

1. 结构和信息层级以 [light](/Users/jt/places/personal/cleaner-app/preview-frames/final-screens/light) 为主真值。
2. 深色映射以 [dark](/Users/jt/places/personal/cleaner-app/preview-frames/final-screens/dark) 为主题真值。
3. 设计稿是 SE 尺寸基准，RN 实现必须使用逻辑尺寸、安全区、最大宽度和网格列数规则适配真实设备。
4. 本文只记录当前可证实结论；本轮 `$impeccable` 重来后的页面不能继续引用旧截图作为最终签收。

## 本轮重来后的状态

| 设计态 | 设计真值 | 当前代码证据 | 当前结果 | 说明 |
| --- | --- | --- | --- | --- |
| `00 Splash` | [Light 00](/Users/jt/places/personal/cleaner-app/preview-frames/final-screens/light/media-clean-se-00-splash-light.png) / [Dark 00](/Users/jt/places/personal/cleaner-app/preview-frames/final-screens/dark/media-clean-se-00-splash-dark.png) | 既有启动体验 | 不纳入本轮 | 用户已明确要求 `Splash` 沿用旧版，不作为本轮重新还原阻塞项 |
| `01 Landing` | [Light 01](/Users/jt/places/personal/cleaner-app/preview-frames/final-screens/light/media-clean-se-01-landing-light.png) / [Dark 01](/Users/jt/places/personal/cleaner-app/preview-frames/final-screens/dark/media-clean-se-01-landing-dark.png) | [LandingScreen.tsx](/Users/jt/places/personal/app-cleaner/src/ui/screens/LandingScreen.tsx:1)、[TabBar.tsx](/Users/jt/places/personal/app-cleaner/src/ui/components/TabBar.tsx:1)、[SE light landing 20260506-134539](/Users/jt/places/personal/app-cleaner/artifacts/agent-device/20260506-134539/steps/01-landing-ready/screen.png)、[SE dark landing 20260506-135050](/Users/jt/places/personal/app-cleaner/artifacts/agent-device/20260506-135050/steps/01-landing-ready/screen.png) | 通过 | SE light/dark 原生截图已补；web 代理截图只保留为辅助参考 |
| `02 Scanning` | [Light 02](/Users/jt/places/personal/cleaner-app/preview-frames/final-screens/light/media-clean-se-02-scanning-light.png) / [Dark 02](/Users/jt/places/personal/cleaner-app/preview-frames/final-screens/dark/media-clean-se-02-scanning-dark.png) | [PhotoGridEntryCard.tsx](/Users/jt/places/personal/app-cleaner/src/ui/screens/photo-grid/PhotoGridEntryCard.tsx:1)、[scan started 20260506-141833](/Users/jt/places/personal/app-cleaner/artifacts/agent-device/20260506-141833/steps/06-scan-started/screen.png) | 通过 | 当前实现可进入扫描中状态，并能继续进入结果态 |
| `03 Result` | [Light 03](/Users/jt/places/personal/cleaner-app/preview-frames/final-screens/light/media-clean-se-03-result-light.png) / [Dark 03](/Users/jt/places/personal/cleaner-app/preview-frames/final-screens/dark/media-clean-se-03-result-dark.png) | [scan complete result 20260506-141833](/Users/jt/places/personal/app-cleaner/artifacts/agent-device/20260506-141833/steps/07-scan-result-ready/screen.png)、[SE light result 20260506-134539](/Users/jt/places/personal/app-cleaner/artifacts/agent-device/20260506-134539/steps/06-seeded-result-ready/screen.png)、[SE dark result 20260506-135050](/Users/jt/places/personal/app-cleaner/artifacts/agent-device/20260506-135050/steps/06-seeded-result-ready/screen.png) | 通过 | `scan-complete` 与 deterministic seeded result 都可进入结果态 |
| `04 Filtering` | [Light 04](/Users/jt/places/personal/cleaner-app/preview-frames/final-screens/light/media-clean-se-04-filtering-light.png) / [Dark 04](/Users/jt/places/personal/cleaner-app/preview-frames/final-screens/dark/media-clean-se-04-filtering-dark.png) | [non-SE light 20260506-185128](/Users/jt/places/personal/app-cleaner/artifacts/agent-device/20260506-185128/steps/08-filtering-selection-mode/screen.png)、[SE light 20260506-185511](/Users/jt/places/personal/app-cleaner/artifacts/agent-device/20260506-185511/steps/08-filtering-selection-mode/screen.png)、[SE dark 20260506-185840](/Users/jt/places/personal/app-cleaner/artifacts/agent-device/20260506-185840/steps/08-filtering-selection-mode/screen.png) | 通过 | 网格列数、缩略图尺寸、缩小后的选择圆点、底部 `Keep / Clean up` 和 tab 安全区已有最新原生证据 |
| `05 Recycle` | [Light 05](/Users/jt/places/personal/cleaner-app/preview-frames/final-screens/light/media-clean-se-05-recycle-light.png) / [Dark 05](/Users/jt/places/personal/cleaner-app/preview-frames/final-screens/dark/media-clean-se-05-recycle-dark.png) | [non-SE light 20260506-192913](/Users/jt/places/personal/app-cleaner/artifacts/agent-device/20260506-192913/steps/05-recycle-selection-mode/screen.png)、[SE light 20260506-192804](/Users/jt/places/personal/app-cleaner/artifacts/agent-device/20260506-192804/steps/05-recycle-selection-mode/screen.png)、[SE dark 20260506-190028](/Users/jt/places/personal/app-cleaner/artifacts/agent-device/20260506-190028/steps/05-recycle-selection-mode/screen.png) | 通过 | 回收站现在默认进入中文设计稿选择态；验收 fixture 改为 9 图多选网格，已复验顶部 `取消全选`、摘要卡、媒体网格、底部 `保留 / 清理` 和收窄后的勾选圆点；脚本不再用旧长按入口伪造选择态 |
| `06 Settings` | [Light 06](/Users/jt/places/personal/cleaner-app/preview-frames/final-screens/light/media-clean-se-06-settings-light.png) / [Dark 06](/Users/jt/places/personal/cleaner-app/preview-frames/final-screens/dark/media-clean-se-06-settings-dark.png) | [non-SE light 20260506-185406](/Users/jt/places/personal/app-cleaner/artifacts/agent-device/20260506-185406/steps/08-settings-cache/screen.png)、[SE light 20260506-185739](/Users/jt/places/personal/app-cleaner/artifacts/agent-device/20260506-185739/steps/08-settings-cache/screen.png)、[SE dark 20260506-190106](/Users/jt/places/personal/app-cleaner/artifacts/agent-device/20260506-190106/steps/08-settings-cache/screen.png) | 通过 | 设置页最大宽度、四卡结构、语言/主题、提醒、缓存入口已有最新原生证据 |

## 2026-05-07 SVG 与无背景规则补签

用户继续指出“所有图标不对”“底部 nav 不需要背景”“识别后分类 item 不要背景”“授权状态不要背景和 shadow”等问题后，已补一轮代码侧设计签收修正：

| 项 | 当前证据 | 签收状态 |
| --- | --- | --- |
| 设计图标资产 | [design/icons](/Users/jt/places/personal/app-cleaner/design/icons) 源文件已映射到 [DesignIcon.tsx](/Users/jt/places/personal/app-cleaner/src/ui/icons/DesignIcon.tsx:1)，并新增 `react-native-svg` | `xmllint --noout design/icons/*.svg` 通过 |
| Bottom nav 无背景 | [TabBar.tsx](/Users/jt/places/personal/app-cleaner/src/ui/components/TabBar.tsx:71) 移除旧背景、圆角、边框和阴影，active/default 图标颜色分离 | 代码签收通过，真机截图已补 |
| 扫描 SVG 环形进度 | [SvgProcessRing](/Users/jt/places/personal/app-cleaner/src/ui/icons/DesignIcon.tsx:83) + [PhotoGridEntryCard.tsx](/Users/jt/places/personal/app-cleaner/src/ui/screens/photo-grid/PhotoGridEntryCard.tsx:177) | Typecheck、目标测试、Android export 均通过；真机扫描中截图已补 |
| 扫描 100% 后识别中 | [PhotoGridScreen.tsx](/Users/jt/places/personal/app-cleaner/src/ui/screens/PhotoGridScreen.tsx:377) 增加 `recognizing` 阶段，生产态保留 780ms 识别过渡 | 代码签收通过，`scan-complete` 真机运行态已补 |
| 结果分类 item 无背景 | [PhotoGridEntryCard.tsx](/Users/jt/places/personal/app-cleaner/src/ui/screens/photo-grid/PhotoGridEntryCard.tsx:972) 将分类项改为透明背景、无阴影，仅保留轻分隔 | 代码签收通过，真机结果态截图已补 |
| 授权状态无背景 | [PhotoGridEntryCard.tsx](/Users/jt/places/personal/app-cleaner/src/ui/screens/photo-grid/PhotoGridEntryCard.tsx:640) 与 [LandingScreen.tsx](/Users/jt/places/personal/app-cleaner/src/ui/screens/LandingScreen.tsx:244) 均移除授权状态卡背景/阴影 | 代码签收通过，真机截图已补 |
| 保留/清理位置一致 | [DetailScreen.tsx](/Users/jt/places/personal/app-cleaner/src/ui/screens/DetailScreen.tsx:170) 已改为 suggestions 模式左保留、右清理；recycle 模式左恢复、右删除 | 目标测试通过 |

本补签已在 `d28739dc` 物理真机上完成 current-size light、scan-complete 与 current-size dark 运行态签收，未打 APK，走 Expo / Metro dev-mode。

## 2026-05-07 物理真机签收

`2026-05-07 03:03 CST` 已执行：

```bash
npm run verify:android:v0-4-physical-signoff -- --serial d28739dc --skip-maestro
```

该命令通过 `--require-physical` 校验目标为真机，跳过 emulator matrix，按物理设备路径覆盖 current-size light、`scan-complete`、current-size dark，并在退出时恢复浅色主题、窗口尺寸和 density。本轮仍按开发模式使用 Expo / Metro，没有安装 APK。

| 覆盖项 | 新证据 |
| --- | --- |
| current-size light `04 Filtering` | [20260507-024507](/Users/jt/places/personal/app-cleaner/artifacts/agent-device/20260507-024507/steps/08-filtering-selection-mode/screen.png) |
| current-size light `05 Recycle` | [20260507-024802](/Users/jt/places/personal/app-cleaner/artifacts/agent-device/20260507-024802/steps/05-recycle-selection-mode/screen.png) |
| current-size light `06 Settings` | [20260507-024910](/Users/jt/places/personal/app-cleaner/artifacts/agent-device/20260507-024910/steps/08-settings-cache/screen.png) |
| `02 Scanning` running/process | [20260507-022318](/Users/jt/places/personal/app-cleaner/artifacts/agent-device/20260507-022318/steps/06-scan-started/screen.png) |
| `02/03` scan-complete | [20260507-025058](/Users/jt/places/personal/app-cleaner/artifacts/agent-device/20260507-025058/steps/06-scan-started/screen.png)、[20260507-025058 result](/Users/jt/places/personal/app-cleaner/artifacts/agent-device/20260507-025058/steps/07-scan-exhausted/screen.png) |
| current-size dark `04 Filtering` | [20260507-025230](/Users/jt/places/personal/app-cleaner/artifacts/agent-device/20260507-025230/steps/08-filtering-selection-mode/screen.png) |
| current-size dark `05 Recycle` | [20260507-025527](/Users/jt/places/personal/app-cleaner/artifacts/agent-device/20260507-025527/steps/05-recycle-selection-mode/screen.png) |
| current-size dark `06 Settings` | [20260507-025635](/Users/jt/places/personal/app-cleaner/artifacts/agent-device/20260507-025635/steps/08-settings-cache/screen.png) |

## 不再作为当前签收的证据

以下历史截图可以证明旧版本曾经跑通，但早于本轮 `$impeccable` 重做主题、网格、回收站和设置页适配，不再作为当前视觉签收：

1. `artifacts/agent-device/20260506-110610`
2. `artifacts/agent-device/20260506-110820`
3. `artifacts/agent-device/20260506-120601`

## v0.4 包装器复验

`2026-05-06 18:51-19:03 CST` 已用 `npm run verify:android:v0-4-design-signoff -- --serial emulator-5554 --skip-maestro --skip-scan-complete` 在 Expo dev-mode 下串起目标页签收。该命令未传 `--install-apk`，Metro 由 `agent-device metro prepare --kind expo` 启动或复用。

| 覆盖项 | 新证据 |
| --- | --- |
| current-size light `04 Filtering` | [20260506-185128](/Users/jt/places/personal/app-cleaner/artifacts/agent-device/20260506-185128/steps/08-filtering-selection-mode/screen.png) |
| current-size light `05 Recycle` | [20260506-185324](/Users/jt/places/personal/app-cleaner/artifacts/agent-device/20260506-185324/steps/05-recycle-selection-mode/screen.png) |
| current-size light `06 Settings` | [20260506-185406](/Users/jt/places/personal/app-cleaner/artifacts/agent-device/20260506-185406/steps/08-settings-cache/screen.png) |
| `02 Scanning` / `03 Result` | 仍沿用 [20260506-145113 scanning](/Users/jt/places/personal/app-cleaner/artifacts/agent-device/20260506-145113/steps/06-scan-started/screen.png)、[20260506-145113 result](/Users/jt/places/personal/app-cleaner/artifacts/agent-device/20260506-145113/steps/07-scan-result-ready/screen.png)；本次包装器显式 `--skip-scan-complete` |
| SE light `04/05/06` | [Filtering 20260506-185511](/Users/jt/places/personal/app-cleaner/artifacts/agent-device/20260506-185511/steps/08-filtering-selection-mode/screen.png)、[Recycle 20260506-185700](/Users/jt/places/personal/app-cleaner/artifacts/agent-device/20260506-185700/steps/05-recycle-selection-mode/screen.png)、[Settings 20260506-185739](/Users/jt/places/personal/app-cleaner/artifacts/agent-device/20260506-185739/steps/08-settings-cache/screen.png) |
| SE dark `04/05/06` | [Filtering 20260506-185840](/Users/jt/places/personal/app-cleaner/artifacts/agent-device/20260506-185840/steps/08-filtering-selection-mode/screen.png)、[Recycle 20260506-190028](/Users/jt/places/personal/app-cleaner/artifacts/agent-device/20260506-190028/steps/05-recycle-selection-mode/screen.png)、[Settings 20260506-190106](/Users/jt/places/personal/app-cleaner/artifacts/agent-device/20260506-190106/steps/08-settings-cache/screen.png) |
| display cutout overlay `04 Filtering` | [20260506-190208](/Users/jt/places/personal/app-cleaner/artifacts/agent-device/20260506-190208/steps/08-filtering-selection-mode/screen.png) |

## 2026-05-06 回收站选择态补验

用户继续指出 `回收站模式` 和图片选中态与设计稿不一致后，已补一轮只针对 `05 Recycle` 的设计还原修正：

1. `recycle-selection` fixture 从单图改为 9 图多选，并固定 `zh-CN` + `theme-preference=system`，避免 Settings smoke 遗留英文状态污染设计签收。
2. `RecycleBin` compact header、summary card、底部 action bar 和全局 TabBar safe-area 占用已收窄，避免 SE 下网格被底部操作压住。
3. 非 SE light 复验：[20260506-192913](/Users/jt/places/personal/app-cleaner/artifacts/agent-device/20260506-192913/steps/05-recycle-selection-mode/screen.png)。
4. SE light 复验：[20260506-192804](/Users/jt/places/personal/app-cleaner/artifacts/agent-device/20260506-192804/steps/05-recycle-selection-mode/screen.png)。
5. 静态复验：`npm run typecheck -- --pretty false`、`npm run test -- --run src/ui/screens/__tests__/RecycleBinScreen.test.tsx src/ui/components/__tests__/PhotoGrid.test.tsx src/ui/components/__tests__/PhotoGridItem-selection.test.tsx src/navigation/__tests__/TabBar.test.tsx src/navigation/__tests__/MainTabNavigator.test.tsx src/navigation/__tests__/RootNavigator.test.tsx`、`bash -n scripts/android/seed-emulator-recycle-bin.sh scripts/android/run-agent-device-observability.sh` 均通过。

## 签收待补

1. 如果最终要求“所有机型完备”，还需增加更多 AVD / 真机矩阵，而不是只依赖当前 Pixel 7 AVD、SE `wm` override 与 `d28739dc` 物理真机。
