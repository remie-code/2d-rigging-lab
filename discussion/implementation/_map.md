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

## Key References

| Path | Purpose |
|---|---|
| [orchestration/wave0-plan.md](orchestration/wave0-plan.md) | Current Wave 0 implementation foundation plan |
| [../development_convention/source-file-organization-policy.md](../development_convention/source-file-organization-policy.md) | Source file responsibility and `index.ts` guardrail |
| `.codex/skills/implementation-orchestration/SKILL.md` | Active orchestration skill basis |

## Next Actions

1. Plan Wave 1 `contracts-foundation` from [orchestration/wave0-plan.md](orchestration/wave0-plan.md) and `discussion/design/module-contracts/typescript-contracts.md`.
