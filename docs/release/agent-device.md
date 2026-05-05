# Agent Device 设备观测契约

[English Version](./agent-device.en.md)

配套复用合同见：[设备验证 Lane 合同](./device-validation-lanes.md)

本文档定义 Media Clean 当前 Android-first 交付中的主设备观测层。这里的 `agent-device` 指的是 `callstackincubator/agent-device` 这套设备自动化与观测 CLI，不是 Firebase，也不是仓库内的业务真值层。它的职责是把“真实设备/模拟器上到底看到了什么、能不能走到目标页面、运行时吐了哪些现场证据”收成稳定 artifact。

## 目标

为当前仓库建立一条可持续、可复用、可上传 artifact 的 Android 设备观测链路，用来覆盖：

1. 真实设备或 emulator 启动应用后的界面现场。
2. 权限、导航、设置、扫描入口等关键流转是否还活着。
3. `logcat` 窗口、网络摘要、性能快照、React 组件树等运行时证据。
4. CI 中的设备级回归信号，而不是只靠人工 adb 截图。

## 分层定位

1. 构建与签名层：见 [Android 发包契约](./android.md)，负责 APK 产出、`apksigner` 验签、SHA256 与 metadata。
2. 业务真值层：SQLite / checkpoint / scan batch / recycle bin，负责扫描口径、恢复进度和用户决策真值。
3. 设备观测层：`agent-device`，负责 snapshot、screenshot、logs、network、perf、react-devtools。
4. 交互 smoke 层：见 [Maestro 验收契约](./maestro.md)，作为次级 fallback，回答“最小流程还能不能点通”。
5. 远程监控层：当前仍是 `noop fallback`，不是本轮 Android 第一版的主验证来源。

这五层里，`agent-device` 是当前“设备观测主层”，但不是唯一真值来源。

## 为什么它是主层

`callstackincubator/agent-device` 当前更适合做仓库内主设备观测层，原因是它不只会点 UI，还能同时给出结构化现场证据：

1. `snapshot` / `snapshot -i`：读取 token-efficient accessibility tree，而不是只靠像素截图。
2. `screenshot --overlay-refs`：把当前可交互 ref 直接叠到截图上，方便复盘。
3. `logs clear --restart` / `logs path`：围绕一次 repro 收窄日志窗口。
4. `network dump --include headers`：抓最近的 HTTP(s) 交互摘要。
5. `perf --json`：补 frame health / 运行性能证据。
6. `react-devtools`：补 React 组件树、slow renders、rerenders 证据。

这正好比当前“adb 截图 + 人工猜状态”更可持续。

## 仓库入口

当前仓库已经固定以下入口：

```bash
npm run agent-device:workflow
npm run seed:android:media -- --serial <android-serial>
npm run observability:device:doctor
npm run verify:android:observability -- --serial <android-serial>
npm run verify:android:acceptance -- --serial <android-serial>
npm run verify:android:scan-probe -- --serial <android-serial>
npm run verify:android:scan-complete -- --serial <android-serial>
npm run verify:android:continue-scan -- --serial <android-serial>
npm run verify:android:permission-denied -- --serial <android-serial>
npm run verify:android:scan-cleanup -- --serial <android-serial>
npm run verify:android:recycle -- --serial <android-serial>
npm run verify:android:recycle-delete -- --serial <android-serial>
npm run verify:device:lane -- android <lane> --serial <android-serial>
npm run verify:device:lane:android:emulator-core -- --serial <android-serial>
npm run verify:device:lane:android:emulator-seeded -- --serial <android-serial>
npm run verify:device:lane:android:real-device-core -- --serial <android-serial>
npm run test:agent-device:smoke -- --serial <android-serial>
npm run observability:device:react -- --serial <android-serial>
```

对应脚本：

1. [scripts/android/run-agent-device.sh](../../scripts/android/run-agent-device.sh)
2. [scripts/android/run-agent-device-observability.sh](../../scripts/android/run-agent-device-observability.sh)
3. [scripts/device/run-validation-lane.sh](../../scripts/device/run-validation-lane.sh)
4. [package.json](../../package.json)

默认固定：

1. `agent-device@0.14.7`
2. Android 包名：`com.jt.mistapmediacleaner`
3. Metro 端口：`8081`
4. Session 名：`media-clean-observability`
5. 优先使用仓库内 `node_modules/.bin/agent-device`，仅在本地依赖缺失时回退到 `npx agent-device@0.14.7`

## 可复用 lane 合同

当前验证链已从“单条 Android 命令”上升为“平台无关 lane contract + Android adapter”：

1. lane contract：见 [设备验证 Lane 合同](./device-validation-lanes.md)
2. Android adapter：见 [scripts/device/run-validation-lane.sh](../../scripts/device/run-validation-lane.sh)
3. flow adapter：见 [scripts/android/run-agent-device-observability.sh](../../scripts/android/run-agent-device-observability.sh)

当前约定：

1. `android emulator-core`
2. `android emulator-seeded`
3. `android real-device-core`

当前本地验证状态：

1. `android emulator-core` lane 已在本机 arm64 emulator 上完整 green
2. `android emulator-seeded` lane 已在本机 arm64 emulator 上完整 green
3. `android real-device-core` 已拿到真机 flow 级 artifact，但 workflow 级远端 green 仍未闭环

截至 `2026-05-05` 的最新本地 full lane 证据：

1. `artifacts/device-validation/android/emulator-seeded-final-v3/scan-probe/20260505-031436`
2. `artifacts/device-validation/android/emulator-seeded-final-v3/continue-scan/20260505-031525`
3. `artifacts/device-validation/android/emulator-seeded-final-v3/scan-cleanup/20260505-031653`
4. `artifacts/device-validation/android/emulator-seeded-final-v3/recycle/20260505-031840`
5. `artifacts/device-validation/android/emulator-seeded-final-v3/recycle-delete/20260505-031938`

当前仍未闭环的外部条件：

1. `adb devices -l` 当前仅有 `emulator-5554`，真机 `d28739dc` 尚未回到 `adb`
2. 当前工作分支 `android-pipeline-main-verify` 仍无 upstream，远端尚未出现 `android-agent-device-observability` workflow，因此 GitHub runner 证据仍缺

后续接 iOS 时，优先保持：

1. lane 名称不变
2. artifact 目录结构不变
3. `verify:device:lane -- <platform> <lane>` 命令形态不变

## 标准执行顺序

本地设备观测推荐顺序：

```bash
npm run build:android:debug
npm run verify:android:observability -- --serial <android-serial>
npm run test:agent-device:smoke -- --serial <android-serial>
npm run verify:android:acceptance -- --serial <android-serial>
npm run seed:android:media -- --serial <android-serial> --clean
npm run verify:android:scan-probe -- --serial <android-serial>
npm run verify:android:scan-complete -- --serial <android-serial>
npm run verify:android:continue-scan -- --serial <android-serial>
npm run verify:android:permission-denied -- --serial <android-serial>
npm run seed:android:media -- --serial <android-serial> --clean
npm run verify:android:scan-cleanup -- --serial <android-serial>
```

如果要把回收站与恢复/永久删除流转也纳入同一条可持续设备观测链，推荐继续执行：

```bash
npm run seed:android:recycle-bin -- --serial <android-serial>
npm run verify:android:recycle -- --serial <android-serial>
npm run seed:android:recycle-bin -- --serial <android-serial>
npm run verify:android:recycle-delete -- --serial <android-serial>
```

截至当前仓库状态，这条本地 emulator 观测链已经能稳定覆盖：

1. `acceptance`：首启、Landing -> Main、媒体权限、通知权限、Settings 回流
2. `permission-denied`：首次拒绝媒体权限后的主界面回流与再次引导
3. `scan-probe`：扫描主流程、完成态/结果态判定、分母口径稳定落盘
4. `scan-complete`：真实设备或非 seed 环境下，将一次真实扫描跑到 `result-ready / exhausted / all-complete` 终态，并验证 baseline / result cache 落盘
5. `continue-scan`：当前窗口耗尽后继续扫描历史窗口的 backfill 回流
6. `scan-cleanup`：扫描结果 -> 详情 -> 清理 -> 回收站回流
7. `recycle`：回收站 -> 详情 -> restore -> 回到回收站根界面
8. `recycle-delete`：回收站 -> 详情 -> 系统删除确认框 -> hard delete -> 空态回流

同时，真机基线也已经补到位：

1. 真机 `capture`：已在 Xiaomi `M2102J2SC`（Android 11）上产出基础观测 artifact
2. 真机 `acceptance`：已覆盖 Landing -> Main、MIUI 媒体权限弹窗、Settings、提醒开关与回流
3. 真机 `permission-denied`：已覆盖首次拒绝媒体权限后的主界面回流与再次引导
4. 真机 `scan-probe`：已确认真实媒体枚举后不再立刻落回 `0 assets`
5. 真机 `scan-complete`：已确认真实扫描可到 `result-ready`，并覆盖旧的 `0 assets` 基线
6. 真机 `recycle`：已通过 deterministic recycle seed，覆盖 `RecycleBin -> detail -> restore -> recycle empty` 回流
7. 真机 `recycle-delete`：已通过 deterministic recycle seed + Android 11 删除权限补齐，覆盖 `RecycleBin -> detail -> hard delete -> recycle empty` 回流

GitHub Actions 当前矩阵也已同步到 lane 结构：

1. `static`
2. `android-emulator-core`
3. `android-emulator-seeded`
4. `android-real-device-core`

其中：

1. 前三条已具备可直接在 GitHub runner / emulator 上执行的 workflow 结构
2. `android-real-device-core` 当前通过 `workflow_dispatch + self-hosted` 手动触发
3. 当前仍缺真实远端 green run 证据，因此不能把 workflow 结构存在误判为最终闭环

当前仍保持 emulator-only 的，主要是会主动写入样例媒体或更深样例回收站状态的 `continue-scan / scan-cleanup` 这组 seeded 流程；而 `scan-probe / scan-complete / recycle / recycle-delete` 已同时支持真机真实媒体场景。

如果只想先看环境与设备识别：

```bash
npm run observability:device:doctor -- --serial <android-serial>
```

如果只想补 React 组件树连接证据：

```bash
npm run observability:device:react -- --serial <android-serial>
```

如果后续要把扫描主流程也纳入设备观测，先注入一组固定样例媒体：

```bash
npm run seed:android:media -- --serial <android-serial> --clean
```

如果后续还要验证回收站恢复/永久删除链，则继续执行：

```bash
npm run seed:android:recycle-bin -- --serial <android-serial>
```

它会同时预热两层状态：

1. `files/SQLite/app-cleaner-operational.db` 中的 `recycle_bin_state`
2. `databases/RKStorage` 中的 `app-cleaner/recycle-bin-candidate-cache`

这样 `RecycleBinScreen` 可以在重扫描完成前，立刻展示一条可恢复的候选项，避免设备观测脚本只看到空态。

当前这条 seed 链已经不再单点依赖历史 `photo-scan-session`。若旧 session cache 缺失，它会退回到：

1. operational store 里的 `asset_manifest`
2. 设备侧 `MediaStore`

自动重建一条可恢复候选 fixture，因此在 restore / hard delete 之后，仍可重新执行 `seed:android:recycle-bin` 回填下一轮观测。

`capture` 主链路会自动做这些事情：

1. 检测且只绑定一个 Android 目标，或要求显式 `--serial`。
2. 可选安装 debug APK。
3. `adb reverse tcp:8081 tcp:8081`。
4. `agent-device metro prepare --kind expo`。
5. `open com.jt.mistapmediacleaner --relaunch`。
6. `logs clear --restart`。
7. 采集 `snapshot.json`、`snapshot-interactive.json`、`current-screen.png`、`perf.json`、`network.txt`。
8. 若启用 `--react-devtools`，再补 `react-status.json`、`react-tree.json`、`react-errors.json`。

`smoke` 主链路会在上述基础上继续执行一条最小稳定流转：

1. Landing 页面下滚并进入主界面。
2. 验证主 tab 已出现。
3. 进入 Settings。
4. 验证 `theme-option-dark` / `theme-option-light` / `language-option-zh-CN` / `language-option-en-US` 可见。
5. 切换深色 -> 浅色。
6. 切换中文 -> 英文。
7. 将每一步的 `snapshot` / `snapshot -i` / `screenshot` 产物收进 `steps/` 目录。

`acceptance` 主链路会执行一条更完整、可回放的首启验收流转：

1. 清空应用数据，并 best-effort 回收媒体与通知权限，确保从可复现的首启态开始。
2. 进入 Landing，并通过 CTA 进入主界面。
3. 拉起并处理媒体权限系统弹窗。
4. 验证授权后回流到主界面，而不是回到 Landing。
5. 进入 Settings，切提醒开关。
6. 拉起并处理通知权限系统弹窗。
7. 验证通知权限回流后仍停留在 Settings，而不是把 JS 状态打回 Landing。
8. 将每一步的 `snapshot` / `snapshot -i` / `screenshot` 产物收进 `steps/` 目录。

`scan-probe` 主链路负责扫描主流程，不再混在 acceptance 里：

1. 打开应用，并按需越过 Landing。
2. 若尚未授权媒体权限，则优先将媒体权限拉到可扫描状态；若 UI 未自动刷新，再回退到真实系统授权弹窗。
3. 先用完整 snapshot 做 preflight；若当前扫描窗口已经处于 `scan-all-complete`、`scan-exhausted` 或已有结果态，则直接记录 outcome，而不是强行等待 `photo-grid-start-scan-button`。
4. 只有 preflight 仍是待启动状态时，才在主界面确认 `photo-grid-start-scan-button` 可见后启动扫描。
5. 使用 accessibility snapshot 轮询，而不是单纯依赖 `wait`，判断以下其一：
   `scan-all-complete`、`scan-exhausted`、`scan-running`。
6. 命中 `scan-running` 时，记录当前 segmented counts，并主动取消扫描，保证 probe 有界且可重复。
7. 将扫描 outcome 与 `segmented-count-{all,photo,video}` 摘要写入根目录 `scan-probe-state.json`，并把分步证据收进 `steps/` 目录。

`scan-complete` 主链路复用 `scan-probe` 的前置与持久化断言，但适用于真实设备或当前工作区已有真实媒体的场景：

1. 打开应用，并按需越过 Landing。
2. 若尚未授权媒体权限，则先拉到可扫描状态。
3. 仅当主界面仍处于待启动状态时，点击 `photo-grid-start-scan-button`。
4. 不在 `scan-running` 阶段自动取消，而是持续等待终态：
   `scan-result-ready`、`scan-exhausted`、`scan-all-complete`。
5. 终态后拉取 `app-cleaner-operational.db` 与 `RKStorage`，验证：
   - 最新 batch 为 `completed`
   - `enumerated_count / analyzed_count / candidate_count` 与终态一致
   - `scan_baseline`、`candidate_view_meta`、`photo-scan-result-cache` 在应出现时真实落盘
6. 将终态摘要与持久化快照收进 `persistence/post-scan/*` 与 `steps/` 目录。

`continue-scan` 主链路会在脚本内部自动切换到“当前窗口仅剩 1 张近期图片、其余样例媒体回填到更早窗口”的固定 seed 布局，并覆盖“当前窗口耗尽 -> 继续扫描 -> 命中历史窗口结果”的回流：

1. 自动执行 `seed:android:media --clean --continue-scan-layout`，把近期窗口压缩为 1 张图片，把其余样例媒体移动到下一段历史窗口。
2. 清空应用数据并从首启态进入主界面。
3. 拉起并放行媒体权限系统弹窗。
4. 点击 `photo-grid-start-scan-button`，等待首轮 outcome。
5. 记录首轮 `scan-exhausted` 摘要，并要求 CTA 标签变为 `继续扫描` / `Scan again`。
6. 点击继续扫描 CTA，等待第二轮 outcome。
7. 第二轮若直接命中结果态，则记录 `scan-result-ready`；若仍是空态，也必须验证扫描窗口范围或 segmented counts 已发生推进。
8. 将前后两轮摘要写入根目录 `continue-scan-transition.json`，并把 `scan-exhausted -> continue-scan -> next-window` 的每一步证据收进 `steps/` 目录。

`permission-denied` 主链路会覆盖“首次拒绝媒体权限后的回流与再引导”：

1. 清空应用数据，并 best-effort 回收媒体与通知权限，确保从可复现的首启态开始。
2. 进入 Landing，并通过 CTA 进入主界面。
3. 拉起媒体权限系统弹窗。
4. 点击系统 `Don’t allow` / `Deny` 拒绝按钮。
5. 验证前台回流后仍停留在主界面，并重新出现 `photo-grid-request-permission-button`。
6. 将 `main -> media-permission-dialog -> denied-return` 的每一步证据收进 `steps/` 目录。

`scan-cleanup` 主链路会在已注入固定样例媒体的前提下，覆盖“扫描结果 -> 详情 -> 清理 -> 回收站回流”：

1. 清空应用数据并从首启态进入主界面。
2. 拉起并放行媒体权限系统弹窗。
3. 点击 `photo-grid-start-scan-button`，等待 `scan-all-complete` 或 `scan-exhausted`。
4. 若顶部完成态标题未稳定出现，但 `photo-grid-item` 已出现，则把它视为 `scan-result-ready`，避免死等旧锚点。
5. 若存在扫描结果条目，则优先通过 interactive snapshot 的 `@ref` 打开首个 `photo-grid-item`。
6. 验证详情页中的 `detail-primary-action`。
7. 执行 primary cleanup，并验证回流后可进入 `RecycleBin`。
8. 在回收站中再次观察到条目，证明“扫描清理 -> 回收站”链路打通。
9. 将 `main -> scan -> detail -> cleaned -> recycle` 的每一步证据收进 `steps/` 目录。

`recycle` 主链路会在已注入样例媒体与回收站候选缓存的前提下，执行一条更深的回收站恢复验收流转：

1. 打开应用并确认已越过 Landing。
2. 进入 `RecycleBin` tab，并等待稳定锚点 `recycle-bin-header-title` 出现。
3. 若存在回收站条目，则打开首个 `photo-grid-item`。
4. 验证详情页中的 `detail-primary-action` 与 `detail-hard-delete`。
5. 执行 restore，并验证回流后仍停留在回收站主界面。
6. 将 `main -> recycle -> detail -> restored` 的每一步证据收进 `steps/` 目录。

`recycle-delete` 主链路会复用同一套 seed 状态，并覆盖永久删除验收流转：

1. 打开应用并确认已越过 Landing。
2. 进入 `RecycleBin` tab，并等待稳定锚点 `recycle-bin-header-title` 出现。
3. 若存在回收站条目，则打开首个 `photo-grid-item`。
4. 验证详情页中的 `detail-hard-delete`。
5. 若系统弹出 `Media PermissionActivity` 删除确认框，则点击 `Allow` 放行。
6. 验证删除后回到回收站根界面，并优先命中 `recycle-bin-empty-title`。
7. 将 `main -> recycle -> detail -> confirmation -> deleted-empty` 的每一步证据收进 `steps/` 目录。

`seed:android:media` 会向 emulator 注入一组固定样例媒体并触发 MediaStore 建档：

1. 3 张重复样例图片
2. 1 张高分辨率 PNG 参考图
3. 1 段 MP4 视频

默认模式下，这组样例媒体会全部落在当前 12 个月扫描窗口内，用于 `scan-probe` 与 `scan-cleanup`。

若追加 `--continue-scan-layout`，脚本会自动把：

1. `media-clean-sample-unique-1.jpg` 保留在当前窗口
2. 其余 JPG / PNG / MP4 样例回填到下一段历史窗口

这样 `continue-scan` probe 就能稳定复现“首轮耗尽 -> 第二轮回填命中历史结果”的 backfill 语义。

## 产物约定

每次 `capture` 都会在 `artifacts/agent-device/<timestamp>/` 下生成证据目录。最小产物包括：

1. `devices.json`
2. `apps.json`
3. `metro-runtime.json`
4. `snapshot.json`
5. `snapshot-interactive.json`
6. `current-screen.png`
7. `perf.json`
8. `network.txt`
9. `log-path.txt`
10. `session.log`（若日志路径可拷贝）

若启用 React DevTools：

1. `react-status.json`
2. `react-tree.json`
3. `react-errors.json`

若执行 `smoke`：

1. `steps/01-launch/*`
2. `steps/02-landing-ready/*`（若本次确实经过 Landing）
3. `steps/03-main-tabs/*`
4. `steps/04-settings-ready/*`
5. `steps/05-theme-dark/*`
6. `steps/06-theme-light/*`
7. `steps/07-language-zh/*`
8. `steps/08-language-en/*`

若执行 `acceptance`：

1. `steps/01-landing-ready/*`
2. `steps/02-landing-cta/*`
3. `steps/03-main-before-media-permission/*`
4. `steps/04-media-permission-dialog/*`
5. `steps/05-main-after-media-allow/*`
6. `steps/06-settings-before-reminder-toggle/*`
7. `steps/07-notification-permission-dialog/*`
8. `steps/08-settings-after-notification-allow/*`

若执行 `scan-probe`：

1. `steps/01-landing-ready/*`（仅在本次确实经过 Landing 时出现）
2. `steps/02-landing-cta/*`（仅在本次确实经过 Landing 时出现）
3. `steps/03-main-before-media-permission/*`（仅在本次确实需要媒体权限兜底时出现）
4. `steps/04-media-permission-dialog/*`（仅在兜底 grant 未触发 UI 刷新、转而走真实系统弹窗时出现）
5. `steps/05-main-ready/*`
6. `steps/06-scan-started/*`（仅在当前页面还处于可点击的 start-scan 状态时出现）
7. `steps/07-scan-all-complete/*` 或 `steps/07-scan-exhausted/*` 或 `steps/07-scan-running/*`
8. `steps/08-scan-cancelled/*`（仅在扫描仍在进行时出现）
9. `steps/*/scan-probe-state.json`：记录 outcome 与 `segmented-count-{all,photo,video}` 摘要

若执行 `continue-scan`：

1. `steps/01-landing-ready/*`
2. `steps/02-landing-cta/*`
3. `steps/03-main-before-media-permission/*`
4. `steps/04-media-permission-dialog/*`
5. `steps/05-main-after-media-allow/*`
6. `steps/06-first-scan-started/*`
7. `steps/07-scan-exhausted/*`
8. `steps/08-continue-scan-started/*`
9. `steps/09-scan-result-ready/*` 或 `steps/09-scan-exhausted/*`
10. `continue-scan-transition.json`：记录首轮与第二轮的 outcome、range label、CTA 标签和 segmented counts

若执行 `permission-denied`：

1. `steps/01-landing-ready/*`
2. `steps/02-landing-cta/*`
3. `steps/03-main-before-media-permission/*`
4. `steps/04-media-permission-dialog/*`
5. `steps/05-main-after-media-deny/*`

若执行 `scan-cleanup`：

1. `steps/01-landing-ready/*`
2. `steps/02-landing-cta/*`
3. `steps/03-main-before-media-permission/*`
4. `steps/04-media-permission-dialog/*`
5. `steps/05-main-after-media-allow/*`
6. `steps/06-scan-all-complete/*`、`steps/06-scan-exhausted/*` 或 `steps/06-scan-result-ready/*`
7. `steps/07-scan-result-item-visible/*`
8. `steps/08-scan-detail/*`
9. `steps/09-recycle-bin/*`
10. `steps/10-recycle-item-visible/*`

若执行 `recycle`：

1. `steps/02-main-tabs/*`
2. `steps/03-recycle-bin/*`
3. `steps/04-recycle-item-visible/*` 或 `steps/04-recycle-empty/*`
4. `steps/05-recycle-detail/*`（仅在存在条目时）
5. `steps/06-recycle-restored/*`（仅在 restore 成功后）

若执行 `recycle-delete`：

1. `steps/02-main-tabs/*`
2. `steps/03-recycle-bin/*`
3. `steps/04-recycle-item-visible/*` 或 `steps/04-recycle-empty/*`
4. `steps/05-recycle-detail/*`（仅在存在条目时）
5. `steps/05-recycle-delete-confirmation/*`（仅在系统确认框出现时）
6. `steps/06-recycle-deleted-empty/*` 或 `steps/06-recycle-deleted/*`

## 与 SQLite / 签名验签的关系

`agent-device` 只负责“设备现场证据”，不替代这两层：

1. release APK 是否可信，仍以 [Android 发包契约](./android.md) 和 `artifacts/android-release/*` 为准。
2. 扫描分子/分母、批次是否完成、回收站与恢复 checkpoint 是否一致，仍以 SQLite-backed 状态和对应测试为准。

发生冲突时，固定按这个顺序判断：

1. 签名/metadata 异常：先判定发包链路失败，不进入产品验收。
2. UI 与 SQLite 不一致：记为产品一致性问题，不把截图当真值。
3. 只有截图没有 artifact / checkpoint 对照：证据不足，不得宣称已完成。

## Expo / Android 适配点

当前仓库是 Expo managed + Android-first，`agent-device` 接入必须遵守这些边界：

1. `android/` 是 prebuild 生成物，不把它当长期手工维护入口。
2. 构建仍收敛在 `build-debug-apk.sh` / `build-release-apk.sh`，观测脚本附着在其后。
3. Debug / dev-client 负责快速设备观测；release 构建负责最终发版验收。
4. 设备观测脚本默认单设备，避免多目标串流误判。
5. 当前无 Firebase 远端监控，因此所有关键结论都必须带本地 artifact 路径。

## Xiaomi 与 test-only helper 限制

`agent-device` 在 Android 上依赖 snapshot helper。根据其官方 Android helper README，这个 helper 是 `test-only instrumentation APK`，安装路径需要 `adb install -r -t`。这意味着：

1. 一些 OEM 设备或 provider 会拦 test-only package 安装。
2. Xiaomi / MIUI 上，这类策略和我们在 Maestro driver 上遇到的阻断属于同一类问题。
3. 阻断表现首先应归类为 harness / OEM 安装策略问题，而不是 `Media Clean` 产品本身启动失败。

当前推荐 fallback 顺序：

1. 复用已安装的 helper / driver。
2. 切到 Android emulator 跑 `agent-device` 主观测链。
3. 优先对真机执行 repo-native `capture`、`scan-complete` 这类不依赖 seed 的补验收。
4. Maestro 仅作为次级 smoke，不作为主观测真值。

## CI 入口

当前仓库已新增主 workflow：

1. [.github/workflows/android-agent-device-observability.yml](../../.github/workflows/android-agent-device-observability.yml)

它会：

1. `npm ci`
2. `npm run typecheck -- --pretty false`
3. `npm run test:observability`
4. `bash scripts/android/build-debug-apk.sh --skip-install`
5. 在 emulator 上执行 `npm run verify:android:observability`
6. 在同一台 emulator 上执行 `npm run test:agent-device:smoke`
7. 在同一台 emulator 上执行 `npm run verify:android:acceptance`
8. 注入固定样例媒体后，在同一台 emulator 上执行 `npm run verify:android:scan-probe`
9. 在同一台 emulator 上执行 `npm run verify:android:continue-scan`
10. 在同一台 emulator 上执行 `npm run verify:android:permission-denied`
11. 重新注入标准样例媒体，并执行 `npm run verify:android:scan-cleanup`
12. 注入回收站候选缓存
13. 在同一台 emulator 上执行 `npm run verify:android:recycle`
14. 再次注入回收站候选缓存，并执行 `npm run verify:android:recycle-delete`
15. 若有真机补验收，再执行 `npm run verify:android:scan-complete -- --serial <real-device-serial>`
16. 上传 `artifacts/agent-device/**` 与 debug APK / metadata / signing report

当前保留的 [device-compatibility.yml](../../.github/workflows/device-compatibility.yml) 已被重新定位为 `Legacy Device Compatibility Exploratory`，仅保留 manual / nightly 探索用途，不再作为主 branch gate。

## 与 Maestro 的关系

Maestro 现在保留，但职责变了：

1. `agent-device`：主设备观测层，负责结构化证据。
2. Maestro：次级交互 smoke / fallback。

因此排障顺序应是：

1. 先看 `agent-device` artifact。
2. 再看 SQLite / checkpoint / metadata。
3. 最后才看是否需要用 Maestro 快速复点一个最小流。

## 官方参考

1. GitHub README: <https://github.com/callstackincubator/agent-device>
2. Introduction: <https://incubator.callstack.com/agent-device/docs/introduction>
3. Installation: <https://incubator.callstack.com/agent-device/docs/installation>
4. Debugging & Profiling: <https://incubator.callstack.com/agent-device/docs/debugging-profiling>
5. Replay & E2E: <https://incubator.callstack.com/agent-device/docs/replay-e2e>
6. Known Limitations: <https://incubator.callstack.com/agent-device/docs/known-limitations>
7. Android helper README: <https://github.com/callstackincubator/agent-device/tree/main/android-snapshot-helper>
