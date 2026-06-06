# Wave49 Domain E Review: Validator / Product Preflight Generalized Import Diagnostics

> Target: `wave49-validator-product-preflight-generalized-import-diagnostics`
> Reviewed report: `discussion/implementation/waves/wave49/wave49-domain-e-validator-product-preflight-generalized-import-diagnostics-report.md`
> Role: Review-Sylph independent review
> Verdict: `pass`

## Verdict

`pass`.

Orch-Sylph自身は実装担当ではない。source implementation は必ず別コンテキストの Gnome に委譲し、レビューは必ず別コンテキストの Review-Sylph に委譲すること。これを分離できない場合は実装せず escalate / blocked として報告すること。

I reviewed the current Domain E diff, current validator source/tests, the Domain E report, Wave49 plan and automation policy, Domain B contract/report/review, Wave48 validator/Product Preflight baseline, and the source organization / diagnostic / schema-ID policies. I found no blocking or non-blocking findings.

## Findings

No findings.

## Scope And File Review

Pass.

- Current Domain E source diff is limited to the expected validator-core files: `packages/validator-core/src/validators/psd-materialized-batch-diagnostics.ts`, `packages/validator-core/src/psd-materialized-batch-diagnostics.test.ts`, `packages/validator-core/src/product-preflight-report.ts`, and `packages/validator-core/src/product-preflight-report.test.ts`.
- The Domain E completion report is present as the expected untracked wave artifact. This review adds only this review artifact.
- The worktree contains other Wave49 A/B/C/D changes outside this review scope. I did not revert or attribute those unrelated changes to Domain E.
- I found no evidence that Domain E edited forbidden source areas such as `apps/**`, `packages/package-format/**`, `packages/operation-core/**`, `packages/ai-interface/**`, manifests, lockfiles, parser implementation, or generated assets. This conclusion is based on the Domain E report's changed-file list plus the current targeted diff/status.

## Design / Development Compliance

Pass.

- Domain B batch evidence fields are consumed additively and remain optional/defaulted in validator-core: batch `evidenceId` / `operationId`, entry `approvedLeafRef`, `approvalOrder`, `resultRefs`, and issue arrays are optional or default arrays in `packages/validator-core/src/validators/psd-materialized-batch-diagnostics.ts:79`, `:90`, and `:108`.
- Backward compatibility is preserved by `getApprovedLeafForEntry`, which prefers per-entry approved refs/order when present and falls back to `approvedLeafRefs[selectedIndex]` for older Wave48 evidence (`packages/validator-core/src/validators/psd-materialized-batch-diagnostics.ts:2115`).
- Domain B issue kinds are consumed through the package-format issue schema/type and mapped to existing stable validator check IDs by an exhaustive `Record<PsdImportPlanIssueKindDto, ...>` mapping (`packages/validator-core/src/validators/psd-materialized-batch-diagnostics.ts:361`). No existing check ID is renamed.
- Reported issue evidence remains machine-readable and additive: issue source, index, kind, id, check id, target path, selected index, approval order, and source-layer key are emitted in `createReportedIssueEvidence` (`packages/validator-core/src/validators/psd-materialized-batch-diagnostics.ts:1165`).
- Generated result refs are surfaced as evidence strings for batch evidence id, materialization evidence/id, operation id, part/drawable/mesh/texture ids, and approved-leaf result summaries (`packages/validator-core/src/validators/psd-materialized-batch-diagnostics.ts:2547`, `:2567`).

## Test Adequacy

Pass.

- Focused validator tests cover generalized Domain B result refs and assert machine-readable approved-leaf generated refs (`packages/validator-core/src/psd-materialized-batch-diagnostics.test.ts:582`).
- Focused tests cover all Domain B issue kinds and verify they map to stable validator/Product Preflight check IDs with `reportedIssueKind=...` evidence (`packages/validator-core/src/psd-materialized-batch-diagnostics.test.ts:620`, `:662`, `:674`).
- Current-session source-missing issue evidence is covered through validator diagnostics and Product Preflight `not_evaluated` mapping (`packages/validator-core/src/psd-materialized-batch-diagnostics.test.ts:695`).
- The previous Wave48 missing-current-source-bytes test now expects `needs_review` and `assetBytes` `not_evaluated`, preventing a false evaluated/warn claim when bytes are absent (`packages/validator-core/src/psd-materialized-batch-diagnostics.test.ts:864`).
- Product Preflight aggregation has direct coverage for `asset.psd.importPlanSourceCurrentBytesMissing` mapping to `sourceMaterialization` `not_evaluated` (`packages/validator-core/src/product-preflight-report.test.ts:563`).
- Targeted Vitest passed: 2 files / 30 tests.

## Automation Policy Compliance

Pass.

- I found no repo/editor proposal generation, semantic classification, recommendation/ranking, auto-fix, automatic commit, LLM/provider/prompt workflow, external transport, all-layer one-click import, recursive group auto import, or group-as-artmesh implementation in the Domain E changed files.
- Forbidden/smart automation scan hits were classified as existing Product Preflight `recommendedNextActions` vocabulary, negative/non-goal report wording, or explicit boundary evidence such as `rawParserObject=notPersisted`, `sourcePsdBytes=notPersisted`, and `rendererPixelOracle=notClaimed`.
- Domain E remains a deterministic validator/Product Preflight diagnostic surface over supplied parser-free evidence; it does not infer targets or propose operations.

## Parser Boundary / Product Preflight Truthfulness

Pass.

- `node scripts/check-psd-parser-import-boundary.mjs` passed: 5 direct parser import/resolve sites remain limited to approved adapter and Wave44 scripts.
- Direct parser import scan under `packages/validator-core/src` returned no import/require matches. A broader parser package string scan found only parser metadata fixture strings in tests, not parser execution or dependency import.
- Validator-core uses package-format parser-free schemas and `safeParse` for supplied evidence; I found no parser execution path in Domain E.
- Missing current import-plan source/session bytes are now truthful `needs_review` diagnostics and Product Preflight `assetBytes` `not_evaluated` source-materialization claims (`packages/validator-core/src/validators/psd-materialized-batch-diagnostics.ts:610`, `packages/validator-core/src/product-preflight-report.ts:737`).
- Product Preflight remains a session-generated in-memory report builder. I found no persisted/exported Product Preflight artifact, no filesystem/browser storage write, no download/export path, no proposal generation or auto repair semantics, and no renderer/pixel/compositing proof claim.

## Source Organization

Pass.

- Domain E changed existing responsibility files for PSD materialized batch diagnostics and Product Preflight report aggregation. No `index.ts` implementation logic was added.
- No broad catch-all file or new dependency was introduced.
- `pnpm.cmd run check:source` passed.
- `pnpm.cmd run check:deps` passed.

## Verification Performed

| Command / check | Result |
|---|---|
| `git diff -- packages/validator-core/src/validators/psd-materialized-batch-diagnostics.ts packages/validator-core/src/psd-materialized-batch-diagnostics.test.ts packages/validator-core/src/product-preflight-report.ts packages/validator-core/src/product-preflight-report.test.ts` | Inspected. |
| `Get-Content -Encoding UTF8 discussion/implementation/waves/wave49/wave49-domain-e-validator-product-preflight-generalized-import-diagnostics-report.md` | Inspected. |
| `pnpm.cmd exec vitest run packages/validator-core/src/psd-materialized-batch-diagnostics.test.ts packages/validator-core/src/product-preflight-report.test.ts` | Sandbox run failed at Vitest/esbuild startup with `spawn EPERM`; approved escalated rerun passed: 2 files / 30 tests. |
| `pnpm.cmd typecheck` | Passed. Root `tsc --noEmit` and editor `tsc --noEmit -p tsconfig.json` passed. |
| `node scripts/check-psd-parser-import-boundary.mjs` | Passed. |
| `pnpm.cmd run check:source` | Passed. |
| `pnpm.cmd run check:deps` | Passed. |
| Direct parser import scan under `packages/validator-core/src` | Passed by exit code 1 / no output for import/require regex. |
| Broader parser package string scan under `packages/validator-core/src` | Informational only: parser metadata strings in tests, no direct imports. |
| Forbidden/smart automation scan over Domain E changed files and report | Passed with classified negative/boundary hits only. |
| `git diff --check -- packages/validator-core/src discussion/implementation/waves/wave49 discussion/implementation/reviews/wave49` | Passed after review artifact write with Git LF-to-CRLF warnings only. |
| Trailing-whitespace scan over this review artifact | Passed by exit code 1 / no output. |

## Unresolved Risks / Assumptions

- Domain E relies on the current Domain B package-format issue-kind contract. Unknown future issue kinds should require a package-format contract update and a validator mapping update.
- Focused validator tests use synthetic parser-free evidence. Browser/editor/e2e proof for arbitrary non-fixed PSD leaf execution remains downstream Wave49 Domain F scope.
- Other Wave49 A/B/C/D changes are present in the worktree; this review treated them as unrelated unless they affected Domain E contracts.
