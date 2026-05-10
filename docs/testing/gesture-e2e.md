# v0.4.1 手势交互 E2E 测试文档

## 概述

本文档描述如何使用 Maestro 测试 v0.4.1 的交互优化功能。

## 测试功能

1. **滑动批量选中** - 长按进入选择模式后，滑动选中多个照片
2. **图片双指缩放** - 详情页中双指缩放图片

## 前置条件

### 环境要求

- Android 设备（Android 10+）或模拟器
- USB 调试已启用
- Maestro CLI 已安装

```bash
# 安装 Maestro
curl -fsSL "https://get.maestro.mobile.dev" | bash

# 确认安装
maestro --version
```

### 准备测试数据

```bash
# 安装 APK（首次）
npm run build:android:debug

# 或使用种子数据填充媒体库
bash scripts/android/seed-emulator-media.sh
```

## 运行测试

### 1. 滑动批量选中测试

```bash
# 启动模拟器或连接真机
adb devices

# 运行滑动选择测试
npm run test:gesture:swipe

# 或使用特定设备
maestro --device YOUR_DEVICE test .maestro/gesture/swipe-selection.yaml
```

**测试步骤:**
1. 导航到扫描结果页
2. 长按第一个网格项进入选择模式
3. 向右滑动选中多个项
4. 验证选中标记出现

### 2. 图片缩放测试

```bash
npm run test:gesture:zoom
```

**测试步骤:**
1. 导航到扫描结果页
2. 点击第一个网格项打开详情页
3. 双击图片测试缩放
4. 拖动图片测试平移
5. 验证详情页保持打开
6. 关闭详情页返回

### 3. 完整测试套件

```bash
npm run test:gesture:all
```

## 手动测试指南

### 滑动批量选中

1. 打开 App，进入扫描结果页
2. 长按任意照片进入选择模式（出现选择指示器）
3. 保持手指按住，滑动到其他照片
4. **期望**: 滑动经过的照片被批量选中
5. **期望**: 右上角显示选中数量

### 图片双指缩放

1. 点击任意照片进入详情页
2. 双指张开放大图片
3. **期望**: 图片放大，最大 3x
4. 拖动移动图片位置
5. **期望**: 图片跟随手指移动
6. 双指收缩到小于原大小时松开
7. **期望**: 图片自动回弹到 1x
8. 双击图片
9. **期望**: 如果已放大则重置到 1x，否则放大到 2x

## Maestro 测试文件

| 文件 | 描述 |
|------|------|
| `swipe-selection.yaml` | 滑动批量选中测试 |
| `pinch-zoom.yaml` | 图片缩放测试 |
| `gesture-suite.yaml` | 完整测试套件 |
| `sub-flows/landing-to-scan-results.yaml` | 导航子流程 |
| `sub-flows/start-scan-and-wait.yaml` | 启动扫描子流程 |
| `sub-flows/check-scan-complete.yaml` | 检查扫描完成子流程 |

## CI/CD 集成

可在 GitHub Actions 中使用：

```yaml
- name: Run Gesture E2E Tests
  run: |
    maestro test .maestro/gesture/gesture-suite.yaml
  env:
    MAESTRO_DEVICE_SERIAL: emulator-5554
```

## 故障排查

### Maestro 未安装

```bash
curl -fsSL "https://get.maestro.mobile.dev" | bash
export PATH="$PATH:$HOME/.maestro/bin"
```

### 设备未连接

```bash
adb devices
# 确认设备已列出且状态为 "device"
```

### 测试失败排查

Maestro 会自动生成截图和日志：

```bash
ls ~/.maestro/tests/
```

## 与 agent-device 的关系

| 工具 | 用途 | 优势 |
|------|------|------|
| Maestro | 纯 UI 自动化测试 | 支持手势、截图、稳定 |
| agent-device | 深度设备交互 + 日志分析 | 可访问性能数据、React DevTools |

推荐流程：
1. **Maestro** 跑核心功能回归
2. **agent-device** 跑深度观测和诊断
