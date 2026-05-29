# Implementation Map

> Lightweight map for implementation orchestration artifacts.

## Role

This directory stores wave plans, domain completion reports, Review-Sylph reports, integration reviews, early escape reports, and final reports for implementation runs.

## Expected Structure

```text
discussion/implementation/
  _map.md
  orchestration/
  reviews/
  waves/
```

## Current State

- The previous `/goal`-oriented development convention policy has been discarded.
- Active implementation orchestration should use `.codex/skills/implementation-orchestration/SKILL.md` plus wave-specific plans stored here.
- Wave 0 foundation scaffold is implementation-proven as of 2026-05-28. Evidence is recorded in [reviews/wave0/wave0-foundation-review.md](reviews/wave0/wave0-foundation-review.md), [waves/wave0/wave0-foundation-completion.md](waves/wave0/wave0-foundation-completion.md), and [waves/wave0/integration-review.md](waves/wave0/integration-review.md).
- A Wave 0 plan exists at [orchestration/wave0-plan.md](orchestration/wave0-plan.md).
- The Wave 0 package naming follow-up was resolved after Wave 0 by aligning active development conventions to `contracts` / `validator-core`.
- Wave 1 contracts foundation completed on 2026-05-29 with public barrel export integration, integration review, final report, and full verification pass. Evidence is recorded in [waves/wave1/wave1-final-report.md](waves/wave1/wave1-final-report.md) and [waves/wave1/integration-review.md](waves/wave1/integration-review.md).
- Wave 2 package / runtime / validator foundation completed on 2026-05-29 with package-format, runtime-core, validator-core, minimal contract fixture, integration review, final report, and full verification pass. Evidence is recorded in [waves/wave2/wave2-final-report.md](waves/wave2/wave2-final-report.md) and [waves/wave2/integration-review.md](waves/wave2/integration-review.md).
- Wave 3 authoring / operation foundation completed on 2026-05-29 with `authoring-core`, `operation-core` DTO / lifecycle foundation, `minimal-operation-create-parameter` fixture, integration review, final report, and full verification pass. Evidence is recorded in [waves/wave3/wave3-final-report.md](waves/wave3/wave3-final-report.md) and [waves/wave3/integration-review.md](waves/wave3/integration-review.md).
- Wave 4 runtime / validation evidence integration completed on 2026-05-29 with authoring runtime adapter, runtime evidence helper, validator evidence helper, operation evidence provider hook, minimal runtime/validation evidence fixture, integration review, final report, and full verification pass. Evidence is recorded in [waves/wave4/wave4-final-report.md](waves/wave4/wave4-final-report.md) and [waves/wave4/integration-review.md](waves/wave4/integration-review.md).

## Key References

| Path | Purpose |
|---|---|
| [orchestration/wave0-plan.md](orchestration/wave0-plan.md) | Current Wave 0 implementation foundation plan |
| [orchestration/wave1-plan.md](orchestration/wave1-plan.md) | Wave 1 contracts-foundation dependency and Orch-Sylph parallelism plan |
| [orchestration/wave2-plan.md](orchestration/wave2-plan.md) | Wave 2 package/runtime/validator foundation dependency and Orch-Sylph parallelism plan |
| [orchestration/wave3-plan.md](orchestration/wave3-plan.md) | Wave 3 authoring/operation foundation dependency and Orch-Sylph parallelism plan |
| [orchestration/wave4-plan.md](orchestration/wave4-plan.md) | Wave 4 runtime/validation evidence integration dependency and Orch-Sylph parallelism plan |
| [waves/wave1/_map.md](waves/wave1/_map.md) | Wave 1 domain completion reports, integration review, and final report |
| [waves/wave2/_map.md](waves/wave2/_map.md) | Wave 2 domain completion reports, integration review, and final report |
| [waves/wave3/_map.md](waves/wave3/_map.md) | Wave 3 domain completion reports, integration review, and final report |
| [waves/wave4/_map.md](waves/wave4/_map.md) | Wave 4 domain completion reports, integration review, and final report |
| [reviews/wave1/_map.md](reviews/wave1/_map.md) | Wave 1 domain review reports |
| [reviews/wave2/_map.md](reviews/wave2/_map.md) | Wave 2 domain review reports |
| [reviews/wave3/_map.md](reviews/wave3/_map.md) | Wave 3 domain review reports |
| [reviews/wave4/_map.md](reviews/wave4/_map.md) | Wave 4 domain review reports |
| [../development_convention/source-file-organization-policy.md](../development_convention/source-file-organization-policy.md) | Source file responsibility and `index.ts` guardrail |
| `.codex/skills/implementation-orchestration/SKILL.md` | Active orchestration skill basis |

## Next Actions

1. Use [waves/wave4/wave4-final-report.md](waves/wave4/wave4-final-report.md) as the completion basis for the next wave.
2. Plan the next implementation wave around package persistence, operation log persistence, generated runtime state / validation report artifact writing, and package revision persistence before GUI / AI implementation.
3. Keep GUI / AI implementation deferred until operation result evidence can be saved and reloaded as durable package artifacts.
