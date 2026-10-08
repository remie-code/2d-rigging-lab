# S3 人間ゲート手順書 — 「独り言 → Fire → 直前の話を踏まえた返事が声 + 口で返る」

> Status: 手順確定（2026-07-12, Gnome / S3 Domain B）。**実行はユーザー**（実マイク・実器接続・
> 実スピーカー再生を伴うため Gnome / エージェントは実行しない＝規律）。
> ゴール: [../../orchestration/s3-wave-plan.md](../../orchestration/s3-wave-plan.md) §1 の人間ゲート——
> 独り言をしばらく → 操縦席の **Fire** → **直前の話を踏まえた返事が声 + 口で返る**。
> 原則「AI は全部聞くが、全部では考えない」が初めて見える。**初の全器官同時稼働**
> （器 + AivisSpeech + 耳 + 知性 + チャネル + 操縦席）。
> 前提: `cd apps/soul/agent && npm install` 済み・`/login` サブスク済み・ガード対象環境変数
> （`ANTHROPIC_API_KEY` 等）未設定・`vendor/` に whisper 一式 + kotoba + silero_vad.onnx 配置済み・
> ffmpeg が PATH（または env `FFMPEG_PATH`）にある（S1 + S2.5 の前提の合算）。

## なぜ人間がやるのか（配線の存在 ≠ 疎通）

機械ゲート（魂の全テスト 269 緑 + `preflight-fire.mjs` + `measure-fire.mjs` の実 SDK 5 ask）は
「fire → 窓収集 → 実 LLM 応答 → soul 記録」までを fake speak/channel で証明済み
（実測: TTFT ≈3.2〜3.9s・[../../../experiments/s3-summon.md](../../../experiments/s3-summon.md)）。
残る未検証は**全器官が同時に立った状態での縦貫通**——実マイクの独り言が会話ログに積もり、Fire 1 発で
その文脈が注入され、返事が実際に声 + 口で返るか。応答が「直前の話を踏まえている」かは人間の耳でしか
判定できない。

## 1. AivisSpeech を起動

`http://127.0.0.1:10101` で待受。疎通確認:

```
curl http://127.0.0.1:10101/version    # "1.1.0-dev" 等が返れば OK
```

## 2. 自律ホスト（器）を起動し Channel を開く

1. **自律ホスト（runtime-player の Autonomous Host 役割）**を起動し、AI の身体モデルをステージに
   出す（口の動きを目視するため画面が見える状態に）。
2. 自律ホストの **Channel ページ**で **`Open Channel`** を押し、表示された **Endpoint URL**
   （`ws://127.0.0.1:<port>/channel?token=<token>`、既定 port 17310）を控える。

## 3. 操縦席を fire 有効で起動（起動コマンド 1 個）

```
npm run cockpit --prefix apps/soul/agent -- --channel "ws://127.0.0.1:<port>/channel?token=<token>"
```

（`<...>` は手順 2 で控えた URL をそのままコピー。等価:
`node apps/soul/agent/scripts/cockpit.mjs --channel "..."`。ポートは `--port 9000`、注入窓は
`--fire-window-min 5`、注入上限は `--fire-max-chars 4000`、TTS は `--tts-base-url` / `--speaker` で
変更可。）

起動すると標準出力に:

```
[cockpit] listening on http://127.0.0.1:8181 (loopback only)
[cockpit] open  http://127.0.0.1:8181/  in your browser — pick a mic, press Start, speak.
[cockpit] fire enabled: channel = ws://127.0.0.1:17310/channel?token=[REDACTED] (window 5 min, max 4000 chars). ...
```

- **`fire enabled` の行が出ることを確認**（`--channel` を忘れると `fire disabled` になり、Fire は
  503 = S2.5 と同じ挙動）。
- ガード対象環境変数があれば起動即拒否される（`起動を拒否しました`→ unset して再起動）。
- LLM の常駐セッションは起動時に立ち上がる（stderr に `session_init` の 1 行 JSON）。
- **Channel への接続は初回 Fire のとき**に行われる（起動順の都合で器が後でも可・接続失敗は
  Fire 時に `(fire error: …)` として操縦席に出て、次の Fire で再試行される）。

## 4. ブラウザで開き、マイクを選んで Start

`http://127.0.0.1:8181/` を開く。S2.5 の操縦席に **Fire セクション**（`[Fire]` ボタン +
`soul: idle`）が増えている。Microphone ドロップダウンでマイクを選び **Start**
（ヘッダが `Listening`・`whisper: up` / `ffmpeg: up` になる——S2.5 手順書 §3 と同じ）。

## 5. 独り言をしばらく

ゲーム実況の独り言のつもりで**数文〜十数文**話す（例: 今やっていること・見えているもの・感想）。
Timeline に `you` の行が積もっていくのを確認する（S2.5 ゲートの再演）。この間、魂は**全部聞いて
いるが、まだ考えていない**（LLM は無風・枠消費ゼロ）。

## 6. Fire

**Fire ボタンを押す**。操縦席で次が起きる:

1. Timeline に**発火マーカー行**（アンバー）: `fired (N lines, M chars injected)`——直近 5 分の
   会話ログが注入された証拠。
2. `soul: thinking`（アンバー・Fire ボタン disable）→ 応答が返ると `soul: speaking`。
3. Timeline に **soul 行**（話者ラベル `soul`・青系）で応答文が積もり、`soul: idle` に戻る。

- busy 中（thinking/speaking）に押しても無視される（`not fired: busy` が控えめに出る）。
- 耳を Start していない / 直近 5 分に発話が無いと `not fired: ears-not-running` / `empty-window`。
- LLM/TTS/器の失敗は Timeline に `(fire error: …)` のゴースト行（淡色）で出る。

## 7. 合格判定 — 「直前の話を踏まえた返事が声 + 口で返る」

- Fire の数秒後（目安 ≈7〜8s・[../../../experiments/s3-summon.md](../../../experiments/s3-summon.md)
  §4 予測）、**スピーカーから声が鳴り、器の口が同期して動き**、
- その内容が**直前の独り言を踏まえている**（例: ボス戦の話をしていたら、ボス戦に反応する一言が
  返る。無関係の定型あいさつではない）。

これが一目一聴で成り立てば **S3 人間ゲート合格**。あわせて
[../../../experiments/s3-summon.md](../../../experiments/s3-summon.md) §4 の記入欄
（Fire → 音声開始の実測 3 回）と §3 の観測項目（遅延 append: Timeline の行順捻れ・古い話題への
反応）も記録する。

## 8. 終了

操縦席のターミナルで **Ctrl+C**（または stdin EOF）。`[cockpit] closing…` のあと、耳 pipeline・
発火オーケストレータ・LLM 常駐セッション・プレイヤー・Channel 接続がすべて畳まれて終了する。

## 9. AHK グローバルホットキー（ゲート後の任意）

ゲート自体は Fire ボタンで成立する。ゲーム中（操縦席タブ非フォーカス）の発火が欲しくなったら
`apps/soul/agent/scripts/fire-hotkey.ahk` を導入する（AutoHotkey v2 をインストール → ファイルを
ダブルクリック → 既定 Ctrl+Alt+F で発火。ポート/キーはファイル先頭で編集・127.0.0.1 以外へは
何も送らない）。

## 10. うまくいかないときの切り分け

| 症状 | 見るところ |
|------|-----------|
| 起動即拒否（`起動を拒否しました`） | ガード対象の環境変数を unset（`ANTHROPIC_API_KEY` 等） |
| `fire disabled` と出る | `--channel` を渡し忘れ（`npm run cockpit -- --channel "..."` の `--` に注意） |
| Fire ボタンで `fire not available` | 同上（操縦席が --channel なしで立っている） |
| `not fired: ears-not-running` | 耳を Start していない（手順 4） |
| `not fired: empty-window` | 直近 5 分（--fire-window-min）に転写が無い。独り言を話してから Fire |
| `(fire error: connection refused …)` | 器の Channel が開いていない/URL 相違。手順 2 の URL を確認して**もう一度 Fire**（再試行される） |
| `(fire error: intent.speech rejected …)` | 器のモデルロード状態（`slotNotWritable` 等・S1 手順書 §6 と同じ） |
| `(fire error: … 10101 …)` / TTS 失敗 | AivisSpeech の起動（手順 1）・`--tts-base-url` |
| 声は鳴るが口が動かない / 口だけ動く | S1 手順書 §6 の切り分けと同じ（Channel 状態 / スピーカー / SoundPlayer） |
| 応答が直前の話を踏まえていない | 発火マーカーの `N lines` を確認（注入が空に近くないか）。転写品質（Timeline の you 行の内容）が崩れていれば S2 の耳チューニングの領分 |
| 転写・耳まわりの不調 | S2.5 手順書 §7（whisper down / ffmpeg down / デバイス列挙失敗） |
