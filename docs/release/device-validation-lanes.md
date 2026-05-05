# 设备验证 Lane 合同

[English Version](./device-validation-lanes.en.md)

本文档定义 Media Clean 当前设备验证链的**可复用 lane 合同**。目标不是只服务 Android，而是先用 Android-first 落地一套“平台无关 contract + 平台适配器实现”的结构，后续 iOS 直接复用 lane 和 artifact 约定。

## 目标

1. 把设备验证从“零散命令”收成 lane。
2. 把并行边界说清楚，避免同一设备上的状态互相污染。
3. 让 Android 现在就能跑，iOS 后续直接对齐 contract。

## 分层

1. **Lane contract 层**
   - 定义验证分组、输入参数、artifact 目录和并行边界。
2. **Platform adapter 层**
   - Android 当前由 [scripts/device/run-validation-lane.sh](../../scripts/device/run-validation-lane.sh) 分发到 [scripts/android/run-agent-device-observability.sh](../../scripts/android/run-agent-device-observability.sh)。
   - iOS 当前只预留 contract，尚未实现 adapter。
3. **Flow probe 层**
   - `capture`、`acceptance`、`permission-denied`
   - `scan-probe`、`scan-complete`
   - `continue-scan`、`scan-cleanup`
   - `recycle`、`recycle-delete`

## 当前入口

```bash
npm run verify:device:lane -- android emulator-core --serial <serial>
npm run verify:device:lane -- android emulator-seeded --serial <serial>
npm run verify:device:lane -- android real-device-core --serial <serial>

npm run verify:device:lane:android:emulator-core -- --serial <serial>
npm run verify:device:lane:android:emulator-seeded -- --serial <serial>
npm run verify:device:lane:android:real-device-core -- --serial <serial>
```

## Lane 定义

### `android emulator-core`

适合“无 seed、无真实媒体依赖”的基础 UI/权限流。

包含：

1. `capture`
2. `smoke`
3. `acceptance`
4. `permission-denied`

默认 artifact 根目录：

```text
artifacts/device-validation/android/emulator-core/
```

### `android emulator-seeded`

适合 deterministic seeded flow，依赖脚本写入样例媒体或样例回收站状态。

包含：

1. `seed:android:media --clean`
2. `scan-probe`
3. `continue-scan`
4. `seed:android:media --clean`
5. `scan-cleanup`
6. `seed:android:recycle-bin`
7. `recycle`
8. `seed:android:recycle-bin`
9. `recycle-delete`

默认 artifact 根目录：

```text
artifacts/device-validation/android/emulator-seeded/
```

### `android real-device-core`

适合真实手机上的非 seed 主链验证。

包含：

1. `capture`
2. `acceptance`
3. `permission-denied`
4. `scan-probe`
5. `scan-complete`

默认 artifact 根目录：

```text
artifacts/device-validation/android/real-device-core/
```

所有 lane 运行结束后，根目录还会额外写出一个 `lane-summary.json`。它是 lane 级收口文件，至少包含：

1. `platform`
2. `lane`
3. `serial`
4. `status`
5. `exitCode`
6. `lastStep`
7. `artifacts`
8. `completedAt`

手动执行时，推荐把“命令退出码为 `0`”和“`lane-summary.json.status == passed`”一起当作 lane 通过信号。

## 并行规则

### 可以并行的

1. `static` 检查与任何设备 lane
2. `android emulator-core` 与 `android emulator-seeded`
3. `android real-device-core` 与 emulator lane
4. 后续 `ios *` lane 与 Android lane

前提是：

1. **不同 job**
2. **不同 serial / 不同设备**
3. **不同 artifact 目录**
4. **不同 session 名**

### 必须串行的

同一台设备上的这些 flow 必须串行：

1. `scan-probe`
2. `scan-complete`
3. `continue-scan`
4. `scan-cleanup`
5. `recycle`
6. `recycle-delete`

原因：

1. 会改写同一份 app-local 状态
2. 会互相覆盖 `scan_batch`、`scan_baseline`、`candidate_view`
3. 还会共享同一 repo-local `agent-device` state / session / Metro 端口

当前 lane runner 已自动按 `platform + lane + serial` 生成唯一 `--session`，例如：

```text
device-validation-android-emulator-core-emulator-5554
```

若你手工覆写 `--session`，就要自己保证不同 lane 不重名。

## Workflow 推荐矩阵

当前最小可行矩阵：

1. `static`
   - `npm ci`
   - `npm run typecheck -- --pretty false`
   - `npm run test:observability`
2. `android-emulator-core`
   - `npm run verify:device:lane:android:emulator-core -- --serial emulator-5554`
3. `android-emulator-seeded`
   - `npm run verify:device:lane:android:emulator-seeded -- --serial emulator-5554`
4. `android-real-device-core`
   - `workflow_dispatch` 手动触发的 self-hosted runner，或本地直接执行
   - `npm run verify:device:lane:android:real-device-core -- --serial <real-device-serial>`

截至当前仓库状态，这个矩阵里已经拿到的本地强证据是：

1. `android-emulator-core` lane 本地完整 green
2. `android-emulator-seeded` lane 本地完整 green
3. `android-real-device-core` 当前已有本机真机 flow 级 artifact，但 workflow 级远端 green 记录仍缺

## 后续接 iOS 的规则

当 iOS adapter 开始实现时，优先保持以下不变：

1. lane 名称
2. artifact 目录结构
3. `verify:device:lane -- <platform> <lane>` 的命令形态
4. 核心 outcome 命名
   - `result-ready`
   - `exhausted`
   - `all-complete`
   - `running`

变化只应该发生在：

1. 平台 adapter 脚本
2. 权限处理实现
3. 平台专属 seed / reset / foreground 处理

## 当前边界

截至当前仓库状态：

1. lane contract 已落地
2. Android lane runner 已落地
3. GitHub Actions 已拆成 `static / android-emulator-core / android-emulator-seeded`
4. `android real-device-core` 已补成 `workflow_dispatch + self-hosted` 手动 lane 骨架，同时仍支持本机直接执行
5. 当前仍缺 GitHub Actions 远端 green run 证据，不应把 workflow 结构存在误判成最终闭环
6. iOS 还没有 adapter，实现状态应明确标注为“未实现”，不要伪装成已支持
