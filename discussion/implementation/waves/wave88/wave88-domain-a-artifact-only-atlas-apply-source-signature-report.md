# Wave88 Domain A Report: Artifact-only Atlas Apply / Source Signature

## Verdict / Status

done

Wave88 Domain A changed Texture Atlas Apply from destructive authoring texture/UV rewrite to artifact-only project commit. Apply now commits the generated atlas texture entry, generated atlas binary bytes/ref, layout summary, and deterministic source signature while preserving authoring `Drawable.textureId`, `Mesh.uvs`, and `Mesh.topologyRevision`.

## Basis Coverage Self-Report

Read and applied:

- `discussion/implementation/orchestration/wave88-plan.md`
- `discussion/implementation/orchestration/wave87-plan.md`
- `discussion/design/screen-design/screens/texture-atlas-task.md`
- `discussion/design/screen-design/screens/viewer-runtime-view.md`
- `discussion/implementation/waves/wave87/wave87-final-integration-report.md`
- `discussion/implementation/reviews/wave87/wave87-final-clean-integration-review.md`
- `discussion/implementation/waves/wave87/wave87-domain-a-atlas-core-schema-apply-mutation-report.md`
- `discussion/implementation/waves/wave87/wave87-domain-b-fix-loop-1-operation-backed-apply-image-preview-report.md`
- `discussion/development_convention/ux-backed-package-logic-authority.md`
- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/development_convention/dependency-policy.md`
- `discussion/development_convention/operation-policy.md`
- `discussion/development_convention/schema-and-id-conventions.md`

Deferred basis items:

- Viewer UI/render mode and design doc updates are Domain B/C scope and were not edited.
- Workspace Directory Export remains out of scope.

## Current-State Confirmation

- Confirmed `packages/authoring-core/src/texture-atlas-mutations.ts` previously registered atlas artifact pieces, then rewrote `Drawable.textureId`, `Mesh.uvs`, and `Mesh.topologyRevision`.
- Confirmed `packages/authoring-core/src/texture-atlas-targets.ts` previously blocked preview when `textureAtlas.layoutSummary` existed via `atlas.target.alreadyAtlasApplied`.
- Confirmed `packages/package-format/src/texture-atlas.ts` had no source signature/freshness marker.
- Confirmed `packages/operation-core/src/operations/apply-texture-atlas-preview.ts` previously emitted model diff fields for drawable texture and mesh UV/topology rewrites.
- Existing package/portable bundle paths already persisted `textureAtlas.textures`, `textureAtlas.layoutSummary`, and atlas binary refs.
- Pre-existing dirty work was left untouched: `discussion/implementation/orchestration/_map.md` modified and `discussion/implementation/orchestration/wave88-plan.md` untracked.

## Artifact-only Apply Trace

- `applyTextureAtlasPreview()` still generates raw RGBA atlas bytes, creates a package-local binary asset ref, upserts the generated atlas texture entry, writes `textureAtlas.layoutSummary`, registers provenance/rights records, registers generated binary bytes, increments authoring revision, and marks the session dirty.
- Removed the destructive authoring loop that assigned `drawable.textureId = preview.atlasTextureId`, rewrote `mesh.uvs`, and incremented `mesh.topologyRevision`.
- Kept legacy result arrays `drawableChanges` and `meshUvChanges` for compatibility, but artifact-only Apply returns them empty.
- Tests now assert all original drawable texture ids, mesh UVs, vertices, triangles, and topology revisions are preserved after Apply.

## Source Signature / Stale Policy Trace

- Added `TextureAtlasSourceSignatureSchema` to `packages/package-format/src/texture-atlas.ts`.
- Added `packages/authoring-core/src/texture-atlas-source-signature.ts`.
- New previews write `layoutSummary.sourceSignature`.
- Signature inputs include:
  - bound Drawable membership;
  - packable placement order and drawable/mesh/original texture ids;
  - mesh topology revision, vertices, triangles, UVs, stable ids, and bounds;
  - source texture entry metadata, binary ref digest/identity, dimensions, byte length, and loaded bytes fingerprint;
  - atlas layout settings, page size, padding, and edge extrusion.
- Signature inputs exclude deformer transform values, keyforms, dynamics groups, current parameter values, package revision, authoring revision, and editor hidden Part state.
- Direct authoring-core Apply rejects stale previews when the current source signature differs from the preview layout signature.

## Operation Contract / Diff Trace

- Operation Core still owns user-facing Apply through async `applyTextureAtlasPreview`.
- Operation handler still recreates the preview from current session/settings, rejects failed previews, rejects layout mismatch, applies via authoring-core, increments package revision, and logs the operation.
- Operation model diff now reports only artifact changes:
  - `/assets/textureAtlas/textures/tex_generated_atlas_page_0`
  - `/assets/textureAtlas/layoutSummary`
  - `/binaryAssets/assets/textures/generated_atlas_page_0.raw-rgba`
- Operation diff no longer reports `/model/drawables/*/textureId`, `/model/meshes/*/uvs`, or `/model/meshes/*/topologyRevision` changes.
- Layout mismatch evidence now includes source signature digest.

## Save/Load / Portable Bundle Trace

- No broad package/portable bundle rewrite was required.
- `TextureAtlasLayoutSummarySchema` now accepts source signature metadata.
- Existing package document and portable bundle paths preserve `textureAtlas.textures`, generated binary refs, layout summary, and source signature.
- Focused tests cover package schema parsing and authoring portable bundle export/import preserving generated atlas binary bytes and layout summary source signature.

## Regenerate / Replace Trace

- Removed the `textureAtlas.layoutSummary` target-selection blocker.
- Existing atlas artifacts no longer prevent preview generation.
- Re-applying a new ready preview upserts/replaces the generated atlas texture entry and layout summary deterministically from preserved original authoring texture/UV state.
- Authoring-core and Operation Core tests both cover replacing an existing atlas artifact.

## Must-not Compliance Evidence

- Apply does not change authoring `Drawable.textureId`.
- Apply does not change authoring `Mesh.uvs`.
- Apply does not increment `Mesh.topologyRevision`.
- Source textures remain retained.
- No Workspace Directory Export, ZIP/archive export, File System Access API, manual atlas editing, multi-page atlas, camera capture, mesh generation, deformer/keyform/dynamics behavior, Viewer UI/render mode, Cubism compatibility, or dependency work was added.
- No `apps/editor/**` files were changed.

## Changed Files

- `packages/package-format/src/texture-atlas.ts`
- `packages/package-format/src/package-document.test.ts`
- `packages/authoring-core/src/index.ts`
- `packages/authoring-core/src/texture-atlas-source-signature.ts`
- `packages/authoring-core/src/texture-atlas-packing.ts`
- `packages/authoring-core/src/texture-atlas-targets.ts`
- `packages/authoring-core/src/texture-atlas-mutations.ts`
- `packages/authoring-core/src/texture-atlas-mutations.test.ts`
- `packages/operation-core/src/operations/apply-texture-atlas-preview.ts`
- `packages/operation-core/src/operations/apply-texture-atlas-preview.test.ts`
- `discussion/implementation/waves/wave88/wave88-domain-a-artifact-only-atlas-apply-source-signature-report.md`

## Validation Commands and Results

- `pnpm.cmd exec vitest run packages/package-format/src/package-document.test.ts packages/package-format/src/portable-package-bundle.test.ts packages/authoring-core/src/portable-project-bundle.test.ts packages/authoring-core/src/texture-atlas-mutations.test.ts packages/operation-core/src/operations/apply-texture-atlas-preview.test.ts`
  - sandbox attempt failed with known Vitest/esbuild `spawn EPERM`;
  - escalated rerun passed: 5 files, 33 tests.
- `pnpm.cmd typecheck`: passed.
- `node scripts/check-source-organization.mjs`: passed.
- `node scripts/check-dependencies.mjs`: passed.
- `git diff --check`: passed with CRLF working-copy warnings only.

## Residual Risks

- `sourceSignature` is optional in schema for compatibility with Wave87 layout artifacts; new Wave88 previews/apply write it. Domain B should treat missing signature as missing/stale for Viewer Atlas Runtime.
- Atlas Task local stale signature in `apps/editor/src/workspace/atlas/atlas-task-projection.ts` still uses broad `authoringRevision` / `packageRevision`. Apps were intentionally not changed in Domain A; Domain B/C should align UI stale behavior with source signature if needed.
- The signature uses deterministic FNV-1a over normalized JSON and source bytes fingerprint. It is a freshness marker, not a cryptographic security primitive.

## User-Decision Points

- Decide later whether old persisted atlas layout summaries without `sourceSignature` need a migration, or whether Viewer/Task should simply treat them as stale and require regeneration.
- Decide later whether UI-level preview stale detection should switch from broad revision checks to the new source signature helper.
