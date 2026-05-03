# Android First 扫描与识别 BDD 规格

English version: [./bdd-specs.en.md](./bdd-specs.en.md)

## 场景 1：Android 以 native metadata-first 枚举作为扫描入口

```gherkin
Scenario: Android 扫描入口先做 native metadata-first enumeration
  Given Android 默认扫描最近 12 个月媒体，且窗口可配置
  When 扫描批次开始创建
  Then app 应先通过 Android native MediaStore 枚举媒体元数据
  And JS 不应再先用 expo-media-library 枚举 source candidates 再整包传给 native executor
  And asset_manifest 应拿到 mime type、bucket、时长、文件大小等 metadata-first 字段
```

## 场景 2：第一版 dirty queue 只分析真正脏的资产

```gherkin
Scenario: dirty queue 只把 new modified missing-analysis 的资产送入分析
  Given SQLite 已存在上一轮 asset_manifest 与 media_analysis
  When Android native enumeration 返回本轮 manifest
  Then planner 应基于 manifest diff 与 analysis presence 计算 dirty reason
  And clean 资产不应继续进入当前 analysis 队列
  And scan_batch 的 enumerated_count 与 dirty_count 应明确区分
```

## 场景 3：页面与批次状态对齐 metadata-first 执行语义

```gherkin
Scenario: PhotoGridScreen 以 metadata-first planning 结果驱动 Android 扫描
  Given Android 扫描准备启动
  When metadata-first planning 完成
  Then PhotoGridScreen 应使用 dirty candidate 集合作为 native executor 的输入
  And scan_batch / scan_batch_item / asset_manifest 应先持久化 planning 结果
  And 页面显示的扫描总量应对应当前 dirty queue，而不是旧的 JS authorized candidate 总数
```

## 场景 4：native stopped 事件能收口当前批次

```gherkin
Scenario: Android native stopped 事件被 JS 消费并正确收口
  Given Android native scan 正在执行
  When native executor 因取消或中断发出 stopped 事件
  Then JS facade 应结束当前观察 promise
  And PhotoGridScreen 不应留下悬空中的 native scan 等待态
```

## 场景 5：完成当前窗口后继续向更早媒体回填

```gherkin
Scenario: Android 扫描按历史切片持续回填直到整库覆盖
  Given Android 默认扫描最近 12 个月媒体，且窗口可配置
  And 上一轮 rolling-window 或 backfill 批次已经完成
  When 用户再次发起 Android 扫描
  Then planner 应从上一轮最早边界之前继续创建新的历史切片
  And native enumeration 应带上 createdAfter 与 createdBefore 两侧边界
  And 当前批次完成后若已无更早媒体，则后续扫描应退回只处理新增或变化媒体
```

## 当前波次边界

```gherkin
Scenario: 第一波不重做 durable candidate aggregation
  Given recognition-scan-android-first 终态要求最终把 analysis_result 与 candidate_view 进入 SQLite
  When 本波次执行 Android 第一版入口改造
  Then 当前实现只负责 native enumeration、dirty queue、batch planning 与 stop semantics
  And 完整 recognition_group 聚合、analysis_result 与 user_decision 策略化扩展留到后续波次
```

## 场景 6：candidate_view 作为页面结果恢复真值

```gherkin
Scenario: PhotoGrid 扫描结果以 SQLite candidate_view 为主并按 scannedAt 仲裁恢复
  Given Android 扫描已经完成并产出 active candidates
  When app 持久化 PhotoScanResultCache
  Then active candidates 应写入 SQLite candidate_view
  And summary 应写入 candidate_view_meta
  And 下次进入页面时应以 SQLite candidate projection 为主恢复结果
  And AsyncStorage 只作为旧版本迁移、兼容镜像与失败回退
  And SQLite 与 AsyncStorage 同时存在时应按 scannedAt 选择最新结果
```

## 场景 7：duplicate group 写入 recognition_group 规范表

```gherkin
Scenario: duplicateGroup 从候选 JSON 下沉为 recognition_group 与 recognition_member
  Given Android 扫描结果里存在带 duplicateGroup 的 active candidates
  When app 持久化 PhotoScanResultCache
  Then duplicateGroup 应写入 SQLite recognition_group
  And 候选资产成员关系应写入 recognition_member
  And candidate_view 仍作为 UI 投影存在
  And 当前波次不重写完整 similar / anomaly 聚合算法
```

## 场景 8：用户决策写入 user_decision 并独立于扫描缓存

```gherkin
Scenario: keep recycle restore delete failed 写入 SQLite user_decision
  Given 用户在 Android 上处理识别候选
  When 用户 keep、移动到回收站、从回收站恢复、永久删除或产生失败记录
  Then app 应写入 SQLite user_decision
  And user_decision 应记录 asset、candidate、decision、reason 与时间戳
  And clearPersistentScanCache 不应删除 user_decision
  And 普通 active 扫描结果不应覆盖已有用户决策
```
