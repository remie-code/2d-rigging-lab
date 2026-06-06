# Development Convention Map

> Lightweight map for development convention documents. Details live in the linked policy files.

## Current Entry Points

| Path | Role | Status |
|---|---|---|
| [../implementation/_map.md](../implementation/_map.md) | Active implementation orchestration entry。capability map、backlog、orchestration mapと合わせて現在wave planを探す | Active handoff |
| [source-file-organization-policy.md](source-file-organization-policy.md) | Source file responsibility, `index.ts` barrel rule, oversized-file guardrail | Accepted |
| [review/source-file-organization-policy-review.md](review/source-file-organization-policy-review.md) | Review of source file organization policy integration | Accepted |
| [review/implementation-orchestration-policy-discard-record.md](review/implementation-orchestration-policy-discard-record.md) | Record of discarded `/goal` orchestration policy | Accepted |

## Policy Groups

| Group | Files |
|---|---|
| P0 source and structure | `source-of-truth-policy.md`, `repository-structure-policy.md`, `module-boundary-policy.md`, `schema-and-id-conventions.md`, `source-file-organization-policy.md` |
| P0 runtime and implementation | `runtime-and-dynamics-implementation-policy.md`, `operation-policy.md`, `testing-and-acceptance-policy.md`, `diagnostic-policy.md` |
| P1 surfaces and process | `gui-implementation-policy.md`, `ai-assistant-implementation-policy.md`, `demo-rights-ip-policy.md`, `dependency-policy.md`, `review-and-pr-policy.md`, `subagent-workflow-policy.md`, `e2e-test-policy.md` |
| Basis and review | `basis/`, `review/` |

## Current Decisions

- The previous `implementation-orchestration-policy.md` has been discarded.
- Active implementation orchestration lives under `discussion/implementation/`; use [../implementation/_map.md](../implementation/_map.md), [../implementation/current-capability-map.md](../implementation/current-capability-map.md), [../implementation/remaining-work-backlog.md](../implementation/remaining-work-backlog.md), and [../implementation/orchestration/_map.md](../implementation/orchestration/_map.md) to locate the current wave plan. The active reusable procedure is `.agents/skills/implementation-orchestration/SKILL.md` unless Undine records a different canonical path.
- Domain-level Orch-Sylph agents should receive relevant design, test, and policy documents for their scope.
- Every implementation domain that writes authored source must receive `source-file-organization-policy.md`; Review-Sylph treats substantial logic in `index.ts` as blocking.
- Active P0 package/module naming uses `contracts` and `validator-core`; older `schema` / `validator` package names remain only in historical basis or resolved review context.

## Next Actions

1. For implementation startup, read [../implementation/_map.md](../implementation/_map.md), [../implementation/current-capability-map.md](../implementation/current-capability-map.md), [../implementation/remaining-work-backlog.md](../implementation/remaining-work-backlog.md), then [../implementation/orchestration/_map.md](../implementation/orchestration/_map.md).
2. At this snapshot, the planned next wave is [../implementation/orchestration/wave48-plan.md](../implementation/orchestration/wave48-plan.md); do not restart Wave 0 except for historical evidence review.
3. Continue passing `source-file-organization-policy.md` to authored-source domains; include `dependency-policy.md`, `diagnostic-policy.md`, and `schema-and-id-conventions.md` when the domain touches dependencies, validator/Product Preflight diagnostics, schemas, IDs, or evidence vocabulary.
