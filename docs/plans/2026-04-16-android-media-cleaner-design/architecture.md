# 架构设计

## 技术栈

- Expo SDK 55
- React Native + TypeScript
- AsyncStorage 用于应用内回收站与最近扫描状态
- `expo-media-library` 读取媒体元数据与执行永久删除
- `expo-video-thumbnails` 生成视频缩略图
- `expo-image-manipulator` + `jpeg-js` 进行轻量图片分析

## 分层

1. `src/domain`
   - 纯函数与类型定义
   - 识别规则、评分阈值、排序逻辑
2. `src/services`
   - 媒体库访问
   - 缩略图生成与像素分析
   - 回收站持久化
3. `src/features`
   - 扫描流程
   - 候选列表与筛选
   - 回收站操作
4. `src/ui`
   - 页面容器、卡片、按钮、状态提示、预览弹层

## 关键数据模型

- `MediaAssetSnapshot`
  - `id`
  - `mediaType`
  - `uri`
  - `width`
  - `height`
  - `duration`
  - `fileSize`
  - `creationTime`
- `VisualMetrics`
  - `brightness`
  - `contrast`
  - `edgeDensity`
- `CleanupCandidate`
  - `id`
  - `asset`
  - `score`
  - `confidence`
  - `kind`
  - `reasons`
  - `deletedState`

## 识别流程

1. 获取媒体权限。
2. 分页读取最近媒体资源。
3. 对图片直接缩放后提取视觉指标；对视频先抽取缩略图再复用同一分析流程。
4. 使用类型特定规则计算评分。
5. 过滤出高于候选阈值的资源并按分数降序展示。
6. 将进入回收站的资源 ID 写入本地持久化，用于隐藏与恢复。

## UI 结构

1. 首页
   - 扫描摘要
   - 授权/重新扫描入口
   - 自动清理按钮
   - 结果列表
2. 预览弹层
   - 大图或视频播放器
   - 元数据、评分与理由
3. 底部操作栏
   - 选中数量
   - 移入回收站
   - 彻底删除
4. 回收站面板
   - 已软删除列表
   - 恢复
   - 永久删除

## 验证策略

1. 核心评分逻辑使用 Vitest 做纯函数测试。
2. 回收站存储逻辑做单元测试。
3. 应用层通过 TypeScript 检查和 Expo 导出验证构建正确性。
