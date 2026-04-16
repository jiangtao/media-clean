# Task 003 - App Flow Tests

- depends-on: task-002-recognition-implementation.md
- type: test

## Goal

为应用状态机、自动清理、选中清理与回收站恢复流程建立失败测试或最小可验证断言。

## Covered BDD

- User grants media permission and sees scan results
- User denies permission and receives guidance
- User opens a candidate for preview
- Auto cleanup moves high-confidence candidates to recycle bin
- Selected cleanup allows hard delete after confirmation

## Verification

```bash
npm run test -- --run
```
