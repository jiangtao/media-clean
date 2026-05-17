# v0.4 Team-Mode Board

## 成员职责

- `baozheng`：总控与集成收口，只做规格冻结、优先级裁决、风险升级。
- `gongsunce`：架构裁决，专管状态边界、真值源、是否需要 scoped store。
- `zhanzhao`：`PhotoGrid` 主路径与高风险扫描恢复逻辑负责人。
- `zhanglong`：`Landing + Entry Card + 顶部产品叙事` 负责人。
- `zhaohu`：`Workspace + Detail Flow + 选择/筛选语义` 负责人。
- `wangchao`：`RecycleBin + Settings + theme/i18n` 收口负责人。
- `mahan`：设备适配、验收矩阵、lane 证据和特殊屏抽检负责人。
- `baxianwang`：终验，拒绝“没证据的完成”。

## 波次与文件归属

| Wave | Owner | 主要文件/目录 | 验证 |
| --- | --- | --- | --- |
| 0 | `baozheng + gongsunce` | `docs/plans/2026-05-06-v0-4-ui-team-plan/**` | 文档互链、自审 |
| 1 | `zhanzhao` | `src/ui/screens/photo-grid/**`、必要时接 `src/features/scan/**` | `typecheck` + `PhotoGridScreen.test.tsx` |
| 2 | `zhanglong` | `src/ui/screens/LandingScreen.tsx`、`src/i18n/app-copy.ts` | `LandingScreen.test.tsx` + `app-copy.test.ts` |
| 3 | `zhaohu` | `src/ui/screens/photo-grid/**`、必要时接 `src/ui/components/PhotoGrid.tsx` | `PhotoGrid` / `DetailScreen` / `PhotoGridScreen` 相关测试 |
| 4 | `wangchao` | `src/ui/screens/RecycleBinScreen.tsx`、`src/ui/screens/SettingsScreen.tsx`、`src/theme/app-theme.ts`、`src/i18n/app-copy.ts` | `RecycleBinScreen` / `SettingsScreen` / `app-theme` / `app-copy` |
| 5 | `mahan` | `src/features/compatibility/**`、`src/ui/components/FoldableLayout*`、目标页适配接线 | `screen-adaptation` + 页面级适配测试 + lane evidence |
| 6 | `baozheng + baxianwang` | 全量集成 | 静态门禁 + Android lane + 人工设计核对 |

## 团队规则

1. 不修改 `docs/goal/*`。
2. 不为“看起来更现代”而改变 Android-first 恢复与通知行为。
3. 不新增 Redux / Zustand 等全局状态库，除非 `gongsunce` 明确裁决。
4. 不回退用户已有改动，不清理与当前任务无关的脏状态。
5. 每一波必须给出可执行验证命令或现成证据路径。
6. 若出现 `runtime/build/test` 红灯，先修 P0，再继续 UI polish。

## 当前执行序

1. 先补齐 Wave 0 文档真值源。
2. 优先拆 `PhotoGrid` 控制面，降低 `PhotoGridScreen.tsx` 耦合度。
3. 与控制面无强耦合的 `Landing`、`RecycleBin`、`Settings`、`theme/i18n` 可以并行收口。
4. 设备适配与 lane evidence 不作为“最后再看”的附属项，必须在主功能收口后立即接上。
