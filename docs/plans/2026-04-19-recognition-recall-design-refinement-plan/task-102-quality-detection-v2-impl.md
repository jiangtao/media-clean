# Task 102: 质量识别规则 V2 实现

## 目标

提高坏图召回率，不再只抓极端异常图。

## 关键动作

1. 增加 `blur score`
2. 增加颜色平坦度或低信息量指标
3. 引入中度异常阈值
4. 保持当前分数体系与缓存兼容

## 负责人

展昭

## 验证

`npm run test -- --run src/domain/recognition/scoring.test.ts`

