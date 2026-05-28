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
- Wave 0 is referenced as complete in `discussion/_map.md`, but repository facts currently show no root `package.json`, `packages/`, `apps/`, `fixtures/`, or `generated/` scaffold. Treat Wave 0 as not yet implementation-proven until evidence is created or located.
- A new Wave 0 plan exists at [orchestration/wave0-plan.md](orchestration/wave0-plan.md).

## Key References

| Path | Purpose |
|---|---|
| [orchestration/wave0-plan.md](orchestration/wave0-plan.md) | Current Wave 0 implementation foundation plan |
| [../development_convention/source-file-organization-policy.md](../development_convention/source-file-organization-policy.md) | Source file responsibility and `index.ts` guardrail |
| `.codex/skills/implementation-orchestration/SKILL.md` | Active orchestration skill basis |

## Next Actions

1. Review and accept or revise [orchestration/wave0-plan.md](orchestration/wave0-plan.md).
2. Run Wave 0 foundation implementation.
3. Record Review-Sylph, completion, and integration artifacts under `reviews/wave0/` and `waves/wave0/`.
