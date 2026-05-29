# Wave 6 Plan: editor-ui operation persistence vertical slice

> Status: Completed / implementation-proven
> Created: 2026-05-29
> Coordinator: Undine
> Execution unit: Wave 6 only

## 1. Upstream Gate

Wave 5 is complete and implementation-proven.

- Basis: [../waves/wave5/wave5-final-report.md](../waves/wave5/wave5-final-report.md)
- Wave 5 pass summary:
  - package revision policy
  - operation log JSONL
  - authoring-to-package document adapter
  - package file set writer / parser
  - runtime / validation generated artifact materializers
  - persisted operation evidence fixture
  - full `pnpm check` pass

Wave 6 starts from the Wave 5 recommendation: `editor-ui-operation-persistence-vertical-slice`.

## 2. Wave Objective

Create the first browser editor vertical slice under `apps/editor`.

The slice must let a user load a browser-safe sample package, commit a `createParameter` operation through `operation-core`, materialize operation evidence, serialize an in-memory package file set, reload it, and inspect the result in the UI.

This wave is not a full editor. It is the first end-to-end GUI proof that the existing core pipeline can be driven from `editor-ui` without bypassing operation boundaries.

## 3. Repository Facts

- `pnpm-workspace.yaml` already includes `apps/*`.
- `apps/` does not currently contain an editor app.
- Root `tsconfig.json` currently includes `apps/*/src/**/*.ts`, but not `.tsx`.
- Root `vitest.config.ts` currently includes only `packages/*/src/**/*.test.ts`.
- `scripts/check-source-organization.mjs` scans `apps/**` and enforces:
  - `index.ts` must remain barrel-only.
  - broad catch-all names such as `types.ts`, `schemas.ts`, `utils.ts`, and `helpers.ts` are forbidden.
- No frontend framework is established in the repository.
- `vite` is present in the lockfile as a transitive Vitest dependency, but is not declared as a direct app dependency.

## 4. Wave Design Decisions

### DEC-W6-001: Use Vite + vanilla TypeScript for the first editor app

Wave 6 should use Vite with browser-native DOM code, not React.

Reason:

- It minimizes new dependencies.
- It avoids `.tsx` / JSX configuration churn.
- It keeps the first UI focused on operation persistence rather than component framework choices.
- It still produces a real browser app that can be built, served, and manually checked.

If a later wave needs a component framework, that should be a separate decision after the editor state and operation boundaries are proven.

### DEC-W6-002: UI event handlers must not mutate package DTOs directly

The UI may create command input and render state, but committed edits must flow through:

```text
editor UI -> editor session adapter -> operation-core -> authoring-core -> package-format
```

Direct mutation of package DTOs from UI modules is blocking.

### DEC-W6-003: Keep package persistence in memory for Wave 6

Wave 6 should not implement file-system save, import picker, browser storage, or native shell integration.

The acceptance surface is an in-memory package file set with visible paths, operation log text summary, generated evidence paths, and reload summary.

### DEC-W6-004: Source split is part of the wave gate

`apps/editor/src/index.ts` or `main.ts` must not become the editor implementation.

The app must be split by responsibility from the start:

- app bootstrap
- session / persistence adapter
- semantic state / view model
- operation form
- evidence / package summary panels
- styles

## 5. Non-goals

- `renderer-adapter` implementation.
- Real canvas/WebGL rendering.
- `viewer-ui` implementation.
- `ai-interface` implementation.
- PSD/source import workflow.
- Full operation catalog.
- File-system persistence.
- Cubism / Live2D SDK, Core, or proprietary asset support.
- Replacing existing core package APIs unless an early escape is required.

## 6. Required Basis Documents

Undine should keep only this plan and completion reports in root context. Domain Orch-Sylphs receive focused basis documents.

Common basis for all Wave 6 domains:

- `.agents/skills/implementation-orchestration/SKILL.md`
- [wave6-plan.md](wave6-plan.md)
- [../../development_convention/source-file-organization-policy.md](../../development_convention/source-file-organization-policy.md)
- [../../design/module-contracts/module-boundaries.md](../../design/module-contracts/module-boundaries.md)

Domain-specific basis:

- Editor GUI domain:
  - [../../design/module-contracts/gui-operation-contract.md](../../design/module-contracts/gui-operation-contract.md)
- Operation/session domain:
  - [../../design/module-contracts/operation-contracts.md](../../design/module-contracts/operation-contracts.md)
  - [../waves/wave5/wave5-final-report.md](../waves/wave5/wave5-final-report.md)
- Persistence domain:
  - [../../design/module-contracts/package-file-format-contract.md](../../design/module-contracts/package-file-format-contract.md)
  - [../waves/wave5/wave5-final-report.md](../waves/wave5/wave5-final-report.md)

## 7. Domain Plan

### Domain A: `wave6-editor-app-tooling-scaffold`

Purpose:

Create the minimal browser app scaffold and verification wiring for `apps/editor`.

Allowed write scope:

- `apps/editor/package.json`
- `apps/editor/index.html`
- `apps/editor/vite.config.ts`
- `apps/editor/src/main.ts`
- `apps/editor/src/app/**`
- `apps/editor/src/styles/**`
- root `package.json`
- root `tsconfig.json`
- root `vitest.config.ts`
- `pnpm-lock.yaml` after dependency install

Forbidden write scope:

- `packages/**` production logic
- `fixtures/**`
- unrelated `discussion/**`

Expected output:

- Workspace app package named `@private-2d-rigging-lab/editor`.
- Vite build script.
- Root checks include app `.test.ts` files.
- App bootstrap remains thin.
- No React / JSX unless the domain escalates and receives a new decision.

Required verification:

- `pnpm install` if manifest or lockfile changes.
- `pnpm --filter @private-2d-rigging-lab/editor build`
- `pnpm typecheck`
- `pnpm check:source`
- `pnpm check:deps`

Early escape triggers:

- Direct Vite dependency cannot be installed or resolved without approval.
- App build requires a framework or browser polyfill not covered by this plan.

Parallelism:

- Must run first. It establishes the app package and shared verification surface.

### Domain B: `wave6-editor-session-persistence-adapter`

Purpose:

Implement a browser-safe editor session adapter that drives the Wave 5 operation persistence flow from app code.

Allowed write scope:

- `apps/editor/src/editor-session/**`

Forbidden write scope:

- UI rendering modules except through exported adapter contracts.
- `packages/**` production logic unless an early escape is approved.
- direct package DTO mutation from UI-owned files.

Expected output:

- Load a browser-safe sample package document.
- Create an authoring session from that package document.
- Commit `createParameter` through `createOperationCore`.
- Capture runtime / validation evidence through the existing provider boundary.
- Serialize operation log JSONL.
- Serialize a package file set with generated artifacts.
- Reload the package file set.
- Expose a concise session summary for UI and tests.

Required tests:

- A session adapter test proves:
  - one `createParameter` commit succeeds
  - package revision increments
  - the new parameter appears after reload
  - operation log has one JSONL entry
  - generated runtime / validation artifact paths are included
  - no Node `fs` dependency is used by app runtime source

Early escape triggers:

- Existing core APIs require Node-only behavior in browser app runtime.
- Evidence generation requires direct imports that violate module boundaries.
- The sample package cannot be represented without a broad catch-all source file.

Parallelism:

- Starts after Domain A has created the app package.
- Can run in parallel with Domain C.

### Domain C: `wave6-editor-semantic-state-view-model`

Purpose:

Create the UI-facing semantic state and view model layer for the first editor workflow.

Allowed write scope:

- `apps/editor/src/editor-state/**`

Forbidden write scope:

- operation commit logic
- package serialization logic
- DOM rendering modules
- `index.ts` implementation bodies

Expected output:

- Editor semantic state shape for:
  - loaded package identity
  - package revision
  - parameter list
  - pending `createParameter` form state
  - last operation result
  - operation log summary
  - generated evidence summary
  - reload summary
- Stable test ID constants in a named responsibility file.
- No catch-all `types.ts` / `utils.ts`.

Required tests:

- View model test for an empty initial state.
- View model test for committed operation summary.
- Test ID uniqueness check.

Early escape triggers:

- GUI contract requires fields that conflict with existing operation / package DTOs.
- Semantic state starts duplicating core package DTOs instead of projecting them.

Parallelism:

- Starts after Domain A.
- Can run in parallel with Domain B.

### Domain D: `wave6-editor-operation-ui-surface`

Purpose:

Implement the visible editor shell and `createParameter` operation surface.

Allowed write scope:

- `apps/editor/src/ui/app-shell/**`
- `apps/editor/src/ui/parameter-operation/**`
- `apps/editor/src/app/**` for composition only
- `apps/editor/src/styles/**`

Forbidden write scope:

- session persistence internals
- core packages
- evidence panel internals owned by Domain E

Expected output:

- Work-focused editor layout, not a landing page.
- App bar / package status area.
- Parameter list.
- `createParameter` form for display name, min, max, default, and step.
- Commit button that calls the session adapter.
- Clear operation status and diagnostics area.
- Stable semantic selectors for browser verification.

Required verification:

- Build passes.
- Manual/browser smoke can create a parameter and see the parameter list update.
- Text does not overlap at desktop or narrow viewport.

Early escape triggers:

- UI needs a framework to remain maintainable in this wave.
- Operation form cannot be wired without direct package mutation.

Parallelism:

- Starts after Domains B and C.
- Can run in parallel with Domain E if app composition ownership is explicitly separated.

### Domain E: `wave6-editor-evidence-persistence-ui`

Purpose:

Expose the persistence and evidence result of the operation pipeline in the editor UI.

Allowed write scope:

- `apps/editor/src/ui/evidence-panel/**`
- `apps/editor/src/ui/package-file-set/**`
- `apps/editor/src/styles/**`

Forbidden write scope:

- operation commit internals
- app bootstrap
- core packages

Expected output:

- Operation log summary panel.
- Generated artifact path list.
- Runtime / validation evidence summary.
- Package file set path list.
- Reload summary showing package revision and committed parameter.

Required verification:

- Evidence panel renders after a committed operation.
- Reload summary matches the session adapter output.
- No generated artifact content is rendered as an oversized raw dump by default.

Early escape triggers:

- Evidence DTO shape is insufficient for a stable summary.
- The panel needs to invent evidence fields not produced by core packages.

Parallelism:

- Starts after Domains B and C.
- Can run in parallel with Domain D if it does not own app composition.

### Domain F: `wave6-integration-review-and-final-report`

Purpose:

Integrate the domains, run the wave gate, perform clean review, and record reports.

Allowed write scope:

- `discussion/implementation/waves/wave6/**`
- `discussion/implementation/reviews/wave6/**`
- `discussion/implementation/_map.md`
- `discussion/implementation/orchestration/_map.md`
- `discussion/_map.md`
- minimal source wiring only if needed to resolve integration issues

Expected output:

- Domain completion reports.
- Review-Sylph reports for each implemented domain.
- Integration review.
- Final report.

Required verification:

- `pnpm install` if needed.
- `pnpm --filter @private-2d-rigging-lab/editor build`
- `pnpm exec vitest run apps/editor/src`
- `pnpm typecheck`
- `pnpm check:source`
- `pnpm check:deps`
- `pnpm check`
- Start the editor dev server and verify in browser:
  - initial editor shell renders
  - commit operation works
  - evidence / package file set summary appears
  - reload summary includes the new parameter
  - desktop and narrow viewport have no obvious overlap

Early escape triggers:

- Any domain remains `blocked`, `escalate`, or unresolved `needs_fix`.
- Full `pnpm check` cannot pass.
- Browser app cannot load due to unresolved bundling or dependency issue.
- Source organization review finds oversized entrypoints or catch-all files.

Parallelism:

- Runs last.

## 8. Launch Order

```text
Batch 1
  A editor app tooling scaffold

Batch 2
  B editor session persistence adapter
  C editor semantic state / view model

Batch 3
  D operation UI surface
  E evidence / persistence UI

Batch 4
  F integration review and final report
```

Undine must wait for each started Orch-Sylph to complete. Do not cancel or mark a domain complete because it is slow.

## 9. Wave Pass Criteria

Wave 6 passes only if all are true:

- `apps/editor` exists as a buildable workspace app.
- The app can commit `createParameter` through `operation-core`.
- The UI shows the newly committed parameter.
- Operation log JSONL is produced in memory.
- Runtime / validation evidence artifacts are produced and summarized.
- Package file set serialization and reload are proven from app-owned adapter tests.
- Source organization guard passes.
- `index.ts` files remain barrel-only if present.
- Full verification passes or failures are explicitly recorded as blocking.
- Integration review and final report are written.

## 10. User Decision Points

No user decision is required before starting Wave 6 under this plan.

Assumption for execution:

- Vite + vanilla TypeScript is accepted as the first editor app stack.
- In-memory package persistence is sufficient for Wave 6.

If either assumption is rejected, revise this plan before launching implementation.
