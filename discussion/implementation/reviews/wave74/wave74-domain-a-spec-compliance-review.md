# Wave74 Domain A Spec Compliance Review

- Verdict: `pass`
- Date: 2026-06-15
- Reviewer: Review-Sylph
- Target: Wave74 Domain A `wave74-deformer-foundation-fixes`
- Lane: Spec Compliance Review

## Findings

No needs-change findings.

Domain A satisfies the in-scope Wave74 deformation foundation requirements for Warp domain mesh-bounds behavior and Rotation `translation` Vec2 interpolation evidence. Items assigned to Domain B/C, especially save/load keyform discovery UI and final combined e2e visibility proof, are not counted as Domain A omissions.

## Review Basis

Read and checked:

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
- Domain A source/test diffs and relevant runtime/editor evaluation source.

## Worktree Classification

Domain A reviewed source/test files:

- `apps/editor/src/features/editor-session/model/rig-tool-state.ts`
- `apps/editor/src/features/editor-session/model/rig-tool-state.test.ts`
- `apps/editor/src/workspace/canvas/canvas-evaluation.test.ts`
- `packages/runtime-core/src/keyform-linear1d-interpolation.test.ts`
- `packages/runtime-core/src/rig-control-keyform-evidence.test.ts`
- `packages/authoring-core/src/portable-project-bundle.test.ts`
- `discussion/implementation/waves/wave74/wave74-domain-a-deformer-foundation-fixes-report.md`

Observed parallel/non-Domain-A dirty files:

- Domain B / visibility hardening candidates: `apps/editor/e2e/portable-project-save-load.e2e.spec.ts`, `apps/editor/src/workspace/panels/deformer-tree-view.tsx`, `apps/editor/src/workspace/panels/parameter-binding-section.tsx`, `apps/editor/src/workspace/panels/parameter-binding-section.test.ts`.
- Map/planning artifacts: `discussion/implementation/_map.md`, `discussion/implementation/orchestration/_map.md`, untracked `discussion/implementation/orchestration/wave74-plan.md`.
- Generated test artifact: `apps/editor/test-results/.../wave72-saved-project.portable-project.json`.

Note: `rig-tool-state.ts` also contains Deformer Tree keyform count projection (`summarizeRigControlKeyforms` at `apps/editor/src/features/editor-session/model/rig-tool-state.ts:610`) used by the parallel Domain B UI badge diff. I did not use that as Domain A acceptance evidence except to check that it does not constitute Domain A save/load discovery UI implementation by itself.

## Requirement Classification

| Basis requirement | Classification | Evidence |
|---|---|---|
| Warp creation domain includes selected drawable committed mesh vertex bounds, including vertices outside source layer/drawable bounds. | `implemented` | Creation now uses `resolveDrawableWarpDomainBounds` at `apps/editor/src/features/editor-session/model/rig-tool-state.ts:165` and `apps/editor/src/features/editor-session/model/rig-tool-state.ts:190`; mesh vertices are preferred at `apps/editor/src/features/editor-session/model/rig-tool-state.ts:827`; test starts at `apps/editor/src/features/editor-session/model/rig-tool-state.test.ts:91`. |
| Fit/reset domain actions use mesh vertex bounds when committed mesh exists. | `implemented` | Fit/reset call `resolveChildBounds` at `apps/editor/src/features/editor-session/model/rig-tool-state.ts:355` and `apps/editor/src/features/editor-session/model/rig-tool-state.ts:364`; child resolution uses warp-domain child bounds at `apps/editor/src/features/editor-session/model/rig-tool-state.ts:588`; test starts at `apps/editor/src/features/editor-session/model/rig-tool-state.test.ts:112`. |
| Outside-layer mesh vertices are inside resulting domain plus deterministic margin. | `implemented` | `WARP_DEFORMER_DOMAIN_MARGIN = 1` at `apps/editor/src/features/editor-session/model/rig-tool-state.ts:23`; `expandRect` at `apps/editor/src/features/editor-session/model/rig-tool-state.ts:1012`; expected outside-layer domain asserted at `apps/editor/src/features/editor-session/model/rig-tool-state.test.ts:94`. |
| Drawables without committed mesh remain deterministic and use existing fallback bounds. | `implemented` | Mesh-missing fallback remains `resolveDrawableBounds` / canvas bounds at `apps/editor/src/features/editor-session/model/rig-tool-state.ts:841` and `apps/editor/src/features/editor-session/model/rig-tool-state.ts:812`; no-mesh fallback asserted in the fit/reset test at `apps/editor/src/features/editor-session/model/rig-tool-state.test.ts:112`. |
| Existing committed custom domains are not silently overwritten except create/fit/reset. | `implemented` | Domain A changes draft/payload calculation paths only; existing committed warp child bounds are cloned unchanged at `apps/editor/src/features/editor-session/model/rig-tool-state.ts:898`, and payload creation copies the normalized draft at `apps/editor/src/features/editor-session/model/rig-tool-state.ts:379`. |
| Canvas/evaluation proves outside-layer mesh vertices deform with lattice. | `implemented` | Test `deforms committed mesh vertices outside source layer bounds...` starts at `apps/editor/src/workspace/canvas/canvas-evaluation.test.ts:265`. |
| Mesh generation algorithm must not change; no vertex clipping/freeform topology/manual mesh editing behavior. | `explicit non-goal` | No mesh generation source is in the Domain A diff; implementation computes bounds from existing vertices at `apps/editor/src/features/editor-session/model/rig-tool-state.ts:993` and does not mutate vertices. |
| Rotation keyed `translation` Vec2 is sampled/interpolated; x/y interpolate linearly; exact keys remain exact. | `implemented` | Runtime interpolation accepts Vec2 at `packages/runtime-core/src/keyform-linear1d-interpolation.ts:185` and interpolates x/y at `packages/runtime-core/src/keyform-linear1d-interpolation.ts:265`; exact/midpoint test starts at `packages/runtime-core/src/keyform-linear1d-interpolation.test.ts:32`. |
| `restTranslation` remains fallback when no keyed translation applies. | `implemented` | Runtime local state starts from `restTranslation` at `packages/runtime-core/src/rig-control-keyform-state.ts:22`; fallback evidence test starts at `packages/runtime-core/src/rig-control-keyform-evidence.test.ts:189`. |
| Canvas evaluation and runtime evidence use interpolated translation values. | `implemented` | Editor evaluation chooses keyed translation before rest fallback at `apps/editor/src/workspace/canvas/canvas-evaluation.ts:429` and applies it in rotation transform at `apps/editor/src/workspace/canvas/canvas-evaluation.ts:742`; midpoint canvas assertion starts at `apps/editor/src/workspace/canvas/canvas-evaluation.test.ts:363`; runtime midpoint evidence starts at `packages/runtime-core/src/rig-control-keyform-evidence.test.ts:236`. |
| Save/load round-trip preserves keyed translation and evaluates interpolated values after load where practical. | `implemented` | Portable import is converted to runtime graph and evaluated at `packages/authoring-core/src/portable-project-bundle.test.ts:202`; `keyset_rotate_translation_x` midpoint `{ x: 2, y: -1.5 }` is asserted at `packages/authoring-core/src/portable-project-bundle.test.ts:215`. |
| Rotation angle and opacity interpolation remain intact. | `implemented` | Existing canvas evaluation coverage remains at `apps/editor/src/workspace/canvas/canvas-evaluation.test.ts:300`; focused test run passed. |
| Wave73 rotation translation editing remains intact. | `implemented` | Existing editing tests include exact translation keyform and ambiguous lock coverage at `apps/editor/src/workspace/canvas/rotation-deformer-editing.test.ts:251` and rest/exact/locked hook coverage at `apps/editor/src/workspace/canvas/rotation-deformer-editing.test.ts:422`; focused test run passed. |
| Save/load keyform visibility and keyform discovery affordance. | `deferred by plan` | Wave74 assigns Domain B to visibility/discovery and C to combined proof (`wave74-plan.md:134`, `wave74-plan.md:135`, `wave74-plan.md:144`). Domain A only adds narrow after-load runtime evaluation evidence. |
| Browser/e2e save/load UI proof. | `deferred by plan` | Domain B/C scope per `wave74-plan.md:135` and `wave74-plan.md:144`; Domain A's portable bundle/runtime test is adequate for its interpolation requirement. |
| Do not persist selection/current parameter values/active tool/canvas view/manual collapsed state/undo/drafts/gestures. | `explicit non-goal` | No Domain A persistence implementation was added; Wave74 keeps these out of scope at `wave74-plan.md:50`. |
| No slider perf, browser-local save slot, archive/filesystem, new package format, Viewer/Runtime View, Texture Atlas, Variant, Cubism compatibility, scale exposure, or dependencies. | `explicit non-goal` | Domain A diff has no `package.json` / lockfile changes and no new format/UI surface. `evaluateViewerRuntimeSnapshot` references are runtime test helpers, not a Viewer / Runtime View implementation. |
| UX-backed package logic authority. | `implemented` | Warp domain behavior is fixed at the editor draft/payload boundary where the accepted Rig Tool UX produces operation payloads; runtime/package-visible Rotation interpolation was verified at runtime/package levels instead of hidden by GUI-only assertions. |
| Source file organization policy. | `implemented` | No new catch-all or `index.ts` implementation file was added; changed production logic stays in existing responsibility files. |
| Dependency policy. | `implemented` | `git diff --name-only` shows no manifest or lockfile change. |
| Operation policy. | `implemented` | Domain A does not introduce direct package mutation; editor code constructs payloads, and committed creation still goes through existing operation paths. |
| Schema and ID conventions. | `implemented` | No package schema or new save format was introduced; new test/runtime IDs use existing safe machine-readable forms such as `keyset_child_translation_midpoint`. |
| Rig Tool / Canvas Preview design boundaries. | `implemented` | Initial warp bounds remain deterministic target-derived draft state; no auto-rig, Cubism-compatible claim, painting/pixel-editing feature, or separate rig editor surface was added. |

## Source Evidence Notes

- Warp domain source uses committed mesh vertices before mesh bounds fallback (`apps/editor/src/features/editor-session/model/rig-tool-state.ts:827` to `apps/editor/src/features/editor-session/model/rig-tool-state.ts:841`).
- Existing committed Warp custom domains remain exact child bounds for parent creation/fit (`apps/editor/src/features/editor-session/model/rig-tool-state.ts:898` to `apps/editor/src/features/editor-session/model/rig-tool-state.ts:900`).
- Runtime Rotation translation starts from `restTranslation` and applies `translation` Vec2 samples (`packages/runtime-core/src/rig-control-keyform-state.ts:22` to `packages/runtime-core/src/rig-control-keyform-state.ts:84`).
- Editor Canvas evaluation reads interpolated Rotation translation from evaluated keyforms before rest fallback (`apps/editor/src/workspace/canvas/canvas-evaluation.ts:429` to `apps/editor/src/workspace/canvas/canvas-evaluation.ts:456`).

## Commands Run

- `git status --short -uall`
- `git diff -- apps/editor/src/features/editor-session/model/rig-tool-state.ts apps/editor/src/features/editor-session/model/rig-tool-state.test.ts apps/editor/src/workspace/canvas/canvas-evaluation.test.ts packages/runtime-core/src/keyform-linear1d-interpolation.test.ts packages/runtime-core/src/rig-control-keyform-evidence.test.ts packages/authoring-core/src/portable-project-bundle.test.ts`
- `pnpm.cmd exec vitest run apps/editor/src/features/editor-session/model/rig-tool-state.test.ts apps/editor/src/workspace/canvas/canvas-evaluation.test.ts packages/runtime-core/src/keyform-linear1d-interpolation.test.ts packages/runtime-core/src/rig-control-keyform-evidence.test.ts packages/authoring-core/src/portable-project-bundle.test.ts apps/editor/src/workspace/canvas/rotation-deformer-editing.test.ts apps/editor/src/features/editor-session/model/parameter-keyform-state.test.ts`
  - Sandbox run failed at startup with esbuild `spawn EPERM`.
  - Escalated rerun passed: 7 files / 45 tests.
- `git diff --check -- apps/editor/src/features/editor-session/model/rig-tool-state.ts apps/editor/src/features/editor-session/model/rig-tool-state.test.ts apps/editor/src/workspace/canvas/canvas-evaluation.test.ts packages/runtime-core/src/keyform-linear1d-interpolation.test.ts packages/runtime-core/src/rig-control-keyform-evidence.test.ts packages/authoring-core/src/portable-project-bundle.test.ts discussion/implementation/waves/wave74/wave74-domain-a-deformer-foundation-fixes-report.md`
  - Passed with CRLF normalization warnings only.

## Residual Risks

- Browser-level proof for the exact Warp creation UI path was not run in this lane. The editor model and Canvas evaluation tests directly cover Domain A's required behavior; combined UI/e2e proof belongs to Domain C if needed.
- Shared-worktree Domain B changes are present. Final integration should review the combined `rig-tool-state.ts` keyform-count projection with `deformer-tree-view.tsx` and the e2e badge assertions as a Domain B/C concern.
- This review reran focused tests and diff whitespace checks, but did not rerun `pnpm.cmd typecheck`, `node scripts/check-source-organization.mjs`, or `node scripts/check-dependencies.mjs`; those are recorded as passed in the Domain A implementation report.

## User-Decision Points

None.
