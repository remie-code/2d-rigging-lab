# Runtime Player Wave5 Domain A Spec Compliance Review

- verdict: pass
- target: `runtime-player-wave5-control-input-profile-calibration`
- review lane: Spec Compliance
- reviewer: Review-Sylph
- date: 2026-06-22

## Scope Reviewed

Reviewed the Domain A changed Runtime Player source directly, including:

- Control shell/pages: `apps/runtime-player/src/control/control-window-app.tsx`, `control-window-shell.tsx`, `control-window-components.tsx`, `control-window-formatters.ts`, `overview-page.tsx`, `input-page.tsx`, `mapping-page.tsx`, `input-diagnostics-panel.tsx`
- Input profile main ownership: `apps/runtime-player/src/main/input-profiles/**`, `input-profile-bridge-handlers.ts`, `input-profile-bridge-request-validation.ts`
- Input/session bridge changes: `apps/runtime-player/src/main/input-bridge-handlers.ts`, `input-connect-request-validation.ts`, `input-session-state.ts`, `runtime-player-main.ts`
- Preload contracts/API: `apps/runtime-player/src/preload/input-profile-bridge-*`, `runtime-player-bridge.ts`, `runtime-player-bridge-contract.ts`
- Focused tests under `apps/runtime-player/src/main/**`
- Targeted searches for direct renderer filesystem access and forbidden Domain A scope.

## Basis Documents Used

- `discussion/runtime-player/implementation/orchestration/player-wave5-plan.md`
- `discussion/runtime-player/screens/initial-runtime-player-screen.md`
- `discussion/runtime-player/screens/control-window-screen-structure.md`
- `discussion/runtime-player/screens/tracking-setup-live-mapping.md`
- `discussion/runtime-player/architecture/tracking-input-mapping-baseline.md`
- `discussion/runtime-player/implementation/waves/wave4/runtime-player-wave4-final-integration-report.md`

## Findings

No blocking or non-blocking spec compliance findings.

Evidence:

- Control navigation is limited to real Wave5 pages `Overview`, `Input`, and `Mapping`; no `Model`, `Stage`, or dedicated `Diagnostics` nav page is exposed (`apps/runtime-player/src/control/control-window-shell.tsx:6`, `apps/runtime-player/src/control/control-window-shell.tsx:11`).
- The Header is persistent and exposes `Open Export`, `Look Forward`, and `Focus Stage` (`apps/runtime-player/src/control/control-window-shell.tsx:51`, `apps/runtime-player/src/control/control-window-shell.tsx:72`).
- Diagnostics remains a secondary collapsible/debug panel under the page content, not a dedicated page (`apps/runtime-player/src/control/control-window-app.tsx:335`, `apps/runtime-player/src/control/input-diagnostics-panel.tsx:39`).
- Input Profile storage is main-owned and resolves to `<userData>/input-profiles/ifacialmocap/profiles.json`; runtime wiring passes Electron `app.getPath("userData")` (`apps/runtime-player/src/main/input-profiles/input-profile-store.ts:41`, `apps/runtime-player/src/main/runtime-player-main.ts:20`).
- Store writes create parent directories and persist `activeProfileId`; selection also persists `activeProfileId` (`apps/runtime-player/src/main/input-profiles/input-profile-store.ts:62`, `apps/runtime-player/src/main/input-profiles/input-profile-store.ts:87`, `apps/runtime-player/src/main/input-profiles/input-profile-store.ts:170`).
- Corrupt/read failure falls back to an empty document with warnings; status presentation activates temporary defaults on read failure (`apps/runtime-player/src/main/input-profiles/input-profile-store.ts:116`, `apps/runtime-player/src/main/input-profile-bridge-handlers.ts:214`).
- Renderer/preload expose IPC APIs only for profile operations; targeted `rg` found no direct filesystem access from `apps/runtime-player/src/control` or `apps/runtime-player/src/preload` (`apps/runtime-player/src/preload/runtime-player-bridge.ts:73`).
- `Look Forward` uses the latest `TrackingFrame`, reports unavailable without a frame, updates session neutral, and does not call profile persistence (`apps/runtime-player/src/main/input-session-state.ts:91`, `apps/runtime-player/src/main/input-session-state.ts:99`, `apps/runtime-player/src/main/input-profile-bridge-handlers.ts:97`).
- Guided calibration includes all required prompt groups, delta thresholds, stable sample completion, range output, learned sign output, and save-profile flow (`apps/runtime-player/src/main/input-profiles/input-profile-calibration-session.ts:18`, `apps/runtime-player/src/main/input-profiles/input-profile-calibration-session.ts:75`, `apps/runtime-player/src/main/input-profiles/input-profile-calibration-session.ts:210`, `apps/runtime-player/src/main/input-profiles/input-profile-calibration-session.ts:287`).
- `Use Temporary Defaults` is visible and session-only; it sets in-memory `temporaryDefaultsActive` without writing the store (`apps/runtime-player/src/control/input-page.tsx:171`, `apps/runtime-player/src/control/input-page.tsx:212`, `apps/runtime-player/src/main/input-profile-bridge-handlers.ts:88`).
- Mapping page is intentionally minimal, shows semantic slot shell as `Unmapped`, and does not implement Auto Mapping, persistent model mapping save, raw source selection, smoothing, curve, or deadzone controls (`apps/runtime-player/src/control/mapping-page.tsx:26`, `apps/runtime-player/src/control/mapping-page.tsx:101`).
- Forbidden Domain A scope is absent in reviewed changed files: no Stage live rendering changes, TCP lifecycle, Body Follow, Stage Motion, smoothing/curve/deadzone editor, or advanced raw source editor were added.

## Verification Performed

- `pnpm.cmd --dir apps/runtime-player exec vitest run -c vitest.config.ts src/main/input-profiles/input-profile-store.test.ts src/main/input-profiles/input-profile-calibration-session.test.ts src/main/input-look-forward-session-neutral.test.ts src/main/input-profile-bridge-request-validation.test.ts src/main/input-connect-request-validation.test.ts src/main/input-session-state.test.ts`
  - First sandbox attempt failed with Vitest/esbuild `spawn EPERM`.
  - Reran with escalation: pass, 6 files / 19 tests.
- `pnpm.cmd --dir apps/runtime-player test:unit`: pass, 20 files / 79 tests.
- `pnpm.cmd --dir apps/runtime-player typecheck`: pass.
- `node scripts/check-source-organization.mjs`: pass.
- `node scripts/check-dependencies.mjs`: pass.
- `git diff --check -- apps/runtime-player/src`: pass, with LF/CRLF working-copy warnings only.
- Targeted `rg` checks:
  - No direct `fs`, `fs/promises`, `node:fs`, `node:path`, `readFile`, `writeFile`, `mkdir`, `localStorage`, or `indexedDB` use from Control/preload.
  - No unexpected Domain A implementation of TCP, Body Follow, Stage Motion, smoothing, curve/deadzone editor, persistent model mapping save, or advanced raw source editor in reviewed changed files.

No `pnpm install` was run.

## Remaining Issues

None for Domain A spec compliance.

Expected remaining Wave5 work is Domain B scope, not a Domain A defect:

- Auto Mapping implementation.
- Runtime parameter frame production.
- Stage live parameter application.
- Per-slot enabled/invert/strength behavior backed by live mapping.

## User-Decision Points

None.
