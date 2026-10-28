# サムネ用の透過スクショ(Capture PNG)— 突き合わせ

> Status: **合格**(直さないと困る指摘は無い。軽い指摘が 2 件)
> Sylph による突き合わせ(2026-10-28)。コードは変えていない。
> 相手: 合意 [../../../screens/thumbnail-capture.md](../../../screens/thumbnail-capture.md)、計画 [../../orchestration/thumbnail-capture-wave-plan.md](../../orchestration/thumbnail-capture-wave-plan.md) §1・§2、報告 [../../waves/thumbnail-capture/report.md](../../waves/thumbnail-capture/report.md)。
> 見たもの: ブランチ `runtime-player/thumbnail-capture` の未コミットの変更(`apps/runtime-player` 配下の差分と未追跡ファイル)。

パス略記: `RP/` = `apps/runtime-player/src/`。

## 1. 型検査とテスト(自分で 1 回走らせた)

- `pnpm run typecheck`(apps/runtime-player): exit 0。
- `pnpm run test`: 152 files / 1021 tests がすべて通った。報告の数と一致する。

## 2. 計画 §1 の振る舞い — 報告とコードの一致

| 計画 §1 | コード | 判定 |
|---|---|---|
| 置き場 2 ページ(Capture PNG / Open Folder) | `RP/control/stage-page.tsx`、`RP/control/live-controller-page.tsx` に共有パネル `StagePngCapturePanel` | 一致 |
| canvas だけ・その瞬間・全体・透明・実ピクセル | `RP/stage/stage-renderer/static-stage-canvas-renderer.ts:521` `capturePngImage()` が保持中の `renderInput` を描き直して `toDataURL`。大きさは既存の `resizeCanvasToDisplaySize`。枠やハンドルは DOM のオーバーレイなので写らない | 一致 |
| 保存先 `pictures\Runtime Player`、何も聞かない | `RP/main/runtime-player-main.ts` で `app.getPath("pictures")` を押すたびに解決 | 一致 |
| 名前 `<フォルダ名>-YYYYMMDD-HHMMSS.png`(ローカル時刻) | `RP/main/stage-png-capture/stage-png-capture-file-name.ts` | 一致 |
| 重複は `-2`、`-3`…、上書きしない | `RP/main/stage-png-capture/stage-png-capture-file-writer.ts` の `wx` ループ | 一致 |
| Windows で使えない文字の置き換え | `<>:"/\|?*` と C0 制御文字を `_`。空なら `stage` | 一致(名前の後ろに `-時刻.png` が付くので、末尾の `.`・空白や `CON` などの予約名は問題にならない) |
| Browser Source 接続中も撮れる | capture の経路に Browser Source の分岐が無い | 一致 |
| 押せない条件(未 loaded / Stage Window 無し / 撮影中) | `RP/control/stage-png-capture-panel.tsx:19-41`。main 側でも loaded と Stage の生存を確かめ直す | 一致 |
| feedback(ファイル名 / 理由) | `RP/control/control-window-app.tsx` の `captureStagePng` | 一致 |
| Open Folder(無ければ作って開く) | `mkdir recursive` → `shell.openPath` | 一致 |
| ロールで分岐しない | 登録は `registerRuntimeExportBridgeHandlers` の直後で、ロールの条件の外 | 一致 |

## 3. 正しさ(委任で挙げられた点)

- **id の突き合わせ**: `randomUUID` の id を pending に登録し、返事は id と送り主の webContents id の両方で照合している(`RP/main/stage-png-capture/stage-png-capture-request-broker.ts:79-108`)。他の webContents からの返事・知らない id は捨てる。問題なし。
- **時間切れ・遅れた返事**: 時間切れで pending を消して reject、遅れて来た返事は pending が無いので捨てる。settle で timer を止める。`send` が例外を投げたらすぐ失敗。問題なし。
- **Stage が作り直されたとき**: `windows.stageWindow` は getter(`RP/main/window-management/runtime-player-windows.ts:80`)なので、押すたびに今の Stage を引く。古い Stage 宛ての pending は時間切れで終わり、新しい Stage の返事は id と送り主が違うので混ざらない。壊れはしないが、待ち時間については指摘 1。
- **`wx` のループ**: `EEXIST` のときだけ次の番号へ進み、それ以外のエラーはすぐ投げる。999 回で終わってエラーを投げる。無限ループにならない。
- **preserveDrawingBuffer=false**: `renderCurrentImmediate()` と `canvas.toDataURL()` が同じ同期の呼び出しの中にあり(`static-stage-canvas-renderer.ts:521-532`)、その呼び出しは IPC を受けた listener の中で同期に走る(`RP/stage/stage-window-app.tsx:249-258`)。間に await は無い。正しい。
- **IPC のバイト列の型**: Stage が `Uint8Array` を invoke で送り、main は `instanceof Uint8Array` と PNG 署名で確かめてから `writeFile` に渡す。Electron の structured clone で `Uint8Array` のまま届き(Buffer でも Uint8Array の派生なので通る)、報告の実機確認でも保存まで通っている。問題なし。
- **sender の検証**: `reportCapture` は送り主の webContents id で絞っている。`capturePng` / `openFolder` は送り主を見ないが、既存の他の bridge handler も見ていないので、今の書き方に揃っている(はみ出しではない)。

## 4. 境界

- `stage/` の本番ファイルに縛られた文字(`Runtime Export` など)は入っていない。既存の境界テスト `RP/runtime-player-boundary.test.ts` は変更なしで通る。
- `main/` からの import は `../../preload/*` だけで、`control/`・`stage/` は import していない。
- 既存の書き方(チャネルの定義 / 契約 / handler / preload の分け方、`createXResult` の形、feedback の出し方)に揃っている。

## 5. 指摘(重い順。どれも合格を止めない)

1. **軽: 撮影中に Stage Window が閉じられると、10 秒待ってから「時間内に返事が無い」になる**
   - 場所: `RP/main/stage-png-capture/stage-png-capture-request-broker.ts:49-76`(送った先の webContents の `destroyed` を見ていない)。
   - 例: Capture PNG を押した直後に Stage Window を閉じる → Control のボタンは 10 秒間 `Capturing` のまま → `Stage PNG capture failed: Stage Window did not answer in time.` が出る。理由としては「閉じられた」の方が正しい。Stage を作り直した直後で、まだ React の購読が付いていないうちに押した場合も同じく 10 秒待つ。
   - 直すなら: request のときに `webContents.once("destroyed", …)` で pending をすぐ reject する。今のままでも壊れはしない。
2. **軽【推測】: main は loaded でも、Stage がまだペイロードを受け取っていない間に押すと、空の透明 PNG が「saved」になる**
   - 場所: `RP/stage/stage-renderer/static-stage-canvas-renderer.ts:521-532` と `:674`(`renderInput` が null なら `emptyScene` を描く)。
   - 例: 読み込み・読み直しが終わった直後、Stage 側の描き始めより先に Capture PNG を押す → 全画素 alpha=0 の PNG が保存され、feedback は成功になる。押せる時間はごく短いはずで、実機で起きるかは確かめていない。
   - 直すなら: `capturePngImage()` で `renderInput === null` のときはエラーにする(「Stage has not drawn the model yet.」など)。

## 6. 報告の「判断が要ること」について(所見のみ)

- パネル名「Thumbnail Capture」・置き場、時間切れ 10 秒、名前の頭を 100 文字で切る、同期の `toDataURL`: どれも合意と矛盾しない。決めるのはユーザー。
- 計画 §3 の人間ゲート(`pack` で作り直した器での確認)、Tracking Host での撮影、devicePixelRatio ≠ 1 は未確認のまま(報告 §4 のとおり)。
