# Electron Desktop Release Contract

[中文版本](./electron-desktop.md)

This document defines the build, size governance, remote update, workflow, and versioning contract required before Media Clean Electron Desktop moves from development mode into a product release. `apps/desktop/` is still the desktop incubation implementation. It already has renderer build, Electron smoke, packaged-like smoke, tray background behavior, SQLite state, and a Rust N-API scan path; `release-desktop` now wires macOS `.dmg` / `.zip` and Windows portable zip release lanes, while the remote auto-update provider remains reserved.

## Current Decisions

1. `apps/desktop/` keeps the Electron main / preload / renderer boundary: main owns OS integration, file permissions, job orchestration, notifications, tray, and update checks; renderer owns product UI; preload exposes only allowlisted IPC.
2. “Check version” currently reads the Electron App version and returns an `electron-app / reserved` placeholder. It does not call GitHub Releases or pretend remote updates are live.
3. Before formal release, Desktop needs its own release unit. The long-term direction follows `docs/research/v0-5-goal-split-execution/repo-release-boundaries.md`: incubate contracts in the main app repo, then move Desktop into an independent release channel when productized.
4. Versioning strategy: major versions should stay aligned with the Media Clean product line when possible; Electron Desktop may evolve its own minor and patch versions. For example, when the product line is on `v0.6`, Desktop can ship `0.6.1-desktop` or `0.6.2`, but Desktop patch versions must not redefine Android / Engine major-version semantics.

## Local Build And Smoke

Current commands:

```bash
npm run desktop:preview
npm --prefix apps/desktop run renderer:build
./apps/desktop/node_modules/.bin/tsc -p apps/desktop/tsconfig.json --noEmit
npm run desktop:smoke
cd apps/desktop && npm run package:smoke
npm run release-desktop
npm run desktop:release:windows
```

## Codex Preview Development Validation

In development mode, run `npm run desktop:preview`, then open these URLs in Codex Preview or a browser:

1. `http://127.0.0.1:5178/?preview=1&view=scan`
2. `http://127.0.0.1:5178/?preview=1&view=tasks`
3. `http://127.0.0.1:5178/?preview=1&view=review`
4. `http://127.0.0.1:5178/?preview=1&view=about`
5. `http://127.0.0.1:5178/?preview=1&surface=tray`

This path injects a renderer-only mock bridge for fast UI, layout, interaction, motion, and screenshot validation. It does not represent Electron main, preload, native notifications, native tray behavior, or packaged resources. Formal release validation still depends on `desktop:smoke` and `package:smoke`.

Required checks for release readiness:

1. The static renderer loads offline from `app://app/index.html`.
2. `desktop:smoke` verifies main / preload / renderer bridge, tray island, update placeholder, notification suppression, and formal desktop icon assets.
3. `package:smoke` verifies packaged-like ASAR, Rust N-API wrapper, child-process worker, multi-directory scan, `app://media`, and cleanup dry-run.
4. Smoke tests must not depend on a Next dev server, call GitHub Releases, or show real notifications.

## Tray Island Window Background

The island no longer uses a large transparent carrier window. The old transparent area behind the island came from the native Electron tray popover window; the release contract is now:

1. The main process must create `trayPopoverWindow` with `transparent: false`; it must not use a `#00000000` transparent background.
2. The popover width must align with the island width, currently `720px`.
3. Before showing the popover, the native window is resized to `.tray-island` content height, capped at `760px`.
4. The renderer `.tray-surface` must not create a transparent shell through padding; the island fills the popover width.
5. Smoke tests must assert that popover viewport width and island width are effectively the same, preventing regressions to “large transparent shell plus centered card”.

## Packaging Targets

`release-desktop` currently covers macOS and Windows:

1. macOS `dmg`: user installation entry. The default path is open-source free distribution: the app is ad-hoc codesigned but not Apple Developer ID notarized. If a Developer ID becomes available later, the workflow input can switch to signed-notarized.
2. macOS `zip`: auto-update feed and rollback entry.
3. Windows portable zip: the first Windows distribution package, including the Electron runtime, ASAR, Rust N-API wrapper, scan worker, and `icon.ico`. It is not an installer; NSIS / MSI comes later.
4. `latest-mac.yml` / `latest-win.yml` and `media-clean-desktop-update-<channel>-<platform>-<arch>.json`: manifest sources for remote update checks.
5. Launch icons come from the same rounded transparent product logo: macOS uses `apps/desktop/assets/icon.icns`, and Windows uses `apps/desktop/assets/icon.ico`.

## Non-App-Store Download Entry

The first Desktop release stage does not use the Mac App Store or Microsoft Store. User downloads use a dual-entry contract: a canonical website URL plus a GitHub Release backup URL, aligned with the Android page-download contract.

1. Canonical website entries are wired now, and the page plus README must use these two URLs:
   - macOS: `https://mc.jerret.me/download/media-clean-desktop-macos-arm64.dmg`
   - Windows: `https://mc.jerret.me/download/media-clean-desktop-windows-x64.zip`
2. GitHub Release backup entries are published by `release-desktop` now. Desktop must not use the repository-level `releases/latest` endpoint because that endpoint is already reserved by the Android latest backup contract. Desktop uses versioned URLs and a dedicated `desktop-latest` URL:
   - macOS: `https://github.com/jiangtao/media-clean/releases/download/desktop-v<version>/media-clean-desktop-macos-arm64.dmg`
   - Windows: `https://github.com/jiangtao/media-clean/releases/download/desktop-v<version>/media-clean-desktop-windows-x64.zip`
   - macOS latest: `https://github.com/jiangtao/media-clean/releases/download/desktop-latest/media-clean-desktop-macos-arm64.dmg`
   - Windows latest: `https://github.com/jiangtao/media-clean/releases/download/desktop-latest/media-clean-desktop-windows-x64.zip`
3. Every formal release uploads both versioned assets and latest alias assets, and force-updates the `desktop-latest` release. Versioned assets are for audit, rollback, and checksum traceability; latest alias assets are for user-facing download buttons.
4. The default public macOS `.dmg` is an open-source free distribution package: ad-hoc signed and not notarized. The download page and Release notes must say that first launch may trigger Gatekeeper; users should verify `media-clean-desktop-latest.sha256`, then open through Control-click / Open or System Settings / Privacy & Security / Open Anyway.
5. If an Apple Developer ID becomes available later, `release-desktop` can use `signed-notarized` mode. Only that mode needs `MACOS_CERTIFICATE_BASE64`, `APPLE_ID`, and related secrets; `MACOS_CERTIFICATE_BASE64` must be a base64-encoded `.p12` certificate, not an email address.
6. The first Windows entry is a portable zip and the download page must say “extract and run”; once Windows code signing and NSIS / MSI are added, the default entry can switch to the installer.
7. `media-clean-desktop-latest.sha256` is uploaded with the latest aliases for download-page and user-side verification.

Linux is still reserved:

1. Linux: `AppImage` / `deb`, smoke first, public release later, using the multi-size PNG set under `apps/desktop/assets/icons/`.
2. Future Windows upgrade: add code signing, NSIS / MSI installer packaging, and optional differential update support. Until signing is implemented, the workflow marks Windows signing / installer status as reserved.

## Electron Icon And Brand Assets

The main process already has stable icon loading, macOS Dock icon application, and a runtime fallback:

1. Runtime prefers `icon.png` so Electron `nativeImage` can decode the product logo directly.
2. Development mode and packaged-like smoke must resolve `apps/desktop/assets` or ASAR `assets`, not only the root repository icon, and must not fall back to the blue generated mark because `.icns` failed to decode.
3. If no real icon asset exists, runtime generates a Media Clean fallback icon so windows, notifications, and tray are not blank.
4. Runtime and tray continue to use the product logo instead of generating task charts; formal bundles use `.icns`, `.ico`, or multi-size PNGs by platform.

Formal desktop assets now exist:

1. `apps/desktop/assets/icon.svg` directly reuses the product logo source file `page/public/apps/icons/logo.svg`.
2. `apps/desktop/assets/icon.png` is generated from the product logo source, preserving transparent rounded corners without adding a white backing.
3. `apps/desktop/renderer/public/icon.png` reuses the same rounded PNG for island / sidebar branding.
4. `apps/desktop/assets/icon.icns` is generated from the rounded PNG for macOS `.app` / `.dmg` / Dock launch icons; macOS `.icns` is only for the formal bundle icon, not the Electron runtime preference.
5. `apps/desktop/assets/icon.ico` is generated from the rounded PNG for Windows `nsis` / `msi` launch icons.
6. `apps/desktop/assets/icons/16x16.png`, `32x32.png`, `48x48.png`, `64x64.png`, `128x128.png`, `256x256.png`, `512x512.png`, and `1024x1024.png` are derived from the same rounded transparent `icon.png` for Linux `AppImage` / `deb` and generic packaging icon sizes.
7. Package smoke copies these files into ASAR and asserts Electron resolves a non-empty PNG product logo at runtime.

## Size Governance

Desktop size risk mainly comes from Electron runtime, renderer bundle, ASAR, Rust N-API native binary, duplicated `node_modules`, and sourcemaps.

Before release, add a size report that:

1. Reports `.dmg`, `.zip`, unpacked app, ASAR, and native resources separately.
2. Lists top-level size distribution, at least top 20 entries.
3. Checks whether renderer sourcemaps, test fixtures, duplicated `node_modules`, or uncompressed native binaries are shipped.
4. Ensures `packages/media-clean-engine` copies only runtime files, not Rust `target/debug`, source fixtures, or build cache.

Initial suggested budgets:

| Artifact | Warning | Fail |
| --- | ---: | ---: |
| macOS `.zip` | 180 MiB | 220 MiB |
| macOS `.dmg` | 190 MiB | 240 MiB |
| `app.asar` | 25 MiB | 40 MiB |
| packaged engine resources | 60 MiB | 100 MiB |

These are first gates and should be tightened after real release data exists.

The current macOS release script generates:

1. `artifacts/desktop-release/media-clean-desktop-v<version>-mac-<arch>.dmg`
2. `artifacts/desktop-release/media-clean-desktop-v<version>-mac-<arch>.zip`
3. `artifacts/desktop-release/media-clean-desktop-v<version>.sha256`
4. `artifacts/desktop-release/media-clean-desktop-v<version>.metadata.json`
5. `artifacts/desktop-release/media-clean-desktop-v<version>.size-report.json`
6. `artifacts/desktop-release/media-clean-desktop-v<version>.size-report.md`
7. `artifacts/desktop-release/media-clean-desktop-update-<channel>-mac-<arch>.json`
8. `artifacts/desktop-release/latest-mac.yml`
9. `artifacts/desktop-release/media-clean-desktop-macos-<arch>.dmg`: GitHub Release latest backup download alias, copied in the workflow publish stage.
10. `artifacts/desktop-release/media-clean-desktop-macos-<arch>.zip`: GitHub Release latest update / rollback alias, copied in the workflow publish stage.

The current Windows release script generates:

1. `artifacts/desktop-release/media-clean-desktop-v<version>-win-<arch>.zip`
2. `artifacts/desktop-release/media-clean-desktop-v<version>-win-<arch>.sha256`
3. `artifacts/desktop-release/media-clean-desktop-v<version>-win-<arch>.metadata.json`
4. `artifacts/desktop-release/media-clean-desktop-v<version>-win-<arch>.size-report.json`
5. `artifacts/desktop-release/media-clean-desktop-v<version>-win-<arch>.size-report.md`
6. `artifacts/desktop-release/media-clean-desktop-update-<channel>-win-<arch>.json`
7. `artifacts/desktop-release/latest-win.yml`
8. `artifacts/desktop-release/media-clean-desktop-windows-<arch>.zip`: GitHub Release latest backup download alias, copied in the workflow publish stage.

## Remote Updates

The About page currently shows only the reserved Electron App version check. Formal implementation should:

1. Read the Electron app version in main.
2. Read a remote update manifest in main; renderer must not call the release source directly.
3. Include at least `version`, `channel`, `platform`, `arch`, `url`, `sha256`, `publishedAt`, and `releaseNotesUrl` in the manifest.
4. Use product-facing states only: `current version`, `new version available`, `cannot check updates right now`.
5. Never block scan, review, or cleanup when update checks fail.

GitHub Releases can be the first remote source, but it must be wrapped by an Electron Desktop update provider. `api.github.com` and repository names must not leak into renderer copy or product UI.

## GitHub Actions Path

Workflow direction:

1. `desktop-pr-check.yml`
   - Trigger: PR / push
   - Runs renderer build, desktop TypeScript, desktop smoke, and package-smoke static checks.

2. `desktop-package-smoke.yml`
   - Trigger: manual / nightly
   - Runs macOS packaged-like smoke, N-API packaging, and size report dry-run.

3. `release-desktop.yml`
   - Trigger: `workflow_dispatch`
   - Inputs: `release_tag`, `release_channel`, `desktop_version`, `macos_distribution`
   - Builds macOS, publishes an ad-hoc signed `.dmg` by default, runs Developer ID sign / notarize only when `signed-notarized` is selected, builds the Windows portable zip, generates size reports, uploads GitHub Release assets, and writes update manifests.

`.github/workflows/release-desktop.yml` is now present. It supports two formal release entry points:

1. Manually run `release-desktop.yml` for maintainer-triggered releases, rollback validation, or failed-release reruns.
2. When a PR is merged into `main` with the `desktop-release` label, `.github/workflows/desktop-release-on-label.yml` reads the version from `apps/desktop/package.json` and triggers `release-desktop.yml` for `desktop-v<version>`.

Local builds are for release smoke and artifact validation, not for public distribution. The `desktop-release` label is effective only after the PR is merged, so unmerged code cannot be released; the triggering actor must be the repository owner or an admin.

`release-desktop` currently has three stages:

1. `resolve-release`: validates the `desktop-v<version>` tag and resolves Desktop version / channel.
2. `build-macos-release` / `build-windows-release`: build platform release assets in parallel.
3. `publish-release`: waits for both platforms, creates the tag, and publishes all assets to the same GitHub Release.
4. `publish-release` also creates stable latest alias files and updates the dedicated `desktop-latest` release; GitHub backup links must not take over the repository-level `releases/latest`. The canonical website entry under `mc.jerret.me/download/...` redirects through Vercel to `desktop-latest`.

The formal Desktop workflow does not require a paid Apple account by default. When `macos_distribution=unsigned`, it reads no Apple signing secrets and publishes an ad-hoc signed `.dmg` for open-source free distribution.

Only when `macos_distribution=signed-notarized`, the Desktop workflow uses dedicated secrets and must not reuse Android keystore material:

1. `MACOS_CERTIFICATE_BASE64`
2. `MACOS_CERTIFICATE_PASSWORD`
3. `MACOS_CODESIGN_IDENTITY`
4. `APPLE_ID`
5. `APPLE_TEAM_ID`
6. `APPLE_APP_SPECIFIC_PASSWORD`
7. Optional: `MACOS_KEYCHAIN_PASSWORD`

If signing or notarization secrets are missing, the `signed-notarized` workflow must fail. The default open-source free distribution mode may publish an ad-hoc signed `.dmg`, but Release notes, metadata, and size reports must mark `distribution: ad-hoc` instead of pretending it is notarized.

Windows does not require signing secrets yet. The Windows artifact is explicitly a portable zip, and metadata / size reports write `signingStatus: reserved` and `installer: reserved` so an unsigned installer cannot be mistaken for a formal installer package.

## Process Guardian

An Electron process cannot prevent another process from sending `SIGKILL`, and it cannot reliably relaunch itself from inside the killed process. Product-grade guarding belongs to the operating system:

1. The first macOS stage uses a LaunchAgent through `scripts/desktop/install-launch-agent.mjs`.
2. The LaunchAgent uses `KeepAlive.SuccessfulExit=false`, so `launchd` relaunches Media Clean after crashes or external kills.
3. Electron writes an `intentional-quit` marker on normal quit. The guardian wrapper exits `0` when it sees that marker, so clicking “Quit Media Clean” does not immediately relaunch the app.
4. Example commands:

```bash
node scripts/desktop/install-launch-agent.mjs --install --app "/Applications/Media Clean.app"
node scripts/desktop/install-launch-agent.mjs --status
node scripts/desktop/install-launch-agent.mjs --uninstall
```

Guardian mode is not forced in development. A future product setting can expose it as a “background guardian” toggle.

## Release Gates

Before a formal Desktop release:

1. `npm run desktop:smoke` passes.
2. `cd apps/desktop && npm run package:smoke` passes.
3. The formal package does not depend on a Next dev server.
4. The formal package starts without the source tree.
5. The scan worker loads the Rust N-API wrapper from packaged resources, not repo `target/debug` or source `packages/media-clean-engine`.
6. Scan notification displays, and clicking it opens review or workbench.
7. The tray icon and cross-platform launch icons always use the product logo instead of generating task charts; task state belongs in the island content.
8. About page version checks show only Electron App version and update status, not implementation details.
9. Desktop main window, tray island, notifications, dialogs, number formatting, and date formatting must follow the system appearance and system language, with at least `zh-CN` / `en-US` coverage.
10. Public macOS release may use an ad-hoc signed `.dmg` by default, but it must publish SHA256, first-launch Gatekeeper instructions, and `distribution: ad-hoc` metadata; if `signed-notarized` is selected, signing and notarization must pass before publishing.
11. Windows release must at least produce a portable zip, checksum, metadata, size report, `latest-win.yml`, and update manifest.
12. Every release uploads checksum, metadata, size report, and update manifest.
13. Every release must upload `media-clean-desktop-macos-<arch>.dmg`, `media-clean-desktop-windows-<arch>.zip`, and `media-clean-desktop-latest.sha256`, then sync them to `desktop-latest` as stable user-facing download entries.
14. For PR-based publishing, the PR must keep the `desktop-release` label before merge; after merge, `.github/workflows/desktop-release-on-label.yml` triggers the formal `release-desktop.yml`.

## TODO

1. Add `desktop-pr-check.yml` and `desktop-package-smoke.yml`.
2. Add an update provider: reserved local result first, GitHub Release manifest later.
3. Wire the LaunchAgent guardian into Settings and define its default behavior.
4. Keep Windows code signing, NSIS / MSI installer packaging, and Linux release on the same version, metadata, and update-manifest contract.
