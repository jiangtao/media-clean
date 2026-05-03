# Android-First Scan And Recognition BDD Specs

中文版本: [./bdd-specs.md](./bdd-specs.md)

## Scenario 1: Android starts with native metadata-first enumeration

```gherkin
Scenario: Android scan starts with native metadata-first enumeration
  Given Android starts with a default last-12-month scan and configurable presets
  When the scan batch is created
  Then the app should enumerate media metadata through Android native MediaStore first
  And JS should no longer enumerate source candidates through expo-media-library before passing them to the native executor
  And asset_manifest should receive metadata-first fields such as mime type, bucket, duration, and file size
```

## Scenario 2: The first dirty queue only analyzes truly dirty assets

```gherkin
Scenario: dirty queue only analyzes new modified missing-analysis assets
  Given SQLite already contains the previous asset_manifest and media_analysis records
  When Android native enumeration returns the latest manifest
  Then the planner should compute dirty reasons from manifest diff and analysis presence
  And clean assets should stay out of the current analysis queue
  And scan_batch should distinguish enumerated_count from dirty_count
```

## Scenario 3: The screen follows metadata-first planning

```gherkin
Scenario: PhotoGridScreen uses metadata-first planning as the Android scan input
  Given the Android scan is about to start
  When metadata-first planning completes
  Then PhotoGridScreen should feed the dirty candidate set into the native executor
  And scan_batch, scan_batch_item, and asset_manifest should persist the planning result first
  And the displayed scan total should match the dirty queue instead of the old JS authorized candidate count
```

## Scenario 4: native stopped events are consumed by JS

```gherkin
Scenario: JS consumes the Android native stopped event and closes the batch cleanly
  Given an Android native scan is running
  When the native executor emits a stopped event due to cancellation or interruption
  Then the JS facade should settle the current observation promise
  And PhotoGridScreen should not keep a hanging native scan wait state
```

## Scenario 5: completed windows continue into older backfill slices

```gherkin
Scenario: Android keeps backfilling older media slices until the whole library is covered
  Given Android starts with a default last-12-month scan and configurable presets
  And the previous rolling-window or backfill batch has completed
  When the user starts another Android scan
  Then the planner should create the next slice before the previous earliest boundary
  And native enumeration should use both createdAfter and createdBefore bounds
  And once no older media remains, later scans should fall back to processing only new or changed assets
```

## Scenario 6: candidate_view is the durable restore source for page results

```gherkin
Scenario: PhotoGrid scan results use SQLite candidate_view as primary projection and choose the newest scannedAt
  Given an Android scan has completed and produced active candidates
  When the app persists PhotoScanResultCache
  Then active candidates should be written to SQLite candidate_view
  And the summary should be written to candidate_view_meta
  And the next page entry should use the SQLite candidate projection as the primary restore source
  And AsyncStorage should remain only as a legacy migration source, compatibility mirror, and failure fallback
  And when SQLite and AsyncStorage both exist, the app should select the newest result by scannedAt
```

## Scenario 7: duplicate groups are persisted into recognition_group

```gherkin
Scenario: duplicateGroup moves from candidate JSON into recognition_group and recognition_member
  Given Android scan results contain active candidates with duplicateGroup
  When the app persists PhotoScanResultCache
  Then duplicateGroup should be written to SQLite recognition_group
  And candidate asset membership should be written to recognition_member
  And candidate_view should remain the UI projection
  And the current wave should not rewrite full similar or anomaly aggregation
```

## Scenario 8: user decisions are persisted independently from scan cache

```gherkin
Scenario: keep recycle restore delete failed outcomes are written to SQLite user_decision
  Given the user handles recognition candidates on Android
  When the user keeps, recycles, restores, permanently deletes, or records a failed outcome
  Then the app should write SQLite user_decision
  And user_decision should record asset, candidate, decision, reason, and timestamps
  And clearPersistentScanCache should not remove user_decision
  And normal active scan results should not overwrite existing user decisions
```
