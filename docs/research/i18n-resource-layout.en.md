# i18n Resource Layout Plan

[中文版本](./i18n-resource-layout.md)

## Background

The v0.5 goal calls out hardcoded copy and insufficient local language package structure. The current `src/i18n/app-copy.ts` keeps all Chinese, English, formatting helpers, and business copy in one file. That works short term, but it becomes difficult to maintain as Settings, PhotoGrid, RecycleBin, Landing, reminders, and scan copy grow.

The mainstream community pattern is closer to the i18next / react-i18next locale + namespace model: one directory per language and one file per business namespace. react-i18next officially supports multiple translation files / namespaces, and i18next supports language and namespace fallback. Expo can continue to provide system locale data through `expo-localization`.

References:

1. react-i18next multiple translation files: [Multiple Translation Files](https://react.i18next.com/guides/multiple-translation-files).
2. i18next fallback: [Fallback](https://www.i18next.com/principles/fallback).
3. Expo system locale access: [Localization](https://docs.expo.dev/guides/localization/).

## Goals

1. One directory per language.
2. One namespace file per business domain.
3. Separate static copy, formatting functions, and language preference resolution.
4. Keep TypeScript key completeness checks.
5. Keep the `getAppCopy(language)` facade during migration to avoid changing every caller at once.
6. Follow system language by default, with user override.
7. Support LTR first; add RTL later through locale metadata.

## Target Structure

```text
src/i18n/
  index.ts
  locale.ts
  schema.ts
  resources.ts
  formatters.ts
  app-copy.ts
  locales/
    zh-CN/
      common.ts
      landing.ts
      photoGrid.ts
      recycleBin.ts
      settings.ts
      reminders.ts
      scan.ts
      errors.ts
    en-US/
      common.ts
      landing.ts
      photoGrid.ts
      recycleBin.ts
      settings.ts
      reminders.ts
      scan.ts
      errors.ts
```

Notes:

1. `schema.ts` defines `AppMessages`, namespace types, and `AppLocaleMeta`.
2. `resources.ts` aggregates all locale directories and exports `APP_I18N_RESOURCES`.
3. `formatters.ts` owns date, count, size, duration, confidence, and issue-type formatting.
4. `app-copy.ts` temporarily remains as a compatibility layer that assembles the old `LocalizedCopy` from `resources.ts` and `formatters.ts`.
5. New code should prefer namespace resources and should not continue expanding `app-copy.ts`.

## Namespaces

| Namespace | Content |
| --- | --- |
| `common` | cancel, close, deleteConfirm, unknownSize, generic status |
| `landing` | first screen, permission entry, product story |
| `photoGrid` | scan entry, progress, filters, selection, result summary |
| `recycleBin` | recycle-bin list, restore, permanent-delete confirmation |
| `settings` | language, theme, reminders, storage, notifications |
| `reminders` | reminder copy, frequency, weekdays, notification channel |
| `scan` | scan state, recognition dimensions, errors, checkpoint copy |
| `errors` | permissions, system errors, recovery failure, external interaction failure |

## TypeScript Constraints

Each locale file should use `satisfies` to keep keys complete:

```ts
import type { PhotoGridMessages } from '../../schema';

export default {
  state: {
    scanReady: 'Ready to scan',
    scanning: 'Scanning',
  },
} satisfies PhotoGridMessages;
```

`en-US` and `zh-CN` must implement the same schema. Tests should cover:

1. Every supported language has every namespace.
2. Namespace keys match across languages.
3. `system` preference resolves to the current system language.
4. Unsupported locales fall back to the default language.
5. The old `getAppCopy(language)` facade does not regress.

## Migration Strategy

1. Wave 1: add structure, schema, resources, and formatters without changing callers.
2. Wave 2: move `common`, `settings`, `appearance`, and `languageOptions` out of `app-copy.ts`.
3. Wave 3: move `photoGrid`, `recycleBin`, and `landing`.
4. Wave 4: move reminder, scan, errors, and formatting functions into `formatters.ts`.
5. Wave 5: add a hardcoded-copy scanner to prevent screens from adding raw Chinese / English UI strings.

## Decision

1. Do not keep expanding the single `app-copy.ts` file.
2. Do not force a full i18next runtime into the current stage. First adopt the i18next-style resource layout and TypeScript type constraints.
3. Preserve the current preference storage protocol to avoid breaking Settings and existing tests.
4. Re-evaluate i18next / react-i18next runtime later if async loading, remote translation, or third-party translation platforms become necessary.
