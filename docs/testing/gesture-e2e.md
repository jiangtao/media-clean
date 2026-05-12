# v0.4.1 手势交互 E2E 测试文档

## 概述

本文档描述 v0.4.1 手势交互的分层验证方式：开发中优先使用单测、组件测试、typecheck 和 Expo dev runtime 日志做快反馈；当滑动选中模型、批量 selection API、手势仲裁和 UI 集成全部完成后，再运行最终设备验收。

Maestro 与 agent-device 不是两套互相竞争的真值。Maestro 是手势脚本执行器，回答“用户路径是否还能点通/滑通”；agent-device 是设备观测与证据编排层，回答“真实设备/模拟器上看到什么、日志是否干净、截图和 runtime evidence 是否可留存”。同一台设备同一时间只能由一个自动化工具驱动，不能并发运行。

## 测试功能

1. **滑动批量选中** - 长按进入选择模式后，滑动选中多个照片
2. **图片双指缩放** - 详情页中双指缩放图片

## 验证分层

### 开发中快反馈

开发中的目标是快速发现模型、组件和 runtime 错误，不把端到端设备流程作为阻塞项。

```bash
npm run test -- --run src/ui/hooks/__tests__/useSwipeSelection.test.ts
npm run test -- --run src/ui/components/__tests__/PhotoGrid.test.tsx
npm run test -- --run src/ui/screens/__tests__/PhotoGridScreen.test.tsx
npm run typecheck
```

结合 Expo dev 或调试包做一次手动 smoke：

1. 长按进入选中模式，无红屏。
2. 轻触只切换单项，不打开详情。
3. 横向拖动能批量选择。
4. 从媒体项起手竖向拖动能批量选中。
5. 从媒体项间距、padding 或边缘起手纵向拖动仍能滚动列表。
6. Metro/adb 日志无新增 JS runtime error、gesture handler/reanimated 初始化错误。

### 功能完整后端到端

当功能实现完成后，优先用 agent-device 收集设备观测证据；若需要稳定复现具体手势路径，再用 Maestro 执行脚本。两者串行运行，不并发抢同一台设备。

交互脚本入口：

```bash
npm run test:gesture:swipe
```

该命令保持兼容 `package.json`，入口仍是：

```bash
maestro test .maestro/gesture/swipe-selection.yaml
```

最终 E2E 需要设备或模拟器中至少有一屏以上的扫描结果，建议使用种子媒体或真实媒体，保证当前问题分类中至少 18 个可见候选项。若候选项太少，横向/斜向选择和纵向滚动无法形成有效覆盖。

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

最终滑动选中 E2E 需要扫描结果已经可进入网格页。若当前设备没有结果，`sub-flows/landing-to-scan-results.yaml` 会尝试启动扫描并等待完成。

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

**最终 E2E 覆盖:**

| 行为 | 自动断言 | 截图/人工验收点 |
|------|----------|-----------------|
| 长按进入选中模式 | `photo-grid-close-button`、`photo-selection-toggle-button`、选中标记出现 | `swipe-selection-01-selection-mode` |
| 横向滑动选择 | 选中标记仍可见 | `swipe-selection-02-after-horizontal-swipe` 应显示同一行多项被选中 |
| 媒体项起手竖向滑选 | 选中标记仍可见 | `swipe-selection-03-after-vertical-selection` 应显示竖向范围新增选中项 |
| 边缘/空白起手纵向滚动 | 选中模式控件仍可见 | 对比 `swipe-selection-04-before-edge-scroll` 和 `swipe-selection-05-after-edge-scroll`，确认 selected count 不变化且列表位置发生变化 |
| 斜向矩形选择 | 选中模式控件仍可见 | `swipe-selection-06-after-diagonal-rectangle` 应显示起点到终点构成的矩形区域被选中，不只是对角线路径 |
| 全选后全不选 | 全不选后空心选择指示器仍可见，选中模式仍存在 | `swipe-selection-08-after-deselect-all` 应无可见实心对勾 |
| X 退出选中模式 | `photo-grid-back-button` 可见 | `swipe-selection-09-after-exit-selection-mode` 应隐藏空心选择指示器 |

Maestro 对“精确选中数量”和“矩形区域完整性”的断言能力有限，所以斜向矩形选择、媒体项起手竖滑选择、空白/间距起手滚动需要结合截图与真机人工验收。若截图与预期冲突，继续使用 agent-device/adb 日志定位，不把单次 Maestro 通过视为最终签收。

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
2. 长按任意照片进入选择模式，锚点项应被选中，其他可选项显示空心选择指示器
3. 横向拖动经过同一行多个照片
4. **期望**: 同一行经过区域被批量选中
5. 从媒体项起手明显竖向拖动
6. **期望**: 起点到终点形成的竖向矩形范围被批量选中
7. 从媒体项间距、padding 或边缘起手明显竖向拖动
8. **期望**: 列表滚动，选中数量不变化
9. 从左上向右下斜向拖动
10. **期望**: 起点和终点构成的完整矩形区域被选中，不只选择对角线路径
11. 点击“全选”，再点击“全不选”
12. **期望**: 所有项取消选中，但页面仍保持选中模式
13. 点击左上角 X
14. **期望**: 页面退出选中模式，空心选择指示器隐藏

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
| `swipe-selection.yaml` | 功能完整后的滑动选中最终 E2E |
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

| 层级 | 工具 | 用途 | 不负责 |
|------|------|------|--------|
| 主设备观测层 | agent-device | 编排设备会话、截图、日志、React/Metro/runtime evidence、artifact 留存 | 不替代所有手势路径脚本 |
| 交互脚本层 | Maestro | 执行可复现的 tap/swipe/pinch flow，生成截图 | 不解释根因，不承担 runtime 观测主层 |
| 开发快反馈层 | Vitest + Expo dev runtime | 验证模型、Hook、组件、红屏/runtime warning | 不证明整机最终体验 |

推荐流程：
1. **开发中** 使用单测、组件测试、typecheck、Expo dev runtime 和日志快反馈。
2. **功能完整后** 先跑 agent-device 或手动等价的设备观测，确认目标页可达、日志干净、截图可留存。
3. **需要复现具体手势时** 串行运行 Maestro flow；若 MIUI 真机拦截 Maestro driver，切到 emulator/CI 或手动真机等价验证。
4. **最终签收** 汇总 agent-device artifact、Maestro 截图或手动等价截图、Metro/adb runtime 日志。两者互补，但不并发驱动同一设备。
