# Android Scan And Recognition Target-State Goals

中文版本: [target-state-goals.md](./target-state-goals.md)

## Background

The repository already contains pieces of a JS scan flow, Android native-first execution, SQLite operational storage, and UI progress recovery. What is still missing is a single Android target-state contract that those pieces must serve.

This document defines that contract first, so architecture can be judged against it.

## Scope

This target state covers only Android:

- local Android media-library scanning
- local Android recognition and candidate aggregation
- foreground UI, background execution, recovery, and persistence
- user keep / recycle / delete decisions on Android

It does not cover iOS, shared-core extraction, cloud sync, or Firebase integration.

## Product Goals

The Android target state must ensure:

1. users start with a default last-12-month scan on Android, with `1/2/3/6/12` month presets available
2. once the current window completes, the next scan continues from older media instead of rescanning the same slice
3. scanning can continue after leaving the page
4. enumeration reads metadata before scheduling analysis
5. progress, candidates, and cleanup value remain trustworthy
6. duplicate, similar, and anomaly results have stable and recoverable provenance
7. user decisions remain decoupled from changing recognition output

## Engineering Goals

The Android architecture must ensure:

1. Android Native Module + Foreground Service is the execution surface
2. SQLite is the durable runtime truth for batch, manifest, analysis, aggregation, and asset state
3. scan execution window and reminder range remain separate concepts
4. single-asset analysis and final aggregation are separate stages
5. recovery, retry, and partial recomputation are first-class behaviors
6. new metadata fields can be added through contracts instead of ad hoc rewrites

## Required Metadata

Enumeration must persist:

- `asset_id`
- `content_uri`
- `media_type`
- `mime_type`
- `width`
- `height`
- `orientation`
- `aspect_ratio`
- `duration_ms`
- `file_size_bytes`
- `date_taken`
- `date_modified`
- `bucket_id`
- `bucket_name`
- optional `is_screenshot`, `bitrate`, `frame_rate`, and `codec`

These fields are not secondary metadata. They are scheduling, grouping, explanation, and UI inputs.

## Acceptance Criteria

The Android target state should make these statements true:

1. batch source, scope, phase, progress, and failures are queryable from SQLite
2. new assets can be handled through incremental scanning rather than repeated full rescans
3. changing the rolling window across `1/2/3/6/12` month presets affects only the relevant asset set
4. after one window finishes, the next scan continues from the previous earliest boundary instead of jumping back to the same recent slice
5. once no older media remains, the scan flow falls back to incremental processing for only new or changed assets
6. after result loss or page exit, the UI can recover batch and `candidate_view` state from SQLite
7. user keep, recycle, restore, and delete decisions are queryable from SQLite `user_decision` and are not removed by scan-cache clearing
8. adding new metadata fields does not require redesigning the main pipeline

## Recognition Goals

The Android target state should explicitly cover:

1. `blur`
2. `duplicate`
3. `similar`
4. `accidental / low-information`
5. `heavy-noise / compression / overall low quality`

Each dimension should map to either an established algorithm family or an explicit AI model path.

Related research: [Algorithm Research](./algorithm-research.en.md)

## AI Constraints

If AI is introduced:

1. inference should remain on-device by default
2. models must be versioned and replaceable
3. classical features and fallback paths must remain available
4. JS UI must not become the main inference surface

## First Release Constraint

The first implementation should ship without AI in the critical path.

That means:

1. no on-device embedding model or classifier in v1
2. no required `MediaPipe / LiteRT / TFLite` runtime in the v1 path
3. v1 similarity focuses on near-similar and burst-like similarity, not strong semantic similarity
4. AI remains a phase-two enhancement rather than a release blocker
