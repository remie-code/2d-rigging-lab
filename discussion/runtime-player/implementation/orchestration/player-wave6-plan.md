# Runtime Player Wave 6 Plan: Body Follow v0

> Runtime Player Wave6は、Wave5で成立したiFacialMocap live mappingの上に、head rotation / head positionから`Body Angle X/Z`を推定するBody Followを追加する。目的は「首から上だけが自然に動く違和感」を減らし、Stage上のモデルがより配信用に自然に見える状態へ近づけることである。Broadcast-ready StageやOBS連携はまだ扱わない。

## 1. Status

- Status: Planned / ready for orchestration
- Target wave: Runtime Player Wave6
- Wave name: `runtime-player-body-follow-v0`
- Primary objective:
  - 既存Input Profileにhead position left/right calibrationを追加できる。
  - 既存profileでは、未設定項目だけを追加キャリブレーションできる。
  - Auto Mappingに`body` groupを追加し、`Body Angle X`と`Body Angle Z`を標準targetへ割り当てられる。
  - `Body Angle X`は既存head horizontal calibration由来で弱く遅れて追従する。
  - `Body Angle Z`はhead tilt(rotationZ)成分とhead positionX成分を合成できる。
  - Mapping画面でBody Followの主要成分strengthをスライダーで調整できる。
  - Stage Windowは引き続きmodel-onlyで、body follow結果だけがruntime parameter valuesとして反映される。

## 2. Planning Gate Result

Planning Gate result: `Plan directly`.

Why planning is now safe:

- Runtime Player Wave5は完了し、ユーザー実機でiFacialMocap接続、guided calibration、Auto Mapping、Stage live motionが動作確認済み。
- ユーザー実機では、顔・目・口のlive motionは想定以上に自然に見える一方、体が静止する違和感が大きいことが確認済み。
- Sylph調査で、標準Body parametersが`Body Angle X/Y/Z`として存在し、Runtime Export/keyform/runtime-core経由で評価されることが確認済み。
- Sylph調査で、現在のAuto Mappingは`head / eyes / mouth`の9 slotsのみで、body semantic slotが未実装であることが確認済み。
- `test_data/iFaceMocap/`に7姿勢の実機diagnostics sampleがあり、`Body Z`向けに`head.positionRaw.x`が有望であることを確認済み。

Uncertainty:

- factual: low. 実装上のbody parameterとtracking frame availabilityは確認済み。
- decision: low. Wave6 scopeと除外範囲はユーザー合意済み。
- cost of wrong plan: medium. body followの責務をStage MotionやBroadcastに混ぜると後続UXが歪む。

Precondition:

- Runtime Player Wave5 source exists and launches.
- User has run `pnpm install` if package dependencies changed before this wave. Agents must not run `pnpm install`.
- No new dependency should be added unless explicitly justified and escalated.

## 3. Accepted Decisions / Oracles

### 3.1 Wave6 Gate Is Natural Body Follow

Required:

- iFacialMocap live input can drive `Body Angle X` and `Body Angle Z` when the loaded Runtime Export has matching body parameters/keyforms.
- Body follow is visible on the clean Stage Window through runtime-core evaluation.
- Body follow does not require Broadcast/OBS setup.
- Body follow does not add Stage debug UI.

Forbidden:

- Broadcast-ready Stage / OBS capture UX.
- Stage scale/translation from head position.
- Body Angle Y.
- TCP/VMC/OSC transport.
- Persistent Model Mapping Profile save.
- Advanced curve editor.
- Direct manipulation of Runtime Export files.

### 3.2 Body Parameter Scope

Required targets:

| Body output | Standard target aliases | Range expectation | Wave6 source |
|---|---|---:|---|
| Body horizontal follow | `Body Angle X` / `body.angle.x` / `param_body_angle_x` | `-10..10` | head horizontal calibration |
| Body tilt follow | `Body Angle Z` / `body.angle.z` / `param_body_angle_z` | `-10..10` | head tilt + head positionX |

Out of scope:

- `Body Angle Y`.
- Body position parameters. No built-in body position presets exist today.
- Body rotation parameters other than the existing Body Angle presets.

### 3.3 Body X Mapping

`Body Angle X` is derived from the same semantic head horizontal direction as `Face Angle X`.

Required behavior:

- Use existing head rotation calibration and learned sign.
- Use a conservative default strength lower than face movement.
- Apply smoothing/lag so the body follows the head with a slight delay.
- Clamp output to the target parameter range.

Reasoning:

- Body X has no reliable independent body signal from iFacialMocap.
- Head horizontal rotation is the most defensible source.
- Direct one-to-one follow feels rigid; weaker delayed follow feels more body-like.

### 3.4 Body Z Mapping

`Body Angle Z` is a composed body follow output:

```text
Body Angle Z =
  headTiltRotationZComponent
+ headPositionXComponent
```

Required behavior:

- Rotation component uses existing head tilt calibration.
- Position component uses head position left/right calibration.
- Rotation strength and position strength are separate sliders in Mapping.
- Each component can be inverted independently when needed.
- Combined output is smoothed/lagged and clamped to the target parameter range.

Reasoning:

- `head rotation z` captures head tilt.
- `head.positionRaw.x` better captures upper-body lateral movement in the provided samples.
- A combined signal is more natural than either source alone.

### 3.5 Head Position Calibration

Head position calibration is Input Profile data, not model mapping data.

Required persistent data:

- head position neutral.
- observed min/max for position axes used by Wave6.
- learned signs for lateral body-left/body-right prompts.

Required prompts:

- Look forward / neutral position.
- Lean or move upper body left.
- Lean or move upper body right.

Accepted simplification:

- Wave6 only uses the lateral position axis needed for Body Z.
- `near_camera` / `far_camera` samples are not used for Body Follow v0. They remain future Stage scale/translation evidence.

### 3.6 Existing Profile Recalibration UX

Existing Input Profiles must remain usable.

Required:

- Profile UI shows calibration sections and whether each section is `Ready` or `Missing`.
- Existing profiles missing head position calibration do not break live mapping.
- User can run only missing calibration items.
- User can recalibrate the head position section without redoing head rotation, eyes, or mouth.
- Full recalibration may exist, but it must not be the only path.

Recommended UX:

```text
Input Profile
  Head rotation                 Ready      Recalibrate
  Eyes / mouth                  Ready      Recalibrate
  Head position left/right      Missing    Calibrate

[ Run missing only ] [ Full recalibration ]
```

### 3.7 Mapping UI Controls

Body controls should match the existing Mapping screen style.

Required:

- Body group appears in Mapping after Auto Map when body targets exist.
- Main controls are sliders/toggles, not freeform debug numbers.
- `Body Angle X` has at least body follow strength and lag/smoothing controls.
- `Body Angle Z` has separate rotation strength and position strength sliders.
- Body slots can be disabled.
- Missing body targets are visible as unmapped/missing without blocking head/eyes/mouth mapping.

Allowed:

- A compact body section if space is tight.
- Simple numeric value display next to sliders if consistent with existing mapping UI.

Forbidden:

- Raw diagnostics-only tuning UX.
- Large debug panels on Stage.
- Requiring users to copy diagnostics for normal body follow setup.

### 3.8 Runtime State Ownership

Required:

- main process owns body follow derived state and emits sanitized runtime parameter values.
- Stage receives only parameter values and minimal runtime export metadata.
- Stage continues to evaluate through runtime-core.

Body follow smoothing/lag requires transient state.

Reset triggers:

- Runtime Export load/reload/clear.
- Mapping change.
- Input profile change.
- Calibration save.
- Look Forward.
- input disconnect/reconnect when needed for stability.

### 3.9 Diagnostics And Visibility

Required:

- Overview/Mapping can indicate Body Follow readiness.
- Body follow absence or missing body target is not a fatal error.
- Existing `info` runtime diagnostics must not be promoted to scary warning panels if they do not affect runtime correctness.

Allowed:

- Input page may expose head position calibration status.
- Debug diagnostics may retain raw `head.positionRaw` values for troubleshooting.

### 3.10 Documentation Alignment

Final integration must update Runtime Player docs and maps to match implementation facts.

Required basis:

- [Runtime Player Wave Planning Conventions](runtime-player-wave-planning-conventions.md)

## 4. Primary Basis

Runtime Player UX/design basis:

- [Initial Runtime Player Screen](../../screens/initial-runtime-player-screen.md)
- [Control Window Screen Structure](../../screens/control-window-screen-structure.md)
- [Tracking Setup / Live Mapping UX](../../screens/tracking-setup-live-mapping.md)
- [Runtime Player Technology Stack Decision](../../architecture/technology-stack-decision.md)
- [Runtime Player Development Policy](../../architecture/runtime-player-development-policy.md)
- [Tracking Input Mapping Baseline](../../architecture/tracking-input-mapping-baseline.md)
- [iFacialMocap Input Adapter Research](../../research/ifacialmocap-input-adapter-research.md)
- [Runtime Player Backlog](../../backlog/runtime-player-backlog.md)
- [Runtime Player Wave Planning Conventions](runtime-player-wave-planning-conventions.md)

Implementation fact basis:

- [Runtime Player Wave5 Final Integration Report](../waves/wave5/runtime-player-wave5-final-integration-report.md)
- [Runtime Player Wave5 Final Clean Integration Review](../reviews/wave5/runtime-player-wave5-final-clean-integration-review.md)

Empirical basis:

- `test_data/iFaceMocap/01_forward.json`
- `test_data/iFaceMocap/02_head_left.json`
- `test_data/iFaceMocap/03_head_right.json`
- `test_data/iFaceMocap/04_body_left.json`
- `test_data/iFaceMocap/05_body_right.json`
- `test_data/iFaceMocap/06_near_camera.json`
- `test_data/iFaceMocap/07_far_camera.json`

Observed sample summary:

```text
forward       PosX  0.048 / PosZ -0.725
head_left     PosX -0.015 / RotZ  27.7
head_right    PosX  0.071 / RotZ -25.2
body_left     PosX -0.184 / RotZ  22.2
body_right    PosX  0.335 / RotZ -36.2
near_camera   PosZ -0.468
far_camera    PosZ -1.038
```

Relevant current source:

- `apps/runtime-player/src/control/**`
- `apps/runtime-player/src/main/input-profiles/**`
- `apps/runtime-player/src/main/input-session-state.ts`
- `apps/runtime-player/src/main/live-mapping/**`
- `apps/runtime-player/src/main/model-mapping-bridge-handlers.ts`
- `apps/runtime-player/src/main/live-parameter-bridge-handlers.ts`
- `apps/runtime-player/src/preload/**`
- `apps/runtime-player/src/stage/**`
- `packages/package-format/src/parameter-presets.ts`
- `packages/runtime-core/**`

## 5. Wave Strategy

```text
Batch 1:
  Domain A: Input Profile Position Calibration + Recalibration UX

Batch 2:
  Domain B: Body Auto Mapping + Body Follow Runtime Parameter Generation

Batch 3:
  Domain C: Final Integration / Clean Review / Docs Alignment
```

Parallelism summary:

| Domain | Can run in parallel? | Reason |
|---|---:|---|
| A. Input Profile Position Calibration + Recalibration UX | No | Establishes profile schema, calibration status, session neutral, and head position learned signs needed by Body Z. |
| B. Body Auto Mapping + Body Follow Runtime Parameter Generation | No | Depends on Domain A head position calibration and touches overlapping mapping/profile contracts. |
| C. Final Integration / Clean Review / Docs Alignment | No | Depends on A/B completion and must review integrated behavior plus docs. |

Rationale:

- A and B both touch main/preload/control contracts, so parallel edits would create avoidable conflicts.
- Position calibration must exist before Body Z position component can be implemented correctly.
- Final integration must verify the complete body follow chain from profile to Stage render.

## 6. Acceptance Criteria

### 6.1 Input Profile Position Calibration

Required:

- Existing profile documents load safely even if they lack head position calibration.
- Profile document/schema supports head position neutral/range/signs.
- Input page shows head position calibration status.
- User can run missing-only calibration.
- User can recalibrate head position left/right without redoing all profile sections.
- `Look Forward` updates session neutral for head rotation and head position.
- Calibration save persists the head position section to `userData` profile storage.

### 6.2 Body Auto Mapping

Required:

- Auto Mapping includes a `body` group when body target parameters exist.
- `Body Angle X` maps to the standard body horizontal target.
- `Body Angle Z` maps to the standard body tilt target.
- Missing body targets are reported without blocking existing head/eyes/mouth slots.
- Computed/dynamics-owned/hidden/internal parameters remain excluded as direct mapping targets.

### 6.3 Body Follow Controls

Required:

- Mapping page shows body controls only when relevant body slots exist or are missing.
- `Body Angle X` has user-facing strength and smoothing/lag controls.
- `Body Angle Z` has separate rotation strength and position strength sliders.
- Component inversion can be toggled where needed.
- Body slots can be disabled.
- Controls remain compact and consistent with existing mapping UI.

### 6.4 Runtime Parameter Generation

Required:

- Body X output uses calibrated head horizontal input.
- Body Z output combines calibrated head tilt and calibrated head positionX.
- Outputs are finite and clamped to target parameter ranges.
- Body follow smoothing/lag state is deterministic and resets on defined reset triggers.
- Main emits body parameter values in the same sanitized live parameter frame path as Wave5.
- Stage receives no raw tracking frame and no debug body data.

### 6.5 Stage Live Confirmation

Required:

- Loaded Runtime Export with authored Body Angle keyforms visibly responds to Body Follow.
- Stage remains model-only.
- Existing head/eyes/mouth mapping continues to work.
- Existing dynamics behavior is not broken.

### 6.6 Verification

Required:

- Focused tests for head position profile parsing/backward compatibility.
- Focused tests for missing-only / section recalibration state logic.
- Focused tests for body auto mapping.
- Focused tests for Body X and Body Z parameter frame generation.
- Focused tests for smoothing/lag reset behavior.
- Typecheck.
- Runtime Player package tests.
- Source organization/dependency checks.
- Manual verification checklist for real iFacialMocap + Runtime Export with Body Angle keyforms.

## 7. Domain A: `runtime-player-wave6-input-profile-position-calibration`

Purpose:

- Extend Input Profile and Calibration UX so existing users can add head position left/right calibration without recreating their whole profile.

Allowed write scope:

- `apps/runtime-player/src/control/**`
- `apps/runtime-player/src/main/input-profiles/**`
- `apps/runtime-player/src/main/input-profile-bridge-handlers.ts`
- `apps/runtime-player/src/main/input-session-state.ts`
- `apps/runtime-player/src/main/input-bridge-handlers.ts`
- `apps/runtime-player/src/main/runtime-player-main.ts`
- `apps/runtime-player/src/preload/**`
- focused tests under `apps/runtime-player/**`
- focused reports/reviews under `discussion/runtime-player/implementation/**`

Forbidden write scope:

- `apps/editor/**`
- `packages/**` except if a narrow type export is discovered and escalated
- `node_modules/**`

Required implementation:

- Add backward-compatible profile schema fields for head position calibration.
- Add parser/default behavior for old profiles without head position fields.
- Add calibration section status: ready/missing.
- Add missing-only calibration flow.
- Add individual head position left/right calibration flow.
- Capture neutral/head position samples for left/right prompts.
- Learn lateral position sign and range.
- Extend `Look Forward` session neutral to include head position.
- Add focused tests for profile compatibility, calibration session behavior, and request validation.

Forbidden implementation:

- Body Auto Mapping and runtime body value generation.
- Stage Motion / scale / translation.
- Broadcast/OBS behavior.
- Persistent Model Mapping Profile.

Expected report:

- Files changed.
- Profile schema changes and backward compatibility behavior.
- Calibration/recalibration UX summary.
- How head position neutral/range/signs are stored.
- Verification performed.
- Remaining integration points for Domain B.

Early escape triggers:

- Existing profile store cannot be extended without breaking persisted Wave5 profiles.
- Head position calibration requires a product decision not covered by this plan.

## 8. Domain B: `runtime-player-wave6-body-auto-mapping-live-follow`

Purpose:

- Add body semantic slots, body follow controls, and live body parameter generation.

Dependencies:

- Domain A head position calibration/session neutral fields.

Allowed write scope:

- `apps/runtime-player/src/main/live-mapping/**`
- `apps/runtime-player/src/main/model-mapping-bridge-handlers.ts`
- `apps/runtime-player/src/main/live-parameter-bridge-handlers.ts`
- `apps/runtime-player/src/main/input-session-state.ts`
- `apps/runtime-player/src/preload/**`
- `apps/runtime-player/src/control/**`
- `apps/runtime-player/src/stage/**` only for narrow live-frame reset/compatibility fixes if needed
- focused tests under `apps/runtime-player/**`
- focused reports/reviews under `discussion/runtime-player/implementation/**`

Forbidden write scope:

- `apps/editor/**`
- broad `packages/**` changes unless escalated
- `node_modules/**`

Required implementation:

- Extend mapping slot contract/types to support `body` group.
- Add Body X and Body Z semantic definitions.
- Auto map body targets using standard body parameter aliases.
- Add body controls in Mapping UI.
- Add per-component Body Z controls: rotation strength and position strength.
- Add Body X conservative strength and smoothing/lag controls.
- Implement main-owned body follow state and reset triggers.
- Generate body parameter values in sanitized live parameter frames.
- Preserve existing head/eyes/mouth mapping behavior.
- Add focused tests for mapping, component strengths, inversion, clamping, finite output, smoothing/lag, and reset behavior.

Forbidden implementation:

- Body Angle Y.
- Stage scale/translation.
- near/far distance effect.
- advanced curve editor.
- persistent Model Mapping Profile save.
- Stage debug UI.

Expected report:

- Files changed.
- Body semantic slot behavior.
- Body controls summary.
- Body follow formula and reset behavior.
- Verification performed.
- Manual real-device verification notes.

Early escape triggers:

- Current mapping contract cannot represent component strengths without a broader redesign.
- Body follow state cannot be implemented without leaking raw tracking data into Stage.
- Runtime Export parameter metadata is insufficient to safely identify body targets.

## 9. Domain C: `runtime-player-wave6-final-integration-clean-review`

Purpose:

- Validate Wave6 as the first Runtime Player wave where head/body input drives authored body parameters, and update docs/maps to match implementation facts.

Allowed write scope:

- `discussion/runtime-player/implementation/waves/wave6/**`
- `discussion/runtime-player/implementation/reviews/wave6/**`
- `discussion/runtime-player/implementation/_map.md`
- `discussion/runtime-player/implementation/orchestration/_map.md`
- `discussion/runtime-player/screens/**`
- `discussion/runtime-player/backlog/**`
- `discussion/runtime-player/_map.md`
- narrow source/test fixes only if clean review requires them

Required checks:

- Domain A and Domain B reports exist.
- Review lanes exist and pass or explicitly escalate.
- Existing profiles without head position calibration remain usable.
- Missing-only recalibration works.
- Body Auto Mapping does not regress existing nine Wave5 slots.
- Body X and Body Z are generated through sanitized live parameter frames.
- Stage remains model-only.
- Stage Motion/Broadcast features were not accidentally added.
- Related docs/maps are updated to match implementation facts.

Expected final artifacts:

- `discussion/runtime-player/implementation/waves/wave6/runtime-player-wave6-domain-a-input-profile-position-calibration-report.md`
- `discussion/runtime-player/implementation/waves/wave6/runtime-player-wave6-domain-b-body-auto-mapping-live-follow-report.md`
- `discussion/runtime-player/implementation/waves/wave6/runtime-player-wave6-final-integration-report.md`
- `discussion/runtime-player/implementation/waves/wave6/_map.md`
- `discussion/runtime-player/implementation/reviews/wave6/runtime-player-wave6-domain-a-spec-compliance-review.md`
- `discussion/runtime-player/implementation/reviews/wave6/runtime-player-wave6-domain-a-design-development-review.md`
- `discussion/runtime-player/implementation/reviews/wave6/runtime-player-wave6-domain-a-test-adequacy-review.md`
- `discussion/runtime-player/implementation/reviews/wave6/runtime-player-wave6-domain-b-spec-compliance-review.md`
- `discussion/runtime-player/implementation/reviews/wave6/runtime-player-wave6-domain-b-design-development-review.md`
- `discussion/runtime-player/implementation/reviews/wave6/runtime-player-wave6-domain-b-test-adequacy-review.md`
- `discussion/runtime-player/implementation/reviews/wave6/runtime-player-wave6-final-clean-integration-review.md`
- `discussion/runtime-player/implementation/reviews/wave6/_map.md`

## 10. Review Policy

Each implemented domain requires three review lanes:

1. Spec Compliance Review
   - Check against this plan and Runtime Player screen/design docs.
2. Design / Development Compliance Review
   - Check Runtime Player Development Policy.
   - Check main/preload/control/stage boundaries, IPC/preload safety, file splitting, source organization, dependency scope.
3. Test Adequacy Review
   - Check focused unit/integration tests, typecheck, package tests, dependency/source checks, and manual verification instructions.

Reviewers must report `pass`, `needs_changes`, or `escalate`.

Blocking findings include:

- Stage receives raw tracking frame, raw head position, or debug body data.
- Body Follow bypasses runtime-core evaluation.
- Existing Wave5 head/eyes/mouth mapping regresses.
- Existing persisted Input Profiles fail to load.
- Missing head position calibration blocks normal face tracking.
- Body controls require raw diagnostics for normal use.
- Body Angle Y, Stage scale/translation, or Broadcast UX is added in Wave6.
- Agents run `pnpm install`.

## 11. Verification Matrix

| Requirement | Minimum evidence |
|---|---|
| Existing profiles without head position load safely | parser/store tests |
| Head position calibration can be added independently | calibration tests |
| Missing-only recalibration works | control/state tests |
| Look Forward updates position session neutral | session tests |
| Body Auto Mapping finds Body X/Z targets | mapping tests |
| Missing body targets do not block existing slots | mapping tests |
| Body X uses head horizontal source | parameter-frame tests |
| Body Z combines rotationZ and positionX strengths | parameter-frame tests |
| smoothing/lag state resets correctly | body-follow state tests |
| Stage receives sanitized parameter values only | source/review |
| Stage remains model-only | source/manual |
| real iFacialMocap moves body-authored Runtime Export | manual checklist |

## 12. Subagent Contract

Orch-Sylph instructions must include:

- Use this Runtime Player Wave6 plan as source of truth.
- Start with bounded current-state confirmation for Runtime Player Wave5 code.
- Delegate Domain A before Domain B.
- Delegate independent review to Review-Sylphs for each implemented domain.
- Wait for all started children.
- Treat `wait_agent` timeout as polling timeout.
- Do not close or interrupt running children.
- Close completed child sessions before final domain report.
- Report `pass`, `needs_fix`, `blocked`, or `escalate`.
- Final integration must update related docs/maps to match implementation facts.

Gnome instructions must include:

- You are not alone in the codebase.
- Do not revert unrelated changes.
- Work only in allowed scope.
- Do not run `pnpm install`.
- Keep Wave6 focused on Body Follow v0.
- Do not implement Broadcast, Stage scale/translation, Body Angle Y, persistent Model Mapping Profile, TCP/VMC/OSC, or advanced curve editor.
- Keep Stage Window model-only.
- Follow Runtime Player Development Policy and Source File Organization Policy.

Review-Sylph instructions must include:

- Review source and tests, not only Gnome summary.
- Report `pass`, `needs_changes`, or `escalate`.
- Remain read-only unless explicitly delegated a narrow fix.
- Treat forbidden scope as blocking.

## 13. Orchestration Policy

This wave follows the Implementation Orchestration skill.

Root / Undine:

- Owns wave plan, user questions, dependency graph, and final decision.
- Must not implement Runtime Player Wave6 source changes.
- Must wait for every started subagent.
- Must treat wait timeouts as polling.
- Must not close running children.

Orch-Sylph:

- Owns one domain loop.
- Must start with bounded current-state confirmation.
- Must delegate implementation and review.
- Must wait for Gnome and all Review-Sylphs.
- Must close completed children.
- Must report domain verdict and evidence.

No parent may pass the wave gate while a child is incomplete, running, or unresolved.

## 14. Out of Scope

- Broadcast-ready Stage / OBS capture flow.
- Stage scale/translation from head position.
- Body Angle Y.
- near/far distance response.
- persistent Model Mapping Profile save/read.
- advanced raw source selection.
- advanced response curve editor.
- TCP receiver.
- VMC/OSC adapter.
- multiple input source switching.
- Editor feature changes.
- Runtime Export generation/mutation.
- packaging/distribution.
