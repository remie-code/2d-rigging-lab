# S3 計測記録: 呼べば応える（Fire → 注入 → 応答）

> Status: 機械計測完了（2026-07-12, Gnome / S3 Domain B）。音声開始 E2E は人間ゲート記入欄（§4）。
> 計測系: `apps/soul/agent/scripts/measure-fire.mjs` — **実 SDK**（createLlmSession・claude-opus-4-8・
> FIRE_SYSTEM_PROMPT = 最小仮面 v0）+ **実** createFireOrchestrator + **実** transcript-buffer
> （you 発話は fixture で積む）+ **fake** speak/channel/player（実 TTS・実器・実再生・実マイクなし）。
> SDK 実消費は **5 ask（ハードガード付き・全数成功）**。サブスク OAuth（apiKeySource: "none"）。

## 1. 実測値（2026-07-12T12:22–12:23Z / node v22.14.0 win32 / claude-opus-4-8）

会話が積もる形で計測（各 fire の前に you 発話 1 件を追加・soul 応答も正本に積まれ次の注入に混ざる
= 実運用形。注入は fire を追うごとに you/soul 混在で長くなる）。

| fire | 注入 (lines / chars) | TTFT (ms) | ask (ms) | fire 全体 (ms) | input_tok | output_tok | 応答 (chars) |
|---|---|---|---|---|---|---|---|
| #1 (cold) | 1 / 36 | 3899.7 | 6750.7 | 6751.4 | 254 | 53 | 49 |
| #2 (warm) | 3 / 127 | 3943.4 | 6153.9 | 6154.1 | 432 | 31 | 25 |
| #3 (warm) | 5 / 193 | 3196.4 | 6143.2 | 6143.3 | 652 | 34 | 26 |
| #4 (warm) | 7 / 253 | 3344.4 | 5954.7 | 5954.8 | 933 | 34 | 29 |
| #5 (warm) | 9 / 318 | 3392.1 | 6745.5 | 6745.6 | 2 (+cache_creation 1273) | 37 | 31 |

- **TTFT ≈ 3.2〜3.9s / ask 全体 ≈ 6.0〜6.8s**（応答全文の受信完了まで）。fire 全体は ask とほぼ同値
  （fake speak が所要ゼロ相当のため）。実運用の「Fire → 音声開始」はこれに TTS（audio_query +
  synthesis・s1-first-light 実測で短文 ≈0.2〜0.5s）と器の accepted RTT が乗る（§4 の人間ゲートで実測）。
- **cold（#1）でも 6.75s**: 常駐セッションの spawn（S1 計測では init 到達 ≈9〜12s）が本計測では ask #1
  の中に目立って乗らなかった。本番結線（`scripts/cockpit.mjs --channel`）は**起動時に session を作る**
  （spawn 先払い）ため、初回 Fire がさらに悪化する構造ではない。
- **注入が伸びても TTFT はほぼ横ばい**（36→318 chars で 3.9→3.4s）。直近 5 分窓 + 4000 字上限の
  既定なら TTFT への注入長の影響は現状無視できる規模。
- usage: 5 ask 合計 input 2,273 tok（+cache_creation 1,273）/ output 189 tok。#5 で SDK が会話履歴を
  1h ephemeral cache に載せ替えた（input_tokens 2 + cache_creation 1273）——常駐セッションの履歴が
  伸びると自動でキャッシュ化される挙動が見えた。
- 応答の質（目視）: 5/5 とも直前の you 発話を踏まえた短い一言（最小仮面 v0 のまま逸脱なし・
  箇条書き/記号なし）。例: you「ボス強すぎない？回復アイテムもう無い」→ soul「えっ、それピンチじゃん！
  慎重に攻撃避けて隙を狙おう！」。

生ログ（JSON サマリ全文）は measure-fire.mjs の標準出力に出る（本記録の表はそこからの転記）。

## 2. 再計測の手順

```
node apps/soul/agent/scripts/measure-fire.mjs
```

- 前提: `/login` 済みサブスク OAuth・ガード対象環境変数（ANTHROPIC_API_KEY 等）未設定
  （設定されていると env-guard が起動拒否する）。AivisSpeech・器・マイクは不要（fake）。
- **実 ask は 5 回固定（ハードガードが 6 回目を throw）**。サブスク枠を消費するので不用意に走らせない。

## 3. 観測項目: 遅延 append の発生頻度【Undine 裁定 2026-07-12・継続観測】

s2-followup §4-1 の残り波紋（whisper watchdog の遅延解決が正本に積まれ得る）が S3 の注入に及ぼす影響:

- (a) 遅延 append した古い発話が、注入テキスト上「最も新しい行」として並ぶ**意味順の捻れ**
  （fire-injection は seq 昇順整形のため）。
- (b) appendedAtMs 窓の遅延感度（窓判定は append 時刻なので、遅延した発話は実際の発話時刻より
  長く窓に残る）。

**観測方法**: 実マイク運転（人間ゲート・以後の常用）中に、操縦席 Timeline の行順が発話順と食い違う
事象・Fire 直後の soul 応答が「古い話題に反応した」と感じる事象を数える。発生したら
`waves/s3/s3-followup.md` に頻度と状況（発話長・CPU 負荷）を追記する。恒久回収は
whisper-inference/client 統合時へ先送り済み（S3 スコープ外）。

- 本計測（fixture 直積み）では構造上発生しない（watchdog 経路を通らない）: **0 / 5 fire**。
- 人間ゲート実測: ＿＿＿（記入欄）

## 4. 音声開始 E2E（Fire → 音声が鳴り始めるまで）——人間ゲート記入欄

全器官起動（AivisSpeech + 器 + 耳 + 操縦席 + 実マイク）が要るため機械では計測しない。
手順: [../implementation/waves/s3/human-gate-procedure.md](../implementation/waves/s3/human-gate-procedure.md)。
Fire クリックから声が聞こえ始めるまでをストップウォッチ（またはコンソールの計測ログ）で 3 回計る。

| 試行 | Fire → 音声開始 (s) | 備考（注入行数・発話の長さ等） |
|---|---|---|
| 1 | ＿＿＿ | |
| 2 | ＿＿＿ | |
| 3 | ＿＿＿ | |

- 参考予測: ask ≈6〜7s（全文受信・§1）+ TTS ≈0.3〜1s + accepted RTT ≈数十 ms → **≈7〜8s** と見込む。
  体感が長すぎる場合の短縮余地（応答ストリーミングの文分割 TTS 等）は S4 以降の領分。
