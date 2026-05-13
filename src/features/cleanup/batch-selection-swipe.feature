Feature: 选中模式下滑动批量选中
  作为使用误触清理应用的用户
  我希望在进入选中模式后可以通过滑动快速批量选择多个网格项
  以便高效地批量清理大量媒体文件

  Background:
    Given 用户已进入媒体网格页面
    And 网格显示至少 6 个媒体项，排列为 3 列 2 行
    And 网格项 ID 分别为 item-1, item-2, item-3, item-4, item-5, item-6

  Scenario: 进入选中模式后水平滑动批量选中多个网格项
    Given 用户已通过长按 item-2 进入选中模式
    And item-2 已被选中
    When 用户手指从 item-2 位置水平向右滑动到 item-3
    Then item-2 和 item-3 都应被选中
    And 选中计数应显示为 2

  Scenario: 进入选中模式后水平滑动经过多个网格项批量选中
    Given 用户已通过长按 item-1 进入选中模式
    And item-1 已被选中
    When 用户手指从 item-1 位置水平向右滑动到 item-3
    Then item-1, item-2, item-3 都应被选中
    And 选中计数应显示为 3

  Scenario: 选中模式下斜向滑动批量选中覆盖区域的网格项
    Given 用户已通过长按 item-1 进入选中模式
    And 网格布局为 3 列
    When 用户手指从 item-1 位置斜向滑动到 item-5（即对角线方向）
    Then 滑动路径覆盖的网格项 item-1, item-2, item-4, item-5 都应被选中
    And 选中计数应显示为 4

  Scenario: 选中模式下斜向滑动覆盖多行区域批量选中
    Given 用户已通过长按 item-2 进入选中模式
    And 网格布局为 3 列
    When 用户手指从 item-2 位置斜向滑动到 item-6
    Then 滑动路径覆盖的网格项 item-2, item-3, item-5, item-6 都应被选中
    And 未被覆盖的 item-1 和 item-4 保持未选中状态

  Scenario: 滑动过程中取消手势但已选中的项保持选中
    Given 用户已进入选中模式并选中了 item-1
    When 用户开始从 item-1 向右滑动到 item-3
    And 滑动过程中 item-2 和 item-3 被自动选中
    And 用户在滑动过程中将手指移出屏幕或触发系统取消手势
    Then item-1, item-2, item-3 应保持选中状态
    And 选中计数应显示为 3

  Scenario: 滑动过程中抬起手指后再次滑动继续批量选中
    Given 用户已进入选中模式并已通过滑动选中了 item-1 和 item-2
    When 用户抬起手指结束第一次滑动
    And 用户再次从 item-2 位置滑动到 item-4
    Then item-1 应保持选中
    And item-2, item-3, item-4 都应被选中
    And 选中计数应显示为 4

  Scenario: 非选中模式下滑动不触发批量选中
    Given 用户未进入选中模式
    And 没有媒体项被选中
    When 用户在网格上执行水平滑动操作
    Then 不应有任何媒体项被选中
    And 滑动应触发网格的正常滚动行为

  Scenario: 非选中模式下长按后滑动不触发批量选中
    Given 用户未进入选中模式
    When 用户按住某个网格项但未完成长按触发
    And 用户在按住状态下滑动手指
    Then 不应进入选中模式
    And 不应有任何媒体项被选中
    And 滑动应触发网格的正常滚动行为

  Scenario: 选中模式下向上滑动批量选中多行网格项
    Given 用户已通过长按 item-4 进入选中模式
    And 网格显示至少 2 行
    When 用户手指从 item-4 位置向上滑动到 item-1
    Then item-1, item-2, item-3, item-4 都应被选中
    And 选中计数应显示为 4

  Scenario: 选中模式下向下滑动批量选中多行网格项
    Given 用户已通过长按 item-1 进入选中模式
    And 网格显示至少 2 行
    When 用户手指从 item-1 位置向下滑动到 item-6
    Then 滑动路径覆盖的所有网格项都应被选中
    And 选中计数应反映实际选中的项目数

  Scenario: 选中模式下反向滑动取消已选中项
    Given 用户已进入选中模式
    And 已通过滑动选中了 item-1, item-2, item-3
    When 用户从 item-3 位置反向滑动回 item-1
    Then item-2 和 item-3 应被取消选中
    And 只有 item-1 保持选中状态

  Scenario: 快速滑动也能正确识别覆盖的网格项
    Given 用户已进入选中模式
    When 用户快速从网格左侧滑动到右侧
    Then 滑动路径覆盖的所有网格项都应被正确选中
    And 不应因滑动速度过快而遗漏中间项
