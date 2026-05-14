# Android APK 包体积分析最佳实践

## 先校准产物类型

不要直接问“APK 为什么 100MB”，先确认五件事：

1. 是 APK 还是 AAB。
2. 是 debug 还是 release。
3. 是 universal APK 还是 ABI split APK。
4. 是 Play Store / AAB 分发，还是 page 直下载。
5. 是否包含 x86 / x86_64 模拟器 ABI。

对 Media Clean 当前问题，关键不是“功能少为什么大”，而是“用户侧直下载的是 universal APK”。

## 基础命令

下载并确认样本：

```bash
mkdir -p artifacts/apk-size-analysis
curl -L --fail --show-error \
  --output artifacts/apk-size-analysis/android-latest.apk \
  https://mc.jerret.me/download/android-latest.apk

ls -lh artifacts/apk-size-analysis/android-latest.apk
shasum -a 256 artifacts/apk-size-analysis/android-latest.apk
```

按顶层目录汇总：

```bash
zipinfo -l artifacts/apk-size-analysis/android-latest.apk |
  awk '$1 ~ /^-/ {
    name=$10; uncomp=$4; comp=$6;
    if (name ~ /^lib\//) top="lib";
    else if (name ~ /^classes[0-9]*\.dex$/) top="dex";
    else if (name ~ /^assets\//) top="assets";
    else if (name ~ /^res\//) top="res";
    else if (name == "resources.arsc") top="resources.arsc";
    else if (name ~ /^META-INF\//) top="META-INF";
    else top="other";
    cu[top]+=uncomp; cc[top]+=comp; n[top]++;
  }
  END {
    for (k in cc) printf "%s\t%d\t%.2f MiB\t%.2f MiB\n", k, n[k], cu[k]/1024/1024, cc[k]/1024/1024;
  }' | sort -k4,4nr
```

按 ABI 汇总：

```bash
zipinfo -l artifacts/apk-size-analysis/android-latest.apk |
  awk '$10 ~ /^lib\// {
    split($10,p,"/");
    abi=p[2];
    cc[abi]+=$6;
    n[abi]++;
  }
  END {
    for (k in cc) printf "%s\t%d\t%.2f MiB\n", k, n[k], cc[k]/1024/1024;
  }' | sort
```

列出最大 native 库：

```bash
zipinfo -l artifacts/apk-size-analysis/android-latest.apk |
  awk '$10 ~ /^lib\// {
    split($10,p,"/");
    file=p[3];
    cc[file]+=$6;
    n[file]++;
  }
  END {
    for (k in cc) printf "%s\t%d\t%.2f MiB\n", k, n[k], cc[k]/1024/1024;
  }' | sort -k3,3nr | head -30
```

如果 Android build-tools 可用，再补充：

```bash
apkanalyzer apk summary app-release.apk
apkanalyzer apk file-size app-release.apk
apkanalyzer apk download-size app-release.apk
```

本机这次 `apkanalyzer` 失败，原因是 Android SDK 里缺少可定位的 build-tools / `aapt`。因此后续脚本必须保留 ZIP 解析 fallback。

## 判断规则

### 100MB 是否合理

对 Expo / React Native universal APK，接近 100MB 可以解释，但不应作为用户侧长期目标。

本次样本里：

1. APK 文件是 102,513,501 bytes。
2. `lib/` 是 77.37 MiB，占 entry 压缩体积约 79.9%。
3. x86 / x86_64 native lib 是 43.23 MiB。
4. `assets/index.android.bundle` 只有 3.16 MiB。

因此这不是业务 JS 过大，而是 native runtime + ABI 策略导致。

### 优先优化顺序

1. 先去掉用户侧 APK 的 x86 / x86_64。
2. 把体积检查前移到 pre-commit，避免 release workflow 才发现回退。
3. 复扫 direct dependency，移除无 runtime import / config plugin / allowlist 解释的依赖。
4. 再根据设备矩阵评估 `arm64-v8a` 单 ABI。
5. 再开启并验证 R8 / resource shrink。
6. 最后评估 `expo.useLegacyPackaging=true` 和 JS lazy load。

不要先从 i18n、主题 token、文案资源、图片小修小补开始，因为它们不是当前最大头。

## Media Clean 当前高价值动作

### 1. 用户侧 APK 不默认包含 x86 / x86_64

当前 generated `android/gradle.properties`：

```properties
reactNativeArchitectures=armeabi-v7a,arm64-v8a,x86,x86_64
```

建议 release workflow 区分：

1. `universal`：内部验证 artifact。
2. `arm-only`：用户侧 page 下载 artifact。
3. `arm64-v8a`：未来主下载候选。

实测收益：

1. 删除 x86 / x86_64，保留 `armeabi-v7a,arm64-v8a`：97.764 MiB -> 47.291 MiB，节省 50.473 MiB。
2. 只保留 `arm64-v8a`：97.764 MiB -> 35.558 MiB，节省 62.206 MiB。
3. `arm64-v8a` 不是默认技术开关，需要产品确认不再支持 32-bit ARM。

### 2. 明确 native lib compression 策略

当前 generated `android/gradle.properties`：

```properties
expo.useLegacyPackaging=false
```

这会让 native `.so` 在 APK 内以未压缩形式存储。本次把 `lib/` 单独压缩估算后，77.37 MiB 的 native lib 可压到约 28MB。

这不是可以无脑开启的选项。需要验证：

1. 安装成功。
2. 首次启动时间。
3. 低端设备启动表现。
4. Android 版本兼容性。
5. release 签名和 page 下载一致性。

### 3. 开启 R8 / resource shrink 前先做兼容测试

当前 generated `android/app/build.gradle`：

```groovy
shrinkResources false
minifyEnabled false
```

建议作为 P2 优化项，而不是第一刀。本地 release smoke 已经证明它有收益：

1. 双 ABI + R8/resource shrink：47.291 MiB -> 40.642 MiB，额外节省 6.649 MiB。
2. `arm64-v8a` + R8/resource shrink：35.558 MiB -> 28.909 MiB，额外节省 6.649 MiB。
3. 主要收益来自 dex：10.817 MiB -> 4.452 MiB。

开启后必须覆盖：

1. media library permission。
2. notifications。
3. background scan foreground service。
4. SQLite operational store。
5. expo-image / expo-video preview。
6. Android native scan modules。

在这些路径完成正式签名 APK 真机回归前，不要把 R8 / resource shrink 设成默认 release。

### 4. 依赖引入必须写体积说明

新增或升级以下类型依赖时必须触发体积审查：

1. Expo native modules。
2. React Native native modules。
3. image / video codec。
4. ML / OCR / vision 模型。
5. SQLite / database engine。
6. icon font / full font family。

当前样本中的重要 native 体积来源包括 RN runtime、Hermes、Expo SQLite、Expo modules core、AVIF/image codecs、Reanimated / Worklets。

## i18n / 多 token 的体积关系

当前 P2 方案对减少 APK 体积没有直接帮助。

可能影响：

1. i18n resource 会进入 JS bundle，正常是小量增长。
2. theme token generated output 如果只服务 RN theme，增长很小。
3. 如果把 Electron CSS、Tailwind 全量输出、文档表、调试数据误 import 到 mobile entry，才会导致不必要增长。

因此 P2 应补充的最佳实践不是“靠 token 瘦身”，而是：

1. mobile entry 禁止 import Electron-only generated artifacts。
2. i18n resource 增量纳入 JS bundle budget。
3. `.ttf` / icon font 体积纳入报告。
4. theme generated output 要分 target：RN / Electron / docs 分目录输出。

## 推荐预算

建议先采用软预算，再收紧：

| 产物 | 目标 | Gate |
| --- | ---: | --- |
| 用户侧 arm64 APK | <= 50MB | warning > 50MB, fail > 60MB |
| 用户侧 arm-only APK | <= 60MB | warning > 60MB, fail > 70MB |
| 内部 universal APK | <= 110MB | warning > 100MB, fail > 120MB |
| JS bundle | <= 5MB | warning > 5MB, fail > 8MB |
| fonts | <= 3MB compressed | warning > 3MB |

## 后续最佳实践支撑清单

1. `scripts/android/analyze-apk-size.mjs`
   - 输入 APK。
   - 输出 Markdown + JSON。
   - 不依赖 Android build-tools。
   - 可选调用 `apkanalyzer`。

2. `docs/release/android-apk-size.md`
   - 记录分析命令、预算、ABI 策略和常见判断。
   - 中文优先，若对外发布则同步英文。

3. Release workflow artifact
   - 上传 `apk-size-report.md`。
   - 上传 `apk-size-report.json`。
   - 在 workflow summary 输出 top 10 native lib。

4. Page contract 扩展
   - 校验 page 下载 APK 的 SHA256。
   - 校验用户侧 APK 不含 x86 / x86_64，除非显式选择 universal。
   - 校验 size budget。

5. Pre-commit 前置 gate
   - `.githooks/pre-commit` 必须调用 `npm run verify:precommit`。
   - hook 先跑 release/page contract 和 analyzer 语法检查。
   - staged files 命中依赖、`app.json`、Android native、release workflow、release 脚本、签名插件时，必须要求已有本地 release smoke APK 并执行 size budget。
   - 本地 SDK 缺失时，不能把问题留到 CI；需要先修 SDK，或在 PR 中明确说明跳过原因和 CI size report 审核责任。

6. Dependency intake checklist
   - 新 native dependency 必须写明用户价值、替代方案、APK 增量、ABI 增量和回滚策略。
   - 新 JS dependency 必须说明是否进入 mobile entry、是否可动态 import、是否有原生 autolinking。
   - icon / font dependency 必须说明实际使用 glyph 范围。
   - `npm run analyze:android:deps` 必须保持通过；确实由 config plugin 或 peer runtime 使用但没有 JS import 的依赖，需要进入 allowlist 并写明原因。

7. Android SDK bootstrap
   - 预装 build-tools、platform-tools、NDK。
   - 避免 release smoke 临时下载 NDK 卡住。
   - `apkanalyzer` 缺失时自动降级到 ZIP fallback。

## 本次补充的知识储备

这次问题暴露的不是单个脚本缺失，而是流程缺了一道“开发前置判断”：

1. 包体积不是 release 后才看的指标；依赖、ABI、native plugin 变更在 commit 前就要触发 size gate。
2. “功能少但 APK 大”要先拆 ABI 和 native `.so`，不要先怀疑业务 JS。
3. Expo / RN 项目里，未使用的 direct dependency 也可能因为 autolinking、config plugin 或 native transitive 进入安装面，需要定期做 import scan。
4. JS 的按需加载不等于 APK 瘦身；如果 native dependency 已进入 APK，只有移除依赖或改变 ABI / packaging 才能减少 APK 下载体积。
5. 本地 SDK bootstrap 也是发布质量的一部分；NDK 缺失会导致前置 gate 形同虚设。
6. 当前最小实测候选是 28.909 MiB，但它叠加了 `arm64-v8a` 和 R8/resource shrink 两个验收前提，不能直接替代默认发布策略。

## 官方参考

1. Android Reduce your app size: https://developer.android.com/topic/performance/reduce-apk-size
2. Android Shrink, obfuscate, and optimize your app: https://developer.android.com/topic/performance/app-optimization/enable-app-optimization
3. Android Studio APK Analyzer: https://developer.android.com/studio/debug/apk-analyzer
4. Expo Analyzing bundles: https://docs.expo.dev/guides/analyzing-bundles/
