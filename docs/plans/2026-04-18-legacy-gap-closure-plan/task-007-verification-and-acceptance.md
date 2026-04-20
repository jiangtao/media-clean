# Task 007: Verification and Acceptance

## 负责人
八贤王

## 类型
Test

## depends-on
["004", "006"]

## BDD 场景

```gherkin
Given App 是全局入口
When 根节点初始化
Then StatusBar、NavigationContainer、SafeAreaProvider、AppPreferencesProvider 的装配顺序应明确
And 相关测试与类型检查应通过
```

## 验证命令

```bash
npm run test -- src/application/AppPreferencesContext.test.tsx src/ui/screens/__tests__/PhotoGridScreen.test.tsx src/ui/screens/__tests__/RecycleBinScreen.test.tsx src/features/compatibility/__tests__/screen-adaptation.test.ts
npm run typecheck
```
