# 多頭化(頭脳差し替え) planning gate 棚卸し

> Status: 完了(2026-07-17)。議論・裁定の正本は [../../soul/brain-swap.md](../../soul/brain-swap.md)(§9=(a')最終形)。
> スパイク実測: [../../experiments/brain-swap-terra.md](../../experiments/brain-swap-terra.md)。
> 本書は Sylph 二体(魂側の縫い目 / 操縦席+SDK型+掃除)の事実調査の統合。計画: [brain-swap-wave-plan.md](brain-swap-wave-plan.md)。

## 1. 裁定の要約(brain-swap.md より・確定済み)

配信前に頭を選ぶ UX(起動→選ぶ→動作確認→配信開始)・フラット2項目(Claude Opus 4.8 / Codex GPT-5.6 Terra)・(a')=SDK+スレッド継続+配信後掃除・effort既定 none・画像橋渡しはアダプタ私事+昇格予約3箇所・**記憶は一級資産**・規約グレー受容・資格情報は健康表示のみ(中身は扱わない)・KILL/NG弁は頭非依存。

## 2. リポジトリ事実(Sylph 調査・file:line 付き)

### 2-1. 知性契約の元型と消費面(魂側)

- 現行外形 = `createLlmSession(options)` → `{ask(content), dispose()}`、ask 戻り値 `{replyText, usage, ttftMs, elapsedMs}`(llm-session.mjs:162-287)。
- **fire-orchestrator は replyText と usage しか消費しない**(processAskedReply :330-338。ttftMs/elapsedMs は現状未消費=grep で参照ゼロ)。→ Codex 頭が ttftMs:null を返しても**壊れる箇所は存在しない**。契約は現外形をそのまま凍結すればよい。
- onUsage へは `{usage, vision}` のみ(:332-334)。モデル名・レイテンシは未搭載。
- **セッションは構造的にホットスワップ可能**: `session` は main() スコープの let(cockpit.mjs:409-410)、書き手は ensureFireResources(:437-457)のみ、読み手は sessionProxy.ask() の getSession()(:206-218・ask 毎に参照)のみ。dispose→null→次の発火で再生成、が最小の切替経路。
- ensureFireResources は現状 createLlmSession 固定(:444-451・model 未指定=DEFAULT_MODEL)。頭の分岐はここに挿す。
- dispose は現状 shutdown(:608-639)時のみ。
- env-guard(env-guard.mjs:31-107)は Anthropic 専用(ANTHROPIC_API_KEY 等で throw)。OpenAI 側は sibling 関数を並置する形(スパイクは個別注意で代替しており未統合)。
- usage 計器は「直近 1 ask の input/output を上書き表示」のみ(view-logic/usage.mjs:18-23・累積なし)。provider 札は表示情報であり「ツマミを置かない」v0 裁定と非衝突。

### 2-2. 観測層の現状(レイテンシ・頭名)

- フィード行は `latText` の器を既に持つ(feed.mjs:50-55・rows.mjs:70-80・latencyLabel=transcript.mjs:54-57)。**soul 行は broadcastSoulTranscript(cockpit-server.mjs:1133-1142)が `latencyMs:null` を固定付加しとるだけ**。
- 足りない配線: processAskedReply が持っとる `asked.elapsedMs` を soul 行(と usage 表示)まで運ぶ経路+頭の識別子。getInit()(モデル名)は現状 stderr ログ止まり(cockpit.mjs:447-450)。

### 2-3. 操縦席の写経元

- 設定区画: settings-drawer.mjs の「声の出力先」行(:388-405・select+Set+状態表示)が「頭脳」区画の最良の写経元。snapshot の settings に `brain` を乗せる形(:30-36 の props 契約)。
- 永続: cockpit-settings-store.mjs の `verbosityMode`(:148-154)が新キー(brainChoice)の写経元。妥当性検証は呼び出し側(cockpit.mjs の hooks)に置く規律(:26-29)。
- POST /api/brain: `/api/verbosity`(:907-932)+`/api/kill`(:934-964)が模範。触る全箇所(JSDoc・options 分配・snapshot・ハンドラ・broadcastState・view-logic 文言・server test 6 種=503/初期 snapshot/正常遷移+SSE/不正 400/欠落 400/born 伝播)は S8 の /api/kill 実装が完全な前例(cockpit-server.test.mjs:2079-2185)。
- 起動フック: createVerbosityHooks(cockpit.mjs:326-344)と同型の createBrainHooks を :404 付近に並置。

### 2-4. codex-sdk 型事実(node_modules/@openai/codex-sdk/dist/index.d.ts)

- `ThreadOptions`(:239-250): model / sandboxMode / workingDirectory / skipGitRepoCheck / modelReasoningEffort("minimal"|"low"|…だが **Terra は minimal 非対応**=スパイク 400 実測) / networkAccessEnabled / webSearchMode / webSearchEnabled / approvalPolicy / additionalDirectories。
- `Thread`: `id`(初回 turn 後に populated / thread.started イベントでも取得可) / `run(input)` → `{items, finalResponse, usage}` / runStreamed。`Input = string | Array<{type:"text",text}|{type:"local_image",path}>`。
- `Usage` = `{input_tokens, cached_input_tokens, output_tokens, reasoning_output_tokens}`。
- `CodexOptions`: codexPathOverride / baseUrl / apiKey(**渡さない**) / config(dotted-path→`--config`) / env(**指定時は process.env を継承しない完全制御**)。
- エラー: turn.failed / error イベント。run() 自体の reject 例外型は型定義に明示なし[実装時に防御的に扱う]。

### 2-5. rollout 掃除の事実(⚠ 最重要の安全事項)

- **実機の sessions は日付 3 階層ネスト**: `~/.codex/sessions/YYYY/MM/DD/rollout-<ISO時刻>-<thread_id>.jsonl`(brain-swap.md §9 のフラット表記は不正確→本書が正)。
- **同居物**: ユーザー自身の rollout が 4400 本以上ある。**掃除は「うちらが作った thread_id の完全一致」のみを対象にし、bulk 削除・パターン削除は絶対にしない**(blocking 基準)。
- thread_id→ファイル特定は日付範囲の再帰探索が必要(SDK にパス取得 API なし)。→ 設計: **魂が自分の thread_id を sidecar ファイル(gitignored・settings 同格)に記録**し、dispose 時+起動時 sweep はその台帳に載っとる id だけを探索・削除する。
- CODEX_HOME は SDK 型/README に登場せず。パスは `os.homedir()/.codex/sessions` 固定で扱う。

## 3. 計画への持ち込み(L0 設計判断)

1. **知性契約 = 現外形の凍結**: `{ask(content)→{replyText,usage,ttftMs|null,elapsedMs}, dispose()}` を JSDoc typedef で明文化し、頭の表(フラット registry・expression-table 式)を `src/mind/brains.mjs` に置く。llm-session.mjs(Claude 頭)は**無変更**でその一項目になる。
2. **Codex 頭** `src/mind/codex-session.mjs`: startThread 一回(常駐 Thread)・ask=thread.run(text / 画像は base64→一時ファイル→local_image→即削除の**アダプタ私事**)・ttftMs:null・effort=none 既定・sandbox read-only+approval never+webSearch disabled・env は SDK の env 完全制御で最小構成+OpenAI 版 env-guard(sibling)。
3. **切替の意味論**: POST /api/brain {brain} → 永続+現 session を dispose→null(進行中発火は既存 dispose 機構が解決)→次の発火から新頭。KILL 状態は orchestrator 側にあるため切替を跨いで生存(頭非依存の裁定どおり)。
4. **観測**: soul 行に latencyMs(実測 elapsed)+brain 札。usage 表示に brain 札。
5. **健康表示**: `~/.claude/.credentials.json` / `~/.codex/auth.json` の**存在確認のみ**(中身は読まない・ログに書かない)。
6. **テスト**: fake SDK(queryImpl 相当の注入口を codex-session にも用意)で実消費ゼロ。rollout 掃除はスクラッチ dir の偽 sessions 構造で機械テスト。
