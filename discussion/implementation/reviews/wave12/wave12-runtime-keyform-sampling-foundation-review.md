# Wave 12 Domain B Review: Runtime Keyform Sampling Foundation

> Wave: `runtime-keyform-evaluation-foundation`
> Domain: `wave12-runtime-keyform-sampling-foundation`
> Reviewer: Review-Sylph
> Verdict: `pass`

## Scope Reviewed

- `packages/runtime-core/src/keyform-linear1d-interpolation.ts`
- `packages/runtime-core/src/keyform-grid2d-interpolation.ts`
- `packages/runtime-core/src/keyform-sampling.ts`
- `packages/runtime-core/src/keyform-linear1d-interpolation.test.ts`
- `packages/runtime-core/src/keyform-grid2d-interpolation.test.ts`
- `packages/runtime-core/src/keyform-sampling.test.ts`

## Basis Documents Used

- `discussion/implementation/orchestration/wave12-plan.md`
- `discussion/design/module-contracts/runtime-core-contract.md`
- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/implementation/waves/wave12/wave12-runtime-keyform-binding-identity-and-parameter-resolution-completion.md`

## Findings

- Blocking findings: none.
- Needs-change findings: none.

## Design / Development Compliance

- Pass.
- Sampling stays Domain B-local and does not wire snapshot/runtime-core integration.
- Linear and grid sampling are deterministic from effective parameter values, with sorted keys, deterministic duplicate handling, exact/interpolated/clamped paths, and state patch cloning/interpolation.
- Sample output preserves `keyformSetId`, `evaluator`, sampled coordinates, target metadata, `compositionMode`, `compositionOrder`, and sampled `statePatch`.
- Diagnostics are emitted for missing effective params, missing grid parameter/value inputs, duplicate linear keys, duplicate grid coordinates, unsupported evaluator, unsupported/incompatible patch shapes, missing grid keys, coordinate clamp cases, and missing sampling targets.
- Source organization is compliant: responsibility-specific files, no `index.ts` implementation logic, and no broad catch-all file.

## Test Adequacy

- Pass for Domain B gate.
- Focused tests cover:
  - Linear exact key sampling, interpolation, endpoint clamp, unsupported patch shape, and incompatible patch shape.
  - Grid exact key sampling, bilinear numeric interpolation, bilinear `Vec2[]` interpolation, and missing surrounding key diagnostics.
  - Sampler metadata preservation, coordinate clamp diagnostics, unsupported patch diagnostics, missing grid key diagnostics, and missing target diagnostics.
- Remaining non-blocking regression gaps:
  - Duplicate linear-key diagnostics.
  - Duplicate grid-coordinate diagnostics.
  - Missing-parameter diagnostics.
  - Unsupported evaluator diagnostics.
  - Grid key-range clamp independent of parameter-range clamp.

## Verification Evidence Reviewed

| Command | Outcome |
|---|---|
| `pnpm.cmd exec vitest run packages/runtime-core/src/keyform-linear1d-interpolation.test.ts packages/runtime-core/src/keyform-grid2d-interpolation.test.ts packages/runtime-core/src/keyform-sampling.test.ts` | Passed after sandbox EPERM required escalated rerun, 3 files / 9 tests |
| `pnpm.cmd exec vitest run packages/runtime-core/src` | Passed after escalated run, 12 files / 31 tests |
| `pnpm.cmd exec tsc --noEmit --module NodeNext --moduleResolution NodeNext --target ES2022 --lib ES2022 --strict --verbatimModuleSyntax --isolatedModules --skipLibCheck --forceConsistentCasingInFileNames --noUncheckedIndexedAccess --exactOptionalPropertyTypes --types node,vitest packages/runtime-core/src/keyform-sampling.ts packages/runtime-core/src/keyform-grid2d-interpolation.ts packages/runtime-core/src/keyform-linear1d-interpolation.ts packages/runtime-core/src/keyform-sampling.test.ts packages/runtime-core/src/keyform-grid2d-interpolation.test.ts packages/runtime-core/src/keyform-linear1d-interpolation.test.ts` | Passed after sandbox EPERM required escalated rerun |
| `git diff --check -- packages/runtime-core/src/keyform-sampling.ts packages/runtime-core/src/keyform-grid2d-interpolation.ts packages/runtime-core/src/keyform-linear1d-interpolation.ts packages/runtime-core/src/keyform-sampling.test.ts packages/runtime-core/src/keyform-grid2d-interpolation.test.ts packages/runtime-core/src/keyform-linear1d-interpolation.test.ts` | Passed |

## Remaining Issues

- Full repository `pnpm.cmd typecheck` is currently blocked by out-of-scope Domain C compile errors in `packages/runtime-core/src/keyform-target-application.ts`.
- Domain B does not integrate samples into snapshots; that remains assigned to Domain D.
- Domain B does not apply sampled patches to drawables/meshes/rig controls; that remains assigned to Domain C.

## User-Decision Points

- None.

## Provisional Assumptions

- Domain B is responsible for producing samples and diagnostics only, not applying target patches to runtime state.
- Later Domain D may pass the richer Domain B sample object through the existing passthrough `KeyformSampleSchema`.
