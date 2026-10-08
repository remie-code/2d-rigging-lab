# Wave 80 Plan: Viewer Interaction + Runtime Controls Density Follow-up

> Wave79で専用Viewer / Runtime View v0が入り、「完成品としてどう見えるか」をAuthoring Workspaceから切り離して確認できるようになった。Wave80はその直後の局所follow-upとして、Viewerの表示parity、Clean Stage操作、Runtime Controls密度を整える。

## 1. Status

- Status: Planned / ready for orchestration
- Target wave: Wave80
- Wave name: `viewer-interaction-controls-density-followup`
- Primary objective:
  - Viewer Clean StageでParts Containerの表示/非表示をDrawable表示と同じく反映する。
  - Clean StageにCanvas同等のmouse wheel zoomを追加する。
  - Clean Stageにleft-drag panを追加する。
  - Runtime Controlsを高密度な横一列rowへ整理し、parameter一覧性を上げる。
  - `Reset changed`を削除し、`Reset all`をicon-only button + tooltip + aria labelにする。
  - Wave80はWave79 Viewerの局所follow-upに留める。runtime-core完全parity、grid2d完全統合、dynamics、export、authoring operationは対象外。

## 2. Planning Gate Result

Planning Gate result: `Plan directly`.

Why planning is now safe:

- Wave79はfinal complete / passで、Viewer / Runtime View v0の専用screen、Clean Stage、Runtime Controls、Authoring `ParameterBar`抑制が実装済み。
- User checkで不足点が具体化している:
  - Drawable visibilityはViewerで効くが、Parts Container visibilityが反映されない。
  - Clean Stageにwheel zoomが必要。
  - Clean Stageにdrag panが必要。
  - Runtime Controlsのrow縦幅が大きく、parameter一覧性が落ちている。
- User decisions are explicit:
  - Viewerには編集操作がないため、left-dragは常時panでよい。
  - Runtime Controls全体の横幅が大きくなることは許容する。
  - Parameter rowからmin/max表示を消してよい。
  - Visibleな`Changed` labelは不要。
  - `Reset changed`は不要。
  - `Reset all`のみ残し、icon-only + tooltip + aria labelにする。
  - Domain A/B相当の実装作業は一つのGnomeにまとめてよい。分割によるreview cost増を避ける。

Uncertainty:

- factual: low to medium. Viewerの実装位置はWave79で固まったが、Parts Container visibilityの既存selector/helperがViewerでどこまで再利用できるかはDomain Aで確認する。
- decision: low. UX decisions are settled.
- cost of wrong plan: medium. 過大分割やsource実装をRootで始めると、Wave79直後の局所follow-upとしての境界が崩れる。

## 3. Accepted Decisions / Oracles

### 3.1 Viewer Follow-up Meaning

- Wave80 is a Viewer / Runtime View follow-up wave.
- Viewer remains a finished-model visual confirmation screen.
- Viewer is not an authoring surface.
- Viewer is not a diagnostics surface.
- Wave80 does not edit mesh, deformer, keyform, parameter definitions, hierarchy, clipping configuration, opacity configuration, or project storage.
- Wave80 does not persist Viewer pan, zoom, or parameter override session state.

### 3.2 Clean Stage Interaction Policy

- Clean Stage is the primary finished-model visual surface.
- Clean Stage should support basic viewing navigation:
  - mouse wheel zoom;
  - left-button drag pan.
- Because Viewer has no editing operations, left-button drag always pans.
- Wheel zoom should be pointer-position anchored where practical with the current projection model.
- Clean Stage pan/zoom are Viewer-local view state.
- Clean Stage pan/zoom must not:
  - mutate project state;
  - mutate selection;
  - mutate active tool;
  - mutate active parameter;
  - create operation history entries;
  - alter save/load payloads.

### 3.3 Visibility Policy

- Viewer should reflect the committed model's effective editor visibility.
- Drawable-level visibility remains authoritative for individual Drawable visibility.
- Parts Container visibility must gate descendant Drawable rendering in Viewer.
- Hidden ancestor Parts Containers hide descendant Drawables in Viewer.
- Visibility parity is a bug fix, not optional polish.
- This wave must not add new save/load fields for visibility.

### 3.4 Runtime Controls Density Policy

- Runtime Controls are the main Viewer operation surface.
- Vertical density matters more than card-like separation.
- Parameter controls should be compact horizontal rows:
  - parameter name;
  - slider;
  - numeric input;
  - row reset icon button.
- Runtime Controls may become wider to preserve usable slider width.
- Numeric input should be narrower and shorter than the Wave79 version.
- Smaller font is acceptable if it improves row density without harming readability.
- Parameter row min/max text is removed.
- The visible `Changed` word is removed.
- Changed state may remain visible through row accent, border, icon state, aria/test state, or equivalent non-text affordance.
- Individual row reset remains.
- `Reset changed` is removed.
- `Reset all` remains as icon-only visible UI.
- `Reset all` tooltip text is `Reset all`.
- `Reset all` aria label is `Reset all parameter overrides`.
- Future Motion / Physics placeholder remains below Runtime Controls as a non-interactive future dynamics slot.

### 3.5 Runtime Parity Boundary

Wave80 intentionally targets:

```text
Wave79 Viewer current committed/evaluated result
= Wave80 Viewer result
  + Parts Container visibility parity
  + Viewer-local pan/zoom
  + denser Runtime Controls UI
```

Wave80 does not target:

```text
runtime-core semantic evaluator complete parity
grid2d keyform parity
dynamics / physics playback
standalone runtime package rendering parity
Viewer export / screenshot / capture
```

Reason:

- The user value of Wave80 is making the just-added Viewer comfortable and trustworthy.
- Runtime engine integration and dynamics remain later, larger boundaries.

### 3.6 Navigation / Authoring Context

- Viewer remains reached through the existing Wave79 Viewer path.
- Back / return behavior from Wave79 should remain intact.
- Returning from Viewer should preserve authoring context by not resetting:
  - selection;
  - active tool;
  - active parameter;
  - authoring parameter values.
- Viewer must not modify `activeTool` to implement pan/zoom.
- Viewer must not expose Authoring `ParameterBar`.

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

- [Wave79 Plan](wave79-plan.md)
- [Wave79 Final Integration Report](../waves/wave79/wave79-final-integration-report.md)
- [Wave79 Final Clean Integration Review](../reviews/wave79/wave79-final-clean-integration-review.md)

Relevant implementation facts from Wave79 baseline and user check:

- Dedicated Viewer / Runtime View screen exists.
- Clean Stage exists and renders without authoring overlays.
- Runtime Controls exist and drive session-only parameter overrides.
- Authoring `ParameterBar` is suppressed while Viewer is active.
- Viewer currently reflects Drawable visibility but not Parts Container visibility.
- Runtime Controls are currently too vertically spacious for a long parameter list.
- Clean Stage lacks required wheel zoom and left-drag pan.
- Existing Canvas navigation behavior can be used as behavioral reference, but Wave80 should not reuse Authoring Canvas UI wholesale.

Likely implementation areas:

- `apps/editor/src/workspace/viewer/viewer-runtime-screen.tsx`
- `apps/editor/src/workspace/viewer/viewer-clean-stage.ts`
- `apps/editor/src/workspace/viewer/runtime-controls.tsx`
- `apps/editor/src/workspace/viewer/runtime-controls-state.ts`
- Viewer-focused tests near the files above

Read-only or conditional reference areas:

- `apps/editor/src/workspace/panels/canvas-preview-panel.tsx`
- `apps/editor/src/workspace/canvas/**`
- `apps/editor/src/features/editor-session/**`

## 5. Review Policy

Each implementation domain requires three review lanes unless explicitly documented as not applicable:

1. `Spec Compliance Review`
   - Check every Wave80 Viewer follow-up requirement and every explicit non-goal.
   - `unclear` is not pass.
2. `Design / Development Compliance Review`
   - Check Viewer source boundaries, Viewer-local state separation, no authoring mutation, UI semantics, and forbidden scope.
3. `Test Adequacy Review`
   - Check Parts Container visibility parity, pan/zoom behavior, Runtime Controls density/reset behavior, and regression coverage.

Domain reports must include:

- Basis Coverage Self-Report
- User-Facing UX Trace
- Viewer Visibility Parity Trace
- Clean Stage Interaction Trace
- Runtime Controls Density Trace
- Must-not Compliance Evidence
- Residual Risk Classification

## 6. Wave Strategy

```text
Batch 1:
  Domain A: Viewer Interaction + Runtime Controls Density Follow-up

Batch 2:
  Domain B: Final Integration / Clean Review / Map Closeout
```

Dependency rationale:

- The user explicitly prefers a single implementation domain for this wave because the Viewer follow-up work is compact and tightly coupled.
- Splitting Parts Container visibility, pan/zoom, and Runtime Controls density into separate domains would increase review cost without adding enough safety.
- Domain A owns all source changes and must keep them local to Viewer unless it explicitly escalates.
- Domain B runs only after Domain A is pass-classified or explicit escalation is recorded.

## 7. Acceptance Criteria

### 7.1 Parts Container Visibility Parity

Required:

- Viewer Clean Stage respects Parts Container visibility.
- If an ancestor Parts Container is hidden, descendant Drawables do not render in Viewer.
- Drawable-level visibility continues to work as before.
- A Drawable renders only when both the Drawable and its relevant ancestor Parts Containers are visible.
- Visibility behavior reflects committed project/editor visibility state.
- No save/load schema change is introduced.

Must not:

- Add a Viewer-only visibility override system.
- Persist Viewer-specific visibility state.
- Break existing Drawable visibility behavior.
- Treat hidden Parts Containers as diagnostics-only or authoring-only state in Viewer.

### 7.2 Clean Stage Wheel Zoom

Required:

- Mouse wheel over Clean Stage changes Viewer zoom.
- Zoom is pointer-position anchored where practical with the current projection model.
- Wheel handling prevents accidental page/panel scroll while Clean Stage is handling zoom.
- Existing fit/zoom controls, if present from Wave79, continue to work.
- Zoom state is Viewer-local only.
- No modifier key is required.

Must not:

- Mutate Canvas authoring zoom state if Viewer maintains separate state.
- Create operation history entries.
- Require active tool changes.
- Introduce authoring overlay controls into Viewer.

### 7.3 Clean Stage Left-Drag Pan

Required:

- Left-button drag on Clean Stage pans the Viewer stage.
- Pointer capture is used where appropriate.
- Pointer up and pointer cancel end panning reliably.
- Cursor affordance communicates pannable / panning state, such as `grab` / `grabbing`.
- Pan state is Viewer-local only.

Must not:

- Select Drawables.
- Move Drawables.
- Edit mesh, deformer, keyform, or parameter state.
- Create operation history entries.
- Depend on an authoring active tool.

### 7.4 Runtime Controls Dense Rows

Required:

- Parameter controls are displayed as compact horizontal rows.
- Each row includes:
  - parameter name;
  - slider;
  - numeric value input;
  - row reset icon button.
- Runtime Controls panel width may increase to keep row layout usable.
- Numeric input is visibly narrower and shorter than the Wave79 version.
- Parameter row min/max text is removed.
- Search remains available at the top.
- Future Motion / Physics placeholder remains at the bottom and stays non-interactive.
- Changed state remains observable without a visible `Changed` word.
- Row reset still resets only that parameter override.

Must not:

- Add parameter group / category filter.
- Add favorite / pinned parameter UI.
- Add keyform add/update/delete controls.
- Mutate Authoring `ParameterBar`.
- Persist Viewer overrides.

### 7.5 Runtime Controls Reset Area

Required:

- `Reset changed` is removed.
- `Reset all` remains.
- `Reset all` is icon-only in visible UI.
- `Reset all` has tooltip text `Reset all`.
- `Reset all` has `aria-label="Reset all parameter overrides"`.
- `Reset all` clears Viewer-local parameter overrides.
- `Reset all` should not clear the search query unless existing Wave79 semantics already require it.

Must not:

- Leave both `Reset changed` and `Reset all` in the header.
- Replace all row reset behavior with only global reset.
- Clear committed authoring parameter values.
- Commit operations or save/load changes.

## 8. Domain Design

| Batch | Domain | Dependency | Purpose |
|---|---|---|---|
| 1 | A. Viewer Interaction + Runtime Controls Density Follow-up | Wave79 pass baseline | Fix Viewer Parts Container visibility parity, add Clean Stage pan/zoom, and compact Runtime Controls |
| 2 | B. Final Integration / Clean Review / Map Closeout | Domain A pass or explicit escalation | Combined validation, clean review, reports/maps |

## 9. Domain A: `wave80-viewer-interaction-controls-density-followup`

Purpose:

- Make the Wave79 Viewer usable as a finished-model confirmation screen by fixing visibility parity, adding basic stage navigation, and reducing Runtime Controls vertical weight.

Expected implementation areas:

- `apps/editor/src/workspace/viewer/viewer-runtime-screen.tsx`
- `apps/editor/src/workspace/viewer/viewer-clean-stage.ts`
- `apps/editor/src/workspace/viewer/runtime-controls.tsx`
- `apps/editor/src/workspace/viewer/runtime-controls-state.ts`
- Existing Viewer-focused tests near those files
- New focused tests only where needed

Allowed write scope:

- `apps/editor/src/workspace/viewer/**`
- Viewer-focused test files under existing local test locations
- `discussion/implementation/waves/wave80/**`
- `discussion/implementation/reviews/wave80/**`

Conditional write scope, requiring explicit report justification:

- `apps/editor/src/workspace/panels/canvas-preview-panel.tsx`
- `apps/editor/src/workspace/canvas/**`
- `apps/editor/src/features/editor-session/**`
- shared utility files outside `workspace/viewer/**`

Forbidden write scope:

- `packages/**`
- `package.json` / lockfiles / dependency configuration
- save/load schema or portable project format
- mesh generation
- deformer authoring operations
- keyform authoring operations
- runtime-core parity expansion
- dynamics / physics implementation
- screenshot/export, compare/diff, crop guide, favorite parameters, parameter grouping
- Atlas, Cubism SDK/runtime export, standalone runtime app

Required tests / evidence:

- Hidden Parts Container hides descendant Drawables in Viewer.
- Drawable visibility still hides individual Drawables in Viewer.
- Visible ancestor Parts Containers plus visible Drawable allow rendering.
- Wheel over Clean Stage changes Viewer zoom and does not mutate project state.
- Left-drag pans Clean Stage and does not create authoring operations.
- Runtime Controls rows are compact horizontal rows.
- Parameter row min/max text and visible `Changed` label are absent.
- Row reset still resets one parameter.
- `Reset changed` is absent.
- `Reset all` clears all Viewer-local overrides and has tooltip / aria label evidence.
- Existing Viewer tests remain passing.

Early escape triggers:

- Parts Container visibility requires changing save/load schema.
- Visibility requires broad editor-session restructuring.
- Clean Stage pan/zoom cannot be implemented without mutating Authoring Canvas state.
- Runtime Controls density conflicts with accepted Viewer screen responsibilities.
- Shared helper extraction outside Viewer becomes necessary and non-trivial.
- Test harness cannot observe the changed behavior with reasonable focused tests.

## 10. Domain B: `wave80-final-integration-clean-review-map-closeout`

Purpose:

- Validate combined Wave80 behavior, obtain independent clean review, and update persistent maps/reports.

Expected implementation areas:

- `discussion/implementation/waves/wave80/**`
- `discussion/implementation/reviews/wave80/**`
- `discussion/implementation/_map.md`
- `discussion/implementation/orchestration/_map.md`

Acceptance:

- Domain A report exists and records `pass` or explicit escalation.
- Required review lanes exist and pass, or explicit escalation is recorded.
- Final clean integration review exists and passes before Wave80 is marked complete.
- Final report records:
  - Viewer visibility parity behavior;
  - Clean Stage wheel zoom behavior;
  - Clean Stage left-drag pan behavior;
  - Runtime Controls dense row behavior;
  - reset control behavior;
  - authoring state non-mutation proof;
  - forbidden scope compliance;
  - validation results;
  - residual risks.
- Maps mark Wave80 status correctly.

Required checks:

- `pnpm typecheck`
- Focused Viewer Clean Stage tests
- Focused Runtime Controls tests
- Focused screen/component tests if Viewer integration changed
- `node scripts/check-source-organization.mjs`
- `node scripts/check-dependencies.mjs`
- `git diff --check`

## 11. Verification Matrix

| Requirement | Minimum evidence |
|---|---|
| Parts Container visibility reflected in Viewer | Viewer render/projection/component test |
| Drawable visibility remains reflected | Viewer render/projection/component test |
| Wheel zoom changes Viewer-local view state | Clean Stage unit/component test |
| Wheel zoom does not mutate authoring state | State/assertion test or source review evidence |
| Left-drag pan changes Viewer-local view state | Clean Stage unit/component test |
| Pan does not create operations | Source review evidence and/or operation spy assertion |
| Runtime Controls rows are dense/horizontal | Component DOM/class/style assertion or review evidence |
| Min/max row text removed | Runtime Controls test or DOM assertion |
| Visible `Changed` label removed | Runtime Controls test or DOM assertion |
| Changed state still observable | DOM/class/aria/test-state assertion |
| Row reset works | Runtime Controls state/component test |
| `Reset changed` removed | Runtime Controls DOM assertion |
| `Reset all` icon-only with tooltip/aria label | Runtime Controls DOM/accessibility assertion |
| Viewer overrides remain session-only | State test / no mutation assertion |
| Runtime-core parity deferred | Final report residual risk / out-of-scope confirmation |

## 12. Expected Persistent Artifacts

Reports:

- `discussion/implementation/waves/wave80/wave80-domain-a-viewer-interaction-controls-density-followup-report.md`
- `discussion/implementation/waves/wave80/wave80-final-integration-report.md`
- `discussion/implementation/waves/wave80/_map.md`

Reviews:

- `discussion/implementation/reviews/wave80/wave80-domain-a-spec-compliance-review.md`
- `discussion/implementation/reviews/wave80/wave80-domain-a-design-development-review.md`
- `discussion/implementation/reviews/wave80/wave80-domain-a-test-adequacy-review.md`
- `discussion/implementation/reviews/wave80/wave80-final-clean-integration-review.md`
- `discussion/implementation/reviews/wave80/_map.md`

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
- Preserve Wave79 accepted Viewer behavior.
- Do not reuse `CanvasPreviewPanel` wholesale for Viewer.
- Do not reuse full `ParameterBar` for Runtime Controls.
- Do not implement runtime-core parity expansion, grid2d parity, dynamics playback, export, diff, crop guide, parameter groups, favorite parameters, mesh, deformer, keyform, or save/load schema changes.
- Keep Viewer pan/zoom and parameter overrides session-only.

Review-Sylph instructions must include:

- Review from source, tests, plan, and reports, not only from Gnome summary.
- Report `pass`, `needs_changes`, or `escalate`.
- Do not ask the user directly.
- Do not edit files unless explicitly delegated a narrow fix after review.
- Treat authoring state mutation from Viewer pan/zoom or Runtime Controls as blocking unless explicitly justified by the plan.
- Treat missing Parts Container visibility parity as blocking.

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

## 15. Out of Scope

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
- Deformer hierarchy authoring changes.
- Save/load schema changes.
- Viewer override persistence.
- Browser history routing.
- Standalone runtime app.
- Texture Atlas Task.
- Cubism SDK / `.moc3` / `.model3.json` compatibility.
