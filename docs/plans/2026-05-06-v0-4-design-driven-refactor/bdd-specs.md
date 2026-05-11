# BDD 场景规格

## 目标说明

本文件为 v0.4 设计稿驱动重构的 BDD 真值源。当前执行波次必须覆盖 `01-06` 的活动场景；`00 Splash` 只保留基线约束。

## Feature: 00 Splash 基线约束

### Scenario: 首启时继续保持既有稳定启动壳
Given 用户首次启动 App
And 当前主题为浅色或深色
When 启动壳显示
Then 启动体验应保持当前既有稳定行为
And 本轮不应引入新的 JS 启动壳分叉

## Feature: 01 Landing / 授权入口

### Scenario: 首次进入时用户理解产品主流程
Given 用户首次进入 App
When Landing 展示
Then 用户应能直接感知“扫描 -> 识别 -> 筛选 -> 清理 -> 报告”的主叙事
And 页面文案应与产品定位一致
And 页面视觉应对齐 `01 landing`

### Scenario: 用户从 Landing 进入主流程
Given 用户已在 Landing
When 用户点击主入口 CTA
Then App 应进入主工作区
And 后续再次进入时不应重复阻断在 Landing

## Feature: 02 Scanning / 扫描中

### Scenario: 用户授权后开始扫描并看到页内进度态
Given 用户已授权媒体库
And 当前存在可扫描媒体
When 用户开始扫描
Then Photos 页应进入设计稿 `02 scanning` 对应的扫描态
And 进度展示应为页内连续状态，不应弹额外阻断式完成层
And Android 通知与页内进度口径应一致

### Scenario: 用户离开页面后重新进入，扫描态可恢复
Given Android 本地扫描仍在运行
When 用户离开 Photos 再返回
Then 页面应恢复到当前真实扫描态
And 不得伪装成未授权或未开始扫描

## Feature: 03 Result / 结果摘要

### Scenario: 扫描完成后用户先看到摘要，而不是直接掉进旧列表
Given 当前扫描已完成
When 页面从扫描态收口
Then 用户应先看到与 `03 result` 对应的结果摘要层
And 摘要应体现分类结果与下一步动作入口
And 不应只剩旧式列表结果

### Scenario: 结果摘要保留继续扫描与浏览结果的双路径
Given 用户正在查看结果摘要
When 用户决定继续向更早窗口扫描或进入筛选
Then 页面应提供明确、可理解的下一步入口
And 不应强制用户重新走完整起始态

## Feature: 04 Filtering / 批量筛选

### Scenario: 用户进入结果工作台进行筛选
Given 当前已有候选结果
When 用户进入筛选工作台
Then Photos 页应进入与 `04 filtering` 对齐的批量筛选态
And 该状态应属于 Photos 内子态而不是新 route

### Scenario: 用户通过网格、选中态、详情流完成判断
Given 用户正在筛选候选结果
When 用户单击媒体
Then 默认应进入详情查看
When 用户长按媒体
Then 应进入选中模式
When 用户在选中模式下点击媒体
Then 应切换选中状态而不是打开详情

### Scenario: 扫描中或扫描后详情流保持正确语义
Given 用户正在查看详情
When 当前媒体属于重复组或相关集合
Then 详情应允许在相关集合内浏览与判断
And 详情结构应优先保证媒体主体可读

## Feature: 05 Recycle / 确认清理

### Scenario: 用户进入回收站确认清理内容
Given 当前存在回收站候选
When 用户进入 RecycleBin tab
Then 页面应对齐 `05 recycle`
And 用户应能看见累计清理收益、当前待清理内容和明确的动作入口

### Scenario: 用户恢复或彻删内容
Given 用户已进入回收站
When 用户执行恢复
Then 项目应返回非回收状态
And 清理累计报告语义不得错误回滚
When 用户执行永久删除
Then 必须经过明确确认
And 删除行为不得产生未处理异常

## Feature: 06 Settings / 设置

### Scenario: 用户进入设置页时看到与 06 设计稿一致的设置体验
Given 用户进入 Settings tab
When 设置页展示
Then Settings 页应对齐 `06 settings` 的信息层级、分组、设置项、底栏语言和主题映射
And 既有偏好行为不应因页面重构而回归

### Scenario: 既有设置偏好仍保持有效
Given 用户在设置页
When 用户切换语言
Then App 文案应切换到对应语言
When 用户切换主题
Then App 主题应切换到对应浅色或深色映射
When 用户调整提醒偏好
Then 提醒设置应保持可用且保存后继续有效
And 不应因为当前 `Photos / RecycleBin / Settings` 重构而破坏既有设置语义

## Feature: 跨页一致性

### Scenario: 用户在不同页面感受到同一产品
Given 用户依次浏览 Landing、Photos、RecycleBin、Settings
When 页面切换
Then 标题层级、按钮层级、底栏语言、卡片气质、主题映射和文案语气应保持一致
And 不应出现“像多个版本拼起来”的割裂感

### Scenario: 文案统一来自真值源
Given 用户切换系统语言或 App 语言
When 页面文案重渲染
Then 核心文案应来自统一 i18n 真值源
And 不应保留散落硬编码的中英双写文案

## Feature: 通知与扫描恢复不回归

### Scenario: UI 重构后通知业务语义保持不变
Given 用户完成一次扫描
When App 在前台或后台
Then 扫描完成通知行为应与当前业务语义保持一致
And UI 重构不得改变 permission 分支或 channel 行为

### Scenario: UI 重构后扫描恢复语义保持不变
Given 当前存在 active scan snapshot 或 resumable batch
When 用户重新进入 Photos
Then App 应优先恢复真实扫描状态
And 不得回退为旧的空白态、未授权态或误导性已完成态

## Feature: 浅色 / 深色 / 异形屏一致性

### Scenario: 设计稿浅色与深色都成立
Given 同一页面存在 light 与 dark 设计稿
When 页面以浅色或深色渲染
Then 结构应一致
And 颜色、边界、层级应对齐对应主题稿

### Scenario: SE 设计稿通过 RN 适配机制映射到真实设备
Given 设计稿是 SE 尺寸基准
When 页面在 RN 中运行于 SE 级别窄屏设备
Then 页面结构、信息密度、底部操作区和主要间距应贴近设计稿
When 页面运行于非 SE 手机、横屏、大屏或折叠态
Then 页面应通过窗口宽度、安全区、内容最大宽度和网格列数规则适配
And 不得把设计稿导出像素直接写死为 RN 样式

### Scenario: 特殊屏幕下核心交互仍可用
Given 当前设备为刘海屏、打孔屏、横屏、大屏或折叠态
When 用户浏览核心页面
Then 标题、底栏、操作区、筛选区与详情区不应被危险区遮挡
And Settings 的设置项、开关、语言/主题控件与提醒设置也不应被危险区遮挡
And 用户应能完成核心操作

### Scenario: Photos、RecycleBin、Settings 都有 SE 与非 SE 签收
Given Photos、RecycleBin、Settings 是本轮主要重构页面
When 八贤王执行终验
Then 每个页面都必须有 SE 设计稿对照证据
And 每个页面都必须有至少一类非 SE 响应式适配证据
And 如果存在偏差，必须在设计签收记录中说明原因
