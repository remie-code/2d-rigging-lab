# Wave77 Domain B Report: Multi-Child Wrap Operation / Authoring Foundation

- Target: `wave77-multi-child-wrap-operation-authoring-foundation`
- Domain: B
- Date: 2026-06-16
- Owner: Orch-Sylph
- Verdict: `pass`
- Fix loops: 1

## Summary

Domain B adds the package/operation foundation for atomic `wrap selected` RigControl creation. Existing create Rotation and create Warp Deformer operations now accept optional `wrapChildren` targets and route them through one authoring mutation, `wrapRigControlChildren`.

The implementation keeps scalar `insertBeforeChild` compatibility, keeps `RigControl.partId` as optional legacy metadata only, and does not touch editor UI, mesh generation, renderer, or package-format semantics.

## Files Changed

- `packages/authoring-core/src/rig-control-mutations.ts`
- `packages/authoring-core/src/rig-control-mutations.test.ts`
- `packages/operation-core/src/payloads/rig-control.ts`
- `packages/operation-core/src/operations/create-rotation2d-rig-control.ts`
- `packages/operation-core/src/operations/create-warp-deformer.ts`
- `packages/operation-core/src/operations/rig-control.test.ts`
- `packages/operation-core/src/operation-schemas.test.ts`
- `packages/ai-interface/src/ai-codex-proposal-operation-catalog.ts`

## Basis Coverage Self-Report

- `discussion/implementation/orchestration/wave77-plan.md`: covered Domain B accepted scope, AC 7.3, Domain B section 10, and must-not list.
- `discussion/implementation/orchestration/wave76-plan.md`: covered Wave76 no-`partId` baseline and earlier wrap exclusions.
- `discussion/implementation/waves/wave76/wave76-final-integration-report.md`: covered Wave76 final baseline and residuals.
- `discussion/implementation/reviews/wave76/wave76-final-clean-integration-review.md`: covered Wave76 final clean review.
- Development policies checked: source organization, UX-backed package authority, dependency policy, operation policy, schema and ID conventions.

## Implementation Trace

- Added exported `wrapRigControlChildren` mutation in `authoring-core`.
- Added `wrapChildren` payload targets for `createRotation2dRigControl` and `createWarpDeformer`.
- Rotation and Warp create handlers now call the atomic authoring mutation for wrap operations.
- Existing `insertBeforeChild` branches remain in place and continue to be tested.
- `wrapChildren` plus `insertBeforeChild` rejects deterministically.
- Non-empty legacy `childDrawableIds` / `childRigControlIds` must match `wrapChildren` when `wrapChildren` is present; mismatches reject.
- Operation target IDs for wrap operations come from the actual wrap targets.

## Data / Schema / Operation Contract Trace

- Parented children under one parent are moved under the new wrapper; unselected siblings remain under the original parent.
- Mixed direct Drawable and child RigControl siblings can be wrapped with an unbound Drawable.
- Root RigControls are replaced in `rigControlRootIds` by one new root wrapper, and old roots get `parentId` set to the wrapper.
- Unbound Drawables can be included with coherent parented or root selected groups.
- Mixed non-root parents, root/parented mixing, duplicate targets, missing children, explicit parent mismatch, insert+wrap, and ancestor/descendant selections reject.
- Model diff evidence records wrapper creation, parent child-list changes, child RigControl `parentId` changes, Drawable child targets, and root ID changes.

## User-Facing UX Trace

Domain B has no editor UI. It provides the package/operation path that Domain C can call from Deformer Tree wrap-selected UX. Bounds/pivot union computation remains Domain C responsibility.

## Must-Not Compliance Evidence

- No `apps/editor/**` edits.
- No Deformer Tree selection/UI edits.
- No mesh generation or renderer edits.
- No dependency additions.
- No package-format redesign.
- No `RigControl.partId` ownership reintroduction.
- No exact mixed Drawable/RigControl visual order claim.

## Verification

- `pnpm.cmd exec vitest run packages/authoring-core/src/rig-control-mutations.test.ts packages/operation-core/src/operations/rig-control.test.ts packages/operation-core/src/operation-schemas.test.ts packages/ai-interface/src/ai-codex-proposal-validation.test.ts`: pass, 4 files / 55 tests. Initial sandbox run failed with `spawn EPERM`; the command was rerun outside the sandbox.
- `pnpm.cmd typecheck`: pass.
- `node scripts/check-source-organization.mjs`: pass.
- `node scripts/check-dependencies.mjs`: pass.
- `git diff --check -- <Domain B files>`: pass; Git printed LF-to-CRLF working-copy warnings only.

## Review Lanes

- Spec Compliance Review: `pass` after Fix Loop 1. See `discussion/implementation/reviews/wave77/wave77-domain-b-spec-compliance-review.md`.
- Design / Development Compliance Review: `pass` after Fix Loop 1. See `discussion/implementation/reviews/wave77/wave77-domain-b-design-development-review.md`.
- Test Adequacy Review: `pass` after Fix Loop 1. See `discussion/implementation/reviews/wave77/wave77-domain-b-test-adequacy-review.md`.

## Fix Loop 1

Initial Design / Development review found ambiguous payload behavior when `wrapChildren` was combined with mismatched legacy child arrays. The fix rejects non-empty mismatched legacy child arrays and excludes ignored child arrays from wrap target IDs.

Initial Test Adequacy review found missing operation-level negative and model-diff assertions. The fix added tests for missing child, explicit parent mismatch, child-list mismatch, insert+wrap rejection, stronger model-diff assertions, root wrap plus unbound Drawable, and stronger geometry preservation checks.

## Residual Risks

- Editor/UI integration and bounds/pivot union computation are intentionally left for Domain C.
- Wrap-specific dry-run tests are not separate; existing create operation dry-run coverage plus commit wrap tests cover the critical behavior.
- RigControl-only mixed-parent rejection is source-enforced, while focused negative tests primarily exercise mixed-parent Drawables.
- Runtime diff remains `undefined`, matching existing create RigControl operation patterns. Reviewers treated this as a non-blocking cross-cutting residual, not a Domain B regression.

## User Decision Points

None.

