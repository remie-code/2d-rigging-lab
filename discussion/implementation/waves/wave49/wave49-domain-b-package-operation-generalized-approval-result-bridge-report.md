# Wave49 Domain B Report: Package / Operation Generalized Approval Result Bridge

> Target: `wave49-package-operation-generalized-approval-result-bridge`
> Role: Gnome implementation agent
> Verdict candidate: `pass`

## Verdict

verdict candidate: `pass`

Wave49 Domain B generalizes the package/operation import-plan approval/result bridge without replacing the Wave48 fixed3 path. The implementation keeps the existing parser-free candidate/approval bridge and bridge-less batch path compatible, then adds additive result evidence so downstream Codex/UI/validator domains can read arbitrary explicitly approved leaf refs, stable generated refs, per-leaf results, and machine-readable issue kinds.

This domain did not implement Editor UI, ai-interface command host behavior, validator diagnostics, parser candidate discovery, proposal generation, semantic classification, all-layer one-click import, recursive group auto import, group-as-artmesh import, direct parser imports in `packages/**`, dependency changes, package manifest changes, lockfile changes, persisted source PSD bytes, or raw parser object persistence.

## Basis Used

- `discussion/implementation/orchestration/wave49-plan.md`
- `discussion/design/codex-friendly-automation-policy.md`
- `discussion/implementation/waves/wave49/wave49-domain-a-boundary-target-inventory-operation-parity-report.md`
- `discussion/implementation/reviews/wave49/wave49-domain-a-boundary-target-inventory-operation-parity-review.md`
- `discussion/implementation/waves/wave48/wave48-final-integration-report.md`
- `discussion/implementation/reviews/wave48/wave48-final-integration-review.md`
- `discussion/implementation/waves/wave48/wave48-domain-b-browser-psd-import-plan-candidate-service-report.md`
- `discussion/implementation/reviews/wave48/wave48-domain-b-browser-psd-import-plan-candidate-service-review.md`
- `discussion/implementation/waves/wave48/wave48-domain-c-package-operation-import-plan-approval-bridge-report.md`
- `discussion/implementation/reviews/wave48/wave48-domain-c-package-operation-import-plan-approval-bridge-review.md`
- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/development_convention/dependency-policy.md`
- `discussion/development_convention/schema-and-id-conventions.md`
- Relevant current source/tests under `packages/package-format/src/**` and `packages/operation-core/src/**`.

## Implementation Summary

- Added additive `PsdImportPlanIssueKind` / `PsdImportPlanIssue` schemas to package-format and operation-core import-plan evidence. The issue kind taxonomy includes stale plan, stale approval, missing candidate, blocked candidate, not-approved, collision, destination parent, source identity mismatch, byte unavailable, byte cap exceeded, partial failure, unsupported/hidden/empty candidate, current-session source missing, and private/local provenance failure.
- Kept `PsdImportPlanApprovalEvidence.issues` optional for public DTO compatibility. Existing Editor-side approval evidence construction does not need to add the new field.
- Extended batch operation evidence additively with generated `evidenceId`, batch `operationId`, entry `approvedLeafRef`, `approvalOrder`, `resultRefs`, aggregate `issues`, and per-entry `issues`.
- Result refs now expose stable materialization evidence id, materialization id, child operation id, generated part/drawable/mesh/texture ids, and batch evidence id after success or preflight rejection.
- Preserved existing batch diagnostics/check IDs while mapping them into stable issue kinds in result evidence.
- Added preflight rejection for an approved leaf ref that still carries `notApproved` in approval statuses.
- Added candidate status evidence tokens so hidden, unsupported, and empty candidate failures can be distinguished from generic blocked-candidate failures.
- Preserved pre-mutation blocking behavior for stale plan/approval, missing/mismatched source identity, destination mismatch, not-approved candidates, blocked candidates, collisions, byte unavailable/cap states, and child preflight failures.

## Focused Test Coverage

- Package-format source manifest round-trip now covers import-plan issue records without raw parser objects or source PSD byte payloads.
- Operation-core batch tests now cover:
  - stable result refs and approved leaf refs on the bridge-enabled success path;
  - arbitrary non-fixed approved eligible leaf `front hair` / `psd:root/group[2]/layer[0]` with generated `part_front_hair`, `draw_front_hair`, `mesh_front_hair`, `tex_front_hair`, `mat_psd_root_group_2_layer_0`, and child operation id `op_import_psd_batch_0_front_hair`;
  - not-approved candidate rejection with `issueKind: "notApproved"`;
  - hidden blocked target `headwear` / `psd:root/layer[1]` rejection with `issueKind: "hiddenCandidate"` and `issueKind: "blockedCandidate"`;
  - existing bridge-less batch path compatibility and Wave48-style bridge-enabled approved-only path.

## Files Changed

- `packages/package-format/src/psd-import-plan-evidence.ts`
- `packages/package-format/src/source-manifest.ts`
- `packages/package-format/src/source-manifest.test.ts`
- `packages/operation-core/src/psd-import-plan-approval-evidence.ts`
- `packages/operation-core/src/psd-layer-materialization-batch-operation-evidence.ts`
- `packages/operation-core/src/preconditions.ts`
- `packages/operation-core/src/operations/import-psd-layer-materialization-batch-import-plan.ts`
- `packages/operation-core/src/operations/import-psd-layer-materialization-batch.ts`
- `packages/operation-core/src/operations/import-psd-layer-materialization-batch.test.ts`
- `discussion/implementation/waves/wave49/wave49-domain-b-package-operation-generalized-approval-result-bridge-report.md`

No `apps/**`, `packages/ai-interface/**`, `packages/validator-core/**`, package manifest, lockfile, parser dependency, fixture byte, generated asset, or review result artifact was intentionally edited.

## Verification Performed

| Command / check | Result |
|---|---|
| `pnpm.cmd exec vitest run packages/package-format/src/source-manifest.test.ts packages/operation-core/src/operations/import-psd-layer-materialization-batch.test.ts` | Initial sandbox run failed at Vitest config load with esbuild `spawn EPERM`; approved escalated run passed: 2 files / 20 tests. |
| Same focused Vitest command after typecheck compatibility fix | Passed with approved escalation: 2 files / 20 tests. |
| `pnpm.cmd typecheck` | Passed. Root `tsc --noEmit` and editor `tsc --noEmit -p tsconfig.json` passed. |
| `node scripts/check-psd-parser-import-boundary.mjs` | Passed. `5` direct import/resolve sites remain limited to approved adapter and Wave44 scripts. |
| `pnpm.cmd run check:source` | Passed. Source organization guard passed. |
| `pnpm.cmd run check:deps` | Passed. Dependency guard passed. |
| `rg -n --glob *.ts --glob *.tsx 'from\s+[''"](@webtoon/psd|ag-psd)[''"]|require\(\s*[''"](@webtoon/psd|ag-psd)[''"]\s*\)' packages` | Passed by exit code `1` with no output; no direct parser import/require in `packages/**`. |
| `git diff --check -- packages/package-format/src packages/operation-core/src discussion/implementation/waves/wave49 discussion/implementation/reviews/wave49` | Passed with Git LF-to-CRLF working-copy warnings only. |

## Compatibility Notes

- Bridge-less `importPsdLayerMaterializationBatch` behavior remains supported; new batch evidence fields are additive.
- Wave48 fixed3 compatibility is preserved because generated ids still come from existing display-name/path id generation, and existing `headwear`, `eyewear`, and `tie / tie` style bridge evidence remains valid.
- `PsdImportPlanApprovalEvidence.issues` is optional to avoid a public DTO break for existing Editor/operation evidence builders.
- Existing operation diagnostic check IDs were not renamed. New `issueKind` records provide the generalized machine-readable taxonomy without destabilizing prior diagnostics.
- `index.ts` files remain barrel-only; no package manifest or lockfile changed.

## Assumptions And Residual Risks

- Domain B proves package/operation contracts with focused synthetic operation fixtures. Browser candidate generation, Editor UI, ai-interface command routing, validator/Product Preflight diagnostics, and focused e2e are intentionally left for later Wave49 domains.
- `front hair` execution here verifies package/operation behavior for the Domain A selected ref shape and target metadata; actual browser/e2e materialization evidence for `test_data/sample_model.psd` remains downstream work.
- The issue taxonomy mapper is intentionally conservative. Unknown future diagnostics map to `partialFailure` until a later domain adds a more specific explicit mapping.
- Source PSD bytes and raw parser objects remain excluded from package/session evidence; materialized bytes are referenced only through binary asset refs.
