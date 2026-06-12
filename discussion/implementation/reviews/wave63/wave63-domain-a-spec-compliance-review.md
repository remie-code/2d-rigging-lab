# Wave63 Domain A Spec Compliance Review

Review lane: Spec Compliance Review
Domain: `wave63-deformer-package-operation-management-foundation`
Review pass: Fix Loop 1 re-review
Verdict: `pass`

## Basis Reviewed

- `discussion/implementation/orchestration/wave63-plan.md`
  - Section 3 accepted decisions / oracles: lines 38-52
  - Section 5 review policy: lines 83-118
  - Section 7.1 deformer management UX AC: lines 144-169
  - Section 9 Domain A scope / capabilities / acceptance / forbidden scope: lines 213-297
  - Sections 13-15 orchestration, artifacts, out of scope: lines 500-568
- `discussion/implementation/waves/wave63/wave63-preplan-deformer-management-inventory.md`
- `discussion/design/screen-design/components/rig-tool.md`
- `discussion/design/screen-design/screens/authoring-workspace.md`
- `discussion/implementation/waves/wave63/wave63-domain-a-report.md`
- Prior review in this file, especially A-SPEC-001 on rejected `updateRigControl` atomicity.
- Actual source files listed in the Domain A report changed-files list, plus `git status` / `git diff --stat` to separate parallel Domain B/editor changes.

## Coverage Matrix

| Required capability | Classification | Evidence | Review result |
|---|---|---|---|
| Binding move / rebind: move an already-bound Drawable to another Deformer without changing Parts membership or draw order, with dry-run / commit / modelDiff | implemented | `moveDrawableRigControlBinding` validates source/target before mutation in `packages/authoring-core/src/rig-control-mutations.ts:275`; operation DTO/handler/modelDiff in `packages/operation-core/src/payloads/rig-control.ts:77` and `packages/operation-core/src/operations/move-drawable-rig-control-binding.ts:30`; operation test preserves parts/drawables/drawOrder in `packages/operation-core/src/operations/rig-control.test.ts:472` | Pass |
| Deformer reparent: move child Deformer to another parent/root; reject cycle, missing target, duplicate child, illegal root state | implemented | authoring mutation preconditions in `packages/authoring-core/src/rig-control-mutations.ts:348`; operation diagnostics in `packages/operation-core/src/operations/reparent-rig-control.ts:28`; cycle/root tests in `packages/operation-core/src/operations/rig-control.test.ts:543` | Pass |
| Insertion-safe create: insert new Rotation / Warp Deformer between existing parent Deformer and bound child Drawable / child Deformer | implemented | shared insertion mutation in `packages/authoring-core/src/rig-control-mutations.ts:469`; Rotation insertion path in `packages/operation-core/src/operations/create-rotation2d-rig-control.ts:112`; Warp insertion path in `packages/operation-core/src/operations/create-warp-deformer.ts:120`; tests for Warp drawable insertion, Rotation drawable insertion, and Warp child-rig insertion in `packages/operation-core/src/operations/rig-control.test.ts:255`, `:315`, `:385` | Pass |
| Committed Deformer update: name / displayName | implemented | payload field in `packages/operation-core/src/payloads/rig-control.ts:91`; mutation preview application in `packages/authoring-core/src/rig-control-mutations.ts:588`; modelDiff field path in `packages/operation-core/src/operations/update-rig-control.ts:170`; operation test in `packages/operation-core/src/operations/rig-control.test.ts:665` | Pass |
| Committed Deformer update: parent deformer | implemented via separate operation | `reparentRigControl` DTO in `packages/operation-core/src/payloads/rig-control.ts:85`; Domain A report explicitly hands parent editing to `reparentRigControl` | Pass; operation granularity is compatible with the basis |
| Committed Deformer update: domain bounds, Transform control point count, Bezier divisions | implemented | payload fields in `packages/operation-core/src/payloads/rig-control.ts:95`; validation/update in `packages/authoring-core/src/rig-control-mutations.ts:1028`; modelDiff in `packages/operation-core/src/operations/update-rig-control.ts:177`; tests in `packages/operation-core/src/operations/rig-control.test.ts:665` | Pass |
| Bezier edit type fixed/readonly compatibility | implemented | create payload fixes/defaults `cubicBezierSurfaceV1` in `packages/operation-core/src/payloads/rig-control.ts:66`; package read projection reports stored-not-evaluated boundary in `packages/package-format/src/warp-deformer-projection.ts:31` | Pass |
| Static opacity multiplier persistence / validation / projection / runtime evaluation, separate from parameter-driven subtree opacity | implemented | package schema in `packages/package-format/src/model-files.ts:207` and `:223`; validator mapping in `packages/validator-core/src/validators/package-schema.ts:260`; read projection in `packages/package-format/src/warp-deformer-projection.ts:68`; runtime graph/evaluation in `packages/authoring-core/src/runtime-graph-rig-controls.ts:22` and `packages/runtime-core/src/rig-control-evaluation.ts:392`; tests in `packages/package-format/src/warp-lattice2d-contract.test.ts:52` and `packages/runtime-core/src/rig-control-hierarchy-evidence.test.ts:79` | Pass |
| Duplicate binding validation: duplicate child, drawable multiple parents, parent/child mismatch | implemented | semantic validator records duplicate children and multi-parent drawables in `packages/validator-core/src/validators/rig-control-semantic.ts:77`, `:255`, `:282`; catalog entries in `packages/validator-core/src/check-catalog.ts:1444`; tests in `packages/validator-core/src/rig-control-semantic.test.ts:232` and `:268` | Pass |
| Keyform compatibility: reject Transform / Bezier cardinality changes while keyforms target the Deformer; no auto migration | implemented | cardinality conflict check in `packages/authoring-core/src/rig-control-mutations.ts:1060`; operation diagnostic in `packages/operation-core/src/operations/update-rig-control.ts:267`; operation atomicity regression in `packages/operation-core/src/operations/rig-control.test.ts:784` | Pass |
| Operation / DTO registration and Domain C handoff surface | implemented | payload union in `packages/operation-core/src/operation-payload.ts:117`; operation type list in `packages/operation-core/src/operation-type.ts:39`; registry entries in `packages/operation-core/src/operation-registry.ts:105`; public exports in `packages/operation-core/src/index.ts:50`; AI catalog entries in `packages/ai-interface/src/ai-codex-proposal-operation-catalog.ts:238`, `:468`, `:561`; Domain A report handoff section | Pass |
| Editor UI wiring, DnD handlers, inspector controls, read projection consumption in `apps/editor/**` | deferred by plan | Domain A forbidden scope in `wave63-plan.md:281`; Domain C owns editor UX in `wave63-plan.md:381`; Domain A report defers editor UI | Correctly deferred, not a Domain A gap |
| Parameter / Keyform authoring UI, Parameter Manager, subtree opacity keyforms | explicit non-goal | Out of scope in `wave63-plan.md:564`; Rig Tool basis separates static opacity from parameter-driven subtree opacity | Not required for Domain A |

## Plan-vs-Basis Delta

- No source conflict found between the accepted UX basis and Domain A's operation granularity. The basis requires parent deformer editing; Domain A implements that through `reparentRigControl` instead of overloading `updateRigControl`, and the handoff document makes this explicit.
- Domain A implements package/operation/validator/runtime foundations only. UI acceptance items from `wave63-plan.md:156-169` and `rig-tool.md` remain Domain C scope and are not counted as hidden pass evidence.
- Static opacity multiplier moved from preplan "decision needed" into Domain A implementation, matching the final Wave63 plan lines 254-258.
- Bezier runtime deformation and parameter-driven subtree opacity are not implemented or claimed, matching Domain A forbidden/out-of-scope rules.
- Artifact filename drift remains: the plan expected a longer Domain A report filename, while the parent task and workspace use `discussion/implementation/waves/wave63/wave63-domain-a-report.md`. This is process/documentation drift, not a spec compliance blocker for this lane.
- `git status` shows parallel Domain B/editor changes outside the Domain A report changed-files list. They were not used as Domain A pass evidence.

## Operation / DTO / Read Projection / Rejection Coverage

Operation and DTO coverage:

- `moveDrawableRigControlBinding`: DTO `{ drawableId, targetRigControlId }`; dry-run / commit handler; modelDiff changes only source and target `childDrawableIds`.
- `reparentRigControl`: DTO `{ childRigControlId, parentRigControlId: RigControlId | null }`; modelDiff covers child `parentId`, previous/new parent `childRigControlIds`, and root membership when moved to root.
- `updateRigControl`: DTO covers `displayName`, `domainBounds`, `transformColumns`, `transformRows`, `bezierColumns`, `bezierRows`, `opacityMultiplier`; commit preflights on a dry-run session before live mutation.
- `createRotation2dRigControl` and `createWarpDeformer`: DTOs include `opacityMultiplier`, `parentRigControlId`, and `insertBeforeChild`; insertion uses the shared authoring mutation.

Read projection coverage:

- `projectWarpDeformerReadModel` exposes `opacityMultiplier` and defaults legacy missing values to `1`.
- Runtime evaluated rig control DTO includes `opacityMultiplier`.
- Runtime descendant drawable opacity multiplies enabled, non-blocked rig-control ancestor multipliers.
- Editor consumption of these projections remains Domain C scope.

Rejection coverage:

- Covered rejections include missing drawable / rig control / parent, missing insertion child binding, duplicate binding, parent-child mismatch, illegal root state, self-parent/cycle, invalid opacity multiplier, invalid Warp domain/division/Bezier surface, unsupported non-warp update fields, keyform cardinality conflict, and no-op cases.
- Fix Loop 1 specifically covers rejected `updateRigControl` commit atomicity for generic fields combined with invalid Warp fields and generic fields combined with keyform cardinality conflicts.

## Negative Compliance

Confirmed within Domain A reviewed scope:

- No `apps/editor/**` file is counted as Domain A implementation evidence.
- No Mesh auto-outline algorithm work is counted as Domain A evidence.
- No dependency addition was observed in the Domain A target list.
- No Cubism compatibility/import/export/load claim is made.
- No Bezier runtime deformation claim is made.
- No Parameter Manager, parameter/keyform authoring UI, or subtree opacity keyform feature is implemented or claimed in Domain A.
- Binding/reparent/insertion tests explicitly preserve Parts membership, drawables, and draw order where the Domain A spec requires it.

## Prior Finding Resolution

### A-SPEC-001: `updateRigControl` rejected commits can partially mutate the live session

Status: resolved

Resolution evidence:

- Authoring mutation now builds `previewRigControlAfter`, applies generic and Warp field changes to that preview, checks no-op, and only then assigns back to the live rig control in `packages/authoring-core/src/rig-control-mutations.ts:588-609`.
- Warp field validation and keyform cardinality rejection occur before the live assignment in `packages/authoring-core/src/rig-control-mutations.ts:1028-1078`.
- Operation commit now runs `applyUpdateRigControl(createDryRunAuthoringSession(session), ..., "committed")` as a preflight and returns the rejected preflight result without touching the live session when preflight fails in `packages/operation-core/src/operations/update-rig-control.ts:36-47`.
- Regression tests prove invalid domain bounds and keyform cardinality conflict leave the rig control, package revision, authoring revision, dirty flag, and operation log length unchanged in `packages/operation-core/src/operations/rig-control.test.ts:743-843`.

## Verification Performed

- PASS: `pnpm.cmd exec vitest run packages/authoring-core/src/rig-control-mutations.test.ts packages/operation-core/src/operations/rig-control.test.ts packages/operation-core/src/operation-schemas.test.ts packages/package-format/src/warp-lattice2d-contract.test.ts packages/validator-core/src/rig-control-semantic.test.ts packages/runtime-core/src/rig-control-hierarchy-evidence.test.ts`
  - Sandbox run failed with `spawn EPERM`; approved escalation rerun passed: 6 files / 61 tests.
- PASS: `pnpm.cmd typecheck`
- PASS: `node scripts/check-source-organization.mjs`
- PASS: `git diff --check` over tracked Domain A target files; output contained only CRLF conversion warnings.
- PASS: trailing-whitespace scan for untracked Domain A operation files, Domain A report, and this updated review file.

## Residual Risk Classification

low

- Low: `updateRigControl` rejected commit atomicity is now covered at authoring preview and operation dry-run preflight boundaries.
- Low: package/schema/operation/validator/runtime surfaces have focused tests and typecheck coverage.
- Low-to-medium integration risk remains for Domain C UI wiring and possible DTO ergonomics adjustments, but no Domain A spec blocker is present.
- Low process risk: report filename drift and parallel workspace changes may complicate integration bookkeeping but do not affect this Domain A spec verdict.

## Verdict

`pass`

Domain A now satisfies the package / operation / validator / runtime foundation required by the Wave63 plan and primary UX basis. The prior atomicity finding is resolved, deferred UI work is explicitly Domain C scope, and no unresolved Spec Compliance finding remains for this lane.
