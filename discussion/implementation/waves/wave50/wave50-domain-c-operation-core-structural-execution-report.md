# Wave50 Domain C Report: Operation-Core Structural Execution

> Target: `wave50-operation-core-structural-execution`
> Role: Gnome implementation agent
> Verdict candidate: `pass`

## Verdict

verdict candidate: `pass`

Domain C implements operation-core execution for `importPsdStructuralScaffold` using the Domain B contracts. The implementation is additive and keeps the Wave48/Wave49 leaf-only `importPsdLayerMaterializationBatch` path unchanged.

## Implementation Summary

- Registered `importPsdStructuralScaffold` in operation type, payload union, operation id resolution, handler registry, lifecycle evidence plumbing, and public barrel exports.
- Added `packages/operation-core/src/operations/import-psd-structural-scaffold.ts`.
  - Validates approval status, plan/approval digest equality, source/destination identity, current source PSD digest/byteLength where available, parser evidence where available, stored source-asset plan/approval evidence where available, and cap policy consistency.
  - Preflights approved groups/leaves for caps, source mappings, parentage, generated refs/name collisions, locked targets, missing destination/generated parents, missing source group/layer, missing materialization evidence, unavailable bytes, and runtime visibility mismatch.
  - Creates approved PSD groups as project `Part` containers through the existing `createPartOperationHandler`, sorted topologically and by `sourceOrder`.
  - Resolves leaf materialization evidence from `sourceAsset.psdProfile.materializationEvidence` by `sourceLayerRef.sourceLayerId`, then materializes leaves through `importPsdLayerMaterializationOperationHandler` using scaffold-provided generated drawable/texture/mesh IDs and generated parent part IDs.
  - Applies `setRuntimeVisibility(false)` only for hidden approved leaves whose `initialRuntimeVisibility` is `false`; visible leaves avoid no-op visibility updates.
  - Returns `psdStructuralScaffoldEvidence` on success and rejection.
  - Preserves atomicity by mutating a candidate session and replacing the original only after the full structural operation succeeds.
- Added focused operation tests covering registration/payload parsing, group part creation, leaf routing under generated parent, hidden leaf runtime visibility, group-not-materialized behavior, stale approval rejection, generated ID collision rejection, and session atomicity.
- Updated the Domain B contract test expectation now that the structural operation is registered.

## Fix Pass After Clean Review

Clean Review-Sylph returned `needs_changes` for three operation-core preflight gaps. This fix pass addressed only those blockers:

- Bound stored approval evidence to `approvalSelectionDigest` and rejected approval/plan scaffold mismatches where approved groups or leaves are absent from, or execution-relevantly different from, the supplied structural plan.
- Rejected duplicate approved `sourceGroupRef.sourceGroupId` and `sourceLayerRef.sourceLayerId` before mutation.
- Revalidated current source/profile group and leaf names, paths, visibility where required, opacity, bounds, parentage, and generated parent mapping, and rejected non-positive structural leaf bounds before materialization.

Focused tests were added for selection digest mismatch, plan membership mismatch, duplicate source refs, stale source evidence, and zero-width leaf bounds. All new rejection paths assert session atomicity.

## Files Changed By Domain C

- `packages/operation-core/src/operation-type.ts`
- `packages/operation-core/src/operation-payload.ts`
- `packages/operation-core/src/operation-registry.ts`
- `packages/operation-core/src/operation-ids.ts`
- `packages/operation-core/src/operation-evidence-result.ts`
- `packages/operation-core/src/lifecycle/evidence.ts`
- `packages/operation-core/src/index.ts`
- `packages/operation-core/src/operations/import-psd-structural-scaffold.ts`
- `packages/operation-core/src/operations/import-psd-structural-scaffold.test.ts`
- `packages/operation-core/src/psd-structural-scaffold-contracts.test.ts`
- `discussion/implementation/waves/wave50/wave50-domain-c-operation-core-structural-execution-report.md`

Pre-existing Domain A/B worktree changes and untracked artifacts were not reverted. No `packages/package-format/src/**` correction was required for Domain C.

## Verification Performed

| Check | Result |
|---|---|
| `pnpm.cmd exec vitest run packages/operation-core/src/operations/import-psd-structural-scaffold.test.ts packages/operation-core/src/psd-structural-scaffold-contracts.test.ts packages/operation-core/src/operations/import-psd-layer-materialization-batch.test.ts` | sandbox run failed with esbuild `spawn EPERM`; approved rerun passed 3 files / 22 tests |
| `pnpm.cmd typecheck` | pass |
| `node scripts/check-psd-parser-import-boundary.mjs` | pass; 5 approved direct import/resolve sites |
| `pnpm.cmd run check:source` | pass |
| `git diff --check -- packages discussion/implementation/waves/wave50 discussion/implementation/reviews/wave50` | pass; Git emitted LF/CRLF working-copy warnings only |

## Scope / Boundary Check

- Did not edit `apps/**`, `packages/ai-interface/**`, `packages/validator/**`, parser adapter packages, root maps/backlog, or review artifacts.
- Did not add parser imports to operation-core.
- Did not add semantic recognition, suggestion/proposal generation, group-as-drawable behavior, initial grid mesh generation, deformer/keyform/physics generation, Photoshop compositing, renderer/pixel oracle, external transport, Cubism compatibility, or public demo asset claims.
- `index.ts` remains barrel-only. The new production handler is scoped to one operation family and keeps implementation logic out of the barrel.

## Residual Risks

- Structural operation-core execution is covered with focused fixtures, not real sample PSD end-to-end evidence; later Domains D/E/G still need Editor/Codex-facing/e2e coverage.
- The handler is intentionally conservative: any preflight diagnostic blocks the whole structural operation. Raising caps or allowing partial success remains a future design decision.

## User-Decision Points

None for Domain C.
