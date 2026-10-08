# Wave14 Domain A Runtime Evaluation Cache Report

- Domain: Runtime Evaluation Cache
- Agent: Gnome
- Verdict: pass
- Date: 2026-06-26

## Scope Completed

- Added a renderer-owned `RuntimeExportEvaluationCache` for invariant Runtime Export evaluation scaffolding.
- Reused cached scaffolding across repeated live frames for the same Runtime Export identity and semantic active Variant selection.
- Kept per-frame Runtime Snapshot, Runtime State, dynamics next state, authored parameter values, evaluated vertices, opacity, visibility, draw order, and keyform samples uncached.
- Shared the cache benefit through `StaticStageCanvasRenderer`, which is used by native Stage and Browser Source.
- Invalidated renderer-owned cache on Runtime Export payload set/reload, clear, and dispose.
- Kept Stage view/display transform, manual pan/zoom, Center Model, and Reset View outside the cache key/invalidation path.

## Cache Boundary

Cached data:

- normalized Runtime Export runtime graph adapter result;
- texture source/render source scaffold and content signature;
- model bounds;
- drawable render templates, including atlas UVs, triangles, blend mode, texture ref, stable drawable index, and clipping map.

Not cached:

- `RuntimeSnapshotDto`;
- `RuntimeStateDto`;
- dynamics previous/next state;
- authored/live parameter values;
- evaluated drawable vertices, opacity, visibility, draw order;
- keyform samples.

## Cache Key / Invalidation

- Cache key includes package id, package revision, package hash, `loadedAtIso`, texture metadata/digest/decoded byte length, atlas source signature digest, and semantic Variant selection.
- Variant `updatedAtIso` is intentionally excluded.
- `singleSelect` selections are keyed by selected Variant id.
- `multiToggle` selections are keyed by sorted selected Variant ids.
- `setPayload`, `clear`, and `dispose` clear the renderer-owned cache.
- Live parameter values, frame index, delta time, previous runtime state, and Stage view/display transform do not clear the cache.

## Files Changed

- `apps/runtime-player/src/stage/stage-renderer/runtime-export-evaluation-cache.ts`
- `apps/runtime-player/src/stage/stage-renderer/evaluated-runtime-export-stage-scene.ts`
- `apps/runtime-player/src/stage/runtime-evaluation/runtime-export-pose-evaluator.ts`
- `apps/runtime-player/src/stage/stage-renderer/static-stage-canvas-renderer.ts`
- `apps/runtime-player/src/stage/stage-renderer/runtime-export-evaluation-cache.test.ts`
- `apps/runtime-player/src/stage/stage-renderer/static-stage-canvas-renderer.frame-pacing.test.ts`
- `discussion/runtime-player/implementation/waves/wave14/domain-a-runtime-evaluation-cache-report.md`

## Verification

- `pnpm.cmd exec vitest run apps/runtime-player/src/stage/stage-renderer/runtime-export-evaluation-cache.test.ts apps/runtime-player/src/stage/stage-renderer/static-stage-canvas-renderer.frame-pacing.test.ts apps/runtime-player/src/stage/runtime-evaluation/runtime-export-default-pose-evaluation.test.ts apps/runtime-player/src/stage/runtime-evaluation/runtime-export-variant-visibility.test.ts`
  - Initial sandbox run failed before tests with `spawn EPERM` while Vitest loaded config through esbuild.
  - Elevated rerun passed: 4 files, 22 tests passed.
- `pnpm.cmd exec vitest run apps/runtime-player/src/stage/browser-source/browser-source-stage-client.test.ts apps/runtime-player/src/stage/stage-renderer/static-stage-canvas-renderer.live-suspension.test.ts`
  - Elevated run passed: 2 files, 11 tests passed.
- `pnpm.cmd typecheck`: passed.
- `node scripts/check-source-organization.mjs`: passed.
- `git diff --check -- apps/runtime-player/src/stage/stage-renderer/evaluated-runtime-export-stage-scene.ts apps/runtime-player/src/stage/stage-renderer/runtime-export-evaluation-cache.ts apps/runtime-player/src/stage/stage-renderer/runtime-export-evaluation-cache.test.ts apps/runtime-player/src/stage/stage-renderer/static-stage-canvas-renderer.ts apps/runtime-player/src/stage/stage-renderer/static-stage-canvas-renderer.frame-pacing.test.ts apps/runtime-player/src/stage/runtime-evaluation/runtime-export-pose-evaluator.ts`: passed with CRLF normalization warnings only.

## Required Scenarios Covered

- Repeated live frames reuse the same cached adapter/scaffold while snapshots, next state, dynamics tick, vertices, opacity, draw order, and clipping output still update per frame.
- Semantic Variant selection changes create a distinct cached scaffold.
- Variant timestamp-only changes reuse the cached scaffold.
- Cache clear invalidates scaffolds; Runtime Export reload and texture key changes produce distinct cache keys.
- Stage view/display transform changes do not rebuild evaluated runtime input.
- Hidden mask-source visibility remains hidden while clipping continues to reference the mask source.
- Browser Source/native shared renderer behavior was covered through existing Browser Source client and live-suspension focused tests.

## Residual Risks / Manual Checks

- Manual Electron/native Stage and OBS Browser Source visual QA was not run.
- Real-model performance improvement still needs a Performance Diagnostics capture to confirm `liveRenderInputEvaluationDurationMs` and `scheduledFrameDurationMs` drop under production payload size.
- The cache stores immutable render scaffolding by reference; current render-core/WebGL paths are expected to treat render input as read-only, and focused tests/typecheck passed.
- No Runtime Export format, Browser Source protocol, diagnostics terminology, iFacialMocap throttling, Stage Motion semantics, Body Follow semantics, dynamics algorithm, WebGL architecture, or Editor code was changed.
