# Runtime Player Wave6 Domain A Report: Input Profile Position Calibration

> Target: `runtime-player-wave6-input-profile-position-calibration`  
> Verdict: pass  
> Scope: Input Profile schema compatibility, head position calibration capture, missing-only / head-position-only calibration flow, Look Forward head position neutral, Control Input UX, focused tests.

## Files Changed

Preload / typed contract:

- `apps/runtime-player/src/preload/input-profile-bridge-contract.ts`

Main profile schema, parser, section state, calibration, and bridge:

- `apps/runtime-player/src/main/input-profiles/input-profile-document.ts`
- `apps/runtime-player/src/main/input-profiles/input-profile-document-parser.ts`
- `apps/runtime-player/src/main/input-profiles/input-profile-calibration-sections.ts`
- `apps/runtime-player/src/main/input-profiles/input-profile-calibration-start.ts`
- `apps/runtime-player/src/main/input-profiles/input-profile-calibration-session.ts`
- `apps/runtime-player/src/main/input-profile-bridge-request-validation.ts`
- `apps/runtime-player/src/main/input-profile-bridge-handlers.ts`
- `apps/runtime-player/src/main/input-session-state.ts`

Control UI:

- `apps/runtime-player/src/control/control-window-app.tsx`
- `apps/runtime-player/src/control/input-page.tsx`

Focused tests:

- `apps/runtime-player/src/main/input-profiles/input-profile-document-parser.test.ts`
- `apps/runtime-player/src/main/input-profiles/input-profile-calibration-sections.test.ts`
- `apps/runtime-player/src/main/input-profiles/input-profile-calibration-start.test.ts`
- `apps/runtime-player/src/main/input-profiles/input-profile-calibration-session.test.ts`
- `apps/runtime-player/src/main/input-profile-bridge-request-validation.test.ts`
- `apps/runtime-player/src/main/input-look-forward-session-neutral.test.ts`

Report:

- `discussion/runtime-player/implementation/waves/wave6/runtime-player-wave6-domain-a-input-profile-position-calibration-report.md`

## Profile Schema And Compatibility

The stored document schema version remains `runtime-player-input-profiles-v1`.

`InputProfileCalibration` now supports an optional `calibration.headPositionRaw` section:

```text
headPositionRaw:
  neutral: TrackingVector3
  min: TrackingVector3
  max: TrackingVector3
  learnedSigns:
    bodyLeft?: { axis, direction }
    bodyRight?: { axis, direction }
```

Backward compatibility behavior:

- Existing saved profiles without `headPositionRaw` still parse and load.
- Missing `headPositionRaw` is reported as only the `Head position left/right` section missing.
- Existing `headRotationEulerDeg`, `eyes`, and `mouth` sections remain required. Profiles with invalid required sections are still skipped.
- If `headPositionRaw` is present but malformed, the profile is skipped as invalid calibration data, matching the existing parser's behavior for malformed calibration sections.
- Temporary defaults continue to provide head rotation / eyes / mouth defaults and are marked with missing head position calibration rather than silently claiming body-position readiness.

## Calibration And Recalibration UX

The Input Profile card now shows section readiness:

- `Head rotation`: `Ready` / `Missing`
- `Eyes / mouth`: `Ready` / `Missing`
- `Head position left/right`: `Ready` / `Missing`

Added actions:

- `Run Missing Only`
  - For an old saved profile missing only head position, starts only `look-forward`, `head-position-left`, and `head-position-right`.
  - Saving updates the existing active profile, preserving profile id, display name, source, transport, and created timestamp.
  - If no saved editable profile exists, it starts a full calibration session so missing/new profile cases still have a complete path.
- `Full Calibration`
  - Runs the full guided calibration prompt set and creates a saved profile as before.
- Head position row `Calibrate` / `Recalibrate`
  - Starts an individual head position section calibration for the saved active profile.
  - Disabled unless the active profile is a saved profile.

No Body Auto Mapping, body runtime parameter generation, Stage Motion, Broadcast/OBS behavior, Model Mapping Profile persistence, TCP/VMC/OSC, or advanced curve editor behavior was added.

## Head Position Storage

Head position samples use normalized tracking frame `head.positionRaw`, with lateral calibration based on `head.positionRaw.x`.

Full and head-position-only sessions record:

- Neutral: captured from the `look-forward` prompt.
- Range: observed min/max of `head.positionRaw` across the session.
- Signs:
  - `bodyLeft`: learned from the `head-position-left` prompt.
  - `bodyRight`: learned from the `head-position-right` prompt.

The prompt acceptance threshold for lateral position is `0.05` raw units on the `x` axis. This is intentionally narrow for Wave6 and can be tuned later from real-device evidence if needed.

`Look Forward` session neutral now includes `headPositionRaw` when the latest normalized frame has it. This remains session-local and does not overwrite the saved profile.

## Verification

No `pnpm install` was run.

Implementation-review fix note:

- Fixed Test Adequacy finding 1 by making `headPositionRaw` readiness explicit. A present head position section is ready only when neutral/min/max are finite and both `learnedSigns.bodyLeft` and `learnedSigns.bodyRight` are usable. The parser now skips profiles with present but incomplete/invalid head position signs, and section status reports incomplete in-memory head position data as `Missing`.
- Fixed Test Adequacy finding 2 by adding a store-level old-profile upgrade persistence test. It exercises the missing-only start path, section session finish/update logic, and `InputProfileStore.saveProfile`, proving the same `profileId`, `activeProfileId`, existing head rotation/eyes/mouth calibration, and created timestamp are preserved while adding `headPositionRaw`.

Focused Runtime Player Vitest:

```text
pnpm.cmd exec vitest run -c vitest.config.ts src/main/input-profiles/input-profile-document-parser.test.ts src/main/input-profiles/input-profile-calibration-sections.test.ts src/main/input-profiles/input-profile-calibration-start.test.ts src/main/input-profiles/input-profile-calibration-session.test.ts src/main/input-profile-bridge-request-validation.test.ts src/main/input-look-forward-session-neutral.test.ts
```

Result:

- First sandboxed run failed before tests with `Error: spawn EPERM` while starting the esbuild service.
- Re-run with escalated execution after final start-policy split: pass, 6 files / 19 tests.
- Narrow fix rerun: first sandboxed run again failed before tests with `Error: spawn EPERM`; escalated rerun passed, 6 files / 24 tests.

Runtime Player typecheck:

```text
pnpm.cmd typecheck
```

Result:

- First run found a local `Map` inference error in `input-profile-calibration-session.ts`; fixed.
- Final run: pass.
- Narrow fix rerun: pass.

Runtime Player unit suite:

```text
pnpm.cmd test:unit
```

Result after final start-policy split: pass, 26 files / 102 tests.

Narrow fix rerun: pass, 26 files / 107 tests.

Runtime Player build:

```text
pnpm.cmd build
```

Result: pass.

Narrow fix note: build was not rerun in the narrow fix loop because the requested verification set was focused tests, typecheck, unit suite, and guards.

Source organization guard:

```text
node scripts/check-source-organization.mjs
```

Result: pass.

Narrow fix rerun: pass.

Dependency guard:

```text
node scripts/check-dependencies.mjs
```

Result: pass.

Narrow fix rerun: pass.

Whitespace check:

```text
git diff --check -- apps/runtime-player/src discussion/runtime-player/implementation/waves/wave6
```

Result: pass, with Git LF-to-CRLF working-copy warnings only.

## Remaining Integration Points For Domain B

- Consume optional `inputProfile.calibration.headPositionRaw` when computing Body Z position component.
- Treat missing head position calibration as Body Z position component unavailable, without blocking existing head / eyes / mouth live mapping.
- Use `learnedSigns.bodyLeft` / `bodyRight` and `neutral/min/max.x` for lateral position normalization.
- Decide how Body Follow readiness is reflected in Mapping/Overview without making missing body targets or missing head position look like fatal face-tracking errors.
- Reset body follow transient smoothing state on input profile change and calibration save.

## Remaining Issues

- Real Control Window interaction was not manually exercised in Electron during this domain.
- Real iFacialMocap head-position calibration was not manually recorded in this domain.
- The head position lateral threshold is source/test validated but not real-device tuned.

## User Decision Points

None for Domain A.

## Out-Of-Scope Edits Needed But Not Made

None.
