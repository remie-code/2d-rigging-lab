# Wave96 Domain A Test Adequacy Review

## Verdict

Verdict: `pass`.

No blocking test-adequacy findings were found. The focused tests directly exercise the Wave96 Domain A cache proof: unchanged Atlas Runtime projections reuse cached static source resolution, stale source-relevant changes invalidate the cache, missing placement and Wave89 unbound Drawable scope remain covered, and Original mode is guarded even when a cache object is supplied.

## Evidence Reviewed

- `discussion/implementation/orchestration/wave96-plan.md`
- `discussion/implementation/orchestration/wave89-plan.md`
- `discussion/implementation/waves/wave89/wave89-final-integration-report.md`
- `discussion/implementation/waves/wave96/wave96-domain-a-viewer-atlas-runtime-static-source-cache-report.md`
- `apps/editor/src/workspace/viewer/viewer-atlas-runtime-source-cache.ts`
- `apps/editor/src/workspace/viewer/viewer-render-source.ts`
- `apps/editor/src/workspace/viewer/viewer-render-source.test.ts`
- `apps/editor/src/workspace/viewer/viewer-runtime-screen.tsx`
- `apps/editor/src/workspace/viewer/viewer-runtime-screen.test.ts`

## Findings

No `critical`, `major`, or `minor` findings.

Informational residual gap:

- `info` - `apps/editor/src/workspace/viewer/viewer-runtime-screen.test.ts`: there is no end-to-end Runtime Screen test that combines an applied atlas, `renderSourceMode: "atlasRuntime"`, and dynamics or Parts visibility in one assertion. This is not blocking for Domain A because the moved Runtime Screen path forwards the dynamic Clean Stage projection into `createViewerRenderSourceProjection()` (`viewer-runtime-screen.tsx:282`, `viewer-runtime-screen.tsx:286`), the Atlas Runtime cache path is covered with keyform-driven projection changes and masks (`viewer-render-source.test.ts:403`), and existing Runtime Screen tests still cover Dynamics and Parts visibility before render-source remap (`viewer-runtime-screen.test.ts:358`, `viewer-runtime-screen.test.ts:484`).

## Test Adequacy Checklist

| Requirement | Adequacy | Evidence |
|---|---|---|
| Repeated unchanged Atlas Runtime projections avoid repeated source signature / target selection | Pass | `viewer-render-source.test.ts:199` calls two Atlas Runtime projections with the same cache and asserts `selectTextureAtlasTargets`, `createTextureAtlasSourceSignature`, and `sameTextureAtlasSourceSignature` each run once (`viewer-render-source.test.ts:226`). It also asserts stable texture bytes/id/UVs (`viewer-render-source.test.ts:229`). |
| Cache hit path exists and bypasses heavy source resolution | Pass | `resolveViewerAtlasRuntimeSource()` reads the cache and returns cached results before the uncached resolver (`viewer-render-source.ts:194`, `viewer-render-source.ts:203`). Heavy work remains in the uncached resolver (`viewer-render-source.ts:229`). |
| Stale invalidation coverage | Pass | `viewer-render-source.test.ts:234` primes the cache, mutates source-relevant mesh UVs, then asserts fallback to Original with `staleSourceSignature` and a second set of heavy-hook calls (`viewer-render-source.test.ts:257`, `viewer-render-source.test.ts:267`, `viewer-render-source.test.ts:272`). Existing stale coverage remains at `viewer-render-source.test.ts:293`. |
| Missing placement disables Atlas Runtime for runtime-eligible Drawable | Pass | `viewer-render-source.test.ts:449` removes a runtime Drawable placement and asserts `missingPlacement` (`viewer-render-source.test.ts:458`). The source resolver validates placements only for selected packable runtime targets (`viewer-render-source.ts:248`). |
| Unbound Drawable missing placement remains non-blocking and omitted | Pass | `viewer-render-source.test.ts:130` asserts Atlas Runtime remains available and omits the Drawable Pool item (`viewer-render-source.test.ts:139`). This preserves Wave89 scope. |
| Original mode guard covers cache-supplied path | Pass | `viewer-render-source.test.ts:167` supplies `atlasRuntimeSourceCache` and throwing heavy hooks, requests `original`, then asserts none are called (`viewer-render-source.test.ts:183`, `viewer-render-source.test.ts:194`). |
| Atlas Runtime remap and unavailable modes remain covered | Pass | Atlas remap coverage remains at `viewer-render-source.test.ts:95`; missing layout and stale unavailable modes are covered at `viewer-render-source.test.ts:277` and `viewer-render-source.test.ts:293`. |
| Runtime playback / dynamic smoke with Atlas Runtime where practical | Pass | Atlas Runtime cache path preserves keyform-driven dynamic bounds and mask relations while reusing static source (`viewer-render-source.test.ts:403`, `viewer-render-source.test.ts:435`, `viewer-render-source.test.ts:438`, `viewer-render-source.test.ts:445`). Runtime Screen focused tests still cover dynamics injection and Parts visibility (`viewer-runtime-screen.test.ts:358`, `viewer-runtime-screen.test.ts:484`). |
| Cache key covers source-relevant invalidation inputs without byte hashing | Pass | Cache key includes package/revision and atlas/source graph inputs (`viewer-atlas-runtime-source-cache.ts:32`), atlas layout/placement/binary identity (`viewer-atlas-runtime-source-cache.ts:66`), and bound Drawable mesh/texture/binary metadata (`viewer-atlas-runtime-source-cache.ts:145`). The stale invalidation test proves a source-relevant mesh UV change misses the cache. |
| Performance instrumentation not added; tests/counters are enough | Pass | No production counters were required. Hook-count tests directly prove the heavy work is not repeated on cache hits (`viewer-render-source.test.ts:226`). |

## Test Commands / Results Considered

Commands rerun by this review:

- `pnpm.cmd exec vitest run apps/editor/src/workspace/viewer/viewer-render-source.test.ts`
  - sandbox: failed before tests with Vite/esbuild `spawn EPERM`;
  - escalated rerun: pass, 1 file / 13 tests.
- `pnpm.cmd exec vitest run apps/editor/src/workspace/viewer/viewer-runtime-screen.test.ts`
  - sandbox: failed before tests with Vite/esbuild `spawn EPERM`;
  - escalated rerun: pass, 1 file / 14 tests.
- `pnpm.cmd typecheck`: pass.
- `node scripts/check-source-organization.mjs`: pass.
- `node scripts/check-dependencies.mjs`: pass.
- `git diff --check`: pass; LF-to-CRLF working-copy warnings only.

Gnome-reported verification matched the focused test results above and was accepted as consistent with this review's rerun.

## Residual Test Gaps

- No browser pixel proof or measured frame-time trace was run. This is acceptable for Domain A because Wave96 allows the proof to rest on focused cache/hook counters when instrumentation is not added.
- No single Runtime Screen test combines Atlas Runtime with applied-atlas dynamics and Parts visibility. Current coverage is adequate but a future integration smoke could add that scenario if Runtime Screen fixture setup becomes cheap.
- Projection remap allocation churn is not measured. Domain A intentionally fixed source resolution/hash repetition first.

## Required Fixes

None.
