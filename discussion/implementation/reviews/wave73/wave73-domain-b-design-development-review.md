# Wave73 Domain B Design / Development Compliance Review

- Verdict: `pass`
- Date: 2026-06-15
- Reviewer: Review-Sylph
- Target: `wave73-rotation2d-translation-exposure`

## Scope Reviewed

Reviewed Wave73 Domain B from source, tests, Wave73/Wave72 plans and reports, Domain A report/review, development policies, screen design docs, and the Domain B implementation report. This review did not rely only on the implementer summary.

Primary changed implementation/test areas inspected:

- `packages/operation-core/src/payloads/rig-control.ts`
- `packages/operation-core/src/operations/update-rig-control.ts`
- `packages/operation-core/src/operations/rig-control.test.ts`
- `packages/operation-core/src/operations/edit-keyform-key.test.ts`
- `packages/authoring-core/src/authoring-mutations.ts`
- `packages/authoring-core/src/rig-control-mutations.ts`
- `packages/authoring-core/src/rig-control-mutations.test.ts`
- `packages/authoring-core/src/linear-keyform-editing.ts`
- `packages/authoring-core/src/portable-project-bundle.test.ts`
- `packages/runtime-core/src/rig-control-keyform-evidence.test.ts`
- `apps/editor/src/features/editor-session/model/parameter-keyform-state.ts`
- `apps/editor/src/features/editor-session/model/rig-tool-state.ts`
- `apps/editor/src/workspace/panels/rig-tool-inspector.tsx`
- `apps/editor/src/workspace/panels/parameter-binding-section.tsx`
- `apps/editor/src/workspace/canvas/canvas-evaluation.ts`
- `apps/editor/src/workspace/canvas/canvas-projection.ts`
- `apps/editor/src/workspace/canvas/canvas-renderer.ts`
- `apps/editor/src/workspace/canvas/rotation-deformer-handles.ts`
- `apps/editor/src/workspace/canvas/rotation-deformer-gesture.ts`
- `apps/editor/src/workspace/canvas/use-rotation-deformer-interaction.ts`

## Basis Documents Used

- `discussion/implementation/orchestration/wave73-plan.md`, especially sections 3, 5, 7.4, 7.5, 7.6, 10, 14, 15, 16.
- `discussion/implementation/waves/wave73/wave73-domain-b-rotation2d-translation-exposure-report.md`.
- `discussion/implementation/waves/wave73/wave73-domain-a-save-load-restoration-tree-collapse-policy-report.md`.
- `discussion/implementation/reviews/wave73/wave73-domain-a-design-development-review.md`.
- `discussion/implementation/orchestration/wave72-plan.md`.
- `discussion/implementation/waves/wave72/wave72-final-integration-report.md`.
- `discussion/implementation/waves/wave72/wave72-domain-a-rotation-deformer-edit-ux-report.md`.
- `discussion/development_convention/ux-backed-package-logic-authority.md`.
- `discussion/development_convention/source-file-organization-policy.md`.
- `discussion/development_convention/dependency-policy.md`.
- `discussion/development_convention/operation-policy.md`.
- `discussion/development_convention/schema-and-id-conventions.md`.
- `discussion/design/screen-design/components/rig-tool.md`.
- `discussion/design/screen-design/components/parameter-keyform.md`.
- `discussion/design/screen-design/components/canvas-preview.md`.

## Findings

No blocking or needs-change findings.

## Architecture And Module-Boundary Notes

- The package/operation contract was extended vertically instead of using a GUI-only workaround. `UpdateRigControlPayloadSchema` accepts finite `restTranslation` through `Vec2Schema` at `packages/operation-core/src/payloads/rig-control.ts:91`, and `updateRigControl` forwards it into the authoring mutation at `packages/operation-core/src/operations/update-rig-control.ts:87`.
- Operation evidence remains coherent. The model diff includes `/restTranslation` at `packages/operation-core/src/operations/update-rig-control.ts:182`, and the operation test asserts dry-run non-mutation, commit result, preservation fields, and diff paths at `packages/operation-core/src/operations/rig-control.test.ts:743`.
- Authoring Core owns the semantic validation and mutation. Rotation-only field detection includes `restTranslation` at `packages/authoring-core/src/rig-control-mutations.ts:578`; wrong-kind updates are rejected at `packages/authoring-core/src/rig-control-mutations.ts:590`; finite x/y validation is enforced at `packages/authoring-core/src/rig-control-mutations.ts:834`.
- Keyed Rotation `translation` is package-level keyform behavior, not editor-local state. `linear-keyform-editing` accepts only `rotation2d` targets with `replace` / `additiveDelta` finite Vec2 patches at `packages/authoring-core/src/linear-keyform-editing.ts:396`.
- Editor mutation routes continue through Operation Core-backed commands. `commitUpdateRigControl` and `commitEditKeyformKey` wrap `updateRigControl` / `editKeyformKey` operation requests at `apps/editor/src/features/editor-session/model/editor-session-commands.ts:369` and `apps/editor/src/features/editor-session/model/editor-session-commands.ts:379`. Canvas gestures call those command wrappers through `rotation-deformer-gesture.ts` rather than mutating the graph directly.
- Source organization complies. `packages/authoring-core/src/index.ts:1` remains barrel-only re-export surface; no new catch-all production files or large `index.ts` implementation bodies were introduced. The source organization guard passed.

## Deterministic Behavior And Validation Notes

- Finite Vec2 handling is present at all relevant layers: operation payload schema (`packages/operation-core/src/payloads/rig-control.ts:97`), authoring mutation validation (`packages/authoring-core/src/rig-control-mutations.ts:834`), and keyform patch validation (`packages/authoring-core/src/linear-keyform-editing.ts:488`).
- Ambiguous keyform writes are locked. `createParameterBindingProjection` only enables editing when the active parameter value has an exact current keyform at `apps/editor/src/features/editor-session/model/parameter-keyform-state.ts:305` and `apps/editor/src/features/editor-session/model/parameter-keyform-state.ts:326`. Canvas translation mode resolves to `locked/missingCurrentKeyform` when translation keyforms exist but the current value is not exact at `apps/editor/src/workspace/canvas/use-rotation-deformer-interaction.ts:666`.
- Rest/keyed translation evaluation is deterministic. Canvas evaluation chooses preview translation, then keyed translation, then `restTranslation` at `apps/editor/src/workspace/canvas/canvas-evaluation.ts:429`, and applies translation after pivot-relative rotation at `apps/editor/src/workspace/canvas/canvas-evaluation.ts:742`.
- Handle hit-testing is stable and distinct. The handle kind union includes `translation` at `apps/editor/src/workspace/canvas/rotation-deformer-handles.ts:8`; the translation handle is computed separately at `apps/editor/src/workspace/canvas/rotation-deformer-handles.ts:40`; hit testing checks pivot, angle, then translation with separate tolerances at `apps/editor/src/workspace/canvas/rotation-deformer-handles.ts:91`.
- Single undoable gesture and cancel/no-commit behavior are preserved by `createEditorSessionGestureCommitController`, whose `commitOnce` guard is at `apps/editor/src/features/editor-session/model/editor-session-gesture-commit.ts:60`, and by pointer finish logic that clears preview and commits only when requested, moved, and changed at `apps/editor/src/workspace/canvas/use-rotation-deformer-interaction.ts:389`.
- Focused tests cover exact translation keyform commit and interpolated lock at `apps/editor/src/workspace/canvas/rotation-deformer-editing.test.ts:251`, hook-level rest/exact/locked translation drag at `apps/editor/src/workspace/canvas/rotation-deformer-editing.test.ts:422`, and parented/nested lock at `apps/editor/src/workspace/canvas/rotation-deformer-editing.test.ts:586`.

## UI Responsibility And Design Compliance

- Inspector exposes Rest translation X/Y in the same Pivot / translation / rest angle group as pivot/rest angle at `apps/editor/src/workspace/panels/rig-tool-inspector.tsx:760`, and payload generation only includes changed `restTranslation` at `apps/editor/src/workspace/panels/rig-tool-inspector.tsx:964`.
- Parameter Binding exposes Rotation `Translation` as a Vec2 binding at `apps/editor/src/features/editor-session/model/parameter-keyform-state.ts:618`; the panel renders X/Y numeric inputs for `vec2` bindings at `apps/editor/src/workspace/panels/parameter-binding-section.tsx:163`.
- Exact-keyform and lock states are represented consistently. The panel disables value editing through `projection.canEditValue` at `apps/editor/src/workspace/panels/parameter-binding-section.tsx:97`; tests assert Translation X/Y and Update/Delete are enabled at exact keyforms at `apps/editor/src/workspace/panels/parameter-binding-section.test.ts:79`.
- Canvas handle design is distinct from pivot/angle: renderer draws translation as a diamond while pivot/angle remain circular at `apps/editor/src/workspace/canvas/canvas-renderer.ts:442`; disabled locked state uses separate handle fill and not-allowed cursor behavior at `apps/editor/src/workspace/canvas/canvas-renderer.ts:462` and `apps/editor/src/workspace/panels/canvas-preview-panel.tsx:506`.
- Parented/nested direct Canvas editing is locked, which is allowed by the Wave73 plan pending a future inverse-transform contract. The hook exposes `parentedUnsupported` lock state at `apps/editor/src/workspace/canvas/use-rotation-deformer-interaction.ts:570`, and test-facing Canvas attributes expose translation mode and lock reason at `apps/editor/src/workspace/panels/canvas-preview-panel.tsx:717`.

## Forbidden Scope And Preservation Notes

- No `packages/package-format/**`, `package.json`, or `pnpm-lock.yaml` changes were present in the reviewed diff scope.
- Domain B did not add save/load implementation. Translation preservation is asserted through `packages/authoring-core/src/portable-project-bundle.test.ts:157` and keyed translation setup at `packages/authoring-core/src/portable-project-bundle.test.ts:406`, while save/load implementation changes in the worktree belong to Domain A's already-reviewed baseline.
- `restScale` / keyed scale are not exposed by operation payload or UI. `UpdateRigControlPayloadSchema` lists pivot, rest angle, rest translation, warp fields, and opacity only at `packages/operation-core/src/payloads/rig-control.ts:91`. `restScale` remains an internal/runtime field referenced by canvas evaluation at `apps/editor/src/workspace/canvas/canvas-evaluation.ts:457` and test fixtures.
- No separate translation deformer/control, mesh generation change, Viewer / Runtime View, Cubism compatibility surface, browser-local save slot, archive/filesystem path, or new dependency was introduced by Domain B.
- Wave72 pivot/rest-angle editing is preserved: the rotation handle tests still include pivot and angle deterministic positions at `apps/editor/src/workspace/canvas/rotation-deformer-editing.test.ts:70`, and the new translation handling is additive to the existing gesture paths.
- Domain A save/load restoration and tree collapse work was not reverted. The portable save/load E2E changes visible in `apps/editor/e2e/portable-project-save-load.e2e.spec.ts` are Domain A hidden Part Container / collapse-flow coverage, not Domain B translation implementation.

## Validation Rerun

Reviewer reran lightweight guards:

- `node scripts/check-source-organization.mjs`: passed.
- `node scripts/check-dependencies.mjs`: passed.
- `git diff --check -- packages/operation-core packages/authoring-core packages/runtime-core apps/editor discussion/implementation/waves/wave73 discussion/implementation/reviews/wave73`: exit 0 with CRLF normalization warnings only.

Reviewed, but did not rerun, the implementer-reported focused validation:

- Focused Vitest suite: 11 files / 86 tests passed after sandbox `spawn EPERM` escalation.
- `pnpm.cmd typecheck`: passed.
- Implementer-reported source organization, dependency, and focused diff checks passed.

## Residual Risks

- No browser-level translation drag path was added. For Design / Development Compliance this is not blocking because the source path is covered through operation, authoring, runtime evidence, component, projection, and hook tests; Test Adequacy review should make the final coverage call.
- Parented/nested direct Canvas translation editing remains intentionally locked. Enabling it later requires a separate accepted local/world inverse-transform contract.
- The workspace has parallel Domain A dirty changes. This review treated Domain A report/review as baseline and checked preservation, but final integration should still rerun combined validation.

## User-Decision Points

None required for this Design / Development Compliance pass.
