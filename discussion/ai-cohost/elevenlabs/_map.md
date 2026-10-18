# ElevenLabs Map

> ai-cohost の子トピック。チャッピーの耳と口を ElevenLabs 一式(STT/TTS)へ差し替えたときにどうなるかの評価。

## 1. Why (ユーザー説明 2026-10-12)

- 発端は **STT の確定遅延**。現行の whisper 経路は、喋り終わり → 転写到着が ≈1.5s(VAD の無音待ち 400ms を足すと体感 ≈1.9s。[../experiments/s2-ears.md](../experiments/s2-ears.md))。ElevenLabs の STT は数百 ms で確定するとされ、応答速度に大きく効く。
- 大掛かりな差し替えになるため、やるときは STT/TTS を全部まじめに調査する。**着手前に全体構想をユーザーと合意する**(未実施)。
- 今回の TTS 調査は、[../decisions/](../decisions/_map.md) の出力(音声タグ選び)の接続先として先に下見したもの。

## 2. Key Files

| Path | Content |
|---|---|
| [research/tts-controls-2026-10.md](research/tts-controls-2026-10.md) | TTS で設定・制御できる要素(モデル、voice_settings、音声タグ、料金)。サブエージェント調査 |
| [research/stt-plans-and-realtime-2026-10.md](research/stt-plans-and-realtime-2026-10.md) | STT のプラン差(Free から API で使える、差は同梱量・同時接続・優先度・商用可否)、リアルタイムの確定制御・接続維持・課金・再接続 |
| [experiments/01-stt-behavior.md](experiments/01-stt-behavior.md) | 実マイクでリアルタイム STT を観測。partial は約1秒おき・言葉から0.5〜1.3秒遅れ。commit は喋り終わりから既定 VAD で≈1.6〜1.9秒、VAD 0.3秒指定(実効0.5秒)で≈0.9秒。無音中に「うん/はい」の partial が出る |
| [experiments/02-tts-voice.md](experiments/02-tts-voice.md) | TTS の声選び(共有ボイス → Voice Design の「案3」に決定、Remix では超えず)と手触り(案3の印象が保たれるのは v4 / v4 Turbo。v4 Turbo は HTTP で鳴り始め≈0.2秒。日本語文の頭の英語タグが効く) |

## 3. Observations (第三者事例。画像はリポジトリに置かない)

- ユーザーの知人の取り組み(会話 AI「ミル」、sonnet-5-5)の画面をユーザーが共有(2026-10-12)。観測できたこと:
  - 日本語の発話文の途中に英語タグ `giggles` が入っている(表示上)。日本語文中でのタグ使用の実例。
  - 「話しかけたい度」と「ターン判定(hold / take_turn)」に Jev を使い、表示上の遅延は 156ms / 237ms。
  - 遅延の内訳表示(語尾から): STT 確定 491ms、Jev 728ms、ターン確定 728ms、LLM 先頭 3365ms、最初の文 3561ms、TTS 先頭音 3754ms。
  - これらは画面表示からの読み取りであり、測定条件は不明。

## 4. Decisions (2026-10-16、ユーザー)

- 使うのはリアルタイム用(`scribe_v2_realtime`)。
- partial と commit の使い方: VAD 無音しきい値 0.3 秒指定(実効はサーバー側で 0.5 秒に丸められる)で commit を順に LLM へ渡す方向(experiments/01 の結果を受けて合意)。短い断片の commit をどうまとめるかは未決。
- 計測の入力は実際のマイク発話(配信と同じ条件)。
- 初期調査は Free プランで行う。配信本番で使うときはサブスクに加入する(商用利用の問題を避けるため)。
- commit の速さは要実験。既定 VAD(1.5 秒)では足りない。`turn_prediction` に期待していたが、`scribe_v2_realtime` では使えない(実機確認 2026-10-16)。

- 操縦席で whisper / ElevenLabs を選べるようにする(体験の合意 → [../implementation/screens/cockpit-stt-selection.md](../implementation/screens/cockpit-stt-selection.md))。合図(barge-in・区切り応答)は手元 VAD のまま、転写だけ ElevenLabs の commit にする。

- TTS の声は Voice Design の「案3」(`Ona22sJYfzcps6cE1jVk`)。モデルは v4 系(v4 / v4 Turbo)が候補で、v3・Flash は声が変わるので外す(2026-10-18。[experiments/02-tts-voice.md](experiments/02-tts-voice.md))。乗り換えはまだ決めていない(手触りを試す段階)。

## 5. Unresolved Questions

- 全体構想(何をどこまで差し替えるか)の合意。
- STT の実測: 確定方式(VAD 既定・短縮 VAD・手動)ごとの、喋り終わりから確定までの時間(日本語、日本から)。
- 再接続時の挙動(最初の約2秒のバッファが毎回乗るか、`previous_text` でどこまで繋がるか)。
- 日本語のタグが効くか(英語タグは台詞の頭に付けると効く。experiments/02)。
- TTS の口の動き(文字ごとの時刻 → 口の形)と、返事の繋ぎ方(文ごとか WebSocket か)。
