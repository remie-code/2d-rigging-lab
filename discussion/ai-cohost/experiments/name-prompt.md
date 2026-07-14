# 「コーディ」語彙登録スイープ計測記録: Whisper initial prompt の効果測定

> Status: テンプレート（記録待ち・2026-07-14, Gnome / wave「口数配線+コーディ語彙登録」Domain B）。
> **実測値は未記入**——人間が `scripts/bench-name-prompt.mjs` を実走した後にこの枠へ数値を書き込む
> （機械側の実装・純ロジックのテストは完了・実走自体は人間ゲート/計測の領分）。
> 計測手段: `apps/soul/agent/scripts/bench-name-prompt.mjs`（新規・bench-asr.mjs 部品を再利用した
> prompt 有無の対比スイープ）。
> 音声素材の規律: AivisSpeech の TTS 合成音声（メモリ上のみ）。実マイク不使用・ディスク非書き込み
> （[s2-ears.md](s2-ears.md) と同一規律を継承）。
> 出自: [../implementation/waves/s6/s6-followup.md](../implementation/waves/s6/s6-followup.md) §2
> （転写側の用語登録＝Whisper initial prompt）/
> [../implementation/orchestration/verbosity-vocab-wave-plan.md](../implementation/orchestration/verbosity-vocab-wave-plan.md) §1
> 人間ゲート B / [../implementation/orchestration/verbosity-vocab-inventory.md](../implementation/orchestration/verbosity-vocab-inventory.md) §B-2。

## 1. 走らせ方（前提: whisper-server + AivisSpeech 起動）

```
cd apps/soul/agent
node scripts/bench-name-prompt.mjs [--runs N] [--port N] [--synthetic]
```

- **前提起動**: 魂の耳の whisper-server（vendor whisper.cpp v1.9.1）+ AivisSpeech engine
  （既定 `http://127.0.0.1:10101`）。どちらも本スクリプト自身は起動しない（`createWhisperServer` は
  spawn する側だが AivisSpeech は既存プロセスを叩くのみ）。
- `--runs N`（既定 1）: 各文 × パラメータ振り 1 本あたりの prompt 有/無セット実行回数。
- `--port N`: whisper-server の起動ポート（既定は `createWhisperServer` の既定）。
- `--synthetic`: AivisSpeech 不在時の構造疎通確認フォールバック（正弦波・**名前判定には使えないので
  実測記録には使わないこと**）。
- 出力: 標準出力に各文の転写（prompt 有/無）を逐次表示し、最後に `RESULT nameAccuracy: …` /
  `RESULT hallucination: …` の集計行を出す。exit 0 = 計測完了・exit 1 = 失敗。

## 2. 記録する指標

| 指標 | prompt 有 | prompt 無 |
|---|---|---|
| **名前正答率**（名前入り音声の転写に名前揺れ集合がヒットした率） | _(未実測)_ | _(未実測)_ |
| **幻聴混入率**（名前なし音声の転写にコーディ系語が誤って出た率） | _(未実測)_ | _(未実測)_ |

- 名前揺れ集合 `NAME_MATCH_VARIANTS_V0`（`scripts/bench-name-prompt.mjs`）: `コーディー`/`コーディ`/
  `コーティー`/`コーティ`/`こーでぃー`。
- 素材: `NAMED_SENTENCES_V0`（名前入り 3 文）/ `UNNAMED_SENTENCES_V0`（名前なし 3 文・幻聴混入判定用）
  × `PARAM_VARIATIONS_V0`（話速/ピッチ/抑揚の振り 7 パターン: base + 各軸 low/high）。

## 3. 判定基準（wave-plan §1 人間ゲート B）

- **機械的判定**: prompt 有で名前正答率が prompt 無より上がり、かつ幻聴混入率の増加が許容範囲内
  （「許容内」の具体的な閾値は人間の体感判断・v0 では数値基準を固定していない）。
- **体感判定**: 実発話で「コーディ」という呼びかけが以前より拾われやすくなったか。

## 4. 実測記録（未実施）

_(人間ゲート後にここへ実測値・生ログ抜粋・判定結果〔採用/不採用/prompt 文字列の見直し要否〕を追記する。
このセクションは Gnome/Domain B 実装完了時点では空欄のまま——実測していない数字を書かない規律。)_
