# Wave94 Domain A Runtime Core Nested Warp Rest/Bind Semantics Report

## Orchestration Verdict

pass

- Loop count: 1 implementation loop, 1 review round.
- Required review lanes: all pass.
- Domain B can start: yes. Domain A has established the runtime numeric oracle; Canvas parity and diagnostics remain Domain B / follow-up scope as planned.

## Summary

Implemented dual-stream runtime rig evaluation for runtime-core:

- `currentVertices`: evaluated drawable vertices after mesh keyforms and child rig effects.
- `referenceVertices`: stable base/rest drawable vertices derived from `NormalizedRuntimeGraph.drawables` before mesh keyform deformation.

Warp lattice membership and bilinear sampling now use `referenceVertices[index]`. The computed displacement is added to `currentVertices[index]`. Rotation/translation affine effects still mutate only the current stream. Child-first effect application order is preserved.

Reference/current vertex count mismatches are deterministic: runtime emits `rigControl.vertexStreamLengthMismatch` and leaves the current vertices unchanged for that drawable, while still applying opacity multipliers.

## Files Changed

- `packages/runtime-core/src/snapshot.ts`
- `packages/runtime-core/src/rig-control-evaluation.ts`
- `packages/runtime-core/src/rig-control-warp-lattice.ts`
- `packages/runtime-core/src/rig-control-hierarchy-evidence.test.ts`
- `packages/runtime-core/src/rig-control-nested-warp-rest-bind-semantics.test.ts`
- `discussion/implementation/waves/wave94/wave94-domain-a-runtime-core-nested-warp-rest-bind-semantics-report.md`

## Tests Run and Results

- `pnpm.cmd exec vitest run packages/runtime-core/src/rig-control-hierarchy-evidence.test.ts packages/runtime-core/src/rig-control-nested-warp-rest-bind-semantics.test.ts`
  - Initial sandbox run failed before tests with `spawn EPERM` while Vitest/Vite tried to spawn esbuild.
  - Re-run with escalation: passed, 2 files / 16 tests.
- `pnpm.cmd exec vitest run packages/runtime-core/src/rig-control-keyform-evidence.test.ts`
  - passed, 1 file / 6 tests.
- `pnpm.cmd typecheck`
  - first run found one local readonly array type issue; fixed.
  - final run passed.
- `pnpm.cmd exec vitest run packages/runtime-core/src/rig-control-hierarchy-evidence.test.ts packages/runtime-core/src/rig-control-nested-warp-rest-bind-semantics.test.ts packages/runtime-core/src/rig-control-keyform-evidence.test.ts`
  - final run passed, 3 files / 22 tests.
- `git diff --check -- packages/runtime-core/src/snapshot.ts packages/runtime-core/src/rig-control-evaluation.ts packages/runtime-core/src/rig-control-warp-lattice.ts packages/runtime-core/src/rig-control-hierarchy-evidence.test.ts packages/runtime-core/src/rig-control-nested-warp-rest-bind-semantics.test.ts discussion/implementation/waves/wave94`
  - passed.
- `node scripts/check-source-organization.mjs`
  - passed.

## Before / After: Current-Coordinate Sampling Removal

Before:

- `applyWarpLattice2dToVertices` received one `vertices` stream.
- The same current vertex was used for:
  - `isPointInsideRect(...)`;
  - normalized lattice coordinate calculation;
  - bilinear displacement sampling;
  - adding displacement.
- A child deformation could move a current vertex outside the parent warp domain and make the parent warp pass through unexpectedly.

After:

- `applyWarpLattice2dToVertices` receives `currentVertices` and `referenceVertices`.
- `referenceVertices[index]` is used for inside/domain membership and normalized lattice sampling.
- Displacement is added to `currentVertices[index]`.
- Rest/reference outside the parent domain remains pass-through even if child effects move current inside.

## Runtime Numeric Evidence

New focused tests in `rig-control-nested-warp-rest-bind-semantics.test.ts`:

- `keeps a rest-inside vertex bound to the parent warp after child warp moves current outside`
  - rest/reference: `{ x: 5, y: 5 }`
  - child current offset: `{ x: 20, y: 0 }`
  - parent warp displacement: `{ x: 1, y: 2 }`
  - expected final vertex: `{ x: 26, y: 7 }`
- `keeps a rest-outside vertex outside the parent warp even when child warp moves current inside`
  - rest/reference: `{ x: 15, y: 5 }`
  - child current offset: `{ x: -10, y: 0 }`
  - parent warp displacement would be `{ x: 1, y: 2 }` if current sampling were used
  - expected final vertex: `{ x: 5, y: 5 }`
- `samples nonuniform parent warp displacement from rest coordinates instead of current coordinates`
  - rest/reference: `{ x: 2, y: 5 }`
  - child current offset: `{ x: 6, y: 0 }`
  - nonuniform parent warp samples x-displacement `2` from rest x=2, not `8` from current x=8
  - expected final vertex: `{ x: 10, y: 5 }`
- `reports reference/current vertex count mismatch and leaves current vertices as a safe fallback`
  - reference count: `1`
  - current count after mesh keyform replace: `2`
  - expected diagnostic: `rigControl.vertexStreamLengthMismatch`
  - expected safe fallback vertices: `{ x: 5, y: 5 }`, `{ x: 6, y: 5 }`

Existing hierarchy evidence intentionally updated:

- `applies ancestor warpLattice2d along descendant rotation2d drawable evidence deterministically`
  - parent warp now samples from rest/reference vertices after child rotation moves current.
  - expected final vertices changed to `{ x: 10.5, y: 1 }`, `{ x: 11, y: 3 }`, `{ x: 9, y: 4 }`, `{ x: 8.5, y: 2 }`.

## Runtime Helper Export Note

No new Canvas reuse helper was exported. `evaluateRigControlHierarchy` now requires a `referenceVerticesByDrawableId` input, and the runtime-internal warp lattice application signature carries current/reference streams. A separate public pure helper for Editor Canvas parity is deferred to Domain B if needed.

## Basis Coverage Self-Report

- Wave94 Domain A plan: covered for runtime-core dual stream, rest/reference warp membership, child-first effect order, mismatch fallback, tests, and report.
- Runtime evaluation semantics `2.4.1 Nested warp membership`: covered for runtime-core.
- Runtime core contract RigControl semantics: covered for runtime-core snapshot evaluation.
- Fixtures/contract tests:
  - `nested-warp-rest-binding`: covered by focused runtime numeric tests.
  - `warp-binding-outside-domain`: not implemented as validator warning in Domain A; see deferred items.
- Validator contract: no validator-core changes. Runtime mismatch diagnostic was added narrowly in runtime-core, not validator registry.
- Traceability matrix: AC-DEF/runtime fixture intent covered through runtime-core tests.
- Source organization policy: new focused test file owns the Wave94 nested warp behavior; no catch-all or index implementation added.
- Dependency policy: no dependency or lockfile changes.
- Operation policy: runtime evaluation only; no package mutation path changed.

## Deferred Basis Items / Remaining Risks

- Editor Canvas parity is not implemented in Domain A and remains Domain B.
- `rigControl.warpBindingOutsideDomain` validator warning is not implemented here; runtime semantics were prioritized.
- No persisted per-vertex binding was added. Reference binding is derived deterministically from normalized base/rest vertices each snapshot.
- If mesh keyforms replace vertices with a different count from base/rest, runtime emits `rigControl.vertexStreamLengthMismatch` and skips geometry rig transforms for that drawable as a safe fallback.
- A Canvas-specific reuse helper may still be useful, but adding a public helper surface was deferred to avoid changing more API shape than Domain A requires.

## Conditional Write Scope

No conditional write scope was used.

- Did not modify `packages/runtime-core/src/normalized-runtime-graph.ts`.
- Did not modify `packages/validator-core/src/**`.

## Review Reports

- `discussion/implementation/reviews/wave94/wave94-domain-a-spec-compliance-review.md`: pass.
- `discussion/implementation/reviews/wave94/wave94-domain-a-design-development-review.md`: pass.
- `discussion/implementation/reviews/wave94/wave94-domain-a-test-adequacy-review.md`: pass.
