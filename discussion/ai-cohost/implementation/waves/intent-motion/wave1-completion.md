# Wave 1 完了報告

Wave 1 の機械ゲートは独立レビュー第2巡で合格。区間入力から、判定の開始、ライブ制御の送受信、パラメータ合成、未対応記録まで確認した。接続契約と記録の読み返し手順は [Wave 1 の契約と根拠](wave1-contract.md)。[独立レビュー](../../reviews/intent-motion/wave1.md)

## 実装

- Soul は `apps/soul/agent/src/mind/speech-intent-motion.mjs`、`speech-intent-none-recorder.mjs` と同ディレクトリのテスト、`src/channel/channel-client.mjs`、`src/test-support/speech-intent-motion-driver.mjs`。判定・記録・再生を分離し、本文が完成する前に音声を開始できる。
- Runtime は `apps/runtime-player/src/main/control-channel/` の要求ディスパッチ、サーバー、オーバーレイ、`speech-motion-state.ts`、プロトコル・スキーマ・交換例、`contract/speech-motion-presets.json`、関連試験。試作から得た三つの多軸姿勢を正規化し、口・まばたきは既存経路に残した。

## 証拠

- 実 DecisionAPI を既存の製品設定で確認。『話を受け取った合図に小さくうなずく』『承知したことを軽い頷きで伝える』は `receive`。『心の中で虹色の花火を打ち上げる』『返答をためらい、迷っていることを伝えたい』は `none`。
- 実 Soul client を子プロセスから起動する Runtime 統合試験で、WebSocket → Runtime overlay → frame heart を確認。既存の口形送信経路 `openSpeech` → `appendSpeech` → `endSpeech`、笑顔と頭・視線の併存、遅延・割り込み・重複・再接続、問いの待機、`none` の無演出と記録を含む。
- Runtime 全体は初回 153 ファイル / 1026 件合格。修正後、独立レビューは Runtime 関連 32/32、同時保存を含む Soul 4 試験を 12 回で 48/48。Runtime 型検査と `git diff --check` も合格。
- 修正後の Soul 全体は `npm test -- --test-reporter=spec --test-timeout=20000` で 2527/2527 合格。Soul zone、依存、fixture チェックも合格。source guard は基点から変更のない `physiology/index.ts` の barrel-only 違反。

## 裁量と残課題

- 初期候補の判定入力を本人の意図だけに絞った。本文と会話文脈は読み返し用に保持する。動作の競合軸では既存表情を優先し、問いの自然終了時は 1500 ms 待ち姿勢を保つ。姿勢の実効値にはモデルマッピング設定が反映される。
- Wave 2 は判定・音声・区間確定の三経路を [Wave 1 の契約](wave1-contract.md) に沿ってつなぐ。中断済み区間は取得済みの本文で確定し、接続を作り直す際は controller も作り直す。
- r804 の実モデル目視、ElevenLabs の実発話との接続、ユーザーの実会話ゲートは未実施。
