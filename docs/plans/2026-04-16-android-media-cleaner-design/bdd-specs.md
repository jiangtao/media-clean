# BDD 规格

## 场景 1：首次打开时申请媒体权限

```gherkin
Scenario: User grants media permission and sees scan results
  Given 用户首次打开应用且尚未授予媒体访问权限
  When 用户点击“授权并开始扫描”并同意权限申请
  Then 应用应开始扫描本地媒体库
  And 用户应看到疑似误触媒体列表与扫描摘要
```

## 场景 2：拒绝权限时给出可恢复提示

```gherkin
Scenario: User denies permission and receives guidance
  Given 用户首次打开应用且尚未授予媒体访问权限
  When 用户拒绝媒体访问权限
  Then 应用应显示权限用途说明
  And 页面应提供再次请求授权的入口
```

## 场景 3：识别误触视频

```gherkin
Scenario: Short dark video is marked as accidental
  Given 媒体库中存在一个时长极短、文件体积较小且缩略图明显过暗的视频
  When 应用完成扫描
  Then 该视频应被标记为“疑似误触视频”
  And 结果中应展示触发原因与置信度
```

## 场景 4：识别误触照片

```gherkin
Scenario: Dark blurry photo is marked as accidental
  Given 媒体库中存在一张明显过暗、边缘信息很少且尺寸较低的照片
  When 应用完成扫描
  Then 该照片应被标记为“疑似误触照片”
  And 结果中应展示触发原因与置信度
```

## 场景 5：查看预览与详细信息

```gherkin
Scenario: User opens a candidate for preview
  Given 用户在识别结果列表中看到了候选媒体
  When 用户点击某个候选项
  Then 应用应展示大图或视频预览
  And 应用应展示类型、创建时间、体积、评分与触发原因
```

## 场景 6：自动清理只做软删除

```gherkin
Scenario: Auto cleanup moves high-confidence candidates to recycle bin
  Given 用户已完成扫描并存在高置信度候选项
  When 用户点击“自动清理”并确认操作
  Then 所有高置信度候选项应被移入应用内回收站
  And 原始媒体文件不应被立即永久删除
```

## 场景 7：手动选中清理可选择彻底删除

```gherkin
Scenario: Selected cleanup allows hard delete after confirmation
  Given 用户已在列表中选中一个或多个候选项
  When 用户点击“选中清理”并选择“彻底删除”且二次确认
  Then 应用应调用系统媒体删除能力删除这些资源
  And 这些资源不应继续出现在结果列表与回收站列表中
```

## 场景 8：回收站可恢复

```gherkin
Scenario: User restores a soft-deleted candidate
  Given 某个候选媒体已经被移入应用内回收站
  When 用户在回收站中点击“恢复”
  Then 该媒体应重新出现在识别结果列表中
  And 回收站中不应再显示该媒体
```
