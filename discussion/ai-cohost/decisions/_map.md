# Decisions Map

> ai-cohost の子トピック群の親。OpenAI Decisions API 等の「有限の選択肢から確率付きで選ぶ」判定で、チャッピー(AI Tuber。GPT で動かすときの呼び名)の知覚・演出を決める取り組みの入口地図。

## 1. Scope

- 利用場面: ユーザーがゲーム配信し、チャッピーが隣でサポート役として、ユーザーの発言を聞きながら同じゲーム画面を見る(ユーザー説明 2026-10-12)。
- このディレクトリの子は「何を判定するか」ごとに分ける。外部 API の事実は共有の `research/` に置く。
- ElevenLabs 自体の評価(STT/TTS の差し替え)は [../elevenlabs/](../elevenlabs/_map.md) の領分。音声タグを「何にするか判定する」部分だけがここに入る。

## 2. Directory Map

| Path | Role | Status |
|---|---|---|
| [research/](research/) | Decisions API の公式事実・課金境界(子トピック共有) | Created |
| [gaze-target/](gaze-target/_map.md) | 画面のどこを見るか(視線注視先) | **一区切り(2026-10-12)**: 4x3 粒度で推定でき、発言で動かせる |
| [reaction-trigger/](reaction-trigger/_map.md) | 反応すべきか(チャッピーの感情が大きく動くか) | 合意済み・未着手 |
| `voice-direction/` | ElevenLabs の音声タグ選び | 未作成(必要になったら切る) |
| `speak-now/`(仮) | 今チャッピーが喋るべきか(区切り応答の固定 2 秒待ち `TURN_END_SILENCE_MS` の代わりに判定する) | 未作成。ユーザー構想(2026-10-16)。STT 切り替えの作業では 2 秒待ちに触れない |

## 3. Shared Facts (要点のみ。詳細はリンク先)

- [research/openai-decisions-api.md](research/openai-decisions-api.md): `POST /v1/decisions`、`gpt-6-luna`、predicate / choice / score。入力のみ $0.10/1M。
- [research/backend-survey-2026-10.md](research/backend-survey-2026-10.md): 判定バックエンドの選び直し調査(判定特化 API・汎用 LLM・ローカル)。Decisions API 採用の前提(Codex クレジット流用)が崩れたため(2026-10-16)。
- 実測(gaze-target 01): 同一入力への答えは決定的。1回 ≈1,200 入力トークン(画像1枚)、遅延 300〜650ms(日本から)。

## 4. Shared Assets

- スクリプト: `apps/soul/agent/scripts/probe-decisions-gaze.mjs`(特区憲章により `apps/soul` 内)。
- キー: `apps/soul/agent/.env.decisions.local` の `OPENAI_DECISIONS_API_KEY`(gitignore)。API Platform 側に $5 入金済み・auto-reload なし(2026-10-12)。
- 画像・動画・生の結果: `tmp/gaze-target/` 等(gitignore)。リポジトリに入れない。
