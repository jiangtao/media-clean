# Maestro 验证

[English README](./README.en.md)

本目录承接 Android 真机/模拟器上的交互验收 smoke，用来验证：

1. 冷启动能越过启动屏进入产品主流程。
2. 核心导航与设置页交互仍然可用。
3. 语言与主题切换这类高频配置不会在真实设备上回归。

当前 flow：

1. `smoke/landing-and-settings.yaml`

运行方式：

```bash
npm run test:maestro:smoke
```

默认要求：

1. 设备已通过 `adb devices` 可见。
2. 已安装 `com.jt.mistapmediacleaner`。
3. 如果运行的是 debug / dev-client 包，需要先启动 Metro：

```bash
npx expo start --dev-client --clear --port 8081
```

已知设备约束：

1. Xiaomi / MIUI 真机在首次运行 Maestro 时，可能拦截它的 driver app 安装。
2. 如果看到 `INSTALL_FAILED_USER_RESTRICTED`，这通常是设备策略问题，不是产品本身崩了。
3. 处理方式是先在开发者选项中允许 USB 安装 / 调试安装，再重新执行 smoke。

Maestro 在本项目中的定位是“交互验收层”，不是唯一真值：

1. UI/导航/权限流程回归，用 Maestro 发现。
2. JS/native 运行时问题，用 `logcat`、Metro 与 crash 证据定位。
3. 扫描进度、批次边界、回收站状态等业务口径问题，回到 SQLite / 存储真值验证。
