# Wave67 Domain C Design / Development Compliance Review

- Role: Review-Sylph
- Domain: C / Mesh `auto-outline-v4-contour-band` headless sidecar
- Verdict: pass

## Scope Reviewed

Target files reviewed directly:

- `packages/authoring-core/src/mesh-outline-v4-contour-band-generation.ts`
- `packages/authoring-core/src/mesh-generation.ts`
- `packages/authoring-core/src/mesh-quality-metrics.ts`
- `packages/authoring-core/src/index.ts`
- `packages/authoring-core/src/mesh-generation.test.ts`
- `packages/operation-core/src/payloads/model-edit.ts`
- `packages/operation-core/src/operations/generate-mesh.ts`
- `packages/operation-core/src/operations/generate-mesh.test.ts`

Basis documents read:

- `discussion/implementation/orchestration/wave67-plan.md`
- `discussion/implementation/waves/wave67/wave67-preplan-mesh-v4-sidecar-inventory.md`
- `discussion/design/mesh-generation/auto-outline-v4-contour-band.md`
- `discussion/design/mesh-rendering/mesh-image-rendering-architecture.md`
- `discussion/design/screen-design/components/mesh-tool.md`
- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/development_convention/dependency-policy.md`
- `discussion/development_convention/operation-policy.md`
- `discussion/development_convention/schema-and-id-conventions.md`
- `.github/skills/implementation-orchestration/SKILL.md`

Unrelated Domain A/B dirty files were observed in the worktree and were not counted as Domain C failures unless they contaminated Domain C.

## Findings

Blocking findings: none.

Warnings / residual notes:

- `packages/authoring-core/src/mesh-outline-v4-contour-band-generation.ts` is a large single-responsibility algorithm file with private duplicated geometry helpers. This is acceptable for this wave because the Wave67 plan explicitly allows local helper duplication when extraction would create churn, and the source organization guard passes. It should be watched if future mesh methods reuse the same contour/Delaunay helpers.
- The worktree includes out-of-scope renderer/editor/package changes, including `apps/editor/package.json`. Domain C package manifests and lockfile did not show Domain C dependency drift; final integration should still review the combined wave dependency state.

## Compliance Matrix

Allowed / forbidden scope: pass.

- Domain C changes are in `authoring-core` and `operation-core`; `package-format` was not changed for V4.
- No renderer, render-core, render-webgl2, Canvas2D, deformer, Cubism compatibility, `.moc3`, renderer seam-fix, or similar claims were found in the Domain C target files.
- Editor default remains V2.6: `commitGenerateMesh` defaults to `auto-outline-v2.6-soft-apron`, and Mesh Tool preview/apply still requests V2.6.

Module boundary: pass.

- V4 algorithm logic lives in authoring-core (`createAutoOutlineV4ContourBandMesh`), with contour extraction, contour-band construction, interior fill, deterministic stable ids, and contour-band metrics.
- Top-level generation routing in `mesh-generation.ts` adds V4 as an explicit method/source id and implements the required fallback chain: V4 -> V2.6 -> V2.5 -> V2 -> V1 -> bounds-grid.
- Operation-core owns request validation, previewMesh preconditions, and provenance formatting. It does not implement mesh geometry.

Source organization: pass.

- `packages/authoring-core/src/index.ts` remains barrel-only; V4 is a single export line.
- No forbidden catch-all `types.ts`, `schemas.ts`, `utils.ts`, or `helpers.ts` files were created.
- `mesh-generation.ts` continues to own existing method id/source id/fallback routing responsibility; the V4 block increases duplication but does not cross into unrelated responsibility.

Dependency policy: pass for Domain C.

- No new Domain C dependency, lockfile drift, binary, Cubism/Core, proprietary parser, or geometry library was introduced.
- `node scripts/check-dependencies.mjs` passed.

Operation payload and previewMesh allowlist: pass.

- `GenerateMeshPayloadSchema` includes `auto-outline-v4-contour-band`.
- `evaluatePreviewMeshPreconditions` allows previewMesh commits for V4 while still rejecting `manual-empty`.
- Provenance records include `generateMesh:auto-outline-v4-contour-band`, `meshSource:outline-v4-contour-band-rgba`, fallback steps, and contour-band quality metrics.

Machine-readable ids: pass.

- Method id `auto-outline-v4-contour-band`, source id `outline-v4-contour-band-rgba`, triangulation id `interim-delaunay-contour-band-strip`, fallback reason ids, and metrics transform-history keys contain no spaces.

## Verification

Commands run:

- `node scripts/check-source-organization.mjs` -> passed.
- `node scripts/check-dependencies.mjs` -> passed.
- `git diff --check -- packages/authoring-core packages/operation-core packages/package-format apps/editor` -> passed; only LF/CRLF warnings were printed.
- `pnpm.cmd exec vitest run packages/authoring-core/src/mesh-generation.test.ts packages/operation-core/src/operations/generate-mesh.test.ts`
  - First sandbox attempt failed with `spawn EPERM` while Vitest/esbuild loaded config.
  - Approved outside-sandbox rerun passed: 2 test files, 48 tests.

## Residual Risks

- This review did not perform human visual inspection of V4 mesh shape quality. The design/development boundary is clean; visual quality remains a product/algorithm validation risk for later comparison.
- Because Domain A/B changes are present in the same worktree, final integration must confirm combined dependency and package boundaries across the full wave.
- The V4 module is cohesive but large. If V4 evolves further or V5 reuses the same primitives, extracting contour/triangulation helper modules may become the safer organization boundary.

## Verdict

pass. No design/development compliance changes are required for Wave67 Domain C.
