# Wave 1 Contracts Zod And Core Completion

> Date: 2026-05-29  
> Domain: `wave1-contracts-zod-and-core`  
> Verdict: `pass`

## Summary

This domain implemented the Wave 1 foundation dependency gate and core contract source files for `packages/contracts`. It did not implement downstream feature behavior and did not edit `src/index.ts`.

## Files Changed

- `packages/contracts/package.json`
- `packages/contracts/src/brand.ts`
- `packages/contracts/src/ids.ts`
- `packages/contracts/src/primitives.ts`
- `packages/contracts/src/enums.ts`
- `packages/contracts/src/ids-core.test.ts`
- `packages/contracts/src/primitives-core.test.ts`
- `generated/dependencies/dependency-registry.json`
- `pnpm-lock.yaml`
- `discussion/implementation/reviews/wave1/wave1-contracts-zod-and-core-review.md`
- `discussion/implementation/waves/wave1/wave1-contracts-zod-and-core-completion.md`
- `discussion/implementation/reviews/wave1/_map.md`
- `discussion/implementation/waves/wave1/_map.md`

## Implementation Notes

- Gnome implemented the code/test slice in `packages/contracts/src/**` within a bounded write scope.
- Orch-Sylph owned dependency install, dependency registry update, verification, review loop, and persistent reports.
- Review-Sylph first escalated the DTO schema naming mismatch between design sketch and schema convention. Orch-Sylph resolved this by adding `Vec2DtoSchema`, `RectDtoSchema`, and `Transform2DDtoSchema` while retaining sketch-name aliases.
- `RuntimeEvaluationProfileSchema` remains as a deprecated legacy export because this domain explicitly required it and `typescript-contracts.md` documents it as legacy compatibility only.
- `zod` resolved to exact installed version `4.4.3`.

## Verification

| Command | Outcome |
|---|---|
| `pnpm.cmd add zod --filter @private-2d-rigging-lab/contracts` | pass, resolved `zod@4.4.3` |
| `pnpm.cmd install` | exit 0; pnpm printed a non-TTY module purge prompt, and `node_modules/.bin` was later confirmed present |
| `pnpm.cmd typecheck` | pass after sandbox EPERM rerun with escalation |
| `pnpm.cmd test` | pass, 3 files / 29 tests after sandbox EPERM rerun with escalation |
| `pnpm.cmd exec vitest run packages/contracts/src` | pass, 3 files / 29 tests after sandbox EPERM rerun with escalation |
| `pnpm.cmd check:deps` | pass |
| `pnpm.cmd check:source` | pass |
| `pnpm.cmd check` | pass after sandbox EPERM rerun with escalation |

## Review Outcomes

| Gate | Outcome |
|---|---|
| Design / Development Compliance Review | pass |
| Test Adequacy Review | pass |
| Clean-context Review-Sylph re-review | pass |

## Remaining Issues

- `packages/contracts/src/index.ts` still does not export the new contracts. This is intentional; `wave1-contracts-integration` owns exports.
- Runtime-specific DTO behavior beyond common enum foundations is intentionally deferred to later Wave 1 domains.

## User-Decision Points

- None for this domain.
