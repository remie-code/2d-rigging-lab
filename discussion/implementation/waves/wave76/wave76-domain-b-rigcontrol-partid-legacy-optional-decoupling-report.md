# Wave76 Domain B RigControl partId Legacy Optional Decoupling Report

## Verdict

pass

Implementation result: `done`. Independent review gate: `pass` with no fix loop required.

Wave76 Domain B `wave76-rigcontrol-partid-legacy-optional-decoupling` を実装した。`RigControl.partId` は package/schema と legacy payload では optional metadata として受け入れ、新規 RigControl 作成・authoring precondition・operation evidence・editor create flow・AI catalog から Parts Container 所有前提を外した。

## Basis Documents Used

- `discussion/implementation/orchestration/wave76-plan.md`
  - sections 3.2, 7.2, 10, 15, 17, 18, 19
- `discussion/implementation/orchestration/wave75-plan.md`
- `discussion/implementation/waves/wave75/wave75-final-integration-report.md`
- `discussion/implementation/reviews/wave75/wave75-final-clean-integration-review.md`
- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/development_convention/ux-backed-package-logic-authority.md`
- `discussion/development_convention/dependency-policy.md`
- `discussion/development_convention/operation-policy.md`
- `discussion/development_convention/schema-and-id-conventions.md`

## Changed Files

- `packages/package-format/src/model-files.ts`
- `packages/package-format/src/warp-deformer-projection.ts`
- `packages/package-format/src/rig-control-contract.test.ts`
- `packages/package-format/src/portable-package-bundle.test.ts`
- `packages/authoring-core/src/rig-control-mutations.ts`
- `packages/authoring-core/src/rig-control-mutations.test.ts`
- `packages/authoring-core/src/part-mutations.ts`
- `packages/authoring-core/src/part-mutations.test.ts`
- `packages/authoring-core/src/runtime-graph-adapter.test.ts`
- `packages/authoring-core/src/portable-project-bundle.test.ts`
- `packages/operation-core/src/payloads/rig-control.ts`
- `packages/operation-core/src/operations/create-rotation2d-rig-control.ts`
- `packages/operation-core/src/operations/create-warp-lattice2d-rig-control.ts`
- `packages/operation-core/src/operations/create-warp-deformer.ts`
- `packages/operation-core/src/operations/delete-part.ts`
- `packages/operation-core/src/operations/rig-control.test.ts`
- `packages/operation-core/src/operations/part-operations.test.ts`
- `packages/operation-core/src/operation-schemas.test.ts`
- `packages/validator-core/src/validators/part-delete-blockers.ts`
- `packages/validator-core/src/part-texture-layer-diagnostics.test.ts`
- `packages/ai-interface/src/ai-codex-proposal-operation-catalog.ts`
- `packages/ai-interface/src/ai-codex-proposal-validation.test.ts`
- `apps/editor/src/features/editor-session/model/rig-tool-state.ts`
- `apps/editor/src/features/editor-session/model/rig-tool-state.test.ts`
- `apps/editor/src/workspace/panels/rig-tool-inspector.test.ts`
- `discussion/implementation/waves/wave76/_map.md`
- `discussion/implementation/waves/wave76/wave76-domain-b-rigcontrol-partid-legacy-optional-decoupling-report.md`

## Requirement Trace / Basis Coverage Self-Report

| Requirement | Status | Evidence |
|---|---|---|
| `rotation2d` / `warpLattice2d` schemas load with and without `partId` | covered | `RigControlSchema` now has optional `partId`; `rig-control-contract.test.ts` covers both forms. |
| New Rotation/Warp Deformer operation payloads do not require `partId` | covered | `CreateRotation2dRigControlPayloadSchema`, `CreateWarpLattice2dRigControlPayloadSchema`, and `CreateWarpDeformerPayloadSchema` accept optional `partId`; `operation-schemas.test.ts` samples omit it. |
| Newly created RigControls omit `partId` | covered | Create handlers no longer set `partId`; authoring and operation tests assert no `partId` on new RigControls. |
| Authoring preconditions no longer require RigControl part existence | covered | `createRotation2dRigControl`, `createWarpLattice2dRigControl`, and `insertRigControlBetweenParentAndChild` no longer call Part existence checks. |
| Operation target refs / targetIds / diagnostics do not include Part solely for rig creation | covered | Create operation handlers no longer add Part target refs/targetIds or missing-Part diagnostics; `rig-control.test.ts` covers new and legacy payloads. |
| Operation ID generation remains display-name based | covered | No operation ID changes; `operation-ids.ts` already uses displayName for create rig operations. |
| Runtime/deformation evaluation works for no-`partId` RigControls | covered | `runtime-graph-adapter.test.ts` and `portable-project-bundle.test.ts` cover no-`partId` RigControls through runtime graph/evaluation paths. |
| Validator/Part delete blockers do not block on legacy `rigControl.partId` alone | covered | Authoring delete, operation delete, and validator blockers now ignore legacy `rigControl.partId`; tests cover legacy-only acceptance and real child/drawable/mask blockers. |
| Editor create flows stop sending `partId` | covered | `rig-tool-state.ts` no longer includes `partId` in draft-derived Rotation/Warp create payloads; tests assert payloads omit it. |
| Editor read models/inspector do not present RigControl as Parts Container-owned | covered | Rig tool read models no longer include `partId`; inspector test fixtures were updated. Drawable target options still show Drawable's Part label only. |
| Portable save/load round-trips legacy and no-`partId` RigControls | covered | `portable-package-bundle.test.ts` and `portable-project-bundle.test.ts` round-trip legacy and current RigControls. |
| AI operation catalog no longer lists `partId` required for create rig operations | covered | Catalog targetKinds/requiredInputs updated; `ai-codex-proposal-validation.test.ts` asserts no `payload.partId` and no Part target kind. |

## Tests And Commands

- `pnpm.cmd exec vitest run packages/package-format/src/rig-control-contract.test.ts packages/package-format/src/portable-package-bundle.test.ts packages/authoring-core/src/rig-control-mutations.test.ts packages/authoring-core/src/part-mutations.test.ts packages/authoring-core/src/runtime-graph-adapter.test.ts packages/authoring-core/src/portable-project-bundle.test.ts packages/operation-core/src/operation-schemas.test.ts packages/operation-core/src/operations/rig-control.test.ts packages/operation-core/src/operations/part-operations.test.ts packages/validator-core/src/part-texture-layer-diagnostics.test.ts apps/editor/src/features/editor-session/model/rig-tool-state.test.ts apps/editor/src/workspace/panels/rig-tool-inspector.test.ts packages/ai-interface/src/ai-codex-proposal-validation.test.ts`
  - first sandbox attempt failed before tests with Vite/esbuild `spawn EPERM`
  - rerun with approval passed: 13 files, 96 tests
- `pnpm.cmd typecheck`
  - passed
- `node scripts/check-source-organization.mjs`
  - passed
- `node scripts/check-dependencies.mjs`
  - passed
- `git diff --check -- packages/package-format packages/authoring-core packages/operation-core packages/validator-core packages/ai-interface apps/editor/src/features/editor-session/model/rig-tool-state.ts apps/editor/src/workspace/panels/rig-tool-inspector.tsx discussion/implementation/waves/wave76`
  - passed; Git emitted existing LF-to-CRLF working-copy warnings only
- `rg -n "[ \t]$" discussion/implementation/waves/wave76/_map.md discussion/implementation/waves/wave76/wave76-domain-b-rigcontrol-partid-legacy-optional-decoupling-report.md packages/package-format/src/rig-control-contract.test.ts`
  - passed; no trailing whitespace matches

## Review Gate

| Review | Result | Artifact |
|---|---|---|
| Spec Compliance | pass | [../../reviews/wave76/wave76-domain-b-spec-compliance-review.md](../../reviews/wave76/wave76-domain-b-spec-compliance-review.md) |
| Design / Development Compliance | pass | [../../reviews/wave76/wave76-domain-b-design-development-review.md](../../reviews/wave76/wave76-domain-b-design-development-review.md) |
| Test Adequacy | pass | [../../reviews/wave76/wave76-domain-b-test-adequacy-review.md](../../reviews/wave76/wave76-domain-b-test-adequacy-review.md) |

Review outcome: no blocking or needs-change findings. Dependent Domain E is ready from the `partId` decoupling perspective.

## Residual Risks

- Full repository test suite, e2e, and a11y were not run; focused coverage plus root typecheck passed.
- Workspace contains unrelated dirty changes from Wave76 plan/map updates and parallel Domain A/C work. This Domain B report only claims the files listed above.
- `AuthoringMutationError` still contains the historical `part_has_rig_controls` code for compatibility with broader error unions; no current Part delete guard emits it for legacy RigControl metadata.

## User-Decision Points

- None.

## Reviewer Focus Areas

- Confirm the compatibility stance: schemas and legacy create payloads accept `partId`, but operation-created RigControls intentionally omit it and do not target Part refs.
- Confirm Part delete semantics: legacy `rigControl.partId` alone no longer blocks deletion, while child Part, Drawable ownership, and mask relation blockers remain intact.
- Confirm editor scope: Drawable/Part labels remain for Drawable target selection, but RigControl read/create flows no longer model Parts Container ownership.
