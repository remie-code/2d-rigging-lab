# ローカルの文字起こし / Domain L — Parakeet / Zipformer を子プロセスで 完了報告

> Gnome → Undine(2026-10-25)。計画: [../../orchestration/local-stt-wave-plan.md](../../orchestration/local-stt-wave-plan.md) §0・§1 Domain L の 1〜8。根拠: [../../../research/stt-candidates-2026-10.md](../../../research/stt-candidates-2026-10.md) §5・§6。
> ブランチ ai-cohost/local-stt(c5f838a8 の上)。コミットはしていない。依存の追加・`npm install`・モデルの取得はしていない。
> 実機は sherpa-onnx-node 2.0.0、Node 24.19.0、モデルは Undine が置いた `vendor/models/` の 2 つ。会話の本文は報告に書かない。

## 1. 変更・新規ファイル(すべて `apps/soul/` 配下)

新規:
- `agent/src/ears/local-stt/local-stt-engines.mjs` — 語彙(`LOCAL_STT_ENGINES`)・モデルの並びと存在確認・設定の正規化・hotwords の token 化・認識器の設定・無音の余白。sherpa を読まない(親子どちらからも読む)。
- `agent/src/ears/local-stt/local-stt-worker.mjs` — 子プロセスの入口。**sherpa-onnx-node を読み込む唯一のファイル**。
- `agent/src/ears/local-stt/local-stt-worker-core.mjs` — 子の中身(IPC の受け答え)。sherpa は入口から注入(偽物でテストできる)。
- `agent/src/ears/local-stt/local-stt-client.mjs` — 親の係(fork・ready・転写・異常終了の検知・dispose)。
- `agent/scripts/fetch-local-stt-models.mjs` — 取得のコマンド。
- テスト: `local-stt-engines.test.mjs`・`local-stt-worker-core.test.mjs`・`local-stt-client.test.mjs`・`no-sherpa-in-parent.test.mjs`(いずれも `src/ears/local-stt/`)、`agent/scripts/fetch-local-stt-models.test.mjs`、偽物の子プロセス `agent/src/test-support/fake-local-stt-worker.mjs`。

変更:
- `agent/src/ears/ear-pipeline.mjs` — `STT_ENGINES` に parakeet・zipformer。ローカルの起動分岐・余白・子の死(localSttDown)・dispose。
- `agent/src/cockpit/cockpit-server.mjs` — Start の分岐(モデルの確認・設定の読み込み・stt の受け渡し)、localSttDown → stt down、警告のラベル。
- `agent/src/cockpit/cockpit-settings-store.mjs` — `getLocalStt()`。
- `agent/scripts/cockpit.mjs` — `createSttEngineHooks` の既知値を `STT_ENGINES` に、`localSttSettings: () => settings.getLocalStt()` を渡す。
- `agent/src/cockpit/view-logic/settings.mjs`・`health.mjs` — 選択肢と表示名。
- `README.md`(S2 耳の節のモデル配置)— 取得の手順と設定キー。
- 既存テストに追記: `ear-pipeline.test.mjs`・`cockpit-server.test.mjs`・`cockpit-settings-store.test.mjs`・`scripts/cockpit.test.mjs`・view-logic の 2 つ(§9)。

## 2. 子プロセスの形と IPC

- 親は `child_process.fork(local-stt-worker.mjs, [], { serialization: "advanced", stdio: ["ignore","pipe","pipe","ipc"], execArgv: [], windowsHide: true })`。stdout / stderr は必ず読み捨てる(whisper-server と同じ流儀)。
- 親 → 子: `{type:"init", engine, files, threads, hotwords}`(fork 直後に 1 回)/ `{type:"transcribe", id, pcm: Int16Array}` / `{type:"shutdown"}`。
- 子 → 親: `{type:"ready", loadMs, decodingMethod, hotwordsUsed, hotwordsDropped}` / `{type:"fatal", message}`(init 失敗 → exit 1)/ `{type:"result", id, text, ms}` / `{type:"error", id, message}`。
- 推論は子の中でも直列。`decodeAsync` があれば使う(実物にはある)。無ければ `decode` + `getResult`。
- 親の `createLocalSttClient` → `{ ready, transcribe(wavBytes) → {text, rawText, ms}, hasExited, isDisposed, pending, dispose }`。WAV から PCM を取り出し(`readWavPcm`)、16kHz mono 以外は送らずに失敗。応答は id で突き合わせる。
- ready 前の fatal / 終了 / `readyTimeoutMs`(既定 120 秒)超過 → `ready` の reject → 耳の Start 失敗。
- ready 後の終了 → 応答待ちは全部 reject(その発話は asrFailure)・`onExit({code, signal})`。再起動はしない(whisper と同じ設計判断)。
- `dispose()` = 応答待ちを reject → kill → stdio destroy → IPC disconnect → unref。冪等。dispose 後の exit では onExit を呼ばない。
- 親で sherpa を読まない仕組み: 親は入口のパスを fork に渡すだけ。テストで 3 通りに固定(§8)。

## 3. 継ぎ目と余白の実装位置(ear-pipeline.mjs)

- 継ぎ目: `start()` のローカル分岐で `transcribe = (wav) => client.transcribe(wav)`(`options.transcribeImpl` があればそちら)。ASR キュー・外側の見張り・転写バッファ・遅延の物差し(`nowImpl() - job.endWallMs`)は whisper の経路のまま。起動の順は VAD init → 子の ready → マイクを開く(ElevenLabs と同じ)。
- 余白 (a): `handleSpeechEnd` の `ring.slice({ startMs: max(0, event.startMs - preRollMs), endMs })`。セグメンタ(`speechPadMs`)とイベントには触れていない。ストリームの先頭より前は作らない(リングの clamp)。
- 余白 (b): encode の直前に `padWithSilence(cut.samples, silencePadMs)`(前後に 0 を足す)。
- どちらもローカルのときだけ(whisper は preRoll 0・無音なしで従来とバイト単位で同じ切り出し)。audio_ctx もローカルでは計算しない(`transcribe` の第 2 引数なし)。
- 転写の `startMs/endMs` はセグメンタの範囲のまま(余白を含めない)。理由: 転写バッファの区間の意味(ゴースト行・inRange)を whisper と揃えるため。

## 4. 切り替えと表示名

- `STT_ENGINES = ["whisper","elevenlabs","parakeet","zipformer"]`。Start の検証(cockpit-server の 400)はこの配列のままで足りる。保存は既存の `setSttEngine`、起動時の復元は `createSttEngineHooks`(既知値 = STT_ENGINES)。効くのは次の Start から(既存の流儀)。
- 選択肢(設定の入出力タブ): 「ローカル（whisper）」「ElevenLabs」「Zipformer（ローカル）」「Parakeet（ローカル）」(全角括弧は既存に合わせた。本命の Zipformer を先)。
- 上の帯(ヘッダ)の表示名: `Parakeet` / `Zipformer`(例 `stt: Zipformer up`、落ちたら `stt: Zipformer down — 理由`)。
- cockpit-server は、ローカルのときだけ `stt: { ...pipelineOptions.stt, engine, local: {...pipelineOptions.stt.local, ...設定} }` を渡す。whisper では従来どおり stt を足さない。

## 5. 設定ファイルのキー(`cockpit-settings.local.json`・画面なし)

| キー | 既定 | 範囲(外は既定) |
|---|---|---|
| `localSttThreads` | 2 | 整数 1〜16 |
| `localSttPreRollMs` | 200 | 0〜1000 |
| `localSttSilencePadMs` | 300 | 0〜1000 |
| `localSttHotwords` | `["チャッピー","コーディ"]` | 文字列の配列(前後の空白を落とし 32 文字以下・重複なし・最大 50)。空配列 = なし。使える語が 1 つも無い非空配列・配列でない値は既定 |

- 正規化は `normalizeLocalSttSettings`(store の `getLocalStt()` と pipeline の両方で通る)。cockpit-server は Start ごとに `localSttSettings()` を読む。

## 6. hotwords の渡し方と可否

- 型定義(sherpa-onnx-node 2.0.0 の types.js)では、`OfflineRecognizerConfig` の typedef に `decodingMethod`/`hotwordsFile`/`hotwordsScore` が載っていない(載っているのは Online 側)。一方 `non-streaming-asr.js` の `OfflineRecognizer.createStream(hotwords)` の JSDoc に、「transducer + `modified_beam_search` のときだけ効く・'/' 区切り・modelingUnit/bpeVocab が無ければ各語を tokens.txt の token の空白区切りで書く」とある。**発話ごとに `createStream("チ ャ ッ ピ ー/コ ー デ ィ")` で渡す形にした**(一時ファイルが要らない)。
- 認識器の設定は `decodingMethod: "modified_beam_search"`・`maxActivePaths: 4`・`hotwordsScore: 1.5`(sherpa の既定値)。`debug: 1` で読ませると `decoding_method="modified_beam_search" max_active_paths=… hotwords_score=…` と出たので、トップレベルのキーは native 側に届いている。
- **日本語の可否: 表せる。** Zipformer(ReazonSpeech K2 v2)は文字単位の token で、「チ ャ ッ ピ ー」「コ ー デ ィ」の全文字が tokens.txt にある(テストで固定・実物があるときだけ走る)。表せない文字を含む語は子が落として、ready で親へ知らせる(診断 `localSttReady.hotwordsDropped`)。
- 効き目の確認(実機・80 発話の材料): ElevenLabs の参照にあって Zipformer が書けなかったカタカナ語を hotwords にすると、10 発話中、既定の 1.5 で 4 発話・3.0 で 4 発話でその語が出るようになった(出力が変わったのは 20 回中 9 回)。関係の無い語をどれだけ強くしても出力は変わらない(候補の中の並べ替えで、無い音を作らない)。「チャッピー」はもとから 2 件とも書けている。呼びかけでの効きは人間ゲート 4。
- hotwords が空なら `greedy_search`(少し速い)。Parakeet(CTC)には渡さない(渡された語は dropped として返す)。

## 7. 警告と死活

- ready 後に子が落ちる → pipeline が ASR を止めて(以後の発話は `asrSkipped reason:"localSttDown"`)診断 `localSttDown {engine, code, signal}` → cockpit-server が `stt` を down(理由「Zipformer の文字起こしの子プロセスが落ちた (code=…, signal=…)」)→ 上の帯に既存の `stt-down`(alert「文字起こしが止まっている」・source = engine)。whisperDown が stt を down にするのと同格。VAD の合図は生きたまま。
- モデルが無い → cockpit-server が Start の前に `checkLocalSttModel`(0 byte は無い扱い)→ 500・理由(どのフォルダにどのファイルが無いか + 取得のコマンド)・stt down・pipeline を作らない(ElevenLabs のキー切れと同じ)。
- 子の読み込み失敗(fatal・早期終了)→ Start 失敗(stt down・whisper は unknown のまま)。
- `warnings` の繋ぎ直し中の文言のラベルも engine 名に(`sttLabel`)。ローカルは繋ぎ直しが無いので実際には出ない。

## 8. テスト

- 件数: `apps/soul/agent` で `node --test` **1646 件すべて緑**(新規 46 件。skip 0)。リポジトリルートで `pnpm run check:soul-zone` 緑(1534 files)。
- 偽物の子プロセスで固定したこと:
  - IPC: init の中身・Int16Array が送られる・id の突き合わせ(順不同)・1 発話の error・16kHz mono 以外は送らない。
  - ready: 読み込み時間・onReady・ready 前の転写は失敗・タイムアウト。
  - 異常終了: ready 前(fatal / exit)は ready の reject で onExit なし、ready 後は onExit + 応答待ちの reject + 以後の転写の失敗。
  - dispose: kill・disconnect・unref・冪等・onExit なし。
  - 本物の fork + 偽物の子(test-support)で、往復・落ちたときの検知・fatal を確認。
  - 余白: 前 200ms + 前後 300ms の長さと、前後が無音であること。設定 0/0 と範囲外。ストリームの先頭で切れる。whisper には効かない。VAD の合図の時刻がエンジンによらず同じ。
  - 切り替え: Zipformer → Parakeet → whisper で stt の受け渡しが変わる・選択の記憶・設定は Start ごとに読み直す。
  - モデルが無いときの失敗、子の死の警告、読み込み失敗。
  - worker-core: 偽物の sherpa で init・token 化した hotwords・greedy と beam の使い分け・Parakeet・decodeAsync なし・fatal・直列。
- **親で sherpa を読まないこと**(`no-sherpa-in-parent.test.mjs`):
  1. 実行時: 別プロセスで `module.registerHooks` の解決 hook を掛けて、`scripts/cockpit.mjs`・cockpit-server・settings store・ear-pipeline・local-stt の親側 4 ファイル・ears-cli・取得のコマンドを読み込む → `sherpa-onnx` の解決は 0 回。hook が効いていることは `import.meta.resolve` で対照を取った。
  2. 静的: 操縦席と耳 CLI の入口から辿れる import に sherpa の specifier が無く、子の入口も辿れない。
  3. src/ と scripts/ の中で sherpa を import / require するのは `local-stt-worker.mjs` だけ。

## 9. 期待値を変えた既存テスト(仕様変更に伴うもの)

- `src/cockpit/view-logic/settings.test.mjs`「STT_ENGINE_OPTIONS / sttEngineSelection …」— 選択肢に Zipformer・Parakeet の 2 行を足した(+ 復元の 2 行)。
- `src/cockpit/view-logic/health.test.mjs`「sttStatusView …」— `STT_ENGINE_LABELS` に parakeet・zipformer を足した(+ 表示の 2 行)。
- `scripts/cockpit.test.mjs`「createSttEngineHooks: 未記憶/未知値は whisper …」— 期待値は変えず、zipformer / parakeet の復元の 2 行を追記しただけ。

## 10. 実機確認(本物の子プロセス・材料は作業フォルダの切り出し済み音声 u011.wav(3.11 秒)・2 スレッド)

親で本物の Silero VAD(onnxruntime-node)を起こして推論した状態で fork した(同じプロセスでは落ちる組み合わせ)。子を 3 回立てて畳んだあとも親の VAD は動いた。

| | ready(loadMs) | 推論 ms(3 回) | 往復 ms | 文字起こし |
|---|---|---|---|---|
| Zipformer(hotwords 2・modified_beam_search) | 3974 | 156 / 146 / 146 | 164 / 151 / 151 | CER 0.21(参照は ElevenLabs)。名前は書けた |
| Zipformer(hotwords なし・greedy) | 4095 | 134 / 129 / 120 | 140 / 136 / 125 | 同じ |
| Parakeet(greedy・hotwords は使わない) | 2318 | 298 / 301 / 394 | 303 / 304 / 398 | CER 0.16。名前は書けた |

- 往復 − 推論 ≈ 5〜8ms(IPC・WAV の取り出し)。
- 縦貫通(マイク無し・本物の VAD + 本物の子 + 余白の既定・32ms ごとに流す): Start → ready は Zipformer 4.1 秒・Parakeet 2.2 秒。speechEnd → 転写(transcribeMs)は Zipformer 145ms・Parakeet 383ms。asrFailure 0。
- ready は Zipformer の方が遅い(約 4 秒。読み込みは Start のときだけ)。
- 実機確認のスクリプトは作業フォルダ(scratchpad の `local-stt-real-check.mjs`・`local-stt-pipeline-check.mjs`・`hotword-effect2.mjs`)にあり、リポジトリには入れていない。

## 11. 裁量判断

1. hotwords は認識器の `hotwordsFile` ではなく、発話ごとの `createStream(hotwords)` で渡した(型定義の JSDoc にある offline の口・一時ファイル不要・効き目は §6 で確認)。
2. hotwords が空なら greedy_search に落とす(beam は 1 発話あたり +15〜25ms)。
3. 範囲: スレッド 1〜16、余白は両方 0〜1000ms、hotwords は 32 文字 × 50 個まで。
4. 転写の startMs/endMs は余白を含めない(§3)。
5. 子の死は自動で再起動しない(whisper と同じ・人間の Stop→Start)。
6. 子の ready のタイムアウトは 120 秒(whisper-server の readyTimeoutMs と同じ)。
7. 診断 `localSttReady`(loadMs・decodingMethod・hotwords の使った数・落とした語)を出す。SSE の diagnostic にも type だけは流れる(本文は含まない)。
8. 取得のコマンドの Zipformer は、アーカイブから int8 の 3 つと tokens.txt に加えて README.md(ライセンス表記)も取り出す。展開は OS の tar(Windows は System32 の tar.exe)。`--dry-run` だけ実行して「揃っている」を確認した(取得はしていない)。
9. 選択肢の並びは whisper・ElevenLabs・Zipformer・Parakeet(本命を先)。whisper の表示「ローカル（whisper）」は変えていない。

## 12. 残リスク

- ゲームと OBS を動かしながらの推論時間は未計測(人間ゲート 1・2)。
- Zipformer の ready が約 4 秒。Start からマイクが開くまでその分待つ(状態は Starting のまま)。
- hotwords の効き目は「候補の中の並べ替え」程度(§6)。呼びかけでの効きは人間ゲート 4。
- 取得のコマンドは実際のダウンロードを走らせていない(偽物の fetch でだけ確認)。tar のメンバー名は既存のアーカイブの展開物(フォルダ名 `sherpa-onnx-zipformer-ja-reazonspeech-2024-08-01/`)に合わせた。
- 子の stderr は読み捨てている(sherpa のログを診断に出していない)。落ちた理由は終了コードだけ。

## 13. 質問

1. 上の帯のヘッダの `whisper` の死活の項目は、ローカルのときも `unknown` のまま出る(ElevenLabs のときと同じ)。ローカルのときは隠すか。今は変えていない。
2. hotwords の強さ(`hotwordsScore` 1.5)を設定ファイルのキーにするか。計画のキーに無いので足していない。

## 14. 追記(Undine の裁定 2 点への対応・2026-10-25)

1. **ヘッダの whisper 欄**: ローカル(parakeet / zipformer)のときは出さない。`view-logic/health.mjs` に `whisperHealthVisible(stt)` を足し、`ui/header.mjs` の HealthLine が使う。stt の engine が parakeet / zipformer のときだけ隠す(耳を止めても前回の選択の engine が残るので、その間も隠れる)。
   - 「ElevenLabs に揃える」について: 見たところ、ElevenLabs のときは今も `whisper: unknown` を出している(cockpit-ui.test.mjs の既存の期待値「既存の whisper 死活は残す」)。ElevenLabs の表示は変えていない。ElevenLabs も隠すかは質問として残す。
2. **`localSttHotwordsScore`**(hotwords の強さ・既定 1.5・0.1〜10。範囲外・数でない値は既定・画面なし)。設定 → `normalizeLocalSttSettings` → pipeline → client の init(`hotwordsScore`)→ 子が認識器の `hotwordsScore` に入れる。Zipformer で hotwords があるときだけ効く。README の設定キーにも追記した。
- テスト: 正規化の範囲、worker-core(init の値が認識器の設定に入る・省略時は 1.5)、client の init、pipeline の受け渡し、settings store、`whisperHealthVisible`、HealthLine(ローカルでは whisper 欄なし・whisper と stt なしでは今どおり)。`node --test` 1648 件緑・`check:soul-zone` 緑。
- 期待値を変えた既存テストは無い(新規の 2 件と、自分で足したテストへの追記のみ)。
- 追記 2(Undine 裁定): ヘッダの whisper 欄は whisper のときだけ出す(ElevenLabs でも消す)。期待値を変えた既存テスト: cockpit-ui.test.mjs「HealthLine（ログのタブ）: stt（方式と状態）…」の「既存の whisper 死活は残す」→ ElevenLabs では出さない。1648 件緑・check:soul-zone 緑。
