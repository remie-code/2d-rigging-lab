# Wave50 Domain B Review: Package / Operation Hierarchy Scaffold Contracts

> Target: `wave50-package-operation-hierarchy-scaffold-contracts`
> Role: Review-Sylph independent clean-context review
> Verdict: `pass`
> Reviewed: 2026-06-07

## Verdict

`pass`

No blocking findings. Domain B is additive package/operation contract and evidence work only. Domain C can start after this review.

## Findings

No blocking findings.

Non-blocking carry-forward:

- Domain C must still implement execution, including generated group part creation, leaf routing under generated parents, hidden source leaf to initially runtime-hidden drawable mapping, sourceOrder-derived ordering, cap/stale/collision/byte preflight blocking, and preservation of old leaf-only behavior.
- If Domain C emits structural operation evidence through the generic `OperationEvidenceResultSchema` / evidence provider path, it should deliberately extend that path. Domain B only added `OperationResultSchema.psdStructuralScaffoldEvidence`.

## Review Basis

Read directly:

- `discussion/design/codex-friendly-automation-policy.md`
- `discussion/implementation/orchestration/wave50-plan.md`
- `discussion/implementation/waves/wave50/wave50-domain-a-boundary-hidden-target-inventory-report.md`
- `discussion/implementation/reviews/wave50/wave50-domain-a-boundary-hidden-target-inventory-review.md`
- `discussion/implementation/waves/wave50/wave50-domain-b-package-operation-hierarchy-scaffold-contracts-report.md`
- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/development_convention/schema-and-id-conventions.md`
- All changed target source/test files listed in the subagent assignment.

## Compliance Review

- Automation / forbidden scope: pass. The new contracts describe explicit structural scaffold evidence only. Boundary literals deny raw parser object persistence, source PSD byte persistence, semantic recognition, repo proposal generation, initial grid mesh generation, Photoshop compositing, and renderer pixel oracle claims in `packages/package-format/src/psd-structural-scaffold-evidence.ts:194`, `packages/package-format/src/psd-structural-scaffold-evidence.ts:240`, and `packages/operation-core/src/psd-structural-scaffold-evidence.ts:307`. A structural-symbol scan found no added structural implementation in `apps/editor/**`, `packages/ai-interface/**`, `packages/validator-core/**`, or `scripts/**`.
- Scope: pass. Reviewed changes stay within `packages/package-format/src/**`, `packages/operation-core/src/**`, tests, and the Domain B report/review paths. No parser behavior, validator behavior, Editor UI, external transport, operation execution handler, semantic recognition, group-as-drawable execution, initial grid mesh generation, or Photoshop compositing was added.
- Backward compatibility: pass. Existing Wave48/Wave49 leaf-only shapes remain intact: `PsdImportPlanGeneratedScaffoldSchema` and `PsdImportPlanApprovedLeafRefSchema` are unchanged in `packages/package-format/src/psd-import-plan-evidence.ts:48` and `packages/package-format/src/psd-import-plan-evidence.ts:184`. `OperationTypeSchema` and `OperationPayloadSchema` still do not register `importPsdStructuralScaffold` (`packages/operation-core/src/operation-type.ts:3`, `packages/operation-core/src/operation-payload.ts:38`), while the old batch payload remains parseable in `packages/operation-core/src/psd-structural-scaffold-contracts.test.ts:57`.
- Group vs leaf contracts: pass. Group part containers and leaf drawable scaffolds are separate strict schemas in `packages/package-format/src/psd-structural-scaffold-evidence.ts:69` and `packages/package-format/src/psd-structural-scaffold-evidence.ts:89`, mirrored in operation-core at `packages/operation-core/src/psd-structural-scaffold-evidence.ts:77` and `packages/operation-core/src/psd-structural-scaffold-evidence.ts:97`. Groups carry generated part refs only; leaves carry generated drawable/texture/mesh refs.
- Hidden visibility contract: pass. `initialRuntimeVisibility` is required to match `visibleInSource` by `superRefine` in `packages/package-format/src/psd-structural-scaffold-evidence.ts:108` and `packages/operation-core/src/psd-structural-scaffold-evidence.ts:116`.
- Source manifest / persistence truthfulness: pass. Structural plan and approval evidence arrays are optional on the PSD profile at `packages/package-format/src/source-manifest.ts:270`, preserving old manifests. Serialized evidence tests reject raw parser/source byte payload leakage by checking for absence of `rawLayerObject`, `sourcePsdBytes`, and `rawRgba` in `packages/package-format/src/psd-structural-scaffold-evidence.test.ts:43`.
- Payload/result shape: pass. `ImportPsdStructuralScaffoldPayloadSchema` exists as a standalone contract at `packages/operation-core/src/payloads/import-psd-structural-scaffold.ts:22`, and operation results can carry structural evidence at `packages/operation-core/src/operation-result.ts:46`. This does not imply current execution support because operation type/payload registration is intentionally absent.
- Source organization / exports: pass. `packages/operation-core/src/index.ts` remains barrel-only and adds only re-exports. New source files are responsibility-scoped schema/evidence files, not broad catch-all files.

## Test Adequacy Review

Adequate for Domain B.

- Positive structural parse and source manifest integration are covered in `packages/package-format/src/psd-structural-scaffold-evidence.test.ts:14`.
- Group-as-drawable strictness is covered in `packages/package-format/src/psd-structural-scaffold-evidence.test.ts:47` and `packages/operation-core/src/psd-structural-scaffold-contracts.test.ts:72`.
- Hidden visibility mismatch rejection is covered in `packages/package-format/src/psd-structural-scaffold-evidence.test.ts:58` and `packages/operation-core/src/psd-structural-scaffold-contracts.test.ts:79`.
- Invalid cap shape rejection is covered in `packages/package-format/src/psd-structural-scaffold-evidence.test.ts:67` and `packages/operation-core/src/psd-structural-scaffold-contracts.test.ts:87`.
- Operation result/payload evidence shape and intentional non-registration of execution are covered in `packages/operation-core/src/psd-structural-scaffold-contracts.test.ts:14`.
- Old leaf-only compatibility is covered in `packages/operation-core/src/psd-structural-scaffold-contracts.test.ts:57`; existing source-manifest tests also continue to parse profiles without the new optional structural arrays.

## Verification Performed

- `git diff --check -- packages discussion/implementation/waves/wave50 discussion/implementation/reviews/wave50`: pass; Git emitted LF/CRLF working-copy warnings only.
- `node scripts/check-psd-parser-import-boundary.mjs`: pass; 5 approved direct import/resolve sites.
- `pnpm.cmd run check:source`: pass.
- Focused Vitest command initially failed in sandbox with esbuild `spawn EPERM`; approved rerun passed 5 files / 32 tests:
  - `packages/package-format/src/psd-structural-scaffold-evidence.test.ts`
  - `packages/operation-core/src/psd-structural-scaffold-contracts.test.ts`
  - `packages/package-format/src/source-manifest.test.ts`
  - `packages/operation-core/src/operations/import-psd-layer-materialization-batch.test.ts`
  - `packages/operation-core/src/operation-schemas.test.ts`
- `pnpm.cmd typecheck`: pass.
- `rg` forbidden-scope scan over changed target files and structural-symbol scan over `apps/editor`, `packages/ai-interface`, `packages/validator-core`, and `scripts`: pass for Domain B scope.

## Files Changed By Review

- `discussion/implementation/reviews/wave50/wave50-domain-b-package-operation-hierarchy-scaffold-contracts-review.md`

## Remaining Risks And User-Decision Points

- No Domain B user decision is required.
- Future decisions remain outside Domain B: group visibility/opacity runtime semantics, higher caps, initial grid mesh generation, Photoshop compositing, renderer/pixel oracle, external transport, public sample-derived assets, and Cubism compatibility.

## Domain C Readiness

Domain C can start.
