# Review-Sylph: local-stt (Domain L) 軽いレビュー

対象: ブランチ ai-cohost/local-stt の未コミット作業ツリー(c5f838a8 の上)。基準: local-stt-wave-plan.md §0・§1、domain-l-report.md。

## 判定: 合格(要修正の差分なし)

## テスト
- apps/soul/agent `node --test`: 1648 件 pass / 0 fail / 0 skip / 0 cancelled
- リポジトリルート `pnpm run check:soul-zone`: 緑(1534 files)
- 取得コマンド `--dry-run`: 実 vendor/models では「揃っている(何もしない)」、存在しない --models-dir では 2 エンジンの不足一覧のみ(取得はしていない)

## 確認結果(diff とコードで確認)
1. 親で sherpa を読まない: sherpa を require するのは local-stt-worker.mjs(createRequire)だけ。client は fork するだけ、worker-core は loadSherpa を注入、engines は純関数。no-sherpa-in-parent.test.mjs は実行時(resolve hook + 対照)・静的(入口から辿る)・ソース全体の 3 通りで固定しており、実効的。fork は serialization advanced・stdio ipc・execArgv []。ready 前の fatal/exit/タイムアウトは ready の reject、ready 後の exit は onExit + 応答待ち全 reject、dispose は冪等で kill/destroy/disconnect/unref、dispose 後は onExit なし。ear-pipeline の dispose が localStt.dispose を呼ぶ。二重 Start は既存の started ガードで拒否。
2. 余白: preRoll は ring.slice の startMs(max(0, startMs - preRollMs))だけに掛かり、セグメンタ・VAD イベント(handleVadEvent)は無変更。転写の startMs/endMs は rangeStartMs(余白を含めない)。padWithSilence は useLocal のときだけ。whisper は preRollMs 0 / 無音なし / audio_ctx 従来どおりで、rangeStartMs の式も whisper では cut.startMs と一致(従来と同じ)。ElevenLabs の分岐は無変更。
3. 切り替え: STT_ENGINES 4 値。Start の 400 検証は STT_ENGINES 参照、scripts/cockpit.mjs の復元も STT_ENGINES 参照、保存は既存の setSttEngine。選択肢と表示名(Zipformer を先)・ヘッダ whisper 欄は whisperHealthVisible で whisper(または stt 未到着)のときだけ。
4. 設定キー: 既定 2 / 200 / 300 / ["チャッピー","コーディ"] / 1.5。範囲外・型違いは既定(threads は整数 1〜16、余白 0〜1000、score 0.1〜10)。Start ごとに読む。
5. 警告: localSttDown → stt down(stt-down alert、source = engine)。モデル欠落は Start 前に checkLocalSttModel(0 byte は無い扱い)で理由付き 500・stt down・pipeline を作らない。
6. 遅延: transcribeAndAppend の currentMeta.latencyMs(nowImpl - endWallMs)は whisper と同じ経路。onSttLatency / sttLatencyBySeq(transcribeMs)も共通。
7. 取得コマンド: 配布元は Hugging Face csukuangfj の sherpa-onnx parakeet リポジトリと k2-fsa/sherpa-onnx の GitHub Releases(asr-models)のみ。揃っていれば何もしない。.part → rename。Windows は System32 の tar.exe。

## 差分(修正指針)
なし。

## 注記(任意・修正不要)
- Parakeet の取得元は k2-fsa 直下ではなく csukuangfj(sherpa-onnx 作者)の HF アカウント。計画の「公式」の解釈として許容範囲だが、ユーザーに伝えておくとよい。
- worker-core の `shutdown` メッセージを親は送らない(kill で畳むため)。害はないが未使用経路。
- 子の stderr は読み捨て(落ちた理由は終了コードのみ)。報告 §12 のとおり。
- 実モデルでの動作・ゲーム負荷下の遅延・hotwords の効きは人間ゲート(本レビューでは本物のモデルは動かしていない)。
