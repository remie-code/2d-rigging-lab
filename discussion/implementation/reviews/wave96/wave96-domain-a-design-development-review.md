# Wave96 Domain A Design / Development Compliance Review

## Verdict

Verdict: `pass`.

Design / Development Compliance Review found no blocking findings. The implementation separates Atlas Runtime static source resolution from dynamic projection remap, uses an explicit invalidating cache key, preserves the existing uncached validation path on misses, and stays inside the allowed source/dependency/operation boundaries.

## Evidence Reviewed

Basis documents:

- `discussion/implementation/orchestration/wave96-plan.md`
  - Domain A required static cache, invalidation inputs, cache-hit no-signature/hash work, stale/missing-placement preservation, and forbidden scope: lines 54-87, 189-267, 340-347.
- `discussion/development_convention/source-file-organization-policy.md`
  - single-responsibility/catch-all review requirements: lines 77-103 and 126-140.
- `discussion/development_convention/dependency-policy.md`
  - no unapproved dependency/lockfile changes: lines 331-399 and 416-426.
- `discussion/development_convention/operation-policy.md`
  - package mutation must go through Operation Core; runtime-only evaluation is non-mutating: lines 34-38, 348-374.
- `discussion/implementation/waves/wave89/wave89-final-integration-report.md`
  - Original mode guard and Wave89 runtime drawable scope baseline: lines 70-84.

Reviewed implementation/report files:

- `apps/editor/src/workspace/viewer/viewer-atlas-runtime-source-cache.ts`
- `apps/editor/src/workspace/viewer/viewer-render-source.ts`
- `apps/editor/src/workspace/viewer/viewer-render-source.test.ts`
- `apps/editor/src/workspace/viewer/viewer-runtime-screen.tsx`
- `discussion/implementation/waves/wave96/wave96-domain-a-viewer-atlas-runtime-static-source-cache-report.md`

Supporting source checked for assumptions:

- `packages/authoring-core/src/texture-atlas-targets.ts`
- `packages/authoring-core/src/texture-atlas-source-signature.ts`
- `packages/authoring-core/src/authoring-session.ts`
- `apps/editor/src/workspace/canvas/canvas-render-scene-adapter.ts`
- `packages/render-core/src/texture-signature.ts`
- `packages/render-webgl2/src/webgl2-textures.ts`

## Findings

- Blocking: none.
- Major: none.
- Minor: none requiring changes.
- Info: `viewer-atlas-runtime-source-cache.ts` keys binary entries by byte length plus `Uint8Array` identity, not by byte content, at lines 206-230. This intentionally avoids per-frame byte hashing and is acceptable under the current repository contract that package-local binary bytes are immutable within a loaded session (`packages/authoring-core/src/authoring-session.ts` lines 65-66). Domain A documents the same source-byte in-place mutation residual risk at report lines 57-59 and 136-140.
- Info: cache-key generation still scans graph/layout metadata and serializes the key every Atlas Runtime projection (`viewer-render-source.ts` lines 203-204; `viewer-atlas-runtime-source-cache.ts` lines 32-44 and 111-190). This is not a compliance issue because the cache-hit path returns before target selection/signature/hash hooks, but it remains a performance residual risk already documented at report line 138.

## Design / Development Checklist

- Cache key and invalidation are explicit and defensible: pass.
  - The key includes package identity/revisions, atlas layout/pages/placements/settings/source signature, atlas binary identity, runtime-bound source graph state, mesh/source texture metadata, and source binary identity (`viewer-atlas-runtime-source-cache.ts` lines 32-44, 46-108, 111-190, 193-230).
- Cache is not keyed only on fragile UI state: pass.
  - The cache key is generated from `AuthoringSession`, not from `renderSourceMode` or transient control state (`viewer-render-source.ts` line 203; `viewer-atlas-runtime-source-cache.ts` lines 32-44).
- Static source resolution and dynamic projection remap are separated: pass.
  - Static availability/layout/page/binary/placement validation is isolated in `resolveViewerAtlasRuntimeStaticSource()` (`viewer-render-source.ts` lines 281-399).
  - Uncached exact stale/missing-placement validation is isolated in `resolveViewerAtlasRuntimeSourceUncached()` (`viewer-render-source.ts` lines 218-279).
  - Dynamic per-frame filtering/UV remap consumes the resolved source in `remapProjectionToAtlasRuntime()` (`viewer-render-source.ts` lines 401-479).
- Cache hit cannot call target selection/source signature/hash work: pass.
  - `resolveViewerAtlasRuntimeSource()` reads the cache and returns immediately on hit before `resolveViewerAtlasRuntimeSourceUncached()` can call hooks (`viewer-render-source.ts` lines 194-216).
  - Focused tests assert unchanged Atlas Runtime projections call target selection/signature/same-signature only once (`viewer-render-source.test.ts` lines 199-232).
- Cache miss preserves exact validation using existing hooks: pass.
  - Miss path calls `selectTextureAtlasTargets()`, `createTextureAtlasSourceSignature()`, and `sameTextureAtlasSourceSignature()` through existing hook plumbing (`viewer-render-source.ts` lines 218-246 and 522-530).
- Runtime Screen uses the static cache across playback frames: pass.
  - `ViewerRuntimeScreen` creates one cache with `useMemo()` and passes it through clean-stage projection creation (`viewer-runtime-screen.tsx` lines 106, 117-139, 243-291).
- Original mode guard is preserved: pass.
  - Original mode does not call heavy Atlas target/signature hooks, even when a cache object is supplied (`viewer-render-source.test.ts` lines 167-197).
- Source organization is acceptable: pass.
  - New helper file is scoped to Viewer Atlas Runtime source-cache key/read/write responsibility.
  - No broad `index.ts`, `types.ts`, `schemas.ts`, `utils.ts`, or `helpers.ts` growth was introduced.
  - `node scripts/check-source-organization.mjs` passed.
- Forbidden scope compliance: pass.
  - Reviewed status/diff shows no package-format schema, Runtime Export, Workspace Save, atlas packing/generation, mesh generation, dynamics solver, Runtime Player, dependency, or lockfile source changes.
  - `git diff -- package.json pnpm-lock.yaml` was empty.
  - `node scripts/check-dependencies.mjs` passed.
- Operation policy compliance: pass.
  - Changes are Viewer runtime projection/cache reads only; no model package mutation path was introduced.

## Tests / Checks Considered

Reviewer-rerun checks:

- `pnpm.cmd exec vitest run apps/editor/src/workspace/viewer/viewer-render-source.test.ts`: pass, 13 tests.
- `pnpm.cmd exec vitest run apps/editor/src/workspace/viewer/viewer-runtime-screen.test.ts`: pass, 14 tests.
- `pnpm.cmd typecheck`: pass.
- `node scripts/check-source-organization.mjs`: pass.
- `node scripts/check-dependencies.mjs`: pass.
- `git diff --check`: pass; emitted LF-to-CRLF working-copy warnings only.

Gnome-reported verification was also considered and matched the reviewer rerun results.

Working tree note:

- `git status --short -uall` showed the expected Viewer source/test changes, the new cache helper, Wave96 plan/domain report files, this review report, sibling Wave96 review artifacts, and an existing `discussion/implementation/orchestration/_map.md` modification. No dependency or lockfile diff was present.

## Residual Risks

- In-place mutation of existing source or atlas `Uint8Array` bytes without revision/ref/object identity/length change remains invisible to this cache and to existing texture-signature caching. This is acceptable for Wave96 because current authoring-core treats package-local binary bytes as immutable within a loaded session.
- Cache-key creation still performs per-frame metadata traversal and JSON serialization when Atlas Runtime cache is supplied. It avoids the intended heavy work: target selection, structured target cloning, source signature creation, and source byte hashing.
- `remapProjectionToAtlasRuntime()` allocation behavior is largely unchanged. If Atlas Runtime remains perceptibly heavier after source resolution caching, a later wave should profile remap allocation and renderer/mask costs.
- Direct graph mutation outside Operation Core could theoretically bypass revision-based invalidation assumptions. That path is already forbidden by operation policy and was not introduced by this change.

## Required Fixes

None.
