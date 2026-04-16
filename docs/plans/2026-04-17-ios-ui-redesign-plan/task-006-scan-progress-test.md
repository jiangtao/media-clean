# Task 006: Scan Progress Animation Test

## 负责人
王朝

## 任务类型
Test (Red)

## 目标
为扫描进度动画编写测试，验证进度显示、计数器动画和完成回调。

## BDD 场景

### 场景 3.1: 开始扫描

```gherkin
Given 用户在照片主屏
When 用户点击扫描按钮
Then 显示扫描进度覆盖层
And 显示圆形进度条
And 显示计数器 "识别中... 0/300"
And 显示当前分析文件名
And 进度条开始动画
```

### 场景 3.2: 扫描进行中

```gherkin
Given 扫描正在进行
When 已分析 150 个项目
Then 计数器显示 "识别中... 150/300"
And 进度条显示 50%
And 进度条颜色从蓝色过渡到绿色

When 分析每个新项目
Then 计数器数字滚动动画
And 当前文件名更新
```

### 场景 3.3: 扫描完成

```gherkin
Given 扫描完成 300/300
When 进度达到 100%
Then 进度条脉冲动画
And 显示 "识别完成"
And 1秒后自动关闭覆盖层
And 切换到结果页面显示问题照片

Given 扫描发现问题照片
Then 显示 "发现 12 个问题照片"
And 仅显示问题照片网格
```

### 场景 3.4: 取消扫描

```gherkin
Given 扫描正在进行
When 用户点击取消按钮
Then 立即停止扫描
And 关闭进度覆盖层
And 返回照片主屏
And 保留已分析结果
```

## 测试文件

- `src/ui/components/__tests__/ScanProgress.test.tsx`
- `src/ui/components/__tests__/ScanCounter.test.tsx`
- `src/features/scan/__tests__/scan-with-progress.test.ts`

## 测试要点

1. **进度显示测试**
   - 验证覆盖层显示/隐藏
   - 验证进度条渲染
   - 验证计数器显示

2. **动画测试**
   - 验证进度条动画
   - 验证计数器滚动
   - 验证颜色过渡

3. **完成回调测试**
   - 验证 100% 时触发完成
   - 验证 1 秒后关闭
   - 验证切换到结果

4. **取消测试**
   - 验证取消按钮
   - 验证停止扫描
   - 验证保留结果

## 验证标准

- [ ] 所有测试用例通过
- [ ] 覆盖开始扫描场景
- [ ] 覆盖扫描进行场景
- [ ] 覆盖扫描完成场景
- [ ] 覆盖取消扫描场景

## 依赖
- Task 001: Setup React Navigation

## 预估工作量
3-4 小时
