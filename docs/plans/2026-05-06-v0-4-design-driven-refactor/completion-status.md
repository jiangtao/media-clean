# v0.4 执行状态清单

## 当前结论

截至 `2026-05-07 15:28 CST`，本轮 `$impeccable` 重来已把 `Photos / RecycleBin / Settings` 从旧版固定布局推进到“SE 设计稿为基准 + RN 响应式适配”的代码状态，并已在 Android emulator 与 `d28739dc` 物理真机上补齐过目标页的原生运行态签收证据。`2026-05-07 14:12 CST` 追加改动继续修正了用户最新指出的两处视觉偏差：扫描进度环不能走分段 fallback，回收站 `清理/释放` 汇总条底边要是 1px 白色 box-shadow 语义线。`2026-05-07 15:28 CST` 已重建 Android debug APK，确认 `react-native-svg` 原生 `RNSVG*` ViewManager 被 autolink 进包，并用 emulator 补到最新扫描连续圆环、回收站选中态和设置页截图。

1. `Photos` 网格尺寸不再使用模块级 `Dimensions.get('window')` 固定值，改为 `useWindowDimensions` + `buildMediaGridLayout`。
2. `RecycleBin` 复用媒体网格和底部操作栏布局规则，批量恢复/清理操作区按安全区和内容宽度计算。
3. `Settings` 使用屏幕布局计算最大内容宽度、卡片间距和 chip 尺寸，避免大屏无限拉伸。
4. 主题、底部 tab、按钮层级已从旧暖色/旧 tab 壳切到更贴近 `light/dark` 设计稿的冷白蓝与深蓝黑体系。
5. `clarify` 复核未发现本轮布局调整破坏高风险动作语义。

当前状态是：**代码侧、静态门禁、Expo dev-mode、Android export、目标页 Android emulator 原生签收、最新 SVG 圆环 emulator 截图、最新回收站选中态 emulator 截图、最新 Settings emulator 截图、`clarify` 文案终验、`scan-complete`、Maestro smoke、v0.4 设计签收包装器与 v0.4 物理真机签收历史证据均已通过；但最新扫描环与回收站 1px box-shadow 改动仍缺最新真机截图复验**。因此当前不能调用 `update_goal complete`。设备重新连接后，需要至少补 `scan-probe` 或等价扫描态截图，以及 `recycle-selection` 回收站截图。

## 本轮新增验证

| 条件 | 当前状态 | 证据 |
| --- | --- | --- |
| 最新扫描环与回收站 1px box-shadow | emulator 通过，待真机复验 | [DesignIcon.tsx](/Users/jt/places/personal/app-cleaner/src/ui/icons/DesignIcon.tsx:54) 不再依赖 `UIManager.getViewManagerConfig`，避免 RN 新架构误走分段 fallback；[RecycleBinScreen.tsx](/Users/jt/places/personal/app-cleaner/src/ui/screens/RecycleBinScreen.tsx:715) 使用 1px 白色线 + RN `boxShadow` 对象数组；`npm run build:android:debug` 通过且 Gradle 生成 [PackageList.java](/Users/jt/places/personal/app-cleaner/android/app/build/generated/autolinking/src/main/java/com/facebook/react/PackageList.java:21) 已包含 `SvgPackage`；`npm run verify:android:scan-probe -- --serial emulator-5554` 通过，最新快速运行态圆环证据见 [after-0_30s.png](/Users/jt/places/personal/app-cleaner/artifacts/manual-debug/scan-ring-fast-capture-20260507-152422/after-0_30s.png)；`npm run verify:android:recycle-selection -- --serial emulator-5554` 通过，证据见 [20260507-152525](/Users/jt/places/personal/app-cleaner/artifacts/agent-device/20260507-152525/steps/05-recycle-selection-mode/screen.png)；`adb devices -l` 当前仅有 emulator，缺最新真机截图 |
| 最新 Settings emulator 复验 | 通过 | `npm run verify:android:settings-signoff -- --serial emulator-5554` 通过；证据见 [20260507-152632](/Users/jt/places/personal/app-cleaner/artifacts/agent-device/20260507-152632/steps/04-settings-entry/screen.png) |
| 最新静态收口门禁 | 通过 | `2026-05-07 15:33 CST` 复验：`git diff --check` 无输出；`npm run typecheck -- --pretty false` 通过；`npm run test -- --run src/ui/screens/__tests__/PhotoGridScreen.test.tsx src/ui/components/__tests__/PhotoGrid.test.tsx src/ui/components/__tests__/PhotoGridItem-selection.test.tsx src/ui/screens/__tests__/RecycleBinScreen.test.tsx src/navigation/__tests__/TabBar.test.tsx src/ui/screens/__tests__/SettingsScreen.test.tsx` 通过，`12` 个测试文件、`298` 个测试 |
| 最新 `clarify` 文案终验 | 文案层通过 | `2026-05-07 15:43 CST` 复核：照片/详情成对动作统一为 `保留 / 清理`、`Keep / Clean`；英文 `Continue scan` 对齐接续扫描语义；缓存维护仍保留 `清除缓存 / Clear cache`。`npm run typecheck -- --pretty false` 通过；`npm run test -- --run src/ui/screens/__tests__/DetailScreen.test.tsx src/ui/screens/__tests__/PhotoGridScreen.test.tsx src/ui/screens/__tests__/RecycleBinScreen.test.tsx src/ui/screens/__tests__/SettingsScreen.test.tsx src/ui/components/__tests__/ActionSwitch.test.tsx src/navigation/__tests__/TabBar.test.tsx` 通过，`12` 个测试文件、`245` 个测试 |
| 最新 SVG / 无背景 UI 反馈 | 通过 | `design/icons/*.svg` 已接入 [DesignIcon.tsx](/Users/jt/places/personal/app-cleaner/src/ui/icons/DesignIcon.tsx:1)；底部 nav、扫描环形进度、保留/清理图标、授权状态、结果分类项已切到无背景/低容器感；`grep -c "</svg>" design/icons/*.svg && xmllint --noout design/icons/*.svg` 通过 |
| 最新 Expo Android export | 通过 | `npx expo export --platform android --clear` 通过，Android bundle 输出到 [dist](/Users/jt/places/personal/app-cleaner/dist/metadata.json:1)，未打 APK |
| 最新全量测试 | 通过 | `npm run test -- --run` 于 `2026-05-07 12:09 CST` 通过，`108` 个测试文件、`1299` 个测试 |
| 最新定向 UI 护栏 | 通过 | `npm run test -- --run src/ui/screens/__tests__/PhotoGridScreen.test.tsx src/ui/screens/__tests__/RecycleBinScreen.test.tsx src/ui/screens/__tests__/DetailScreen.test.tsx src/ui/screens/__tests__/LandingScreen.test.tsx src/ui/screens/__tests__/SettingsScreen.test.tsx src/navigation/__tests__/TabBar.test.tsx src/navigation/__tests__/MainTabNavigator.test.tsx src/ui/components/__tests__/ActionSwitch.test.tsx` 通过，`16` 个测试文件、`258` 个测试 |
| 定向 UI 护栏 | 通过 | `npm run test -- --run src/ui/screens/__tests__/PhotoGridScreen.test.tsx src/ui/screens/__tests__/RecycleBinScreen.test.tsx src/ui/screens/__tests__/SettingsScreen.test.tsx src/ui/screens/__tests__/LandingScreen.test.tsx src/ui/components/__tests__/PhotoGrid.test.tsx src/ui/components/__tests__/PhotoGridItem-selection.test.tsx src/navigation/__tests__/TabBar.test.tsx`，当前工作树复验结果 `14` 个测试文件、`302` 个测试通过 |
| 全量测试 | 通过 | `npm run test -- --run` 于 `2026-05-07 12:09 CST` 通过，结果 `108` 个测试文件、`1299` 个测试通过 |
| TypeScript | 通过 | `npm run typecheck -- --pretty false` 于 `2026-05-07 11:57 CST` 当前工作树复验通过 |
| Diff hygiene | 通过 | `bash -n scripts/android/run-agent-device-observability.sh scripts/android/run-v0-4-design-signoff.sh scripts/android/run-maestro-smoke.sh` 与 `git diff --check` 于 `2026-05-07 11:57 CST` 通过，无输出 |
| Expo dev-mode | 通过 | `CI=1 npm run start -- --port 8099` 可启动 Metro，未打 APK；日志见 [metro-devmode-20260506-133336.log](/Users/jt/places/personal/app-cleaner/artifacts/web-dev-signoff/metro-devmode-20260506-133336.log) |
| v0.4 设计签收包装器 | 通过 | `npm run verify:android:v0-4-design-signoff -- --dry-run --skip-maestro --skip-scan-complete` 可在无设备状态下打印 current-size、SE light、SE dark、display cutout 签收矩阵；默认不传 `--install-apk` |
| v0.4 设计签收包装器真实运行 | 通过 | `npm run verify:android:v0-4-design-signoff -- --serial emulator-5554 --skip-maestro --skip-scan-complete` 已在 `emulator-5554` 上完成 current-size light、SE light、SE dark、display cutout overlay 签收；证据见 [design-signoff.md](./design-signoff.md#v04-包装器复验)；本次未打 APK |
| 最新 Recycle 反馈复验 | 通过 | `npm run verify:android:recycle-selection -- --serial emulator-5554` 已二次复验；最新非 SE 证据见 [20260506-192913](/Users/jt/places/personal/app-cleaner/artifacts/agent-device/20260506-192913/steps/05-recycle-selection-mode/screen.png)，SE light 证据见 [20260506-192804](/Users/jt/places/personal/app-cleaner/artifacts/agent-device/20260506-192804/steps/05-recycle-selection-mode/screen.png)，旧脚本长按入口已被默认选择态检测替代 |
| 最新 Photos 选中态复验 | 通过 | `npm run verify:android:filtering-selection -- --serial emulator-5554` 通过，最新证据见 [20260506-184744](/Users/jt/places/personal/app-cleaner/artifacts/agent-device/20260506-184744) 与包装器 [20260506-185128](/Users/jt/places/personal/app-cleaner/artifacts/agent-device/20260506-185128)、[20260506-185511](/Users/jt/places/personal/app-cleaner/artifacts/agent-device/20260506-185511)、[20260506-185840](/Users/jt/places/personal/app-cleaner/artifacts/agent-device/20260506-185840) |
| 最新 Settings 复验 | 通过 | `npm run verify:android:settings-signoff -- --serial emulator-5554` 通过，最新证据见 [20260506-184951](/Users/jt/places/personal/app-cleaner/artifacts/agent-device/20260506-184951) 与包装器 [20260506-185406](/Users/jt/places/personal/app-cleaner/artifacts/agent-device/20260506-185406)、[20260506-185739](/Users/jt/places/personal/app-cleaner/artifacts/agent-device/20260506-185739)、[20260506-190106](/Users/jt/places/personal/app-cleaner/artifacts/agent-device/20260506-190106) |
| v0.4 物理真机签收入口 | 通过 | `npm run verify:android:v0-4-physical-signoff -- --serial d28739dc --skip-maestro` 于 `2026-05-07 03:03 CST` 通过；覆盖 current-size light、`scan-complete`、current-size dark，未打 APK |
| 物理真机 current-size light | 通过 | `04` [20260507-024507](/Users/jt/places/personal/app-cleaner/artifacts/agent-device/20260507-024507/steps/08-filtering-selection-mode/screen.png)、`05` [20260507-024802](/Users/jt/places/personal/app-cleaner/artifacts/agent-device/20260507-024802/steps/05-recycle-selection-mode/screen.png)、`06` [20260507-024910](/Users/jt/places/personal/app-cleaner/artifacts/agent-device/20260507-024910/steps/08-settings-cache/screen.png) |
| 最新入口/相册选中真机复验 | 通过 | `npm run verify:android:filtering-selection -- --serial d28739dc` 于 `2026-05-07 11:43 CST` 通过；入口 CTA 后进入 Photos，最新选中态证据见 [20260507-114039](/Users/jt/places/personal/app-cleaner/artifacts/agent-device/20260507-114039/steps/08-filtering-selection-mode/screen.png) |
| 最新回收站选中真机复验 | 通过 | `npm run verify:android:recycle-selection -- --serial d28739dc` 于 `2026-05-07 11:45 CST` 通过；长按进入选中、顶部 `全选`、底部 `保留 / 清理` 与 summary 证据见 [20260507-114414](/Users/jt/places/personal/app-cleaner/artifacts/agent-device/20260507-114414/steps/05-recycle-selection-mode/screen.png) |
| 物理真机 process / scan-complete | 通过 | process running [20260507-022318](/Users/jt/places/personal/app-cleaner/artifacts/agent-device/20260507-022318/steps/06-scan-started/screen.png)；scan-complete [20260507-025058](/Users/jt/places/personal/app-cleaner/artifacts/agent-device/20260507-025058/steps/07-scan-exhausted/screen.png) |
| 物理真机 current-size dark | 通过 | `04` [20260507-025230](/Users/jt/places/personal/app-cleaner/artifacts/agent-device/20260507-025230/steps/08-filtering-selection-mode/screen.png)、`05` [20260507-025527](/Users/jt/places/personal/app-cleaner/artifacts/agent-device/20260507-025527/steps/05-recycle-selection-mode/screen.png)、`06` [20260507-025635](/Users/jt/places/personal/app-cleaner/artifacts/agent-device/20260507-025635/steps/08-settings-cache/screen.png) |
| cutout overlay 恢复 | 通过 | 修复 `cmd overlay list` 解析后，最小 smoke 确认 `enabled_cutouts=`，设备恢复为 `1080x2400 / density 420 / night no / no cutout` |
| Expo web 代理截图 | 部分通过 | [01-web-se-initial.png](/Users/jt/places/personal/app-cleaner/artifacts/web-dev-signoff/20260506-132340/01-web-se-initial.png) 仅证明 web 代理可渲染，不作为 RN 原生视觉签收 |
| Android emulator 非 SE light 签收 | 通过 | `filtering-selection` [20260506-185128](/Users/jt/places/personal/app-cleaner/artifacts/agent-device/20260506-185128)、`recycle-selection` [20260506-185324](/Users/jt/places/personal/app-cleaner/artifacts/agent-device/20260506-185324)、`settings-signoff` [20260506-185406](/Users/jt/places/personal/app-cleaner/artifacts/agent-device/20260506-185406) |
| Android emulator SE light 签收 | 通过 | `wm size 750x1334 / density 326` 后运行：`filtering-selection` [20260506-185511](/Users/jt/places/personal/app-cleaner/artifacts/agent-device/20260506-185511)、`recycle-selection` [20260506-185700](/Users/jt/places/personal/app-cleaner/artifacts/agent-device/20260506-185700)、`settings-signoff` [20260506-185739](/Users/jt/places/personal/app-cleaner/artifacts/agent-device/20260506-185739) |
| Android emulator SE dark 签收 | 通过 | `cmd uimode night yes` 后运行：`filtering-selection` [20260506-185840](/Users/jt/places/personal/app-cleaner/artifacts/agent-device/20260506-185840)、`recycle-selection` [20260506-190028](/Users/jt/places/personal/app-cleaner/artifacts/agent-device/20260506-190028)、`settings-signoff` [20260506-190106](/Users/jt/places/personal/app-cleaner/artifacts/agent-device/20260506-190106) |
| Photos 扫描/结果运行态 | 通过 | `scan-complete` 已通过：[20260506-141833 06-scan-started](/Users/jt/places/personal/app-cleaner/artifacts/agent-device/20260506-141833/steps/06-scan-started/screen.png)、[20260506-141833 07-scan-result-ready](/Users/jt/places/personal/app-cleaner/artifacts/agent-device/20260506-141833/steps/07-scan-result-ready/screen.png) |
| Maestro smoke | 通过 | `npm run test:maestro:smoke`，结果 `1/1 Flow Passed in 39s`；本轮同时修复 smoke 脚本空数组兼容和语言切换后的滚动断言 |

## 历史证据口径

`artifacts/agent-device/20260506-*` 中的旧运行态截图证明了前一轮 `01-06` 曾经能跑通，但这些截图早于本次主题、网格、回收站、设置页响应式重构。因此：

1. 旧截图可以作为“业务链路历史可运行”参考。
2. 旧截图不能作为本轮 `$impeccable` 重来后的最终视觉签收证据。
3. 本轮最终签收必须重新捕获 `Photos(02/03/04) / RecycleBin(05) / Settings(06)` 的 SE 与非 SE 原生运行态截图。

## 非阻断后续项

| 后续项 | 影响 | 当前证据 |
| --- | --- | --- |
| 当前 macOS 无可用 iOS simulator 工具链 | 暂不能补 iOS SE simulator 截图；不影响本轮 Android-first v0.4 物理真机收口 | `xcrun simctl` 不可用 |

## 完成定义对照

| 条件 | 当前状态 | 说明 |
| --- | --- | --- |
| `Photos / RecycleBin / Settings` 代码侧 SE/RN 适配 | 通过 | 核心页面已接入窗口尺寸、安全区、媒体网格和最大宽度布局规则 |
| 静态门禁 | 通过 | 定向测试、全量测试、typecheck、diff check 均通过 |
| Expo 开发模式 | 通过 | Metro 可启动；`verify:android:v0-4-design-signoff` 默认不安装 APK，符合“开发模式下不需要打 APK”的口径 |
| 设计图原生运行态签收 | 目标页通过 | `02/03/04/05/06` 已有 Android emulator 原生证据，`04/05/06` 额外覆盖非 SE light、SE light、SE dark |
| 非 SE 运行态抽检 | 通过 | 默认 AVD `1080x2400 / density 420` 已跑目标页签收 |
| Android 设备链路 | 待补最新真机截图 | emulator 目标页签收、SE override、dark、cutout 与 `d28739dc` 历史物理真机签收均已通过；最新扫描环与回收站 1px box-shadow 代码变更后，`adb devices -l` 当前仅有 `emulator-5554`，仍需补最新真机截图 |
| `clarify` 终验 | 文案层通过 | [clarify-review.md](./clarify-review.md) 已记录最新 copy 复核；最终 goal 仍因最新视觉修正缺真机截图而不能关闭 |

## 当前阻塞

`2026-05-07 14:12 CST`：`adb devices -l` 当前无在线设备，无法补最新扫描环和回收站 1px box-shadow 的真机截图。重新连接 `d28739dc` 后继续执行：

1. `npm run verify:android:scan-probe -- --serial d28739dc`
2. `npm run verify:android:recycle-selection -- --serial d28739dc`

`2026-05-07 14:43 CST`：尝试用本机 AVD 作为非替代性补验，`$ANDROID_HOME/emulator/emulator -list-avds` 可见 `MediaClean_API_33` 与 `MediaClean_API_33_ARM64`，但启动 `MediaClean_API_33_ARM64` 后 emulator 进程立即退出，`adb devices -l` 仍为空。

`2026-05-07 15:28 CST`：新建并启动 `MediaClean_SE_API_33_Fresh`，当前 `adb devices -l` 可见 `emulator-5554`。已通过 `npm run build:android:debug` 修复旧 APK 缺 `react-native-svg` native ViewManager 导致的 `RNSVGPath` 红屏，并完成 emulator 运行态补验：扫描连续圆环 [after-0_30s.png](/Users/jt/places/personal/app-cleaner/artifacts/manual-debug/scan-ring-fast-capture-20260507-152422/after-0_30s.png)、回收站选中态 [20260507-152525](/Users/jt/places/personal/app-cleaner/artifacts/agent-device/20260507-152525/steps/05-recycle-selection-mode/screen.png)、设置页 [20260507-152632](/Users/jt/places/personal/app-cleaner/artifacts/agent-device/20260507-152632/steps/04-settings-entry/screen.png)。这能证明最新 APK 的 RN 原生运行态已恢复，但不能替代最新物理真机复验。

`2026-05-07 15:36 CST`：再次诊断设备链路，`adb devices -l` 仍只有 `emulator-5554`；`ioreg -p IOUSB -l -w0` 只看到一个泛化的 `USB DEVICE`，无 Android/手机厂商标识、无 ADB serial，不能作为物理真机验收设备。需要在手机侧切换 USB 传输/调试授权，或重新接入可被 ADB 识别的 Android 真机。

`2026-05-07 15:38 CST`：执行 `adb kill-server` / `adb start-server` 后复查，`adb devices -l` 仍只有 `emulator-5554`。USB 过滤结果只包含 `Magic Trackpad` 和 `COMPANY / USB DEVICE`，仍无 Android、MTP、ADB 或手机厂商标识。当前阻塞不是 verifier 脚本或 ADB server 缓存问题。

## 下一步只剩这些

1. 重新连接 `d28739dc` 后，先确保真机安装的是包含 `react-native-svg` native ViewManager 的最新 debug APK；可用 `adb install -r android/app/build/outputs/apk/debug/app-debug.apk` 或 `npm run android` 重装。
2. 补 `scan-probe`，确认扫描进度是完整连续环，不是分段 fallback。
3. 补 `recycle-selection`，确认回收站 `清理/释放` 汇总条底边为 1px 白色 box-shadow 语义线。
4. 若进入“所有机型完备”最终放行，再扩展更多 AVD / 真机矩阵。
5. 若恢复 iOS simulator / `simctl`，可补 iOS SE 截图；当前 v0.4 Android-first 收口不以此为阻断。
