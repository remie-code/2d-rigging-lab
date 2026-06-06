# Wave50 Domain F Report: Validator Product Preflight Structural Diagnostics

> Target: `explicit-psd-subtree-hierarchy-scaffold-v0`
> Role: Gnome implementation agent
> Domain: F - validator / Product Preflight structural diagnostics
> Verdict candidate: `pass`

## Verdict

verdict candidate: `pass`

Domain F adds parser-free validator-core diagnostics for Wave50 PSD structural scaffold operation evidence and wires those diagnostics into Product Preflight category aggregation. The implementation is additive, keeps Wave44-Wave49 PSD materialization/source-profile behavior intact, and does not edit operation-core, apps, parser adapters, contracts, or root maps.

The first clean review returned `needs_changes` for two diagnostic gaps. Undine applied a focused fix pass, and the current repository-level `pnpm.cmd typecheck` plus focused validator tests pass.

## Implementation Summary

- Added `validatePsdStructuralScaffoldDiagnostics` under validator-core.
  - Accepts structural evidence supplied to `validatePackageRuntime` without executing parser code or importing operation-core.
  - Emits truthful not-evaluated diagnostics only when structural evidence is required or source profile plan/approval evidence exists without operation evidence.
  - Projects structural operation issue kinds such as preflight blocked, stale plan/approval, current source missing, source group/layer mapping missing, parentage/order mismatch, generated ref collision, byte unavailable, and provenance blocked.
  - Validates group scaffold invariants: source group mapping, generated part existence, generated parent existence, parent/child membership, sourceOrder where model order is available, and group-as-part-container-only boundaries.
  - Validates leaf scaffold invariants: source layer mapping, generated parent/drawable/texture/mesh existence, drawable/mesh/texture linkage, parent membership, sourceOrder where available, and hidden initial runtime visibility.
  - Rejects malformed group drawable/texture/mesh claims.
- Wired structural evidence inputs through `validatePackageRuntime` and `validatePackageRuntimeWithBinaryAssets`.
- Added Product Preflight mapping for structural diagnostics into assetBytes, modelStructure, and composition categories, including sourceMaterialization evidence refs and not-evaluated claims.
- Registered the new Wave50 structural check IDs in `defaultCheckCatalog`.
- Added focused validator tests for successful evidence, preflight-blocked evidence, hidden runtime visibility mismatch, missing generated refs, stale/approval/source mapping issue projection, conditional not-evaluated behavior, malformed group drawable claims, and catalog registration.

## Fix Pass After Clean Review

The initial clean review identified two blocking gaps:

- A nested leaf could claim an existing but wrong `generatedParentPartId` while drawable/part references remained internally consistent.
- A source asset missing `binaryAssetRef` emitted a warning, allowing `structuralScaffoldAvailable` and preventing Product Preflight `not_evaluated` handling.

The fix pass:

- added leaf expected-parent validation from source parent group -> generated group part mapping;
- emits `asset.psd.structuralScaffoldParentageMismatch` when a nested leaf is routed to the wrong existing part or when its source parent group scaffold is missing;
- changed direct source `binaryAssetRef` absence to `needs_review`;
- added focused tests for wrong existing leaf parentage and missing current source bytes producing `assetBytes.status === "not_evaluated"` with no `structuralScaffoldAvailable` check.

## Files Changed By Domain F

- `packages/validator-core/src/validators/psd-structural-scaffold-diagnostics.ts`
- `packages/validator-core/src/psd-structural-scaffold-diagnostics.test.ts`
- `packages/validator-core/src/validators/package-runtime.ts`
- `packages/validator-core/src/product-preflight-report.ts`
- `packages/validator-core/src/check-catalog.ts`
- `discussion/implementation/waves/wave50/wave50-domain-f-validator-product-preflight-structural-diagnostics-report.md`

No `packages/contracts/src/**` change was required.

## Verification Performed

| Check | Result |
|---|---|
| `pnpm.cmd exec vitest run packages/validator-core/src/psd-structural-scaffold-diagnostics.test.ts packages/validator-core/src/psd-materialized-batch-diagnostics.test.ts packages/validator-core/src/product-preflight-report.test.ts packages/validator-core/src/psd-source-profile.test.ts packages/validator-core/src/psd-materialized-asset-diagnostics.test.ts` | sandbox run failed with esbuild `Error: spawn EPERM`; approved rerun after fix pass passed 5 files / 62 tests |
| `pnpm.cmd typecheck` | pass |
| `node scripts\check-psd-parser-import-boundary.mjs` | pass; 5 approved direct import/resolve sites |
| `pnpm.cmd run check:source` | pass |
| `rg "operation-core|@webtoon/psd|ag-psd|parsePsd|fromPsd" packages/validator-core/src/validators/psd-structural-scaffold-diagnostics.ts` | no matches |
| `git diff --check -- packages/validator-core packages/contracts discussion/implementation/waves/wave50 discussion/implementation/reviews/wave50` | pass; Git emitted LF/CRLF working-copy warnings only |

## Scope / Boundary Check

- Did not edit `apps/**`, `packages/ai-interface/**`, `packages/operation-core/**`, parser adapter packages, root maps/backlog, or contracts.
- Did not execute parser code or add parser imports.
- Did not add semantic recognition, renderer/pixel oracle, Photoshop compositing, initial grid mesh generation, or public demo asset claims.
- Preserved existing PSD materialized batch, materialized asset, source profile, and Product Preflight tests in the focused validator suite.

## Residual Risks

- Structural evidence schemas are mirrored locally with permissive parser-free validation rather than imported from package-format. This avoids operation/parser coupling but can drift if the package-format contract changes.
- The validator confirms structural consistency from available package/runtime evidence. It cannot prove PSD parser semantics, real PSD byte contents, or renderer output.

## User-Decision Points

None required for Domain F.

## Contract Blockers

None encountered for Domain F.
