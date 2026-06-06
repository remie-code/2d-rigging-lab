# Wave47 Domain B Report: Browser Multi-Layer Materialization Service

> Target: `wave47-browser-multi-layer-materialization-service`
> Role: Gnome implementation agent
> Review status: `pass` after Review-Sylph review

## Review Status

`pass`

The original pre-review candidate status is superseded by the independent Review-Sylph review: [wave47-domain-b-browser-multi-layer-materialization-service-review.md](../../reviews/wave47/wave47-domain-b-browser-multi-layer-materialization-service-review.md).

Domain B source implementation is complete in `apps/editor/src/**` and focused Editor tests pass. The browser materialization service now supports explicit multi-layer PSD leaf-layer batch materialization from current private/local PSD source bytes without adding parser imports outside the approved Editor/browser adapter boundary.

The earlier full-repository typecheck blockage from parallel/out-of-scope `packages/operation-core` Wave47 changes is stale. The Domain B review records current `pnpm.cmd typecheck`, focused Editor typecheck, parser-boundary, source-organization, and dependency checks as passing, with no verification-blocked items.

## Scope / Boundary

- Added batch service/result helpers under `apps/editor/src/editor-workflow/**`.
- Reused the existing selected-layer materialization service and `browser-psd-parser-adapter.ts`; no parser import was added outside the approved adapter.
- Kept Domain D UI controls out of scope.
- Did not edit `packages/**`, `apps/editor/e2e/**`, `scripts/**`, dependencies, lockfiles, renderer, compositing, all-layer import, recursive group import, or public demo asset behavior.

## Implementation Summary

- Added `materializeSelectedPsdLayersFromArrayBuffer` and `materializeSelectedPsdLayersFromBrowserFile`.
- Added parser-free batch result evidence with per-entry `materialized` / `failed` outcomes and aggregate status `success`, `partialFailure`, `failure`, or `preflightBlocked`.
- Enforced explicit selection semantics:
  - duplicate refs become `duplicateSelection`;
  - missing current source bytes become `missingCurrentSourceBytes`;
  - expected source digest/byteLength mismatch becomes `staleSource`;
  - selected groups remain `unsupportedLayerType` via the approved adapter;
  - count cap and total raw RGBA cap are surfaced as structured failures.
- Preserved single-layer private/local candidate evidence and extended it with source layer bounds and `visibleInSource`.
- Batch default caps match Domain A: `4` unique selected layers and `32 * 1024 * 1024` total raw RGBA bytes.

## Sample Target Materialization Evidence

Source PSD:

- `test_data/sample_model.psd`
- byteLength: `22406225`
- sha256: `44ab43238cd2b2af2fb0ce6a7b5073a60e332d03da7666ea274c02e0462294b5`
- parser: `@webtoon/psd` `0.4.0`
- mediaType: `application/vnd.ai-native-live2d.raw-rgba; pixelFormat=rgba8`
- provenance: private/local, `publicDemoAsset=false`

Materialized targets:

| Layer | Ref | Dimensions | Raw RGBA byteLength | SHA-256 |
|---|---|---:|---:|---|
| `headwear` | `psd:root/layer[0]` | `400 x 288` | `460800` | `671e6a363745b1ce2e8d29c1a63438170fe9511c8884ea42298cf9b8886e5c1a` |
| `eyewear` | `psd:root/layer[3]` | `265 x 110` | `116600` | `a5558168cbf75f7817a139131c764e317a77056138d6be0e591077b3e373e708` |
| `tie / tie` | `psd:root/group[6]/layer[0]` | `104 x 560` | `232960` | `46ba1a95659ac420d37ca89b0ab919ca6ad2022280bb268313937fcd2cd69673` |

Default sample batch total raw RGBA byteLength: `810360`.

## Files Changed

Editor workflow/service:

- `apps/editor/src/editor-workflow/browser-psd-parser-adapter.ts`
- `apps/editor/src/editor-workflow/index.ts`
- `apps/editor/src/editor-workflow/selected-psd-layer-batch-materialization-result.ts`
- `apps/editor/src/editor-workflow/selected-psd-layer-batch-materialization-service.ts`
- `apps/editor/src/editor-workflow/selected-psd-layer-materialization-result.ts`
- `apps/editor/src/editor-workflow/selected-psd-layer-materialization-service.ts`

Focused tests:

- `apps/editor/src/editor-workflow/selected-psd-layer-batch-materialization-service.test.ts`
- `apps/editor/src/editor-workflow/selected-psd-layer-intake-workflow.test.ts`

Report:

- `discussion/implementation/waves/wave47/wave47-domain-b-browser-multi-layer-materialization-service-report.md`

## Verification Performed

Passed:

- `pnpm.cmd exec vitest run apps/editor/src/editor-workflow/selected-psd-layer-batch-materialization-service.test.ts`
  - `8` tests passed.
- `pnpm.cmd exec vitest run apps/editor/src/editor-workflow/selected-psd-layer-materialization-service.test.ts apps/editor/src/editor-workflow/browser-psd-parser-bridge.test.ts`
  - `15` tests passed.
- `pnpm.cmd exec vitest run apps/editor/src/editor-workflow/selected-psd-layer-batch-materialization-service.test.ts apps/editor/src/editor-workflow/selected-psd-layer-materialization-service.test.ts apps/editor/src/editor-workflow/browser-psd-parser-bridge.test.ts apps/editor/src/editor-workflow/selected-psd-layer-intake-workflow.test.ts`
  - `26` tests passed.
- `pnpm.cmd --filter @private-2d-rigging-lab/editor typecheck`
  - Passed during implementation and was rerun by Review-Sylph as passing in the current worktree.
- `pnpm.cmd run check:source`
  - Passed.
- `pnpm.cmd run check:deps`
  - Passed.
- `node scripts/check-psd-parser-import-boundary.mjs`
  - Passed: `5` direct import/resolve sites remain limited to the approved adapter and Wave44 scripts.
- `git diff --check -- apps/editor/src discussion/implementation/waves/wave47/wave47-domain-b-browser-multi-layer-materialization-service-report.md`
  - Passed with CRLF normalization warnings only.
- `git diff --no-index --check -- NUL <new Domain B file>` for the three new Editor source/test files and this report
  - No whitespace findings; exit `1` was expected for no-index file differences, with CRLF normalization warnings only.

Review-superseding evidence:

- [Domain B Review-Sylph review](../../reviews/wave47/wave47-domain-b-browser-multi-layer-materialization-service-review.md) verdict: `pass`.
- `pnpm.cmd typecheck`
  - Passed in the current worktree during Review-Sylph review.
- `pnpm.cmd --filter @private-2d-rigging-lab/editor typecheck`
  - Passed in the current worktree during Review-Sylph review.
- Verification blocked / failing:
  - None in the current worktree according to the Review-Sylph review.

## Remaining Issues

- No Domain B blocker remains after independent Review-Sylph review.
- Domain B does not implement UI controls, package operation batch commit, validator diagnostics, e2e persistence, all-layer import, recursive group import, full compositing, or renderer/pixel oracle behavior.

## User-Decision Points

None for Domain B.
