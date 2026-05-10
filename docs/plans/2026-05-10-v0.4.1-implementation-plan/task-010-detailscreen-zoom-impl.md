# Task 010: Integrate ZoomableImage into DetailScreen

## BDD Scenario

```gherkin
Feature: 详情页图片双指缩放

  Scenario: 双指展开放大图片
    When 用户点击一张图片进入详情页
    And 双指展开
    Then 图片开始放大

  Scenario: 视频不支持缩放
    When 用户点击一个视频进入详情页
    Then 视频正常播放
    And 不支持双指缩放操作

  Scenario: 缩放状态下切换图片
    Given 用户正在查看重复组中的图片
    And 当前图片已放大到 2 倍
    When 用户左右滑动切换到组内其他图片
    Then 新图片以原始大小显示
    And 缩放状态重置
```

## Task

Integrate ZoomableImage component into DetailScreen.

## Files to Modify

- `src/ui/screens/DetailScreen.tsx`

## Implementation Steps

1. Import ZoomableImage from '../components/ZoomableImage'
2. Find the Image component used for photo display
3. Replace Image with ZoomableImage for photo items only
4. Keep VideoPlayer for video items (no change)
5. Pass required props: uri, width, height

## Key Changes

```typescript
// Before (in DetailScreen):
<Image
  source={buildSizedImageSource(...)}
  style={styles.singleStageImage}
  contentFit="contain"
/>

// After:
{activeDetailCandidate.asset.mediaType === 'photo' ? (
  <ZoomableImage
    uri={activeDetailCandidate.asset.uri}
    width={stageSize.width}
    height={stageSize.height}
    maxScale={3}
    minScale={1}
  />
) : (
  <VideoPlayer {...videoProps} />
)}
```

## Verification

- [ ] Tests from Task 009 pass (Green phase)
- [ ] Photos show with zoom capability
- [ ] Videos play without zoom
- [ ] Switching images resets zoom
- [ ] No visual regression

## depends-on

["009", "006"]
