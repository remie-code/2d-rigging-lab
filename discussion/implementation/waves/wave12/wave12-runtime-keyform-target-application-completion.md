# Wave 12 Domain C Completion: Runtime Keyform Target Application

> Wave: `runtime-keyform-evaluation-foundation`
> Domain: `wave12-runtime-keyform-target-application`
> Orchestrator: Orch-Sylph
> Verdict: `pass`

## Scope Changed

- Runtime-core sampled keyform target application foundation.
- Runtime-core drawable geometry helpers for deterministic bounds and vertex hashing.
- Focused runtime-core tests for target application and geometry.
- Persistent Domain C review and completion reports.

## Basis Documents Used

- `.agents/skills/implementation-orchestration/SKILL.md`
- `C:/Users/remie/.codex/skills/subagent-context-hygiene/SKILL.md`
- `discussion/implementation/orchestration/wave12-plan.md`
- `discussion/implementation/waves/wave12/wave12-runtime-keyform-binding-identity-and-parameter-resolution-completion.md`
- `discussion/design/module-contracts/runtime-core-contract.md`
- `discussion/development_convention/source-file-organization-policy.md`
- `packages/runtime-core/src/normalized-runtime-graph.ts`
- `packages/runtime-core/src/keyform-evaluation-types.ts`
- `packages/runtime-core/src/parameter-resolution.ts`
- `packages/runtime-core/src/snapshot.ts`
- `packages/runtime-core/src/diagnostics.ts`
- `packages/runtime-core/src/keyform-sampling.ts` as read-only integration shape reference after Domain B files appeared in the workspace

## Implementation Summary

- Added `packages/runtime-core/src/drawable-geometry.ts` with:
  - `computeBoundsFromVertices`,
  - deterministic `createStableVertexHash`,
  - precision-aware coordinate formatting with negative-zero normalization after rounding.
- Added `packages/runtime-core/src/keyform-target-application.ts` with `applyKeyformTargetPatches`.
- Added Domain C-local sampled patch input types so the target application step does not require changes to `keyform-evaluation-types.ts`.
- Supported mesh `vertices` target application:
  - `replace` uses a Vec2 array as the evaluated vertices,
  - `additiveDelta` adds a Vec2 array to existing evaluated drawable vertices,
  - updates `vertices`, `bounds`, `vertexCount`, and `vertexHash` deterministically.
- Supported drawable target application:
  - opacity / defaultOpacity with `replace`, `additiveDelta`, and `multiplyOpacity`, clamped to `[0, 1]`,
  - visible / visibility / runtimeVisibility with boolean `replace`,
  - drawOrder / baseDrawOrder / evaluatedDrawOrder with numeric `replace` and `additiveDelta`, requiring integer results.
- Returned deterministic sorted drawables and draw list based on visible drawables.
- Returned diagnostics instead of silent ignores for unsupported target kinds, unsupported target properties, unsupported composition modes, missing targets, invalid patch shapes, non-finite values, missing base vertices, vertex length mismatch, and non-integer draw order.
- Accepted both flattened patch target fields and Domain B-style `targetMetadata` / `statePatch` sample shape for downstream Domain D integration.
- Did not integrate with `createRuntimeSnapshot`; Domain D owns snapshot wiring.

## Orchestration

- Implementation was delegated to Gnome with a bounded write scope.
- Clean review was delegated to Review-Sylph after implementation and verification evidence existed.
- Review-Sylph received basis docs, target files, verification evidence, and a focused rubric; it did not rely only on the implementation summary.
- A first clean review returned `needs_changes`; Orch-Sylph applied the review fixes and sent a post-fix clean review, which returned `pass`.

## Review Findings and Resolution

| Finding | Resolution |
|---|---|
| Vertex hash formatting normalized `-0` before rounding, so a value like `-0.000004` could become `-0.00000` and hash differently from `0.00000`. | Changed coordinate formatting to round first, normalize negative zero after rounding, and added a regression test. |
| Domain B samples used `targetMetadata`, while Domain C initially expected flattened `targetKind` / `targetId` / `targetProperty`. | Added `targetMetadata` support while retaining flattened fields, plus a focused compatibility test. |

Persistent review report: `discussion/implementation/reviews/wave12/wave12-runtime-keyform-target-application-review.md`.

## Files Changed

- `packages/runtime-core/src/drawable-geometry.ts`
- `packages/runtime-core/src/keyform-target-application.ts`
- `packages/runtime-core/src/drawable-geometry.test.ts`
- `packages/runtime-core/src/keyform-target-application.test.ts`
- `discussion/implementation/reviews/wave12/wave12-runtime-keyform-target-application-review.md`
- `discussion/implementation/waves/wave12/wave12-runtime-keyform-target-application-completion.md`

## Verification Performed

| Command | Outcome |
|---|---|
| `pnpm.cmd exec vitest run packages/runtime-core/src/drawable-geometry.test.ts packages/runtime-core/src/keyform-target-application.test.ts` | Sandbox run failed with `EPERM` opening `node_modules/.../vitest.mjs`; escalated rerun passed, 2 files / 6 tests before review fix |
| `pnpm.cmd exec vitest run packages/runtime-core/src/drawable-geometry.test.ts packages/runtime-core/src/keyform-target-application.test.ts` | Escalated rerun after review fixes passed, 2 files / 8 tests |
| `pnpm.cmd exec vitest run packages/runtime-core/src` | Escalated rerun before review fixes passed, 12 files / 28 tests |
| `pnpm.cmd exec vitest run packages/runtime-core/src` | Escalated rerun after review fixes passed, 12 files / 30 tests |
| `pnpm.cmd exec tsc --noEmit --target ES2022 --lib ES2022 --module NodeNext --moduleResolution NodeNext --strict --verbatimModuleSyntax --isolatedModules --skipLibCheck --forceConsistentCasingInFileNames --noUncheckedIndexedAccess --exactOptionalPropertyTypes --types node,vitest/globals packages/runtime-core/src/drawable-geometry.ts packages/runtime-core/src/keyform-target-application.ts packages/runtime-core/src/drawable-geometry.test.ts packages/runtime-core/src/keyform-target-application.test.ts` | Passed |
| `pnpm.cmd typecheck` | First run during parallel work failed in Domain B-owned `packages/runtime-core/src/keyform-sampling.ts`; final escalated rerun passed |
| `pnpm.cmd run check:source` | Passed |

## Remaining Issues

- Runtime snapshot integration is not implemented in Domain C and remains assigned to Domain D.
- `keyformSamples` population remains assigned to Domain B / Domain D integration.
- Domain D must call target application before omitting full vertices when mesh `additiveDelta` patches require base vertices.
- Domain B files were present in the workspace during this run; Domain C read `keyform-sampling.ts` only as an integration-shape reference and did not edit Domain B files.

## User-Decision Points

- None.

## Provisional Assumptions

- `targetKind: "rigControl"` is intentionally unsupported in Domain C for Wave 12 and should produce diagnostics.
- `defaultOpacity` maps to evaluated runtime `opacity`.
- `drawOrder` and `evaluatedDrawOrder` update `evaluatedDrawOrder`; `baseDrawOrder` updates both base and evaluated order so runtime-visible draw order changes.
- Mesh IDs are effectively one-to-one with drawables for MVP. If duplicate mesh IDs appear, Domain C chooses the lowest drawable ID deterministically.
