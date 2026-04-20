# Task 008: 全量验证与波次放行

- 负责人：八贤王
- 类型：test
- depends-on：["005", "007"]
- BDD 场景：runtime 调整后必须无 error
- 验证命令：
  - `npm run typecheck -- --pretty false`
  - `npm run test -- --run`
