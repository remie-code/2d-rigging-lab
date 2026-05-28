# Development Convention Map

> Lightweight map for development convention documents. Details live in the linked policy files.

## Current Entry Points

| Path | Role | Status |
|---|---|---|
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
- Active implementation orchestration now lives under `discussion/implementation/` and uses `.codex/skills/implementation-orchestration/SKILL.md` as the reusable procedure.
- Domain-level Orch-Sylph agents should receive relevant design, test, and policy documents for their scope.
- Every implementation domain that writes authored source must receive `source-file-organization-policy.md`; Review-Sylph treats substantial logic in `index.ts` as blocking.
- Active P0 package/module naming uses `contracts` and `validator-core`; older `schema` / `validator` package names remain only in historical basis or resolved review context.

## Next Actions

1. Review [../implementation/orchestration/wave0-plan.md](../implementation/orchestration/wave0-plan.md).
2. Run Wave 0 foundation implementation before contract or feature implementation.
3. Keep `source-file-organization-policy.md` attached to all authored source implementation domains.
