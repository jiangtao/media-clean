# Android First 扫描与识别最佳实践

English version: [./best-practices.en.md](./best-practices.en.md)

## 1. 先守住 execution boundary，再谈理想边界

当前仓库已经有：

- RN native module
- foreground service
- Kotlin native executor
- JS importer 与页面编排

所以第一版不要为了“更纯粹”而同时引入 Expo Module 重写、Rust 下沉、聚合层翻新。先把 Android metadata-first 入口打实。

## 2. manifest 必须是 planning input，不是 UI 附属字段

`asset_manifest` 不是“顺手带上的元数据缓存”，而是：

1. dirty queue 输入
2. worker weighting 输入
3. duplicate / near-similar / anomaly 解释输入
4. repair / backfill 的扩展输入

因此枚举字段宁可 best-effort 置空，也不能继续由页面层临时拼接。

## 3. 第一波只下沉入口，追加波次只做候选恢复投影

第一波要明确控制范围：

1. 做 `MediaStoreEnumerator`
2. 做 dirty queue 初版
3. 做批次 planning 持久化
4. 做 stopped event 收口

追加波次可以把 `PhotoScanResultCache` 写入 SQLite `candidate_view / candidate_view_meta`，但这只是页面恢复投影。

第三波可以把候选 JSON 里的 duplicate group 抽成 `recognition_group / recognition_member`，但只做最小 durable group 形态。

第四波可以把用户动作写成 `user_decision`，但只承接 keep / recycle / restore / delete / failed，不引入复杂策略引擎。

当前仍不做：

1. `analysis_result` 全量 durable truth 改造
2. 完整 similar / anomaly group 重建
3. `PhotoGridScreen` 完整去 AsyncStorage 化
4. WorkManager 级后台续跑

## 4. dirty queue 第一版先求可解释，再求完整

第一版 dirty reason 先收口为：

1. `new`
2. `modified`
3. `missing-analysis`

`algorithm-upgrade` 先预留，不在这一波硬做假版本化。

## 5. 停止语义必须显式

原生侧已经有 stopped 事件，就不应再让 JS 观察 promise 悬空。取消、中断、页面退出至少要做到：

1. JS 观察层能收口
2. 当前批次状态不会留在“看起来还在跑”的假态
3. 前台服务与页面态一致
