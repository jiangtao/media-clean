# v0.4 BDD Specs

## 场景 1：Photos 入口态 `01`

```gherkin
Scenario: 用户首次进入 Photos，看到统一的入口卡
  Given 用户进入 Photos 页面
  And 当前权限状态为 loading 或 denied 或 granted-but-not-scanned
  When 页面完成首屏渲染
  Then 顶部应展示统一入口卡而不是散落的临时提示
  And 入口卡 copy 来自统一 i18n 真值源
  And light/dark 与 zh-CN/en-US 下都保持同一信息结构
```

## 场景 2：扫描中 `02`

```gherkin
Scenario: Android 扫描进行中时 UI 持续反馈进度且不改变既有恢复语义
  Given 用户已授权媒体库权限
  And Android native scan 或 JS scan 正在运行
  When 页面进入 scanning 状态
  Then 顶部入口卡应展示统一进度文案、批次范围和当前进度
  And foreground service / checkpoint / runtime snapshot 语义不回归
  And 扫描过程不阻塞 UI 线程
```

## 场景 3：扫描结果态 `03`

```gherkin
Scenario: 扫描完成后用户看到结果摘要和筛选入口
  Given 当前批次已经完成扫描
  When 页面进入 completed 状态
  Then 顶部入口卡应展示结果摘要与 breakdown
  And 用户可以从同一页面继续筛选照片或视频
  And 若已完成全部历史扫描，结果态应展示完成说明而非继续扫描 CTA
```

## 场景 4：工作台与详情流 `04`

```gherkin
Scenario: 用户在 Photos 内完成筛选、选中和详情查看
  Given 页面已经有扫描候选结果
  When 用户切换筛选、长按选中、单击进入详情
  Then 工作台状态、选中状态和详情流应彼此解耦
  And PhotoGrid 组件保持 dumb render，不重复承载筛选真值
  And 扫描中冻结快照查看详情的现有语义保持不变
```

## 场景 5：RecycleBin `05`

```gherkin
Scenario: 用户进入回收站查看空态、批量操作和清理报告
  Given 用户切换到 RecycleBin tab
  When 页面加载缓存与持久态
  Then 页面应展示统一主题层级、统一 copy 和 SQLite 累计清理报告
  And 空态、恢复、永久删除、批量操作文案都来自统一 i18n 真值源
```

## 场景 6：Settings `06`

```gherkin
Scenario: 用户在设置页切换语言与主题并查看扫描范围和提醒设置
  Given 用户进入 Settings tab
  When 用户切换语言、主题或扫描范围
  Then 设置页说明文案应来自统一 i18n 真值源
  And 语言默认跟系统，允许手动切换
  And 主题默认跟系统，允许手动切换 light/dark
```

## 场景 7：国际化与主题一致性

```gherkin
Scenario: 全局页面遵循系统语言与系统主题，并支持手动切换
  Given AppPreferences 已完成 hydrate
  When 用户不做手动覆盖
  Then 页面默认跟随系统语言和系统主题
  When 用户手动切换语言或主题
  Then Landing / Photos / RecycleBin / Settings 都应立即反映变化
```

## 场景 8：通知逻辑不变

```gherkin
Scenario: v0.4 UI 重构不改变通知业务语义
  Given 用户已存在既有扫描完成提醒与清理提醒逻辑
  When 扫描恢复、扫描完成或提醒设置发生变化
  Then 通知触发条件、恢复语义和权限处理保持现有逻辑不变
  And 相关回归以现有 notification tests 与 Android lane 证据守护
```

## 场景 9：特殊屏可用

```gherkin
Scenario: 异形屏与大屏设备上目标页无遮挡且可操作
  Given 设备可能为打孔屏、刘海屏、横屏、大屏或折叠态
  When 用户访问 Photos、RecycleBin、Settings
  Then 顶部内容、筛选区、操作栏和底部交互不应被遮挡
  And 本波不强制引入双栏 IA，但必须保证安全区正确和操作可达
```
