# Architecture

[中文版本](./architecture.md)

## 1. Current Problem Layers

### Recognition

1. Quality detection relies mostly on `brightness / contrast / edgeDensity` plus small-file and low-resolution rules, with thresholds that are too extreme.
2. Duplicate detection relies on a single average hash and near-duplicate thresholds, which miss:
   - light compression differences
   - rotation / crop differences
   - fallback-analysis cases
3. There is no real `similar media` layer yet, only `duplicate`.
4. The default scan scope of recent `360` media limits recall by design.

### Presentation

1. The grid shows only actionable duplicate items, not the representative copy, so users misread “recognized one duplicate” as “recognized only one photo”.
2. Badge, tag, and detail semantics do not yet share one count model.

### Design

1. Scan entry, progress, and completion still feel like separate fragments.
2. The detail footer has too many competing layers.
3. Motion still risks flicker because multiple state layers change at once.

## 2. Target Architecture

### Recognition Recall V2

Split the pipeline into four layers:

1. `asset-analysis`
   - keep persistent cache reuse
   - add blur score and primary/secondary fingerprints
2. `quality-classification`
   - add a mid-severity abnormal layer
3. `duplicate-detection`
   - keep exact / near duplicate
   - add fallback retry and two-stage verification
4. `similar-grouping`
   - add a distinct `similar` result class

### Result Semantics V2

Unify two counts across grid and detail:

1. `groupTotalCount`
2. `actionableCount`

### Mobile Refinement V2

1. One scan card:
   - title
   - scope summary
   - progress rail
   - completion summary
2. One detail stage:
   - top counter / close
   - clear media stage
   - tag row
   - floating paired action switch
   - pagination dots

## 3. Key Decisions

1. Upgrade quality detection from three metrics to a multi-signal model.
2. Move duplicate detection to a two-stage strategy.
3. Do not abandon duplicate detection when analysis falls back.
4. Keep `360` as the default scope, but make larger scopes extensible and cache-aware.

## 4. Team Mapping

1. Gongsun Ce: domain rules and cache signatures
2. Zhan Zhao: scan-path integration
3. Zhang Long: quality-detection failure tests
4. Zhao Hu: duplicate/similar failure tests
5. Wang Chao: scan-page refinement
6. Ma Han: detail-page refinement
7. designer: visual audit and acceptance checklist

