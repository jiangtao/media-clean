# 最佳实践

## 背景

三个 goal 可以并行，但并行的前提是边界清楚。后续执行时应按团队模式拆工作包，每个工作包都必须有 owner、写文件范围、验证命令和完成定义。

## 通用原则

1. 不修改 `docs/goal` 原始目标文件。
2. 不把 TypeScript 当作生产扫描 / 识别 engine。
3. 不让 Electron、skill、CLI 各自实现识别规则。
4. 不把 P2 UI 治理和 P0 algorithm migration 混到一个 PR。
5. 不在 schema 未稳定时推进完整 Electron renderer UI。
6. 所有 destructive cleanup 默认 dry-run。
7. 所有跨端输出必须经过 schema / fixture / parity 验证。

## Worktree 和分支建议

建议三个 goal 使用独立 worktree 或至少独立分支：

```text
goal/p0-rust-core-cli
goal/p1-electron-desktop
goal/p2-i18n-theme-governance
```

分支之间只通过明确 contract 交接：

1. schema。
2. fixture。
3. CLI command。
4. npm package interface。
5. theme token output。
6. i18n namespace schema。

## 文件所有权

### P0 Rust Core 和 CLI

主要写范围：

1. `engines/recognition-rust/`
2. `schemas/`
3. `fixtures/media-clean-result/`
4. `scripts/scan/`
5. `package.json` scripts
6. Android parity 相关测试，后置进入 `src/features/scan/`

不应写：

1. Electron renderer UI。
2. RN screen UI。
3. i18n/theme 大迁移。

### P1 Electron Desktop

主要写范围：

1. 独立 `media-clean-desktop` repo，或当前仓库临时 `apps/desktop/` spike。
2. `packages/media-clean-engine/`，仅限 engine handoff 或 npm wrapper。
3. `engines/recognition-rust/crates/media_clean_napi/`
4. `scripts/desktop/`
5. theme generated output 的消费侧。

不应写：

1. Rust Core 算法规则。
2. Android native executor。
3. i18n/theme source token。

### P2 多语言、多主题重构

主要写范围：

1. `src/i18n/`
2. `src/theme/`
3. `scripts/i18n/`
4. `scripts/theme/`
5. UI tests 中的 copy/theme mock。

不应写：

1. `engines/recognition-rust/`
2. Electron main process。
3. Android native scan algorithm。

## 验证纪律

P0 最低验证：

```bash
cargo test --manifest-path engines/recognition-rust/Cargo.toml
npm run verify:schema:media-clean-result
npm run verify:desktop-go:scan
npm run typecheck -- --pretty false
```

P1 最低验证：

```bash
npm run desktop:smoke
npm run desktop:build
npm run typecheck -- --pretty false
```

如果脚本尚未存在，执行计划必须包含新增脚本任务。

P2 最低验证：

```bash
npm run typecheck -- --pretty false
npm run test -- --run src/i18n src/theme
npm run verify:i18n:resources
npm run verify:theme:tokens
```

如果 `verify:i18n:resources` 或 `verify:theme:tokens` 尚未存在，执行计划必须先新增验证脚本，再推进大规模迁移。

## 团队模式建议

P0 可拆：

1. 公孙策：core/schema 边界审查。
2. 展昭：Rust workspace 和 `media_clean_core`。
3. 王朝：`media_clean_cli` 和 machine output。
4. 张龙：fixture / parity / scripts。
5. 八贤王：schema、cargo、CLI smoke 验收。

P1 可拆：

1. 公孙策：Electron security / IPC boundary。
2. 展昭：main process engine adapter。
3. 王朝：renderer workbench。
4. 赵虎：packaging / native addon smoke。
5. 八贤王：dry-run safety 和 packaged smoke。

P2 可拆：

1. 张龙：i18n namespace。
2. 马汉：theme token / generated artifacts。
3. 赵虎：UI hardcoded cleanup。
4. 八贤王：功能等价和 visual regression signoff。

## 交接规则

1. P0 给 P1 的交接物是 schema、CLI command、N-API package API、sample session。
2. P2 给 P1 的交接物是 theme CSS variables、Tailwind `@theme` 输出、i18n namespace schema。
3. P1 不得要求 P2 先完成全部治理才能开始 architecture spike。
4. P2 不得要求 P0 修改 algorithm schema 来适配 UI copy。
5. 完整 Electron Desktop 发布态不长期留在主应用仓库，应按 [仓库与发版边界](./repo-release-boundaries.md) 拆出。
6. 任何跨 goal contract 变化必须先更新本计划包或对应 research doc，再进入实现。
