# Wave96 Domain A Report: Viewer Atlas Runtime Static Source Cache

## Verdict

Verdict: `pass`.

Viewer / Runtime View の `Atlas Runtime` で、runtime playback frame ごとに `selectTextureAtlasTargets()` / `createTextureAtlasSourceSignature()` / source texture byte hash を再実行しない cache 経路を追加した。Atlas Runtime の見た目、stale detection、missing placement、Original mode、Wave89 runtime Drawable scope は維持した。

## Basis Coverage Self-Report

- `discussion/implementation/orchestration/wave96-plan.md`: Domain A 要件、allowed/forbidden scope、required tests を確認して反映。
- `discussion/implementation/orchestration/wave89-plan.md` と `discussion/implementation/waves/wave89/wave89-final-integration-report.md`: Original mode guard と Drawable Pool / unbound Drawable 除外 semantics を維持。
- `discussion/implementation/orchestration/wave95-plan.md` と `discussion/implementation/waves/wave95/wave95-final-integration-report.md`: mesh generation / runtime export / atlas algorithm 非干渉を確認。
- `.agents/skills/implementation-orchestration/SKILL.md`: Gnome 実装、Review-Sylph 分離、report 証跡の前提を確認。
- `discussion/development_convention/source-file-organization-policy.md`: Viewer 専用 helper に cache/key 責務を分離し、guard pass。
- `discussion/development_convention/dependency-policy.md`: dependency / lockfile 変更なし、guard pass。
- `discussion/development_convention/operation-policy.md`: package mutation なし。Viewer runtime projection の non-mutating 経路のみ変更。

## Deferred Basis Items

- Browser pixel proof / frame-time measurement は未実施。Wave96 plan では source resolution cache 後の確認対象だが、Domain A では focused hook counter tests と existing renderer cache semantics で per-frame heavy work elimination を固定した。
- Projection remap allocation 削減は未実施。今回の主要 bottleneck である source resolution / source signature / source byte hashing の per-frame 実行を先に除去した。

## Current-State Confirmation

- 変更前は `createViewerRuntimeCleanStageProjection()` が playback state 更新ごとに `createViewerCleanStageRenderSourceProjection()` を呼び、`Atlas Runtime` の場合に `resolveViewerAtlasRuntimeSource()` へ到達していた。
- `resolveViewerAtlasRuntimeSource()` は毎回 `selectTextureAtlasTargets()` と `createTextureAtlasSourceSignature()` を呼び、source texture bytes を hash して stale check していた。
- `Original` mode は既に heavy hooks を呼ばない guard があり、その挙動は維持した。

## Implementation Summary

- `apps/editor/src/workspace/viewer/viewer-atlas-runtime-source-cache.ts` を追加。
  - explicit cache object `ViewerAtlasRuntimeSourceCache` を追加。
  - cache key 生成、read/write を Viewer 専用 helper に分離。
- `apps/editor/src/workspace/viewer/viewer-render-source.ts`
  - `createViewerRenderSourceProjection()` に optional `atlasRuntimeSourceCache` を追加。
  - cache hit 時は cached `ViewerAtlasRuntimeSourceResult` を返し、signature / target selection を呼ばない。
  - cache miss 時は既存 validation を `resolveViewerAtlasRuntimeSourceUncached()` で実行し、結果を cache する。
  - dynamic remap は従来通り `remapProjectionToAtlasRuntime()` に閉じた。
- `apps/editor/src/workspace/viewer/viewer-runtime-screen.tsx`
  - `useMemo(() => createViewerAtlasRuntimeSourceCache(), [])` で Runtime Screen lifetime の cache を保持。
  - runtime playback frame ごとに変わる `parameterValues` から original projection を作り、cached static Atlas Runtime source を `createViewerRenderSourceProjection()` に渡す。
- `apps/editor/src/workspace/viewer/viewer-render-source.test.ts`
  - cache hit counter test、cache invalidation stale test、Original guard with cache、keyform/mask dynamic remap smoke を追加。

## Cache Key / Invalidation Basis

Cache key version: `viewer-atlas-runtime-source-cache-key-v1`.

Invalidation inputs:

- package identity and revision: `packageId`, `formatVersion`, `packageRevision`, `authoringRevision`;
- atlas layout identity/content: texture atlas texture entries, `layoutId`, `atlasTextureId`, `sourceTexturePolicy`, `generatedByOperationId`, settings, source signature, page dimensions, pixel format, placements;
- atlas binary/page identity: atlas texture entry, binary ref metadata, binary entry path/id/media type/byte length, byte object identity;
- runtime-eligible source graph state used by stale detection: rig drawable bindings, draw order, stable order, bound drawable source fields, mesh bounds/vertices/uvs/triangles/stable ids/topology revision, texture entry metadata, source binary entry byte length and byte object identity.

The key deliberately does not hash source texture bytes. On key change, the miss path runs the existing exact stale check via `selectTextureAtlasTargets()`, `createTextureAtlasSourceSignature()`, and `sameTextureAtlasSourceSignature()`.

Source texture byte in-place mutation without revision/ref/object identity/length change is not detectable without byte hashing. Current authoring-core source documents package-local binary bytes as immutable within a loaded session, and normal mutation paths replace metadata/session state rather than mutating the existing `Uint8Array` in place. If a future supported path mutates source `Uint8Array` bytes in place, this cache must be revisited or escalated.

## Work Moved Out Of Per-Frame Path

Cache hit path avoids:

- `selectTextureAtlasTargets()`;
- `createTextureAtlasSourceSignature()`;
- `sameTextureAtlasSourceSignature()`;
- source texture byte fingerprint/hash inside source signature creation;
- placement validation for unchanged static atlas state.

Per-frame dynamic work remains:

- create current Canvas projection from current parameter/dynamics state;
- filter projection to cached runtime drawable ids;
- apply cached atlas texture refs / bytes / dimensions;
- remap current mesh UVs through cached placements;
- filter mask relations, mesh overlays, selected ids, and deformer child ids to runtime drawables.

## Preservation Evidence

- Original mode:
  - Existing guard remains and now also covers a supplied cache object.
  - Test confirms Original does not call target selection, source signature creation, or signature comparison hooks.
- Stale detection:
  - Existing stale source test remains passing.
  - New cache invalidation test mutates source mesh UVs after an available cached result; second projection misses cache, recomputes signature, and returns `staleSourceSignature`.
- Missing placement:
  - Existing runtime-eligible missing placement test remains passing with `missingPlacement`.
- Wave89 runtime Drawable scope:
  - Existing test still verifies unbound Drawable Pool drawables are omitted from Atlas Runtime and do not disable it.
- Clipping/mask and dynamic playback semantics:
  - New Atlas Runtime cache test verifies keyform-driven bounds differ across projections while target/signature hooks run once.
  - New test verifies runtime mask relation is preserved after Atlas Runtime remap.
  - Existing Runtime Screen dynamics/keyform tests remain passing.
- Runtime Export / Workspace Save / package-format / mesh generation / dynamics solver / Runtime Player:
  - No diffs in those paths.

## Performance Instrumentation Decision

No production performance instrumentation was added.

Reason: focused hook-counter tests directly prove the required bottleneck removal: unchanged Atlas Runtime projections call target selection and source signature creation only on initial miss. Adding counters/timers would add surface area without improving this Domain A proof, and Wave96 allows instrumentation only when needed. No console logging or UI debug display was added.

## Tests / Checks Run

- `pnpm.cmd exec vitest run apps/editor/src/workspace/viewer/viewer-render-source.test.ts`
  - sandbox attempt: failed before tests with Vite/esbuild `spawn EPERM`.
  - escalated rerun: pass, 1 file / 13 tests.
- `pnpm.cmd exec vitest run apps/editor/src/workspace/viewer/viewer-runtime-screen.test.ts`
  - escalated rerun after fix: pass, 1 file / 14 tests.
- `pnpm.cmd typecheck`: pass.
- `node scripts/check-source-organization.mjs`: pass.
- `node scripts/check-dependencies.mjs`: pass.
- `git diff --check`: pass; emitted LF-to-CRLF working-copy warnings only, no whitespace errors.

## Forbidden-Scope Compliance

- No Texture Atlas packing/generation algorithm changes.
- No Runtime Export format changes.
- No Workspace Save format changes.
- No package-format schema changes.
- No mesh generation changes.
- No dynamics solver changes.
- No Runtime Player app changes.
- No dependency or lockfile changes.
- No conditional-scope changes in `packages/authoring-core/src/texture-atlas-source-signature.ts`, `packages/authoring-core/src/texture-atlas-targets.ts`, `apps/editor/src/workspace/canvas/canvas-renderer.ts`, or `packages/render-webgl2/src/**`.

## Changed Files

- `apps/editor/src/workspace/viewer/viewer-atlas-runtime-source-cache.ts`
- `apps/editor/src/workspace/viewer/viewer-render-source.ts`
- `apps/editor/src/workspace/viewer/viewer-render-source.test.ts`
- `apps/editor/src/workspace/viewer/viewer-runtime-screen.tsx`
- `discussion/implementation/waves/wave96/wave96-domain-a-viewer-atlas-runtime-static-source-cache-report.md`

## Residual Risks

- Cache key creation still scans lightweight graph/source metadata each frame when Atlas Runtime cache is supplied. It avoids target selection, structured clones, source signature creation, and byte hashing, but it is not a zero-work key check.
- In-place mutation of an existing source `Uint8Array` without any revision/ref/object identity/length change would be invisible to the cache key. Current authoring-core contract treats those bytes as immutable within a loaded session.
- Allocation inside `remapProjectionToAtlasRuntime()` remains similar to the pre-Wave96 path. If source resolution cache does not fully close the perceived performance gap, a later wave should profile projection remap allocation and renderer/mask costs.
