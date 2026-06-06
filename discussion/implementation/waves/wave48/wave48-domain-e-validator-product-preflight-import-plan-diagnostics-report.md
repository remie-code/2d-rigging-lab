# Wave48 Domain E Report: Validator / Product Preflight Import Plan Diagnostics

> Target: `wave48-validator-product-preflight-import-plan-diagnostics`
> Role: Gnome implementation agent
> Verdict candidate: `pass`

## Verdict

verdict: `pass`

Wave48 Domain E is implemented for parser-free import-plan candidate and approval evidence diagnostics in validator-core and session-generated Product Preflight reporting. The validator now consumes Domain C import-plan bridge evidence as an optional evidence contract, checks it without parser execution, and reports unsupported, hidden, not-approved, byte-cap-blocked, generated collision, preflight-blocked, partial, mismatch, stale-source, missing-current-byte, and private/local provenance boundary states through cataloged diagnostics.

The change does not implement parser execution, Editor UI, persisted/exported Product Preflight artifacts, renderer/pixel oracle proof, all-layer import, recursive group auto import, Cubism claims, public demo asset claims, repo-side AI/LLM/auto-fix behavior, package/operation contract changes, or dependency expansion.

## Basis Documents Used

- `.agents/skills/implementation-orchestration/SKILL.md`
- `C:/Users/remie/.codex/skills/subagent-context-hygiene/SKILL.md`
- `discussion/implementation/orchestration/wave48-plan.md`
- `discussion/implementation/current-capability-map.md`
- `discussion/implementation/remaining-work-backlog.md`
- `discussion/implementation/waves/wave48/wave48-domain-a-import-plan-boundary-sample-group-inventory-report.md`
- `discussion/implementation/reviews/wave48/wave48-domain-a-import-plan-boundary-sample-group-inventory-review.md`
- `discussion/implementation/waves/wave48/wave48-domain-c-package-operation-import-plan-approval-bridge-report.md`
- `discussion/implementation/reviews/wave48/wave48-domain-c-package-operation-import-plan-approval-bridge-review.md`
- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/development_convention/dependency-policy.md`
- `discussion/development_convention/diagnostic-policy.md`
- `discussion/development_convention/schema-and-id-conventions.md`
- `discussion/tests/fixtures/fixture-manifest.md`
- `discussion/tests/traceability/test-traceability-matrix.md`

## Implementation Summary

- Extended PSD materialized batch diagnostics to accept optional Domain C `importPlanBridge` evidence through package-format parser-free schemas, without adding an operation-core dependency.
- Added an opt-in `requireImportPlanBridgeEvidence` / `requirePsdImportPlanBridgeEvidence` path so callers can truthfully report missing bridge evidence instead of silently treating import-plan status as evaluated.
- Added import-plan bridge validation for:
  - missing or malformed parser-free bridge evidence
  - missing private/local boundary facts and unsupported public demo/source-byte persistence provenance
  - stale source PSD digest/byteLength/source asset identity
  - missing current source byte identity
  - candidate count, digest, approved-ref, order, approval status, generated scaffold preview, and destination mismatches
  - hidden, unsupported, empty, duplicate, generated collision, byte-cap-blocked, and not-approved candidate states
  - approval/batch preflight blocked states
  - partial bridge-plus-batch states
- Added Product Preflight mapping so missing import-plan bridge evidence becomes a truthful `assetBytes` `not_evaluated` result with a `sourceMaterialization` diagnostic reference.
- Added catalog entries for all new validator diagnostics, keeping evidence text bounded to parser-free, session-only Product Preflight facts.
- Preserved Wave47 bridge-less batch diagnostics compatibility; existing materialized-batch diagnostics still run when no import-plan bridge is supplied and the bridge is not required.

## Files Changed

- `packages/validator-core/src/validators/psd-materialized-batch-diagnostics.ts`
- `packages/validator-core/src/validators/package-runtime.ts`
- `packages/validator-core/src/check-catalog.ts`
- `packages/validator-core/src/product-preflight-report.ts`
- `packages/validator-core/src/psd-materialized-batch-diagnostics.test.ts`
- `packages/validator-core/src/product-preflight-report.test.ts`
- `discussion/implementation/waves/wave48/wave48-domain-e-validator-product-preflight-import-plan-diagnostics-report.md`

No `apps/**`, parser implementation, `packages/operation-core/**`, `packages/package-format/**`, package manifests, lockfiles, fixture bytes, or Product Preflight export/persistence artifacts were intentionally edited by Domain E.

## Tests Added / Updated

- Focused materialized-batch diagnostics tests for approved import-plan bridge evidence with hidden, unsupported, byte-cap-blocked, generated-collision, and not-approved candidate summaries.
- Focused materialized-batch diagnostics tests for selected not-approved/blocked candidates and candidate/approval mismatch diagnostics.
- Focused materialized-batch diagnostics tests for stale source identity, missing current package-local source PSD bytes, approval preflight blocked state, and selected `emptyZeroSize` blocking status.
- Focused materialized-batch diagnostics tests for missing required import-plan bridge evidence and Product Preflight `not_evaluated` mapping.
- Focused materialized-batch diagnostics tests for partial bridge state and malformed/private-local provenance boundary evidence.
- Focused Product Preflight report test for direct `asset.psd.importPlanEvidenceMissing` diagnostic mapping.
- Catalog coverage for the new import-plan diagnostic ids.

## Review Fix Loop

Review-Sylph returned `needs_fix` for test adequacy in `discussion/implementation/reviews/wave48/wave48-domain-e-validator-product-preflight-import-plan-diagnostics-review.md`.

Fixes applied:

- Added behavioral coverage for `asset.psd.importPlanSourceStale` by mutating bridge source digest and byteLength evidence away from the current source PSD identity.
- Added behavioral coverage for `asset.psd.importPlanSourceCurrentBytesMissing` by marking the current source PSD `binaryAssetRef.storageStatus` as `missing-package-local-bytes-v1`.
- Added behavioral coverage for `asset.psd.importPlanPreflightBlocked` by using parser-free approval evidence with `approvalStatus=preflightBlocked`.
- Added direct selected-candidate coverage for `emptyZeroSize` in the blocking status evidence path.

## Verification Performed

| Command / check | Result | Notes |
|---|---|---|
| `pnpm.cmd exec vitest run packages/validator-core/src/psd-materialized-batch-diagnostics.test.ts packages/validator-core/src/product-preflight-report.test.ts` | pass | 2 files / 26 tests passed after rerun with approved escalation. The first sandboxed run failed with Vitest/esbuild `spawn EPERM` while loading config. |
| `pnpm.cmd typecheck` | pass | Root and editor TypeScript checks passed in the current worktree. |
| `pnpm.cmd run typecheck:root` | pass | Root package TypeScript check passed. |
| `pnpm.cmd run check:source` | pass | Source organization guard passed. |
| `pnpm.cmd run check:deps` | pass | Dependency guard passed; no validator-core dependency expansion was needed. |
| `node scripts\check-psd-parser-import-boundary.mjs` | pass | Parser import boundary remained limited to approved adapter and Wave44 scripts. |
| `git diff --check -- packages/validator-core/src discussion/implementation/waves/wave48 discussion/implementation/reviews/wave48` | pass | LF-to-CRLF Git warnings only; no whitespace findings. |
| `Select-String -Path discussion/implementation/waves/wave48/wave48-domain-e-validator-product-preflight-import-plan-diagnostics-report.md -Pattern '\s+$'` | pass | Supplemental scan covered this new untracked report file. |

## Remaining Issues

- Domain E validates import-plan bridge evidence attached to batch diagnostics. Standalone package-format source-manifest import-plan evidence arrays are not turned into separate Product Preflight diagnostics in this wave.

## User-Decision Points

None required for Domain E.

Future decisions remain outside Domain E: Product Preflight persistence/export, Editor UI surfacing, parser-backed candidate discovery, public/demo asset policy, all-layer import, recursive group import, renderer/pixel oracle proof, Cubism claims, and any repo-side AI/LLM or auto-fix behavior.

## Provisional Assumptions

- Wave47 final pass remains the implementation-proven baseline for batch materialization diagnostics.
- Wave48 Domain A, B, and C are treated as pass per orchestration instruction.
- Domain C `importPlanBridge` evidence is the supported parser-free contract for connecting candidate/approval facts to validator diagnostics in this wave.
- Product Preflight output remains session-generated and read-only; diagnostics must not imply persisted/exported artifacts or parser execution.
- `sourceBytePersistence: "metadataOnlyNoRawBytes"` and `publicDemoAsset=false` are required provenance facts when bridge evidence is present.
