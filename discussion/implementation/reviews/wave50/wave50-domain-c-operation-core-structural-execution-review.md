# Wave50 Domain C Review: Operation-Core Structural Execution

> Target: `wave50-operation-core-structural-execution`
> Role: Clean Review-Sylph independent re-review after fix pass
> Verdict: `pass`
> Reviewed: 2026-06-07

## Verdict

`pass`

The prior `needs_changes` findings are materially closed. The fix pass strengthens explicit approval binding, rejects duplicate approved source refs, and conservatively revalidates source evidence before mutation. No new blocking design, implementation, or test issue was found.

Domains D/E/F may proceed against the Domain C operation-core contract. They still need their own Editor, Codex-facing, and validator/Product Preflight tests rather than relying only on these operation-core tests.

## Scope Reviewed

Basis reviewed:

- `discussion/implementation/orchestration/wave50-plan.md`
- Domain A report and review
- Domain B report and review
- Previous Domain C review
- Domain C implementation report after fix pass

Source and tests reviewed:

- `packages/operation-core/src/operations/import-psd-structural-scaffold.ts`
- `packages/operation-core/src/operations/import-psd-structural-scaffold.test.ts`
- `packages/operation-core/src/operation-type.ts`
- `packages/operation-core/src/operation-payload.ts`
- `packages/operation-core/src/operation-registry.ts`
- `packages/operation-core/src/operation-ids.ts`
- `packages/operation-core/src/operation-evidence-result.ts`
- `packages/operation-core/src/lifecycle/evidence.ts`
- `packages/operation-core/src/index.ts`
- `packages/operation-core/src/psd-structural-scaffold-contracts.test.ts`

Review-local checks:

- Read the structural handler and focused tests with line numbers.
- Ran targeted `rg` scans for parser imports, semantic/proposal/compositing/grid/Cubism/external-transport terms, approval digest handling, duplicate source-ref handling, and source-evidence mismatch checks.
- Ran `git status --short -uall`, `git diff --stat` on the changed operation-core files, and `git diff --check -- packages discussion/implementation/waves/wave50 discussion/implementation/reviews/wave50`.

## Prior Findings Closure

1. Approval selection is now strongly bound: closed.

- Stored approval matching now includes `approvalSelectionDigest` alongside `approvalId`, `structuralPlanDigest`, and `approvalStatus` in `packages/operation-core/src/operations/import-psd-structural-scaffold.ts:638`.
- `addApprovalPlanBindingDiagnostics` verifies every approved group and leaf is present in the supplied structural plan and execution-relevant fields match in `packages/operation-core/src/operations/import-psd-structural-scaffold.ts:405`.
- Group plan comparison covers source refs, source parent, name/path, sourceOrder, visibility, opacity, bounds, generated parent, generated part id, and generated display name in `packages/operation-core/src/operations/import-psd-structural-scaffold.ts:463`.
- Leaf plan comparison covers source refs, source parent, name/path, sourceOrder, visibility, opacity, bounds, generated parent, generated drawable/texture/mesh ids, generated display name, and initial runtime visibility in `packages/operation-core/src/operations/import-psd-structural-scaffold.ts:484`.
- Tests now reject stored approval selection digest mismatch and approved scaffolds absent from the structural plan in `packages/operation-core/src/operations/import-psd-structural-scaffold.test.ts:150` and `packages/operation-core/src/operations/import-psd-structural-scaffold.test.ts:158`.

2. Duplicate approved source refs are rejected: closed.

- Duplicate approved group source refs are detected before mutation with `duplicateApprovedSourceGroup` in `packages/operation-core/src/operations/import-psd-structural-scaffold.ts:733`.
- Duplicate approved layer source refs are detected before mutation with `duplicateApprovedSourceLayer` in `packages/operation-core/src/operations/import-psd-structural-scaffold.ts:990`.
- The focused test covers duplicate `sourceGroupRef.sourceGroupId` and duplicate `sourceLayerRef.sourceLayerId` while asserting atomic no-mutation behavior in `packages/operation-core/src/operations/import-psd-structural-scaffold.test.ts:172`.

3. Source evidence fields are revalidated: closed.

- Group source name/ref name/path, sourceOrder, group path, visibility, opacity, bounds, source parentage, and generated parent mapping are checked in `packages/operation-core/src/operations/import-psd-structural-scaffold.ts:851`.
- Leaf source name/ref name, visibility, opacity, bounds, source/ref path, profile name/opacity/bounds/sourceOrder, source parentage, and generated parent mapping are checked in `packages/operation-core/src/operations/import-psd-structural-scaffold.ts:1151`.
- Non-positive structural leaf bounds are rejected before materialization in `packages/operation-core/src/operations/import-psd-structural-scaffold.ts:1038`.
- The focused tests cover stale name/opacity/bounds evidence and zero-width leaf bounds with atomic no-mutation assertions in `packages/operation-core/src/operations/import-psd-structural-scaffold.test.ts:225` and `packages/operation-core/src/operations/import-psd-structural-scaffold.test.ts:264`.

## Design / Development Compliance Findings

No blocking findings.

- Operation registration and plumbing are coherent: `importPsdStructuralScaffold` is in the operation type list, payload union, registry, operation id derivation, evidence result schema, lifecycle evidence merge, and barrel exports.
- The operation remains additive and preserves old leaf-only batch payload compatibility, covered in `packages/operation-core/src/psd-structural-scaffold-contracts.test.ts:59`.
- Groups are created through `createPartOperationHandler` as part containers only. I found no group texture, drawable, mesh, or ArtMesh creation path in the structural handler.
- Leaves are routed through the existing selected-layer materialization handler under their approved `generatedParentPartId`, and hidden leaves get `setRuntimeVisibility(false)` only when `initialRuntimeVisibility` is false.
- The atomic shape remains appropriate: preflight runs before mutation, child operations run against a cloned session, and the original session is replaced only after success.
- No direct `@webtoon/psd` import or parser boundary bypass was added in operation-core. Parser data is compared only as stored evidence.
- No semantic recognition, auto proposal generation, group-as-drawable behavior, initial grid mesh, deformer/keyform/physics generation, Photoshop compositing claim, external HTTP/WebSocket/MCP transport, or Cubism compatibility claim was added by Domain C. Existing operation-core exports for unrelated keyform/dynamics operations are pre-existing general operation-core surface, not structural import behavior.
- `packages/operation-core/src/index.ts` remains a barrel-only export file.

## Test Adequacy Findings

Adequate for Domain D/E/F to proceed against this operation-core contract.

The root-provided focused verification passed 3 files / 22 tests after approved rerun. The added coverage now includes the prior blockers:

- registration, payload parsing, group part creation, leaf routing, hidden runtime visibility, group-not-materialized behavior, and evidence shape;
- stale plan/status rejection and generated id collision rejection;
- stored approval selection digest mismatch;
- approved group/leaf absence from plan;
- duplicate approved source group and layer refs;
- stale source name/opacity/bounds evidence;
- non-positive leaf bounds rejection;
- old leaf-only batch compatibility and structural contract strictness.

This is sufficient for Domains D/E/F to build against Domain C's current contract. It is not a substitute for their required surface tests: Editor approval UX, Codex-facing stale/result refs, validator diagnostics, save/load, and focused e2e still need independent coverage in later domains.

Non-blocking test gaps left for later hardening:

- Cap-policy, missing source group/layer, missing materialization evidence, and child-operation failure branches are not all individually asserted here.
- Those branches are conservative preflight/atomic paths and do not block D/E/F, but Domain F should exercise the diagnostics it consumes.

## Verification Considered

Root-provided verification after the fix pass:

- `pnpm.cmd exec vitest run packages/operation-core/src/operations/import-psd-structural-scaffold.test.ts packages/operation-core/src/psd-structural-scaffold-contracts.test.ts packages/operation-core/src/operations/import-psd-layer-materialization-batch.test.ts`: sandbox run failed with esbuild `spawn EPERM`; approved rerun passed, 3 files / 22 tests.
- `pnpm.cmd typecheck`: pass.
- `node scripts/check-psd-parser-import-boundary.mjs`: pass, 5 approved direct import/resolve sites.
- `pnpm.cmd run check:source`: pass.
- `git diff --check -- packages discussion/implementation/waves/wave50 discussion/implementation/reviews/wave50`: pass, only LF/CRLF working-copy warnings.

Review-local verification:

- `git diff --check -- packages discussion/implementation/waves/wave50 discussion/implementation/reviews/wave50`: pass, only LF/CRLF working-copy warnings.
- Targeted line-numbered source/test review of the structural handler and focused tests.
- Targeted `rg` scans for parser boundary and forbidden-scope terms. Matches were evidence strings/test boundary literals or pre-existing unrelated operation-core exports, not added forbidden behavior.

I did not rerun Vitest or typecheck in this clean re-review context because the root-provided approved rerun evidence already covers the fix pass and the sandbox path is known to hit esbuild `spawn EPERM`.

## Remaining Risks

- `import-psd-structural-scaffold.ts` is large. It is acceptable for this domain, but future expansions should avoid growing it into an unbounded catch-all.
- Source opacity is still evidence-only for structural import unless a later domain makes opacity mapping explicit. This matches Wave50 boundaries and is not a blocker.
- Domain F should consume the current structural issue taxonomy carefully and add validator/Product Preflight tests for the exact diagnostics it exposes.
- Domain D/E/G still need UI/Codex/e2e proof with real workflow surfaces; this review only gates operation-core structural execution.

## User-Decision Points

None.

No user decision is needed for Domain C. Future decisions remain outside this pass: group visibility/opacity runtime semantics, higher caps, partial structural success, initial grid mesh generation, Photoshop compositing/renderer proof, external transport, public sample-derived assets, or Cubism compatibility.
