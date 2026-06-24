# Wave99 Domain C Report: Variant Manager Editor UI / Canvas Preview

## Verdict

Domain id: `wave99-variant-manager-editor-ui-canvas-preview`

Verdict: `done` from Gnome perspective.

Domain C source implementation is complete in the allowed `apps/editor/src/**` scope plus this report/map update. Domain A/B package changes were treated as baseline and were not modified by this Domain C pass. No Runtime Player, Runtime Export materialization/schema, Texture Atlas algorithm/signature, package dependency manifest, or lockfile changes were made.

## Changed Files

Editor session / operation bridge:

- `apps/editor/src/features/editor-session/editor-session-context.tsx`
- `apps/editor/src/features/variants/model/variant-session-commands.ts`
- `apps/editor/src/features/variants/model/variant-session-commands.test.ts`
- `apps/editor/src/features/variants/model/variant-preview-state.ts`

Variant Manager projection / picker:

- `apps/editor/src/features/variants/model/variant-manager-projection.ts`
- `apps/editor/src/features/variants/model/variant-manager-projection.test.ts`

Workspace UI:

- `apps/editor/src/workspace/authoring-workspace.tsx`
- `apps/editor/src/workspace/authoring-workspace.test.ts`
- `apps/editor/src/workspace/toolbox/workspace-toolbox.test.ts`
- `apps/editor/src/workspace/variants/variant-manager-screen.tsx`
- `apps/editor/src/workspace/variants/variant-manager-screen.test.ts`

Canvas preview integration:

- `apps/editor/src/workspace/canvas/canvas-evaluation.ts`
- `apps/editor/src/workspace/canvas/canvas-projection.ts`
- `apps/editor/src/workspace/canvas/canvas-variant-visibility.test.ts`
- `apps/editor/src/workspace/panels/canvas-preview-panel.tsx`

Report/map:

- `discussion/implementation/waves/wave99/wave99-domain-c-variant-manager-editor-ui-canvas-preview-report.md`
- `discussion/implementation/waves/wave99/_map.md`

## Implementation Summary

- Added explicit `activeEntry === "variants"` routing in `AuthoringWorkspaceContent`.
- Added `VariantManagerScreen` with group list/create/rename/mode edit/delete, Variant create/rename/delete, membership matrix, default active editor, preview active editor, target removal, check strip, and embedded Canvas preview.
- Hid `ParameterBar` for the Variant Manager route.
- Added Back action returning to neutral `activeEntry: "workspace"`.
- Added dedicated Variant picker projection and UI. It renders Parts Container hierarchy, defaults containers collapsed, shows `eligible / total` counts, and classifies drawables as eligible, not bound, already in other group, or already in this group.
- Added Editor session Variant command wrappers that commit through Operation Core and are exposed from `EditorSessionProvider` through the existing `runCommandWithHistory` path.
- Added session-local `variantPreviewActiveSelections` state in `EditorSessionProvider`. It is reconciled against the current graph, reset on project load/undo/redo transient reset, and is not written into package/project state.
- Added Canvas `variantVisibilityPredicate` option through `createCanvasRenderProjection` to `createCanvasEvaluatedScene`.
- `CanvasPreviewPanel` now builds the predicate with Domain B `createVariantVisibilityPredicate`, using session-local preview selections and Domain B default-active fallback semantics.

## Fix Loop 1 / TA-C Closure

Fix Loop 1 addressed both Test Adequacy findings without changing production source.

- TA-C-001 closure:
  - Added a Provider + `CanvasPreviewPanel` integration test in `apps/editor/src/workspace/canvas/canvas-variant-visibility.test.ts`.
  - The test renders `EditorSessionProvider` with a Variant fixture, updates `setVariantPreviewActiveSelection`, verifies `variantPreviewActiveSelections` updates, verifies the Canvas projection surface changes from 2 to 1 renderable drawables, and verifies `session.dirty`, `canUndo`, serialized session state, and `defaultActive` remain unchanged.
- TA-C-002 closure:
  - Added event-level `VariantManagerScreen` component tests in `apps/editor/src/workspace/variants/variant-manager-screen.test.ts`.
  - Coverage now exercises group create/delete, Variant create/rename/delete, single-select last Variant delete disabled state, picker collapsed/count DOM, picker eligibility disabled/checked DOM states, `Add selected`, membership checkbox, default active selector, and preview active selector.

Fix Loop 1 changed only focused app tests plus this report.

## Tests Run

Passed:

- `pnpm.cmd typecheck`
- `pnpm.cmd exec vitest run apps/editor/src/workspace/canvas/canvas-variant-visibility.test.ts apps/editor/src/workspace/variants/variant-manager-screen.test.ts`
  - Fix Loop 1 added/changed tests passed: 2 files / 9 tests.
- `pnpm.cmd exec vitest run apps/editor/src/features/variants/model/variant-session-commands.test.ts apps/editor/src/features/variants/model/variant-manager-projection.test.ts apps/editor/src/workspace/canvas/canvas-variant-visibility.test.ts apps/editor/src/workspace/authoring-workspace.test.ts apps/editor/src/workspace/toolbox/workspace-toolbox.test.ts apps/editor/src/workspace/variants/variant-manager-screen.test.ts`
  - Initial sandboxed attempt failed with `spawn EPERM` while loading Vite/Vitest config through esbuild.
  - Elevated rerun passed before Fix Loop 1: 6 files / 19 tests.
  - Fix Loop 1 elevated rerun passed: 6 files / 24 tests.
- `pnpm.cmd exec vitest run apps/editor/src/workspace/canvas/canvas-evaluation.test.ts apps/editor/src/workspace/canvas/canvas-projection.test.ts`
  - Passed: 2 files / 36 tests.
- `node scripts/check-source-organization.mjs`
- `node scripts/check-dependencies.mjs`
- `git diff --check -- apps/editor/src discussion/implementation/waves/wave99`
  - Exit 0. Git emitted existing LF-to-CRLF working-copy warnings only.

Not run:

- Full repository test suite.
- `pnpm install`, per task instruction.

## Compatibility Evidence

- Existing variant-free Canvas behavior remains covered by existing `canvas-evaluation.test.ts` and `canvas-projection.test.ts`; they passed after adding the optional predicate with default `true`.
- Variant-neutral drawables remain visible according to existing runtime/part visibility because Domain B predicate returns true for unassigned drawables and Canvas still ANDs with `runtimeVisibility && !hiddenByPart`.
- Variant false hides only assigned drawables by the new `variantVisibilityPredicate` AND branch; it does not mutate `runtimeVisibility`, keyforms, parts hidden state, or opacity.
- Workspace Save / Portable JSON compatibility is preserved: Domain C did not change save/open/package-format files, and preview active selection is held only in React session state.
- Runtime Export variant-free behavior is preserved: Domain C did not edit Runtime Export schema/materialization or Runtime Player files.
- Texture Atlas target selection/freshness is preserved: Domain C did not edit Texture Atlas target/signature/mutation/packing code, and membership-only stale behavior remains Domain B baseline.
- Dependency compatibility is preserved: no dependency manifest or lockfile changes; dependency guard passed.

## Operation Behavior Evidence

- `variant-session-commands.ts` wraps each Domain A Variant operation with `createOperationCore().commitOperation(...)` and returns `EditorSessionCommandResult`.
- `EditorSessionProvider` exposes Variant mutation methods through `runCommandWithHistory`, matching existing GUI mutation behavior.
- `variant-session-commands.test.ts` verifies:
  - create group commits and initializes single-select default Variant;
  - group rename/mode update commits and converts default active selection;
  - delete group removes the group without deleting drawables;
  - create/rename/delete Variant works;
  - last Variant delete is blocked for single-select;
  - same drawable can be a member of multiple Variants in the same group;
  - default active selection is saved into project graph state.
- Add Drawables picker prevents unbound/pool-only drawables and cross-group ownership at UI projection level; Operation Core remains the authoritative mutation guard.

## Basis Coverage Self-Report

- Explicit `variants` route: covered.
- `VariantManagerScreen`: covered.
- Parameter Bar hidden for Variant Manager: covered.
- Back to neutral Authoring Workspace: covered.
- Group create/rename/update/delete: covered.
- Variant create/rename/delete: covered.
- Last single-select Variant delete blocked: covered.
- Dedicated Add Drawables picker projection/component: covered; `StructureTreePanel` is not imported.
- Parts Container hierarchy default collapsed: covered.
- Picker eligible/total counts: covered.
- Picker eligibility states eligible/not bound/already other group/already this group: covered.
- Remove target drawable: covered.
- Membership matrix checkbox cells: covered.
- Variant Manager event-level create/delete/rename/picker/membership/default/preview wiring: covered by Fix Loop 1 component tests.
- Same drawable checked for multiple Variants in same group: covered.
- Default active selection editor and persisted graph update: covered.
- Preview active selection session-local: covered.
- Preview active affects Canvas preview predicate: covered, including Provider + `CanvasPreviewPanel` integration in Fix Loop 1.
- Preview active does not dirty/save project state: covered by non-mutating predicate path, no persistence changes, and Fix Loop 1 Provider integration asserting unchanged serialized session/default active.
- Canvas variant predicate AND path: covered.
- Variant-neutral drawable existing visibility semantics: covered.
- Variant false hides assigned drawable while preserving other visibility semantics: covered.
- No groups / invalid refs / duplicate ownership check strip projection: covered.
- Workspace Save / Portable JSON compatibility: preserved by no save/package changes.
- Runtime Export variant-free behavior: preserved by no runtime export changes.
- Texture Atlas target selection/membership-only stale behavior: preserved by no atlas changes.

## Deferred Basis Items

- Runtime Player Variant UI/hotkeys/Browser Source protocol remain out of Wave99 Domain C.
- Viewer Runtime View Variant switcher was not implemented; current Domain C preview is in Variant Manager Canvas preview.
- Capture From Current State remains out of scope.
- Smart grouping / automatic classification remains out of scope.
- Clipping/mask relationship warning is not implemented; deterministic no-group/invalid-ref/duplicate-ownership checks are included.
- Batch add drawables is implemented as repeated Operation Core commits rather than a single batch operation because Domain A exposes single-drawable operations.

## Source Organization / Dependency Notes

- New production files have focused responsibilities:
  - `variant-session-commands.ts`: app-side Operation Core commit wrappers.
  - `variant-preview-state.ts`: session-local preview active selection reconciliation.
  - `variant-manager-projection.ts`: Manager/check/picker projections and ID suggestions.
  - `variant-manager-screen.tsx`: workspace screen composition.
- `index.ts` files were not edited.
- No new dependencies, dependency manifest changes, or lockfile changes.
- Source organization and dependency guards passed.

## Residual Risks

- The Manager UI is covered by SSR/pure projection/command tests, not browser E2E.
- Add selected drawables creates one history entry per drawable because no Domain A batch operation exists.
- Preview active selection currently affects any `CanvasPreviewPanel` through Provider state, not only the Manager instance. It remains session-local and resettable, and no permanent Authoring Workspace switcher was added.
