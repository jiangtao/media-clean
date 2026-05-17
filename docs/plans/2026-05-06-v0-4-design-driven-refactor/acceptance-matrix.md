# 验收矩阵

## 验收原则

1. 先过静态门禁，再上设备。
2. 先过关键 UI/运行时护栏，再做人工设计签收。
3. 只要出现 runtime/build error，立即冻结后续 polish。
4. 设计图签收不是补充项，而是本轮主验收项。
5. 当前模块期覆盖 `Landing / Photos / RecycleBin / Settings`；`Splash` 沿用既有体验。

## 开发期默认验证口径

开发阶段默认不要求先打 APK。日常 UI 重构与联调先走 Expo / RN dev mode：

```bash
npm run start
npm run android
```

适用范围：

1. 设计稿还原
2. 交互节奏调整
3. 文案与层级调整
4. 主题与页面结构重构

以下情况再升级到 Android verify lane：

1. 触及扫描恢复
2. 触及权限回流
3. 触及通知行为
4. 触及回收站删除链路
5. 进入阶段性里程碑验收
6. 进入最终放行

## 一、静态门禁

### 必跑

```bash
npm run typecheck -- --pretty false
npm run test -- --run
```

### 定向护栏

```bash
npm run test -- --run \
  src/ui/screens/__tests__/LandingScreen.test.tsx \
  src/ui/screens/__tests__/PhotoGridScreen.test.tsx \
  src/ui/screens/__tests__/DetailScreen.test.tsx \
  src/ui/screens/__tests__/RecycleBinScreen.test.tsx \
  src/ui/screens/__tests__/SettingsScreen.test.tsx \
  src/services/notifications/scan-completion-notifications.test.ts \
  src/features/compatibility/__tests__/screen-adaptation.test.ts
```

## 二、Android 设备链路

说明：

1. 本节不是开发期每一轮必跑项。
2. 本节用于里程碑验证与最终放行。
3. v0.4 设计签收优先使用 Expo / RN dev mode，不要求打 APK。
4. 只有显式带 `--install-apk` 的脚本才进入 APK 安装路径；本轮设计稿签收包装器默认不安装 APK。

### v0.4 设计签收包装器

在已通过 `npm run start` 与 `npm run android` 打开开发态 App 后，可用一个入口串起 `Photos / RecycleBin / Settings` 的 SE、非 SE、深色和异形屏 emulator 签收：

```bash
npm run verify:android:v0-4-design-signoff
```

需要先查看矩阵但不执行设备操作时：

```bash
npm run verify:android:v0-4-design-signoff -- --dry-run
```

连接物理 Android 真机后，使用真机专用入口补特殊屏现场。该入口要求目标必须是真机/非 emulator；如果误连 emulator 会直接失败。它不做 emulator 的 SE / cutout override，也默认跳过 Maestro，只跑当前尺寸浅色、`scan-complete` 和当前尺寸深色签收，并在退出时恢复设备主题：

```bash
npm run verify:android:v0-4-physical-signoff -- --serial <device-serial>
```

如果只想预览真机分支：

```bash
V0_4_DRY_RUN_QEMU=0 npm run verify:android:v0-4-physical-signoff -- --dry-run --skip-scan-complete
```

如需在真机上额外跑 Maestro smoke，请单独执行 `npm run test:maestro:smoke`，不要把它作为特殊屏视觉签收的默认前置条件。

### 主链路顺序

1. 首启/权限回流：

```bash
npm run verify:android:acceptance
```

2. 扫描主路径：

```bash
npm run verify:android:scan-complete
npm run verify:android:continue-scan
npm run verify:android:filtering-selection
```

3. 回收站主路径：

```bash
npm run verify:android:recycle
npm run verify:android:recycle-selection
npm run verify:android:recycle-delete
```

4. Settings 设计签收：

```bash
npm run verify:android:settings-signoff
```

5. 次级交互 smoke：

```bash
npm run test:maestro:smoke
```

## 三、人工设计签收

### 逐屏签收要求

当前活动范围每页必须同时对照 `light` 与 `dark` 对应设计稿：

1. `01 landing`
2. `02 scanning`
3. `03 result`
4. `04 filtering`
5. `05 recycle`
6. `06 settings`

补充说明：

1. `00 splash` 沿用既有启动体验，只保留回归基线，不作为本轮主签收页。
2. `06 settings` 设计稿已稳定，恢复为本轮逐屏签收页；通过前需有浅/深色运行态截图与偏好回归证据。

### SE 与非 SE 签收要求

设计稿是 SE 尺寸基准。每个主要页面必须完成两类签收：

1. SE 签收：在 SE 级别窄屏画布上对照设计稿结构、密度、底部操作区和层级。
2. 非 SE 签收：在至少一类非 SE 尺寸上验证响应式映射，包括安全区、内容最大宽度、网格列数和底部操作区。

重点页面：

1. `02 scanning`
2. `03 result`
3. `04 filtering`
4. `05 recycle`
5. `06 settings`

### 每页检查项

1. 结构是否与设计稿一致
2. 标题层级是否一致
3. 操作区位置与权重是否一致
4. 组件间距是否明显偏离
5. 浅色与深色映射是否都成立
6. 中文与英文是否都可读
7. 是否存在按设计稿导出像素硬编码的尺寸
8. 非 SE 设备上是否保持可读、可点、可判断

### 运行态补充要求

以下页面不能只对静态 JSX，必须补运行态截图：

1. `02 scanning`
2. `03 result`
3. `04 filtering`
4. `05 recycle`
5. `06 settings`

## 四、异形屏与特殊屏抽检

至少覆盖：

1. `1` 台打孔屏或刘海屏
2. `1` 台横屏、大屏或折叠态设备

抽检项：

1. 顶部标题与状态区不被遮挡
2. 底部 tab 与操作区不误触
3. 详情页关闭、翻页、底部操作区可达
4. 回收站与 Photos 工作台的卡片与分组不贴边变形
5. Settings 分组、开关、语言/主题控件和提醒设置不贴边、不遮挡、可触达

## 五、文案与体验终验

### `clarify` 终验对象

1. Landing 主叙事
2. Photos 扫描说明
3. 结果摘要说明
4. 回收站空态与统计说明
5. Settings 设置项说明、语言/主题切换、提醒偏好说明与高风险动作解释

### 通过条件

1. 用户一眼能理解当前状态
2. 用户知道下一步该做什么
3. 没有明显技术口吻或翻译腔
4. 中文与英文表达都自然

## 六、最终放行条件

以下条件必须同时满足：

1. 静态门禁通过
2. 定向护栏通过
3. Android 设备链路通过
4. 设计图人工签收通过
5. 异形屏抽检通过
6. `clarify` 终验通过
7. `06 Settings` 设计签收、文案终验、偏好回归和 Settings-inclusive smoke 均通过
8. 无阻断性 runtime/build error
