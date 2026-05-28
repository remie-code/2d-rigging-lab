---
name: implementation-orchestration
description: Use for implementation phases that need wave planning, bounded subagent delegation, create-review-fix loops, clean review contexts, persistent review records, and root context protection. Trigger when a user asks an implementation coordinator to run work through Undine -> Orch-Sylph -> Gnome/Review-Sylph style orchestration.
---

# Implementation Orchestration

Use this skill to keep implementation runs from collapsing into one overloaded root context.

## Core Model

```text
Undine (L0)
  -> Orch-Sylph per domain (L1)
    -> Gnome implementation (L2)
    -> Review-Sylph independent review (L2)
  -> Integrator wave review
  -> final report
```

## Context Firewall

Keep the root orchestrator's context small.

- Undine owns objective, wave plan, domain split, integration decisions, user questions, and final report.
- Orch-Sylph owns one domain loop and gathers domain-specific basis documents.
- Gnome receives only the implementation basis, write scope, tests, and applicable policies for that domain.
- Review-Sylph receives artifacts, verification summary, and review basis. It must not rely on the implementer's explanation as its only source.
- Integrator receives completion reports and shared-contract changes.

Do not load every project policy into Undine by default. Pass detailed policy documents to the subagents that need them.

## Required Flow

1. Confirm the upstream wave gate.
2. Build or load a dependency-aware wave plan.
3. Launch one Orch-Sylph per independent domain when subagents are available.
4. Have Orch-Sylph delegate implementation to Gnome and review to Review-Sylph.
5. Wait for each started domain to reach `pass`, `needs_fix`, `escalate`, or `blocked`.
6. Run Integrator review before marking a wave complete.
7. Write or update persistent reports.

If subagents are unavailable, record the fallback and preserve the same review gates.

## Subagent Call Header

Use a clear call header:

```text
[subagent-call] 呼び出し元: <caller>
```

Recommended callers:

- `Undine` for L0 -> L1
- `Orch-Sylph` for L1 -> Gnome/Review-Sylph
- `Undine - clean context review` for clean review

## Domain Assignment Must Include

- target and wave
- dependencies
- allowed write scope
- forbidden write scope
- basis documents
- applicable policies
- required tests and verification
- expected evidence
- loop limit
- early escape triggers

## Review Rules

Every implemented domain needs two review lanes unless explicitly N/A:

1. Design / Development Compliance Review
2. Test Adequacy Review

Clean Context Review is an execution mode, not a separate lane.

## Wait Rules

Undine must not cancel, summarize, or mark incomplete domain agents as complete just because they are still running or the root context is long.

If interruption is unavoidable, record the domain as incomplete, blocked, or escalated. Do not pass the wave gate.

## Early Escape

Stop and escalate when:

- source documents conflict
- module boundary is unclear
- test oracle is missing
- user decision is required
- review findings do not shrink for two consecutive loops
- dependency approval is required
- rights/provenance is missing
- implementation appears to require a forbidden oracle or boundary bypass

## Project-Specific Basis

When the workspace contains wave plans under `discussion/implementation/orchestration/`, treat the active wave plan as the project-specific execution basis.

When a source implementation domain writes authored source, include `discussion/development_convention/source-file-organization-policy.md` in the domain basis.
