# 声の差し替え Wave 3 / Domain E — 操縦席の声の切り替えと警告 完了報告

> Gnome → Undine（2026-10-18）。計画: [../../orchestration/voice-swap-wave-plan.md](../../orchestration/voice-swap-wave-plan.md) §3 Domain E・「D と E の接点」・「Wave 2 からの申し送り」2。コミットはしていない。`src/voice/` と `apps/runtime-player` には触れていない（作業ツリーの `src/voice/` の差分と新規ファイルは Domain D のもの）。

## 1. 変更したファイル（すべて `apps/soul/agent/` 配下）

- 設定: `src/cockpit/cockpit-settings-store.mjs`（`getTtsEngine` / `setTtsEngine`）
- サーバー: `src/cockpit/cockpit-server.mjs`、`src/cockpit/warnings.mjs`（コメントだけ）
- 起動: `scripts/cockpit.mjs`（`createTtsEngineHooks`、`createVoiceEngineManager`、Start での配線、遅延ログ）
- 画面:
  - `src/cockpit/ui/settings-drawer.mjs`、`ui/app.mjs`、`ui/header.mjs`、`ui/bottom-bar.mjs`
  - `src/cockpit/view-logic/settings.mjs`、`view-logic/health.mjs`、`view-logic/glance-meters.mjs`
- テスト:
  - `cockpit-settings-store.test.mjs`、`cockpit-server.test.mjs`、`scripts/cockpit.test.mjs`
  - `cockpit-ui.test.mjs`、`cockpit-ui-glance.test.mjs`
  - `view-logic/settings.test.mjs`、`view-logic/health.test.mjs`、`view-logic/glance-meters.test.mjs`

## 2. 振る舞い

### 設定

- キー `ttsEngine` を足した（`sttEngine` の写経）。
- 保存層は文字列をそのまま返す。不明な値を `"aivis"` に直すのは `createTtsEngineHooks.resolveInitialTtsEngine`（STT と同じ分担）。

### UI（設定 → 入出力タブ）

- 「文字起こし」の行の下に「声」の select（AivisSpeech / ElevenLabs）を置いた。
- Start の失敗理由を出す共用のエラー欄は、声の行の下へ移した。
- STT と同じ流儀にした。
  - 選んだ値は Start の body `ttsEngine` で送る。
  - 前回の選択は `state.tts.engine` から復元する。選び直した後は上書きしない。
  - 動作中も選べるが、効くのは次の Start から。注記の文言は足していない。STT にも無いため。
- ログのタブの健康 1 行に `tts: ElevenLabs up` などを足した。engine を作る前（unknown）は出さない。

### サーバー（`cockpit-server`）

- 新しい option:
  - `ttsEngineInitial`
  - `onSetTtsEngine`
  - `onPrepareVoiceEngine(kind) → {ok} | {ok:false, reason}`
- 新しい内部 API:
  - `setVoiceEngineStatus({engine, status, reason})`
  - `reportVoiceReadingsFallback()`
- snapshot に `tts: { engine, status, reason }` を足した。キーは載せない。
- `POST /api/ears/start` の `ttsEngine`:
  - 未知の値は 400（`sttEngine` と同じ）。
  - Start のたびに記憶する。
  - 文字起こしのキーの確認の後、耳を開く前に `onPrepareVoiceEngine` を呼ぶ。
  - 声を用意できなければ、耳を開かずに Start を失敗にする（500・理由つき・`tts.status = down`）。
- 遅延のレコード（SSE `latency`・`onReplyLatency`）に `voice`（鳴らした engine の種類）を足した（additive）。

### Start での作成と作り直し（`scripts/cockpit.mjs`）

- `createVoiceEngineManager` の `prepare(kind)` の動き:
  - 種類が前回と同じ: 使い回す。
  - 種類が違う: 古い engine の status の購読を外し、dispose してから `createVoiceEngine(kind, deps)` で作り直す。
  - elevenlabs: その場で `loadElevenLabsApiKey()` を読む。
- 失敗の扱い:
  - 対象は、キーが無い・工場が投げた、の 2 つ。
  - `{ok:false, reason}` を返し、engine を持たない（古い engine も dispose 済み）。
  - 自動で AivisSpeech には戻さない。
- Start より前の Fire は `ensure(desiredTtsEngine)` で同じ道を通る。失敗は理由の Error で、fireError になる。
- engine の `onStatus` は、今の engine の分だけ `server.setVoiceEngineStatus` へ流す（作り直した古い engine の通知は捨てる）。作った直後にも今の `status` を 1 回知らせる。
- 終了時は `voiceEngines.dispose()` で畳む。

### 警告

- 状態で決まるもの（組み立ては `refreshStateWarnings` の中で、STT と同じ）:
  - `tts-reconnecting`（warn）
  - `tts-down`（alert。Start でキーが無いときも出る）
- AivisSpeech のときは、状態から警告を出さない。
- 出来事: `tts-readings-fallback`（warn、60 秒。続けば回数を数える）。
  - detail は出さない。D の通知の中身を警告に載せないため。

## 3. 遅延表示

- 区間名「TTS」「声」とキー `ttsMs` / `voiceMs` はそのままにした（engine に依存しない名前）。
- 凡例の該当 2 項目に、新しい定義を title として添えた。
  - TTS:「声を頼んでから最初の音が届くまで」
  - 声:「最初の音が届いてから鳴り始めるまで」
- 遅延の棒の title の末尾に「（声: ElevenLabs）」を足した。
- 標準出力の遅延の 1 行の末尾に ` voiceEngine=elevenlabs` を足した。
- 旧定義（audio_query → synthesis）を指す文言は、cockpit 配下には残っていなかった。

## 4. D とつなぐときの前提

- 呼ぶ形は `createVoiceEngine("elevenlabs", { readingClient, ttsBaseUrl, speaker, apiKey, onReadingsFallback })`。
  - `readingClient` は `createTtsClient({ baseUrl: args.ttsBaseUrl, speaker: args.speaker })`。
- 前提にしたこと:
  1. `accentPhrases` は D が tts-client に足す。
  2. engine は作った時点で繋ぎ始める。
  3. `status` / `onStatus` は STT と同じ語彙を使う。
- 報告時点の作業ツリーで、D の登録（`VOICE_ENGINE_FACTORIES.elevenlabs`）と `accentPhrases` の形がこの前提と合うことを確認した（読んだだけ）。
- テストは工場を偽物に差し替えている。

## 5. テスト

- `node --test`: 1427 件すべて成功（D の作業中のテストを含む。最後の実行時点）。
- この Domain で足したテストは 23 件:
  - settings-store 2
  - cockpit-server 9
  - cockpit.mjs 7（hooks 1・manager 6）+ 結線 1
  - view-logic 2
  - UI 2
- 既存テストの期待値は変えていない。足した assert は、遅延ログの 1 行・凡例の title・棒の title。
- `check:soul-zone`: 成功（1507 ファイル）。

## 6. 裁量判断

1. 声を用意できないときは、耳の Start ごと失敗にした（STT のキー切れと同じ）。声のない配信を始めさせないため。
2. 声の engine は耳の Stop では畳まない。Wave 2 と同じく、終了か種類の変更で畳む。ElevenLabs は耳が止まっていても繋ぎっぱなし。
3. Start の後で耳の起動自体が失敗しても、用意した engine はそのまま残す。次の Start で使い回す。
4. 遅延に `voice` を足した。人間ゲート 3（体感の速さ）で、engine ごとに見比べられるようにするため。
5. `tts-reconnecting` / `tts-down` の detail は、Start の失敗理由のときだけ入る。engine の status には理由が無いため。

## 7. 残るリスク

- 喋っている最中に Stop → 種類を変えて Start すると、古い engine の dispose で進行中の声が切れる。今は運用外として扱った。
- D の `onDiagnostic`（切断の理由など）は繋いでいない。

## 8. 質問

1. 声を用意できないとき、耳だけ動かす（警告だけ出す）方がよいか。今は Start 失敗にしている。
2. D の `onDiagnostic` の reason を `tts-reconnecting` の detail に出すか。本文やキーが入らないことを D 側で保証できるなら、STT（例: `closed code=1006`）と揃えられる。
