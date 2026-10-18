# 声の差し替え Wave 2 突き合わせレビュー(Review-Sylph・軽め 1 レーン)

> 対象: 未コミット作業ツリー(Wave 1 = 0ea68aea の上)。基準: [voice-swap-wave-plan.md](../../orchestration/voice-swap-wave-plan.md) §0・§2 Domain C・「Wave 1 からの申し送り」1〜6。報告 [domain-c-report.md](../../waves/voice-swap/domain-c-report.md)・[domain-a2-report.md](../../waves/voice-swap/domain-a2-report.md) は diff とテストで確かめた。

## 判定: 合格(軽微な差分 1 件。Wave 3 へ持ち込む注記 4 件)

## テスト件数(自分で実行)

| 対象 | 結果 |
|---|---|
| apps/soul/agent `node --test` | 1396 件 pass / 0 fail(報告どおり) |
| `check:soul-zone` | 成功(1504 ファイル) |
| apps/runtime-player `vitest run` | 142 ファイル 981 件 pass |
| apps/runtime-player `tsc --noEmit` | エラーなし |
| scripts/*.mjs の import 解決 | すべて読み込める(削除したモジュールの参照切れなし) |

## 確認できたこと

- **VoiceEngine の形**: format/audio/timeline/end の 4 種、`status`/`onStatus`/`dispose`/`kind`、失敗は列の途中の throw。`createVoiceEngine(kind, deps)` は `VOICE_ENGINE_FACTORIES` に 1 行足せば elevenlabs を載せられ、不明な kind は RangeError。状態の入れ物(`engine-status.mjs`)も Wave 3 で流用できる。
- **SpeechStreamer と申し送り 1〜4**:
  - 1: プレイヤー/engine は `onEarsStarted` → `ensureVoiceResources()` で作る。落ちていれば作り直す。
  - 2: `openSpeech` は FIFO の先頭(`pump` で active になった文)の format と最初の音(または end)が揃ってから。時間割の append は音の write より先。
  - 3: accepted は効いた根拠にせず、`active` と player イベントの id 照合だけで発話順を決めている。
  - 4: abort/dispose/失敗は player.stop → `releaseMouth`。自然終了は `endSpeech`。endSpeech 失敗は鳴り終わりで release。open が飛行中に中断しても `openAttempted` で release が出る。
- **Codex 経路**: FIFO、STARTED 前の bargeIn 不発(`hasAudiblyStarted`)、`playedText` は ENDED まで鳴った文だけ。diagnostic 名(bargeIn…/kill…)も維持。
- **Claude 経路**: 完了は `ended`(ENDED/中断/失敗)。`computeSpokenPrefix` へは止める前の `snapshot()`(累積時間割と STARTED 時刻)を渡し、STARTED 前は経過 0。STARTED の時刻は両側とも `Date.now` 系。
- **割り込み・キル**: `abort` が `player.stop()` を同期に呼び、全 job の `AbortController` を abort して signal が engine へ届く。Aivis engine は各 await の前後で `throwIfAborted`、tts-client にも signal を通している。
- **遅延イベント**: `voice.synthesis.requested` → `voice.audio.first_chunk` → `voice.player.started` を fire-latency が `…:sentence-1` で拾う。fire-diagnostics の開始の目印は `speech.playback.activated`。操縦席の表示キー(ttsMs/voiceMs)は据え置きで整合。旧名(`tts.synthesis.completed` 等)の参照は fire-diagnostics/ の古い実行ログ(gitignore)だけ。
- **削除ファイルの参照**: grep でコードの参照ゼロ(コメントの言及のみ)。
- **Domain A2**: 安全網 `RUNTIME_PLAYER_SPEECH_STREAM_STALL_END_MS = 2000` は申し送り 5 どおり。評価は純関数のまま、store が書き戻して遅れた append/end/open で終端を後ろにずらさない。**golden・凸恒等式・onset の期待値は diff 上無変更**(speech-timeline-state.test は削除行ゼロ、store test は下記 2 件の時刻のみ)。
- **既存テスト 2 件の時刻変更(5000→1500ms)**: 「end 無しなら 5 秒後も開いたまま」を確かめていたもので、2000ms の安全網で意味が変わるため時刻を窓の内側へ動かすのが必然。1500ms は ended 済みなら閉じている(約 680ms 以降)より後、安全網(最後のモーラ + 2000ms)より前で、意図が保たれる。**例外として認めてよい**。

## 差分

1. **(軽微)契約の記述が A2 と食い違う。** `contract/channel-intent-speech-stream-payload-schema.json` の description と `contract/channel-protocol-contract.ts:256` が「until end ... (no automatic close)」のまま。計画 §1 の文言も同じ(申し送り 5 が上書き)。
   - 修正指針: 2 か所に「データが尽きてから 2000ms、続きも end も来なければ end と同じに閉じる(以後の append/end は無視)」を追記。挙動は変えない。契約テストが description を固定していないか確認。Wave 3 の前でも後でもよい。

## Wave 3 への注記

1. **ElevenLabs engine は abort を状況で読み分けること。** `markTerminal` は自然完了した文でも `controller.abort()` を呼び、barge-in/kill では全 job を一斉に abort する。engine は(a)end 後の abort は無視、(b)複数文の abort でも接続切断・再接続は 1 回に束ねる。そうしないと正常な文のたびに切断・再接続する。1 本の WebSocket を複数文が共有するため、文ごとの `synthesize` は engine 内で直列化する必要もある(SpeechStreamer は次の文の synthesize を前の文の再生中に始める)。
2. **操縦席の engine 切り替え(Domain E)。** `cockpit.mjs` の `ensureVoiceResources` は `voiceEngine == null` のときだけ作り、種類は `DEFAULT_VOICE_ENGINE_KIND` 固定。「次の Start から効く」には、Start で `ttsEngine` を読み、種類が変わっていたら dispose して作り直す処理が要る(進行中の Fire は `acceptedEngine` を持つので、旧 engine の dispose は Fire の境目まで待つ)。`onStatus` を警告へつなぐ配線もまだ無い(想定どおり Wave 3)。
3. **安全網 2000ms と ElevenLabs のチャンク間隔。** 通信の揺れでチャンク(alignment)の到着が 2 秒以上空くと、器は文の途中で口を閉じ、その後の append は accepted のまま無視される(その文は声だけ鳴る)。データ切れは「最後のモーラの絶対時刻と受理時刻の遅いほう」から数えるので通常は余裕があるが、人間ゲート 6(ネット不調)で口が途中で止まる症状が出たら原因はこれ。
4. **計画 §0 の記述との差。** AivisVoiceEngine は format → **timeline → audio** → end の順(append を音より先に届けるため。Domain C の裁量)。ElevenLabs でも「その音に対応する alignment を先に出す」順が望ましい(`flush` は時間割を音より先に送る)。計画 §0 の文言をこの順に直すと誤読がない。

## その他の注記

- 旧 Claude 経路の `buildSpeechTimeline` の 512 上限は据え置き。器の上限は発話 4096 になったので、Domain C の質問 1(緩めるか)は Undine の裁定待ち。Claude の 512 モーラ超の長文は今と同じく失敗する(退行ではない)。
- 鳴らし始めた後の失敗(Claude 経路)は fireError で soul に積まない(質問 2)。Codex 経路は鳴った分を正本化するので両経路で扱いが違う。必要なら Undine が裁定。
- 申し送り 6: `apps/runtime-player/out/` の再ビルドは人間ゲート前に必要(この wave では未実施)。
- スクリプト群の import 確認のため scripts/*.mjs を読み込んだ(`preflight-*` は引数なしで usage/キー不足を出して終わる。実際の合成・再生はしていない)。
