# Wave46 Domain C Review: Package / Operation Texture Intake And Part Mapping Bridge

> Target: `wave46-package-operation-texture-intake-part-mapping-bridge`
> Date: 2026-06-05
> Review mode: separate clean-context Review-Sylph review
> Final verdict: `pass`

## Scope Reviewed

Review-Sylph reviewed the Domain C package/operation files, including the new untracked materialization operation, evidence, and test files:

- `packages/package-format/src/binary-asset.ts`
- `packages/package-format/src/psd-source-evidence.ts`
- `packages/package-format/src/source-manifest.test.ts`
- `packages/operation-core/src/payloads/import-source.ts`
- `packages/operation-core/src/psd-import-operation-evidence.ts`
- `packages/operation-core/src/psd-layer-materialization-operation-evidence.ts`
- `packages/operation-core/src/operations/import-psd-layer-materialization.ts`
- `packages/operation-core/src/operations/import-psd-layer-materialization.test.ts`
- operation plumbing files under `packages/operation-core/src/**`

Review basis included the Wave46 plan, Domain A report/review, Wave45 Domain C report/review, source organization policy, and schema/id policy. Domain B `apps/editor/src/**` changes were treated as out of scope except for checking that they did not create a direct Domain C package contract collision.

## Review History

Initial Review-Sylph verdict: `needs_fix`

- Non-selected-layer extraction and canonical extraction option mismatches could be accepted.
- Source PSD digest mismatch could pass when the source asset had `contentHash=sha256:<hex>` but no source binary ref.

Re-review after fix loop 1 verdict: `needs_fix`

- `sourceLayerPath` mismatch could still be accepted when only the final layer name matched.

Final re-review after fix loop 2 verdict: `pass`

- No blocking findings remained.

## Final Findings

No blocking findings.

Prior finding 1 is fixed:

- `import-psd-layer-materialization.ts` rejects non-`selectedLayerRasterV1`.
- It rejects canonical option mismatches, including wrong `layerSelection`, effects, hidden layers, composition, and channel order.
- Covered by `import-psd-layer-materialization.test.ts`.

Prior finding 2 is fixed:

- Source digest compares against source binary ref or fallback `contentHash=sha256:<hex>` when there is no source binary ref.
- Covered by `import-psd-layer-materialization.test.ts`.

Prior finding 3 is fixed:

- `sourceLayerPath` accepts only exact expected tail or a prefixed path ending in the full expected tail.
- It no longer accepts the same final layer name under a wrong group path.
- Covered by `import-psd-layer-materialization.test.ts`.

## Test Adequacy

Review-Sylph judged the test coverage adequate for Domain C:

- Success paths cover existing-part and new-part intake.
- Success paths cover texture, drawable, mesh, provenance, evidence wiring, and operation log evidence.
- Negative paths cover stale/missing materialized bytes, source PSD digest mismatch, extraction mismatch, and wrong group path.
- Package-format compatibility covers Wave46 raw RGBA materialization evidence serialization.

## Verification Performed By Review-Sylph

- `pnpm.cmd exec vitest run ...`: 4 files, 22 tests passed.
- `pnpm.cmd typecheck`: passed.
- `pnpm.cmd run check:source`: passed.
- fixed-string parser import scan under `packages/**`: no direct `@webtoon/psd` or `ag-psd` imports/requires found.
- Broad parser scan hits were evidence/test strings only.
- `git diff --check -- packages/package-format/src packages/operation-core/src`: passed with LF/CRLF warnings only.
- no-index whitespace checks for new untracked Domain C files: no whitespace findings.

## Remaining Issues / User-Decision Points

None for Domain C.

## Review Separation

Review-Sylph was separate from Gnome and read-only. The reviewer inspected source, diffs, tests, and basis docs directly, and did not edit files.
