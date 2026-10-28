# サムネ用の透過スクショ(Capture PNG)— Domain T 実装報告

> Status: 実装済み・突き合わせ合格・指摘 2 件を直した(2026-10-28、Gnome)。人間ゲート合格 [human-gate.md](human-gate.md)。ブランチ `runtime-player/thumbnail-capture`。
> 計画: [../../orchestration/thumbnail-capture-wave-plan.md](../../orchestration/thumbnail-capture-wave-plan.md) §1・§2。合意: [../../../screens/thumbnail-capture.md](../../../screens/thumbnail-capture.md)。棚卸し: [../../thumbnail-capture-inventory.md](../../thumbnail-capture-inventory.md)。
> 触ったのは `apps/runtime-player` だけ。packages/・魂・操縦席・control-channel の契約は変えていない。
> 保存: サブエージェントはこのファイルを書けなかったので、Gnome の報告本文を Undine が保存した。Undine が型検査(exit 0)とテスト(152 files / 1021 tests)を再実行して確かめた。

パス略記: `RP/` = `apps/runtime-player/src/`。

## 1. 変えたファイル

### 新規

| ファイル | 中身 |
|---|---|
| `RP/preload/stage-png-capture-bridge-channels.ts` (+ `.test.ts`) | チャネル 4 本(`runtime-player:stage-png-capture:*`)。Control → main の `capturePng` / `openFolder`、main → Stage の `captureRequested`、Stage → main の `reportCapture` |
| `RP/preload/stage-png-capture-bridge-contract.ts` | Control 側の API と結果の型(`fileName` / `filePath` / `folderPath` を載せる)。Stage 側の頼み `{ requestId }` と返事(`ok` + `pngBytes` / `error` + `message`) |
| `RP/main/stage-png-capture/stage-png-capture-request-broker.ts` (+ test) | id 付きの往復。頼みを `webContents.send` で送り、返事を id と送り主の webContents id で突き合わせる。既定は 10 秒で時間切れ。返ってきたバイト列が PNG の署名で始まるかを確かめる |
| `RP/main/stage-png-capture/stage-png-capture-file-name.ts` (+ test) | 保存先は `<pictures>\Runtime Player`、名前の頭は Runtime Export のフォルダ名。Windows で使えない文字(`<>:"/\|?*` と制御文字)は `_` に置き換え、空なら `stage`、100 文字で切る。時刻は `YYYYMMDD-HHMMSS`(ローカル) |
| `RP/main/stage-png-capture/stage-png-capture-file-writer.ts` (+ test) | フォルダを作り(`recursive`)、`wx` で書く。名前が使われていたら `-2`、`-3`… と進むので上書きしない。同じ秒の連写でもぶつからない |
| `RP/main/stage-png-capture/stage-png-capture-bridge-handlers.ts` (+ test) | `ipcMain.handle` を登録する。撮る前に main 側でも「loaded か」「Stage Window があるか」を確かめ直す。Open Folder はフォルダを作ってから `shell.openPath` |
| `RP/stage/stage-png-capture/stage-png-capture-report.ts` (+ test) | Stage の返事を作る純粋関数。撮影中の例外は `error` の返事にする |
| `RP/stage/stage-renderer/static-stage-canvas-renderer.png-capture.test.ts` | `capturePngImage` のテスト(描き直し → toDataURL の順、dispose 後は拒む、PNG でない data URL は拒む) |
| `RP/control/stage-png-capture-panel.tsx` (+ test) | 2 つのページで共有するパネル「Thumbnail Capture」と、押せる条件 `getStagePngCaptureAvailability` |
| `RP/preload/runtime-player-bridge.stage-png-capture.test.ts`、`RP/preload/runtime-player-stage-bridge.stage-png-capture.test.ts` | preload の契約テスト |

### 既存の変更

| ファイル | 変更 |
|---|---|
| `RP/stage/stage-renderer/static-stage-canvas-renderer.ts` | 公開メソッド `capturePngImage()` を追加した。既存の private `renderCurrentImmediate()` で描き直し、同じ呼び出しの中で `canvas.toDataURL("image/png")` を読んでバイト列にする。`decodePngDataUrl` も追加した |
| `RP/stage/stage-window-app.tsx` | 頼みを購読し、その IPC のタスクの中で撮って返す。レンダラの作成に失敗した経路でも購読し、「Stage renderer is unavailable.」をすぐ返す(main を 10 秒待たせない) |
| `RP/preload/runtime-player-stage-bridge-contract.ts` / `runtime-player-stage-bridge.ts` | `window.runtimePlayerStage.stagePngCapture`(`onCaptureRequested` / `reportCapture`) |
| `RP/preload/runtime-player-bridge-contract.ts` / `runtime-player-bridge.ts` | `window.runtimePlayer.stagePngCapture`(`capturePng` / `openFolder`) |
| `RP/main/runtime-player-main.ts` | `registerRuntimeExportBridgeHandlers` の戻り値(session)を受けるようにし、`registerStagePngCaptureBridgeHandlers` を登録した。状態は `session.getStatus()`、保存先は押すたびに `app.getPath("pictures")` から決める |
| `RP/control/control-window-app.tsx` | `stagePngCaptureBusy` の state(`try/finally`)と `captureStagePng` / `openStagePngCaptureFolder` を追加した。結果の `message` は既存の feedback に出す(ok → success、それ以外 → error) |
| `RP/control/stage-page.tsx` | 上段 3 列の直後にパネルを置いた。props は `stagePngCaptureBusy` / `onCaptureStagePng` / `onOpenStagePngCaptureFolder`(必須) |
| `RP/control/live-controller-page.tsx` | 3 列の並びの下にパネルを置いた。props は同上 |
| `RP/control/stage-page.browser-source.test.ts`、`stage-page.stage-motion.test.ts`、`live-controller-page.test.ts`、`control-window-degraded.test.ts` | 呼び出し側に新しい必須 props を足した。Live Controller のボタン配線と押せない条件、Stage ページにパネルが出ることのテストを追加した |

## 2. 往復の作り

```
Control  ──invoke capturePng──▶  main
                                  │ 状態確認(loaded / Stage Window)
                                  │ broker.request(): requestId を作り pending に登録、時間切れタイマー
                                  ├──webContents.send captureRequested { requestId }──▶ Stage
                                  │                         IPC のタスクの中で:
                                  │                         renderCurrentImmediate() → toDataURL → バイト列
                                  ◀──invoke reportCapture { requestId, result, pngBytes|message }──┘
                                  │ broker.handleReport(event.sender, report): id と送り主で突き合わせ
                                  │ writeStagePngCaptureFile(): mkdir → wx で書く(-2, -3…)
Control  ◀── { result, message, fileName, filePath, atIso } ──┘
```

- **preserveDrawingBuffer は false のまま**にした(`createWebGl2RendererFromCanvas` の呼び出しは触っていない)。描き直しと読み出しを同じ同期の呼び出しで行うので、合成でバッファが消える前に読める。
  - 描き直しは持っている `renderInput` をそのまま描くだけで、評価はやり直さない。だから姿は進まず、その瞬間の姿が写る。
  - 表示中の Stage Motion の変換(`displayViewTransform`)もそのまま効く。
- 透明: WebGL は既定のまま(`alpha` / `premultipliedAlpha: true`)。`toDataURL` が premultiplied を戻して RGBA の PNG にする。
- Arrange 中の枠やハンドルは canvas の外にある DOM のオーバーレイなので写らない。
- 大きさ: canvas のピクセル数がそのまま PNG の大きさになる(既存の `resizeCanvasToDisplaySize`、`clientWidth × devicePixelRatio`)。
- 時間切れは 10 秒(`runtimePlayerStagePngCaptureTimeoutMs`)。遅れて来た返事は捨てる。`send` が例外を投げたらすぐ失敗にする。
- 押せない条件(Control)と、そのときパネルの `Capture` 行に出す理由:

  | 条件 | 表示 |
  |---|---|
  | 撮っている最中 | `Capturing` |
  | Runtime Export が loaded でない(null を含む) | `Load a model to capture` |
  | Stage の状態をまだ受け取っていない | `Checking` |
  | Stage Window が destroyed | `Stage Window closed` |

  Open Folder はいつでも押せる。
- feedback の文言:

  | 場面 | 文言 |
  |---|---|
  | 成功 | `Stage PNG saved: <ファイル名>` |
  | 失敗 | `Stage PNG capture failed: <理由>`(例 `Stage Window did not answer in time.`) |
  | 撮る前の確認で止めた | `Capture PNG needs a loaded model.` / `Stage Window is not available.` |
  | Open Folder | `Capture folder opened: <パス>` / `Capture folder could not be opened: <理由>` |

- Browser Source がつながっていても止めない(Stage Window が最後に描いた姿が写る)。ロールで分岐はしていない。

## 3. テスト

- 型検査 `pnpm run typecheck`(`apps/runtime-player`): exit 0。
- テスト `pnpm run test`: **152 files / 1021 tests がすべて通った**(着手前は 142 files / 981 tests。+10 files / +40 tests)。
- 既存の境界テスト(`RP/runtime-player-boundary.test.ts`)は変えずに通る。
  - `stage/` の本番ファイルに `Runtime Export`・`<button`・`Debug`・`Connect` の文字を入れていない。
  - Stage の bridge と契約に `openDirectory` などの文字を入れていない。
  - `main/` から `../control`・`../stage` を import していない。
- ルートの `check-source-organization` が出す違反は `RP/main/physiology/index.ts` の 1 件だけで、今回触っていない既存のファイル。今回の変更による違反は無い。
- 改行: 編集・新規のファイルは、作業ツリーの慣例(CRLF)に揃えた。

## 4. 実機確認(開発起動)

- 起動コマンド: `pnpm exec electron-vite dev --remoteDebuggingPort 9333 -- --role=autonomousHost --profile=capture-check`
  - ユーザーが普段使うスロット(`autonomous-default` / `tracking-default`)に触らないよう、使い捨てのスロット `capture-check` を作った。
  - その startup-state に `C:\workspace\remie\rigging\astra-chan\exports\astra-chan-runtime` を入れ、起動時の自動読み込みで Runtime Export を loaded にした。
- 操作: リモートデバッグ(CDP)で Control Window の DOM を操作した。ナビの「Stage」を押し、「Capture PNG」ボタンを `click()` した。本物のボタンから preload → main → Stage → main → ファイルの経路をそのまま通る。押す前のボタンは押せる状態だった。
- 結果: feedback に `Stage PNG saved: astra-chan-runtime-20261028-134334.png` が出た。`C:\Users\remie\Pictures\Runtime Player\` が作られ、その中に PNG ができた。
- PNG の中身(Node で IHDR/IDAT を自前で展開して確認):
  - 720 × 900、8bit RGBA(colorType 6)。Stage の canvas も 720 × 900(この PC の devicePixelRatio は 1)。
  - 四隅の alpha はすべて 0。
  - alpha=0 の画素 569,072、alpha=255 の画素 74,217、0 < alpha < 255 の画素(縁の半透明)4,711。
  - 見えている範囲は x 111–608 / y 72–827。
  - つまり背景は透明で、チャッピーの画素は alpha > 0、縁の半透明も残っている。
- 連写: API から 2 回続けて撮ると `astra-chan-runtime-20261028-134400.png` と `…-134400-2.png` ができた。上書きはされなかった。
- 確かめていないこと:
  - Open Folder の実機。Explorer の窓が開くので避けた。単体テストで `mkdir` → `shell.openPath` は確認している。
  - 撮っている最中に押せないことの目視。撮影が 100ms 以内に終わり、押した 100ms 後にはもう押せる状態に戻っていた。単体テストでは確認している。
  - Tracking Host での撮影。
  - devicePixelRatio が 1 でない PC。
  - `pack` で作り直した器(計画 §3 の人間ゲート)。
- 後片付け:
  - 確かめに使った PNG 3 枚を消した。それで空になった `Pictures\Runtime Player` フォルダ(この確認で初めて作られたもの)も消した。
  - 使い捨てスロット `slots\capture-check` を消した。
  - 起動した Electron を止めた。

## 5. 判断が要ること

1. **パネルの名前と置き場**: 合意にあるのはボタン名(`Capture PNG` / `Open Folder`)だけなので、2 つのページに同じパネル「Thumbnail Capture」を置いた。
   - 中身は、押せる/押せない理由を出す `Capture` 行、`Saves to: Pictures\Runtime Player`、一行の説明。
   - Stage ページでは上段 3 列の直後、Live Controller では一番下に置いた。
   - 名前と位置はユーザーの確認待ち。
2. **時間切れ 10 秒**: 大きな窓でも PNG にするのは数百 ms で済む前提で、安全側に取った値。変えたいときは定数 1 か所で変えられる。
3. **名前の頭を 100 文字で切る**: フォルダ名が極端に長いときのパスの長さへの備え。合意には無い細かい決めごと。
4. **読み出しは同期の `toDataURL`**: `toBlob` は非同期で、仕様上は呼んだ時点の絵を取るが、確実さを優先して同期の方にした。とても大きな窓では、撮るときだけ Stage の描画が一瞬止まることがある。

## 6. 突き合わせの指摘の直し(2026-10-28)

突き合わせ([../../reviews/thumbnail-capture/review.md](../../reviews/thumbnail-capture/review.md))は合格。軽い指摘 2 件を直した。

1. **撮影中に Stage Window を閉じると 10 秒待たされる** → `stage-png-capture-request-broker.ts`。
   - 頼む時点で webContents が destroyed なら、送らずに「Stage Window is not available.」で失敗にする。
   - 頼んだ後は `destroyed` を `once` で見張り、閉じたらすぐ「Stage Window closed before the capture finished.」で失敗にする。決着したら見張りを外す。
   - テスト 3 件(撮影中に閉じる・最初から閉じている・決着後に見張りが外れる)。
2. **Stage がまだモデルを描く前に押すと、空の透明 PNG が成功として残る** → `static-stage-canvas-renderer.ts` の `capturePngImage()`。
   - `renderInput` が null なら canvas を読まずに「Stage has not drawn the model yet.」を投げる。feedback には「Stage PNG capture failed: Stage has not drawn the model yet.」と出る。
   - テスト 1 件(読み込み前と clear 後に拒み、toDataURL を呼ばない)。
- 型検査 exit 0、テスト 152 files / 1025 tests がすべて通った(Undine が再実行して確認)。
