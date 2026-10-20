# 声の差し替え Wave 2 の仕上げ（3 点）完了報告

> Gnome → Undine（2026-10-18）。依頼: Undine 裁定 2026-10-18（domain-c 質問 1・2、wave-2 レビュー差分 1）。
> 元: [domain-c-report.md](domain-c-report.md) §8、[../../reviews/voice-swap/wave-2.md](../../reviews/voice-swap/wave-2.md) 差分 1。
> コミットはしていない。依存・環境は変えていない。

## 1. 変更したファイル

`apps/soul/agent`:

- `src/voice/mora-timeline.mjs`
- `src/voice/mora-timeline.test.mjs`
- `src/voice/speech-streamer.mjs`
- `src/voice/speech-streamer.test.mjs`
- `src/voice/engines/aivis-voice-engine.mjs`（コメントだけ）
- `src/voice/engines/aivis-voice-engine.test.mjs`
- `src/mind/fire-orchestrator.mjs`
- `src/mind/fire-orchestrator.test.mjs`
- `src/mind/fire-diagnostics.test.mjs`

`apps/runtime-player`（説明文だけ。挙動は変えていない）:

- `src/main/control-channel/contract/channel-intent-speech-stream-payload-schema.json`（トップの `description`）
- `src/main/control-channel/contract/channel-protocol-contract.ts`（`end` の JSDoc）

## 2. 各点の対応

### 2-1. 一括の読み上げの上限を 4096 に揃えた（domain-c 質問 1）

- `mora-timeline.mjs` に `MAX_UTTERANCE_TIMELINE_LENGTH = 4096` を置いた。
  - 名前は契約 JSON の `maxUtteranceTimelineLength` を大文字にしたもの。
  - 器側の `runtimePlayerControlChannelSpeechStreamMaxUtteranceLength` と同じ値。
- `buildSpeechTimeline` は 4096 を超えたら throw する（切り詰めない）。エラー文は `exceeding the contract maxUtteranceTimelineLength 4096`。
- `MAX_TIMELINE_ITEMS = 512` は残した。intent.speech の 1 回の上限として `preflight-tts.mjs` が使っている。buildSpeechTimeline の上限ではないことをコメントに書いた。
- 器への分割はもともと入っていた。SpeechStreamer が `SPEECH_STREAM_APPEND_MAX_ITEMS`（512）ずつ appendSpeech する。一括の読み上げでも分かれることをテストで確かめた。
- テストで固定したこと:
  - 値が 4096 であること。
  - 契約 JSON の `maxUtteranceTimelineLength` と同じであること。JSON は `readFileSync` で読むだけで、import はしない。特区の境界の検査は通る。
  - 513 要素と 4096 要素は通り、4097 要素は throw すること。
  - 上限は母音の数（脱落した要素を除いた数）で判定すること。
  - 1ms ずつ押し出す処理が 4096 回続いても壊れないこと。
  - AivisSpeech engine + speakOnce で 1300 要素が 1 発話のまま `[512, 512, 276]` に分けて append されること。open は 1 回だけで、id もすべて同じ。
- 既存テスト 2 件の「上限超」の入力を 513 から `MAX_UTTERANCE_TIMELINE_LENGTH + 1` に変えた。
  - `aivis-voice-engine.test`
  - `fire-diagnostics.test`
  - 上限の変更に伴うもので、期待値（code・stage）は変えていない。

### 2-2. Claude 経路で鳴らし始めた後に失敗したとき（domain-c 質問 2）

- **STARTED の後に失敗し、鳴った分が 1 文字以上あるとき**
  - soul に `${鳴った分}\n${PROGRESSIVE_INTERRUPTION_NOTE}` を 1 回追記する。文ごとの経路と同じ文言・同じ形。
  - onSoulTranscript を出す。
  - 返り値は `{fired:false, reason:"speech-playback-failed", charsSpoken, elapsedMs, expressions}`。
  - fireError は出さない。文ごとの経路で途中まで鳴って失敗したときと同じ扱い。
  - 本文を含まないトレース `speech.partial.projected`（playedChars / totalChars / terminalCause）を出す。
- **鳴った分の求め方**: `computeSpokenPrefix` に次の 3 つを渡す。
  - 止まる前の snapshot() の累積の時間割。
  - snapshot() の STARTED 時刻。
  - 失敗の時刻。
- **STARTED の前の失敗、または鳴った分が 0 文字のとき**: 今どおり fireError にし、soul には積まない。
- **失敗の時刻を出すため、SpeechStreamer に次を足した**:
  - `abort(cause, error, atMs?)`。player の事象（ERROR / STOPPED / exit）が持つ atMs を使う。無いときは now()。
  - snapshot の `stoppedActive`。世代を閉じたときに鳴らしていた文を、閉じた時刻つきで残す。自然に終わったときは null。
  - speakOnce の `ended` に `atMs` を足した。`snapshot()` は、鳴らしている文が無くなった後は stoppedActive を見る。
  - 既存のフィールドは変えていない。
- テスト:
  - orchestrator: 350ms 鳴った後の ERROR で `こんに\n（応答は途中で中断されました）` になる（fireError なし、release 1 回、トレースに本文なし）。
  - orchestrator: 0 文字のときと STARTED 前のときは fireError になる。
  - orchestrator: 見張りの時間切れでも正本化される（失敗の時刻は時計から取る）。
  - streamer: ended の atMs と、失敗の後の snapshot。
  - streamer: stoppedActive。

### 2-3. 契約の説明を更新した（wave-2 差分 1）

- JSON と TS の 2 か所から「no automatic close」を外し、安全網の説明を足した。足した内容:
  - payload の項目ではない。
  - データが尽きた時刻（最後のモーラの絶対時刻と、それを運んだ slice の受理時刻の遅いほう）から 2000ms の間、append も end も来なければ、その時刻に end を受理したのと同じに閉じる。
  - その後の append / end は無視する。
- TS には定数名 `RUNTIME_PLAYER_SPEECH_STREAM_STALL_END_MS` も書いた。
- 契約テストは description を固定していない（確認済み）。

## 3. テスト結果

| 対象 | 結果 |
|---|---|
| apps/soul/agent `node --test` | 1402 件すべて成功（1396 から 6 件増。mora-timeline +1、orchestrator +2、streamer +3） |
| `pnpm run check:soul-zone` | 成功（1504 ファイル） |
| apps/runtime-player `vitest run` | 142 ファイル・981 件すべて成功 |
| apps/runtime-player `tsc --noEmit` | エラーなし |

## 4. 裁量判断

1. **STARTED の後でも、鳴った分が 0 文字なら fireError にした。** 文ごとの経路も、空の playedText は正本化しない。注記だけの行は作らない。
2. **次の ask への継続の注記（`PROGRESSIVE_CONTINUITY_INSTRUCTION`）は付けていない。** 一括の読み上げの barge-in / kill も付けていないので、それに合わせた。
3. **返り値の reason は新しく `speech-playback-failed` にした。** 文ごとの経路の `progressive-delivery-failed` と同じく fired:false。reason を見て分岐しているのは `fire.completed` のトレースだけ。

## 5. 残るリスク・注記

- `scripts/preflight-tts.mjs` は今も intent.speech の 512 上限で検査している。512 モーラを超える `--text` を渡すと、契約違反として報告される。短い既定の文では影響しない。直していない。
- `scripts/first-light.mjs` も buildSpeechTimeline を使うが、時間割を作るだけで送らないので影響しない。
- SpeechStreamer 自身は、1 発話の合計が 4096 以下かを検査していない。Wave 3 の ElevenLabs engine が 4096 を超える alignment を出すと、器が invalidPayload で拒否し、play-failed になる。

## 6. 質問

1. 一括の読み上げで鳴った分を正本化したとき、次の ask へ継続の注記を付けるべきか。今は barge-in と同じく付けていない（§4-2）。
2. `preflight-tts.mjs` の検査を intent.speechStream の上限（4096、append 512 ずつ）に合わせるべきか。手動の確認用の道具なので、今回は据え置いた（§5）。
