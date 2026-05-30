# Wave19 Domain E Completion: Texture Provenance Validator Evidence

## Verdict

`pass`

Domain E の source implementation は Gnome 別コンテキストへ委譲し、Review-Sylph 別コンテキストの clean review で一度 `escalate` を受けた。原因は validator 本体ではなく、旧 metadata-only operation evidence test が新しい `ref.texturePreviewMissing` diagnostic を期待していなかったことだったため、許可済みの focused evidence regression test だけを Gnome fix loop で更新した。Follow-up Review-Sylph review は `pass`。

## Scope

- Domain: `wave19-texture-provenance-validator-evidence`
- Implementation agent: `019e793b-4a58-78d0-b25d-bd49d515c425` (`Gnome the 44th`)
- Review agent: `019e7947-3b90-7b41-b2b9-3300c76ca5e2` (`Sylph the 45th`)
- Review artifact: `discussion/implementation/reviews/wave19/wave19-texture-provenance-validator-evidence-review.md`
- Review verdict: `pass`
- Date: 2026-05-30
- Orch-Sylph source implementation: none. Orch-Sylph only coordinated, verified, and wrote discussion artifacts.

## Changed Files

Validator core:

- `packages/validator-core/src/check-catalog.ts`
- `packages/validator-core/src/index.ts`
- `packages/validator-core/src/source-asset-rights-provenance.test.ts`
- `packages/validator-core/src/validators/package-runtime.ts`
- `packages/validator-core/src/validators/texture-assets.ts`

Fixtures / evidence:

- `fixtures/contracts/source-asset-rights-provenance-validator/source-package.cleared.json`
- `fixtures/contracts/source-asset-rights-provenance-validator/expected/source-validation-oracle-summary.json`
- `packages/operation-core/src/imported-source-package-evidence-preview-consistency.test.ts`

Reports:

- `discussion/implementation/reviews/wave19/wave19-texture-provenance-validator-evidence-review.md`
- `discussion/implementation/waves/wave19/wave19-texture-provenance-validator-evidence-completion.md`

## Implementation Summary

- Added texture asset reference validation for texture atlas entries and preview assets.
- Added check catalog entries for:
  - `ref.texturePreviewMissing`
  - `ref.textureSourceLayerMismatch`
  - `rights.textureProvenanceMissing`
  - `rights.textureProvenanceMismatch`
- Wired texture asset validation into `validatePackageRuntime` after existing source/drawable rights and reference checks.
- Extended the compact source rights/provenance fixture with a texture-backed source package that includes texture atlas entry, preview asset, texture provenance, and texture rights records.
- Added validator oracle cases for:
  - valid texture-backed source package pass,
  - visible drawable with missing preview payload,
  - missing atlas / missing texture reference via existing `ref.drawableTextureMissing`,
  - texture/source-layer mismatch,
  - texture rights/provenance mismatch.
- Updated the operation evidence regression so the Wave18 metadata-only imported-source fixture explicitly observes `ref.texturePreviewMissing` instead of silently expecting `checks=[]`.
- `index.ts` remains barrel-only: `export * from "./validators/texture-assets.js";`.

No editor UI, runtime renderer, operation handler redesign, binary image IO, PNG decode, atlas packing, or implementation logic in `index.ts` was added by Domain E.

## Review / Fix Loop

Initial Review-Sylph verdict was `escalate`.

High finding:

- `packages/operation-core/src/imported-source-package-evidence-preview-consistency.test.ts` expected the old metadata-only fixture to produce no validation checks, but the new Domain E validator correctly returned `ref.texturePreviewMissing`.

Fix applied by Gnome:

- Changed only `packages/operation-core/src/imported-source-package-evidence-preview-consistency.test.ts`.
- Replaced the stale `finalValidationReport.checks === []` expectation with an assertion for one structured `ref.texturePreviewMissing` diagnostic.
- Updated the test-local expected summary wrapper to expect `validation.status = "fail"` and `checkIds = ["ref.texturePreviewMissing"]`.

Follow-up Review-Sylph verdict: `pass`.

## Verification

| Command | Result | Notes |
|---|---|---|
| `pnpm.cmd exec vitest run packages/validator-core/src/source-asset-rights-provenance.test.ts packages/operation-core/src/imported-source-package-evidence-preview-consistency.test.ts` | pass | Final local rerun: 2 files / 15 tests. Sandbox run required escalation because Vitest reads from `node_modules` hit `EPERM`. |
| `pnpm.cmd exec vitest run packages/package-format/src/package-document.test.ts packages/package-format/src/package-file-set.test.ts packages/package-format/src/source-asset-rights-fixture.test.ts` | pass | Final local rerun: 3 files / 16 tests. |
| `pnpm.cmd typecheck` | pass | Sandbox run hit `EPERM` reading TypeScript from `node_modules`; escalated rerun passed root and editor typecheck. |
| `pnpm.cmd run check:source` | pass | Source organization guard passed. |
| `git diff --check -- packages/validator-core/src fixtures/contracts/source-asset-rights-provenance-validator packages/operation-core/src/imported-source-package-evidence-preview-consistency.test.ts` | pass | CRLF warnings only; no whitespace errors. |

## Pass Evidence

- Valid texture-backed source package validation passes with no checks.
- Visible drawable with a texture atlas entry but missing preview payload emits structured `ref.texturePreviewMissing` evidence.
- Visible drawable with missing texture atlas entry / missing atlas remains covered by existing `ref.drawableTextureMissing`.
- Texture source layer mismatch is observable as `ref.textureSourceLayerMismatch` with drawable, texture, preview layer, expected layer, and reason evidence.
- Texture rights/provenance mismatch is observable as `rights.textureProvenanceMismatch` with texture, preview asset, provenance asset, rights asset, expected assets, and reason evidence.
- Wave18 metadata-only operation evidence is not contradicted: it now explicitly records missing preview payload as `ref.texturePreviewMissing` rather than treating metadata-only texture evidence as a full pass.
- Review-Sylph confirmed the final Domain E diff satisfies validator/evidence pass criteria.

## Shared Worktree Notes

The shared workspace contains additional operation-core changes outside Domain E, including import handler/payload files and related operation tests. They were not attributed to Domain E and were not reverted.

## Remaining Risks

- `rights.textureProvenanceMissing` is catalog-registered and implemented, but the compact fixture primarily exercises `rights.textureProvenanceMismatch`. This is non-blocking for Domain E because the required pass evidence focuses on provenance/rights mismatch; a later validator hardening pass can add an explicit missing-provenance branch fixture.
- The old metadata-only operation evidence fixture now fails validation by design. Later Domain D/F/G integration may choose to materialize preview assets so the full import workflow returns to validation pass.

## User Decision Points

None for Domain E.
