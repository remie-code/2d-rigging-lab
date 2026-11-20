# チャッピーの全登録モーションを見比べる

11資産、24個のDecision候補、36通りの登録済み候補・対象ペアを、実際に再生する28本にまとめた。比較の左がGPT-6 Astra時代の登録版（`4caa13b8`）、右が本人確認後に全28本採用したGPT-6.2 Astra版。

| グループ | 見られる演技 |
|---|---|
| 笑み | 柔らかな微笑み、弾む喜び、照れ、少し得意げな笑み、息を抜いてからの微笑み |
| 一緒に笑う | 相方に向き直って笑う版と、画面・視聴者向けの正面版 |
| 会話 | 受け取り、相方の話への関心、相方への問い、ゲーム画面への好奇心、仕組みへの納得 |
| 安堵 | 画面、相方、視聴者を向いた「短く息を抜く」 |
| 探索・確認 | 探す、一点を見極める、二点を見比べる、戻って再確認する、相方の発見に追いつく、危険が去ったかうかがう |
| 驚き | 不意を突かれて引き、見返す |
| 苦笑 | やれやれ、共感、徒労、茶化し、自分の不得手、柔らかな限界説明 |

条件はr843の同一モデル、同じ仮音声・口パク・画角・再生開始時刻。新作の多くは、発話のどこで注意・姿勢・表情が変わるかを個別に設計した。目を閉じる表情では眼球移動を重ねない。顔の横回転は24度以内。上体の追従、ステージの上下、寄り引きは演技ごとに使い分けた。

台詞は既存の[会話の分解](../../concept/speech-motion-intent.md)、[笑み](../speech-motion-smile-nuances-v1/README.md)、[探索](../speech-motion-search-nuances-v1/README.md)、[苦笑](../speech-motion-wry-nuances-v1/README.md)の代表例・抜粋、および比較用の例文（安堵、笑いの共有、驚きなど）。音声はローカル合成。製品のElevenLabs音声や配信録画の再生ではない。

新たに描画する比較ではRuntime Playerの発話モーション再生器を使い、開始時の接続、発話終了時の保持と解除、Stage Yの導入とScale補間を評価する。通常の自動揺れをオフとした画角で、明示的なStage Y・Scaleを表示する。水平・奥行きの通常ステージ入力はこの条件では画角に加わらない。既に提示した好奇心、弾む喜び、照れの3本はその比較動画を使用する。

## 採用と現用への配置

本人が全比較を確認して右側を採用。[配布用の11定義](../../../../apps/runtime-player/assets/speech-motions/) と現用Runtime Playerの `slots/autonomous-default/speech-motions` に配置した。両方の11ファイルのハッシュが一致し、現用スロットを正規ローダーで開いて24候補・36対象ペアすべてが採用版28本に解決した。各候補の新しい定義履歴も保存済み。通常のPlayerは次回起動から反映する。

配布テストは全候補・対象で採用した入力と実再生を照合し、口パク、Stage、制御の解除を確認する。WebSocket統合を含む制御チャンネルのテスト256件とRuntime Playerの型チェックが通過した。配信での最終的な見え方は次回の実使用で確認する。

## 再生と再生成

ローカルの `tmp/speech-motion/astra-62-library/index.html` から演技・対象を選べる。同じ場所の `all-comparisons.mp4` は演技名と28チャプターを付けた通し版。持ち出す場合は `comparison-library.zip` を展開し、中の `index.html` を開く。MP4だけでも個別再生できる。

制作定義は `takes/` 以下の各ファイル。[描画環境](../game-curiosity-astra-62/README.md)にPython・ffprobeも用意し、リポジトリのルートから次を実行する。

制作時の確認では、正規ローダーで24候補・36ペアすべてが解決し、28本の個別映像と28チャプターの通し映像（2分52秒）を最後まで復号できた。個別映像用の持ち出しZIPも整合性確認済み。

```powershell
python discussion/ai-cohost/experiments/motion-library-astra-62/build.py
node --experimental-transform-types --no-warnings discussion/ai-cohost/experiments/motion-library-astra-62/verify.mjs
```

`--only 01-soft 04-proud` で個別のクリップを再生成し、`--gallery-only` で既存の動画から一覧・ZIPを作り直せる。候補の製品形式JSONは同じ出力場所の `candidate-assets/`。対象共有とDecision候補名は登録版と同じ。確認は一時領域のPlayerローダーで行う。
