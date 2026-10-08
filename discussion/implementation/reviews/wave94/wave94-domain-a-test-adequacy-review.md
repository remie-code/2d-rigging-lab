# Wave94 Domain A Test Adequacy Review

## Verdict

pass

## Evidence Reviewed

- Source of truth: `discussion/implementation/orchestration/wave94-plan.md`
- Test / fixture basis:
  - `discussion/design/module-contracts/fixtures-and-contract-tests.md`
  - `discussion/design/module-contracts/runtime-core-contract.md`
  - `discussion/design/mvp-authoring-runtime/03-runtime-evaluation-semantics.md`
- Implementation report: `discussion/implementation/waves/wave94/wave94-domain-a-runtime-core-nested-warp-rest-bind-semantics-report.md`
- Reviewed source and tests:
  - `packages/runtime-core/src/rig-control-nested-warp-rest-bind-semantics.test.ts`
  - `packages/runtime-core/src/rig-control-hierarchy-evidence.test.ts`
  - `packages/runtime-core/src/rig-control-keyform-evidence.test.ts`
  - `packages/runtime-core/src/snapshot.ts`
  - `packages/runtime-core/src/rig-control-evaluation.ts`
  - `packages/runtime-core/src/rig-control-warp-lattice.ts`

## Coverage Findings

| Required Domain A case | Finding |
|---|---|
| Runtime positive nested rest-inside/current-outside case | Covered. `rig-control-nested-warp-rest-bind-semantics.test.ts:28` builds rest `{x:5,y:5}`, child offset `{x:20,y:0}`, parent domain `0..10`, and expects final `{x:26,y:7}` at line 39. Old current-coordinate parent membership would have produced pass-through after current x moved to 25, so the assertion catches the prior behavior. |
| Runtime negative rest-outside/current-inside case | Covered. `rig-control-nested-warp-rest-bind-semantics.test.ts:43` uses rest `{x:15,y:5}`, child offset `{x:-10,y:0}`, and expects final `{x:5,y:5}` at line 54. Old current-coordinate parent membership would have sampled parent displacement after current moved inside, so this catches the inverse failure mode. |
| Runtime nonuniform parent Warp proof that sampling uses rest/reference, not current | Covered. `rig-control-nested-warp-rest-bind-semantics.test.ts:58` uses nonuniform x offsets and expects `{x:10,y:5}` at line 74. The implementation report records the intended distinction: rest x=2 samples displacement 2, while old current x=8 sampling would produce a different result. |
| Existing hierarchy/keyform tests updated intentionally and enough to protect prior behavior | Covered. `rig-control-hierarchy-evidence.test.ts:216` was intentionally updated for ancestor warp over descendant rotation, with exact vertices at lines 249-254. Existing keyform coverage remains in `rig-control-keyform-evidence.test.ts:393`, which still asserts semantic bilinear warp keyform deformation and was included in the reported focused test run. |
| Reference/current vertex count mismatch handled deterministically and asserted | Covered. The new mismatch test asserts fallback vertices and `rigControl.vertexStreamLengthMismatch` with `currentVertices=2` / `referenceVertices=1` at `rig-control-nested-warp-rest-bind-semantics.test.ts:78-95`. Source checks length before applying effects in `rig-control-evaluation.ts:381-407` and emits evidence at lines 561-569. |
| Numeric values strong enough to catch old current-coordinate behavior | Covered. The positive, negative, and nonuniform cases each have exact final vertex assertions that differ from old current-coordinate membership or sampling. The nonuniform case is especially strong because current and rest are both inside parent bounds but imply different bilinear weights. |
| Domain B Canvas parity tests deferred/not applicable for Domain A | Not a Domain A blocker. The Wave94 plan puts Canvas preview parity in Domain B after Domain A. Domain A tests establish the runtime numeric oracle that Domain B should mirror. |

## Source Cross-Checks

- `snapshot.ts:190-199` derives `referenceVerticesByDrawableId` before mesh/keyform target patches are applied to current drawables, then passes it into `evaluateRigControlHierarchy`.
- `snapshot.ts:361-369` copies graph drawable base vertices into the reference stream, avoiding aliasing with current vertex mutations.
- `rig-control-evaluation.ts:468-504` carries current and reference streams through the effect chain. Rotation applies only to current vertices; warp receives both streams.
- `rig-control-warp-lattice.ts:110` uses the reference vertex for inside/domain membership.
- `rig-control-warp-lattice.ts:208-226` computes normalized lattice coordinates from `referenceVertex` and adds the sampled displacement to `currentVertex`.

## Blocking Gaps

None found.

## Non-Blocking Risks / Deferred Items

- Domain B Canvas parity tests are still required by Wave94 but are correctly outside Domain A.
- `rigControl.warpBindingOutsideDomain` validator/runtime warning is deferred. Current Domain A negative tests assert no `rigControl_evaluation` diagnostics for rest-outside/current-inside; that is acceptable for this semantic fix, but future diagnostic work may need to narrow or update that assertion.
- Tests were reviewed statically in this pass. I considered Gnome-reported execution evidence rather than rerunning commands in this read-only review context.

## Tests Considered

- Gnome-reported: `pnpm.cmd exec vitest run packages/runtime-core/src/rig-control-hierarchy-evidence.test.ts packages/runtime-core/src/rig-control-nested-warp-rest-bind-semantics.test.ts packages/runtime-core/src/rig-control-keyform-evidence.test.ts` passed, 3 files / 22 tests.
- Gnome-reported: `pnpm.cmd typecheck` passed.
- Gnome-reported: `node scripts/check-source-organization.mjs` passed.
- Gnome-reported: scoped `git diff --check` passed.
