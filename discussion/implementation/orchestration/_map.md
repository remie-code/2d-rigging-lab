# Implementation Orchestration Map

> Entry map for implementation wave plans and final orchestration reports.

## Files

| Path | Role | Status |
|---|---|---|
| [wave0-plan.md](wave0-plan.md) | Wave 0 implementation foundation plan | Completed / implementation-proven |
| [wave1-plan.md](wave1-plan.md) | Wave 1 contracts-foundation dependency and parallelism plan | Completed / implementation-proven |
| [wave2-plan.md](wave2-plan.md) | Wave 2 package/runtime/validator foundation dependency and parallelism plan | Completed / implementation-proven |
| [wave3-plan.md](wave3-plan.md) | Wave 3 authoring/operation foundation dependency and parallelism plan | Completed / implementation-proven |

## Current Decision

- The active orchestration basis is `.codex/skills/implementation-orchestration/SKILL.md` plus wave-specific plans under `discussion/implementation/`.
- The previous `/goal`-oriented development convention policy has been discarded.
- Wave 0 is complete and provides the package/test/check scaffold.
- Wave 1 `contracts-foundation` completed on 2026-05-29. The final domain was `wave1-contracts-integration`.
- Wave 1 public integration keeps `packages/contracts/src/index.ts` as a barrel-only export surface.
- Wave 2 `package-runtime-validator-foundation` completed on 2026-05-29. The final domain was `wave2-integration-review-and-final-report`.
- Wave 2 public integration keeps `packages/package-format/src/index.ts`, `packages/runtime-core/src/index.ts`, and `packages/validator-core/src/index.ts` as barrel-only export surfaces.
- Wave 3 `authoring-operation-foundation` completed on 2026-05-29. The final domain was `wave3-integration-review-and-final-report`.
- Wave 3 introduced `authoring-core`, operation DTOs, minimal dry-run / commit lifecycle, and `minimal-operation-create-parameter` fixture while keeping public `index.ts` files barrel-only.
