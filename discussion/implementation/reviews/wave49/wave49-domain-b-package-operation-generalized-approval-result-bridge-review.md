# Wave49 Domain B Review: Package / Operation Generalized Approval Result Bridge

> Target: `wave49-package-operation-generalized-approval-result-bridge`
> Reviewed report: `discussion/implementation/waves/wave49/wave49-domain-b-package-operation-generalized-approval-result-bridge-report.md`
> Role: Review-Sylph independent clean review
> Verdict: `pass`

## Verdict

`pass`.

I reviewed the Wave49 Domain B source/test diff directly against the Wave49 plan, automation policy, Domain A boundary report/review, Wave48 final baseline, Wave48 Browser candidate service evidence, Wave48 package/operation approval bridge evidence, and the source organization / dependency / schema-ID policies. I found no blocking design/development compliance, test adequacy, automation-policy, parser-boundary, persistence-boundary, or source-organization issue.

## Findings

No findings.

## Design / Development Compliance Review

Pass.

- The import-plan issue taxonomy is additive in both package-format and operation-core. `PsdImportPlanIssueKindSchema` includes stale plan, stale approval, missing candidate, blocked candidate, not-approved, collision, destination parent, source identity mismatch, byte unavailable, byte cap exceeded, partial failure, unsupported/hidden/empty candidate, current-session source missing, and private/local provenance failure (`packages/package-format/src/psd-import-plan-evidence.ts:103`, `packages/operation-core/src/psd-import-plan-approval-evidence.ts:140`). `PsdImportPlanApprovalEvidenceSchema.issues` is optional, preserving existing DTO builders (`packages/package-format/src/psd-import-plan-evidence.ts:232`, `packages/operation-core/src/psd-import-plan-approval-evidence.ts:269`).
- Batch evidence now exposes stable batch evidence IDs, operation IDs, approved leaf refs, approval order, result refs, and per-entry/aggregate issues without removing existing fields (`packages/operation-core/src/psd-layer-materialization-batch-operation-evidence.ts:56`, `:73`, `:79`, `:82`, `:91`, `:107`, `:131`).
- Generated refs are not fixed3-special-cased. The batch operation derives part/drawable/texture/mesh IDs from the source layer display path/name and child operation IDs from the parent operation plus selected index (`packages/operation-core/src/operations/import-psd-layer-materialization-batch.ts:206`, `:249`, `:927`).
- Preflight remains before mutation. Batch preconditions run before child materialization, and any batch/import-plan/child diagnostics return rejected evidence against the original session (`packages/operation-core/src/operations/import-psd-layer-materialization-batch.ts:133`, `:142`, `:166`).
- Import-plan diagnostics still reject stale/mismatched states before mutation: candidate digest, non-approved approval status including `approvalSelectionMismatch`, approved leaf count/order/ref mismatch, source asset/source PSD mismatch, destination mismatch, not-approved candidates, blocked candidates, materialization source mismatch, and generated scaffold mismatch (`packages/operation-core/src/operations/import-psd-layer-materialization-batch-import-plan.ts:205`, `:215`, `:227`, `:243`, `:253`, `:264`, `:137`, `:150`, `:168`, `:185`).
- The new issue mapper preserves explicit machine-readable issue kinds for candidate status, not-approved, blocked, collision, destination parent, source identity, byte unavailable/cap, current-session source missing, private/local provenance, and fallback partial failure (`packages/operation-core/src/operations/import-psd-layer-materialization-batch.ts:730`, `:754`, `:832`).

## Test Adequacy Review

Pass.

- Focused package-format coverage persists import-plan issue records and continues asserting no raw parser/source byte payloads (`packages/package-format/src/source-manifest.test.ts:576`, `:590`).
- Focused operation-core coverage verifies stable result refs for arbitrary non-fixed `front hair` leaf `psd:root/group[2]/layer[0]` (`packages/operation-core/src/operations/import-psd-layer-materialization-batch.test.ts:293`), stale/mismatched approval rejection before mutation (`:355`), not-approved rejection with `issueKind: "notApproved"` (`:397`), hidden blocked candidate rejection with `hiddenCandidate` and `blockedCandidate` (`:446`), duplicate/collision handling (`:504`), and missing/stale byte evidence without partial mutation (`:558`).
- Existing bridge-less compatibility is still covered by the base multi-layer batch test (`packages/operation-core/src/operations/import-psd-layer-materialization-batch.test.ts:28`), and bridge-enabled approved-only behavior remains covered by the import-plan bridge test (`:150`).
- Residual downstream scope is correctly left for later domains: browser candidate generation, Editor UX, ai-interface command routing, validator/Product Preflight diagnostics, and focused e2e.

## Automation Policy Compliance

Pass.

- No Editor UI, ai-interface host, validator-core, proposal generation, semantic classification, auto-fix, automatic commit, all-layer one-click import, recursive group auto import, or group-as-artmesh implementation was added in this domain diff.
- Positive fixed3/source scans found the Wave49 non-fixed target only in tests/fixtures, not implementation special-casing. Forbidden-scope matches in source are negative boundary literals such as `allLayerOneClickImport: "notProvided"` and persistence assertions.

## Parser / Persistence Boundary Review

Pass.

- `node scripts/check-psd-parser-import-boundary.mjs` passed; direct parser imports remain limited to the approved adapter and Wave44 scripts.
- Direct package import scan for `from ... @webtoon/psd`, `from ... ag-psd`, and matching `require(...)` under `packages/**` returned no matches. A broader package-name scan found only parser metadata strings in evidence/tests.
- Source PSD bytes and raw parser objects are not persisted by the new evidence. Boundary schemas require `rawParserObjectPersistence: "notPersisted"` and `sourcePsdBytePersistence: "metadataOnlyNoRawBytes"` (`packages/package-format/src/psd-import-plan-evidence.ts:165`, `:235`, `packages/operation-core/src/psd-layer-materialization-batch-operation-evidence.ts:115`), and focused tests assert the serialized evidence excludes `rawLayerObject` and `sourcePsdBytes` (`packages/operation-core/src/operations/import-psd-layer-materialization-batch.test.ts:146`, `:289`).

## Source Organization Review

Pass.

- `packages/operation-core/src/index.ts` remains barrel-only exports (`packages/operation-core/src/index.ts:1`).
- `packages/package-format/src/index.ts` remains barrel-only exports (`packages/package-format/src/index.ts:1`).
- `packages/package-format/src/source-manifest.ts` re-exports the new import-plan issue schemas and extends `LayeredCharacterPsdProfileSchema` with optional import-plan evidence arrays in the existing PSD profile responsibility file (`packages/package-format/src/source-manifest.ts:37`, `:234`).
- `pnpm.cmd run check:source` passed.

## Verification Performed

| Command / check | Result |
|---|---|
| `pnpm.cmd exec vitest run packages/package-format/src/source-manifest.test.ts packages/operation-core/src/operations/import-psd-layer-materialization-batch.test.ts` | Initial sandbox run failed at Vitest config load with esbuild `spawn EPERM`; approved escalated rerun passed: 2 files / 20 tests. |
| `pnpm.cmd typecheck` | Passed. Root `tsc --noEmit` and editor `tsc --noEmit -p tsconfig.json` passed. |
| `node scripts/check-psd-parser-import-boundary.mjs` | Passed. `5` direct import/resolve sites remain limited to approved adapter and Wave44 scripts. |
| `pnpm.cmd run check:source` | Passed. Source organization guard passed. |
| `pnpm.cmd run check:deps` | Passed. Dependency guard passed. |
| `rg -n "from .*@webtoon/psd|from .*ag-psd|require\\(.*@webtoon/psd|require\\(.*ag-psd" packages` | Passed by exit code `1` with no output; no direct parser import/require found under `packages/**`. |
| `rg -n --glob *.ts --glob *.tsx "@webtoon/psd|ag-psd" packages` | Informational. Hits were parser metadata strings in evidence/tests, not direct imports. |
| `git diff --check -- packages/package-format/src packages/operation-core/src discussion/implementation/waves/wave49 discussion/implementation/reviews/wave49` | Passed with Git LF-to-CRLF working-copy warnings only. |
| `git diff --name-status -- packages/package-format/src packages/operation-core/src package.json pnpm-lock.yaml` | Only the expected 9 package-format/operation-core source/test files are modified; no package manifest or lockfile diff. |

## Files Changed By This Review

- `discussion/implementation/reviews/wave49/wave49-domain-b-package-operation-generalized-approval-result-bridge-review.md`

## Unresolved Risks / Assumptions

- Approval-selection digest freshness is represented in operation-core by non-`approved` approval status and by approved refs/order/source/destination checks, not by recomputing the Editor's approval digest in operation-core. This matches the Domain A operation diagnostic list, which gates approval selection mismatch through `importPlanApprovalNotApproved`.
- Domain B proves package/operation contracts with focused fixtures. Actual browser candidate generation for non-fixed leaves, Editor result UX, ai-interface command parity, validator/Product Preflight diagnostics, and focused e2e remain downstream Wave49 work.
- Unknown future operation diagnostics currently map to `partialFailure`; downstream domains should add explicit issue-kind mappings when they introduce new stable diagnostic IDs.
