# Wave99 Domain A Test Adequacy Re-Review

Date: 2026-06-24
Reviewer: Review-Sylph
Domain: `wave99-variant-model-package-format-operations`
Review pass: Fix Loop 1 / TA-001

## Verdict

Verdict: `pass`

Blocking test adequacy findings: none.

TA-001 is closed. Fix Loop 1 added the missing invalid-reference coverage across
package-format, authoring-core mutations, and operation-core routing. I reviewed
the source and tests directly and reran the focused Domain A Variant tests.

## Scope Reviewed

Basis documents reviewed:

- `discussion/implementation/orchestration/wave99-plan.md`
- `discussion/design/screen-design/screens/variant-expression-manager.md`
- `discussion/design/screen-design/_map.md`
- `discussion/design/screen-design/screens/workspace-save-and-navigation.md`
- `discussion/design/screen-design/screens/texture-atlas-task.md`
- `discussion/design/screen-design/screens/runtime-export-task.md`
- `discussion/design/screen-design/screens/viewer-runtime-view.md`
- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/development_convention/dependency-policy.md`
- `discussion/development_convention/operation-policy.md`
- `discussion/implementation/waves/wave99/wave99-domain-a-variant-model-package-format-operations-report.md`
- Prior review: `discussion/implementation/reviews/wave99/wave99-domain-a-test-adequacy-review.md`
- Context reviews: `discussion/implementation/reviews/wave99/wave99-domain-a-spec-compliance-review.md`, `discussion/implementation/reviews/wave99/wave99-domain-a-design-development-review.md`

Source and tests reviewed directly:

- `packages/package-format/src/model-variants.ts`
- `packages/package-format/src/model-variants.test.ts`
- `packages/package-format/src/package-document.ts`
- `packages/package-format/src/package-file-set.ts`
- `packages/package-format/src/package-manifest.ts`
- `packages/package-format/src/package-file-paths.ts`
- `packages/authoring-core/src/authoring-graph.ts`
- `packages/authoring-core/src/package-document-from-authoring-session.ts`
- `packages/authoring-core/src/package-document-model-files.ts`
- `packages/authoring-core/src/variant-mutations.ts`
- `packages/authoring-core/src/variant-mutations.test.ts`
- `packages/authoring-core/src/variant-persistence.test.ts`
- `packages/operation-core/src/payloads/variants.ts`
- `packages/operation-core/src/operations/variants.ts`
- `packages/operation-core/src/operations/variants.test.ts`
- `packages/operation-core/src/operation-type.ts`
- `packages/operation-core/src/operation-payload.ts`
- `packages/operation-core/src/operation-registry.ts`

## Findings

No blocking findings.

## TA-001 Closure Evidence

Prior TA-001 required focused invalid-reference tests for Variant model files,
authoring mutations, and operation-core routed failures. The new tests cover
those paths:

| Required invalid-reference area | Status | Evidence |
|---|---|---|
| PackageDocument rejects Variant targets that reference unknown package drawables | Closed | Test at `packages/package-format/src/model-variants.test.ts:100`; source branch at `packages/package-format/src/package-document.ts:69` |
| Package variants reject membership rows referencing unknown Variants | Closed | Test at `packages/package-format/src/model-variants.test.ts:119`; source branch at `packages/package-format/src/model-variants.ts:126` |
| Package variants reject membership drawables outside `targetDrawableIds` | Closed | Test at `packages/package-format/src/model-variants.test.ts:136`; source branch at `packages/package-format/src/model-variants.ts:117` |
| Package variants reject duplicate cross-group drawable ownership | Closed | Test at `packages/package-format/src/model-variants.test.ts:154`; source branch at `packages/package-format/src/model-variants.ts:195` |
| Authoring mutations reject missing drawable/group/variant/membership/target refs | Closed | Test at `packages/authoring-core/src/variant-mutations.test.ts:206`; source branches at `packages/authoring-core/src/variant-mutations.ts:410`, `:325`, `:343`, `:258`, `:470` |
| Authoring mutations reject invalid multi-toggle default active references | Closed | Test at `packages/authoring-core/src/variant-mutations.test.ts:282`; source branches at `packages/authoring-core/src/variant-mutations.ts:501`, `:528` |
| Operation Core rejects representative invalid references routed through handlers | Closed | Test at `packages/operation-core/src/operations/variants.test.ts:167`; diagnostic mapping at `packages/operation-core/src/operations/variants.ts:389` through `:402` |

## Required Coverage Check

| Required Domain A test area | Status | Evidence |
|---|---|---|
| Old package/workspace without variants parses as empty variants | Covered | `packages/package-format/src/model-variants.test.ts:18`, `packages/package-format/src/model-variants.test.ts:40`, `packages/authoring-core/src/variant-persistence.test.ts:29` |
| Valid package with `model/variants.json` serializes/parses | Covered | `packages/package-format/src/model-variants.test.ts:31`; optional file handling at `packages/package-format/src/package-file-set.ts:49` and `:101` |
| Optional `model/variants.json` is not required for old workspaces | Covered | `packages/package-format/src/model-variants.test.ts:40`; default schema at `packages/package-format/src/package-document.ts:36` |
| Portable JSON round-trips variants | Covered | `packages/package-format/src/model-variants.test.ts:54`, `packages/authoring-core/src/variant-persistence.test.ts:58` |
| Workspace save/open round-trips variants | Covered | `packages/authoring-core/src/variant-persistence.test.ts:40`; authoring graph/package mapping at `packages/authoring-core/src/authoring-graph.ts:55` and `packages/authoring-core/src/package-document-model-files.ts:58` |
| Core mutations cover group/variant/target/membership/default active flows | Covered | `packages/authoring-core/src/variant-mutations.test.ts:56`, `:90`, `:122`, `:173` |
| Core mutations cover invalid references | Covered | `packages/authoring-core/src/variant-mutations.test.ts:206`, `:282` |
| Operation lifecycle and registry coverage | Covered | Lifecycle tests at `packages/operation-core/src/operations/variants.test.ts:20`, `:42`, `:70`, `:105`, `:132`; operation types at `packages/operation-core/src/operation-type.ts:46`; payload union at `packages/operation-core/src/operation-payload.ts:144`; registry entries at `packages/operation-core/src/operation-registry.ts:148` |
| Operation Core invalid refs routed through handlers | Covered | `packages/operation-core/src/operations/variants.test.ts:167` |
| Preview active selection not represented in PackageDocument | Covered | `packages/package-format/src/model-variants.test.ts:67`, `packages/authoring-core/src/variant-persistence.test.ts:75` |
| Canvas predicate AND behavior | Deferred | Domain B/C scope, not a Domain A test blocker |
| Picker eligibility | Deferred | Domain C scope, not a Domain A test blocker |
| Runtime Export metadata/default behavior | Deferred | Domain B scope, not a Domain A test blocker |
| Editor UI route/back/Parameter Bar hidden | Deferred | Domain C scope, not a Domain A test blocker |

## Commands

Run:

```text
pnpm.cmd exec vitest run packages/package-format/src/model-variants.test.ts packages/authoring-core/src/variant-mutations.test.ts packages/authoring-core/src/variant-persistence.test.ts packages/operation-core/src/operations/variants.test.ts
```

Result:

- Initial sandboxed run failed before test execution with `spawn EPERM` while
  Vitest/esbuild loaded `vitest.config.ts`.
- Re-ran the same command with escalation for process spawn.
- Escalated run passed: 4 files, 26 tests.

Not run:

- `pnpm install`: not run, per review scope.
- Full repository suite, full `pnpm typecheck`, source organization guard, and
  dependency guard were not rerun in this Test Adequacy re-review. This lane
  focused on Domain A tests and direct source/test inspection.

## Residual Test Gaps

No remaining Domain A blocking test gaps found.

Deferred non-Domain-A coverage remains as planned:

- Variant predicate/default-active resolver and Runtime Export metadata/default behavior: Domain B.
- Canvas preview session-local active selection and AND composition: Domain C after Domain B.
- Variant Manager route/UI/Add Drawables picker/matrix/Parameter Bar behavior: Domain C.

## Decision Needed

No user design decision is needed. This re-review verdict is `pass`.
