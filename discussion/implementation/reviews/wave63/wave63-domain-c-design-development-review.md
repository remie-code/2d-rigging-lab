# Wave63 Domain C Design / Development Compliance Review

Review lane: Design / Development Compliance Review
Domain: `wave63-deformer-tree-inspector-editor-ux`
Review pass: Fix Loop 2 final re-check
Reviewer: independent Review-Sylph
Date: 2026-06-12
Verdict: `pass`

## Basis Reviewed

- `discussion/implementation/orchestration/wave63-plan.md`
- `discussion/implementation/waves/wave63/wave63-domain-a-report.md`
- `discussion/implementation/waves/wave63/wave63-domain-b-report.md`
- `discussion/design/screen-design/components/rig-tool.md`
- `discussion/design/screen-design/screens/authoring-workspace.md`
- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/implementation/waves/wave63/wave63-domain-c-report.md`
- Target source files and focused tests listed in the review request, plus fix-loop additions `canvas-renderer.ts`, `canvas-preview-panel.tsx`, and `rig-tool-inspector.test.ts`.

## Verdict Summary

`pass`.

The prior blocking finding C-DD-001 is resolved. Warp Deformer draft Apply now uses the shared Rig command feedback path, the draft inspector renders that feedback, and insertion drafts lock the parent selector so ordinary UI edits cannot create a stale `insertBeforeChild` / parent combination. No unresolved Design / Development compliance blocker was found.

Fix Loop 2 keeps the pass verdict. The only reviewed implementation change in this lane is a local stability fix to Rig inspector `Parent deformer` select handlers: each handler captures `event.currentTarget.value` before entering state callbacks. This does not change package contracts, operation routing, failure feedback, source organization, or forbidden-scope boundaries.

## Prior Finding Resolution

### C-DD-001: Warp Deformer draft Apply rejection is console-only, so Inspector failure UX is not surfaced

Status: resolved

Resolution evidence:

- `applyRigDraft` now calls `applyRigCommand` at `apps/editor/src/features/editor-session/editor-session-context.tsx:451` to `:467`.
- `applyRigCommand` sends rejected diagnostics to `rigOperationFeedback` and returns the current session without committing at `apps/editor/src/features/editor-session/editor-session-context.tsx:263` to `:284`.
- `WarpDeformerDraftEditor` receives `feedback={rigOperationFeedback}` at `apps/editor/src/workspace/panels/rig-tool-inspector.tsx:57` to `:69`.
- The draft inspector renders the same unobtrusive feedback surface used by committed inspectors at `apps/editor/src/workspace/panels/rig-tool-inspector.tsx:395` and `:1018` to `:1028`.
- Insertion drafts lock the parent selector with `disabled={draft.insertBeforeChild !== undefined}` at `apps/editor/src/workspace/panels/rig-tool-inspector.tsx:261` to `:276`, and show a compact insertion status at `:287` to `:294`.
- Browser coverage exercises the rejected stale insertion draft path and expects `rig-tool-operation-feedback` at `apps/editor/e2e/psd-import.e2e.spec.ts:337` to `:385`.

## Fix Loop 2 Re-Check

Status: pass

- Draft Warp parent select now captures `const parentRigControlId = event.currentTarget.value` before `onUpdate(...)` at `apps/editor/src/workspace/panels/rig-tool-inspector.tsx:263` to `:276`.
- Committed Warp parent select now captures the value before `setEditState(...)` at `apps/editor/src/workspace/panels/rig-tool-inspector.tsx:510` to `:521`.
- Committed Rotation parent select uses the same local capture pattern at `apps/editor/src/workspace/panels/rig-tool-inspector.tsx:751` to `:762`.
- The select fix is UI-local and does not call package mutations directly. Parent changes still apply through `onReparent(...)` in inspector `apply` handlers, which are wired to the Editor context operation wrapper.
- E2E coverage exercises the committed Inspector parent select and asserts Deformer hierarchy changes while Parts drawable row order remains unchanged at `apps/editor/e2e/psd-import.e2e.spec.ts:400` to `:438`.
- Component-level test coverage verifies keyformed Warp Deformers disable all division inputs and omit disabled division fields from update payloads in `apps/editor/src/workspace/panels/rig-tool-inspector.test.ts`.

## Compliance Checks

### Architecture / Module Boundary

Status: pass

- Editor command wrappers route package-changing work through Operation Core operation types rather than local package mutation: `createWarpDeformer`, `createRotation2dRigControl`, `bindRigControlChild`, `moveDrawableRigControlBinding`, `reparentRigControl`, and `updateRigControl` are in `apps/editor/src/features/editor-session/model/editor-session-commands.ts:287` to `:366`.
- Those wrappers use `createOperationCore().commitOperation(...)` with an operation request at `apps/editor/src/features/editor-session/model/editor-session-commands.ts:469` to `:489`.
- Context wiring calls the Editor command wrappers for drawable create, selected-Deformer parent create, DnD bind/rebind/reparent, and committed inspector edits at `apps/editor/src/features/editor-session/editor-session-context.tsx:469` to `:584`.
- Deformer Tree DnD dispatches only rig-control operations at `apps/editor/src/workspace/panels/deformer-tree-view.tsx:70` to `:80`.
- I found no Domain C package foundation redesign and no new package contract work in the reviewed Editor source.

### Source Organization

Status: pass with non-blocking size risk

- No reviewed `index.ts` file contains implementation logic.
- No new broad catch-all `types.ts`, `schemas.ts`, `utils.ts`, or `helpers.ts` file was introduced.
- `rig-tool-state.ts`, `editor-session-commands.ts`, `rig-tool-inspector.tsx`, `deformer-tree-view.tsx`, `canvas-projection.ts`, `canvas-renderer.ts`, and `canvas-preview-panel.tsx` remain responsibility-scoped.
- `rig-tool-inspector.test.ts` is a focused component/payload test file for the Rig inspector and mirrors the touched source responsibility.
- `rig-tool-inspector.tsx` is large and now owns draft, committed Warp, committed Rotation, parent creation actions, field widgets, and update payload shaping. This is not a blocking catch-all violation, but future Rig Tool expansion should split committed deformer inspectors or payload helpers into named files.
- `node scripts/check-source-organization.mjs` passed.

### UI Design Compliance

Status: pass

- No landing or marketing UI was added.
- Drawable selection exposes both required actions, `Create Rotation Deformer` and `Create Warp Deformer`, in the Rig inspector.
- Selected Deformer inspectors expose `Create Parent Rotation Deformer` and `Create Parent Warp Deformer` via icon+text command buttons at `apps/editor/src/workspace/panels/rig-tool-inspector.tsx:1030` to `:1059`.
- Controls are appropriate: selects for parent deformer, number inputs for bounds/divisions/opacity, readonly Bezier edit type, icon+text buttons for clear commands.
- Deformer Tree keeps hierarchy primary and adds a collapsed-by-default Drawable Pool at `apps/editor/src/workspace/panels/deformer-tree-view.tsx:223` to `:299`.
- The Pool uses binding terminology (`Drawable Pool`, `No unbound Drawables`) and does not imply Parts membership changes.
- I found no visible tutorial/marketing copy or raw operation/evidence payload display in the changed Rig/Deformer panels.

### Failure UX / No-Mutation Behavior

Status: pass

- UI-prevented invalid drops return before dispatching an operation at `apps/editor/src/workspace/panels/deformer-tree-view.tsx:65` to `:68`.
- Invalid drop feedback is local, compact, and unobtrusive at `apps/editor/src/workspace/panels/deformer-tree-view.tsx:301` to `:309`.
- Operation rejections use `rigOperationFeedback`; rejected commands return the current session at `apps/editor/src/features/editor-session/editor-session-context.tsx:276` to `:284`.
- Focused unit tests assert invalid Deformer Tree operation rejections return the original session at `apps/editor/src/features/editor-session/model/editor-session-commands.test.ts:198` to `:239`.
- Focused browser coverage asserts stale insertion draft rejection displays inspector feedback at `apps/editor/e2e/psd-import.e2e.spec.ts:337` to `:385`.
- Fix Loop 2 browser coverage asserts committed Inspector parent reparent does not change Parts order at `apps/editor/e2e/psd-import.e2e.spec.ts:400` to `:438`.

### Parts / Deformers Coherence

Status: pass

- Deformer rows, Rotation rows, and bound Drawable reference rows remain distinct in the Deformer Tree; bound Drawable references use `data-row-kind="bound-drawable-ref"`.
- Drawable Pool is computed from deformer binding, not Parts membership, at `apps/editor/src/features/editor-session/model/rig-tool-state.ts:372` to `:388`.
- Focused tests assert pool bind, bound Drawable rebind, and Deformer reparent preserve drawable Parts membership and global draw order at `apps/editor/src/features/editor-session/model/editor-session-commands.test.ts:117` to `:196`.

### Selected-Deformer Parent Create

Status: pass

- Parent Warp and Parent Rotation payloads use `childRigControlIds` for root selected Deformers and `parentRigControlId + insertBeforeChild.kind === "rigControl"` for parented insertion at `apps/editor/src/features/editor-session/model/rig-tool-state.ts:221` to `:285`.
- Unit coverage checks root parent creation and parented insertion payloads at `apps/editor/src/features/editor-session/model/rig-tool-state.test.ts:164` to `:207`.
- Operation-level coverage checks root parent and insertion rewiring at `apps/editor/src/features/editor-session/model/editor-session-commands.test.ts:340` to `:395`.
- E2E coverage creates a Rotation Deformer and inserts a parent Warp above it at `apps/editor/e2e/psd-import.e2e.spec.ts:387` to `:426`.

### Canvas Overlay Scope

Status: pass

- Committed Rotation overlay is projection/rendering work only. `canvas-projection.ts` projects Rotation overlay DTO fields at `apps/editor/src/workspace/canvas/canvas-projection.ts:289` to `:310`.
- `canvas-renderer.ts` draws the Rotation guide from the projection at `apps/editor/src/workspace/canvas/canvas-renderer.ts:124` to `:215`.
- `canvas-preview-panel.tsx` only passes the existing Rig draft into canvas projection at `apps/editor/src/workspace/panels/canvas-preview-panel.tsx:115` to `:126`.
- Unit tests cover committed Warp and Rotation projections at `apps/editor/src/workspace/canvas/canvas-projection.test.ts:260` to `:359`.

### Forbidden Scope

Status: pass

- No Mesh algorithm implementation was added in Domain C target source. Mesh generation remains in Domain B/package code.
- No Parameter / Keyform authoring UI was added. Keyform handling is limited to detecting keyform presence and disabling division edits, for example `apps/editor/src/workspace/panels/rig-tool-inspector.tsx:607` to `:657` and `apps/editor/src/features/editor-session/model/rig-tool-state.ts:589` to `:595`.
- No semantic auto-rig, semantic classification, Cubism compatibility claim, Cubism SDK/Core use, or Cubism file-format handling was found in reviewed Domain C paths.
- No new dependency or dependency-policy issue was introduced by Domain C.

### Domain B Conflict Avoidance

Status: pass

- Mesh Tool default/new generation remains `auto-outline-v2` in shared context and commands at `apps/editor/src/features/editor-session/editor-session-context.tsx:352` to `:399` and `apps/editor/src/features/editor-session/model/editor-session-commands.ts:270` to `:285`.
- Unit coverage still asserts Mesh Tool generation commands default to `auto-outline-v2` at `apps/editor/src/features/editor-session/model/editor-session-commands.test.ts:441` to `:512`.
- Focused Mesh Tool E2E `generates an initial mesh draft for a selected hidden Drawable and applies it` passed during this review.

## Verification Performed

- Read all required basis documents and updated Domain C report.
- Inspected the relevant source and focused tests directly; this verdict does not rely on the Gnome summary alone.
- Ran `node scripts/check-source-organization.mjs`: pass.
- Ran `git diff --check -- <Domain C target files and report>`: pass, with CRLF conversion warnings only.
- Ran `pnpm.cmd typecheck`: pass.
- Ran focused Vitest command:
  - Sandbox run failed with Vite/esbuild `spawn EPERM`.
  - Approved rerun passed: 3 files / 23 tests.
- Ran focused Rig/Deformer Playwright command:
  - Sandbox run failed with `spawn EPERM`.
  - Approved rerun passed: 3 tests.
- Ran focused Mesh Tool Playwright command for Domain B conflict avoidance:
  - Approved rerun passed: 1 test.
- Ran Fix Loop 2 focused Vitest command:
  - Sandbox run failed with Vite/esbuild `spawn EPERM`.
  - Approved rerun passed: 2 files / 12 tests.
- Ran Fix Loop 2 focused Playwright command for committed Inspector parent reparent:
  - Sandbox run failed with `spawn EPERM`.
  - Approved rerun passed: 1 test.

## Residual Risk Classification

low-to-medium

- Low: C-DD-001 is resolved by shared feedback routing, visible draft inspector feedback, locked insertion parent selection, and browser coverage.
- Low: package/editor boundary, source organization guard, typecheck, focused unit tests, and focused E2E pass.
- Low-to-medium: `rig-tool-inspector.tsx` is still cohesive but large; future Rig Tool growth should split responsibilities before it becomes costly to review.
- Low-to-medium: full browser coverage for every deformer reparent gesture is still limited, but operation-level no-mutation coverage exists and this does not block Design / Development compliance.

## Final Verdict

`pass`
