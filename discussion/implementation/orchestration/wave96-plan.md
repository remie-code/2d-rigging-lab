# Wave 96 Plan: Viewer Atlas Runtime Performance Cache

> Wave96は、Viewer / Runtime View の `Atlas Runtime` が `Original` よりかなり重くなる問題を、Atlas Runtime source resolution / stale check / projection remap の責務分離とキャッシュで解消する。目的は、完成モデル確認時にAtlas RuntimeでもOriginalに近い体感で動かせるようにすることである。

## 1. Status

- Status: Planned / ready for orchestration
- Target wave: Wave96
- Wave name: `viewer-atlas-runtime-performance-cache`
- Primary objective:
  - Viewer `Atlas Runtime` 選択時に、runtime playback frameごとに元texture bytesをhashしない。
  - `selectTextureAtlasTargets()` / `createTextureAtlasSourceSignature()` / placement validationの重い静的処理を、session / atlas stateが変わった時だけ実行する。
  - Atlas Runtimeの見た目、対象Drawable、stale detection、clipping/mask、dynamics/keyform挙動は維持する。
  - Original modeの既存responsibilityは維持する。
  - まずsource resolution cacheを本命にし、必要に応じてprojection remap allocationを削減する。

## 2. Planning Gate Result

Planning Gate result: `Plan directly`.

Why planning is now safe:

- ユーザー観察として、ほぼ完成したモデルをViewer `Atlas Runtime`で確認すると、`Original`と比べて明確に重いことが確認された。
- Read-only Sylph調査で、Viewer playback frameごとに `createViewerRuntimeCleanStageProjection()` が走り、Atlas Runtime選択時だけ `resolveViewerAtlasRuntimeSource()` が `selectTextureAtlasTargets()` と `createTextureAtlasSourceSignature()` を実行し、元texture bytesをhashしている可能性が高いことが確認された。
- 描画自体はOriginal/Atlas Runtimeともに同じ `renderCanvasProjection()` / WebGL2経路であり、継続的な重さの最有力原因は描画ではなくAtlas Runtime source/stale validationのper-frame再計算である。
- ユーザー価値は明確で、UX仕様変更ではなく既存Atlas Runtime確認モードの性能改善である。

Uncertainty:

- factual: medium. source resolution cacheだけで体感差が十分消える可能性は高いが、projection remap allocationやmask/WebGL側の寄与は実装後に確認する必要がある。
- decision: low. product semanticsは変更しない。
- cost of wrong plan: medium. cache invalidationを誤るとstale atlasを正しくdisableできないため、テストはstale detection維持を重視する。

## 3. Accepted Decisions / Oracles

### 3.1 No UX / Semantics Change

Required:

- Viewer `Atlas Runtime` はruntime/export相当の確認モードであり続ける。
- Runtime graph所属Drawableだけを対象にするWave89 semanticsを維持する。
- Drawable Pool / unbound DrawableはAtlas Runtime projectionに含めない。
- `Original` modeの描画責務は変更しない。
- Dynamics / keyform / clipping / opacity / Parts visibility / masks はAtlas Runtimeでも従来通り反映される。

Forbidden:

- Atlas target selection semanticsを変更する。
- Atlas Runtimeでunbound Drawableを再び描画対象に戻す。
- stale判定を外す。
- Canvas editor側にAtlas Runtime描画責務を広げる。
- Runtime Export formatやWorkspace Save formatを変更する。

### 3.2 Static Atlas Source Resolution Cache

Required:

- Atlas Runtimeの静的source resolutionをruntime frameごとに再実行しない。
- 重い処理は、session / package revision / atlas layout / atlas source signature / source texture state が変化した時だけ再計算する。
- 少なくとも以下はcache対象にする:
  - Atlas page availability;
  - runtime-eligible target set;
  - placement lookup;
  - source signature / stale status;
  - missing placement / stale disabled reason.
- cacheはstale stateを隠さない。
- cache hit時に元texture bytes全走査hashが増えないことをテストで固定する。

Accepted implementation shapes:

- React側で `useMemo` / explicit cache object を持ち、dynamic projection remapへ静的Atlas sourceを渡す。
- `viewer-render-source.ts` 側に純粋な static source resolver と dynamic remapper を分離する。
- session object identityだけに依存するのではなく、package revision / atlas layout / source signature等の明示的なinvalidating keyを使う。

### 3.3 Dynamic Projection Remap

Required:

- per-frameに必要な処理は、現在のparameter/dynamics結果を反映したprojectionへAtlas texture / UV / runtime drawable filteringを適用することに限定する。
- Atlas texture bytes / dimensions / content signature はcache済みstatic sourceから参照する。
- UV remapやmask relation filteringが過剰なallocationをしている場合は、低リスクな範囲で削減する。

Accepted:

- remap allocation削減はsource resolution cache後の第2優先。
- static/dynamic分離のために小さなhelper typeを追加してよい。

### 3.4 Performance Instrumentation

Required:

- 既存のperformance instrumentationを壊さない。
- 必要なら、低侵襲なtiming/counterを追加してよい:
  - `viewer.atlasRuntime.resolveSource.ms`
  - `viewer.atlasRuntime.remapProjection.ms`
  - `viewer.atlasRuntime.sourceSignature.cacheHit`
  - `viewer.atlasRuntime.sourceSignature.cacheMiss`
- instrumentation追加はoptionalではなく、実装判断として「必要なら入れる」。入れない場合は、既存カウンタとテストで十分な理由をDomain reportに書く。

Forbidden:

- console spam。
- production UIに性能デバッグ表示を出す。
- localStorage設定なしで大量ログを出す。

### 3.5 Texture / Render Cache Preservation

Required:

- WebGL texture cacheの `textureId + contentSignature` semanticsを壊さない。
- Atlas texture uploadが毎frame発生しないことを既存/追加テストまたは性能カウンタで確認する。
- 2D fallback canvas cacheを壊さない。

## 4. Primary Basis

Common:

- [Implementation Orchestration Skill](../../../.agents/skills/implementation-orchestration/SKILL.md)
- [Source File Organization Policy](../../development_convention/source-file-organization-policy.md)
- [Dependency Policy](../../development_convention/dependency-policy.md)
- [Operation Policy](../../development_convention/operation-policy.md)

Wave baseline:

- [Wave87 Plan](wave87-plan.md)
- [Wave88 Plan](wave88-plan.md)
- [Wave89 Plan](wave89-plan.md)
- [Wave92 Plan](wave92-plan.md)
- [Wave95 Plan](wave95-plan.md)
- [Wave89 Final Integration Report](../waves/wave89/wave89-final-integration-report.md)
- [Wave95 Final Integration Report](../waves/wave95/wave95-final-integration-report.md)

Known source facts from Sylph investigation:

- `apps/editor/src/workspace/viewer/viewer-runtime-screen.tsx`
  - `requestAnimationFrame` playback loop updates runtime state.
  - `createViewerRuntimeCleanStageProjection()` is entered during playback updates.
- `apps/editor/src/workspace/viewer/viewer-render-source.ts`
  - `Original` mostly returns original projection.
  - `Atlas Runtime` calls `resolveViewerAtlasRuntimeSource()`.
  - `resolveViewerAtlasRuntimeSource()` performs atlas page/binary validation, target selection, source signature comparison, and placement validation.
  - `remapProjectionToAtlasRuntime()` filters runtime drawables and remaps texture/UV data.
- `packages/authoring-core/src/texture-atlas-targets.ts`
  - `selectTextureAtlasTargets()` scans targets and clones source texture bytes.
- `packages/authoring-core/src/texture-atlas-source-signature.ts`
  - `createTextureAtlasSourceSignature()` hashes target texture bytes.
- `apps/editor/src/workspace/canvas/canvas-renderer.ts`
  - Original/Atlas Runtime both render through `renderCanvasProjection()`.
  - raw RGBA 2D fallback canvas is cached.
- `packages/render-webgl2/src/webgl2-textures.ts`
  - WebGL texture upload is cached by texture id / content signature.

Likely implementation areas:

- `apps/editor/src/workspace/viewer/viewer-render-source.ts`
- `apps/editor/src/workspace/viewer/viewer-render-source.test.ts`
- `apps/editor/src/workspace/viewer/viewer-runtime-screen.tsx`
- `apps/editor/src/workspace/viewer/viewer-runtime-screen.test.ts`
- `packages/authoring-core/src/texture-atlas-source-signature.ts`
- `packages/authoring-core/src/texture-atlas-targets.ts`
- existing performance instrumentation files under `packages/render-core/src/**` if timing/counters are added.

## 5. Wave Strategy

Wave96 should run in ordered batches.

```text
Batch 1:
  Domain A: Viewer Atlas Runtime Static Source Cache + Focused Performance Tests

Batch 2:
  Domain B: Final Integration / Clean Review / Map Closeout
```

Dependency rationale:

- The highest-confidence bottleneck is localized to Viewer Atlas Runtime source resolution.
- Splitting source resolution cache and projection remap across parallel implementation domains would create overlapping edits in `viewer-render-source.ts`.
- A single implementation domain keeps cache invalidation semantics coherent and reduces review overhead.
- Final integration should happen after Domain A confirms stale detection and visual/runtime semantics are preserved.

## 5.1 Domain Design

| Batch | Domain | Dependency | Parallelism | Purpose |
|---|---|---|---|---|
| 1 | A. Viewer Atlas Runtime Static Source Cache + Focused Performance Tests | Wave89/95 final pass + Sylph performance investigation | First / single implementation domain | Cache static Atlas Runtime source resolution, preserve stale detection, reduce per-frame source signature/hash work, add focused regression/perf tests |
| 2 | B. Final Integration / Clean Review / Map Closeout | Domain A pass or explicit escalation | Final only | Validate behavior, tests, forbidden-scope compliance, and record final artifacts |

## 6. Domain A: Viewer Atlas Runtime Static Source Cache + Focused Performance Tests

Domain id: `wave96-viewer-atlas-runtime-static-source-cache`

Purpose:

- Stop Atlas Runtime from recomputing source signature / target selection / stale validation every playback frame.
- Preserve existing Viewer Atlas Runtime semantics and stale-disable behavior.

Allowed write scope:

- `apps/editor/src/workspace/viewer/viewer-render-source.ts`
- `apps/editor/src/workspace/viewer/viewer-render-source.test.ts`
- `apps/editor/src/workspace/viewer/viewer-runtime-screen.tsx`
- `apps/editor/src/workspace/viewer/viewer-runtime-screen.test.ts`
- narrowly scoped new viewer helper files under `apps/editor/src/workspace/viewer/` if needed.
- narrowly scoped performance instrumentation additions under:
  - `packages/render-core/src/**`
  - `apps/editor/src/workspace/viewer/**`
- Domain A report/review files under `discussion/implementation/waves/wave96/` and `discussion/implementation/reviews/wave96/`

Conditional write scope, requiring explicit report justification:

- `packages/authoring-core/src/texture-atlas-source-signature.ts`
- `packages/authoring-core/src/texture-atlas-targets.ts`
- `apps/editor/src/workspace/canvas/canvas-renderer.ts`
- `packages/render-webgl2/src/**`

Forbidden write scope:

- Texture Atlas packing/generation algorithm changes.
- Runtime Export format changes.
- Workspace Save format changes.
- package-format schema changes.
- Mesh generation changes.
- Dynamics solver changes.
- Runtime Player app changes.
- dependencies / lockfile.

Required implementation:

- Separate Atlas Runtime static source resolution from dynamic projection remap.
- Ensure static source resolution is memoized/cached across runtime playback frames.
- Cache invalidation must account for:
  - session/package identity or revision;
  - atlas layout identity/content;
  - source signature state;
  - atlas binary/page identity;
  - source texture state used by stale detection.
- Cache hit path must not call `createTextureAtlasSourceSignature()` or re-hash source texture bytes.
- Preserve `Original` mode behavior and ensure Original does not trigger heavy Atlas Runtime source resolution.
- Preserve Atlas Runtime disable reasons:
  - missing layout;
  - stale source;
  - missing placement for runtime-eligible Drawable;
  - missing atlas binary/page.
- Preserve runtime graph Drawable scope from Wave89.
- Preserve clipping/mask and Dynamics/keyform playback behavior.

Required tests:

- Repeated Atlas Runtime projection calls with unchanged session/atlas state:
  - return valid projection;
  - do not recompute source signature / target selection beyond the initial miss;
  - keep output Drawable texture/UV remapping stable.
- Stale atlas case:
  - cache invalidates or reports stale when source texture/signature state changes;
  - Atlas Runtime remains disabled with the correct reason.
- Missing placement case:
  - runtime-eligible Drawable missing placement still disables Atlas Runtime.
  - unbound Drawable missing placement does not disable Atlas Runtime.
- Original mode guard:
  - Original projection path does not trigger heavy Atlas Runtime signature/target work.
- Runtime playback smoke:
  - Dynamics/keyform values still affect Atlas Runtime projection.
  - Parts visibility / masks remain preserved where existing fixtures cover them.
- If instrumentation is added:
  - counters/timings are gated by existing performance instrumentation policy.

Required evidence:

- Explain the cache key / invalidation basis.
- Explain which work moved from per-frame to static resolution.
- Include before/after trace or test evidence showing source signature/hash work is not repeated.
- Include residual risk if allocation churn remains visible after source resolution caching.

Escalate if:

- Correct cache invalidation requires changing package-format or workspace persistence schema.
- Source texture mutation can occur without any detectable session/revision/signature change.
- Atlas Runtime stale detection cannot be preserved without per-frame full texture hashing.
- The measured/observed bottleneck remains dominated by WebGL/mask rendering after source resolution cache.

## 7. Domain B: Final Integration / Clean Review

Domain id: `wave96-final-integration-clean-review`

Dependencies:

- Domain A `pass`

Purpose:

- Validate combined performance fix and behavior preservation.
- Confirm no atlas generation/export/schema/runtime-player drift.
- Record final reports/reviews/maps.

Allowed write scope:

- `discussion/implementation/waves/wave96/**`
- `discussion/implementation/reviews/wave96/**`
- orchestration/review/wave maps if status updates are required.

Required checks:

- Domain A report/review lanes are present.
- Focused Viewer Atlas Runtime cache tests.
- Focused Original mode guard tests.
- Focused stale/missing placement tests.
- Existing Viewer render source tests.
- Existing Texture Atlas / Viewer Runtime focused tests that Domain A touched.
- `pnpm typecheck`, or explicit known unrelated failure classification.
- `node scripts/check-source-organization.mjs`.
- `node scripts/check-dependencies.mjs`.
- `git diff --check`.
- Forbidden-scope diff check:
  - no Runtime Export format changes;
  - no Workspace Save format changes;
  - no package-format schema changes;
  - no mesh generation changes;
  - no dynamics solver changes;
  - no Runtime Player changes;
  - no dependency/lockfile changes.

## 8. Review Policy

Domain A requires independent review lanes:

1. Spec Compliance Review
2. Design / Development Compliance Review
3. Test Adequacy Review

Spec Compliance Review must explicitly check:

- Atlas Runtime no longer performs source signature / target selection per playback frame.
- stale detection is preserved.
- missing placement disable reasons are preserved.
- Wave89 runtime-eligible Drawable scope is preserved.
- Original mode behavior is preserved.
- Dynamics/keyform/mask/clipping behavior is not intentionally changed.

Design / Development Review must explicitly check:

- cache key and invalidation are explicit and defensible.
- cache is not keyed only on fragile UI state.
- static source resolution and dynamic remap responsibilities are separated clearly.
- no source organization violation or catch-all file growth.
- no forbidden schema/export/atlas-generation/runtime-player/dependency changes.

Test Adequacy Review must explicitly check:

- repeated Atlas Runtime projection cache-hit test.
- stale invalidation test.
- missing placement / unbound Drawable scope test.
- Original mode guard test.
- runtime playback smoke with Atlas Runtime.
- performance instrumentation tests if counters were added.

## 9. Expected Persistent Artifacts

Wave reports:

- `discussion/implementation/waves/wave96/wave96-domain-a-viewer-atlas-runtime-static-source-cache-report.md`
- `discussion/implementation/waves/wave96/wave96-final-integration-report.md`
- `discussion/implementation/waves/wave96/_map.md`

Review reports:

- `discussion/implementation/reviews/wave96/wave96-domain-a-spec-compliance-review.md`
- `discussion/implementation/reviews/wave96/wave96-domain-a-design-development-review.md`
- `discussion/implementation/reviews/wave96/wave96-domain-a-test-adequacy-review.md`
- `discussion/implementation/reviews/wave96/wave96-final-clean-integration-review.md`
- `discussion/implementation/reviews/wave96/_map.md`

## 10. Subagent Contract

Orch-Sylph instructions must include:

- Use this active wave plan as source of truth.
- Start with bounded current-state confirmation for assigned domain.
- Orch-Sylph自身は実装担当ではない。source implementation は必ず別コンテキストの Gnome に委譲し、レビューは必ず別コンテキストの Review-Sylph に委譲すること。これを分離できない場合は実装せず escalate / blocked として報告すること。
- Delegate implementation to Gnome.
- Delegate independent reviews to Review-Sylphs.
- Wait for all started children.
- Treat `wait_agent` timeout as polling timeout.
- Do not close or interrupt running children.
- Close completed child sessions before final domain report.
- Report `pass`, `needs_fix`, `blocked`, or `escalate`.

Gnome instructions must include:

- You are not alone in the codebase.
- Do not revert unrelated changes.
- Work only in allowed scope.
- Do not run `pnpm install`.
- Do not add dependencies.
- Preserve Atlas Runtime visual semantics.
- Preserve stale detection.
- Preserve Original mode behavior.
- Preserve Runtime Export / Workspace Save / package-format schema.
- Include Basis Coverage Self-Report and Deferred Basis Items.

Review-Sylph instructions must include:

- Review source and tests, not only Gnome summary.
- Report `pass`, `needs_changes`, or `escalate`.
- Remain read-only unless explicitly delegated a narrow fix.
- Treat per-frame source signature / target selection in Atlas Runtime playback as blocking.
- Treat stale detection regression as blocking.
- Treat Runtime Export / Workspace Save / package-format / dependency drift as blocking.

## 11. Orchestration Policy

Root / Undine:

- Owns wave plan, user questions, dependency graph, and final report.
- Must not implement Wave96 source changes.
- Must wait for every started subagent.
- Must treat wait timeouts as polling.
- Must not close running children.

Orch-Sylph:

- Owns one domain loop.
- Must start with bounded current-state confirmation.
- Must delegate implementation and review.
- Must wait for Gnome and all Review-Sylphs.
- Must close completed children.
- Must report domain verdict and evidence.

No parent may pass the wave gate while a child is incomplete, running, or unresolved.

## 12. Out of Scope

- Texture Atlas packing/generation algorithm changes.
- Workspace Directory Export changes.
- Runtime Export format changes.
- Workspace Save format changes.
- package-format schema changes.
- Mesh generation changes.
- Dynamics solver changes.
- Runtime Player app changes.
- Web Worker conversion.
- Renderer architecture rewrite.
- Mask/clipping redesign before source resolution cache evidence.
- Browser pixel proof as a blocker.
- New dependencies.
- Cubism SDK / `.moc3` / `.model3.json` / `.physics3.json` compatibility.
