# 読み上げ文から演技を決める Wave 2 独立レビュー

2026-11-22。**機械検証は合格。配信者による最終確認は未実施。** [Wave計画](../../orchestration/sentence-motion-decision-wave-plan.md)・[Wave 1レビュー](wave1-review.md)・[体験と責務の合意](../../../concept/sentence-motion-decision.md)・[比較実験](../../../experiments/sentence-motion-decision-2026-11-22.md)

- Codexの逐次テキストとClaudeの全文結果は、既存の文分割器から同じ音声ジョブと一文判定へ進む。判定は文を音声キューに渡す時点で起動し、キューの開始・終了処理では結果を待たない。実PlayerのWebSocket統合で一文目と二文目の開始をそれぞれ判定保留中に進め、二文目の遅い結果が鳴っている最中に適用され、一文目の結果が逆順で到着してもポーズが変わらないことを確認した。早い結果は再生開始通知後に適用される。[Fire](../../../../../apps/soul/agent/src/mind/fire-orchestrator.mjs)・[文ジョブ](../../../../../apps/soul/agent/src/mind/speech-sentence-delivery.mjs)・[実Player統合試験](../../../../../apps/runtime-player/src/main/control-channel/speech-intent-motion-integration.test.ts)
- 音声ジョブの終端で適用可能な期間を閉じる。割り込みとキルで仕草が解除され、閉場開始後の判定を棄却し、接続交替で旧接続の判定を新接続に送らないことを確認した。連続判定では同一応答の隣接文で演技と補完後の注意先が一致し、最初の再生要求が受理された場合に再始動を抑える。実Playerで連続うなずきが先行クリップの位置を保つことと、別の演技でポーズが変わることを確認した。[モーション制御](../../../../../apps/soul/agent/src/mind/speech-intent-motion.mjs)・[Cockpitの接続交替試験](../../../../../apps/soul/agent/scripts/cockpit.test.mjs)
- v2記録を統合試験で読み直し、対象文、直前会話と先行文、選択値、共有中の補完、選択時の演技版、音声の完了・中断・未開始、モーションの要求受理・見送りを照合した。運用記録のモーション可視性は `unobserved` で、実Player試験では別途フレームの値を確認した。v1の読み取り互換と判定時カタログの版保持も関連試験で再確認した。[記録器](../../../../../apps/soul/agent/src/mind/speech-intent-section-recorder.mjs)・[記録試験](../../../../../apps/soul/agent/src/mind/speech-sentence-motion.test.mjs)
- Cockpitは受理時に、場に対応する既存の見る窓から共有状態を取り、体あり・ElevenLabsのロールにモーション制御を渡す。FireはさらにPlayerと制御チャネルを要する。機械試験では通常のCockpit本体の結線を検査し、実Player統合のFireで同じ窓リゾルバーを通したゲーム共有と見る窓なしVCを比較した。体なしの発火試験では合成用のモーション制御を渡しても判定を開始せず、音声が出ることを確認した。外部配信とDiscordへの実接続は行っていない。[Cockpit起動時の結線](../../../../../apps/soul/agent/src/cockpit/startup/run-cockpit.mjs)・[Discordの窓結線試験](../../../../../apps/soul/agent/scripts/cockpit-discord-g.test.mjs)・[Fire試験](../../../../../apps/soul/agent/src/mind/fire-orchestrator.test.mjs)
- 意図タグの教示を削除し、Codexの初回と圧縮復元では人格設定が維持されること、Claudeの初回および通常・自動・視覚発火にも意図タグ教示が入らないことを確認した。表情・思い出し・小タスクの既存処理と、残存する意図マーカーを読み上げから除く処理は関連回帰の対象に含まれる。[Codexセッション](../../../../../apps/soul/agent/src/mind/codex-session.test.mjs)・[Claudeセッション](../../../../../apps/soul/agent/src/mind/llm-session.test.mjs)

独立再実行はSoul関連362件、実Player WebSocket統合1件が成功。`git diff --check` も成功。Orchの検証ではSoul全体2638件、Player関連59件が成功し、開発用に隔離した通常起動で `/` と `/api/state`、標準入力EOFによる終了、起動ラッパーの `--help` を確認した。

## 配信者による最終確認

開発用の場と記憶を使って普段どおり会話し、声のテンポ、応答中の仕草の切替、同じうなずきの再始動の有無を一度の確認で見る。気になった台詞の一部を控え、場を終えてから一文の記録で判定と演技版、再生の観測を照合する。[起動・確認・記録の手順](../../waves/sentence-motion-decision/human-gate.md)
