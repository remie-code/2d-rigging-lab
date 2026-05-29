# Wave 12 Domain C Review: Runtime Keyform Target Application

> Wave: `runtime-keyform-evaluation-foundation`
> Domain: `wave12-runtime-keyform-target-application`
> Review mode: clean Review-Sylph
> Verdict: `pass`

## Scope Reviewed

- `packages/runtime-core/src/drawable-geometry.ts`
- `packages/runtime-core/src/keyform-target-application.ts`
- `packages/runtime-core/src/drawable-geometry.test.ts`
- `packages/runtime-core/src/keyform-target-application.test.ts`

## Basis Documents Used

- `discussion/implementation/orchestration/wave12-plan.md`
- `discussion/design/module-contracts/runtime-core-contract.md`
- `discussion/development_convention/source-file-organization-policy.md`
- `packages/runtime-core/src/normalized-runtime-graph.ts`
- `packages/runtime-core/src/keyform-evaluation-types.ts`
- `packages/runtime-core/src/snapshot.ts`
- `packages/runtime-core/src/diagnostics.ts`
- `packages/runtime-core/src/keyform-sampling.ts` as read-only integration shape reference

## Findings

- No blocking, major, or minor findings remain.

## Design / Contract Compliance

- `applyKeyformTargetPatches` applies already-sampled patches to evaluated drawable state with deterministic patch ordering.
- Mesh `vertices` patches support `replace` and `additiveDelta`, update vertices, recompute bounds, update vertex count, and recompute a deterministic vertex hash.
- Drawable opacity / defaultOpacity, visible / visibility / runtimeVisibility, and draw order aliases are supported against the existing `EvaluatedDrawableDto` shape.
- Unsupported target kinds, unsupported properties, incompatible composition modes, missing targets, malformed patches, non-finite values, length mismatches, missing base vertices, and non-integer draw order results produce runtime diagnostics.
- Domain C does not integrate with `createRuntimeSnapshot`, `runtime-core.ts`, or public `index.ts`; snapshot wiring remains Domain D work.
- Domain C accepts Domain B's sample target metadata shape (`targetMetadata` plus `statePatch`) without editing Domain B sampling files.

## Development Compliance

- Write scope stayed within the Domain C source and focused test files.
- New production files have single responsibilities:
  - `drawable-geometry.ts`: bounds and deterministic vertex hashing.
  - `keyform-target-application.ts`: sampled patch application to evaluated drawable state.
- No `index.ts` implementation logic or unrelated module changes were introduced.
- Source organization guard passed.

## Test Adequacy

- Focused tests cover:
  - deterministic bounds and vertex hashing,
  - negative-near-zero hash normalization at configured precision,
  - mesh vertex replacement,
  - mesh additive deltas,
  - Domain B `targetMetadata` compatibility,
  - drawable opacity, visibility, and draw order patches,
  - unsupported target/property/mode diagnostics,
  - invalid patch shapes,
  - non-finite values,
  - vertex length mismatch,
  - non-integer draw order diagnostics.
- Verification evidence is sufficient for Domain C. Runtime snapshot integration and `keyformSamples` population are intentionally deferred to Domain D.

## Review Loop

Initial review verdict was `needs_changes` for a hash precision edge case where values rounding to negative zero could hash differently from `0`. The implementation was fixed by rounding before zero normalization and adding a regression test.

The initial review also noted a Domain B/C sample shape integration risk. Domain C now accepts flattened target fields and Domain B-style `targetMetadata`, with a focused compatibility test.

Post-fix clean review verdict: `pass`.

## Verification Evidence Reviewed

| Command | Outcome |
|---|---|
| `pnpm.cmd exec vitest run packages/runtime-core/src/drawable-geometry.test.ts packages/runtime-core/src/keyform-target-application.test.ts` | Sandbox run failed with `EPERM` opening Vitest from `node_modules`; escalated rerun passed, 2 files / 8 tests |
| `pnpm.cmd exec vitest run packages/runtime-core/src` | Escalated rerun passed, 12 files / 30 tests |
| `pnpm.cmd typecheck` | Passed on final rerun |
| `pnpm.cmd run check:source` | Passed |

## Remaining Issues

- None for Domain C.
- Domain D must wire sampled patches into snapshot creation before snapshot detail filtering can omit vertices needed by mesh `additiveDelta`.

## User-Decision Points

- None.

## Provisional Assumptions

- Domain D will pass evaluated drawable vertices into Domain C before snapshot-detail stripping when mesh `additiveDelta` patches are possible.
- `rigControl` target application remains future scope for Wave 12 and should produce an unsupported target diagnostic in this domain.
