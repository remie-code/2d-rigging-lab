# Wave 72 Plan: Rotation Deformer Edit UX + Portable Project Save/Load Wiring

> Viewerへ進む前に、回転デフォーマを「作れるだけ」から「触って調整できるrig tool」に進め、既存portable package bundle能力をReact EditorのOpen/Save導線へ接続するwave。新しい保存形式は作らず、browser-local save slotも本waveでは扱わない。

## 1. Status

- Status: Planned / ready for orchestration
- Target wave: Wave72
- Wave name: `rotation-deformer-edit-ux-portable-save-load-wiring`
- Primary objective:
  - Rotation Deformerを選択・作成・評価済みの状態から、pivot / rest angle / keyformed angleを実用編集できる状態へ進める。
  - Canvas上で回転デフォーマのpivotと角度を直接操作できるUXを追加する。
  - 既存の `AuthoringSession` <-> `PackageDocument` / portable bundle能力をReact Editorから使えるOpen/Save UXへ接続する。
  - 保存/読込後もmesh、deformer hierarchy、warp edits、rotation edits、parameters、keyforms、materialized texture assetsが破綻しないことを証明する。

## 2. Planning Gate Result

Planning Gate result before this plan: `Inventory first`.

Why planning is now safe:

- ユーザー判断が明確:
  - Viewer / Runtime Viewより先にRotation Deformer編集を進める。
  - Save/Loadは「既存能力のEditor接続」が主目的であり、新保存形式の設計ではない。
  - Save/Load v0はportable bundle import/exportを優先する。
  - Browser-local save slotは現時点では必要性が低く、本waveでは扱わない。
- Read-only Sylph inventoryにより、次が確認済み:
  - Rotation Deformerはデータモデル、作成、選択、keyform、Canvas評価/overlay表示まで存在する。
  - 欠けているのはpivot/rest angleの永続編集、Canvas pivot/angle操作、keyform-aware canvas angle editingである。
  - `authoring-core` / `package-format` はpackage document、binary file set、portable bundleの下層能力を持つ。
  - 欠けているのはReact Editor側のsave/load controller、App Bar wiring、Project Storage task、session hydration/load replacementである。

Uncertainty:

- factual: medium. Rotation操作の座標空間、既存update operationの拡張範囲、current Editor stateのpackage editor state mappingはDomain内で確認が必要。
- decision: low-medium. v0のSave/Load scopeはportable bundleに固定済み。Rotation editing v0の最小成立範囲は計画で定義する。
- cost of wrong plan: high. Rotationのpivot/rest/keyform semanticsやload hydrationを誤ると、rig authoring loopと保存復元の信頼性を同時に壊す。

## 3. Accepted Decisions / Oracles

- Root / Undine must not implement the wave.
- Implementation must be delegated through Orch-Sylph -> Gnome / Review-Sylph.
- Root / Undine and Orch-Sylph must wait for every started subagent.
- `wait_agent` timeout is polling timeout, not failure.
- Running child agents must not be killed, interrupted, closed, or summarized as complete.
- Completed child sessions must be closed by their parent.
- Current mesh generation default and accepted mesh improvements must not be reverted.
- Rotation Deformer v0 editing must prioritize a usable authoring loop over Viewer work.
- Save/Load v0 must reuse existing project-defined package / portable bundle capabilities.
- Browser-local save slot, cloud storage, native filesystem, archive/ZIP, File System Access API, directory picker, and drag-drop import/export are out of scope.
- Portable bundle import/export is the accepted Wave72 save/load path.
- Save/Load wiring must not introduce a new package format.
- Rotation angle keyform edits must use the existing parameter/keyform model unless an explicit blocker is reported.
- Loading a project may clear transient editor drafts/history; this is acceptable for v0 if documented and tested.

## 4. Primary Basis

Common:

- [Implementation Orchestration Skill](../../../.agents/skills/implementation-orchestration/SKILL.md)
- [UX-Backed Package Logic Authority](../../development_convention/ux-backed-package-logic-authority.md)
- [Source File Organization Policy](../../development_convention/source-file-organization-policy.md)
- [Dependency Policy](../../development_convention/dependency-policy.md)
- [Operation Policy](../../development_convention/operation-policy.md)
- [Schema and ID Conventions](../../development_convention/schema-and-id-conventions.md)

Design / UX:

- [Rig Tool Component](../../design/screen-design/components/rig-tool.md)
- [Parameter Keyform Component](../../design/screen-design/components/parameter-keyform.md)
- [Canvas Preview Component](../../design/screen-design/components/canvas-preview.md)
- [Authoring Workspace Screen](../../design/screen-design/screens/authoring-workspace.md)
- [Project Storage Task](../../design/screen-design/screens/project-storage-task.md)
- [Toolbox Component](../../design/screen-design/components/toolbox.md)

Wave baseline:

- [Wave60 Plan](wave60-plan.md)
- [Wave61 Plan](wave61-plan.md)
- [Wave62 Plan](wave62-plan.md)
- [Wave63 Plan](wave63-plan.md)
- [Wave64 Plan](wave64-plan.md)
- [Wave65 Plan](wave65-plan.md)
- [Wave66 Plan](wave66-plan.md)
- [Wave67 Plan](wave67-plan.md)
- [Wave71 Plan](wave71-plan.md)

Confirmed inventory facts:

- Rotation data exists as `rotation2d` with `pivot`, `restAngleDegrees`, children, parent id, opacity multiplier, and enabled state.
- Editor can create Rotation Deformer from selected Drawable and insert Rotation Deformer above a selected rig control.
- Deformer Tree can render/select/reparent rotation deformers.
- Canvas evaluation applies rotation around pivot, using keyformed angle when present and `restAngleDegrees` otherwise.
- Canvas renderer already draws rotation overlay elements, but the overlay is display-only.
- Parameter/keyform UI exposes Rotation `angleDegrees` and opacity binding.
- `UpdateRigControlPayloadSchema` / authoring `updateRigControl` currently cover common fields and Warp-specific fields, not rotation pivot/rest angle.
- App Bar Open/Save buttons exist but have no working `onClick`.
- `storage` task entry exists but `AuthoringWorkspace` does not render a Project Storage task when selected.
- `EditorSessionProvider` has no storage actions, session replacement/load hydration API, or reset flow for current React Editor.

## 5. Review Policy

Each implemented domain requires three review lanes unless explicitly N/A:

1. `Spec Compliance Review`
   - Checks this wave plan and primary basis docs.
   - Each relevant basis requirement must be classified as `implemented` / `explicit non-goal` / `deferred by plan` / `unclear` / `not relevant`.
   - `unclear` is not pass.
2. `Design / Development Compliance Review`
   - Checks architecture, module boundary, source organization, operation boundary, dependency policy, deterministic behavior, UI responsibility split, and forbidden scope.
3. `Test Adequacy Review`
   - Checks unit / integration / browser / e2e coverage or N/A rationale for each in-scope requirement.

Each Gnome report must include:

- Basis Coverage Self-Report
- Intentionally Deferred Basis Items
- User-Facing UX Trace
- Operation / Package Contract Trace
- Save/Load State Preservation Trace where relevant
- Must-not Compliance Evidence
- Residual Risk Classification

## 6. Wave Strategy

Wave72 uses two implementation domains plus one final integration domain.

```text
Batch 1:
  Domain A: Rotation Deformer Edit UX
  Domain B: Portable Project Save/Load Editor Wiring

Batch 2:
  Domain C: Final Integration / Clean Review / Map Closeout
```

Dependency graph:

```text
A and B may start in parallel after bounded current-state confirmation.
B must include the final persisted shape of rotation edits if A changes package/operation contracts.
C depends on A/B pass or explicit escalation and performs final validation, clean review, and map closeout.
```

Rationale:

- Rotation editing and Save/Load wiring touch different primary concerns but converge in end-to-end state preservation.
- Running A and B as separate domains preserves focused implementation and review while allowing coordination through shared package/session contracts.
- C remains separate to force a clean integration gate over the combined authoring loop.

## 7. Acceptance Criteria

### 7.1 Rotation Deformer Persistent Editing

Required:

- Rotation Deformer committed state must be editable through durable operations.
- At minimum, committed Rotation Deformer editing must support:
  - `pivot.x`;
  - `pivot.y`;
  - `restAngleDegrees`.
- Operation-level validation must reject wrong-kind rig controls and invalid numeric values.
- Updating rotation fields must preserve hierarchy, child bindings, opacity, enabled state, and existing keyform bindings.
- Inspector must expose editable pivot and rest angle controls for selected Rotation Deformer.
- Inspector must still expose name, parent, opacity, children summary, and parameter binding state.
- Existing Warp Deformer editing behavior must remain unchanged.
- Existing Rotation Deformer creation and insert-parent flows must remain available.

Rest-angle semantics:

- `restAngleDegrees` remains the unkeyed fallback angle.
- Existing keyed `angleDegrees` values remain authoritative at keyed positions.
- If changing rest angle while keyforms exist is allowed, the UI/test evidence must make the effect explicit.
- If changing rest angle while keyforms exist is locked or warned, this must be implemented consistently in Inspector and tests.

### 7.2 Rotation Deformer Canvas Interaction

Required:

- Selected Rotation Deformer overlay must become interactive, not display-only.
- Canvas must provide a pivot handle that can drag the rotation pivot.
- Canvas must provide an angle/rotation handle or equivalent arc gesture that can edit rotation angle.
- Pointer interaction must preview changes during drag without committing multiple history entries.
- Pointer-up must commit one undoable user gesture.
- Cancel/abort path must discard preview state.
- Canvas interactions must be deterministic and testable through projection/hit-test helpers.
- Interaction must work in the current editor coordinate system for unparented and parented rotation deformers, or explicitly block/diagnose unsupported nested cases.

Keyform-aware angle editing:

- When the current parameter state is exactly on an editable keyform for a Rotation angle binding, canvas angle drag should update that keyform's `angleDegrees`.
- When not on an editable keyform, the UI must avoid silently writing ambiguous keyform state.
- Existing numeric `ParameterBindingSection` behavior for Rotation angle must remain available.

### 7.3 Portable Project Save / Load Editor Wiring

Required:

- Connect App Bar Save Project to portable bundle export using existing package/project-defined format capabilities.
- Connect App Bar Open Project to portable bundle import and session hydration.
- Add or activate a Project Storage task surface if needed to make Open/Save status and errors discoverable.
- Loading a project must replace the current `AuthoringSession` with the loaded session.
- Loading must clear or reset transient drafts/history that cannot be meaningfully preserved.
- Save status must not remain hardcoded to only `Untitled model` if a meaningful saved/loaded identity or status is available.
- Import/export must preserve materialized binary assets required by PSD-derived textures.
- Error states for invalid bundle, missing bytes, or digest mismatch must be user-visible and testable.

Portable bundle scope:

- Use existing `exportPortablePackageBundleV0` / `importPortablePackageBundleV0` or their current equivalents.
- Do not add ZIP/archive/native filesystem/cloud/browser-local save slot work.
- Do not create a new save format.
- Browser download/upload may be used if already compatible with the app stack; otherwise implement the smallest project-defined portable bundle transfer path consistent with current browser constraints.

### 7.4 Authoring State Preservation

Required round-trip targets:

- Part / Drawable hierarchy and mixed ordering.
- Mesh vertices, UVs, triangles, and generation provenance.
- Materialized texture asset refs and binary payloads.
- Warp Deformer hierarchy, bindings, domain/control point edits, and keyform offsets.
- Rotation Deformer hierarchy, bindings, pivot, rest angle, keyed angle, opacity, and enabled state.
- Parameters and keyform sets.
- Drawable opacity keyforms where present.
- Masks, draw order, source assets, provenance, and rights metadata where already represented by the package format.

Editor-local state:

- Selection, active tool, editor-hidden parts, canvas view, active parameter, and current parameter values may be persisted only if the existing editor-state contract can support them cleanly.
- Undo history, transient mesh/rig drafts, selected control point, and in-progress gestures are not required to persist.
- If Editor-local state is deferred, the final report must say so explicitly.

## 8. Domain Design

| Batch | Domain | Dependency | Purpose |
|---|---|---|---|
| 1 | A. Rotation Deformer Edit UX | Current rotation2d model/evaluation + Warp editing patterns | Operation/model support, Inspector editing, Canvas pivot/angle interaction, keyform-aware angle edit, tests |
| 1 | B. Portable Project Save/Load Editor Wiring | Existing package-format / authoring-core adapters | App Bar/Open Save wiring, Project Storage task, session hydration, portable bundle import/export, state preservation tests |
| 2 | C. Final Integration / Clean Review / Map Closeout | A/B pass or explicit escalation | Combined validation, clean review, reports/maps |

## 9. Domain A: `wave72-rotation-deformer-edit-ux`

Purpose:

- Make Rotation Deformer practically editable through Inspector and Canvas, with undoable operations and keyform-aware angle editing.

Expected implementation areas:

- `packages/operation-core/src/payloads/rig-control.ts`
- `packages/operation-core/src/operations/update-rig-control.ts`
- `packages/operation-core/src/operations/edit-keyform-key.ts` only if keyform operation contract needs alignment
- `packages/authoring-core/src/rig-control-mutations.ts`
- `packages/authoring-core/src/linear-keyform-editing.ts` only if keyform helpers need alignment
- `packages/runtime-core/src/rig-control-keyform-state.ts`
- `packages/runtime-core/src/rig-control-evaluation.ts`
- `apps/editor/src/features/editor-session/model/rig-tool-state.ts`
- `apps/editor/src/features/editor-session/model/editor-session-commands.ts`
- `apps/editor/src/features/editor-session/editor-session-context.tsx`
- `apps/editor/src/workspace/panels/rig-tool-inspector.tsx`
- `apps/editor/src/workspace/panels/parameter-binding-section.tsx` only if Rotation angle UX needs narrow alignment
- `apps/editor/src/workspace/canvas/canvas-projection.ts`
- `apps/editor/src/workspace/canvas/canvas-renderer.ts`
- `apps/editor/src/workspace/canvas/canvas-preview-panel.tsx`
- New focused canvas rotation hit-test / gesture modules if needed
- Focused unit/component/e2e tests

Allowed write scope:

- `packages/package-format/**` only if a missing schema field or type export blocks accepted rotation editing.
- `packages/operation-core/**`
- `packages/authoring-core/**`
- `packages/runtime-core/**` only for narrow rotation/keyform evaluation alignment.
- `apps/editor/**`
- `discussion/implementation/waves/wave72/**`
- `discussion/implementation/reviews/wave72/**`

Forbidden write scope:

- Project save/load implementation except narrow coordination stubs agreed with Domain B.
- Mesh generation algorithm changes.
- Renderer architecture rewrite.
- Viewer / Runtime View.
- New dependencies unless dependency policy is followed and escalated.

Required tests / evidence:

- Operation tests for pivot/rest-angle update success, invalid values, wrong-kind rejection, no-op or diff behavior, and hierarchy preservation.
- Editor context/model tests for rotation edit commands, undo/redo, selection preservation, and keyform-aware angle edits.
- Canvas tests for rotation overlay projection, pivot handle hit testing, angle handle hit testing, drag preview, pointer-up single commit, and cancel behavior.
- Inspector/component tests for editable pivot/rest angle and keyform/rest-angle messaging.
- Focused Playwright path for create Rotation Deformer -> edit pivot/angle -> add/update angle keyform -> observe changed evaluated artwork or test-facing overlay/evaluation state.

Early escape triggers:

- Parent/child coordinate conversion makes direct canvas editing unsafe without a broader transform contract.
- Existing operation model cannot express rotation setup edits without a package/schema change larger than this domain.
- Keyform editing semantics conflict with current parameter model.
- A deterministic test oracle for canvas rotation interaction cannot be created with current test-facing surfaces.

## 10. Domain B: `wave72-portable-project-save-load-editor-wiring`

Purpose:

- Wire existing portable project bundle capabilities into the React Editor so users can save the current project and load it back.

Expected implementation areas:

- `apps/editor/src/features/editor-session/editor-session-context.tsx`
- `apps/editor/src/features/editor-session/model/editor-session-commands.ts`
- New storage/service module under `apps/editor/src/features/project-storage/**` or a local editor-session storage module
- `apps/editor/src/workspace/app-bar.tsx`
- `apps/editor/src/workspace/authoring-workspace.tsx`
- `apps/editor/src/workspace/workspace-data.ts`
- `apps/editor/src/workspace/toolbox/workspace-toolbox.tsx`
- New or activated Project Storage task screen
- `packages/authoring-core/src/to-package-document.ts`
- `packages/authoring-core/src/from-package-document.ts`
- `packages/package-format/src/package-file-set.ts`
- `packages/package-format/src/package-binary-file-set.ts`
- `packages/package-format/src/portable-package-bundle.ts`
- `apps/editor/package.json` only if a direct package-format dependency is required by current package boundaries
- Focused unit/component/e2e tests

Allowed write scope:

- `apps/editor/**`
- `packages/authoring-core/**` for missing adapter coverage only
- `packages/package-format/**` for narrow portable bundle API/export fixes only
- `packages/operation-core/**` only if operation payload preservation requires narrow schema alignment
- `discussion/implementation/waves/wave72/**`
- `discussion/implementation/reviews/wave72/**`

Forbidden write scope:

- Browser-local save slot / IndexedDB UI.
- ZIP/archive/native filesystem/File System Access API/directory picker/drag-drop.
- New package format.
- Cloud/cross-profile persistence.
- Viewer / Runtime View.
- Broad package-format redesign.

Required tests / evidence:

- Unit test for AuthoringSession containing texture bytes, mesh, warp deformer, rotation deformer, parameters, and keyforms round-tripping through package document and portable bundle.
- Editor storage service tests for export, import, invalid bundle, missing bytes, and digest mismatch.
- Provider/component tests for save status, load replacement, reset/clear transient state if implemented, and App Bar button wiring.
- E2E or focused browser test for:
  - import or construct a project;
  - generate/apply mesh;
  - create/edit Warp and Rotation Deformers;
  - add/edit parameter/keyform state;
  - save portable bundle;
  - reset/reload/open bundle;
  - assert tree/deformer/mesh/parameter/keyform/render state is restored.

Early escape triggers:

- Current browser test environment cannot simulate portable bundle import/export without a stable file fixture path.
- Existing package-format cannot carry current React Editor texture bytes without a broader binary asset boundary change.
- Session hydration requires destructive state replacement that cannot preserve existing provider invariants.
- Dependency approval is required for download/upload mechanics.

## 11. Domain C: `wave72-final-integration-clean-review-map-closeout`

Purpose:

- Validate the combined authoring loop, obtain independent clean review, and update persistent maps/reports.

Expected implementation areas:

- `discussion/implementation/waves/wave72/**`
- `discussion/implementation/reviews/wave72/**`
- `discussion/implementation/_map.md`
- `discussion/implementation/orchestration/_map.md`
- Relevant design maps only if status links need alignment

Acceptance:

- Domain A implementation report exists and records pass or explicit escalation.
- Domain B implementation report exists and records pass or explicit escalation.
- Domain A/B Spec / Design-Development / Test Adequacy reviews exist and pass, or explicit escalation is recorded.
- Final clean integration review exists and passes before the wave is marked complete.
- Final report records:
  - Rotation edit UX delivered;
  - Inspector and Canvas edit paths;
  - keyform-aware angle behavior;
  - portable bundle Open/Save path;
  - state preservation evidence;
  - validation results;
  - residual risks and intentionally deferred editor-local state.
- Maps mark Wave72 status correctly.
- Current mesh default and accepted mesh behavior are not reverted.

Forbidden:

- Production source implementation except narrow documentation/map fixes.
- Closing the wave without independent clean review.
- Treating missing child-agent responses as pass.

Required checks:

- `pnpm typecheck`
- Focused operation-core rig-control tests
- Focused authoring-core package adapter / rig-control tests
- Focused runtime-core rotation/keyform evaluation tests if touched
- Focused editor session/context tests
- Focused editor component/canvas interaction tests
- Focused Playwright save/load and rotation edit path if stable
- `node scripts/check-source-organization.mjs`
- `node scripts/check-dependencies.mjs`
- `git diff --check`

## 12. Verification Matrix

| Requirement | Minimum evidence |
|---|---|
| Rotation pivot/rest editable | Operation tests, Inspector tests, Editor command tests |
| Rotation canvas pivot drag | Hit-test/gesture tests and focused e2e or test-facing overlay evidence |
| Rotation canvas angle edit | Gesture tests and keyform-aware command/evaluation evidence |
| Single undoable gesture | Editor context/history test |
| Keyed angle update | Parameter/keyform operation/editor tests |
| Warp behavior preserved | Focused regression tests over existing Warp edit path |
| App Bar Save connected | Component/provider test and e2e save path |
| App Bar Open connected | Component/provider test and e2e load path |
| Portable bundle reused | Package-format/authoring round-trip tests and no new format evidence |
| Binary assets preserved | Portable bundle test with materialized texture bytes |
| Mesh/deformer/parameter/keyform restored | Round-trip unit and focused browser/e2e evidence |
| Browser-local save excluded | Diff/review check and final report deferred item |
| No mesh regression | Diff/review check over mesh-generation default unless intentionally untouched |

## 13. Expected Persistent Artifacts

Reports:

- `discussion/implementation/waves/wave72/wave72-domain-a-rotation-deformer-edit-ux-report.md`
- `discussion/implementation/waves/wave72/wave72-domain-b-portable-project-save-load-editor-wiring-report.md`
- `discussion/implementation/waves/wave72/wave72-final-integration-report.md`
- `discussion/implementation/waves/wave72/_map.md`

Reviews:

- `discussion/implementation/reviews/wave72/wave72-domain-a-spec-compliance-review.md`
- `discussion/implementation/reviews/wave72/wave72-domain-a-design-development-review.md`
- `discussion/implementation/reviews/wave72/wave72-domain-a-test-adequacy-review.md`
- `discussion/implementation/reviews/wave72/wave72-domain-b-spec-compliance-review.md`
- `discussion/implementation/reviews/wave72/wave72-domain-b-design-development-review.md`
- `discussion/implementation/reviews/wave72/wave72-domain-b-test-adequacy-review.md`
- `discussion/implementation/reviews/wave72/wave72-final-clean-integration-review.md`
- `discussion/implementation/reviews/wave72/_map.md`

## 14. Subagent Contract

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
- Do not run overlapping broad refactors.
- Implement within the domain write scope.
- Preserve existing mesh generation and Warp editing behavior unless the plan explicitly requires a narrow change.

Review-Sylph instructions must include:

- Review from source, tests, plan, and reports, not only from Gnome summary.
- Report `pass`, `needs_changes`, or `escalate`.
- Do not ask the user directly.
- Do not edit files unless explicitly delegated a narrow fix after review.

## 15. Orchestration Policy

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
- May modify `packages/**` only when the assigned domain explicitly allows it and accepted UX/architecture requires it.
- May add dependencies only through dependency policy compliance and escalation.
- Must include Basis Coverage Self-Report and Deferred Basis Items.
- Must not implement Viewer, browser-local save slot, archive/filesystem, or mesh-generation changes outside this plan.

Review-Sylph:

- Reviews from artifacts and source, not only from Gnome summary.
- Must produce assigned lane report.
- Spec Compliance Review must not silently treat basis omissions as future scope.
- Must check Rotation editing, Save/Load wiring, portable bundle boundary, state preservation, forbidden scope, and test adequacy.

Waiting rule:

- `wait_agent` timeout is polling timeout, not failure.
- No parent agent may terminate a child agent's work merely because it has not responded yet.
- If interruption is unavoidable, record incomplete / blocked / escalated. Do not pass the wave gate.

## 16. Out of Scope

- Viewer / Runtime View.
- Texture Atlas Task.
- Variant / Expression Manager.
- Dynamics expansion.
- Browser-local save slot / IndexedDB UI.
- Cloud persistence.
- ZIP/archive/native filesystem/File System Access API/directory picker/drag-drop import/export.
- New package format.
- Operation log persistence redesign.
- Full editor-state persistence for undo history, transient drafts, selected control point, and in-progress gestures.
- Mesh generation algorithm changes.
- Manual mesh topology expansion.
- Renderer/WebGL architecture expansion.
- Pixel oracle / Photoshop compositing parity.
- Auto-rigging.
- Semantic recognition from part name, drawable name, or image content.
- Cubism SDK / `.moc3` / `.model3.json` compatibility.
- External HTTP / WebSocket / MCP transport.
- LLM provider integration.
- Repo-side semantic proposal generation / auto-fix.
