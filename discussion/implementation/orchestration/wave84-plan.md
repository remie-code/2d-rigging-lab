# Wave 84 Plan: Viewer Runtime Dynamics Playback + Solver Consolidation

> Wave83でDynamics Tool上の時間進行previewとQuick Tuneが成立し、ユーザーはInspectorから自然な揺れを確認できるようになった。Wave84はそのDynamics設定をViewer / Runtime Viewへ接続し、完成モデル確認時にdriver parameter操作から物理揺れ込みの描画が見える状態へ進める。同時に、Editor-localに残ったpreview solver重複を減らし、Dynamics演算の正本をruntime-coreへ寄せる。

## 1. Status

- Status: Planned / ready for orchestration
- Target wave: Wave84
- Wave name: `viewer-runtime-dynamics-playback-solver-consolidation`
- Primary objective:
  - Viewer / Runtime Viewで、Runtime Controlsのdriver parameterを動かすとDynamics outputが時間経過で計算され、既存keyform/deformer評価へ反映されるようにする。
  - driver操作停止後もpendulum motionが継続し、自然に収束するようにする。
  - Viewerにsession-localなDynamics simulation stateと`Reset simulation`を追加する。
  - Dynamics output parameterはViewerのRuntime Controlsで表示・編集対象にしない。
  - Dynamics solver / parameter resolution / runtime frame evaluationの正本を`packages/runtime-core`へ寄せ、Editor UI側の独立した物理式コピーを減らす。
  - Editor Dynamics Tool previewは、可能な限りruntime-core solverを共有してViewer playbackとparityを保つ。
  - multi-pendulum、multi-output、same-output mixer、frame stepping、Dynamics schema変更はWave84対象外。

## 2. Planning Gate Result

Planning Gate result: `Inventory first -> Plan`.

Why planning is now safe:

- Wave83後のユーザー確認で、Dynamics Tool Inspector上のpreviewは自然に揺れることが確認された。
- ExportしたJSONを読み込み直してもDynamicsは完全に動作することがユーザー確認された。
- Sylph調査で、現行Editor-local solver、runtime-core候補、Viewer parameter injection point、serialization path、Runtime Controlsのoutput除外ポイントが確認された。
- User decisions are explicit:
  - 次はViewer / Runtime ViewにDynamics playbackを接続する。
  - solverの正本は`runtime-core`へ寄せる。
  - `apps/editor`が`runtime-core`を直接呼ぶことは、責務上自然なら許容する。
  - `authoring-core`へ物理演算実装を逃がさない。
  - Dynamics output parameterはViewer上で編集できない。将来的にもoutput meter/slider表示は基本サポートしない。

Uncertainty:

- factual: medium. `apps/editor`から`runtime-core`への直接依存追加が必要か、既存workspace dependencyにすでに含まれるかはDomain Aで確認する。
- decision: low. UX / responsibility boundary / non-goals are settled.
- cost of wrong plan: high. Solver ownershipを曖昧にすると、Editor previewとViewer playbackの揺れが将来ずれる。

## 3. Accepted Decisions / Oracles

### 3.1 Runtime Dynamics Playback Meaning

- Viewer / Runtime View is the finished-model confirmation surface.
- Dynamics playback in Viewer should show model motion, not solver internals.
- Runtime Controls represent externally-authored input values such as face angle or body angle.
- Dynamics output values are derived values and are not user-editable in Viewer.
- Viewer Dynamics simulation state is session-local and must not enter operation history, save/load payloads, or project dirty state.
- Viewer playback is automatic while the Viewer is mounted and a project has enabled Dynamics Groups.
- `Reset simulation` is allowed and should reset mutable simulation state.
- Pause/play and frame stepping are out of scope.

Conceptual Viewer algorithm:

```text
Viewer animation frame
  -> read Runtime Controls authored input values
  -> build base/authored parameter map
  -> advance Dynamics simulation state by dt
  -> compute additive output offsets
  -> resolve effective parameter values
  -> feed effective values into existing keyform/deformer evaluation
  -> render finished model
```

### 3.2 Solver Responsibility Boundary

Accepted responsibility split:

- `packages/runtime-core`
  - owns Dynamics solver;
  - owns additive `base + offset` parameter resolution;
  - owns runtime frame/sequence evaluation primitives;
  - does not know React, Editor UI, Inspector state, Canvas components, or operation history.
- `packages/authoring-core`
  - owns authoring graph, operations, package import/export, and authoring-to-runtime graph conversion;
  - does not own physical simulation formulas;
  - must not become an indirection layer merely to hide a legitimate Editor -> runtime-core dependency.
- `apps/editor`
  - owns Viewer UI, Dynamics Tool UI, rAF loops, preview/session-local mutable state, and UI reset controls;
  - calls runtime-core solver/evaluation helpers for physical calculation;
  - may add a direct dependency on `@private-2d-rigging-lab/runtime-core` when that is the clean responsibility boundary.

Policy:

- Do not preserve old package boundaries for their own sake.
- Do not move solver logic into `authoring-core`.
- Do not duplicate the pendulum formula in Editor when a runtime-core call or small runtime-core adapter can serve the same purpose.
- If a residual Editor-local adapter remains, it must be limited to UI state mapping, not independent physics semantics.

### 3.3 Dynamics Output Parameter Policy in Viewer

- Any parameter used as a Dynamics output is excluded from Viewer Runtime Controls editing.
- This applies even when the output parameter is an initialized preset/authored parameter.
- The Viewer should not show a moving read-only output slider/meter.
- The feedback for Dynamics output is the moving model itself.
- If future diagnostics need raw output values, they must be added as a deliberately separate diagnostics surface, not Runtime Controls.

### 3.4 Runtime Parameter Semantics

- Dynamics output remains additive: `effective = base/authored + dynamicsOffset`.
- Runtime Controls set base/authored input values.
- Dynamics outputs are injected before keyform/deformer evaluation.
- Dynamics output injection must not replace the base value with an absolute value.
- Multiple Dynamics Groups writing the same output parameter remain invalid or warning-worthy according to existing validation authority.
- Wave84 must not implement same-output mixing.

### 3.5 Viewer Controls Policy

- `Motion / Physics` placeholder may be opened enough to expose `Reset simulation`.
- `Reset simulation` resets mutable runtime Dynamics state only.
- No visible raw solver table, no frame stepping, no play/pause requirement.
- Existing Viewer pan/zoom and dense Runtime Controls from Wave80 must remain intact.
- Runtime output exclusion must not make driver parameters harder to find.

## 4. Primary Basis

Common:

- [Implementation Orchestration Skill](../../../.agents/skills/implementation-orchestration/SKILL.md)
- [UX-Backed Package Logic Authority](../../development_convention/ux-backed-package-logic-authority.md)
- [Source File Organization Policy](../../development_convention/source-file-organization-policy.md)
- [Dependency Policy](../../development_convention/dependency-policy.md)
- [Operation Policy](../../development_convention/operation-policy.md)
- [Schema and ID Conventions](../../development_convention/schema-and-id-conventions.md)

Screen / UX basis:

- [Dynamics Tool Component Spec](../../design/screen-design/components/dynamics-tool.md)
- [Viewer / Runtime View Screen Spec](../../design/screen-design/screens/viewer-runtime-view.md)
- [Screen Design Map](../../design/screen-design/_map.md)
- [Screen Design Components Map](../../design/screen-design/components/_map.md)
- [React Editor Foundation Oracle](../../design/screen-design/react-editor-foundation-oracle.md)
- [E2E Oracle](../../design/screen-design/e2e-oracle.md)

Wave baseline:

- [Wave80 Plan](wave80-plan.md)
- [Wave80 Final Integration Report](../waves/wave80/wave80-final-integration-report.md)
- [Wave81 Plan](wave81-plan.md)
- [Wave81 Final Integration Report](../waves/wave81/wave81-final-integration-report.md)
- [Wave81 Dynamics Time Progression Status](../waves/wave81/wave81-dynamics-time-progression-status.md)
- [Wave82 Plan](wave82-plan.md)
- [Wave82 Final Integration Report](../waves/wave82/wave82-final-integration-report.md)
- [Wave83 Plan](wave83-plan.md)
- [Wave83 Final Integration Report](../waves/wave83/wave83-final-integration-report.md)
- [Wave83 Final Clean Integration Review](../reviews/wave83/wave83-final-clean-integration-review.md)

Factual inventory from Sylph:

- `apps/editor/src/features/editor-session/model/dynamics-tool-state.ts`
  - current Editor-local preview state and stepping helpers.
- `apps/editor/src/workspace/panels/dynamics-tool-inspector.tsx`
  - current preview animation loop and Quick Tune UI.
- `packages/runtime-core/src/dynamics-evaluation.ts`
  - `stepDynamics(...)`, `advanceDynamicsGroupState(...)`, `computeDynamicsOutputOffsets(...)`.
- `packages/runtime-core/src/parameter-resolution.ts`
  - additive effective parameter resolution.
- `packages/runtime-core/src/runtime-core.ts`
  - `evaluateRuntimeFrame(...)` / `evaluateRuntimeSequence(...)`.
- `apps/editor/src/workspace/viewer/viewer-runtime-screen.tsx`
  - `createViewerRuntimeCleanStageProjection(...)` and Viewer Runtime Controls merge point.
- `apps/editor/src/workspace/viewer/viewer-clean-stage.ts`
- `apps/editor/src/workspace/canvas/canvas-evaluation.ts`
  - keyform/deformer evaluation path after parameter map injection.
- `apps/editor/src/workspace/viewer/runtime-controls-state.ts`
  - Runtime Controls editable parameter projection.
- `packages/package-format/src/model-files.ts`
  - `dynamics-file-v2` schemas.
- `packages/authoring-core/src/package-document-from-authoring-session.ts`
- `packages/authoring-core/src/package-document-model-files.ts`
- `packages/authoring-core/src/authoring-graph.ts`
  - Dynamics persistence path.

## 5. Review Policy

Each implementation domain requires three review lanes unless explicitly documented as not applicable:

1. `Spec Compliance Review`
   - Check Viewer playback, output exclusion, solver responsibility boundary, and explicit non-goals.
2. `Design / Development Compliance Review`
   - Check package responsibility, dependency changes, session/history boundaries, source organization, and no hidden UI/debug scope.
3. `Test Adequacy Review`
   - Check runtime-core solver/parity tests, Viewer playback tests, output exclusion tests, reset tests, and regression coverage for Dynamics Tool preview.

Domain reports must include:

- Basis Coverage Self-Report
- Current-State Confirmation
- Solver Ownership / Dependency Decision Trace
- Runtime Playback Integration Trace
- Runtime Controls Output Exclusion Trace
- Editor Preview Parity Trace
- History / Persistence Boundary Trace
- Must-not Compliance Evidence
- Residual Risk Classification

## 6. Wave Strategy

```text
Batch 1:
  Domain A: Viewer Dynamics Playback + Solver Consolidation

Batch 2:
  Domain B: Final Integration / Clean Review / Map Closeout
```

Dependency rationale:

- Solver consolidation, Viewer playback, Runtime Controls output exclusion, and Editor preview parity are tightly coupled around parameter-value ownership.
- Splitting runtime-core and Viewer integration into separate implementation domains would likely create review handoff cost and risk inconsistent solver semantics.
- Domain A should own the full create-review-fix loop for the single end-to-end Dynamics playback path.
- Domain B runs only after Domain A is pass-classified or explicit escalation is recorded.

## 7. Acceptance Criteria

### 7.1 Viewer Dynamics Playback

Required:

- Viewer / Runtime View advances Dynamics simulation over time while open.
- Runtime Controls driver parameter changes feed Dynamics inputs.
- Dynamics output offsets are injected before keyform/deformer evaluation.
- Model artwork visibly responds to Dynamics output through existing parameter/keyform/deformer evaluation.
- Driver stops still allow pendulum motion to continue and converge.
- `dt` is clamped or stepped to avoid large jumps after tab suspension or long stalls.
- Viewer unmount or project/session change stops the animation loop and releases stale runtime state.

Must not:

- Require opening Dynamics Tool for Viewer playback.
- Persist Viewer simulation state.
- Add operation history entries from Viewer playback.
- Implement frame stepping, timeline playback, or external camera/motion transport.

### 7.2 Reset Simulation

Required:

- Viewer exposes a minimal `Reset simulation` affordance, likely under `Motion / Physics`.
- Reset clears mutable Dynamics state such as angle, angular velocity, previous source, and previous source velocity.
- Reset does not alter authored parameter defaults, Runtime Controls override values, project data, save/load payload, or undo/redo history.
- Reset is available only when it has meaning, or is gracefully disabled when no Dynamics Group exists.

Must not:

- Add play/pause controls unless needed internally and hidden from user-facing UI.
- Add raw solver diagnostics.

### 7.3 Dynamics Output Exclusion

Required:

- Parameters used as Dynamics outputs are not editable in Viewer Runtime Controls.
- Dynamics output parameters are not displayed as moving read-only sliders/meters in Runtime Controls.
- Existing driver/input parameters remain visible and editable.
- Output exclusion handles initialized preset/authored parameters used as Dynamics outputs.
- Reset all / Runtime Controls override count ignores excluded Dynamics outputs.

Must not:

- Reclassify output parameters as `computedDynamics` solely to hide them if that would change package semantics.
- Remove output parameters from authoring data or keyform binding authority.
- Hide non-output parameters accidentally.

### 7.4 Solver Consolidation / Parity

Required:

- Dynamics Tool preview and Viewer playback use runtime-core solver/evaluation semantics.
- Editor-local code no longer owns an independent copy of the pendulum physics formula when a runtime-core helper can be used.
- Any remaining Editor-local helpers are adapters from UI/session state to runtime-core inputs/outputs.
- Add or preserve tests proving Editor preview and runtime-core stepping parity for representative Dynamics definitions.
- Preserve Wave83 Quick Tune behavior and preview animation.

Must not:

- Move physical simulation formulas into `authoring-core`.
- Force `apps/editor` through `authoring-core` if a direct `runtime-core` dependency is the cleaner boundary.
- Broadly rewrite runtime-core unrelated to Dynamics.
- Change `dynamics-file-v2` schema.

### 7.5 Runtime Parameter Semantics

Required:

- Runtime effective value remains additive: `base/authored + dynamicsOffset`.
- Viewer Runtime Controls values form the base/authored input map.
- Existing authored parameter defaults apply when a control has no override.
- Disabled Dynamics Groups do not affect effective output values.
- Same-output ownership validation behavior is preserved.

Must not:

- Treat Dynamics output as absolute replacement.
- Add multi-output, multi-pendulum, or mixer behavior.

### 7.6 Persistence / History Boundary

Required:

- Existing export/import of Dynamics Groups remains passing.
- Loading a saved project with Dynamics Groups allows Viewer playback without additional authoring steps.
- Viewer playback and reset do not dirty the project.
- Dynamics Tool Quick Tune committed edits remain operation-backed as in Wave83.

Must not:

- Change portable package schema.
- Persist simulation runtime state.

### 7.7 Performance / Smoothness Preservation

Required:

- Wave82 parameter scrub responsiveness remains intact.
- Viewer Dynamics rAF loop does not create obvious slider jank.
- Texture signature memoization and no-op guards are preserved.
- Animation loop is browser-frame scheduled and cleans up correctly.

Must not:

- Add a busy loop.
- Add visible telemetry/debug UI.
- Add new external dependencies.

## 8. Domain Design

| Batch | Domain | Dependency | Purpose |
|---|---|---|---|
| 1 | A. Viewer Dynamics Playback + Solver Consolidation | Wave83 pass baseline | Connect runtime-core Dynamics solver to Viewer, hide output params in Runtime Controls, migrate Editor preview to shared semantics |
| 2 | B. Final Integration / Clean Review / Map Closeout | Domain A pass or explicit escalation | Combined validation, clean review, reports/maps |

## 9. Domain A: `wave84-viewer-dynamics-playback-solver-consolidation`

Purpose:

- Make authored Dynamics Groups behave in the Viewer as finished-model runtime physics, while consolidating Dynamics stepping semantics around `runtime-core`.

Expected implementation areas:

- `packages/runtime-core/src/dynamics-evaluation.ts`
- `packages/runtime-core/src/parameter-resolution.ts`
- `packages/runtime-core/src/runtime-core.ts`
- `packages/runtime-core/src/*.test.ts`
- `apps/editor/package.json` if a direct workspace dependency is needed
- `apps/editor/src/workspace/viewer/viewer-runtime-screen.tsx`
- `apps/editor/src/workspace/viewer/runtime-controls-state.ts`
- `apps/editor/src/workspace/viewer/viewer-clean-stage.ts`
- `apps/editor/src/workspace/viewer/*.test.ts`
- `apps/editor/src/features/editor-session/model/dynamics-tool-state.ts`
- `apps/editor/src/features/editor-session/model/dynamics-tool-state.test.ts`
- `apps/editor/src/workspace/panels/dynamics-tool-inspector.tsx`
- `apps/editor/src/workspace/panels/dynamics-tool-inspector.test.ts`
- Focused Canvas projection/evaluation tests only if injection path needs direct coverage

Allowed write scope:

- `packages/runtime-core/src/**`
- `apps/editor/src/**`
- `apps/editor/package.json` if direct runtime-core dependency is required
- workspace dependency metadata only if required by dependency policy for local package linkage
- focused tests for touched files
- `discussion/implementation/waves/wave84/**`
- `discussion/implementation/reviews/wave84/**`

Conditional write scope, requiring explicit report justification:

- `packages/authoring-core/src/**` only for authoring-to-runtime graph conversion or test helper exposure; not for physics formula ownership.
- `packages/package-format/src/**` only for tests proving no schema change or if existing schema exports must be imported without changing shape.
- `scripts/**` only if an existing source/dependency guard must be updated for the accepted direct dependency.

Forbidden write scope:

- `dynamics-file-v2` schema changes.
- Save/load format changes.
- Operation payload/schema changes.
- Multi-pendulum authoring or runtime.
- Multiple outputs per Dynamics Group.
- Same-output mixer or additive blending across groups.
- Frame stepping, timeline, camera input, external transport.
- New Viewer raw solver diagnostics or output meters.
- Mesh/deformer/keyform authoring behavior changes unrelated to Dynamics output evaluation.
- Mesh generation algorithms.
- Persistent WebGL buffer/cache architecture.
- New external dependencies.
- Cubism SDK/runtime/export compatibility.

Required tests / evidence:

- Viewer driver parameter change produces time-progressing Dynamics output.
- Viewer output motion continues after driver stops and converges.
- Viewer reset clears simulation state without changing authored data or Runtime Controls overrides.
- Dynamics output parameters are excluded from Runtime Controls editing/display.
- Driver/input parameters remain editable.
- Editor Dynamics Tool preview still advances and Quick Tune still affects preview.
- Editor preview and runtime-core solver semantics share a common helper or have parity tests proving identical representative behavior.
- Runtime effective values use additive `base + offset`.
- Playback ticks and reset do not create operation history entries or dirty project state.
- Existing Dynamics export/import roundtrip remains passing if touched code can affect persistence.

Early escape triggers:

- Direct `apps/editor` -> `runtime-core` dependency conflicts with dependency policy and requires user decision.
- Runtime-core solver APIs cannot support Viewer playback without broad runtime snapshot redesign.
- Output exclusion creates ambiguous behavior for a parameter that is both driver and output in valid existing data.
- Viewer playback requires schema changes to know Dynamics-owned outputs.
- Dynamics Tool preview parity cannot be preserved while moving to runtime-core without significant UX regression.
- Test harness cannot observe Viewer time progression/reset behavior with reasonable fake timers/rAF.

## 10. Domain B: `wave84-final-integration-clean-review-map-closeout`

Purpose:

- Validate combined Wave84 behavior, obtain independent clean review, and update persistent maps/reports.

Expected implementation areas:

- `discussion/implementation/waves/wave84/**`
- `discussion/implementation/reviews/wave84/**`
- `discussion/implementation/_map.md`
- `discussion/implementation/orchestration/_map.md`

Acceptance:

- Domain A report exists and records `pass` or explicit escalation.
- Required review lanes exist and pass, or explicit escalation is recorded.
- Final clean integration review exists and passes before Wave84 is marked complete.
- Final report records:
  - solver ownership/dependency decision;
  - Viewer runtime playback behavior;
  - reset simulation behavior;
  - Runtime Controls output exclusion;
  - Editor preview parity / migration evidence;
  - persistence/history non-mutation evidence;
  - forbidden scope compliance;
  - validation results;
  - residual risks and recommended next boundary.
- Maps mark Wave84 status correctly.

Required checks:

- `pnpm typecheck`
- Focused Viewer runtime tests:
  - `apps/editor/src/workspace/viewer/viewer-runtime-screen.test.ts`
  - `apps/editor/src/workspace/viewer/runtime-controls-state.test.ts`
- Focused Dynamics Tool preview tests:
  - `apps/editor/src/features/editor-session/model/dynamics-tool-state.test.ts`
  - `apps/editor/src/workspace/panels/dynamics-tool-inspector.test.ts`
- Focused runtime-core Dynamics tests:
  - `packages/runtime-core/src/dynamics-evaluation.test.ts`
  - `packages/runtime-core/src/parameter-resolution.test.ts`
  - `packages/runtime-core/src/viewer-evaluation.test.ts` or the current equivalent
- Persistence tests if touched:
  - `packages/authoring-core/src/portable-project-bundle.test.ts`
  - `packages/package-format/src/package-document.test.ts`
- `node scripts/check-source-organization.mjs`
- `node scripts/check-dependencies.mjs`
- `git diff --check`

## 11. Verification Matrix

| Requirement | Minimum evidence |
|---|---|
| Viewer advances Dynamics over time | fake rAF/timer Viewer or model test |
| Runtime Controls driver affects Dynamics | Viewer projection/component test |
| Motion continues after driver stops | runtime-core/model test |
| Reset simulation clears mutable state only | Viewer/model test |
| Output params excluded from Runtime Controls | runtime-controls-state test |
| Driver params remain editable | runtime-controls-state test |
| Effective values are additive | runtime-core parameter-resolution test |
| Editor preview still works | Dynamics Tool state/Inspector tests |
| Solver semantics are shared or parity-proven | runtime-core/editor preview parity test |
| No history/save mutation from playback/reset | editor-session or source-review evidence |
| No schema change | package-format/portable roundtrip or source-review evidence |

## 12. Expected Persistent Artifacts

Reports:

- `discussion/implementation/waves/wave84/wave84-domain-a-viewer-dynamics-playback-solver-consolidation-report.md`
- `discussion/implementation/waves/wave84/wave84-final-integration-report.md`
- `discussion/implementation/waves/wave84/_map.md`

Reviews:

- `discussion/implementation/reviews/wave84/wave84-domain-a-spec-compliance-review.md`
- `discussion/implementation/reviews/wave84/wave84-domain-a-design-development-review.md`
- `discussion/implementation/reviews/wave84/wave84-domain-a-test-adequacy-review.md`
- `discussion/implementation/reviews/wave84/wave84-final-clean-integration-review.md`
- `discussion/implementation/reviews/wave84/_map.md`

## 13. Subagent Contract

Domain assignment must include:

- target and wave;
- dependencies;
- allowed write scope;
- forbidden write scope;
- basis documents;
- applicable policies;
- required tests and verification;
- expected evidence;
- loop limit;
- early escape triggers.

Each Orch-Sylph must start with bounded current-state confirmation before delegating to Gnome.

Gnome instructions must include:

- This workspace may already have unrelated dirty changes.
- Do not revert user or other-agent changes.
- Do not run broad refactors.
- Implement within the domain write scope.
- Preserve Wave80 Viewer pan/zoom and dense controls.
- Preserve Wave82 scrub performance improvements.
- Preserve Wave83 Dynamics Tool preview and Quick Tune UX.
- Treat `runtime-core` as the owner of physical Dynamics semantics.
- Do not move physics formula ownership into `authoring-core`.
- Do not display or edit Dynamics output parameters in Viewer Runtime Controls.
- Do not implement output meters, frame stepping, multi-pendulum, multi-output, mixer, schema changes, or new dependencies.

Review-Sylph instructions must include:

- Review from source, tests, plan, and reports, not only from Gnome summary.
- Report `pass`, `needs_changes`, or `escalate`.
- Do not ask the user directly.
- Do not edit files unless explicitly delegated a narrow fix after review.
- Treat Viewer Dynamics playback missing time progression as blocking.
- Treat Dynamics output parameters remaining editable/visible in Runtime Controls as blocking.
- Treat Editor-local independent physics formula copies as needs-change unless justified as a UI adapter only.
- Treat `authoring-core` owning physics solver semantics as blocking.
- Treat schema changes, frame stepping, output meters, multi-pendulum, multi-output, or mixer as forbidden scope.

## 14. Orchestration Policy

This wave must follow `.agents/skills/implementation-orchestration/SKILL.md`.

Root / Undine:

- Owns wave plan, dependency graph, user questions, and final decision.
- Must not implement the wave.
- Must preserve root context.
- Must wait for every started subagent.
- Must treat `wait_agent` timeout as polling timeout, not failure.
- Must not close, kill, interrupt, or summarize running children as complete.

Orch-Sylph:

- Owns exactly one domain loop.
- Must start with bounded current-state confirmation for its domain.
- Must delegate implementation to Gnome unless the domain is review-only.
- Must delegate review to independent Review-Sylphs.
- Must include separate Spec Compliance Review lane.
- Must wait for Gnome and Review-Sylph completion.
- Must not cancel, close, or interrupt child agents because they are slow or waiting.
- Must close completed child agent sessions at the end of the domain.
- Must not close running child sessions.
- Must report `pass`, `needs_fix`, `blocked`, or `escalate` with file paths, validation, and residual risks.

Gnome:

- Receives domain-specific basis sections only.
- Implements within allowed scope.
- May add dependencies only through dependency policy compliance and escalation.
- Must include Basis Coverage Self-Report and Deferred Basis Items.
- Must not implement unrelated authoring, mesh, deformer, atlas, camera, or transport features.

Review-Sylph:

- Reviews from artifacts and source, not only from Gnome summary.
- Must produce assigned lane report.
- Spec Compliance Review must not silently treat basis omissions as future scope.
- Must check forbidden scope, solver ownership, Viewer playback semantics, Runtime Controls output exclusion, and history/persistence boundaries explicitly.

Waiting rule:

- `wait_agent` timeout is polling timeout, not failure.
- No parent agent may terminate a child agent's work merely because it has not responded yet.
- If interruption is unavoidable, record incomplete / blocked / escalated. Do not pass the wave gate.

## 15. Out of Scope

- Dynamics Tool major UX redesign beyond parity fixes required by solver consolidation.
- Output parameter sliders/meters in Viewer.
- Raw solver diagnostics in Viewer.
- Pause/play controls.
- Frame stepping.
- Timeline or motion clip playback.
- External camera input, motion transport, HTTP/WebSocket/MCP runtime input.
- Multi-pendulum simulation or authoring.
- Multiple outputs per Dynamics Group.
- Same-output mixer / additive blending across groups.
- Dynamics save/load schema changes.
- Operation schema changes.
- Parameter preset redesign.
- Product Preflight Dynamics validation expansion unless required by touched code.
- Mesh generation changes.
- Mesh/deformer/keyform authoring UX changes.
- Texture Atlas Task.
- screenshot / export.
- Compare / Diff.
- New external dependencies.
- Cubism SDK / `.moc3` / `.model3.json` / `.physics3.json` compatibility.
