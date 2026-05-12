# v0.4 文案 Clarify 终验

## 终验上下文

依据 [.impeccable.md](/Users/jt/places/personal/app-cleaner/.impeccable.md:1) 的既有设计上下文，本产品面对的是“为自己或家人整理手机相册的中文移动端用户”。文案通过标准不是“像设计稿”，而是：

1. 看得清当前状态。
2. 知道下一步做什么。
3. 高风险动作不产生误解。
4. 中文像真实产品，英文不出现明显翻译腔或错误动作承诺。

## 本轮已修正

| 位置 | 原问题 | 当前修正 |
| --- | --- | --- |
| Landing 未授权 CTA | 旧文案 `前往授权 / Grant access` 暗示按钮会直接拉起系统授权，但真实动作是先进入工作区，再在工作区中授权 | 改为 `进入工作区并授权 / Open and grant access` |
| Landing 未授权说明 | 原句过长，且“扫描相册中的异常内容”在未进入工作区前显得过早 | 改为更明确的顺序表达：`进入工作区后授权即可开始扫描`、`进入工作区后授权，即可开始扫描并分析相册中的异常内容` |
| Settings 提醒卡标题 | 英文 `Recurring Cleanup Readiness` 偏生硬，且不贴合 06 设计稿短标题 | 改为设置页专用 `定期提醒 / Reminders`，不改变通知业务标题 |
| 扫描完成后的过渡状态 | 旧状态从“扫描中”直接进入结果摘要，用户看不到“扫描已完成但还在整理结果”的中间状态 | 增加 `识别中 / Recognizing results`，文案明确表达“扫描 100%，正在整理分类结果”，不改变扫描算法语义 |
| Photos / Detail 成对动作 | 局部仍使用 `清除 / Clear`，与本轮用户要求的成对口径 `保留 / 清理` 不一致 | 将照片批量操作与详情页候选处理统一为 `保留 / 清理`、`Keep / Clean`；缓存维护仍保留 `清除缓存 / Clear cache`，因为语义是移除本地缓存而不是清理媒体 |
| 继续扫描英文 | 英文 `Scan again` 容易被理解为重新开始扫描，而真实语义是接续上一批或处理新增变化媒体 | 改为 `Continue scan`，与中文 `继续扫描` 和扫描恢复语义一致 |

相关代码与测试：

1. [app-copy.ts](/Users/jt/places/personal/app-cleaner/src/i18n/app-copy.ts:415)
2. [LandingScreen.test.tsx](/Users/jt/places/personal/app-cleaner/src/ui/screens/__tests__/LandingScreen.test.tsx:96)

## 本轮 `$impeccable` 重来后的复核

1. `Photos` 网格、扫描态、结果态和筛选态的布局适配调整没有改变“扫描 / 继续扫描 / 保留 / 清理”的动作含义。
2. `RecycleBin` 的视觉层级调整没有把“恢复”和“彻底删除”混成同一风险等级；删除仍走原有确认链。
3. `Settings` 的卡片、chip 和最大宽度调整没有改变语言、主题、提醒、扫描范围、缓存清理的业务语义。
4. 主题色从旧暖色转向设计稿冷白蓝/深蓝黑后，危险动作仍保留红色语义，恢复/保留仍保留安全动作语义。
5. 本轮没有把设计稿的视觉文案硬编码成不可翻译文本。

## 当前通过项

1. Landing 主叙事已经从“产品营销页”收回到“扫描入口页”，中文主文案方向正确。
2. Photos 扫描 / 结果页的核心动作文案现在都能表达“本地扫描、继续扫描、查看并决定清理或保留”的真实语义。
3. RecycleBin 的高风险动作提示仍保持清楚，`确认 / 再次确认 / 彻底删除不可恢复` 这条链没有被这轮重构破坏。
4. Settings 设置页主说明、语言/主题切换和提醒偏好说明已收敛为短标题、短动作和明确状态，不再使用冗长解释当主层级。
5. SE/RN 适配重跑只调整视觉 token、网格尺寸、响应式容器和底部操作布局，没有改变高风险动作承诺。

## 当前未完全闭环项

1. 最新 SVG 扫描环与回收站 1px boxShadow 视觉修正后的物理真机运行态截图尚未补齐；这是完成定义阻塞项，但不是文案语义阻塞项。
2. English 运行态 smoke 当前不作为模块收口前置；语言切换链路已由既有 Settings / Maestro smoke 覆盖。
3. 若进入“所有机型完备”最终放行，再补更多 AVD / 真机矩阵；当前 Android-first v0.4 真机收口不以此为阻断。

## 验证

1. `npm run test -- --run src/ui/components/__tests__/PhotoGrid.test.tsx src/ui/components/__tests__/PhotoGridItem-selection.test.tsx src/ui/screens/__tests__/PhotoGridScreen.test.tsx src/ui/screens/__tests__/RecycleBinScreen.test.tsx src/ui/screens/__tests__/SettingsScreen.test.tsx src/theme/app-theme.test.ts`
2. `npm run typecheck`
3. `npm run test -- --run`
4. `git diff --check`
5. `CI=1 npm run start -- --port 8099`

## 结论

文案层面可记为**通过**：本轮 `$impeccable` 重来没有引入新的高风险语义问题，`保留 / 清理`、`继续扫描`、权限入口和二次确认链路语义已收敛。最终 goal 仍不能关闭，因为最新 SVG 扫描环与回收站 1px boxShadow 修正缺物理真机截图复验；该阻塞已在 [completion-audit.md](./completion-audit.md) 记录。
