# 仓库与发版边界

## 背景

当前仓库定位是主应用仓库，核心交付物是 Android-first React Native App。Rust Core、CLI、Electron Desktop、Codex skill 都和主应用有关，但它们的发版节奏、用户安装方式、CI 产物和维护责任不同。

如果长期都放在主应用仓库，会带来几个问题：

1. Android App 发版会被 CLI / desktop / skill 的 CI 和依赖拖慢。
2. Rust / N-API / Electron 的包体、签名、预构建产物会污染移动 App 仓库。
3. 版本号语义混乱：App version、engine version、CLI version、desktop version 不应强行一致。
4. 权限和发布密钥风险扩大：Android keystore、desktop signing、npm token、skill registry token 不应混在同一个 release pipeline。
5. 后续多人并行时，UI、engine、desktop、skill 会在同一仓库制造大量无关冲突。

## 决策

采用 **主应用仓库孵化 contract，稳定后按发版单元拆出** 的路线。

```text
this repo: app-cleaner
  Android RN app
  Android adapter
  app-specific i18n/theme
  schema snapshot / fixture snapshot
  early Rust Core incubation only until extraction gate

future repo/package: media-clean-engine
  Rust Core
  CLI
  N-API package
  schema canonical source
  fixtures / parity tests
  GitHub Release binaries
  npm package

future repo/app: media-clean-desktop
  Electron Desktop product
  desktop packaging / signing / updater
  consumes media-clean-engine

future repo/package: media-clean-skill
  Codex skill wrapper
  skill templates
  consumes CLI or npm package
```

## 留在主应用仓库的内容

长期保留：

1. Android / RN 主应用。
2. Android native adapter。
3. App-specific i18n、theme、settings、navigation、screens。
4. 与 App 行为强相关的测试。
5. 已发布 engine contract 的 snapshot fixture，用于 App 回归。

短期孵化：

1. `engines/recognition-rust` 的初始 Rust Core / CLI skeleton。
2. `schemas/media-clean-result.schema.json`。
3. `fixtures/media-clean-result/`。
4. parity scripts。

短期孵化的原因是 Android baseline、schema 和 fixture 都在这里，P0 初期需要贴着主应用验证。

## 稳定后拆出的内容

### `media-clean-engine`

拆出条件：

1. `media_clean_core` 有稳定 public model。
2. `media_clean_cli scan / plan / quarantine --dry-run` contract 固定。
3. `media-clean-result.schema.json` 达到 `v1` 或等价稳定版本。
4. Rust output 与 Android baseline 有 parity report。
5. CLI 可以独立 CI。
6. npm package / binary release 有基础 smoke。

拆出后：

1. engine repo 成为 schema canonical source。
2. App repo 只 pin engine version 和 contract snapshot。
3. Android 未来回流通过 released engine artifact 接入。

### `media-clean-desktop`

拆出条件：

1. P0 CLI 或 N-API 可被稳定消费。
2. Electron main / preload / renderer 的 architecture spike 通过。
3. desktop packaging、signing、auto-update 进入真实产品化。
4. desktop UI 迭代开始独立于 Android App 发布。

拆出后：

1. Desktop repo 消费 `media-clean-engine`。
2. Desktop 有自己的 release channel、签名证书、更新策略和 smoke tests。
3. 主应用仓库只保留文档链接和 contract reference。

### `media-clean-skill`

拆出条件：

1. CLI machine output 稳定。
2. skill wrapper 不再只是 dev smoke。
3. skill 需要独立发布、安装说明、模板和示例。

拆出后：

1. Skill repo 消费 `media-clean-engine` CLI 或 npm package。
2. Skill 不复制识别规则。
3. Skill release 与 Android App release 解耦。

## 发版边界

| 单元 | 仓库归属 | 版本号 | 主要产物 | 发布门禁 |
| --- | --- | --- | --- | --- |
| Android App | 当前主应用仓库 | App version | APK / AAB / page download | typecheck、vitest、Android build、真机验收 |
| Rust Engine / CLI | 先孵化，稳定后拆 `media-clean-engine` | engine semver | Rust binary、npm package、schema | cargo test、schema validation、parity、binary smoke |
| Electron Desktop | 稳定后拆 `media-clean-desktop` | desktop semver | `.dmg` / `.zip` / updater feed | desktop smoke、native addon load、CLI fallback、signing |
| Codex Skill | 稳定后拆 `media-clean-skill` | skill version | skill package / templates | CLI contract smoke、dry-run safety、install smoke |
| i18n/theme governance | 当前主应用仓库 | app/internal themeVersion | generated RN theme、Electron CSS export | typecheck、i18n resources、theme token verifier |

## 当前阶段怎么做

当前阶段不立刻拆仓，因为 P0 还需要贴近 Android baseline：

1. Rust Core / CLI 先在主应用仓库孵化。
2. 目录边界必须按未来拆仓设计，避免写死 App 依赖。
3. Electron Desktop 只做方案和后置 spike，不在主应用仓库承载完整发布态产品。
4. P2 i18n/theme 留在主应用仓库，因为它是 App UI 治理。
5. 一旦 P0 达到 extraction gate，优先拆 `media-clean-engine`，再推进 Desktop / skill 独立产品线。

## 结论

不建议把所有内容长期放在这个主应用仓库。

推荐路线：

```text
现在:
  App repo incubates Rust Core / CLI contract
  App repo owns P2 i18n/theme

P0 稳定后:
  Extract media-clean-engine
  App repo consumes released engine / schema snapshot

P1 产品化时:
  Build media-clean-desktop separately
  Consume media-clean-engine

Skill 发布时:
  Build media-clean-skill separately
  Consume CLI / npm package
```

这样管理成本最低，发版边界清楚，也不会让主应用仓库失控膨胀。
