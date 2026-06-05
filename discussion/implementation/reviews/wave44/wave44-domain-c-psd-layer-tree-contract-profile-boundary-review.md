# Wave44 Domain C Review: PSD Layer Tree Contract / Profile Boundary

> Target: `wave44-psd-layer-tree-contract-profile-boundary`
> Reviewer: Review-Sylph independent reviewer
> Reviewed report: `discussion/implementation/waves/wave44/wave44-domain-c-psd-layer-tree-contract-profile-boundary-report.md`

## Verdict

`pass`

Re-review after Gnome fix loop 1 confirms F1 is resolved. Design/development compliance remains acceptable, and the updated tests now explicitly assert PSD source digest, source byte length, source media type, derived artifact path, generator id, and materialization-local parser evidence preservation.

## Scope Reviewed

- `packages/contracts/src/product-preflight-report.ts`
- `packages/contracts/src/product-preflight-report.test.ts`
- `packages/package-format/src/psd-source-evidence.ts`
- `packages/package-format/src/source-manifest.ts`
- `packages/package-format/src/source-manifest.test.ts`
- `packages/operation-core/src/payloads/import-source.ts`
- `packages/operation-core/src/operations/import-psd-source-asset-materialization.ts`
- `packages/operation-core/src/operations/import-psd-source-asset.test.ts`
- `discussion/implementation/waves/wave44/wave44-domain-c-psd-layer-tree-contract-profile-boundary-report.md`

Known parallel changes in manifests, lockfile, parser smoke script, Domain B report, maps, and backlog were observed by `git status` but not attributed to Domain C.

## Basis Documents Used

- `.agents/skills/implementation-orchestration/SKILL.md`
- `C:/Users/remie/.codex/skills/subagent-context-hygiene/SKILL.md`
- `discussion/implementation/orchestration/wave44-plan.md`
- `discussion/implementation/waves/wave44/wave44-domain-a-psd-dependency-security-fixture-boundary-report.md`
- `discussion/implementation/reviews/wave44/wave44-domain-a-psd-dependency-security-fixture-boundary-review.md`
- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/development_convention/schema-and-id-conventions.md`
- `discussion/development_convention/diagnostic-policy.md`
- `discussion/tests/fixtures/fixture-manifest.md`

## Findings

### F1 - Materialization provenance/parser preservation coverage

Severity: `resolved`

`packages/package-format/src/psd-source-evidence.ts:116` through `packages/package-format/src/psd-source-evidence.ts:148` define optional source provenance details (`sourceDigest`, `sourceByteLength`, `sourceMediaType`) and optional materialization-local `parser` evidence. The operation-core payload mirror has the same provenance fields at `packages/operation-core/src/payloads/import-source.ts:161` through `packages/operation-core/src/payloads/import-source.ts:192`.

The original review found that fixtures contained these fields but the assertions did not prove they survived parsing/materialization. Gnome fix loop 1 added explicit `toMatchObject` coverage in both test lanes:

- `packages/package-format/src/source-manifest.test.ts:296` through `packages/package-format/src/source-manifest.test.ts:318` now asserts `sourceDigest`, `sourceByteLength`, `sourceMediaType`, `derivedArtifactPath`, `generatedBy`, and materialization-local parser evidence.
- `packages/operation-core/src/operations/import-psd-source-asset.test.ts:325` through `packages/operation-core/src/operations/import-psd-source-asset.test.ts:347` now asserts the same preservation through operation-core materialization.

F1 is resolved.

## Design / Development Compliance Review

No design compliance blocker found.

- Public contract change is additive: `sourceMaterialization` is added to Product Preflight artifact kind/ref handling at `packages/contracts/src/product-preflight-report.ts:105` and `packages/contracts/src/product-preflight-report.ts:213`.
- Parser-free profile compatibility is preserved by optional additions to `LayeredCharacterPsdProfileSchema` at `packages/package-format/src/source-manifest.ts:129` through `packages/package-format/src/source-manifest.ts:197`.
- New `packages/package-format/src/psd-source-evidence.ts` has a focused responsibility for PSD evidence schemas. It uses strict parser/materialization evidence objects and explicit `parser-private-shape-excluded-v1` boundaries.
- Unsupported Photoshop behavior is represented as `unsupported` / `notEvaluated`, not as implemented behavior, at `packages/package-format/src/psd-source-evidence.ts:47` and in tests at `packages/package-format/src/source-manifest.test.ts:272` / `packages/package-format/src/source-manifest.test.ts:277`.
- Operation-core preserves optional evidence through structured clones at `packages/operation-core/src/operations/import-psd-source-asset-materialization.ts:129` through `packages/operation-core/src/operations/import-psd-source-asset-materialization.ts:158`.
- No Domain C parser dependency import was found for `@webtoon/psd` or `ag-psd`; parser package names appear only as evidence strings in tests.
- Public `index.ts` files remain barrel-only.
- No full compositing, renderer, pixel oracle, Cubism compatibility, Editor UI, or PNG workflow expansion implementation was found in the Domain C diff.

Non-blocking observation: operation-core mirrors package-format PSD evidence schemas in `packages/operation-core/src/payloads/import-source.ts`. That is acceptable for the current package dependency boundary because operation-core does not depend on package-format, but the added tests should stay explicit to reduce future DTO drift.

## Test Adequacy Review

Covered:

- Product Preflight `sourceMaterialization` artifact ref accepts generated JSON paths and rejects non-JSON paths at `packages/contracts/src/product-preflight-report.test.ts:166`.
- Package-format roundtrip covers real PSD parse intake, layer tree evidence, unsupported/not-evaluated evidence, materialization evidence including source provenance and parser evidence, and parser-private object rejection at `packages/package-format/src/source-manifest.test.ts:242` and `packages/package-format/src/source-manifest.test.ts:335`.
- Operation-core preserves real PSD parse evidence and selected layer materialization evidence, including source provenance and parser evidence, into parser-free profile metadata at `packages/operation-core/src/operations/import-psd-source-asset.test.ts:259`.
- Existing parser-free adapter compatibility fixtures remain in the same test files and passed.

## Verification Performed

- Read required basis documents listed above.
- Ran `git status --short -uall`: confirmed Domain C files plus known parallel non-Domain-C changes.
- Ran `git diff -- ...Domain C files...`: inspected tracked Domain C source/test diffs directly.
- Read `packages/package-format/src/psd-source-evidence.ts` directly.
- Ran parser-import search for `from "@webtoon/psd"`, `import("@webtoon/psd")`, `from "ag-psd"`, and `import("ag-psd")`: no matches in Domain C source scope.
- Ran `pnpm.cmd exec vitest run packages/contracts/src/product-preflight-report.test.ts packages/package-format/src/source-manifest.test.ts packages/operation-core/src/operations/import-psd-source-asset.test.ts`: passed, 3 files / 23 tests.
- Ran `pnpm.cmd typecheck`: passed.
- Ran `pnpm.cmd run check:source`: passed.
- Ran `git diff --check -- ...Domain C tracked files...`: passed with LF-to-CRLF working-copy warnings only.
- Ran trailing-whitespace checks on the untracked `packages/package-format/src/psd-source-evidence.ts` and Domain C report: no matches.
- Re-review after fix loop 1:
  - Inspected updated `git diff -- packages/package-format/src/source-manifest.test.ts packages/operation-core/src/operations/import-psd-source-asset.test.ts` directly.
  - Searched updated tests for `sourceDigest`, `sourceByteLength`, `sourceMediaType`, `derivedArtifactPath`, `generatedBy`, parser package/version, adapter, runtime, and private shape policy assertions.
  - Ran `pnpm.cmd exec vitest run packages/contracts/src/product-preflight-report.test.ts packages/package-format/src/source-manifest.test.ts packages/operation-core/src/operations/import-psd-source-asset.test.ts`: passed, 3 files / 23 tests.
  - Ran `pnpm.cmd typecheck`: passed.
  - Ran `pnpm.cmd run check:source`: passed.
  - Ran `git diff --check -- ...Domain C tracked files...`: passed with LF-to-CRLF working-copy warnings only.

## Remaining Issues

- Domain D still needs to populate evidence from actual selected layer raster extraction.
- Domain E still needs validator/Product Preflight diagnostics over parsed PSD, materialization, and unsupported/not-evaluated evidence.

## User-Decision Points

- None required for Domain C.
- The existing future decision remains: `test_data/sample_model.psd` derived visual bytes must not become public distributable demo material without a separate rights/provenance decision.

## Separation Note

Review-Sylph was separate from Gnome. This review inspected basis documents, diffs, changed files, and verification results directly. Review-Sylph did not edit source files or implementation reports.
