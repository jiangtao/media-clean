# Task 101: 识别召回失败样本测试

## 目标

先把用户补充的漏检样本转成失败测试，禁止凭感觉调规则。

## 覆盖范围

1. 模糊、灰暗、纯色、低质量图片
2. 两张完全相同但当前漏检的图片
3. 相似但不完全重复的图片
4. 分析 fallback 导致重复漏检的图片

## 负责人

张龙

## 验证

`npm run test -- --run src/domain/recognition/scoring.test.ts src/features/scan/scan-media-library.test.ts`

