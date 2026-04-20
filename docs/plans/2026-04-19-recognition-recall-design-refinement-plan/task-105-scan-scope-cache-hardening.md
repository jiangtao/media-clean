# Task 105: 扫描范围与分析缓存策略补强

## 目标

在不破坏性能的前提下，给更高召回率提供范围与缓存支撑。

## 关键动作

1. 抽象扫描范围策略
2. 保持默认最近 `360`
3. 让更深范围与缓存签名兼容
4. 确保分析缓存不会因新增指纹而失效混乱

## 负责人

展昭

## 验证

`npm run test -- --run src/features/scan/scan-media-library.test.ts src/services/storage/app-storage.test.ts`

