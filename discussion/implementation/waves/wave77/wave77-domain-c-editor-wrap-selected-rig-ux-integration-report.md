# Wave77 Domain C Report: Editor Wrap-Selected Rig UX Integration

- Verdict: `pass`
- Domain: `wave77-editor-wrap-selected-rig-ux-integration`
- Date: 2026-06-16
- Owner: Orch-Sylph
- Implementation delegate: Gnome
- Review lanes: Spec Compliance, Design / Development Compliance, Test Adequacy
- Fix loops: 1

## Summary

Domain C connects Wave77 Deformer Tree mixed selection to Rig Tool create actions:

- The Rig Tool Inspector now consumes `deformerTreeSet` selections and lists selected Deformer/Drawable targets compactly.
- Coherent selections can create one Rotation or Warp wrapper through Domain B `wrapChildren` payloads.
- Incoherent selections disable create actions and show warning copy with an icon.
- Root Deformer + Pool Drawable and same-parent existing child + Pool Drawable wrap flows are supported.
- Created wrappers become the active selected RigControl after commit.
- Existing single Drawable Rig create, Wave76 Drawable batch root create, and Deformer Tree DnD routes remain separate.

## Changed Files

Production source:

- `apps/editor/src/features/editor-session/model/deformer-tree-wrap-selection.ts`
- `apps/editor/src/features/editor-session/model/rig-tool-state.ts`
- `apps/editor/src/features/editor-session/editor-session-context.tsx`
- `apps/editor/src/workspace/panels/rig-tool-inspector.tsx`

Tests:

- `apps/editor/src/features/editor-session/model/deformer-tree-wrap-selection.test.ts`
- `apps/editor/src/features/editor-session/model/rig-tool-state.test.ts`
- `apps/editor/src/features/editor-session/editor-session-context-history.test.ts`
- `apps/editor/src/workspace/panels/rig-tool-inspector.test.ts`

Persistent artifacts:

- `discussion/implementation/waves/wave77/wave77-domain-c-editor-wrap-selected-rig-ux-integration-report.md`
- `discussion/implementation/reviews/wave77/wave77-domain-c-spec-compliance-review.md`
- `discussion/implementation/reviews/wave77/wave77-domain-c-design-development-review.md`
- `discussion/implementation/reviews/wave77/wave77-domain-c-test-adequacy-review.md`
- `discussion/implementation/waves/wave77/_map.md`
- `discussion/implementation/reviews/wave77/_map.md`

## Basis Coverage Self-Report

Covered basis:

- `discussion/implementation/orchestration/wave77-plan.md`
  - Domain C accepted scope from sections 3.4, 3.5, 7.4, 11, and verification matrix section 13.
- Domain A report and spec review
  - Used the editor-local `deformerTreeSet` selection contract and Deformer Tree selectable target model.
- Domain B report and spec review
  - Used the atomic create-operation `wrapChildren` payload contract.
- `discussion/implementation/orchestration/wave76-plan.md`
- `discussion/implementation/waves/wave76/wave76-final-integration-report.md`
  - Used for existing single Drawable Rig create and Wave76 unbound Drawable batch root create baseline.
- Development policies:
  - `discussion/development_convention/source-file-organization-policy.md`
  - `discussion/development_convention/ux-backed-package-logic-authority.md`
  - `discussion/development_convention/dependency-policy.md`
  - `discussion/development_convention/operation-policy.md`
  - `discussion/development_convention/schema-and-id-conventions.md`

Deferred by Wave77 plan:

- Final combined integration review, broad map closeout, and final Wave77 report remain Domain D.
- Full browser E2E for the complete wrap-selected click path is not added in Domain C; model/component/context integration proof is recorded below.

## User-Facing UX Trace

- `RigToolInspector` derives a Deformer Tree wrap read model for `selection.kind === "deformerTreeSet"`.
- The Target Selection section lists selected target names with compact details such as `Root Deformer`, `Bound Drawable`, and `Pool Drawable`.
- Coherent selections enable `Create Rotation Deformer` and `Create Warp Deformer`.
- Incoherent selections disable both create buttons and render warning copy with `AlertCircle`.
- Create actions call Editor context methods that commit through existing Operation Core command wrappers, then select the newly created wrapper RigControl.

## Data / Schema / Operation Contract Trace

- `deformer-tree-wrap-selection.ts` is the focused editor model file for Deformer Tree wrap-selection projection.
- Coherent selections produce create Rotation/Warp payloads with:
  - `wrapChildren` set to the selected Drawable/RigControl child targets;
  - matching `childDrawableIds` and `childRigControlIds`;
  - `parentRigControlId` only when selected existing children share one immediate parent;
  - no `insertBeforeChild` in the wrap path.
- Rotation pivot is computed from selected bounds union.
- Warp domain is computed from selected warp-domain bounds union.
- Missing/stale targets, changed Drawable parent binding, already-bound Pool Drawable, duplicate selected child, ancestor/descendant selection, mixed existing parents, and mixed root/parented selections produce disabled warning read models.
- Context mutations continue to route through `commitCreateRotationDeformer` and `commitCreateWarpDeformer`, preserving Operation Core as the package mutation gateway.

## Must-Not Compliance Evidence

- No package source, package-format, renderer, WebGL, mesh generation, save/load redesign, dependency, or lockfile changes were made by Domain C.
- No broad auto-rigging, semantic inference, Canvas modifier selection, or Cubism compatibility work was added.
- Existing Deformer Tree DnD commands remain routed to bind/move/reparent operations and are not refit/resize paths.
- Multiple existing non-root parents and ancestor/descendant selected targets are rejected before payload creation.
- The exact mixed Drawable/RigControl display order is not claimed.

## Verification Performed

Commands run by Orch-Sylph:

- `pnpm.cmd exec vitest run apps/editor/src/features/editor-session/model/deformer-tree-wrap-selection.test.ts apps/editor/src/features/editor-session/model/rig-tool-state.test.ts apps/editor/src/workspace/panels/rig-tool-inspector.test.ts apps/editor/src/features/editor-session/editor-session-context-history.test.ts`
  - Sandbox run failed with `spawn EPERM`.
  - Escalated rerun passed: 4 files, 32 tests.
- `pnpm.cmd typecheck`
  - Passed.
- `node scripts/check-source-organization.mjs`
  - Passed.
- `node scripts/check-dependencies.mjs`
  - Passed.
- Scoped `git diff --check`
  - Passed with LF-to-CRLF working-copy warnings only.

Coverage included:

- Coherent selection -> enabled create payloads.
- Incoherent selection -> disabled create actions and warning.
- Rotation pivot from selected bounds union.
- Warp domain from selected warp-domain bounds union.
- Pool Drawable + root Deformer wrapper flow.
- Pool Drawable + same-parent existing child wrapper flow.
- Created wrapper becomes selected after creation.
- Existing single Drawable create and Wave76 batch root create regressions in focused tests.
- Component/context proof for representative wrap-selected UX; existing PSD E2E remains the browser proof for surrounding Deformer Tree selection, Pool, DnD, and batch Rig regression paths.

## Review Results

- Spec Compliance Review: `pass`
  - `discussion/implementation/reviews/wave77/wave77-domain-c-spec-compliance-review.md`
- Design / Development Compliance Review: `pass` after Fix Loop 1
  - `discussion/implementation/reviews/wave77/wave77-domain-c-design-development-review.md`
- Test Adequacy Review: `pass`
  - `discussion/implementation/reviews/wave77/wave77-domain-c-test-adequacy-review.md`

## Fix Loop 1

Initial Design / Development review found that the Domain C wrap-selection read model, payload builders, candidate validation, geometry union, and warning logic had been added to the already-large `rig-tool-state.ts`.

The fix split that responsibility into:

- `apps/editor/src/features/editor-session/model/deformer-tree-wrap-selection.ts`
- `apps/editor/src/features/editor-session/model/deformer-tree-wrap-selection.test.ts`

Imports were updated in Editor context, Rig Tool Inspector, and related tests. The Design / Development reviewer re-reviewed the split and updated the verdict to `pass`.

## Residual Risk Classification

- Low: The complete wrap-selected flow is not browser-clicked end to end. Domain C uses model, component, and editor-session integration tests; existing E2E covers adjacent Deformer Tree modifier selection, Pool DnD continuity, and Wave76 batch Rig regression.
- Low: `editor-session-context.tsx` and `rig-tool-inspector.tsx` remain large, but Domain C additions there are wiring/rendering rather than extracted model derivation.
- Low: Domain C directly model-tests mixed-parent incoherence; duplicate/ancestor/stale variants are source-enforced and covered more deeply by Domain B operation/authoring tests.

## User Decision Points

None.

## Final Recommendation

Wave77 Domain C can be accepted as `pass`. Carry the residual risks into Domain D final integration review rather than reopening Domain C.
