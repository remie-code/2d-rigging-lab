# S1 Domain C 実装記録: Agent SDK 統合 + CLI + 計測 + experiments 開設 + docs

> Status: 実装完了・機械検証全緑（2026-07-12, Gnome）。SDK 実機計測 4 ask 実施済み。人間ゲート
> （実器フル疎通・実再生）は未実施＝choke point。
> スコープ: [../../orchestration/s1-wave-plan.md](../../orchestration/s1-wave-plan.md) §3 Domain C・§4。
> 前提: Domain A（[domain-a.md](domain-a.md)）/ Domain B（[domain-b.md](domain-b.md)）の純関数・TTS・
> 常駐再生・チャネル送出・speak を**再利用**（再実装せず）。`@anthropic-ai/claude-agent-sdk` 0.3.207
> install 済み。SDK オプション名・メッセージ形は node_modules の `sdk.d.ts` を Read して裏取り。

## 1. 作成・変更ファイル一覧と契約

すべて特区サブディレクトリ `apps/soul/agent/` 内（pnpm workspace glob 対象外＝lockfile 不変）。
器・契約・pnpm-lock には一切触れていない。ランタイム依存は agent-sdk のみのまま（依存追加ゼロ・
install 実行なし）。

### 新規（Domain C 本体）

| パス | 役割・契約 |
| --- | --- |
| `src/env-guard.mjs` | サブスク枠認証ガード（純関数）。`assertSubscriptionAuthEnv(env=process.env)`: `ANTHROPIC_API_KEY` / `ANTHROPIC_AUTH_TOKEN` / `CLAUDE_CODE_USE_*`（プレフィクス一致）のいずれかが**非空で設定**されていれば理由付き throw（起動拒否）。`ANTHROPIC_BASE_URL` は**非既定値なら warning**（throw しない・下記設計判断）。戻り `{ warnings: string[] }`。`DEFAULT_ANTHROPIC_BASE_URL` を export。 |
| `src/llm-session.mjs` | 常駐 LLM セッション。`createLlmSession({env, systemPrompt, model, maxTurns, queryImpl, skipEnvGuard, onInit, onWarning})` → `{ ask(text) => Promise<{replyText, usage, ttftMs, elapsedMs}>, dispose(), getInit() }`。`query()` を**常駐ストリーミング入力モード**（prompt=押込み型 AsyncIterable）で 1 プロセス保持。options: `settingSources: []` / `systemPrompt`（既定=会話用最小文） / `model: "claude-opus-4-8"` / `persistSession: false` / `maxTurns: 1` / `tools: []` / `includePartialMessages: true` / `abortController`。出力は**手動 `q.next()`** で汲む（for-await-break は `.return()` を呼びセッションを殺すため不可）。TTFT は stream_event の text_delta 到達で計測（fallback=result.ttft_ms）、usage は result から。`DEFAULT_SYSTEM_PROMPT` / `DEFAULT_MODEL` を export。 |
| `src/cli.mjs` | 会話 CLI。`runConversation(deps)`（依存注入で配線検証可能）+ `main()`（本番配線・直接実行時のみ）。フロー: env-guard → session 常駐起動 → connectChannel → createAudioPlayer → stdin 一文 → `session.ask()` → `speak()`（口+声）→ ループ。SIGINT（AbortController）/ EOF で全 dispose（session→player→channel）。各発話で `{event:"utterance", usage, ttft_ms, ask_ms, e2e_ms, channel_rtt_ms, timeline_items, wav_sec}` を 1 行 JSON で stderr。位置引数=Channel URL、`--system`/`--base-url`/`--speaker`。 |
| `scripts/first-light.mjs` | **実 SDK 計測ランナー**（4 ask のみ）。1 常駐セッションで tools 確認 1 + 計測サンプル 3。init（tools[]/apiKeySource）+ 各 ask の usage/ttft/elapsed + TTS(audio_query/synthesis) + timeline を記録し JSON サマリを出す。送出・再生なし。 |

### 変更

| パス | 変更 |
| --- | --- |
| `src/channel-client.test.mjs` | **note 回収 2 ケース追記**（6→8）: (a) 未知イベント（未知 kind / 非 JSON / 相関先なし replyTo）黙殺 + `consumeUnknownEventCount` 計数、(b) 応答前サーバ切断で pending が closedError で reject。channel-client 本体は不変。 |
| `src/audio-player.mjs` | **ハング対策ハードニング**（dispose）: kill 後に stdio パイプ destroy + `child.unref()`（reap 待ちで event loop を生かさない）。挙動（play/dispose の意味）は不変。 |
| `src/test-support/ws-double.mjs` | ハードニング（`server.unref()` + `closeAllConnections()`）+ note 回収の送出ヘルパ（`sendServerEvent`/`sendRawText`/`dropConnections`・onSpeech の `"drop"`）。 |
| `src/test-support/ws-client.mjs` | ハードニング（`socket.unref()` + close 時 `removeAllListeners()`+`destroy()`）。 |
| `apps/soul/README.md` | agent/ を住人に追記。物理コスト節を裁定 1（サブディレクトリ独立パッケージ容認）で更新。 |
| `discussion/ai-cohost/_map.md` | experiments/ を Directory Map に登録。 |

### 新規テスト

`src/env-guard.test.mjs`(9) / `src/llm-session.test.mjs`(8・**実 SDK 不使用**=fake queryImpl) /
`src/cli.test.mjs`(3・session ダブル + ws-double + echo-player + fake tts)。実 SDK テストは
スイートから除外（SDK 実行は first-light の 4 ask のみ・裁定どおり）。

## 2. tools:[] 動作確認の結果 — **全ツール無効・disallowedTools 併用は不要**

first-light の ask #1（実 SDK）で確認した生出力:

```
init.tools = []  apiKeySource = none  model = claude-opus-4-8
init.slash_commands.len = 44  init.skills.len = 17
tools:[] で全ツール無効か: YES (init.tools=[])
reply : こんにちは、来てくれてうれしいよ！
```

- **`tools: []` で `system/init.tools = []`（全ツール無効）**。応答にもツール使用は現れず。
  → wave 計画の分岐「だめなら disallowedTools 併用」は**非該当**（併用不要）。
- `slash_commands`(44) / `skills`(17) は CLI 機能の広告であってモデルの tool ではない
  （`init.tools` とは別軸。応答経路には出ない）。
- **`apiKeySource = none`** = API キー不使用 = サブスク OAuth で走っている。env-guard の前提が実機で成立。

## 3. SDK 実行回数の記録 — **4 ask（上限内）・1 常駐セッション**

| # | 種別 | プロンプト（短文） | TTS |
| --- | --- | --- | --- |
| ask #1 | tools:[] 動作確認（+ 初期化時間実測） | 「ツールを使わずに、一言だけで挨拶して。」 | なし |
| ask #2 | 計測サンプル | 「今日はいい天気だね。」 | audio_query+synthesis（送出/再生なし） |
| ask #3 | 計測サンプル | 「好きな食べ物は何？」 | 同上 |
| ask #4 | 計測サンプル | 「配信を始めるよ、意気込みを一言。」 | 同上 |

- **4 ask すべてを 1 つの常駐セッションで実行**（residency 実証）。`maxTurns: 1` でもストリーミング
  入力セッションは終了せず 4 ask を往復できた（`maxTurns` は「1 入力あたりの自律多段ループ」の上限で
  あって、セッション寿命ではない、と実測で確認）。
- **12 秒スポーン問題の実測**: 追加 query 不要で ask #1 に含まれる初期化時間として計測した。
  init 到達 = ask 開始から **1247.7ms** / セッション生成から **1882.9ms**（≈ spawn + 初期化）。
  この回は恐れていた 12 秒ではなかった。ただし `query()` を毎回作れば都度この初期化を払う（Issue #34）
  ため residency の価値は不変。cold ask #1 総時間 = 4960.7ms。
- SDK 実行はこの 4 ask で完了（`node --test` からは実 SDK テストを除外し、llm-session のロジックは
  fake queryImpl で検証＝サブスク消費ゼロ）。

## 4. 計測要約（experiments 記録へのリンク）

初回計測記録 → **[../../../experiments/s1-first-light.md](../../../experiments/s1-first-light.md)**
（S 系列の常設計器の初回。measurements 流儀）。要点:

- warm ask（LLM 往復）≈ 3.2〜3.3s（#2/#3）、**#4 は 9.2s の外れ値**（要監視）。TTFT warm ≈ 1.2〜1.9s。
- TTS の支配項は synthesis ≈ 0.97〜1.24s（audio_query は 18〜56ms）。timeline 構築 < 0.4ms（無視可）。
- input_tokens が 252→284→318→364 と単調増加（residency で会話履歴が累積。長時間会話のコスト示唆）。
- **E2E 完全計測（音声が鳴り始めるまで）はここに無い**（チャネル送出・再生をしていないため）。
  人間ゲート（CLI / preflight-e2e）で取る。

## 5. ANTHROPIC_BASE_URL の扱い（設計判断・根拠）

ガード対象は wave 計画どおり 3 種（API_KEY / AUTH_TOKEN / CLAUDE_CODE_USE_*）とし、BASE_URL は
**warn 止まり**にした。根拠:

- BASE_URL は「送信先の付け替え」であって、それ自体が課金方式を切り替えるわけではない。既定値
  `https://api.anthropic.com` はサブスク OAuth が使う正規エンドポイントそのもの。
- **この開発環境はハーネスが BASE_URL を既定値に設定している**（Orch 確認事項。実測: `"https://api.anthropic.com"`）。
  ここを throw 対象にすると本環境で SDK 動作確認が一切できなくなる。
- よって: 既定値（末尾スラッシュ差を正規化して比較）に等しければ無言で通す、**非既定値なら warning**
  を返して起動は継続（運用者が意図的にプロキシを挟む余地を残す）。env-guard.test で両分岐を固定。

## 6. note 回収の判断 — **2 件とも実施（Domain B レビュー note 1/2）**

Undine 裁定「note 1・2 を Domain C に小さく含めて回収（工数が膨らむなら follow-up 送り・判断は Orch）」
に対し、**両件とも実装した**（channel-client の写経コピーは S2 以降も使う土台のため、独立 assert を
ここで固める価値が高く、工数は小さかった）:

- **note 1**（未知イベント黙殺 + `consumeUnknownEventCount`）: ws-double に `sendServerEvent` /
  `sendRawText` を足し、未知 kind / 非 JSON / 相関先なし replyTo の 3 種を送って黙殺 + 計数 3 を確認。
- **note 2**（切断時 pending reject）: ws-double の onSpeech に `"drop"`（返信せず接続破棄）を足し、
  sendSpeech が closedError で reject することを確認。

ws-double への追加はテスト支援のみ（本番コード不変）。follow-up 送りにはしていない。

## 7. ハング調査（Orch 追加指示の回収）— 未再現・発生源ハードニング済み

Orch 経由で「`node --test` が 62/62 pass を吐いた後に終了せず 30 分超走るハング 3 件」の調査・対処を
追加指示された。

### 再現試行（すべて緑・exit 0・ハング未再現）

```
# 単発 20 回
run 1..20: exit=0（全て）
# 疑わしい個別ファイル 各 25 回（audio-player / speak / channel-client）
audio done / speak done / channel done（HANG 出力なし＝全て正常終了）
# 6 並列 × 5 ラウンド（高負荷下でレースを誘発）
r1..r5 全 30 ジョブ: exit=0
```

**この環境ではハングを再現できなかった**（100+ 回・高負荷含む）。緑出力後は数百 ms で正常終了。

### 発生源ハードニング（未再現だが本体品質として予防・常駐魂のクリーンシャットダウン）

最有力候補は「kill 済みだが OS 未 reap の子プロセス、または未 destroy のソケットが event loop を
生かし続ける」窓。発生源で潰した:

- `audio-player.mjs` dispose: kill 後に stdio パイプ destroy + `child.unref()`（reap 待ちで loop を
  保持しない）。魂は畳む意図で dispose を呼ぶので reap を待たず抜けてよい。
- `test-support/ws-double.mjs`: `server.unref()`（listen 後）+ `closeAllConnections()`（close 時）。
- `test-support/ws-client.mjs`（MinimalWebSocket）: `socket.unref()` + close 時 `removeAllListeners()`
  + `destroy()`。
- CLI（`cli.mjs`）: SIGINT/EOF で session→player→channel を確実に dispose（cli.test の abort/EOF 経路で
  「戻る＝ハングしない」を固定）。

ハードニング後も 84/84 緑・6 並列 × 3 ラウンド全 exit 0 を再確認。**未再現ゆえ「真因を潰した」証明は
できない**ため、残存監視を [s1-followup.md](s1-followup.md) §8 に記録（再燃時は
`process.getActiveResourcesInfo()` でハンドル特定するのが次の一手）。

## 8. 検証（Gnome が実行した生出力）

### 8.1 `cd apps/soul/agent && node --test`（全緑）

```
# tests 84
# suites 0
# pass 84
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 545.9113
EXIT=0
```

内訳（Domain A 34 + Domain B 26 + Domain C 24）: env-guard 9 / llm-session 8 / cli 3 /
channel-client 8（6+note 回収 2）/ 既存 56。実 SDK テストはスイートから除外（SDK は first-light の
4 ask のみ）。

### 8.2 env-guard の起動拒否（SDK 実行なし・回数消費なし）

```
=== CLI startup with ANTHROPIC_API_KEY set ===
[cli] FATAL: Error: 魂の起動を拒否しました（サブスク枠認証ガード）。API 課金・別認証に切り替わる環境変数が設定されています: ANTHROPIC_API_KEY。…
    at assertSubscriptionAuthEnv (…/src/env-guard.mjs:87:11)
    at main (…/src/cli.mjs:163:24)
EXIT=1

=== CLI startup with CLAUDE_CODE_USE_BEDROCK set ===
[cli] FATAL: Error: 魂の起動を拒否しました（…）: CLAUDE_CODE_USE_BEDROCK。…
EXIT=1
```

ガードは `connectChannel` / SDK spawn の**前**に throw（stack が env-guard→main を示す）。SDK 実行ゼロ。

### 8.3 SDK 実行 4 ask の生出力（tools 確認 + 計測 3）

```
init.tools = []  apiKeySource = none  model = claude-opus-4-8
tools:[] で全ツール無効か: YES (init.tools=[])
init到達: ask開始から 1247.7 ms / セッション生成から 1882.9 ms
ask#1 usage in/out=252/20  ttft 2992.5ms  ask_ms(cold) 4960.7
ask#2 「今日はいい天気だね。」→「ほんと、こんな日はお散歩したくなるね！」 in/out=284/22 ttft 1267.6 ask 3194.3 / TTS aq 55.7+syn 1118.2 wav 3.1954s / 20 moras→15 items
ask#3 「好きな食べ物は何？」→「ラーメンかな、やっぱりこってり系がたまらないよね！」 in/out=318/27 ttft 1227.6 ask 3345.2 / aq 27.0+syn 1241.6 wav 4.1589s / 26→21
ask#4 「配信を始めるよ、意気込みを一言。」→「よし、今日も全力で楽しんでいくよ！」 in/out=364/21 ttft 1897.2 ask 9240.6（外れ値）/ aq 17.9+syn 974.5 wav 3.2727s / 20→16
EXIT=0
```

（フル JSON サマリは [../../../experiments/s1-first-light.md](../../../experiments/s1-first-light.md) §3。）

### 8.4 check 3 種（新規赤ゼロ）

```
Soul zone boundary guard passed: 1274 source files scanned; …  (soul-zone exit=0)
Dependency guard passed.  (deps exit=0)
Source organization violations found:
- apps/runtime-player/src/main/physiology/index.ts: index.ts must remain a barrel-only entrypoint  (source exit=1)
  → 違反 1 行のみ・soul 言及 0（grep -c "^- "=1 / grep -ci soul=0）。既知の physiology barrel（S1 無関係・followup §7）。新規赤ゼロ。
```

soul-zone は 1267→**1274** ファイルに増（Domain C 新規を含めて走査）・違反ゼロ。

### 8.5 保護パス不変（git）

```
git diff --stat pnpm-lock.yaml apps/runtime-player/            → (空=不変)
git diff --stat apps/runtime-player/src/main/control-channel/contract/  → (空=C4 契約 fixture 不変)
git status --porcelain（自スコープ）:
 M apps/soul/README.md
 M discussion/ai-cohost/_map.md
?? apps/soul/agent/  ?? discussion/ai-cohost/experiments/  ?? discussion/ai-cohost/implementation/waves/s1/
```

pnpm-lock.yaml・器コード（runtime-player）・C4 契約 fixture・参照ドライバ すべて diff ゼロ。作業は
`apps/soul/agent/`・`apps/soul/README.md`・`discussion/ai-cohost/`（experiments 開設・waves/s1・_map）に
閉じている。`npm/pnpm install` 実行なし・外部公開ツール未使用・git commit/push なし・スピーカー再生
なし・実器接続なし。

## 9. 未解決の質問（Orch-Sylph へ）

1. **人間ゲート実施依頼（choke point）**: 実器フル疎通 + 実再生は Gnome は行わない（規律）。ユーザー/
   Undine が [human-gate-procedure.md](human-gate-procedure.md) に従い「AivisSpeech + 自律ホスト起動 +
   Channel 開放 + URL 手渡し」の上で CLI を起動し一言打ち、**声が答え・口が合っている**ことを一目一聴で
   確認する必要がある。ここで初めて「配線の存在」が「疎通」に昇格する。皮膚感ズレは prePhonemeSec の
   追撃で吸収（純関数の呼び出し値のみ・手順書 §5）。

2. **`maxTurns: 1` × residency の解釈確定**: 実測では `maxTurns: 1` でも 1 常駐セッションで 4 ask を
   往復できた（セッションは終了しない）。この理解を S 系列の前提として確定してよいか（wave 計画は
   `maxTurns: 1` を指定・実測で residency と両立を確認）。もし将来「1 ask あたり複数ターンの自律動作」を
   許したくなったら maxTurns を上げる、という運用でよいか裁定を仰ぐ。

3. **ハング未再現の扱い**: §7 のとおり 100+ 回（高負荷含む）で再現せず、発生源ハードニングを施したが
   「直った」証明はできない。この状態（ハードニング済み + 残存監視を followup §8 に記録）で S1 機械ゲート
   としては足りるとみなしてよいか。人間ゲートやユーザー環境で再燃したら getActiveResourcesInfo で
   ハンドル特定する、を次の一手として合意したい。

4. **会話レイテンシの外れ値（ask #4=9.2s）**: サンプル 3 では分散を語れない。魂の常設監視項目
   （_map §6 の未解決質問「会話レイテンシ」）として、サンプルを増やす計測回を後続 S 問題で持つべきか。

## 10. 質問への裁定（Orch-Sylph 記録・Undine 裁定 2026-07-12）

1. **人間ゲートの実施**: wave 機械完了後に **Undine がユーザーへ依頼**する（[human-gate-procedure.md](human-gate-procedure.md) を使う）。S1 wave の Orch-Sylph 完了条件は**機械ゲートまで**。
2. **`maxTurns: 1` × residency の両立**: 実測（§3・experiments §5-3）に基づき **S 系列の前提として確定**。`maxTurns` は「1 入力あたりの自律多段ループ」の上限であってセッション寿命ではない。将来 1 ask 複数ターンが要る日は maxTurns を上げる運用。
3. **ハング未再現の扱い**: 未再現（100+ 回・高負荷含む）+ 発生源ハードニング + followup §8 の残存監視で、**S1 機械ゲートとして足りる**とみなす（「真因を潰した証明はできない」という正直な記録込みで受理）。再燃時は `process.getActiveResourcesInfo()` でハンドル特定が次の一手。
4. **レイテンシ外れ値（ask #4=9.2s）**: **常設監視項目とする。ただし専用の計測回は設けない**——S3/S4 が自然に会話サンプルを量産するため、experiments/ の記録流儀に「外れ値の頻度」を項目として残す（s1-first-light.md §6 に注記済み）。
