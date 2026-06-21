# Wave96 Domain A Spec Compliance Review

Verdict: `pass`

Review-Sylph は basis 文書、Domain A report、実装 source、focused tests を直接確認した。blocking / major / minor の spec compliance finding はない。

## Evidence Reviewed

- `discussion/implementation/orchestration/wave96-plan.md`
  - cache behavior / stale / missing placement scope: lines 56-67, 229-246, 248-264.
  - review gate focus: lines 333-346.
- `discussion/implementation/orchestration/wave89-plan.md`
  - runtime-eligible Drawable scope / Original mode guard: lines 90-112, 254-270.
- `discussion/implementation/waves/wave89/wave89-final-integration-report.md`
  - Wave89 final behavior for Original mode / Drawable Pool omission: lines 74-84, 136.
- `discussion/implementation/waves/wave95/wave95-final-integration-report.md`
  - prior baseline / forbidden-scope stability: lines 68-75, 81-96, 108-112.
- `discussion/implementation/waves/wave96/wave96-domain-a-viewer-atlas-runtime-static-source-cache-report.md`
  - cache key / invalidation explanation / verification: lines 32-59, 68-95, 102-114, 121-140.
- Review target source/tests:
  - `apps/editor/src/workspace/viewer/viewer-atlas-runtime-source-cache.ts`
  - `apps/editor/src/workspace/viewer/viewer-render-source.ts`
  - `apps/editor/src/workspace/viewer/viewer-render-source.test.ts`
  - `apps/editor/src/workspace/viewer/viewer-runtime-screen.tsx`
- Supporting source:
  - `packages/authoring-core/src/texture-atlas-targets.ts`
  - `packages/authoring-core/src/texture-atlas-source-signature.ts`
  - `packages/authoring-core/src/authoring-session.ts`

## Findings

- Blocking: none.
- Major: none.
- Minor: none.

## Spec Compliance Checklist

| Requirement | Status | Evidence |
|---|---|---|
| Atlas Runtime が unchanged playback frames で source signature / target selection を繰り返さない | Pass | Runtime Screen は `useMemo` で cache を 1 個作り playback projection へ渡す: `apps/editor/src/workspace/viewer/viewer-runtime-screen.tsx:106`, `apps/editor/src/workspace/viewer/viewer-runtime-screen.tsx:117`。cache hit は uncached work 前に返る: `apps/editor/src/workspace/viewer/viewer-render-source.ts:203`。target selection / source signature は uncached path のみ: `apps/editor/src/workspace/viewer/viewer-render-source.ts:229`。focused hook-count test は unchanged projection 2 回で target/signature hooks が 1 回だけ呼ばれることを固定: `apps/editor/src/workspace/viewer/viewer-render-source.test.ts:199`。 |
| stale detection が normal cache invalidation で隠れない | Pass | cache key は package/authoring revision、atlas layout/source signature/placements、texture metadata、runtime-bound mesh/source fields、binary byte identity を含む: `apps/editor/src/workspace/viewer/viewer-atlas-runtime-source-cache.ts:32`, `apps/editor/src/workspace/viewer/viewer-atlas-runtime-source-cache.ts:46`, `apps/editor/src/workspace/viewer/viewer-atlas-runtime-source-cache.ts:111`, `apps/editor/src/workspace/viewer/viewer-atlas-runtime-source-cache.ts:206`。miss 時の既存 stale comparison は維持: `apps/editor/src/workspace/viewer/viewer-render-source.ts:236`。cache invalidation test は mesh UV mutation 後に `staleSourceSignature` を得る: `apps/editor/src/workspace/viewer/viewer-render-source.test.ts:234`。 |
| runtime-eligible Drawable missing placement の disable reason が維持される | Pass | uncached resolution は current packable targets から runtime Drawable IDs を作り、runtime target の placement 欠落で `missingPlacement` を返す: `apps/editor/src/workspace/viewer/viewer-render-source.ts:248`。focused test は placement を削除して `missingPlacement` を assert: `apps/editor/src/workspace/viewer/viewer-render-source.test.ts:449`。 |
| Wave89 Drawable Pool / unbound Drawable scope が維持される | Pass | `selectTextureAtlasTargets()` は unbound drawable を `unboundDrawablePool` として除外: `packages/authoring-core/src/texture-atlas-targets.ts:105`。Atlas Runtime runtime IDs は packable targets 由来: `apps/editor/src/workspace/viewer/viewer-render-source.ts:248`。remap は drawables / masks / overlays を runtime set へ filter: `apps/editor/src/workspace/viewer/viewer-render-source.ts:415`, `apps/editor/src/workspace/viewer/viewer-render-source.ts:431`。fixture は pool drawable を rig binding 外に置く: `apps/editor/src/workspace/viewer/viewer-render-source.test.ts:580`。test は pool omission を assert: `apps/editor/src/workspace/viewer/viewer-render-source.test.ts:130`。 |
| Original mode behavior が維持され heavy Atlas Runtime work を起動しない | Pass | Original branch は `resolveViewerAtlasRuntimeSource()` や hooks を呼ばず、static availability のみ行う: `apps/editor/src/workspace/viewer/viewer-render-source.ts:180`。Original mode で target selection / signature work が走ると throw する hook test が no-call を assert: `apps/editor/src/workspace/viewer/viewer-render-source.test.ts:167`。unbound pool drawable の Original 表示も維持: `apps/editor/src/workspace/viewer/viewer-render-source.test.ts:80`。 |
| Dynamics / keyform / mask / clipping behavior を意図変更していない | Pass | Runtime projection は現行 parameter/dynamics playback values から current original projection を作ってから Atlas remap する: `apps/editor/src/workspace/viewer/viewer-runtime-screen.tsx:275`。remap は current projection を入力にし、有効な runtime mask relation を落とさない filter を行う: `apps/editor/src/workspace/viewer/viewer-render-source.ts:401`, `apps/editor/src/workspace/viewer/viewer-render-source.ts:431`。non-source dynamics/keyform が Atlas Runtime を stale にしない test: `apps/editor/src/workspace/viewer/viewer-render-source.test.ts:318`。cached keyform/mask behavior test: `apps/editor/src/workspace/viewer/viewer-render-source.test.ts:403`。 |
| Runtime Export / Workspace Save / package-format schemas / mesh generation / dynamics solver / Runtime Player を変更していない | Pass | `git status --short -uall` は Viewer files と Wave96 discussion artifacts のみを表示。`packages/package-format`, runtime export assembly/materialization, `apps/runtime-player`, `packages/runtime-core`, dependency manifests, lockfile に対する scoped `git diff --name-only` は empty。 |

## Tests And Checks Considered

Gnome-reported verification:

- `pnpm.cmd exec vitest run apps/editor/src/workspace/viewer/viewer-render-source.test.ts`: pass, 13 tests. 初回 sandbox run は Vite/esbuild `spawn EPERM`、escalated rerun は pass。
- `pnpm.cmd exec vitest run apps/editor/src/workspace/viewer/viewer-runtime-screen.test.ts`: pass, 14 tests。
- `pnpm.cmd typecheck`: pass。
- `node scripts/check-source-organization.mjs`: pass。
- `node scripts/check-dependencies.mjs`: pass。
- `git diff --check`: pass。LF-to-CRLF working-copy warnings only。

Review-Sylph はこの lane では Vitest を再実行していない。review-side supplemental checks は read-only / non-destructive のみ:

- `git status --short -uall`
- forbidden schema/export/runtime-player/runtime-core/dependency paths への scoped `git diff --name-only`
- `git diff --check`

## Residual Risks

- cache key は cache hit で byte hashing を意図的に行わない。通常の source texture change は binary entry byte length/object identity/metadata で miss させ、miss 後に既存の exact source-signature check を実行する。既存 `Uint8Array` の in-place mutation が length/ref/metadata unchanged のまま起きると cache invalidation されない。このリスクは Domain A report に記録済みであり、authoring-core が loaded session 内の package-local binary bytes を immutable と明記しているため、この wave では許容できる: `packages/authoring-core/src/authoring-session.ts:65`。
- cache-hit path は key 作成のため lightweight graph/source metadata scan をまだ行う。これは per-frame target selection / source signature / byte hashing を除去する Wave96 要件は満たすが、zero-work ではない。
- Browser pixel proof / frame-time measurement は Domain A では未実施。focused hook-count tests が必須 bottleneck removal を直接固定し、projection/runtime-screen tests が visual/runtime semantics を補完している。

## Required Fixes

None.
