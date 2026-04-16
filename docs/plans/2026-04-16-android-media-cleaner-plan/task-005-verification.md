# Task 005 - Verification

- depends-on: task-004-app-flow-implementation.md
- type: verification

## Goal

运行测试、类型检查与 Android 导出，确认 MVP 达到目标文档约束。

## Verification

```bash
npm run test -- --run
npx tsc --noEmit
npx expo export --platform android
```
