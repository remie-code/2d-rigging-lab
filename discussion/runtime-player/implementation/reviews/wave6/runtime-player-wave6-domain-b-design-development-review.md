# Runtime Player Wave6 Domain B Design / Development Compliance Review

- Verdict: `pass`
- Target: `runtime-player-wave6-body-auto-mapping-live-follow`
- Review lane: Design / Development Compliance Review
- Reviewer: Review-Sylph
- Date: 2026-06-23

## Scope Reviewed

Reviewed Domain B source and focused tests directly against Runtime Player development policy, process boundaries, source organization, dependency scope, and main/preload/control/stage responsibilities.

Direct inspection covered:

- `apps/runtime-player/src/preload/model-mapping-bridge-contract.ts`
- `apps/runtime-player/src/control/mapping-page.tsx`
- `apps/runtime-player/src/main/live-mapping/body-follow-state.ts`
- `apps/runtime-player/src/main/live-mapping/semantic-slot-definitions.ts`
- `apps/runtime-player/src/main/live-mapping/runtime-export-auto-mapping.ts`
- `apps/runtime-player/src/main/live-mapping/runtime-parameter-frame.ts`
- `apps/runtime-player/src/main/live-mapping/live-mapping-state.ts`
- `apps/runtime-player/src/main/model-mapping-bridge-request-validation.ts`
- `apps/runtime-player/src/main/model-mapping-bridge-handlers.ts`
- `apps/runtime-player/src/main/input-bridge-handlers.ts`
- `apps/runtime-player/src/main/input-session-state.ts`
- `apps/runtime-player/src/main/runtime-player-main.ts`
- Stage boundary references: `apps/runtime-player/src/preload/live-parameter-bridge-contract.ts`, `apps/runtime-player/src/preload/runtime-player-stage-bridge.ts`, `apps/runtime-player/src/preload/runtime-player-stage-bridge-contract.ts`, `apps/runtime-player/src/stage/stage-window-app.tsx`, `apps/runtime-player/src/stage/stage-renderer/static-stage-canvas-renderer.ts`, `apps/runtime-player/src/stage/runtime-evaluation/runtime-export-pose-evaluator.ts`
- Focused tests: `apps/runtime-player/src/main/live-mapping/runtime-export-auto-mapping.test.ts`, `apps/runtime-player/src/main/live-mapping/runtime-parameter-frame.test.ts`, `apps/runtime-player/src/main/input-session-state.test.ts`

Pre-existing Domain A files were inspected only where they affect Domain B reset/profile/input boundaries.

## Basis Documents Used

- `discussion/runtime-player/implementation/orchestration/player-wave6-plan.md`
- `discussion/runtime-player/architecture/runtime-player-development-policy.md`
- `discussion/runtime-player/architecture/tracking-input-mapping-baseline.md`
- `discussion/runtime-player/implementation/waves/wave6/runtime-player-wave6-domain-b-body-auto-mapping-live-follow-report.md`
- `discussion/runtime-player/implementation/waves/wave5/runtime-player-wave5-final-integration-report.md`
- `discussion/runtime-player/implementation/reviews/wave5/runtime-player-wave5-final-clean-integration-review.md`

## Findings

### Blocking

None.

### Needs Changes

None.

### Non-Blocking Observations

- Real-device tuning and visual confirmation remain manual gaps, not source compliance failures. The implementation defaults are source/test covered, but the final feel of Body X/Z strength and lag still needs a real Runtime Export with authored body keyforms and real iFacialMocap input.
- Automatic clearing when an input connection becomes time-stale by age is not implemented as a separate timer-driven reset. I did not classify this as a Domain B design violation because the explicit reset paths under review cover runtime export changes, mapping changes, profile/calibration/Look Forward actions, connect/reconnect, and disconnect; disconnect clears the latest live-rate tracking frame.

## Boundary / Source Organization Assessment

Pass.

- Main owns body follow derived state and smoothing. `RuntimePlayerBodyFollowState` stores transient per-slot smoothed values in `apps/runtime-player/src/main/live-mapping/body-follow-state.ts:7`, and main wires one instance through `apps/runtime-player/src/main/runtime-player-main.ts:22-79`.
- Body X/Z value generation happens in main live mapping, not Stage. `apps/runtime-player/src/main/live-mapping/runtime-parameter-frame.ts:281-423` derives body values from calibrated head rotation/head position, applies finite/clamp handling through the existing parameter frame path, and applies body smoothing through main-owned state.
- Stage receives sanitized live parameter frames only. The live frame contract contains runtime export identity, sequence/timestamps, and `parameterValues` only in `apps/runtime-player/src/preload/live-parameter-bridge-contract.ts:1-12`; Stage applies only `liveFrame.parameterValues` as `authoredParameterValues` in `apps/runtime-player/src/stage/stage-renderer/static-stage-canvas-renderer.ts:209-219`.
- Stage continues to evaluate through runtime-core. `apps/runtime-player/src/stage/runtime-evaluation/runtime-export-pose-evaluator.ts:58-81` calls `evaluateRuntimeFrame`; Body Follow does not bypass runtime-core or add a Stage-side body solver.
- No raw tracking frame, raw head position, body debug payload, or input diagnostics were added to the Stage live parameter path. Stage preload exposes runtime export, live parameter frames, and stage status/reset APIs only in `apps/runtime-player/src/preload/runtime-player-stage-bridge-contract.ts:27-31`.
- Preload remains typed and narrow for Domain B. `apps/runtime-player/src/preload/model-mapping-bridge-contract.ts:1-101` adds typed body slot/control fields; `apps/runtime-player/src/preload/runtime-player-bridge.ts:46-166` exposes named bridge functions, not raw `ipcRenderer`, filesystem handles, sockets, or Electron objects to renderer code.
- Control UI remains setup/mapping UI. `apps/runtime-player/src/control/mapping-page.tsx:106-126` renders semantic slots, and `apps/runtime-player/src/control/mapping-page.tsx:235-437` adds body toggles/sliders for Body X/Z. I found no Stage debug UI, raw diagnostics tuning panel, freeform parameter editor, textarea, direct runtime export mutation, or persistent Model Mapping Profile surface.
- Source organization is cohesive. New body follow state is under `main/live-mapping`, semantic definitions remain with mapping semantics, validation remains in the bridge request validator, and no new catch-all `types.ts`, `utils.ts`, `helpers.ts`, `common.ts`, or substantial `index.ts` was introduced. `node scripts/check-source-organization.mjs` passed in this review.

## Dependency and Forbidden-Scope Checks

Pass.

- No package dependency diff was present in `package.json`, `pnpm-lock.yaml`, or `apps/runtime-player/package.json`; `node scripts/check-dependencies.mjs` passed in this review.
- No changed files were detected under `apps/editor/**`, `packages/**`, or `node_modules/**`.
- Targeted forbidden-scope search found no Domain B implementation of Body Angle Y, `body.angle.y`, `param_body_angle_y`, Broadcast/OBS UX, VMC/OSC transport, persistent Model Mapping Profile save/read, `localStorage`, or `indexedDB`. The only `TCP` hit was an existing iFacialMocap parser test name.
- Stage scale/translation from head position was not added. Existing Stage viewport pan/zoom code remains Stage display behavior and is not driven by tracking head position.
- `git diff --check -- apps/runtime-player/src discussion/runtime-player/implementation/waves/wave6 discussion/runtime-player/implementation/reviews/wave6` exited 0 with LF-to-CRLF working-copy warnings only.

## Reset / Stale Frame Assessment

Pass at source level for the Domain B reset paths.

- Runtime Export changing/loaded/cleared resets body follow state, clears live frames, and updates mapping status in `apps/runtime-player/src/main/runtime-player-main.ts:58-79`.
- Mapping regeneration and slot updates reset body follow state before republishing in `apps/runtime-player/src/main/model-mapping-bridge-handlers.ts:104-129`.
- Input connect/reconnect and disconnect invoke the main reset callback in `apps/runtime-player/src/main/input-bridge-handlers.ts:81-130`; main clears body follow state and live frames in `apps/runtime-player/src/main/runtime-player-main.ts:30-37`.
- Input profile changes, Look Forward, calibration save, and calibration-session actions go through `onProfileChanged` in `apps/runtime-player/src/main/input-profile-bridge-handlers.ts:66-77`, with main resetting body follow state before publishing in `apps/runtime-player/src/main/runtime-player-main.ts:38-46`.
- Disconnect clears the latest live-rate tracking frame in `apps/runtime-player/src/main/input-session-state.ts:192-202`; focused coverage exists in `apps/runtime-player/src/main/input-session-state.test.ts:120-140`.

## Wave5 Preservation Assessment

Pass.

- Existing Wave5 head/eyes/mouth slots remain in `apps/runtime-player/src/main/live-mapping/semantic-slot-definitions.ts:38-133`; Body X/Z are appended as the body group in `apps/runtime-player/src/main/live-mapping/semantic-slot-definitions.ts:134-161`.
- Auto Mapping still filters to authored direct external-input targets and excludes computed dynamics, hidden direct controls, read-only, runtime-internal, and manifest-excluded targets in `apps/runtime-player/src/main/live-mapping/runtime-export-auto-mapping.ts:52-88`.
- Focused mapping tests assert the 11-slot set while preserving the existing 9 non-body slots in `apps/runtime-player/src/main/live-mapping/runtime-export-auto-mapping.test.ts:57-70` and `apps/runtime-player/src/main/live-mapping/runtime-export-auto-mapping.test.ts:127-205`.
- Focused parameter-frame tests cover existing head/eyes/mouth finite output and invalid-source skipping in `apps/runtime-player/src/main/live-mapping/runtime-parameter-frame.test.ts:15-154`, plus Body X/Z generation, component inversion, clamping, missing head position calibration fallback, and smoothing reset in `apps/runtime-player/src/main/live-mapping/runtime-parameter-frame.test.ts:156-334`.

## Remaining Issues / Manual Verification Gaps

- I did not rerun Vitest or typecheck in this review lane; I reviewed the focused tests directly and independently reran source organization, dependency, and whitespace guards. Gnome-reported Vitest/typecheck/unit results remain the automated test evidence for this lane.
- Manual Electron launch was not performed here.
- Manual real-device verification remains open: load a Runtime Export with authored `Body Angle X` / `Body Angle Z` keyforms, connect real iFacialMocap input, confirm clean Stage body motion, and confirm no Stage debug/raw tracking surface appears.
- Default Body X/Z strengths and lag should be evaluated visually with a real model before treating them as final tuning.

## User-Decision Points

None required for Domain B source behavior.

Future decision points after manual verification:

- Whether to adjust default Body X strength, Body Z rotation strength, Body Z position strength, or lag.
- Whether Body Follow settings should later become part of a persistent Model Mapping Profile once that feature is explicitly designed.
