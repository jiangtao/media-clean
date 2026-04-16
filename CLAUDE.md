# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

误触清理 (Mistap Media Cleaner) is an Android-first cross-platform React Native app for cleaning media files from family phone albums. It scans recent photos/videos locally and uses explainable heuristic rules to identify accidental captures, abnormal content, and duplicates. The app provides an "in-app recycle bin" for safe cleanup.

## Tech Stack

- Expo SDK 54
- React Native 0.81.5 + TypeScript 5.9
- Vitest for testing
- AsyncStorage for persistence
- expo-media-library for media access and deletion
- expo-notifications for local reminders
- expo-video-thumbnails + expo-image-manipulator + jpeg-js for visual analysis

## Development Commands

```bash
# Install dependencies
npm install

# Start development server
npm run android    # Android
npm run ios        # iOS (Expo Go compatibility only)
npm run web        # Web

# Testing
npm run test -- --run        # Run all tests once
npm run test -- --run <file> # Run specific test file

# Type checking
npm run typecheck

# Build for production
npm run export:android

# Prebuild (generate native projects)
npm run prebuild:android   # Generate Android project
npm run prebuild:ios       # Generate iOS project

# Build variants
npm run build:android:debug    # Debug APK
npm run build:android:release  # Release APK (requires signing)
npm run build:android:clean    # Clean Android build
```

## Architecture

### Directory Structure

```
src/
├── domain/           # Pure functions and types (no side effects)
│   └── recognition/  # Media analysis: types.ts, scoring.ts, image-metrics.ts
├── services/         # External interactions and I/O
│   ├── media/        # Visual analysis (analyze-visuals.ts)
│   ├── storage/      # AsyncStorage wrappers
│   └── notifications/# Reminder scheduling
├── features/         # Domain logic orchestration
│   ├── scan/         # Media library scanning
│   ├── cleanup/      # Recycle bin state management
│   └── reminders/    # Reminder settings and copy
├── ui/               # React components (CandidateCard, PreviewModal)
└── application/      # Root app component (MediaCleanerApp.tsx)
```

### Layer Boundaries

- **Domain** (`src/domain/recognition/`): Pure logic with zero framework imports. Example: `scoring.ts` calculates cleanup scores using only math operations on image metrics.
- **Services** (`src/services/`): Framework-specific I/O wrappers. Example: `analyze-visuals.ts` uses `expo-image-manipulator` and `jpeg-js` to extract pixel data.
- **Features** (`src/features/`): Orchestration that composes domain + services. Example: `scan-media-library.ts` coordinates media fetching and analysis.
- **UI** (`src/ui/`): React components receive data via props; no direct service calls.
- **Application** (`src/application/`): Root component wires features to UI and manages app-level state.

### Key Design Patterns

1. **Layered Architecture**
   - `domain`: Pure business logic, no framework dependencies
   - `services`: External API wrappers (MediaLibrary, Notifications, FileSystem)
   - `features`: Use-cases that compose domain + services
   - `ui`: Presentational components
   - `application`: State management and coordination

2. **Recognition Flow**
   - Scan: Fetch recent media (max 360) via `expo-media-library`
   - Analysis: Extract visual metrics (brightness, contrast, edge density) using `expo-image-manipulator`
   - Scoring: Apply heuristic rules to calculate cleanup score (0-100)
   - Threshold: Only items with score ≥ 55 become candidates

3. **Cleanup Lifecycle**
   - Soft delete: Move to in-app recycle bin (persisted IDs in AsyncStorage)
   - Hard delete: Call `MediaLibrary.deleteAssetsAsync()` with user confirmation
   - Restore: Remove from recycle bin, item reappears in suggestions

4. **Safety Model**
   - Auto-cleanup only moves high-confidence items to recycle bin
   - Permanent deletion always requires secondary confirmation
   - Recycle bin is app-level state, not system-level

## Key Constants

- `MAX_SCAN_ASSETS = 360` - Default scan limit (recent items only)
- `CANDIDATE_THRESHOLD = 55` - Minimum score to be flagged as candidate
- `ANALYSIS_CONCURRENCY = 4` - Parallel analysis limit

## Internationalization

- Supported languages: `zh-CN`, `en-US`
- Copy defined in `src/i18n/app-copy.ts`
- Language preference persisted in AsyncStorage

## Theme System

- Supports `system` (default), `light`, `dark` modes
- Theme preference persisted and applied via `src/theme/app-theme.ts`
- UI uses dynamic theme palette from `getAppTheme()`

## Testing Strategy

- Unit tests for pure domain logic (scoring, image-metrics)
- Storage logic tests with mocked AsyncStorage
- Notification scheduling tests
- Run with `npm run test -- --run`
- Test files follow `*.test.ts` pattern alongside source files

## Reference Documentation

- Goal: [docs/goal/v0.1.md](./docs/goal/v0.1.md)
- Design: [docs/plans/2026-04-16-android-media-cleaner-design/_index.md](./docs/plans/2026-04-16-android-media-cleaner-design/_index.md)

## Important Notes

- iOS is Expo Go compatibility only; Android is the primary target
- Media analysis happens on-device, no cloud API calls
- Reminders are local notifications only (no background scanning)
- Video analysis uses thumbnail sampling, not full frame analysis
