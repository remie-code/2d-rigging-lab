# Wave29 Domain A Operation Hardening Review

Date: 2026-06-02
Reviewer: Review-Sylph
Target: `wave29-mesh-edit-operation-hardening`
Verdict: `pass`

## Scope Reviewed

Reviewed the requested Domain A files:

- `packages/operation-core/src/payloads/model-edit.ts`
- `packages/operation-core/src/operations/move-mesh-vertex.ts`
- `packages/operation-core/src/operations/move-mesh-vertex.test.ts`
- `packages/operation-core/src/operation-lifecycle.test.ts`
- `discussion/implementation/waves/wave29/wave29-domain-a-operation-hardening-gnome-report.md`

The workspace also contains parallel changes outside Domain A. They were not reviewed as Domain A implementation, except for guard checks and boundary searches needed to verify this domain.

## Basis Documents Used

- `discussion/implementation/orchestration/wave29-plan.md`
- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/development_convention/dependency-policy.md`
- `discussion/development_convention/schema-and-id-conventions.md`
- `discussion/design/module-contracts/operation-contracts.md`
- `discussion/design/module-contracts/package-file-format-contract.md`
- `discussion/implementation/waves/wave17/wave17-final-report.md`
- `discussion/implementation/waves/wave28/wave28-final-report.md`
- `discussion/tests/traceability/test-traceability-matrix.md`
- `discussion/tests/fixtures/fixture-manifest.md`
- Implementation report inspected as supporting evidence, not sole evidence: `discussion/implementation/waves/wave29/wave29-domain-a-operation-hardening-gnome-report.md`

## Findings

No blocking, high, medium, or low-severity findings.

## Design / Development Compliance

Pass.

- Write scope stayed within the requested Domain A files and report. No package manifest, lockfile, or operation-core `index.ts` diff was present.
- `moveMeshVertex` stays in operation-core and uses authoring-core mutation APIs; no editor-state import or editor package dependency was introduced. Boundary search found no `apps/editor` or editor-state dependency in operation-core production code.
- The lock-aware bridge is caller-supplied: `MoveMeshVertexPayloadSchema` adds `lockedTargetIds` with the existing schema pattern at `packages/operation-core/src/payloads/model-edit.ts:87`, and the handler passes graph-derived target refs into `createLockedTargetDiagnostics` at `packages/operation-core/src/operations/move-mesh-vertex.ts:120`.
- Target refs are deterministic and include mesh, owning drawable, owning part when resolvable, and per-stable-vertex paths at `packages/operation-core/src/operations/move-mesh-vertex.ts:319`.
- The mutation remains bounded to vertex coordinate changes and bounds recomputation; authoring-core does not create/delete vertices, triangles, UVs, or topology in `packages/authoring-core/src/mesh-mutations.ts:75`.
- No forbidden-scope terms or implementation paths were found in the reviewed files for parser/image decode/archive/external dependency/Cubism/pixel oracle/full renderer/topology editor.
- Machine-readable IDs remain dot-separated lower camelCase, e.g. `operation.moveMeshVertex.lockedTarget`, matching the existing operation diagnostic pattern.

## Test Adequacy

Pass.

- Multi-vertex dry-run and clone behavior are covered at `packages/operation-core/src/operations/move-mesh-vertex.test.ts:31`.
- Multi-vertex commit, operation log target IDs, model diff targets, checked target refs, package materialization, stable vertex IDs, and bounds are covered at `packages/operation-core/src/operations/move-mesh-vertex.test.ts:152`.
- Missing mesh, missing vertex, duplicate vertex, empty delta, no-op, and keyform-scope rejection remain deterministic at `packages/operation-core/src/operations/move-mesh-vertex.test.ts:197` and `packages/operation-core/src/operations/move-mesh-vertex.test.ts:296`.
- Lock bridge coverage rejects caller-supplied locked drawable and part targets without editor-state dependency at `packages/operation-core/src/operations/move-mesh-vertex.test.ts:262`.
- Existing single vertex lifecycle row nudge compatibility remains covered at `packages/operation-core/src/operation-lifecycle.test.ts:307`.

## Verification Performed

Passed:

- `pnpm.cmd exec vitest run packages/operation-core/src/operations/move-mesh-vertex.test.ts packages/operation-core/src/operation-lifecycle.test.ts packages/authoring-core/src/mesh-mutations.test.ts packages/operation-core/src/mesh-vertex-runtime-evidence.test.ts packages/operation-core/src/operation-schemas.test.ts`
  - 5 files passed, 33 tests passed.
- `pnpm.cmd typecheck`
- `pnpm.cmd run check:source`
- `pnpm.cmd run check:deps`
- `git diff --check -- packages/operation-core/src/operation-lifecycle.test.ts packages/operation-core/src/operations/move-mesh-vertex.test.ts packages/operation-core/src/operations/move-mesh-vertex.ts packages/operation-core/src/payloads/model-edit.ts discussion/implementation/waves/wave29/wave29-domain-a-operation-hardening-gnome-report.md`
  - No whitespace errors. Git emitted LF-to-CRLF working-copy warnings only.

## Remaining Issues

None for Domain A.

The Gnome report recorded a repository typecheck failure in parallel validator-core work, but reviewer rerun on 2026-06-02 passed after later workspace changes.

## User-Decision Points

None.

## Provisional Assumptions

- Editor lock state is intentionally lowered by callers into `payload.lockedTargetIds`; operation-core must not read editor-state directly.
- Lock IDs are stable target IDs. Kind-level disambiguation is not added in Domain A because existing Wave28 lock bridge behavior also matches by target ID.
- Domain A does not update operation contract prose because the assignment's write scope did not include design contract documents, and the implementation follows the existing Wave28 `lockedTargetIds` pattern.
