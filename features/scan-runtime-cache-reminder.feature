# English Version: ./scan-runtime-cache-reminder.en.feature

Feature: 运行时稳定性、分析缓存与提醒触发
  为了让照片清理体验稳定且高效
  作为使用者
  我希望应用在关闭详情、重复扫描分析、主线程渲染与定时提醒上都有明确可验证的行为

  Scenario: 关闭正在播放的视频详情时不应触发 runtime 报错
    Given 用户正在详情页播放一个视频
    When 用户点击关闭按钮返回上一层
    Then 详情页应正常关闭
    And 不应因为播放器释放流程再次触发 pause 或抛出 runtime 异常

  Scenario: 已分析过且未变化的媒体应优先复用本地持久化分析缓存
    Given 用户之前已经完成过一次扫描
    And 应用本地已持久化媒体分析结果
    When 用户再次扫描同一批未变化媒体
    Then 系统应优先复用对应媒体的本地分析缓存
    And 不应重复生成缩略分析结果或重复计算同一媒体指纹

  Scenario: 扫描分析不应长时间阻塞主线程渲染
    Given 用户开始扫描最近媒体
    When 扫描正在持续分析图片与视频
    Then 主线程应保持可响应
    And 分析过程应采用 worker 或可让渡主线程的切片执行策略

  Scenario: 开启提醒后仅在最近扫描范围内存在新增媒体时触发提醒
    Given 用户已经开启定时扫描提醒
    And 用户将扫描范围设置为最近 3 个月
    When 系统检测到最近 3 个月内出现新增图片或视频
    Then 提醒才应被视为可触发
    And 若最近 3 个月内没有新增媒体则不应触发提醒

  Scenario: 当前 live 应用入口冷启动时应对已开启提醒执行 reconcile
    Given 用户此前已经在设置页开启过定时扫描提醒
    And 当前应用通过 App.tsx 进入主导航
    When 应用冷启动并恢复本地提醒设置
    Then 系统应在当前 live 入口中对提醒进行 reconcile
    And 若提醒元数据发生变化则应回写到本地持久化存储
