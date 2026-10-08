# Wave 79 Plan: Viewer / Runtime View v0

> Wave78でWarp Deformerのkeyed scale handlesまで到達し、手動rig編集の基礎操作は一段落した。Wave79はAuthoring Workspaceから離れた専用Viewer / Runtime Viewを追加し、編集overlayなしで「完成品としてどう見えるか」を確認できる最初の画面を実装する。

## 1. Status

- Status: Planned / ready for orchestration
- Target wave: Wave79
- Wave name: `viewer-runtime-view-v0`
- Primary objective:
  - Authoring Workspaceから専用Viewer screenを開けるようにする。
  - ViewerにClean Stageを置き、現在のcommitted modelを編集overlayなしで表示する。
  - ViewerにRuntime Controlsを置き、session-only parameter overrideで完成品の見え方を確認できるようにする。
  - Viewer中はAuthoring Parameter Barやkeyform authoring UIを出さない。
  - Viewer v0は現在のEditor Canvas evaluationに合わせる。runtime-core完全parity、grid2d完全統合、dynamics再生は後続に回す。

## 2. Planning Gate Result

Planning Gate result: `Inventory first`, then `Plan directly`.

Why planning is now safe:

- Viewer / Runtime Viewの画面仕様は [viewer-runtime-view.md](../../design/screen-design/screens/viewer-runtime-view.md) に差し替え済み。
- Read-only Sylph Aが、既に`viewer` entryは存在し、専用screen branchが未接続であることを確認した。
- Read-only Sylph Bが、Clean Stageは新rendererではなく`createCanvasRenderProjection` + `renderCanvasProjection`を再利用するのが安全であることを確認した。
- Read-only Sylph Cが、Runtime Controlsは既存Parameter Barのauthoring UIを再利用せず、値計算/helperだけを借りたsession-only override UIにすべきことを確認した。
- User decisions are explicit:
  - Viewer v0は作品確認画面であり、authoring / diagnostics / export画面ではない。
  - Viewer中はAuthoring `ParameterBar`を出さない。
  - Viewer v0は現在のEditor Canvas evaluationとの一致を優先する。
  - runtime-coreの完全parity、grid2d完全評価、dynamics再生はWave79の対象外。
  - computedDynamics系parameterはv0 Runtime Controlsから除外する。
  - parameter group / category filter、favorite parameter、screenshot / export、Compare / Diff、presentation frame / crop guideは実装しない。

Uncertainty:

- factual: medium. Existing renderer can suppress major overlays, but `drawOrigin` is currently always drawn when using `renderCanvasProjection`.
- decision: low. UX decisions are settled.
- cost of wrong plan: high. ViewerをCanvas Panel丸ごと再利用またはruntime-core統合として扱うと、authoring UI混入か過大実装になる。

## 3. Accepted Decisions / Oracles

### 3.1 Viewer Meaning

- Viewer / Runtime View is a dedicated screen for finished-model visual confirmation.
- It is not an authoring surface.
- It is not a diagnostics surface.
- It does not edit mesh, deformer, keyform, parameter definitions, hierarchy, clipping, opacity, or project storage.
- It does not persist session parameter overrides.

### 3.2 Display Policy

- Clean Stage shows committed model state with session-only parameter overrides.
- Clean Stage must not show:
  - mesh overlay;
  - deformer lattice;
  - selection bounds;
  - control points;
  - warp scale handles;
  - mesh draft / rig draft;
  - layer bounds;
  - hit-test debug;
  - authoring toolbar affordances.
- Initial background is `neutral solid gray`.
- Background selection may include dark / light / checker if cheap, but neutral gray is the required default.
- Runtime status is not persistent. Empty/error state appears only if drawing cannot happen.

### 3.3 Runtime Controls Policy

- Runtime Controls are the main operation surface.
- Runtime Controls include:
  - parameter name search at the top;
  - sliders;
  - numeric inputs;
  - changed indication;
  - row reset where practical;
  - reset changed / reset all;
  - Future Playback Slot placeholder at the bottom.
- Runtime Controls do not include:
  - parameter group / category filter;
  - favorite/pinned parameters;
  - keyform add/update/delete;
  - Parameter Manager definition editing;
  - authoring Parameter Bar controls.
- Session state should be shaped like:

```text
parameterOverrides: Partial<Record<ParameterId, number>>
search: string
futureSimulationState: separate later, not implemented in v0
```

- Default-valued parameter entries should be removed from `parameterOverrides`.
- `reset changed` and `reset all` must only update Viewer local state.
- Runtime Controls must not call operation-core mutation, `editKeyformKey`, history commit helpers, save/load project operations, or parameter definition commands.
- `computedDynamics` parameters are excluded from editable Runtime Controls in v0.

### 3.4 Runtime Parity Boundary

Wave79 intentionally targets:

```text
Authoring Canvas current committed/evaluated result
= Viewer v0 current committed/evaluated result, minus authoring overlays
```

Wave79 does not target:

```text
runtime-core semantic evaluator complete parity
grid2d keyform parity
dynamics / physics playback parity
standalone runtime package rendering parity
```

Reason:

- The user value of Wave79 is first finished-model confirmation in the current Editor.
- Runtime engine integration is a later, larger boundary.

### 3.5 Navigation / Authoring Context

- Viewer is reached through existing `viewer` workspace entry.
- The standalone App Bar Viewer icon must activate the same path as the normal Viewer entry.
- Returning from Viewer should preserve existing authoring context by keeping providers/stores mounted and not resetting:
  - selection;
  - active tool;
  - active parameter;
  - authoring parameter values.
- Viewer must not modify `activeTool` just to hide authoring UI.

## 4. Primary Basis

Common:

- [Implementation Orchestration Skill](../../../.agents/skills/implementation-orchestration/SKILL.md)
- [UX-Backed Package Logic Authority](../../development_convention/ux-backed-package-logic-authority.md)
- [Source File Organization Policy](../../development_convention/source-file-organization-policy.md)
- [Dependency Policy](../../development_convention/dependency-policy.md)
- [Operation Policy](../../development_convention/operation-policy.md)
- [Schema and ID Conventions](../../development_convention/schema-and-id-conventions.md)

Screen / UX basis:

- [Viewer / Runtime View Screen Spec](../../design/screen-design/screens/viewer-runtime-view.md)
- [Screen Design Map](../../design/screen-design/_map.md)
- [Screen Specs Map](../../design/screen-design/screens/_map.md)
- [React Editor Foundation Oracle](../../design/screen-design/react-editor-foundation-oracle.md)
- [E2E Oracle](../../design/screen-design/e2e-oracle.md)

Wave baseline:

- [Wave78 Plan](wave78-plan.md)
- [Wave78 Final Integration Report](../waves/wave78/wave78-final-integration-report.md)
- [Wave78 Final Clean Integration Review](../reviews/wave78/wave78-final-clean-integration-review.md)

Relevant implementation facts from read-only inventory:

- `viewer` already exists in `WorkspaceEntryId`.
- `taskEntries` already includes Viewer metadata.
- `AuthoringWorkspaceContent` currently special-cases `parameters` and `storage`; `viewer` falls through to normal Authoring Workspace.
- App Bar has a right-side Viewer icon that is currently not wired.
- `CanvasPreviewPanel` should not be reused wholesale because it owns authoring toolbar, overlay toggles, selection hit-testing, and active-tool coupling.
- Clean rendering should reuse lower-level projection/render functions:
  - `createCanvasRenderProjection`
  - `createCanvasEvaluatedScene`
  - `renderCanvasProjection`
- Existing `CanvasOverlayState` gates major overlays, but `drawOrigin` may need an explicit clean-stage suppression path.
- Existing parameter value math can selectively reuse:
  - `listEditorParameters`
  - `clampParameterValue`
  - `formatParameterValue`
  - slider projection helpers if extracted safely.

## 5. Review Policy

Each implementation domain requires three review lanes unless explicitly documented as not applicable:

1. `Spec Compliance Review`
   - Check every Viewer v0 requirement and every explicit non-goal.
   - `unclear` is not pass.
2. `Design / Development Compliance Review`
   - Check source boundaries, module ownership, session-only state separation, renderer reuse, UI semantics, and forbidden scope.
3. `Test Adequacy Review`
   - Check route, clean rendering, runtime controls, no authoring mutation, and regression coverage.

Domain reports must include:

- Basis Coverage Self-Report
- User-Facing UX Trace
- Runtime Controls State Contract Trace
- Clean Stage / Overlay Suppression Trace
- Must-not Compliance Evidence
- Residual Risk Classification

## 6. Wave Strategy

```text
Batch 1:
  Domain A: Clean Stage Render Foundation
  Domain B: Runtime Controls Session State + UI Foundation

Batch 2:
  Domain C: Dedicated Viewer Screen Integration

Batch 3:
  Domain D: Final Integration / Clean Review / Map Closeout
```

Dependency rationale:

- Domain A and B can proceed in parallel if they keep write scopes disjoint.
- Domain A owns reusable clean render behavior and overlay suppression below the screen layer.
- Domain B owns Viewer parameter override state, filtering, reset, and controls below the screen integration layer.
- Domain C depends on A/B to wire the dedicated screen, navigation, layout, and no-Authoring-ParameterBar behavior.
- Domain D runs after A-C pass or explicit escalation.

## 7. Acceptance Criteria

### 7.1 Dedicated Viewer Navigation

Required:

- `viewer` workspace entry opens a dedicated Viewer / Runtime View screen.
- The right-side App Bar Viewer icon opens the same screen.
- Viewer has a Back action to return to Authoring Workspace.
- Returning preserves current authoring selection/tool/parameter context by not resetting existing providers/stores.
- Viewer does not render Authoring `ParameterBar`.
- Viewer does not show Authoring Workspace panels as its primary layout.

Must not:

- Add URL routing as part of Wave79.
- Reset active tool/selection/active parameter on Viewer open/close.
- Use a modal as the canonical Viewer UI.

### 7.2 Clean Stage

Required:

- Clean Stage displays the current committed model.
- Clean Stage applies Viewer session parameter overrides.
- Clean Stage uses existing Canvas evaluation/rendering lower-level paths where practical.
- Initial background is neutral solid gray.
- Basic view controls exist or existing fit/zoom/pan behavior is reused where practical.
- Clipping, opacity, mesh, deformer, and linear keyform evaluation are preserved through the current Editor Canvas evaluation path.
- Empty/error state is shown only when drawing cannot happen.

Must not:

- Show mesh overlay.
- Show deformer lattice.
- Show selection bounds.
- Show control points.
- Show scale handles.
- Show mesh/rig draft preview.
- Show layer bounds or origin guide in Clean Stage.
- Bypass existing clipping/mask rendering.
- Use mesh preview path that disables clipping.

### 7.3 Runtime Controls

Required:

- Runtime Controls show parameter name search at the top.
- Runtime Controls list editable non-computedDynamics parameters.
- Sliders and numeric inputs clamp to parameter min/max.
- Changed parameters are visually indicated.
- Default-valued overrides are removed from the override map.
- Row reset, reset changed, and reset all update only Viewer local state.
- Future Playback Slot appears at the bottom with non-interactive placeholder such as `Motion / Physics: Not configured`.
- Runtime Controls feed session-only overrides into Clean Stage rendering.

Must not:

- Show parameter group / category filter.
- Show favorite/pinned parameter UI.
- Add/update/delete keyforms.
- Mutate `EditorSessionProvider.parameterValues`.
- Commit operations to project history.
- Persist Viewer overrides in save/load.
- Expose computedDynamics parameters as editable controls in v0.

### 7.4 Runtime Parity Boundary

Required:

- Viewer v0 matches current Editor Canvas evaluation for committed model state and session parameter overrides, minus authoring overlays.
- Any mismatch risk with runtime-core semantic evaluator is recorded as residual risk, not silently solved by broad integration.

Must not:

- Implement runtime-core textured render scene integration.
- Implement grid2d keyform parity unless it is already supported by current Editor Canvas evaluation.
- Implement dynamics / physics playback.
- Add transport/export/runtime package app responsibilities.

## 8. Domain Design

| Batch | Domain | Dependency | Purpose |
|---|---|---|---|
| 1 | A. Clean Stage Render Foundation | Wave78 pass baseline | Add/reuse clean render path with overlay/origin suppression and committed model projection |
| 1 | B. Runtime Controls Session State + UI Foundation | Wave78 pass baseline | Add parameter override projection/helpers and Viewer controls without authoring mutation |
| 2 | C. Dedicated Viewer Screen Integration | Domains A-B pass | Wire `viewer` route/screen, layout, App Bar entry, Back action, and parameter override flow |
| 3 | D. Final Integration / Clean Review / Map Closeout | Domains A-C pass or explicit escalation | Combined validation, clean review, reports/maps |

## 9. Domain A: `wave79-clean-stage-render-foundation`

Purpose:

- Provide a reusable Clean Stage render path for Viewer that uses existing Editor Canvas evaluation/rendering without authoring overlays.

Expected implementation areas:

- `apps/editor/src/workspace/canvas/canvas-renderer.ts`
- `apps/editor/src/workspace/canvas/canvas-projection.ts`
- `apps/editor/src/workspace/canvas/canvas-evaluation.ts`
- `apps/editor/src/workspace/canvas/canvas-renderer.test.ts`
- `apps/editor/src/workspace/canvas/canvas-projection.test.ts`
- New `apps/editor/src/workspace/viewer/*clean-stage*` files only if Domain C agrees to own final screen integration separately

Required tests / evidence:

- Clean render can be invoked with no selection and no drafts.
- Mesh/deformer/selection/control-point overlays are absent.
- Origin guide is absent in Clean Stage.
- Clipping/mask path remains preserved.
- Parameter override input changes evaluated/rendered projection without mutating session.
- Existing Canvas renderer/projection tests remain passing.

Early escape triggers:

- Overlay suppression requires broad renderer architecture changes.
- Clipping works only through a path that cannot support clean Viewer rendering.
- Renderer APIs force Authoring `CanvasPreviewPanel` reuse.

## 10. Domain B: `wave79-runtime-controls-session-state-ui-foundation`

Purpose:

- Build Viewer Runtime Controls state and UI primitives with local session-only parameter overrides.

Expected implementation areas:

- `apps/editor/src/workspace/viewer/runtime-controls.tsx`
- `apps/editor/src/workspace/viewer/runtime-controls-state.ts`
- `apps/editor/src/workspace/viewer/runtime-controls.test.tsx`
- `apps/editor/src/features/editor-session/model/parameter-keyform-state.ts` only for safe helper export/extraction
- `apps/editor/src/workspace/panels/parameter-bar.tsx` only for safe helper extraction; do not import the full component into Viewer

Required tests / evidence:

- Parameter name search filters by display name and/or id.
- No group/category filter exists.
- computedDynamics parameters are excluded from editable rows.
- Slider and numeric input clamp values.
- Default-valued rows remove override entries.
- Changed indication appears only for non-default overrides.
- Row reset, reset changed, and reset all work.
- Controls do not call keyform operations, project mutations, or history commit helpers.
- Authoring `parameterValues` are not changed by Viewer controls.

Early escape triggers:

- Parameter helpers are too coupled to Parameter Bar authoring behavior and require broader extraction.
- computedDynamics identification is ambiguous in the current schema.
- Existing parameter definition initialization cannot be safely reused outside Parameter Bar.

## 11. Domain C: `wave79-dedicated-viewer-screen-integration`

Purpose:

- Connect Viewer v0 as a dedicated screen and combine Clean Stage with Runtime Controls.

Expected implementation areas:

- `apps/editor/src/workspace/authoring-workspace.tsx`
- `apps/editor/src/workspace/app-bar.tsx`
- `apps/editor/src/workspace/workspace-data.ts`
- `apps/editor/src/state/editor-ui-store.ts`
- `apps/editor/src/workspace/viewer/viewer-runtime-screen.tsx`
- `apps/editor/src/workspace/viewer/viewer-runtime-screen.test.tsx`
- `apps/editor/src/workspace/app-bar.test.tsx`
- Existing route/screen tests near Parameter Manager / Project Storage patterns
- Focused e2e only if practical and stable

Required tests / evidence:

- Viewer entry opens dedicated screen.
- Right-side App Bar Viewer icon opens same screen.
- Back returns to Authoring Workspace.
- Authoring `ParameterBar` is suppressed while Viewer is active.
- Runtime Controls override Clean Stage output.
- Authoring selection/tool/active parameter context is preserved after returning.
- Viewer screen does not expose keyform add/update/delete UI.
- Viewer screen does not expose authoring overlay toggles.
- Future Playback Slot is present but non-interactive.

Early escape triggers:

- Existing `activeEntry` model cannot distinguish route vs launcher state without broad redesign.
- Suppressing Parameter Bar requires restructuring the entire workspace shell.
- Viewer integration collides with unrelated Wave78 dirty changes in a way that cannot be resolved locally.

## 12. Domain D: `wave79-final-integration-clean-review-map-closeout`

Purpose:

- Validate combined Wave79 behavior, obtain independent clean review, and update persistent maps/reports.

Expected implementation areas:

- `discussion/implementation/waves/wave79/**`
- `discussion/implementation/reviews/wave79/**`
- `discussion/implementation/_map.md`
- `discussion/implementation/orchestration/_map.md`

Acceptance:

- Domain A-C reports exist and record `pass` or explicit escalation.
- Required review lanes exist and pass, or explicit escalation is recorded.
- Final clean integration review exists and passes before Wave79 is marked complete.
- Final report records:
  - Viewer meaning and non-goals;
  - Clean Stage render path;
  - overlay suppression evidence;
  - Runtime Controls session state contract;
  - authoring state non-mutation proof;
  - route/navigation behavior;
  - runtime parity boundary and residual risks;
  - validation results.
- Maps mark Wave79 status correctly.

Required checks:

- `pnpm typecheck`
- Focused Viewer / Runtime Controls tests
- Focused Canvas renderer/projection/evaluation tests if touched
- Focused App Bar / workspace routing tests
- Focused Playwright smoke if practical
- `node scripts/check-source-organization.mjs`
- `node scripts/check-dependencies.mjs`
- `git diff --check`

## 13. Verification Matrix

| Requirement | Minimum evidence |
|---|---|
| Viewer opens from workspace entry | Component/route test |
| App Bar icon opens Viewer | App Bar test |
| Back preserves context | Component or e2e test |
| Authoring ParameterBar suppressed | Screen test |
| Clean Stage shows committed model | Screen/render test |
| No authoring overlays | Renderer/screen test |
| Origin guide absent | Renderer/screen test |
| Parameter override affects model | Controls + projection/evaluation test |
| Overrides are session-only | State test / no mutation assertion |
| Search filters by name | Runtime Controls test |
| No group/category filter | Screen/controls test |
| computedDynamics excluded | Runtime Controls test |
| Reset changed/all | Runtime Controls test |
| Clipping preserved | Existing renderer/projection tests plus focused regression if touched |
| Runtime-core parity deferred | Final report residual risk |

## 14. Expected Persistent Artifacts

Reports:

- `discussion/implementation/waves/wave79/wave79-domain-a-clean-stage-render-foundation-report.md`
- `discussion/implementation/waves/wave79/wave79-domain-b-runtime-controls-session-state-ui-foundation-report.md`
- `discussion/implementation/waves/wave79/wave79-domain-c-dedicated-viewer-screen-integration-report.md`
- `discussion/implementation/waves/wave79/wave79-final-integration-report.md`
- `discussion/implementation/waves/wave79/_map.md`

Reviews:

- `discussion/implementation/reviews/wave79/wave79-domain-a-spec-compliance-review.md`
- `discussion/implementation/reviews/wave79/wave79-domain-a-design-development-review.md`
- `discussion/implementation/reviews/wave79/wave79-domain-a-test-adequacy-review.md`
- `discussion/implementation/reviews/wave79/wave79-domain-b-spec-compliance-review.md`
- `discussion/implementation/reviews/wave79/wave79-domain-b-design-development-review.md`
- `discussion/implementation/reviews/wave79/wave79-domain-b-test-adequacy-review.md`
- `discussion/implementation/reviews/wave79/wave79-domain-c-spec-compliance-review.md`
- `discussion/implementation/reviews/wave79/wave79-domain-c-design-development-review.md`
- `discussion/implementation/reviews/wave79/wave79-domain-c-test-adequacy-review.md`
- `discussion/implementation/reviews/wave79/wave79-final-clean-integration-review.md`
- `discussion/implementation/reviews/wave79/_map.md`

## 15. Subagent Contract

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
- Preserve Wave78 accepted behavior.
- Do not reuse `CanvasPreviewPanel` wholesale for Viewer.
- Do not reuse full `ParameterBar` for Runtime Controls.
- Do not implement screenshot/export, Compare/Diff, parameter groups, favorite parameters, crop guide, or dynamics playback.
- Keep Viewer overrides session-only.

Review-Sylph instructions must include:

- Review from source, tests, plan, and reports, not only from Gnome summary.
- Report `pass`, `needs_changes`, or `escalate`.
- Do not ask the user directly.
- Do not edit files unless explicitly delegated a narrow fix after review.
- Treat authoring UI leakage into Viewer as blocking unless explicitly justified by the plan.

## 16. Orchestration Policy

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
- Must not implement runtime-core parity expansion, grid2d parity, dynamics playback, export, diff, or authoring operations.

Review-Sylph:

- Reviews from artifacts and source, not only from Gnome summary.
- Must produce assigned lane report.
- Spec Compliance Review must not silently treat basis omissions as future scope.
- Must check forbidden scope and negative cases explicitly.

Waiting rule:

- `wait_agent` timeout is polling timeout, not failure.
- No parent agent may terminate a child agent's work merely because it has not responded yet.
- If interruption is unavoidable, record incomplete / blocked / escalated. Do not pass the wave gate.

## 17. Out of Scope

- Runtime-core textured render scene integration.
- Full runtime parity.
- `parameter-grid-2d-v1` parity work.
- Dynamics / physics playback.
- Motion timeline or transport controls.
- screenshot / export.
- Compare / Diff.
- presentation frame / crop guide.
- pinned / favorite parameters.
- parameter group / category filter.
- authoring keyform add/update/delete in Viewer.
- Parameter Manager definition editing in Viewer.
- Mesh generation changes.
- Deformer editing changes.
- Save/load schema changes for Viewer overrides.
- Browser history routing.
- Standalone runtime app.
- Texture Atlas Task.
- Cubism SDK / `.moc3` / `.model3.json` compatibility.
