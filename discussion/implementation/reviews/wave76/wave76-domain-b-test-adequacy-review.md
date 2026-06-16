# Wave76 Domain B Test Adequacy Review

## Verdict

pass

Wave76 Domain B `wave76-rigcontrol-partid-legacy-optional-decoupling` のテストは、要求された互換性維持と新規 ownership 非導入の両方を十分に押さえている。レビューでは Gnome 報告だけでなく、対象ソース、対象テスト、差分、残存 `partId` 参照を直接確認した。

## Basis

- `discussion/implementation/orchestration/wave76-plan.md`
  - sections 7.2, 10, 15, 17, 18, 19
- `discussion/implementation/waves/wave76/wave76-domain-b-rigcontrol-partid-legacy-optional-decoupling-report.md`
- Domain B changed source/tests listed in the review request
- Additional directly relevant changed file from the implementation report:
  - `packages/package-format/src/warp-deformer-projection.ts`

## Findings

No blocking or change-request findings.

## Coverage Assessment

| Rubric item | Assessment | Evidence |
|---|---|---|
| Schema loads with and without `partId` | adequate | `packages/package-format/src/model-files.ts:216`, `packages/package-format/src/model-files.ts:232`; `packages/package-format/src/rig-control-contract.test.ts:6`, `packages/package-format/src/rig-control-contract.test.ts:17` cover legacy/current rotation and warp. |
| Create operation payloads without `partId` | adequate | `packages/operation-core/src/payloads/rig-control.ts:25`, `:40`, `:55`; representative schema samples omit `partId` in `packages/operation-core/src/operation-schemas.test.ts`. |
| Newly created RigControls omit `partId` | adequate | Authoring tests assert omitted `partId` for rotation/warp; operation tests assert committed created controls omit `partId`; editor draft/payload tests assert no `partId`. |
| Positive legacy compatibility | adequate | Package contract tests preserve legacy `partId`; authoring test preserves explicit legacy metadata; portable package/project tests round-trip legacy/current controls. |
| Negative no-new-ownership behavior | adequate | Operation tests assert no Part `targetIds` / `checkedTargetRefs` for new and legacy create payloads; editor tests assert create payloads omit `partId`; AI catalog tests assert rig creates no longer target Part or require `payload.partId`. |
| Operation target refs / diagnostics | adequate | `packages/operation-core/src/operations/rig-control.test.ts:77`, `:81`, `:127`, `:134`, `:185`, `:229`, and legacy payload test at `:244` verify create evidence excludes Part targets. |
| Operation ID generation remains display-name based | adequate by source inspection | `packages/operation-core/src/operation-ids.ts:211`, `:215`, `:219` use `displayName` for create rotation, warp lattice, and warp deformer IDs. |
| Runtime / evaluation evidence | adequate | `packages/authoring-core/src/runtime-graph-adapter.test.ts:210` covers no-`partId` runtime graph projection; `packages/authoring-core/src/portable-project-bundle.test.ts` evaluates imported rig controls through runtime snapshot with the current no-`partId` warp path. |
| Validator/delete blockers | adequate | Authoring and operation Part delete tests accept legacy-only `rigControl.partId`; validator source only tracks child parts, drawables, and mask relations; `packages/validator-core/src/part-texture-layer-diagnostics.test.ts:788` keeps child/drawable/mask blockers. |
| Editor create flows | adequate | `apps/editor/src/features/editor-session/model/rig-tool-state.test.ts` asserts draft and payload omit `partId`; source read model no longer exposes RigControl `partId`. |
| Portable round-trip | adequate | `packages/package-format/src/portable-package-bundle.test.ts` covers legacy/current rig controls; `packages/authoring-core/src/portable-project-bundle.test.ts` covers authoring portable import/export and runtime use. |
| AI catalog required input alignment | adequate | `packages/ai-interface/src/ai-codex-proposal-operation-catalog.ts` removes Part target kind and required `partId`; `packages/ai-interface/src/ai-codex-proposal-validation.test.ts` asserts no Part target and no `payload.partId`. |

## Commands And Evidence

- Read/inspected:
  - Wave76 plan and Domain B implementation report.
  - `git diff --` for the requested Domain B files.
  - `rg` scans for `partId`, target refs, AI catalog required inputs, delete blockers, and operation ID generation.
  - Source reads for create rig operations, authoring mutations, delete part operation, validator blockers, editor rig state, editor inspector tests, runtime/portable tests, and package schema tests.
- Focused validation:
  - `pnpm.cmd exec vitest run packages/package-format/src/rig-control-contract.test.ts packages/package-format/src/portable-package-bundle.test.ts packages/authoring-core/src/rig-control-mutations.test.ts packages/authoring-core/src/part-mutations.test.ts packages/authoring-core/src/runtime-graph-adapter.test.ts packages/authoring-core/src/portable-project-bundle.test.ts packages/operation-core/src/operation-schemas.test.ts packages/operation-core/src/operations/rig-control.test.ts packages/operation-core/src/operations/part-operations.test.ts packages/validator-core/src/part-texture-layer-diagnostics.test.ts apps/editor/src/features/editor-session/model/rig-tool-state.test.ts apps/editor/src/workspace/panels/rig-tool-inspector.test.ts packages/ai-interface/src/ai-codex-proposal-validation.test.ts`
    - sandbox attempt failed before tests with Vite/esbuild `spawn EPERM`.
    - escalated rerun passed: 13 test files, 96 tests.
  - `git diff --check -- <Domain B requested files>`
    - passed; Git emitted LF-to-CRLF working-copy warnings only.

## Residual Risks

- Full repo test suite, e2e, a11y, and full `typecheck` were not rerun in this review lane. The implementation report records those broader checks where applicable, but this review independently reran only the focused Domain B tests.
- `packages/package-format/src/warp-deformer-projection.ts` was changed and inspected because it appears in the implementation report, but it was not listed in the review request's Domain B file set. It preserves optional legacy `partId` in projection; no dedicated new no-`partId` projection test was found, but source behavior is straightforward and the broader package/portable/runtime tests cover no-`partId` rig controls.
- There is no explicit test for a legacy create payload whose `partId` points to a missing Part. Source inspection shows operation-created RigControls ignore payload `partId` and authoring mutations no longer look up the Part, so this is not blocking.

## User Decision Points

None.
