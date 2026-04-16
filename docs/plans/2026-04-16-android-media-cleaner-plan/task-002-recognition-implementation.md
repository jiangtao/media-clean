# Task 002 - Recognition Implementation

- depends-on: task-001-recognition-tests.md
- type: implementation

## Goal

实现媒体视觉指标计算、照片/视频评分逻辑、候选项排序与回收站状态持久化。

## Covered BDD

- Short dark video is marked as accidental
- Dark blurry photo is marked as accidental
- User restores a soft-deleted candidate

## Verification

```bash
npm run test -- --run
npx tsc --noEmit
```
