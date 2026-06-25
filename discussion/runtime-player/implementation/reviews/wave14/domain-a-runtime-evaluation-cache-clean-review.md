# Wave14 Domain A Clean Review: Runtime Evaluation Cache

- Role: Review-Sylph
- Verdict: pass
- Scope: Domain A only; unrelated Domain B diagnostics/control diffs ignored except for direct integration risk.

## Findings

- Blocking findings: none.
- Non-blocking test gap: cache-key determinism for `multiToggle` is verified by code inspection, but there is no direct cache-key unit assertion with reordered `variantIds`. Existing runtime Variant visibility tests cover `multiToggle` output behavior.

## Review Notes

- Cache scope is limited to invariant scaffold data: runtime graph adapter result, texture source, model bounds, drawable templates, stable index, and clipping.
- Per-frame Runtime Snapshot/State, authored parameter values, dynamics next state, evaluated vertices, opacity, visibility, draw order, and keyform samples remain evaluated per frame.
- Runtime Export reload, clear, and dispose clear the renderer-owned cache. Variant semantic changes switch cache entries by key; non-semantic `updatedAtIso` is ignored.
- Stage Motion, view transform, manual pan/zoom, Center Model, and Reset View do not rebuild runtime evaluation input.
- Native Stage and Browser Source both use `StaticStageCanvasRenderer`, so the cache-capable path is shared.
- Source organization guard passed; the new helper has a cohesive cache/scaffold responsibility.

## Verification

- `pnpm.cmd exec vitest run apps/runtime-player/src/stage/stage-renderer/runtime-export-evaluation-cache.test.ts apps/runtime-player/src/stage/stage-renderer/static-stage-canvas-renderer.frame-pacing.test.ts apps/runtime-player/src/stage/runtime-evaluation/runtime-export-default-pose-evaluation.test.ts apps/runtime-player/src/stage/runtime-evaluation/runtime-export-variant-visibility.test.ts apps/runtime-player/src/stage/browser-source/browser-source-stage-client.test.ts apps/runtime-player/src/stage/stage-renderer/static-stage-canvas-renderer.live-suspension.test.ts`
  - Passed: 6 files / 33 tests.
- `pnpm.cmd typecheck`
  - Passed.
- `node scripts/check-source-organization.mjs`
  - Passed.
- `git diff --check -- apps/runtime-player/src/stage/stage-renderer/evaluated-runtime-export-stage-scene.ts apps/runtime-player/src/stage/stage-renderer/runtime-export-evaluation-cache.ts apps/runtime-player/src/stage/stage-renderer/runtime-export-evaluation-cache.test.ts apps/runtime-player/src/stage/stage-renderer/static-stage-canvas-renderer.ts apps/runtime-player/src/stage/stage-renderer/static-stage-canvas-renderer.frame-pacing.test.ts apps/runtime-player/src/stage/runtime-evaluation/runtime-export-pose-evaluator.ts`
  - Passed with CRLF normalization warnings only.

## Residual Risks / Manual Checks

- Real Electron/native Stage and OBS Browser Source visual QA was not run.
- Real-model Performance Diagnostics capture is still needed to confirm `liveRenderInputEvaluationDurationMs` and `scheduledFrameDurationMs` materially drop.
- Cached texture/template arrays are reused by reference; current render paths are expected to treat render input as read-only.
