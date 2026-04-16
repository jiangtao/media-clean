# Mis-Tap Media Cleaner

[中文 README](./README.md)

An Android-first cross-platform MVP for cleaning accidental, anomalous, and duplicate media from family phones. The app scans recent media locally, applies explainable programmatic rules, and guides the user through a safe cleanup flow with an app-level recycle bin.

## Current Capabilities

- Requests photo and video permissions, then scans media locally.
- Detects accidental, anomalous, and duplicate photos and videos.
- Shows one recognition-results list with category filters, confidence level, reasons, metadata, and preview.
- Explains why a reference copy was kept for duplicate results, with lightweight comparisons in cards and preview.
- Supports auto cleanup by moving high-confidence items into the app recycle bin.
- Supports manual cleanup with either soft delete or confirmed permanent deletion.
- Supports restoring items from the recycle bin.
- Supports "cleanup readiness" with local reminders, daily or weekly scheduling, weekday selection for weekly mode, plus visible scheduling status and next reminder time.
- Supports runtime internationalization: the app can switch between `zh-CN / en-US`, persists the chosen language, and updates reminder copy, candidate cards, preview modal copy, and primary status text accordingly.
- Supports light/dark appearance modes: the app follows the system by default, and users can persist a manual `system / light / dark` preference inside the app.

## Detection Strategy

The first version stays fully on-device and uses lightweight heuristics:

- Accidental detection: duration, brightness, contrast, edge detail, resolution, and file size.
- Anomalous detection: extremely short duration, unusual aspect ratios, unusually low resolution, and nearly blank frames.
- Duplicate detection: image thumbnail fingerprints, plus duration-adaptive multi-frame video thumbnail fingerprints and metadata similarity, while keeping one higher-quality representative copy.

This version prioritizes safety and explainability over aggressive recall.

## Safety Model

- Auto cleanup never permanently deletes media.
- "Move to recycle bin" is an app-level soft delete that only hides items inside the app.
- "Permanent delete" is the only path that calls the system media deletion API, and it always requires confirmation.
- "Cleanup reminders" only prompt the user to reopen the app; they do not scan media silently in the background or auto-run cleanup.

## Current Limitations

- The MVP scans the most recent `360` media items instead of the entire library.
- The recycle bin is app-managed, not the system photo trash.
- Reminder support is currently based on local notifications with daily or weekly repeat, and weekly mode can choose the weekday; it is not background scanning or a system scheduler.
- Detection is heuristic-based for now and can be upgraded later with stronger native analysis or models; the current repo does not wire in an external AI API yet.
- Android is the primary runtime path being validated right now.

## Local Run

```bash
npm install
npm run android
```

## Verification Commands

```bash
npm run test -- --run
npm run typecheck
npm run export:android
```

## Core Documents

- Goal: [docs/goal/v0.1.md](./docs/goal/v0.1.md)
- Design: [docs/plans/2026-04-16-android-media-cleaner-design/_index.md](./docs/plans/2026-04-16-android-media-cleaner-design/_index.md)
- Execution Plan: [docs/plans/2026-04-16-android-media-cleaner-plan/_index.md](./docs/plans/2026-04-16-android-media-cleaner-plan/_index.md)

## Suggested Next Steps

- Improve visual quality analysis for both photos and videos.
- Improve reminder configuration UX and add richer reminder strategies and copy policies.
- Evolve the app recycle bin into a clearer lifecycle management flow.
