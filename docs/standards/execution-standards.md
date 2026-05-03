# 执行规范

[English Version](./execution-standards.en.md)

## 适用范围

本文档定义本仓库后续执行时必须遵守的团队组织、质量闸、TODO 推进顺序与验收纪律。其约束范围覆盖设计、计划、实现、验证与交付全过程。

## 一、目标文件与验收源

1. `docs/goal/*.md` 全部是不可变目标文件，只能读取、对照、引用，不得改写。
2. 当仓库存在多个版本目标文件时，由用户显式点名的最新目标版本成为当前活跃目标源。
3. 当前活跃目标源为 `docs/goal/v0.3.md`；`docs/goal/v0.2.md` 与 `docs/goal/v0.1.md` 作为历史基线保留，只用于回看既有能力与演进边界，不再主导当前波次。
4. 每一轮执行结束时，必须同时对照以下验收源：
   - `docs/goal/v0.3.md`
   - `docs/goal/v0.2.md`（仅用于上一波次能力回看）
   - `docs/goal/v0.1.md`（仅用于历史差异回看）
   - 已生效的标准文档
   - 对应设计文档
   - 对应执行计划
   - 对应 BDD 场景或 `.feature` 文件
5. 若代码、计划、标准三者不一致，以当前活跃目标源和已确认标准为先，不得以“代码先写了”为由倒逼目标让步。

## 二、团队组织标准

1. **包拯** 为 Lead，主线程即包拯，负责总控范围、裁决取舍、冻结或放行 TODO 波次。
2. **公孙策** 负责架构审查，专管边界、真值源、模块耦合、扩展性与 live 路径正确性。
3. **展昭** 负责核心执行与根集成，专管主路径实现、跨模块收口与疑难修复。
4. **张龙、赵虎、王朝、马汉** 为执行小队，只接受 Lead 分派的明确文件所有权与任务边界。
5. **八贤王** 负责验收；未过验收者，不得宣称“完成”。
6. 若使用 subAgent，角色映射必须稳定：
   - Lead：主线程
   - 架构：`explorer` 或等价审查型 agent
   - 执行：`worker` 或等价实现型 agent
   - 验收：审查型 agent 或主线程终验
7. 任一子成员汇报时，必须附：
   - 改动范围
   - 验证证据
   - 未收口风险
   仅报“已完成”而无证据者，不予采信。

## 三、执行链标准

1. 默认执行链为：
   - `brainstorming`
   - `writing-plans`
   - `executing-plans`
   - `behavior-driven-development / agent-team-driven-development`
   - `verification`
2. 若用户已明确给出可执行计划，可直接进入执行，不得强制重做设计。
3. 若任务存在两个及以上可并行子问题，Lead 应显式启用 subAgent，并分配互不冲突的文件所有权。
4. 若任务高度耦合、下一步结果依赖即时上下文，则由主线程直接执行，不得为并行而并行。

## 四、质量第一标准

1. 客户端以质量第一；一旦出现 `runtime error`，立即冻结非 P0 功能推进，先清 runtime。
2. 任何触及 runtime 敏感路径的改动，至少包括以下范围：
   - `App.tsx`
   - 导航
   - 屏幕入口
   - 扫描链路
   - 提醒链路
   - 视频/图片详情渲染链路
3. 每一次 runtime 敏感改动后，必须保证“无 error”再继续下一项 TODO。
4. 此处“无 error”不是口号，而是至少满足：
   - 类型检查通过
   - 相关测试通过
   - 不存在已知红屏、崩溃、未处理异步异常
   - 当前 live 入口路径未被遗留入口绕开
5. 若修复 runtime 时发现根因在遗留路径与 live 路径分裂，必须优先修 live 路径，不得继续向遗留入口堆逻辑。

## 五、质量闸

1. `npm run typecheck -- --pretty false` 是硬门槛。
2. `npm run test -- --run` 是硬门槛。
3. 若改动只影响局部模块，先跑定向测试；定向通过后仍必须跑全量测试再收口。
4. 若改动涉及 runtime 敏感路径，必须补足或更新对应回归测试，至少覆盖：
   - 视频详情关闭不崩
   - 重复扫描复用持久化分析缓存
   - 扫描分析让渡主线程而非长时间霸占 UI
   - 提醒冷启动 reconcile 与同步调度
   - 详情动作、扫描动作不产生未处理异常
5. 当前仓库尚无 `lint` 脚本，因此 `typecheck + vitest --run` 共同构成最低质量闸，不得省略。
6. 任何新增逻辑若无法被测试覆盖，必须明确说明原因与替代验收手段；否则不得合入。

## 六、TODO 推进标准

1. TODO 不得平铺推进，必须分级。
2. 默认优先级如下：
   - `P0`：runtime、崩溃、数据错乱、主路径阻断
   - `P1`：目标文件直指能力但 live 路径未贯通
   - `P2`：体验优化、交互细化、扩展能力
   - `P3`：储备性优化、远期能力
3. 若 `P0` 未清，不得推进 `P1/P2/P3`。
4. 每个 TODO 进入执行队列前，必须具备：
   - 负责人
   - 依赖关系
   - 对应 BDD 场景
   - 验证命令
   - 完成定义
5. 没有测试或验收命令的 TODO，不算“可执行 TODO”，只算“待办说明”。

## 七、当前默认 TODO 队列

1. 第一队列：`v0.3` 产品化主流程
   - 升级标准/计划，使当前波次明确锚定 `docs/goal/v0.3.md`
   - 首页必须突出“扫描 -> 识别 -> 筛选 -> 清理 -> 报告”主流程
   - 扫描页必须显式展示识别分类摘要，而不是只有列表结果
2. 第二队列：保留和清理与累计报告
   - 回收站语义收紧为“保留和清理”
   - 真删除必须写入 `SQLite` 累计清理报告
   - 恢复动作不得回滚累计报告
3. 第三队列：远程可观测性 foundation
   - Firebase / Crashlytics / Analytics 不进入当前 Android 第一版
   - 当前版本只保留本地错误兜底，不要求真机远程上报验收
   - 后续版本重新启用时，必须补齐 service files、原生配置与真机验收
4. 第四队列：后续终局能力
   - Rust shared core、iOS adapter、skill / desktop 复用进入后续波次
   - 不得反向阻塞当前产品化交付

## 八、当前交付阻断 TODO

1. [src/ui/screens/LandingScreen.tsx](/Users/jt/places/personal/app-cleaner/src/ui/screens/LandingScreen.tsx:1) 尚未承担 `v0.3` 要求的五步产品流程首页。
2. [src/ui/screens/PhotoGridScreen.tsx](/Users/jt/places/personal/app-cleaner/src/ui/screens/PhotoGridScreen.tsx:1) 缺少“识别分类摘要”这一显式产品化状态层。
3. [src/ui/screens/RecycleBinScreen.tsx](/Users/jt/places/personal/app-cleaner/src/ui/screens/RecycleBinScreen.tsx:1) 尚未展示基于 `SQLite` 的累计清理报告。
4. Firebase / Crashlytics / Analytics 已从当前 Android 第一版交付阻断项中移出；不得把 noop fallback 警告当作当前版本缺陷。
5. 上述前三项未收口前，不得宣称 `docs/goal/v0.3.md` 的当前 Android 第一版交付完成。

## 九、文档纪律

1. 中文文档为主文档，英文文档为镜像文档，双方必须互链。
2. 计划、测试、报告可不做双语镜像；标准与设计默认需要。
3. 更新标准时，必须同步更新相关设计、计划或 BDD 场景，避免标准独走。
4. 文档不得脱离代码现状；若文档写了但 live 路径未接，视为未完成。

团队模式的实际运行细节，见 [agent-team-mode.md](./agent-team-mode.md)。

## 十、完成定义

1. 通过质量闸。
2. 对齐当前活跃目标源。
3. 对齐标准与 BDD。
4. 子成员验证证据完整。
5. 无阻断性 TODO 残留在当前波次内。
