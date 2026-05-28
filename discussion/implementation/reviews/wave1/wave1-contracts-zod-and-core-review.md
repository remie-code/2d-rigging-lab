# Wave 1 Contracts Zod And Core Review

> Date: 2026-05-29  
> Domain: `wave1-contracts-zod-and-core`  
> Reviewer mode: Clean-context Review-Sylph  
> Verdict: `pass`

## Basis

- `discussion/implementation/orchestration/wave1-plan.md`
- `discussion/implementation/waves/wave0/integration-review.md`
- `discussion/design/module-contracts/module-boundaries.md`
- `discussion/design/module-contracts/typescript-contracts.md`
- `discussion/development_convention/repository-structure-policy.md`
- `discussion/development_convention/module-boundary-policy.md`
- `discussion/development_convention/schema-and-id-conventions.md`
- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/development_convention/dependency-policy.md`
- `discussion/development_convention/review-and-pr-policy.md`
- `discussion/development_convention/subagent-workflow-policy.md`

## Reviewed Scope

- `packages/contracts/package.json`
- `packages/contracts/src/brand.ts`
- `packages/contracts/src/ids.ts`
- `packages/contracts/src/primitives.ts`
- `packages/contracts/src/enums.ts`
- `packages/contracts/src/ids-core.test.ts`
- `packages/contracts/src/primitives-core.test.ts`
- `generated/dependencies/dependency-registry.json`
- `pnpm-lock.yaml`

## Design / Development Compliance Review

Verdict: `pass`

- `zod` is recorded in the contracts manifest, lockfile, and dependency registry with exact resolved version `4.4.3`, purpose, license, scope, and approval/status evidence.
- New authored source is split by responsibility: `brand.ts`, `ids.ts`, `primitives.ts`, and `enums.ts`.
- `packages/contracts/src/index.ts` was not edited; export integration remains owned by the later integration domain.
- No catch-all source file was created.
- No downstream package behavior, IO, runtime algorithm, validator behavior, GUI behavior, AI behavior, Cubism dependency, or Cubism oracle leaked into this domain.
- `RuntimeEvaluationProfileSchema` is retained only as an explicitly deprecated legacy export, matching the domain assignment and `typescript-contracts.md`; no new contract consumes it beyond compatibility parsing.

## Test Adequacy Review

Verdict: `pass`

- ID tests cover all branded ID prefixes with valid examples.
- ID tests reject wrong prefix, spaces, and empty suffix.
- Primitive tests cover finite number rejection of `Infinity` and `NaN`, Vec2 DTO parsing, Rect nonnegative dimensions, and Transform2D parsing.
- Common enum tests cover representative authoring, diagnostic, runtime, and deprecated legacy enum parsing plus invalid value rejection.
- `Vec2DtoSchema`, `RectDtoSchema`, and `Transform2DDtoSchema` are tested as policy-compliant canonical names; `Vec2Schema`, `RectSchema`, and `Transform2DSchema` remain tested compatibility aliases for the design sketch names.

## Findings

### Resolved: DTO schema naming versus design sketch naming

Initial review found a source conflict between `schema-and-id-conventions.md`, which requires external DTO schema names like `<Name>DtoSchema`, and `typescript-contracts.md`, which sketches `Vec2Schema`, `RectSchema`, and `Transform2DSchema`.

Resolution: the implementation now provides canonical `Vec2DtoSchema`, `RectDtoSchema`, and `Transform2DDtoSchema` exports, while retaining the design sketch names as aliases. The reviewer rechecked this change and returned `pass`.

## Verification Evidence Considered

| Command | Outcome |
|---|---|
| `pnpm.cmd typecheck` | pass |
| `pnpm.cmd test` | pass, 3 files / 29 tests |
| `pnpm.cmd exec vitest run packages/contracts/src` | pass, 3 files / 29 tests |
| `pnpm.cmd check:deps` | pass |
| `pnpm.cmd check:source` | pass |
| `pnpm.cmd check` | pass |

## Remaining Issues

- None for this domain.

## User-Decision Points

- None.
