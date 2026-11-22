# Wave 1A — ゲーム画面の文字認識と追跡

Windows標準の日本語OCRでキャプチャ画像を読み、表示の交代・消失で本文を確定する。横に割れたOCR出力の復元や認識の空振りには、同じ画像から取った文字の線も使う。同時に進む表示を別々に追い、同じまとまりで読めた行は画面順と改行を保つ。[独立レビュー合格](../../reviews/game-dialogue-ocr/wave1a-review.md)

## 配信への接続

- [Windows OCR](../../../../../apps/soul/agent/src/eyes/windows-ocr.mjs) の `recognizeScreenText({jpegBase64, capturedAtMs}, {signal})` は、時刻・寸法・OCR行と矩形・追跡用の画素マスク・数値の除外根拠を含むフレームか、`{error: {kind, message}}` を返す。空認識は成功フレーム。エラー時は追跡器を更新せず、認識処理には閉場時に中止できる `AbortSignal` を渡す。録画再生は同じ関数の `imageBase64` に元画像を渡す。
- [追跡器](../../../../../apps/soul/agent/src/eyes/game-dialogue-tracker.mjs) の `createGameDialogueTracker()` を場ごとに作る。`update(frame)` は今回確定した記録、`pending()` は表示中の記録を返す。記録には `text`、`displayOrder`、`startedAt`、`lastSeenAt`、`closedAt`、`closeReason` がある。確定した順に受け取り、表示開始順や重なりを `displayOrder` と各時刻から確認できる。保留の `closedAt` と `closeReason` は空値。

## 検証

`src/eyes` の76テストが通過。文字送り、認識の空振り、左右分裂、上下の片方だけの交代、似た本文の交代と実行中の子プロセス中止を確認した。

[エンドフィールドの三場面](wave-1a-endfield-replay.md)では、録画画像146枚すべてを実Windows OCRで読み、その認識と画素マスクを最終の追跡器で再生した。戦闘はダメージ由来のOCR 11件のうち9件を候補から除外し、うち2件は再読による除外。ミンホとティフォロスでは、本文を読めた標本が1枚だけの台詞も残った。数字を含む台詞と改行も確認した。別の合成画像では「残りの12個の祭壇を探さないと。」で3種類の再読が走り、OCR本文を保持した。

操作UIやクエスト表示、OCRの誤字は残る。消失と再表示が取得の間に収まる場合は、連続表示に見えることがある。1474×829の戦闘画像1枚にかかった時間は、子プロセス起動を含めて約1.48秒。実配信の取得解像度・周期・閉場との接続はWave 2で確かめる。
