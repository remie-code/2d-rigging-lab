# Wave88 Domain A Spec Compliance Review

## Verdict

`pass`

Review lane: Spec Compliance Review
Target: `wave88-artifact-only-atlas-apply-source-signature`

No blocking spec-compliance findings were found for Domain A.

## Basis Read

- `discussion/implementation/orchestration/wave88-plan.md`
- `discussion/implementation/orchestration/wave87-plan.md`
- `discussion/design/screen-design/screens/texture-atlas-task.md`
- `discussion/design/screen-design/screens/viewer-runtime-view.md`
- `discussion/implementation/waves/wave88/wave88-domain-a-artifact-only-atlas-apply-source-signature-report.md`
- Changed package / authoring / operation source and tests listed in the review assignment.
- Additional persistence path checks in `packages/package-format/src/package-file-set.ts`, `packages/package-format/src/portable-package-bundle.ts`, `packages/authoring-core/src/package-document-from-authoring-session.ts`, and `packages/authoring-core/src/portable-project-bundle.ts`.

## Blocking Findings

None.

## Compliance Findings

### Artifact-only Apply

Pass.

Repository facts:

- `applyTextureAtlasPreview()` now upserts the generated texture entry, writes `textureAtlas.layoutSummary`, registers generated atlas binary bytes, and marks revision/dirty state without rewriting authoring drawables or meshes: `packages/authoring-core/src/texture-atlas-mutations.ts:153`, `packages/authoring-core/src/texture-atlas-mutations.ts:154`, `packages/authoring-core/src/texture-atlas-mutations.ts:165`, `packages/authoring-core/src/texture-atlas-mutations.ts:173`, `packages/authoring-core/src/texture-atlas-mutations.ts:174`, `packages/authoring-core/src/texture-atlas-mutations.ts:176`.
- Search for atlas-specific destructive rewrites found no remaining `drawable.textureId = preview.atlasTextureId`, atlas-local `mesh.uvs = ...`, `rewriteUvIntoAtlas`, or atlas-local `getNextTopologyRevision` use. Remaining `mesh.uvs` / `topologyRevision` writes are in unrelated mesh topology mutation modules.
- Tests assert authoring `drawables` and `meshes` remain equal to their pre-apply snapshots, including texture refs, UVs, vertices, triangles, and topology revisions: `packages/authoring-core/src/texture-atlas-mutations.test.ts:282`, `packages/authoring-core/src/texture-atlas-mutations.test.ts:320`, `packages/authoring-core/src/texture-atlas-mutations.test.ts:321`; operation-level equivalent at `packages/operation-core/src/operations/apply-texture-atlas-preview.test.ts:137`, `packages/operation-core/src/operations/apply-texture-atlas-preview.test.ts:140`, `packages/operation-core/src/operations/apply-texture-atlas-preview.test.ts:141`.

### Runtime Atlas Artifact Commit

Pass.

Repository facts:

- Schema now models `TextureAtlasSourceSignatureSchema` and `layoutSummary.sourceSignature`: `packages/package-format/src/texture-atlas.ts:143`, `packages/package-format/src/texture-atlas.ts:161`.
- Preview packing writes `sourceSignature` into the layout summary and records original texture provenance / placement UV rects: `packages/authoring-core/src/texture-atlas-packing.ts:99`, `packages/authoring-core/src/texture-atlas-packing.ts:214`, `packages/authoring-core/src/texture-atlas-packing.ts:228`, `packages/authoring-core/src/texture-atlas-packing.ts:251`.
- Apply commits the generated texture entry and binary asset ref/bytes through `TextureAtlasEntryDto` plus `registerAuthoringSessionBinaryBytes`: `packages/authoring-core/src/texture-atlas-mutations.ts:135`, `packages/authoring-core/src/texture-atlas-mutations.ts:153`, `packages/authoring-core/src/texture-atlas-mutations.ts:165`.
- Tests assert generated atlas texture id/path/dimensions, binary file entry, layout placements, and `sourceSignature`: `packages/authoring-core/src/texture-atlas-mutations.test.ts:302`, `packages/authoring-core/src/texture-atlas-mutations.test.ts:325`, `packages/authoring-core/src/texture-atlas-mutations.test.ts:327`, `packages/authoring-core/src/texture-atlas-mutations.test.ts:328`.

### Source Signature / Freshness Marker

Pass.

Repository facts:

- Source signature payload includes layout settings, sorted bound drawable membership, packable target order, drawable/mesh/original texture ids, mesh topology/bounds/vertices/UVs/triangles/stable ids, texture entry metadata, dimensions, binary ref, byte length, and source byte fingerprint: `packages/authoring-core/src/texture-atlas-source-signature.ts:20`, `packages/authoring-core/src/texture-atlas-source-signature.ts:28`, `packages/authoring-core/src/texture-atlas-source-signature.ts:30`, `packages/authoring-core/src/texture-atlas-source-signature.ts:53`, `packages/authoring-core/src/texture-atlas-source-signature.ts:64`, `packages/authoring-core/src/texture-atlas-source-signature.ts:108`.
- Direct authoring apply rejects stale previews by recomputing and comparing the source signature: `packages/authoring-core/src/texture-atlas-mutations.ts:208`, `packages/authoring-core/src/texture-atlas-mutations.ts:215`, `packages/authoring-core/src/texture-atlas-mutations.ts:220`, `packages/authoring-core/src/texture-atlas-mutations.ts:379`.
- Operation apply recreates the preview and rejects layout/source-signature mismatch before mutation: `packages/operation-core/src/operations/apply-texture-atlas-preview.ts:129`, `packages/operation-core/src/operations/apply-texture-atlas-preview.ts:390`.
- Tests prove the digest changes for UV, topology, source texture bytes, membership, and settings changes, and does not change for rig-control rest-angle, keyform, and dynamics-only changes: `packages/authoring-core/src/texture-atlas-mutations.test.ts:185`, `packages/authoring-core/src/texture-atlas-mutations.test.ts:191`, `packages/authoring-core/src/texture-atlas-mutations.test.ts:201`, `packages/authoring-core/src/texture-atlas-mutations.test.ts:205`, `packages/authoring-core/src/texture-atlas-mutations.test.ts:218`, `packages/authoring-core/src/texture-atlas-mutations.test.ts:279`.

### Regenerate / Replace

Pass.

Repository facts:

- The former `atlas.target.alreadyAtlasApplied` warning remains only in the union type for compatibility; no `textureAtlas.layoutSummary` blocker remains in `selectTextureAtlasTargets()`: `packages/authoring-core/src/texture-atlas-targets.ts:18`, `packages/authoring-core/src/texture-atlas-targets.ts:93`.
- Apply uses upsert semantics for the generated atlas texture entry: `packages/authoring-core/src/texture-atlas-mutations.ts:260`.
- Authoring-core and operation-core tests prove reapply/replacement from preserved source state without authoring texture or UV rewrites: `packages/authoring-core/src/texture-atlas-mutations.test.ts:372`, `packages/operation-core/src/operations/apply-texture-atlas-preview.test.ts:179`, `packages/operation-core/src/operations/apply-texture-atlas-preview.test.ts:212`, `packages/operation-core/src/operations/apply-texture-atlas-preview.test.ts:214`.

### Operation Diff / Evidence

Pass.

Repository facts:

- Operation diff fields are limited to generated atlas texture entry, `layoutSummary`, and generated binary asset path: `packages/operation-core/src/operations/apply-texture-atlas-preview.ts:256`, `packages/operation-core/src/operations/apply-texture-atlas-preview.ts:263`, `packages/operation-core/src/operations/apply-texture-atlas-preview.ts:273`.
- The model diff construction does not add drawable or mesh targets for changed authoring fields: `packages/operation-core/src/operations/apply-texture-atlas-preview.ts:283`.
- Tests assert the exact changed paths and preserve drawables/meshes: `packages/operation-core/src/operations/apply-texture-atlas-preview.test.ts:143`, `packages/operation-core/src/operations/apply-texture-atlas-preview.test.ts:146`, `packages/operation-core/src/operations/apply-texture-atlas-preview.test.ts:140`, `packages/operation-core/src/operations/apply-texture-atlas-preview.test.ts:141`.

### Save / Load / Portable Bundle

Pass.

Repository facts:

- Package file set still serializes `assets.textureAtlas` into `texture-atlas.json`, and package parsing restores it.
- Portable bundle collection includes `packageDocument.assets.textureAtlas.textures[*].binaryAssetRef`, so generated atlas bytes are part of the existing portable bundle path.
- Tests cover package schema parsing with generated atlas entry + source signature: `packages/package-format/src/package-document.test.ts:262`, `packages/package-format/src/package-document.test.ts:287`, `packages/package-format/src/package-document.test.ts:356`.
- Authoring-core atlas tests cover export/import preserving layout summary, source signature, texture entry, and generated raw RGBA bytes: `packages/authoring-core/src/texture-atlas-mutations.test.ts:337`, `packages/authoring-core/src/texture-atlas-mutations.test.ts:359`, `packages/authoring-core/src/texture-atlas-mutations.test.ts:362`, `packages/authoring-core/src/texture-atlas-mutations.test.ts:367`.
- Existing portable project bundle tests also assert `textureAtlas` and binary file entries round-trip: `packages/authoring-core/src/portable-project-bundle.test.ts:249`, `packages/authoring-core/src/portable-project-bundle.test.ts:250`.

### Workspace Directory Export Boundary

Pass.

Repository facts:

- Changed source does not add Workspace Directory Export, File System Access API, ZIP/archive export, or image export behavior.
- Domain A report explicitly states Workspace Directory Export remains out of scope and no export feature was added: `discussion/implementation/waves/wave88/wave88-domain-a-artifact-only-atlas-apply-source-signature-report.md:30`, `discussion/implementation/waves/wave88/wave88-domain-a-artifact-only-atlas-apply-source-signature-report.md:93`.

## Documentation Check

Non-blocking residual for Domain A:

- `discussion/design/screen-design/screens/texture-atlas-task.md` still contains Wave87-era wording that says Apply commits atlas asset / UV references and updates Drawable texture reference / UVs: `discussion/design/screen-design/screens/texture-atlas-task.md:96`, `discussion/design/screen-design/screens/texture-atlas-task.md:230`, `discussion/design/screen-design/screens/texture-atlas-task.md:231`.
- I am treating this as non-blocking for this Domain A review because Wave88 plan assigns design-document updates to Wave88 overall / Domain C, while Domain A's delegated changed files and required evidence focus on package/authoring/operation semantics.
- If the parent gate expects Domain A itself to update design docs before passing, reclassify this item to `needs_changes`.

## Verification Performed

- Static source review of the changed package-format, authoring-core, and operation-core files.
- Static test review of changed package-format, authoring-core, and operation-core tests.
- Searched changed source/report for destructive atlas apply remnants and workspace export claims.
- Ran focused validation:
  - Sandbox attempt failed with Vitest/esbuild `spawn EPERM`.
  - Escalated rerun passed:
    - `pnpm.cmd exec vitest run packages/package-format/src/package-document.test.ts packages/package-format/src/portable-package-bundle.test.ts packages/authoring-core/src/portable-project-bundle.test.ts packages/authoring-core/src/texture-atlas-mutations.test.ts packages/operation-core/src/operations/apply-texture-atlas-preview.test.ts`
    - Result: 5 test files passed, 33 tests passed.

## Residual Risks / Uncertainties

- `layoutSummary.sourceSignature` is optional in package schema for compatibility. New Wave88 previews/apply write it, and stale/missing preview signatures are rejected, but old Wave87 artifacts without a signature still need Domain B/C policy: treat as stale or migrate.
- Atlas Task UI stale detection reportedly still uses broad revision markers outside Domain A. This does not affect Domain A artifact-only commit, but Domain B/C should align Viewer/Task freshness with the new signature helper.
- Direct Canvas projection tests were not part of Domain A source changes. For Domain A, Canvas preservation is supported by preserving authoring `Drawable.textureId` and `Mesh.uvs`; Viewer/Canvas projection proof remains Domain B/C evidence.

## Parent-Session Decision Points

- Decide later whether old layout summaries without `sourceSignature` require migration or deterministic regeneration.
- Decide whether Domain C should update the stale Texture Atlas Task design wording before Wave88 final integration can pass.
