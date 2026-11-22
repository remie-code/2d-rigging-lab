# 読み上げ文から演技を決める Wave 1 独立レビュー

2026-11-22。**合格。Wave 2へ進める。** [Wave計画](../../orchestration/sentence-motion-decision-wave-plan.md)・[合意](../../../concept/sentence-motion-decision.md)・[比較実験](../../../experiments/sentence-motion-decision-2026-11-22.md)

- 「料理が効いてるね。お、今の一撃…！」を既存の分割器に入れ、判定入力が一文目と直前会話、続いて二文目と直前会話・一文目であることを確認した。一文目の入力に二文目は含まれない。意図タグを求めず、既存カタログから演技・注意先を独立の二問として一回で問い合わせる。テストは判定器の代替を使う。 [一文の入力と設問](../../../../../apps/soul/agent/src/mind/speech-sentence-motion.mjs)・[試験](../../../../../apps/soul/agent/src/mind/speech-sentence-motion.test.mjs)
- 生の選択を保持し、有効な演技が選ばれ、注意先が不明で、ゲーム画面を共有している場合だけ `game` に補う。非共有時の対象不明、演技なし、補完後も含む対象版未制作を区別できる。 [共通判定](../../../../../apps/soul/agent/src/mind/speech-intent-motion.mjs)
- v2の一文記録は、本文・判定に使用した文脈・共有状態・生の選択と補完先・選択時のカタログによる演技版・音声とモーションの観測結果を保持できる。同じ保存器を使って作成したv1の旧区間をv2と並べて読み、旧ファイルのバイト列と内容を照合した。保存先と区間識別、原子的な公開処理を再利用している。 [記録器](../../../../../apps/soul/agent/src/mind/speech-intent-section-recorder.mjs)・[互換試験](../../../../../apps/soul/agent/src/mind/speech-sentence-motion.test.mjs)
- 実装上の選択は、v2で `kind: "sentence"` を付けること、共有状態を補完と記録に用いること、返事の開始時に直前会話を複製すること。直前会話を何件渡すかは入力元で決まり、比較実験の最大4件は一文判定器に固定していない。Wave 2で、通常経路が適切な時点の会話・共有状態・カタログを渡し、再生観測を完了時に記録することを確認する。

独立再実行は29件成功（新規3件、意図モーション9件、文分割17件）。`git diff --check` 成功。通常の音声経路への結線と再生タイミングは Wave 2 の検証範囲。

```powershell
node --test apps/soul/agent/src/mind/speech-sentence-motion.test.mjs apps/soul/agent/src/mind/speech-intent-motion.test.mjs apps/soul/agent/src/mind/incremental-sentence-tag-buffer.test.mjs
```
