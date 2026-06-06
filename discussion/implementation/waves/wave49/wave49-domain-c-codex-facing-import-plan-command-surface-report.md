# Wave49 Domain C Report: Codex-Facing Import-Plan Command Surface

> Target: `wave49-codex-facing-import-plan-command-surface`
> Role: Gnome implementation agent
> Verdict candidate: `pass`

## Verdict

verdict candidate: `pass`

Wave49 Domain C extends the existing `packages/ai-interface` command schema and the in-process Editor command host with deterministic PSD import-plan intake commands. The surface lets Codex read the current explicit PSD import-plan state, submit explicit approved leaf refs, preflight the approved intake through the existing dry-run lifecycle, execute the approved intake through the same explicit batch operation path used by human workflows, and inspect stable generated refs, operation IDs, evidence refs, and issue records exposed by Domain B.

This domain did not implement proposal generation, candidate ranking, semantic classification, natural-language parsing, LLM/provider/prompt integration, external HTTP/WebSocket/MCP transport, visible Editor suggestion UI, automatic commit, parser scope expansion, validator-core diagnostics, all-layer one-click import, recursive group auto import, or group-as-artmesh import.

## Basis Used

- `discussion/implementation/orchestration/wave49-plan.md`
- `discussion/design/codex-friendly-automation-policy.md`
- `discussion/implementation/waves/wave49/wave49-domain-a-boundary-target-inventory-operation-parity-report.md`
- `discussion/implementation/reviews/wave49/wave49-domain-a-boundary-target-inventory-operation-parity-review.md`
- `discussion/implementation/waves/wave49/wave49-domain-b-package-operation-generalized-approval-result-bridge-report.md`
- `discussion/implementation/reviews/wave49/wave49-domain-b-package-operation-generalized-approval-result-bridge-review.md`
- `discussion/implementation/waves/wave40/wave40-final-report.md`
- `discussion/implementation/reviews/wave40/wave40-clean-integration-review.md`
- `discussion/implementation/waves/wave48/wave48-final-integration-report.md`
- `discussion/implementation/reviews/wave48/wave48-final-integration-review.md`
- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/development_convention/dependency-policy.md`
- `discussion/development_convention/schema-and-id-conventions.md`
- Relevant current source/tests under `packages/ai-interface/src/**` and `apps/editor/src/**`.

## Implementation Summary

- Added PSD import-plan AI command DTOs and command host contract:
  - `getPsdImportPlanState`
  - `setPsdImportPlanApproval`
  - `preflightPsdImportPlanIntake`
  - `executePsdImportPlanIntake`
- Added a PSD import-plan command executor with capability gates, host-missing `not_implemented` behavior, preflight dry-run approval recording, commit approval enforcement via `approvedPreflightCommandId` and `expectedOperationId`, response normalization, transcript recording, and evidence ref aggregation from Domain B batch evidence.
- Review fix: PSD preflight approval is now also bound to `approvalContextDigest`, a SHA-256 digest over ordered `approvedLayerNodeRefs`, `destinationParentPartId`, normalized `expectedPlan`, and operation id. `executePsdImportPlanIntake` computes the same digest before calling the Editor host, so an approved preflight for same-count leaf set A cannot be reused for leaf set B.
- Extended the existing AI command request/response unions and public barrel exports while keeping the generic operation executor backward-compatible by returning command-matching `not_implemented` payloads when PSD commands are sent to the operation-only executor.
- Added a Codex-readable operation catalog entry for `importPsdLayerMaterializationBatch` as an available explicit operation. This is metadata only; no repo-side proposal generation or ranking was added.
- Added an Editor PSD import-plan projector that exposes import-plan summary/candidates and latest batch status, generated `part` / `drawable` / `texture` / `mesh` refs, batch/child operation IDs, evidence refs, and Domain B issue records.
- Routed the Editor in-process AI command host to the PSD import-plan executor before operation provenance checks.
- Added a preflight-only selected PSD layer batch workflow that reuses the existing explicit batch materialization and operation dry-run path without mutating the project or persistent byte store.
- Connected the workflow controller to the PSD command host:
  - read current plan state;
  - regenerate explicit approval previews from supplied refs;
  - validate expected plan context and current approval refs before preflight/execute;
  - preflight with `preflightEditorSelectedPsdLayerBatchIntakeWorkflow`;
  - execute with `commitEditorSelectedPsdLayerBatchIntakeWorkflow`.

## Files Changed

- `packages/ai-interface/src/ai-psd-import-plan-command.ts`
- `packages/ai-interface/src/ai-psd-import-plan-command-executor.ts`
- `packages/ai-interface/src/ai-psd-import-plan-command.test.ts`
- `packages/ai-interface/src/ai-approval-policy.ts`
- `packages/ai-interface/src/ai-command-transcript.ts`
- `packages/ai-interface/src/ai-command-name.ts`
- `packages/ai-interface/src/ai-command-payload.ts`
- `packages/ai-interface/src/ai-command-response-payload.ts`
- `packages/ai-interface/src/ai-command-executor.ts`
- `packages/ai-interface/src/ai-command-schema.test.ts`
- `packages/ai-interface/src/ai-codex-proposal-operation-catalog.ts`
- `packages/ai-interface/src/ai-codex-proposal-validation.test.ts`
- `packages/ai-interface/src/index.ts`
- `apps/editor/src/ai-command-host/editor-ai-command-host.ts`
- `apps/editor/src/ai-command-host/editor-ai-command-host.test.ts`
- `apps/editor/src/ai-command-host/editor-ai-psd-import-plan-projector.ts`
- `apps/editor/src/ai-command-host/index.ts`
- `apps/editor/src/editor-workflow/selected-psd-layer-batch-intake-workflow.ts`
- `apps/editor/src/editor-workflow/selected-psd-layer-batch-intake-workflow.test.ts`
- `apps/editor/src/editor-workflow/workflow-controller.ts`
- `discussion/implementation/waves/wave49/wave49-domain-c-codex-facing-import-plan-command-surface-report.md`

Note: `ai-command-request.ts` and `ai-command-response.ts` were inspected as part of the command surface but did not require direct edits.

## Focused Test Coverage

- AI command schema tests now cover PSD import-plan command request/response parsing and command-name exposure.
- New AI PSD import-plan command executor tests cover:
  - read state through a host;
  - dry-run capability enforcement for approval changes;
  - preflight with dry-run approval recording, transcript entry, stable evidence refs, operation IDs, and generated refs;
  - execute rejection before approval;
  - execute success only after matching preflight approval.
  - regression coverage that an approved preflight for one explicit approved ref list cannot execute a different same-count ref list with the same preflight command and operation id.
- Existing AI operation executor tests still cover backward-compatible operation dry-run/commit behavior.
- Catalog tests now assert the available `importPsdLayerMaterializationBatch` metadata and required explicit payload fields.
- Editor command host tests cover PSD import-plan routing to the injected in-process host.
- Selected PSD layer batch workflow tests cover dry-run preflight without project mutation or persistent byte writes.

## Verification Performed

| Command / check | Result |
|---|---|
| `pnpm.cmd exec vitest run packages/ai-interface/src/ai-command-schema.test.ts packages/ai-interface/src/ai-psd-import-plan-command.test.ts packages/ai-interface/src/ai-codex-proposal-validation.test.ts packages/ai-interface/src/ai-operation-command.test.ts` | Initial sandbox run failed at Vitest config load with esbuild `spawn EPERM`; approved escalated rerun passed: 4 files / 35 tests. |
| `pnpm.cmd exec vitest run apps/editor/src/ai-command-host/editor-ai-command-host.test.ts apps/editor/src/editor-workflow/selected-psd-layer-batch-intake-workflow.test.ts` | Passed with approved escalation: 2 files / 17 tests. |
| `pnpm.cmd exec vitest run packages/ai-interface/src/ai-command-schema.test.ts packages/ai-interface/src/ai-psd-import-plan-command.test.ts packages/ai-interface/src/ai-codex-proposal-validation.test.ts packages/ai-interface/src/ai-operation-command.test.ts apps/editor/src/ai-command-host/editor-ai-command-host.test.ts apps/editor/src/editor-workflow/selected-psd-layer-batch-intake-workflow.test.ts` | Passed with approved escalation after review fix: 6 files / 53 tests. |
| `pnpm.cmd exec vitest run packages/ai-interface/src/ai-psd-import-plan-command.test.ts packages/ai-interface/src/ai-operation-command.test.ts packages/ai-interface/src/ai-codex-proposal-approval-lifecycle.test.ts` | Review-fix focused run passed with approved escalation: 3 files / 23 tests. |
| `pnpm.cmd typecheck` | Passed. Root `tsc --noEmit` and editor `tsc --noEmit -p tsconfig.json` passed. |
| `node scripts/check-psd-parser-import-boundary.mjs` | Passed. `5` direct import/resolve sites remain limited to approved adapter and Wave44 scripts. |
| `pnpm.cmd run check:source` | Passed. Source organization guard passed. |
| `pnpm.cmd run check:deps` | Passed. Dependency guard passed. |
| Changed-file forbidden/smart automation scan with `rg -n -i 'llm|provider|prompt|natural[- ]language|proposal generation|generateProposal|generate proposal|semantic class|classification|rank|candidate ranking|auto[- ]?fix|automatic commit|http|websocket|mcp|external transport|one[- ]click|recursive group|group-as-artmesh|all-layer|smart|visible ui|suggestion|server|fetch\(' ...` | Hits classified as existing unsupported-boundary catalog declarations, Domain A/B and Domain C boundary-report prose stating forbidden work was not implemented, test false positives (`provideRuntimeEvidence`), existing names (`TutorialSmallMeshEdit`), and `parserVersion` evidence fields. No forbidden implementation, transport, proposal generation, LLM/provider, smart UI, parser expansion, or automatic commit found. |
| `git diff --check -- packages/contracts/src packages/ai-interface/src apps/editor/src discussion/implementation/waves/wave49 discussion/implementation/reviews/wave49` | Passed by exit code `0`; Git emitted LF-to-CRLF working-copy warnings only. |

## Compatibility Notes

- Existing `dryRunOperation` / `commitOperation` lifecycle and approval semantics are preserved.
- Generic approval records remain backward-compatible; `approvalContextDigest` is optional and only PSD import-plan preflight/execute uses it.
- Existing read commands and operation-only executor behavior remain backward-compatible; new PSD commands receive command-matching `not_implemented` payloads if no PSD host is attached.
- The Editor bridge uses current explicit PSD import-plan workflow state and the existing explicit selected-layer batch operation path. It does not add a visible UI surface.
- Domain B result evidence is consumed additively; no package-format or operation-core DTO changes were made in Domain C.
- No package manifest, lockfile, dependency, parser import, HTTP/WebSocket/MCP server, or validator-core file was changed by this domain.

## Residual Risks / Follow-Up

- The command surface depends on the current explicit PSD import-plan state being present in the Editor workflow. Calls without a current plan/source fail deterministically through command diagnostics.
- `setPsdImportPlanApproval` regenerates the preview through the existing explicit plan preview workflow; expected-plan digests are checked before preflight/execute to prevent stale intake.
- Review-Sylph should review the new DTO surface for naming and response-shape fit before this is treated as final integration.
