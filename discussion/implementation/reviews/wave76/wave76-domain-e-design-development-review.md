# Wave76 Domain E Design / Development Compliance Review

- Verdict: `pass`
- Lane: Design / Development Compliance
- Target: `wave76-rig-batch-create-unbound-drawables`
- Date: 2026-06-16
- Reviewer: Review-Sylph

## Basis Reviewed

- `discussion/implementation/orchestration/wave76-plan.md`, especially sections 3.5, 7.5, 13, 15, 17, 18, and 19.
- `discussion/implementation/waves/wave76/wave76-domain-e-rig-batch-create-unbound-drawables-report.md`
- Dependency domain reports:
  - `discussion/implementation/waves/wave76/wave76-domain-b-rigcontrol-partid-legacy-optional-decoupling-report.md`
  - `discussion/implementation/waves/wave76/wave76-domain-c-drawable-multiselect-parts-tree-select-inspector-report.md`
  - `discussion/implementation/waves/wave76/wave76-domain-d-mesh-target-simplification-multi-preview-apply-report.md`
- Wave75 baseline:
  - `discussion/implementation/orchestration/wave75-plan.md`
  - `discussion/implementation/waves/wave75/wave75-final-integration-report.md`
  - `discussion/implementation/reviews/wave75/wave75-final-clean-integration-review.md`
- Policies:
  - `discussion/development_convention/source-file-organization-policy.md`
  - `discussion/development_convention/ux-backed-package-logic-authority.md`
  - `discussion/development_convention/dependency-policy.md`
  - `discussion/development_convention/operation-policy.md`

## Scope Reviewed

Directly inspected source and test files:

- `apps/editor/src/features/editor-session/model/rig-tool-state.ts`
- `apps/editor/src/features/editor-session/model/rig-tool-state.test.ts`
- `apps/editor/src/workspace/panels/rig-tool-inspector.tsx`
- `apps/editor/src/workspace/panels/rig-tool-inspector.test.ts`
- `apps/editor/src/features/editor-session/editor-session-context.tsx`
- `apps/editor/e2e/psd-import.e2e.spec.ts`

Additional dependency and boundary checks:

- Domain B package contract sources:
  - `packages/operation-core/src/payloads/rig-control.ts`
  - `packages/operation-core/src/operations/create-rotation2d-rig-control.ts`
  - `packages/operation-core/src/operations/create-warp-deformer.ts`
  - `packages/package-format/src/model-files.ts`
- Package manifests and lockfile paths via `git diff --name-only`.

The worktree is dirty from Wave76 Domains A/B/C/D/E and review/map artifacts. This review only attributes the Domain E behavior to the files listed in the Domain E report and the source files inspected above.

## Findings

No blocking findings.

No needs-change findings.

## Development / Design Compliance Notes

### Architecture And Source Organization

- Batch Rig model logic is in the editor-session model layer, not embedded in the React component. `createRigBatchDrawableTargets` centralizes selected Drawable projection, duplicate suppression, missing-id tolerance, and bound/eligible classification at `apps/editor/src/features/editor-session/model/rig-tool-state.ts:236`.
- Batch Rotation and Warp payload helpers are model helpers at `rig-tool-state.ts:267` and `:293`. They build payloads from eligible targets only and leave UI rendering to `rig-tool-inspector.tsx`.
- Editor context owns the user-command boundary. Batch creates are exposed as context actions at `apps/editor/src/features/editor-session/editor-session-context.tsx:1101` and `:1130`, and both call `applyRigCommand`, which routes through `runCommandWithHistory` at `editor-session-context.tsx:684`.
- The actual mutation path remains the existing Rig operation commit path: `commitCreateRotationDeformer` at `editor-session-context.tsx:1112` and `commitCreateWarpDeformer` at `:1141`. This satisfies the Operation Policy expectation that GUI package mutations route through Operation Core / established commit helpers.
- UI concerns are isolated in `RigBatchTargetStart` at `apps/editor/src/workspace/panels/rig-tool-inspector.tsx:187`; the top-level inspector only selects this view for `selection.kind === "drawableSet"` at `:121`.
- Source organization is acceptable for this domain. Domain E adds cohesive helpers to an existing Rig Tool model file, context callbacks to the existing editor provider, and a focused inspector subcomponent. No new `index.ts`, broad catch-all file, manifest, lockfile, package schema, or new dependency was introduced.

### `partId` Decoupling

- Domain B's package contract dependency is present: create payload schemas still accept legacy `partId` as optional metadata, not required input, in `packages/operation-core/src/payloads/rig-control.ts:24`, `:39`, and `:54`.
- Operation create handlers construct new Rotation/Warp RigControls without writing `partId`: `createPackageRotation2dRigControl` returns no `partId` at `packages/operation-core/src/operations/create-rotation2d-rig-control.ts:213`, and `createPackageWarpDeformerRigControl` returns no `partId` at `packages/operation-core/src/operations/create-warp-deformer.ts:220`.
- Package-format compatibility keeps legacy `partId` optional for Rotation and Warp RigControls at `packages/package-format/src/model-files.ts:212` and `:228`.
- Domain E editor payload helpers do not add `partId`. The batch Rotation return at `apps/editor/src/features/editor-session/model/rig-tool-state.ts:280` and batch Warp return through `createWarpDeformerPayloadFromDraft` at `:311` omit `partId`; the test assertions cover both payloads and committed RigControls at `apps/editor/src/features/editor-session/model/rig-tool-state.test.ts:251`, `:278`, `:294`, `:316`, and `:332`.
- Residual Part labels in `rig-tool-state.ts:549` and `:861` are display/target-pool context for Drawables, not RigControl ownership assumptions. I found no reintroduced `partId` dependency in the new batch create flow.

### Batch Root-Create Semantics

- Eligibility follows the plan: `findDrawableRigControlParentId` classifies a Drawable as already bound if any RigControl lists it in `childDrawableIds` at `apps/editor/src/features/editor-session/model/rig-tool-state.ts:1019`.
- `createRigBatchDrawableTargets` marks bound Drawables as `alreadyBound` and eligible Drawables as `eligible` at `rig-tool-state.ts:254`. Mixed selections are therefore explicit instead of hidden in UI state.
- Batch Rotation create uses only eligible targets, computes a union-bounds pivot, and returns no `parentRigControlId` or `insertBeforeChild` fields at `rig-tool-state.ts:271` through `:290`.
- Batch Warp create uses only eligible targets, computes union warp-domain bounds, and delegates to the existing Warp payload normalizer with no parent/insert fields supplied at `rig-tool-state.ts:297` through `:320`.
- Tests directly cover the root-create contract:
  - mixed bound/unbound selection excludes the bound Drawable and disables all-bound creates at `apps/editor/src/features/editor-session/model/rig-tool-state.test.ts:225` through `:260`;
  - batch Rotation creates one root RigControl with both child Drawables and no `partId` at `:263` through `:296`;
  - batch Warp creates one root RigControl with both child Drawables and no `partId` at `:298` through `:334`.
- This does not encode selected-bound-child wrap behavior, fake/common Parts Container ownership, Deformer Tree multi-select, or mixed parented/unparented wrapper semantics. Those items are explicitly out of scope in the Wave76 plan.

### Existing Single Drawable And Parent Deformer Routes

- Single selected Drawable behavior remains separate from batch behavior. The single start UI still renders `WarpDeformerSingleTargetStart` for `selection.kind === "drawable"` at `apps/editor/src/workspace/panels/rig-tool-inspector.tsx:111`.
- Single Warp draft creation still computes `parentRigControlId` and `insertBeforeChild` when the Drawable is already bound at `apps/editor/src/features/editor-session/model/rig-tool-state.ts:169` through `:199`.
- Single Rotation create still computes `parentRigControlId` and `insertBeforeChild` when the Drawable is already bound at `rig-tool-state.ts:202` through `:233`.
- Existing single-bound insertion tests remain present at `apps/editor/src/features/editor-session/model/rig-tool-state.test.ts:163` through `:208`.
- Parent Deformer creation routes for selected RigControls still use the parent payload helpers and preserve insertion semantics for child RigControls at `rig-tool-state.ts:324` and `:358`; regression coverage remains at `rig-tool-state.test.ts:384` through `:410`.

### Domain D Mesh Shared Context

- Domain E did not overwrite Domain D's Mesh batch/shared context design. `meshDrafts` remains the provider state and `meshDraft` remains the compatibility value in `apps/editor/src/features/editor-session/editor-session-context.tsx:386`.
- Mesh batch apply still rechecks `isMeshGenerationEligible` for `batchEligible` drafts at `editor-session-context.tsx:960` through `:966`, preserving Domain D's no-overwrite behavior.
- Rig create actions clear transient Mesh drafts before committing at `editor-session-context.tsx:1109` and `:1138`, matching existing transient-state cleanup behavior and avoiding stale Mesh previews after switching to Rig creation.
- The Domain D report's accepted model/context/UI split remains intact; no Mesh generation algorithm, batch overwrite route, package-format change, or renderer redesign was introduced by Domain E.

### UI Design

- The batch start view lists selected Drawable names with stable rows and status labels at `apps/editor/src/workspace/panels/rig-tool-inspector.tsx:210` through `:235`.
- The warning for already-bound Drawables is visible and names excluded Drawables at `rig-tool-inspector.tsx:237` through `:244`.
- Create buttons derive disabled state from `eligibleTargets.length > 0` at `rig-tool-inspector.tsx:196` and apply that state at `:254` and `:268`.
- The UI uses the existing inspector panel style: compact section, existing icon set, full-width buttons, small labels, truncation for target names, and no nested cards.
- Component tests prove mixed bound/unbound rendering, warning display, create-button enabled state, all-bound disabled state, and absence of a `Wrap` control at `apps/editor/src/workspace/panels/rig-tool-inspector.test.ts:132` through `:185`.
- The focused PSD E2E path proves the user-facing flow reaches Rig Tool from Drawable multi-select, creates a batch Rotation Deformer, observes committed two-child overlay state, then reselects bound Drawables and sees warning/disabled/no-wrap UI at `apps/editor/e2e/psd-import.e2e.spec.ts:213` through `:236`.

## Verification Reviewed / Performed

Performed in this review:

| Command / check | Result |
|---|---|
| `node scripts/check-source-organization.mjs` | Passed. |
| `node scripts/check-dependencies.mjs` | Passed. |
| `git diff --check -- <Domain E touched files>` | Exit 0; only LF-to-CRLF working-copy warnings. |
| `git diff --name-only HEAD -- package.json pnpm-lock.yaml apps/editor/package.json packages/*/package.json` | No manifest or lockfile output for the reviewed manifest set. |
| `rg -n "partId"` over the Domain E editor files | No new batch create `partId` write path found; remaining matches are Part APIs/display lookup or Domain B optional package compatibility. |
| `rg -n "commitCreateRotationDeformer|commitCreateWarpDeformer|commitGenerateMesh"` over context/model/UI | Batch Rig mutations route through existing commit helpers; Mesh batch apply remains in place. |

Reviewed from the Domain E report and source:

- Focused Vitest command reportedly passed after escalation: `rig-tool-state.test.ts` and `rig-tool-inspector.test.ts`, 2 files / 14 tests.
- `editor-session-context-history.test.ts` reportedly passed after escalation, 1 file / 10 tests.
- `pnpm.cmd typecheck` reportedly passed.
- Focused `psd-import` Playwright command reportedly passed after escalation and ran the full PSD import spec, 11 tests.
- The Domain E report records `node scripts/check-source-organization.mjs`, `node scripts/check-dependencies.mjs`, and scoped `git diff --check` as passed.

I did not rerun Vitest, Playwright, or broad typecheck in this review. The compliance decision is based on direct source/test inspection, the policy guard checks performed above, and the implementation report's focused validation record.

## Residual Risks / Non-Blockers

- Batch Warp create is covered by model/operation commit tests, but the focused browser assertion exercises batch Rotation create only. This matches the implementer report's residual risk and is acceptable for this design/development lane; final integration can choose whether a browser Warp smoke is worth the additional cost.
- The bound warning lists Drawable names but not the owning RigControl names. The Wave76 plan requires warning/exclusion, not parent attribution, so this is non-blocking.
- Batch Rig eligibility is computed in editor model/context helpers before the commit helper is called. The current UI is synchronous and tests cover the accepted path, but if future async or multi-actor command surfaces are added, final design should consider an apply-time eligibility recheck similar to Domain D's Mesh batch guard.
- The shared worktree contains parallel-domain package/WebGL/Mesh/selection changes and review artifacts. Final integration must re-check the combined Wave76 state before treating this Domain E pass as whole-wave pass.

## User Decision Points

None.

## Final Gate Recommendation

pass
