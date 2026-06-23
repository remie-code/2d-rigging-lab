# Runtime Player Wave11 Domain C Review: Stage Motion UI

- verdict: pass
- reviewer: Review-Sylph
- target/domain: runtime-player-wave11-stage-motion-ui

## Findings

- Blocking/Major: none.
- Minor, non-blocking test gap: the focused UI tests verify that the missing Depth Scale calibration button calls the provided route handler in `apps/runtime-player/src/control/stage-page.stage-motion.test.ts:109`, but they do not directly assert the `control-window-app.tsx` request branching that chooses `mode: "section"` for saved profiles with ready left/right calibration and `mode: "missing-only"` otherwise. The implementation at `apps/runtime-player/src/control/control-window-app.tsx:756` through `:790` is simple and matches the Domain A start semantics in `apps/runtime-player/src/main/input-profiles/input-profile-calibration-start.ts:57` through `:108`, so this is not blocking. A small future control-window test would reduce regression risk around that route.

## Spec Compliance

- Stage Motion renders on the Stage page. `StagePage` places `StageMotionPanel` beside `Stage Window` and `View` in `apps/runtime-player/src/control/stage-page.tsx:155`, not on Mapping.
- Required controls exist and update Domain B settings live. `StageMotionPanel` exposes Enabled at `apps/runtime-player/src/control/stage-motion-panel.tsx:49`, Horizontal Follow strength/limit/invert at `:64`, `:81`, and `:98`, Depth Scale strength/limit/invert at `:134`, `:151`, and `:168`, and Stabilization dead zone/reaction at `:187` and `:202`. Each control emits a partial `RuntimePlayerStageMotionSettingsUpdate`.
- Auto-save state remains understandable. The Stage Motion panel shows `Auto Save` from the existing Stage persistence label at `apps/runtime-player/src/control/stage-motion-panel.tsx:56`, and the existing full `Auto Save` panel remains in `apps/runtime-player/src/control/stage-page.tsx:239`.
- Missing near/far calibration is visible and recoverable. Depth Scale readiness is computed in `apps/runtime-player/src/control/stage-motion-panel.tsx:300`, displayed near `:118`, and missing states expose `Calibrate in Input` at `:122`. The route switches to Input and starts calibration in `apps/runtime-player/src/control/control-window-app.tsx:677`.
- No runtime parameter sliders, raw diagnostics, or editor/mapping controls were introduced in the Stage Motion UI. The focused absence test covers this in `apps/runtime-player/src/control/stage-page.stage-motion.test.ts:129`.
- Browser Source ordering is preserved. Stage Motion is before `BrowserSourceOutputPanel` in `apps/runtime-player/src/control/stage-page.tsx:155` and `:164`; `Local Preview / Fallback` remains after Browser Source at `:169`. Tests assert this in `apps/runtime-player/src/control/stage-page.stage-motion.test.ts:43` and keep the fallback ordering assertion in `apps/runtime-player/src/control/stage-page.browser-source.test.ts:143`.

## Design / Development Compliance

- Domain C stays within the expected control UI surface: `control-window-app.tsx`, `stage-page.tsx`, the new focused `stage-motion-panel.tsx`, focused UI tests, and the Domain C report.
- Domain B contracts are reused. Domain C consumes `stageState.stageMotion.settings` and calls `stageView.updateStageMotionSettings(update)` through the existing `runStageAction` path at `apps/runtime-player/src/control/control-window-app.tsx:672`.
- No unnecessary preload/main contract churn was introduced by Domain C. The bridge surface was already supplied by Domain B.
- No Model Mapping Profile, Runtime Export, Browser Source payload, or Window State schema files were changed by Domain C. A targeted `git diff --name-only` over model-mapping/runtime-export paths returned no files.
- Source organization policy is respected. `stage-motion-panel.tsx` has a focused UI responsibility, no `index.ts` implementation logic or catch-all file was added, and `node scripts/check-source-organization.mjs` passed.
- The worktree contains concurrent Domain A/B changes; this review found no evidence that Domain C reverted unrelated work.

## Test Adequacy

- Render, required labels, numeric display, and auto-save status are covered in `apps/runtime-player/src/control/stage-page.stage-motion.test.ts:23`.
- Browser Source / fallback ordering is covered in `apps/runtime-player/src/control/stage-page.stage-motion.test.ts:43`, with the pre-existing fallback-specific ordering test updated at `apps/runtime-player/src/control/stage-page.browser-source.test.ts:143`.
- Partial update shapes for all Stage Motion controls are covered in `apps/runtime-player/src/control/stage-page.stage-motion.test.ts:57`.
- Missing near/far display and click route to the provided calibration callback are covered in `apps/runtime-player/src/control/stage-page.stage-motion.test.ts:109`.
- Absence of mapping/editor/runtime parameter controls is covered in `apps/runtime-player/src/control/stage-page.stage-motion.test.ts:129`.
- Remaining non-blocking gap: no direct test for the `createDepthScaleCalibrationRequest` branch shape in `control-window-app.tsx`, as noted in Findings.

## Commands Run

- `git status --short -uall` from repo root: observed Domain C files plus concurrent Domain A/B worktree changes.
- `pnpm.cmd exec vitest run src/control/stage-page.browser-source.test.ts src/control/stage-page.stage-motion.test.ts` from `apps/runtime-player`: passed with escalation, 2 files / 9 tests. I used escalation up front because this workspace's Vitest runs are known to hit sandbox `spawn EPERM`.
- `pnpm.cmd run typecheck` from `apps/runtime-player`: passed.
- `node scripts/check-source-organization.mjs` from repo root: passed.
- `git diff --check -- apps/runtime-player/src/control apps/runtime-player/src/preload discussion/runtime-player/implementation/waves/wave11` from repo root: exit 0; Git printed CRLF normalization warnings only.
- `git diff --name-only -- apps/runtime-player/src/main/model-mapping-profiles apps/runtime-player/src/main/model-mapping-bridge-handlers.ts apps/runtime-player/src/main/live-mapping apps/runtime-player/src/main/runtime-export apps/runtime-player/src/preload/runtime-export-bridge-contract.ts` from repo root: returned no files.
- `pnpm install`: not run.

## Unresolved Risks / User Decision Points

- Real-device tuning for default strength/limit/dead-zone/reaction values still needs later manual validation with iFacialMocap and OBS Browser Source.
- No browser/Electron visual smoke test was run for this UI review; verification is React static rendering/event tests, typecheck, source organization guard, and source inspection.
- No user/product decision is required before Domain D from this review perspective.

## Review Artifact

- Written to `discussion/runtime-player/implementation/reviews/wave11/runtime-player-wave11-domain-c-stage-motion-ui-review.md`.
