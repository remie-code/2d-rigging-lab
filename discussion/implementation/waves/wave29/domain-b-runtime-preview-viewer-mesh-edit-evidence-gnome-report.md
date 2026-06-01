# Wave29 Domain B Gnome Report: Runtime / Preview / Viewer Mesh Edit Evidence

## Status

done

## Scope

Implemented focused semantic evidence for `wave29-runtime-preview-viewer-mesh-edit-evidence`.

Changed files:

- `packages/runtime-core/src/mesh-evidence.ts`
- `packages/runtime-core/src/mesh-evidence.test.ts`
- `packages/runtime-core/src/normalized-runtime-graph.ts`
- `packages/runtime-core/src/snapshot.ts`
- `packages/runtime-core/src/runtime-evidence.ts`
- `packages/runtime-core/src/viewer-evaluation.ts`
- `packages/runtime-core/src/index.ts`
- `apps/editor/src/editor-preview/preview-dto.ts`
- `apps/editor/src/editor-preview/preview-projection.ts`
- `apps/editor/src/editor-preview/preview-mesh-evidence.test.ts`

`packages/runtime-core/src/index.ts` remains barrel-only; it only re-exports `mesh-evidence.js`.

## Semantics Added

- Runtime snapshots can carry optional per-drawable mesh evidence when mesh metadata exists:
  - deterministic vertex refs and positions,
  - bounds and vertex hash,
  - topology summary with vertex, stable ID, UV, triangle, and triangle index counts.
- `buildRuntimeEvidence` now returns `meshEditEvidence` comparing baseline and candidate snapshots.
- Viewer runtime evidence now includes the same mesh edit evidence, aligned with the viewer comparison epsilon policy.
- Preview projection can consume `meshEditEvidence` and mark per-vertex state:
  - selected,
  - moved,
  - locked,
  - editor-hidden,
  - runtime-visible/runtime-hidden,
  - texture-backed.
- Editor-hidden, locked, and selected remain editor/preview evidence only; runtime visibility remains the runtime drawable field.

## Verification

Passed:

- `pnpm.cmd exec vitest run packages/runtime-core/src/mesh-evidence.test.ts apps/editor/src/editor-preview/preview-mesh-evidence.test.ts`
- `pnpm.cmd exec vitest run packages/runtime-core/src/runtime-evidence.test.ts packages/runtime-core/src/viewer-evaluation.test.ts packages/runtime-core/src/layer-tree-evidence.test.ts apps/editor/src/editor-preview/preview-projection.test.ts apps/editor/src/editor-preview/texture-preview-resolution.test.ts`
- `pnpm.cmd typecheck`
- `pnpm.cmd exec vitest run packages/runtime-core/src/mesh-evidence.test.ts packages/runtime-core/src/runtime-evidence.test.ts packages/runtime-core/src/viewer-evaluation.test.ts packages/runtime-core/src/layer-tree-evidence.test.ts apps/editor/src/editor-preview/preview-mesh-evidence.test.ts apps/editor/src/editor-preview/preview-projection.test.ts apps/editor/src/editor-preview/texture-preview-resolution.test.ts`
- `pnpm.cmd exec vitest run packages/runtime-core/src/snapshot-comparison.test.ts packages/runtime-core/src/texture-projection.test.ts packages/runtime-core/src/rig-control-hierarchy-evidence.test.ts packages/runtime-core/src/rig-control-keyform-evidence.test.ts packages/runtime-core/src/dynamics-evaluation.test.ts packages/runtime-core/src/runtime-evidence-artifacts.test.ts packages/runtime-core/src/wave28-part-texture-layer-contract-fixtures.test.ts packages/runtime-core/src/preview-viewer-equivalence-fixture.test.ts`

Skipped:

- Full e2e was not run; Domain B is runtime/editor-preview evidence only and no app UI workflow was changed.

## Residual Risks

- Mesh evidence is semantic JSON evidence only. It does not prove pixel rendering, texture sampling, WebGL/canvas renderer behavior, topology editing, or UV editing.
- Moved vertex refs require full-detail snapshots with vertex positions. Summary snapshots still expose bounds/hash/topology where mesh metadata is present, but not full moved vertex lists.

## User Input / Design Decisions

- needs_user_input: none
- needs_design_decision: none
- blockers: none
