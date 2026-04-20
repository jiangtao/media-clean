# Task 108: 全量验证与体验验收

## 目标

确保识别提升与设计 refinement 不引入 runtime 错误、性能倒退或体验回退。

## 验证命令

1. `npm run typecheck -- --pretty false`
2. `npm run test -- --run`

## 验收要点

1. 相同照片与相似照片召回提升
2. 模糊、纯色、灰暗图能进候选
3. 列表与详情数量语义一致
4. 扫描与详情动效稳定，不闪、不顿
5. 无新增 runtime error

## 负责人

八贤王

