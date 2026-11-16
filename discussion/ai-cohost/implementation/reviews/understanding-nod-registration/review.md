# 理解のうなずき登録の独立レビュー

2026-11-15。登録・配備の判定は合格。 [外部演技資産の契約](../../waves/external-motion-assets/wave1-contract.md) · [承認済みの試作](../../../experiments/speech-motion-understanding-nod-v1/README.md)

- 配布元の `understanding-nod` は `game` から `understanding-nod-v1` だけを参照する。配布元と試作の `clips` 全体を Node の `assert.deepEqual` で照合した。4,200 ms の原時計、頭Yの6キー、固定値11個、Stage の倍率1・Y 0の全キーが一致。クリップの長さは描画定義とも一致し、口パク用パラメータへの書き込みはない。 [配布元](../../../../../apps/runtime-player/assets/speech-motions/understanding-nod.json) · [試作曲線](../../../experiments/speech-motion-understanding-nod-v1/performance.json) · [描画定義](../../../experiments/speech-motion-understanding-nod-v1/definition.json)
- 候補説明に「なるほど、そういうことか」という発話例の意味、ゲーム中の仕組み・説明・関係がつながる場面、画面を見たままの一度のうなずきがそろう。相方の話を受け取る相づち、強い同意、勝利を喜ぶ反応、驚きを別の演技として示し、各意図の選択を禁止する指示は含まない。既存の `receive` は相方対象で、1,050 ms の受領クリップを持つ。 [候補説明](../../../../../apps/runtime-player/assets/speech-motions/understanding-nod.json) · [受領クリップ](../../../../../apps/runtime-player/assets/speech-motions/receive.json)
- 配布元と `autonomous-default/speech-motions` の新規ファイルはバイト一致。SHA-256 は `66a17d9c7265898f0cc81148c11367d6c4f0e2d81f5f649cf9ffeb2d07884092`。既存7資産の SHA-256 は、それぞれのフォルダで作業前に記録された比較値と一致した。
- 配布テスト20件を独立に再実行して全件合格。隔離したプロファイルで起動時ローダーを通し、8演技・15ペア・12クリップ、説明の公開、クリップの完全一致、`partner` と `viewers` の未制作判定を確認した。 [配布テスト](../../../../../apps/runtime-player/src/main/control-channel/speech-motion-distribution.test.ts)
- 実装担当の検証記録では、配布元と運用先それぞれの隔離コピーで同じ件数、`receive × partner` の解決、新規定義のアーカイブ保存を確認。配布、ローダー、Stage Presence、発話演技のStage Yの全64件が合格した。証拠はワークスペースの `tmp/speech-motion/understanding-nod-v1/registration-baseline.json` と `registration-verification.json` に保存されている。

現用Playerへの読み込みは次回起動時。実会話での選択と再生は未確認。
