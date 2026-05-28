# Wave 0 Implementation Plan

> Implementation foundation plan based on `.codex/skills/implementation-orchestration/SKILL.md` and the current discussion.

## Status

Draft for user review.

## Purpose

Wave 0 establishes the implementation workspace so later waves can be delegated to Orch-Sylph / Gnome / Review-Sylph without inventing tooling, package structure, evidence paths, or review gates during feature work.

Wave 0 is not a feature wave. It creates the minimum repository foundation needed before contracts, package format, runtime, validator, operation, GUI, AI, or demo-safe implementation begins.

## Basis

### Skill Basis

- `.codex/skills/implementation-orchestration/SKILL.md`

### Current Discussion Decisions

- Undine should act as the L0 implementation coordinator directly when that is clearer than delegating broad work to `/goal`.
- `/goal` should not be treated as the only viable orchestration surface.
- Implementation should proceed one wave at a time.
- The previous `discussion/development_convention/implementation-orchestration-policy.md` is discarded.
- Large `index.ts` files and catch-all source files must be prevented.
- `index.ts` is a package entrypoint / barrel by default, not an implementation container.

### Development Convention Basis

- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/development_convention/source-of-truth-policy.md`
- `discussion/development_convention/repository-structure-policy.md`
- `discussion/development_convention/module-boundary-policy.md`
- `discussion/development_convention/dependency-policy.md`
- `discussion/development_convention/review-and-pr-policy.md`

### Design Basis

- `discussion/design/module-contracts/_map.md`
- `discussion/design/module-contracts/module-boundaries.md`

## Repository Facts Observed Before Wave 0

- Root `package.json` does not exist.
- `packages/` does not exist.
- `apps/` does not exist.
- Root `fixtures/` does not exist.
- Root `generated/` does not exist.
- `discussion/implementation/_map.md` exists.
- `discussion/_map.md` currently says Wave 0 scaffold is complete, but the repository facts above do not support treating that as implementation evidence.

## Objective

Create the minimal monorepo and verification scaffold required for Wave 1 contract implementation.

Wave 0 must leave the repository in a state where an Orch-Sylph can safely launch Wave 1 domains with explicit write scopes, test commands, source organization rules, and persistent evidence paths.

## Non-Goals

Wave 0 must not implement:

- shared DTO contracts beyond placeholder exports needed for smoke tests
- package file format logic
- runtime evaluation
- Minimum Open Dynamics v1
- operation-core mutation behavior
- validator rules
- acceptance runner logic
- GUI editor or viewer
- AI assistant behavior
- demo-safe preflight
- PSD import or image processing
- Cubism import/export, Cubism SDK/Core, Cubism Viewer matching, or Cubism Physics compatibility

## L0 Orchestration Shape

Wave 0 is tightly coupled and should use one Orch-Sylph domain rather than parallel domains.

```text
Undine L0
  -> Orch-Sylph: wave0-foundation
    -> Gnome: scaffold workspace and checks
    -> Review-Sylph: review scaffold, checks, source organization, dependency guardrails
  -> Undine: accept, ask user decision, or revise plan
```

Parallel Wave 0 subdomains are not recommended because package manager, workspace config, scripts, and package skeletons all touch shared root files.

## Domain Assignment: wave0-foundation

### Target

Set up repository implementation foundation.

### Allowed Write Scope

- `package.json`
- `pnpm-workspace.yaml`
- `pnpm-lock.yaml`
- `tsconfig*.json`
- `vitest.config.*`
- `.gitignore`
- `packages/**`
- `apps/**`
- `fixtures/**`
- `generated/**`
- `scripts/**`
- `discussion/implementation/**`
- targeted map updates under `discussion/_map.md` and `discussion/implementation/_map.md`

### Forbidden Write Scope

- `discussion/acceptance-criteria/**`, unless a blocking source conflict is discovered and the user approves a separate design update.
- `discussion/scenarios/**`, unless a blocking source conflict is discovered and the user approves a separate design update.
- `discussion/design/module-contracts/**`, unless Wave 0 exposes a contradiction that must be recorded rather than silently fixed.
- `test_data/**`, unless the user explicitly asks to use or move those assets.

### Required Inputs

- `.codex/skills/implementation-orchestration/SKILL.md`
- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/development_convention/dependency-policy.md`
- `discussion/development_convention/repository-structure-policy.md`
- `discussion/design/module-contracts/module-boundaries.md`

### Required Outputs

- workspace package manager files
- TypeScript configuration
- Vitest configuration
- package skeletons for the first implementation waves
- smoke test proving the test runner works
- typecheck command proving TypeScript wiring works
- forbidden dependency check
- source organization check for `index.ts` / catch-all files
- `fixtures/` and `generated/` scaffold
- Wave 0 review report
- Wave 0 completion report

## Package Skeleton

Wave 0 should create package directories without feature implementation:

| Package | Purpose in later waves | Wave 0 content |
|---|---|---|
| `packages/contracts` | shared IDs, DTOs, diagnostics, diffs, artifact refs | minimal src layout and smoke export |
| `packages/package-format` | project-defined model package parsing/writing | minimal package shell |
| `packages/runtime-core` | deterministic runtime evaluation | minimal package shell |
| `packages/operation-core` | operation dry-run/commit/log gateway | minimal package shell |
| `packages/validator-core` | validation reports and diagnostics | minimal package shell |

Apps may be scaffolded only as empty placeholders if the package manager requires workspace coverage. GUI implementation is not part of Wave 0.

## Source File Organization Requirements

Wave 0 must enforce the source organization policy from the start:

- `src/index.ts` may re-export only.
- No implementation logic belongs in `index.ts`.
- Avoid broad `types.ts`, `schemas.ts`, `utils.ts`, or `helpers.ts` catch-all files.
- Placeholder packages should use named files with clear ownership, such as `src/package-info.ts`, if a smoke export is needed.
- Smoke tests should target the named source file, not a large entrypoint implementation.

## Suggested Scripts

Root scripts should be minimal but stable:

| Script | Purpose |
|---|---|
| `pnpm typecheck` | run TypeScript type checking across workspace |
| `pnpm test` | run Vitest smoke tests |
| `pnpm test:unit` | alias or narrower unit test command |
| `pnpm check:deps` | verify no forbidden Cubism SDK/Core or parser dependency is declared |
| `pnpm check:source` | verify `index.ts` files stay barrel-only and catch-all files are not introduced |
| `pnpm check` | run typecheck, tests, dependency check, and source organization check |

Lint/format may be added in Wave 0 if low-friction. They may also be deferred with a clear reason if they would slow down the first scaffold.

## Dependency Policy

Wave 0 may introduce only baseline development dependencies needed for TypeScript and tests.

Likely allowed categories:

- TypeScript
- Vitest
- Zod, if needed for smoke-level contract package wiring
- Node type definitions

Forbidden:

- Cubism SDK/Core
- Cubism format parsers
- Live2D model loaders
- proprietary binary dependencies without review
- runtime image/PSD tooling before dependency review

Any package manager install should update lockfile and dependency evidence.

## Verification

Wave 0 should run:

```text
pnpm install
pnpm typecheck
pnpm test
pnpm check:deps
pnpm check:source
```

If network or dependency installation is unavailable, Orch-Sylph must record the blocked command and stop before claiming Wave 0 pass.

## Review-Sylph Scope

Review-Sylph checks:

- workspace files exist and match the intended package manager
- scripts can run or have explicit blocked reasons
- no forbidden dependency is declared
- package skeletons match module-boundary ownership
- `index.ts` files are barrel-only
- no catch-all source files are created
- no feature implementation leaked into Wave 0
- `fixtures/` and `generated/` are separated
- Wave 0 reports are written under `discussion/implementation/`

## Persistent Reports

Wave 0 should produce:

| Artifact | Path |
|---|---|
| Review report | `discussion/implementation/reviews/wave0/wave0-foundation-review.md` |
| Completion report | `discussion/implementation/waves/wave0/wave0-foundation-completion.md` |
| Integration review | `discussion/implementation/waves/wave0/integration-review.md` |

## Completion Gate

Wave 0 passes only when:

- root package manager files exist
- workspace package skeletons exist
- TypeScript config exists
- Vitest config exists
- at least one smoke test exists and passes
- typecheck passes
- dependency guard passes
- source organization guard passes
- no Cubism SDK/Core or Cubism parser dependency exists
- no `index.ts` contains substantial implementation logic
- generated and fixture directories are separated
- Review-Sylph report exists
- completion report exists
- integration review exists

## Early Escape Conditions

Stop and return to Undine if:

- package manager choice needs user decision
- dependency installation is blocked
- existing uncommitted user changes overlap the Wave 0 write scope in a way that cannot be safely preserved
- Wave 0 requires a dependency not covered by dependency policy
- module package naming cannot be chosen without changing accepted module contracts
- the scaffold would need to use forbidden Cubism dependencies or assets

## Proposed Next Wave After Completion

If Wave 0 passes, Wave 1 should be `contracts-foundation`:

- implement `packages/contracts` from `typescript-contracts.md`
- split by responsibility: IDs, primitives, diagnostics, diffs, runtime state, artifact refs
- keep `index.ts` as re-export only
- add contract tests for the exported schemas and ID formats
