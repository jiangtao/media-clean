# 质量优先执行体系 - 执行计划

## 目标

围绕 `docs/goal/v0.1.md`，把团队角色、质量第一与 TODO 推进顺序沉入仓库内的长期执行规范，并据此组织下一轮真实交付。

## 设计参考

- 设计文档：`docs/plans/2026-04-18-quality-first-execution-design/`
- 执行规范：`docs/standards/execution-standards.md`

## 团队分工

| 角色 | 成员 | 职责 |
|------|------|------|
| Lead | 包拯 | 主控波次、冻结与放行、合并结果 |
| 架构 | 公孙策 | 审核规范分层、live 路径与边界 |
| 核心执行 | 展昭 | 主线文档、计划与后续集成推进 |
| 执行小队 | 张龙、赵虎、王朝、马汉 | TODO 波次中的测试、实现与验证 |
| 验收 | 八贤王 | 对照目标、标准、计划、BDD 与测试验收 |

## 执行计划

```yaml
tasks:
  - id: "001"
    subject: "执行规范文档固化"
    slug: "execution-standards-doc"
    type: "doc"
    depends-on: []
    assignee: "展昭"
  - id: "002"
    subject: "runtime 质量闸与验收源固化"
    slug: "runtime-quality-gates"
    type: "doc"
    depends-on: ["001"]
    assignee: "公孙策"
  - id: "003"
    subject: "TODO 队列编排与阻断项入表"
    slug: "todo-queue-prioritization"
    type: "doc"
    depends-on: ["001", "002"]
    assignee: "包拯"
  - id: "004"
    subject: "回收站真实数据流测试"
    slug: "recycle-bin-state-test"
    type: "test"
    depends-on: ["003"]
    assignee: "张龙"
  - id: "005"
    subject: "回收站真实数据流实现"
    slug: "recycle-bin-state-impl"
    type: "impl"
    depends-on: ["004"]
    assignee: "展昭"
  - id: "006"
    subject: "回收站 badge 与详情链路测试"
    slug: "recycle-bin-badge-detail-test"
    type: "test"
    depends-on: ["003"]
    assignee: "赵虎"
  - id: "007"
    subject: "回收站 badge 与详情链路实现"
    slug: "recycle-bin-badge-detail-impl"
    type: "impl"
    depends-on: ["005", "006"]
    assignee: "王朝"
  - id: "008"
    subject: "全量验证与波次放行"
    slug: "verification-and-release-gate"
    type: "test"
    depends-on: ["005", "007"]
    assignee: "八贤王"
```

## 任务文件

- [Task 001: 执行规范文档固化](./task-001-execution-standards-doc.md)
- [Task 002: runtime 质量闸与验收源固化](./task-002-runtime-quality-gates.md)
- [Task 003: TODO 队列编排与阻断项入表](./task-003-todo-queue-prioritization.md)
- [Task 004: 回收站真实数据流测试](./task-004-recycle-bin-state-test.md)
- [Task 005: 回收站真实数据流实现](./task-005-recycle-bin-state-impl.md)
- [Task 006: 回收站 badge 与详情链路测试](./task-006-recycle-bin-badge-detail-test.md)
- [Task 007: 回收站 badge 与详情链路实现](./task-007-recycle-bin-badge-detail-impl.md)
- [Task 008: 全量验证与波次放行](./task-008-verification-and-release-gate.md)

## BDD 覆盖

| 场景 | 对应任务 |
|------|----------|
| 团队角色进入执行规范 | 001-003 |
| runtime 调整后必须无 error | 002, 008 |
| TODO 必须带验证命令 | 002-003 |
| 回收站阻断项先于体验项 | 004-007 |

## 依赖链

```text
001 -> 002 -> 003
003 -> 004 -> 005
003 -> 006 -> 007
005 + 007 -> 008
```

## 成功标准

- [ ] 团队角色与 subAgent 映射已进入仓库执行规范
- [ ] runtime 质量闸已明文化
- [ ] TODO 队列与阻断项已明文化
- [ ] 回收站真实数据流进入下一轮优先执行波次
- [ ] 后续实现必须受 `execution-standards.md` 约束
