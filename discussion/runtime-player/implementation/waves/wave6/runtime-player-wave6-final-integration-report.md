# Runtime Player Wave6 Final Integration Report

> Target: `runtime-player-wave6-final-integration-clean-review`
> Verdict: pass for Domain C docs/report integration; final clean integration review pass
> Scope: integrated Wave6 validation after Domain A and Domain B pass, docs/maps alignment, closeout evidence, and final clean review result. No source or test files were edited in this Domain C task.

## Summary

Runtime Player Wave6 is source/test complete at the Domain A/B implementation and review level for Body Follow v0.

Implemented integration facts:

- Existing Input Profiles without `calibration.headPositionRaw` still load and remain usable for existing face / eyes / mouth live mapping.
- Input Profile calibration now has explicit section readiness for head rotation, eyes/mouth, and head position left/right.
- Saved profiles can run missing-only calibration and head-position-only recalibration without recreating the full profile.
- Auto Mapping now has a `body` group with `body-x` and `body-z` slots, while preserving the existing nine Wave5 head / eyes / mouth slots.
- `Body Angle X` is generated from calibrated head horizontal input with conservative strength and smoothing/lag.
- `Body Angle Z` combines calibrated head tilt and optional calibrated `head.positionRaw.x`, with separate rotation and position strengths/inversion.
- Body outputs are emitted through the same sanitized live parameter frame path as Wave5.
- Stage remains model-only, receives no raw tracking/head-position/debug body data, and still evaluates through runtime-core.
- Stage Motion, Broadcast/OBS UX, Body Angle Y, persistent Model Mapping Profile save/read, TCP/VMC/OSC transport, advanced curve editing, and Stage debug UI were not added.

No source/test fix was made during Domain C.

## Dependency Gate

Domain C started after both prerequisite domains reported pass:

- Domain A report: [runtime-player-wave6-domain-a-input-profile-position-calibration-report.md](runtime-player-wave6-domain-a-input-profile-position-calibration-report.md)
- Domain B report: [runtime-player-wave6-domain-b-body-auto-mapping-live-follow-report.md](runtime-player-wave6-domain-b-body-auto-mapping-live-follow-report.md)

Required Domain A/B review lanes exist:

- Domain A spec compliance: pass.
- Domain A design / development compliance: pass.
- Domain A test adequacy re-review: pass.
- Domain B spec compliance: pass.
- Domain B design / development compliance: pass.
- Domain B test adequacy: pass.

## Required Check Results

| Check | Result | Evidence |
|---|---|---|
| Domain A and Domain B reports exist | pass | Both reports exist under `discussion/runtime-player/implementation/waves/wave6/` and declare `pass`. |
| Review lanes exist and pass or escalate | pass | Six Domain A/B review artifacts exist under `discussion/runtime-player/implementation/reviews/wave6/` and declare `pass`. |
| Existing profiles without head position calibration remain usable | pass | Domain A parser/section tests and reviews confirm old profiles parse, missing `headPositionRaw` is reported as only the head-position section missing, and live readiness does not require head position for face / eyes / mouth. |
| Missing-only recalibration works | pass | Domain A report and Test Adequacy re-review confirm saved old profiles run only `look-forward`, `head-position-left`, and `head-position-right`, preserve profile id/created timestamp, and persist `headPositionRaw`. |
| Body Auto Mapping does not regress existing nine Wave5 slots | pass | Domain B report and reviews confirm Auto Mapping now creates 11 slots by appending `body-x` / `body-z`; focused tests preserve the existing nine non-body slots. |
| Body X and Body Z are generated through sanitized live parameter frames | pass | Domain B report/reviews confirm main-owned body follow computes values in `runtime-parameter-frame.ts`, skips non-finite values, clamps to target range, and publishes only `parameterValues` to Stage. |
| Stage remains model-only | pass | Domain B reviews confirm Stage receives no raw tracking frame, raw head position, input diagnostics, or debug body payload, and passes sanitized `parameterValues` through runtime-core evaluation. |
| Stage Motion/Broadcast features were not accidentally added | pass | Domain A/B reports and reviews confirm no Stage scale/translation from head position, no near/far distance behavior, no Broadcast/OBS UX, no Body Angle Y, no TCP/VMC/OSC, and no Stage debug UI. |
| Related docs/maps are updated to match implementation facts | pass after Domain C docs alignment | Runtime Player maps, Wave6 report/review maps, screen docs, and backlog were updated so Body Follow v0 is no longer described as only planned/future. |

## Verification Performed

No `pnpm install` was run.

Automated verification after docs/maps alignment:

- Runtime Player typecheck:
  - Command: `pnpm.cmd typecheck` from `apps/runtime-player`
  - Result: pass.
- Focused Wave6 Runtime Player Vitest:
  - Command: `pnpm.cmd exec vitest run -c vitest.config.ts src/main/input-profiles/input-profile-document-parser.test.ts src/main/input-profiles/input-profile-calibration-sections.test.ts src/main/input-profiles/input-profile-calibration-start.test.ts src/main/input-profiles/input-profile-calibration-session.test.ts src/main/input-profile-bridge-request-validation.test.ts src/main/input-look-forward-session-neutral.test.ts src/main/live-mapping/runtime-export-auto-mapping.test.ts src/main/live-mapping/runtime-parameter-frame.test.ts src/main/input-session-state.test.ts`
  - First sandboxed run failed before tests with `Error: spawn EPERM` while starting the esbuild service.
  - Escalated rerun result: pass, 9 files / 42 tests.
- Runtime Player unit suite:
  - Command: `pnpm.cmd test:unit` from `apps/runtime-player`
  - First sandboxed run failed before tests with `Error: spawn EPERM` while starting the esbuild service.
  - Escalated rerun result: pass, 26 files / 114 tests.
- Source organization guard:
  - Command: `node scripts/check-source-organization.mjs`
  - Result: pass.
- Dependency guard:
  - Command: `node scripts/check-dependencies.mjs`
  - Result: pass.
- Scoped whitespace check:
  - Command: `git diff --check -- apps/runtime-player/src discussion/runtime-player`
  - Result: pass, with Git LF-to-CRLF working-copy warnings only.

Runtime Player build was not rerun in Domain C because this task made docs/maps changes only, and typecheck plus focused/unit tests and guards covered the requested final checks.

Source/boundary evidence confirmed from Domain A/B reports and reviews:

- Existing profile compatibility, missing-only recalibration, and head-position readiness are covered by focused Domain A tests and reviewer source inspection.
- Body slot mapping, Body X/Z runtime parameter generation, clamping/finite output, missing head position fallback, smoothing reset, and stale-frame clearing are covered by focused Domain B tests and reviewer source inspection.
- Source organization guard and dependency guard were reported passing by Domain A/B implementation/review lanes.

## Clean Final Review Result

Final clean integration review passed after Domain C.

Review artifact:

- `discussion/runtime-player/implementation/reviews/wave6/runtime-player-wave6-final-clean-integration-review.md`

The review found no blocking or needs-change findings. Remaining checks are manual real-device/Electron verification items, not a blocking review gate.

## Documentation Alignment

Updated to match Wave6 implementation facts:

- [../../../_map.md](../../../_map.md)
- [../../_map.md](../../_map.md)
- [../../orchestration/_map.md](../../orchestration/_map.md)
- [_map.md](_map.md)
- [../../reviews/wave6/_map.md](../../reviews/wave6/_map.md)
- [../../../screens/_map.md](../../../screens/_map.md)
- [../../../screens/initial-runtime-player-screen.md](../../../screens/initial-runtime-player-screen.md)
- [../../../screens/control-window-screen-structure.md](../../../screens/control-window-screen-structure.md)
- [../../../screens/tracking-setup-live-mapping.md](../../../screens/tracking-setup-live-mapping.md)
- [../../../backlog/runtime-player-backlog.md](../../../backlog/runtime-player-backlog.md)

Key documentation changes:

- Wave6 Body Follow v0 is documented as implemented at source/test/review level rather than only planned/future.
- Input Profile head position left/right calibration, section readiness, missing-only recalibration, and head-position-only recalibration are documented as Wave6 facts.
- Auto Mapping is documented as preserving the existing nine Wave5 slots and adding Body X/Z slots when matching body targets exist.
- Body Follow is documented as sanitized runtime parameter generation, not Stage-side raw tracking or Stage Motion.
- Stage scale/translation, near/far distance response, Broadcast/OBS UX, persistent Model Mapping Profile save/read, Body Angle Y, and dedicated Stage debug UI remain future/out of scope.

## Manual Verification Remaining

The following are not treated as done by Domain C:

- Launch Electron Runtime Player and visually inspect the Input Profile section readiness and missing-only / head-position-only calibration controls.
- Launch Electron Runtime Player and inspect the Mapping page Body group and Body X/Z controls.
- Load a Runtime Export with authored `Body Angle X` / `Body Angle Z` keyforms.
- Connect real iFacialMocap input and verify clean Stage body motion.
- Confirm existing face / eyes / mouth motion remains active when body slots are present or missing.
- Confirm Stage remains model-only during body follow and shows no setup/debug/raw tracking body UI.
- Tune Body X/Z default strengths and lag with real-device visual evidence if needed.

## User Decision Points

No new user decision is required for Wave6 source behavior.

Future planning topics:

- Whether to adjust default Body X strength, Body Z rotation strength, Body Z position strength, or lag after real-device visual testing.
- Whether Body Follow settings should later become part of a persistent Model Mapping Profile.
- When to implement Stage Motion from head position, near/far distance response, Stage window placement/capture controls, or Broadcast/OBS UX.
- Whether to add React/IPC validation tests for Mapping Page body controls in a later hardening wave.

## Source/Test Blockers

No source/test blocker was discovered in Domain C.

Wave6 is closed at source/test/docs/review level after the final clean integration review pass. Remaining verification is manual real-device/Electron body follow confirmation and tuning.
