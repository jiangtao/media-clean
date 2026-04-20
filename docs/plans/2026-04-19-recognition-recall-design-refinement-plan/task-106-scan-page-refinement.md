# Task 106: 扫描页设计 refinement

## 目标

把扫描入口、进度和完成态收成一张更简洁可信的任务卡。

## 关键动作

1. 合并入口卡、进度轨和结果摘要
2. 减少状态切换时的结构跳变
3. 统一数量、badge 与说明文案语气
4. 去除扫描过程中的闪烁

## 负责人

王朝

## 验证

`npm run test -- --run src/ui/screens/__tests__/PhotoGridScreen.test.tsx src/ui/components/__tests__/ScanProgress.test.tsx`

