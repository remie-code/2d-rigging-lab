# Wave72 Domain A Spec Compliance Review

## Verdict

pass

No needs-change findings were found for Wave72 Domain A. The implementation satisfies the in-scope Rotation Deformer persistent edit and Canvas interaction requirements. The only unimplemented items reviewed here are classified as `deferred by plan` or `explicit non-goal`, not `unclear`.

## Fix Loop 1 Re-review

Final verdict after Gnome fix loop 1: `pass`.

Reviewed the narrow fix-loop changes in `apps/editor/src/workspace/canvas/canvas-renderer.ts`, `apps/editor/src/workspace/canvas/rotation-deformer-editing.test.ts`, `apps/editor/src/features/editor-session/model/editor-session-commands.test.ts`, and the updated Domain A implementation report. No Wave72 Domain A requirement classification changed. The renderer change aligns the overlay drawing path with the existing shared Rotation handle helper, and the added tests strengthen existing evidence for pointer preview/commit/cancel lifecycle, redo/history behavior, selected rig-control preservation, and parented `parentedUnsupported` lock behavior.

Re-review verification:

- Focused Domain A Vitest suite initially hit sandbox esbuild `spawn EPERM`; escalated rerun passed: 6 files, 65 tests.
- `pnpm.cmd typecheck`: passed.
- `node scripts/check-source-organization.mjs`: passed.
- `node scripts/check-dependencies.mjs`: passed.
- `git diff --check`: exit 0; CRLF conversion warnings only.

## Fix Loop 2 Spot Re-review

Final verdict after Gnome fix loop 2: `pass`.

Reviewed the narrow fix-loop changes in `apps/editor/src/features/editor-session/editor-session-context.tsx`, `apps/editor/src/features/editor-session/editor-session-context-history.test.ts`, `apps/editor/src/features/editor-session/model/editor-session-commands.test.ts`, and the updated Domain A implementation report. No Wave72 Domain A requirement classification changed. The added provider props are optional testability inputs and preserve the normal empty-session/null-selection initialization path. The new stateful provider history test strengthens Section 9 evidence by reading live `context.selection` while asserting the selected Rotation Deformer survives Rotation pivot/rest edits, angle keyform edits, undo, and redo. No Domain A save/load scope was added.

Spot re-review verification:

- Focused Domain A Vitest suite initially hit sandbox esbuild `spawn EPERM`; escalated rerun passed: 7 files, 74 tests.
- `pnpm.cmd typecheck`: passed.
- `node scripts/check-source-organization.mjs`: passed.
- `node scripts/check-dependencies.mjs`: passed.
- `git diff --check`: exit 0; CRLF conversion warnings only.

## Scope reviewed

- Domain: `wave72-rotation-deformer-edit-ux`.
- Review lane: Spec Compliance Review.
- Source reviewed: operation payload/handler, authoring mutation, editor command/history path, Canvas projection/evaluation/renderer/interaction, Inspector, and focused tests listed in the Domain A report.
- Parallel dirty Domain B save/load and Project Storage work was observed but not reviewed as Domain A. No unreported shared-file dependency was found that changes the Domain A verdict.

## Basis documents used

- `discussion/implementation/orchestration/wave72-plan.md`, especially sections 3, 5, 7.1, 7.2, 9, 12, 14, 15, 16.
- `discussion/development_convention/ux-backed-package-logic-authority.md`.
- `discussion/development_convention/operation-policy.md`.
- `discussion/development_convention/schema-and-id-conventions.md`.
- `discussion/design/screen-design/components/rig-tool.md`.
- `discussion/design/screen-design/components/parameter-keyform.md`.
- `discussion/design/screen-design/components/canvas-preview.md`.
- `discussion/design/screen-design/screens/authoring-workspace.md`.
- `discussion/implementation/waves/wave72/wave72-domain-a-rotation-deformer-edit-ux-report.md`.

## Reviewer verification

- `pnpm.cmd exec vitest run packages/operation-core/src/operations/rig-control.test.ts packages/authoring-core/src/rig-control-mutations.test.ts apps/editor/src/features/editor-session/model/editor-session-commands.test.ts apps/editor/src/workspace/canvas/canvas-projection.test.ts apps/editor/src/workspace/canvas/rotation-deformer-editing.test.ts apps/editor/src/workspace/panels/rig-tool-inspector.test.ts`
  - Initial sandbox run failed with esbuild `spawn EPERM`.
  - Escalated rerun passed: 6 files, 62 tests.
- `pnpm.cmd typecheck`: passed.
- `node scripts/check-source-organization.mjs`: passed.
- `node scripts/check-dependencies.mjs`: passed.
- `git diff --check`: exit 0; CRLF conversion warnings only.

## Requirement classification

| Requirement | Classification | Evidence |
|---|---|---|
| Wave72 must prioritize Rotation Deformer authoring loop over Viewer work. | implemented | Plan oracle: `discussion/implementation/orchestration/wave72-plan.md:48`. No Viewer/Runtime files were part of Domain A. |
| Rotation angle keyform edits must use existing parameter/keyform model. | implemented | Plan oracle: `discussion/implementation/orchestration/wave72-plan.md:53`; keyform commit uses `commitEditKeyformKey` in `apps/editor/src/workspace/canvas/rotation-deformer-gesture.ts:86`. |
| Update operation must support `pivot.x`, `pivot.y`, `restAngleDegrees`. | implemented | Payload accepts `pivot` and `restAngleDegrees`: `packages/operation-core/src/payloads/rig-control.ts:91`; mutation applies them: `packages/authoring-core/src/rig-control-mutations.ts:609`. |
| Rotation field edits must be durable operations. | implemented | Canvas/Inspector route through `commitUpdateRigControl`: `apps/editor/src/workspace/canvas/rotation-deformer-gesture.ts:56`; operation handler calls authoring mutation: `packages/operation-core/src/operations/update-rig-control.ts:82`. |
| Wrong-kind and invalid numeric values must be rejected. | implemented | Kind/numeric checks: `packages/authoring-core/src/rig-control-mutations.ts:587`, `packages/authoring-core/src/rig-control-mutations.ts:801`; diagnostics: `packages/operation-core/src/operations/update-rig-control.ts:249`; tests: `packages/operation-core/src/operations/rig-control.test.ts:810`. |
| Updating rotation fields must preserve hierarchy, child bindings, opacity, enabled state, and existing keyforms. | implemented | Mutation clones/assigns only edited fields: `packages/authoring-core/src/rig-control-mutations.ts:602`; preservation test: `packages/authoring-core/src/rig-control-mutations.test.ts:329`. |
| Inspector must expose editable pivot/rest angle controls. | implemented | UI controls: `apps/editor/src/workspace/panels/rig-tool-inspector.tsx:757`; test: `apps/editor/src/workspace/panels/rig-tool-inspector.test.ts:86`. |
| Inspector must still expose name, parent, opacity, children summary, and parameter binding state. | implemented | Rotation Inspector includes name/parent/children/keyforms: `apps/editor/src/workspace/panels/rig-tool-inspector.tsx:709`; ParameterBindingSection: `apps/editor/src/workspace/panels/rig-tool-inspector.tsx:754`; opacity: `apps/editor/src/workspace/panels/rig-tool-inspector.tsx:809`. |
| Existing Warp Deformer editing behavior must remain unchanged. | implemented | Existing Warp tests remain in focused suite; command test covers Warp update/cardinality conflict: `apps/editor/src/features/editor-session/model/editor-session-commands.test.ts:349`; guards passed. |
| Existing Rotation creation and insert-parent flows must remain available. | implemented | Editor command tests cover creation and parent insertion: `apps/editor/src/features/editor-session/model/editor-session-commands.test.ts:301`, `apps/editor/src/features/editor-session/model/editor-session-commands.test.ts:534`. |
| `restAngleDegrees` remains unkeyed fallback. | implemented | Evaluation falls back to rest angle: `apps/editor/src/workspace/canvas/canvas-evaluation.ts:422`; binding base value is rest angle: `apps/editor/src/features/editor-session/model/parameter-keyform-state.ts:567`. |
| Existing keyed `angleDegrees` values remain authoritative at keyed positions. | implemented | Evaluation reads keyed angle before rest fallback: `apps/editor/src/workspace/canvas/canvas-evaluation.ts:423`; keyform evaluation applies angle property: `apps/editor/src/features/editor-session/model/parameter-keyform-state.ts:496`. |
| If rest angle is editable while keyforms exist, UI/test evidence must make effect explicit. | implemented | Inspector message: `apps/editor/src/workspace/panels/rig-tool-inspector.tsx:799`; test asserts message: `apps/editor/src/workspace/panels/rig-tool-inspector.test.ts:103`. |
| Selected Rotation overlay must become interactive. | implemented | Canvas wires Rotation interaction before selection/warp handlers: `apps/editor/src/workspace/panels/canvas-preview-panel.tsx:379`; renderer state exposes editability: `apps/editor/src/workspace/canvas/use-rotation-deformer-interaction.ts:354`. |
| Canvas pivot handle can drag pivot. | implemented | Pivot drag controller: `apps/editor/src/workspace/canvas/use-rotation-deformer-interaction.ts:193`; gesture commits pivot payload: `apps/editor/src/workspace/canvas/rotation-deformer-gesture.ts:56`; tests: `apps/editor/src/workspace/canvas/rotation-deformer-editing.test.ts:110`. |
| Canvas angle/rotation handle can edit angle. | implemented | Angle handle and hit-test helper: `apps/editor/src/workspace/canvas/rotation-deformer-handles.ts:39`; angle gesture controller: `apps/editor/src/workspace/canvas/use-rotation-deformer-interaction.ts:221`; tests: `apps/editor/src/workspace/canvas/rotation-deformer-editing.test.ts:55`. |
| Pointer drag previews changes without multiple history commits. | implemented | Move updates preview only: `apps/editor/src/workspace/canvas/use-rotation-deformer-interaction.ts:275`, `apps/editor/src/workspace/canvas/use-rotation-deformer-interaction.ts:295`; gesture controller commits once: `apps/editor/src/features/editor-session/model/editor-session-gesture-commit.ts:60`. |
| Pointer-up commits one undoable user gesture. | implemented | Finish path calls `commitGestureController` only on pointer-up: `apps/editor/src/workspace/canvas/use-rotation-deformer-interaction.ts:319`; undo test: `apps/editor/src/workspace/canvas/rotation-deformer-editing.test.ts:110`. |
| Cancel/abort discards preview state. | implemented | Finish with `commit: false` returns without commit after clearing preview: `apps/editor/src/workspace/canvas/use-rotation-deformer-interaction.ts:326`; cancel test: `apps/editor/src/workspace/canvas/rotation-deformer-editing.test.ts:203`. |
| Canvas interactions deterministic/testable through projection/hit-test helpers. | implemented | Helpers: `apps/editor/src/workspace/canvas/rotation-deformer-handles.ts:67`; projection preview tests: `apps/editor/src/workspace/canvas/canvas-projection.test.ts:382`. |
| Unparented Rotation direct Canvas editing. | implemented | The tested fixture is unparented and supports pivot/rest/keyform angle drags: `apps/editor/src/workspace/canvas/rotation-deformer-editing.test.ts:303`. |
| Parented/nested Rotation direct Canvas editing support. | deferred by plan | Plan allows explicit block/diagnose for unsupported nested cases: `discussion/implementation/orchestration/wave72-plan.md:187`; early escape names unsafe parent/child coordinate conversion: `discussion/implementation/orchestration/wave72-plan.md:296`. |
| Parented/nested unsupported cases must be blocked/diagnosed. | implemented | Source blocks when selected rig control has `parentId`: `apps/editor/src/workspace/canvas/use-rotation-deformer-interaction.ts:453`; exposes lock reason/editability attrs: `apps/editor/src/workspace/panels/canvas-preview-panel.tsx:699`. |
| Exact Rotation angle keyform drag updates that keyform. | implemented | Mode resolution chooses keyform only at editable projection: `apps/editor/src/workspace/canvas/use-rotation-deformer-interaction.ts:499`; test updates key at value 30: `apps/editor/src/workspace/canvas/rotation-deformer-editing.test.ts:164`. |
| Non-keyform/interpolated angle state must not silently write ambiguous keyform state. | implemented | Between-keyform projection is locked by `missingCurrentKeyform`: `apps/editor/src/workspace/canvas/use-rotation-deformer-interaction.ts:512`; test asserts lock behavior: `apps/editor/src/workspace/canvas/rotation-deformer-editing.test.ts:164`. |
| Existing numeric `ParameterBindingSection` behavior for Rotation angle remains available. | implemented | Rotation bindings include angle/opacity: `apps/editor/src/features/editor-session/model/parameter-keyform-state.ts:259`; exact-key UI test: `apps/editor/src/workspace/panels/parameter-binding-section.test.ts:44`. |
| Section 9 operation tests. | implemented | Operation tests cover success, diff fields, invalid/wrong-kind/no-op: `packages/operation-core/src/operations/rig-control.test.ts:743`; reviewer reran focused suite. |
| Section 9 authoring/editor command/history tests. | implemented | Authoring tests: `packages/authoring-core/src/rig-control-mutations.test.ts:329`; editor command tests: `apps/editor/src/features/editor-session/model/editor-session-commands.test.ts:301`; gesture history tests: `apps/editor/src/workspace/canvas/rotation-deformer-editing.test.ts:110`. |
| Section 9 Canvas tests. | implemented | Hit-test, projection, preview, commit, cancel, keyform-aware drag covered by `apps/editor/src/workspace/canvas/rotation-deformer-editing.test.ts:55` and `apps/editor/src/workspace/canvas/canvas-projection.test.ts:350`. |
| Section 9 Inspector/component tests. | implemented | `apps/editor/src/workspace/panels/rig-tool-inspector.test.ts:86`. |
| Section 9 focused Playwright Rotation path. | deferred by plan | Domain A did not add Playwright. Plan's required checks qualify Playwright as "if stable": `discussion/implementation/orchestration/wave72-plan.md:409`; verification matrix allows focused e2e or test-facing overlay evidence: `discussion/implementation/orchestration/wave72-plan.md:419`. |
| Save/load, portable bundle, App Bar Open/Save, browser-local storage. | explicit non-goal | Domain A forbidden scope excludes project save/load except coordination stubs: `discussion/implementation/orchestration/wave72-plan.md:278`; out-of-scope browser/local/archive items: `discussion/implementation/orchestration/wave72-plan.md:538`. |
| Viewer/Runtime View, mesh generation, renderer architecture expansion, Cubism compatibility. | explicit non-goal | Section 16 out-of-scope: `discussion/implementation/orchestration/wave72-plan.md:532`; no Domain A source changes were found in Viewer/runtime-core/package-format or mesh generation algorithms. |
| UX-backed package logic must be vertical and deterministic. | implemented | Accepted UX required operation/authoring payload support; package change is narrow and covered by focused operation/authoring tests. Basis: `discussion/development_convention/ux-backed-package-logic-authority.md:33`. |
| Operation Core remains the mutation gateway. | implemented | Policy: `discussion/development_convention/operation-policy.md:79`; UI/gesture path uses `commitUpdateRigControl` and Operation Core, not direct graph mutation: `apps/editor/src/workspace/canvas/rotation-deformer-gesture.ts:63`. |
| Machine-readable IDs and schema conventions. | implemented | New diagnostics/check IDs use dot-separated IDs without spaces: `packages/operation-core/src/operations/update-rig-control.ts:249`; policy: `discussion/development_convention/schema-and-id-conventions.md:123`. |

## Findings

No blocking or needs-change findings.

## Non-goals and deferred items

- Parented/nested Rotation direct Canvas manipulation support is deferred by plan; the implemented behavior is to block selected child Rotation direct edits and expose a lock reason.
- Full Playwright Rotation editing workflow is deferred because the plan only requires it if stable and accepts test-facing overlay evidence for Canvas interaction.
- Domain B save/load requirements are N/A for this Domain A verdict. Domain A does not claim portable bundle import/export, Project Storage UI, App Bar Open/Save wiring, session hydration, browser-local save slots, archive/native filesystem, or load round-trip preservation.
- Viewer/Runtime View, mesh generation algorithm changes, renderer/WebGL expansion, new package format, Cubism compatibility, auto-rigging, and semantic recognition remain out of scope.

## Residual risks

- Browser-level coverage is absent for the Rotation edit workflow. Confidence comes from focused operation, authoring, editor command, component, projection, renderer-facing, and gesture tests.
- Parented/nested direct edit is intentionally blocked, not solved. A future local/world inverse transform contract is needed before enabling direct edits on child Rotation Deformers.
- The workspace contains parallel dirty Domain B files. Reviewer ran typecheck and guards successfully, but did not review Domain B source as part of this Domain A artifact.

## User-decision points

None for Wave72 Domain A pass. Future support for parented/nested direct Canvas Rotation editing requires a separate design decision on local/world coordinate conversion semantics.
