# Task 017: Integration and E2E Test

## 负责人
八贤王

## 任务类型
Test / Verification

## 目标
执行端到端集成测试，验证所有功能协同工作，确保设计目标达成。

## BDD 场景覆盖

### 完整用户流程测试

```gherkin
Scenario: 完整清理流程
Given 用户首次打开应用
When 授予照片权限
Then 显示照片网格

When 点击扫描按钮
Then 显示扫描进度
And 进度完成后显示问题照片

When 长按选择问题照片
And 点击清理
Then 照片移动到回收站

When 切换到回收站 Tab
Then 显示已删除照片

When 点击恢复
Then 照片移回主相册
```

### 边缘场景测试

```gherkin
Scenario: 无照片权限
Given 用户未授予照片权限
When 打开应用
Then 显示权限请求页面

Scenario: 扫描无结果
Given 扫描完成
When 未发现问题照片
Then 显示 "未发现异常照片" 提示

Scenario: 回收站为空
Given 用户在回收站 Tab
When 回收站为空
Then 显示空状态插图
```

## 测试范围

### 功能测试

- [ ] 底部 Tab 导航（3 个 tabs 切换）
- [ ] 照片网格（3 列布局，分段过滤）
- [ ] 扫描进度（动画，计数器，取消）
- [ ] 照片选择（长按，多选，清理）
- [ ] 详情页（全屏，视频，重复对比）
- [ ] 设置（扫描范围，语言，主题，提醒）
- [ ] 回收站（恢复，永久删除）
- [ ] 主题（系统跟随，手动切换）

### 性能测试

- [ ] 照片网格滚动流畅（60fps）
- [ ] 扫描进度动画流畅
- [ ] 内存占用正常

### 无障碍测试

- [ ] Tab 标签可读
- [ ] 按钮触摸目标 >= 44pt
- [ ] 颜色对比度符合标准

## 验收标准

| 检查项 | 状态 |
|--------|------|
| 所有单元测试通过 | ⬜ |
| 所有集成测试通过 | ⬜ |
| iOS 风格视觉设计 | ⬜ |
| 性能达标（60fps） | ⬜ |
| 无障碍合规 | ⬜ |
| 代码审查通过 | ⬜ |

## 依赖
- Task 007: Scan Progress Implementation
- Task 009: Photo Selection Mode Implementation
- Task 011: Detail View Implementation
- Task 013: Settings Screen Implementation
- Task 015: Recycle Bin Implementation
- Task 016: Theme Integration

## 预估工作量
4-6 小时
