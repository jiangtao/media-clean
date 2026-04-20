# Task 001: App Preferences Context Tests

## 负责人
张龙

## 类型
Test

## depends-on
[]

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
```
