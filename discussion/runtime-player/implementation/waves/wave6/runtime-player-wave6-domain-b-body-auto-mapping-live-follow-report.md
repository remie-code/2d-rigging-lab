# Runtime Player Wave6 Domain B Report: Body Auto Mapping + Live Follow

> Target: `runtime-player-wave6-body-auto-mapping-live-follow`  
> Verdict: pass  
> Scope: Body X/Z semantic slots, body auto mapping, Mapping UI body controls, main-owned Body Follow smoothing state, sanitized body runtime parameter values, reset hooks, focused tests.

## Files Changed

Preload / typed mapping contract:

- `apps/runtime-player/src/preload/model-mapping-bridge-contract.ts`

Main live mapping:

- `apps/runtime-player/src/main/live-mapping/semantic-slot-definitions.ts`
- `apps/runtime-player/src/main/live-mapping/runtime-export-auto-mapping.ts`
- `apps/runtime-player/src/main/live-mapping/runtime-parameter-frame.ts`
- `apps/runtime-player/src/main/live-mapping/body-follow-state.ts`
- `apps/runtime-player/src/main/live-mapping/live-mapping-state.ts`
- `apps/runtime-player/src/main/model-mapping-bridge-request-validation.ts`
- `apps/runtime-player/src/main/model-mapping-bridge-handlers.ts`

Main reset integration:

- `apps/runtime-player/src/main/runtime-player-main.ts`
- `apps/runtime-player/src/main/input-bridge-handlers.ts`
- `apps/runtime-player/src/main/input-session-state.ts`

Control UI:

- `apps/runtime-player/src/control/mapping-page.tsx`

Focused tests:

- `apps/runtime-player/src/main/live-mapping/runtime-export-auto-mapping.test.ts`
- `apps/runtime-player/src/main/live-mapping/runtime-parameter-frame.test.ts`
- `apps/runtime-player/src/main/input-session-state.test.ts`

Report:

- `discussion/runtime-player/implementation/waves/wave6/runtime-player-wave6-domain-b-body-auto-mapping-live-follow-report.md`

Note: the working tree also contains pre-existing Domain A changes in adjacent Runtime Player files. This Domain B implementation did not revert them.

## Body Slot Behavior

Auto Mapping now creates 11 semantic slots:

- Existing Wave5 slots remain: 3 head, 4 eyes, 2 mouth.
- New body slots:
  - `body-x` / `Body X` / group `body`
  - `body-z` / `Body Z` / group `body`

Body targets are selected only from direct authored external-input parameters. Computed dynamics outputs, hidden direct controls, read-only targets, runtime-internal targets, and manifest-excluded targets remain excluded.

Body target aliases:

- Body X: `Body Angle X`, `body.angle.x`, `param_body_angle_x`
- Body Z: `Body Angle Z`, `body.angle.z`, `param_body_angle_z`

Missing body targets produce `missing-target` body slots and do not block existing head / eyes / mouth mapping.

## Body Controls Summary

Mapping UI now includes a `Body` group whenever body slots exist, including missing body slots after Auto Map.

Body X controls:

- Enabled toggle.
- Invert toggle.
- Strength slider, default `35%`.
- Lag slider, default `75%`.

Body Z controls:

- Enabled toggle.
- Rotation strength slider, default `25%`.
- Rotation invert toggle.
- Position strength slider, default `40%`.
- Position invert toggle.
- Lag slider, default `75%`.

Controls are session-local mapping state only. No persistent Model Mapping Profile save/read was added.

## Body Follow Formula

Body Follow is main-owned and emits only sanitized `RuntimePlayerLiveParameterFrame.parameterValues` to Stage.

Body X:

```text
headHorizontalNormalized =
  centered(head.rotationEulerDeg[faceRight.axis],
           sessionNeutral.headRotationEulerDeg,
           profile.headRotationEulerDeg,
           faceRight.direction)

bodyXTarget =
  mapToTargetRange(headHorizontalNormalized * invert * strength)
```

Defaults:

- strength: `0.35`
- lag smoothing: `0.75`

Body Z:

```text
rotationComponent =
  centered(head.rotationEulerDeg[tiltRight.axis],
           sessionNeutral.headRotationEulerDeg,
           profile.headRotationEulerDeg,
           tiltRight.direction)
  * rotationInvert
  * rotationStrength

positionComponent =
  centered(head.positionRaw[bodyRight.axis],
           sessionNeutral.headPositionRaw,
           profile.headPositionRaw,
           bodyRight.direction)
  * positionInvert
  * positionStrength

bodyZTarget =
  mapToTargetRange(clamp(rotationComponent + positionComponent, -1, 1))
```

Defaults:

- rotation strength: `0.25`
- position strength: `0.40`
- lag smoothing: `0.75`

If `head.positionRaw` or `inputProfile.calibration.headPositionRaw` is missing, the Body Z position component is skipped. The rotation component and all existing head / eyes / mouth slots continue to work.

All body outputs pass through the same finite-value and target-range clamp path as existing live parameters.

## Reset Behavior

`RuntimePlayerBodyFollowState` stores transient per-body-slot smoothed target values in main. First value after reset uses the current target directly; later frames apply:

```text
next = previous + (target - previous) * (1 - smoothing)
```

Reset hooks implemented:

- Runtime Export changing / loaded / cleared.
- Auto-map regeneration.
- Mapping slot update.
- Input profile action path, including profile selection, temporary defaults, Look Forward, calibration save, and calibration-session actions.
- Input connect / reconnect.
- Input disconnect.

Input disconnect also clears the latest live-rate tracking frame from `RuntimePlayerInputSessionState`, preventing later mapping/profile actions from republishing stale disconnected input.

## Verification

No `pnpm install` was run.

Focused Runtime Player Vitest:

```text
pnpm.cmd exec vitest run -c vitest.config.ts src/main/live-mapping/runtime-export-auto-mapping.test.ts src/main/live-mapping/runtime-parameter-frame.test.ts
```

Result:

- First sandboxed run failed before tests with `Error: spawn EPERM` while starting the esbuild service.
- Re-run with escalated execution: pass, 2 files / 12 tests.

Additional focused reset rerun:

```text
pnpm.cmd exec vitest run -c vitest.config.ts src/main/live-mapping/runtime-export-auto-mapping.test.ts src/main/live-mapping/runtime-parameter-frame.test.ts src/main/input-session-state.test.ts
```

Result:

- Escalated run: pass, 3 files / 18 tests.

Runtime Player typecheck:

```text
pnpm.cmd typecheck
```

Result: pass.

Runtime Player unit suite:

```text
pnpm.cmd test:unit
```

Result:

- First sandboxed run failed before tests with `Error: spawn EPERM` while starting the esbuild service.
- Re-run with escalated execution: pass, 26 files / 114 tests.

Source organization guard:

```text
node scripts/check-source-organization.mjs
```

Result: pass.

Dependency guard:

```text
node scripts/check-dependencies.mjs
```

Result: pass.

Whitespace check:

```text
git diff --check -- apps/runtime-player/src discussion/runtime-player/implementation/waves/wave6
```

Result: pass, with Git LF-to-CRLF working-copy warnings only.

## Manual Verification Notes

Not performed in this implementation context:

- Launch Electron Runtime Player and inspect the Mapping page Body group.
- Load a Runtime Export with authored `Body Angle X` / `Body Angle Z` keyforms.
- Connect real iFacialMocap input and verify clean Stage body motion.
- Tune Body X/Z strengths with a real model and camera posture.

Manual expected behavior:

- Existing face / eyes / mouth motion remains active.
- Missing body targets show as Missing in Mapping but do not block live face motion.
- Body X follows head horizontal weakly and with lag.
- Body Z follows head tilt plus lateral head-position movement when head position calibration exists.
- Stage remains model-only and receives no raw tracking/head-position/debug body data.

## Remaining Issues

- Default Body X/Z strengths and lag are source/test validated but not real-device tuned.
- Body Z position component depends on Domain A head-position calibration quality.
- Body Angle Y, Stage scale/translation, near/far distance effects, Broadcast/OBS UX, persistent Model Mapping Profile save/read, advanced curve editing, TCP/VMC/OSC transport, and Stage debug UI remain out of scope.

## User Decision Points

None required for Domain B source behavior.

Future tuning decisions:

- Whether Body X default strength `35%`, Body Z rotation `25%`, Body Z position `40%`, and lag `75%` should change after real-device visual testing.
- Whether Body Follow controls should later move into a persistent Model Mapping Profile once that feature is designed.
