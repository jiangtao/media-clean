# Task 103: 重复与相似识别失败样本测试

## 目标

为 Duplicate V2 与 Similar 分层建立失败样本。

## 覆盖范围

1. 完全相同照片
2. 轻微压缩差异照片
3. 裁剪 / 旋转后仍相似的照片
4. fallback 后仍应进入复核的样本

## 负责人

赵虎

## 验证

`npm run test -- --run src/domain/recognition/scoring.test.ts src/features/scan/scan-media-library.test.ts`

