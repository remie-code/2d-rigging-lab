# Wave91 Domain B Spec Compliance Review

Role: Review-Sylph, Spec Compliance Review
Target: Wave91 `deformer-lifecycle-cleanup`, Domain B `wave91-editor-deformer-lifecycle-integration`
Date: 2026-06-20
Verdict: `pass`

## Findings

Blocking findings: none.

Needs-changes findings: none.

Warnings: none.

## Passing Evidence

### 1. Editor delete command and history wiring

Pass. Domain B adds an editor command wrapper around Domain A's operation-core `deleteRigControl` operation, and the Provider routes it through the existing editor history path.

- `commitDeleteRigControl()` calls `commitSingleOperation()` with `operationType: "deleteRigControl"` and the typed payload: `apps/editor/src/features/editor-session/model/editor-session-commands.ts:384`, `:389`.
- `commitSingleOperation()` clones the current session and commits through `createOperationCore().commitOperation()` using GUI/human operation requests, preserving the Operation Core mutation gateway required by `discussion/development_convention/operation-policy.md:87` and `:351`: `apps/editor/src/features/editor-session/model/editor-session-commands.ts:526`, `:530`, `:539`, `:549`.
- `EditorSessionProvider` imports and exposes `deleteRigControl`: `apps/editor/src/features/editor-session/editor-session-context.tsx:98`, `:442`.
- The Provider delete callback uses `applyRigCommand()`, which uses `runCommandWithHistory()`, so committed deletes are recorded through `commitEditorSessionCommandWithHistory()`: `apps/editor/src/features/editor-session/editor-session-context.tsx:1271`, `:1277`, `:2084`, `:2087`, `:2095`.
- Existing history stores before/after session snapshots and restores them through undo/redo: `apps/editor/src/features/editor-session/model/editor-session-history.ts:56`, `:63`, `:64`, `:76`, `:86`, `:95`, `:105`, `:114`, `:135`.
- Provider test coverage deletes the selected Deformer, verifies selection is cleared, verifies the rig control is removed, then verifies undo restores it and redo removes it again: `apps/editor/src/features/editor-session/editor-session-context-history.test.ts:1031`, `:1047`, `:1050`, `:1051`, `:1055`, `:1058`, `:1062`, `:1065`, `:1066`.

### 2. Inspector delete UI

Pass. Both committed Warp and Rotation inspectors render `Delete Deformer` and invoke the delete callback with the current rig control ID.

- `RigToolInspector` passes `deleteRigControl` into committed Warp and Rotation inspectors: `apps/editor/src/workspace/panels/rig-tool-inspector.tsx:58`, `:103`, `:114`.
- Committed Warp Deformer inspector renders `DeleteDeformerAction` with `readModel.rigControlId`: `apps/editor/src/workspace/panels/rig-tool-inspector.tsx:625`, `:637`, `:747`.
- Committed Rotation Deformer inspector renders `DeleteDeformerAction` with `readModel.rigControlId`: `apps/editor/src/workspace/panels/rig-tool-inspector.tsx:870`, `:883`, `:1039`.
- The shared delete action is a button labelled `Delete Deformer` and directly calls `onDelete`; no confirmation layer is present there: `apps/editor/src/workspace/panels/rig-tool-inspector.tsx:1303`, `:1309`, `:1313`.
- Warp inspector test clicks `Delete Deformer` and expects `onDelete(RIG_FACE_WARP)`: `apps/editor/src/workspace/panels/rig-tool-inspector.test.ts:90`, `:106`, `:107`.
- Rotation inspector test clicks `Delete Deformer` and expects `onDelete(RIG_FACE_ROTATION)`: `apps/editor/src/workspace/panels/rig-tool-inspector.test.ts:160`, `:176`, `:177`.

### 3. Delete cleanup

Pass. Successful delete clears the selected rig/deformer selection and rig-related transient state that can point at the deleted rig control.

- On commit, Provider clears `selection`, drawable anchor, Deformer Tree anchor, `rigDraft`, and `rigOperationFeedback`: `apps/editor/src/features/editor-session/editor-session-context.tsx:2088`, `:2089`, `:2090`, `:2091`, `:2092`, `:2093`.
- The Provider test asserts selected rig-control deletion clears selection and remains undoable/redoable: `apps/editor/src/features/editor-session/editor-session-context-history.test.ts:1031`, `:1050`, `:1052`, `:1058`, `:1065`, `:1066`.
- `rigDraft` can contain a `parentRigControlId`, so clearing it is relevant to the deleted-rig-control transient cleanup requirement: `apps/editor/src/features/editor-session/model/rig-tool-state.ts:36`, `:38`.

### 4. No Wave91 delete confirmation dialog

Pass. I found no delete-specific confirmation dialog in the Domain B delete path.

- `DeleteDeformerAction` invokes `onDelete` directly: `apps/editor/src/workspace/panels/rig-tool-inspector.tsx:1307`, `:1309`.
- The only `confirm` match in `editor-session-context.tsx` is the pre-existing dirty workspace replacement confirmation helper, not Deformer delete: `apps/editor/src/features/editor-session/editor-session-context.tsx:2570`, `:2573`, `:2579`.
- No `window.confirm` / delete confirmation match was found in `apps/editor/src/workspace/panels/rig-tool-inspector.tsx`.

### 5. Actual suffixed rigControlId propagation

Pass. The editor no longer predicts IDs from display names. It uses the operation result/model diff to select the actual committed rig control ID.

- `EditorSessionCommandResult` now carries `operationResult`: `apps/editor/src/features/editor-session/model/editor-session-commands.ts:27`, `:31`.
- `commitOperationInPlace()` stores the returned Operation Core result on editor command results: `apps/editor/src/features/editor-session/model/editor-session-commands.ts:551`, `:555`.
- Warp and Rotation create commands both call `extractAddedRigControlId(result.operationResult)` after commit: `apps/editor/src/features/editor-session/model/editor-session-commands.ts:300`, `:311`, `:316`, `:324`.
- `extractAddedRigControlId()` reads `operationResult.modelDiff.added` and returns the added `rigControl` ID: `apps/editor/src/features/editor-session/model/editor-session-commands.ts:571`, `:574`, `:575`, `:578`.
- The old predicted-ID import/use is removed in the working diff for `editor-session-commands.ts`.
- Command test coverage asserts duplicate display-name Rotation creation returns `_2` as the second actual ID and that the committed session contains that ID: `apps/editor/src/features/editor-session/model/editor-session-commands.test.ts:129`, `:150`, `:151`, `:153`, `:154`.
- Provider test coverage asserts selection lands on `rig_twin_rotation_deformer_2` after duplicate display-name creation: `apps/editor/src/features/editor-session/editor-session-context-history.test.ts:1072`, `:1079`, `:1088`, `:1091`, `:1093`, `:1095`.

### 6. Mesh Apply hook placement and draft UX

Pass. The hook runs after successful mesh draft commits, after the draft batch loop has committed meshes, and the existing draft cleanup/selection UX remains in place.

- `applyMeshDraft()` captures `draftsToApply`, records only successfully committed drawable IDs, and advances `nextSession` after each mesh commit: `apps/editor/src/features/editor-session/editor-session-context.tsx:1704`, `:1705`, `:1711`, `:1720`, `:1735`, `:1739`, `:1740`.
- Auto-refit runs only after the draft loop and only when at least one drawable committed: `apps/editor/src/features/editor-session/editor-session-context.tsx:1743`, `:1746`.
- Draft cleanup and existing selection behavior run after committed apply: `apps/editor/src/features/editor-session/editor-session-context.tsx:1757`, `:1758`, `:1759`, `:1760`, `:1762`, `:1764`, `:1765`.
- Provider integration test previews a mesh draft, applies it, verifies drafts are cleared, verifies the mesh was committed, and verifies the Warp domain contains committed mesh vertices: `apps/editor/src/features/editor-session/editor-session-context-history.test.ts:1107`, `:1115`, `:1124`, `:1128`, `:1129`, `:1131`.
- Existing batch apply behavior still has a test asserting draft cleanup and that only eligible drawables are applied: `apps/editor/src/features/editor-session/editor-session-context-history.test.ts:972`, `:996`, `:1017`, `:1020`, `:1021`, `:1022`, `:1023`.

### 7. Mesh Apply auto-refit semantics

Pass. The auto-refit helper matches the Wave91 checklist.

- It accepts committed Drawable IDs and dedupes them with `new Set(committedDrawableIds)`: `apps/editor/src/features/editor-session/model/mesh-apply-auto-refit.ts:13`, `:15`, `:69`.
- It collects affected ancestors by walking from direct parents upward, retains only `kind === "warpLattice2d"` candidates, and dedupes candidates by rig control ID: `apps/editor/src/features/editor-session/model/mesh-apply-auto-refit.ts:70`, `:74`, `:77`, `:79`, `:80`.
- It sorts candidates by hierarchy depth descending, which processes inner descendants before outer ancestors: `apps/editor/src/features/editor-session/model/mesh-apply-auto-refit.ts:95`, `:97`.
- It skips missing/non-Warp candidates and keyed/keyformed Warps via existing keyform detection: `apps/editor/src/features/editor-session/model/mesh-apply-auto-refit.ts:23`, `:24`; `apps/editor/src/features/editor-session/model/rig-tool-state.ts:870`, `:874`.
- It computes required bounds from all current child Drawables and child rig controls: `apps/editor/src/features/editor-session/model/mesh-apply-auto-refit.ts:28`, `:30`, `:31`; `apps/editor/src/features/editor-session/model/rig-tool-state.ts:855`, `:860`, `:863`, `:867`.
- It unions required bounds with the current domain and skips updates when unchanged, so it expands only and does not shrink: `apps/editor/src/features/editor-session/model/mesh-apply-auto-refit.ts:37`, `:38`, `:39`.
- It updates through the existing rig update operation wrapper only when bounds changed: `apps/editor/src/features/editor-session/model/mesh-apply-auto-refit.ts:42`, `:43`, `:44`.
- Focused tests cover expand, no-shrink, keyed skip, nested inner-to-outer, and shared-parent/all-children behavior: `apps/editor/src/features/editor-session/model/mesh-apply-auto-refit.test.ts:35`, `:65`, `:89`, `:113`, `:143`.

### 8. Out-of-scope boundaries

Pass. I found no evidence that Domain B added the Wave91-forbidden features or crossed the listed package boundaries.

- Auto-refit only finds Warp lattice controls, not Rotation controls: `apps/editor/src/features/editor-session/model/mesh-apply-auto-refit.ts:121`, `:129`.
- Keyed Warps are silently skipped with no warning/diagnostic path added in auto-refit: `apps/editor/src/features/editor-session/model/mesh-apply-auto-refit.ts:23`, `:24`, `:25`.
- The current inspector diff adds `DeleteDeformerAction` only; the existing `Fit bounds` draft/inspector action was not introduced by this Wave91 diff: `apps/editor/src/workspace/panels/rig-tool-inspector.tsx:778`.
- Targeted diff scan returned no Domain B changes under runtime/render packages, mesh algorithm packages, package manifests, or lockfile.
- Targeted search found no Deformer Tree context menu, keyboard delete shortcut, or delete confirmation addition in the Domain B changed files.

## Residual Risks / Test Gaps

- I did not run Vitest, typecheck, source checks, or dependency checks in this review. This pass is based on direct source/test inspection and read-only static scans.
- The delete cleanup test verifies selection and undo/redo, but it does not explicitly fixture a live `rigDraft` or stale `rigOperationFeedback` pointing at the deleted rig control. Source clears both on successful delete, so I do not consider this a blocker.
- Actual suffixed-ID propagation is source-covered for both Warp and Rotation create commands, but focused duplicate-selection tests cover the Rotation provider path. A future low-cost test could add a duplicate Warp provider path.
- Auto-refit source dedupes duplicate committed Drawable IDs and affected ancestors, but there is no explicit duplicate-input test. Existing source structure is straightforward and lower risk.
- Auto-refit commits each domain expansion through separate `updateRigControl` operation commits inside one editor history entry. That matches the existing operation gateway and editor history behavior, but tests do not assert the exact operation-log count for nested/shared cases.

## Verification Performed

- Read Wave91 plan, Domain A report/reviews, Wave90 final integration basis, operation policy, and discussion structure entry points.
- Inspected the current working-tree Domain B source and tests directly, including the new auto-refit helper and focused tests.
- Ran read-only `git status`, `git diff`, and `rg` scans for changed files, operation wiring, confirmation dialogs, out-of-scope runtime/mesh/dependency changes, and targeted UI/test evidence.
- Wrote this review artifact only; no source or test files were edited.
