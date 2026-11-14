# 演技×注意対象 Wave 2 独立レビュー

**2026-11-12 合格。** [Wave 2 の受け入れ基準](../../waves/performance-attention/wave2-basis.md)、[Wave 1 の実装契約](../../waves/performance-attention/wave1-contract.md)、[ユーザー判断 §7](../../../concept/speech-motion-performance-and-attention.md#7-製品接続のcontext-check2026-11-12確定)を実装、試験、更新後の通常版と portable に照合した。

## 判定から再生まで

- Soul は自由記述の原意図タグ、区間本文、ask 開始時に取得した直前会話を同じ入力に入れる。演技の質問は意図を尊重するよう指示し、本文との一致を評価しない。対象は独立した質問で一つを選ぶ。演技の `none` と対象の `unknown` を加えた二問を、既存の Decision helper に一回で渡す。 [Soul の判定と区間状態](../../../../../apps/soul/agent/src/mind/speech-intent-motion.mjs)
- 選択肢と制作済み6組は Soul と Runtime が同じ JSON から読む。演技未対応、対象不明、未制作の順で照合し、別対象への置換は行わない。WS の拒否・通信失敗、判定の拒否・通信失敗は意味上の結果から分ける。 [共有レジストリ](../../../../../apps/runtime-player/src/main/control-channel/contract/speech-motion-registry.json)・[Runtime の解決処理](../../../../../apps/runtime-player/src/main/control-channel/contract/speech-motion-registry.mjs)
- 逐次経路では最初に確定した音声ジョブの本文を enqueue と同じターンに保存し、判定は microtask で開始する。一括経路では末尾を含めた区間全体を判定へ渡す。空区間は判定と `begin` を送らない。発話中に判定を受け取ったときだけ再生を開始でき、同一区間の音声ジョブ間で待つ場合は次の `STARTED` で再確認する。音声の enqueue、合成、プレーヤー開始は判定や記録の完了を待たない。 [Fire](../../../../../apps/soul/agent/src/mind/fire-orchestrator.mjs)・[区間と音声ジョブの対応](../../../../../apps/soul/agent/src/mind/speech-intent-delivery.mjs)
- 再生操作は接続、世代、区間に結び付ける。通常 `end` は追加の `play` を閉じ、開始済みの短い安堵は4.5秒の曲線末尾まで進む。次の区間開始、barge-in、kill、切断で解除する。実WS試験は受付応答を確認した後、フレームの目・顔・胴・Stage Y を照合して適用と解除を確認している。 [Cockpit の接続所有](../../../../../apps/soul/agent/scripts/cockpit.mjs)・[実WS統合試験](../../../../../apps/runtime-player/src/main/control-channel/speech-intent-motion-integration.test.ts)

## 記録

- v3 の意味上の未対応記録は両方の選択値、識別子、原意図と原タグ、直前会話、判定時本文とその範囲、最終区間本文を保持する。音声範囲の状態は対応するプレーヤーの `STARTED` / `ENDED` と配信状態から得る。UTF-16 の本文範囲を保存し、聞こえた文字数の推計は含めない。実WS試験の kill ケースで `completed`、`started-incomplete`、`not-started`、`not-enqueued` の4範囲を実ファイルと照合した。 [音声観測の受け渡し](../../../../../apps/soul/agent/src/voice/speech-streamer.mjs)・[記録処理](../../../../../apps/soul/agent/src/mind/speech-intent-none-recorder.mjs)
- 保存先は `apps/soul/agent/tmp/speech-intent-none/`。一時ファイルを書き終えた後にハードリンクで公開し、既存ファイルを上書きしない。作業後の228件についてファイル名と内容 SHA-256 の一覧を独立に集計した。作業前の Orchestrator の集計値 `22A599B6F8E80C9DEF5DEE8951A5CDD9F6ECE0F8124D20F81C822A0B96515696` に一致した。
- `ask` と `viewers` の合成例は `unproduced-pair` を保存した。判定に使った本文は最終本文の `[0, 14)` と一致し、プレーヤーが完了した2ジョブの範囲は `[0, 14)` と `[14, 23)` だった。 [合成記録例](../../../../../tmp/performance-attention-package/records/ab47786e3dab2270f751ac47c6ae2533fdd1d526d3ba51ceb77683da07c03148.json)

## 独立再実行

実WS統合試験をループバックの許可下で再実行し、1/1合格。制御した音声合成と再生イベントで、判定保留中に先行音声の口パラメータが動くことを一括・逐次の両方で確認した。同じ試験で判定の順序逆転、通常終了と遅着、kill、barge-in、世代・接続の交代、意味上の3理由、拒否・通信失敗・モデル不一致を確認した。

Soul の `fire-orchestrator.test.mjs`、`incremental-sentence-tag-buffer.test.mjs`、`speech-intent-motion.test.mjs`、`cockpit.test.mjs` も、一時領域へのファイル操作を許可してまとめて再実行し、終了コード0を確認した。

実装側の集計は Runtime 155ファイル・1065件、packages 250ファイル・1552件、Soul 関連164件と Cockpit を含む295件。Soul の2集計には重複がある。packages の件数は `preview-viewer-equivalence-fixture.test.ts` を除いた実行。型検査、依存・Soul Zone・fixture 検査は合格し、ソース構成検査は既知の `apps/runtime-player/src/main/physiology/index.ts` 1件を報告した。 [実行コマンドと集計](../../../../../tmp/performance-attention-package/checks.json)

## 実Decisionと音声初動

本番の Decision helper と `gpt-6-luna` に非私的な合成例を各1回送った結果を確認した。最初の3例は原タグと本文が同じで、直前会話だけが異なる。演技は3例とも `brief-relief` で、対象は相方・ゲーム画面・視聴者に変わった。残り3例は `none` と視聴者、`brief-relief` と不明、`ask` と視聴者で、対応する未対応理由と両方の選択値が揃った。判定時間は各例順に 1529、321、241、250、258、226ms。 [合成入力と結果](../../../../../tmp/performance-attention-package/decision-probe-observed.json)

音声初動は Fire と本番 `SpeechStreamer` を模擬 transport・TTS・プレーヤーへつなぎ、判定を300ms保留して別に計測した。最初の確定文から逐次の最初のPCMは0.149〜1.254ms、模擬 `STARTED` は0.232〜1.687ms。一括の最初のPCMは0.130〜0.150ms、模擬 `STARTED` は0.195〜0.216ms。各3回すべてで判定完了より先行した。この計測範囲は確定文から模擬プレーヤーまで。 [音声初動の計測値](../../../../../tmp/performance-attention-package/audio-timing.json)

## 配布物

通常版 exe・portable exe・通常版 `app.asar` のバイト数と SHA-256 を実ファイルから再計算し、配布時のマニフェストと一致した。`app.asar` から取り出した `out/main/main.js` はビルド出力と SHA-256 が一致した。バンドル内の演技と対象の説明、6組、r804適用条件、3クリップの全曲線を現行の共有JSONと照合し、値が一致した。 [配布物マニフェスト](../../../../../tmp/performance-attention-package/artifact-manifest.json)

通常版を別プロファイルで起動した報告では、読み込んだ asar の SHA-256 が実ファイルと一致し、r804 の6組すべてで WS の指示が Stage のフレームへ適用された。短い安堵は約70ms後の `end` を越えて進み、ゲーム画面は顔Y −7.60、相方は胴X −5.80、視聴者は目Y 0.48に達した。3組とも Stage Y が変わり、終了後は元の Y 34pxへ戻った。確認範囲は Stage の描画入力とビュー変換。 [通常版の隔離起動](../../../../../tmp/performance-attention-package/proof-TejEQd/report.json)

Portable が展開して実際に読み込んだ asar の SHA-256 も通常版と一致した。別プロファイルの r804 で同じ6組が適用され、短い安堵3組は通常版と同じ代表値（顔Y −7.60、胴X −5.80、目Y 0.48）に達して Stage Y が34pxへ戻った。初回の隔離試験は初期IPCの4秒の観測上限に達したため、試験側を15秒に延ばして再実行した。 [Portable の隔離起動](../../../../../tmp/performance-attention-package/proof-GwQzdy/report.json)

本人の実会話、動きの自然さ、実際の未対応記録から次の制作に戻れることは [本人確認](../../waves/performance-attention/human-gate.md) に残る。
