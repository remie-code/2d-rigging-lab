# Wave102 Domain A Test Adequacy Review

Lane: Test Adequacy Review

Verdict: `pass`

## Reviewed Tests / Source

- Plan: `discussion/implementation/orchestration/wave102-plan.md`
- Gnome report: `discussion/implementation/waves/wave102/wave102-domain-a-runtime-export-variant-visibility-foundation-report.md`
- Schema/tests: `packages/package-format/src/runtime-export.ts`, `packages/package-format/src/runtime-export.test.ts`, `packages/package-format/src/package-document.test.ts`
- Materialization/tests: `packages/authoring-core/src/runtime-export-materialization.ts`, `packages/authoring-core/src/runtime-export-assembly.test.ts`
- Player compatibility surface: `apps/runtime-player/src/main/runtime-export-loader/**`, `apps/runtime-player/src/stage/runtime-evaluation/**`
- Relevant diff: source/test changes are limited to `runtime-export.ts`, `runtime-export.test.ts`, `runtime-export-materialization.ts`, and `runtime-export-assembly.test.ts`; no Runtime Player source diff was present.

## Command Evidence

- `pnpm.cmd exec vitest run packages/package-format/src/runtime-export.test.ts packages/package-format/src/package-document.test.ts`
  - First sandboxed run failed before test execution with Vite/esbuild `spawn EPERM`.
  - Escalated rerun passed: 2 files, 21 tests.
- `pnpm.cmd exec vitest run packages/authoring-core/src/runtime-export-assembly.test.ts`
  - Passed: 1 file, 16 tests.
- `pnpm.cmd exec vitest run apps/runtime-player/src/main/runtime-export-loader apps/runtime-player/src/stage/runtime-evaluation`
  - Passed: 4 files, 27 tests.
- `pnpm.cmd typecheck`
  - Passed.
- `git diff --check -- packages/package-format/src/runtime-export.ts packages/package-format/src/runtime-export.test.ts packages/authoring-core/src/runtime-export-materialization.ts packages/authoring-core/src/runtime-export-assembly.test.ts apps/runtime-player/src/main/runtime-export-loader apps/runtime-player/src/stage/runtime-evaluation`
  - Passed with LF-to-CRLF working-copy warnings only.

## Test Adequacy Matrix

| # | Requirement | Test / evidence | Assessment |
|---|---|---|---|
| 1 | Runtime Export schema new case: drawable with `baseVisible` and `visible`. | `runtime-export.ts:329-341` adds optional schema field; `runtime-export.test.ts:147-168` parses a drawable with `baseVisible: true` and `visible: false`. | Covered. |
| 2 | Runtime Export schema legacy case: drawable without `baseVisible` parses. | Minimal fixture omits `baseVisible` at `runtime-export.test.ts:497-518`; legacy parse assertion is at `runtime-export.test.ts:128-145`. | Covered. |
| 3 | Materialization emits `baseVisible` for every exported Drawable. | `runtime-export-materialization.ts:138-161` maps every included target with `baseVisible`; assembly test asserts all exported fixture drawables at `runtime-export-assembly.test.ts:87-106`. | Covered. |
| 4 | `visible` remains default-active evaluated initial visibility. | `runtime-export-materialization.ts:98-102` resolves default selections and `runtime-export-materialization.ts:146-155` computes `visible = baseVisible && variantVisibilityPredicate(...)`; assembly test asserts default-active result at `runtime-export-assembly.test.ts:119-155`. | Covered. |
| 5 | Default-inactive Variant Drawable: `baseVisible` can be true while `visible` is false. | `DRAW_BODY` is authored visible at `runtime-export-assembly.test.ts:535`; variant default selects the other drawable at `runtime-export-assembly.test.ts:439-455`; assertion `baseVisible=true`, `visible=false` is at `runtime-export-assembly.test.ts:143-148`. | Covered. |
| 6 | Non-Variant Drawable: `baseVisible` and `visible` match when no default predicate hides it. | No-variant assembly path asserts `DRAW_BODY true/true` and `DRAW_HIDDEN false/false` at `runtime-export-assembly.test.ts:91-111`. | Covered. |
| 7 | Runtime Export variants metadata is present when session has Variant Groups. | `runtime-export-materialization.ts:222-229` emits variants when filtered groups exist; assembly test asserts metadata and `defaultActiveSelections` at `runtime-export-assembly.test.ts:119-142`. | Covered. |
| 8 | Variant metadata references exported Drawable ids deterministically, including missing/export-filtered Drawable references. | Package schema rejects missing references at `runtime-export.ts:731-750` and `runtime-export.test.ts:266-301`; materialization filters export-filtered `DRAW_POOL` from targets and memberships at `runtime-export-materialization.ts:343-363` and `runtime-export-assembly.test.ts:157-190`. | Covered. |
| 9 | Existing Runtime Export without Variant Groups remains valid. | Package-format test keeps variants optional at `runtime-export.test.ts:99-126`; assembly no-variant test asserts `variants` is undefined at `runtime-export-assembly.test.ts:111`; package-document focused test suite also passed unchanged. | Covered. |
| 10 | Runtime Player compatibility tests pass or are unaffected with credible no-touch evidence. | No Runtime Player source diff; adapter still reads `drawable.visible` at `runtime-export-runtime-graph-adapter.ts:157-194`; focused Runtime Player tests passed 4 files / 27 tests. Legacy Player fixtures omit `baseVisible` at `runtime-export-directory-loader.test.ts:390-411` and `runtime-export-default-pose-evaluation.test.ts:704-725`. | Covered. |
| 11 | Live Controller UI / active switching / Stage render behavior are not silently tested as implemented features. | Test search found only schema/materialization `baseVisible` and `defaultActiveSelections` assertions in package-format/authoring-core tests. Runtime Player tests remain existing loader/evaluation compatibility tests; no source diff in Player UI, IPC, or stage behavior. | Covered. |

## Findings

None.

## Residual Risks / Open Verification Items

- Runtime Player compatibility coverage is intentionally no-touch/focused. It proves old and current `visible`-based loading/evaluation still passes, but it does not test future runtime Variant switching.
- All-targets-filtered Variant Groups are documented in the Gnome report and are deterministic from the filtering implementation, but there is no dedicated all-targets-filtered fixture. Current tests cover both parser rejection of missing references and export filtering of a partially filtered group.
- Full repository tests, browser/e2e, and future Live Controller behavior tests were not run for this lane.
