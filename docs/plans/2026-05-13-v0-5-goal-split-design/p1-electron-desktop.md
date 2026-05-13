# P1 Electron Desktop 执行方案

## 背景

Electron Desktop 是面向小白用户的桌面产品入口。它不是 P0 的替代路线，而是 P0 Rust Core / CLI 稳定后的产品化表层。

本 goal 依据：

1. [Rust-first 项目分层与发包管理](../../research/project-layering-and-packaging.md)
2. [v0.5 后续目标拆分决策记录](../../research/v0-5-follow-up-goal-split.md)
3. [主题 Token 与 Tailwind 复用方案](../../research/theme-token-tailwind-strategy.md)

## 目标

建立 Electron First 的桌面端工作台，让非技术用户可以完成：

1. 选择本地目录。
2. 扫描媒体。
3. 查看识别候选和原因。
4. 接入本地 LLM review。
5. 生成 cleanup plan。
6. 预览并执行 safe quarantine。

## 非目标

1. 不复制 Rust Core 识别规则。
2. 不在 renderer 直接访问文件系统。
3. 不在 P0 contract 未稳定前做完整 UI 产品化。
4. 不优先切 Tauri。
5. 不把 destructive delete 作为首版能力。

## 依赖

硬依赖：

1. P0 Rust Core。
2. P0 CLI command contract。
3. `@mistap/media-clean-engine` N-API package 或 CLI fallback。

软依赖：

1. P2 theme token generated CSS。
2. P2 i18n namespace。
3. local LLM provider contract。

## 目录方案

从发版和管理角度，完整 Electron Desktop 不建议长期放在当前主应用仓库。推荐先按下面结构设计独立 `media-clean-desktop` 产品仓库；如需在当前仓库做短期 architecture spike，目录可临时映射为 `apps/desktop/`，但不能作为长期发布路径。

```text
media-clean-desktop/
  package.json
  electron/
    main/
      engine-adapter.ts
      cli-fallback.ts
      scan-job-service.ts
      quarantine-service.ts
      llm-provider-service.ts
    preload/
      index.ts
      api.ts
    renderer/
      src/
        App.tsx
        screens/
          ScanWorkspace.tsx
          ReviewWorkspace.tsx
          CleanupPlanScreen.tsx
          SettingsScreen.tsx
        ipc/
        theme/
  tests/

packages/media-clean-engine/
  package.json
  src/
  native/
```

主应用仓库长期只保留：

1. Desktop 方案文档。
2. schema / fixture snapshot。
3. 必要的 engine package consumption 说明。

Desktop 产品仓库负责：

1. Electron packaging。
2. desktop signing。
3. auto-update。
4. native addon bundle。
5. desktop smoke tests。

## 架构边界

### Main process

职责：

1. 目录选择和路径授权。
2. 加载 N-API addon。
3. CLI fallback。
4. scan job lifecycle。
5. quarantine / restore。
6. local LLM provider 调用。
7. artifact 存储。

### Preload

职责：

1. 暴露 typed IPC。
2. 隐藏 Electron / Node 能力。
3. 校验 renderer 请求基本 shape。

### Renderer

职责：

1. 展示 scan progress。
2. 展示 candidate list / cluster detail。
3. 展示 LLM review。
4. 展示 cleanup plan。
5. 触发 dry-run / confirm quarantine。

禁止：

1. renderer 直接 import `fs`。
2. renderer 直接 import `.node` addon。
3. renderer 拼 shell command。

## 分阶段执行

### Phase P1.1: architecture spike

前置条件：

1. P0 CLI command contract 已初步固定。
2. 至少有一个 schema-compatible sample session。

写文件范围：

1. 独立 desktop repo，或当前仓库临时 `apps/desktop/` spike。
2. `packages/media-clean-engine/`
3. `scripts/desktop/`

完成定义：

1. Electron app 能启动空 shell。
2. main / preload / renderer 分层清楚。
3. typed IPC smoke 可运行。
4. 不接真实清理动作。

### Phase P1.2: engine adapter

写文件范围：

1. `engine-adapter.ts`
2. `cli-fallback.ts`
3. `packages/media-clean-engine/`
4. `media_clean_napi/`

能力：

1. 优先 N-API。
2. N-API 不可用时 CLI fallback。
3. 统一返回 `ScanSession`。
4. 错误标准化。

完成定义：

1. native addon load smoke。
2. CLI fallback smoke。
3. sample fixture 能被加载并展示。

### Phase P1.3: scan workspace

写文件范围：

1. renderer `ScanWorkspace`。
2. main `scan-job-service`。
3. preload scan API。

能力：

1. directory picker。
2. scan start / cancel。
3. progress event。
4. session output location。
5. error display。

完成定义：

1. UI 可完成从选目录到 session 生成。
2. cancel 不遗留半成品 destructive action。
3. 大目录扫描不阻塞 renderer。

### Phase P1.4: review and cleanup plan

写文件范围：

1. `ReviewWorkspace`。
2. `CleanupPlanScreen`。
3. `llm-provider-service`。
4. `quarantine-service`。

能力：

1. candidate / cluster 浏览。
2. cleanup reason 展示。
3. local LLM provider 设置。
4. dry-run quarantine preview。
5. operation artifact。

完成定义：

1. cleanup 默认 dry-run。
2. 真正 quarantine 前必须二次确认。
3. operation artifact 可复查。

### Phase P1.5: packaging smoke

写文件范围：

1. Electron build config。
2. native addon packaging。
3. desktop smoke scripts。

完成定义：

1. macOS dev build 可打开。
2. native addon 或 CLI fallback 在 packaged 环境可用。
3. 不要求 Windows/Linux 首轮完整签名发布，但目录结构要预留。

## 安全要求

1. `contextIsolation: true`。
2. `nodeIntegration: false`。
3. IPC allowlist。
4. 所有 path 由 main process 校验。
5. destructive action 默认关闭。
6. quarantine 目录必须可追踪、可恢复。
7. LLM provider 只接本地或用户显式配置 endpoint。

## 验收命令

后续执行计划应新增：

```bash
npm run desktop:dev
npm run desktop:build
npm run desktop:smoke
npm run desktop:package:smoke
```

最低验收：

```bash
npm run typecheck -- --pretty false
npm run desktop:smoke
```

## 工作包建议

### Work Packet: p1-electron-shell

- Owner: 展昭
- Goal: 建立 Electron main/preload/renderer shell。
- Write Scope: 独立 `media-clean-desktop` repo，或当前仓库临时 `apps/desktop/` spike。
- Verification: `npm run desktop:smoke`
- Done When: app 启动、typed IPC 可用。

### Work Packet: p1-engine-adapter

- Owner: 公孙策
- Goal: 设计并实现 N-API / CLI fallback adapter。
- Write Scope: desktop main process adapter、`packages/media-clean-engine/`
- Verification: addon load smoke + CLI fallback smoke。
- Done When: renderer 消费同一 `ScanSession` contract。

### Work Packet: p1-renderer-workbench

- Owner: 王朝
- Goal: 实现 scan / review / cleanup plan 工作台。
- Write Scope: desktop renderer workspace。
- Verification: renderer smoke。
- Done When: sample session 可完整浏览。

### Work Packet: p1-safety-gate

- Owner: 八贤王
- Goal: 验收 dry-run、quarantine、IPC 安全边界。
- Write Scope: tests / docs。
- Verification: desktop smoke + safety checklist。
- Done When: 无 renderer direct fs，无 destructive default。
