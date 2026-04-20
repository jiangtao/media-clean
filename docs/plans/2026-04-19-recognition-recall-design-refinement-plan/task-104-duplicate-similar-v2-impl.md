# Task 104: Duplicate V2 与 Similar 分层实现

## 目标

把当前“近重复”提升为“完全重复 / 近重复 / 相似”三层能力。

## 关键动作

1. 双层指纹与疑似复核
2. fallback 重试与兜底
3. `groupTotalCount` 与 `actionableCount` 分离
4. 保持代表副本保留策略

## 负责人

公孙策

## 验证

`npm run test -- --run src/domain/recognition/scoring.test.ts src/features/scan/scan-media-library.test.ts`

