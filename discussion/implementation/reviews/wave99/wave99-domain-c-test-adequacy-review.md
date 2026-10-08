# Wave99 Domain C Test Adequacy Re-Review

Date: 2026-06-24
Reviewer: Review-Sylph
Domain: `wave99-variant-manager-editor-ui-canvas-preview`
Review lane: Test Adequacy
Review pass: Fix Loop 1 / TA-C-001, TA-C-002
Verdict: `pass`

## Summary

Fix Loop 1 directly addresses the two prior Test Adequacy findings. I reviewed the updated tests themselves, not only the Gnome summary.

- TA-C-001 is closed. The Canvas test now renders `EditorSessionProvider` and `CanvasPreviewPanel`, updates Provider preview active state, observes the Canvas renderable drawable count change, and asserts the authoring session/default active state remains unchanged and non-dirty.
- TA-C-002 is closed. The Variant Manager component test now exercises the major screen operations at event level: group create/delete, Variant create/rename/delete, last single-select delete disabled state, picker expansion/eligibility/add selected, membership checkbox, default active selector, and preview active selector.

No blocking test adequacy findings remain for Domain C.

## Findings

No blocking findings.

## Closure Evidence

### TA-C-001: Preview active Provider / CanvasPreviewPanel integration and non-persistence

Status: closed.

Evidence:

- `apps/editor/src/workspace/canvas/canvas-variant-visibility.test.ts:122` adds the Provider + `CanvasPreviewPanel` integration case.
- The test renders `EditorSessionProvider` with `CanvasPreviewPanel` at `apps/editor/src/workspace/canvas/canvas-variant-visibility.test.ts:394` and `:408` through `:418`.
- It records the serialized session before preview mutation at `apps/editor/src/workspace/canvas/canvas-variant-visibility.test.ts:126`.
- It verifies default-derived preview state and initial Canvas output at `apps/editor/src/workspace/canvas/canvas-variant-visibility.test.ts:128` and `:137`.
- It calls the real Provider `setVariantPreviewActiveSelection` at `apps/editor/src/workspace/canvas/canvas-variant-visibility.test.ts:140`.
- It verifies the Provider preview state changed and Canvas output changed from 2 to 1 renderable drawables at `apps/editor/src/workspace/canvas/canvas-variant-visibility.test.ts:149` and `:158`.
- It verifies `session.dirty === false`, `canUndo === false`, `defaultActive` unchanged, and the serialized session unchanged at `apps/editor/src/workspace/canvas/canvas-variant-visibility.test.ts:159` through `:165`.
- The source path under test is the intended integration path: Provider preview state at `apps/editor/src/features/editor-session/editor-session-context.tsx:632`, reconciled preview selections at `:715`, Provider setter at `:1591`, `CanvasPreviewPanel` predicate creation at `apps/editor/src/workspace/panels/canvas-preview-panel.tsx:148` through `:154`, and projection pass-through at `:163` through `:170`.

This covers the prior missing integration between Provider session-local state, `CanvasPreviewPanel`, Canvas projection, and non-dirty/non-save behavior.

### TA-C-002: VariantManagerScreen major UI operations at event level

Status: closed.

Evidence:

- Group create/delete UI events are covered at `apps/editor/src/workspace/variants/variant-manager-screen.test.ts:130` through `:160`, including expected `createVariantGroup` and `deleteVariantGroup` calls.
- Variant create/rename/delete and last-delete disabled state are covered at `apps/editor/src/workspace/variants/variant-manager-screen.test.ts:168` through `:214`.
- Picker DOM behavior and Add selected are covered at `apps/editor/src/workspace/variants/variant-manager-screen.test.ts:220` through `:258`, including collapsed/count text, disabled/checked eligibility states, other-group reason text, and `addVariantTargetDrawable`.
- Membership, default active, and preview active UI controls are covered at `apps/editor/src/workspace/variants/variant-manager-screen.test.ts:266` through `:300`.
- The tested source wiring is the intended screen path: group create at `apps/editor/src/workspace/variants/variant-manager-screen.tsx:138`, group delete at `:368`, Variant delete/button disabled behavior at `:410` through `:418` and `:617`, default active at `:450` through `:456`, preview active at `:459` through `:460`, Add Drawables at `:485` and `:494`, and membership at `:544`.

This covers the prior gap where command/projection tests existed but screen-level input/select/checkbox/button wiring was not exercised.

## Required Coverage Check

| Domain C Required test area | Status after Fix Loop 1 | Evidence |
|---|---|---|
| `Variants` Toolbox entry opens Variant Manager route | Covered | Existing route/toolbox tests retained: `apps/editor/src/workspace/toolbox/workspace-toolbox.test.ts`, `apps/editor/src/workspace/authoring-workspace.test.ts`. |
| Back returns to neutral workspace | Covered | Existing screen test retained at `apps/editor/src/workspace/variants/variant-manager-screen.test.ts:84`. |
| Parameter Bar hidden in Variant Manager | Covered | Existing route test retained in `apps/editor/src/workspace/authoring-workspace.test.ts`. |
| Existing workspace without variants opens empty manager | Covered | Existing screen test retained at `apps/editor/src/workspace/variants/variant-manager-screen.test.ts:76`. |
| Create group initializes expected mode/default Variant | Covered | Command coverage retained; UI event wiring added at `apps/editor/src/workspace/variants/variant-manager-screen.test.ts:130`. |
| Delete group removes group and does not delete drawables | Covered | Command coverage retained; UI delete call and no drawable removal call added at `apps/editor/src/workspace/variants/variant-manager-screen.test.ts:156` through `:163`. |
| Create/delete/rename Variant works | Covered | UI event test at `apps/editor/src/workspace/variants/variant-manager-screen.test.ts:168` through `:206`. |
| Last Variant delete is blocked for single-select | Covered | UI disabled assertion at `apps/editor/src/workspace/variants/variant-manager-screen.test.ts:214`. |
| Add Drawables picker hierarchy collapsed / counts / eligibility | Covered | Component-level picker DOM test at `apps/editor/src/workspace/variants/variant-manager-screen.test.ts:220` through `:248`, plus projection tests retained. |
| Membership checkbox updates model | Covered | UI event test at `apps/editor/src/workspace/variants/variant-manager-screen.test.ts:266` through `:281`. |
| Same drawable can be checked for multiple same-group Variants | Covered | Existing command/model coverage retained in `apps/editor/src/features/variants/model/variant-session-commands.test.ts`. |
| Default active selection saves through project state | Covered | Command coverage retained; UI selector wiring added at `apps/editor/src/workspace/variants/variant-manager-screen.test.ts:283` through `:293`. |
| Preview active affects Canvas and does not mark project dirty/save | Covered | Provider + CanvasPreviewPanel integration test at `apps/editor/src/workspace/canvas/canvas-variant-visibility.test.ts:122` through `:165`. |
| Variant-neutral drawable remains visible according to existing visibility | Covered | Existing Canvas predicate tests retained at `apps/editor/src/workspace/canvas/canvas-variant-visibility.test.ts:81` and `:108`. |
| Variant false hides assigned drawable while preserving existing visibility semantics | Covered | Existing Canvas predicate/AND tests retained, plus Provider integration output assertion at `apps/editor/src/workspace/canvas/canvas-variant-visibility.test.ts:158`. |

## Basis Documents Used

- `discussion/implementation/orchestration/wave99-plan.md`
- `discussion/design/screen-design/screens/variant-expression-manager.md`
- `discussion/design/screen-design/_map.md`
- `discussion/design/screen-design/screens/authoring-workspace.md`
- `discussion/design/screen-design/components/parts-tree.md`
- `discussion/design/screen-design/components/rig-tool.md`
- `discussion/design/screen-design/components/toolbox.md`
- `discussion/implementation/waves/wave99/wave99-domain-c-variant-manager-editor-ui-canvas-preview-report.md`
- `discussion/implementation/reviews/wave99/wave99-domain-c-spec-compliance-review.md`
- `discussion/implementation/reviews/wave99/wave99-domain-c-design-development-review.md`
- Domain A/B reports and Test Adequacy re-review baselines under `discussion/implementation/waves/wave99/` and `discussion/implementation/reviews/wave99/`

## Source And Tests Reviewed

- `apps/editor/src/workspace/canvas/canvas-variant-visibility.test.ts`
- `apps/editor/src/workspace/variants/variant-manager-screen.test.ts`
- `apps/editor/src/features/editor-session/editor-session-context.tsx`
- `apps/editor/src/workspace/panels/canvas-preview-panel.tsx`
- `apps/editor/src/workspace/canvas/canvas-evaluation.ts`
- `apps/editor/src/workspace/canvas/canvas-projection.ts`
- `apps/editor/src/workspace/variants/variant-manager-screen.tsx`
- Prior retained Domain C tests:
  - `apps/editor/src/features/variants/model/variant-session-commands.test.ts`
  - `apps/editor/src/features/variants/model/variant-manager-projection.test.ts`
  - `apps/editor/src/workspace/authoring-workspace.test.ts`
  - `apps/editor/src/workspace/toolbox/workspace-toolbox.test.ts`

## Test Results Considered

Gnome reported these checks passed after Fix Loop 1:

- `pnpm.cmd exec vitest run apps/editor/src/workspace/canvas/canvas-variant-visibility.test.ts apps/editor/src/workspace/variants/variant-manager-screen.test.ts`
  - Passed: 2 files / 9 tests.
- Domain C focused set:
  - Passed: 6 files / 24 tests.
- `pnpm.cmd typecheck`
- `git diff --check -- apps/editor/src discussion/implementation/waves/wave99`
  - Exit 0, with LF-to-CRLF warnings only.

Reviewer did not rerun Vitest in this re-review because the lane decision was based on direct inspection of the newly added test coverage and Gnome had already rerun the focused and Domain C sets after Fix Loop 1. `pnpm install` was not run.

## Residual Risks / Open Verification

- UI coverage remains component/fake-DOM and projection focused. There is still no browser E2E or visual screenshot verification for the complete Manager layout.
- Preview active selection is Provider-wide session-local state, so after leaving the Manager a normal `CanvasPreviewPanel` can still reflect the preview state until reset/load/reconciliation. This is already noted in Spec and Design/Development reviews and is not a Test Adequacy blocker for the two prior findings.
- Batch Add selected still commits one operation per drawable because Domain A exposes single-drawable operations. This is a UX/history granularity risk, not an uncovered TA-C-001/002 issue.

## Decision

No user design decision is needed. Verdict: `pass`.
