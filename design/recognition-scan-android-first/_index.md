# Android First 扫描与识别设计入口

English version: [./_index.en.md](./_index.en.md)

本目录已经冻结的核心结论只有一条：

`Android 必须成为扫描与识别的一号执行面，并且入口必须是 metadata-first。`

当前仓库不是从零开始，而是已经具备：

1. Android 原生执行器与 foreground service 骨架
2. `scan_batch / scan_batch_item / asset_manifest` 等 SQLite 运行时表
3. `PhotoGridScreen` 对进度、checkpoint、恢复的编排

所以这一轮不再重做“是否要 Android-first”的讨论，而是把已有设计转成可执行源，优先推进 Android 第一版：

1. native `MediaStore` enumeration
2. metadata-first dirty queue
3. 默认最近 `12` 个月、随后按历史切片持续回填的扫描窗口策略
4. Android 停止/恢复语义收口

## 设计文档

- [终态需求目标](./target-state-goals.md)
- [识别算法调研](./algorithm-research.md)
- [Android First 扫描与识别架构](./architecture.md)
- [BDD 规格](./bdd-specs.md)
- [最佳实践](./best-practices.md)

## 当前执行口径

1. 只落实 Android 第一版，不把 iOS / Rust / cloud / Firebase 混入主线。
2. 第一波已经把 native enumeration、dirty queue、batch planning、native stopped 与默认 `12` 个月 + 历史 backfill 固化。
3. 第二波只把 `PhotoScanResultCache` 下沉为 SQLite `candidate_view / candidate_view_meta` 恢复投影，解决页面退出或冷启动后的候选结果恢复。
4. 当前第三波只把 duplicate group 的最小规范化真值写入 `recognition_group / recognition_member`，不重写聚合算法。
5. 当前第四波把 keep / recycle / restore / delete / failed 写入 SQLite `user_decision`，并且不随扫描缓存清理而丢失。
6. 当前第四波仍不重做完整 `analysis_result` durable truth，也不扩大到完整 similar / anomaly group 重建。
7. 现有 RN native module 继续保留，不在这一轮强制改成 Expo Module。
