# Wave 82 Plan: Parameter Scrub Performance v1 + Dynamics Inspector Follow-up

> Wave81でDynamics Tool v0が入り、次に触るべき本筋は「parameterを動かした時に完成/編集中の見え方が重い」問題である。Wave82は性能改善を2段に分けた前半として、低リスクな入力coalescing、no-op guard、texture signature memoization、計測hookを入れ、合わせてDynamics Inspectorの初期/通常状態をGroups一覧中心に整える。

## 1. Status

- Status: Planned / ready for orchestration
- Target wave: Wave82
- Wave name: `parameter-scrub-performance-v1-dynamics-inspector-followup`
- Primary objective:
  - Parameter Bar、Viewer Runtime Controls、Dynamics preview driverのlive slider更新を軽くする。
  - 同じ値への更新をno-op化し、不要なReact state更新とCanvas再評価を避ける。
  - slider drag中の更新を`requestAnimationFrame`でcoalesceし、pointer up / blurでfinal flushする。
  - unchanged texture bytesのcontent signatureをidentity-basedにmemoizeし、毎frame byte hashを避ける。
  - dev flag配下にperformance instrumentationを追加し、改善前後を比較できるようにする。
  - Dynamics Tool Inspectorの初期/通常状態を「Dynamics Groups list + New Group」のみにし、group row選択でPreview中心のgroup inspector、New/Editでcreate/edit formに遷移する。
  - React context分割、dirty graph evaluation、WebGL persistent buffer化、mask cache、Dynamics時間経過loop、Viewer playbackはWave82対象外。

## 2. Planning Gate Result

Planning Gate result: `Plan directly`.

Why planning is now safe:

- Read-only Sylph performance inventoryで、parameter sliderの重さはhistory commitではなく、live value changeごとの広いstate update、Canvas full evaluation/projection/render、texture byte hash、mesh upload allocationにあると確認した。
- User decisions are explicit:
  - 性能改善は2waveに分ける。
  - Wave82は低リスクな入力・描画パス改善を先に扱う。
  - `requestAnimationFrame` coalescingによる最大1frame遅れは許容する。
  - texture byte arrayはsession中immutableとみなし、identity-based memoizationしてよい。
  - Dynamics時間経過preview/playbackは後で考える。
  - Dynamics Toolの通常状態はGroups一覧とNew Groupだけにし、group選択で個別Inspectorへ進む。
- Existing docs reflect the UX direction:
  - [Dynamics Tool Component Spec](../../design/screen-design/components/dynamics-tool.md) was updated to describe List / Existing Group Inspector / Create / Edit states.
  - [Wave81 Dynamics Time Progression Status](../waves/wave81/wave81-dynamics-time-progression-status.md) records that continuous dynamics playback is not part of Wave81/Wave82 follow-up unless explicitly planned.

Uncertainty:

- factual: medium. Exact hot spots need instrumentation to quantify; the implementation paths are known enough to start.
- decision: low. The first-wave optimization boundary and Dynamics UX follow-up are settled.
- cost of wrong plan: medium. Overreaching into dirty-graph/WebGL architecture would distort the wave; under-scoping to only UI polish would miss the main performance issue.

## 3. Accepted Decisions / Oracles

### 3.1 Performance Wave Meaning

- Wave82 is the first performance-improvement wave for live parameter scrubbing.
- It targets unnecessary updates and repeated static work before deeper architecture changes.
- It must preserve current visual semantics.
- It must not change parameter/keyform/deformer/Dynamics authoring meaning.
- It must not persist live preview values differently from current behavior.
- It must produce measurement hooks, not just subjective "feels faster" claims.

### 3.2 rAF Coalescing Policy

- Live slider/range scrubbing may be coalesced to at most one applied update per animation frame.
- The latest scrubbed value wins.
- Pointer up, pointer cancel, blur, and keyboard/input finalization must flush the latest value.
- Coalescing must not lose the final user-selected value.
- Coalescing must not create operation history entries.
- Numeric input typing may remain immediate if coalescing it would harm editability; no-op guards still apply.

### 3.3 No-op Guard Policy

- Updating a parameter/preview override to the same clamped value should be a no-op.
- No-op guards should be placed as low as practical in provider/model helpers so both UI and future callers benefit.
- Guards must cover:
  - Authoring Parameter Bar `parameterValues`;
  - Viewer Runtime Controls override values;
  - Dynamics Tool preview driver values.
- Guards should preserve existing clamping/default-removal semantics.

### 3.4 Texture Signature Memoization Policy

- Texture bytes are treated as immutable within a session/revision.
- Content signature computation may be memoized by stable byte-array identity or stable asset identity.
- Memoization must not cause changed image bytes to reuse a stale signature if the byte-array identity changes.
- Texture upload cache semantics must remain correct.
- No new dependency is allowed for hashing or memoization.

### 3.5 Performance Instrumentation Policy

- Instrumentation must be disabled by default.
- A dev flag such as `window.__LIVE2D_PERF__ === true` or `localStorage.live2dPerf === "1"` may enable it.
- Instrumentation should avoid visible UI changes.
- Minimum counters/timings:
  - slider raw events;
  - applied updates;
  - skipped no-op updates;
  - rAF coalesced updates;
  - Canvas projection/evaluation total timing;
  - texture signature cache hits/misses and bytes hashed;
  - render mesh upload or WebGL buffer update counts where practical.
- Reports should include before/after evidence where practical, or explain why only instrumentation evidence was possible.

### 3.6 Dynamics Inspector Follow-up Policy

- Dynamics Tool initial/normal Inspector state shows only:
  - Dynamics Tool context header;
  - existing Dynamics Groups list;
  - `New Group` button.
- It must not show Settings / Inputs / Pendulum / Outputs / Validation / Preview until a group is opened or a create/edit flow starts.
- Selecting a saved group row opens Existing Group Inspector:
  - group name / enabled status;
  - Preview controls and output summary;
  - `Edit` action;
  - `Delete Group` action.
- `New Group` opens Create Group Inspector:
  - settings / inputs / advanced normalization / pendulum / output / validation;
  - `Create` and `Cancel`.
- `Edit` opens Edit Group Inspector:
  - same editable sections as create;
  - `Apply` and `Cancel`.
- This follow-up must not implement Dynamics time progression loop or Viewer playback.

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
- [Wave80 Final Clean Integration Review](../reviews/wave80/wave80-final-clean-integration-review.md)
- [Wave81 Plan](wave81-plan.md)
- [Wave81 Final Integration Report](../waves/wave81/wave81-final-integration-report.md)
- [Wave81 Final Clean Integration Review](../reviews/wave81/wave81-final-clean-integration-review.md)
- [Wave81 Dynamics Time Progression Status](../waves/wave81/wave81-dynamics-time-progression-status.md)

Relevant implementation facts from read-only inventory:

- Authoring Parameter Bar slider currently calls `setActiveParameterValue(...)` for every pointer/range move.
- `setActiveParameterValue(...)` updates local preview state, not operation history.
- `EditorSessionContext` value changes can rerender broad `useEditorSession()` consumers.
- `CanvasPreviewPanel` recomputes `createCanvasRenderProjection(...)` whenever the effective parameter map changes.
- Canvas evaluation currently rebuilds maps, evaluates keyforms, walks drawables/rig controls, transforms vertices, computes bounds/visibility/masks, and sorts drawables.
- Normal parameter ticks do not regenerate mesh topology, but evaluated mesh data is cloned/transformed/packed/uploaded.
- WebGL texture upload cache can avoid re-upload, but texture content signatures are currently recomputed by hashing bytes during render scene construction.
- Viewer Runtime Controls use local override state, but feed the same projection/evaluation/rendering path.
- Dynamics preview driver scrubbing produces a Dynamics effective parameter map and feeds the same Canvas path.

Likely implementation areas:

- `apps/editor/src/workspace/panels/parameter-bar.tsx`
- `apps/editor/src/workspace/viewer/runtime-controls.tsx`
- `apps/editor/src/workspace/viewer/runtime-controls-state.ts`
- `apps/editor/src/workspace/panels/dynamics-tool-inspector.tsx`
- `apps/editor/src/features/editor-session/editor-session-context.tsx`
- `apps/editor/src/features/editor-session/model/dynamics-tool-state.ts`
- `apps/editor/src/workspace/panels/canvas-preview-panel.tsx`
- `apps/editor/src/workspace/canvas/canvas-projection.ts`
- `apps/editor/src/workspace/canvas/canvas-evaluation.ts`
- `apps/editor/src/workspace/canvas/canvas-render-scene-adapter.ts`
- `packages/render-core/src/texture-signature.ts`
- `packages/render-webgl2/src/webgl2-renderer.ts`
- Focused tests near touched files

## 5. Review Policy

Each implementation domain requires three review lanes unless explicitly documented as not applicable:

1. `Spec Compliance Review`
   - Check every Wave82 requirement and every explicit non-goal.
   - Treat missing final flush or lost slider value as blocking.
2. `Design / Development Compliance Review`
   - Check source boundaries, session-only preview behavior, no operation-history pollution, dev-flag behavior, and forbidden scope.
3. `Test Adequacy Review`
   - Check no-op guards, rAF coalescing/final flush, texture signature memoization, instrumentation coverage, and Dynamics Inspector state transitions.

Domain reports must include:

- Basis Coverage Self-Report
- Performance Pipeline Trace
- Input Coalescing Trace
- No-op Guard Trace
- Texture Signature Memoization Trace
- Instrumentation Trace
- Dynamics Inspector UX Trace
- Must-not Compliance Evidence
- Residual Risk Classification

## 6. Wave Strategy

```text
Batch 1:
  Domain A: Parameter Scrub Performance v1 + Dynamics Inspector Follow-up

Batch 2:
  Domain B: Final Integration / Clean Review / Map Closeout
```

Dependency rationale:

- The source changes are compact but cross-cutting across slider UI, provider/model guards, render-core memoization, and Dynamics Inspector state.
- Splitting Dynamics Inspector follow-up from slider coalescing would likely create file overlap in `dynamics-tool-inspector.tsx`.
- Splitting no-op/rAF/texture memoization into separate domains would increase review cost without isolating much risk.
- Deeper architecture work is intentionally deferred to a later wave.
- Domain B runs only after Domain A is pass-classified or explicit escalation is recorded.

## 7. Acceptance Criteria

### 7.1 Authoring Parameter Bar Scrub Performance

Required:

- Slider/range drag is coalesced with `requestAnimationFrame` or equivalent frame-bound scheduling.
- The final value is flushed on pointer up, pointer cancel, blur, or equivalent completion event.
- Updating to the same clamped parameter value is a no-op.
- Scrubbing still updates Canvas preview.
- Scrubbing still respects parameter min/max/step behavior.
- Scrubbing does not create operation history entries.
- Existing keyform marker and parameter selection behavior remain intact.

Must not:

- Drop the last scrubbed value.
- Change authored keyform data.
- Disable keyboard-accessible slider/value editing.
- Persist live preview state differently.
- Introduce global throttling that affects non-slider authoring operations.

### 7.2 Viewer Runtime Controls Scrub Performance

Required:

- Viewer Runtime Controls slider/range updates are coalesced with the same policy where practical.
- Updating an override to the same effective value is a no-op.
- Default-valued overrides still remove override entries.
- `Reset all` and row reset behavior from Wave80 remains intact.
- Viewer overrides remain session-only.
- Viewer Clean Stage still updates from runtime controls.

Must not:

- Mutate Authoring `ParameterBar` state.
- Persist Viewer overrides.
- Reintroduce removed `Reset changed` UI.
- Change Viewer screen responsibilities.

### 7.3 Dynamics Preview Driver Scrub Performance

Required:

- Dynamics preview driver slider/range updates are coalesced with the same policy where practical.
- Updating a preview driver to the same clamped value is a no-op.
- Dynamics preview state remains session-only.
- Preview scrubbing still updates Canvas with Dynamics effective parameter map.
- Preview reset still resets simulation state.
- No operation history entries are created from preview scrubbing.

Must not:

- Implement continuous Dynamics animation loop.
- Implement Viewer Dynamics playback/time progression.
- Persist preview state.
- Re-enable normal Parameter Bar editing while `activeTool === "dynamics"`.

### 7.4 Texture Signature Memoization

Required:

- Unchanged texture byte arrays/assets do not require full byte hashing on every render scene construction.
- Memoization preserves correctness when byte-array identity changes.
- Texture cache hit/miss semantics remain correct.
- Tests cover repeated signature calls returning the same signature without repeated hashing where observable.
- No external dependency is added.

Must not:

- Reuse stale signatures for changed texture bytes.
- Disable texture upload cache.
- Change visible rendering semantics.
- Assume cross-session global persistence.

### 7.5 Performance Instrumentation

Required:

- Instrumentation is disabled by default.
- A documented dev flag enables counters/timings.
- Instrumentation records enough data to compare slider scrubbing before/after:
  - raw events;
  - applied updates;
  - skipped no-op updates;
  - coalesced updates;
  - projection/evaluation timing;
  - texture signature cache hits/misses or bytes hashed;
  - render/WebGL upload counts where practical.
- Instrumentation must be lightweight when disabled.
- Domain report records how to enable it and what evidence was observed.

Must not:

- Add visible product UI.
- Spam console/log output when disabled.
- Persist telemetry.
- Send data over network.

### 7.6 Dynamics Inspector List / Group / Create / Edit States

Required:

- Opening Dynamics Tool initially shows the list state:
  - Dynamics Tool header/context;
  - Dynamics Groups list;
  - `New Group` button.
- Initial/list state does not show Settings, Inputs, Advanced, Pendulum, Outputs, Validation, Preview, Apply, or Delete controls.
- Clicking an existing group opens Existing Group Inspector with preview and actions.
- Existing Group Inspector has a way back to Groups list.
- Existing Group Inspector exposes `Edit` and `Delete Group`.
- Clicking `Edit` opens Edit Group Inspector with editable form and `Apply`/`Cancel`.
- Clicking `New Group` opens Create Group Inspector with editable form and `Create`/`Cancel`.
- Cancel returns to the appropriate prior state without committing changes.
- Create/update/delete behavior remains operation-backed where it was already committed behavior.

Must not:

- Add a global `EditorSelection` kind for Dynamics Group.
- Put Dynamics Group management in Parameter Manager.
- Mix list state and edit form by default.
- Implement Dynamics time progression playback.

## 8. Domain Design

| Batch | Domain | Dependency | Purpose |
|---|---|---|---|
| 1 | A. Parameter Scrub Performance v1 + Dynamics Inspector Follow-up | Wave81 pass baseline | Add low-risk scrub performance improvements, texture signature memoization, instrumentation, and Dynamics Inspector state cleanup |
| 2 | B. Final Integration / Clean Review / Map Closeout | Domain A pass or explicit escalation | Combined validation, clean review, reports/maps |

## 9. Domain A: `wave82-parameter-scrub-performance-v1-dynamics-inspector-followup`

Purpose:

- Make live parameter scrubbing lighter without changing model semantics, and finish the Dynamics Inspector state model follow-up.

Expected implementation areas:

- `apps/editor/src/workspace/panels/parameter-bar.tsx`
- `apps/editor/src/workspace/viewer/runtime-controls.tsx`
- `apps/editor/src/workspace/viewer/runtime-controls-state.ts`
- `apps/editor/src/workspace/panels/dynamics-tool-inspector.tsx`
- `apps/editor/src/features/editor-session/editor-session-context.tsx`
- `apps/editor/src/features/editor-session/model/dynamics-tool-state.ts`
- `apps/editor/src/workspace/panels/canvas-preview-panel.tsx`
- `apps/editor/src/workspace/canvas/canvas-projection.ts`
- `apps/editor/src/workspace/canvas/canvas-evaluation.ts`
- `apps/editor/src/workspace/canvas/canvas-render-scene-adapter.ts`
- `packages/render-core/src/texture-signature.ts`
- `packages/render-webgl2/src/webgl2-renderer.ts`
- Focused tests near touched files

Allowed write scope:

- `apps/editor/src/**`
- `packages/render-core/src/**`
- `packages/render-webgl2/src/**`
- Focused tests for touched files
- `discussion/implementation/waves/wave82/**`
- `discussion/implementation/reviews/wave82/**`

Conditional write scope, requiring explicit report justification:

- `packages/runtime-core/**` only if a shared runtime/evaluation helper is needed for instrumentation boundaries.
- `packages/render-core/**` outside texture signature only if memoization needs a small shared helper.
- `scripts/**` only if an existing guard/check must be updated for new instrumentation naming.

Forbidden write scope:

- Save/load schema or portable project format
- Operation payload/schema changes
- Keyform/deformer/mesh behavior changes
- Mesh generation algorithms
- React context architecture split
- Dirty graph evaluation
- Persistent WebGL drawable buffers / `bufferSubData` architecture
- Mask render caching
- Worker/offscreen rendering
- Dynamics continuous animation loop
- Viewer runtime playback/time progression
- New external dependencies
- Cubism SDK/runtime/export compatibility

Required tests / evidence:

- Authoring Parameter Bar no-op guard skips same-value updates.
- Authoring slider coalescing applies the latest value and flushes final value.
- Viewer Runtime Controls no-op/coalescing preserves reset/default semantics.
- Dynamics preview driver no-op/coalescing preserves preview update/reset semantics.
- Scrubbing does not create operation history entries.
- Texture signature memoization avoids repeated hashing for same byte-array identity and recomputes for changed identity.
- Instrumentation is disabled by default and enabled by documented dev flag.
- Instrumentation counters/timings are test-covered where practical or source-review evidenced where browser timing APIs are hard to assert.
- Dynamics Tool initial state shows only Groups list + New Group.
- Existing group/create/edit/cancel/apply/delete state transitions work.
- Existing focused Viewer/Dynamics/ParameterBar tests remain passing.

Early escape triggers:

- rAF coalescing breaks keyboard accessibility or loses final values.
- Same-value no-op guards conflict with current reset/default-removal semantics.
- Texture byte identity is not stable enough to memoize safely.
- Instrumentation requires invasive global state or visible product UI.
- Dynamics Inspector state cleanup requires global EditorSelection or a broad navigation model.
- Performance improvement requires React context split or WebGL buffer architecture to produce any measurable benefit.

## 10. Domain B: `wave82-final-integration-clean-review-map-closeout`

Purpose:

- Validate combined Wave82 behavior, obtain independent clean review, and update persistent maps/reports.

Expected implementation areas:

- `discussion/implementation/waves/wave82/**`
- `discussion/implementation/reviews/wave82/**`
- `discussion/implementation/_map.md`
- `discussion/implementation/orchestration/_map.md`

Acceptance:

- Domain A report exists and records `pass` or explicit escalation.
- Required review lanes exist and pass, or explicit escalation is recorded.
- Final clean integration review exists and passes before Wave82 is marked complete.
- Final report records:
  - no-op guard behavior;
  - rAF coalescing/final flush behavior;
  - texture signature memoization behavior;
  - instrumentation usage/evidence;
  - Dynamics Inspector state cleanup;
  - operation/history non-mutation proof;
  - forbidden scope compliance;
  - validation results;
  - residual risks and recommended Wave83 boundary.
- Maps mark Wave82 status correctly.

Required checks:

- `pnpm typecheck`
- Focused Parameter Bar tests
- Focused Viewer Runtime Controls tests
- Focused Dynamics Tool Inspector tests
- Focused Dynamics preview state/history tests
- Focused texture signature/render-core tests
- Focused Canvas projection/render instrumentation tests where practical
- `node scripts/check-source-organization.mjs`
- `node scripts/check-dependencies.mjs`
- `git diff --check`

## 11. Verification Matrix

| Requirement | Minimum evidence |
|---|---|
| Authoring same-value scrub no-op | Provider/model or Parameter Bar test |
| Authoring rAF coalesces updates | Parameter Bar test with fake timers/rAF |
| Authoring final value flushes | Pointer up/blur test |
| Viewer same-value override no-op | Runtime Controls state/component test |
| Viewer rAF preserves reset/default semantics | Runtime Controls test |
| Dynamics preview driver no-op | Dynamics tool state test |
| Dynamics preview rAF flushes latest value | Dynamics Inspector test |
| Scrub does not create history entries | Editor session history test |
| Texture signature memoized | render-core unit test |
| Texture identity change recomputes | render-core unit test |
| Instrumentation disabled by default | unit/source review evidence |
| Instrumentation dev flag works | focused unit/component test where practical |
| Dynamics Tool list state is minimal | Dynamics Inspector test |
| Group row opens preview inspector | Dynamics Inspector test |
| New/Edit open editable form | Dynamics Inspector test |
| Cancel does not commit | Dynamics Inspector/model test |
| Continuous Dynamics playback deferred | Final report forbidden-scope evidence |

## 12. Expected Persistent Artifacts

Reports:

- `discussion/implementation/waves/wave82/wave82-domain-a-parameter-scrub-performance-v1-dynamics-inspector-followup-report.md`
- `discussion/implementation/waves/wave82/wave82-final-integration-report.md`
- `discussion/implementation/waves/wave82/_map.md`

Reviews:

- `discussion/implementation/reviews/wave82/wave82-domain-a-spec-compliance-review.md`
- `discussion/implementation/reviews/wave82/wave82-domain-a-design-development-review.md`
- `discussion/implementation/reviews/wave82/wave82-domain-a-test-adequacy-review.md`
- `discussion/implementation/reviews/wave82/wave82-final-clean-integration-review.md`
- `discussion/implementation/reviews/wave82/_map.md`

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
- Preserve Wave80 Viewer behavior and Wave81 Dynamics behavior.
- Treat this as performance v1, not full renderer architecture work.
- Prefer small shared helpers only when they reduce duplication across Parameter Bar / Runtime Controls / Dynamics preview.
- Keep all preview/override values session-only as before.
- Do not implement Dynamics continuous animation, Viewer playback/time progression, React context split, dirty graph evaluation, WebGL persistent buffers, mask cache, worker/offscreen rendering, mesh generation, deformer/keyform behavior changes, save/load schema changes, or new dependencies.

Review-Sylph instructions must include:

- Review from source, tests, plan, and reports, not only from Gnome summary.
- Report `pass`, `needs_changes`, or `escalate`.
- Do not ask the user directly.
- Do not edit files unless explicitly delegated a narrow fix after review.
- Treat lost final slider value as blocking.
- Treat operation-history pollution from scrubbing as blocking.
- Treat instrumentation enabled by default or visible product telemetry as blocking.
- Treat Dynamics Inspector showing the edit form in initial/list state as blocking.
- Treat hidden implementation of continuous Dynamics playback as forbidden scope.

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
- Must not implement architecture-deep performance work or unrelated authoring features.

Review-Sylph:

- Reviews from artifacts and source, not only from Gnome summary.
- Must produce assigned lane report.
- Spec Compliance Review must not silently treat basis omissions as future scope.
- Must check forbidden scope, final flush, history boundaries, and disabled-by-default instrumentation explicitly.

Waiting rule:

- `wait_agent` timeout is polling timeout, not failure.
- No parent agent may terminate a child agent's work merely because it has not responded yet.
- If interruption is unavoidable, record incomplete / blocked / escalated. Do not pass the wave gate.

## 15. Out of Scope

- React context split or external store migration.
- Dirty graph evaluation by affected parameter/deformer subtree.
- Persistent WebGL per-drawable buffers, index-buffer reuse, and `bufferSubData` architecture.
- Mask render caching.
- Worker/offscreen rendering.
- Moving Editor Canvas onto runtime-core full parity.
- Runtime-core textured render scene integration.
- Full runtime parity.
- Dynamics continuous animation loop.
- Viewer Dynamics playback/time progression.
- Viewer reset simulation/pause/playback controls.
- Frame stepping.
- Multi-pendulum or multi-output Dynamics authoring.
- Mixer / same-output multi-group blending.
- Texture Atlas Task.
- Mesh generation changes.
- Deformer editing changes.
- Keyform authoring behavior changes.
- Save/load schema or portable project format changes.
- screenshot / export.
- Compare / Diff.
- External HTTP/WebSocket/MCP transport.
- New external dependencies.
- Cubism SDK / `.moc3` / `.model3.json` / `.physics3.json` compatibility.
