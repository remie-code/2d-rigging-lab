# Wave76 Domain C Design / Development Compliance Review

- Verdict: `pass`
- Lane: Design / Development Compliance
- Target: `wave76-drawable-multiselect-parts-tree-select-inspector`
- Date: 2026-06-16
- Reviewer: Review-Sylph

## Basis Reviewed

- `discussion/implementation/orchestration/wave76-plan.md`, especially sections 3.3, 7.3, 11, 15, 17, 18, and 19.
- `discussion/implementation/orchestration/wave75-plan.md`
- `discussion/implementation/waves/wave75/wave75-final-integration-report.md`
- `discussion/implementation/reviews/wave75/wave75-final-clean-integration-review.md`
- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/development_convention/ux-backed-package-logic-authority.md`
- `discussion/development_convention/dependency-policy.md`
- `discussion/development_convention/operation-policy.md`
- `discussion/implementation/waves/wave76/wave76-domain-c-drawable-multiselect-parts-tree-select-inspector-report.md`

## Scope Reviewed

Source and test files inspected directly:

- `apps/editor/src/features/editor-session/model/editor-selection.ts`
- `apps/editor/src/features/editor-session/editor-session-context.tsx`
- `apps/editor/src/features/editor-session/model/session-tree.ts`
- `apps/editor/src/features/editor-session/model/session-tree.test.ts`
- `apps/editor/src/workspace/panels/structure-tree-panel.tsx`
- `apps/editor/src/workspace/panels/inspector-panel.tsx`
- `apps/editor/src/workspace/canvas/canvas-projection.ts`
- `apps/editor/src/workspace/canvas/canvas-projection.test.ts`
- `apps/editor/e2e/psd-import.e2e.spec.ts`

Parallel-domain dirt was present in `packages/**`, `packages/render-webgl2/**`, Rig Tool files, Wave76 Domain A artifacts, and maps. This review treated those as out of Domain C unless they intersected the reviewed behavior.

## Findings

### Resolved In Fix Loop 1: Ctrl/Meta deselect can lose the clicked Drawable as the Shift anchor

`apps/editor/src/features/editor-session/model/editor-selection.ts:97` through `:105` correctly makes Ctrl/Meta toggle update `anchorDrawableId` to the clicked Drawable. The focused model test also captures the important collapse case at `apps/editor/src/features/editor-session/model/session-tree.test.ts:103`: toggling one member off can leave a single different Drawable selected while the anchor remains the clicked Drawable.

The first review found that the React context did not preserve that contract. `selectDrawable` applied the transition anchor at `apps/editor/src/features/editor-session/editor-session-context.tsx:883` through `:891`, but the effect at `apps/editor/src/features/editor-session/editor-session-context.tsx:442` through `:446` later overwrote the anchor whenever the resulting selection was a single Drawable. In a user flow such as:

1. click Drawable A;
2. Ctrl/Meta-click Drawable B;
3. Ctrl/Meta-click Drawable B again, leaving only A selected;
4. Shift-click Drawable C;

the plan requires the anchor after step 3 to be the clicked Drawable B, so step 4 ranges from B to C. The effect changed the anchor back to A, so the next Shift range was computed from A instead.

This violated Wave76 section 3.3 / 7.3: Ctrl-click updates anchor to the clicked Drawable, and Shift-click ranges from that anchor. It also meant the model helper was correct but the UI state integration could diverge after a normal user modifier sequence.

Recommended fix: avoid unconditional anchor synchronization from any single Drawable selection. Either remove that effect and set the anchor explicitly in every single-Drawable selection path that should establish one, or guard the effect so it does not override an anchor explicitly returned by the Parts Tree transition.

Fix Loop 1 status: resolved. The unconditional single-Drawable anchor sync effect was removed. `apps/editor/src/features/editor-session/editor-session-context.tsx:442` through `:452` now only contains mesh draft cleanup on selection changes, and `selectDrawable` applies the transition anchor directly at `apps/editor/src/features/editor-session/editor-session-context.tsx:880` through `:888`. Other selection-setting paths now explicitly set the anchor for Drawable selection or clear it for Part/RigControl selection, for example `moveStructureChild` at `:837` through `:856`, `selectPart` / `selectRigControl` at `:858` through `:895`, mesh/rig creation paths at `:947` through `:1065`, and rig binding/update paths at `:1122` through `:1179`.

The added test at `apps/editor/src/features/editor-session/model/session-tree.test.ts:103` through `:128` verifies the toggle-collapse case keeps the clicked Drawable as the next Shift anchor. Additional fallback and replace coverage appears at `:159` through `:233`.

## Fix Loop 1 Re-review

Final verdict: `pass`.

The anchor finding is resolved in source, not only in the report. I found no new design/development issue introduced by Fix Loop 1. The fix keeps anchor mutation explicit in the same context branches that set selection, preserves Drawable-only multi-select scope, and does not introduce package, operation, dependency, or persistence changes.

Verification performed in this re-review:

| Command / check | Result |
|---|---|
| Reviewed `discussion/implementation/reviews/wave76/wave76-domain-c-design-development-review.md` | Previous `needs_changes` finding confirmed. |
| Reviewed `discussion/implementation/waves/wave76/wave76-domain-c-drawable-multiselect-parts-tree-select-inspector-report.md` | Fix Loop 1 claims and validation table reviewed. |
| Reviewed current diff for `editor-session-context.tsx`, `session-tree.test.ts`, `editor-selection.ts`, and `session-tree.ts` | Anchor sync effect removed; explicit anchor set/clear paths verified. |
| `rg` over `selectionAnchorDrawableId`, `setSelectionAnchorDrawableId`, `setSelection(` | No remaining unconditional single-Drawable anchor sync found; all reviewed `setSelection` branches set or clear anchor coherently. |
| `git diff --check -- <Domain C files>` | Passed; CRLF normalization warnings only. |
| `git diff --name-only HEAD -- package.json pnpm-lock.yaml apps/editor/package.json packages/*/package.json` | No manifest or lockfile output in the reviewed set. |
| `node scripts/check-source-organization.mjs` | Passed. |
| `node scripts/check-dependencies.mjs` | Passed. |
| `pnpm.cmd exec vitest run apps/editor/src/features/editor-session/model/session-tree.test.ts apps/editor/src/workspace/canvas/canvas-projection.test.ts` | Sandbox run failed with esbuild `spawn EPERM`; escalated rerun passed, 2 files / 26 tests. |

## Design / Development Compliance Notes

- Source organization is acceptable. Domain C kept selection transition logic in `editor-selection.ts`, tree/inspector projection in `session-tree.ts`, Parts Tree event handling in `structure-tree-panel.tsx`, Select Inspector rendering in `inspector-panel.tsx`, and canvas highlight projection in `canvas-projection.ts`.
- No broad `index.ts`, catch-all helper file, dependency manifest, lockfile, package-format, operation schema, or package mutation change was found in the Domain C reviewed scope.
- Parts Tree modifier handling is localized to `structure-tree-panel.tsx:51` through `:60`. Deformer Tree and Canvas still call `selectDrawable` without modifier options at `deformer-tree-view.tsx:140`, `deformer-tree-view.tsx:289`, and `canvas-preview-panel.tsx:502`.
- Select Inspector is minimal and does not expose Drawable edit controls. `inspector-panel.tsx:132` through `:164` renders kind/count/name list only; the E2E asserts opacity and clipping controls are absent at `psd-import.e2e.spec.ts:192` through `:193`.
- Canvas projection marks multi-selected Drawables uniformly through `isDrawableSelected` and `resolveSelectedDrawableIds`; the new canvas test at `canvas-projection.test.ts:120` through `:144` checks no Part subtree expansion and no mesh overlay for a Drawable set.
- Existing single-selection Part/Drawable/RigControl paths are structurally preserved. `createDrawableSelection` returns `kind: "drawable"` for one id, keeping single Drawable consumers on the existing shape.

## Verification Reviewed / Performed

Performed in this review:

| Command | Result |
|---|---|
| `git diff --check -- <Domain C files>` | Passed; CRLF normalization warnings only. |
| `git diff --name-only HEAD -- package.json pnpm-lock.yaml apps/editor/package.json packages/*/package.json` | No output for reviewed manifests. |
| `node scripts/check-source-organization.mjs` | Passed. |
| `node scripts/check-dependencies.mjs` | Passed. |
| `pnpm.cmd exec vitest run apps/editor/src/features/editor-session/model/session-tree.test.ts apps/editor/src/workspace/canvas/canvas-projection.test.ts` | Sandbox run failed with esbuild `spawn EPERM`; escalated rerun passed, 2 files / 25 tests. |

Reviewed from Gnome report:

- Focused E2E `psd-import` path reportedly passed and includes Parts Tree modifier-click proof plus Select Inspector assertions.
- Root `pnpm.cmd typecheck` reportedly remains red outside Domain C at `packages/authoring-core/src/rig-control-mutations.ts(479,3): Cannot find name 'assertPartExists'`.
- App `tsc --noEmit` reportedly had out-of-domain debt; Gnome recorded no remaining errors in Domain C touched files after local fixes.

## Residual Risks

- A direct React context harness regression was not added; the source bug was removed and the model transition contract now covers the toggle-collapse anchor behavior.
- Mesh and Rig Tool behavior for `drawableSet` is intentionally deferred to Domains D and E. Domain C does not yet make those tools useful for multi-select; this is acceptable as deferred scope but should be rechecked in dependent domains.
- Full Playwright was not rerun in this review; the E2E evidence was checked from source and the implementation report.
- The shared worktree is dirty from parallel domains, so final integration must recheck cross-domain interactions after Domain C fixes land.

## User Decision Points

None. The anchor issue is an implementation bug against the accepted Wave76 multi-select contract, not a product decision.
