# Runtime Player Wave3 Domain B Design/Development Review

## Verdict

pass

Loop 2 後の再レビューでは、blocking な design/development compliance 違反は見つからなかった。Stage status relay と Reset naming はどちらも非 blocking warning として記録する。

## Scope Reviewed

- Target: `runtime-player-wave3-stage-evaluated-render-and-view-transform`
- Review lane: Design / Development Compliance
- Mode: read-only source review, except writing this report
- 指定 source files:
  - `apps/runtime-player/src/stage/stage-renderer/static-stage-canvas-renderer.ts`
  - `apps/runtime-player/src/stage/stage-renderer/stage-viewport.ts`
  - `apps/runtime-player/src/stage/stage-renderer/stage-view-transform.ts`
  - `apps/runtime-player/src/stage/stage-renderer/stage-render-diagnostics.ts`
  - `apps/runtime-player/src/stage/stage-window-app.tsx`
  - `apps/runtime-player/src/control/control-window-app.tsx`
  - `apps/runtime-player/src/preload/stage-view-bridge-channels.ts`
  - `apps/runtime-player/src/preload/runtime-player-bridge.ts`
  - `apps/runtime-player/src/preload/runtime-player-bridge-contract.ts`
  - `apps/runtime-player/src/main/stage-view-bridge-handlers.ts`
  - `apps/runtime-player/src/main/stage-view-status-state.ts`
  - `apps/runtime-player/src/main/placeholder-bridge-handlers.ts`
  - `apps/runtime-player/src/main/placeholder-action-state.ts`
  - `apps/runtime-player/src/main/runtime-player-main.ts`
- 指定 tests:
  - `apps/runtime-player/src/runtime-player-boundary.test.ts`
  - `apps/runtime-player/src/main/stage-view-status-state.test.ts`
  - `apps/runtime-player/src/stage/stage-renderer/stage-render-diagnostics.test.ts`
- 指定 tracked diff:
  - `git diff -- apps/runtime-player/src/control/control-window-app.tsx apps/runtime-player/src/main/placeholder-action-state.ts apps/runtime-player/src/main/placeholder-bridge-handlers.ts apps/runtime-player/src/main/runtime-player-main.ts apps/runtime-player/src/preload/runtime-player-bridge-contract.ts apps/runtime-player/src/preload/runtime-player-bridge.ts apps/runtime-player/src/stage/stage-renderer/runtime-export-stage-scene.test.ts apps/runtime-player/src/stage/stage-renderer/stage-viewport.ts apps/runtime-player/src/stage/stage-renderer/static-stage-canvas-renderer.ts apps/runtime-player/src/stage/stage-window-app.tsx`
- 追加で読んだ関連新規 source/test:
  - `apps/runtime-player/src/stage/stage-renderer/evaluated-runtime-export-stage-scene.ts`
  - `apps/runtime-player/src/stage/runtime-evaluation/default-runtime-pose-evaluator.ts`
  - `apps/runtime-player/src/stage/runtime-evaluation/runtime-export-runtime-graph-adapter.ts`
  - `apps/runtime-player/src/stage/stage-renderer/stage-view-transform.test.ts`
  - `apps/runtime-player/src/stage/runtime-evaluation/runtime-export-default-pose-evaluation.test.ts`
- Implementation report:
  - `discussion/runtime-player/implementation/waves/wave3/runtime-player-wave3-domain-b-stage-evaluated-render-and-view-transform-report.md`

## Basis Used

- `discussion/runtime-player/architecture/runtime-player-development-policy.md`
- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/runtime-player/architecture/technology-stack-decision.md`
- `discussion/runtime-player/implementation/orchestration/player-wave3-plan.md`
- `discussion/runtime-player/screens/initial-runtime-player-screen.md`
- `discussion/_conventions.md`
- `discussion/_map.md`

## Findings

### Warning: Stage status report API is visible to all renderer windows

- `apps/runtime-player/src/preload/runtime-player-bridge-contract.ts:70`
- `apps/runtime-player/src/preload/runtime-player-bridge.ts:49`
- `apps/runtime-player/src/preload/runtime-player-bridge.ts:52`
- `apps/runtime-player/src/main/stage-view-bridge-handlers.ts:19`
- `apps/runtime-player/src/main/stage-view-status-state.ts:42`
- `apps/runtime-player/src/stage/stage-window-app.tsx:197`
- `apps/runtime-player/src/control/control-window-app.tsx:59`

`stageView.reportStatus(status)` は共通 preload API として exposed されているため、現在の Control Window からも型上は呼べる。main の `reportStatus` handler も `event.sender` / `webContents` が Stage Window かどうかを確認していない。

これは blocking ではない。理由は、露出しているのが raw `ipcRenderer` や Electron object ではなく typed app-level API であり、status payload は main 側で `unknown` から正規化される。また影響範囲は Control Window に表示する Stage render status/diagnostics に限定され、filesystem/socket/window-placement 等の権限や Runtime Export 変異は渡していない。

ただし、renderer window が増える、または Stage status がより強い制御判断に使われる前に、sender gating を入れるか、Stage 用 report API と Control 用 read/subscribe API を preload entry ごとに分けるのが望ましい。

### Warning: Reset naming remains semantically stale but is still acceptable for Wave3

- `apps/runtime-player/src/preload/runtime-player-bridge-contract.ts:6`
- `apps/runtime-player/src/preload/runtime-player-bridge-contract.ts:89`
- `apps/runtime-player/src/control/control-window-app.tsx:91`
- `apps/runtime-player/src/control/control-window-app.tsx:294`
- `apps/runtime-player/src/main/placeholder-action-state.ts:17`
- `apps/runtime-player/src/main/placeholder-bridge-handlers.ts:43`
- `apps/runtime-player/src/main/placeholder-bridge-handlers.ts:49`
- `apps/runtime-player/src/stage/stage-window-app.tsx:105`

実際の Loop 2 後の挙動は Stage view transform reset だが、UI/API/action 名は既存の `Reset Stage Position` / `resetStagePosition` / `reset-stage-position` を継続している。

これは blocking ではない。Wave3 plan は既存 Control reset affordance から Reset View をつなぐことを許容しており、現在の main route は Stage Window に `runtime-player:stage-view:reset-requested` を送るだけで、Stage 側も `renderer.resetView()` のみを実行する。

ただし将来の OS-level Stage placement reset / persisted stage settings と衝突しやすい。次に Stage placement を実装する前に、Control UI と bridge contract を `Reset View` と `Reset Stage Position` に分ける判断が必要。

## Confirmations

- Renderer process boundary は維持されている。`apps/runtime-player/src/stage` と `apps/runtime-player/src/control` への Electron/Node/raw IPC 検索は no matches で、boundary test も `electron`, `node:`, `ipcRenderer`, `BrowserWindow` を禁止している（`apps/runtime-player/src/runtime-player-boundary.test.ts:10`）。
- Electron usage は main/preload に閉じている。preload は `contextBridge` / `ipcRenderer` を使って typed API を公開し（`apps/runtime-player/src/preload/runtime-player-bridge.ts:1`, `apps/runtime-player/src/preload/runtime-player-bridge.ts:76`）、main は window routing と IPC handler を持つ（`apps/runtime-player/src/main/runtime-player-main.ts:13`, `apps/runtime-player/src/main/stage-view-bridge-handlers.ts:18`）。
- Main process は React/UI module を import していない。`apps/runtime-player/src/main` に対する `react`, `../control`, `../stage` import 検索は no matches で、boundary test も同じ制約を持つ（`apps/runtime-player/src/runtime-player-boundary.test.ts:38`）。
- Preload bridge は narrow typed API の範囲に収まる。`RuntimePlayerStageViewApi` は status get/report/subscribe と reset subscribe のみ（`apps/runtime-player/src/preload/runtime-player-bridge-contract.ts:70`）、raw Electron object や filesystem/socket handle は exposed していない。
- Stage は capture-clean を維持している。`StageWindowApp` の JSX は shell と canvas のみ（`apps/runtime-player/src/stage/stage-window-app.tsx:132`）、Stage production source に `<button`, `Debug`, `Connect`, `Runtime Export` は no matches。boundary test も同じ観点を固定している（`apps/runtime-player/src/runtime-player-boundary.test.ts:26`）。
- Diagnostics/status UI は Control にだけ出る。Control は Stage status を取得・購読し（`apps/runtime-player/src/control/control-window-app.tsx:59`, `apps/runtime-player/src/control/control-window-app.tsx:71`）、Stage panel / notice に表示する（`apps/runtime-player/src/control/control-window-app.tsx:278`, `apps/runtime-player/src/control/control-window-app.tsx:465`）。
- Runtime hot path は React render-driven ではない。React は Stage の mount/subscription と coarse `renderState` のみを持ち（`apps/runtime-player/src/stage/stage-window-app.tsx:18`）、実描画は imperative controller の `renderer.render(...)` で行われる（`apps/runtime-player/src/stage/stage-renderer/static-stage-canvas-renderer.ts:123`）。
- Stage pan/zoom/reset は session-local display transform に閉じている。canvas event listener は renderer controller にあり（`apps/runtime-player/src/stage/stage-renderer/static-stage-canvas-renderer.ts:72`）、wheel/pan は `StageViewTransform` だけを更新する（`apps/runtime-player/src/stage/stage-renderer/static-stage-canvas-renderer.ts:155`, `apps/runtime-player/src/stage/stage-renderer/static-stage-canvas-renderer.ts:202`）。
- Stage render は evaluated default pose を消費している。`setPayload()` は `createEvaluatedRuntimeExportStageRenderInput(payload)` を呼ぶ（`apps/runtime-player/src/stage/stage-renderer/static-stage-canvas-renderer.ts:81`）、その先は `runtime-core` の `evaluateRuntimeFrame` を使う（`apps/runtime-player/src/stage/runtime-evaluation/default-runtime-pose-evaluator.ts:35`）。
- Stage 側で keyform/deformer evaluation を再実装していない。adapter は Runtime Export DTO を `NormalizedRuntimeGraph` に薄く変換し（`apps/runtime-player/src/stage/runtime-evaluation/runtime-export-runtime-graph-adapter.ts:67`）、評価は `@private-2d-rigging-lab/runtime-core` に委ねている（`apps/runtime-player/src/stage/runtime-evaluation/default-runtime-pose-evaluator.ts:2`）。
- Initial fit と view transform は分離されている。`createStageViewport` は exported/model bounds 由来の initial transform と optional view transform を compose する（`apps/runtime-player/src/stage/stage-renderer/stage-viewport.ts:18`, `apps/runtime-player/src/stage/stage-renderer/stage-viewport.ts:31`）。
- 新規 files は責務が分かれている。`stage-view-transform.ts` は transform math、`stage-render-diagnostics.ts` は diagnostic formatting、`stage-view-status-state.ts` は status normalization/storage、`stage-view-bridge-channels.ts` は channel constants に限定されている。
- Source organization guard の禁止パターンは見えない。reviewer 側の `rg --files apps/runtime-player/src | rg "(index|types|schemas|utils|helpers|common|shared|misc)\\.ts$"` は no matches。
- `authoring-core` 依存は Runtime Player に入っていない。`rg -n "authoring-core" apps/runtime-player` は no matches で、`apps/runtime-player/package.json:16` から `apps/runtime-player/package.json:20` の runtime-player dependencies にも `authoring-core` はない。
- Tests は boundary/status/diagnostics/transform/evaluated render adapter を押さえている。boundary guard は `apps/runtime-player/src/runtime-player-boundary.test.ts:10`、status normalization は `apps/runtime-player/src/main/stage-view-status-state.test.ts:21`、diagnostic formatting は `apps/runtime-player/src/stage/stage-renderer/stage-render-diagnostics.test.ts:7`、view transform は `apps/runtime-player/src/stage/stage-renderer/stage-view-transform.test.ts:10`。

## Verification Evidence

Gnome Loop 2 evidence:

- Typecheck pass.
- Focused Vitest sandboxed failed with esbuild `spawn EPERM`.
- Focused Vitest elevated pass, 5 files / 16 tests.
- Runtime Player unit suite elevated first failed due Stage boundary guard text; fixed; rerun pass, 10 files / 43 tests.
- Source organization check pass.
- Dependency check pass.
- `git diff --check` pass, LF-to-CRLF warnings only.

Reviewer additional evidence:

- Read basis documents and full requested source/test files.
- Inspected requested tracked diff directly.
- Ran `git status --short -uall`.
- Ran targeted `rg` searches for `authoring-core`, renderer Electron/Node/raw IPC usage, Stage production UI/debug text, main React/UI imports, and source-organization catch-all names.
- Reran `git diff --check` for the reviewed tracked/new files; result was exit 0 with LF-to-CRLF working-copy warnings only.
- Did not rerun pnpm/Vitest suites in this review lane.

## Remaining Risks/Gaps

- Manual Electron verification with a real transparent Stage Window and real Runtime Export remains important for pan/zoom/reset feel, clipping, and complex deformer visual confidence.
- Stage status report sender gating is a future hardening item. It is non-blocking while status remains telemetry-only, but should not be ignored if more renderer windows or stronger status authority are added.
- Reset naming should be resolved before implementing OS-level Stage placement reset or persisted Stage settings.
- Current review is design/development compliance only; full functional spec correctness and test adequacy remain owned by the other review lanes.
- Current scope remains Wave3: no live input, parameter mapping, dynamics time progression, body-follow, head-position motion, previous export restore, or Stage persistence was added.

## User-Decision Points

- None required to pass Domain B.
- Future decision: split `Reset View` and `Reset Stage Position` into separate Control labels and bridge APIs before Stage placement work.
- Future decision: sender-gate `stageView.reportStatus` to the Stage Window or split Stage/Control preload APIs before status routing becomes authoritative beyond diagnostics display.
