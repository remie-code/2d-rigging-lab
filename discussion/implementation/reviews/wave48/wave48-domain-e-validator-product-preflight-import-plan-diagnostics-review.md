# Wave48 Domain E Re-review: Validator / Product Preflight Import Plan Diagnostics

> Target: `wave48-validator-product-preflight-import-plan-diagnostics`
> Reviewed report: `discussion/implementation/waves/wave48/wave48-domain-e-validator-product-preflight-import-plan-diagnostics-report.md`
> Role: Review-Sylph independent clean re-review
> Verdict: `pass`

## Verdict

`pass`

No remaining blocking or non-blocking findings were found after one bounded Gnome fix loop. The earlier `needs_fix` findings for missing behavioral coverage are resolved: focused tests now directly exercise import-plan stale source identity, missing current source bytes, preflight-blocked approval evidence, and selected-candidate `emptyZeroSize` blocking status.

This re-review did not implement source or test fixes. It only updates this review artifact.

## Findings

No remaining findings.

### Resolved From Prior Review

- E-F1 resolved: `asset.psd.importPlanSourceStale`, `asset.psd.importPlanSourceCurrentBytesMissing`, and `asset.psd.importPlanPreflightBlocked` now have focused behavioral tests at `packages/validator-core/src/psd-materialized-batch-diagnostics.test.ts:600`, `packages/validator-core/src/psd-materialized-batch-diagnostics.test.ts:639`, and `packages/validator-core/src/psd-materialized-batch-diagnostics.test.ts:674`.
- E-F2 resolved: selected-candidate `emptyZeroSize` is now included in the direct selected blocked-candidate test and asserted through `blockingStatuses=hidden,unsupported,emptyZeroSize,byteCapBlocked,generatedIdCollision` at `packages/validator-core/src/psd-materialized-batch-diagnostics.test.ts:538`.

## Scope Reviewed

- Required orchestration/context skills and Wave48 plan/basis documents.
- Domain A report/review for import-plan boundary, sample root, candidate statuses, and non-goals.
- Domain C report/review plus read-only contracts:
  - `packages/package-format/src/psd-import-plan-evidence.ts`
  - `packages/operation-core/src/psd-import-plan-approval-evidence.ts`
- Requested Domain E diff and target files:
  - `packages/validator-core/src/validators/psd-materialized-batch-diagnostics.ts`
  - `packages/validator-core/src/validators/package-runtime.ts`
  - `packages/validator-core/src/check-catalog.ts`
  - `packages/validator-core/src/product-preflight-report.ts`
  - `packages/validator-core/src/psd-materialized-batch-diagnostics.test.ts`
  - `packages/validator-core/src/product-preflight-report.test.ts`
  - Domain E report and this review artifact.

## Design / Development Compliance

Pass.

- Scope is acceptable for Domain E. The reviewed Domain E diff is limited to validator-core source/tests plus the Domain E report/review artifacts. The broader worktree contains accepted/parallel Wave48 Domain C/D changes, but they are outside this Domain E review scope.
- Validator-core consumes Domain C parser-free bridge evidence through package-format schemas and does not import a PSD parser. The bridge safe-parse path starts at `packages/validator-core/src/validators/psd-materialized-batch-diagnostics.ts:331`; direct parser import scans over `packages/**` returned no import/require matches.
- `requirePsdImportPlanBridgeEvidence` is threaded through package-runtime into batch diagnostics without changing package/operation contracts at `packages/validator-core/src/validators/package-runtime.ts:43`, `packages/validator-core/src/validators/package-runtime.ts:83`, and `packages/validator-core/src/validators/package-runtime.ts:207`.
- New diagnostics are cataloged with machine-readable IDs in `packages/validator-core/src/check-catalog.ts:916` through `packages/validator-core/src/check-catalog.ts:1009`.
- Import-plan checks cover stale/missing source evidence, candidate summary mismatch/warning, approval mismatch, preflight blocked, partial state, selected blocked/not-approved candidates, malformed evidence, and private/local provenance boundary issues in `packages/validator-core/src/validators/psd-materialized-batch-diagnostics.ts:367`, `:467`, `:568`, `:639`, `:694`, `:765`, `:1580`, `:1625`, and `:1647`.
- Product Preflight maps required-missing import-plan bridge evidence to truthful `assetBytes` `not_evaluated` / `sourceMaterialization` refs at `packages/validator-core/src/product-preflight-report.ts:744` and `packages/validator-core/src/product-preflight-report.ts:756`.
- Wording remains parser-free and session-only. I did not find claims of persisted/exported Product Preflight artifacts, parser execution, release/demo gates, renderer/pixel oracles, Cubism compatibility, all-layer import, recursive group auto import, public demo asset use, repo-side AI/LLM, or auto-fix.
- Existing Wave47 bridge-less batch diagnostics remain compatible because import-plan bridge evidence is optional unless explicitly required; existing batch tests still pass.
- Source organization is acceptable. `index.ts` implementation was not introduced, and `check:source` passed. The main diagnostics file is large, but it remains a named responsibility file and this wave's changes are focused on the existing PSD batch diagnostics responsibility.

## Test Adequacy

Pass.

Focused tests now cover the Domain E rubric:

- hidden, unsupported, not-approved, generated-collision, collision/preflight count, and byte-cap candidate summary warning at `packages/validator-core/src/psd-materialized-batch-diagnostics.test.ts:489`;
- selected not-approved and selected blocked candidates, including direct `emptyZeroSize`, at `packages/validator-core/src/psd-materialized-batch-diagnostics.test.ts:538`;
- candidate-plan digest mismatch and approval mismatch at `packages/validator-core/src/psd-materialized-batch-diagnostics.test.ts:538`;
- stale source identity at `packages/validator-core/src/psd-materialized-batch-diagnostics.test.ts:600`;
- missing current package-local source PSD bytes at `packages/validator-core/src/psd-materialized-batch-diagnostics.test.ts:639`;
- approval preflight blocked state at `packages/validator-core/src/psd-materialized-batch-diagnostics.test.ts:674`;
- required-missing bridge evidence and Product Preflight `not_evaluated` mapping at `packages/validator-core/src/psd-materialized-batch-diagnostics.test.ts:710`;
- partial state and malformed/private-local provenance boundary evidence at `packages/validator-core/src/psd-materialized-batch-diagnostics.test.ts:739`;
- direct Product Preflight mapping for `asset.psd.importPlanEvidenceMissing` at `packages/validator-core/src/product-preflight-report.test.ts:519`;
- catalog presence for all new import-plan check IDs at `packages/validator-core/src/psd-materialized-batch-diagnostics.test.ts:188`.

The focused tests use synthetic parser-free evidence and do not execute the parser, Editor UI, renderer, pixel oracle, or forbidden external oracles.

## Verification Performed

- `git diff -- packages/validator-core/src/validators/psd-materialized-batch-diagnostics.ts packages/validator-core/src/validators/package-runtime.ts packages/validator-core/src/check-catalog.ts packages/validator-core/src/product-preflight-report.ts packages/validator-core/src/psd-materialized-batch-diagnostics.test.ts packages/validator-core/src/product-preflight-report.test.ts discussion/implementation/waves/wave48/wave48-domain-e-validator-product-preflight-import-plan-diagnostics-report.md discussion/implementation/reviews/wave48/wave48-domain-e-validator-product-preflight-import-plan-diagnostics-review.md`
  - Inspected. Initial output was large/truncated, so implementation and test files were also read directly by targeted line ranges and `rg`.
- `pnpm.cmd exec vitest run packages/validator-core/src/psd-materialized-batch-diagnostics.test.ts packages/validator-core/src/product-preflight-report.test.ts`
  - First sandboxed run failed with Vitest/esbuild `spawn EPERM`.
  - Approved rerun passed: 2 files / 26 tests.
- `pnpm.cmd run typecheck:root`
  - Passed.
- `pnpm.cmd typecheck`
  - Passed in the current worktree.
- `pnpm.cmd run check:source`
  - Passed.
- `pnpm.cmd run check:deps`
  - Passed.
- `node scripts\check-psd-parser-import-boundary.mjs`
  - Passed: 5 direct parser import/resolve sites remain limited to the approved adapter and Wave44 scripts.
- `rg -n "from .*@webtoon/psd|require\(.*@webtoon/psd|from .*ag-psd|require\(.*ag-psd" packages`
  - No output; no direct parser import/require match in `packages/**`.
- `git diff --check -- packages/validator-core/src discussion/implementation/waves/wave48 discussion/implementation/reviews/wave48`
  - Passed with LF-to-CRLF warnings only.

## Remaining Issues

None for Domain E.

Domain E intentionally validates import-plan bridge evidence attached to batch diagnostics. Standalone package-format source-manifest import-plan evidence arrays remain outside this wave's validator/Product Preflight surface, as recorded in the Domain E report.

## User-Decision Points

None required for Domain E.

Future decisions remain outside this review: Product Preflight persistence/export, Editor UI surfacing, parser-backed candidate discovery, public/demo asset policy, all-layer import, recursive group import, renderer/pixel oracle proof, Cubism claims, and repo-side AI/LLM/auto-fix behavior.

## Provisional Assumptions

- Wave47 final pass is the implementation-proven baseline for batch materialization diagnostics.
- Wave48 Domain A, B, and C are accepted pass gates for this Domain E review.
- Domain C `importPlanBridge` evidence is the supported parser-free contract for validator/Product Preflight import-plan diagnostics in this wave.
- Product Preflight output remains session-generated and read-only; diagnostics must not imply persisted/exported artifacts or parser execution.
- `sourceBytePersistence: "metadataOnlyNoRawBytes"` and `publicDemoAsset=false` are required provenance facts when bridge evidence is present.
