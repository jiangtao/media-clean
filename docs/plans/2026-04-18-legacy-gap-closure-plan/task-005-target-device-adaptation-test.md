# Task 005: Target Device Special-Screen Adaptation Tests

## 负责人
马汉

## 类型
Test

## depends-on
[]

## BDD 场景

```gherkin
Given 用户目标机型默认采用 Samsung_S20 横屏左上打孔配置
When 兼容性模块识别屏幕类型
Then 应识别为 hole-punch-left
And 顶部内容与横屏危险区不应重叠
```

## 验证命令

```bash
npm run test -- src/features/compatibility/__tests__/screen-adaptation.test.ts
```
