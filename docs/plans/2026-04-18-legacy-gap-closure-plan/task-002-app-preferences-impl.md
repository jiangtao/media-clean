# Task 002: App Preferences Context Implementation

## 负责人
展昭

## 类型
Implementation

## depends-on
["001"]

## BDD 场景

```gherkin
Given 应用已保存语言偏好和主题偏好
When App 启动并装配根 Provider
Then 导航、页面和组件应共享同一份语言与主题真值源
And Settings 页面修改偏好后，照片页和回收站页应立即反映变化
```

## 验证命令

```bash
npm run test -- src/application/AppPreferencesContext.test.tsx
npm run typecheck
```
