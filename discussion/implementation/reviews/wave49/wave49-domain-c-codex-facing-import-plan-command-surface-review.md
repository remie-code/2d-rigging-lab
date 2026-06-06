# Wave49 Domain C Review: Codex-Facing Import-Plan Command Surface

> Target: `wave49-codex-facing-import-plan-command-surface`
> Role: independent Review-Sylph
> Reviewed report: `discussion/implementation/waves/wave49/wave49-domain-c-codex-facing-import-plan-command-surface-report.md`

## Verdict

`pass`

I re-reviewed the updated Domain C source and tests independently after the review-fix loop. The prior `needs_fix` finding is closed: PSD import-plan execution now binds approval to a deterministic approval-context digest, and the same-count leaf-ref swap regression is rejected before host execution.

No blocking design/development compliance, test adequacy, automation policy, parser-boundary, source-organization, approval lifecycle, result/evidence taxonomy, or backward-compatibility issue remains in the reviewed Domain C scope.

## Prior Finding Closure

### Closed: approved preflight reuse across same-count leaf sets

The previous finding was that `executePsdImportPlanIntake` approval was bound only to `approvedPreflightCommandId + agentId + operationId`, allowing a same-count approved leaf-set swap to reuse a previously approved preflight.

The updated implementation closes that gap:

- `packages/ai-interface/src/ai-psd-import-plan-command.ts:68` creates `approvalContextDigest` from a deterministic JSON payload containing schema version, operation id, ordered `approvedLayerNodeRefs`, `destinationParentPartId`, and normalized `expectedPlan`.
- `packages/ai-interface/src/ai-psd-import-plan-command-executor.ts:126` records that digest only when `preflightPsdImportPlanIntake` returns an `operationResult` with status `dry_run`.
- `packages/ai-interface/src/ai-psd-import-plan-command-executor.ts:89` computes the execute-side digest before calling the host, and `:94` checks it through the approval policy.
- `packages/ai-interface/src/ai-approval-policy.ts:133`, `:140`, and `:147` reject missing, unexpected, or mismatched approval-context digests.
- `packages/ai-interface/src/ai-psd-import-plan-command.test.ts:308` verifies that an approved preflight for one explicit leaf list cannot execute a different same-count leaf list with the same preflight command id and operation id; `:340` verifies the host execute method was not called.

This satisfies the Wave49 requirement that execution remain current to the explicit approval selection rather than only to an operation id.

## Review Lanes

### Design / Development Compliance

Pass. The command surface remains deterministic and human-equivalent. The digest is an approval binding over explicit structured inputs; it does not infer intent, classify PSD content, rank candidates, or generate proposals.

### Test Adequacy

Pass. The added regression covers the specific prior risk: same-count approved leaf-ref swap after approval is rejected before host execution. Existing generic operation tests still cover digest-free dry-run/commit approval behavior.

### Automation Policy Compliance

Pass. No repo-side proposal generation, semantic classification, candidate ranking, LLM/provider/prompt integration, smart UI suggestion controls, or automatic commit was found in the reviewed Domain C changed files.

### External Transport / Proposal Generation Boundary

Pass. No HTTP, WebSocket, MCP server, fetch-based transport, or external transport implementation was added. The proposal catalog change remains explicit operation metadata only.

### Parser Boundary

Pass. No direct parser import was added in the Domain C changed files. Direct parser import scan found no import/require usage of `@webtoon/psd` and no `parsePsd` usage; remaining parser-name hits are fixture/evidence strings.

### Source Organization

Pass. `packages/ai-interface/src/index.ts` and `apps/editor/src/ai-command-host/index.ts` remain barrel-only. New logic lives in named responsibility files.

### Approval / Operation Lifecycle

Pass. PSD import-plan execute requires commit capability, a user-approved preflight command id, matching operation id, and matching approval-context digest. Rejected approval checks return before host execution. Generic `dryRunOperation` / `commitOperation` remains backward-compatible because digest is optional and the generic executor records/checks approvals without it.

### Result / Evidence Taxonomy

Pass. Domain C continues to expose Domain B result refs, operation ids, evidence refs, issue arrays, generated part/drawable/texture/mesh refs, and diagnostics through the PSD import-plan command result/projector. The added approval-context digest strengthens lifecycle binding without replacing Domain B evidence.

### Backward Compatibility

Pass. Existing command names, generic dry-run/commit lifecycle, operation-only executor behavior, and transcript hydration/serialization remain compatible. `approvalContextDigest` is optional in approval records/transcript entries.

## Verification

Commands run during this re-review:

| Command | Result |
|---|---|
| `pnpm.cmd exec vitest run packages/ai-interface/src/ai-psd-import-plan-command.test.ts packages/ai-interface/src/ai-operation-command.test.ts packages/ai-interface/src/ai-command-schema.test.ts` | Sandbox run failed with esbuild `spawn EPERM`; approved escalated rerun passed: 3 files / 24 tests. |
| `pnpm.cmd typecheck` | Passed. |
| `node scripts/check-psd-parser-import-boundary.mjs` | Passed: 5 direct import/resolve sites limited to approved adapter and Wave44 scripts. |
| `pnpm.cmd run check:source` | Passed. |
| `pnpm.cmd run check:deps` | Passed. |
| `git diff --check -- packages/contracts/src packages/ai-interface/src apps/editor/src discussion/implementation/waves/wave49 discussion/implementation/reviews/wave49` | Passed by exit code `0`; Git emitted LF-to-CRLF working-copy warnings only. |
| Scoped forbidden/smart automation `rg` over Domain C changed files | No forbidden implementation found. Hits were report/review prose, existing unsupported catalog entries, test fixture parser evidence strings, existing validator-core import in prior ai-interface code, existing tutorial naming, and `provideRuntimeEvidence`. |
| Direct parser import scan over changed source/test files | No import/require of `@webtoon/psd` and no `parsePsd` usage. Plain `@webtoon/psd` hits are fixture `parserPackageName` evidence only. |

## Residual Risks / Assumptions

- I treated Domain A and Domain B reports/reviews as accepted basis and reviewed Domain C integration against those contracts.
- I did not re-run the full 6-file combined suite in this re-review turn because Orch reported it already passed after the fix; I ran the focused approval lifecycle subset that directly exercises the closed finding plus typecheck and boundary guards.
- The approval-context digest depends on Web Crypto SHA-256 availability. Current tests/typecheck pass in the project runtime; if a future non-Web-Crypto host is introduced, it should provide an equivalent deterministic digest implementation rather than weakening the binding.
