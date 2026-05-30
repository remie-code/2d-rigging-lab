# Wave18 Domain B Completion: Asset Rights / Provenance Validator Evidence

## Verdict

`pass`

Domain B の validator / package-format 実装と Review-Sylph 修正ループ1は完了した。cleared / needs_review / blocked / missing provenance / missing texture / missing drawable provenance の compact oracle を focused tests で確認済み。

Review-Sylph findings 1-3 はすべて対応済み。

## Changed Files

Package format:

- `packages/package-format/src/texture-atlas.ts`
- `packages/package-format/src/package-document.ts`
- `packages/package-format/src/package-file-paths.ts`
- `packages/package-format/src/package-file-set.ts`
- `packages/package-format/src/index.ts`
- `packages/package-format/src/source-asset-rights-fixture.test.ts`

Validator:

- `packages/validator-core/src/check-catalog.ts`
- `packages/validator-core/src/validators/asset-rights.ts`
- `packages/validator-core/src/validators/drawable-provenance.ts`
- `packages/validator-core/src/validators/drawable-references.ts`
- `packages/validator-core/src/validators/package-runtime.ts`
- `packages/validator-core/src/index.ts`
- `packages/validator-core/src/source-asset-rights-provenance.test.ts`

Fixture:

- `fixtures/contracts/source-asset-rights-provenance-validator/fixture-manifest.json`
- `fixtures/contracts/source-asset-rights-provenance-validator/source-package.cleared.json`
- `fixtures/contracts/source-asset-rights-provenance-validator/expected/source-validation-oracle-summary.json`

Report:

- `discussion/implementation/waves/wave18/wave18-asset-rights-provenance-validator-evidence-completion.md`

## Implementation Notes

- Added optional `texture-atlas-v1` DTO to `package-format` so split PNG fixtures can carry concrete texture IDs without breaking older package documents.
- `ref.drawableTextureMissing` now applies to visible drawables by default, including atlas-absent split PNG and PSD source-backed drawables.
- The only texture exception is explicit and tested: `generated-fixture-v1` packages without `assets.textureAtlas` remain valid as legacy text/generated fixtures. If a generated fixture provides a texture atlas, its visible drawable texture IDs are still checked.
- Added drawable-level provenance validation:
  - `rights.drawableProvenanceMissing`: drawable `sourceProvenanceId` has no provenance record.
  - `rights.drawableProvenanceMismatch`: drawable provenance record exists but belongs to a different asset than `drawable.sourceAssetId`.
- Source asset rights/provenance checks remain:
  - `rights.provenanceMissing`: `error` / `fail`
  - `rights.recordMissing`: `error` / `fail`
  - `rights.statusNeedsReview`: `warning` / `needs_review`
  - `rights.statusBlocked`: `blocking` / `fail`
- `needs_review` rights status intentionally does not become `fail`; it produces summary status `needs_review`, making the review decision observable without blocking schema/reference readability.
- Diagnostics include practical `target`, `targetPath`, `evidence`, `impact`, `relatedAC`, and `relatedScenarios` fields for AI-readable tracing.

## Review-Sylph Findings Addressed

1. High visible missing-texture oracle too narrow: fixed. Tests now cover missing texture with an atlas entry removed, missing atlas for split PNG, missing atlas for PSD source-backed drawable, and the explicit generated-fixture no-atlas exception.
2. High drawable `sourceProvenanceId` not validated: fixed. Validator now checks missing and mismatched drawable provenance IDs; tests cover a broken `sourceProvenanceId`.
3. Medium stale completion report: fixed by this report update.

## Verification Results

Pass:

- `pnpm.cmd exec vitest run packages/validator-core/src/source-asset-rights-provenance.test.ts packages/validator-core/src/validator-core.test.ts packages/validator-core/src/minimal-contract-fixture.test.ts packages/package-format/src/source-asset-rights-fixture.test.ts packages/package-format/src/package-file-set.test.ts packages/package-format/src/minimal-contract-fixture.test.ts`
  - 6 files / 25 tests passed after sandbox EPERM was avoided by escalated run.
- `pnpm.cmd typecheck`
  - pass after sandbox EPERM was avoided by escalated run.
- `pnpm.cmd run check:source`
  - Source organization guard passed.
- `git diff --check -- packages/validator-core/src packages/package-format/src fixtures/contracts discussion/implementation/waves/wave18/wave18-asset-rights-provenance-validator-evidence-completion.md`
  - pass with CRLF normalization warnings only.

## Remaining Risks

- `texture-atlas-v1` is optional to preserve existing package documents and generated fixtures. Future persistence/import domains should decide when authored packages must always materialize `assets/textures/texture-atlas.json`.
- `toPackageDocument` in `authoring-core` does not preserve optional `textureAtlas` yet. Domain B did not edit it because `packages/authoring-core/**` is forbidden for this task.
- Texture asset rights/provenance are represented in the fixture, but Domain B validates source asset rights/provenance, drawable provenance, and drawable texture reference existence only.

## User-Decision Points

None for Domain B.
