# Wave44 Domain E Review: PSD Validator Provenance / Security Diagnostics

> Target: `wave44-psd-validator-provenance-security-diagnostics`
> Reviewer: Review-Sylph independent reviewer
> Review loop: 1 of max 2 needs_fix loops

## Verdict

`pass`

Loop 1 resolves the previous F1 finding. Materialization digests are now emitted as stable `algorithm:hex` evidence, and focused tests assert both derived raster digest and source PSD digest strings. No new blocking findings were found in the original Domain E review scope.

## Findings

### F1 - Materialization digest evidence is lost as `[object Object]`

Severity: `resolved`

Loop 0 found that `materialization.digest` and `materialization.provenance.sourceDigest` were template-stringified directly, which would have produced `[object Object]`.

Loop 1 inspection confirms the fix:

- `packages/validator-core/src/validators/psd-source-evidence-diagnostics.ts:440` now emits `digest=${formatDigest(materialization.digest)}`.
- `packages/validator-core/src/validators/psd-source-evidence-diagnostics.ts:447` now emits `sourceDigest=${formatDigest(materialization.provenance.sourceDigest)}`.
- `packages/validator-core/src/validators/psd-source-evidence-diagnostics.ts:634` through `packages/validator-core/src/validators/psd-source-evidence-diagnostics.ts:635` define `formatDigest` as `missing` for absent values and `${digest.algorithm}:${digest.hex}` for present digest DTOs.
- `packages/validator-core/src/psd-source-profile.test.ts:179` asserts `digest=sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa`.
- `packages/validator-core/src/psd-source-profile.test.ts:185` asserts `sourceDigest=sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb`.

F1 is resolved.

### New Findings

No new findings.

## Design / Development Compliance Review

- Domain E remains scoped to `packages/validator-core/src/**` plus Wave44 discussion artifacts.
- The digest fix stays inside `packages/validator-core/src/validators/psd-source-evidence-diagnostics.ts`; it does not introduce parser execution, parser dependency import, manifest/lockfile edits, script changes, renderer/pixel oracle behavior, Cubism compatibility, Editor UI, or AI repair generation.
- `packages/validator-core/src/validators/psd-source-evidence-diagnostics.ts` remains a focused validator file. `index.ts` was not changed.
- Parser dependency search in `packages/validator-core/src` found no runtime parser imports. `@webtoon/psd` appears only as test evidence strings in `packages/validator-core/src/psd-source-profile.test.ts`; `ag-psd` and `from "psd"` were not found.
- Product Preflight behavior from loop 0 remains unchanged and still sits in validator-core-owned aggregation/classification logic.
- Boundary evidence such as `validatorBoundary=no-parser-execution`, `photoshopCompositing=notClaimed`, and `rendererPixelOracle=notClaimed` remains present in the PSD diagnostics path.

## Test Adequacy Review

- The focused PSD source profile test now covers the previously missing provenance digest assertions.
- Focused tests still cover parser evidence, unavailable parser evidence, layer tree evidence/missing/mismatch, unsupported and not-evaluated feature evidence, materialization evidence/missing/mismatch, Product Preflight `sourceMaterialization`, unsupported PSD feature mapping, and not-evaluated feature warning behavior.
- Synthetic fixtures remain acceptable for Domain E. Real fixture/materialization population is still a Domain D/F integration concern, not a Domain E unit-test blocker.
- Malformed parser evidence remains indirectly covered by existing package schema validation rather than a focused Domain E malformed-evidence test. This is a non-blocking residual test gap because F1 is fixed and unavailable/inconsistent parser evidence paths are directly covered.

## Verification / Review Actions Performed

- Re-read the implementation-orchestration review rules.
- Inspected current `git diff` for `packages/validator-core/src/validators/psd-source-evidence-diagnostics.ts` and `packages/validator-core/src/psd-source-profile.test.ts`.
- Read the current F1 fix locations and test expectations with line numbers.
- Searched validator-core for parser dependency references:
  - `@webtoon/psd`: test evidence strings only.
  - `ag-psd`: no matches.
  - `from "psd"`: no matches.
- Ran `pnpm.cmd exec vitest run packages/validator-core/src/psd-source-profile.test.ts packages/validator-core/src/product-preflight-report.test.ts`: passed, 2 files / 23 tests.
- Ran `pnpm.cmd typecheck`: passed.
- Ran `pnpm.cmd run check:source`: passed.
- Ran `pnpm.cmd run check:deps`: passed.
- Ran `git diff --check -- packages/validator-core/src discussion/implementation/waves/wave44/wave44-domain-e-psd-validator-provenance-security-diagnostics-report.md discussion/implementation/reviews/wave44/wave44-domain-e-psd-validator-provenance-security-diagnostics-review.md`: passed with LF-to-CRLF warnings only.
- Ran trailing whitespace search on the new/untracked Domain E implementation report, validator file, and this review artifact: no matches.

## Remaining Issues

- No Domain E blocking issues remain.
- Domain D/F still need real materialization fixture/evidence population; this review only evaluates Domain E's validator/Product Preflight unit coverage and F1 fix.

## User-Decision Points

- None for Domain E.
- The existing future decision remains: `test_data/sample_model.psd` derived visual bytes must not be treated as public distributable demo material without separate rights/provenance approval.
