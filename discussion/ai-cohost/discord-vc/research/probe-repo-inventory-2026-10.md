# 受信の試しのためのリポジトリ棚卸し(Sylph 2026-10-30)

> 種別: リポジトリの事実の棚卸し。判断・推奨はしない。推測には【推測】と付ける。
> 対象: Discord の Bot が VC に入り 1 人の声を受け取れるかを数だけで確かめる使い捨ての試し(Node v24.19 / `@discordjs/voice` 0.19.2 / `@snazzah/davey` を想定)。
> 読んでいないもの: `.env*.local`、`cockpit-settings.local.json`(と `.bak*`)、`memories/` の中身。鍵ファイルは存在の確認(ディレクトリ一覧)だけ。
> 注: 調査時点で `discussion/ai-cohost/discord-vc/scope.md` は作業ツリーで変更中(`git status` で M)。下の scope.md の行番号は調査時点の作業ツリーのもの。

---

## 1. 外部 API に繋ぐコードを置いてよい場所の決まり

### 事実(ファイル:行)

条文(`discussion/ai-cohost/concept/mvp-boundary-amendment.md`):

- `:5` 対象は root `_map.md` 「次の行動2」の Future scope 指定(external HTTP / WebSocket / MCP API work と LLM provider integration)の明示変更。
- `:13-17` §2 解禁するもの: ①runtime-player の外部操縦チャネル(loopback + token の WS) ②生理層生成器 ③(第二段)演出メタデータ区画。
- `:21` §3 引き続き禁止: リポジトリ内の LLM プロバイダ統合は「本リポジトリのどのapp/packageにも入れない」。
- `:22` §3 リポジトリ内の知覚(画面キャプチャ、視覚モデル呼び出し)は器に入れない。
- `:24` §3「external APIの一般解禁ではない: 解禁は§2の操縦チャネルに限る。MCP server化等は将来の個別判断。」
- `:38` §6 改定二号: 魂は特区 `apps/soul` に住むことを許可。「特区は単数の魂ではなく『魂たちの住む区画』」。
- `:48` 憲章1: 「LLMプロバイダ統合・知覚(画面キャプチャ/視覚モデル)は `apps/<魂>` 配下でのみ許される。他の場所では従来どおり禁止(§3は特区外について不変)。」
- `:49` 憲章2: 魂が import してよいのは操縦チャネルの契約(型・fixture)だけ。器のコードを直接 import しない。
- `:50` 憲章3: 器側の何ものも魂を import しない。
- `:51` 憲章4: 決定論・provenance の規律は特区内に適用されない。
- `:52` 憲章5: 秘密(APIキー等)はコミットされない。特区の設定は環境変数/ローカル設定で扱う。
- `:53` 憲章6: 特区内のツールチェーンは特区の自由。
- `:55` 「外部」の定義は「リポジトリの外」から「境界の外」へ改まる。

root 地図(`discussion/_map.md`):

- `:77` 次の行動2: 「runtime-player の loopback 操縦チャネルと生理層生成器は解禁、LLM provider integration・知覚は `apps/soul` 特区内のみ許可、特区外は禁止。**それ以外の external API は Future scope**。」
- `:72` AI Cohost 行: 「LLM/知覚は `apps/soul` 特区内のみ許可(特区外は禁止)」。

特区の README(`apps/soul/README.md`):

- `:9-14` 憲章 6 条の要約(上と同旨)。
- `:18-20` `apps/soul` **直下**には `package.json` を置かない(workspace glob `apps/*` に入り `pnpm-lock.yaml` の `importers:` が増えるため)。
- `:22-28` サブディレクトリの独立パッケージは容認(裁定 1・2026-07-12)。`apps/soul/<サブディレクトリ>/package.json` は workspace 対象外=lockfile 不変。install はユーザーの作業(エージェントは install しない)。
- `:32-46` `reference-driver/` が特区の住人として `apps/soul` 直下の別サブディレクトリに置かれている前例(依存ゼロ、`package.json` なし)。

機械検査(`scripts/check-soul-zone-boundary.mjs`):

- `:29` 特区の接頭辞は `apps/soul`(サブディレクトリを問わず `apps/soul/` 以下はすべて特区内、`:103-107`)。
- `:53` 走査対象は `apps` `packages` `tests` `scripts`。`:42-51` `node_modules` 等は除外。
- `:93-95` 相対 specifier だけを解決して判定する(bare specifier、例えば `@discordjs/voice` は判定対象外)。

現に `apps/soul/agent` には LLM でも知覚でもない外部サービスへ繋ぐコードがある(事実の列挙):

- `apps/soul/agent/src/chat/innertube.mjs:32` YouTube(`https://www.youtube.com`)。
- `apps/soul/agent/src/ears/elevenlabs-stt.mjs:43` ElevenLabs STT の `wss://`。
- `apps/soul/agent/src/voice/engines/elevenlabs-voice-engine.mjs:56` ElevenLabs TTD の `wss://`。
- `apps/soul/agent/src/cockpit/quota.mjs:27` ElevenLabs の `https://`。
- `apps/soul/agent/src/mind/speak-now-decisions.mjs:38` OpenAI Decisions API。

### 当てはめの候補(判断はしない)

- 候補 A: `apps/soul/agent/scripts/` の中(既存の probe/spike と同じ置き場。§2 参照)。
- 候補 B: `apps/soul/<新サブディレクトリ>/`(`reference-driver/` と同格の別住人。独自 `package.json` は README `:22-28` の容認範囲)。
- 候補 C: 特区外(リポジトリ root の `scripts/` や `tmp/` 等)。
- 条文上の読みどころ: 憲章1(`:48`)が特区限定にしているのは「LLMプロバイダ統合・知覚」であり、Discord の音声受信がこれに当たるかは条文に書かれていない。一方 `_map.md:77` と amendment `:24` は「それ以外の external API」を Future scope / 一般解禁ではない、としている。この二つが Discord のような非 LLM の外部 API を特区内で扱うことにどう掛かるかを明示した条文は見つからなかった。

### 分からなかったこと

- 「Discord のような外部 API」が憲章1の「知覚」に当たるか(声を聞くことを知覚と読むか)を定めた文言。見つからない。
- ElevenLabs / YouTube / OpenAI Decisions を特区内に入れたときに、`_map.md:77` の「それ以外の external API は Future scope」との関係を明示的に裁定した記録。今回の調査範囲(ai-cohost の premises / soul / decisions / elevenlabs / architecture の grep)では見つからなかった。【推測】特区内であることを根拠に暗黙に扱われてきた可能性がある。
- 特区外(候補 C)に外部 API コードを置くことを明示的に許す条文は見つからなかった。

---

## 2. 試し・実験のコードの置き場の前例

### 事実(ファイル:行)

コミットされている probe / spike は、すべて `apps/soul/agent/scripts/` にある(`git ls-files` で確認):

| ファイル | 種類 | 依存 | 鍵の渡し方 | 出力 |
|---|---|---|---|---|
| `probe-elevenlabs-stt.mjs` | 外部 API の観測 | Node 組み込み + `../src/ears/*`(`:35-42`) | `node --env-file`(`:21-25`、`:72-73`) | `tmp/elevenlabs-stt/runs/`(`:16-18`)。音声は書かず、イベント時刻と文字起こしを残す |
| `probe-decisions-gaze.mjs` / `-speak-now` / `-comment-guard` / `-comment-react` | 外部 API の観測 | Node 組み込みのみ(gaze `:24-26`) | `node --env-file`(gaze `:10-13`、`:19`、`:79-80`) | `tmp/gaze-target/runs`(gaze `:21`) |
| `probe-long-utterance.mjs` | 回帰プローブ(恒久) | `../src/*`(`:22-26`) | なし | 標準出力のみ。音声はメモリのみ(`:16`) |
| `spike-codex-terra.mjs` | 使い捨てスパイク(`:3`「スパイク(使い捨て)」) | `@openai/codex-sdk` + Node 組み込み(`:9`、`:29-36`) | サブスク OAuth(`:16`) | 一時ファイルは finally で削除(`:19`) |

- 命名: `probe-<対象>-<観点>.mjs` / `spike-<対象>.mjs`。各ファイル冒頭の JSDoc に目的・実行コマンド・秘密の扱い・出力先を書く流儀(上の行番号)。
- コミット: 例 `dd644b17`(2026-10-16)「feat(soul): add Decisions API gaze and ElevenLabs STT probe scripts」、`11c0307d`(2026-07-17)Codex/Terra スパイク。
- spike の依存の入れ方: `11c0307d` で `apps/soul/agent/package.json` に `@openai/codex-sdk` を 1 行足し、`package-lock.json` も同じコミットで更新(`git show 11c0307d --stat`: package-lock.json +135、package.json +1、スパイク本体、`discussion/ai-cohost/experiments/brain-swap-terra.md`)。その依存は後に本体の依存として残っている(`apps/soul/agent/package.json:13`)。
- 実験の記録はコードと別に `discussion/ai-cohost/experiments/` に置く(`experiments/_map.md`、`discussion/_conventions.md:163`「実測は `experiments/`」)。
- コミットされない probe の前例: `discussion/ai-cohost/experiments/codex-streaming-sentence-probe.md:25` は `node --input-type=module -e` の使い捨てスクリプトで実施し、スクリプト自体は残していない(プロンプト等は省略と明記)。`codex-app-server-streaming-probe.md:5` は `apps/soul/agent/node_modules` 内の同梱実行物を直接使った。
- 実行結果の置き場 `tmp/` は root `.gitignore:19` で無視。現に `tmp/elevenlabs-stt`、`tmp/gaze-target`、`tmp/speak-now` 等が存在。
- 特区外の root `scripts/` には probe/spike の前例はない(中身は `check-*` と `wave44-*` のみ)。
- `apps/soul/agent` 以外に独自 `package.json` を持つ「小さな置き場」の前例は特区内にない(`reference-driver/` は `package.json` なし)。

### 分からなかったこと

- 「使い捨て」の試しをコミットするか・試し後に消すかの決まり。`spike-codex-terra.mjs` は「使い捨て」と書きつつコミットされ残っている。消す規約は見つからない。
- 本体の `package.json` に試し専用の依存を足すことへの決まり(spike では足したが、規約としての記述は見つからない)。

---

## 3. 鍵ファイルの読み方の前例

### 事実(ファイル:行)

二つの流儀がある。

(a) コード内で直接読み、`process.env` に入れない(本体 `src/` の流儀):

- `apps/soul/agent/src/ears/elevenlabs-stt.mjs`
  - `:35` `readFileSync`、`:38` `parseEnv`(`node:util`)、`:40` `here = dirname(fileURLToPath(import.meta.url))`。
  - `:46` `ELEVENLABS_API_KEY_NAME = "ELEVENLABS_API_KEY"`。
  - `:49` `DEFAULT_ELEVENLABS_ENV_PATH = join(here, "..", "..", ".env.elevenlabs.local")`。
  - `:95-125` `loadElevenLabsApiKey(options)`: `readFileImpl`(既定 readFileSync utf8)で読み → `parseEnv` → キー名の値を trim して `{ ok: true, apiKey }`。読めない・解析できない・空なら `{ ok: false, reason }`(reason にキーの値は含めない、`:97`)。`options.path` と `options.readFileImpl` はテスト注入。
- `apps/soul/agent/src/mind/speak-now-decisions.mjs`
  - `:33` `parseEnv`、`:48` `DEFAULT_DECISIONS_ENV_PATH`、`:64-94` `loadDecisionsApiKey(options)`(上と同型)。
- テスト: `apps/soul/agent/src/ears/elevenlabs-stt.test.mjs:64-73` が「`process.env` が変わらないこと」と既定パスを固定。`speak-now-decisions.test.mjs:82-85` も同旨。
- 利用側: `apps/soul/agent/src/cockpit/cockpit-server.mjs:541-544`(`elevenLabsApiKeyProvider`、既定 loadElevenLabsApiKey、キーは state/SSE/ログ/エラーに載せない)、`:576-578`(`decisionsApiKeyProvider`)。`scripts/transcribe-elevenlabs-batch.mjs:7-8`、`:18`、`:31`(scripts から src の loader を import して使う前例)。

(b) `node --env-file=` で `process.env` に入れる(probe の流儀):

- `probe-elevenlabs-stt.mjs:21-25`、`:72-73`、`probe-decisions-*.mjs`(例 gaze `:10-13`、`:79-80`)。
- `.gitignore` 側の説明も `node --env-file=` 前提: `apps/soul/agent/.gitignore:46-50`。

鍵ファイルの置き場と無視:

- `apps/soul/agent/.gitignore:50` `.env*.local`。`apps/soul/agent/.env.discord.local` が無視されることを `git check-ignore` で確認(`.gitignore:50` が当たる)。
- ユーザーの準備文書: `discussion/ai-cohost/discord-vc/probe-setup.md:25-26`(置き場 `apps/soul/agent/.env.discord.local`、中身は `DISCORD_BOT_TOKEN=` の 1 行)、`:4`(鍵はチャットにもログにも出さない、エージェントは中身を読まない)。
- `.env*.local` の無視規則は `apps/soul/agent/.gitignore` だけにある。`git check-ignore` で、仮のパス `apps/soul/discord-probe/.env.discord.local` と `scripts/x/.env.discord.local` は **無視されない**ことを確認した(root `.gitignore` に `.env` の規則はない)。

### 分からなかったこと

- Discord 用の loader(例えば `loadDiscordBotToken`)は存在しない。`DISCORD` を含むコードは `apps/soul/agent` に見当たらない。
- (a) と (b) のどちらを試しで使うべきかの決まりは見つからない(本体は a、probe は b、という実態のみ)。
- `env-guard.mjs` は `ANTHROPIC_*` 等を拒否する(README `:61-63` 相当)。`DISCORD_BOT_TOKEN` を `process.env` に入れることへの影響は、拒否対象名に含まれるかを含め今回は確かめていない。【推測】名前が異なるので当たらない。

---

## 4. 依存の入れ方

### 事実(ファイル:行)

- root: pnpm(`package.json` の `"packageManager": "pnpm@10.12.1"`)。`pnpm-workspace.yaml` の `packages:` は `packages/*` と `apps/*`(1 階層)。
- `apps/soul/agent/package.json:1-17`: 名前 `@soul/agent`、`private`、`"type": "module"`、scripts は `test: node --test` と `cockpit`。`dependencies` は `@anthropic-ai/claude-agent-sdk` 0.3.207(固定)、`@openai/codex-sdk` ^0.163.0、`onnxruntime-node` 1.27.0(固定)、`sherpa-onnx-node` ^2.0.0。`engines` の指定はない。
- `apps/soul/agent/package-lock.json` はコミットされている(`git ls-files`)。npm の独立パッケージで、workspace 対象外(`apps/soul/README.md:22-28`)。
- install はユーザーの作業(`apps/soul/README.md:26-27`、`:71-75`)。install による `package-lock.json` 差分を受理した記録: `discussion/ai-cohost/implementation/orchestration/s2-wave-plan.md:74`。
- 依存追加の履歴(`git log -- apps/soul/agent/package.json`): `11c0307d`(codex-sdk、スパイク)、`c5f838a8`(sherpa-onnx-node)ほか。
- 「独自 package.json を持つ小さな置き場」の前例: 特区内では `apps/soul/agent` のみ。リポジトリ全体では `fixtures/contracts/invalid-rigControl-cycle/package.json`(fixture。依存の置き場ではない)。
- `.gitignore`:
  - root `.gitignore:1` `node_modules/`(先頭 `/` なしで任意の深さ)。仮パス `apps/soul/discord-probe/node_modules/x` も無視されることを `git check-ignore` で確認。
  - root `.gitignore:15` `apps/*/src/**/*.js`(1 階層目の app の `src` 内の `.js` を無視。`apps/soul/agent/src` は対象外。`.mjs` は対象外)。
  - root `.gitignore:19` `tmp/`。
  - `apps/soul/agent/.gitignore:8` `vendor/`、`:22-25` `*.wav` `*.pcm` `*.raw` `recordings/`、`:50` `.env*.local`。
- 既存チェックとの関係:
  - `scripts/check-dependencies.mjs:5` は `node_modules` を除いた**全ディレクトリ**の `package.json` の依存名を走査し(`:157-174`)、`:18-28` の禁止パターン(live2d / cubism / moc3 等)に当たると失敗する。`@discordjs/voice`・`@snazzah/davey` はこのパターンに当たらない(パターンを読んだ限り)。
  - `scripts/check-soul-zone-boundary.mjs:93-95` は相対 import のみ判定。
  - `scripts/check-source-organization.mjs:5`、`:7-14` は `apps` 等を走査し、`:15` の名前(`types.ts` `schemas.ts` `utils.ts` `helpers.ts`)を禁止。
  - root `tsconfig.json` の include は `packages/*` と `scripts/**/*.mts` のみ(apps/soul は型検査の対象外)。root `vitest.config.ts` は `apps/*/src/**/*.test.ts`(1 階層目。`.mjs` は対象外)。

### 分からなかったこと

- `@discordjs/voice` 0.19.2 / `@snazzah/davey` がネイティブ依存を持つ場合、root `package.json` の `pnpm.onlyBuiltDependencies`(`electron` のみ)のような制限が npm 独立パッケージ側に要るか。npm 側にはその種の設定は見当たらない。外部パッケージの中身は調べていない。
- Node v24.19 で動かすことの決まり(`engines` も `.nvmrc` もない)。README の参照ドライバは「素の Node 22」(`apps/soul/README.md:36`)と書く。

---

## 5. ログ・診断に本文や声を残さない決まりの在り処(場所だけ)

### 事実(ファイル:行)

文書:

- `discussion/ai-cohost/discord-vc/scope.md:133`(作業ツリー)§15: 受信の試しは「声も文字起こしも残さない」。
- `discussion/ai-cohost/discord-vc/probe-setup.md:4`: 鍵はチャットにもログにも出さない。
- `discussion/ai-cohost/implementation/orchestration/s2-wave-plan.md:62`: blocking 基準 4「マイク実音声の録音データをリポジトリ・成果物に残さない(プライバシー)」。
- `discussion/ai-cohost/implementation/screens/cockpit-stt-selection.md:95`: 遅延のログは数字だけ、文字起こし本文は書かない。
- `discussion/ai-cohost/research/context-growth-2026-10.md:50`: 頭の文脈の記録は本文を書かない。
- `discussion/ai-cohost/implementation/reviews/voice-swap/wave-3.md:47`: キーも本文もトレース・診断に出さない。
- `discussion/ai-cohost/experiments/codex-app-server-streaming-probe.md:7`: 実験記録に prompt / response 本文を保存しない。

コード:

- `apps/soul/agent/.gitignore:18-25`(録音・PCM/WAV を残さない)、`:53-55`(session-usage は本文なし)。
- `apps/soul/agent/src/mind/session-usage-log.mjs:7`「会話の本文は書かない」。
- `apps/soul/agent/scripts/cockpit.mjs:1127`(文字起こしの遅延ログは数字だけ)、`:1258`、`:1291`、`:1480`、`:1502`、`:1797`。
- `apps/soul/agent/src/cockpit/cockpit-server.mjs:541-544`、`:577-578`(キーを state/SSE/ログ/エラーに載せない)、`:2662`、`:2672`、`:2774`、`:2998`、`:3051`。
- `apps/soul/agent/src/mind/fire-orchestrator.mjs:70`、`:1254`(画像を積まない・ディスク非保存の流儀)。
- `apps/soul/agent/src/voice/speech-streamer.mjs:35`、`:84`、`apps/soul/agent/src/voice/engines/aivis-voice-engine.mjs:18`(診断は本文なし)。
- `apps/soul/agent/scripts/probe-long-utterance.mjs:16`(音声はメモリのみ・ディスク不書き出し)。
- テストで固定している例: `apps/soul/agent/src/cockpit/cockpit-server.test.mjs:3992`、`:5305`。

対照の事実: `probe-elevenlabs-stt.mjs:16-18` は音声を書かないが、文字起こしを `tmp/elevenlabs-stt/runs/` に残す。

### 分からなかったこと

- 魂全体に掛かる「ログに本文・声を残さない」の一つの正本文書は見つからなかった。決まりは wave 計画・レビュー・画面設計・コードのコメントに分かれて書かれている。

---

## 要約

1. 憲章で特区限定なのは「LLM 統合・知覚」(`mvp-boundary-amendment.md:48`)。非 LLM の external API は `_map.md:77` で Future scope、`:24` で一般解禁ではない。Discord がどちらに当たるかを定めた条文はない。特区内には既に YouTube・ElevenLabs・OpenAI Decisions へ繋ぐコードがある。
2. probe/spike の前例は `apps/soul/agent/scripts/probe-*.mjs` / `spike-*.mjs`(コミット済み)。結果は `tmp/`(無視)、記録は `discussion/ai-cohost/experiments/`。コミットしない `node -e` の前例もある。
3. 鍵の読み方は二通り: 本体は `loadElevenLabsApiKey`(`elevenlabs-stt.mjs:103`)/`loadDecisionsApiKey`(`speak-now-decisions.mjs:72`)で `parseEnv`、probe は `node --env-file`。`.env*.local` の無視は `apps/soul/agent/.gitignore:50` だけで、特区の別サブディレクトリには効かない。
4. 依存は npm の独立パッケージ(`apps/soul/agent`、lock はコミット済み、install はユーザー)。`apps/soul` 直下に package.json は置かない。サブディレクトリの独立パッケージは容認(README `:22-28`)。`node_modules/` はどの深さでも無視。
