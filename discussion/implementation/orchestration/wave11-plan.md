# Wave 11 Plan: AI Operation Catalog Expansion - Keyform Foundation

> Wave 11 は、Wave 10 で成立した AI read / inspection / validation 基盤の次段として、AI が扱える mutation operation catalog を `createParameter` から keyform 系へ拡張する 1 wave 実行単位である。

## Status

- Status: Planned
- Planned date: 2026-05-29
- Coordinator: Undine
- Execution trigger: User explicitly starts Wave 11 implementation.
- Primary pattern: Undine -> Orch-Sylph -> Gnome / Review-Sylph, with clean review contexts and bounded write scopes.

## Repository Facts

- `packages/operation-core/src/operation-type.ts` and payload schemas already list broad operation catalog entries, including `createParameter`, `addKeyform`, and `addKeyformGrid2d`.
- `packages/operation-core/src/operation-registry.ts` currently registers only `createParameter`.
- `packages/authoring-core/src/authoring-mutations.ts` currently implements only `createParameter`.
- Authoring graph and package serialization already carry `keyformSets`.
- Runtime graph adapter preserves keyform bindings, but runtime snapshot evaluation does not yet apply keyform patches into visible drawable / mesh output.
- Wave 10 added internal AI read commands: `inspectModel`, `inspectTarget`, and `validatePackage`.

## Design Decision

Wave 11 should implement the lowest-dependency operation catalog expansion: `addKeyform` and `addKeyformGrid2d` foundation.

This is preferred over dynamics / rig-control work because:

- It depends directly on already implemented `createParameter`, target inspection, operation dry-run / commit lifecycle, package persistence, and transcript evidence.
- The operation contracts already define payloads for `addKeyform` and `addKeyformGrid2d`.
- It gives AI a concrete authoring expansion path after creating parameters.
- Dynamics and rig controls require broader runtime semantics, group lifecycle rules, and validation behavior, so they should remain later waves.

## Scope

Wave 11 includes:

- Authoring-core keyform mutation helpers and focused tests.
- Operation-core handlers for `addKeyform` and `addKeyformGrid2d`.
- Operation registry integration for the two handlers.
- Editor session evidence support for committed keyform operations.
- AI host regression proving dry-run / approval / commit / inspect / validate / operation-log flow for keyform operations.
- Persistent Wave 11 reports, reviews, and final verification evidence.

Wave 11 does not include:

- New GUI panels for manual keyform editing.
- Runtime-visible keyform patch evaluation if it requires changing runtime evaluator semantics.
- Dynamics operations.
- Rig-control operations.
- External HTTP / WebSocket / MCP transport.
- Automatic repair-candidate generation.
- Standalone `getDiff` or `rerunValidation` commands.

If Review-Sylph determines that runtime-visible keyform evaluation is mandatory for accepting these operations, the wave should early-escape with a smaller accepted foundation: model/package/operation-log keyform persistence plus a recorded follow-up wave for runtime evaluation.

## Basis Documents

Every implementation Orch-Sylph must receive only the focused basis below, not the whole conversation history.

- `.agents/skills/implementation-orchestration/SKILL.md`
- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/design/module-contracts/operation-contracts.md`
- `discussion/design/module-contracts/ai-command-contract.md`
- `discussion/design/module-contracts/gui-operation-contract.md`
- `discussion/acceptance-criteria/02_DomainAcceptanceCriteria/213_AI-native_Operation.md`
- `discussion/scenarios/02_DomainAcceptanceCriteria/213_AI-native_Operation.md`
- `discussion/implementation/waves/wave10/wave10-final-report.md`

## Dependency Order

1. Authoring keyform mutations must land first.
2. `addKeyform` and `addKeyformGrid2d` operation handlers can be implemented in parallel after authoring mutations.
3. Registry integration and editor evidence support can proceed in parallel after both handlers are ready.
4. AI host regression must run after registry and evidence integration.
5. Clean review, integration fixes, and final report finish the wave.

## Orch-Sylph Parallel Design

| Batch | Domain | Parallelism | Depends On | Write Scope |
|---|---|---:|---|---|
| 1 | `wave11-keyform-authoring-mutations` | Solo | Wave 10 final state | `packages/authoring-core/src/**`, authoring-core tests |
| 2A | `wave11-add-keyform-operation-handler` | Parallel with 2B | Batch 1 | `packages/operation-core/src/operations/add-keyform*`, operation-core tests |
| 2B | `wave11-add-keyform-grid2d-operation-handler` | Parallel with 2A | Batch 1 | `packages/operation-core/src/operations/add-keyform-grid2d*`, operation-core tests |
| 3A | `wave11-operation-registry-keyform-integration` | Parallel with 3B | Batch 2A, 2B | `packages/operation-core/src/operation-registry.ts`, operation-core integration tests, keyform fixture |
| 3B | `wave11-editor-keyform-evidence-support` | Parallel with 3A | Batch 2A, 2B | `apps/editor/src/editor-session/**`, editor session tests |
| 4 | `wave11-ai-keyform-command-regression` | Solo | Batch 3A, 3B | `apps/editor/src/**` AI host tests, compact fixture / transcript regression |
| 5 | `wave11-integration-review-and-final-report` | Solo | Batch 4 | `discussion/implementation/**`, final fixes as needed |

## Domain Assignments

### `wave11-keyform-authoring-mutations`

Goal:

- Add focused authoring mutations/selectors for keyform set creation without expanding `authoring-mutations.ts` into a catch-all file.

Expected output:

- Mutations for one-dimensional keyform set creation and two-dimensional grid keyform set creation, or a narrow shared helper used by both.
- Preconditions for parameter existence, target existence, target property support, and keyform set ID uniqueness.
- Authoring-core unit tests for successful mutation and invalid references.

Forbidden:

- Large `index.ts` logic.
- Runtime evaluator changes.
- Operation-core registry edits.

Review focus:

- Single-responsibility file split.
- No broad graph mutation utility that hides operation-specific invariants.
- Error codes are structured and testable.

### `wave11-add-keyform-operation-handler`

Goal:

- Implement `addKeyform` as a real dry-run / commit operation handler.

Expected output:

- Operation handler file with model diff, precondition report, and operation result behavior aligned with `createParameter`.
- Tests covering dry-run non-mutation, commit mutation, invalid parameter, invalid target, and duplicate / conflicting keyform identity.

Forbidden:

- `operation-registry.ts` edits; registry integration belongs to Batch 3A.
- Editor app changes.

Review focus:

- Handler is thin and delegates graph mutation rules to authoring-core.
- Operation result contains enough model diff evidence for AI approval.

### `wave11-add-keyform-grid2d-operation-handler`

Goal:

- Implement `addKeyformGrid2d` as a real dry-run / commit operation handler.

Expected output:

- Operation handler file with model diff, precondition report, and operation result behavior aligned with `addKeyform`.
- Tests covering two-parameter grid creation, missing parameter, duplicate axis parameter, invalid target, and dry-run non-mutation.

Forbidden:

- `operation-registry.ts` edits; registry integration belongs to Batch 3A.
- Editor app changes.

Review focus:

- Grid-specific invariants remain explicit.
- The implementation does not collapse 1D and 2D operations into an unreadable generic handler.

### `wave11-operation-registry-keyform-integration`

Goal:

- Register the two keyform operation handlers and prove operation-core lifecycle integration.

Expected output:

- Registry entries for `addKeyform` and `addKeyformGrid2d`.
- Operation-core integration tests proving dry-run and commit dispatch through registry.
- Minimal keyform operation fixture showing package-level persistence of keyform sets.

Forbidden:

- Editor evidence provider changes.
- Runtime evaluator semantics changes.

Review focus:

- Registry remains small and declarative.
- Fixture is compact and deterministic.

### `wave11-editor-keyform-evidence-support`

Goal:

- Allow editor session commit flow to collect evidence for keyform operations without making AI transports or UI panels.

Expected output:

- Evidence provider recognizes `addKeyform` and `addKeyformGrid2d`.
- Existing runtime / validation evidence helpers are reused where possible.
- Tests prove editor session commit does not reject supported keyform operations.

Forbidden:

- New visible UI surface.
- External transport work.
- Inventing runtime-visible keyform behavior if runtime-core does not already evaluate it.

Review focus:

- Evidence code is operation-aware but not a giant switch file if it starts growing.
- Any runtime diff limitation is explicitly documented in test names or reports.

### `wave11-ai-keyform-command-regression`

Goal:

- Prove the AI-facing workflow can create parameters, dry-run keyform operations, approve / commit, inspect the affected target, validate the package, and correlate transcript / operation-log entries.

Expected output:

- Compact regression covering at least one `addKeyform` AI flow.
- Prefer also covering `addKeyformGrid2d` if the setup remains small and deterministic.
- Transcript and operation-log correlation remains stable.

Forbidden:

- New UI workflow unless a tiny test harness hook is unavoidable.
- Repair suggestion generation.
- Broad fixture expansion.

Review focus:

- This remains a regression of AI operation catalog expansion, not an end-to-end UI feature wave.
- Test setup uses semantic IDs and avoids screenshot-only assertions.

### `wave11-integration-review-and-final-report`

Goal:

- Run clean Review-Sylph checks, apply necessary fixes, and record the final state.

Expected output:

- Domain completion reports under `discussion/implementation/waves/wave11/`.
- Clean review report under `discussion/implementation/reviews/wave11/`.
- Integration review and final report with verification commands and residual risks.
- Map updates for `discussion/_map.md`, `discussion/implementation/_map.md`, and `discussion/implementation/orchestration/_map.md`.

Review focus:

- No large catch-all files were introduced.
- Public `index.ts` files remain barrel-only.
- Operation-core remains decoupled from runtime-core / validator-core.
- AI host remains transport-independent.

## Verification Plan

Minimum focused verification:

- `pnpm.cmd exec vitest run packages/authoring-core/src`
- `pnpm.cmd exec vitest run packages/operation-core/src`
- `pnpm.cmd exec vitest run apps/editor/src`
- `pnpm.cmd typecheck`

Preferred final verification:

- `pnpm.cmd test:standard`
- `pnpm.cmd build`

If time or environment prevents the preferred final verification, the final report must record exactly which command was skipped and why.

## Residual Risks

- Runtime snapshots may not show visible target deformation because runtime-core does not yet apply keyform patches. Wave 11 should not hide this; it should record the limitation and keep model diff / package persistence as the accepted foundation.
- Evidence provider branching may start to grow. If it becomes unwieldy, split per-operation evidence helpers during the wave rather than creating a large central switch.
- `addKeyformGrid2d` setup may require two deterministic parameters. If that makes the AI host regression too large, keep the AI regression focused on `addKeyform` and cover grid2d at operation-core level.

## Completion Criteria

Wave 11 is complete when:

- `addKeyform` and `addKeyformGrid2d` can be dry-run and committed through operation-core.
- Committed keyform operations persist in the package document model.
- Editor session evidence collection accepts supported keyform operations.
- At least one AI command regression proves keyform operation dry-run / approval / commit / inspect / validate flow.
- Clean review finds no blocking issues, or all blocking issues are fixed.
- Final report records verification evidence and remaining limitations.
