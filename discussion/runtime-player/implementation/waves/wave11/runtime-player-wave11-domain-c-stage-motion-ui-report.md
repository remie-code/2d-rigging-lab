# Runtime Player Wave11 Domain C Report: Stage Motion UI

- verdict: pass
- domain: runtime-player-wave11-stage-motion-ui
- loop count: 1 implementation loop, 1 review loop, 0 fix loops
- implementation agent: Gnome
- review agent: Review-Sylph
- review report: `discussion/runtime-player/implementation/reviews/wave11/runtime-player-wave11-domain-c-stage-motion-ui-review.md`

## Files Changed

Domain C source/test/report changes:

- `apps/runtime-player/src/control/control-window-app.tsx`
- `apps/runtime-player/src/control/stage-motion-panel.tsx`
- `apps/runtime-player/src/control/stage-page.tsx`
- `apps/runtime-player/src/control/stage-page.browser-source.test.ts`
- `apps/runtime-player/src/control/stage-page.stage-motion.test.ts`
- `discussion/runtime-player/implementation/waves/wave11/runtime-player-wave11-domain-c-stage-motion-ui-report.md`

Pre-existing Domain A/B source and discussion changes remain in the worktree and were not reverted.

## Implementation Summary

- Added a compact `Stage Motion` panel to the `Stage` page top grid beside `Stage Window` and `View`, leaving `Browser Source Output` before `Local Preview / Fallback`.
- Added controls for:
  - `Enabled`
  - `Horizontal Follow`: strength px, limit px, invert
  - `Depth Scale`: strength %, limit %, invert
  - `Stabilization`: dead zone, reaction
- Wired all controls to `stageView.updateStageMotionSettings(partialUpdate)` through the existing `runStageAction` path.
- Displayed Stage Motion auto-save state using existing Stage persistence `statusLabel`; no manual save button was added.
- Displayed near/far readiness on `Depth Scale`.
- Added a `Calibrate in Input` route when near/far calibration is missing:
  - saved profile with left/right ready uses section calibration for `head-position-near-far`
  - other cases route to existing `missing-only` Input calibration after switching to the `input` page
- Kept Stage Motion on the `Stage` page only. Mapping page, Runtime Export, Browser Source payloads, and Window State schema were not changed.

## Required Behavior Trace

1. Stage page panel: implemented via `StageMotionPanel`.
2. Settings update live: every control sends a Domain B partial settings update through `stageView.updateStageMotionSettings`.
3. Auto-save understandable: panel shows `Auto Save` from `stageState.persistence.statusLabel`; existing Auto Save panel remains.
4. Missing near/far visible: `Depth Scale` shows `Missing` / `No profile` / `Ready` status.
5. Calibration recovery route: missing near/far shows `Calibrate in Input` and starts the closest existing Input calibration mode.
6. Browser Source ordering preserved: tests assert `Stage Motion` before `Browser Source Output`, and fallback remains after Browser Source.
7. No editor/mapping/runtime parameter controls added: focused UI tests assert Mapping/Profile/Runtime Parameter labels are absent.

## Tests / Commands

- `pnpm.cmd exec vitest run src/control/stage-page.browser-source.test.ts src/control/stage-page.stage-motion.test.ts` from `apps/runtime-player`:
  - initial sandbox run failed with known `spawn EPERM`
  - rerun with elevated permissions passed, 2 files / 9 tests
  - rerun after component split passed, 2 files / 9 tests
- `pnpm.cmd run typecheck` from `apps/runtime-player`: passed.
- `node scripts/check-source-organization.mjs` from repo root: passed.
- `git diff --check -- apps/runtime-player/src/control apps/runtime-player/src/preload discussion/runtime-player/implementation/waves/wave11` from repo root: passed; Git printed CRLF normalization warnings only.
- `pnpm install`: not run.

Review-Sylph independently ran:

- `pnpm.cmd exec vitest run src/control/stage-page.browser-source.test.ts src/control/stage-page.stage-motion.test.ts` from `apps/runtime-player`: passed with escalation, 2 files / 9 tests.
- `pnpm.cmd run typecheck` from `apps/runtime-player`: passed.
- `node scripts/check-source-organization.mjs` from repo root: passed.
- `git diff --check -- apps/runtime-player/src/control apps/runtime-player/src/preload discussion/runtime-player/implementation/waves/wave11` from repo root: passed; Git printed CRLF normalization warnings only.
- Targeted `git diff --name-only` over Model Mapping and Runtime Export paths returned no files.
- `pnpm install`: not run.

## Review Result

Review report:

- `discussion/runtime-player/implementation/reviews/wave11/runtime-player-wave11-domain-c-stage-motion-ui-review.md`

Review-Sylph verdict: pass.

Blocking or major findings: none.

Non-blocking note: focused UI tests verify that the missing Depth Scale calibration button calls the provided route handler, but do not directly assert the `control-window-app.tsx` branch that chooses section calibration versus missing-only calibration. Review-Sylph judged this non-blocking because the branch is small and follows Domain A start semantics.

## Source Organization Notes

- Stage Motion UI controls live in focused `apps/runtime-player/src/control/stage-motion-panel.tsx`.
- `stage-page.tsx` remains responsible for Stage page composition and existing Stage page status panels.
- No `index.ts` implementation logic, catch-all source file, or preload bridge contract change was introduced by Domain C.

## Risks / User Decision Points

- Real-device tuning for default ranges and perceived feel still needs later manual verification with iFacialMocap and OBS Browser Source.
- No browser/Electron visual smoke test was run in this domain; verification is focused React static rendering, event callback tests, typecheck, and source organization guard.
- No user/product decision is required from Domain C.
