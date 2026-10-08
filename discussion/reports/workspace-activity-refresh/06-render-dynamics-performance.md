# Render / Dynamics / Performance — Workspace Activity Refresh

調査日: 2026-08-08。対象は現行の render、dynamics、texture-atlas/UV 契約、Editor/Runtime Player 性能である。モデル制作史・メッシュ候補の勝敗史そのものは非目標とした。

## 1. Scope / inspected entry points

先に [workspace-activity-refresh/audit-contract.md](audit-contract.md)、[discussion/_conventions.md](../../_conventions.md)、[discussion/_map.md](../../_map.md) を読み、下記の current owner map から source/test/measurement と Wave 記録へ照合した。

- Design maps: [canvas-evaluation/_map.md](../../design/canvas-evaluation/_map.md)、[mesh-generation/_map.md](../../design/mesh-generation/_map.md)、[mesh-rendering/_map.md](../../design/mesh-rendering/_map.md)、[texture-atlas/_map.md](../../design/texture-atlas/_map.md)。
- Performance maps/reports: [render-performance/_map.md](../../render-performance/_map.md)、[editor-render-performance/_map.md](../editor-render-performance/_map.md)、[player-survey.md](../../render-performance/player-survey.md)。
- 現行 source: `apps/editor/src/workspace/canvas/*`、`packages/render-core`、`packages/render-webgl2`、`packages/render-software`、`packages/authoring-core` の mesh/atlas/export、`packages/runtime-core` の dynamics/evaluation、`apps/runtime-player` の stage renderer/evaluation cache。
- Evidence: Wave66/67/81/85/92/101/106/108/109 final report、Perf Wave 2 measurements、Runtime Player Waves13–19 maps/reports、C7 closure record、Git log/status。

情報種別は、current repository fact、accepted design/policy decision、historical evidence、experiment/manual observation、inference、unresolved human/device gate を以下で分離した。

## 2. Executive summary

1. Editor の表示境界は `CanvasEvaluatedScene` であり、評価済み mesh/UV/opacity/draw-order/mask を `RenderScene` に adapter し、WebGL2 を primary、Canvas2D を fallback/overlay/debug 用途として使う構成が現行である（`canvas-evaluation.ts:31-69`、`canvas-render-scene-adapter.ts:28-72`、`canvas-renderer.ts:125-139`）。
2. Canvas evaluation の実装待ちは残っていない（Wave66）。Wave67 の render-core/WebGL2 foundation も実装 pass だが、semantic/fake-GL pass は実 GPU/readPixels の pixel parity を意味しない（[canvas-evaluation map](../../design/canvas-evaluation/_map.md:21-30)、[Wave67 report](../../implementation/waves/wave67/wave67-final-integration-report.md)）。
3. Wave108 Option E/Wave109 は、生成 UV 非クランプ、層サイズ依存透明 padding/gutter、LINEAR、contentInset、`uvRect` content-sub-rect を editor/export/runtime で共有する契約として実装済み。packing と Runtime Export preflight は `deriveContentSubRectUv` を共有する（`texture-atlas-packing.ts:536-572`、`texture-atlas-content-rect.ts:19-69`、`runtime-export-assembly.ts:788-815`）。
4. Atlas の新規 Generate Preview/Apply は Skyline (`single-page-skyline-v1`) が default、shelf は既存 artifact の read compatibility である（`texture-atlas-packing.ts:25-31`、[texture-atlas map](../../design/texture-atlas/_map.md:20-25)）。AtlasRuntime の透明 margin、cross-bleed、LINEAR端 AA、`original` inset は未解決の目視 gate である。
5. 現行 dynamics は world-frame `dynamics-file-v3` の Verlet chain。`stepChain` は damping/gravity を積分し root→tip の固定長制約を投影、`advanceDynamicsGroupState` は固定 `subSteps` を反復する（`dynamics-evaluation.ts:211-343`）。Wave81 の additivePendulum v2 は historical/superseded であり、Wave106 は schema/semantics の置換で render 性能改善を測定した wave ではない。
6. Editor Perf Wave 2 の実モデル計測では評価 127.2 ms、`artworkBoundsAndAssembly` 75.8%、`deformerVertex` 17%、WebGL mesh upload 1,610 / `bufferData` 3,220。後続 synthetic では medium 1.782 ms、heavy 20.329 ms、rigHeavy 10.616 ms まで改善し、rigControls assembly はほぼゼロになったが、Node 計測は WebGL submit/mask を含まない（[real-model-002](../../render-performance/measurements/real-model-002.md:8-21)、[after-wave2](../../render-performance/measurements/after-wave2-synthetic.md:63-168)）。
7. Runtime Player Waves13–19 は frame pacing、evaluation cache、compiled evaluator、render-frame fast path、軽量 diagnostics、latest-wins/rAF cadence を実装・検証済み。product deep profiler は Wave18 で transport を撤去し、`runtimeCoreProfiling: "deep"` は developer/test 専用である（[render-performance map](../../render-performance/_map.md:40-49)、`runtime-export-pose-evaluator.ts:55-107`、`static-stage-canvas-renderer.ts:339-356,549-586`）。
8. Chrome/Edge と OBS/CEF の near-60fps 差は手動観測であり、Player の 60fps benchmark ではない。C7 二体負荷の CPU/GPU/FPS capture、実 GPU/pixel parity、Canvas2D sunset、AtlasRuntime visual は未計測/未裁定のまま保持する（[runtime-player map](../../runtime-player/implementation/_map.md:327-338)、[C7 closure](../../ai-cohost/implementation/orchestration/c7-closure-record.md:17-21)）。

## 3. What was built or investigated

### 3.1 Render stack and Canvas evaluation

`CanvasEvaluatedScene` は canvas/artwork bounds、evaluated drawables、rig controls、mask relations を境界として持ち、drawable は textureRef、mesh vertices/UV/triangles、bounds、opacity、visibility、draw order を持つ（`apps/editor/src/workspace/canvas/canvas-evaluation.ts:31-69`）。`createRenderSceneFromCanvasProjection` は visible/renderable drawable を RenderScene の texture source/drawable に変換し、mesh の stage coordinates、layer-local UV、triangles、mask relation を維持する（`apps/editor/src/workspace/canvas/canvas-render-scene-adapter.ts:28-95`）。

Editor renderer は WebGL2 stack を試し、stack が無い・context が作れない・render が throw した場合に Canvas2D draw stack へ戻す（`canvas-renderer.ts:125-139,167-215,236-255`）。WebGL2 renderer は draw order と alpha-mask clipping を処理する（`packages/render-webgl2/src/webgl2-renderer.ts:50-91`）。`render-core` の契約は stage-y-down、stage mesh、layer-local top-left 0..1 UV、premultiplied normal blend、drawable-alpha-mask で固定される（`packages/render-core/src/render-scene.ts:1-70`）。

Perf Wave 2 では display-only の `toFixed(12)` string round-trip を tiny-magnitude snap に置き換えた。保存/export の原値は触らず、display geometry の差は epsilon 内という記録である（`canvas-evaluation.ts:1311-1328`）。

### 3.2 Dynamics v3 and runtime evaluation

`stepDynamics` は dt を安定上限へ clamp、reset/zero-dt では state を保持し、それ以外では Verlet chain を一回進める。`advanceDynamicsGroupState` は input/defaults/source を作り、fixed `subSteps` 分だけ `stepDynamics` を反復する（`packages/runtime-core/src/dynamics-evaluation.ts:262-343`）。

Runtime render-frame evaluation は input/previous state/options/context を schema parse し、state compatibility、dynamics、drawable vertex evaluation、render-frame clone を順に実行する（`packages/runtime-core/src/runtime-core.ts:225-311`）。`RuntimeModelInstance.getState()` も `RuntimeStateDtoSchema.parse` を行う（`runtime-model.ts:216-218`）。これらは現行コード上の構造事実であり、Player の実ボトルネック測定結果ではない。

### 3.3 Atlas, UV, and transparent-margin contract

Option E は generator の outward radius を一律 K に抑えず、source texture long-edge に応じた `maxCoverageMarginSourcePixels`（v7 の 0.012×longEdge、4..16 px clamp + blur 1 px）を透明 padding の上限にする（`mesh-generation-coverage-margin.ts:8-58,73-99`）。v6d の約3 px outward はこの下限で覆われる。v6d/v7 の mesh 品質勝敗は別 human hold である。

Wave108 の UV は非クランプで overshoot を自タイル透明帯へ送り、LINEAR/premultiplied sampling で隣接 bleed を避ける。Wave109 は packing writer と Runtime Export preflight が同じ `deriveContentSubRectUv` を呼ぶようにした。`uvRect` は whole padded raster ではなく content sub-rect である（`texture-atlas-content-rect.ts:19-69`、`runtime-export-assembly.ts:788-815`）。WebGL2 texture cache は content signature を key にし、CLAMP_TO_EDGE/LINEAR、premultiplied upload を設定する（`packages/render-webgl2/src/webgl2-textures.ts:19-55,69-82`）。

Software fallback の `sampleTextureLinear` も CLAMP_TO_EDGE の bilinear blend を premultiplied float space で行い、透明帯を補間して fringe を抑える。対応する tests は out-of-range clamp、midpoint blend、透明 premultiplied edge を固定している（`packages/render-software/src/raster/texture-sampler.ts:102-138`、`packages/render-software/src/raster/texture-sampler.test.ts:59-116`）。これは software sampling の契約テストであり、実 GPU pixel parity の証明ではない。

関連する focused test surfaces は `packages/render-core/src/render-scene.test.ts`、`packages/render-webgl2/src/webgl2-renderer.test.ts`、`apps/editor/src/workspace/canvas/canvas-render-scene-adapter.test.ts`、`packages/runtime-core/src/dynamics-evaluation.test.ts` である。Wave の実行結果は Wave reports の集計を根拠とし、この refresh では再実行していない。

### 3.4 Editor and Runtime Player performance work

Editor Perf Wave 2 の選択駆動 rig-control 遅延化、display normalization、clone 削減は current map で accepted close。実モデルと synthetic の before/after は Section 6 に分離した。Renderer 外側の C/60fps pursuit は current product work では再開されていない。

Player 側は scaffold/evaluation cache（`runtime-export-evaluation-cache.ts:81-170`）、compiled model/evaluateRenderFrame fast path、snapshot/public DTO を避ける render-frame 出力、latest-wins live parameter frame と one-rAF scheduling（`static-stage-canvas-renderer.ts:339-356,549-586`）を実装した。Stage scene は pose evaluation、drawable conversion、scene build、cache status を診断 profile として採取するが、deep phase の product transport は無い。

### 3.5 Diagnostics and export support

Wave85 Diagnostics v0 は read-only projection、badges、jumps、mesh/dynamics warnings の surface を pass した。Wave92 Runtime Export v0 は atlas-applied UV/page refs と stale/missing atlas を block する preflight を pass した。どちらも GPU pixel acceptance や Player/OBS benchmark を追加したものではない。

## 4. Current repository state

| 領域 | 現行 repository fact | 証拠種別 / gate |
|---|---|---|
| Canvas evaluation | `CanvasEvaluatedScene` → projection → RenderScene adapter が現行境界。Perf Wave 2 display path は tiny snap。 | source fact (`canvas-evaluation.ts:31-69,1311-1328`); semantic regression と pixel gate open |
| Mesh rendering | WebGL2 primary、Canvas2D fallback/overlay/debug。RenderScene schema と alpha-mask clipping は実装済み。 | accepted design + source (`render-scene.ts:1-70`, `canvas-renderer.ts:125-215`); real GPU/readPixels and Canvas2D sunset open |
| Mesh generation | `auto-outline-v6d-adaptive-contour-constrainautor` が technical/default route、v7 margin-contour は comparison toggle。v6/v7 quality/toggle lifetime は hold。 | map/decision (`design/mesh-generation/_map.md:24,36-46`); product quality not accepted |
| Atlas | `single-page-skyline-v1` default。shelf artifacts read-compatible。Option E transparent margin、content sub-rect UV、Wave109 preflight helper are current. | source + Wave101/108/109 reports; AtlasRuntime visual open |
| Dynamics | world-frame `dynamics-file-v3`, Verlet chain/root→tip constraints, fixed substeps. Wave81 v2 is historical. | source (`dynamics-evaluation.ts:211-343`) + Wave106 report; no render-perf claim |
| Editor performance | Perf Wave 2 accepted close for the Editor interaction path; no real-model-003 rerun recorded after synthetic follow-up. | measurements + user acceptance in map; GPU submit/mask not covered by Node bench |
| Runtime Player | W13–19 implementation/review pass: pacing/cache/compiled fast path/diagnostics/cadence. Wave20 packaged lifecycle, W21 Domain C, W22 real-device speech/vowel gates remain separate. | source + runtime-player map; product/real-device gates open |
| Product diagnostics | Wave85 diagnostics and Wave92 Runtime Export pass. | historical implementation evidence; not a pixel/OBS acceptance |
| Workspace | HEAD at refresh is `af5839452f0968a005cb6cd13c62b714aa4e6d4e` (`docs: refresh discussion maps`). No source/test edits were made by this report task; unrelated parallel worktree changes were preserved. | Git fact; audit contract baseline is separate and must not be conflated with current HEAD |

## 5. Accepted decisions and boundaries

- Render input is evaluated scene/render contract, not raw authoring session; `render-core` is the shared boundary. WebGL2 is primary; Canvas2D is migration fallback/debug/overlay, with sunset still undecided.
- Wave108 Option E is the accepted technical UV/transparent-margin contract: non-clamped layer-local UV, source-size-dependent transparent padding, LINEAR/premultiplied path, and contentInset-derived content sub-rect. Wave109 is the accepted packing/preflight reconciliation.
- Skyline is the accepted new-atlas default; shelf remains read compatibility. User-facing selector, trim, rotation, and multi-page policy are not decided.
- `dynamics-file-v3` world-frame chain supersedes Wave81 additivePendulum v2. Wave106’s pass establishes schema/semantic replacement, not render-performance acceptance.
- v6d is the current technical/default mesh route with implementation evidence; v7 remains comparison toggle. “Accepted default” does not mean product-quality victory or toggle deletion: the v6/v7 human quality hold remains open.
- Editor Perf Wave 2 is accepted for the Editor interaction scope. Runtime Player performance work is the W13–19 fast path/diagnostics/cadence scope; product deep profiler must not be re-exposed merely to obtain numbers.
- Implementation/test pass, synthetic measurement, manual OBS-vs-browser observation, GPU/pixel quality, and real-device speech/voice gates are separate evidence classes. This report does not make new product, UX, hardware, or scope decisions.

## 6. Verification and experiment evidence

### 6.1 Wave implementation/review records

| Wave | Recorded result | Boundary / caveat |
|---|---|---|
| 66 | CanvasEvaluatedScene, evaluated mesh/deform/opacity/rotation, projection boundary implemented; focused semantic/call-level checks passed. | Report explicitly makes no screenshot/pixel-perfect claim; Canvas2D interpolation, full clipping parity and pixel oracle remain outside pass. |
| 67 | `render-core`, `render-webgl2`, Editor adapter, WebGL2-before-Canvas2D fallback implemented; fake-context semantics/typecheck/focused tests pass. | No real GPU/readPixels pixel result; texture padding was not v0. |
| 81 | Additive pendulum/dynamics-file-v2 historical pass. | Superseded by Wave106 v3; do not use as current dynamics truth. |
| 85 | Diagnostics v0 read-only projection/badges/jumps and mesh/dynamics warning surfaces pass. | Diagnostics surface only; no renderer/GPU benchmark. |
| 92 | Runtime Export v0 package/assembly/editor task pass; atlas UV/page refs and stale/missing atlas preflight blockers pass. | No Player/OBS/camera performance claim. |
| 101 | Skyline default focused contract pass: mixed-size non-overlap, within-page, determinism, padding/content/source/UV semantics, Blocking Issues UX. | 8 files / 79 focused tests, typecheck/guards; no browser visual/E2E or full-repo claim. |
| 106 | Destructive replacement to world-frame `dynamics-file-v3`; focused dynamics/editor/player-tuning/authoring-host suites and typecheck pass. | 58 + 50 + 28 + 82 tests as recorded; render packages untouched; no render delta measurement. |
| 108 | Option E non-clamp UV, transparent margin/gutter, LINEAR parity, contentInset mapping across editor/export/runtime. | Typecheck and guards clean; package run 241 files/1492 pass; editor 61/63 with 6 pre-existing/f flaky failures and isolated viewer 27/27. AtlasRuntime visual gate open. |
| 109 | Shared `deriveContentSubRectUv` in packing and export preflight; non-zero inset ready/block behavior covered. | authoring-core 317 and packages 1500 focused passes, typecheck pass; real AtlasRuntime visual still separate. |

### 6.2 Editor performance measurements

- Recorded real-model-002 (92 evaluations): evaluation average 127.2 ms; `artworkBoundsAndAssembly` 96.4 ms (75.8%); `deformerVertex` 21.6 ms (17%); projection 129.4 ms; Canvas caller 92 / render adapter 46; WebGL mesh uploads 1,610 and `bufferData` 3,220; slider events 34 with 7 coalesced ([measurement](../../render-performance/measurements/real-model-002.md:8-21)). This is a recorded measurement, not a current universal benchmark.
- Same-machine Node synthetic after Wave 2: light 0.273 ms, medium 1.782 ms, heavy 20.329 ms, rigHeavy 10.616 ms; rigControls assembly approximately 0.001 ms/eval (about -99.998% in rigHeavy), deformerVertex medium/heavy about -91/-92% ([after-wave2-synthetic](../../render-performance/measurements/after-wave2-synthetic.md:63-141)).
- Synthetic baseline had medium 13.690 ms, heavy 233.393 ms, rigHeavy 89.153 ms; rigHeavy `assembly.rigControls` was 67.824 ms/eval (99.84% of parent) ([baseline-synthetic-v3](../../render-performance/measurements/baseline-synthetic-v3.md:81)).
- The harness does not submit WebGL, masks, GPU driver work, or StrictMode duplicate rendering ([after-wave2-synthetic](../../render-performance/measurements/after-wave2-synthetic.md:164-168)). Thus synthetic improvements and real GPU/pixel acceptance are different gates.

### 6.3 Runtime Player evidence and unmeasured gates

- Player survey records the live chain as parameter/keyform/deformer/dynamics/vertex evaluation → RenderScene → GPU upload, with cache and render-frame fast path reducing public snapshot work ([player-survey](../../render-performance/player-survey.md:48)). It also lists static candidates (runtime `getState()` parse, clones, index rebuild, mask FBO), but labels them hypotheses pending measurement ([player-survey](../../render-performance/player-survey.md:87)).
- Runtime-core has a 15-phase deep profiler and Player stage metrics, but Wave18 removed product deep transport; `runtimeCoreProfiling: "deep"` is developer/test-only ([player-survey](../../render-performance/player-survey.md:151-162), `runtime-export-pose-evaluator.ts:55-107,131-165`).
- Wave19 manual OBS/CEF vs Chrome/Edge comparison found near-60fps applied/render cadence in Chrome/Edge and lower cadence in OBS/CEF. This is manual environment evidence, not FPS/CPU/GPU capture or a 60fps guarantee ([runtime-player map](../../runtime-player/implementation/_map.md:333-338)).
- C7 two-instance load is a user impression (“this PC feels a little heavy”) with no CPU/GPU/FPS capture. Any hardware experiment needs separately declared target and user authorization ([C7 closure](../../ai-cohost/implementation/orchestration/c7-closure-record.md:17-21)).

## 7. Historical progression / turning points

1. **Wave66:** moved Canvas display toward an evaluated-scene boundary. This closed the “evaluation pipeline implementation” gap while leaving semantic/pixel verification as explicit gates.
2. **Wave67:** added render-core and WebGL2 foundation, keeping Canvas2D fallback. The renderer consumes evaluated vertices and does not own deformer semantics.
3. **Wave81:** delivered additivePendulum/dynamics-file-v2 as a historical additive design. It is not current after the later destructive replacement.
4. **Wave85 → Wave92:** added read-only diagnostics and Runtime Export/preflight surfaces; these support inspection/export but are not visual or performance acceptance.
5. **Perf Wave 2:** removed Editor hot-path rig-control reconstruction and display-path string rounding/clones. Real and synthetic records show large CPU-side improvement; GPU-side coverage stayed outside the Node harness.
6. **Wave101:** changed new atlas packing default to Skyline while preserving shelf artifact reads.
7. **Wave106:** replaced v2 additive pendulum with world-frame dynamics-file-v3 Verlet chain; focused tests pass, but no render-performance delta was claimed.
8. **Wave108:** adopted Option E transparent margin/non-clamp UV/LINEAR/contentInset contract to contain mesh boundary overshoot in each tile’s own transparent band.
9. **Wave109:** repaired the preflight/packing contract drift by sharing `deriveContentSubRectUv`; non-zero inset export-ready behavior became testable.
10. **Player Waves13–19:** completed pacing/cache/compiled evaluator/render-frame fast path/light diagnostics/cadence work; Wave18 intentionally removed product deep profiling and Wave19 attributed remaining cadence difference to OBS/CEF environment in manual comparison.

Relevant source commits in the current history include `70485f4` (Option E/boundary transparent margin implementation and resolver regression fix) and `899cb2e` (Wave109 UV-rect preflight alignment; authoring-core/packages green as recorded). Historical wave reports may predate those commits and should not be treated as uncommitted current state.

## 8. Open gates, debts, and uncertainties

- Real GPU/readPixels or equivalent pixel oracle for WebGL2 vs Canvas2D: seam/anti-aliasing/mask parity is unverified. Canvas2D sunset criteria and remaining overlay/debug responsibilities are not decided.
- AtlasRuntime visual check for transparent margin, cross-bleed, LINEAR edge AA, and `original` inset remains a human/device gate even though Wave108/109 focused contracts pass.
- Mesh v6d/v7 quality criteria and generation-family toggle lifetime remain a user quality hold. No automated pass may infer v6 product acceptance, v7 deletion, or Wave2/v6 removal.
- Dynamics v3 implementation is current, but model-authoring calibration/real-device tuning and any render-cost impact are not closed by Wave106. This report intentionally does not resolve that product gate.
- Runtime Player W20 packaged lifecycle smoke, W21 Domain C, and W22/W23 real speech/vowel gates are separate current work. They should not be recast as render-performance pass/fail.
- C7 two-instance hardware stress is optional/unmeasured. No target hardware/browser, FPS/CPU/GPU capture protocol, or authorization is recorded.
- Player survey hypotheses (`getState` schema parse, per-frame clone/index work, mask FBO) remain static hypotheses; no post-Wave19 raw bottleneck capture was found. Product deep profiling must remain disabled unless a new boundary is explicitly decided.
- Synthetic/Node measurements cannot establish GPU submit, browser compositor, mask FBO, readback, or OBS/CEF cadence. A new real-model-003 run is not recorded and should be reopened only on explicit regression/request.
- `dynamics-file-v3` and Option E contracts have focused tests but not a single cross-package GPU/AtlasRuntime visual oracle; contract maintenance and visual evidence remain separate.

## 9. Candidate next work (facts-derived; no recommendation)

- Record a declared-target GPU/readPixels or equivalent pixel-oracle experiment covering WebGL2/Canvas2D parity, masks, seam/AA, and AtlasRuntime transparent margin/`original` inset.
- If the user reopens C7, capture CPU/GPU/FPS and browser/OBS cadence for two instances on named hardware/browser targets; keep it developer/test-only unless separately accepted.
- If Player performance is reopened, use the existing internal profiler seam to measure (not assume) `getState` parsing, clone layers, static index validation, and mask cost before any optimization.
- Add/maintain regression coverage for `CanvasEvaluatedScene` semantics, contentInset/uvRect preflight sharing, and dynamics v3 edge/reset/substep behavior.
- Record an explicit Canvas2D sunset/retained debug-overlay policy and v6/v7 quality/toggle decision when the responsible human gate is available.
- Re-run real-model-003 only if a regression or explicit user request creates that measurement scope; existing synthetic gains do not by themselves require a new benchmark.

## 10. Evidence index

| Evidence | Establishes |
|---|---|
| `discussion/design/canvas-evaluation/_map.md:10,21-30` | Wave66 implemented boundary; semantic/pixel/sunset gates remain. |
| `discussion/design/mesh-rendering/_map.md:10-11,24-36` | WebGL2 primary, Wave67 foundation, Option E/Wave109 contract, GPU/pixel and AtlasRuntime gates. |
| `discussion/design/texture-atlas/_map.md:16,20-31` | Skyline default, shelf compatibility, shared contentInset/uvRect, visual gate. |
| `discussion/design/mesh-generation/_map.md:24,36-46` | v6d technical/default route, v7 comparison toggle, quality hold and no Wave2 deletion. |
| `apps/editor/src/workspace/canvas/canvas-evaluation.ts:31-69,1311-1328` | Evaluated scene schema and Perf Wave 2 display-only normalization. |
| `apps/editor/src/workspace/canvas/canvas-render-scene-adapter.ts:28-109` | Projection → RenderScene mapping and content UV remap without clamping. |
| `apps/editor/src/workspace/canvas/canvas-renderer.ts:125-215,236-255` | WebGL2 primary attempt and Canvas2D fallback/error disable path. |
| `packages/render-core/src/render-scene.ts:1-70` | Shared render schema, coordinate/UV/blend/clipping contract. |
| `packages/render-webgl2/src/webgl2-renderer.ts:50-91,261-277` | Ordered draw/mask path and per-drawable dynamic buffer submission. |
| `packages/render-webgl2/src/webgl2-textures.ts:19-55,69-82` | Texture signature cache, LINEAR/CLAMP_TO_EDGE, premultiplied upload. |
| `packages/render-software/src/raster/texture-sampler.ts:102-138`、`texture-sampler.test.ts:59-116` | Software fallback の premultiplied bilinear/edge clamp と透明 fringe regression tests。 |
| `packages/render-core/src/render-scene.test.ts`、`packages/render-webgl2/src/webgl2-renderer.test.ts`、`apps/editor/src/workspace/canvas/canvas-render-scene-adapter.test.ts`、`packages/runtime-core/src/dynamics-evaluation.test.ts` | Render schema/WebGL semantic、Canvas adapter、dynamics contract の focused test entry points。 |
| `packages/authoring-core/src/mesh-generation-coverage-margin.ts:8-58,73-99` | Option E source-pixel margin bound and v6d/v7 coverage relation. |
| `packages/authoring-core/src/texture-atlas-packing.ts:25-31,536-572` | Skyline default and content-sub-rect UV placement. |
| `packages/authoring-core/src/texture-atlas-content-rect.ts:19-69` | Shared contentInset → normalized UV computation. |
| `packages/authoring-core/src/runtime-export-assembly.ts:560-572,788-815` | Export preflight blocks invalid/stale UV and uses shared helper. |
| `packages/runtime-core/src/dynamics-evaluation.ts:211-343` | v3 Verlet chain, reset/dt clamp, fixed substeps. |
| `packages/runtime-core/src/runtime-core.ts:225-311` | Runtime input parsing, dynamics, drawable evaluation, render-frame cloning. |
| `apps/runtime-player/src/stage/stage-renderer/static-stage-canvas-renderer.ts:339-356,549-586` | latest-wins parameter coalescing and one-rAF scheduling. |
| `apps/runtime-player/src/stage/runtime-evaluation/runtime-export-pose-evaluator.ts:55-107,131-165` | deep profiler only when explicitly requested; normal path keeps it disabled. |
| `apps/runtime-player/src/stage/stage-renderer/runtime-export-evaluation-cache.ts:81-170` | Scaffold cache hits/misses/invalidation and cache key inputs. |
| `discussion/implementation/waves/wave66/wave66-final-integration-report.md` | Canvas evaluation implementation/pass and no pixel claim. |
| `discussion/implementation/waves/wave67/wave67-final-integration-report.md` | Render foundation pass and fake-GL/semantic boundary. |
| `discussion/implementation/waves/wave81/wave81-final-integration-report.md` | Historical dynamics v2; superseded status. |
| `discussion/implementation/waves/wave85/wave85-final-integration-report.md` | Diagnostics v0 pass. |
| `discussion/implementation/waves/wave92/wave92-final-integration-report.md` | Runtime Export v0/preflight pass. |
| `discussion/implementation/waves/wave101/wave101-final-integration-report.md` | Skyline focused implementation/evidence. |
| `discussion/implementation/waves/wave106/wave106-final-integration-report.md` | Dynamics v3 replacement and focused test counts; no render claim. |
| `discussion/implementation/waves/wave108/wave108-final-integration-report.md` | Option E verification counts and AtlasRuntime visual residual. |
| `discussion/implementation/waves/wave109/wave109-domain-a-uvrect-preflight-report.md` | Shared UV helper and 317/1500/typecheck evidence. |
| `discussion/render-performance/measurements/real-model-002.md:8-21` | Recorded real-model baseline and WebGL counters. |
| `discussion/render-performance/measurements/baseline-synthetic-v3.md:81-100,102-148` | Pre-Wave2 synthetic baseline. |
| `discussion/render-performance/measurements/after-wave2-synthetic.md:63-168` | Post-Wave2 synthetic deltas and Node/GPU limitation. |
| `discussion/render-performance/player-survey.md:48-85,87-124,151-194` | Player live path, current optimization coverage, deep profiler seam, and unmeasured hypotheses. |
| `discussion/runtime-player/implementation/_map.md:327-338` | Wave18 deep transport removal and Wave19 manual OBS/Chrome/Edge finding. |
| `discussion/ai-cohost/implementation/orchestration/c7-closure-record.md:17-21` | C7 two-instance load is user impression only; no hardware capture. |
| Git `70485f4`, `899cb2e`, HEAD `af5839452` | Option E/Wave109 source history and current workspace revision. |

## 11. Limitations

- This is a repository/evidence refresh, not a new implementation or benchmark. No source, test, config, map, stage, or commit was changed; only this report is created with `apply_patch`.
- No real GPU/readPixels, AtlasRuntime screenshot, OBS capture, CPU/GPU/FPS trace, packaged Electron smoke, or real-speech run was executed during this refresh. Recorded manual observations are labeled as such.
- Wave reports are historical snapshots and may describe pre-commit/uncommitted state; current source and current HEAD take precedence for repository facts.
- Node synthetic measurements omit browser compositor, WebGL submit, mask FBO, driver, and OBS/CEF effects. They cannot close the corresponding human/device gates.
- Wave81 dynamics v2, pre-Wave2 Editor diagnosis, and old “reopen deep profiler” suggestions remain useful historical context only; current maps and Wave18 boundary supersede them.
