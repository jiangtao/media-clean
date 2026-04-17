# 最佳实践 - 机型适配

## SafeArea 使用规范

### ✅ 正确做法
```tsx
import { useSafeAreaInsets } from 'react-native-safe-area-context';

function Screen() {
  const insets = useSafeAreaInsets();
  return (
    <View style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}>
      {/* 内容 */}
    </View>
  );
}
```

### ❌ 避免做法
```tsx
// 不要硬编码状态栏高度
<View style={{ paddingTop: 44 }}> {/* iOS 刘海屏高度 */}
```

## 刘海屏适配原则

1. **永远使用 SafeArea** - 不要假设状态栏高度
2. **测试横竖屏** - 刘海位置会变化
3. **避免关键内容在边缘** - 可能被圆角遮挡
4. **全屏模式例外** - 图片/视频预览可以全屏

## Android 特有注意事项

- 状态栏透明/沉浸式需要额外配置
- 手势导航栏高度变化（Android 10+）
- 不同厂商自定义刘海形状
- 底部导航栏动态隐藏/显示

## 测试检查清单

### 标准屏
- [ ] 内容正常显示
- [ ] 无额外空白

### 刘海屏
- [ ] 顶部内容避开刘海
- [ ] 横屏时刘海在正确侧
- [ ] 全屏模式可隐藏刘海

### 打孔屏
- [ ] 状态栏图标不被遮挡
- [ ] 前置摄像头区域无重要内容

### 瀑布屏
- [ ] 边缘内容可正常交互
- [ ] 重要信息不在曲面区域
