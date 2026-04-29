# Android First 扫描与识别设计

English version: [README.en.md](./README.en.md)

本目录只回答一个问题：**Android 终态下，扫描与识别系统应该长成什么样。**

阅读顺序：

1. [终态需求目标](./target-state-goals.md)
2. [识别算法调研](./algorithm-research.md)
3. [Android First 扫描与识别架构](./architecture.md)

当前约束：

- 先把 Android 路径讲透，不把 iOS / CLI / skill 混进来。
- 扫描时必须读出媒体尺寸、时长、文件大小等元数据。
- 识别维度要能落到已有权威算法或明确的 AI 模型方案。
- 目标文档先定义“必须满足什么”，架构文档再定义“怎么满足”。

审阅重点：

1. 终态范围是否应该以 Android 为唯一主执行面。
2. 元数据是否足够支撑后续识别、排序、分组与解释。
3. SQLite 是否应该升级为 Android 扫描运行时真值，而不是缓存层。
4. duplicate / similar 是否应该彻底后移到二阶段聚合。
