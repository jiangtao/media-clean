# Task 004 - App Flow Implementation

- depends-on: task-003-app-flow-tests.md
- type: implementation

## Goal

完成 Expo 应用界面、权限流、扫描、预览、自动清理、选中清理与回收站交互实现。

## Covered BDD

- User grants media permission and sees scan results
- User denies permission and receives guidance
- User opens a candidate for preview
- Auto cleanup moves high-confidence candidates to recycle bin
- Selected cleanup allows hard delete after confirmation

## Verification

```bash
npm run test -- --run
npx tsc --noEmit
npx expo export --platform android
```
