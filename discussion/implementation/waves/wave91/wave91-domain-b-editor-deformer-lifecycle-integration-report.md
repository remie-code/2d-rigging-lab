# Wave91 Domain B Editor Deformer Lifecycle Integration Report

Date: 2026-06-20
Domain: `wave91-editor-deformer-lifecycle-integration`
Verdict: `pass`

## Scope

Domain B implemented the Editor-side Wave91 integration:

- Editor command/context wiring for Domain A `deleteRigControl`.
- `Delete Deformer` actions in committed Warp and Rotation Deformer inspectors.
- Editor create-result propagation from actual committed operation results, including suffixed rig IDs.
- Mesh Apply post-commit auto-refit for unkeyed Warp Deformer ancestors.
- Focused editor tests for delete UI/history, suffixed selection, and Mesh Apply auto-refit.

Out-of-scope items stayed untouched: delete confirmation dialog, Deformer Tree row action/context menu/Delete key, manual Fit to children button, keyed-Warp skip warning, Rotation/keyed auto-refit, domain shrink, runtime evaluator behavior, mesh generation algorithms, Texture Atlas, Dynamics, Workspace Save, dependencies, and lockfile.

## Changed Files

Implementation:

- `apps/editor/src/features/editor-session/model/editor-session-commands.ts`
- `apps/editor/src/features/editor-session/model/mesh-apply-auto-refit.ts`
- `apps/editor/src/features/editor-session/editor-session-context.tsx`
- `apps/editor/src/workspace/panels/rig-tool-inspector.tsx`

Tests:

- `apps/editor/src/features/editor-session/model/editor-session-commands.test.ts`
- `apps/editor/src/features/editor-session/model/mesh-apply-auto-refit.test.ts`
- `apps/editor/src/features/editor-session/editor-session-context-history.test.ts`
- `apps/editor/src/workspace/panels/rig-tool-inspector.test.ts`

Artifacts:

- `discussion/implementation/waves/wave91/wave91-domain-b-editor-deformer-lifecycle-integration-report.md`
- `discussion/implementation/waves/wave91/_map.md`
- `discussion/implementation/reviews/wave91/wave91-domain-b-spec-compliance-review.md`
- `discussion/implementation/reviews/wave91/wave91-domain-b-design-development-review.md`
- `discussion/implementation/reviews/wave91/wave91-domain-b-test-adequacy-review.md`
- `discussion/implementation/reviews/wave91/_map.md`

Pre-existing Domain A package changes and artifacts were left intact and not reverted.

## Implementation Summary

`editor-session-commands` now exposes `commitDeleteRigControl()` through operation-core `deleteRigControl`. It also carries the operation result on editor command results and extracts created rig control IDs from `modelDiff.added`, replacing display-name-predicted IDs for Warp/Rotation creation.

`EditorSessionProvider` exposes `deleteRigControl()`, routes it through existing rig command/history handling, and clears selected deformer state, selection anchors, rig draft, and rig feedback after a successful delete. Undo/redo remains the existing before/after session snapshot behavior.

Committed Warp and Rotation Deformer inspectors now render a `Delete Deformer` button that invokes the delete callback for the selected rig control.

Mesh Apply now records successfully committed Drawable IDs, then runs `commitMeshApplyAutoRefit()` after all mesh draft commits. The helper dedupes affected Warp ancestors, processes deeper ancestors before outer ancestors, skips keyed Warps, computes required bounds from all current children, unions them with current domain bounds, and calls `commitUpdateRigControl()` only when the domain expands.

## Review Results

All required review lanes completed and passed.

| Review lane | Final verdict | Artifact |
|---|---|---|
| Spec Compliance Review | `pass` | `discussion/implementation/reviews/wave91/wave91-domain-b-spec-compliance-review.md` |
| Design / Development Compliance Review | `pass` | `discussion/implementation/reviews/wave91/wave91-domain-b-design-development-review.md` |
| Test Adequacy Review | `pass` | `discussion/implementation/reviews/wave91/wave91-domain-b-test-adequacy-review.md` |

No fix loop was required after review. Reviewers inspected source and tests directly and did not rely only on the implementer summary.

## Verification

Commands run by Orch-Sylph:

| Command | Outcome |
|---|---|
| `pnpm.cmd exec vitest run apps/editor/src/features/editor-session/model/editor-session-commands.test.ts apps/editor/src/features/editor-session/model/mesh-apply-auto-refit.test.ts apps/editor/src/features/editor-session/editor-session-context-history.test.ts apps/editor/src/workspace/panels/rig-tool-inspector.test.ts` | Sandbox attempt failed with Vite/esbuild `spawn EPERM`; approved rerun passed: 4 files / 54 tests. |
| `pnpm.cmd typecheck` | Passed. |
| `pnpm.cmd run check:source` | Passed. |
| `pnpm.cmd run check:deps` | Passed. |
| `git diff --check -- apps/editor/src/features/editor-session apps/editor/src/workspace/panels discussion/implementation/reviews/wave91 discussion/implementation/waves/wave91` | Passed; Git reported LF/CRLF working-copy warnings only. |
| `Select-String -Path apps/editor/src/features/editor-session/model/mesh-apply-auto-refit.ts,apps/editor/src/features/editor-session/model/mesh-apply-auto-refit.test.ts -Pattern '\\s+$'` | Passed with no trailing-whitespace matches for new untracked files. |

## Residual Risks

- Actual created-ID propagation relies on the current operation-core convention that create operations emit one added rig-control target in `modelDiff.added`. Domain A source and Domain B tests support that contract; if future create operations add multiple rig controls, the editor should switch to an explicit operation result field or exact-one guard.
- Provider-level duplicate suffixed selection is directly covered for Rotation creation. Warp creation uses the same command result extraction and selection path; residual risk is low.
- Provider-level Mesh Apply integration covers hook placement, draft cleanup, generated mesh commit, and unkeyed Warp expansion. No-shrink, keyed skip, nested, and shared-parent behavior are covered at the focused helper level.

## User-Decision Points

None for Domain B.
