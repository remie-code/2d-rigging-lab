# Wave83 Domain A Dynamics Preview Time Progression + Quick Tune Report

## Verdict

pass

Domain A is pass-classified after one focused Gnome fix loop and three independent Review-Sylph lanes. No blocking or needs-change findings remain.

## Basis Documents Used

- `discussion/implementation/orchestration/wave83-plan.md`
- `discussion/design/screen-design/components/dynamics-tool.md`
- `discussion/implementation/waves/wave81/wave81-dynamics-time-progression-status.md`
- `discussion/implementation/waves/wave82/wave82-final-integration-report.md`
- `discussion/implementation/reviews/wave82/wave82-final-clean-integration-review.md`
- `discussion/implementation/waves/wave81/wave81-final-integration-report.md`
- `discussion/implementation/reviews/wave81/wave81-final-clean-integration-review.md`
- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/development_convention/ux-backed-package-logic-authority.md`
- `discussion/development_convention/dependency-policy.md`
- `discussion/development_convention/operation-policy.md`
- `discussion/development_convention/schema-and-id-conventions.md`

## Children Started And Waited

- Gnome implementation: `019edabe-322b-72d2-85a6-90ee19bd63ef`; completed; waited.
- Gnome Fix Loop 1 for duplicate Quick Tune completion commits: same child; completed; waited.
- Spec Compliance Review: `019edad5-020d-7c20-a414-0fc04bf880d7`; completed; waited; verdict `pass`.
- Design / Development Compliance Review: `019edad5-53e6-76a0-a8d8-25f4c9e984a4`; completed; waited; verdict `pass`.
- Test Adequacy Review: `019edad5-be87-7f31-b8c5-2383acc359f0`; completed; waited; verdict `pass`.

## Files Changed

- `apps/editor/src/features/editor-session/model/dynamics-tool-state.ts`
- `apps/editor/src/features/editor-session/model/dynamics-tool-state.test.ts`
- `apps/editor/src/features/editor-session/editor-session-context.tsx`
- `apps/editor/src/features/editor-session/editor-session-context-history.test.ts`
- `apps/editor/src/workspace/panels/dynamics-tool-inspector.tsx`
- `apps/editor/src/workspace/panels/dynamics-tool-inspector.test.ts`
- `apps/editor/src/workspace/panels/inspector-panel.test.ts`
- `discussion/implementation/waves/wave83/wave83-domain-a-dynamics-preview-time-progression-quick-tune-report.md`
- `discussion/implementation/waves/wave83/_map.md`
- `discussion/implementation/reviews/wave83/_map.md`
- `discussion/implementation/reviews/wave83/wave83-domain-a-spec-compliance-review.md`
- `discussion/implementation/reviews/wave83/wave83-domain-a-design-development-review.md`
- `discussion/implementation/reviews/wave83/wave83-domain-a-test-adequacy-review.md`

## Current-State Confirmation

- Wave81 left Editor Dynamics preview as one fixed step on driver value changes; no continuing preview loop existed.
- `dynamics-tool-state.ts` held session-local selected group, driver values, simulation states, and reset serial.
- `setDynamicsToolPreviewDriverValue(...)` previously both stored driver value and stepped the local solver once.
- `resetDynamicsToolPreviewSimulation(...)` already reset mutable simulation state and incremented a session-local serial.
- `createDynamicsToolPreviewEvaluation(...)` already built Dynamics Tool preview parameter values from parameter defaults plus Inspector-local driver values, then applied additive output.
- Existing Group Inspector showed driver controls, raw `Source / Angle / Offset / Effective` rows, Reset Preview, Edit, and Delete.
- Wave82 rAF slider coalescing lived in `apps/editor/src/workspace/controls/raf-coalesced-number.ts` and was preserved.

## Solver Reuse Decision Trace

- Direct runtime-core import was not used in this domain.
- Reason: `apps/editor` does not currently depend on `@private-2d-rigging-lab/runtime-core`; adding that package dependency would require manifest/dependency boundary work outside the delegated source scope.
- The Editor-local helper was aligned with runtime-core semantics instead:
  - `dtMs` is clamped to `100ms`.
  - long elapsed time is split into nominal `16.6666667ms` substeps.
  - pendulum formula, reset state shape, additive output, and disabled/missing-pendulum behavior remain aligned with runtime-core.
- No `packages/runtime-core/src/**` files were changed.

## Preview Animation Loop Trace

- `setDynamicsToolPreviewDriverValue(...)` now only stores the selected group and clamped driver value; animation frames consume that driver value afterward.
- `advanceDynamicsToolPreviewSimulation(...)` advances the selected group state using elapsed `dtMs`.
- `ExistingGroupInspector` starts a `requestAnimationFrame` loop only when the open group matches `dynamicsToolPreview.selectedGroupId`.
- The loop cleanup cancels the pending frame on unmount, group close, Edit/Create/List transition, or selected-group mismatch.
- Driver changes affect later frames through `driverValuesByGroupId`.
- Driver stops still allow the loop to keep advancing angular velocity/restoring/damping state until convergence.
- Reset Preview uses the resolved current preview definition and resets angle, angular velocity, previous source, previous source velocity, tick, and reset counter deterministically.
- List/Create/Edit states do not mount the normal preview animation loop.

## Quick Tune UI / Commit Trace

- Existing Group Inspector now renders Quick Tune below Preview and above Actions.
- Controls are exactly:
  - Strength
  - Limit
  - Length
  - Sway
  - Reaction
  - Convergence
- Quick Tune live edits update `definitionOverridesByGroupId`, a session-local preview override consumed by `createDynamicsToolPreviewEvaluation(...)` and preview stepping.
- Finalization commits through the existing `updateDynamicsGroup(...)` operation path with `pendulums` and `outputs` only.
- Same-value finalization no-ops.
- Fix Loop 1 added a finalized-draft signature guard so repeated completion events for the same draft, such as pointerup followed by blur, create only one operation-backed update while the committed group prop is stale.
- The normal raw `Source / Angle / Offset / Effective` rows were removed from Existing Group Inspector.

## History / Persistence Boundary Trace

- Animation ticks update only React/session-local preview state.
- Quick Tune live drafts and definition overrides are session-local and are cleared when matching committed group state or on group Inspector unmount.
- Quick Tune committed changes use existing operation-backed `updateDynamicsGroup(...)`; no operation schema or payload shape was added.
- Preview animation ticks, driver preview values, reset state, and quick tune live overrides do not enter save/load schema or portable project format.
- Existing Dynamics create/update/delete operation-backed flows remain in place.

## Must-not Compliance Evidence

- No Viewer playback, Viewer time progression, Viewer reset controls, pause/playback controls, or frame stepping were implemented.
- No save/load schema or portable package format files were changed.
- No operation payload/schema files were changed.
- No keyform/deformer/mesh behavior files were changed.
- No multi-pendulum, multi-output, mixer, same-output blending, or Cubism compatibility work was added.
- No new dependencies were added.
- Wave82 rAF coalescing helper was reused and preserved.

## Verification Performed

Passed:

- `pnpm.cmd typecheck`
- Focused Vitest after sandbox `esbuild spawn EPERM` and approved rerun:
  - `apps/editor/src/workspace/panels/dynamics-tool-inspector.test.ts`
  - `apps/editor/src/features/editor-session/model/dynamics-tool-state.test.ts`
  - `apps/editor/src/features/editor-session/editor-session-context-history.test.ts`
  - `apps/editor/src/workspace/panels/inspector-panel.test.ts`
  - Result: 4 files / 29 tests passed.
- `node scripts/check-source-organization.mjs`
- `node scripts/check-dependencies.mjs`
- `git diff --check` passed with CRLF normalization warnings only.

Not run, with justification:

- Focused runtime-core Dynamics tests: no `packages/runtime-core/src/**` files were changed.
- Focused Canvas projection/evaluation tests: no Canvas projection/evaluation files were changed; existing Canvas receives the same `dynamicsToolPreviewEvaluation.parameterValues` surface.

## Review Lane Verdicts And Fix Loops

- Pre-review self-check found a likely duplicate Quick Tune commit risk.
- Fix Loop 1 delegated to Gnome and completed before independent review lanes.
- Spec Compliance Review: `pass`, no findings.
- Design / Development Compliance Review: `pass`, no findings.
- Test Adequacy Review: `pass`, no findings.

## Residual Risks

- No browser/manual visual QA was run for actual drag feel or live Canvas motion.
- Editor-local solver remains duplicated from runtime-core. Future work should consolidate if package dependency policy allows `apps/editor` to depend on runtime-core or exposes a narrow shared stepping contract.
- Quick Tune coefficient controls are covered by component/model tests, not by browser pointer/blur ordering in a real DOM.

## User-Decision Points

None for Domain A implementation after Fix Loop 1.
