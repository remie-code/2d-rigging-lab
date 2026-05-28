# Development Convention Review

## Status

Accepted

## Scope

This review covers the P0/P1 development convention documents created under `discussion/development_convention/` from the authoritative basis set:

- `discussion/development_convention/basis/00_overview.md`
- `discussion/development_convention/basis/01_common_policy_template.md`
- `discussion/development_convention/basis/02_p0_policy_specs.md`
- `discussion/development_convention/basis/03_p1_policy_specs.md`
- `discussion/development_convention/basis/04_required_diagrams_and_tables.md`

It also checks alignment with `discussion/_conventions.md`, `discussion/acceptance-criteria/`, `discussion/scenarios/`, `discussion/design/module-contracts/`, `discussion/tests/`, `discussion/demo/streaming-demo-policy.md`, and `discussion/proposal/live2d-feature-proposal-template.md`.

## Reviewed Documents

| Priority | Policy | Status | Mermaid diagrams | Required table groups | Verdict |
|---|---|---:|---:|---:|---|
| P0 | `source-of-truth-policy.md` | Accepted | 2 | 3 | pass |
| P0 | `repository-structure-policy.md` | Accepted | 3 | 3 | pass |
| P0 | `module-boundary-policy.md` | Accepted | 3 | 4 | pass |
| P0 | `schema-and-id-conventions.md` | Accepted | 2 | 3 | pass |
| P0 | `runtime-and-dynamics-implementation-policy.md` | Accepted | 3 | 4 | pass |
| P0 | `operation-policy.md` | Accepted | 2 | 3 | pass |
| P0 | `testing-and-acceptance-policy.md` | Accepted | 4 | 4 | pass |
| P0 | `diagnostic-policy.md` | Accepted | 2 | 3 | pass |
| P1 | `gui-implementation-policy.md` | Accepted | 3 | 4 | pass |
| P1 | `ai-assistant-implementation-policy.md` | Accepted | 3 | 4 | pass |
| P1 | `demo-rights-ip-policy.md` | Accepted | 3 | 4 | pass |
| P1 | `dependency-policy.md` | Accepted | 2 | 4 | pass |
| P1 | `review-and-pr-policy.md` | Accepted | 2 | 4 | pass |
| P1 | `subagent-workflow-policy.md` | Accepted | 3 | 4 | pass |
| P1 | `e2e-test-policy.md` | Accepted | 4 | 4 | pass |

## Findings

### Blocking

None.

### Warnings

| ID | Finding | Impact | Required follow-up |
|---|---|---|---|
| WARN-DEVCONV-001 | The basis documents still contain historical example output paths under `discussion/development/`, while the user task explicitly requires output under `discussion/development_convention/`. | Future agents may search the older path if they read only the basis path examples. | Keep the created policies under `discussion/development_convention/` for this task. Update basis path examples or repository maps in a later cleanup if the directory decision becomes durable project policy. |

### Suggestions

| ID | Finding | Suggested action |
|---|---|---|
| SUG-DEVCONV-001 | Several policies include local Conflict Resolution Log examples. | When implementation begins, consider creating a central conflict log path if repeated cross-policy conflicts appear. |

## Basis Compliance

| Gate | Result | Evidence |
|---|---|---|
| All P0/P1 policies exist | pass | 15 policy files exist under `discussion/development_convention/`. |
| Common template sections exist | pass | Each policy contains Status, Purpose, Scope, Source Documents, Required Decisions, Required Diagrams, Required Tables, Rules, Forbidden, Required Evidence, Review Checklist, Conflict Handling, Change Process, and Completion Gate. |
| Required Decisions exist | pass | Each policy has numbered `DEC-*` decisions matching its scope. |
| Required diagrams exist | pass | Diagram counts match `04_required_diagrams_and_tables.md`: 40 Mermaid diagrams total across all policies. |
| Required tables exist | pass | Required table groups are present for each policy. |
| Rules / Forbidden / Evidence / Checklist exist | pass | All policies include explicit rules, forbidden actions, required evidence, and review checklist sections. |
| Conflict handling exists | pass | Each policy defines conflict handling and a Conflict Resolution Log format or current log. |
| P0 readiness | pass | P0 policies define source authority, repository structure, module boundaries, schema/ID, runtime/dynamics, operations, tests/acceptance, and diagnostics before implementation starts. |
| P1 readiness | pass | P1 policies define GUI, AI, demo/rights/IP, dependencies, review/PR, subagent workflow, and E2E requirements before corresponding module implementation. |

## Guardrail Review

| Guardrail | Result |
|---|---|
| Monorepo is fixed | pass |
| Baseline remains Private 2D Rigging Lab / Prototype | pass |
| Minimum Open Dynamics v1 remains in MVP | pass |
| RuntimeStateDto is explicit input/output and not hidden mutable state | pass |
| RuntimeState artifact and RuntimeState sequence artifact are distinct | pass |
| Operation Core is the mutation boundary | pass |
| AI changes require dry-run and human approval before commit | pass |
| Candidate diagnostics alone cannot be MVP-blocking oracle | pass |
| Structured evidence, not screenshots alone, is the primary acceptance basis | pass |
| Cubism formats, SDK/Core, Viewer consistency, Physics compatibility, and existing Cubism models are not implementation/test/acceptance oracles | pass |
| Machine-readable IDs must contain no spaces | pass |

## Integrator Decision

The P0/P1 development convention document set is accepted for the requested `discussion/development_convention/` output location.

The only recorded warning is the pre-existing path mismatch between basis examples and the requested output directory. This review treats the user-provided output path as the task-local source of truth and does not move or duplicate files into `discussion/development/`.
