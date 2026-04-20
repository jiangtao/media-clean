# BDD 规格

[English Version](./bdd-specs.en.md)

## Feature 1：团队角色必须进入后续执行规范

### Scenario 1：Lead 与 subAgent 角色明确

- **Given** 仓库进入新的执行波次
- **When** Lead 准备拆任务并启用 subAgent
- **Then** 必须先声明包拯、公孙策、展昭、执行小队、八贤王的职责映射
- **And** 每个子成员必须拥有明确文件边界与验证责任

### Scenario 2：目标文件只读

- **Given** 仓库存在 `docs/goal/v0.1.md`
- **When** 任意成员推进任务
- **Then** 目标文件只能读取和对照
- **And** 不得将实现需要反向写入目标文件

## Feature 2：runtime 调整后必须无 error

### Scenario 3：runtime 报错优先级最高

- **Given** 当前波次同时存在 runtime 修复与体验优化
- **When** runtime 报错出现
- **Then** 非 `P0` TODO 必须冻结
- **And** 团队先完成 runtime 根因修复与回归验证

### Scenario 4：runtime 调整后的最低质量闸

- **Given** 任意 runtime 敏感路径发生改动
- **When** 团队准备宣布完成
- **Then** `npm run typecheck -- --pretty false` 必须通过
- **And** `npm run test -- --run` 必须通过

## Feature 3：TODO 必须按队列推进

### Scenario 5：交付阻断项先于体验优化

- **Given** 同时存在回收站真实数据缺口与交互细节优化
- **When** Lead 编排下一波 TODO
- **Then** 回收站真实数据流应先于低优先级体验项进入执行

### Scenario 6：TODO 必须带验证命令

- **Given** 一个 TODO 被放入执行队列
- **When** 团队准备开始实现
- **Then** 该 TODO 必须附带负责人、依赖、BDD 场景和验证命令
- **And** 若无验证命令则该 TODO 不得算作可执行项
