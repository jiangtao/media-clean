# Android APK 可用性优先优化计划

## 背景

当前目标不是盲目追求最小 APK，而是在每一步优化后都能确认用户功能可用。APK 体积治理必须按阶段推进：每次只改一个主要变量，先生成候选包，再分析体积，再安装到真机验证，最后才决定是否固化为默认 release 策略。

当前事实：

| 项目 | 当前值 | 判断 |
| --- | ---: | --- |
| 最新 debug APK | 191.34 MiB / 200,630,721 bytes | 只作为本地开发验证，不作为用户下载体积目标 |
| main 合并后 release 报告 | 54.130 MiB / 56,759,910 bytes | 当前用户侧可接受基线，低于 60 MiB warning budget |
| 原始线上 universal APK | 97.764 MiB | 主要问题是包含 `x86` / `x86_64` 模拟器 ABI |
| main 合并后 arm64-only 估算 | 40.176 MiB | 高收益，但会影响 32-bit ARM 设备可安装性 |
| merge 前 R8 / resource shrink 候选 | 40.642 MiB | 有收益，但必须重新基于 main-merged 版本验证 |
| merge 前 arm64 + shrink 候选 | 28.909 MiB | 当前最小候选，但不能直接作为正式承诺 |

## 决策原则

1. 用户侧发布包优先看 release APK / AAB，不用 debug APK 判断下载体积。
2. 每个阶段只改一个高影响变量，避免包体变化和功能回归无法归因。
3. 能影响安装兼容性的优化先做候选，不直接默认开启。
4. 能影响运行时行为的优化必须真机安装验证，不能只看构建成功。
5. JS 动态 import、i18n、theme token 主要优化启动路径和治理，不作为 APK 主瘦身手段。
6. 任何新增 native dependency 都必须给出 APK delta、用户价值和回滚方案。

## 统一执行闭环

每一阶段都按同一套步骤执行：

1. 记录当前 `git status --short`，确认本阶段改动范围。
2. 运行静态验证：

   ```bash
   npm run typecheck
   npm test -- --run
   npm run analyze:android:deps
   ```

3. 构建本阶段候选 release APK。
4. 生成 APK size report。
5. 与 baseline / Stage 1 / 上一个阶段生成对比表。
6. 安装到测试机验证。
7. 跑最小可用性验收。
8. 只有体积收益和可用性都通过，才更新 release 默认策略。
9. 若任一验收失败，保留报告并回滚本阶段开关。

## 安装与可用性验收步骤

### 1. Debug 可用性验证

用于确认当前源码功能可打开、可导航、可走核心流程。

```bash
npm run build:android:debug
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
npm run verify:android:acceptance
```

通过条件：

1. `adb install -r` 返回 `Success`。
2. 应用可从桌面启动。
3. 媒体权限流程可进入。
4. 首页、扫描入口、详情页、回收站、设置页可打开。
5. 不出现 JS red screen 或 native crash。

### 2. Release 候选安装验证

用于确认真实发布配置不会因为 shrink、ABI、签名或 native module 变化破坏功能。

如果候选包使用临时 keystore，真机上已有正式签名包时不能直接覆盖安装；需要选择其中一种方式：

1. 在专用测试机上先卸载同包名应用，再安装临时 release。
2. 使用正式 signing chain 构建候选 APK。
3. 后续增加独立测试包名，避免覆盖正式包。

推荐命令：

```bash
npm run build:android:release:smoke
npm run analyze:android:apk -- android/app/build/outputs/apk/release/app-release.apk \
  --out-dir artifacts/apk-size-stages/stage-<n>-<name> \
  --profile user-arm-only \
  --fail-on-budget
adb install -r android/app/build/outputs/apk/release/app-release.apk
```

若遇到 `INSTALL_FAILED_UPDATE_INCOMPATIBLE`，优先判断签名链不一致；不要把它误判成功能回归。

## 阶段计划

### Stage 0：冻结当前可用基线

目标：先拿到一个“当前能安装、能打开、能跑核心流程”的基线，后续每一步都和它比较。

动作：

1. 保留当前 debug 安装结果：191.34 MiB，`versionName=0.0.3`，`versionCode=3`。
2. 重新构建 main-merged Stage 1 release smoke，刷新 `artifacts/android-release/` 报告。
3. 生成 `stage-0-current` 对比记录。

验收：

1. debug APK 真机安装成功。
2. release smoke 体积报告成功生成。
3. `verify:android:acceptance` 至少跑通核心 smoke；如果 MIUI 权限阻断，需要记录为设备门禁，不算功能回归。

预计体积收益：无，作为基线。

### Stage 1：保留双 ARM ABI 作为默认发布策略

目标：正式用户下载 APK 默认只包含 `armeabi-v7a` 和 `arm64-v8a`，不再包含 `x86` / `x86_64`。

动作：

1. 确认 release workflow 默认 `ANDROID_RELEASE_ARCHITECTURES=armeabi-v7a,arm64-v8a`。
2. 用正式或 smoke release 重新构建。
3. 确认 APK 内不存在 `x86` / `x86_64`。
4. 安装验证核心流程。

验收：

1. APK 低于 60 MiB warning budget。
2. APK size report 标记为 non-universal。
3. 真机安装、启动、核心导航通过。
4. page 下载包与 release metadata SHA256 一致。

预计体积：当前 main-merged 报告约 54.130 MiB。

决策：这是当前最稳的默认发布策略。

### Stage 2：完成 icon font 去除候选

目标：移除 `@expo/vector-icons` 对 icon font 的依赖，降低字体资源体积，并减少后续误引入整套字体的风险。

当前状态：工作区已有一段未完成的 `AppIcon` / `DesignIcon` 替换改动，需要先收口、验证，再决定是否移除依赖。

动作：

1. 完成所有 UI icon 调用到 `AppIcon` / SVG primitive 的迁移。
2. 移除 `@expo/vector-icons` direct dependency。
3. 重新构建 debug 和 release smoke。
4. 对比 APK fonts 表，确认 `.ttf` 体积下降。
5. 真机检查所有按钮、tab、筛选、详情页、回收站图标。

验收：

1. `npm run typecheck` 通过。
2. 相关 UI 测试通过。
3. 所有关键图标可见且语义不混乱。
4. release report 中 fonts 体积下降或不再包含 vector icon font。

预计体积收益：约 1 MiB 到 2 MiB，具体以 release report 为准。

决策：收益不是最大，但用户风险低，且能减少后续字体膨胀，适合作为 Stage 1 后的稳定优化。

### Stage 3：评估 arm64-only 用户包

目标：只发布 `arm64-v8a` APK，把用户侧 APK 进一步压到约 40 MiB。

风险：32-bit ARM 设备无法安装。这个不是纯技术优化，而是产品兼容性决策。

动作：

1. 构建 arm64-only release smoke。

   ```bash
   npm run build:android:release:smoke:arm64
   ```

2. 生成 `stage-3-arm64-only` 报告。
3. 在当前真机安装验证。
4. 明确是否仍要支持 32-bit ARM 设备。

验收：

1. APK 只包含 `arm64-v8a`。
2. 当前主力真机安装和核心流程通过。
3. 发布文档明确最低设备要求。
4. 若要保留 32-bit 支持，则此阶段只作为可选下载包，不替换默认包。

预计体积：main-merged 静态估算约 40.176 MiB，需重建确认。

决策：若目标用户基本是近年 Android 手机，这是最高效的继续瘦身项；若要保守兼容，先不默认启用。

### Stage 4：重新验证 R8 / resource shrink

目标：在不影响运行时行为的前提下压缩 dex 和资源。

风险：反射、Expo modules、通知、后台任务、SQLite、媒体扫描、视频缩略图、native scan 都可能被 shrink 误伤。

动作：

1. 基于 main-merged 版本构建 shrink release smoke。

   ```bash
   npm run build:android:release:smoke:shrink
   ```

2. 生成 `stage-4-r8-resource-shrink` 报告。
3. 安装 release 候选包。
4. 跑完整高风险路径：
   - 媒体权限
   - 图片扫描
   - 视频缩略图
   - 详情预览
   - SQLite 持久化
   - 回收站
   - 通知提醒
   - 后台任务注册
   - native scan / resume

验收：

1. APK 体积相对 Stage 1 明确下降。
2. 所有高风险路径通过。
3. 无 native crash。
4. 若失败，记录缺失 keep rule 后回滚开关。

预计体积收益：merge 前双 ARM 候选为 40.642 MiB；main-merged 需要重新实测。

决策：收益高于 icon font，但回归成本也更高，放在 arm64 决策之后或并行做候选验证。

### Stage 5：组合候选 arm64-only + shrink

目标：验证当前已知最小用户包策略。

动作：

```bash
npm run build:android:release:smoke:arm64-shrink
```

验收：

1. 同时满足 Stage 3 和 Stage 4 的全部验收。
2. 不能只因为体积最小就替换默认发布策略。
3. 若默认启用，需要 release note 标明兼容性边界。

预计体积：merge 前候选为 28.909 MiB；main-merged 需要重新实测。

决策：这是最小包候选，不是当前默认策略。

### Stage 6：启动路径与按需加载优化

目标：提升可用性，减少非扫描路径启动成本，但不把它当 APK 主瘦身手段。

候选动作：

1. `analyze-visuals.ts` 中 `expo-image-manipulator`、`expo-video-thumbnails`、`jpeg-js` 改成扫描路径动态 import。
2. 视频播放器保持在详情 / carousel 边界内加载，避免首页路径初始化播放器逻辑。
3. 通知初始化延迟到用户启用提醒或完成 onboarding 后。
4. i18n / theme token 保持 mobile entry 最小引入，不误 import desktop / Electron generated artifacts。

验收：

1. 首屏启动不退化。
2. 扫描路径首次进入时功能正常。
3. JS bundle 体积不显著增长。
4. APK 体积若无明显变化，也视为预期结果。

预计体积收益：APK 下载体积很小或无；主要收益是启动速度和内存。

## 优先级总表

| 优先级 | 阶段 | 体积收益 | 可用性风险 | 是否建议默认启用 |
| --- | --- | ---: | --- | --- |
| P0 | Stage 0 current baseline | 0 | 低 | 是 |
| P0 | Stage 1 双 ARM release | 约 -43.6 MiB vs universal | 低 | 是 |
| P1 | Stage 2 icon font 去除 | 约 -1 到 -2 MiB | 低到中 | 通过后启用 |
| P1 | Stage 3 arm64-only | 约 -14 MiB vs 当前 Stage 1 | 中，影响 32-bit 设备 | 需产品确认 |
| P1 | Stage 4 R8 / resource shrink | 预计 -6 到 -14 MiB | 中到高 | 完整回归后启用 |
| P2 | Stage 5 arm64 + shrink | 最大 | 高 | 作为候选，不直接默认 |
| P2 | Stage 6 JS 按需加载 | APK 收益小 | 低到中 | 以启动性能证据触发 |

## 下一步 TODO

1. 先执行 Stage 0：刷新当前 main-merged release smoke 报告，并保留最新 debug 安装结果。
2. 接着执行 Stage 2：收口当前未完成的 `AppIcon` 迁移，验证后再移除 `@expo/vector-icons`。
3. 同时准备 Stage 3 / Stage 4 候选构建，但默认不替换 release 策略，直到安装和核心流程验证完成。
4. 每阶段完成后更新 `docs/release/android-apk-size-governance-report.md` 的对比表。
