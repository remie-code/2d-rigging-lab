# Render Performance / Dynamics Map Freshness Audit

> 監査基準点: HEAD `3c3669eefcc375c62d1ec6b4d77a000d7cbbb61c` / 2026-08-08 (Asia/Tokyo)。本ファイルだけを作成した。

## 1. 担当範囲と確認対象

### Assigned maps

- `discussion/render-performance/_map.md`
- `discussion/reports/editor-render-performance/_map.md`

### Cross-topic evidence checked

- Editor implementation maps/reports: Waves 81, 82, 83, 84, 93, 96, 97, 98, 106 (`discussion/implementation/waves/**`)。
- Runtime Player implementation maps/reports: Waves 13--21 (`discussion/runtime-player/implementation/waves/**`)、Wave 22/23 final reports（両 wave に `_map.md` は存在しない）、親 implementation/orchestration maps。
- Measurements and design: `discussion/render-performance/measurements/{real-model-002,baseline-synthetic-v3,after-wave2-synthetic}.md`, Perf Wave 2 final report, `improvement-design.md`, `player-survey.md`。
- Current source/tests: Editor `canvas-evaluation.ts`, `parameter-keyform-state.ts`, Viewer tests; runtime-core render-frame/dynamics/evaluator code; Runtime Player stage renderer/evaluator/effective tuning and tests。
- Cross-app/manual records: Runtime Player implementation map Wave 15--19 entries and `discussion/ai-cohost/implementation/orchestration/c7-closure-record.md`。

Git observation: `git rev-parse HEAD` は契約の基準点と一致。`git status --short` は監査開始前の `.codex/**`、`discussion/expo.zip`、`discussion/reports/_map.md` と監査出力を含む既存変更を示した。これらは変更・削除していない。

## 2. Map verdicts

| Map | 種類 | 判定 | 理由 |
|---|---|---|---|
| `discussion/render-performance/_map.md` | `living-current-state` | **Partially stale** | Editor Wave 2 の実装/合成 before-after と 2026-07-08 のユーザー受け入れは現行事実。しかし Player の「保留→再開時 #5 deep profiling」という次行動は、後続 Player Waves 13--19（Wave18 の product deep-profile 撤去、Wave19 の OBS/Chrome 比較）を反映していない。Wave 2 行にも未解決の計測003待ちが残り、同 map 内の Editor クローズ記述と矛盾する。 |
| `discussion/reports/editor-render-performance/_map.md` | `historical-evidence-index`（Status: Recorded 2026-07-07） | **Intentionally historical** | 2026-07-07 の静的現状調査を指す入口としては正しい。後続 Wave 2 の処方を取り込む map ではない。ただし `toFixed` を含む一行結論と file:line は現在 source の説明として再利用してはいけない（下記 §3）。 |

Wave 81/82/83/84/93/96/97/98/106 および Runtime Player Wave 13--21 の各 wave map は、それぞれの完了時点の evidence index として pass/complete を記録しており、後続 wave が存在することだけで stale とはしない。Wave 22/23 は `_map.md` 不在のため final report を確認した。

## 3. Stale / suspicious map statements

### 3.1 `discussion/render-performance/_map.md`

- **L40--44, L48, L61**: 「Runtime Player は一旦保留」「再開点は #5 deep profiling → #1/#4」「それまで保留」は、C7 の 2026-07-12 未計測負荷記録としては正しいが、現在の Player 状態の入口としては古い。後続の Runtime Player Wave 13--19 が frame pacing、evaluation cache、compiled evaluator、render-frame fast path、軽量 diagnostics、Browser Source cadence diagnostics を完了した。
- **L44**: `runtimeCoreProfiling: "deep"` の live 配線を product 次行動のように読むのは不正確。Wave18 は product Control/Stage IPC/Browser Source HTTP/WS の deep-profiling transport を撤去し、evaluator 内の同 option は developer/test 専用に残した（`discussion/runtime-player/implementation/waves/wave18/wave18-final-integration-report.md:54-58,83-88`、`discussion/runtime-player/implementation/waves/wave18/domain-b-product-profiling-transport-removal-report.md:118-141`）。新しい product 設計合意なしに再公開できない。
- **L54**: 「60fps 続行可否と案Cは実モデル計測003待ち」は L36--38 の「Editor の動作として十分、案C/60fps は不要としてクローズ」と同一 map 内で矛盾する。`real-model-003.md` は現時点で存在せず、これは未実施の定量ゲートとして記録すべきだが、ユーザー受け入れ済みの Editor close を pending として扱わない。
- **L42--43**: C7 の二体並走負荷は「観測・未計測」であって「Player が遅い」という測定結果ではない。`c7-closure-record.md:17-21` は性能改善を C7 scope 外とし、要否/時期を別裁定にしている。

### 3.2 `discussion/reports/editor-render-performance/_map.md`

本 map は historical index なので当時の記述は stale 判定しない。ただし current source と突合すると次の file:line は再利用時に危険である。

- **L15, L19**: Editor display path の `toFixed` 正規化を現行事実として読むべきではない。Perf Wave 2 で表示経路は数値 snap に変更され、現在の `apps/editor/src/workspace/canvas/canvas-evaluation.ts:1311-1328` は `Math.abs(value) < 1e-12 ? 0 : value`。対応テストも `apps/editor/src/workspace/canvas/canvas-evaluation.test.ts:587-639` にある。runtime-core 側の `toFixed` は別経路として残る（`packages/runtime-core/src/rig-control-transform.ts:105-110`）。
- **L19**: `canvas-evaluation.ts L718-741, L1159-1165` は Wave 2 後に行が移動し、現在は rig-control order / mask index / bounds の別処理を指す。現行の頂点 chain は同 file L831 付近、display normalization は L1326 付近。
- **L30**: 「処方は未確定」は 2026-07-07 の調査時点では正しいが、Perf Wave 2 (`improvement-design.md` Status Implemented) 後の現行状態ではない。map 自体が Recorded であることを維持し、living map から current prescription としてリンクしない。

## 4. Current facts vs. measurements vs. hypotheses

### Editor (measured / accepted)

- User real-model measurement 002: 92 evaluations、`evaluation` **127.2 ms/eval**、`artworkBoundsAndAssembly` **96.4 ms (75.8%)**、`deformerVertex` **21.6 ms (17.0%)**、projection 129.4 ms、`canvas` caller 92 vs `renderSceneAdapter` 46、WebGL mesh uploads 1610 / `bufferDataCalls` 3220 (`discussion/render-performance/measurements/real-model-002.md:8-28`)。これは実モデルの測定結果。
- Synthetic v3 isolated the source: rigHeavy `artworkBoundsAndAssembly` 67.935 ms/eval、その `assembly.rigControls` 67.824 ms/eval = parent の 99.84% (`discussion/render-performance/measurements/baseline-synthetic-v3.md:134-168`)。これは合成 benchmark の結果であり、実モデル値ではない。
- Perf Wave 2 after (rig 非選択の slider 主経路): medium **1.782 ms/eval (−87.0%)**、heavy **20.329 ms/eval (−91.3%)**、rigHeavy **10.616 ms/eval (−88.1%)**、light −67.3%; rigHeavy `assembly.rigControls` 67.824→0.001 ms/eval (`discussion/render-performance/measurements/after-wave2-synthetic.md:58-75,77-117,147-160`)。run1/run2 の近接も同 report §4 に記録される。
- **Acceptance decision, not benchmark**: map L36--38 records user real-model confirmation “Editor の動作としては十分” and closes案C/60fps continuation. `real-model-003.md` is absent; therefore the 30fps `avg≤33ms` real-model criterion remains unmeasured, but it is not an open Editor user gate unless the symptom recurs.

### Editor Viewer / dynamics (current source and wave evidence)

- Wave82 added rAF input coalescing and gated instrumentation, but explicitly did not add dirty evaluation or a quantified before/after benchmark (`discussion/implementation/waves/wave82/wave82-domain-a-parameter-scrub-performance-v1-dynamics-inspector-followup-report.md:93-105,157-163`).
- Wave83/84 added preview time progression and consolidated Viewer stepping around runtime-core; Wave84 records that Viewer still builds Canvas projection and that large real projects may need profiling (`discussion/implementation/waves/wave84/wave84-domain-a-viewer-dynamics-playback-solver-consolidation-report.md:50-53,66-73,146-153`).
- Wave96 caches Atlas Runtime source resolution/signature/hash, Wave97 stops Dynamics rAF after convergence, and Wave98 removes the active-frame duplicate zero-delta evaluation while adding gated counters. None claims to remove slider-time Canvas full evaluation (`discussion/implementation/waves/wave96/wave96-domain-a-viewer-atlas-runtime-static-source-cache-report.md:19-22,63-76,98-102`; `discussion/implementation/waves/wave97/wave97-domain-a-viewer-dynamics-idle-playback-throttle-report.md:31-50,109-119`; `discussion/implementation/waves/wave98/wave98-domain-a-viewer-dynamics-performance-instrumentation-duplicate-eval-removal-report.md:32-49,74-100,141-152`).
- Current Editor keyform code still loops all sorted keyform sets (`apps/editor/src/features/editor-session/model/parameter-keyform-state.ts:473-499`), while display `toFixed` is gone. Thus the historical report's “full keyform pass/no dirty tracking” remains a useful hypothesis/fact boundary, but its old toFixed attribution does not.

### Runtime Player (current code / accepted wave facts)

- Native Stage and Browser Source share an event-driven latest-wins renderer: `setLiveParameterFrame` replaces pending input and counts coalescing (`apps/runtime-player/src/stage/stage-renderer/static-stage-canvas-renderer.ts:339-355`); only one rAF is scheduled while pending (`:549-586`). This supports the Wave19 interpretation that input cadence and render cadence can differ without an explicit 30fps throttle.
- Live render uses `RuntimeModelInstance.evaluateRenderFrame`; normal control is `snapshotValidation: "skip"`, while evaluator-internal `runtimeCoreProfiling: "deep"` is optional (`apps/runtime-player/src/stage/runtime-evaluation/runtime-export-pose-evaluator.ts:55-70,131-162`). Wave18 intentionally keeps deep profiling out of product transport; it remains developer/test-only.
- Runtime-core still parses input, previous state, options, and context each render-frame evaluation (`packages/runtime-core/src/runtime-core.ts:231-246`), `getState()` returns a Zod-parsed copy (`packages/runtime-core/src/runtime-model.ts:216-218`), render-frame output clones vertices (`packages/runtime-core/src/runtime-core.ts:260-309`), and WebGL mesh upload rebuilds valid indices on each call (`packages/render-webgl2/src/webgl2-mesh.ts:9-60`). These are repository facts supporting player-survey candidates #1/#3/#4; **their frame-time contribution remains unmeasured**.
- Runtime Player wave evidence is a progression, not a single unchanged baseline: Wave17 introduced render-frame fast output; Wave18 removed product deep-profile transport and kept cheap proof counters (`discussion/runtime-player/implementation/waves/wave17/wave17-final-integration-report.md:58-66,71-77`; `.../wave18/wave18-final-integration-report.md:54-58,83-88`); Wave19 added lightweight rAF/render/coalescing fields and tests (`.../wave19/wave19-final-integration-report.md:37-58,101-115`).
- The later implementation parent map records the user OBS-vs-Chrome/Edge comparison as closed: Chrome/Edge reached near-60fps applied/render cadence while OBS stayed lower, attributing the remaining cadence limit to OBS/CEF environment (`discussion/runtime-player/implementation/_map.md:332-338`, commit `ff165f2`). The Wave19 final report and Wave19 wave map still contain older “manual pending” wording (`discussion/runtime-player/implementation/waves/wave19/wave19-final-integration-report.md:124-129,150-177`; `.../waves/wave19/_map.md:28-39`); treat those as superseded historical residue, not as the current next action.

### Wave106 relationship (dynamics boundary)

- Wave106 is a **dynamics semantics replacement**, not a render-performance wave: v0 additive pendulum → `worldFrameChainV1` / `dynamics-file-v3`, with profile-v1 discard and v2 hard reject (`discussion/implementation/waves/wave106/_map.md:22-27`). Final clean gate is pass with render-software/render-webgl2 forbidden-scope unchanged (`.../wave106/_map.md:27-33`; `discussion/implementation/waves/wave106/wave106-final-integration-report.md:76-82`).
- Current solver advances a world-frame Verlet chain, projecting one segment at a time (`packages/runtime-core/src/dynamics-evaluation.ts:211-260`), and loops fixed substeps (`:303-334`). “Dynamics cost is groups × substeps and independent of drawable vertex count” remains a complexity hypothesis/structural fact; Wave106 adds segment-chain work, but no player or Editor frame-time measurement was recorded.
- Editor Domain B and Player Domain C both passed v3/profile-v2 updates (Editor focused 50/50, Player tuning 28/28; packages 58/58) (`discussion/implementation/waves/wave106/wave106-final-integration-report.md:91-101`). The remaining Hair Sway rig calibration is model-authoring scope, not a performance result (`discussion/implementation/waves/wave106/_map.md:31-33`).

## 5. Accepted decisions and open human/device gates

### Accepted / closed

1. Editor Perf Wave 2 A+D+E implementation is complete and user-accepted as sufficient; no current mandate for renderer-outside evaluation or 60fps pursuit (`discussion/render-performance/_map.md:36-38,50-54`).
2. Runtime Player Wave18 product diagnostics is intentionally lightweight; deep profiling cannot be re-exposed through product bridges without a new accepted design (`discussion/runtime-player/implementation/waves/wave18/wave18-final-integration-report.md:54-58,115-136`).
3. Wave19’s latest recorded OBS/Chrome comparison treats the remaining Browser Source cadence gap as an OBS/CEF environment limitation; Runtime Player does not force 60fps (`discussion/runtime-player/implementation/_map.md:333-338`; `discussion/runtime-player/implementation/waves/wave19/wave19-final-integration-report.md:145-148`).
4. Wave106 dynamics v3/profile v2 replacement is final pass; no render package changes and no performance claim.

### Open decisions / gates

- **Player two-instance load**: C7 records both Browser Sources alive but only a user impression that this PC feels strained; there is no FPS/CPU/GPU capture (`discussion/ai-cohost/implementation/orchestration/c7-closure-record.md:17-21`). User must decide whether to reopen a performance experiment, on which hardware/browser targets, and whether developer-only deep profiling is authorized.
- **Real-model Editor 003**: no file/result exists. Reopen only if the accepted “sufficient” behavior regresses or a numeric 30fps gate is explicitly requested.
- **Player candidate optimizations #1/#3/#4** (`getState` parse, clone layers, triangle-index cache): code paths are present, but no post-Wave19 bottleneck measurement or user mandate exists. Do not present them as scheduled work.
- **Wave106 Hair Sway calibration** and Runtime Player Wave22/23 real vowel-rig user gates are behavior/authoring gates, not render-performance closure evidence.

## 6. Parent-map implications

1. `discussion/render-performance/_map.md` should be corrected from “Player still on hold; next = product deep-profile wiring” to: Waves 13--19 completed the available Player diagnostics/fast-path/cadence work; latest recorded comparison attributes cadence gap to OBS/CEF; C7 two-instance strain remains an **unmeasured optional reopen**. If a future diagnostic wave is authorized, explicitly label it developer/test-only or obtain a new product design decision.
2. Remove or historical-label `discussion/render-performance/_map.md:54` (“60fps/C and measurement003 pending”) because it conflicts with the same map’s accepted Editor close at L36--38. Keep `real-model-003` absence as an unresolved measurement fact, not a current acceptance blocker.
3. Keep `discussion/reports/editor-render-performance/_map.md` as an intentionally historical 2026-07-07 index, but add a visible “pre-Perf Wave 2 baseline” cue if/when a docs update is authorized. Current readers must use render-performance measurements and Wave2 final report for the prescription.
4. Cross-topic integration should link Wave106 as a dynamics/schema/tuning change with **no measured render-performance delta**. Do not infer that world-frame dynamics fixed or worsened the Player/Editor frame budget.
5. The Wave19 final report and Wave19 wave map still say manual OBS confirmation is pending while the later parent map records the OBS/Chrome comparison as closed. Root/runtime-player integration should reconcile this historical contradiction before any map refresh.

## 7. Unresolved / not verified in this audit

- No real-model `real-model-003.md`, no raw post-Wave19 `tmp/report.log`, and no reproducible CPU/GPU/frame-time capture for C7’s two-instance load were found.
- No before/after measurement isolates Player `getState()` Zod parse, runtime-core clone layers, or WebGL triangle-index validation; these remain hypotheses/candidates despite being visible in current code.
- No new product deep-profiler transport was implemented or verified; only evaluator-internal developer/test profiling remains.
- Browser/OBS manual comparison is recorded in the parent map but its raw capture is not checked into this repository; treat it as manual observation rather than a benchmark artifact.
