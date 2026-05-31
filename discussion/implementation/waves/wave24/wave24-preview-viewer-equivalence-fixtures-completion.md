# Wave 24 Domain D Completion: Preview / Viewer Equivalence Fixtures

> Target: `wave24-preview-viewer-equivalence-fixtures`
> Date: 2026-06-01
> Role: Gnome implementation agent
> Status: `pass`

## Summary

Domain D is `pass`.

The implementation adds a deterministic contract fixture proving that editor Preview and Viewer evaluation stay aligned for the same runtime input across summary, effective parameter, targeted keyform, targeted drawable, and targeted dynamics fields. The oracle intentionally does not compare pixels and does not add a renderer oracle.

The focused test uses the existing embedded preview projection (`projectEditorPreview`) and Domain A viewer evaluation (`evaluateViewerRuntimeSnapshot`) against the same normalized runtime graph and request. The fixture covers authored parameter override -> computed dynamics output -> keyform-sampled drawable geometry.

## Changed Files

Fixture:

- `fixtures/contracts/preview-viewer-equivalence-keyform-dynamics/fixture-manifest.json`
- `fixtures/contracts/preview-viewer-equivalence-keyform-dynamics/runtime/runtime-graph.json`
- `fixtures/contracts/preview-viewer-equivalence-keyform-dynamics/request/evaluation-request.json`
- `fixtures/contracts/preview-viewer-equivalence-keyform-dynamics/expected/preview-viewer-equivalence-summary.json`

Focused test:

- `packages/runtime-core/src/preview-viewer-equivalence-fixture.test.ts`

Completion report:

- `discussion/implementation/waves/wave24/wave24-preview-viewer-equivalence-fixtures-completion.md`

## Pass Evidence

- Preview and Viewer consume the same runtime graph, frame input, parameter override, target IDs, options, and strictness.
- Preview side uses existing embedded preview projection rather than a new preview oracle.
- Viewer side uses Domain A viewer runtime evaluation.
- The expected fixture pins:
  - preview projection summary;
  - comparable snapshot summary;
  - effective authored/computed parameters;
  - targeted linear keyform sample;
  - targeted drawable bounds/vertices/draw order/visibility/opacity;
  - targeted dynamics driver/output/state fields;
  - runtime diff summary.
- Existing Wave23 dynamics fixture remains compatible.

## Verification

| Check | Result | Notes |
|---|---|---|
| `pnpm.cmd exec vitest run packages/runtime-core/src/preview-viewer-equivalence-fixture.test.ts` | pass | 1 fixture test |
| `pnpm.cmd exec vitest run packages/runtime-core/src/preview-viewer-equivalence-fixture.test.ts packages/runtime-core/src/viewer-evaluation.test.ts packages/runtime-core/src/dynamics-contract-evidence-fixture.test.ts` | pass | 3 files / 6 tests |
| `pnpm.cmd exec vitest run packages/validator-core/src/dynamics-contract-evidence-fixture.test.ts packages/validator-core/src/runtime-evidence-report.test.ts` | pass | 2 files / 6 tests |
| `pnpm.cmd test:unit` | pass | 115 files / 588 tests |
| `pnpm.cmd run typecheck:root` | pass | Root/package typecheck passed, including the new runtime-core fixture test |
| `pnpm.cmd typecheck` | pass | Final rerun passed after parallel editor changes settled |
| `pnpm.cmd run check:source` | pass | Source organization guard passed |
| `pnpm.cmd run check:deps` | pass | Dependency guard passed |
| `git diff --check -- fixtures/contracts packages/runtime-core packages/validator-core discussion/implementation/waves/wave24 discussion/implementation/reviews/wave24` | pass | Exit 0; Git emitted LF/CRLF working-copy warnings only |
| Dependency manifest diff check | pass | No package manifest or lockfile output |

## Non-Goals Confirmed

- No editor UI implementation.
- No runtime/validator broad implementation.
- No pixel-level renderer oracle.
- No real asset bytes, PSD parser, image decode fixture, file picker, archive, actual binary upload, Cubism SDK/Core, Cubism Viewer compatibility, or Cubism Physics compatibility claim.
- No dependency manifest or lockfile changes.
- No public `index.ts` implementation logic.

## Residual Risks

- The fixture is a deterministic normalized runtime graph fixture, not an end-to-end editor workflow or persistence smoke.
- The oracle compares summary and targeted runtime fields only; renderer/pixel equivalence remains future scope.
- The runtime-core test imports the existing editor preview projection as a test-only dependency so the fixture can exercise the real embedded preview projection without editing editor UI. Review should confirm this boundary remains acceptable.

## User Decision Points

None.
