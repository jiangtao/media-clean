# Best Practices

[中文版本](./best-practices.md)

## Recognition

1. Add failing tests before tuning thresholds.
2. Separate:
   - extreme anomalies
   - mid-severity low-quality media
   - normal media
3. Separate:
   - exact duplicates
   - near duplicates
   - similar media
4. A single fallback must not permanently mean “cannot compare”.
5. Any added fingerprint or verification step must reuse persistent cache signatures.

## Presentation

1. Grid counts and detail pagination must describe the same thing.
2. “Keep the representative copy” and “show the group total” must be modeled separately.
3. Badges should communicate count, tags should communicate reason, and the recycle bin should communicate destination.

## Design

1. Brand priority: minimal > crisp > trustworthy > localized > smooth.
2. Smooth means continuous, stable, and flicker-free.
3. Let media and results dominate, not helper copy.
4. Keep footer information tight; do not manufacture design through bulk.

## Quality Gates

1. Every recognition-rule change needs failing samples first.
2. Every scan/detail interaction change needs regression coverage.
3. Every wave must pass:
   - `npm run typecheck -- --pretty false`
   - `npm run test -- --run`

