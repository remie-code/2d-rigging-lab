# Wave 83 Plan: Dynamics Tool Time-Progression Preview + Quick Tune

> Wave82でparameter scrubは体感上十分に軽くなり、Dynamics Tool Inspectorの通常状態もGroup list中心へ整理された。Wave83はDynamics調整の本丸として、Group Inspector上で時間経過する振り子previewを表示し、driver sliderとQuick Tuneを同じ視界に置いて揺れを詰められるようにする。

## 1. Status

- Status: Planned / ready for orchestration
- Target wave: Wave83
- Wave name: `dynamics-tool-time-progression-preview-quick-tune`
- Primary objective:
  - Dynamics ToolのExisting Group Inspectorで、driver値変更後も時間経過でpendulum simulationを進め、揺れと収束をCanvas上で確認できるようにする。
  - Preview中のraw solver summaryである`Source / Angle / Offset / Effective`を通常UIから外す。
  - Existing Group InspectorにQuick Tuneを追加し、`Strength / Sway / Reaction / Convergence / Length / Limit`をdriver preview sliderと同じ視界で調整できるようにする。
  - Quick TuneはCanvas previewへ即時反映しつつ、operation historyへ毎frame commitしない。
  - runtime-coreのDynamics stepping contractを可能な範囲で再利用し、Editor-local previewと将来Viewer playbackの挙動差を増やさない。
  - Viewer runtime playback/time progression、frame stepping、multi-pendulum、multi-output、mixerはWave83対象外。

## 2. Planning Gate Result

Planning Gate result: `Plan directly`.

Why planning is now safe:

- Dynamics ToolのUX方針は [Dynamics Tool Component Spec](../../design/screen-design/components/dynamics-tool.md) に反映済み。
- Wave81の実装事実として、現状はdriver変更ごとに1 stepだけ進み、時間経過loopが未実装であることは [Wave81 Dynamics Time Progression Status](../waves/wave81/wave81-dynamics-time-progression-status.md) に記録済み。
- Wave82でparameter scrubのno-op guard、rAF coalescing、texture signature memoization、performance instrumentationが入り、preview animation loopを入れる前提の体感/性能リスクが下がった。
- User decisions are explicit:
  - Dynamics Tool内で時間経過する揺れが見えないと設定値を詰められない。
  - Viewer playbackより先にDynamics Tool preview animation loopを実装する。
  - Existing Group Inspectorではraw solver summaryを通常表示しない。
  - Quick Tuneは`Strength / Sway / Reaction / Convergence / Length / Limit`だけを置く。
  - input/output binding、normalization、kind、invert、validation detailはEdit画面に残す。

Uncertainty:

- factual: medium. Editor-local `stepDynamicsToolPreview(...)` と runtime-core `stepDynamics(...)` のどちらを主に使うべきかは、Domain Aで現行実装確認して決める。
- decision: low. UXとscope decisionsはsettled。
- cost of wrong plan: medium. Viewer playbackやmulti-pendulumまで広げると過大実装になる。逆に1 step previewのままだとUX目的を満たさない。

## 3. Accepted Decisions / Oracles

### 3.1 Dynamics Tool Preview Meaning

- Dynamics Tool preview is an authoring adjustment preview.
- It is not finished-model Viewer playback.
- It should show how a selected Dynamics Group reacts over time to Inspector-local driver preview values.
- Non-driver parameters remain default in Dynamics Tool preview.
- Normal Parameter Bar editing remains disabled while `activeTool === "dynamics"`.
- Preview state is session-local and not saved to portable project.
- Preview scrubbing and preview animation must not create operation history entries.

### 3.2 Time Progression Policy

- Existing Group Inspector owns a preview animation loop while a group is open and preview is active.
- The loop is driven by `requestAnimationFrame` or an equivalent browser frame scheduler.
- The loop reads current Inspector-local driver preview values each frame.
- The loop advances pendulum mutable state using elapsed `dt`.
- `dt` must be clamped or stepped deterministically enough to avoid giant jumps after tab suspension or long stalls.
- Reset Preview clears mutable simulation state, including angle, angular velocity, previous source, and previous source velocity.
- Leaving the group, switching tools, deleting the group, or unmounting the Inspector must stop the loop.
- The loop must not run in List / Create / Edit states unless explicitly needed for a preview surface.

Conceptual algorithm:

```text
preview animation frame
  -> read selected Dynamics Group definition
  -> read Inspector-local driver preview values
  -> compute source from inputs
  -> advance pendulum state by dt
  -> compute output offset
  -> build effective parameter map
  -> feed existing Canvas evaluation/rendering
  -> schedule next frame while preview remains active
```

### 3.3 Solver Reuse Policy

- Prefer reusing the runtime-core Dynamics solver/step contract where practical.
- Editor preview and future Viewer playback should not drift in formula semantics.
- If direct runtime-core reuse is blocked by current types or package boundaries, Domain A may keep an Editor preview stepping helper but must:
  - document why runtime-core reuse was not used;
  - align formulas and tests with runtime-core behavior as closely as practical;
  - leave a clean path for future consolidation.
- Do not rewrite runtime-core broadly just to satisfy Editor UI.

### 3.4 Quick Tune Policy

Quick Tune appears in Existing Group Inspector, below Preview and above Actions.

Controls:

```text
Quick Tune
  Strength   Limit
  Length     Sway
  Reaction   Convergence
```

Meaning:

- `Strength`: output amplitude / how much the final parameter moves.
- `Limit`: output safety clamp / how far output can move from base.
- `Length`: period, weight, and delayed feel.
- `Sway`: how much driver velocity/acceleration produces swing.
- `Reaction`: how quickly the pendulum follows input/root movement.
- `Convergence`: damping / how quickly the swing settles.

Quick Tune does not include:

- driver parameter selection;
- input kind;
- add/delete input;
- influence / invert;
- Advanced normalization;
- output parameter selection;
- output kind;
- output invert;
- validation detail.

### 3.5 Quick Tune Commit Policy

- Quick Tune edits should be visible on Canvas immediately.
- Quick Tune must not commit operation history every animation frame or every tiny pointer movement.
- The accepted commit model for Wave83:
  - while dragging/typing, update an Inspector-local quick tune draft and preview from that draft;
  - on pointer up, pointer cancel, blur, Enter, or equivalent finalization, commit one operation-backed update if the effective Dynamics Group definition changed;
  - if the value returns to the committed value, no-op rather than committing;
  - if the user navigates away from the group with an unflushed Quick Tune value, flush the latest completed value where normal completion events permit; abrupt unmount may discard purely in-flight drag state.
- Numeric inputs may commit on blur/Enter to preserve editability.
- `Edit` remains available for structural changes that are not Quick Tune.

### 3.6 Raw Solver Summary Policy

- `Source / Angle / Offset / Effective` are not shown in the normal Existing Group Inspector.
- Canvas motion is the primary feedback.
- If raw solver values are useful later, they belong in Diagnostics / Evidence View or dev/debug mode, not the default Inspector.

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

- [Wave81 Plan](wave81-plan.md)
- [Wave81 Final Integration Report](../waves/wave81/wave81-final-integration-report.md)
- [Wave81 Final Clean Integration Review](../reviews/wave81/wave81-final-clean-integration-review.md)
- [Wave81 Dynamics Time Progression Status](../waves/wave81/wave81-dynamics-time-progression-status.md)
- [Wave82 Plan](wave82-plan.md)
- [Wave82 Final Integration Report](../waves/wave82/wave82-final-integration-report.md)
- [Wave82 Final Clean Integration Review](../reviews/wave82/wave82-final-clean-integration-review.md)

Likely implementation areas:

- `apps/editor/src/workspace/panels/dynamics-tool-inspector.tsx`
- `apps/editor/src/workspace/panels/dynamics-tool-inspector.test.ts`
- `apps/editor/src/features/editor-session/model/dynamics-tool-state.ts`
- `apps/editor/src/features/editor-session/model/dynamics-tool-state.test.ts`
- `apps/editor/src/features/editor-session/editor-session-context.tsx`
- `apps/editor/src/features/editor-session/editor-session-context-history.test.ts`
- `apps/editor/src/workspace/panels/canvas-preview-panel.tsx`
- `apps/editor/src/workspace/canvas/canvas-projection.ts`
- `apps/editor/src/workspace/canvas/canvas-evaluation.ts`
- `packages/runtime-core/src/dynamics-evaluation.ts`
- `packages/runtime-core/src/runtime-core.ts`
- Existing Wave82 helper `apps/editor/src/workspace/controls/raf-coalesced-number.ts`
- Focused tests near touched files

## 5. Review Policy

Each implementation domain requires three review lanes unless explicitly documented as not applicable:

1. `Spec Compliance Review`
   - Check every Wave83 requirement and explicit non-goal.
   - Treat one-step-only preview as blocking.
2. `Design / Development Compliance Review`
   - Check solver reuse boundary, session/history boundaries, UI state ownership, source organization, and forbidden scope.
3. `Test Adequacy Review`
   - Check animation loop stepping, reset, cleanup, Quick Tune live preview/commit behavior, hidden raw summary, and regression coverage.

Domain reports must include:

- Basis Coverage Self-Report
- Current-State Confirmation
- Solver Reuse Decision Trace
- Preview Animation Loop Trace
- Quick Tune UI / Commit Trace
- History / Persistence Boundary Trace
- Must-not Compliance Evidence
- Residual Risk Classification

## 6. Wave Strategy

```text
Batch 1:
  Domain A: Dynamics Preview Time Progression + Quick Tune

Batch 2:
  Domain B: Final Integration / Clean Review / Map Closeout
```

Dependency rationale:

- The work is centered on a single user flow and several overlapping files, especially `dynamics-tool-inspector.tsx` and Dynamics preview state.
- Splitting headless solver, UI loop, and Quick Tune into separate implementation domains would create file overlap and review overhead.
- Domain A must start with bounded current-state confirmation before deciding whether to reuse runtime-core step directly or keep an aligned Editor-local helper.
- Domain B runs only after Domain A is pass-classified or explicit escalation is recorded.

## 7. Acceptance Criteria

### 7.1 Preview Animation Loop

Required:

- Existing Group Inspector runs a preview animation loop while a Dynamics Group is open.
- The loop advances simulation state over time using frame `dt`.
- Driver slider changes affect subsequent simulation frames.
- Driver stops still allow pendulum motion to continue and converge.
- `dt` is clamped or stepped to avoid large jumps after stalls.
- Leaving Group Inspector, switching out of Dynamics Tool, deleting the group, or unmounting stops the loop.
- List / Create / Edit states do not run the normal preview animation loop.

Must not:

- Run a busy loop outside browser frame scheduling.
- Continue ticking for deleted/unselected groups.
- Persist mutable preview simulation state.
- Create operation history entries from animation ticks.
- Implement Viewer playback.

### 7.2 Solver Semantics

Required:

- Preview stepping preserves Wave81 additive `base + offset` semantics.
- Preview uses current Inspector-local driver values.
- Non-driver parameters remain default in Dynamics Tool preview.
- Preview reset initializes mutable state deterministically.
- Solver formula is reused from runtime-core where practical, or explicitly aligned and justified if not.

Must not:

- Replace base output with absolute Dynamics value.
- Require `computedDynamics` output parameters.
- Allow multiple Dynamics Groups to write the same output parameter.
- Add multi-pendulum or multi-output behavior.

### 7.3 Quick Tune UI

Required:

- Existing Group Inspector shows Quick Tune controls:
  - Strength;
  - Limit;
  - Length;
  - Sway;
  - Reaction;
  - Convergence.
- Quick Tune controls are visible near the driver Preview controls.
- Quick Tune changes update Canvas preview immediately.
- Quick Tune changes affect the active preview animation loop.
- Quick Tune uses compact controls suitable for Inspector vertical space.
- Quick Tune does not show structural binding controls.

Must not:

- Show input/output binding controls in Quick Tune.
- Show Advanced normalization in Quick Tune.
- Remove Edit flow for structural changes.
- Expand Group Inspector into the full edit form by default.

### 7.4 Quick Tune Commit / History

Required:

- Quick Tune live changes are previewed from an Inspector-local draft.
- A committed Dynamics Group update occurs once per completed adjustment, not every animation frame.
- Pointer up / pointer cancel / blur / Enter, or equivalent completion, flushes the latest value.
- Same-value adjustments no-op.
- Committed Quick Tune changes are operation-backed and undoable/redoable.
- Preview animation ticks are not operation-backed.
- Tests prove no history pollution from ticks and bounded history behavior for Quick Tune commits.

Must not:

- Commit on every rAF tick.
- Commit on every tiny pointer move.
- Lose the final adjusted value on normal completion.
- Persist uncommitted preview-only state in save/load.

### 7.5 Raw Solver Summary Removal

Required:

- `Source / Angle / Offset / Effective` are absent from the normal Existing Group Inspector.
- `Reset Preview` remains available.
- Canvas motion remains the primary feedback.
- If any raw values remain for tests/debug, they are not visible as default user-facing rows.

Must not:

- Replace raw solver summary with another always-visible debug table.
- Remove necessary validation feedback from Create/Edit forms.

### 7.6 Performance / Smoothness Preservation

Required:

- Wave82 rAF coalescing/no-op improvements remain intact.
- Preview animation loop does not reintroduce obvious slider jank.
- Existing performance instrumentation remains disabled by default.
- If practical, instrumentation records or can observe Dynamics preview ticks.

Must not:

- Add visible telemetry/debug UI.
- Add new dependencies.
- Revert Wave82 texture signature memoization or scrub improvements.

## 8. Domain Design

| Batch | Domain | Dependency | Purpose |
|---|---|---|---|
| 1 | A. Dynamics Preview Time Progression + Quick Tune | Wave82 pass baseline | Add time-progressing Dynamics Tool preview, Quick Tune UI/live draft/commit behavior, and raw summary removal |
| 2 | B. Final Integration / Clean Review / Map Closeout | Domain A pass or explicit escalation | Combined validation, clean review, reports/maps |

## 9. Domain A: `wave83-dynamics-preview-time-progression-quick-tune`

Purpose:

- Make Dynamics Tool useful for tuning by showing the actual delayed swing/settle behavior while exposing the six most useful tuning coefficients in the Preview state.

Expected implementation areas:

- `apps/editor/src/workspace/panels/dynamics-tool-inspector.tsx`
- `apps/editor/src/workspace/panels/dynamics-tool-inspector.test.ts`
- `apps/editor/src/features/editor-session/model/dynamics-tool-state.ts`
- `apps/editor/src/features/editor-session/model/dynamics-tool-state.test.ts`
- `apps/editor/src/features/editor-session/editor-session-context.tsx`
- `apps/editor/src/features/editor-session/editor-session-context-history.test.ts`
- `apps/editor/src/workspace/panels/canvas-preview-panel.tsx`
- `apps/editor/src/workspace/canvas/canvas-projection.ts`
- `apps/editor/src/workspace/canvas/canvas-evaluation.ts`
- `packages/runtime-core/src/dynamics-evaluation.ts`
- Runtime-core focused tests if solver reuse/refactor occurs
- Existing Wave82 rAF helper tests if extended

Allowed write scope:

- `apps/editor/src/**`
- `packages/runtime-core/src/**` for Dynamics solver reuse/alignment only
- Focused tests for touched files
- `discussion/implementation/waves/wave83/**`
- `discussion/implementation/reviews/wave83/**`

Conditional write scope, requiring explicit report justification:

- `packages/contracts/**` only if runtime-core type alignment requires a small exported state type.
- `packages/render-core/**` only if performance instrumentation needs a small Dynamics tick counter.
- `scripts/**` only if an existing guard/check must be updated.

Forbidden write scope:

- Save/load schema or portable project format
- Operation payload/schema shape changes beyond existing Dynamics update operation usage
- Keyform/deformer/mesh behavior changes
- Mesh generation algorithms
- React context architecture split
- Dirty graph evaluation
- Persistent WebGL buffers / mask cache / worker rendering
- Viewer runtime playback/time progression
- Viewer reset simulation/pause/playback controls
- Frame stepping
- Multi-pendulum or multi-output authoring
- Mixer / same-output blending
- New external dependencies
- Cubism SDK/runtime/export compatibility

Required tests / evidence:

- Preview loop advances pendulum state over multiple frames.
- Driver value changes affect subsequent frames.
- Motion continues after driver stops and converges.
- Reset Preview deterministically resets mutable state.
- Loop stops when group is closed/unselected or tool state changes.
- List/Create/Edit states do not run the normal preview loop.
- Quick Tune controls render in Existing Group Inspector.
- Quick Tune updates preview immediately.
- Quick Tune finalization commits one operation-backed update.
- Quick Tune same-value changes no-op.
- Animation ticks do not create history entries.
- `Source / Angle / Offset / Effective` rows are absent in normal Group Inspector.
- Existing Dynamics create/edit/delete flows remain passing.

Early escape triggers:

- Runtime-core solver reuse requires broad runtime snapshot redesign.
- Editor preview animation requires Viewer playback architecture.
- Quick Tune cannot commit without changing operation payload/schema.
- Operation-history semantics for live draft vs committed group update are ambiguous and need user decision.
- Preview loop creates unacceptable performance regression even after Wave82 improvements.
- Test harness cannot observe animation loop behavior with reasonable fake timers/rAF.

## 10. Domain B: `wave83-final-integration-clean-review-map-closeout`

Purpose:

- Validate combined Wave83 behavior, obtain independent clean review, and update persistent maps/reports.

Expected implementation areas:

- `discussion/implementation/waves/wave83/**`
- `discussion/implementation/reviews/wave83/**`
- `discussion/implementation/_map.md`
- `discussion/implementation/orchestration/_map.md`

Acceptance:

- Domain A report exists and records `pass` or explicit escalation.
- Required review lanes exist and pass, or explicit escalation is recorded.
- Final clean integration review exists and passes before Wave83 is marked complete.
- Final report records:
  - solver reuse/alignment decision;
  - time-progressing preview behavior;
  - reset/cleanup behavior;
  - Quick Tune UI and commit behavior;
  - raw solver summary removal;
  - operation/history non-mutation proof for ticks;
  - forbidden scope compliance;
  - validation results;
  - residual risks and recommended next boundary.
- Maps mark Wave83 status correctly.

Required checks:

- `pnpm typecheck`
- Focused Dynamics Tool Inspector tests
- Focused Dynamics preview state/history tests
- Focused runtime-core Dynamics tests if touched
- Focused Canvas projection/evaluation tests if touched
- `node scripts/check-source-organization.mjs`
- `node scripts/check-dependencies.mjs`
- `git diff --check`

## 11. Verification Matrix

| Requirement | Minimum evidence |
|---|---|
| Preview loop advances over time | fake rAF/timer component or model test |
| Driver changes affect later frames | model/component test |
| Motion continues and converges after driver stops | model/runtime test |
| Reset Preview clears state | model/component test |
| Loop stops on unmount/group close/tool change | component lifecycle test or source review evidence |
| No history entries from ticks | editor-session history test |
| Quick Tune renders six controls | Dynamics Inspector test |
| Quick Tune live preview updates | component/model test |
| Quick Tune finalizes one operation-backed update | editor-session history/operation test |
| Same-value Quick Tune no-ops | model/component test |
| Raw solver summary absent | Dynamics Inspector DOM test |
| Solver reuse/alignment decision recorded | Domain A report |
| Viewer playback not implemented | final report forbidden-scope evidence |

## 12. Expected Persistent Artifacts

Reports:

- `discussion/implementation/waves/wave83/wave83-domain-a-dynamics-preview-time-progression-quick-tune-report.md`
- `discussion/implementation/waves/wave83/wave83-final-integration-report.md`
- `discussion/implementation/waves/wave83/_map.md`

Reviews:

- `discussion/implementation/reviews/wave83/wave83-domain-a-spec-compliance-review.md`
- `discussion/implementation/reviews/wave83/wave83-domain-a-design-development-review.md`
- `discussion/implementation/reviews/wave83/wave83-domain-a-test-adequacy-review.md`
- `discussion/implementation/reviews/wave83/wave83-final-clean-integration-review.md`
- `discussion/implementation/reviews/wave83/_map.md`

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
- Preserve Wave82 performance improvements.
- Preserve Wave81/Wave82 Dynamics data contract and operation-backed create/update/delete.
- Treat this as Dynamics Tool authoring preview work, not Viewer playback.
- Prefer runtime-core solver reuse where practical, but do not broaden runtime architecture merely to satisfy UI.
- Keep mutable preview state session-local.
- Do not implement Viewer time progression, frame stepping, multi-pendulum, multi-output, mixer, save/load schema changes, keyform/deformer/mesh behavior changes, or new dependencies.

Review-Sylph instructions must include:

- Review from source, tests, plan, and reports, not only from Gnome summary.
- Report `pass`, `needs_changes`, or `escalate`.
- Do not ask the user directly.
- Do not edit files unless explicitly delegated a narrow fix after review.
- Treat one-step-only preview as blocking.
- Treat animation ticks creating operation history as blocking.
- Treat Quick Tune committing on every frame/pointer move as blocking.
- Treat raw solver summary visible in normal Group Inspector as blocking.
- Treat hidden Viewer playback implementation as forbidden scope.

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
- Must not implement unrelated authoring or Viewer playback features.

Review-Sylph:

- Reviews from artifacts and source, not only from Gnome summary.
- Must produce assigned lane report.
- Spec Compliance Review must not silently treat basis omissions as future scope.
- Must check forbidden scope, preview loop semantics, history boundaries, Quick Tune commit behavior, and hidden raw summary explicitly.

Waiting rule:

- `wait_agent` timeout is polling timeout, not failure.
- No parent agent may terminate a child agent's work merely because it has not responded yet.
- If interruption is unavoidable, record incomplete / blocked / escalated. Do not pass the wave gate.

## 15. Out of Scope

- Viewer runtime playback/time progression.
- Viewer reset simulation/pause/playback controls.
- Frame stepping.
- Multi-pendulum simulation or authoring.
- Multiple outputs per Dynamics Group.
- Mixer / same-output multi-group blending.
- Dynamics-owned output Viewer UI.
- Product Preflight Dynamics validation expansion unless required by touched code.
- Save/load schema or portable project format changes.
- Keyform/deformer/mesh behavior changes.
- Mesh generation changes.
- Additional performance optimization beyond preserving Wave82 behavior.
- React context split.
- Dirty graph evaluation.
- Persistent WebGL buffers, mask cache, worker/offscreen rendering.
- Runtime-core textured render scene integration.
- Texture Atlas Task.
- screenshot / export.
- Compare / Diff.
- External HTTP/WebSocket/MCP transport.
- New external dependencies.
- Cubism SDK / `.moc3` / `.model3.json` / `.physics3.json` compatibility.
