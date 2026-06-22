# Runtime Player Wave6 Domain B Spec Compliance Review

> Target: `runtime-player-wave6-body-auto-mapping-live-follow`  
> Reviewer lane: Spec Compliance Review  
> Verdict: `pass`

## Scope Reviewed

Reviewed the Domain B implementation source and focused tests directly:

- `apps/runtime-player/src/preload/model-mapping-bridge-contract.ts`
- `apps/runtime-player/src/control/mapping-page.tsx`
- `apps/runtime-player/src/control/control-window-formatters.ts`
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
- `apps/runtime-player/src/main/live-parameter-bridge-handlers.ts`
- `apps/runtime-player/src/preload/live-parameter-bridge-contract.ts`
- Stage live-frame consumption spot check:
  - `apps/runtime-player/src/stage/stage-window-app.tsx`
  - `apps/runtime-player/src/stage/stage-renderer/static-stage-canvas-renderer.ts`
- Tests:
  - `apps/runtime-player/src/main/live-mapping/runtime-export-auto-mapping.test.ts`
  - `apps/runtime-player/src/main/live-mapping/runtime-parameter-frame.test.ts`
  - `apps/runtime-player/src/main/input-session-state.test.ts`

## Basis Documents Used

- `discussion/runtime-player/implementation/orchestration/player-wave6-plan.md`
- `discussion/runtime-player/implementation/waves/wave6/runtime-player-wave6-domain-b-body-auto-mapping-live-follow-report.md`
- `discussion/runtime-player/screens/tracking-setup-live-mapping.md`
- `discussion/runtime-player/screens/control-window-screen-structure.md`
- `discussion/runtime-player/screens/initial-runtime-player-screen.md`
- `discussion/runtime-player/architecture/tracking-input-mapping-baseline.md`
- `discussion/runtime-player/implementation/waves/wave6/runtime-player-wave6-domain-a-input-profile-position-calibration-report.md`
- `discussion/_conventions.md`
- `discussion/_map.md`

## Findings Ordered By Severity

No blocking or needs-change spec compliance findings.

Evidence:

- The mapping contract now includes only `body-x` and `body-z` in addition to the existing nine Wave5 slots, and the slot group union includes `body` (`apps/runtime-player/src/preload/model-mapping-bridge-contract.ts:1`, `apps/runtime-player/src/preload/model-mapping-bridge-contract.ts:18`).
- Body control fields are present in the preload contract and update request shape: `bodyRotationStrength`, `bodyPositionStrength`, `bodyRotationInvert`, and `bodyPositionInvert` (`apps/runtime-player/src/preload/model-mapping-bridge-contract.ts:43`, `apps/runtime-player/src/preload/model-mapping-bridge-contract.ts:75`).
- Body X/Z semantic definitions map to `Body Angle X` / `body.angle.x` / `param_body_angle_x` and `Body Angle Z` / `body.angle.z` / `param_body_angle_z`; no Body Angle Y slot or alias is defined (`apps/runtime-player/src/main/live-mapping/semantic-slot-definitions.ts:135`, `apps/runtime-player/src/main/live-mapping/semantic-slot-definitions.ts:147`).
- Auto Mapping still filters to direct authored external-input targets and excludes read-only, computed dynamics output, hidden direct controls, and manifest-excluded parameters (`apps/runtime-player/src/main/live-mapping/runtime-export-auto-mapping.ts:52`, `apps/runtime-player/src/main/live-mapping/runtime-export-auto-mapping.ts:71`).
- Missing body targets become `missing-target` slots with warnings and do not prevent the existing head/eyes/mouth slots from being present (`apps/runtime-player/src/main/live-mapping/runtime-export-auto-mapping.ts:21`, `apps/runtime-player/src/main/live-mapping/runtime-export-auto-mapping.ts:44`, `apps/runtime-player/src/main/live-mapping/runtime-export-auto-mapping.test.ts:204`).
- Mapping UI routes body slots to a body-specific row and exposes Enabled, Body X Invert/Strength/Lag, and Body Z Rotation invert/strength, Position invert/strength, and Lag controls (`apps/runtime-player/src/control/mapping-page.tsx:138`, `apps/runtime-player/src/control/mapping-page.tsx:283`, `apps/runtime-player/src/control/mapping-page.tsx:309`, `apps/runtime-player/src/control/mapping-page.tsx:359`).
- Live readiness does not treat missing targets as fatal; it requires a ready mapping state and at least one enabled/mapped slot, while the Auto Mapping label separately reports missing count (`apps/runtime-player/src/control/control-window-formatters.ts:245`, `apps/runtime-player/src/control/control-window-formatters.ts:267`, `apps/runtime-player/src/control/control-window-formatters.ts:278`).
- Body X uses the calibrated head horizontal sign/range path and applies Body X strength/invert before smoothing (`apps/runtime-player/src/main/live-mapping/runtime-parameter-frame.ts:281`, `apps/runtime-player/src/main/live-mapping/runtime-parameter-frame.ts:294`, `apps/runtime-player/src/main/live-mapping/runtime-parameter-frame.ts:425`).
- Body Z composes a calibrated head tilt rotation component and an optional calibrated `head.positionRaw` component, with separate strengths and inversion; missing position input or calibration returns `null` only for the position component (`apps/runtime-player/src/main/live-mapping/runtime-parameter-frame.ts:312`, `apps/runtime-player/src/main/live-mapping/runtime-parameter-frame.ts:342`, `apps/runtime-player/src/main/live-mapping/runtime-parameter-frame.ts:373`).
- Generated values skip missing/disabled/non-finite slot output and clamp emitted values to target min/max before adding them to sanitized live parameter frames (`apps/runtime-player/src/main/live-mapping/runtime-parameter-frame.ts:28`, `apps/runtime-player/src/main/live-mapping/runtime-parameter-frame.ts:50`, `apps/runtime-player/src/main/live-mapping/runtime-parameter-frame.ts:54`).
- Body follow smoothing is main-owned transient state with deterministic reset support (`apps/runtime-player/src/main/live-mapping/body-follow-state.ts:7`, `apps/runtime-player/src/main/live-mapping/body-follow-state.ts:10`, `apps/runtime-player/src/main/live-mapping/body-follow-state.ts:14`).
- Reset hooks cover runtime export changing/loaded/cleared, input reset, input profile actions, Auto Map regeneration, and mapping slot updates (`apps/runtime-player/src/main/runtime-player-main.ts:33`, `apps/runtime-player/src/main/runtime-player-main.ts:42`, `apps/runtime-player/src/main/runtime-player-main.ts:60`, `apps/runtime-player/src/main/model-mapping-bridge-handlers.ts:104`, `apps/runtime-player/src/main/model-mapping-bridge-handlers.ts:119`).
- Input reconnect/disconnect clears body follow state through `onInputReset`, and session state clears latest live-rate tracking data on listening/idle transitions (`apps/runtime-player/src/main/input-bridge-handlers.ts:81`, `apps/runtime-player/src/main/input-bridge-handlers.ts:123`, `apps/runtime-player/src/main/input-session-state.ts:147`, `apps/runtime-player/src/main/input-session-state.ts:192`).
- Stage receives `RuntimePlayerLiveParameterFrame` whose cross-window contract contains `parameterValues` and runtime export identity, not raw tracking/head-position/debug body data; Stage passes only `liveFrame.parameterValues` into runtime-core evaluation (`apps/runtime-player/src/preload/live-parameter-bridge-contract.ts:1`, `apps/runtime-player/src/main/live-parameter-bridge-handlers.ts:22`, `apps/runtime-player/src/stage/stage-renderer/static-stage-canvas-renderer.ts:209`).
- Focused tests cover body auto mapping, body alias fallback, target exclusion, Body X/Z generation, component strengths/inversion, finite/clamped output, missing head position calibration, smoothing reset, and disconnect stale-frame clearing (`apps/runtime-player/src/main/live-mapping/runtime-export-auto-mapping.test.ts:12`, `apps/runtime-player/src/main/live-mapping/runtime-export-auto-mapping.test.ts:97`, `apps/runtime-player/src/main/live-mapping/runtime-parameter-frame.test.ts:156`, `apps/runtime-player/src/main/live-mapping/runtime-parameter-frame.test.ts:194`, `apps/runtime-player/src/main/live-mapping/runtime-parameter-frame.test.ts:225`, `apps/runtime-player/src/main/live-mapping/runtime-parameter-frame.test.ts:255`, `apps/runtime-player/src/main/live-mapping/runtime-parameter-frame.test.ts:284`, `apps/runtime-player/src/main/input-session-state.test.ts:120`).

## Spec Compliance Summary

- `body` group contract: compliant. Existing head/eyes/mouth slots remain in the same semantic definition list and body slots are additive.
- Body X/Z mapping: compliant. Body X and Body Z use the required aliases/display names/parameter-id fallbacks; no Body Angle Y mapping is present in reviewed Domain B files.
- Missing body targets: compliant. Missing body parameters produce missing body slots and do not block live readiness when other mapped slots exist.
- Mapping UI controls: compliant. Body X has enabled, invert, strength, and lag. Body Z has enabled, rotation strength/invert, position strength/invert, and lag.
- Runtime body parameter generation: compliant. Body X uses calibrated head horizontal input. Body Z combines calibrated head tilt and optional calibrated `head.positionRaw` lateral input.
- Missing head position calibration: compliant. The Body Z position component is skipped; rotation and existing face/mouth paths continue.
- Sanitized output: compliant. Non-finite values are skipped and emitted values are clamped into target ranges before Stage publication.
- Reset triggers: compliant for the implemented plan. Runtime export, mapping, profile/calibration actions, Look Forward, and input reconnect/disconnect paths reset body smoothing state.
- Main/control/stage ownership: compliant for this lane. Main owns derived body follow state and Stage consumes sanitized parameter values through runtime-core.

## Forbidden-Scope Checks

No forbidden Wave6 Domain B scope was found in reviewed files.

- No Body Angle Y / `body.angle.y` / `param_body_angle_y` / `body-y` mapping was found.
- No Stage scale/translation from head position was added in the reviewed Domain B source. Existing Stage view transform/pan/zoom code is outside this body-follow mapping path and does not consume tracking head position.
- No near/far distance effect was found.
- No advanced curve editor was found.
- No persistent Model Mapping Profile save/read was found; mapping remains session-local.
- No Stage debug UI or raw body diagnostics panel was added.
- No Broadcast/OBS, TCP, VMC, or OSC behavior was added.

Read-only keyword searches for the forbidden terms over the Domain B changed files returned no matches except existing unrelated Stage/view wording outside the body-follow data path.

## Verification Performed

Read-only review commands performed in this lane:

- `Get-Content` on the basis documents and reviewed source/test files.
- `rg -n` and `Select-String` searches for body slots, aliases, controls, runtime formulas, reset hooks, sanitized live parameter paths, and forbidden-scope terms.
- Numbered source excerpts for `runtime-export-auto-mapping.ts`, `runtime-parameter-frame.ts`, `runtime-player-main.ts`, `model-mapping-bridge-handlers.ts`, `input-bridge-handlers.ts`, `input-session-state.ts`, and live parameter / Stage consumption paths.

I did not run `pnpm install`. I did not rerun Vitest/typecheck/unit/guard commands in this review lane; the Gnome-reported verification remains separate implementation evidence and was source/test-checked here for consistency with the spec.

## Remaining Issues / Manual Verification Gaps

- No spec-compliance issue remains for Domain B.
- Manual Electron/runtime verification remains open: inspect Mapping page body controls, load a Runtime Export with authored Body Angle X/Z keyforms, connect real iFacialMocap input, and confirm clean Stage body motion.
- Default Body X/Z strengths and lag are source/test-backed but still need real-device visual tuning.
- Body Z position quality depends on Domain A head-position calibration quality and real-device camera posture.

## User-Decision Points

None required for Domain B spec compliance.

Future non-blocking tuning decisions after manual testing:

- Whether the default Body X strength `35%`, Body Z rotation strength `25%`, Body Z position strength `40%`, and lag `75%` should be adjusted.
- Whether Body Follow controls should later become part of a persistent Model Mapping Profile after that feature is explicitly designed.
