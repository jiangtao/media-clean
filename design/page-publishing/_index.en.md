# Media Clean Page Publishing Design

[中文版本](./_index.md)

## Context

`../cleaner-app/index.html` is the approved landing page source. The promo video, runtime images, icons, and splash outputs still live in an external asset folder, so this design migrates the confirmed page runtime resources into `page/` for an independent Vercel deployment.

## Decisions

1. `page/` is a standalone static site and does not reuse the Expo web build.
2. Vercel Root Directory points to `page`, with `page/dist` as the build output.
3. `page/public/index.html` is copied from the approved `../cleaner-app/index.html` and is the single source of truth for the published page.
4. The current public page is Chinese; English remains a documentation mirror only, with no unapproved `/en` page.
5. Runtime page assets include the root promo video, `resources/*` images, `apps/icons/*` icons, and the PWA manifest.
6. `preview-frames` remains the source for Android splash and design assets, not for the current published page structure.
7. `/landing.html -> /index.html` is kept as a compatibility rewrite.

## Design Documents

1. [BDD Specs](./bdd-specs.en.md)
2. [Architecture](./architecture.en.md)
3. [Best Practices](./best-practices.en.md)
