# Implementation Orchestration Policy Discard Record

## Status

Accepted.

## Decision

`discussion/development_convention/implementation-orchestration-policy.md` and its `/goal` companion documents were discarded.

Active implementation orchestration now lives under:

- `discussion/implementation/orchestration/wave0-plan.md`
- `.codex/skills/implementation-orchestration/SKILL.md`

## Rationale

The previous policy still centered `/goal` as the primary execution surface. The current implementation approach is to let Undine act directly as L0 coordinator, launch bounded Orch-Sylph domains, and keep wave-specific execution plans under `discussion/implementation/`.

## Follow-Up

- Keep source-file organization policy active under `discussion/development_convention/`.
- Use `discussion/implementation/` for wave plans, completion reports, reviews, integration reviews, and final reports.
- Treat old basis references to `implementation-orchestration-policy.md` as historical, not active.
