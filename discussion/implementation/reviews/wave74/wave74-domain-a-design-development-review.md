# Wave74 Domain A Design / Development Compliance Review

- Verdict: `pass`
- Date: 2026-06-15
- Reviewer: Review-Sylph
- Target: Wave74 Domain A `wave74-deformer-foundation-fixes`
- Lane: Design / Development Compliance Review
- Re-review: fix loop 1 ownership reclassification accepted.

## Basis Reviewed

- `discussion/implementation/orchestration/wave74-plan.md`
- `discussion/implementation/orchestration/wave73-plan.md`
- `discussion/implementation/waves/wave73/wave73-final-integration-report.md`
- `discussion/implementation/reviews/wave73/wave73-final-clean-integration-review.md`
- `discussion/implementation/waves/wave73/wave73-domain-b-rotation2d-translation-exposure-report.md`
- `discussion/development_convention/ux-backed-package-logic-authority.md`
- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/development_convention/dependency-policy.md`
- `discussion/development_convention/operation-policy.md`
- `discussion/development_convention/schema-and-id-conventions.md`
- `discussion/design/screen-design/components/rig-tool.md`
- `discussion/design/screen-design/components/canvas-preview.md`
- `discussion/implementation/waves/wave74/wave74-domain-a-deformer-foundation-fixes-report.md`
- Current source/test diffs for the Domain A reported files.
- Current dirty worktree classification, including parallel Domain B editor/e2e changes.

## Re-Review Result

The prior verdict was `needs_changes` because keyform discovery/count production read-model work was present in shared Domain A-reported files. Fix loop 1 updated the Domain A report to narrow Domain A ownership to Warp domain calculation hunks and to explicitly exclude `keyformSetCount`, `keyformKeyCount`, `summarizeRigControlKeyforms`, Deformer Tree keyform-count projection, and the "Deformer Tree discovery" test from Domain A ownership.

That ownership reclassification resolves the Domain A design/development finding. The keyform count projection remains in the worktree, but it is now documented as Domain B work in `discussion/implementation/waves/wave74/wave74-domain-a-deformer-foundation-fixes-report.md:27` and `discussion/implementation/waves/wave74/wave74-domain-a-deformer-foundation-fixes-report.md:31`. Domain B also claims and reviews the same work in `discussion/implementation/waves/wave74/wave74-domain-b-save-load-keyform-visibility-hardening-report.md:24` and `discussion/implementation/reviews/wave74/wave74-domain-b-design-development-review.md:62`.

No new blocking or needs-change issues were found for the Domain A-owned Warp domain and Rotation translation interpolation evidence.

## Findings

### Blocking

None.

### Needs Changes

None.

### Resolved Prior Finding: Keyform discovery read-model ownership

Previously flagged lines remain present: `apps/editor/src/features/editor-session/model/rig-tool-state.ts` adds `keyformSetCount` and `keyformKeyCount` to Warp / Rotation deformer read models and Deformer Tree rows at lines 65, 96, 134, and 150; `summarizeRigControlKeyforms` computes counts at lines 610-622; deformer rows project them at lines 644-645, 701-703, and 735-737. The corresponding model test remains at `apps/editor/src/features/editor-session/model/rig-tool-state.test.ts:286` and asserts count fields at lines 323-327. Parallel Domain B UI consumes them in `apps/editor/src/workspace/panels/deformer-tree-view.tsx:177` through line 230.

This is acceptable for Domain A after the fix-loop report update because Domain A no longer claims those hunks as its implementation, and Domain B's report/review now explicitly covers them as keyform visibility/discovery work. Domain A should not revert them in this shared worktree.

## Passing Checks

- Warp Deformer creation now uses committed mesh vertex bounds for editor-generated `domainBounds` at `apps/editor/src/features/editor-session/model/rig-tool-state.ts:190`, with fit/reset using child bounds at lines 355-370 and payload creation still producing an existing `createWarpDeformer` payload at lines 379-402.
- The fixed margin is deterministic and geometry/preset independent: `WARP_DEFORMER_DOMAIN_MARGIN = 1` at `apps/editor/src/features/editor-session/model/rig-tool-state.ts:23`; mesh vertex bounds are expanded through `resolveDrawableWarpDomainBounds`, `computeVertexBounds`, and `expandRect` at lines 827-837 and 993-1018.
- Existing committed child Warp domains are preserved when computing parent/child bounds because `resolveRigControlWarpDomainBounds` returns stored `domainBounds` for `warpLattice2d` at `apps/editor/src/features/editor-session/model/rig-tool-state.ts:898-900`.
- The no-mesh fallback remains deterministic through `resolveDrawableBounds` / `fallbackCanvasBounds` at `apps/editor/src/features/editor-session/model/rig-tool-state.ts:812-824` and `1021-1028`.
- Warp tests cover outside-layer committed mesh vertices and fit/reset/fallback behavior at `apps/editor/src/features/editor-session/model/rig-tool-state.test.ts:91-157`; Canvas evaluation proves outside-layer vertices deform when the domain includes them at `apps/editor/src/workspace/canvas/canvas-evaluation.test.ts:265-298`.
- Rotation translation interpolation did not require production runtime/schema changes. Existing runtime interpolation supports Vec2 at `packages/runtime-core/src/keyform-linear1d-interpolation.ts:185-189`, and rotation sampling applies `translation` separately from internal `scale` at `packages/runtime-core/src/rig-control-keyform-state.ts:69-86`. Added tests cover exact/midpoint Vec2 interpolation at `packages/runtime-core/src/keyform-linear1d-interpolation.test.ts:32-50`, runtime fallback/interpolation at `packages/runtime-core/src/rig-control-keyform-evidence.test.ts:189-283`, Canvas midpoint evaluation at `apps/editor/src/workspace/canvas/canvas-evaluation.test.ts:325-373`, and after-load runtime evaluation at `packages/authoring-core/src/portable-project-bundle.test.ts:202-226`.
- GUI mutation paths still route through Operation Core: editor apply uses `commitCreateWarpDeformer` / `commitUpdateRigControl` in `apps/editor/src/features/editor-session/editor-session-context.tsx:985-987`, `1061-1063`, and `1113-1117`; the commands call operation types `createWarpDeformer` and `updateRigControl` at `apps/editor/src/features/editor-session/model/editor-session-commands.ts:295-306` and `369-376`.
- No package schema, manifest, lockfile, or dependency changes were found in the Domain A diff.
- No mesh generation algorithm change, mesh clipping, selection/current parameter persistence, slider performance work, Viewer / Runtime View, save format, Cubism dependency/asset, or scale exposure was found in the Domain A foundation changes. Existing `restScale` mentions remain test/runtime fixture state, not an editor exposure path.

## Source Organization / Dependency / ID Review

- No `index.ts` implementation growth or new catch-all files were introduced by the Domain A owned diff.
- `node scripts/check-source-organization.mjs` passed.
- `node scripts/check-dependencies.mjs` passed.
- `git diff --check -- <Domain A files>` exited 0 with CRLF normalization warnings only.
- Manifest/lockfile diff check for `package.json`, `pnpm-lock.yaml`, and touched package manifests produced no changed files.
- Machine-readable IDs observed in added tests use existing safe forms such as `keyset_rotate_translation_x`, `rigControl:rig_head_rotate.translation`, and `keyset_child_translation_midpoint`; no new space-containing IDs were found in the Domain A diff.

## Worktree Classification

- Domain A reported dirty source/test files are limited to `rig-tool-state.ts` plus focused editor/runtime/authoring tests and the Domain A report.
- Parallel dirty files outside the Domain A report include `apps/editor/e2e/portable-project-save-load.e2e.spec.ts`, `apps/editor/src/workspace/panels/deformer-tree-view.tsx`, `apps/editor/src/workspace/panels/parameter-binding-section.tsx`, `apps/editor/src/workspace/panels/parameter-binding-section.test.ts`, and implementation maps. These appear to be Domain B/keyform-discovery or orchestration artifacts and were not edited or reverted.
- The shared `rig-tool-state.ts` and `rig-tool-state.test.ts` ownership is now explicitly split: Domain A owns Warp domain calculation and related tests; Domain B owns keyform count/read-model discovery and related tests.

## Commands Run

- `git status --short -uall`
- `git diff --stat -- <Domain A files>`
- `git diff -- <Domain A files>`
- `rg` / line-number inspections across Domain A files, policy files, and selected parallel Domain B files.
- `node scripts/check-source-organization.mjs` -> passed.
- `node scripts/check-dependencies.mjs` -> passed.
- `git diff --check -- <Domain A files>` -> passed with CRLF normalization warnings only.
- `git diff --name-status -- package.json pnpm-lock.yaml apps/editor/package.json packages/authoring-core/package.json packages/runtime-core/package.json packages/operation-core/package.json` -> no output.
- Re-review additions:
  - Re-read the updated Domain A report.
  - Read Domain B report and Design / Development review ownership evidence for keyform count projection.
  - `rg -n "keyformSetCount|keyformKeyCount|summarizeRigControlKeyforms|Deformer Tree|discovery|rig-tool-state" ...`
  - Reran `node scripts/check-source-organization.mjs` -> passed.
  - Reran `node scripts/check-dependencies.mjs` -> passed.
  - Reran `git diff --check -- <Domain A files + Domain A report + this review>` -> passed with CRLF normalization warnings only.
  - Reran manifest/lockfile diff check -> no output.

I did not rerun the focused Vitest suite in this lane; Gnome's reported Vitest/typecheck results were reviewed as implementation evidence, while this review independently reran lightweight architecture/dependency/diff guards.

## Residual Risks

- Browser-level proof for the exact Warp creation UI path remains an integration/test-adequacy concern; current Domain A evidence is editor-model and Canvas-evaluation focused.
- Operation Core still consumes explicit `domainBounds`; non-editor callers that construct a Warp payload themselves must provide the corrected domain. This is acceptable for the reviewed UI draft path but should stay visible in future API/Codex-facing authoring work.
- Domain A and Domain B both touch `rig-tool-state.ts` and its tests. The ownership split is now documented and reviewed, but final integration should still inspect the combined editor model file as one unit.

## User-Decision Points

None.
