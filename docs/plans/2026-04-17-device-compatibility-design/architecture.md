# 架构设计 - 机型适配

## 组件架构

```
src/
├── ui/
│   └── components/
│       ├── SafeAreaContainer.tsx      # 安全区容器组件
│       ├── NotchAwareHeader.tsx       # 刘海感知头部
│       └── BottomSafeArea.tsx         # 底部安全区
├── services/
│   └── device/
│       ├── screen-info.ts             # 屏幕信息获取
│       ├── notch-detector.ts          # 刘海检测
│       └── emulator-config.ts         # 模拟器配置
└── features/
    └── compatibility/
        ├── use-orientation.ts         # 方向变化处理
        └── use-screen-type.ts         # 屏幕类型检测
```

## 技术选型

### 核心库
- `react-native-safe-area-context` - 安全区计算（已集成）
- `react-native-device-info` - 设备信息获取（可选）
- `@react-native-community/hooks` - 屏幕尺寸 hooks

### 测试工具
- rn-notch-testing skill - 自动化测试
- ADB + Android Emulator - 多机型验证
- Fastlane Screengrab - 截图自动化

## 屏幕类型检测逻辑

```typescript
// 基于 SafeAreaInsets 推断屏幕类型
function detectScreenType(insets: EdgeInsets): ScreenType {
  // 顶部额外高度 > 30 可能是刘海屏
  if (insets.top > 30) return 'notch';
  // 顶部高度在 24-30 之间可能是打孔屏
  if (insets.top >= 24 && insets.top <= 30) return 'hole-punch';
  return 'standard';
}
```

## 模拟器配置矩阵（扩展版）

```json
{
  "devices": [
    // 标准屏
    { "name": "Pixel_5", "type": "standard", "api": 31, "screen": "1080x2340", "density": "420dpi" },
    { "name": "Pixel_8", "type": "standard", "api": 34, "screen": "1080x2400", "density": "420dpi" },

    // 刘海屏（居中刘海）
    { "name": "Pixel_7_Notch", "type": "notch", "api": 33, "screen": "1080x2400", "density": "420dpi", "notch": "center" },
    { "name": "Huawei_P30", "type": "notch", "api": 28, "screen": "1080x2340", "density": "420dpi", "notch": "center" },
    { "name": "Xiaomi_9", "type": "notch", "api": 29, "screen": "1080x2340", "density": "440dpi", "notch": "center" },

    // 水滴屏（小刘海）
    { "name": "OnePlus_7", "type": "teardrop", "api": 29, "screen": "1080x2400", "density": "402dpi", "notch": "teardrop" },
    { "name": "Redmi_Note_8", "type": "teardrop", "api": 28, "screen": "1080x2340", "density": "409dpi", "notch": "teardrop" },

    // 打孔屏（居中打孔）
    { "name": "Samsung_S23", "type": "hole-punch", "api": 33, "screen": "1080x2340", "density": "450dpi", "hole": "center" },
    { "name": "Pixel_8_Pro", "type": "hole-punch", "api": 34, "screen": "1344x2992", "density": "489dpi", "hole": "center" },
    { "name": "Xiaomi_13", "type": "hole-punch", "api": 33, "screen": "1080x2400", "density": "419dpi", "hole": "center" },

    // 打孔屏（左上打孔）
    { "name": "Samsung_S20", "type": "hole-punch-left", "api": 30, "screen": "1440x3200", "density": "560dpi", "hole": "left" },
    { "name": "Huawei_Mate_40", "type": "hole-punch-left", "api": 30, "screen": "1344x2772", "density": "456dpi", "hole": "left" },

    // 瀑布屏/曲面屏
    { "name": "Pixel_7_Pro", "type": "waterfall", "api": 33, "screen": "1440x3120", "density": "512dpi", "edge": "curved" },
    { "name": "Samsung_S23_Ultra", "type": "waterfall", "api": 33, "screen": "1440x3088", "density": "500dpi", "edge": "curved" },
    { "name": "OnePlus_11", "type": "waterfall", "api": 33, "screen": "1440x3216", "density": "525dpi", "edge": "curved" },

    // 药丸屏（灵动岛类似）
    { "name": "Honor_90", "type": "pill", "api": 33, "screen": "1200x2664", "density": "435dpi", "notch": "pill" },

    // 平板设备
    { "name": "Pixel_Tablet", "type": "tablet", "api": 33, "screen": "1600x2560", "density": "320dpi" },
    { "name": "Galaxy_Tab_S9", "type": "tablet", "api": 33, "screen": "1600x2560", "density": "274dpi" },

    // 折叠屏（外屏）
    { "name": "Galaxy_Z_Flip5_Cover", "type": "foldable-cover", "api": 33, "screen": "720x748", "density": "301dpi" },
    { "name": "Galaxy_Z_Fold5_Cover", "type": "foldable-cover", "api": 33, "screen": "904x2316", "density": "412dpi" },

    // 折叠屏（内屏）
    { "name": "Galaxy_Z_Flip5_Inner", "type": "foldable-inner", "api": 33, "screen": "1080x2640", "density": "426dpi", "fold": "horizontal" },
    { "name": "Galaxy_Z_Fold5_Inner", "type": "foldable-inner", "api": 33, "screen": "1812x2176", "density": "374dpi", "fold": "vertical" },

    // 补充机型（平衡 API 分布）
    { "name": "Pixel_6a", "type": "hole-punch", "api": 31, "screen": "1080x2400", "density": "429dpi", "hole": "center" },
    { "name": "Redmi_9A", "type": "standard", "api": 29, "screen": "720x1600", "density": "269dpi" },
    { "name": "Samsung_A14", "type": "hole-punch", "api": 31, "screen": "1080x2408", "density": "400dpi", "hole": "center" }
  ]
}
```

### 机型分类统计（优化后）

| 类型 | 数量 | 代表机型 |
|------|------|----------|
| 标准屏 | 3 | Pixel 5/8, Redmi 9A (720p) |
| 刘海屏 | 3 | Pixel 7 Notch, Huawei P30, Xiaomi 9 |
| 水滴屏 | 2 | OnePlus 7, Redmi Note 8 |
| 打孔屏（居中） | 4 | Samsung S23, Pixel 8 Pro/6a, Xiaomi 13, Samsung A14 |
| 打孔屏（左上） | 2 | Samsung S20, Huawei Mate 40 |
| 瀑布屏 | 3 | Pixel 7 Pro, Samsung S23 Ultra, OnePlus 11 |
| 药丸屏 | 1 | Honor 90 |
| 平板 | 2 | Pixel Tablet, Galaxy Tab S9 |
| 折叠屏外屏 | 2 | Galaxy Z Flip5, Galaxy Z Fold5 |
| 折叠屏内屏 | 2 | Galaxy Z Flip5 Inner, Galaxy Z Fold5 Inner |
| **总计** | **24** | 覆盖主要屏幕类型 |

### API 级别分布（优化后）

| API 级别 | Android 版本 | 设备数 | 占比 |
|----------|--------------|--------|------|
| API 28 | Android 9 | 2 | 8% |
| API 29 | Android 10 | 3 | 12% |
| API 30 | Android 11 | 2 | 8% |
| API 31 | Android 12 | 3 | 12% |
| API 33 | Android 13 | 11 | 46% |
| API 34 | Android 14 | 3 | 12% |

**优化目标**：API 28-31 从 20% 提升到 40%，降低对 API 33 的过度依赖。
