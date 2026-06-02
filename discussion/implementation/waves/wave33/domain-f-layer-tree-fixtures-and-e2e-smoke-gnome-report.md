# Wave33 Domain F Gnome Report: Layer Tree Fixtures And E2E Smoke

Date: 2026-06-02

Verdict: done

## Scope Implemented

- Added rights-clean semantic JSON contract fixture for Layer Tree direct manipulation under `fixtures/contracts/wave33-layer-tree-direct-manipulation-contract-fixtures/`.
- Added focused operation-core fixture test covering request parsing, operation chain, package materialization, runtime/viewer evidence, validator evidence, reload reinspection contract, rejected non-empty delete, and pending-delete preflight contract metadata.
- Added desktop/mobile production Editor e2e smoke for row-level Layer Tree direct manipulation controls with browser-local save/load reinspection.
- Registered the fixture/test narrowly in fixture manifest and traceability matrix.

## Files Changed

- `fixtures/contracts/wave33-layer-tree-direct-manipulation-contract-fixtures/**`
- `packages/operation-core/src/wave33-layer-tree-direct-manipulation-contract-fixtures.test.ts`
- `apps/editor/e2e/test-ids.mjs`
- `apps/editor/e2e/layer-tree-direct-manipulation-smoke.mjs`
- `apps/editor/e2e/smoke-checks.mjs`
- `discussion/tests/fixtures/fixture-manifest.md`
- `discussion/tests/traceability/test-traceability-matrix.md`
- `discussion/implementation/waves/wave33/domain-f-layer-tree-fixtures-and-e2e-smoke-gnome-report.md`

## Coverage Notes

- Rename: fixture `updatePart` renames `part_wave33_head`; e2e drafts row rename for `part_wave_33_head` and reinspects after save/load.
- Reparent: fixture/e2e reparent head under parent; runtime/viewer checks depth 2 hierarchy.
- Empty-leaf delete pass: fixture/e2e delete empty leaf and assert absence after materialization/save/load.
- Non-empty delete rejection: fixture pins `operation.deletePart.partHasChildParts`; e2e asserts parent delete control is disabled with `Part has child parts`.
- Drawable reassignment: fixture/e2e move `draw_body` under renamed/reparented head.
- Texture assignment: fixture/e2e assign `tex_wave33`; e2e uses package-local metadata-only preview and asserts texture-backed semantic preview fallback.
- Preview / Viewer / validation: fixture pins runtime/viewer/validator summaries; e2e asserts Preview summary, Viewer part/drawable evidence, and exact validator diagnostics surfaced by production source-intake metadata.
- Save/load reinspection: e2e saves to browser localStorage, reloads, loads, and rechecks Layer Tree, Preview, Viewer, package graph, operation log, and generated runtime/validation artifacts.
- Pending-delete preflight: e2e drafts drawable assignment to a pending-delete part, drafts empty-leaf delete, commits, and asserts operation log count remains unchanged, graph remains unchanged, pending target option is disabled, and draft state is preserved.

## Verification

- `pnpm.cmd exec vitest run packages/operation-core/src/wave33-layer-tree-direct-manipulation-contract-fixtures.test.ts`: passed, 2 tests.
- `node apps/editor/e2e/layer-tree-direct-manipulation-smoke.mjs`: passed desktop and mobile.
- `pnpm.cmd test:e2e`: passed desktop and mobile integrated smoke.
- `pnpm.cmd typecheck`: passed.
- `git diff --check -- fixtures/contracts/wave33-layer-tree-direct-manipulation-contract-fixtures apps/editor/e2e packages/operation-core/src/wave33-layer-tree-direct-manipulation-contract-fixtures.test.ts discussion/tests/fixtures/fixture-manifest.md discussion/tests/traceability/test-traceability-matrix.md discussion/implementation/waves/wave33`: passed with CRLF normalization warnings only.

## Residual Risks

- Production e2e validation intentionally observes exact diagnostics from metadata-only source-intake (`asset.psd.adapterDiagnostic` and `ref.textureSourceLayerMismatch`) because the UI cannot add a new texture atlas entry to the existing sample `src_generated / layer_body` without importing a duplicate source asset. The semantic contract fixture separately pins a validator pass path for the authored package state.
- No real image bytes, parser, renderer, pixel oracle, native drag-and-drop, recursive delete, delete-with-reassign, multi-select bulk operation, archive/file-system access, dependency, manifest, or lockfile changes were introduced.

## Out-of-Scope Changes

None required for Domain F completion.
