# Wave48 Domain C Report: Package / Operation Import Plan Approval Bridge

> Target: `wave48-package-operation-import-plan-approval-bridge`
> Role: Gnome implementation agent
> Verdict candidate: `pass`

## Verdict

verdict: `pass`

Wave48 Domain C is implemented for the parser-free package/operation evidence bridge. The change adds import-plan candidate and approval evidence shapes, records candidate-plan and approval-selection digests, records source PSD identity by hash/byteLength/source asset id without source-byte persistence, keeps not-approved and blocked candidate summaries separate from approved leaves, and connects only the approved ordered leaf refs to the existing Wave47 batch materialization/intake path.

The bridge remains limited to explicit approved leaf-layer intake. It does not implement Editor UI, browser parser logic, validator diagnostics, all-layer import, recursive group auto import, drag-drop, archive/filesystem access, full compositing, renderer/pixel oracle, texture correctness oracle, Cubism claims, public demo assets, repo-side AI/LLM behavior, or auto-fix behavior.

## Basis Documents Used

- `.agents/skills/implementation-orchestration/SKILL.md`
- `C:/Users/remie/.codex/skills/subagent-context-hygiene/SKILL.md`
- `discussion/implementation/orchestration/wave48-plan.md`
- `discussion/implementation/current-capability-map.md`
- `discussion/implementation/remaining-work-backlog.md`
- `discussion/implementation/waves/wave48/wave48-domain-a-import-plan-boundary-sample-group-inventory-report.md`
- `discussion/implementation/reviews/wave48/wave48-domain-a-import-plan-boundary-sample-group-inventory-review.md`
- `discussion/implementation/waves/wave47/wave47-domain-h-integration-review-and-final-report.md`
- `discussion/implementation/reviews/wave47/wave47-domain-h-clean-integration-review.md`
- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/development_convention/dependency-policy.md`
- `discussion/development_convention/diagnostic-policy.md`
- `discussion/development_convention/schema-and-id-conventions.md`
- `discussion/tests/fixtures/fixture-manifest.md`
- `discussion/tests/traceability/test-traceability-matrix.md`
- Wave45 Domain C package/import report and review
- Wave46 Domain C operation rehydration report and review
- Wave47 Domain C batch intake report and review
- Wave47 Domain F focused e2e persistence report

## Implementation Summary

- Added package-format import-plan evidence schemas for parser-free candidate plans, approval selections, source PSD identity, candidate statuses, not-approved/blocked summaries, destination parent part, generated scaffold preview/resolved ids, and boundary flags.
- Extended `LayeredCharacterPsdProfileSchema` with optional `importPlanCandidateEvidence` and `importPlanApprovalEvidence` arrays without renaming existing fields.
- Added operation-core import-plan approval bridge schemas so operation payload/evidence can carry the same parser-free facts without adding a package-format dependency or parser dependency.
- Extended `ImportPsdLayerMaterializationBatchPayloadSchema` and batch operation evidence with optional `importPlanBridge`.
- Connected `importPlanBridge` to `importPsdLayerMaterializationBatch` preflight and result evidence. Requests without the bridge keep the Wave47 batch path behavior.
- Added import-plan preflight diagnostics before mutation. The operation now rejects stale or mismatched evidence before cloning/committing approved entries.

## Bridge Preflight Coverage

The Domain C bridge validates these facts before the existing Wave47 batch materialization/intake path can execute:

- candidate plan digest matches the approval evidence candidate plan digest
- approval status is `approved`
- approved leaf refs match the batch entry refs and order
- source asset id, source PSD digest, and byteLength match the materialization provenance
- approval destination parent matches the batch destination parent
- each approved ref exists in the candidate plan
- not-approved candidates and blocked candidates are not passed to batch intake
- hidden, unsupported, zero-size, duplicate-ref, generated-id/name collision, and byte-cap-blocked candidate statuses block execution
- generated scaffold preview/resolved ids match the generated texture/drawable/mesh/part targets

For approved materialized leaves, the existing Wave47 evidence is preserved: raw RGBA binary asset refs, mediaType `application/vnd.ai-native-live2d.raw-rgba; pixelFormat=rgba8`, digest, byteLength, width, height, source layer ref/path, extraction options, operation id, private/local provenance, and `publicDemoAsset=false`.

## Files Changed

- `packages/package-format/src/psd-import-plan-evidence.ts`
- `packages/package-format/src/source-manifest.ts`
- `packages/package-format/src/source-manifest.test.ts`
- `packages/operation-core/src/psd-import-plan-approval-evidence.ts`
- `packages/operation-core/src/psd-layer-materialization-batch-operation-evidence.ts`
- `packages/operation-core/src/payloads/import-source.ts`
- `packages/operation-core/src/index.ts`
- `packages/operation-core/src/operations/import-psd-layer-materialization-batch.ts`
- `packages/operation-core/src/operations/import-psd-layer-materialization-batch-import-plan.ts`
- `packages/operation-core/src/operations/import-psd-layer-materialization-batch.test.ts`
- `discussion/implementation/waves/wave48/wave48-domain-c-package-operation-import-plan-approval-bridge-report.md`

No `apps/**`, `packages/validator-core/**`, package manifest, lockfile, dependency registry, fixture byte, public demo asset, raw parser object, source PSD byte payload, or review artifact was intentionally edited by Domain C.

## Tests Added / Updated

- Package-format source manifest round-trip coverage for import plan candidate evidence and approval evidence, including source PSD hash/byteLength, not-approved/blocked summary, generated scaffold preview/resolved ids, candidate/approval digests, and absence of raw parser/source byte payloads.
- Operation-core batch tests for:
  - recording import-plan approval bridge evidence while materializing only approved leaves
  - rejecting stale or mismatched import plan approval evidence before mutating the session
  - rejecting not-approved candidates before materializing approved entries
  - preserving existing bridge-less Wave47 batch path compatibility

## Verification Performed

| Command / check | Result | Notes |
|---|---|---|
| `pnpm.cmd run typecheck:root` | pass | Root TypeScript check passed after the Domain C exact-optional-property fixes. |
| `pnpm.cmd exec vitest run packages/package-format/src/source-manifest.test.ts packages/operation-core/src/operations/import-psd-layer-materialization-batch.test.ts` | pass | 2 files / 18 tests passed. Run with approved escalation because sandboxed Vitest previously hit an esbuild config `EPERM`. |
| `rg -n --glob *.ts --glob *.tsx 'from\s+[''\"](@webtoon/psd|ag-psd)[''\"]|require\(\s*[''\"](@webtoon/psd|ag-psd)[''\"]\s*\)' packages` | pass | Exit code 1 with no output; no direct parser imports were found in `packages/**`. |
| `pnpm.cmd run check:source` | pass | Source organization guard passed. |
| `pnpm.cmd run check:deps` | pass | Dependency guard passed. |
| `git diff --check -- packages/package-format/src packages/operation-core/src discussion/implementation/waves/wave48 discussion/implementation/reviews/wave48` | pass | LF-to-CRLF Git warnings only; no whitespace findings. New untracked files were also covered by a supplemental trailing-whitespace scan in the final handoff. |
| `pnpm.cmd typecheck` | pass | Review-Sylph reran this in the current worktree after the transient out-of-scope `apps/editor/**` failures were resolved. |
| `pnpm.cmd test:unit` | pass | Review-Sylph reran this in the current worktree: 239 files / 1225 tests passed. |

## Current Worktree Notes

Pre-existing Wave48 orchestration/report artifacts were present before this task. Additional `apps/editor/**` changes appeared in the worktree during the implementation window and were not edited by Domain C. During the original Gnome handoff they caused transient full-suite failures outside Domain C; Review-Sylph reran `pnpm.cmd typecheck` and `pnpm.cmd test:unit` in the current worktree and both now pass.

## Remaining Issues

None blocking for Domain C after Review-Sylph pass-with-note.

Domain C intentionally does not create UI, parser candidate discovery, validator diagnostics, or focused e2e coverage; those remain for their assigned domains.

## User-Decision Points

None required for Domain C.

Future decisions remain outside Domain C: higher approval caps, hidden leaf materialization, all-layer import, recursive group import, public/demo asset policy, Product Preflight durability/export, and any UI/parser/validator expansion.

## Provisional Assumptions

- Wave47 final pass remains the implementation-proven baseline for batch raw RGBA intake and generated scaffold evidence.
- Wave48 Domain A report/review is accepted as the current candidate-plan boundary and sample-root inventory evidence.
- The approval-selection digest is treated as immutable approval evidence owned by the caller that constructs the parser-free plan/approval bridge.
- `sourceBytePersistence: "metadataOnlyNoRawBytes"` and `publicDemoAsset=false` are required boundary facts for source PSD identity in this wave.
