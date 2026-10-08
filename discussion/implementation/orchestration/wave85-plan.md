# Wave 85 Plan: Validation / Diagnostics v0

> Wave84でViewer Runtime Dynamics playbackまで成立し、作成したモデルを完成状態として見る導線が通った。Wave85は「完成度を採点する画面」ではなく、決定論的に検知できる問題、Mesh生成失敗原因、対象へ移動するjump導線を提供する。Viewerには警告を混ぜず、Validate / Diagnostics entry、read-only list、Mesh Tool inline diagnostics、Dynamics validation、Tree warning badgeを薄く接続する。

## 1. Status

- Status: Planned / ready for orchestration
- Target wave: Wave85
- Wave name: `validation-diagnostics-v0`
- Primary objective:
  - `validate` entryから読み取り専用のDiagnostics listを開けるようにする。
  - Editor-local diagnostics projectionを追加し、決定論的な警告を生成する。
  - App Bar / ToolboxのValidate entryにwarning badgeを表示する。
  - Mesh生成失敗 / fallback / triangles 0の詳細をMesh Tool内でinline表示し、診断情報をコピーできるようにする。
  - Dynamics input/output参照切れ、output keyform missing、same-output conflictをDynamics ToolおよびDiagnostics listで扱う。
  - meshなしなのにDeformer / Keyform対象になっているDrawableをParts Tree / Deformer Tree / Diagnostics listで見つけられるようにする。
  - Jump actionで対象のDrawable / Deformer / Parameter / Dynamics Groupへ移動できるようにする。
  - Viewerにはwarning / diagnostics UIを出さない。
  - Auto-fix、AI repair、Product Preflight wholesale migration、completion score、quality judgementはWave85対象外。

## 2. Planning Gate Result

Planning Gate result: `Inventory first -> Plan`.

Why planning is now safe:

- UX direction is captured in [Validation / Diagnostics v0 画面・表示仕様](../../design/screen-design/screens/diagnostics-evidence-view.md).
- Sylph inventory confirmed:
  - `validate` entry exists but the screen body is not wired.
  - React Diagnostics / Evidence full component is absent.
  - Mesh Tool has draft metadata but generation-undefined failures currently only reach console debug.
  - Dynamics draft validation exists but output-keyform-missing and existing-group summary wiring are absent.
  - Tree rows have no warning slots yet.
  - Existing selection/tool APIs can support v0 jump actions.
- User decisions are explicit:
  - badge count is warning item count.
  - `output keyform missing` means no keyformSet exists for the output parameter; do not infer actual rendered effect.
  - Mesh failure details stay local to Mesh Tool, not global history.
  - Viewer should not show diagnostics warnings.
  - Diagnostics list is read-only and does not auto-fix.

Uncertainty:

- factual: low-medium. Connection points are identified, but exact component wiring may reveal small local constraints.
- decision: low. UX and scope decisions are settled for v0.
- cost of wrong plan: medium. Over-broad Product Preflight migration or Evidence-heavy scope would distort the wave.

## 3. Accepted Decisions / Oracles

### 3.1 Diagnostics Meaning

- Validation / Diagnostics v0 is not a completion score.
- It does not judge naturalness, beauty, rigging quality, or whether a user intentionally omitted keyforms.
- It only exposes deterministic warnings and actionable diagnostics.
- Severity is Warning by default. Blocker can be deferred unless an existing system already distinguishes it cleanly.
- All diagnostics are read-only.
- No auto-fix, repair generation, proposal generation, or automatic authoring operation is provided.

### 3.2 Display Surfaces

The feature has three display layers:

1. Inline Inspector warning:
   - Mesh Tool for mesh generation failures/fallbacks.
   - Dynamics Tool for group validation.
   - Rig / Drawable context for mesh-missing drawables when practical.
2. Tree warning icon:
   - Parts Tree / Deformer Tree rows for target-specific warnings, especially mesh-missing drawable rows.
3. Validate / Diagnostics list:
   - A read-only list with category, title, target, explanation, details, and jump actions.

Viewer / Runtime View remains a finished-model confirmation surface and must not show diagnostics warnings.

### 3.3 Badge Policy

- App Bar / Toolbox Validate entry shows a warning badge when diagnostics exist.
- Badge count is the number of warning items, not affected target count.
- The count may be capped visually if needed by existing UI pattern, but the underlying count should be warning item count.

### 3.4 Mesh Diagnostics Policy

- Mesh generation failure/fallback/0-triangle details are shown in Mesh Tool only.
- Global Diagnostics list must not accumulate historical mesh generation failures.
- Mesh diagnostic details must be copyable as text suitable for pasting to Codex.
- If mesh generation returns no draft, the implementation may add a Mesh Tool local “last generation diagnostic” state or equivalent draft union.
- Do not persist mesh generation diagnostic history to project save/load.

### 3.5 Dynamics Diagnostics Policy

- Missing input parameter and missing output parameter are diagnostics.
- Duplicate output ownership should be prevented in create/edit where possible; if loaded data already contains it, show it in Diagnostics.
- `output keyform missing` v0 definition:
  - If no keyformSet exists for the Dynamics output parameter, warn.
  - If at least one keyformSet exists for that parameter, do not warn.
  - Do not infer whether that keyform actually affects visible rendering.
- Existing Dynamics create/edit validation must keep working.
- Group list / Group inspector should show existing group validation summaries where practical.

### 3.6 Reference Diagnostics Policy

Diagnostics list should include deterministic broken references:

- keyform references missing parameter.
- keyform target missing Drawable / Deformer.
- Deformer child missing.
- Deformer parent missing.
- Deformer parent cycle.
- Dynamics input/output missing parameter.
- duplicate Dynamics output conflict from existing data.

Each item should identify the target and offer the safest available jump action.

### 3.7 Jump Actions

Accepted v0 jumps:

- mesh missing -> Authoring entry + Mesh tool + select Drawable.
- deformer issue -> Authoring entry + Rig tool + select Deformer tree target.
- parameter issue -> Parameters entry + set active parameter.
- dynamics group -> Authoring entry + Dynamics tool + set selected/preview group.

Do not require Dynamics Inspector mode lifting unless needed for a simple, low-risk implementation. Tool switch + group selection is sufficient for v0.

## 4. Primary Basis

Common:

- [Implementation Orchestration Skill](../../../.agents/skills/implementation-orchestration/SKILL.md)
- [UX-Backed Package Logic Authority](../../development_convention/ux-backed-package-logic-authority.md)
- [Source File Organization Policy](../../development_convention/source-file-organization-policy.md)
- [Dependency Policy](../../development_convention/dependency-policy.md)
- [Operation Policy](../../development_convention/operation-policy.md)
- [Schema and ID Conventions](../../development_convention/schema-and-id-conventions.md)

Screen / UX basis:

- [Validation / Diagnostics v0 Screen Spec](../../design/screen-design/screens/diagnostics-evidence-view.md)
- [Viewer / Runtime View Screen Spec](../../design/screen-design/screens/viewer-runtime-view.md)
- [Dynamics Tool Component Spec](../../design/screen-design/components/dynamics-tool.md)
- [Screen Specs Map](../../design/screen-design/screens/_map.md)
- [Screen Design Map](../../design/screen-design/_map.md)
- [React Editor Foundation Oracle](../../design/screen-design/react-editor-foundation-oracle.md)
- [E2E Oracle](../../design/screen-design/e2e-oracle.md)

Wave baseline:

- [Wave84 Plan](wave84-plan.md)
- [Wave84 Final Integration Report](../waves/wave84/wave84-final-integration-report.md)
- [Wave84 Final Clean Integration Review](../reviews/wave84/wave84-final-clean-integration-review.md)
- [Remaining Work Backlog](../remaining-work-backlog.md)

Factual inventory:

- `apps/editor/src/state/editor-ui-store.ts`
  - `WorkspaceEntryId` includes `"validate"`.
  - `setActiveEntry()` / `setActiveTool()` exist.
- `apps/editor/src/workspace/workspace-data.ts`
  - `taskEntries` includes `Validate` / `ShieldCheck`.
- `apps/editor/src/workspace/app-bar.tsx`
- `apps/editor/src/workspace/toolbox/workspace-toolbox.tsx`
  - existing task entry rendering and likely badge insertion points.
- `apps/editor/src/workspace/authoring-workspace.tsx`
  - special-cases `parameters`, `storage`, `viewer`; `validate` screen body is currently absent.
- `apps/editor/src/features/editor-session/editor-session-context.tsx`
  - mesh drafts state and selection/session operations.
- `apps/editor/src/features/editor-session/model/session-tree.ts`
  - `createStructureTreeRows()`.
- `apps/editor/src/workspace/panels/structure-tree-panel.tsx`
  - Parts Tree row rendering.
- `apps/editor/src/features/editor-session/model/rig-tool-state.ts`
  - `createDeformerTreeRows()`, `selectDeformerTreeTarget()`.
- `apps/editor/src/workspace/panels/deformer-tree-view.tsx`
  - Deformer Tree row rendering.
- `apps/editor/src/workspace/panels/mesh-tool-inspector.tsx`
  - Mesh Tool preview/result UI.
- `apps/editor/src/features/editor-session/model/dynamics-tool-state.ts`
  - `validateDynamicsToolDraft()`, Dynamics preview group state.
- `apps/editor/src/workspace/panels/dynamics-tool-inspector.tsx`
  - Dynamics Tool list/group/create/edit UI.
- `packages/authoring-core/src/mesh-generation.ts`
- `packages/authoring-core/src/mesh-quality-metrics.ts`
  - mesh generation and v6 metrics.
- `packages/authoring-core/src/dynamics-mutations.ts`
  - mutation-time missing refs / duplicate output enforcement.

## 5. Review Policy

Each implementation domain requires three review lanes unless explicitly documented as not applicable:

1. `Spec Compliance Review`
   - Check accepted Validation / Diagnostics v0 scope and explicit non-goals.
2. `Design / Development Compliance Review`
   - Check Editor-local projection responsibility, UI wiring, jump boundaries, no Product Preflight wholesale migration, source organization, and no auto-fix behavior.
3. `Test Adequacy Review`
   - Check projection cases, screen/badge/jump tests, Mesh Tool inline diagnostics, Dynamics validation, Tree warning icons, and Viewer negative coverage.

Domain reports must include:

- Basis Coverage Self-Report
- Current-State Confirmation
- Diagnostics Projection Trace
- UI / Badge / Jump Trace
- Mesh Inline Diagnostics Trace
- Dynamics Validation Trace
- Tree Warning Trace
- Must-not Compliance Evidence
- Verification
- Residual Risks

## 6. Wave Strategy

```text
Batch 1:
  Domain A: Editor-local Diagnostics Projection

Batch 2:
  Domain B: Validate Screen + Badge + Jump Actions
  Domain C: Inline / Tree Diagnostics Integration

Batch 3:
  Domain D: Final Integration / Clean Review / Map Closeout
```

Dependency rationale:

- Domain A provides the diagnostic item model and projection that B/C consume.
- Domain B owns the global read-only list, Validate entry connection, warning badge, and jump actions.
- Domain C owns local surfacing: Mesh Tool inline diagnostic details, Dynamics group/list warnings, and tree warning icons.
- Domain B and C both depend on A but should avoid overlapping implementation files where possible.
- Domain D runs only after A/B/C are pass-classified or explicit escalation is recorded.

## 7. Acceptance Criteria

### 7.1 Diagnostics Projection

Required:

- Add an Editor-local diagnostics projection, likely under `apps/editor/src/features/editor-session/model/editor-diagnostics-state.ts`.
- Projection returns stable read-only diagnostic items with:
  - id;
  - severity;
  - category;
  - code;
  - title;
  - message;
  - target;
  - optional details;
  - optional action hints.
- Projection covers:
  - mesh missing for Drawable used by Deformer / Keyform target;
  - missing keyform parameter;
  - missing keyform target Drawable / Deformer;
  - missing Deformer parent;
  - missing Deformer child;
  - Deformer parent cycle;
  - Dynamics missing input parameter;
  - Dynamics missing output parameter;
  - duplicate Dynamics output ownership in existing data;
  - Dynamics output keyform missing by v0 definition.
- Projection exposes warning item count for badges.

Must not:

- Depend on React UI.
- Mutate session state.
- Run Product Preflight wholesale.
- Infer rigging quality or naturalness.

### 7.2 Validate Screen / Diagnostics List

Required:

- `validate` entry opens a dedicated read-only Diagnostics screen instead of falling back to Authoring Workspace.
- The screen lists diagnostic items by category.
- Empty state clearly indicates no deterministic warnings.
- Each row shows target and short message.
- Rows provide appropriate jump actions.
- No auto-fix or repair actions are shown.

Must not:

- Display raw Product Preflight payloads by default.
- Show model completion score.
- Add editing controls inside the Diagnostics screen.

### 7.3 App Bar / Toolbox Badge

Required:

- Validate entry shows a warning badge when diagnostic item count is non-zero.
- Badge count uses warning item count.
- Badge appears in the App Bar and/or Toolbox where the Validate entry is rendered.
- No badge is shown when diagnostics are empty.

Must not:

- Show Diagnostics warning badge inside Viewer / Runtime View.
- Block normal authoring workflow.

### 7.4 Jump Actions

Required:

- Mesh missing item can jump to Authoring + Mesh tool + selected Drawable.
- Deformer item can jump to Authoring + Rig tool + selected Deformer target where possible.
- Parameter item can jump to Parameters entry + active parameter.
- Dynamics item can jump to Authoring + Dynamics tool + selected/preview Dynamics Group.
- Jump actions do not mutate project data.

Must not:

- Require full Dynamics Inspector state lift unless needed for a small safe implementation.
- Auto-create mesh, keyform, parameter, or Dynamics group.

### 7.5 Mesh Tool Inline Diagnostics

Required:

- Mesh generation failure, fallback, or 0 triangles displays an inline diagnostic card in Mesh Tool.
- Diagnostic card includes a short reason and details where available.
- Diagnostic details include useful copyable data, such as algorithm id, method/source, preset, drawable, bounds, contour counts, vertices/triangles, fallback steps, and failure reason where available.
- Copy diagnostic details action is available.
- Mesh diagnostic details are not persisted as global history.

Must not:

- Add global mesh failure history.
- Change mesh generation algorithm behavior.
- Replace preview with Product Preflight output.

### 7.6 Dynamics Validation Surfaces

Required:

- Existing create/edit validation continues to work.
- Existing groups can surface validation summaries in group list/group inspector where practical.
- Output-keyform-missing warning is added with v0 definition.
- Duplicate output ownership remains blocked on create/edit where currently enforced.
- Loaded or existing duplicate output ownership appears in Diagnostics list.

Must not:

- Judge whether the Dynamics motion looks natural.
- Require Viewer to show diagnostic warnings.
- Change Dynamics schema.

### 7.7 Tree Warning Icons

Required:

- Parts Tree rows can show a compact warning icon for drawables with mesh-missing diagnostics.
- Deformer Tree drawable rows can show a compact warning icon for drawables with mesh-missing diagnostics.
- Icons use existing tooltip/icon patterns where practical.
- Icons do not expand row height or clutter tree layout.

Must not:

- Add verbose diagnostic text directly into tree rows.
- Add warning icons for speculative quality judgments.

### 7.8 Viewer Exclusion

Required:

- Viewer / Runtime View does not show Diagnostics warning badges, inline warnings, or diagnostic list content.
- Viewer Runtime Controls remain focused on runtime parameter input.

Must not:

- Reintroduce output parameter sliders/meters or diagnostics into Viewer.

## 8. Domain Design

| Batch | Domain | Dependency | Purpose |
|---|---|---|---|
| 1 | A. Editor-local Diagnostics Projection | Wave84 pass baseline | Add diagnostic model/projection and unit tests |
| 2 | B. Validate Screen + Badge + Jump Actions | Domain A pass | Wire validate entry to screen, badge, read-only list, jump actions |
| 2 | C. Inline / Tree Diagnostics Integration | Domain A pass | Add Mesh Tool inline diagnostics, Dynamics validation surfacing, Parts/Deformer Tree warning icons |
| 3 | D. Final Integration / Clean Review / Map Closeout | Domains A-C pass or explicit escalation | Combined validation, clean review, reports/maps |

## 9. Domain A: `wave85-editor-local-diagnostics-projection`

Purpose:

- Create the deterministic read-only diagnostics model that the screen, badge, tree icons, and tool warnings can consume.

Expected implementation areas:

- `apps/editor/src/features/editor-session/model/editor-diagnostics-state.ts`
- `apps/editor/src/features/editor-session/model/editor-diagnostics-state.test.ts`
- focused helpers under `apps/editor/src/features/editor-session/model/**` if needed

Allowed write scope:

- `apps/editor/src/features/editor-session/model/**`
- focused tests for touched files
- `discussion/implementation/waves/wave85/**`
- `discussion/implementation/reviews/wave85/**`

Conditional write scope requiring explicit report justification:

- `packages/authoring-core/src/**` only if a tiny pure helper is clearly better shared and does not broaden package semantics.

Forbidden write scope:

- React UI components.
- Mesh generation algorithms.
- Dynamics schema or operation payloads.
- Product Preflight wholesale migration.
- Auto-fix or repair actions.

Required tests / evidence:

- mesh-missing diagnostic.
- missing keyform parameter diagnostic.
- missing keyform target diagnostic.
- missing deformer parent/child diagnostic.
- deformer cycle diagnostic.
- Dynamics missing input/output diagnostic.
- duplicate Dynamics output diagnostic.
- output-keyform-missing diagnostic and no-warning when one keyformSet exists.
- stable warning item count.

Early escape triggers:

- Required diagnostics cannot be computed from current session graph without broad schema changes.
- Deterministic check would require quality inference rather than reference/state facts.

## 10. Domain B: `wave85-validate-screen-badge-jump-actions`

Purpose:

- Make the existing `validate` entry useful by opening a read-only Diagnostics screen with warning badge and jump actions.

Expected implementation areas:

- `apps/editor/src/workspace/authoring-workspace.tsx`
- `apps/editor/src/workspace/workspace-data.ts`
- `apps/editor/src/workspace/app-bar.tsx`
- `apps/editor/src/workspace/toolbox/workspace-toolbox.tsx`
- new or existing `apps/editor/src/workspace/diagnostics/**`
- `apps/editor/src/state/editor-ui-store.ts` only if jump plumbing needs small additions
- focused tests near touched files

Allowed write scope:

- `apps/editor/src/workspace/**`
- `apps/editor/src/state/**`
- focused tests for touched files
- `discussion/implementation/waves/wave85/**`
- `discussion/implementation/reviews/wave85/**`

Forbidden write scope:

- Mesh Tool Inspector implementation.
- Dynamics Tool Inspector implementation.
- Parts/Deformer Tree warning implementation.
- Product Preflight wholesale UI migration.
- Viewer diagnostics.
- Auto-fix or repair actions.

Required tests / evidence:

- Validate entry opens Diagnostics screen.
- Badge count appears when warning item count > 0.
- Badge absent when no diagnostics exist.
- Diagnostics list is read-only and has no auto-fix controls.
- Jump actions call the expected entry/tool/selection changes.
- Viewer does not show diagnostics warnings.

Early escape triggers:

- Existing workspace routing cannot open `validate` without broader task/window redesign.
- Jump actions require large state ownership changes.

## 11. Domain C: `wave85-inline-tree-diagnostics-integration`

Purpose:

- Surface diagnostics at the point of work: Mesh Tool inline failure details, Dynamics Tool validation summaries, and tree warning icons.

Expected implementation areas:

- `apps/editor/src/workspace/panels/mesh-tool-inspector.tsx`
- `apps/editor/src/features/editor-session/editor-session-context.tsx` for last mesh generation diagnostic state if needed
- `apps/editor/src/workspace/panels/dynamics-tool-inspector.tsx`
- `apps/editor/src/features/editor-session/model/dynamics-tool-state.ts`
- `apps/editor/src/features/editor-session/model/session-tree.ts`
- `apps/editor/src/workspace/panels/structure-tree-panel.tsx`
- `apps/editor/src/features/editor-session/model/rig-tool-state.ts`
- `apps/editor/src/workspace/panels/deformer-tree-view.tsx`
- focused tests near touched files

Allowed write scope:

- `apps/editor/src/features/editor-session/**`
- `apps/editor/src/workspace/panels/**`
- focused tests for touched files
- `discussion/implementation/waves/wave85/**`
- `discussion/implementation/reviews/wave85/**`

Conditional write scope requiring explicit report justification:

- `packages/authoring-core/src/mesh-quality-metrics.ts` only if existing metrics need a narrow export for copy payload. Do not alter algorithms.

Forbidden write scope:

- Validate screen implementation.
- App Bar / Toolbox badge implementation.
- Mesh generation algorithm changes.
- Dynamics schema/operation changes.
- Viewer changes except tests proving exclusion if necessary.
- Global mesh failure history.

Required tests / evidence:

- Mesh Tool shows diagnostic card for fallback / 0 triangles / generation failure where representable.
- Copy diagnostic details includes useful payload.
- Dynamics group list or inspector shows output-keyform-missing and existing validation summaries.
- Parts Tree warning icon appears for mesh-missing drawable.
- Deformer Tree warning icon appears for mesh-missing drawable.
- Tree rows remain compact.

Early escape triggers:

- Mesh generation failures currently drop too much information to show useful inline diagnostics without broad generator refactor.
- Tree warning propagation requires broad tree model redesign.

## 12. Domain D: `wave85-final-integration-clean-review-map-closeout`

Purpose:

- Validate combined Wave85 behavior, obtain independent clean review, and update persistent maps/reports.

Expected implementation areas:

- `discussion/implementation/waves/wave85/**`
- `discussion/implementation/reviews/wave85/**`
- `discussion/implementation/_map.md`
- `discussion/implementation/orchestration/_map.md`

Acceptance:

- Domain A/B/C reports exist and record `pass` or explicit escalation.
- Required review lanes exist and pass, or explicit escalation is recorded.
- Final clean integration review exists and passes before Wave85 is marked complete.
- Final report records:
  - diagnostics projection behavior;
  - validate screen / badge / jump behavior;
  - mesh inline diagnostic behavior;
  - dynamics validation behavior;
  - tree warning behavior;
  - Viewer exclusion proof;
  - forbidden scope compliance;
  - validation results;
  - residual risks and user-decision points.
- Maps mark Wave85 status correctly.

Required checks:

- `pnpm typecheck`
- Focused diagnostics projection tests.
- Focused validate screen / app bar / toolbox tests.
- Focused Mesh Tool Inspector tests.
- Focused Dynamics Tool Inspector tests.
- Focused Parts Tree / Deformer Tree tests.
- Viewer negative test if touched or if diagnostics badge scope could leak.
- `node scripts/check-source-organization.mjs`
- `node scripts/check-dependencies.mjs`
- `git diff --check`

## 13. Verification Matrix

| Requirement | Minimum evidence |
|---|---|
| Diagnostics projection returns required items | `editor-diagnostics-state.test.ts` |
| Warning item count powers badge | projection + UI tests |
| Validate entry opens Diagnostics screen | workspace/app-bar/toolbox test |
| Diagnostics list read-only | component test / source review |
| Jump actions select expected target/tool | UI/store tests |
| Mesh inline diagnostic appears | Mesh Tool Inspector test |
| Copy diagnostic payload exists | Mesh Tool Inspector test |
| Dynamics output-keyform warning | Dynamics state/Inspector test |
| Existing Dynamics validation preserved | Dynamics tests |
| Parts Tree warning icon | Structure Tree test |
| Deformer Tree warning icon | Deformer Tree test |
| Viewer excludes diagnostics | Viewer negative test/source review |
| No auto-fix/Product Preflight wholesale migration | review evidence |

## 14. Expected Persistent Artifacts

Reports:

- `discussion/implementation/waves/wave85/wave85-domain-a-editor-local-diagnostics-projection-report.md`
- `discussion/implementation/waves/wave85/wave85-domain-b-validate-screen-badge-jump-actions-report.md`
- `discussion/implementation/waves/wave85/wave85-domain-c-inline-tree-diagnostics-integration-report.md`
- `discussion/implementation/waves/wave85/wave85-final-integration-report.md`
- `discussion/implementation/waves/wave85/_map.md`

Reviews:

- `discussion/implementation/reviews/wave85/wave85-domain-a-spec-compliance-review.md`
- `discussion/implementation/reviews/wave85/wave85-domain-a-design-development-review.md`
- `discussion/implementation/reviews/wave85/wave85-domain-a-test-adequacy-review.md`
- `discussion/implementation/reviews/wave85/wave85-domain-b-spec-compliance-review.md`
- `discussion/implementation/reviews/wave85/wave85-domain-b-design-development-review.md`
- `discussion/implementation/reviews/wave85/wave85-domain-b-test-adequacy-review.md`
- `discussion/implementation/reviews/wave85/wave85-domain-c-spec-compliance-review.md`
- `discussion/implementation/reviews/wave85/wave85-domain-c-design-development-review.md`
- `discussion/implementation/reviews/wave85/wave85-domain-c-test-adequacy-review.md`
- `discussion/implementation/reviews/wave85/wave85-final-clean-integration-review.md`
- `discussion/implementation/reviews/wave85/_map.md`

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
- Treat diagnostics as read-only warnings, not fixes.
- Preserve Viewer exclusion.
- Keep Mesh generation failure details local to Mesh Tool.
- Do not migrate Product Preflight wholesale.
- Do not implement auto-fix, repair generation, AI proposal generation, completion score, quality judgement, or Viewer diagnostics.

Review-Sylph instructions must include:

- Review from source, tests, plan, and reports, not only from Gnome summary.
- Report `pass`, `needs_changes`, or `escalate`.
- Do not ask the user directly.
- Do not edit files unless explicitly delegated a narrow fix after review.
- Treat auto-fix, Viewer diagnostics, global mesh failure history, Product Preflight wholesale migration, or quality scoring as forbidden scope.
- Treat missing read-only Diagnostics list, missing badge, missing Mesh Tool inline failure diagnostics, or missing deterministic projection as blocking unless explicitly deferred by plan.

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
- Must not implement unrelated authoring, mesh algorithms, atlas, Viewer playback, camera, or transport features.

Review-Sylph:

- Reviews from artifacts and source, not only from Gnome summary.
- Must produce assigned lane report.
- Spec Compliance Review must not silently treat basis omissions as future scope.
- Must check forbidden scope, deterministic warning semantics, UI placement, jump safety, and test coverage explicitly.

Waiting rule:

- `wait_agent` timeout is polling timeout, not failure.
- No parent agent may terminate a child agent's work merely because it has not responded yet.
- If interruption is unavoidable, record incomplete / blocked / escalated. Do not pass the wave gate.

## 17. Out of Scope

- Completion score or model readiness score.
- Naturalness / rig quality judgement.
- Product Preflight full migration.
- Evidence-heavy raw payload UI.
- Auto-fix, repair generation, AI proposal generation, automatic operation application.
- Global mesh generation failure history.
- Mesh generation algorithm changes.
- Dynamics schema changes.
- Multi-pendulum, multi-output, same-output mixer.
- Viewer diagnostics, Viewer warning badges, Viewer output meters.
- Save/load format changes.
- Texture Atlas Task.
- PSD import semantic recognition or auto-rigging.
- Full renderer / pixel oracle.
- New external dependencies.
- Cubism SDK / `.moc3` / `.model3.json` / `.physics3.json` compatibility.
