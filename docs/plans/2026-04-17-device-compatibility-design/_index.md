# 机型适配验证和测试设计

## Context

根据目标文档 v0.1.md 第 64-68 行要求：
> 需要适配所有的 App 机型，包含打孔屏、刘海屏
> 所有的机型需要验证和测试过才算完备

当前状态：
- ✅ 已使用 `react-native-safe-area-context` 进行基础适配
- ✅ TabBar 和 Screen 组件已使用 `useSafeAreaInsets`
- ⚠️ 缺乏针对打孔屏、刘海屏的系统化验证方案
- ⚠️ 缺乏自动化测试覆盖

## Requirements

1. **覆盖所有屏幕类型**：标准屏、刘海屏（ notch ）、打孔屏（hole-punch）、瀑布屏（waterfall）
2. **验证关键场景**：状态栏、底部导航、横竖屏切换
3. **建立测试矩阵**：不同品牌、不同屏幕尺寸
4. **自动化验证**：截图对比、布局检查

## 方案选择

**采用方案：模拟器矩阵方案**

理由：
1. 成本低 - 无需购买实体设备
2. 覆盖全 - 可配置 20+ 种屏幕类型
3. 可复现 - 测试环境标准化
4. 自动化 - 可集成截图对比

### 模拟器矩阵（24 台设备，优化版）

| 类型 | 数量 | 代表机型 |
|------|------|----------|
| 标准屏 | 3 | Pixel 5/8, Redmi 9A (720p 低端机) |
| 刘海屏 | 3 | Pixel 7 Notch, Huawei P30, Xiaomi 9 |
| 水滴屏 | 2 | OnePlus 7, Redmi Note 8 |
| 打孔屏（居中） | 4 | Samsung S23, Pixel 8 Pro/6a, Samsung A14 |
| 打孔屏（左上） | 2 | Samsung S20, Huawei Mate 40 |
| 瀑布屏 | 3 | Pixel 7 Pro, Samsung S23 Ultra, OnePlus 11 |
| 药丸屏 | 1 | Honor 90 |
| 平板 | 2 | Pixel Tablet, Galaxy Tab S9 |
| 折叠屏外屏 | 2 | Galaxy Z Flip5, Galaxy Z Fold5 |
| 折叠屏内屏 | 2 | Galaxy Z Flip5 Inner, Galaxy Z Fold5 Inner |
| **总计** | **24** | 覆盖主要屏幕类型 |

**API 分布优化**：API 28-31 从 20% 提升到 40%，新增 720p 低端机和折叠屏内屏。

### 验证流程

1. **Phase 1**: 创建模拟器矩阵（张龙）
2. **Phase 2**: 自动化截图测试（赵虎）
3. **Phase 3**: 关键场景验证（王朝、马汉）
4. **Phase 4**: 八贤王验收

## Detailed Design

### 1. 屏幕类型分类

| 类型 | 特征 | 代表机型 |
|------|------|----------|
| 标准屏 | 无刘海/打孔 | Pixel 5 |
| 刘海屏 | 顶部凹槽 | iPhone 13 |
| 打孔屏 | 摄像头孔 | Samsung S23 |
| 瀑布屏 | 曲面边缘 | Pixel 7 Pro |
| 灵动岛 | 药丸形区域 | iPhone 14 Pro |

### 2. 验证清单

#### 状态栏区域
- [ ] 状态栏高度正确获取
- [ ] 内容不被刘海/打孔遮挡
- [ ] 横屏时刘海侧内容处理

#### 底部导航
- [ ] 底部安全区正确计算
- [ ] 手势导航区域（Android 10+）
- [ ] 底部 TabBar 位置正确

#### 横竖屏切换
- [ ] 刘海位置变化处理
- [ ] 内容重新布局
- [ ] 全屏模式适配

### 3. 测试策略

**Phase 1**: Android Emulator 矩阵验证
- 创建 5-8 种常见屏幕配置
- 手动验证关键场景
- 截图存档

**Phase 2**: rn-notch-testing 自动化
- 使用技能进行自动化验证
- 集成到 CI/CD

**Phase 3**: 真机抽样验证
- 选取 2-3 台实体设备验证
- 最终确认

## Design Documents

- [BDD Specifications](./bdd-specs.md) - 行为场景和测试策略
- [Architecture](./architecture.md) - 技术架构和组件设计
- [Best Practices](./best-practices.md) - 屏幕适配最佳实践

## Team Assignment

| 成员 | 任务 |
|------|------|
| 公孙策 | 架构设计、测试矩阵规划 |
| 展昭 | 核心适配逻辑实现 |
| 张龙 | Android Emulator 配置 |
| 赵虎 | 自动化测试编写 |
| 王朝 | 横竖屏切换处理 |
| 马汉 | 截图对比验证 |
| 八贤王 | 最终验收 |
