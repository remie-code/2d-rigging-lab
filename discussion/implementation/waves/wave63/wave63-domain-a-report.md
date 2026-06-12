# Wave63 Domain A Report: Deformer Package / Operation Management Foundation

## Status

implemented - fix loop 1 applied

## Fix Loop 1 Review Findings Addressed

- Addressed A-SPEC-001 / A-DD-001 / A-TEST-001: `updateRigControl` now builds a fully validated preview state before mutating the live rig control, and the operation commit path performs a dry-run preflight before applying to the live session. Rejected commits for invalid Warp fields or keyform cardinality conflicts leave the rig control, package/authoring revisions, dirty state, and operation log length unchanged.
- Added operation-level rejected-commit atomicity tests for generic field changes combined with invalid Warp `domainBounds`, and generic field changes combined with keyform cardinality conflict.
- Added insertion-safe operation tests for `createRotation2dRigControl` between a parent deformer and drawable child, and `createWarpDeformer` between a parent deformer and child rig control. These cover dry-run no-mutation, committed parent/child rewiring, modelDiff field paths, and no Parts/draw-order mutation.
- Added operation-level dry-run/modelDiff/no-mutation coverage for drawable rebind, deformer reparent including root reparent modelDiff, and committed update dry-run no-mutation.
- Added validator coverage for duplicate `childRigControlIds` producing `rigControl.duplicateChild`.

## Current-state delta from inventory

- Deformer management now has package/authoring/operation/validator/runtime foundations for binding move, deformer reparent, insertion-safe create, committed deformer update, static opacity multiplier, duplicate binding validation, and division/keyform cardinality rejection.
- Existing `bindRigControlChild` remains the unbound-pool bind operation. Bound drawable movement is separated into `moveDrawableRigControlBinding`.
- `createRotation2dRigControl` and `createWarpDeformer` now support insertion between an existing parent deformer and one existing child drawable/deformer via `parentRigControlId + insertBeforeChild`.
- Warp Deformer read projection and runtime evaluation expose/use `opacityMultiplier`, defaulting legacy missing values to `1`.

## Chosen operation granularity

- `moveDrawableRigControlBinding`: move an already-bound drawable from its current deformer parent to another deformer parent.
- `reparentRigControl`: move a deformer under another deformer, or to root with `parentRigControlId: null`.
- `createRotation2dRigControl` / `createWarpDeformer`: creation operations extended for insertion-safe create. The inserted deformer is created with the existing child as its only child; the parent binding is replaced.
- `updateRigControl`: committed inspector-style update for display name, static opacity multiplier, Warp Deformer domain bounds, transform grid point counts, and Bezier edit surface divisions.
- Parent field editing in the inspector should call `reparentRigControl` rather than overloading `updateRigControl`.

## Basis Coverage Self-Report

- Deformer Tree and Drawable Pool separation: implemented in operation semantics. Drawable binding move changes only rig control child lists, not Parts membership, Parts Tree order, or draw order.
- Deformer Creation / Insertion: implemented for Rotation2d and Warp Deformer insertion between existing parent deformer and existing drawable/deformer child.
- Warp Deformer Inspector fields: operation support exists for displayName/name, parent via reparent operation, domainBounds, transform control point count, Bezier divisions, and opacityMultiplier.
- Operation policy: dry-run and commit handlers return modelDiff/precondition diagnostics using existing operation-core patterns.
- Schema/id conventions: no new dependency or ID convention introduced; new operation payloads reuse existing ID schemas.
- UX-backed package authority: source/package/operation semantics are aligned to the design handoff; no editor UI implementation was added.

## Intentionally Deferred Basis Items

- Editor UI wiring, drag/drop handlers, inspector controls, and read projection consumption in `apps/editor/**` are deferred to Domain C.
- Parameter-driven subtree opacity is not implemented; `opacityMultiplier` is static and separate.
- Bezier runtime evaluation remains stored-not-evaluated; no runtime Bezier deformation claim is made.
- Keyform cardinality migration is deferred. Wave63 safe rule is implemented as reject-on-cardinality-change when keyforms target the deformer.
- Cubism compatibility/import/export/load is not claimed or implemented.

## User Workflow Trace

1. User drags a bound Drawable from one Deformer Tree row to another: Domain C should call `moveDrawableRigControlBinding`. The package updates only source/target `childDrawableIds`.
2. User drags a child Deformer to a new parent Deformer or root: Domain C should call `reparentRigControl`. Cycles, duplicate children, and incoherent parent/root state are rejected.
3. User creates a Rotation/Warp Deformer on an already-bound child: Domain C should call `createRotation2dRigControl` or `createWarpDeformer` with `parentRigControlId` and `insertBeforeChild`. Existing binding is replaced, not duplicated.
4. User edits Warp Deformer inspector fields and commits: Domain C should call `updateRigControl` for name/domain/divisions/opacity, and `reparentRigControl` for parent.

## Must-not Compliance Evidence

- No `apps/editor/**` file was edited by Domain A implementation. Existing workspace dirty entries under `apps/editor/**` were treated as preexisting/parallel work and left untouched.
- No dependency was added.
- No unrelated refactor or formatting-only pass was performed.
- No Cubism compatibility, Bezier runtime evaluation, parameter/keyform authoring UI, or editor UX implementation was claimed.
- Domain A report only: this file was added; Domain B/C/D reports and reviews were not edited.

## Static opacity multiplier persistence/validation/projection evidence

- Persistence: `opacityMultiplier?: number` added to package rig controls, with new create/update paths persisting explicit values and authoring creates defaulting missing values to `1`.
- Validation: package schema constrains `opacityMultiplier` to `0..1`; authoring mutations reject invalid values; validator maps schema failures to `rigControl.opacityMultiplierRange`.
- Read projection: `projectWarpDeformerReadModel` exposes `opacityMultiplier`, defaulting legacy missing values to `1`.
- Runtime projection/evaluation: authoring runtime graph projection emits `opacityMultiplier`; runtime evaluated rig controls expose it and descendant drawable opacity is multiplied through enabled, non-blocked deformer ancestor chains.

## Duplicate binding and keyform cardinality rejection evidence

- Duplicate child entries in a single rig control are diagnosed as `rigControl.duplicateChild`.
- A drawable bound under more than one rig control is diagnosed as `rigControl.drawableMultipleParents`.
- Parent/child mismatch remains diagnosed as `rigControl.parentChildMismatch` and is also rejected by mutation preconditions where relevant.
- Division/cardinality edits are rejected with `rig_control_keyform_cardinality_conflict` / `operation.updateRigControl.keyformCardinalityConflict` if transform or Bezier cardinality would change while keyforms target that deformer.

## Domain C handoff

Operation names:
- `moveDrawableRigControlBinding`
- `reparentRigControl`
- `updateRigControl`
- extended `createRotation2dRigControl`
- extended `createWarpDeformer`

DTO / payload shapes:
- `moveDrawableRigControlBinding`: `{ drawableId, targetRigControlId }`
- `reparentRigControl`: `{ childRigControlId, parentRigControlId: RigControlId | null }`
- `updateRigControl`: `{ rigControlId, displayName?, domainBounds?, transformColumns?, transformRows?, bezierColumns?, bezierRows?, opacityMultiplier? }`
- `createRotation2dRigControl`: existing fields plus `opacityMultiplier?`, `parentRigControlId?`, `insertBeforeChild?: { kind: "drawable" | "rigControl", id, path? }`
- `createWarpDeformer`: existing fields plus `opacityMultiplier?`, `insertBeforeChild?: { kind: "drawable" | "rigControl", id, path? }`

Read projection fields:
- Warp Deformer read model now includes `opacityMultiplier`.
- Runtime evaluated rig control DTO now includes `opacityMultiplier`.
- Runtime evaluated drawable opacity reflects static ancestor/direct deformer multipliers.

Editable fields:
- Generic: `displayName`, `opacityMultiplier`
- Warp Deformer: `domainBounds`, `transformColumns`, `transformRows`, `bezierColumns`, `bezierRows`
- Parent: use `reparentRigControl`

Main rejection / diagnostic reasons:
- Missing drawable / rig control / parent
- Duplicate child entry or duplicate drawable binding
- Parent/child mismatch
- Illegal root state
- Self-parent or cycle
- Invalid opacity multiplier
- Invalid Warp Deformer domain/division/Bezier surface
- Unsupported field on non-warp rig control
- Keyform cardinality conflict
- No-op update / no-op binding

## Changed files list

- `packages/package-format/src/model-files.ts`
- `packages/package-format/src/warp-deformer-projection.ts`
- `packages/package-format/src/warp-lattice2d-contract.test.ts`
- `packages/authoring-core/src/authoring-mutations.ts`
- `packages/authoring-core/src/rig-control-mutations.ts`
- `packages/authoring-core/src/rig-control-mutations.test.ts`
- `packages/authoring-core/src/runtime-graph-rig-controls.ts`
- `packages/operation-core/src/payloads/rig-control.ts`
- `packages/operation-core/src/operation-payload.ts`
- `packages/operation-core/src/operation-type.ts`
- `packages/operation-core/src/operation-registry.ts`
- `packages/operation-core/src/index.ts`
- `packages/operation-core/src/operation-schemas.test.ts`
- `packages/operation-core/src/operations/create-rotation2d-rig-control.ts`
- `packages/operation-core/src/operations/create-warp-deformer.ts`
- `packages/operation-core/src/operations/move-drawable-rig-control-binding.ts`
- `packages/operation-core/src/operations/reparent-rig-control.ts`
- `packages/operation-core/src/operations/update-rig-control.ts`
- `packages/operation-core/src/operations/rig-control.test.ts`
- `packages/validator-core/src/check-catalog.ts`
- `packages/validator-core/src/validators/package-schema.ts`
- `packages/validator-core/src/validators/rig-control-semantic.ts`
- `packages/validator-core/src/rig-control-semantic.test.ts`
- `packages/runtime-core/src/normalized-runtime-graph.ts`
- `packages/runtime-core/src/rig-control-evaluation.ts`
- `packages/runtime-core/src/rig-control-hierarchy-evidence.test.ts`
- `packages/ai-interface/src/ai-codex-proposal-operation-catalog.ts`
- `discussion/implementation/waves/wave63/wave63-domain-a-report.md`

## Verification performed

- PASS: `pnpm.cmd exec vitest run packages/authoring-core/src/rig-control-mutations.test.ts packages/operation-core/src/operations/rig-control.test.ts packages/operation-core/src/operation-schemas.test.ts packages/package-format/src/warp-lattice2d-contract.test.ts packages/validator-core/src/rig-control-semantic.test.ts packages/runtime-core/src/rig-control-hierarchy-evidence.test.ts` (6 files / 61 tests)
- PASS: `pnpm.cmd typecheck`
- PASS: `node scripts/check-source-organization.mjs`
- PASS: `git diff --check` over Domain A touched tracked source paths.
- PASS: whitespace check for untracked Domain A files (`packages/operation-core/src/operations/update-rig-control.ts`, this report) using `git diff --check --no-index` output filtering.
- Note: focused vitest inside sandbox failed with `spawn EPERM`; reruns with approved escalation passed.

## Residual Risk Classification

low-to-medium

- Low: rejected `updateRigControl` commits are now atomic at both authoring mutation ordering and operation commit preflight boundaries, with regression tests for invalid Warp field and keyform cardinality conflict paths.
- Low: package/authoring/operation/validator/runtime contracts are covered by focused tests and typecheck.
- Medium: Domain C still needs UI wiring and may require small DTO ergonomics adjustments after integrating drag/drop/inspector controls.
- Medium: existing workspace includes unrelated dirty/parallel files outside Domain A scope; these were not reverted or edited.
