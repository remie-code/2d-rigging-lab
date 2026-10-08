# Wave98 Domain A Design / Development Compliance Review

## Verdict

Verdict: `pass`.

No blocking design/development findings were found. The implementation is scoped to the Viewer runtime playback/projection path plus one API-neutral render-core timing helper fix, uses conservative reuse gates, preserves Wave97 rAF lifecycle semantics, and keeps performance instrumentation behind the existing opt-in flag.

## Basis Read

- `discussion/implementation/orchestration/wave98-plan.md`
- `.agents/skills/implementation-orchestration/SKILL.md`
- `discussion/implementation/orchestration/wave97-plan.md`
- `discussion/implementation/waves/wave97/wave97-final-integration-report.md`
- `discussion/implementation/orchestration/wave96-plan.md`
- `discussion/implementation/waves/wave96/wave96-final-integration-report.md`
- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/development_convention/dependency-policy.md`
- `discussion/development_convention/operation-policy.md`

## Source/Test Evidence Reviewed

- `apps/editor/src/workspace/viewer/viewer-runtime-screen.tsx`
  - Lines 113-141 keep the latest runtime playback frame in React state and a ref, and attach reusable parameter values only to fresh `evaluateViewerRuntimePlaybackFrame(...)` results.
  - Lines 151-181 pass a compatible playback state and the optional reusable snapshot into Clean Stage projection.
  - Lines 224-299 preserve the Wave97 single-rAF lifecycle: one pending `frameRequest`, cleanup via `cancelAnimationFrame`, and rescheduling only while unsettled.
  - Lines 335-402 time Clean Stage projection and pass the reusable snapshot to `resolveViewerRuntimeParameterValues(...)`.
- `apps/editor/src/workspace/viewer/viewer-runtime-playback.ts`
  - Lines 100-151 wrap the existing Viewer frame evaluation in gated counter/timing calls without changing the runtime input shape, delta clamping, max substeps, or result mapping.
  - Lines 153-172 create a reusable snapshot containing the model object, parameter signature, parameter values, state object, and state identity key.
  - Lines 254-287 reuse only when the exact state object matches and compatibility checks pass; otherwise the prior zero-delta fallback remains.
  - Lines 289-302 require same model object, same state identity key, compatible runtime state, and matching parameter signature before reuse.
  - Lines 26-36 and 86-252 show the fixed step, max elapsed/substep constants, settled thresholds, initial-state creation, and settled checks were not changed by this domain.
- `packages/render-core/src/performance-instrumentation.ts`
  - Lines 99-102 change `performance.now()` to be called through its receiver object. The exported API and opt-in policy remain unchanged.
- `apps/editor/src/workspace/viewer/viewer-runtime-screen.test.ts`
  - Lines 375-542 cover reuse skip, stale reusable fallback, no-dynamics no-evaluation path, and instrumentation disabled by default.
- `discussion/implementation/waves/wave98/wave98-domain-a-viewer-dynamics-performance-instrumentation-duplicate-eval-removal-report.md`
  - Reviewed for final metric names, deferred runtime-core counter rationale, verification evidence, and residual risks.
- `discussion/implementation/waves/wave98/_map.md`
  - Reviewed for Domain A report registration.

## Design/Development Findings

- Compatibility/staleness checks are explicit, conservative, and defensible. Reuse requires the same `RuntimeStateDto` object, the same `ViewerRuntimePlaybackModel` object, matching state identity, compatible package identity, and matching base parameter signature. Any mismatch falls back to the existing zero-delta evaluation path.
- React state/ref usage is acceptable. The state+ref helper keeps rAF callbacks current without waiting for a render, while the effect dependencies are keyed by runtime parameter signature, model, and reset token rather than the frame object itself. The `frameRequest !== null` guard and cleanup prevent duplicate rAF scheduling and leaks.
- No broad runtime/renderer architecture rewrite was introduced. The source diff is limited to Viewer screen/playback files and one render-core helper; runtime-core, renderer architecture, export, package-format, mesh, and atlas source cache code were not part of the Domain A target diff.
- No physics formula/rate/threshold/default drift was found. The Viewer evaluation still calls `evaluateRuntimeFrame(...)` with the same delta clamp, fixed max substeps, options, and source/policy metadata. Dynamics solver files were not changed.
- Instrumentation names are coherent with the existing dot-separated performance counter style and remain disabled by default through `globalThis.__LIVE2D_PERF__ === true` or `localStorage.live2dPerf === "1"`.
- The render-core `performance.now()` receiver fix is justified and API-neutral. It avoids unbound receiver failure in Node/Vitest while preserving the fallback to `Date.now()` and all exported helper names.
- Source organization is acceptable. No `index.ts`, broad catch-all file, or new dependency surface was introduced; the existing Viewer files remain responsibility-specific, and the repository guard passes.
- Dependency/lockfile review: Domain A target files do not add dependencies or dependency imports outside existing packages. The workspace currently has unrelated dirty `apps/runtime-player/**` and `pnpm-lock.yaml` changes; per task scope these were treated as pre-existing/unowned. The dependency guard passes.

## Verification Commands/Results

- `git diff -- apps/editor/src/workspace/viewer/viewer-runtime-screen.tsx apps/editor/src/workspace/viewer/viewer-runtime-playback.ts packages/render-core/src/performance-instrumentation.ts`
  - Reviewed. Diff is scoped to Viewer reusable-frame plumbing, Viewer perf metrics, and the render-core `performance.now()` receiver fix.
- `pnpm.cmd typecheck`
  - Pass.
- `node scripts/check-source-organization.mjs`
  - Pass: `Source organization guard passed.`
- `node scripts/check-dependencies.mjs`
  - Pass: `Dependency guard passed.`
- `git diff --check`
  - Pass. Git emitted LF-to-CRLF working-copy warnings only; no whitespace errors.
- `pnpm.cmd exec vitest run apps/editor/src/workspace/viewer/viewer-runtime-screen.test.ts apps/editor/src/workspace/viewer/runtime-controls-state.test.ts packages/render-core/src/render-scene.test.ts`
  - Initial sandboxed attempt failed with `spawn EPERM` while Vite/esbuild loaded config.
  - Re-run with escalated execution passed: 3 files / 44 tests.

## Blocking Issues

None.

## Residual Risks

- Browser CPU profiling and pixel proof were not run; Wave98 Domain A did not require them as blockers.
- Runtime-core group/substep counters remain deferred because wiring the existing render-core instrumentation into runtime-core would require dependency-direction or manifest changes.
- The working tree includes unrelated dirty Runtime Player and lockfile files outside Domain A ownership. This review did not adjudicate those changes.
