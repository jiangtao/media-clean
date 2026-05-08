# Maestro 验收契约

[English Version](./maestro.en.md)

## 目标

为 `v0.0.1` 保留一层可执行的 Android 交互验收 smoke，覆盖冷启动、主导航和关键设置切换，作为 `agent-device` 主设备观测层之后的次级 fallback。

## 分层定位

1. 构建层：`npm run build:android:debug` / `npm run build:android:release:smoke`
2. 运行时层：`adb logcat`、Metro、native crash
3. 业务真值层：SQLite、扫描批次、回收站与用户决策
4. 主设备观测层：见 [Agent Device 设备观测契约](./agent-device.md)
5. 次级交互 smoke 层：Maestro

Maestro 只回答“用户点出来的流程是否还活着”，不回答“底层为什么坏了”，也不再承担主设备观测职责。

## 当前 smoke 覆盖

当前仓库提供：

1. [`.maestro/smoke/landing-and-settings.yaml`](../../.maestro/smoke/landing-and-settings.yaml)

它覆盖：

1. 启动应用并越过 Landing。
2. 进入主 Tab。
3. 切到设置页。
4. 将语言切到 `en-US` 并断言英文设置文案。
5. 将主题切到 `dark` 再回到 `light`。
6. 把语言切回 `zh-CN`。

## 执行方式

```bash
npm run test:maestro:smoke
```

脚本入口：

1. [scripts/android/run-maestro-smoke.sh](../../scripts/android/run-maestro-smoke.sh)
2. CI workflow: [.github/workflows/android-maestro-smoke.yml](../../.github/workflows/android-maestro-smoke.yml)

## 执行前提

1. `adb devices` 至少存在一个可用 Android 设备。
2. 设备已安装 `com.jt.mistapmediacleaner`。
3. 若验证 debug / dev-client 包，先启动：

```bash
npx expo start --dev-client --clear --port 8081
```

## 已知设备阻断

1. Xiaomi / MIUI 真机上，Maestro 首次执行时可能因为 driver app 首次安装被系统策略拦截。
2. 当前我们在连接设备 `M2102J2SC / Xiaomi / MIUI V125` 上已经真实复现到：

```text
INSTALL_FAILED_USER_RESTRICTED: Install canceled by user
```

3. 这类错误说明交互验收链路被设备策略拦住，不等于 `Media Clean` 产品本身启动失败。
4. 额外确认：本地 `maestro 2.3.0` 即便带 `--no-reinstall-driver`，仍会尝试安装 `maestro-server.apk`，其包名为 `dev.mobile.maestro.test`；因此“设备上已有 `dev.mobile.maestro` driver”并不能绕过这一步。
5. 在当前 Xiaomi / MIUI 真机上，若 `dev.mobile.maestro.test` 未预装，就没有仓库内可脚本化的本地绕过方案；处理方式仍是先在开发者选项里允许 USB 安装 / 调试安装，再重新执行 `npm run test:maestro:smoke`。
6. 若当前设备策略无法放开，仓库内现成 fallback 是 emulator / CI lane，而不是继续在这台真机上重试。

## CI 自动化

仓库内已补充基于 Android emulator 的 Maestro smoke workflow：

1. `.github/workflows/android-maestro-smoke.yml`
2. 使用 `reactivecircus/android-emulator-runner@v2`
3. 先构建 debug APK，再启动 emulator
4. 启动 `expo start --dev-client --clear --port 8081`
5. 通过 `adb reverse` 让 emulator 访问 Metro
6. 运行 `.maestro/smoke/landing-and-settings.yaml`

这条链路的价值在于：

1. 本地 Xiaomi / MIUI 真机若拦截 Maestro driver，CI 仍可独立提供次级交互 smoke 信号。
2. 交互 smoke 仍可进入 PR / 主干自动化，但主设备观测应优先看 `agent-device` artifact。
3. 当真机同时拦截 `dev.mobile.maestro` / `dev.mobile.maestro.test` 安装时，CI emulator 是仓库内唯一稳定可复用的 Maestro 执行路径。

## 下一步推荐补充

1. 首次权限授权 -> 扫描页进入。
2. 扫描中切换 Tab 再返回，验证状态延续。
3. 回收站保留 / 恢复 / 彻底删除。
4. 提醒设置开关与任务不存在时的容错提示。
