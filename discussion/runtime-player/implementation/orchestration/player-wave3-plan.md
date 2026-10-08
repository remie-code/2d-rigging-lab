# Runtime Player Wave 3 Plan: Default Runtime Pose + Stage View Transform

> Runtime Player Wave3は、Runtime Export読み込み後のStage表示をraw static mesh dumpからruntime-core評価済みdefault poseへ置き換える。同時に、配信用の見え方を調整できるStage上のsession-local pan / zoom / reset viewを追加する。iFacialMocap入力、parameter controls、head position由来motion、Stage size設定UIは対象外。

## 1. Status

- Status: Planned / ready for orchestration
- Target wave: Runtime Player Wave3
- Wave name: `runtime-player-default-runtime-pose-stage-view-transform`
- Primary objective:
  - Runtime Exportを開いた直後、Stage Windowにdefault parameter / keyform / deformer / opacityが反映されたdefault runtime poseを表示する。
  - Stage描画でkeyform/deformerを再実装せず、既存 `runtime-core` 評価経路を使う。
  - Runtime Player側に `RuntimeExportModelDto -> NormalizedRuntimeGraph` の薄いadapterを追加する。
  - Stage Window上でwheel zoom / drag panを可能にする。
  - Reset Viewでexport時bounds基準のinitial fitへ戻せるようにする。

## 2. Planning Gate Result

Planning Gate result: `Inventory first -> ready_to_plan`.

Why planning is now safe:

- Runtime Player Wave2は完了し、Runtime Exportを読み込み、Stage Windowにraw static meshとして表示できる。
- ユーザーは実物Runtime Exportを開けること、Stage表示が出ることを確認済み。
- Sylph調査により、現Stageはraw texture / rest vertices / atlas UV / triangles / base opacity / visible / draw order / masksだけを使い、parameter default / keyform / deformer / opacity keyform / dynamics default stateを反映していないことが確認済み。
- `runtime-core` にはdefault parameter resolution、keyform sampling/application、rotation/warp deformer hierarchy、opacity multiplier、dynamics reset/default state、snapshot評価の既存部品がある。
- 主な不足は `RuntimeExportModelDto -> NormalizedRuntimeGraph` adapterであり、Stage側で評価処理を再発明する必要はない。

Uncertainty:

- factual: medium. Adapter実装時にRuntime Export DTOと `NormalizedRuntimeGraph` の細部対応確認が必要。
- decision: low. UX/scope方針は合意済み。
- cost of wrong plan: high. runtime評価経路を誤るとwave4のiFacialMocap mapping/live loopで作り直しになる。

Precondition:

- Runtime Player Wave2 source exists and launches.
- Runtime Player can open the user's real Runtime Export directory.
- Implementation agents must not run `pnpm install`.
- If package dependencies change, report clearly and stop for user-side install unless already installed.

## 3. Accepted Decisions / Oracles

### 3.1 Default Runtime Pose Means Evaluated Pose

Required:

- Stage must not render raw exported rest mesh as the final loaded state.
- Stage must render the result of runtime evaluation with all authored parameter values absent, so parameter defaults are used.
- Keyforms at default parameter values must be sampled.
- Drawable opacity / visibility / draw-order keyforms must be reflected.
- Rotation and warp deformers must be evaluated through runtime-core hierarchy.
- Deformer opacity multipliers must be reflected.
- Dynamics must be in reset/default state only; no time progression in Wave3.

Forbidden:

- Reimplementing keyform/deformer evaluation in `apps/runtime-player/src/stage/**`.
- Adding manual parameter sliders to Control Window.
- Adding iFacialMocap/network input.
- Adding head position driven body/stage motion.

### 3.2 Runtime-Core Is The Evaluation Authority

Required:

- Use existing `runtime-core` snapshot/evaluation path for default pose.
- Add only a thin adapter from Runtime Export DTO to the graph shape expected by `runtime-core`.
- Keep the adapter pure and testable.
- Runtime Player must not import `authoring-core` just to reuse `toRuntimeGraph`.

Recommended:

- Keep the adapter Player-local in Wave3 to avoid package dependency churn.
- Promote it to a shared package later only if another consumer needs Runtime Export -> runtime-core graph conversion.

### 3.3 Stage Size, Initial Fit, And View Transform Are Separate Concepts

Definitions:

- Stage size: the transparent Stage Window / canvas area captured by OBS or another app.
- Initial fit: first placement of the model inside the Stage using exported model/canvas bounds.
- Stage view transform: user-controlled pan / zoom applied to the rendered model for display only.
- Runtime pose evaluation: default parameter/keyform/deformer evaluation that changes the model's rendered geometry and opacity.
- Head position driven Stage motion: future automatic Stage scale/translation derived from tracking input.

Required:

- Initial fit uses exported model/canvas bounds, not per-frame evaluated bounds.
- Stage size is independent from model/canvas bounds.
- Evaluated vertices outside exported bounds must not be clipped by Stage fitting logic.
- Stage view transform must not mutate Runtime Export, model parameters, keyforms, or runtime graph.
- Pan / zoom are session-local in Wave3.
- Reset View returns to exported-bounds initial fit.

Accepted limitation:

- Wave3 may use current Stage Window size as Stage size.
- Dedicated Stage Size presets, custom resolution UI, OBS ratio presets, always-on-top, click-through, and persisted stage placement are later waves.

### 3.4 Stage Interaction UX

Required:

- Stage Window supports mouse wheel zoom.
- Stage Window supports left-drag pan.
- Zoom should be anchored around the pointer where practical, or at least around Stage center if pointer anchoring is too costly.
- Drag pan should work because Stage Window has no authoring/edit operations.
- Reset View exists, preferably wired from existing Control Window stage/reset affordance if present.
- Stage remains capture-clean: no visible handles, overlays, parameter lists, or debug UI on Stage by default.

### 3.5 Wave3 Is Not Live Input

Forbidden:

- iFacialMocap UDP/TCP receive.
- input source connect/disconnect behavior.
- tracking frame normalization.
- parameter mapping.
- calibration / Look Forward behavior.
- body follow head.
- head position driven Stage scale/translation.
- dynamics time progression.
- previous export auto restore.
- Stage size/settings persistence.

Allowed:

- Control Window may continue showing placeholder input/calibration sections.
- Debug/error status may expose evaluation failure summary in Control Window.

## 4. Primary Basis

Runtime Player basis:

- [Initial Runtime Player Screen](../../screens/initial-runtime-player-screen.md)
- [Runtime Player Technology Stack Decision](../../architecture/technology-stack-decision.md)
- [Runtime Player Development Policy](../../architecture/runtime-player-development-policy.md)
- [Tracking Input Mapping Baseline](../../architecture/tracking-input-mapping-baseline.md)
- [Runtime Player Backlog](../../backlog/runtime-player-backlog.md)

Runtime Export / evaluation basis:

- `packages/package-format/src/runtime-export.ts`
- `packages/authoring-core/src/runtime-export-materialization.ts`
- `packages/runtime-core/src/runtime-core.ts`
- `packages/runtime-core/src/snapshot.ts`
- `packages/runtime-core/src/parameter-resolution.ts`
- `packages/runtime-core/src/keyform-sampling.ts`
- `packages/runtime-core/src/keyform-target-application.ts`
- `packages/runtime-core/src/rig-control-evaluation.ts`
- `packages/runtime-core/src/rig-control-warp-lattice.ts`
- `packages/runtime-core/src/initial-state.ts`
- `packages/render-core/**`
- `packages/render-webgl2/**`

Current implementation facts:

- `apps/runtime-player` loads Runtime Export directory through main/preload IPC.
- Stage receives loaded Runtime Export payload and raw RGBA texture bytes.
- Stage currently converts Runtime Export directly to render input through static rest mesh data.
- There is no Player-local Runtime Export to `runtime-core` graph adapter yet.
- Runtime Player depends on `package-format`, `runtime-core`, `render-core`, and `render-webgl2`, but must not import `authoring-core`.

Likely implementation areas:

- `apps/runtime-player/src/stage/**`
- `apps/runtime-player/src/control/**` for Reset View/status wiring only
- `apps/runtime-player/src/preload/**` only if a narrow reset/status command is needed
- `apps/runtime-player/src/main/**` only if window message plumbing is needed
- focused tests under `apps/runtime-player/**`
- no expected changes to `packages/**` unless a tiny export/type gap is discovered and explicitly reported

## 5. Wave Strategy

```text
Batch 1:
  Domain A: Runtime Export Default Pose Evaluation Adapter

Batch 2:
  Domain B: Stage Evaluated Render Integration + View Transform UX

Batch 3:
  Domain C: Final Integration / Clean Review / Map Closeout
```

Parallelism summary:

| Domain | Can run in parallel? | Reason |
|---|---:|---|
| A. Runtime Export Default Pose Evaluation Adapter | No | Establishes the evaluated render-frame contract. Stage integration should not guess adapter output. |
| B. Stage Evaluated Render Integration + View Transform UX | No | Depends on Domain A's evaluated graph/snapshot/render scene path. |
| C. Final Integration / Clean Review | No | Depends on A and B completion and must review integrated behavior. |

Rationale:

- Evaluation correctness and Stage interaction are conceptually distinct, but B should consume a stable evaluated output from A.
- A protects wave4 by making runtime-core the authority now.
- B protects player UX by separating Stage size, initial fit, and view transform.

## 6. Acceptance Criteria

### 6.1 Default Runtime Pose Evaluation

Required:

- Opening a valid Runtime Export displays an evaluated default pose.
- Parameter defaults are used when there are no live authored/input overrides.
- Keyforms at default parameter values are sampled.
- Mesh keyform deformation is reflected.
- Drawable opacity / visibility / draw-order keyforms are reflected.
- Rotation and warp deformer hierarchy is reflected.
- Deformer opacity multipliers are reflected.
- Dynamics are reset/default only and do not time-progress.
- Clipping/masks still work with evaluated geometry/opacities.

### 6.2 Adapter Boundary

Required:

- Runtime Export DTO is converted to the `runtime-core` graph shape through a pure Player-local adapter.
- Adapter has focused tests.
- Runtime Player does not import `authoring-core`.
- Stage renderer does not own runtime graph construction details beyond consuming adapter output.

### 6.3 Stage View Transform

Required:

- Stage initial fit is based on exported model/canvas bounds.
- Wheel zoom works on Stage Window.
- Left-drag pan works on Stage Window.
- Reset View returns to initial fit.
- Pan/zoom are session-local.
- Pan/zoom do not mutate model data or Runtime Export.
- Evaluated vertices outside exported bounds are still drawn if inside the visible Stage canvas.
- Stage remains transparent/capture-clean with no visible editing handles or parameter UI.

### 6.4 Error Handling

Required:

- Runtime evaluation/adapter errors do not crash the app.
- Stage clears or remains in a safe state on fatal evaluation errors.
- Control Window exposes a human-readable error/status path.
- Runtime diagnostics should not be silently swallowed if they indicate missing graph data or unsupported assumptions.

### 6.5 Tests / Verification

Minimum required verification:

- Runtime Player package typecheck.
- Unit tests for Runtime Export -> runtime-core graph adapter.
- Unit tests proving default pose evaluation changes output from raw rest state for at least one parameter/keyform/deformer or opacity case.
- Unit or integration test for snapshot/evaluated output -> Stage render input.
- Stage view transform tests for wheel zoom / drag pan / reset view pure state helpers if interaction logic is split.
- `node scripts/check-source-organization.mjs`.
- `node scripts/check-dependencies.mjs`.
- `git diff --check`.

Preferred verification:

- Manual check with the user's real Runtime Export:
  - default-parameter opacity-hidden parts are hidden.
  - simple deformer/keyform default pose appears as expected.
  - clipping remains correct.
  - wheel zoom / drag pan / reset view work.
- Screenshot/pixel smoke if Electron environment allows it.

If GUI/screenshot verification cannot run in the agent environment:

- Domain report must say so.
- Domain report must provide manual verification steps.

## 7. Domain A: `runtime-player-wave3-default-pose-evaluation-adapter`

Purpose:

- Add the pure adapter and one-shot default runtime evaluation path needed to produce evaluated Stage render data from a loaded Runtime Export.

Allowed write scope:

- `apps/runtime-player/src/stage/**`
- `apps/runtime-player/src/shared/**` only if there is already an appropriate bounded shared contract area
- focused tests under `apps/runtime-player/**`
- focused Runtime Player reports/reviews under `discussion/runtime-player/implementation/**`

Forbidden write scope:

- `apps/editor/**`
- broad `packages/**` changes
- `packages/authoring-core/**` imports from Runtime Player
- `node_modules/**`
- Editor implementation docs under `discussion/implementation/**`

Required implementation:

- Convert Runtime Export parameters, drawables, meshes, masks, rig controls, keyforms, and dynamics groups into a `runtime-core` graph shape.
- Evaluate default pose using empty authored/input values and reset/default dynamics state.
- Request enough snapshot detail to provide evaluated vertices/opacities/draw order needed by Stage.
- Preserve texture/atlas page metadata separately from graph evaluation.
- Add tests for adapter field coverage and default pose evaluation.

Forbidden implementation:

- WebGL interaction UX.
- iFacialMocap/network/mapping.
- manual parameter controls.
- dynamics time progression.
- Stage size persistence.

Expected report:

- Files changed.
- Adapter contract shape.
- Which Runtime Export fields are consumed.
- Which runtime-core APIs are used.
- Verification performed.
- Residual gaps/unsupported export features.

Early escape triggers:

- `runtime-core` graph shape cannot be constructed from Runtime Export without missing required data.
- Existing `runtime-core` APIs require importing authoring-only code.
- Snapshot detail needed for rendering is unavailable without broad runtime-core changes.

## 8. Domain B: `runtime-player-wave3-stage-evaluated-render-and-view-transform`

Purpose:

- Replace raw rest mesh Stage rendering with evaluated default pose rendering and add session-local Stage pan/zoom/reset view.

Dependencies:

- Domain A evaluated output contract.

Allowed write scope:

- `apps/runtime-player/src/stage/**`
- `apps/runtime-player/src/control/**` for Reset View/status wiring only
- `apps/runtime-player/src/preload/**` / `apps/runtime-player/src/main/**` only if narrow command routing is needed
- focused tests under `apps/runtime-player/**`
- focused Runtime Player reports/reviews under `discussion/runtime-player/implementation/**`

Forbidden write scope:

- `apps/editor/**`
- broad renderer package changes unless explicitly escalated
- input adapter/network implementation
- persistent settings/storage implementation

Required implementation:

- Feed evaluated vertices/opacities/draw order into existing render-core/render-webgl2 path.
- Preserve raw RGBA texture upload and atlas UV usage.
- Preserve clipping/masks.
- Initial fit uses exported model/canvas bounds.
- Add Stage view transform state for pan/zoom.
- Add wheel zoom and left-drag pan on Stage Window.
- Add Reset View path.
- Keep Stage visually UI-free.
- Add tests for transform math and render adapter regression.

Forbidden implementation:

- Visible Stage controls/handles by default.
- Parameter sliders.
- live input/mapping.
- dynamics playback loop.
- persisted Stage placement/settings.

Expected report:

- Files changed.
- Render path summary.
- Stage interaction behavior.
- How Reset View is triggered.
- Verification performed.
- Manual visual verification steps.
- Known rendering/interaction limitations.

Early escape triggers:

- Current render scene type cannot accept evaluated vertices/opacities without broad package changes.
- Existing Stage Window event handling is incompatible with pointer/wheel interactions.
- Reset View cannot be routed without changing broad main/preload contracts.

## 9. Domain C: `runtime-player-wave3-final-integration-clean-review`

Purpose:

- Validate Runtime Player Wave3 as an evaluated default pose + Stage view transform wave.

Allowed write scope:

- `discussion/runtime-player/implementation/waves/wave3/**`
- `discussion/runtime-player/implementation/reviews/wave3/**`
- `discussion/runtime-player/implementation/_map.md`
- `discussion/runtime-player/implementation/orchestration/_map.md`
- narrow source/test fixes only if clean review requires them

Required checks:

- Domain A and Domain B reports exist.
- Review lanes exist and pass or explicitly escalate.
- Stage uses runtime-core evaluation, not raw rest mesh rendering.
- Runtime Player does not import `authoring-core`.
- Stage interaction is display-only and session-local.
- Input/mapping/dynamics playback/body-follow remain out of scope.
- Manual verification instructions are clear.

Expected final artifacts:

- `discussion/runtime-player/implementation/waves/wave3/runtime-player-wave3-domain-a-default-pose-evaluation-adapter-report.md`
- `discussion/runtime-player/implementation/waves/wave3/runtime-player-wave3-domain-b-stage-evaluated-render-and-view-transform-report.md`
- `discussion/runtime-player/implementation/waves/wave3/runtime-player-wave3-final-integration-report.md`
- `discussion/runtime-player/implementation/waves/wave3/_map.md`
- `discussion/runtime-player/implementation/reviews/wave3/runtime-player-wave3-domain-a-spec-compliance-review.md`
- `discussion/runtime-player/implementation/reviews/wave3/runtime-player-wave3-domain-a-design-development-review.md`
- `discussion/runtime-player/implementation/reviews/wave3/runtime-player-wave3-domain-a-test-adequacy-review.md`
- `discussion/runtime-player/implementation/reviews/wave3/runtime-player-wave3-domain-b-spec-compliance-review.md`
- `discussion/runtime-player/implementation/reviews/wave3/runtime-player-wave3-domain-b-design-development-review.md`
- `discussion/runtime-player/implementation/reviews/wave3/runtime-player-wave3-domain-b-test-adequacy-review.md`
- `discussion/runtime-player/implementation/reviews/wave3/runtime-player-wave3-final-clean-integration-review.md`
- `discussion/runtime-player/implementation/reviews/wave3/_map.md`

## 10. Review Policy

Each implemented domain requires three review lanes:

1. Spec Compliance Review
   - Check against this plan and accepted Runtime Player UX boundaries.
   - Verify default pose evaluation and Stage transform scope.
2. Design / Development Compliance Review
   - Check Runtime Player Development Policy.
   - Check main/preload/control/stage boundaries, file splitting, IPC/preload safety, source organization, dependency scope.
3. Test Adequacy Review
   - Check adapter/evaluation tests, transform tests, typecheck, dependency/source checks, and manual verification instructions.

Reviewers must report `pass`, `needs_changes`, or `escalate`.

Blocking findings include:

- Stage still renders raw rest mesh as loaded final state.
- Runtime Player imports `authoring-core`.
- Stage reimplements keyform/deformer evaluation instead of using runtime-core.
- Manual parameter sliders or input mapping are added.
- Dynamics time progression is added.
- Stage pan/zoom mutates model data or Runtime Export.
- Stage shows visible editing UI/handles by default.
- Invalid/evaluation failure crashes app.
- No credible manual verification path.

## 11. Verification Matrix

| Requirement | Minimum evidence |
|---|---|
| Runtime Export -> runtime-core graph adapter exists | source + adapter tests |
| Default parameter values are applied | evaluation test |
| Keyforms are sampled at defaults | evaluation test |
| Deformer hierarchy is evaluated | evaluation test or existing runtime-core evidence plus adapter test |
| Opacity/visibility keyforms affect render | evaluation/render adapter test |
| Clipping remains supported | render adapter/source review/manual check |
| Stage initial fit uses exported bounds | transform source/test |
| Wheel zoom works | source/test/manual check |
| Drag pan works | source/test/manual check |
| Reset View works | source/test/manual check |
| Stage remains UI-free | source/review/manual check |
| No input/mapping/body-follow added | source review |

## 12. Subagent Contract

Orch-Sylph instructions must include:

- Use this Runtime Player Wave3 plan as source of truth.
- Start with bounded current-state confirmation for Runtime Player Wave2 code and runtime-core evaluation APIs.
- Delegate Domain A before Domain B.
- Delegate independent review to Review-Sylphs for each implemented domain.
- Wait for all started children.
- Treat `wait_agent` timeout as polling timeout.
- Do not close or interrupt running children.
- Close completed child sessions before final domain report.
- Report `pass`, `needs_fix`, `blocked`, or `escalate`.

Gnome instructions must include:

- You are not alone in the codebase.
- Do not revert unrelated changes.
- Work only in allowed scope.
- Do not run `pnpm install`.
- Keep Wave3 focused on default runtime pose and Stage view transform.
- Do not implement iFacialMocap, parameter controls, body-follow, head-position motion, dynamics playback, or persistence.
- Do not import `authoring-core` into Runtime Player.
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
- Must not implement Runtime Player Wave3 source changes.
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

- iFacialMocap UDP/TCP receiver.
- VMC/OSC adapter.
- input source connect/disconnect behavior.
- tracking frame normalization.
- calibration / Look Forward implementation.
- parameter mapping.
- parameter sliders.
- body follow head.
- head position driven Stage scale/translation.
- dynamics time progression.
- previous Runtime Export auto restore.
- recent export list.
- Stage size preset/custom UI.
- Stage placement/settings persistence.
- always-on-top / click-through platform behavior.
- Runtime Export generation or mutation.
- Editor feature changes.
- packaging/distribution.
