# Wave28 Domain B Review: Runtime / Preview / Viewer Layer Tree Evidence

## Verdict

pass

## Scope

- Target: `wave28-runtime-preview-viewer-layer-tree-evidence`
- Reviewer: Review-Sylph
- Date: 2026-06-01
- Review mode: independent review of basis docs, changed files, diff, and verification results

## Basis Reviewed

- `.agents/skills/implementation-orchestration/SKILL.md`
- `discussion/implementation/orchestration/wave28-plan.md`
- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/development_convention/dependency-policy.md`
- `discussion/development_convention/schema-and-id-conventions.md`
- `discussion/design/module-contracts/package-file-format-contract.md`
- `discussion/design/mvp-authoring-runtime/03-runtime-evaluation-semantics.md`
- `discussion/tests/traceability/test-traceability-matrix.md`
- `discussion/implementation/waves/wave28/domain-b-runtime-preview-viewer-layer-tree-evidence-report.md`

## Files Reviewed

Runtime-core:

- `packages/runtime-core/src/normalized-runtime-graph.ts`
- `packages/runtime-core/src/layer-tree-evidence.ts`
- `packages/runtime-core/src/layer-tree-evidence.test.ts`
- `packages/runtime-core/src/snapshot.ts`
- `packages/runtime-core/src/snapshot-comparison.ts`
- `packages/runtime-core/src/viewer-evaluation.ts`
- `packages/runtime-core/src/index.ts`

Editor Preview:

- `apps/editor/src/editor-preview/preview-dto.ts`
- `apps/editor/src/editor-preview/preview-layer-state.ts`
- `apps/editor/src/editor-preview/preview-projection.ts`
- `apps/editor/src/editor-preview/runtime-diff-summary.ts`
- `apps/editor/src/editor-preview/texture-preview-resolution.ts`
- `apps/editor/src/editor-preview/preview-projection.test.ts`
- `apps/editor/src/editor-preview/texture-preview-resolution.test.ts`

## Findings

No blocking or non-blocking findings.

## Design / Development Compliance

Pass.

- Runtime evidence now has a focused part evidence surface: `NormalizedRuntimeGraph.parts`, `NormalizedPart`, evaluated parts, hierarchy path, depth, drawable membership, and runtime-visible drawable counts.
- Runtime snapshots expose part hierarchy evidence and drawable `partId` membership without adding editor-only state to runtime semantics.
- Runtime diff emits stable semantic paths for `/parts/{partId}`, `/parts/{partId}/...`, `/drawables/{drawableId}/partId`, and `/drawables/{drawableId}/texture/...`.
- Viewer-facing evidence exposes sorted `partHierarchyEvidence` and `drawableLayerEvidence` with runtime visibility and texture assignment status.
- Editor Preview overlays `selection`, `lockedIds`, and `editorHiddenIds` only in `apps/editor/src/editor-preview`, preserving the runtime/editor-only boundary required by the wave plan and runtime semantics doc.
- Preview distinguishes runtime visibility, editor-hidden, locked, selected, unresolved texture, and texture-backed status via `EditorPreviewDrawableLayerStateDto`.
- Non-goals were contained. I did not find operation handler, validator broad implementation, Editor UI, renderer, image decode/sampling, dependency, manifest, or lockfile changes in the Domain B scope.
- `packages/runtime-core/src/index.ts` remains barrel-only.
- New responsibility files are focused: runtime layer-tree evidence lives in `layer-tree-evidence.ts`, and editor preview overlay state lives in `preview-layer-state.ts`.

## Test Adequacy

Pass.

- `packages/runtime-core/src/layer-tree-evidence.test.ts` covers deterministic part hierarchy, drawable membership, viewer evidence, runtime visibility, texture status, and stable diff paths for part membership and texture assignment.
- `apps/editor/src/editor-preview/preview-projection.test.ts` covers part projection and editor-only layer state overlay, including selected, locked, editor-hidden, runtime-hidden, and texture-unresolved state.
- `apps/editor/src/editor-preview/texture-preview-resolution.test.ts` covers texture-backed and unresolved layer state refresh after preview asset resolution.
- Existing compatibility coverage was rerun for runtime evidence, artifacts, dynamics, rig-control hierarchy/keyform evidence, texture projection, and preview/viewer equivalence.
- Full typecheck now passes in the current workspace. This differs from the Gnome report, which recorded earlier out-of-scope A/C typecheck failures; those failures are no longer present in my verification run.

## Verification Run

- `pnpm.cmd exec vitest run packages/runtime-core/src/layer-tree-evidence.test.ts packages/runtime-core/src/snapshot-comparison.test.ts packages/runtime-core/src/viewer-evaluation.test.ts apps/editor/src/editor-preview/preview-projection.test.ts apps/editor/src/editor-preview/texture-preview-resolution.test.ts`
  - Result: pass, 5 files / 19 tests.
- `pnpm.cmd exec vitest run packages/runtime-core/src/layer-tree-evidence.test.ts packages/runtime-core/src/snapshot-comparison.test.ts packages/runtime-core/src/viewer-evaluation.test.ts apps/editor/src/editor-preview/preview-projection.test.ts apps/editor/src/editor-preview/texture-preview-resolution.test.ts packages/runtime-core/src/runtime-evidence.test.ts packages/runtime-core/src/runtime-evidence-artifacts.test.ts packages/runtime-core/src/dynamics-evaluation.test.ts packages/runtime-core/src/rig-control-hierarchy-evidence.test.ts packages/runtime-core/src/rig-control-keyform-evidence.test.ts packages/runtime-core/src/texture-projection.test.ts packages/runtime-core/src/preview-viewer-equivalence-fixture.test.ts`
  - Result: pass, 12 files / 43 tests.
- `git diff --check -- apps/editor/src/editor-preview packages/runtime-core/src discussion/implementation/waves/wave28/domain-b-runtime-preview-viewer-layer-tree-evidence-report.md`
  - Result: pass. Git reported LF-to-CRLF working-copy warnings only.
- `pnpm.cmd typecheck`
  - Result: pass.
- `git diff --name-only -- package.json pnpm-lock.yaml pnpm-workspace.yaml apps/*/package.json packages/*/package.json`
  - Result: no dependency or manifest files changed.

## Remaining Issues

None for Domain B.

## User Decision Points

None.

