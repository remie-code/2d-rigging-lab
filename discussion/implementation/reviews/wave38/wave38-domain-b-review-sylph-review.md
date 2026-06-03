# Wave38 Domain B Review-Sylph Review

## Verdict

pass

Domain B is aligned with the Domain A contracts and the operation/runtime evidence path is covered. The fix-loop 1 re-review confirmed the previous authoring lifecycle finding is resolved.

## Basis Reviewed

- `.agents/skills/implementation-orchestration/SKILL.md`
- `discussion/implementation/orchestration/wave38-plan.md`
- `discussion/implementation/waves/wave38/wave38-domain-a-orch-sylph-completion.md`
- `discussion/implementation/reviews/wave38/wave38-domain-a-review-sylph-review.md`
- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/design/module-contracts/package-file-format-contract.md`
- Domain B changed source and focused tests under `packages/authoring-core/src`, `packages/operation-core/src`, `packages/package-format/src`, and `packages/runtime-core/src`
- `discussion/implementation/waves/wave38/wave38-domain-b-gnome-implementation-report.md` as supplementary evidence only

## Files Reviewed

- `packages/authoring-core/src/authoring-mutations.ts`
- `packages/authoring-core/src/index.ts`
- `packages/authoring-core/src/mesh-generation.ts`
- `packages/authoring-core/src/mesh-topology-mutations.ts`
- `packages/authoring-core/src/mesh-topology-mutations.test.ts`
- `packages/authoring-core/src/package-document-model-files.ts`
- `packages/authoring-core/src/runtime-graph-drawables.ts`
- `packages/authoring-core/src/to-package-document.ts`
- `packages/authoring-core/src/from-package-document.ts`
- `packages/authoring-core/src/to-runtime-graph.ts`
- `packages/operation-core/src/index.ts`
- `packages/operation-core/src/operation-registry.ts`
- `packages/operation-core/src/payloads/mesh-topology.ts`
- `packages/operation-core/src/operations/mesh-topology.ts`
- `packages/operation-core/src/operations/mesh-topology.test.ts`
- `packages/package-format/src/model-files.ts`
- `packages/package-format/src/mesh-topology-contract.test.ts`
- `packages/runtime-core/src/mesh-evidence.ts`
- `packages/runtime-core/src/mesh-evidence.test.ts`
- `packages/runtime-core/src/normalized-runtime-graph.ts`
- `packages/runtime-core/src/tutorial-evidence-summary.test.ts`

## Findings By Severity

No open findings.

Resolved: the previous medium finding for invalid direct authoring `insertIndex` handling is fixed. `addMeshVertex` and `addMeshTriangle` now validate `insertIndex` with `isValidInsertIndex` before mutation (`packages/authoring-core/src/mesh-topology-mutations.ts:111` through `packages/authoring-core/src/mesh-topology-mutations.ts:118`, `packages/authoring-core/src/mesh-topology-mutations.ts:185` through `packages/authoring-core/src/mesh-topology-mutations.ts:192`, `packages/authoring-core/src/mesh-topology-mutations.ts:519` through `packages/authoring-core/src/mesh-topology-mutations.ts:522`). Tests cover negative, fractional, `NaN`, and infinite values, and assert mesh state, authoring revision, and dirty flag remain unchanged on rejection (`packages/authoring-core/src/mesh-topology-mutations.test.ts:154` through `packages/authoring-core/src/mesh-topology-mutations.test.ts:200`, `packages/authoring-core/src/mesh-topology-mutations.test.ts:231` through `packages/authoring-core/src/mesh-topology-mutations.test.ts:233`).

## Design / Development Compliance Review

- PASS: Fix-loop 1 keeps validation in the authoring topology mutation module and does not introduce new implementation scope or dependency surface.
- PASS: Domain B uses the Domain A bounded operation contracts rather than redefining operation types or payload shapes (`packages/operation-core/src/payloads/mesh-topology.ts:15` through `packages/operation-core/src/payloads/mesh-topology.ts:76`).
- PASS: Supported operations are registered through the existing operation registry pattern (`packages/operation-core/src/operation-registry.ts:57` through `packages/operation-core/src/operation-registry.ts:72`).
- PASS: Operation handlers route to authoring mutations and convert authoring mutation errors into deterministic operation diagnostics (`packages/operation-core/src/operations/mesh-topology.ts:89` through `packages/operation-core/src/operations/mesh-topology.ts:157`, `packages/operation-core/src/operations/mesh-topology.ts:488` through `packages/operation-core/src/operations/mesh-topology.ts:519`).
- PASS: Operation results include model diff plus `meshTopologyEvidence`, with topology revision before/after, count changes, changed element evidence, and explicit renderer/texture sampling correctness claims of `"none"` (`packages/operation-core/src/operations/mesh-topology.ts:271` through `packages/operation-core/src/operations/mesh-topology.ts:288`, `packages/operation-core/src/operations/mesh-topology.ts:409` through `packages/operation-core/src/operations/mesh-topology.ts:425`).
- PASS: Package materialization preserves mesh fields by cloning `session.graph.meshes` into the package document and schema-parsing the result (`packages/authoring-core/src/package-document-model-files.ts:22` through `packages/authoring-core/src/package-document-model-files.ts:24`, `packages/authoring-core/src/to-package-document.ts:21` through `packages/authoring-core/src/to-package-document.ts:24`). Loading routes through `createAuthoringGraphFromPackageDocument` (`packages/authoring-core/src/from-package-document.ts:13` through `packages/authoring-core/src/from-package-document.ts:28`).
- PASS: Runtime projection carries vertices, UVs, triangles, stable IDs, and topology revision (`packages/authoring-core/src/runtime-graph-drawables.ts:28` through `packages/authoring-core/src/runtime-graph-drawables.ts:39`, `packages/runtime-core/src/normalized-runtime-graph.ts:98` through `packages/runtime-core/src/normalized-runtime-graph.ts:103`).
- PASS: Runtime and Viewer evidence exposes topology summaries plus full-detail UV and triangle refs when requested (`packages/runtime-core/src/mesh-evidence.ts:147` through `packages/runtime-core/src/mesh-evidence.ts:163`, `packages/runtime-core/src/mesh-evidence.ts:248` through `packages/runtime-core/src/mesh-evidence.ts:273`, `packages/runtime-core/src/mesh-evidence.ts:306` through `packages/runtime-core/src/mesh-evidence.ts:337`).
- PASS: Public `index.ts` changes are barrel-only re-exports (`packages/authoring-core/src/index.ts:1`, `packages/operation-core/src/index.ts:1`).
- PASS: No dependency manifest or lockfile changes were present.
- PASS: No Editor UI, validator-core implementation, renderer, image decode, pixel oracle, external dependency, automatic triangulation, or retopology implementation was found in the reviewed Domain B paths.

## Test Adequacy Review

- PASS: Focused operation test covers commit -> operation log -> evidence -> package materialization -> save/load reinspection -> runtime graph projection (`packages/operation-core/src/operations/mesh-topology.test.ts:41` through `packages/operation-core/src/operations/mesh-topology.test.ts:158`).
- PASS: Focused operation test covers stale topology revision and referenced vertex removal rejection without operation-log or mesh-state corruption (`packages/operation-core/src/operations/mesh-topology.test.ts:161` through `packages/operation-core/src/operations/mesh-topology.test.ts:188`).
- PASS: Authoring tests cover add/remove vertex, legacy triangle stable ID materialization, remove triangle, UV move, stale revision rejection, referenced vertex rejection, and invalid `insertIndex` no-corruption behavior (`packages/authoring-core/src/mesh-topology-mutations.test.ts:28` through `packages/authoring-core/src/mesh-topology-mutations.test.ts:200`).
- PASS: Runtime evidence tests cover topology revision, stable triangle ID count, UV refs, triangle refs, and Viewer-facing full-detail evidence (`packages/runtime-core/src/mesh-evidence.test.ts:31` through `packages/runtime-core/src/mesh-evidence.test.ts:131`, `packages/runtime-core/src/mesh-evidence.test.ts:134` through `packages/runtime-core/src/mesh-evidence.test.ts:198`).
- PASS: The prior test gap for invalid `insertIndex` values on direct authoring APIs is closed by two focused no-corruption tests.

## Orchestration Compliance Review

- PASS: This review used the clean reviewer role and inspected basis docs, source, tests, and verification output directly rather than relying only on the Gnome report.
- PASS: I did not modify source files. The only write performed is this review artifact under `discussion/implementation/reviews/wave38/`.
- PASS from this review perspective: Gnome's reported Domain B source files are within the allowed Domain B source scope. The broader working tree contains Domain A/C changes, but they were not attributed to Domain B in the Gnome report and were not reviewed as Domain B implementation.

## Verification Performed

- Fix-loop 1 source re-review:
  - Confirmed `addMeshVertex` and `addMeshTriangle` reject invalid `insertIndex` values before mutation.
  - Confirmed new tests cover `< 0`, non-integer, `NaN`, and non-finite values with mesh state, `authoringRevision`, and `dirty` unchanged after rejection.
- `pnpm.cmd exec vitest run packages/authoring-core/src/mesh-topology-mutations.test.ts`
  - Result: 1 file passed, 5 tests passed.
- `pnpm.cmd exec vitest run packages/authoring-core/src/mesh-topology-mutations.test.ts packages/operation-core/src/operations/mesh-topology.test.ts packages/runtime-core/src/mesh-evidence.test.ts packages/runtime-core/src/tutorial-evidence-summary.test.ts packages/operation-core/src/operation-schemas.test.ts packages/package-format/src/mesh-topology-contract.test.ts packages/operation-core/src/operations/generate-mesh.test.ts`
  - Result: 7 files passed, 26 tests passed.
- `pnpm.cmd exec vitest run packages/authoring-core/src/package-document-adapter.test.ts packages/authoring-core/src/runtime-graph-adapter.test.ts packages/authoring-core/src/mesh-mutations.test.ts`
  - Result: 3 files passed, 10 tests passed.
- `pnpm.cmd typecheck`
  - Result: passed.
- `git diff --check` over the fix-loop files
  - Result: no whitespace errors.
- `Select-String` trailing-whitespace scan over fix-loop source/test/report files
  - Result: no matches.
- Dependency manifest / lockfile status check
  - Result: no changes.
- Forbidden-scope scan over reviewed Domain B source paths and the updated Gnome report
  - Result: source paths had no forbidden-scope hits; report mentions non-goals only as unsupported/unclaimed.

## Remaining Risks

- Full `test:unit` and `test:e2e` were not run in this clean review.
- Legacy package `vertexStableIds` remain broader tokens than operation `VertexIdSchema` by Domain A contract. I did not treat this as a Domain B blocker because Domain B was required to use Domain A contracts, but it remains a future compatibility consideration for editing historical meshes whose stable vertex IDs are not `vtx_...`.

## User Decision Points

None.
