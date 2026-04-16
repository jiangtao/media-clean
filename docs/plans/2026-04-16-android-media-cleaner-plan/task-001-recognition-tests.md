# Task 001 - Recognition Tests

- depends-on: none
- type: test

## Goal

为误触照片/视频识别规则与回收站状态转换建立失败测试。

## Covered BDD

- Short dark video is marked as accidental
- Dark blurry photo is marked as accidental
- User restores a soft-deleted candidate

## Verification

```bash
npm run test -- --run
```
