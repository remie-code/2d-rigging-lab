# Wave50 Domain F Review: Validator / Product Preflight Structural Diagnostics

> Target: `explicit-psd-subtree-hierarchy-scaffold-v0`
> Role: Wave50 Domain F clean re-review Sylph after fix pass
> Review lanes: Design / Development Compliance Review, Test Adequacy Review
> Verdict: `pass`

## Verdict

`pass`

The prior blocking findings are materially fixed. The validator remains parser-free, the structural diagnostics now catch wrong existing leaf parent routes, and missing current source bytes now produce truthful Product Preflight `assetBytes` `not_evaluated` handling through a `sourceMaterialization` claim. No new blocking design, development-compliance, or test-adequacy issue was found in the reviewed Domain F scope.

## Prior Blocking Findings Rechecked

### 1. Leaf generated parent consistency

Status: fixed.

Evidence reviewed:

- `packages/validator-core/src/validators/psd-structural-scaffold-diagnostics.ts:1082` calls `validateLeafGeneratedParentage` for every generated leaf scaffold.
- `packages/validator-core/src/validators/psd-structural-scaffold-diagnostics.ts:1133` through `packages/validator-core/src/validators/psd-structural-scaffold-diagnostics.ts:1167` emits `asset.psd.structuralScaffoldParentageMismatch` when `leaf.generatedParentPartId` does not match the parent generated from `leaf.sourceParentGroupRef`.
- `packages/validator-core/src/validators/psd-structural-scaffold-diagnostics.ts:1960` through `packages/validator-core/src/validators/psd-structural-scaffold-diagnostics.ts:1972` maps root leaves to the structural destination parent and nested leaves to the matching generated group part, returning `undefined` when a referenced source parent group has no generated group scaffold.
- `packages/validator-core/src/psd-structural-scaffold-diagnostics.test.ts:178` through `packages/validator-core/src/psd-structural-scaffold-diagnostics.test.ts:208` covers the previous gap: a nested leaf is routed to an existing but wrong root part while the drawable/parent membership is made internally consistent, and the expected parentage mismatch is still emitted.

### 2. Missing source asset bytes and Product Preflight not-evaluated state

Status: fixed.

Evidence reviewed:

- `packages/validator-core/src/validators/psd-structural-scaffold-diagnostics.ts:705` through `packages/validator-core/src/validators/psd-structural-scaffold-diagnostics.ts:724` now emits `asset.psd.structuralScaffoldSourceCurrentBytesMissing` as `status: "needs_review"` when the source asset has no `binaryAssetRef`.
- `packages/validator-core/src/validators/psd-structural-scaffold-diagnostics.ts:1640` through `packages/validator-core/src/validators/psd-structural-scaffold-diagnostics.ts:1647` only emits `asset.psd.structuralScaffoldAvailable` when there are no `fail` or `needs_review` checks.
- `packages/validator-core/src/product-preflight-report.ts:785` through `packages/validator-core/src/product-preflight-report.ts:797` treats the structural missing-current-bytes diagnostic as truthfully not evaluated only when the diagnostic status is `needs_review`.
- `packages/validator-core/src/product-preflight-report.ts:799` through `packages/validator-core/src/product-preflight-report.ts:818` maps that not-evaluated diagnostic to `sourceMaterialization`.
- `packages/validator-core/src/psd-structural-scaffold-diagnostics.test.ts:245` through `packages/validator-core/src/psd-structural-scaffold-diagnostics.test.ts:275` removes `sourceAsset.binaryAssetRef`, verifies the diagnostic is `needs_review`, verifies `structuralScaffoldAvailable` is absent, and verifies Product Preflight `assetBytes.status === "not_evaluated"` with a `sourceMaterialization` not-evaluated claim.

## Compliance Review

- Scope: pass. Reviewed Domain F source changes are limited to `packages/validator-core/src/**` plus the Domain F discussion artifacts requested for this domain.
- Parser boundary: pass. Static scans over the changed Domain F files found no dependency on `operation-core`, `apps/editor`, `ai-interface`, parser adapters, `@webtoon/psd`, `ag-psd`, `parsePsd`, or `fromPsd` in production validator code. The only parser package hits are fixture evidence strings in the structural diagnostics test.
- Automation policy: pass. The diagnostics preserve the Wave50 deterministic structural-copy boundary and explicitly record no semantic recognition, no repo proposal generation, no renderer/pixel oracle, no Photoshop compositing, no group-as-artmesh, and no initial grid mesh generation.
- Product Preflight DTO shape: pass. The mapping uses existing `assetBytes`, `modelStructure`, and `composition` categories; existing pass/fail/not_evaluated status shapes; existing diagnostic refs; and existing `sourceMaterialization` evidence/not-evaluated artifact kind.
- Check catalog: pass. The new structural check IDs are catalog-backed in `packages/validator-core/src/check-catalog.ts:1012` through `packages/validator-core/src/check-catalog.ts:1204`.
- Domain A/B/C alignment: pass. Domain F validates the contracts and execution evidence expected by the accepted Wave50 boundary: groups as part containers, leaves as drawable/texture/mesh scaffolds, parentage/sourceOrder, hidden initial runtime visibility, source identity/stale states, collision/blocker states, and parser-free persisted evidence.

## Test Adequacy Review

Adequate for Domain F pass.

The structural diagnostics test now covers the two prior blockers directly, plus catalog registration, successful parser-free evidence and `sourceMaterialization` evidence refs, aggregate preflight-blocked/collision projection, hidden runtime visibility mismatch, missing generated refs, stale/approval/source mapping issue projection, conditional not-evaluated behavior when plan/approval evidence exists without operation evidence, malformed group drawable claims, and malformed raw visibility evidence.

Existing PSD materialization/source-profile behavior remains covered by the root-provided focused validator suite:

- `packages/validator-core/src/psd-materialized-batch-diagnostics.test.ts`
- `packages/validator-core/src/product-preflight-report.test.ts`
- `packages/validator-core/src/psd-source-profile.test.ts`
- `packages/validator-core/src/psd-materialized-asset-diagnostics.test.ts`
- `packages/validator-core/src/psd-structural-scaffold-diagnostics.test.ts`

## Verification Considered / Performed

Considered root-provided verification after the fix pass:

- `pnpm.cmd typecheck`: pass.
- Focused validator Vitest: sandbox run failed with esbuild `spawn EPERM`; approved rerun passed 5 files / 62 tests.
- `node scripts/check-psd-parser-import-boundary.mjs`: pass, 5 approved direct import/resolve sites.
- `pnpm.cmd run check:source`: pass.
- `git diff --check -- apps/editor packages/validator-core discussion/implementation/waves/wave50 discussion/implementation/reviews/wave50`: pass, LF/CRLF warnings only.

Review-local verification:

- Read Wave50 plan, Codex-friendly automation policy, Domain A/B/C reports and reviews, Domain F report, and the existing Domain F review artifact.
- Inspected `psd-structural-scaffold-diagnostics.ts`, `psd-structural-scaffold-diagnostics.test.ts`, `package-runtime.ts`, `product-preflight-report.ts`, and `check-catalog.ts`.
- Ran targeted `rg` scans for the prior blocker IDs and code paths: `generatedParentPartId`, `sourceParentGroupRef`, `structuralScaffoldParentageMismatch`, `binaryAssetRef`, `structuralScaffoldSourceCurrentBytesMissing`, `structuralScaffoldAvailable`, `assetBytes`, `sourceMaterialization`, and `not_evaluated`.
- Ran targeted `rg` scans for forbidden parser/app/operation imports and parser execution terms in the changed Domain F files.
- Inspected Product Preflight category/evidence mapping and structural check catalog registration.

I did not rerun Vitest or typecheck in this clean re-review context because the root-provided approved rerun evidence already covers the fix pass and the sandbox path is known to fail on esbuild `spawn EPERM`.

## Review Artifact

- `discussion/implementation/reviews/wave50/wave50-domain-f-validator-product-preflight-structural-diagnostics-review.md`

## Remaining Issues / User-Decision Points

- No blocking Domain F issue remains.
- No direct user decision is required for Domain F.
- Integration-level Wave50 risks remain for later domains/final review: Editor/Codex-facing structural surfaces, focused e2e preservation, and final full-wave verification.
