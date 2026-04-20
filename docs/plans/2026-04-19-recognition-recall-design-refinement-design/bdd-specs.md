# BDD 规格

[English Version](./bdd-specs.en.md)

## 识别召回

```gherkin
Feature: 识别召回率提升

  Scenario: 中度模糊和灰暗照片也应被识别
    Given 相册中存在一张亮度偏低且明显模糊的照片
    When 用户执行扫描
    Then 该照片应进入候选结果
    And 触发原因应包含模糊、灰暗或低质量中的至少一个

  Scenario: 纯色或近纯色图片应被识别为异常或低质量
    Given 相册中存在一张接近纯色且边缘极少的图片
    When 用户执行扫描
    Then 该图片应进入候选结果

  Scenario: 两张完全相同的照片应被识别为重复组
    Given 相册中存在两张完全相同的照片
    When 用户执行扫描
    Then 系统应构建一个重复组
    And 列表中的重复数量应与详情中可浏览的组数量一致

  Scenario: 某一张图片首次分析 fallback 也不应永久失去重复识别能力
    Given 两张相同照片中有一张首次分析 fallback
    When 系统执行重复识别
    Then 系统应执行兜底或复核策略
    And 不应因为单次 fallback 直接放弃重复识别

  Scenario: 相似但不完全重复的照片应进入相似组
    Given 相册中存在两张构图接近但非完全重复的照片
    When 用户执行扫描
    Then 系统应将其识别为相似组或等价结果层
```

## 数量语义

```gherkin
Feature: 重复数量语义统一

  Scenario: 列表数量表示同组媒体数量
    Given 某条结果属于重复组
    When 用户查看列表角标
    Then 数量应表示同组可浏览媒体数量

  Scenario: 详情中的页码与列表数量一致
    Given 用户从列表打开一条重复结果
    When 用户左右切换详情媒体
    Then 可切换项数量应与列表数量语义一致
```

## 设计 refinement

```gherkin
Feature: 扫描与详情视觉细化

  Scenario: 扫描入口与进度统一为单一卡片
    Given 用户已授权并进入照片页
    When 扫描未开始、进行中和完成后
    Then 页面应保持单一卡片语义
    And 不应在状态切换时产生额外结果卡闪入

  Scenario: 详情页保持单舞台和最小辅助信息
    Given 用户打开详情页
    Then 媒体舞台应优先占据主要可见空间
    And 标签应限制为单行最新 3 个
    And 开关、分页点与标签层级应清晰

  Scenario: 扫描动画必须去闪并连续
    Given 扫描过程中候选项逐步消失
    Then 卡片与进度反馈应保持单一主过渡
    And tab 数量变化不得跳变闪烁
```

