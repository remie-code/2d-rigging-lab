# S2 follow-up 記録: wave 内で対応しない持ち越し事項

> Status: 記録開始(2026-07-12, Orch-Sylph)。Domain C 完了時に Gnome/Orch が追記する。各項目は発生源レビューへのリンクで根拠を辿れる。
> 出典: [../../reviews/s2/domain-a-review.md](../../reviews/s2/domain-a-review.md) / [../../reviews/s2/domain-b-review.md](../../reviews/s2/domain-b-review.md) non-blocking notes + Undine 裁定。

## 1. 転写バッファの無限成長は長期記憶の別問題系列へ(Domain B レビュー質問 2 / Undine 裁定 2026-07-12)

転写バッファ(`transcript-buffer.mjs`)は append-only の in-memory 列で上限なし。**S2/S3 では対応不要が正しい**——テキストのみ・一配信分のメモリ量は自明に小さい(アーキ方向 §2.7「転写バッファは配信一回分」・S系列分解 §4 の除外事項「長期記憶・配信をまたぐ記憶は別問題系列」)。永続化・ローテーション・配信をまたぐ記憶は **persona ではなく長期記憶系列**で扱う。ここに先送りを明示する。

## 2. Domain A レビュー non-blocking の残り(テスト補強候補・回収先未定のもの)

[domain-a-review.md](../../reviews/s2/domain-a-review.md) notes より、Domain C で回収されないもの:

- note 3: ffmpeg-capture の restartResetMs 予算リセット経路が未テスト(nowImpl 注入でテスト可能・常駐の生命線なので価値あり)。
- note 4: maxSpeech 分割テストの末尾 speechCancel 未 assert(挙動は手検算で正・網羅補強)。
- note 5: encodeWav の channels≠1 / int16ToFloat32 の +32767 上端が未テスト(既定経路は固定済み)。
- note 6: fake-ffmpeg の write 直後 exit(大きな --bytes を使う将来テストでは write コールバック後 exit が安全)。
- note 7: silero-vad.process() の出力名不一致時 NaN(下流の有限性検査で顕在化するが、ラッパ自身の明示 throw の方が診断が速い)——Domain C の VAD ラッパ到達テスト追加時に回収可。

## 3. Domain B レビュー non-blocking の残り(Domain C で回収されないもの)

[domain-b-review.md](../../reviews/s2/domain-b-review.md) notes より:

- note 5: whisper-server ヘルスチェック fetch に per-attempt abort がない(localhost 接続拒否は即時 reject のため実害まず無し・記録のみ)。
- note 6: whisper-server lineReader の onStdout 経路が未テスト(onStderr と同一実装・網羅補強)。
- note 7(教訓): untracked 期のファイル不変主張は `git diff` では証明できない。以後の wave ではテスト数/内容照合を根拠にすること。

(Domain B notes 1〜4 は wave 計画 §3 Domain C の設計注記へ引き継ぎ済み——本 followup の対象外。)

## 4. Domain C 完了時の現況更新と新規持ち越し(2026-07-12, Gnome / Domain C)

### §2〜§3 の現況

- Domain A note 7(silero-vad の出力名不一致 NaN)は**回収済み**: 明示 throw に改善 + fake ortImpl テストで固定([domain-c.md](domain-c.md) 参照)。
- Domain B note 1(whisper-client のタイムアウトが本文読み取りを覆わない)は、**新規モジュール `whisper-inference.mjs` 側では構造で回収**(clear が try 全体の finally にのみある+本文ハングのテスト固定)。whisper-client.mjs 自体は Domain B 成果のため未変更——下記の統合候補と同時に直すのが素直。
- Domain A notes 3/4/5/6・Domain B notes 5/6 は引き続き未回収(テスト網羅の補強候補・実害なし)。

### Domain C からの新規持ち越し

1. **whisper-inference.mjs と whisper-client.mjs の統合**: 動的 audio_ctx は whisper-client(Domain B 成果・変更禁止)に注入点が無かったため、audio_ctx 対応の /inference 呼び出しを新規 `whisper-inference.mjs` に置いた(タイムアウト規律は同一・パース純関数は import で共有)。機能が重なる 2 モジュールが並ぶ状態なので、S3 以降で whisper-client へ `extraFields` か `audioCtx` オプションを足して一本化するのが素直(その際 Domain B レビュー note 1 も一緒に閉じる)。
   **併記(Domain C レビュー note 1 / Undine 裁定 2026-07-12)——【S3 設計注記・明示引き継ぎ】**: ear-pipeline の外側 watchdog(utteranceTimeoutMs 45s)は Promise.race のみで**下層の transcribe をキャンセルしない**。watchdog 発火後も転写ジョブは背後で走り続け、**遅延解決すれば正本(転写バッファ)へ append され得る**(asrFailure 診断済みの発話が後から積まれ、seq と startMs の順序が食い違い得る)。既定配線では内側 timeout 30s < 外側 45s のため外側はまず発火せず実害は狭いが、**S3 は転写正本の消費側として「遅延解決が正本に積まれ得る」事実を設計前提に含める**こと。恒久回収は本統合時に「失敗確定後のジョブは append しない」ガード(ジョブ世代トークン等)を足す([../../reviews/s2/domain-c-review.md](../../reviews/s2/domain-c-review.md) note 1)。
2. **whisper-server の自動再起動なし(設計判断)**: ready 後の死は診断表示+ASR 停止(VAD は継続)で人間の再起動に委ねる。配信の長時間運用で「無人復旧が要る」と分かったら、バックオフ付き再起動(ffmpeg-capture の型)を根拠付きで足す。
3. **`-t` は総 CPU を律しない(実測)**: 6T 指定でも推論中の whisper-server は ≈10 コア分を短時間使う(BLAS/flash-attn 層が別に並列化)。二体並走との実干渉は S2 人間ゲートの OBS 同時起動で観察し、問題があれば `--threads 4` への後退や BLAS スレッド環境変数(OPENBLAS_NUM_THREADS 等)の制御を検討([../../../experiments/s2-ears.md](../../../experiments/s2-ears.md) §4)。
4. **maxSpeech 20s 連続発話の機械分割は転写文脈が切れる**: 分割点はモデル都合(無音を待たない)なので文の途中で切れ得る。S3 の発火判定が `reason:"maxSpeech"` を見て「まだ話し続けている」と扱えるよう、reason は転写バッファには載らないが VAD イベントで購読可能。必要になったら entry への reason 伝搬を検討。
5. **ears-cli の VAD イベント JSON は要約のみ**(stderr の `{"event":"vad"}` は type と t_ms だけ)。S6 barge-in の実装時はイベントを CLI 越しでなく ear-pipeline の onVadEvent を直接購読する(その用途には十分)。
6. **【S3 の品質前提】転写は完璧でない(kotoba モデル起因の聞き違い)**: 長文 TTS で「メッシュ生成→メッシュ先生」の聞き違いが **audio_ctx 全窓でも同一に発生** = チューニング無関係のモデル起因([../../../experiments/s2-ears.md](../../../experiments/s2-ears.md) §2.1)。Orch の独立再実行(preflight-ears)でも再現(その後レビューの独立実行でも再現=3実行者全再現)。**S3 の発火判定・LLM への転写注入は「転写は完璧でない」前提で設計する**こと(固有名詞・専門語の誤変換を許容する発火条件、LLM 側の文脈補正への期待、等の材料)。S2 ゴール(転写が積もるのが見える)には影響しない。(Undine 裁定 2026-07-12・domain-c.md §9-Q3)

## 5. Domain C レビュー non-blocking の残り(台帳)

[domain-c-review.md](../../reviews/s2/domain-c-review.md) notes より(note 1 は §4-1 併記済み・note 6 は wave 内で即時回収済み[silero-vad.mjs JSDoc]・note 5 は本 followup が正で対応不要):

- note 2: intraOpNumThreads:1 の per-frame レイテンシはレビュー独立計測でわずかに悪化方向(0.605→0.642ms・計測方法差あり)。差は実時間予算 32ms の 0.1% で結論(劣化は無意味な水準)は不変。「悪化しない」は「悪化が無意味な水準」と読むのが正確。
- note 3: ffmpeg 再起動でセグメンタ状態をリセットしない——再起動を跨いで triggered 中だった発話は前後の音声が 1 発話に接合され得る(VAD 文脈/状態は reset 済みで確率は健全・実害は境界 1 発話の切れ目が不自然な程度)。気になるなら handleCaptureExit でセグメンタ相当の仕切り直しを検討。
- note 4: ear-pipeline.test.mjs の makeHarness は `...pipelineOptions` が後勝ちのため、segmenter を部分指定するとテスト用既定が丸ごと置換される(現テストは全キー指定で回避・将来の書き手への罠として記録)。
