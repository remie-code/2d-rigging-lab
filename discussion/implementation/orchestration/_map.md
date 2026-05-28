# Implementation Orchestration Map

> Entry map for implementation wave plans and final orchestration reports.

## Files

| Path | Role | Status |
|---|---|---|
| [wave0-plan.md](wave0-plan.md) | Wave 0 implementation foundation plan | Completed / implementation-proven |
| [wave1-plan.md](wave1-plan.md) | Wave 1 contracts-foundation dependency and parallelism plan | Draft for user review |

## Current Decision

- The active orchestration basis is `.codex/skills/implementation-orchestration/SKILL.md` plus wave-specific plans under `discussion/implementation/`.
- The previous `/goal`-oriented development convention policy has been discarded.
- Wave 0 is complete and provides the package/test/check scaffold.
- Wave 1 should start with `contracts-foundation`; the first implementation domain is `contracts-zod-and-core`.
- Wave 1 parallelism is staged: diagnostics and runtime evidence may run in parallel only after core IDs/primitives and Zod dependency evidence are complete.
