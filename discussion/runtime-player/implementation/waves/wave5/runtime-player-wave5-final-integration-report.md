# Runtime Player Wave5 Final Integration Report

> Target: `runtime-player-wave5-final-integration-clean-review`  
> Verdict: pass  
> Scope: integrated Wave5 validation after Domain A and Domain B pass, clean final review coordination, docs/maps alignment, and Wave5 closeout evidence.

## Summary

Runtime Player Wave5 is source/test complete for Tracking Setup + Live Mapping v0.

Implemented integration facts:

- Control Window exposes only real Wave5 pages: `Overview`, `Input`, and `Mapping`.
- Input Profile persistence is main-owned and uses `<electron userData>/input-profiles/ifacialmocap/profiles.json`.
- Profile read failure falls back to temporary defaults and warning/status output instead of crashing.
- `Look Forward` is session-local and does not overwrite persistent profile neutral.
- Guided Calibration v0 records range and learned signs.
- Auto Mapping v0 uses standard semantic slots and targets authored external-input parameters only.
- Main produces sanitized `runtime-player-live-parameter-frame-v1` frames.
- Stage consumes only sanitized live parameter frames, evaluates through `runtime-core`, and remains model-only.
- Diagnostics remain Control/debug UI state and are not the live-rate Stage motion path.

No source/test fix was required during Domain C.

## Dependency Gate

Domain C started after both prerequisite domains reported pass:

- Domain A report: [runtime-player-wave5-domain-a-control-input-profile-calibration-report.md](runtime-player-wave5-domain-a-control-input-profile-calibration-report.md)
- Domain B report: [runtime-player-wave5-domain-b-auto-mapping-stage-live-report.md](runtime-player-wave5-domain-b-auto-mapping-stage-live-report.md)

Required Domain A/B review lanes exist:

- Domain A spec compliance: pass.
- Domain A design / development compliance: pass.
- Domain A test adequacy: pass.
- Domain B spec compliance: pass.
- Domain B design / development compliance: pass.
- Domain B test adequacy: pass.

## Required Check Results

| Check | Result | Evidence |
|---|---|---|
| Domain A and Domain B reports exist | pass | Both reports exist under `discussion/runtime-player/implementation/waves/wave5/` and declare `pass`. |
| Review lanes exist and pass or escalate | pass | Six Domain A/B review artifacts exist under `discussion/runtime-player/implementation/reviews/wave5/` and declare `pass`. |
| Control Window only exposes real Wave5 pages | pass | `apps/runtime-player/src/control/control-window-shell.tsx` defines only `Overview`, `Input`, and `Mapping`; diagnostics remains a secondary panel in `control-window-app.tsx`. |
| Input Profile persists under `userData` and fallback is safe | pass | `runtime-player-main.ts` wires Electron `app.getPath("userData")`; `input-profile-store.ts` resolves `input-profiles/ifacialmocap/profiles.json`, creates directories, validates reads, and produces `read-failed` snapshots; profile bridge status activates temporary defaults on read failure. |
| `Look Forward` is session-local | pass | `RuntimePlayerInputSessionState` captures latest tracking frame into session neutral; bridge action does not write the profile store. |
| Calibration learns range/signs | pass | Calibration prompts, stable sample thresholds, range accumulation, learned signs, and profile creation are implemented in `input-profile-calibration-session.ts` and covered by focused tests. |
| Auto Mapping uses standard parameters and avoids forbidden output targets | pass | `semantic-slot-definitions.ts` covers the required nine slots; `runtime-export-auto-mapping.ts` requires external-input authored targets and excludes computed, hidden, read-only, internal, and manifest-excluded parameters. |
| Stage live motion works through runtime-core evaluation | pass at source/test level | Main produces sanitized parameter frames; Stage passes `parameterValues` into runtime-core evaluation through `runtime-export-pose-evaluator.ts`; focused Stage tests pass. |
| Stage remains model-only | pass at source/test level | Stage app renders only the Stage shell/canvas and uses Stage-only preload APIs; boundary tests assert no setup/debug/raw tracking surfaces in Stage production files. |
| Diagnostics are not used as live-rate UI state | pass | `input-bridge-handlers.ts` invokes live frame publication on input frame receipt separately from throttled diagnostics; Stage coalesces latest live frames on `requestAnimationFrame`. |
| Related docs/maps updated | pass after Domain C docs alignment | Screen docs, Runtime Player maps, implementation maps, Wave5 report map, and Wave5 review map are updated to reflect Wave5 implementation facts and future-only items. |

## Verification Performed

No `pnpm install` was run.

Automated verification:

- Focused Runtime Player Vitest:
  - Command: `pnpm.cmd exec vitest run -c vitest.config.ts src/main/input-connect-request-validation.test.ts src/main/input-look-forward-session-neutral.test.ts src/main/input-profile-bridge-request-validation.test.ts src/main/input-profiles/input-profile-calibration-session.test.ts src/main/input-profiles/input-profile-store.test.ts src/main/live-mapping/runtime-export-auto-mapping.test.ts src/main/live-mapping/runtime-parameter-frame.test.ts src/stage/stage-renderer/stage-live-parameter-frame-match.test.ts src/stage/runtime-evaluation/runtime-export-default-pose-evaluation.test.ts src/stage/stage-renderer/runtime-export-stage-scene.test.ts src/runtime-player-boundary.test.ts`
  - Result: pass, 11 files / 36 tests.
- Runtime Player unit suite:
  - Command: `pnpm.cmd test:unit` from `apps/runtime-player`
  - Result: pass, 23 files / 90 tests.
- Runtime Player typecheck:
  - Command: `pnpm.cmd typecheck` from `apps/runtime-player`
  - Result: pass.
- Runtime Player build:
  - Command: `pnpm.cmd build` from `apps/runtime-player`
  - Result: pass; emitted both `preload.mjs` and `stage-preload.mjs`.
- Source organization guard:
  - Command: `node scripts/check-source-organization.mjs`
  - Result: pass.
- Dependency guard:
  - Command: `node scripts/check-dependencies.mjs`
  - Result: pass.
- Scoped whitespace check:
  - Command: `git diff --check -- apps/runtime-player/src apps/runtime-player/electron.vite.config.ts discussion/runtime-player`
  - Result: pass, with LF/CRLF working-copy warnings only.

Source/boundary inspection:

- Confirmed Control navigation only includes `Overview`, `Input`, and `Mapping`.
- Confirmed renderer/preload do not read/write Input Profile files directly.
- Confirmed Stage production/preload surfaces do not expose raw `TrackingFrame`, raw frame text, blendshapes, input profile APIs, model mapping edit APIs, diagnostics APIs, or the broad Control bridge.
- Confirmed no Wave5 implementation of Body Follow, head-position Stage Motion, TCP transport, persistent Model Mapping Profile save, smoothing, deadzone, response curve editor, advanced raw source selector, or runtime parameter sliders.

## Clean Final Review

Clean final review artifact:

- [../../reviews/wave5/runtime-player-wave5-final-clean-integration-review.md](../../reviews/wave5/runtime-player-wave5-final-clean-integration-review.md)

Review status:

- First clean review found no source/test blocking issue.
- First clean review returned `needs_changes` only because docs/maps still contained stale Wave5 pending/planned descriptions.
- Domain C updated the stale docs/maps and requested re-review.
- Final clean re-review verdict: pass.

## Documentation Alignment

Updated to match Wave5 implementation facts:

- [../../../_map.md](../../../_map.md)
- [../../_map.md](../../_map.md)
- [../../orchestration/_map.md](../../orchestration/_map.md)
- [_map.md](_map.md)
- [../../reviews/wave5/_map.md](../../reviews/wave5/_map.md)
- [../../../screens/_map.md](../../../screens/_map.md)
- [../../../screens/initial-runtime-player-screen.md](../../../screens/initial-runtime-player-screen.md)
- [../../../screens/control-window-screen-structure.md](../../../screens/control-window-screen-structure.md)
- [../../../screens/tracking-setup-live-mapping.md](../../../screens/tracking-setup-live-mapping.md)

Key documentation changes:

- Wave5 is no longer described as the next subject in active maps.
- Control Window v0 is documented as `Header + Overview / Input / Mapping`.
- `Model`, `Stage`, and dedicated `Diagnostics` pages are documented as future, not exposed Wave5 pages.
- `Gaze X/Y` v0 priority is documented as eye Euler first.
- `Use Temporary Defaults` is documented as included in Wave5 v0 and non-persistent.
- Persistent Model Mapping Profile save/read is documented as future.
- Stage live motion is documented as sanitized parameter frame + runtime-core evaluation, not diagnostics-driven UI state.

## Manual Verification Remaining

The following are not treated as done by Domain C:

- Launch Electron Runtime Player and visually verify the Wave5 Control shell.
- Verify only `Overview` / `Input` / `Mapping` nav is exposed in the live app.
- Connect real iFacialMocap input and exercise Guided Calibration through the UI.
- Save an Input Profile, restart Runtime Player, and verify reload from the OS `userData` directory.
- Load a real Runtime Export, use saved profile or temporary defaults, run Auto Mapping, and confirm real iFacialMocap input moves the clean Stage model.
- Confirm Stage remains model-only during live motion.
- Confirm Runtime Export reload/clear does not leave stale live pose state.

## User Decision Points

No new user decision is required for Wave5 source behavior.

Future planning topics:

- When to run and record real-device/manual verification evidence.
- Persistent Model Mapping Profile storage and Runtime Export fingerprint.
- Dedicated Model / Stage / Diagnostics pages.
- Stage Window display operations such as always-on-top, click-through, hide control, and preview background.
- Body Follow / head-position Stage Motion.
