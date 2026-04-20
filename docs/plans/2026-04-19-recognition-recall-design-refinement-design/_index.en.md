# Recognition Recall and Design Refinement - Design Overview

[中文版本](./_index.md)

## Background

The app already supports local scanning, duplicate/anomaly detection, recycle bin handling, detail viewing, and persistent caches. Recent feedback shows two gaps remain:

1. Detection is still conservative and misses blurry, flat-color, dim, low-quality, similar, and some truly identical photos.
2. The live mobile UI path works, but the scan card, detail stage, tags, badges, recycle-bin semantics, and motion are not yet aligned with the intended tone: minimal, crisp, trustworthy, localized, and smooth.

This design organizes the next execution wave so the team can improve both recognition recall and mobile refinement without deviating from [v0.1](/Users/jt/places/personal/app-cleaner/docs/goal/v0.1.md).

## Goals

1. Raise recall for low-quality media and duplicate/similar media, especially:
   - blurry, dim, flat-color, and low-quality images
   - truly identical images currently missed
   - visually similar but not fully duplicate images
2. Preserve the product baseline of local-first, explainable, and safe cleanup.
3. Keep scan performance and runtime stability intact.
4. Apply the brand attributes `minimal, crisp, trustworthy, localized, smooth` to scan and detail flows.

## Recommended Approach

Run two coordinated tracks:

1. **Recognition track**: `Recognition Recall V2`
   - relax quality thresholds and add a mid-severity abnormal layer
   - add a dedicated blur score
   - add duplicate fallback retry, multi-signal fingerprints, and similar-media layering
   - separate group total from actionable count
2. **Design track**: `Mobile Refinement V2`
   - merge scan entry, progress, and completion into a single card
   - tighten detail-stage hierarchy and floating actions
   - unify badge/tag/recycle-bin semantics
   - simplify motion into a single primary transition

## Out of Scope

1. No cloud AI model in this wave.
2. No default full-library scan; only design an extensible scan-scope capability.
3. No new native worker pipeline in this wave.

## Team Guidance

1. **Bao Zheng**: scope freeze, prioritization, and release gates.
2. **Gongsun Ce**: architecture, boundaries, and truth sources.
3. **Zhan Zhao**: recognition and UI integration on the live path.
4. **Zhang Long / Zhao Hu**: failing BDD tests first, then detection implementation.
5. **Wang Chao / Ma Han**: design refinement and interaction regression.
6. **designer**: translate brand words into concrete UI refinements.
7. **Ba Xian Wang**: final acceptance against gates and UX criteria.

## Success Criteria

1. Missed identical, near-duplicate, and similar photos are materially reduced and covered by tests.
2. Blurry, flat-color, dim, and low-quality images reliably enter candidate results.
3. Grid and detail counts communicate both group size and actionable size clearly.
4. Scan and detail flows feel more coherent and stable without new runtime issues.
5. `typecheck` and full tests pass.

## Design Documents

- [Architecture](./architecture.en.md)
- [BDD Specs](./bdd-specs.en.md)
- [Best Practices](./best-practices.en.md)

