# Android 扫描与识别终态需求目标

English version: [target-state-goals.en.md](./target-state-goals.en.md)

## 背景

当前仓库里已经有 JS 扫描、Android native-first 尝试、SQLite operational store、UI 进度恢复等多条线，但这些能力还没有被一个明确的 Android 终态目标统一起来。

如果终态目标不先收敛，后面的扫描链路、SQLite 模型、后台服务、UI 进度、候选结果都会继续彼此耦合，最后只能得到“能跑一阵子”的实现，而不是“长期可演进”的 Android 产品能力。

所以这里先定义 Android 终态需求目标，再让架构去响应这些目标。

## 终态范围

这份目标文档只覆盖 Android：

- Android 手机本地媒体库扫描
- Android 本地识别与候选聚合
- Android 前台页面、后台执行、恢复与持久化
- 用户在 Android 端做 keep / recycle / delete 决策

这份文档暂不覆盖：

- iOS 执行面
- Rust shared core
- 云端同步
- Firebase 监控接入

## 终态产品目标

Android 终态能力必须同时满足：

1. 用户在 Android 上默认先扫描最近 `12` 个月媒体，并可改成 `1/2/3/6/12` 个月窗口。
2. 当前窗口扫完后，下一次扫描要从上一批之前的更早媒体继续回填，直到覆盖整库。
3. 扫描离开页面后仍能继续推进，用户回到页面时能恢复真实进度。
4. 扫描阶段先读取媒体元数据，再决定是否进入分析队列。
5. 用户能看到可信的扫描进度、候选结果和历史清理收益。
6. duplicate / similar / anomaly 等结果具备稳定、可解释、可恢复的来源。
7. 用户决策和识别结果解耦，避免“识别变化把用户决定冲掉”。

## 终态工程目标

Android 扫描与识别架构必须满足：

1. 执行主面是 Android Native Module + Foreground Service，不依赖 JS 主线程常驻。
2. SQLite 是 Android 运行时真值，负责 batch、manifest、analysis、aggregation、asset state。
3. 扫描执行窗口与 reminder 判断范围彻底分离。
4. 单资源分析与最终候选聚合彻底分层。
5. 每个阶段都支持恢复、重试、局部重算，而不是只能全局重扫。
6. 新增媒体字段时，能够通过 manifest 和 analysis contract 自然扩展，而不是改一串临时对象。

## 必要输入字段

Android 终态扫描在枚举阶段必须读出并持久化这些字段：

- `asset_id`
- `content_uri`
- `media_type`
- `mime_type`
- `width`
- `height`
- `orientation`
- `aspect_ratio`
- `duration_ms`
- `file_size_bytes`
- `date_taken`
- `date_modified`
- `bucket_id`
- `bucket_name`
- `is_screenshot`（best effort）
- `bitrate`（视频 best effort）
- `frame_rate`（视频 best effort）
- `codec`（视频 best effort）

这些字段在终态里不是“附加信息”，而是：

- dirty queue 规划输入
- worker 权重输入
- duplicate / similar / anomaly 的解释输入
- UI 展示与排序输入
- 后续新增识别策略的扩展输入

## 核心能力要求

### 1. 枚举能力

系统必须支持：

- 默认最近 `12` 个月滚动窗口扫描，且窗口配置可调整为 `1/2/3/6/12` 个月
- 按窗口持续向更早时间回填的历史扫描
- 覆盖整库后的增量重扫
- manifest diff

### 2. 分析能力

系统必须支持：

- photo / video 分离的 worker pool
- 不同设备能力下的受限并发
- 算法版本升级后的局部重算
- 失败重试与 fallback 分析路径

### 3. 聚合能力

系统必须支持：

- duplicate
- similar
- anomaly
- 分组结果的局部刷新
- 候选视图稳定恢复

### 4. 运行时能力

系统必须支持：

- 前台启动扫描
- 后台继续执行
- 冷启动恢复
- UI attach 到现有 batch
- 进度与 heartbeat 恢复

### 5. 用户决策能力

系统必须支持：

- keep
- recycle
- delete
- 回收站恢复
- 清理报告累计

## 识别算法目标

Android 终态识别至少要覆盖：

1. `模糊`
2. `重复`
3. `相似`
4. `误触 / 低信息`
5. `噪声重 / 压缩重 / 综合差质`

并满足：

1. 每个维度都要能对应到已有算法或明确的 AI 模型方案。
2. `重复` 和 `相似` 不能混成一个分值。
3. `误触` 归到 `anomaly` 子类，不直接覆盖 duplicate / similar。
4. 质量类分数必须可解释，至少能落回 `blur / noise / naturalness / accidental` 这些子信号。

关联调研文档：[Android 识别算法调研](./algorithm-research.md)

## AI 引入约束

如果引入 AI，终态目标要求：

1. AI 推理默认本地执行，不依赖云端。
2. AI 模型必须可版本化、可回退、可替换。
3. AI 结果不能成为唯一真值，仍需保留传统规则和传统特征通路。
4. JS 页面不得承担 AI 主推理线程。
5. 模型缺失或 delegate 不可用时，系统仍能退回非 AI 识别路径。

## 第一版落地约束

第一版实现先按 **非 AI 路线** 落地。

这意味着：

1. 第一版不引入端侧 embedding 模型和分类模型。
2. 第一版不要求 `MediaPipe / LiteRT / TFLite` 运行时进入主链路。
3. 第一版的 `相似` 只解决近相似、连拍相似、轻变化相似，不追求强语义相似。
4. 第一版优先保证：
   - `模糊`
   - `重复`
   - `近相似`
   - `误触 / 低信息`
   - `噪声重 / 差质`
   这五类都能以传统特征与规则稳定落地。
5. AI 保留为第二阶段增强位，不阻塞第一版上线。

## 非目标

当前这轮终态目标明确不追求：

- 在单资源分析阶段直接给出最终 duplicate / similar 结论
- 让 JS 页面承担长期后台扫描执行
- 把所有状态继续塞进 AsyncStorage
- 每次配置变化都全量重扫

## 验收标准

Android 终态方案至少要做到：

1. 新扫描批次的来源、范围、阶段、进度、失败项都能在 SQLite 中查询。
2. 新资源进入媒体库后，只需扫描变化范围，不必重复重扫整库。
3. 扫描窗口改为最近 `1/2/3/6/12` 个月时，系统只重算受影响资产集合。
4. 当前窗口完成后，下一次扫描会从上一批最早边界之前继续回填，而不是重新扫刚处理过的窗口。
5. 当更早历史已经没有未覆盖媒体时，系统会把后续扫描退回成“只处理新增或变化媒体”的增量模式。
6. 识别结果丢失或页面退出后，重新进入仍能从 SQLite 恢复 batch 与 `candidate_view`。
7. 用户 keep / recycle / restore / delete 等决策能从 SQLite `user_decision` 查询，并且不会被清理扫描缓存误删。
8. 新增媒体字段时，只需要扩展 manifest / analysis contract 与对应聚合逻辑，不需要推翻主链路。
