# Source File Organization Policy

## Status

Accepted.

## Purpose

This policy prevents implementation agents from concentrating production logic in large `index.ts` files or other broad "god files".

Source files must remain small enough for future agents to read, review, test, and extend safely. File boundaries should follow single responsibility: one file owns one cohesive concept, schema family, operation family, validator concern, runtime step, or public API entrypoint.

## Scope

Applies to authored source under:

- `packages/**`
- `apps/**`
- `tests/**`
- implementation-owned tooling under `scripts/**` when present

Does not apply to generated files under `generated/**`.

## Required Decisions

### DEC-FILE-001: `index.ts` is a barrel by default

`index.ts` files are public entrypoints or barrel files. They may re-export symbols and contain minimal package-facing wiring. They must not become the primary location for implementation logic.

### DEC-FILE-002: One source file owns one responsibility

Production source files should be split by responsibility. A file that mixes unrelated DTO families, validators, runtime algorithms, operations, IO, fixtures, and public API wiring must be split.

### DEC-FILE-003: Large unions and registries need owned files

Large discriminated unions, diagnostic registries, operation registries, schema groups, and runtime evaluator steps must live in named responsibility files. `index.ts` may re-export them.

### DEC-FILE-004: Review must treat oversized entrypoints as blocking

Development Compliance Review must reject substantial implementation logic placed in `index.ts` or another broad file when it can reasonably be split by responsibility.

## Rules

### R-FILE-001: Keep `index.ts` as re-export surface

`index.ts` should contain only:

- `export ... from "./..."` statements
- tiny public API composition that cannot sensibly live elsewhere
- package entrypoint comments, if useful

### R-FILE-002: Split implementation by domain responsibility

Use named files such as:

- `ids.ts`
- `diagnostics.ts`
- `runtime-state.ts`
- `runtime-state-sequence.ts`
- `artifact-refs.ts`
- `package-manifest.ts`
- `operations/dynamics.ts`
- `validators/package-structure.ts`

Names are examples, not mandatory. The responsibility boundary is mandatory.

### R-FILE-003: Avoid broad catch-all files

Do not create or grow files whose role is only "all schemas", "all types", "all operations", "everything validator", or "misc utilities".

### R-FILE-004: Test files should mirror source responsibility

Tests should target the same responsibility boundary where practical. A large all-in-one test file is a warning unless it is a small integration test.

### R-FILE-005: Document exceptions

If a file temporarily keeps multiple responsibilities together, the domain completion report must explain why, what risk remains, and when it should be split.

## Forbidden

| Forbidden action | Applies to | Severity |
|---|---|---|
| Put substantial implementation logic in `index.ts` | production source | blocking |
| Put large Zod schema families directly in `index.ts` | schema source | blocking |
| Put operation execution, validation, runtime evaluation, or package IO bodies in `index.ts` | production source | blocking |
| Create a catch-all `types.ts`, `schemas.ts`, `utils.ts`, or `helpers.ts` that mixes unrelated responsibilities | production source | warning, blocking if it hides multiple module responsibilities |
| Add new functionality to an already oversized file when a responsibility split is practical | all authored source | blocking |
| Treat barrel export convenience as a reason to avoid source file ownership | all authored source | blocking |

## Required Evidence

Implementation reports and reviews should include:

- changed files grouped by responsibility
- any `index.ts` changes classified as re-export / entrypoint wiring / exception
- oversized-file exceptions, if any
- review finding when source organization is blocking or warning

## Review Checklist

### Blocking

- [ ] `index.ts` contains no substantial implementation logic.
- [ ] New source files have clear single responsibilities.
- [ ] Large schema, operation, diagnostic, runtime, or validator concerns are split into named files.
- [ ] No catch-all source file hides multiple module responsibilities.
- [ ] Any exception is documented in the domain completion report.

### Warning

- [ ] A file is readable now but likely to need splitting in the next wave.
- [ ] Tests are broader than the source responsibility boundary.
- [ ] A barrel file has non-trivial wiring that may deserve a named file later.

## Change Process

Change this policy when repository source layout, package entrypoint strategy, or code review rules change.
