# Runtime Player Wave 11 Plan: Stage Motion / Head Position Follow

> Objective: add Stage-level head-position follow so the broadcast model shifts horizontally and scales with calibrated head position, while preserving Browser Source-first output and Wave10 performance behavior.

## 1. Status

- Status: Ready to launch.
- Planning gate result: inventory then plan.
- Inventory result:
  - Calibrated head position X exists in main-owned input/profile data and is already used by Body Follow.
  - Depth/Z exists as raw head-position data, but current Input Profile calibration only records left/right intentionally; near/far must be added for production-grade scale follow.
  - Saved Stage base transform is Window State `stageView.transform`.
  - Browser Source receives Stage display state from main; Stage Motion must be computed in main and published as sanitized composed Stage transform, not raw tracking data.
  - Wave10 local preview suspension must remain active: Browser Source should still receive Stage Motion while native local preview live rendering is suspended.
- Source of truth before implementation:
  - [stage-motion-head-position-follow.md](../../screens/stage-motion-head-position-follow.md)
  - Wave11 Sylph implementation-boundary inventory.
  - [broadcast-stage-setup-v0.md](../../screens/broadcast-stage-setup-v0.md)
  - [control-window-screen-structure.md](../../screens/control-window-screen-structure.md)
  - [player-wave10-plan.md](player-wave10-plan.md)
  - [runtime-player-wave-planning-conventions.md](runtime-player-wave-planning-conventions.md)

## 2. Product Goal

Runtime Player already moves the model through mapping, body follow, dynamics, and Browser Source output. Wave11 should add the last missing layer of physical presence: the whole character should subtly follow the user's head position inside the Stage composition.

The desired experience is:

1. The user connects iFacialMocap and calibrates Input Profile including near/far.
2. The user opens the `Stage` page and enables `Stage Motion`.
3. Moving head left/right shifts the model horizontally in the broadcast frame.
4. Moving closer/farther scales the model slightly larger/smaller.
5. Manual Stage pan/zoom remains the base composition.
6. Stage Motion settings auto-save.
7. OBS Browser Source sees the same composed transform as native Stage preview.
8. Browser Source continues to work while Wave10 native local preview live rendering is suspended.

This feature is a Stage-level display transform. It is not model parameter mapping, rigging, Runtime Export mutation, or keyform editing.

## 3. Accepted Decisions

### 3.1 Stage Motion Scope

- Stage Motion belongs to the `Stage` page.
- Stage Motion uses calibrated head position:
  - head position X -> horizontal Stage offset.
  - calibrated near/far depth -> Stage scale offset.
- Stage Motion adds transient live offsets on top of saved manual Stage pan/zoom.
- Stage Motion settings auto-save.
- Current live offsets are not saved.

### 3.2 Near/Far Calibration

- Wave11 should add near/far calibration to Input Profile.
- Do not use incidental Z values from left/right calibration as production depth.
- Input calibration should explicitly guide the user through closer/farther prompts.
- Existing Input Profiles without near/far data must still load.
- Missing near/far calibration should be visible and recoverable through Input/Profile calibration UI.

### 3.3 Runtime Boundary

- Compute Stage Motion in main.
- Main owns tracking frame, active Input Profile, session neutral, Window State, Browser Source server, and Wave10 preview suspension policy.
- Browser Source receives only sanitized composed Stage display transform.
- Browser Source must not receive raw tracking frames, raw head position, calibration internals, or debug diagnostics.
- Do not add Stage Motion to Model Mapping Profile.

### 3.4 Persistence

- Stage Motion settings are local display settings.
- Persist them with Window State unless implementation finds a concrete reason to split a new local display-state file.
- The current recommendation remains Window State.

Saved:

- enabled.
- horizontal strength / limit / invert.
- scale strength / limit / invert.
- dead zone.
- reaction.

Not saved:

- current live offset.
- current smoothed offset.
- raw head position.
- session neutral / Look Forward state.

### 3.5 Wave10 Preservation

- Browser Source remains the fixed primary broadcast path.
- Native Stage Window remains local preview/fallback.
- Browser Source client connected: native local preview live rendering may be suspended.
- Stage Motion must still be applied to Browser Source during native preview suspension.
- Do not reintroduce high-frequency Control React updates.

## 4. Wave Strategy

Use a sequential chain. Each domain creates a basis for the next:

1. Near/far calibration creates reliable depth input.
2. Stage Motion core uses the calibrated input and persists settings.
3. Stage page UI exposes the already-defined settings.
4. Final integration aligns docs and runs clean review.

Avoid aggressive parallelism. The code paths overlap around input profile schema, window state schema, bridge contracts, Stage page UI, Browser Source display state, and main runtime wiring.

### Batch 1

| Domain | Work | Parallel? | Notes |
|---|---|---|---|
| Domain A | Input Profile near/far calibration | No | Adds explicit closer/farther calibration and backward-compatible profile data. |

### Batch 2

| Domain | Work | Parallel? | Notes |
|---|---|---|---|
| Domain B | Stage Motion core, persistence, and transform transport | No, after A | Depends on calibrated depth and owns main-side composed transform. |

### Batch 3

| Domain | Work | Parallel? | Notes |
|---|---|---|---|
| Domain C | Stage page UI for Stage Motion | No, after B | Depends on settings schema/bridge from B. |

### Batch 4

| Domain | Work | Parallel? | Notes |
|---|---|---|---|
| Domain D | Final integration, docs alignment, clean review | No, after C | Verifies Browser Source, Wave10 suspension, persistence, and docs. |

## 5. Domain A: Input Profile Near/Far Calibration

Suggested subagent name:

```text
runtime-player-wave11-input-profile-near-far-calibration
```

### Scope

Extend Input Profile calibration so head position depth is explicitly calibrated for Stage Motion scale follow.

### Primary Files / Areas

Likely areas:

- `apps/runtime-player/src/main/input-session-state.ts`
- `apps/runtime-player/src/main/input-profiles/**`
- `apps/runtime-player/src/control/**` input calibration UI.
- `apps/runtime-player/src/preload/**` only if calibration bridge contracts require extension.
- focused tests under `apps/runtime-player/src/main/input-profiles/**` and related Control tests.

### Required Behavior

- Add near/far calibration section for head position depth.
- Add guided prompts for:
  - move closer.
  - move farther.
- Preserve existing left/right head position calibration.
- Existing Input Profiles without near/far data continue to load.
- Calibration readiness distinguishes:
  - head position left/right.
  - head position near/far.
- Missing-only calibration can guide only missing near/far prompts when the rest of the profile is ready.
- Learned sign / normalization data needed for depth scale is stored in Input Profile.
- Do not alter Model Mapping Profile.
- Do not expose raw tracking/debug data to Browser Source.

### Tests

At minimum, add focused tests for:

- profile parse/load backward compatibility without near/far section.
- near/far prompt readiness.
- missing-only calibration includes near/far when absent.
- existing left/right calibration still passes.
- normalized depth value/sign behavior where deterministic.
- no `pnpm install`.

## 6. Domain B: Stage Motion Core / Persistence / Transport

Suggested subagent name:

```text
runtime-player-wave11-stage-motion-core-persistence-transport
```

### Dependency

Start after Domain A passes.

### Scope

Implement the main-owned Stage Motion calculation and deliver sanitized composed Stage transform to native Stage and Browser Source.

### Primary Files / Areas

Likely areas:

- `apps/runtime-player/src/main/runtime-player-main.ts`
- `apps/runtime-player/src/main/window-state/**`
- `apps/runtime-player/src/main/stage-view-bridge-handlers.ts`
- new likely `apps/runtime-player/src/main/stage-motion/**`
- `apps/runtime-player/src/preload/runtime-player-bridge-contract.ts`
- Browser Source preload/contract files if present.
- `apps/runtime-player/src/main/broadcast-source/browser-source-session.ts`
- `apps/runtime-player/src/stage/browser-source/browser-source-stage-client.ts`
- `apps/runtime-player/src/stage/stage-renderer/static-stage-canvas-renderer.ts`
- focused tests under `apps/runtime-player/src/main/**` and `apps/runtime-player/src/stage/**`

### Required Behavior

- Add Stage Motion settings with defaults.
- Persist settings in Window State or a justified local display-state equivalent.
- Compute live Stage Motion in main from:
  - saved base Stage view transform.
  - calibrated head position horizontal input.
  - calibrated near/far depth input.
  - Stage Motion settings.
  - elapsed time for smoothing/reaction.
- Apply:
  - dead zone.
  - invert.
  - strength.
  - limit.
  - reaction/smoothing.
- Publish composed Stage transform to Browser Source without raw tracking data.
- Native Stage preview uses the same composed transform when live rendering is active.
- Browser Source continues receiving composed transform while Wave10 native local preview live rendering is suspended.
- Avoid high-frequency Control state churn; live transform delivery to Browser Source must not force Control updates every frame.
- Keep manual Stage pan/zoom as base transform.
- Do not save current live offset or smoothed runtime state.

### Tests

At minimum, add focused tests for:

- pure Stage Motion math:
  - dead zone.
  - limits.
  - invert.
  - reaction/smoothing.
  - base transform composition.
- Window State persistence/default/backward compatibility.
- Browser Source receives composed transform without raw tracking/debug payload.
- native preview suspension does not disable Browser Source Stage Motion.
- Control update sampling is not regressed by live transform updates.
- no `pnpm install`.

## 7. Domain C: Stage Page UI

Suggested subagent name:

```text
runtime-player-wave11-stage-motion-ui
```

### Dependency

Start after Domain B exposes stable settings/bridge contracts.

### Scope

Add Stage Motion controls to the `Stage` page.

### Primary Files / Areas

Likely areas:

- `apps/runtime-player/src/control/stage-page.tsx`
- `apps/runtime-player/src/control/**`
- preload/control bridge tests if needed.
- CSS under `apps/runtime-player/src/**`
- focused Control UI tests.

### Required Behavior

Add a compact `Stage Motion` panel on the Stage page:

```text
Stage Motion
  Enabled

Horizontal Follow
  Strength
  Limit
  Invert

Depth Scale
  Strength
  Limit
  Invert

Stabilization
  Dead zone
  Reaction
```

UX requirements:

- Stage Motion lives on Stage page, not Mapping page.
- Settings update live.
- Settings auto-save.
- Missing near/far calibration should be visible for Depth Scale and should route the user toward Input calibration.
- Do not add runtime parameter sliders.
- Do not add raw diagnostics here.
- Keep the UI compact enough not to bury Browser Source Output / Local Preview controls.

### Tests

At minimum, add focused tests for:

- Stage Motion panel renders on Stage page.
- controls call the bridge/update settings.
- auto-save state or persistence status remains understandable.
- missing near/far calibration state is represented.
- no editor/mapping controls are introduced.
- no `pnpm install`.

## 8. Domain D: Final Integration + Docs Alignment

Suggested subagent name:

```text
runtime-player-wave11-final-integration-stage-motion
```

### Scope

Run after A/B/C complete and pass review.

### Required Behavior

- Verify near/far calibration is production-grade enough for depth scale.
- Verify Stage Motion belongs to Stage page and not Mapping page.
- Verify settings auto-save/restore.
- Verify Browser Source receives composed transform and no raw tracking/debug data.
- Verify Wave10 native local preview suspension remains effective.
- Verify manual Stage pan/zoom remains the base transform.
- Verify docs/maps match implementation facts.
- Write Wave11 reports and reviews under:
  - `discussion/runtime-player/implementation/waves/wave11/`
  - `discussion/runtime-player/implementation/reviews/wave11/`

Docs to update as implementation facts require:

- [stage-motion-head-position-follow.md](../../screens/stage-motion-head-position-follow.md)
- [broadcast-stage-setup-v0.md](../../screens/broadcast-stage-setup-v0.md)
- [control-window-screen-structure.md](../../screens/control-window-screen-structure.md)
- [tracking-setup-live-mapping.md](../../screens/tracking-setup-live-mapping.md)
- [runtime-player-backlog.md](../../backlog/runtime-player-backlog.md)
- runtime-player maps.

The final integration scope must include:

```text
実装事実に合わせて関連ドキュメントを更新する。
```

## 9. Acceptance Criteria

- Input Profile supports explicit near/far head position calibration.
- Existing Input Profiles without near/far still load.
- Missing near/far calibration is visible and recoverable.
- Stage page has Stage Motion settings.
- Stage Motion settings auto-save and restore.
- Manual Stage pan/zoom remains the saved base transform.
- Head position X adds only transient horizontal Stage offset.
- Calibrated near/far depth adds only transient Stage scale offset.
- Dead zone suppresses small jitter.
- Reaction smooths motion.
- Strength/limit/invert work for horizontal and depth scale.
- Current live offsets are not saved.
- OBS Browser Source sees the same final Stage Motion result.
- Browser Source receives no raw tracking/debug data.
- Wave10 local preview suspension continues to reduce duplicate rendering.
- Native Stage preview resumes/works when no Browser Source client is connected.
- Focused tests cover calibration, Stage Motion math, persistence, Browser Source transform transport, and UI.
- No `pnpm install` is run by agents.

## 10. Verification Matrix

| Area | Verification |
|---|---|
| Input Profile calibration | Tests for near/far prompts, readiness, backward compatibility, missing-only calibration. |
| Stage Motion math | Pure unit tests for dead zone, limit, invert, smoothing, and composition. |
| Persistence | Window State schema/default/save/restore tests. |
| Runtime transport | Tests that Browser Source receives composed transform without raw tracking/debug data. |
| Wave10 preservation | Tests/manual check that native preview suspension remains active and Browser Source still receives Stage Motion. |
| Control UI | Stage page tests for controls, missing calibration, and no mapping/editor controls. |
| Regression | Runtime Player typecheck and focused Vitest. |
| Manual OBS | Confirm left/right Stage offset, near/far scale, Browser Source parity, smoothness, and persistence after restart. |

## 11. Manual Check Notes

The final report should ask the user to check:

- Recalibrate or missing-only calibrate near/far in Input Profile.
- Enable Stage Motion.
- Move head left/right and confirm Stage horizontal offset.
- Move closer/farther and confirm Stage scale change.
- Adjust strength/limit/dead zone/reaction while watching OBS Browser Source.
- Confirm motion is smooth and bounded.
- Confirm manual Stage pan/zoom remains the base position.
- Restart Runtime Player and confirm settings restore.
- Confirm OBS Browser Source sees the same Stage Motion.
- Confirm CPU/performance remains acceptable after Wave10 improvements.

## 12. Out of Scope

- Body parameter mapping changes.
- Runtime Export changes.
- model keyform/rig edits.
- editor-style parameter sliders.
- Spout2.
- OBS automation.
- saving current live offset.
- advanced curves.
- separate Stage Motion profile management UI.
- remote Browser Source server.
- exposing raw tracking/debug data to Browser Source.

## 13. Subagent Contract

- Do not run `pnpm install`; the user handles installs.
- Keep implementation scoped to Runtime Player.
- Preserve Browser Source as fixed primary broadcast path.
- Preserve Wave10 native local preview suspension.
- Do not implement Spout sender or OBS automation.
- Do not expose raw tracking/debug data to Browser Source.
- Do not mutate Runtime Export or Model Mapping Profile for Stage Motion.
- Do not save current live offsets.
- Do not revert unrelated or concurrent changes.
- Add focused tests where behavior is deterministic.
- If a shared file must be touched, keep the change minimal and record it in the domain report.

## 14. Review Policy

Each implementation domain needs the usual review lanes:

- spec compliance.
- design/development compliance.
- test adequacy.

Reviewers must specifically check:

- near/far calibration is explicit and backward-compatible.
- Stage Motion remains Stage-level display transform, not mapping/rigging.
- Browser Source receives only sanitized composed transform.
- Wave10 preview suspension and diagnostic sampling are not regressed.
- Window State persistence does not save live runtime offsets.
- Stage page UI is compact and does not introduce editor/mapping controls.

## 15. Orchestration Policy

This wave follows the Implementation Orchestration skill.

Root / Undine:

- Owns wave plan, user questions, dependency graph, and final decision.
- Must not implement Runtime Player Wave11 source changes.
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

Required assignment sentence:

```text
Orch-Sylph自身は実装担当ではない。source implementation は必ず別コンテキストの Gnome に委譲し、レビューは必ず別コンテキストの Review-Sylph に委譲すること。これを分離できない場合は実装せず escalate / blocked として報告すること。
```

No parent may pass the wave gate while a child is incomplete, running, or unresolved.
