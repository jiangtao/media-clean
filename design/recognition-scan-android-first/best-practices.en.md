# Android-First Scan And Recognition Best Practices

中文版本: [./best-practices.md](./best-practices.md)

## 1. Protect the execution boundary first

The repository already has:

- RN native modules,
- a foreground service,
- a Kotlin native executor,
- JS importer and screen orchestration.

Do not widen this wave into an Expo Module rewrite, Rust migration, or full aggregation redesign. First make the Android metadata-first entry path real.

## 2. Treat manifest as planning input, not UI garnish

`asset_manifest` must be the input for dirty queue planning, weighting, explanation, and future repair/backfill. It should no longer be assembled as a screen-level afterthought.

## 3. Keep wave scope narrow

Wave 1 should only deliver:

1. `MediaStoreEnumerator`
2. the first dirty queue
3. batch planning persistence
4. stopped-event handling

The follow-up wave may persist `PhotoScanResultCache` into SQLite `candidate_view / candidate_view_meta`, but that is only a page restore projection.

Wave 3 may extract duplicate groups from candidate JSON into `recognition_group / recognition_member`, but only as the first durable group shape.

Wave 4 may persist user actions into `user_decision`, but it should only cover keep, recycle, restore, delete, and failed outcomes without introducing a policy engine.

The current scope should still not deliver:

1. the full `analysis_result` durable truth redesign,
2. full similar/anomaly group rebuilds,
3. the full removal of AsyncStorage as runtime truth,
4. WorkManager-grade background continuation.
