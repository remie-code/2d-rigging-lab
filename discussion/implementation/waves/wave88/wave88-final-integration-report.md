# Wave88 Final Integration Report

## Verdict / Status

pass

Wave88 Domain C integrated the completed Domain A and Domain B work, updated the screen-design documents away from Wave87 destructive Apply semantics, and reran the focused Wave88 validation set.

Final clean integration review exists and passes:

- [../../reviews/wave88/wave88-final-clean-integration-review.md](../../reviews/wave88/wave88-final-clean-integration-review.md), verdict `pass`.

## Upstream Gate Confirmation

- Domain A report exists: [wave88-domain-a-artifact-only-atlas-apply-source-signature-report.md](wave88-domain-a-artifact-only-atlas-apply-source-signature-report.md), status `done`.
- Domain A review lanes exist and pass:
  - [../../reviews/wave88/wave88-domain-a-spec-compliance-review.md](../../reviews/wave88/wave88-domain-a-spec-compliance-review.md)
  - [../../reviews/wave88/wave88-domain-a-design-development-review.md](../../reviews/wave88/wave88-domain-a-design-development-review.md)
  - [../../reviews/wave88/wave88-domain-a-test-adequacy-review.md](../../reviews/wave88/wave88-domain-a-test-adequacy-review.md)
- Domain B report exists: [wave88-domain-b-viewer-original-atlas-runtime-mode-report.md](wave88-domain-b-viewer-original-atlas-runtime-mode-report.md), status `done`.
- Domain B review lanes exist and pass:
  - [../../reviews/wave88/wave88-domain-b-spec-compliance-review.md](../../reviews/wave88/wave88-domain-b-spec-compliance-review.md)
  - [../../reviews/wave88/wave88-domain-b-design-development-review.md](../../reviews/wave88/wave88-domain-b-design-development-review.md)
  - [../../reviews/wave88/wave88-domain-b-test-adequacy-review.md](../../reviews/wave88/wave88-domain-b-test-adequacy-review.md)

## Artifact-only Apply Semantics

Accepted Wave88 behavior is now implemented and documented:

- `Apply Atlas` commits runtime atlas artifact state only.
- Generated atlas texture entry, generated raw RGBA binary bytes/ref, layout summary, placements, and source signature are committed.
- Authoring `Drawable.textureId` is preserved.
- Authoring `Mesh.uvs` is preserved.
- `Mesh.topologyRevision` is preserved for atlas Apply.
- Source textures remain available.
- Existing atlas artifacts can be regenerated/replaced from original authoring source.

The Texture Atlas screen spec now states these semantics explicitly and no longer describes `Apply Atlas` as a desired authoring texture/UV rewrite.

## Source Signature / Stale Policy

Domain A added a deterministic source signature on `textureAtlas.layoutSummary`.

Recorded source inputs include bound Drawable membership, packable placement inputs, drawable/mesh/original texture ids, mesh topology/UV/bounds inputs, source texture byte identity/dimensions, and layout settings.

Recorded non-source inputs excluded from stale detection include deformer transform values, keyforms, dynamics, current parameter values, editor hidden state, and broad package/authoring revision changes unrelated to atlas source inputs.

Domain B uses the committed source signature for Viewer `Atlas Runtime` availability. Missing signature, stale signature, invalid dimensions, missing bytes, missing placement, or invalid byte length disable `Atlas Runtime` and fall back to `Original`.

## Canvas Original Preservation

Canvas remains the authoring surface and uses original authoring texture refs and mesh UVs.

Evidence:

- Domain A preserves authoring drawables and meshes on Apply.
- Domain B did not change Canvas projection source.
- `apps/editor/src/workspace/viewer/viewer-render-source.test.ts` asserts Canvas projection still uses original texture ids and original mesh UVs after atlas commit.
- `apps/editor/src/workspace/atlas/texture-atlas-task-screen.test.ts` now expects operation-backed Apply to preserve original drawable texture ids and mesh UVs.

## Viewer Original / Atlas Runtime Behavior

Viewer now supports:

- `Original`: existing clean-stage behavior using original texture / original UV.
- `Atlas Runtime`: committed atlas artifact rendering through Viewer-only projection remap.

`Atlas Runtime` remaps temporary Viewer projection texture id, binary id/path, bytes, dimensions, and evaluated UVs using committed placement `uvRect`. It does not mutate `session.graph`, authoring drawable texture refs, authoring mesh UVs, or mesh topology revisions.

Runtime Controls now places the render-source mode control above parameter search. Missing/stale atlas state disables `Atlas Runtime` with a deterministic short reason and falls back to `Original` when needed.

## Save / Load Evidence

Save/load and portable bundle evidence remains covered by Domain A and final validation:

- `packages/package-format/src/package-document.test.ts`
- `packages/package-format/src/portable-package-bundle.test.ts`
- `packages/authoring-core/src/portable-project-bundle.test.ts`
- `packages/authoring-core/src/texture-atlas-mutations.test.ts`

The package document accepts `layoutSummary.sourceSignature`, and portable bundle paths preserve generated atlas binary bytes and layout summary/source signature.

## Documentation Updates

Updated:

- `discussion/design/screen-design/screens/texture-atlas-task.md`
  - `Apply Atlas` commits runtime artifact.
  - authoring texture/UV/topology are preserved.
  - source signature stale policy is documented.
  - Workspace Directory Export is future scope.
- `discussion/design/screen-design/screens/viewer-runtime-view.md`
  - Viewer supports `Original` / `Atlas Runtime`.
  - `Atlas Runtime` uses committed artifact through Viewer-only projection remap.
  - missing/stale atlas disables `Atlas Runtime`.
  - Runtime Controls places render source mode above parameter search.
- `discussion/design/screen-design/_map.md`
- `discussion/design/screen-design/screens/_map.md`

Implementation maps were updated after the final clean review passed.

## Forbidden Scope Compliance

No Domain C source/product implementation was added. Domain A/B reports and reviews record no forbidden scope slip for:

- Workspace Directory Export
- manual atlas editing
- multi-page atlas implementation
- camera capture
- broad refactors
- new dependencies
- Cubism compatibility / public format claims

Domain C changed documentation/maps/reports only.

## Validation Results

- `pnpm.cmd exec vitest run packages/package-format/src/package-document.test.ts packages/package-format/src/portable-package-bundle.test.ts packages/authoring-core/src/portable-project-bundle.test.ts packages/authoring-core/src/texture-atlas-mutations.test.ts packages/operation-core/src/operations/apply-texture-atlas-preview.test.ts apps/editor/src/workspace/viewer/viewer-render-source.test.ts apps/editor/src/workspace/viewer/runtime-controls-state.test.ts apps/editor/src/workspace/viewer/viewer-runtime-screen.test.ts apps/editor/src/workspace/viewer/viewer-clean-stage.test.ts apps/editor/src/workspace/atlas/texture-atlas-task-screen.test.ts`
  - sandbox attempt failed with known Vitest/esbuild `spawn EPERM`;
  - escalated rerun passed: 10 files, 81 tests.
- `pnpm.cmd typecheck`: passed.
- `node scripts/check-source-organization.mjs`: passed.
- `node scripts/check-dependencies.mjs`: passed.
- `git diff --check`: exit 0; CRLF working-copy warnings only.
- Stale design-doc scan for Wave87 destructive Apply wording and old Viewer search-order wording: clear in screen docs after Domain C edits.

## Residual Risks

- No browser pixel screenshot or rendered-pixel equivalence test was added for Viewer `Original` versus `Atlas Runtime`; current evidence is projection/UI-level.
- Old persisted atlas layout summaries without `sourceSignature` are treated as unavailable/stale and require regeneration; no migration was added.
- Viewer `Atlas Runtime` uses a strict missing-placement policy: any renderable projection drawable without committed placement disables the mode rather than mixing original and atlas rendering.
- Source signature recomputation in Viewer projection creation is deterministic but may need caching if projects become large.

## User-Decision Points

- Decide later whether old atlas artifacts without `sourceSignature` should be migrated or always regenerated.
- Decide later whether strict missing-placement disablement should remain the long-term Viewer policy or become a partial fallback policy.
- Decide later whether a future hardening wave should add browser pixel checks for Viewer `Original` versus `Atlas Runtime` parity.
- Decide later when to design Workspace Directory Export / AI-native structured workspace save, explicitly outside Wave88.

## Clean Review Gate

Pass:

- [../../reviews/wave88/wave88-final-clean-integration-review.md](../../reviews/wave88/wave88-final-clean-integration-review.md)
