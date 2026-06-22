# Runtime Player Wave5 Final Clean Integration Review

- verdict: `pass`
- target: Runtime Player Wave5 final clean integration
- review lane: Domain C clean final integration review
- reviewer: Review-Sylph
- date: 2026-06-22
- re-review: docs/maps cleanup verification after first-review `needs_changes`

## Scope Reviewed

Reviewed the Wave5 integration state from basis documents, Domain A/B reports, all Wave5 Domain A/B review artifacts, Runtime Player screen docs, focused source, focused tests, and required boundary searches.

Re-review update: after Domain C docs/maps cleanup, re-read the active Runtime Player maps, Wave5 report/review maps, and final integration report to verify the prior documentation/map alignment finding.

Direct source/test inspection covered:

- Control shell/pages: `apps/runtime-player/src/control/control-window-shell.tsx`, `control-window-app.tsx`, `overview-page.tsx`, `input-page.tsx`, `mapping-page.tsx`
- Input profile / calibration / session state: `apps/runtime-player/src/main/input-profiles/**`, `input-profile-bridge-handlers.ts`, `input-session-state.ts`, `input-bridge-handlers.ts`
- Live mapping / Stage live path: `apps/runtime-player/src/main/live-mapping/**`, `model-mapping-bridge-handlers.ts`, `live-parameter-bridge-handlers.ts`
- Preload contracts: `apps/runtime-player/src/preload/*stage*`, `*live-parameter*`, model mapping, input profile, and runtime bridge contracts
- Stage render/evaluation: `apps/runtime-player/src/stage/**`
- Focused tests for profile store, calibration, Look Forward, mapping, runtime parameter frame, Stage live frame matching, runtime-core evaluation, Stage scene, and boundary checks.

## Basis Documents Used

- `discussion/runtime-player/implementation/orchestration/player-wave5-plan.md`
- `discussion/runtime-player/implementation/orchestration/runtime-player-wave-planning-conventions.md`
- `discussion/runtime-player/implementation/waves/wave5/runtime-player-wave5-domain-a-control-input-profile-calibration-report.md`
- `discussion/runtime-player/implementation/waves/wave5/runtime-player-wave5-domain-b-auto-mapping-stage-live-report.md`
- All six Domain A/B Wave5 review artifacts under `discussion/runtime-player/implementation/reviews/wave5/`
- Runtime Player screen docs under `discussion/runtime-player/screens/`
- Runtime Player maps under `discussion/runtime-player/_map.md`, `implementation/_map.md`, `implementation/orchestration/_map.md`, `implementation/waves/wave5/_map.md`, and `implementation/reviews/wave5/_map.md`
- `discussion/runtime-player/implementation/waves/wave5/runtime-player-wave5-final-integration-report.md`

## Findings

### Blocking

None in source or tests.

### Needs Changes

None.

### Resolved Prior Finding

The first review's documentation/map alignment `needs_changes` finding is resolved.

Re-review evidence:

- `discussion/runtime-player/screens/_map.md` now documents Wave5 v0 Control navigation as `Overview` / `Input` / `Mapping`, treats `Model` / `Stage` / dedicated `Diagnostics` pages as future, and no longer lists Input Profile storage as an open question.
- `discussion/runtime-player/_map.md` now records Wave5 implementation facts and moves persistent Model Mapping Profile, advanced mapping, Body Follow, Stage Motion, TCP, and dedicated pages to future scope.
- `discussion/runtime-player/implementation/_map.md` and `discussion/runtime-player/implementation/orchestration/_map.md` now mark Wave5 as `Completed / final pass` and link Wave5 reports/reviews.
- `discussion/runtime-player/implementation/waves/wave5/_map.md` now records final integration verdict `pass` and links the final report/review.
- `discussion/runtime-player/implementation/reviews/wave5/_map.md` now includes this final clean integration review and records final integration review verdict as pass after docs/maps cleanup re-review.
- `discussion/runtime-player/implementation/waves/wave5/runtime-player-wave5-final-integration-report.md` records the final integration evidence and documentation alignment work.
- A targeted stale-text search over the active Runtime Player maps/docs found no remaining matches for the prior stale planned/pending/next-wave wording.

### Non-Blocking Observations

- Manual real-device verification is still not done in the evidence I reviewed. This remains explicit manual verification, not a blocking source/docs issue.
- No product/user decision is needed for the source behavior reviewed here.

## Required Check Results

| Required check | Result | Evidence |
|---|---|---|
| Domain A and Domain B reports exist | pass | Both Wave5 domain reports exist and declare `pass`. |
| Review lanes exist and pass/escalate | pass | Six Domain A/B review artifacts exist; all declare `pass`. |
| Control Window only exposes real Wave5 pages | pass | `control-window-shell.tsx:12-14` defines only `Overview`, `Input`, `Mapping`; no `Model`, `Stage`, or dedicated `Diagnostics` nav page is exposed. |
| Input Profile persists under `userData` and failure fallback is safe | pass | `runtime-player-main.ts:35` passes `app.getPath("userData")`; `input-profile-store.ts:41-45` resolves `input-profiles/ifacialmocap/profiles.json`; read failures become `read-failed` snapshots and status falls back to temporary defaults in `input-profile-bridge-handlers.ts:240-248`. |
| `Look Forward` is session-local | pass | `input-session-state.ts:99-121` captures latest tracking frame into `sessionNeutral`; bridge action does not write the profile store. |
| Calibration learns range/signs | pass | `input-profile-calibration-session.ts:75-89`, `210-232`, and `287-326` cover prompts, stable sample learning, and profile creation; focused calibration tests passed. |
| Auto Mapping uses standard parameters and avoids forbidden output targets | pass | `semantic-slot-definitions.ts:30-113` defines required standard slots; `runtime-export-auto-mapping.ts:65-71` requires external-input authored targets and excludes computed/hidden/read-only/internal paths. |
| Stage live motion works through runtime-core evaluation | pass at source/test level | `model-mapping-bridge-handlers.ts:45-70` produces sanitized frames; `static-stage-canvas-renderer.ts:209-212` passes `parameterValues`; `runtime-export-pose-evaluator.ts:58-65` calls `evaluateRuntimeFrame`. |
| Stage remains model-only | pass at source/test level | `stage-window-app.tsx:151-162` renders only the stage shell/canvas; boundary tests assert no raw tracking/setup/debug controls in Stage production files. |
| Diagnostics are not used as live-rate UI state | pass | `input-bridge-handlers.ts:92-95` calls the live publish callback on every received frame separately from throttled diagnostics; Stage coalesces latest live frames with `requestAnimationFrame`. |
| Related docs/maps updated | pass | Updated maps/docs now reflect Wave5 v0 implementation facts and future-only items; targeted stale-text search over active maps/docs returned no matches for the prior stale planned/pending/next-wave wording. |

## Verification Performed

No `pnpm install` was run.

Docs/maps cleanup re-review:

- Re-read `discussion/runtime-player/screens/_map.md`.
- Re-read `discussion/runtime-player/_map.md`.
- Re-read `discussion/runtime-player/implementation/_map.md`.
- Re-read `discussion/runtime-player/implementation/orchestration/_map.md`.
- Re-read `discussion/runtime-player/implementation/waves/wave5/_map.md`.
- Re-read `discussion/runtime-player/implementation/reviews/wave5/_map.md`.
- Re-read `discussion/runtime-player/implementation/waves/wave5/runtime-player-wave5-final-integration-report.md`.
- Ran targeted `rg` over active Runtime Player maps/docs for the stale terms from the first review; no matches were returned.
- Did not rerun source tests or typecheck for this re-review because the changes under review were docs/maps cleanup only and previous source/test evidence remains sufficient.

First-review focused searches/source inspection retained:

- Confirmed no direct filesystem/localStorage/indexedDB use from Control/preload.
- Confirmed Stage production/preload sources do not expose `window.runtimePlayer`, `TrackingFrame`, `rawFrame`, `blendshapes`, input profile APIs, model mapping APIs, diagnostics APIs, or open-directory APIs.
- Confirmed forbidden feature searches found no Wave5 implementation of Body Follow, Stage Motion, smoothing, deadzone, response curve, persistent Model Mapping Profile save, runtime parameter sliders, or TCP transport. The only `TCP` match was an existing iFacialMocap parser test name.
- Confirmed current git status contains Wave5 source/docs/report/review changes; this review did not modify source files.

First-review focused tests retained:

```text
pnpm.cmd exec vitest run -c vitest.config.ts src/main/input-profiles/input-profile-store.test.ts src/main/input-profiles/input-profile-calibration-session.test.ts src/main/input-look-forward-session-neutral.test.ts src/main/input-profile-bridge-request-validation.test.ts src/main/input-session-state.test.ts src/main/live-mapping/runtime-export-auto-mapping.test.ts src/main/live-mapping/runtime-parameter-frame.test.ts src/stage/stage-renderer/stage-live-parameter-frame-match.test.ts src/stage/runtime-evaluation/runtime-export-default-pose-evaluation.test.ts src/stage/stage-renderer/runtime-export-stage-scene.test.ts src/runtime-player-boundary.test.ts
```

- First sandbox attempt failed before tests with Vitest/Vite `esbuild` `spawn EPERM`.
- Reran with escalation for the same command.
- Result: pass, 11 files / 38 tests.

First-review typecheck retained:

```text
pnpm.cmd typecheck
```

- Run from `apps/runtime-player`.
- Result: pass.

## Remaining Manual Verification

Treat all of the following as not done:

- Launch Electron Runtime Player and visually verify the Wave5 Control shell.
- Verify only `Overview / Input / Mapping` nav is exposed in the live app.
- Connect real iFacialMocap input and exercise Guided Calibration through the UI.
- Save an Input Profile, restart Runtime Player, and verify reload from the OS `userData` directory.
- Load a real Runtime Export, use saved profile or temporary defaults, run Auto Mapping, and confirm real iFacialMocap input moves the clean Stage model.
- Confirm Stage remains model-only during live motion: no debug overlay, raw tracking text, sliders, or setup UI.
- Confirm Runtime Export reload/clear does not leave stale live pose state.

## User-Decision Points

None for source behavior.

Operational follow-up required:

- Decide when to run and record real-device/manual verification evidence.
