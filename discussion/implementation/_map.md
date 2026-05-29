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
- Wave 5 package persistence / operation log foundation completed on 2026-05-29 with package revision policy, operation log JSONL, authoring-to-package document adapter, package file set writer, runtime/validation artifact materializers, persisted operation evidence fixture, integration review, final report, and full verification pass. Evidence is recorded in [waves/wave5/wave5-final-report.md](waves/wave5/wave5-final-report.md) and [waves/wave5/integration-review.md](waves/wave5/integration-review.md).
- Wave 6 editor-ui operation persistence vertical slice completed on 2026-05-29 with `apps/editor`, browser-safe session adapter, semantic state/view model, operation UI, evidence/package panels, integration review, final report, and full verification pass. Evidence is recorded in [waves/wave6/wave6-final-report.md](waves/wave6/wave6-final-report.md) and [waves/wave6/integration-review.md](waves/wave6/integration-review.md).
- Wave 7 editor project persistence and e2e hardening completed on 2026-05-29 with DOM-free core/editor typecheck split, operation log hydration, browser-local project persistence, save/load/reset UI, durable editor e2e smoke, integration review, final report, and full verification pass. Evidence is recorded in [waves/wave7/wave7-final-report.md](waves/wave7/wave7-final-report.md) and [waves/wave7/integration-review.md](waves/wave7/integration-review.md).
- Wave 8 AI interface dry-run command foundation completed on 2026-05-29 with `packages/ai-interface`, transport-independent command schemas, dry-run / approval / commit executor, read command host contract, editor in-process AI host, transcript fixture, clean integration review, final report, and full verification pass. Evidence is recorded in [waves/wave8/wave8-final-report.md](waves/wave8/wave8-final-report.md), [waves/wave8/integration-review.md](waves/wave8/integration-review.md), and [reviews/wave8/wave8-integration-clean-review.md](reviews/wave8/wave8-integration-clean-review.md).
- Wave 9 AI command approval UI and transcript persistence completed on 2026-05-29 with visible AI approval workflow, browser-local transcript persistence, transcript/operation-log correlation, desktop/mobile e2e coverage, clean integration review, final report, and full verification pass. Evidence is recorded in [waves/wave9/wave9-final-report.md](waves/wave9/wave9-final-report.md), [waves/wave9/integration-review.md](waves/wave9/integration-review.md), and [reviews/wave9/wave9-integration-clean-review.md](reviews/wave9/wave9-integration-clean-review.md).
- Wave 10 AI read / inspection / validation command foundation completed on 2026-05-29 with internal `inspectModel`, `inspectTarget`, and `validatePackage` command contracts, editor projectors, host integration, compact fixture regression, integration review, final report, and full verification pass. Evidence is recorded in [waves/wave10/wave10-final-report.md](waves/wave10/wave10-final-report.md), [waves/wave10/integration-review.md](waves/wave10/integration-review.md), and [reviews/wave10/wave10-integration-clean-review.md](reviews/wave10/wave10-integration-clean-review.md).

## Key References

| Path | Purpose |
|---|---|
| [orchestration/wave0-plan.md](orchestration/wave0-plan.md) | Current Wave 0 implementation foundation plan |
| [orchestration/wave1-plan.md](orchestration/wave1-plan.md) | Wave 1 contracts-foundation dependency and Orch-Sylph parallelism plan |
| [orchestration/wave2-plan.md](orchestration/wave2-plan.md) | Wave 2 package/runtime/validator foundation dependency and Orch-Sylph parallelism plan |
| [orchestration/wave3-plan.md](orchestration/wave3-plan.md) | Wave 3 authoring/operation foundation dependency and Orch-Sylph parallelism plan |
| [orchestration/wave4-plan.md](orchestration/wave4-plan.md) | Wave 4 runtime/validation evidence integration dependency and Orch-Sylph parallelism plan |
| [orchestration/wave5-plan.md](orchestration/wave5-plan.md) | Wave 5 package persistence / operation log foundation dependency and Orch-Sylph parallelism plan |
| [orchestration/wave6-plan.md](orchestration/wave6-plan.md) | Wave 6 editor-ui operation persistence vertical slice dependency and Orch-Sylph parallelism plan |
| [orchestration/wave7-plan.md](orchestration/wave7-plan.md) | Wave 7 editor project persistence and e2e hardening dependency and Orch-Sylph parallelism plan |
| [orchestration/wave8-plan.md](orchestration/wave8-plan.md) | Wave 8 AI interface dry-run command foundation dependency and Orch-Sylph parallelism plan |
| [orchestration/wave9-plan.md](orchestration/wave9-plan.md) | Wave 9 AI command approval UI and transcript persistence dependency and Orch-Sylph parallelism plan |
| [orchestration/wave10-plan.md](orchestration/wave10-plan.md) | Wave 10 internal AI read / inspection / validation command foundation dependency and Orch-Sylph parallelism plan |
| [waves/wave1/_map.md](waves/wave1/_map.md) | Wave 1 domain completion reports, integration review, and final report |
| [waves/wave2/_map.md](waves/wave2/_map.md) | Wave 2 domain completion reports, integration review, and final report |
| [waves/wave3/_map.md](waves/wave3/_map.md) | Wave 3 domain completion reports, integration review, and final report |
| [waves/wave4/_map.md](waves/wave4/_map.md) | Wave 4 domain completion reports, integration review, and final report |
| [waves/wave5/_map.md](waves/wave5/_map.md) | Wave 5 domain completion reports, integration review, and final report |
| [waves/wave6/_map.md](waves/wave6/_map.md) | Wave 6 domain completion reports, integration review, and final report |
| [waves/wave7/_map.md](waves/wave7/_map.md) | Wave 7 domain completion reports, integration review, and final report |
| [waves/wave8/_map.md](waves/wave8/_map.md) | Wave 8 domain completion reports, integration review, and final report |
| [waves/wave9/_map.md](waves/wave9/_map.md) | Wave 9 domain completion reports, integration review, and final report |
| [waves/wave10/_map.md](waves/wave10/_map.md) | Wave 10 domain completion reports, integration review, and final report |
| [reviews/wave1/_map.md](reviews/wave1/_map.md) | Wave 1 domain review reports |
| [reviews/wave2/_map.md](reviews/wave2/_map.md) | Wave 2 domain review reports |
| [reviews/wave3/_map.md](reviews/wave3/_map.md) | Wave 3 domain review reports |
| [reviews/wave4/_map.md](reviews/wave4/_map.md) | Wave 4 domain review reports |
| [reviews/wave5/_map.md](reviews/wave5/_map.md) | Wave 5 domain review reports |
| [reviews/wave6/_map.md](reviews/wave6/_map.md) | Wave 6 domain and clean integration review reports |
| [reviews/wave7/_map.md](reviews/wave7/_map.md) | Wave 7 clean integration review reports |
| [reviews/wave8/_map.md](reviews/wave8/_map.md) | Wave 8 clean integration review reports |
| [reviews/wave9/_map.md](reviews/wave9/_map.md) | Wave 9 clean integration review reports |
| [reviews/wave10/_map.md](reviews/wave10/_map.md) | Wave 10 clean integration review reports |
| [../development_convention/source-file-organization-policy.md](../development_convention/source-file-organization-policy.md) | Source file responsibility and `index.ts` guardrail |
| `.codex/skills/implementation-orchestration/SKILL.md` | Active orchestration skill basis |

## Next Actions

1. Plan the next wave as `ai-operation-catalog-expansion` unless the user explicitly prioritizes broader inspection/runtime surface work.
2. Keep external HTTP/WebSocket/MCP transport in Future scope unless the current MVP boundary is explicitly changed.
3. Continue passing [../development_convention/source-file-organization-policy.md](../development_convention/source-file-organization-policy.md) to implementation domains that write authored source.
