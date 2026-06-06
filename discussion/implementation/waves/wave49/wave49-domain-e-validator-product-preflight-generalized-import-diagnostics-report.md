# Wave49 Domain E Report: Validator / Product Preflight Generalized Import Diagnostics

> Target: `wave49-validator-product-preflight-generalized-import-diagnostics`
> Role: Gnome implementation agent
> Verdict candidate: `pass`

## Verdict

verdict candidate: `pass`

Wave49 Domain E extends validator/Product Preflight import-plan diagnostics for the generalized approval/result evidence added by Domain B while preserving the Wave48 parser-free bridge behavior. Validator-core now accepts additive batch evidence fields for generated result refs, per-entry approved leaf refs, approval order, and import-plan issue records. Product Preflight can surface Domain B issue-kind taxonomy through existing stable validator check IDs without adding parser execution, source PSD byte persistence, raw parser object persistence, proposal generation, or renderer/pixel oracle semantics.

Orch-Sylph自身は実装担当ではない。source implementation は必ず別コンテキストの Gnome に委譲し、レビューは必ず別コンテキストの Review-Sylph に委譲すること。これを分離できない場合は実装せず escalate / blocked として報告すること。

## Basis Used

- `discussion/implementation/orchestration/wave49-plan.md`
- `discussion/design/codex-friendly-automation-policy.md`
- `discussion/implementation/waves/wave49/wave49-domain-a-boundary-target-inventory-operation-parity-report.md`
- `discussion/implementation/reviews/wave49/wave49-domain-a-boundary-target-inventory-operation-parity-review.md`
- `discussion/implementation/waves/wave49/wave49-domain-b-package-operation-generalized-approval-result-bridge-report.md`
- `discussion/implementation/reviews/wave49/wave49-domain-b-package-operation-generalized-approval-result-bridge-review.md`
- `discussion/implementation/waves/wave49/wave49-domain-c-codex-facing-import-plan-command-surface-report.md`
- `discussion/implementation/reviews/wave49/wave49-domain-c-codex-facing-import-plan-command-surface-review.md`
- `discussion/implementation/waves/wave48/wave48-domain-e-validator-product-preflight-import-plan-diagnostics-report.md`
- `discussion/implementation/reviews/wave48/wave48-domain-e-validator-product-preflight-import-plan-diagnostics-review.md`
- `discussion/implementation/waves/wave48/wave48-final-integration-report.md`
- `discussion/implementation/reviews/wave48/wave48-final-integration-review.md`
- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/development_convention/diagnostic-policy.md`
- `discussion/development_convention/schema-and-id-conventions.md`
- Current validator source/tests under `packages/validator-core/src/**`.

## Implementation Summary

- Extended the validator-local parser-free batch evidence schema to tolerate Domain B additive fields:
  - batch `evidenceId`, batch `operationId`, aggregate `issues`;
  - per-entry `approvedLeafRef`, `approvalOrder`, `resultRefs`, and `issues`.
- Added Domain B `PsdImportPlanIssueKind` consumption in validator-core without importing operation-core or any parser dependency.
- Mapped Domain B issue kinds onto existing stable Product Preflight/validator check IDs:
  - stale plan / missing candidate -> `asset.psd.importPlanCandidateMismatch`;
  - stale approval -> `asset.psd.importPlanApprovalMismatch`;
  - blocked / hidden / unsupported / empty candidate -> `asset.psd.importPlanCandidateBlocked`;
  - not-approved -> `asset.psd.importPlanNotApprovedCandidateSelected`;
  - collision / byte cap -> `asset.psd.importPlanPreflightBlocked`;
  - destination parent -> `asset.psd.materializedBatchDestinationParentInvalid`;
  - source identity mismatch -> `asset.psd.importPlanSourceStale`;
  - byte unavailable / current-session source missing -> `asset.psd.importPlanSourceCurrentBytesMissing`;
  - partial failure -> `asset.psd.importPlanPartialState`;
  - private/local provenance failure -> `asset.psd.importPlanProvenanceBlocked`.
- Preserved Wave48 inference checks over candidate/approval bridge evidence and added reported issue evidence as additive diagnostics.
- Updated approved-leaf matching to prefer per-entry `approvedLeafRef` and `approvalOrder` when present, with Wave48 `approvedLeafRefs[selectedIndex]` fallback for older evidence.
- Added machine-readable evidence strings for generated result refs, batch/entry issue kinds, approval issue kinds, and per-approved-leaf result states.
- Changed import-plan source/current-session byte absence to `needs_review` and Product Preflight `not_evaluated`, while preserving materialized batch source-byte warning behavior outside import-plan evidence.

## Files Changed

- `packages/validator-core/src/validators/psd-materialized-batch-diagnostics.ts`
- `packages/validator-core/src/psd-materialized-batch-diagnostics.test.ts`
- `packages/validator-core/src/product-preflight-report.ts`
- `packages/validator-core/src/product-preflight-report.test.ts`
- `discussion/implementation/waves/wave49/wave49-domain-e-validator-product-preflight-generalized-import-diagnostics-report.md`

No `apps/**`, `packages/package-format/**`, `packages/operation-core/**`, `packages/ai-interface/**`, `packages/contracts/**`, package manifest, lockfile, parser implementation, Product Preflight persisted/exported artifact, proposal generation, or review artifact was intentionally edited by this domain.

## Focused Test Coverage

- Existing Wave48 import-plan diagnostics remain covered.
- Added coverage that Domain B generalized result refs and per-entry approved leaf refs are accepted rather than rejected as malformed batch evidence.
- Added coverage that generated result refs and per-approved-leaf status summaries appear in validator evidence.
- Added coverage for all Domain B import-plan issue kinds mapping to stable validator/Product Preflight check IDs.
- Added coverage that `currentSessionSourceMissing` issue evidence and missing current import-plan source bytes produce Product Preflight `not_evaluated`, not a false pass or renderer/parser claim.
- Added direct Product Preflight aggregation coverage for `asset.psd.importPlanSourceCurrentBytesMissing`.

## Verification Performed

| Command / check | Result |
|---|---|
| `pnpm.cmd exec vitest run packages/validator-core/src/psd-materialized-batch-diagnostics.test.ts packages/validator-core/src/product-preflight-report.test.ts` | Initial sandbox run failed at Vitest config load with esbuild `spawn EPERM`; approved escalated rerun passed: 2 files / 30 tests. Re-run after fixture type fix also passed: 2 files / 30 tests. |
| `pnpm.cmd typecheck` | Initial run failed on validator test fixture TypeScript errors after the first implementation pass; fixed helper typing. Final rerun passed: root `tsc --noEmit` and editor `tsc --noEmit -p tsconfig.json`. |
| `node scripts/check-psd-parser-import-boundary.mjs` | Passed. `5` direct import/resolve sites remain limited to approved adapter and Wave44 scripts. |
| `pnpm.cmd run check:source` | Passed. Source organization guard passed. |
| `pnpm.cmd run check:deps` | Passed. Dependency guard passed. |
| `rg -n --glob '*.ts' --glob '*.tsx' 'from\\s+[''"](@webtoon/psd|ag-psd)[''"]|require\\(\\s*[''"](@webtoon/psd|ag-psd)[''"]\\s*\\)' packages\\validator-core\\src` | Passed by exit code `1` with no output; no direct parser import/require in validator-core. |
| Changed-file forbidden/smart automation scan with `rg -n -i 'llm|provider|prompt|natural[- ]language|proposal generation|generateProposal|generate proposal|semantic class|classification|rank|candidate ranking|auto[- ]?fix|automatic commit|http|websocket|mcp|external transport|one[- ]click|recursive group|group-as-artmesh|all-layer|smart|suggest|recommend|parser execution|pixel oracle|renderer|cubism|sourcePsdBytes|rawParserObject' ...` | Matches classified as existing Product Preflight recommended-action identifiers, negative/non-goal parser/renderer/cubism evidence strings in tests, and boundary literals such as `rawParserObject=notPersisted`, `sourcePsdBytes=notPersisted`, `rendererPixelOracle=notClaimed`. No forbidden implementation or positive capability claim found. |
| `git diff --check -- packages/validator-core/src discussion/implementation/waves/wave49 discussion/implementation/reviews/wave49` | Passed after report write with Git LF-to-CRLF working-copy warnings only. |
| `rg -n "[ \\t]+$" discussion/implementation/waves/wave49/wave49-domain-e-validator-product-preflight-generalized-import-diagnostics-report.md` | Passed by exit code `1` with no output; no trailing whitespace in the untracked report artifact. |

## Compatibility Notes

- Domain B fields are additive and optional. Older Wave48 batch evidence without `evidenceId`, `operationId`, `approvedLeafRef`, `approvalOrder`, `resultRefs`, or `issues` remains accepted.
- Validator-core consumes package-format import-plan schemas only. It does not import operation-core or parser packages.
- No existing validator check IDs were renamed. Domain B issue kinds are surfaced as machine-readable evidence on existing stable check IDs.
- Product Preflight remains session-generated/read-only. The changes do not create a persisted/exported Product Preflight artifact.
- Missing current import-plan source/session bytes now make the import-plan source-materialization category `not_evaluated`; this avoids claiming revalidation capability when source bytes/session evidence are absent.

## Assumptions And Residual Risks

- Domain A/B/C reports and reviews are treated as accepted contracts for this Domain E implementation.
- Validator diagnostics remain parser-free and evidence-driven; they do not prove Photoshop compositing, renderer output, texture sampling correctness, pixel equivalence, or Cubism compatibility.
- Unknown future issue kinds require a package-format contract update before validator-core can map them.
- Focused validator tests use synthetic parser-free evidence; focused e2e proof for non-fixed sample PSD execution remains downstream Wave49 Domain F scope.
