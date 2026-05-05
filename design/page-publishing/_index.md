# Media Clean 页面发布设计

[English Version](./_index.en.md)

## 背景

`../cleaner-app/index.html` 已沉淀并通过验收为当前 landing page；宣传视频、运行时图片、icons 与 splash 产物仍分散在素材目录中，不适合作为当前 App 仓库的标准发布入口。本设计把确认过的页面与发布所需资源迁入 `page/`，让 Vercel 可以独立发布 Media Clean 产品页。

## 决策

1. `page/` 是独立静态站点，不复用 Expo web 构建。
2. Vercel Root Directory 指向 `page`，构建输出为 `page/dist`。
3. `page/public/index.html` 直接来自已确认的 `../cleaner-app/index.html`，它是发布页唯一页面真值。
4. 当前对外页面为中文；英文只作为正式文档镜像，不新增未经确认的 `/en` 页面。
5. 发布页运行资源包括根目录宣传视频、`resources/*` 图片、`apps/icons/*` 图标与 PWA manifest。
6. `preview-frames` 继续作为 Android splash 与设计素材来源，不作为当前发布页页面结构来源。
7. 保留 `/landing.html -> /index.html` rewrite，兼容旧入口。

## Design Documents

1. [BDD 规格](./bdd-specs.md)
2. [架构设计](./architecture.md)
3. [最佳实践](./best-practices.md)
