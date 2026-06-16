# Wave77 Domain A Spec Compliance Review

- Verdict: `pass`
- Review lane: Spec Compliance Review
- Target: Wave77 / Domain A `wave77-deformer-tree-selection-pool-tree-row-cleanup`
- Date: 2026-06-16
- Reviewer: Review-Sylph
- Artifact path: `discussion/implementation/reviews/wave77/wave77-domain-a-spec-compliance-review.md`

## Basis Coverage

- Reviewed Wave77 plan sections 3.1, 3.2, 3.3, 7.1, 7.2, 9, and 15-17. Key Domain A scope is Deformer Tree mixed selection, Drawable Pool tree rendering, row cleanup, and existing DnD preservation: `discussion/implementation/orchestration/wave77-plan.md:41`, `:52`, `:61`, `:181`, `:203`, `:288`.
- Reviewed Wave76 baseline for existing Drawable-only Parts Tree multi-select and explicit no Deformer Tree / Canvas modifier multi-select baseline: `discussion/implementation/orchestration/wave76-plan.md:66`, `:75`; `discussion/implementation/waves/wave76/wave76-final-integration-report.md:73`, `:119`.
- Reviewed changed Domain A files listed in the assignment plus supporting Inspector/DnD source where needed for must-not checks.

## Findings

No blocking findings.

No needs-change findings.

## Requirement Classification

| Requirement | Classification | Evidence |
|---|---:|---|
| Deformer Tree selection can include Deformer node, bound Drawable ref, and Pool Drawable. | `implemented` | Selection target union covers `rigControl`, `boundDrawable`, and `poolDrawable`: `apps/editor/src/features/editor-session/model/editor-selection.ts:27`; rows and pool items project selected state through `isDeformerTreeTargetSelected`: `apps/editor/src/features/editor-session/model/rig-tool-state.ts:539`, `:588`, `:891`. |
| Parts Container row is Pool structure only, not selectable. | `implemented` | Pool part item type has `selected: false` and `displayOnly: true`: `rig-tool-state.ts:121`; selectable target projection only adds Pool items whose kind is `drawable`: `rig-tool-state.ts:688`. UI renders part rows as `div`, `aria-disabled`, no click/drag/drop handlers: `apps/editor/src/workspace/panels/deformer-tree-view.tsx:310`. |
| Normal click replaces selection and updates anchor. | `implemented` | `resolveDeformerTreeSelectionTransition` replace path returns clicked-only legacy selection and anchor: `editor-selection.ts:221`, `:277`. UI passes non-modifier clicks as replace: `deformer-tree-view.tsx:73`. |
| Ctrl/Meta click toggles clicked selectable row and updates anchor. | `implemented` | Toggle mode dedupes/orders targets and sets `anchorTarget: clickedTarget`: `editor-selection.ts:230`; UI maps Ctrl/Meta to toggle: `deformer-tree-view.tsx:74`. |
| Shift click ranges over visible Deformer Tree selectable row order. | `implemented` | Range uses `visibleTargets.slice(start, end + 1)`, not Parts Tree drawable order: `editor-selection.ts:250`; UI builds `visibleSelectionTargets` from Deformer rows plus expanded Pool rows: `deformer-tree-view.tsx:54`. |
| Shift fallback when anchor is absent or not visible. | `implemented` | Null/missing anchor returns clicked-only selection: `editor-selection.ts:246`, `:252`. Covered by unit test: `rig-tool-state.test.ts:472`. |
| Parts Tree `drawableSet` range order is not reused for Deformer Tree range. | `implemented` | Deformer Tree has a separate `deformerTreeSet`, `DeformerTreeSelectionTarget`, and `orderDeformerTreeTargetsByVisibleTree`: `editor-selection.ts:21`, `:27`, `:363`. |
| Canvas multi-highlight is not required. | `explicit non-goal` | Wave77 says Canvas multi-highlight may be absent: `wave77-plan.md:50`. Canvas click remains a plain single `selectDrawable(hitDrawableId)` path without modifier handling: `apps/editor/src/workspace/panels/canvas-preview-panel.tsx:499`. |
| Pool shows only unbound Drawables and excludes already-bound Drawables. | `implemented` | Pool derives `boundDrawableIds` from every `rigControl.childDrawableIds` and filters them out: `rig-tool-state.ts:563`. Unit coverage verifies bound exclusion: `rig-tool-state.test.ts:340`. |
| Pool reflects Parts tree structure and prunes empty subtrees. | `implemented` | `appendPartSubtree` walks ordered part children, adds part rows only when `childRows.length > 0`, and emits fallback unbound Drawables: `rig-tool-state.ts:596`, `:627`, `:654`. Unit coverage includes nested hierarchy and empty container pruning: `rig-tool-state.test.ts:488`. |
| Pool container rows are display-only, non-draggable, and not drop targets. | `implemented` | UI part rows have `data-display-only="true"` and no `draggable`, `onDragOver`, or `onDrop`: `deformer-tree-view.tsx:311`. E2E asserts display-only and non-draggable: `apps/editor/e2e/psd-import.e2e.spec.ts:492`. |
| Pool Drawable rows are selectable and draggable to Deformer rows. | `implemented` | Pool drawable rows call `selectTreeTarget`, are `draggable`, and start `poolDrawable` drag payloads: `deformer-tree-view.tsx:330`. Drop handler binds Pool Drawable to target Deformer: `deformer-tree-view.tsx:96`. Focused E2E drags Pool row to Deformer row: `psd-import.e2e.spec.ts:511`. |
| Pool count remains count of unbound Drawables, not container rows. | `implemented` | Count filters `drawablePoolItems` to `kind === "drawable"`: `deformer-tree-view.tsx:63`, `:295`. |
| Deformer rows no longer render secondary control-points or pivot detail. | `implemented` | Deformer row UI renders only display name plus count/key badges, not `transformLabel` or pivot detail: `deformer-tree-view.tsx:248`. E2E asserts row text omits `control points` and `Pivot`: `psd-import.e2e.spec.ts:474`. |
| Inspector still exposes editable Deformer geometry controls. | `implemented` | Warp draft/edit still expose domain bounds, transform divisions, Bezier divisions, and apply controls: `apps/editor/src/workspace/panels/rig-tool-inspector.tsx:403`, `:630`. Rotation edit still exposes pivot/rest transform controls: `rig-tool-inspector.tsx:844`. E2E reads/fills transform controls: `psd-import.e2e.spec.ts:434`, `:467`. |
| Existing single `selectRigControl` and `selectDrawable` behavior remains usable outside Deformer Tree multi-select. | `implemented` | Context keeps both methods: `editor-session-context.tsx:894`, `:920`; Canvas still calls `selectDrawable` directly: `canvas-preview-panel.tsx:502`. |
| Multi-selection does not crash existing Inspector panels. | `implemented` | General Inspector falls back to Project projection for non-Drawable-set selections: `session-tree.ts:290`; Rig Tool Inspector falls back to empty state for unsupported `deformerTreeSet`: `rig-tool-inspector.tsx:140`. Dedicated wrap-selected Inspector UX is Domain C. |
| Existing Pool Drawable, bound Drawable ref, and Deformer node DnD routes remain present. | `implemented` | Drop handler routes Pool Drawable to bind, bound Drawable to move, RigControl to reparent: `deformer-tree-view.tsx:80`, `:96`, `:100`, `:105`. Drag payload parser accepts all three payload kinds: `deformer-tree-view.tsx:420`. |
| Existing DnD does not auto-resize/refit existing Deformers. | `implemented` | UI routes DnD to bind/move/reparent commands only: `editor-session-context.tsx:1260`, `:1275`, `:1290`. Authoring mutations update child lists / parent ids / roots only: `packages/authoring-core/src/rig-control-mutations.ts:258`, `:310`, `:383`. Geometry updates are separate `updateRigControl` logic: `rig-control-mutations.ts:1425`. Operation tests assert move/reparent changed paths are child/parent fields only: `packages/operation-core/src/operations/rig-control.test.ts:1000`, `:1080`. |
| Fit-to-children or explicit refit operation for existing DnD. | `explicit non-goal` | Wave77 explicitly excludes a `Fit to children` route in Domain A/Existing DnD: `wave77-plan.md:67`; no new DnD refit route is present in Domain A UI. |
| Wrap-selected authoring and editor UX. | `deferred by plan` | Domain B owns operation foundation and Domain C owns editor wrap-selected UX: `wave77-plan.md:164`, `:168`, `:245`. Domain A correctly stops at selection/pool/row cleanup. |

## Must-Not Compliance

- No Parts Tree order reuse for Deformer Tree range: pass. Deformer Tree uses `visibleTargets` and `DeformerTreeSelectionTarget`, not `drawableSet`: `editor-selection.ts:214`, `:363`.
- No Parts Container selection: pass. Pool part rows are `selected: false`, display-only, and absent from selectable targets: `rig-tool-state.ts:121`, `:688`.
- No selection persistence to package data: pass. Selection and anchors are React state: `editor-session-context.tsx:385`. Save passes only `session`, `baseDocument`, and `editorHiddenPartIds`: `editor-session-context.tsx:581`. Package editor-state writer still emits fixed `selection: []`: `packages/authoring-core/src/package-document-editor-state.ts:32`.
- No Canvas modifier multi-select: pass. Modifier handling is in Deformer Tree view only: `deformer-tree-view.tsx:73`; Canvas hit selection remains single-select: `canvas-preview-panel.tsx:499`.
- No already-bound Drawables in Pool: pass. Pool filter excludes all childDrawableIds already listed by RigControls: `rig-tool-state.ts:563`.
- No Pool container drop target: pass. Pool part row has no drag/drop handlers: `deformer-tree-view.tsx:311`.
- No Inspector geometry control removal: pass. Warp/Rotation geometry controls remain present in Inspector source and focused E2E: `rig-tool-inspector.tsx:403`, `:630`, `:844`; `psd-import.e2e.spec.ts:434`, `:467`.

## Verification Performed In This Review

- `pnpm.cmd exec vitest run apps/editor/src/features/editor-session/model/rig-tool-state.test.ts`
  - Initial sandbox run failed with known `spawn EPERM`.
  - Escalated rerun passed: 1 file, 12 tests.
- `git diff --check --` Domain A files passed; Git emitted LF-to-CRLF working-copy warnings only.
- Source review covered the listed Domain A files and supporting DnD/Inspector/storage files cited above.

Recorded by Orch-Sylph/Gnome and not independently rerun here:

- `pnpm.cmd typecheck` passed.
- Focused Playwright PSD-import grep for `creates a Warp Deformer draft` passed with 1 test after sandbox EPERM escalation.

## Residual Risks

- The focused E2E path verifies Deformer Tree modifier selection, Pool container display-only behavior, row detail removal, and Pool Drawable to Deformer DnD. Existing bound Drawable ref DnD and Inspector reparent flows exist in PSD E2E/source, but this review did not rerun those broader tests.
- Deformer node drag-to-reparent is source-routed and covered by model/operation tests; no newly added Domain A browser assertion specifically drags a Deformer node onto another Deformer.
- `deformerTreeSet` currently falls back to safe empty/project Inspector states. That is adequate for Domain A crash-safety, but Domain C still must add the coherent wrap-selected Inspector/UX.

## User Decision Points

None.

## Final Recommendation

Domain A can pass the Spec Compliance gate. Carry the residual risks above into Test Adequacy / Domain C review rather than reopening Domain A.
