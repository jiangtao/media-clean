# Interaction Standards

[中文版本](./interaction-standards.md)

## Scope

This document defines interaction standards for core in-app flows. The first standardized flow is the scan entry on the Photos screen. Similar flows should reuse this standard instead of inventing page-specific patterns.

## Scan Entry Standard

### 1. The entry block must stay restrained

1. Permission copy and pre-scan copy must use secondary typography so the media area stays visually dominant.
2. The top entry block should remain low in height and preserve space for results and previews.
3. The primary CTA may stay clear, but it must not expand into a hero-sized card.

### 2. The authorized default state must explain scope and immediately expose usable results

1. Once access is granted, the page must show a scan scope summary before scanning starts.
2. The first release defaults to scanning the most recent `360` media items.
3. The number must come from a source of truth instead of being hard-coded inside page JSX copy.
4. When scan scope becomes configurable later, the block should only update the displayed source-of-truth value without changing the interaction structure.
5. The authorized default state should not keep extra “default scan explanation” body copy. The scope summary itself should carry the message.
6. The top entry area should keep only a high-level summary such as `360 media selected`; it must not carry a separate `All (360)`-style quantity label.
7. Counts for `All`, `Photos`, and `Videos` must live in the tabs below. The same location rule applies both before and after scanning rather than moving counts between header and tabs. The preferred expression is compact, such as `All 5 / Photos 3 / Videos 2`, rather than an extra parenthesized style.
8. The `All / Photos / Videos` tab typography must follow one compact mobile hierarchy: icon `16`, label `14`, count `12`. The count must be rendered as a secondary layer instead of keeping the whole tab string at one font size.
9. As soon as authorization is available, the page must render the authorized media itself instead of stopping at an empty, explanatory, or placeholder-only state.
10. The tabs below must already be functional in the default state, at minimum for `All`, `Photos`, and `Videos`, and they must switch to real media results immediately instead of acting like empty shells.
11. Before scanning starts, the tab counts should reflect the authorized scope. Once scanning begins, the `All / Photos / Videos` counts must update in real time to match the media still visible in the list instead of staying pinned to the initial `360`-item scope.

### 3. Scan feedback must stay inline

1. Scan progress should use an inline status rail instead of a blocking modal.
2. The scan entry, in-progress state, and completed state should reuse one task card whenever possible instead of splitting the entry card and progress card into separate unrelated containers.
3. The rail must include:
   - a status title
   - one progressive breathing pipeline-style progress bar
   - a `current/total` counter
4. Scanning must preserve the user’s sense of continuity with the main page.
5. The current photo filename or per-item text should not be shown by default while scanning, so the flow stays compact and focused.
6. When a scanned item is normal, its transient feedback should dissolve away naturally and yield back to the primary content instead of flickering, snapping, or cutting out abruptly.
7. Scan results must stream in progressively. Media confirmed as normal should disappear from the list during scanning rather than all surviving items appearing only at the very end.
8. As normal media fades out, the `All / Photos / Videos` tab counts must decrement in real time so the numbers always match the currently visible list.
9. While the scan list is still converging, the list area may apply a light translucent loading overlay to signal that data is still changing. The overlay must keep the media visible underneath and must not black out the whole page.

### 4. Completion must resolve in place

1. When scanning completes, the same entry block must show the number of anomalous media items that were found.
2. Completion must not rely on a separate finishing dialog.
3. After completion, the user should be able to continue into the result list immediately or rescan from the same block.
4. After scanning completes, the scope breakdown should continue to live in the filter tabs below, for example: `All (360)`, `Photos (339)`, `Videos (21)`. Completion must not move those counts back into the header.
5. The top area should no longer duplicate the full scope breakdown once the tabs below take over that responsibility.
6. The anomalous-media message should sit directly between the completion label and the `progress/total` value, using a warning-style accent color.
7. The warning accent color must adapt to light and dark themes rather than relying on a single fixed value.

### 5. Safe-area handling and scan-result caching must stay reliable

1. The Photos home screen must adapt to notch, punch-hole, and other irregular displays. Both the top entry block and the tab switcher below must stay outside dangerous screen areas.
2. Safe-area handling must cover not only the header but also the tab strip, filter carrier, and first-screen interactive controls so that portrait and landscape layouts do not get clipped, pinned, or mis-tapped.
3. The settings screen must also adapt to notch, punch-hole, and landscape safe areas. The title, section containers, and footer all need to respect `top / left / right / bottom` safe-area insets instead of only compensating for the bottom edge.
4. Completed scan results must be cached. On the next visit, the page should prefer showing cached results and cached tab counts immediately instead of forcing another full scan.
5. Rescanning is an explicit refresh action. A full scan should run again only when the user chooses to rescan or the cache is no longer valid.
6. When cached results are used, the page must still keep the tabs interactive and the result list browsable rather than reverting to an unscanned explanation state first.

### 6. Media clarity, selection, detail view, and duplicate-group handling must stay explicit

1. Media shown in the grid and in detail must stay visually clear and identifiable. The default presentation should prefer the original source or another high-fidelity local source rather than an analysis thumbnail, over-compressed asset, or intentionally softened overlay state.
2. Grid thumbnails must stay as close as possible to the perceived sharpness of the system photo gallery. The same item should not look noticeably softer here than it does in the native gallery app.
3. If performance requires a low-fidelity placeholder first, it must upgrade to a clear image almost immediately and without drawing attention to the transition. Users must not be asked to decide whether to delete something from a blurry state.
4. The selected state should keep only the selection icon itself. It must not further reduce media readability through global dimming, heavy overlays, extra explanatory copy, or redundant highlight treatments.
5. Once selection mode is active, every media tile must show the same selection indicator in the top-right corner: an empty circle when not selected, and a solid primary-colored circle with a checkmark when selected. The visual should feel close to a native attachment-picker selection pattern.
6. The selected state of a media item must be carried by a clear, stable, recognizable icon instead of temporary characters, plain text, or ad-hoc placeholders.
7. The selection icon should reuse the project's existing iconfont or icon system first. If the project does not yet have one, the product should still introduce a unified icon system rather than letting individual pages improvise symbols.
8. Core visible icons across the grid, bottom tabs, detail close, previous / next controls, recycle-bin empty states, and settings selection states must come from one shared, familiar icon system. Do not mix emoji, text arrows, temporary symbols, and system glyphs on the same product surface.
9. When the grid is in its default non-selection state, thumbnails should not render anomaly-tag copy directly on top of the media. At the grid layer, keep only essential media content plus light semantics such as the video marker and duplicate-count badge; full labels belong in detail.
10. When the media grid is not in selection mode, a single tap must open detail immediately. Detail access must not be buried behind a secondary entry point or require selection mode first.
11. A long press on media must enter selection mode and immediately select the focused item. The long-press gesture must not continue into opening detail.
12. Once selection mode is active, a single tap on media must toggle selected / unselected state instead of opening detail. When the selected set becomes empty, the product should return to non-selection mode automatically.
13. Bulk selection actions must provide both `Clear` and `Keep`, and the bottom bar must present them as two large side-by-side buttons with counts directly in the labels, such as `Clear (1)` and `Keep (1)`.
14. The bulk-selection footer should feel close to a native mobile attachment-picker pattern: equal-width red and green buttons, generous radius, and a fixed bottom dock. It should no longer reuse the detail-view switch structure.
15. The simplified detail viewer should keep a fixed structure by default: top-left index, top-right close action, centered media stage, a floating bottom tag-and-action rail, and bottom-most pagination dots. It must not regress into a stack of dense information panels.
16. The detail view must use a left-right swipable main media stage. Each swiped item should keep the media itself dominant while surfacing its labels near the bottom so the user does not need to hunt across separate areas for media, labels, and actions.
17. The swipe scope should default to the current media item's related set, meaning the duplicate group, similar set, or another explicitly related cluster tied to the focused item. If no related set exists, the detail view should stay on a single-item review rather than chaining into the whole result list.
18. The first screen of the detail view must show anomaly labels directly, such as `Duplicate`, `Similar`, `Low quality`, `Blurry`, or `Overexposed`. These labels must not be buried inside collapsible areas, secondary pages, or extra taps.
19. The main media stage in detail must optimize for “clear enough to judge correctly.” The image should expand as close as possible to the available width limit, ideally approaching a `100%` stage width instead of reserving excessive whitespace for tags or controls.
20. The detail view must adapt to notch, punch-hole, and other irregular displays. The index, close button, swipe controls, bottom labels, bottom actions, and pagination dots must all stay outside dangerous screen zones in both portrait and landscape.
21. The detail view must add a `Keep` action. Its meaning is “false positive / do not clean,” not delete, not postpone, and not back. Once applied, the media should be explicitly kept out of the current cleanup decision.
22. If the media belongs to a duplicate group, the detail view should let the user review the group by swiping horizontally and act directly on the currently focused item with `Clear` or `Keep`, instead of forcing an extra complex subflow.
23. If the user does not enter detail and triggers duplicate cleanup directly from the grid, the system must keep the highest-definition, best-quality media item by default and treat the remaining duplicates as cleanup candidates. This default must stay predictable in the interaction design.
24. Tags inside detail must use the smallest readable typography and must stay limited to a single row of the latest `3` labels. Tags should remain visually secondary and must not wrap or stack into the media stage.
25. `Clear / Keep` or `Restore / Delete` must be combined into one bottom switch-style action control, also using the smallest readable type, instead of two oversized independent buttons.
26. The system must supply a recommendation state for detail actions: high-confidence anomalies or non-representative duplicates should default to `Clear`, while representative copies or uncertain items should default to `Keep`. The user must still be able to override that recommendation.
27. If detail contains only `1` media item, it must not show previous / next controls. In duplicate-group review, the previous control must disappear at the first item and the next control must disappear at the last item. Wrap-around navigation is not allowed.
28. After scanning, if a grid item belongs to a duplicate group, the thumbnail must show a duplicate-count badge directly on the tile. The badge should show the count only, and its color must match the `Duplicate` tag tone.
29. The recycle-bin page must reuse the same grid interaction semantics as the Photos page: tap opens detail by default, long press enters selection mode, taps toggle selection while selection mode is active, and the page leaves selection mode automatically when the selection becomes empty.
30. The detail footer hierarchy must follow “light tags, steady switch, weak pagination”: tags explain the reason, the switch carries the decision, and pagination only hints position. These three layers must not compete equally for attention.

## Animation Standard

1. Scan feedback animation must stay smooth and continuous, without stutter, jitter, or flicker.
2. The flowing pipeline should feel natural rather than mechanical, avoiding metronomic beats, evenly blinking steps, abrupt loop resets, or rigid linear motion.
3. The flowing motion, breathing pulse, and state transitions should read as one continuous movement instead of reacting with a visible jump on each progress update.
4. Transient feedback for normal media should fade away gracefully so the user perceives completion instead of a hard cut.
5. State transitions should prefer gradual fade and smooth continuity over abrupt pop-in or pop-out behavior.
6. Animation must remain subordinate to readability and theme consistency.
7. Entering or leaving the detail view, expanding or collapsing duplicate groups, and selection feedback must all stay smooth and continuous instead of showing frame drops, hard cuts, or hierarchy glitches.
8. The selection icon should appear and transition with a light but clear motion treatment rather than flashing instantly or lagging behind the actual selection state.
9. Duplicate-group expansion must preserve spatial continuity so the user understands that the expanded content belongs to the same media group rather than a different content block.
10. Left-right motion on the detail-stage must feel like one continuous media rail. Full-screen hard cuts, blur-then-sharpen tricks, sudden jumps, or out-of-sync label/media transitions are not acceptable.
11. When moving from the grid into detail, or swiping between items inside detail, the product should keep the media subject visually clear. Light transitions are acceptable, but long blurry states must not be used to hide loading or fake polish.
12. Motion feedback for `Keep`, `Delete`, and `Select` must stay light, immediate, and unambiguous instead of delaying judgment or covering the media content.
13. Perceived clarity must remain stable across the grid, the detail viewer, and horizontal paging. The product must not show a sharp thumbnail in the grid, then a softer detail view, or a blur-first page transition.
14. All high-frequency touch controls should carry a restrained iOS-style press response, such as subtle scale, opacity, and surface-tone changes. Harsh flashes, heavy ripples, or no visible feedback at all are not acceptable.

## Implementation Discipline

1. Copy comes from the shared i18n source of truth.
2. Colors come from the shared theme source of truth.
3. Any change to this standard must be accompanied by tests.
