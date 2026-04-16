# Android 媒体清理 MVP 执行计划

## Goal

在空仓库中完成一个可运行的 Expo/React Native Android 优先 MVP，覆盖目标文档要求的扫描识别、列表展示、预览、自动清理、选中清理与应用内回收站能力。

## Architecture Summary

- 前端容器：Expo + React Native + TypeScript
- 领域层：误触识别评分与候选项排序
- 服务层：媒体库访问、缩略图生成、图像分析、回收站存储
- UI 层：首页、候选列表、预览弹层、回收站与底部操作栏

## Execution Metadata

- 设计来源：`../2026-04-16-android-media-cleaner-design/`
- 开发方式：BDD 优先，小步验证
- 验证方式：`vitest` + `tsc` + `expo export --platform android`

## Task Files

- [task-001-recognition-tests.md](./task-001-recognition-tests.md)
- [task-002-recognition-implementation.md](./task-002-recognition-implementation.md)
- [task-003-app-flow-tests.md](./task-003-app-flow-tests.md)
- [task-004-app-flow-implementation.md](./task-004-app-flow-implementation.md)
- [task-005-verification.md](./task-005-verification.md)

## BDD Coverage

1. 场景 1、2 由任务 003、004 覆盖。
2. 场景 3、4 由任务 001、002 覆盖。
3. 场景 5、6、7、8 由任务 003、004 覆盖。

## Dependency Chain

1. `task-001` -> `task-002`
2. `task-002` -> `task-003`
3. `task-003` -> `task-004`
4. `task-004` -> `task-005`
