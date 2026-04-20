# 识别召回与设计细化 - 执行计划

## 目标

围绕“识别召回率提升”和“移动端设计 refinement”组织下一轮团队执行，确保识别条件能覆盖新增反馈，同时让设计风格更细致、更统一。

## 设计参考

- 设计总览：`docs/plans/2026-04-19-recognition-recall-design-refinement-design/`
- 执行规范：`docs/standards/execution-standards.md`
- 交互标准：`docs/standards/interaction-standards.md`

## 团队分工

| 角色 | 成员 | 职责 |
|------|------|------|
| Lead | 包拯 | 锁定范围、拆波次、放行门禁 |
| 架构 | 公孙策 | 识别分层、缓存签名、范围策略 |
| 核心执行 | 展昭 | 扫描链、识别域、live 路径集成 |
| 执行小队 | 张龙、赵虎 | 失败样本测试与识别实现 |
| 执行小队 | 王朝、马汉 | 扫描页/详情页 refinement |
| designer | 设计成员 | 风格细化、动效与信息层级审校 |
| 验收 | 八贤王 | runtime 零错误与体验验收 |

## 波次安排

```yaml
tasks:
  - id: "101"
    subject: "识别召回失败样本测试"
    slug: "recognition-recall-failing-specs"
    type: "test"
    depends-on: []
    assignee: "张龙"
  - id: "102"
    subject: "质量识别规则 V2 实现"
    slug: "quality-detection-v2-impl"
    type: "impl"
    depends-on: ["101"]
    assignee: "展昭"
  - id: "103"
    subject: "重复与相似识别失败样本测试"
    slug: "duplicate-similar-failing-specs"
    type: "test"
    depends-on: []
    assignee: "赵虎"
  - id: "104"
    subject: "Duplicate V2 与 Similar 分层实现"
    slug: "duplicate-similar-v2-impl"
    type: "impl"
    depends-on: ["103"]
    assignee: "公孙策"
  - id: "105"
    subject: "扫描范围与分析缓存策略补强"
    slug: "scan-scope-cache-hardening"
    type: "impl"
    depends-on: ["102", "104"]
    assignee: "展昭"
  - id: "106"
    subject: "扫描页设计 refinement"
    slug: "scan-page-refinement"
    type: "impl"
    depends-on: ["105"]
    assignee: "王朝"
  - id: "107"
    subject: "详情页与语义统一 refinement"
    slug: "detail-viewer-refinement"
    type: "impl"
    depends-on: ["105"]
    assignee: "马汉"
  - id: "108"
    subject: "全量验证与体验验收"
    slug: "verification-and-acceptance"
    type: "test"
    depends-on: ["106", "107"]
    assignee: "八贤王"
```

## 任务文件

- [Task 101: 识别召回失败样本测试](./task-101-recognition-recall-failing-specs.md)
- [Task 102: 质量识别规则 V2 实现](./task-102-quality-detection-v2-impl.md)
- [Task 103: 重复与相似识别失败样本测试](./task-103-duplicate-similar-failing-specs.md)
- [Task 104: Duplicate V2 与 Similar 分层实现](./task-104-duplicate-similar-v2-impl.md)
- [Task 105: 扫描范围与分析缓存策略补强](./task-105-scan-scope-cache-hardening.md)
- [Task 106: 扫描页设计 refinement](./task-106-scan-page-refinement.md)
- [Task 107: 详情页与语义统一 refinement](./task-107-detail-viewer-refinement.md)
- [Task 108: 全量验证与体验验收](./task-108-verification-and-acceptance.md)

## 依赖链

```text
101 -> 102
103 -> 104
102 + 104 -> 105
105 -> 106
105 -> 107
106 + 107 -> 108
```

## 验证命令

1. 定向测试：
   - `npm run test -- --run src/domain/recognition/scoring.test.ts`
   - `npm run test -- --run src/features/scan/scan-media-library.test.ts`
   - `npm run test -- --run src/ui/screens/__tests__/PhotoGridScreen.test.tsx`
   - `npm run test -- --run src/ui/screens/__tests__/DetailScreen.test.tsx`
2. 全量门禁：
   - `npm run typecheck -- --pretty false`
   - `npm run test -- --run`

## 完成定义

1. 新增反馈中的漏检样本已经进入测试。
2. 识别规则与 UI 语义已统一。
3. 设计细节符合“简洁、利落、可信、本地化、流畅”。
4. 不引入新的 runtime / 卡顿 / 红屏。

