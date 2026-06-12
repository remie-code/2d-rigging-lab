# Wave65 Preplan Undo / History Inventory

## verdict

done

## scope reviewed

- Basis docs requested by Undine for Wave64 Parameter / Keyform context.
- Operation result, lifecycle, log, request, payload, and representative operation handlers under `packages/operation-core/src/**`.
- Authoring mutation state for revisions, parameters, and linear keyform editing under `packages/authoring-core/src/**`.
- Editor command wrappers, provider state, Parameter Bar, Parameter Binding section, Parameter Manager command wrappers, Canvas preview, Parts Tree drag/drop, Deformer Tree drag/drop, Mesh/Rig draft flow under `apps/editor/src/features/editor-session/**` and `apps/editor/src/workspace/**`.
- Focused tests around operation lifecycle, editor commands, parameter keyform state, and command wrappers.
- Supporting policy check: `discussion/development_convention/operation-policy.md`.

Not reviewed exhaustively:

- Every operation handler implementation. Representative create/update/delete/keyform/drag-adjacent handlers were read where they affect undo feasibility.
- Runtime-core and validator-core internals, except as referenced by operation result/evidence boundaries.
- Persistence/save-load history behavior. This inventory found no editor history stack to inspect.

## basis documents used

- `discussion/design/screen-design/components/parameter-keyform.md`
  - Parameter Bar owns active parameter/current value; keyform authoring goes through Parameter Bar plus parameter-aware Inspector; non-key positions show interpolation and lock edits.
- `discussion/implementation/orchestration/wave64-plan.md`
  - Wave64 expected `editKeyformKey`, Parameter Bar scrub/commit loop, Parameter Manager v0, and explicit non-goals such as visibility/clipping/draw-order keyforms.
- `discussion/implementation/waves/wave64/wave64-domain-a-parameter-keyform-package-operation-foundation-report.md`
  - Domain A added `editKeyformKey`, initialized parameter surfaces, parameter definition operations, and v0 keyform support matrix.
- `discussion/implementation/waves/wave64/wave64-domain-b-editor-parameter-keyform-editing-loop-report.md`
  - Domain B connected editor UI to `editKeyformKey`; active parameter/current value is editor-local UI state.
- `discussion/implementation/waves/wave64/wave64-domain-d-parameter-manager-v0-report.md`
  - Domain D reused the shared active parameter contract and added parameter definition command wrappers.

Supporting document:

- `discussion/development_convention/operation-policy.md`
  - `DEC-OP-006` says undo/redo is Post-MVP unless a later accepted policy explicitly promotes it; current operation logs must still preserve before/after revision evidence for future undo/redo design.

## repository facts with file paths

### Operation result, diff, and log

- `packages/operation-core/src/operation-result.ts` defines `OperationResultSchema` with statuses `accepted`, `rejected`, `dry_run`, `committed`, `rolled_back`; optional `modelDiff`, `runtimeDiff`, `validationDiff`; generated evidence refs; and a required `reversible` boolean.
- `packages/contracts/src/model-diff.ts` defines `ModelDiffSchema` as `baseRevision`, `candidateRevision`, `added`, `removed`, `changed`, and `operationIds`.
- `packages/contracts/src/field-change.ts` defines each changed field as `{ path, before, after }`, where `path` is a JSON pointer and `before`/`after` are JSON values.
- `packages/operation-core/src/lifecycle/commit.ts` prepares a request, invokes the registered handler, increments `session.packageRevision` after commit, applies optional evidence, creates an operation log entry, and appends it to an `OperationLog`.
- `packages/operation-core/src/lifecycle/dry-run.ts` applies the handler to a dry-run session and does not mutate the original session.
- `packages/operation-core/src/operation-log.ts` is append-only in memory. It hydrates entries, exposes `entries`, and appends new entries. There is no cursor, stack, undo, redo, or rollback method.
- `packages/operation-core/src/operation-log-entry.ts` persists the request payload, result, target ids, precondition, timestamp, provenance id, evidence ids, and `reversible`.
- `packages/operation-core/src/operation-log-jsonl.ts` serializes/parses operation log entries as JSONL. It does not implement replay, rollback, inverse generation, or stack semantics.
- `packages/operation-core/src/operation-registry.ts` registers operation handlers with `dryRun` and `commit`. The handler interface has no inverse/undo method.
- `rg` over the reviewed operation/editor paths found `rolled_back` only in the result schema, and no `undo`, `redo`, `inverse`, or rollback implementation.

### Reversible and modelDiff content

- Most mutating operation handlers set `reversible: true`; rejected results from `packages/operation-core/src/preconditions.ts` set `reversible: false`.
- Some operation handlers set `reversible: false` for operation-specific non-applied/fallback results, for example `packages/operation-core/src/operations/import-psd-layer-materialization-batch.ts` and `packages/operation-core/src/operations/import-psd-structural-scaffold.ts`.
- `reversible: true` is a fact in the result/log, not an executable inverse contract. No code path consumes it to undo.
- `packages/operation-core/src/operations/create-parameter.ts` records `added: [{ kind: "parameter", id }]` and a changed field whose `after` is only the parameter id, not the full parameter object. This is not enough by itself to reconstruct the created parameter from `modelDiff`.
- `packages/operation-core/src/operations/parameter-definition.ts` records update field-level before/after values and deletion with the full deleted parameter in `before`.
- `packages/operation-core/src/operations/edit-keyform-key.ts` records `keyformSetBefore` and `keyformSetAfter` in changed fields, so keyform add/update/delete has enough local before/after payload for snapshot-style or targeted restore.
- `packages/operation-core/src/operations/create-drawable.ts`, `packages/operation-core/src/operations/create-rotation2d-rig-control.ts`, and `packages/operation-core/src/operations/delete-part.ts` include richer before/after objects for some created/deleted entities and related list changes.
- Inference: `modelDiff` is useful for audit, UI labels, validation, and targeted restore in some operations, but its completeness is not uniform enough to be the only generic undo mechanism without an additional inverse/snapshot layer.

### Authoring revision and mutation behavior

- `packages/authoring-core/src/authoring-session.ts` stores `packageRevision`, `authoringRevision`, `dirty`, and `graph` in `AuthoringSession`.
- `packages/authoring-core/src/authoring-revision.ts` increments `authoringRevision` by one for authoring mutations.
- `packages/operation-core/src/package-revision.ts` increments `packageRevision` only for committed operations. Dry-run candidate sessions get a candidate package revision but the baseline session does not change.
- `packages/authoring-core/src/linear-keyform-editing.ts` implements `addCurrent`, `updateCurrent`, `deleteCurrent`, `createEnds`, and `createEndsCenter`; it returns `keyformSetBefore`/`keyformSetAfter` and increments `authoringRevision`.
- `packages/authoring-core/src/parameter-mutations.ts` implements custom parameter update/delete and rejects preset-locked or in-use deletes.

### Editor command wrappers and provider state

- `apps/editor/src/features/editor-session/model/editor-session-commands.ts` exposes `EditorSessionCommandResult` as `{ committed, session, diagnostics }`. It does not return `OperationResultDto`, `OperationLogEntryDto`, `operationId`, `modelDiff`, or `reversible`.
- The same file creates a fresh `createOperationCore()` inside each `commitOperationInPlace` call, so GUI operation logs are not preserved across commands.
- `apps/editor/src/features/editor-session/model/parameter-definition-commands.ts` has the same pattern for create/update/delete custom parameter commands: fresh `createOperationCore()`, return only committed/session/diagnostics.
- `apps/editor/src/features/editor-session/editor-session-context.tsx` owns the editor's `session` React state and mutating callbacks. It also owns UI state such as `selection`, `activeParameterId`, `parameterValues`, `meshDraft`, `rigDraft`, collapsed/hidden state, and operation feedback.
- `EditorSessionProvider` is the natural editor layer for an in-memory undo stack because every GUI package-changing command flows through it or through command wrappers called by it.
- Inference: if history entries need operation metadata, command wrappers must be enriched to return operation results/log entries, or OperationCore must be owned above individual command calls.

### Parameter scrub, keyform commit, and preview

- `apps/editor/src/features/editor-session/editor-session-context.tsx` stores `parameterValues` as editor-local UI state and updates it through `setActiveParameterValue` / `resetActiveParameterValue`.
- `apps/editor/src/features/editor-session/model/parameter-keyform-state.ts` uses `parameterValues` to create Parameter Bar projections and evaluated preview state. This state is not package data and does not call Operation Core.
- `apps/editor/src/workspace/canvas/canvas-projection.ts` consumes `parameterValues` to evaluate drawable opacity, rig opacity multiplier, rotation angle, and warp control point offsets for Canvas preview.
- `apps/editor/src/workspace/panels/parameter-bar.tsx` and `apps/editor/src/workspace/panels/parameter-binding-section.tsx` call `editKeyformKey` only for Add / Update / Delete / Ends / Ends+Center actions.
- `apps/editor/src/features/editor-session/model/parameter-keyform-state.ts` locks direct property editing between key positions (`canEditValue: false`) and leaves Add Current available. Tests in `parameter-keyform-state.test.ts` cover interpolated/locked state and rig/drawable projection.
- Inference: current-value scrub is already separable from undo because it is not a package operation. Keyform add/update/delete and endpoint creation are explicit commits and can become history entries.

### Gesture and draft structures

- `apps/editor/src/workspace/panels/canvas-preview-panel.tsx` pointer logic currently handles select-click and pan. It does not commit model/keyform changes on pointer move/up.
- `apps/editor/src/features/editor-session/editor-session-context.tsx` and `apps/editor/src/workspace/panels/mesh-tool-inspector.tsx` separate Mesh preview (`meshDraft`) from Apply/Cancel. Apply commits `generateMesh`.
- `apps/editor/src/features/editor-session/editor-session-context.tsx`, `apps/editor/src/features/editor-session/model/rig-tool-state.ts`, and `apps/editor/src/workspace/panels/rig-tool-inspector.tsx` separate Warp Deformer draft (`rigDraft`) from Apply/Cancel. Apply commits create/update operations.
- `apps/editor/src/workspace/panels/structure-tree-panel.tsx` keeps drag/drop intent in local component state and commits only on `onDrop` via `moveStructureChild`.
- `apps/editor/src/workspace/panels/deformer-tree-view.tsx` keeps drag/drop state locally and commits only on drop via bind/rebind/reparent callbacks.
- Some editor commands are already multi-operation logical commands. Examples: `commitDrawableReorder` may commit `setDrawablePart` and `setDrawOrder`; `commitDrawableMaskSourceEdit` may remove one mask relation target and set another; committed deformer inspector Apply may call reparent and update. These should be one user-visible history entry if the gesture/action is one user command.

## findings

### 1. Existing operation results are useful but not sufficient for generic undo

Facts:

- `modelDiff` has revision anchors and before/after field changes.
- Keyform update/delete and parameter update/delete carry enough local before/after data.
- Create operations are inconsistent: `createParameter` does not put the full created parameter object into `modelDiff`, while some other create operations do include full objects.
- No code applies `modelDiff` backward to a session.

Recommendation:

- Do not plan Wave65 around generic `modelDiff` inversion alone.
- Treat `modelDiff` as audit/metadata for history entries, and use either session snapshots or explicit inverse operation constructors for the first undo implementation.

### 2. No inverse operation or history stack exists

Facts:

- The operation handler interface has only `dryRun` and `commit`.
- `OperationLog` is append-only and has no cursor.
- Editor wrappers discard operation log/result metadata.
- The only rollback-like fact is the unused `rolled_back` status enum value.

Recommendation:

- Plan a real editor history layer. The smallest safe layer is in-memory and editor-owned; durable/replayable operation-log history is a larger package/editor contract change.

### 3. The natural UI integration point is `EditorSessionProvider`

Facts:

- `EditorSessionProvider` owns `session` and the mutating callbacks used by the UI.
- Command wrappers return enough to replace session state, but not enough to annotate history with operation ids/diffs.
- Parameter Manager, Parameter Bar, Rig Tool, Mesh Tool, Parts Tree, and Deformer Tree all route package-changing work back through provider callbacks.

Recommendation:

- Put v0 undo/redo state in `EditorSessionProvider` or a focused editor-session history model consumed by the provider.
- Enrich `EditorSessionCommandResult` if history entries need `modelDiff`, `operationId`, `operationType`, or `reversible` display/guard data.

### 4. Scrub versus commit is already mostly separated

Facts:

- Scrub/current parameter changes only mutate `parameterValues`.
- Canvas preview evaluates `parameterValues` without package mutation.
- Keyform add/update/delete and endpoint actions call `editKeyformKey`.
- Mesh/Rig draft flows separate preview from Apply.
- Tree drag/drop commits on drop.

Recommendation:

- Exclude `parameterValues` scrub and reset from package undo v0 unless UX explicitly asks for view-state undo.
- Record keyform Add / Update / Delete / Ends / Ends+Center and drag/drop Apply/Drop commits as undoable package entries.

### 5. Multi-operation editor commands are the main grouping risk

Facts:

- Some editor-level user actions can run multiple Operation Core commits before returning one `EditorSessionCommandResult`.
- The current command result does not expose each underlying operation result/log entry.

Recommendation:

- History entries should be created around editor commands/gestures, not around raw Operation Core commits, for UI semantics such as "one drop = one undo".
- If operation metadata is retained, store an array of operation results/log entries inside one history entry.

## risks / gaps

- Policy gap: `discussion/development_convention/operation-policy.md` still says undo/redo is Post-MVP unless promoted by later accepted policy. Wave65 should explicitly establish the new policy boundary or label the work as experimental/local history.
- Generic diff gap: `modelDiff.added`/`removed` are target refs, not uniformly full object snapshots. A generic diff-applier would need operation-specific fallback or stronger diff guarantees.
- Editor log gap: GUI command wrappers instantiate fresh Operation Core objects and discard operation logs. Operation-log-based history cannot be built without changing wrapper/provider contracts.
- Direct state restore risk: an editor-owned snapshot undo can set `session` directly, which may be viewed as package mutation outside Operation Core unless the plan defines undo as restoring prior editor state rather than committing a new operation.
- Revision semantics risk: snapshot undo will move `packageRevision` and `authoringRevision` backward. This is easy for in-memory undo but may conflict with future durable audit/replay semantics.
- UI-state contamination risk: if history snapshots include all provider state, scrub, selection, panel visibility, collapsed tree state, and drafts may accidentally become undoable. Package undo v0 should snapshot `AuthoringSession` separately from transient UI state.
- Future pointer-edit gap: Canvas pointer code has no model-edit preview/commit structure for direct deformation/keyform drag. Future drag-to-edit work needs draft state during pointer move and a single commit on pointer up/cancel.
- Keyform delete risk is manageable but explicit: deleting the last key removes the whole keyform set and stable-order entry. `editKeyformKey` records keyformSetBefore/After, so snapshot undo can restore it, but inverse operation design must handle set recreation.
- Parameter delete risk: `deleteParameter` rejects in-use parameters, but undo of a later keyform addition followed by redo/undo across parameter changes must guard against stale parameter/target references if history is not linear.

## recommended planning implications

- Minimum Wave65 undo foundation should include:
  - An editor-session history model with `undoStack` and `redoStack`.
  - A history entry shape based on `beforeSession`, `afterSession`, user-visible command label/kind, and optional operation metadata.
  - Provider-level wrappers so package-changing callbacks push exactly one history entry per user command.
  - Redo invalidation when a new committed command occurs after undo.
  - Exclusion of `parameterValues` scrub/reset, selection, collapse/visibility UI gates, mesh/rig drafts before Apply, and feedback messages from package undo.
  - Focused tests for keyform add/update/delete undo/redo, custom parameter create/update/delete where safe, and at least one existing drag/drop or draft Apply command.
- Do not make generic inverse operations the first Wave65 deliverable unless the plan also strengthens modelDiff completeness and operation-specific inverse contracts.
- Do not rely on `reversible: true` as the execution gate. It can be displayed or used as metadata, but v0 undo should rely on the availability of a captured `beforeSession`.
- If preserving operation audit history matters in Wave65, first enrich `EditorSessionCommandResult` to include underlying `OperationResultDto`/log entry metadata. Otherwise keep v0 explicitly as in-memory editor history and defer durable operation-log replay.
- For "1 gesture = 1 undo entry", place history capture around editor-level command callbacks, not inside low-level Operation Core calls.
- For keyform UX specifically:
  - Scrub is session-local preview and should stay outside package undo.
  - Add / Update / Delete / Ends / Ends+Center are package mutations and should be undoable.
  - Inspector value edits before pressing Update are local component state and should not enter history until Update/Add commits.

## user-decision points

- Should Wave65 formally promote Undo/Redo from Post-MVP into current accepted scope, requiring an operation-policy/design update?
- Should v0 undo be package-only (`AuthoringSession` history) or include UI view state such as selection, active parameter, and `parameterValues`?
- Should v0 history be in-memory only, or should it preserve operation-log metadata for future durable/replayable history?
- Should undo/redo create new operation log entries with a `rolled_back`/restore semantics, or restore prior editor snapshots without appending operation logs?
- For multi-operation editor commands, should the user-visible entry label be command-level only, or should the UI expose underlying operation details?

## provisional assumptions

- "Scrub is Undo対象外" means active parameter value changes and reset-to-default preview changes are not added to package history.
- "Keyform add/update/delete and drag commit are Undo対象" means package-changing commits after explicit Add/Update/Delete/Ends/Apply/Drop actions should create one undo entry per user gesture.
- Wave65 can start with editor-local undo for current session only unless Undine/user decides durable replay is required.
- `AuthoringSession` snapshot history is acceptable for v0 only if the plan explicitly names the Operation Policy tension and does not present it as durable Operation Core rollback.
- Direct Canvas keyform drag is not in current proven scope; any "drag commit" in Wave65 should refer to existing tree DnD or future work that first adds a preview/commit draft boundary.
