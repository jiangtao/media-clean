# Electron Desktop 发布契约

[English Version](./electron-desktop.en.md)

本文档定义 Media Clean Electron Desktop 从开发态进入产品化发布态前必须补齐的 build、包体积、远端更新、workflow 与版本策略。当前 `apps/desktop/` 仍是桌面端孵化实现，已经具备 renderer build、Electron smoke、packaged-like smoke、托盘后台、SQLite 状态和 Rust N-API 扫描链路；`release-desktop` 已接入 macOS `.dmg` / `.zip` 与 Windows portable zip 发布链路，远端 auto-update provider 仍保持预留状态。

## 当前决策

1. `apps/desktop/` 继续遵守 Electron main / preload / renderer 分层：main 负责系统能力、文件授权、任务编排、通知、托盘和更新检查入口；renderer 只负责产品界面；preload 只暴露 allowlist IPC。
2. “检查版本”当前只读取 Electron App version，并返回 `electron-app / reserved` 占位结果，不访问 GitHub Releases，也不假装已经有远端更新。
3. 正式发布前，Desktop 需要独立发布单元。长期方向与 `docs/research/v0-5-goal-split-execution/repo-release-boundaries.md` 对齐：主 App 仓库孵化 contract，Desktop 产品化后拆成独立 release channel。
4. 版本策略：大版本尽量和 Media Clean 产品线统一；Electron Desktop 可以独立发展小版本和补丁版本。例如产品线进入 `v0.6` 时，Desktop 可发布 `0.6.1-desktop` 或 `0.6.2`，但不能用 Desktop 小版本反向改变 Android / Engine 的大版本语义。

## 本地 build 与 smoke

当前可用入口：

```bash
npm run desktop:preview
npm --prefix apps/desktop run renderer:build
./apps/desktop/node_modules/.bin/tsc -p apps/desktop/tsconfig.json --noEmit
npm run desktop:smoke
cd apps/desktop && npm run package:smoke
npm run release-desktop
npm run desktop:release:windows
```

## Codex Preview 开发验证

开发态可运行 `npm run desktop:preview`，在 Codex Preview 或浏览器里打开以下入口：

1. `http://127.0.0.1:5178/?preview=1&view=scan`
2. `http://127.0.0.1:5178/?preview=1&view=tasks`
3. `http://127.0.0.1:5178/?preview=1&view=review`
4. `http://127.0.0.1:5178/?preview=1&view=about`
5. `http://127.0.0.1:5178/?preview=1&surface=tray`

该入口只注入 renderer mock bridge，用于快速验证 UI、排版、交互、动效和截图回归；它不代表 Electron main、preload、通知、托盘原生行为或 packaged resources。正式发布仍以 `desktop:smoke` 和 `package:smoke` 为准。

发布态前必须保留的验证：

1. renderer 静态构建可离线加载到 `app://app/index.html`。
2. `desktop:smoke` 验证 main / preload / renderer bridge、托盘 island、版本检查占位、通知抑制和桌面端正式 icon 资产。
3. `package:smoke` 验证 packaged-like ASAR、Rust N-API wrapper、child-process worker、多目录扫描、`app://media`、清理 dry-run。
4. smoke 不依赖 Next dev server，不访问 GitHub Release，不弹出真实通知。

## Tray Island 窗口背景

island 不再使用透明大窗口承载。之前 island 后面的“透明背景”来自 Electron 托盘 popover 的透明无边框窗口，现在发布契约改为：

1. main 进程创建 `trayPopoverWindow` 时必须使用 `transparent: false`，不能使用 `#00000000` 透明背景。
2. popover 宽度必须和 island 对齐，当前为 `720px`。
3. 显示 popover 前根据 `.tray-island` 内容高度收紧原生窗口，高度最多 `760px`。
4. renderer 的 `.tray-surface` 不再通过 padding 制造透明外壳；island 必须填满 popover 宽度。
5. smoke 必须断言 popover viewport width 与 island width 基本一致，避免回退成“大透明背景 + 中间小卡片”。

## 正式打包目标

当前 `release-desktop` 覆盖 macOS 与 Windows：

1. macOS `dmg`：用户安装入口。默认走开源免费分发路径，产物会做 ad-hoc codesign 但不做 Apple Developer ID notarization；如果后续有 Apple Developer ID，再通过 workflow 输入切换到 signed-notarized。
2. macOS `zip`：auto-update feed 和回滚入口。
3. Windows portable zip：Windows 首阶段正式分发包，包含 Electron runtime、ASAR、Rust N-API wrapper、scan worker 和 `icon.ico`。它不是 installer，后续再升级到 NSIS / MSI。
4. `latest-mac.yml` / `latest-win.yml` 与 `media-clean-desktop-update-<channel>-<platform>-<arch>.json`：远端更新检查读取的 manifest 源。
5. Launch icon 使用同一份圆角透明产品 logo 派生：macOS 使用 `apps/desktop/assets/icon.icns`，Windows 使用 `apps/desktop/assets/icon.ico`。

## 非 App Store 下载入口

Desktop 第一阶段不走 Mac App Store 或 Microsoft Store。用户下载入口采用“官网固定地址 + GitHub Release 备份地址”的双入口模式，和 Android page download 契约保持一致：

1. 官网固定入口后续接入：
   - macOS：`https://mc.jerret.me/download/media-clean-desktop-macos-arm64.dmg`
   - Windows：`https://mc.jerret.me/download/media-clean-desktop-windows-x64.zip`
2. GitHub Release 备份入口当前由 `release-desktop` 直接发布。桌面端不能使用仓库级 `releases/latest`，因为该入口已经作为 Android latest 备份下载契约；Desktop 必须使用 tag-specific 地址：
   - macOS：`https://github.com/jiangtao/media-clean/releases/download/desktop-v<version>/media-clean-desktop-macos-arm64.dmg`
   - Windows：`https://github.com/jiangtao/media-clean/releases/download/desktop-v<version>/media-clean-desktop-windows-x64.zip`
3. 每次正式发布同时上传版本化资产和 latest 别名资产。版本化资产用于审计、回滚和 checksum 追溯；latest 别名资产用于用户下载按钮。
4. macOS 默认公开 `.dmg` 是开源免费分发包：ad-hoc signed、未 notarized。下载页和 Release notes 必须明确提示首次打开可能触发 Gatekeeper，用户需要先校验 `media-clean-desktop-latest.sha256`，再通过 Control-click / Open 或 System Settings / Privacy & Security / Open Anyway 打开。
5. 如果后续拿到 Apple Developer ID，`release-desktop` 可选择 `signed-notarized` 模式；只有这个模式才需要 `MACOS_CERTIFICATE_BASE64`、`APPLE_ID` 等 secrets，并且 `MACOS_CERTIFICATE_BASE64` 必须是 `.p12` 证书的 base64，不是邮箱地址。
6. Windows 第一阶段是 portable zip，下载页必须标注“解压后运行”，后续接入 Windows code signing 与 NSIS / MSI installer 后再替换默认入口。
7. `media-clean-desktop-latest.sha256` 随 latest 别名资产一起上传，用于下载页和用户侧校验。

后续再补 Linux：

1. Linux：`AppImage` / `deb`，先做 smoke，再决定是否公开发布，Launch icon 使用 `apps/desktop/assets/icons/` 下的多尺寸 PNG。
2. Windows 后续增强：接入 code signing、NSIS / MSI installer 和可选差分更新；在完成签名前，workflow 明确标记 Windows signing / installer 为 reserved。

## Electron icon 与品牌资产

当前 main 进程已经有稳定 icon 加载顺序、macOS Dock icon 应用和 runtime fallback：

1. 运行态优先读取 `icon.png`，确保 Electron `nativeImage` 能直接解码产品 logo。
2. 开发态和 packaged-like smoke 都必须命中 `apps/desktop/assets` 或 ASAR 内 `assets`，不能只依赖仓库根目录 icon，也不能因为 `.icns` 解码失败回退到蓝色 fallback。
3. 如果真实 icon 资产不存在，运行时生成 Media Clean fallback icon，保证窗口、通知、托盘不空白。
4. 运行态和托盘继续使用产品 logo，不生成任务图表；正式 bundle 按平台使用 `.icns`、`.ico` 或多尺寸 PNG。

已落地的正式桌面端资产：

1. `apps/desktop/assets/icon.svg` 直接复用产品 logo 源文件 `page/public/apps/icons/logo.svg`。
2. `apps/desktop/assets/icon.png` 由产品 logo 源文件生成，保留透明圆角，不额外垫白底。
3. `apps/desktop/renderer/public/icon.png` 复用同一份圆角 PNG，用于 island / sidebar 品牌展示。
4. `apps/desktop/assets/icon.icns` 从圆角 PNG 生成，用于 macOS `.app` / `.dmg` / Dock launch icon；macOS `.icns` 只作为正式 bundle icon，不作为 Electron runtime 首选。
5. `apps/desktop/assets/icon.ico` 从圆角 PNG 生成，用于 Windows `nsis` / `msi` launch icon。
6. `apps/desktop/assets/icons/16x16.png`、`32x32.png`、`48x48.png`、`64x64.png`、`128x128.png`、`256x256.png`、`512x512.png`、`1024x1024.png` 均由同一份圆角透明 `icon.png` 派生，用于 Linux `AppImage` / `deb` 和通用打包器图标尺寸。
7. package smoke 会把这些文件复制进 ASAR，并断言实际 Electron 运行态选择的是非空 PNG 产品 logo。

## 包体积治理

Electron Desktop 的体积风险主要来自 Electron runtime、renderer bundle、ASAR、Rust N-API native binary、重复 node_modules 和 sourcemap。

发布前必须增加 size report：

1. 输出 `.dmg`、`.zip`、unpacked app、ASAR、native resources 分项体积。
2. 输出 top-level 文件体积分布，至少列出 top 20。
3. 检查 renderer sourcemap、测试 fixture、重复 `node_modules`、未压缩 native binary 是否被打入正式包。
4. 检查 `packages/media-clean-engine` 只复制运行时必需文件，不复制 Rust target/debug、源码级 fixture 或 build cache。

建议首轮预算：

| 产物 | Warning | Fail |
| --- | ---: | ---: |
| macOS `.zip` | 180 MiB | 220 MiB |
| macOS `.dmg` | 190 MiB | 240 MiB |
| `app.asar` | 25 MiB | 40 MiB |
| packaged engine resources | 60 MiB | 100 MiB |

这些预算是初始门槛，正式数据出来后再收紧。

当前 macOS release 脚本会生成：

1. `artifacts/desktop-release/media-clean-desktop-v<version>-mac-<arch>.dmg`
2. `artifacts/desktop-release/media-clean-desktop-v<version>-mac-<arch>.zip`
3. `artifacts/desktop-release/media-clean-desktop-v<version>.sha256`
4. `artifacts/desktop-release/media-clean-desktop-v<version>.metadata.json`
5. `artifacts/desktop-release/media-clean-desktop-v<version>.size-report.json`
6. `artifacts/desktop-release/media-clean-desktop-v<version>.size-report.md`
7. `artifacts/desktop-release/media-clean-desktop-update-<channel>-mac-<arch>.json`
8. `artifacts/desktop-release/latest-mac.yml`
9. `artifacts/desktop-release/media-clean-desktop-macos-<arch>.dmg`：GitHub Release latest 备份下载别名，由 workflow 发布阶段复制生成。
10. `artifacts/desktop-release/media-clean-desktop-macos-<arch>.zip`：GitHub Release latest 更新/回滚别名，由 workflow 发布阶段复制生成。

当前 Windows release 脚本会生成：

1. `artifacts/desktop-release/media-clean-desktop-v<version>-win-<arch>.zip`
2. `artifacts/desktop-release/media-clean-desktop-v<version>-win-<arch>.sha256`
3. `artifacts/desktop-release/media-clean-desktop-v<version>-win-<arch>.metadata.json`
4. `artifacts/desktop-release/media-clean-desktop-v<version>-win-<arch>.size-report.json`
5. `artifacts/desktop-release/media-clean-desktop-v<version>-win-<arch>.size-report.md`
6. `artifacts/desktop-release/media-clean-desktop-update-<channel>-win-<arch>.json`
7. `artifacts/desktop-release/latest-win.yml`
8. `artifacts/desktop-release/media-clean-desktop-windows-<arch>.zip`：GitHub Release latest 备份下载别名，由 workflow 发布阶段复制生成。

## 远端更新

当前关于页只显示 Electron App 版本检查预留状态。正式接入时应改成：

1. main 进程读取 Electron app version。
2. main 进程读取远端 update manifest，不让 renderer 直接访问发布源。
3. manifest 至少包含 `version`、`channel`、`platform`、`arch`、`url`、`sha256`、`publishedAt`、`releaseNotesUrl`。
4. UI 只表达用户能理解的状态：`当前已是最新版`、`有新版本可安装`、`暂时无法检查更新`。
5. 失败不影响扫描、审阅和清理。

远端发布源可以先使用 GitHub Releases，但实现上必须通过 Electron Desktop 的 update provider 封装，不能把 `api.github.com` 和 repo 名写进 renderer 文案或业务 UI。

## GitHub Actions 路线

正式 workflow 拆分方向：

1. `desktop-pr-check.yml`
   - 触发：PR / push
   - 内容：renderer build、desktop TypeScript、desktop smoke、package smoke 静态检查。

2. `desktop-package-smoke.yml`
   - 触发：manual / nightly
   - 内容：macOS packaged-like smoke、N-API packaging、size report dry-run。

3. `release-desktop.yml`
   - 触发：`workflow_dispatch`
   - 输入：`release_tag`、`release_channel`、`desktop_version`、`macos_distribution`
   - 内容：macOS build，默认发布 ad-hoc signed `.dmg`；选择 `signed-notarized` 时执行 Developer ID sign / notarize；Windows portable zip build；生成 size report；上传 GitHub Release assets；生成 update manifest。

当前已落地 `.github/workflows/release-desktop.yml`。它和 Android release 一样，只允许通过手动 workflow 发布正式桌面版本；本地只做 release smoke 与产物验证，不作为正式分发源。

`release-desktop` 当前分为三个阶段：

1. `resolve-release`：校验 `desktop-v<version>` tag、解析 Desktop version 和 channel。
2. `build-macos-release` / `build-windows-release`：并行产出 macOS 与 Windows release assets。
3. `publish-release`：等待两个平台都成功后创建 tag，并把所有 assets 发布到同一个 GitHub Release。
4. `publish-release` 会额外生成固定文件名 latest 别名，但 GitHub 备份链接必须使用 `releases/download/desktop-v<version>/...`，不能占用仓库级 `releases/latest`。官网固定下载入口后续由 `mc.jerret.me/download/...` 指向当前桌面 tag。

正式 Desktop workflow 默认不需要 Apple 付费账号。`macos_distribution=unsigned` 时不读取任何 Apple signing secrets，会产出开源免费分发用的 ad-hoc signed `.dmg`。

只有 `macos_distribution=signed-notarized` 时，Desktop workflow 才使用独立 secrets，且不复用 Android keystore：

1. `MACOS_CERTIFICATE_BASE64`
2. `MACOS_CERTIFICATE_PASSWORD`
3. `MACOS_CODESIGN_IDENTITY`
4. `APPLE_ID`
5. `APPLE_TEAM_ID`
6. `APPLE_APP_SPECIFIC_PASSWORD`
7. 可选：`MACOS_KEYCHAIN_PASSWORD`

缺少签名或公证 secrets 时，`signed-notarized` workflow 必须失败；默认开源免费分发模式允许发布 ad-hoc signed `.dmg`，但 Release notes、metadata 和 size report 必须标记 `distribution: ad-hoc`，不能伪装成 notarized。

Windows 当前不要求 signing secrets。Windows 产物是明确标记的 portable zip，metadata 和 size report 会写入 `signingStatus: reserved` 与 `installer: reserved`，避免把未签名 installer 当成正式安装包。

## 进程守护

应用内无法阻止其它进程发送 `SIGKILL`，也无法保证系统级强制结束后自己在同一进程内拉起。产品级守护需要交给操作系统：

1. macOS 首阶段使用 LaunchAgent，脚本入口为 `scripts/desktop/install-launch-agent.mjs`。
2. LaunchAgent 使用 `KeepAlive.SuccessfulExit=false`，进程异常退出或被 kill 后由 `launchd` 重新拉起。
3. Electron 正常退出时会写入 `intentional-quit` marker，guardian wrapper 看到该 marker 后退出 `0`，避免用户点击“退出 Media Clean”后被立刻拉起。
4. 安装命令示例：

```bash
node scripts/desktop/install-launch-agent.mjs --install --app "/Applications/Media Clean.app"
node scripts/desktop/install-launch-agent.mjs --status
node scripts/desktop/install-launch-agent.mjs --uninstall
```

该守护能力默认不在开发态强制打开；后续产品化可以在设置页提供“后台守护”开关。

## 发布门禁

进入正式 Desktop release 前，必须满足：

1. `npm run desktop:smoke` 通过。
2. `cd apps/desktop && npm run package:smoke` 通过。
3. 正式包不依赖 Next dev server。
4. 正式包能在无源码目录时启动。
5. scan worker 从 packaged resources 加载 Rust N-API wrapper，而不是从仓库 `target/debug` 或 `packages/media-clean-engine` 源目录加载。
6. 扫描通知可显示，点击通知进入审阅或工作台。
7. 托盘图标和跨平台 launch icon 始终使用产品 logo，不生成任务图表；任务状态只在 island 内容里表达。
8. 关于页版本检查只显示 Electron App 版本与更新状态，不泄露实现细节。
9. 桌面端主窗口、托盘 island、通知、对话框、数字和日期格式必须跟随系统深浅色与系统语言，至少覆盖 `zh-CN` / `en-US`。
10. macOS 默认可公开 ad-hoc signed `.dmg`，但必须同时公开 SHA256、Gatekeeper 首次打开说明和 `distribution: ad-hoc` metadata；如果选择 `signed-notarized`，则必须签名与 notarization 通过后才允许公开。
11. Windows release 必须至少产出 portable zip、checksum、metadata、size report、`latest-win.yml` 和 update manifest。
12. 每次 release 必须上传 checksum、metadata、size report 和 update manifest。
13. 每次 release 必须上传 `media-clean-desktop-macos-<arch>.dmg`、`media-clean-desktop-windows-<arch>.zip` 和 `media-clean-desktop-latest.sha256`，作为用户侧稳定下载入口。

## TODO

1. 增加 `desktop-pr-check.yml` 与 `desktop-package-smoke.yml`。
2. 增加 update provider：先返回本地 reserved，后续接 GitHub Release manifest。
3. 将 LaunchAgent 守护开关接入设置页，并明确默认策略。
4. Windows code signing、NSIS / MSI installer 和 Linux release 继续沿用同一版本和 metadata/update manifest 契约。
