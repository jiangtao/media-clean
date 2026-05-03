# Android-First Scan And Recognition Design Entry

中文版本: [./_index.md](./_index.md)

This folder is now treated as an execution-ready design source.

The frozen decision is simple:

`Android is the primary execution surface, and the entry path must be metadata-first.`

The repository already has:

1. an Android native executor plus foreground service skeleton,
2. SQLite runtime tables such as `scan_batch`, `scan_batch_item`, and `asset_manifest`,
3. `PhotoGridScreen` orchestration for progress, checkpoint, and restore.

The Android v1 execution work therefore focuses on:

1. native `MediaStore` enumeration,
2. metadata-first dirty queue planning,
3. a default last-12-month window plus history backfill slices,
4. stop and restore semantics for the Android-first path.

## Current Execution Scope

1. Keep the work Android-only; do not mix iOS, Rust, cloud, or Firebase into this line.
2. Wave 1 has already made native enumeration, dirty queue planning, batch persistence, native stopped handling, and the default last-12-month history backfill policy real.
3. Wave 2 only moves `PhotoScanResultCache` into a SQLite `candidate_view / candidate_view_meta` restore projection.
4. The current Wave 3 only extracts duplicate groups into normalized `recognition_group / recognition_member` rows without rewriting the aggregation algorithm.
5. Wave 4 records keep, recycle, restore, delete, and failed outcomes into SQLite `user_decision`, and those decisions are not removed by scan-cache clearing.
6. Full durable truth for `analysis_result` and complete similar/anomaly group rebuilds remains a later wave.

## Design Documents

- [Target-State Goals](./target-state-goals.en.md)
- [Algorithm Research](./algorithm-research.en.md)
- [Architecture](./architecture.en.md)
- [BDD Specs](./bdd-specs.en.md)
- [Best Practices](./best-practices.en.md)
