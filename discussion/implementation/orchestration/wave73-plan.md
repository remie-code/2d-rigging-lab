# Wave 73 Plan: Save/Load Restoration + Rotation Deformer Translation

> Wave72でEditor Open/SaveとRotation Deformer編集が通った後の修正wave。portable bundle復元漏れを塞ぎ、Parts Tree初期collapse policyを決め打ちし、Rotation Deformerに既存schema/runtime上のtranslation能力をEditor操作として露出する。

## 1. Status

- Status: Planned / ready for orchestration
- Target wave: Wave73
- Wave name: `save-load-restoration-rotation-translation`
- Primary objective:
  - Parts Container visibilityをportable bundle save/loadで復元する。
  - Save/Load round-trip assertionsを厚くし、model/package stateの復元漏れを検出できるようにする。
  - Parts Tree初期表示をContainer閉じ気味の方針へ変更する。
  - `rotation2d` の既存 `restTranslation` / keyed `translation` 能力をoperation、Inspector、Canvas、parameter/keyform UIへ露出する。

## 2. Planning Gate Result

Planning Gate result before this plan: `Inventory then discuss`.

Why planning is now safe:

- ユーザー判断が明確:
  - Parts Container visibilityは永続化対象として確定。
  - Selection、active tool、canvas view、current parameter valuesは現時点では保存しない。
  - Undo history、drafts、drag previewは保存不要。
  - Collapsed tree stateは保存しない。ただし初期表示policyとしてContainerを閉じ気味にする改善をWave73に含める。
  - Rotation Deformer translationは `rotation2d` に含める方針で確定。別deformer化しない。
- Read-only Sylph inventoryにより、次が確認済み:
  - Parts Container visibilityはReact state `editorHiddenPartIds` にあり、save時にbundleへ渡されず、load時に明示クリアされる。
  - package-formatには `model.editorState.editorHiddenIds` の受け皿候補が既に存在する。
  - `rotation2d` schemaには `restTranslation` が既にあり、作成時も `{ x: 0, y: 0 }` が設定される。
  - runtime/keyform contractはtranslationを概ね扱えるが、Wave72 Editor operation/UI/keyform authoringには露出していない。

Uncertainty:

- factual: medium. `editorState.editorHiddenIds` hydration boundary、stale-id filtering、current tree collapse initialization、translation keyform editing helpersはDomain内で確認が必要。
- decision: low. Product direction and main scope are fixed.
- cost of wrong plan: high. Save/Load復元漏れやtranslationの座標/評価semanticsを誤ると、保存信頼性とrig authoring UXの両方を損なう。

## 3. Accepted Decisions / Oracles

- Root / Undine must not implement the wave.
- Implementation must be delegated through Orch-Sylph -> Gnome / Review-Sylph.
- Root / Undine and Orch-Sylph must wait for every started subagent.
- `wait_agent` timeout is polling timeout, not failure.
- Running child agents must not be killed, interrupted, closed, or summarized as complete.
- Completed child sessions must be closed by their parent.
- Current mesh generation default and accepted mesh improvements must not be reverted.
- Wave72 portable bundle Open/Save path must remain the save/load foundation.
- Do not introduce browser-local save slot, IndexedDB UI, new package format, archive/filesystem, File System Access API, directory picker, drag/drop, or cloud persistence.
- Parts Container visibility is durable editor project state for this product.
- Parts Container visibility must be stored using package editor state or an equivalent existing package-defined editor-state path, not a new save format.
- Selection, active tool, canvas view, current parameter values, undo history, drafts, and in-progress gestures are not Wave73 persistence targets.
- Collapsed tree state is not persisted in Wave73.
- Parts Tree initial display policy must change to a collapsed-by-default container presentation, with session-only manual expand/collapse.
- Rotation translation belongs inside `rotation2d`.
- Use existing naming unless implementation proves otherwise:
  - rest/setup value: `restTranslation`;
  - keyed animated value: `translation`.
- Recommended transform semantics are accepted for implementation:
  - rotate around `pivot`;
  - then apply parallel `translation`;
  - parent/ancestor transforms apply through existing hierarchy evaluation.
- Scale exists in schema/runtime but must not be exposed accidentally.
- Parented/nested direct Canvas translation editing may remain locked pending a future inverse-transform contract. Numeric local fields may still be allowed when safe.

## 4. Primary Basis

Common:

- [Implementation Orchestration Skill](../../../.agents/skills/implementation-orchestration/SKILL.md)
- [UX-Backed Package Logic Authority](../../development_convention/ux-backed-package-logic-authority.md)
- [Source File Organization Policy](../../development_convention/source-file-organization-policy.md)
- [Dependency Policy](../../development_convention/dependency-policy.md)
- [Operation Policy](../../development_convention/operation-policy.md)
- [Schema and ID Conventions](../../development_convention/schema-and-id-conventions.md)

Design / UX:

- [Project Storage Task](../../design/screen-design/screens/project-storage-task.md)
- [Authoring Workspace Screen](../../design/screen-design/screens/authoring-workspace.md)
- [Rig Tool Component](../../design/screen-design/components/rig-tool.md)
- [Parameter Keyform Component](../../design/screen-design/components/parameter-keyform.md)
- [Canvas Preview Component](../../design/screen-design/components/canvas-preview.md)

Wave baseline:

- [Wave72 Plan](wave72-plan.md)
- [Wave72 Final Integration Report](../waves/wave72/wave72-final-integration-report.md)
- [Wave72 Final Clean Integration Review](../reviews/wave72/wave72-final-clean-integration-review.md)
- [Wave72 Domain A Report](../waves/wave72/wave72-domain-a-rotation-deformer-edit-ux-report.md)
- [Wave72 Domain B Report](../waves/wave72/wave72-domain-b-portable-project-save-load-editor-wiring-report.md)

Confirmed inventory facts:

- `editorHiddenPartIds` is current React editor state and is cleared during load.
- `model.editorState.editorHiddenIds` exists as a package editor-state candidate.
- Drawable visibility, default opacity, order/reparenting, mesh, texture bytes, warp deformers, rotation deformers, and parameters/keyforms are package/model state and appear saveable, but several have weak direct round-trip assertions.
- `rotation2d` already persists `restTranslation` and `restScale`.
- runtime transform supports translation, but operation/editor authoring lacks `restTranslation` update and `translation` keyform UI.

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

Wave73 uses two implementation domains plus one final integration domain.

```text
Batch 1:
  Domain A: Save/Load Restoration + Parts Tree Initial Collapse Policy

Batch 2:
  Domain B: Rotation2d Translation Exposure

Batch 3:
  Domain C: Final Integration / Clean Review / Map Closeout
```

Dependency graph:

```text
A fixes editor-state persistence and tree initialization first.
B depends on A pass or explicit escalation, so B can build translation round-trip tests on the corrected save/load path.
C depends on A/B pass or explicit escalation and performs final validation, clean review, and map closeout.
```

Rationale:

- A and B both touch `apps/editor` and save/load tests; running them in parallel would create avoidable write collisions.
- Translation save/load assertions should use the corrected editor/project storage path from Domain A.
- C remains separate to force a clean integration gate over persistence plus rig-authoring changes.

## 7. Acceptance Criteria

### 7.1 Parts Container Visibility Persistence

Required:

- Save must serialize current `editorHiddenPartIds` into the existing package editor-state path or an equivalent project-defined editor-state container.
- Load must hydrate Parts Container visibility from saved editor state.
- Hydration must validate IDs against current Part Container IDs and drop stale IDs deterministically.
- Load must no longer blindly clear saved `editorHiddenPartIds` when valid saved editor state exists.
- PSD import seeded hidden groups must continue to behave correctly.
- User-visible Parts Tree and Canvas effective visibility must reflect restored hidden Parts Container state.

Must not:

- Move Parts Container visibility into core model visibility unless a blocker proves editor-state storage impossible.
- Persist undo history, drafts, in-progress gestures, active tool, canvas view, current parameter values, or selection as part of this requirement.

### 7.2 Save/Load Round-Trip Assertion Hardening

Required:

- Add or strengthen tests for save/load round-trip of:
  - Parts Container visibility;
  - Drawable visibility;
  - default opacity;
  - order / reparenting;
  - mesh vertices/UVs/triangles/provenance;
  - texture binary bytes;
  - Warp Deformer numeric state and keyform offsets;
  - Rotation Deformer pivot/restAngle/keyed angle;
  - parameters and keyform sets.
- Tests must distinguish:
  - package/model state expected to persist;
  - editor-local state intentionally not persisted;
  - transient state intentionally cleared.
- Save/load tests should not require browser-local save slots or filesystem APIs.

### 7.3 Parts Tree Initial Collapse Policy

Required:

- Parts Tree should initialize with Part Containers collapsed by default where this improves scanability.
- Manual expand/collapse remains session-only state.
- Collapsed state must not be serialized into portable bundle in Wave73.
- The implementation may auto-expand a narrow path when needed for immediate user task continuity, such as selected item, newly created item, or error/focused target, but this must be deterministic and documented.
- Existing tests that rely on visible descendants must either use explicit expand actions or stable helpers rather than relying on all containers starting open.

### 7.4 Rotation2d Rest Translation

Required:

- Expose `restTranslation` as committed editable Rotation Deformer setup state.
- Operation-level update must support finite `restTranslation.x` and `restTranslation.y`.
- Operation-level validation must reject wrong-kind rig controls and invalid numeric values.
- Updating `restTranslation` must preserve pivot, rest angle, hierarchy, child bindings, opacity, enabled state, and existing keyform bindings.
- Inspector must expose Rest translation X/Y near pivot/rest angle.
- Save/load round-trip must preserve nonzero `restTranslation`.
- Do not expose `restScale` in Wave73.

### 7.5 Rotation2d Keyed Translation

Required:

- Parameter/keyform authoring must support keyed Rotation `translation` as a Vec2 value.
- Existing Rotation `angleDegrees` and opacity binding behavior must remain available.
- Exact keyform position editing may update keyed `translation`.
- Interpolated/between-key states must not silently write ambiguous keyed translation.
- Existing runtime/keyform semantics should be reused where possible.
- Save/load round-trip must preserve nonzero keyed `translation`.

### 7.6 Rotation2d Canvas Translation Interaction

Required:

- Canvas must provide a translation/move handle or gesture distinct from pivot drag.
- Translation drag must preview movement during drag.
- Pointer-up must commit one undoable gesture.
- Cancel/abort must discard preview.
- With no translation keyform context, translation drag edits `restTranslation`.
- At an exact editable translation keyform, translation drag edits keyed `translation`.
- Ambiguous interpolated states must be locked or clearly non-committal.
- Parented/nested direct Canvas translation editing may remain blocked with a clear reason until a future transform-contract wave.

## 8. Domain Design

| Batch | Domain | Dependency | Purpose |
|---|---|---|---|
| 1 | A. Save/Load Restoration + Parts Tree Initial Collapse Policy | Wave72 save/load path | Persist hidden Part Containers, harden round-trip assertions, change tree initial collapse policy |
| 2 | B. Rotation2d Translation Exposure | A pass or explicit escalation | Expose rest/keyed translation through operations, Inspector, Canvas, keyforms, and save/load tests |
| 3 | C. Final Integration / Clean Review / Map Closeout | A/B pass or explicit escalation | Combined validation, independent clean review, reports/maps |

## 9. Domain A: `wave73-save-load-restoration-tree-collapse-policy`

Purpose:

- Fix observed save/load restoration gap and update Parts Tree initial display policy.

Expected implementation areas:

- `apps/editor/src/features/editor-session/editor-session-context.tsx`
- `apps/editor/src/features/editor-session/model/editor-session-commands.ts`
- `apps/editor/src/features/editor-session/model/editor-hidden-part-state.ts`
- `apps/editor/src/features/project-storage/**`
- `apps/editor/src/workspace/**` Parts Tree / tree initialization paths
- `packages/authoring-core/src/to-package-document.ts`
- `packages/authoring-core/src/from-package-document.ts`
- `packages/authoring-core/src/package-document-model-files.ts`
- `packages/package-format/src/model-files.ts` only if existing editor-state schema/export needs a narrow fix
- `apps/editor/e2e/portable-project-save-load.e2e.spec.ts`
- Focused unit/component/e2e tests

Allowed write scope:

- `apps/editor/**`
- `packages/authoring-core/**` for editor-state adapter/hydration only
- `packages/package-format/**` for narrow editor-state type/export fixes only
- `discussion/implementation/waves/wave73/**`
- `discussion/implementation/reviews/wave73/**`

Forbidden write scope:

- Rotation translation implementation except round-trip test placeholders that do not change behavior.
- Browser-local save slot / IndexedDB UI.
- ZIP/archive/native filesystem/File System Access API/directory picker/drag-drop.
- New package format.
- Cloud/cross-profile persistence.
- Viewer / Runtime View.
- Mesh generation algorithm changes.

Required tests / evidence:

- Provider/unit test: hide Part Container -> export portable bundle -> load bundle -> hidden Part Container restored.
- Stale-id test for editor hidden IDs.
- Browser/e2e assertion: hidden Part Container remains hidden after save/load and Canvas effective visibility follows.
- Round-trip assertions for drawable visibility, default opacity, order/reparenting, mesh, texture bytes, warp numeric state/keyforms, rotation numeric state/keyforms, parameters/keyforms.
- Tree initialization test proving Part Containers default collapsed and manual expand/collapse is session-only.
- Negative assertion that undo history/drafts/in-progress gesture state is not persisted.

Early escape triggers:

- Existing package editor-state schema cannot safely represent hidden Part IDs without a broader format decision.
- Tree collapse policy conflicts with current e2e or accessibility selectors in a way that requires broad test migration.
- Save/load round-trip test oracle becomes too broad or flaky to be useful.

## 10. Domain B: `wave73-rotation2d-translation-exposure`

Purpose:

- Expose existing Rotation Deformer translation capability through product-facing authoring UX.

Expected implementation areas:

- `packages/operation-core/src/payloads/rig-control.ts`
- `packages/operation-core/src/operations/update-rig-control.ts`
- `packages/operation-core/src/operations/edit-keyform-key.ts`
- `packages/operation-core/src/operations/add-keyform.ts` only if keyed Vec2 initialization requires alignment
- `packages/authoring-core/src/rig-control-mutations.ts`
- `packages/authoring-core/src/linear-keyform-editing.ts`
- `packages/authoring-core/src/keyform-mutations.ts` only if necessary for Vec2 translation
- `packages/runtime-core/src/rig-control-transform.ts`
- `packages/runtime-core/src/rig-control-keyform-state.ts`
- `packages/runtime-core/src/rig-control-evaluation.ts`
- `apps/editor/src/features/editor-session/model/rig-tool-state.ts`
- `apps/editor/src/features/editor-session/model/editor-session-commands.ts`
- `apps/editor/src/features/editor-session/editor-session-context.tsx`
- `apps/editor/src/workspace/panels/rig-tool-inspector.tsx`
- `apps/editor/src/workspace/panels/parameter-binding-section.tsx`
- `apps/editor/src/workspace/canvas/**` rotation projection/handles/interaction
- Focused unit/component/e2e tests

Allowed write scope:

- `packages/operation-core/**`
- `packages/authoring-core/**`
- `packages/runtime-core/**` for narrow translation evaluation/keyform alignment
- `packages/package-format/**` only if existing `restTranslation` / keyform schema export blocks the accepted UX
- `apps/editor/**`
- `discussion/implementation/waves/wave73/**`
- `discussion/implementation/reviews/wave73/**`

Forbidden write scope:

- Save/load restoration implementation except round-trip tests using Domain A path.
- Exposing `restScale` or keyed scale.
- Adding a separate translation deformer/control.
- Mesh generation changes.
- Viewer / Runtime View.
- New dependencies unless dependency policy is followed and escalated.

Required tests / evidence:

- Operation tests for `restTranslation` update success, invalid values, wrong-kind rejection, diff behavior, and hierarchy preservation.
- Authoring mutation tests for finite Vec2 validation and preservation of rotation fields/keyforms.
- Keyform tests for Rotation keyed `translation` Vec2 add/edit/interpolation behavior.
- Runtime tests for nonzero rest translation, keyed translation, hierarchy composition, and snapshot/diff evidence if relevant.
- Inspector tests for Rest translation X/Y.
- Parameter binding tests for keyed translation Vec2 editing.
- Canvas projection/handle tests for distinct translation handle and hit testing.
- Interaction hook tests for move preview, pointer-up single commit, cancel/no-commit, rest vs keyed translation behavior, and locked ambiguous/interpolated states.
- Portable save/load round-trip test with nonzero `restTranslation` and keyed `translation`.
- Focused browser path if stable; otherwise explicit test adequacy rationale from Review-Sylph.

Early escape triggers:

- Current keyform data model cannot represent Vec2 translation without broader schema/API changes.
- Coordinate space for translation cannot be made deterministic for unparented controls.
- Parent/nested locking cannot be represented in UI without misleading interaction.
- Adding translation requires exposing scale or another forbidden transform dimension.

## 11. Domain C: `wave73-final-integration-clean-review-map-closeout`

Purpose:

- Validate the combined save/load restoration and rotation translation work, obtain independent clean review, and update persistent maps/reports.

Expected implementation areas:

- `discussion/implementation/waves/wave73/**`
- `discussion/implementation/reviews/wave73/**`
- `discussion/implementation/_map.md`
- `discussion/implementation/orchestration/_map.md`
- Relevant design maps only if status links need alignment

Acceptance:

- Domain A implementation report exists and records pass or explicit escalation.
- Domain B implementation report exists and records pass or explicit escalation.
- Domain A/B Spec / Design-Development / Test Adequacy reviews exist and pass, or explicit escalation is recorded.
- Final clean integration review exists and passes before the wave is marked complete.
- Final report records:
  - Parts Container visibility persistence;
  - round-trip assertion hardening;
  - Parts Tree initial collapse policy;
  - Rotation rest/keyed translation delivered;
  - Inspector, Canvas, and keyform UX trace;
  - save/load translation evidence;
  - validation results;
  - residual risks and intentionally deferred editor-local state.
- Maps mark Wave73 status correctly.

Forbidden:

- Production source implementation except narrow documentation/map fixes.
- Closing the wave without independent clean review.
- Treating missing child-agent responses as pass.

Required checks:

- `pnpm typecheck`
- Focused operation-core rig-control/keyform tests
- Focused authoring-core package adapter / rig-control / keyform tests
- Focused runtime-core rotation/keyform evaluation tests
- Focused editor session/context tests
- Focused editor component/canvas interaction tests
- Focused Playwright portable save/load path if stable
- `node scripts/check-source-organization.mjs`
- `node scripts/check-dependencies.mjs`
- `git diff --check`

## 12. Verification Matrix

| Requirement | Minimum evidence |
|---|---|
| Parts Container visibility persists | Provider/unit test and focused e2e |
| Stale hidden IDs filtered | Unit test |
| Model state round-trip strengthened | Portable bundle tests/e2e assertions |
| Tree starts collapsed | Component/provider/e2e assertion |
| Collapsed state not persisted | Unit or report evidence |
| `restTranslation` editable | Operation/editor/Inspector tests |
| keyed `translation` editable | Keyform/editor tests |
| translation Canvas move handle | Projection/interaction tests |
| single undoable translation gesture | Editor context/history test |
| ambiguous translation states locked | Interaction/keyform tests |
| translation save/load | Portable bundle round-trip test |
| scale not exposed | Diff/review check |
| no new save format/browser-local save | Diff/review check |

## 13. Expected Persistent Artifacts

Reports:

- `discussion/implementation/waves/wave73/wave73-domain-a-save-load-restoration-tree-collapse-policy-report.md`
- `discussion/implementation/waves/wave73/wave73-domain-b-rotation2d-translation-exposure-report.md`
- `discussion/implementation/waves/wave73/wave73-final-integration-report.md`
- `discussion/implementation/waves/wave73/_map.md`

Reviews:

- `discussion/implementation/reviews/wave73/wave73-domain-a-spec-compliance-review.md`
- `discussion/implementation/reviews/wave73/wave73-domain-a-design-development-review.md`
- `discussion/implementation/reviews/wave73/wave73-domain-a-test-adequacy-review.md`
- `discussion/implementation/reviews/wave73/wave73-domain-b-spec-compliance-review.md`
- `discussion/implementation/reviews/wave73/wave73-domain-b-design-development-review.md`
- `discussion/implementation/reviews/wave73/wave73-domain-b-test-adequacy-review.md`
- `discussion/implementation/reviews/wave73/wave73-final-clean-integration-review.md`
- `discussion/implementation/reviews/wave73/_map.md`

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
- Preserve existing mesh generation, Wave72 save/load foundation, and Wave72 rotation editing behavior unless this plan explicitly requires a narrow change.

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
- Must not implement Viewer, browser-local save slot, archive/filesystem, mesh-generation changes, or scale exposure outside this plan.

Review-Sylph:

- Reviews from artifacts and source, not only from Gnome summary.
- Must produce assigned lane report.
- Spec Compliance Review must not silently treat basis omissions as future scope.
- Must check Parts visibility persistence, round-trip tests, tree collapse policy, Rotation translation, forbidden scope, and test adequacy.

Waiting rule:

- `wait_agent` timeout is polling timeout, not failure.
- No parent agent may terminate a child agent's work merely because it has not responded yet.
- If interruption is unavoidable, record incomplete / blocked / escalated. Do not pass the wave gate.

## 16. Out of Scope

- Persisting selection, active tool, canvas view, current parameter values, undo history, drafts, selected control point, and in-progress gestures.
- Persisting manual collapsed tree state.
- Browser-local save slot / IndexedDB UI.
- Cloud persistence.
- ZIP/archive/native filesystem/File System Access API/directory picker/drag-drop import/export.
- New package format.
- Separate translation deformer/control.
- Exposing `restScale` or keyed scale.
- Viewer / Runtime View.
- Texture Atlas Task.
- Variant / Expression Manager.
- Dynamics expansion.
- Mesh generation algorithm changes.
- Renderer/WebGL architecture expansion.
- Pixel oracle / Photoshop compositing parity.
- Auto-rigging.
- Semantic recognition from part name, drawable name, or image content.
- Cubism SDK / `.moc3` / `.model3.json` compatibility.
- External HTTP / WebSocket / MCP transport.
- LLM provider integration.
- Repo-side semantic proposal generation / auto-fix.
