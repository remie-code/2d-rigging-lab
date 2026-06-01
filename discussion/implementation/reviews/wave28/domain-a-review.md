# Wave28 Domain A Review

## Verdict

pass

Target: `wave28-part-texture-authoring-operation-foundation`

Review role: independent Review-Sylph gate for Domain A. Source fixes were not made.

## Basis

- `.agents/skills/implementation-orchestration/SKILL.md`
- `C:/Users/remie/.codex/skills/subagent-context-hygiene/SKILL.md`
- `discussion/implementation/orchestration/wave28-plan.md`
- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/development_convention/dependency-policy.md`
- `discussion/development_convention/schema-and-id-conventions.md`
- `discussion/design/module-contracts/operation-contracts.md`
- `discussion/design/module-contracts/package-file-format-contract.md`
- `discussion/tests/traceability/test-traceability-matrix.md`
- `discussion/tests/fixtures/fixture-manifest.md`
- Domain A changed files listed in the review request
- `discussion/implementation/waves/wave28/domain-a-gnome-report.md`

## Findings

No blocking findings.

Non-blocking residual risk:

- The focused operation tests cover dry-run and commit/log/materialization across the new operation family, but not every new operation in both lifecycle modes. Current direct evidence is `createPart` dry-run (`packages/operation-core/src/operations/part-operations.test.ts:32`), `updatePart` commit/log/materialization (`packages/operation-core/src/operations/part-operations.test.ts:57`), `setDrawablePart` dry-run (`packages/operation-core/src/operations/drawable-part-texture-operations.test.ts:31`), and `setDrawableTexture` commit/log/materialization (`packages/operation-core/src/operations/drawable-part-texture-operations.test.ts:61`). This is acceptable for Domain A because handlers share the existing lifecycle path and Domain E is explicitly responsible for contract fixtures, but Domain E should add an end-to-end part create/update -> drawable reassign -> texture assignment fixture.

## Design / Development Compliance

- Scope containment passes. Domain A source changes are limited to `packages/authoring-core/src/**` and `packages/operation-core/src/**`; parallel changes in editor/runtime/validator were not reviewed as Domain A implementation.
- Public entrypoints remain barrel-only: `packages/authoring-core/src/index.ts:1` through `:38` and `packages/operation-core/src/index.ts:1` through `:40` contain only exports.
- Source-file organization passes. New implementation responsibilities are split into part mutation, drawable-part mutation, drawable-texture mutation, texture selector, locked-target helper, and per-operation handlers. Line counts are modest: the largest new handler is `packages/operation-core/src/operations/update-part.ts` at 322 lines; no catch-all source file was introduced.
- Dependency policy passes. No package manifests or lockfiles changed, and the Domain A files do not introduce file picker, parser/archive, image decode, Cubism, pixel oracle, WebGL, or renderer scope.
- Schema/id conventions pass. New operation types are added to `packages/operation-core/src/operation-type.ts:7` through `:10`, payload schemas to `packages/operation-core/src/payloads/model-edit.ts:40` through `:78`, and schema tests cover representative payload parsing at `packages/operation-core/src/operation-schemas.test.ts:177` through `:203`.
- Operation contract alignment passes for Domain A scope:
  - Dry-run handlers clone authoring sessions before applying mutations, e.g. `packages/operation-core/src/operations/create-part.ts:30` through `:33`, `update-part.ts:29` through `:35`, `set-drawable-part.ts:31` through `:37`, and `set-drawable-texture.ts:31` through `:37`.
  - Commit handlers mutate the supplied session through the existing lifecycle and log path; `packages/operation-core/src/lifecycle/commit.ts:68` through `:99` handles package revision and operation log append.
  - Deterministic operation diagnostics exist for missing/duplicate/cycle/no-op/locked preconditions in the new handlers, with locked-target construction centralized at `packages/operation-core/src/operations/locked-targets.ts:5` through `:23`.
  - Model diffs include target refs and stable paths for part graph, drawable membership, and texture assignment changes, e.g. `create-part.ts:188` through `:237`, `update-part.ts:173` through `:188`, `set-drawable-part.ts:160` through `:183`, and `set-drawable-texture.ts:162` through `:181`.
  - Package materialization is exercised through `toPackageDocument` in focused tests for part graph and texture/drawable state.

## Test Adequacy

Passed:

- Domain A focused tests: 6 files, 20 tests.
- Compatibility tests for existing createDrawable, setDrawOrder, setRuntimeVisibility, setMaskRelation, rig-control, dynamics, lifecycle, and existing authoring mutations: 13 files, 70 tests.
- Package adapter and dependency-boundary tests: 3 files, 8 tests.
- Full `pnpm.cmd typecheck`.
- `git diff --check -- packages/authoring-core/src packages/operation-core/src discussion/implementation/waves/wave28/domain-a-gnome-report.md`; no whitespace errors, only existing LF/CRLF warnings.

Focused verification commands run:

```text
pnpm.cmd exec vitest run packages/authoring-core/src/part-mutations.test.ts packages/authoring-core/src/drawable-part-mutations.test.ts packages/authoring-core/src/drawable-texture-mutations.test.ts packages/operation-core/src/operations/part-operations.test.ts packages/operation-core/src/operations/drawable-part-texture-operations.test.ts packages/operation-core/src/operation-schemas.test.ts
pnpm.cmd exec vitest run packages/operation-core/src/operations/create-drawable.test.ts packages/operation-core/src/operations/set-draw-order.test.ts packages/operation-core/src/operations/set-runtime-visibility.test.ts packages/operation-core/src/operations/set-mask-relation.test.ts packages/operation-core/src/operations/rig-control.test.ts packages/operation-core/src/operations/create-dynamics-group.test.ts packages/operation-core/src/operation-lifecycle.test.ts packages/authoring-core/src/drawable-mutations.test.ts packages/authoring-core/src/draw-order-mutations.test.ts packages/authoring-core/src/runtime-visibility-mutations.test.ts packages/authoring-core/src/mask-relation-mutations.test.ts packages/authoring-core/src/rig-control-mutations.test.ts packages/authoring-core/src/dynamics-mutations.test.ts
pnpm.cmd exec vitest run packages/authoring-core/src/package-document-adapter.test.ts packages/authoring-core/src/dependency-boundary.test.ts packages/operation-core/src/dependency-boundary.test.ts
pnpm.cmd typecheck
git diff --check -- packages/authoring-core/src packages/operation-core/src discussion/implementation/waves/wave28/domain-a-gnome-report.md
```

## Fixes Required From Gnome

None for Domain A gate.

## Remaining Issues

- The earlier Gnome report recorded full typecheck as blocked by parallel validator-core edits, but as of this clean review `pnpm.cmd typecheck` passes.
- Domain E should provide the fuller contract fixture called out in the wave plan so the operation -> package graph -> runtime/viewer evidence -> validator report chain is locked as persistent evidence.

## User-Decision Points

None.
