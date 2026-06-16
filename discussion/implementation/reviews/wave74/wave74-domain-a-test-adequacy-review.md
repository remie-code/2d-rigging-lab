# Wave74 Domain A Test Adequacy Review

- Verdict: `pass`
- Date: 2026-06-15
- Reviewer: Review-Sylph
- Target: Wave74 Domain A, `wave74-deformer-foundation-fixes`
- Lane: Test Adequacy Review

## Basis Reviewed

- `discussion/implementation/orchestration/wave74-plan.md`
- `discussion/implementation/orchestration/wave73-plan.md`
- `discussion/implementation/waves/wave73/wave73-final-integration-report.md`
- `discussion/implementation/reviews/wave73/wave73-final-clean-integration-review.md`
- `discussion/implementation/waves/wave73/wave73-domain-b-rotation2d-translation-exposure-report.md`
- `discussion/development_convention/ux-backed-package-logic-authority.md`
- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/development_convention/dependency-policy.md`
- `discussion/development_convention/operation-policy.md`
- `discussion/development_convention/schema-and-id-conventions.md`
- `discussion/design/screen-design/components/rig-tool.md`
- `discussion/design/screen-design/components/canvas-preview.md`
- `discussion/implementation/waves/wave74/wave74-domain-a-deformer-foundation-fixes-report.md`
- Domain A source and tests listed in the assignment.

## Findings

No blocking findings.

No needs-change findings.

## Requirement Coverage

| Domain A requirement | Review result | Evidence |
|---|---|---|
| Warp creation with committed mesh vertices outside layer bounds includes all mesh vertices plus deterministic margin | Adequate | Implementation uses `WARP_DEFORMER_DOMAIN_MARGIN = 1` and resolves Warp draft bounds from committed mesh vertices before falling back to mesh bounds or canvas bounds at `apps/editor/src/features/editor-session/model/rig-tool-state.ts:23`, `apps/editor/src/features/editor-session/model/rig-tool-state.ts:190`, and `apps/editor/src/features/editor-session/model/rig-tool-state.ts:827`. Test mutates committed mesh vertices outside the original layer rectangle, expects `{ x: 5, y: 17, width: 42, height: 48 }`, and commits the draft payload through create-Warp flow at `apps/editor/src/features/editor-session/model/rig-tool-state.test.ts:91`. |
| Warp fit/reset uses mesh vertex bounds with committed mesh and fallback bounds without mesh | Adequate | Fit/reset route through child-bound resolution at `apps/editor/src/features/editor-session/model/rig-tool-state.ts:355`, `apps/editor/src/features/editor-session/model/rig-tool-state.ts:364`, and `apps/editor/src/features/editor-session/model/rig-tool-state.ts:588`. Test checks mesh-vertex bounds for fit/reset, reset of transform grid defaults, and no-mesh fallback to existing canvas bounds at `apps/editor/src/features/editor-session/model/rig-tool-state.test.ts:112`. |
| Canvas/evaluation proves outside-layer mesh vertices deform with lattice | Adequate | Canvas test puts committed mesh vertices at `x=-4` and `x=104`, gives the Warp domain the mesh-vertex envelope, samples a Warp offset keyform, and asserts evaluated outside vertices and drawable bounds move at `apps/editor/src/workspace/canvas/canvas-evaluation.test.ts:265`. This proves the corrected domain is not leaving outside-layer committed vertices effectively unwarped. |
| Rotation translation rest fallback, exact keyed value, midpoint x/y linear interpolation | Adequate | Generic Vec2 interpolation exact and midpoint behavior is pinned at `packages/runtime-core/src/keyform-linear1d-interpolation.test.ts:32`. Runtime evidence covers rest fallback, interpolated midpoint `{ x: 3, y: -1 }`, and exact keyed `{ x: 8, y: -6 }` at `packages/runtime-core/src/rig-control-keyform-evidence.test.ts:189`. Canvas evaluation also covers rest, exact, midpoint, and parent-child composition at `apps/editor/src/workspace/canvas/canvas-evaluation.test.ts:325`. |
| After-load/evaluation for translation if practical | Adequate | Portable bundle test imports the saved session, converts it to a runtime graph, evaluates midpoint `param_angle_x = 0`, and asserts imported `keyset_rotate_translation_x` samples `{ x: 2, y: -1.5 }` and applies it to `rig_head_rotate.localTransform.translation` at `packages/authoring-core/src/portable-project-bundle.test.ts:202`. |
| Regression evidence for angle/opacity interpolation and Wave73 rotation translation editing | Adequate | Existing and focused tests remain in the reported suite: canvas angle/opacity keyforms at `apps/editor/src/workspace/canvas/canvas-evaluation.test.ts:300`; parameter binding angle/translation/opacity projection and edit payload coverage at `apps/editor/src/features/editor-session/model/parameter-keyform-state.test.ts:90`; operation-level rest translation and keyform editing coverage at `packages/operation-core/src/operations/rig-control.test.ts:743` and `packages/operation-core/src/operations/edit-keyform-key.test.ts:304`. |

## Test Design Assessment

The test set is not only checking private helper outputs. The Warp creation test verifies the draft and committed payload result, the fit/reset test exercises public editor-session model functions, and the Canvas test verifies evaluated drawable geometry rather than implementation internals.

Rotation translation is covered at multiple layers: the generic `linear-1d-v1` interpolation primitive, runtime evidence/snapshot behavior, Canvas evaluation, and portable save/load after-load evaluation. That layering is appropriate because Domain A reports no production runtime code change was needed for translation; the main gap was missing regression evidence.

The fixed `1px` margin assertion is intentionally specific and acceptable because Wave74 requires a deterministic margin. The fallback test is also appropriate because current no-mesh behavior is the existing canvas-bound fallback.

## Commands Run By This Review

| Command | Outcome |
|---|---|
| `pnpm.cmd exec vitest run apps/editor/src/features/editor-session/model/rig-tool-state.test.ts apps/editor/src/workspace/canvas/canvas-evaluation.test.ts packages/runtime-core/src/keyform-linear1d-interpolation.test.ts packages/runtime-core/src/rig-control-keyform-evidence.test.ts packages/authoring-core/src/portable-project-bundle.test.ts apps/editor/src/features/editor-session/model/parameter-keyform-state.test.ts` | Not rerun successfully in this review environment. Vitest failed during config startup with esbuild `spawn EPERM` before tests executed. Escalated rerun was not used after approval review rejected it because the assignment explicitly said to report sandbox EPERM rather than work around policy. |
| `pnpm.cmd typecheck` | Passed. |
| `node scripts/check-source-organization.mjs` | Passed. |
| `node scripts/check-dependencies.mjs` | Passed. |
| `git diff --check -- apps/editor/src/features/editor-session/model/rig-tool-state.ts apps/editor/src/features/editor-session/model/rig-tool-state.test.ts apps/editor/src/workspace/canvas/canvas-evaluation.test.ts packages/runtime-core/src/keyform-linear1d-interpolation.test.ts packages/runtime-core/src/rig-control-keyform-evidence.test.ts packages/authoring-core/src/portable-project-bundle.test.ts discussion/implementation/waves/wave74/wave74-domain-a-deformer-foundation-fixes-report.md` | Exit 0. CRLF normalization warnings only. |

Gnome reported the same focused Vitest command failed in sandbox with esbuild `spawn EPERM` and then passed under approved escalation: 6 files / 36 tests. Gnome also reported the focused operation/authoring regression command passed: 5 files / 39 tests. This review could not independently rerun Vitest because of the same sandbox startup block.

## Worktree / Verification Reliability Notes

- The worktree includes parallel dirty Domain B and map changes, including `apps/editor/e2e/portable-project-save-load.e2e.spec.ts`, `apps/editor/src/workspace/panels/deformer-tree-view.tsx`, `apps/editor/src/workspace/panels/parameter-binding-section.tsx`, `apps/editor/src/workspace/panels/parameter-binding-section.test.ts`, and implementation maps. These were not edited by this review.
- Static verification ran against the combined dirty worktree and passed.
- The inability to rerun Vitest in sandbox is a verification reliability limitation, not a source/test adequacy finding.

## Residual Risks

- Browser-level proof for the exact Warp creation UI path is absent in Domain A. This is acceptable for Domain A because the corrected behavior is model/runtime deterministic and is covered by editor model tests plus Canvas evaluation tests; broader browser save/load visibility proof is Domain B/C scope in the Wave74 plan.
- The outside-layer Canvas Warp test uses a uniform lattice offset. It proves outside committed vertices are not skipped/unwarped, but it is not a richer non-uniform interpolation-shape oracle. This is acceptable for the stated Domain A requirement.
- Fit/reset coverage directly exercises drawable child bounds and no-mesh fallback. Mixed child deformer union behavior is supported by the implementation path but less directly asserted; no current requirement makes this blocking.

## User-Decision Points

None.

## Final Recommendation

`pass`.

Domain A has adequate focused test evidence for Warp mesh-bounds domain behavior, Rotation translation interpolation, after-load runtime evaluation, and relevant Wave73 regressions. Treat the sandbox Vitest `EPERM` as an execution-environment limitation for this review lane and rely on Gnome's reported escalated Vitest pass until final integration can rerun tests in an approved environment.
