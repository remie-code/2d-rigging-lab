# ロールを作るための棚卸し: 記憶の置き場・設定の形・頭と名前・声・名前の手がかり・文書の決まり(Sylph 2026-10-31)

> 目的: 「ロール」(名前・性格の指示・声・動かすモデル・しゃべり方の方針・体を使うか・記憶)を作る前に、今のコードの事実を集める。設計や範囲の判断はしない。
> 前提(呼び出し側から): 今ある記憶の記録は全部チャッピーのロールのもの。記憶の書き出し役(②)への指示と `_conventions.md` の文面は一字も変えない(ユーザーの決定)。
> 重複を避けるため、ロールの持ち物の散らばりの一覧は [layer-classification-2026-10.md](layer-classification-2026-10.md) §5 に任せ、ここでは「触る場所」と「残る結び付き」を足す。
> 読んでいないもの: `memories/` の中身(ディレクトリ名も見ていない)、`cockpit-settings.local.json` とその `.bak*`、`.env*.local`。行番号はすべて `apps/soul/agent/` からの相対パス(文書を除く)。

## 1. 記憶の置き場の仕組み

### 1.1 置き場を決めているコード

| 何 | 場所 | 中身 |
|---|---|---|
| 既定の置き場 | `src/memory/memory-store.mjs:40` | `DEFAULT_MEMORY_DIR = join(here, "..", "..", "memories")`(= `apps/soul/agent/memories/`)。定数はこれ 1 つ |
| 種のファイル | `src/memory/memory-store.mjs:43` | `CONVENTIONS_SEED_PATH = join(here, "conventions-seed.md")` |
| 決まりのファイル名 | `src/memory/memory-store.mjs:46` | `CONVENTIONS_FILE_NAME = "_conventions.md"` |
| 置き場の使い手 | `scripts/cockpit.mjs:84`(import)、`:1630`(準備)、`:1635`(本体のファイル名の決定)、`:1986`(②)、`:2037`(④) | 4 か所すべて `DEFAULT_MEMORY_DIR` をそのまま渡す。設定や起動引数から置き場を変える口は無い |
| 既定の取り込み | `src/mind/memory.mjs:34`、`:309` | `writeStreamRecord` の `dir` 省略時の既定が `DEFAULT_MEMORY_DIR` |
| `.gitignore` | `.gitignore:41` | `memories/`(プロジェクトの git からは外す) |
| テストの固定 | `src/memory/memory-store.test.mjs:45-46` | `DEFAULT_MEMORY_DIR` が `apps/soul/agent/memories` で終わることを確かめている。ほかのテストは一時フォルダを注入(`memory.test.mjs:546`、`recall.test.mjs:29`、`memory-store.test.mjs:59`) |

### 1.2 記憶の git(プロジェクトとは別の git)

- **初期化**: `prepareMemoryFolder`(`src/memory/memory-store.mjs:155-201`)。冪等。
  1. フォルダが無ければ `mkdirSync(dir, { recursive: true })`(`:162-164`)。
  2. `join(dir, ".git")` が無ければ `git init --quiet <dir>`(`:171-175`)。**見るのは `<dir>/.git` だけ**で、親のフォルダに `.git` があるかは見ない。
  3. 毎回 `git config --local` で `user.name=soul` / `user.email=soul@memory.invalid` / `core.autocrlf=false` / `core.safecrlf=false` を入れ直す(`:177-186`、定数 `:49-50`)。
  4. `<dir>/_conventions.md` が無ければ種を LF にそろえて書く(`flag: "wx"`、`:188-198`)。あれば触らない。
- **コミット**: `commitMemoryChanges`(`:237-271`)。`<dir>/.git` が無ければ git を呼ばずに失敗で返す(`:250-252`)。`status --porcelain --untracked-files=all` → 変化があれば `add --all` → `commit -m "<役名> <JST日時>"`(`buildCommitMessage` `:223-225`)→ `rev-parse HEAD`。
- **git を置き場に固定する方法**: init 以外はすべて `--git-dir=<dir>/.git --work-tree=<dir>`(`pinnedGitArgs` `:120-122`)。`GIT_DIR` などの継承環境変数を落とす(`:56-79`)。`execFile` で呼ぶ(シェルなし)。
- **誰がコミットするか**: ②のあとだけ(`src/mind/memory.mjs:245`、役名 `WRITER_ROLE = "書き出し役"` `:37`)。④はコミットしない(`src/mind/recall.mjs:18`)。
- **直列化**: 保存の係 `createMemoryRecorder` が 1 プロセスに 1 つで、index.lock がぶつからないように直列にする(`scripts/cockpit.mjs:601-611`、`:1979-2003`)。

### 1.3 `_conventions.md` の種がいつどこへ書かれるか

- **いつ**: 操縦席の起動時に 1 回(`scripts/cockpit.mjs:1629-1634`)。失敗しても配信は止めず、ターミナルに WARN を 1 行(`:1631-1633`)。
- **どこへ**: `prepareMemoryFolder({ dir: DEFAULT_MEMORY_DIR })` なので `memories/_conventions.md`。無いときだけ書く。
- **種の文面の中身(置き場の分け方に関わる部分だけ)**: パスは相対の語だけ(「このフォルダ」`src/memory/conventions-seed.md:3`、`:44`、`_map.md` `:15`、`:17`、`<YYYY-MM-DD>.md` `:18`)。絶対パスや `memories/` という語は入っていない。ただし**名前「チャッピー」が文面に入っている**(`:3`、`:37`、`:49`)。種は 1 つしかない(ロールごとの種の口は無い)。

### 1.4 ②書き出し役・④思い出し役へのフォルダの渡し方

| | ②書き出し役 | ④思い出し役 |
|---|---|---|
| 呼び口 | `writeStreamRecord`(`src/mind/memory.mjs:308-340`)→ `runWriterOnce`(`:221-248`) | `runRecall`(`src/mind/recall.mjs:155-190`) |
| 作業ディレクトリ | `create({ cwd: dir })`(`memory.mjs:226`) | `create({ cwd: dir })`(`recall.mjs:167`) |
| 権限 | `sandbox: "workspace-write"`(`memory.mjs:227`) | `sandbox: "read-only"`(`recall.mjs:168`) |
| そのほか | `finalAnswerOnly: true`、`ephemeral: true`(`memory.mjs:228-230`) | 同じ(`recall.mjs:169-171`)。打ち切り 120 秒(`:41`) |
| 指示(systemPrompt) | `WRITER_SYSTEM_PROMPT`(`memory.mjs:164-169`) | `RECALL_SYSTEM_PROMPT`(`recall.mjs:62-67`) |
| 頼みの本文 | `buildWriterRequest`(`memory.mjs:176-208`) | `buildRecallRequest`(`recall.mjs:95-115`) |
| `dir` の出どころ | `scripts/cockpit.mjs:1986` | `scripts/cockpit.mjs:2037`(思い出しの係 `recall-desk.mjs` は `dir` を知らない。`runRecall` の job は `{ request, entries, nowMs }` だけ `recall-desk.mjs:73`、`:173`) |

- Codex 側の扱い: `cwd` は絶対パス必須(`src/mind/codex-session.mjs:655-656`)。thread/start と turn/start に渡す(`:1036`、`:1149`)。`workspace-write` の `writableRoots` は空で、書けるのは cwd の下だけ(`:158-160`)。MCP の名前を読む `config/read` も `cwd: threadCwd` で読む(`:963`)。App Server のプロセス自体の cwd は一時フォルダのまま(`:31-32`、`:932`)。
- **パスはプロンプトに埋め込まれていない。** ②④の指示はどちらも「今の作業フォルダが記憶の置き場です」(`memory.mjs:166`、`recall.mjs:64`)で、`_conventions.md` / `_map.md` は相対の名前だけ(`memory.mjs:166`、`:195-198`、`recall.mjs:64`、`:102-103`)。②に渡す既存の本体も `<topic>/<名前>.md` の相対パス(`memory.mjs:135-139`、`:180`)。名前(チャッピー)も入っていない。→ **置き場を `memories/<role>/` に変えても、`dir` を差し替えるだけで②④の文面は変えずに済む**(コードの事実から)。
- ただし文面には「配信」「配信の相方 AI」「you = 配信者」が入っている(`memory.mjs:165`、`:185`、`:203`、`recall.mjs:63`、`:97`、`:110`)。これは置き場の分け方とは別の話(layer-classification §2.4)。

### 1.5 置き場の中身を魂が読む場所(フォルダの形に依存するコード)

- `topicDirs(dir)`(`src/mind/memory.mjs:89-98`): `dir` 直下のフォルダのうち `.` と `_` で始まらないものを**すべてトピックとみなす**。
- `resolveStreamRecordBaseName`(`:107-128`): 全トピックの `<日付>(-n).md` を数えて今回のファイル名を決める。
- `findStreamRecordFiles`(`:135-139`): 今回の本体があるトピックを探す(②への頼みと、書き損じの判定 `:272-277` に使う)。
- `createStreamRecordIdentity`(`:147-159`): 起動時に `dir` を受け取り、最初の `get()` で 1 回だけ決める(`scripts/cockpit.mjs:1635`)。

### 1.6 `memories/<role>/` に分けるときに触る場所(事実の一覧)

| 触る場所 | 今 | 分けたときに起きること(コードから読める範囲) |
|---|---|---|
| `src/memory/memory-store.mjs:40` `DEFAULT_MEMORY_DIR` | `memories/` | ロールのフォルダを作る関数か、呼び出し側で `join(DEFAULT_MEMORY_DIR, role)` を組むかのどちらか【推測】。`memory-store.test.mjs:45-46` はこの定数の形を固定している |
| `scripts/cockpit.mjs:1630` `prepareMemoryFolder` | `memories/` を準備 | `dir` を `memories/<role>/` にすると、`<role>/.git` が無ければ**そこに新しい git を作る**(`memory-store.mjs:171-175`)。`memories/.git` が既にあっても見ない。その場合 `memories/` の git の中に別の git が入れ子になる。【推測: 今の `memories/` には起動時の準備で `.git` ができているはず。中身を見ていないので未確認】 |
| `scripts/cockpit.mjs:1630` の種 | `memories/_conventions.md` | `memories/<role>/_conventions.md` に種(チャッピーの名前入り)が置かれる。種は 1 つなので、チャッピー以外のロールでも同じ文面になる(`conventions-seed.md:3`) |
| `scripts/cockpit.mjs:1635` `createStreamRecordIdentity` | 起動時に 1 回、`dir` を固定 | 起動のあとでロールを切り替えるなら、ここも作り直しが要る(今は起動 1 回に 1 つ)【推測】 |
| `scripts/cockpit.mjs:1986` ②の `dir` | `DEFAULT_MEMORY_DIR` | ロールのフォルダを渡す。②の指示文は変えずに済む(§1.4) |
| `scripts/cockpit.mjs:2037` ④の `dir` | `DEFAULT_MEMORY_DIR` | 同上 |
| `scripts/cockpit.mjs:1979-2003` 保存の係 | 1 プロセスに 1 つ、直列 | ロールが 1 起動に 1 つなら今のまま。同じ起動で複数ロールが記憶を書くなら、git ごとの直列が要る【推測】 |
| 今の記録をチャッピーへ移す | — | コードには移す道は無い(移し替えは開発側の手作業、という前例: `discussion/ai-cohost/memory/recall-flow.md:76`) |

- **置き場の根を `memories/` のままにして、ロールのフォルダをその下に並べた場合の注意(コードの事実)**: ②④の cwd を `memories/` のままにすると、`topicDirs` がロールのフォルダをトピックとして数え(`memory.mjs:89-98`)、②の `workspace-write` は他のロールのフォルダにも書ける(`codex-session.mjs:158-160`)。cwd を `memories/<role>/` にすれば、どちらも起きない。
- 【推測】Codex は cwd から上へ git の根を探して AGENTS.md などを読む作りと思われる。`memories/<role>/.git` があればそこで止まり、無ければ `memories/.git`、それも無ければプロジェクトの git まで上がる可能性がある。確かめていない。

## 2. 設定ファイルの形(`cockpit-settings-store.mjs`)

- 保存先: `DEFAULT_SETTINGS_PATH = apps/soul/agent/cockpit-settings.local.json`(`src/cockpit/cockpit-settings-store.mjs:116`)。1 つの JSON。
- 書き方: set のたびに全体を読んでマージして書く(`writeMerged` `:181-189`)。**知らない最上位のキーは残る**(`{ ...readAll(), ...patch }` `:183`)。読めない・壊れた JSON は `{}` 扱い(`:171-178`)なので、壊れたファイルに 1 回でも set すると、そのキーだけのファイルで上書きされる。書き込み失敗は握りつぶす。会話指示だけは失敗を投げる別の書き方(`writeMergedStrict` `:198-203`)。
- 操縦席サーバが直接読むのは `lastDevice` だけ(`src/cockpit/cockpit-server.mjs:1203`、`:2179`)。ほかは `scripts/cockpit.mjs` の hooks 経由。

| キー | 読み書きの型 | 既定・妥当な値(どこで決まるか) |
|---|---|---|
| `lastDevice` | string \| null(`:247`、`:251`) | 既定なし |
| `lastChannelUrl` | string \| null(`:254`、`:258`) | 起動引数 `--channel` が優先(`scripts/cockpit.mjs:1649`)、指定されたら保存(`:1703-1706`) |
| `visionTarget` | string \| null(`:261`、`:265`) | 既定なし |
| `audioDevice` | string \| null(`:268`、`:272`) | 既定なし(= 既定の出力) |
| `selfFireEnabled` | boolean(読めなければ null)(`:275-281`) | 既定 OFF(呼び出し側) |
| `bargeInEnabled` | boolean(`:283-289`) | 既定 ON(呼び出し側) |
| `chatSource` | string \| null(`:291`、`:295`) | 既定なし |
| `verbosityMode` | string \| null(`:298`、`:302`) | `quiet` / `normal` / `chatty`、それ以外は `normal`(`scripts/cockpit.mjs:764-772`) |
| `brainChoice` | string \| null(`:305`、`:309`) | `BRAIN_IDS` にある値だけ、それ以外は `claude`(`scripts/cockpit.mjs:808-814`) |
| `sttEngine` | string \| null(`:312`、`:316`) | `whisper` / `elevenlabs` / `parakeet` / `zipformer`、既定 `whisper`(`scripts/cockpit.mjs:869-877`) |
| `ttsEngine` | string \| null(`:319`、`:323`) | `aivis` / `elevenlabs`、既定 `aivis`(`scripts/cockpit.mjs:890`、`:904-912`) |
| `speakStartMode` | string \| null(`:326`、`:330`) | `classic` / `speak-now`、既定 `speak-now`(`scripts/cockpit.mjs:1185-1191`) |
| `commentBusyPolicy` | string \| null(`:333`、`:337`) | `drop` 以外は `hold`(`scripts/cockpit.mjs:1229-1232`) |
| `commentHoldMaxAgeSec` / `commentHoldMaxCount` | 正の数(読むだけ)(`:339-343`) | 手で書くキー |
| `backchannelMinIntervalSec` | 0 以上の数(読むだけ)(`:344-347`) | 既定 8 秒(呼び出し側) |
| `latencyWarnSec` / `latencyAlertSec` | 正の数(読むだけ)(`:348-352`) | 既定 4 / 6 秒 |
| `compactThresholdTokens` | 整数(5 万〜45 万に正規化)(`:359`、`:365-368`) | set のとき旧キー `compactThresholdRatio` を消す(`:367`) |
| `compactQuietSec` / `compactMinIntervalMin` | 0 以上の数(読むだけ)(`:356-362`) | 既定 3 秒 / 10 分 |
| `codexFastMode` | boolean(`:370-376`) | 既定 OFF |
| `localSttThreads` / `localSttPreRollMs` / `localSttSilencePadMs` / `localSttHotwords` / `localSttHotwordsScore` | 読むだけ。`normalizeLocalSttSettings` に通す(`:377-386`) | hotwords は文字列の配列、既定 `["チャッピー", "コーディ"]`(`src/ears/local-stt/local-stt-engines.mjs:71`、正規化 `:117-134`) |
| `conversationInstructions` | 書く形 `{ version: 1, overrides: { <頭の id>: string } }`(`:233-243`)。読むときは `overrides` が無ければ直下を地図とみなす(古い形、`:214-230`) | **頭の id は `CONVERSATION_INSTRUCTION_BRAIN_IDS` の 6 つだけ**(`src/mind/fire-orchestrator.mjs:230-237`)。それ以外の id は読まず、次に保存するときに消える(`:223-228`、`:236-238`)。空文字列も読まない |
| (`memoryEnabled`) | 読まない(`:38`) | 古いファイルに残っていても無視 |

- 会話指示の既定の本文: `FIRE_SYSTEM_PROMPT_BODY`(`src/mind/fire-orchestrator.mjs:205-207`)。知らない id は Claude の既定に倒れる(`:255-269`)。
- 会話指示の頭の id の一覧は、ほかに 2 か所に**直書き**: 操縦席 API の検査(`src/cockpit/cockpit-server.mjs:100` で import して `:1588` で照合)と画面側の写し(`src/cockpit/view-logic/conversation-instruction.mjs:14-21`。画面の層は brains.mjs を import しない決まり)。

## 3. 頭の一覧と名前の表

### 3.1 頭の表(`src/mind/brains.mjs:50-109`)

| id | 表示名(label) | 作り方 | 名前(identity) |
|---|---|---|---|
| `claude` | Claude (Opus 4.8)(`:53`) | `createLlmSession` | cody(`:56`) |
| `claude-opus-55` | Claude (Opus 5.5)(`:64`) | `createLlmSession` + model `claude-opus-5-5`(`:65`) | cody(`:67`) |
| `codex` | Codex (GPT-5.6 Terra)(`:71`) | `createCodexSession` | chappy(`:74`) |
| `codex-56-sol` | Codex (GPT-5.6 Sol)(`:86`) | model `gpt-5.6-sol`、effort low(`:89`) | chappy(`:91`) |
| `codex-astra` | GPT-6 Astra(`:95`) | model `gpt-6-astra`、effort low(`:96`) | chappy(`:98`) |
| `codex-61-sol` | GPT-6.1 Sol(`:102`) | model `gpt-6.1-sol`、effort low(`:105`) | chappy(`:107`) |

- `BRAIN_IDS`(`:115`)。`resolveBrainIdentity(brainId)` は行の `identity` を返し、知らなければコーディ(`:124-127`)。

### 3.2 名前の表(`src/mind/model-identity.mjs`)

| id | canonicalName | latinName | displayName | whisperPrompt | voiceCallVariants | commentCallVariants |
|---|---|---|---|---|---|---|
| cody(`:53-61`) | コーディ | Cody | こーでぃー | 「こーでぃー、コーディ。」 | コーディ / コーディー / コーティ / コーティー(`:22-27`) | Cody / cody / CODY + 声の 4 つ + こーでぃー(`:29-35`) |
| chappy(`:62-70`) | チャッピー | Chappy | チャッピー | 「ちゃっぴー、チャッピー。」 | チャッピー / ちゃっぴー(`:37`) | Chappy / chappy / CHAPPY + 声の 2 つ(`:39-44`) |

- 型の `id` は `"cody" | "chappy"` に固定(`:13`)。知らない値はコーディ(`:74`、`resolveModelIdentity` `:83-88`)。

### 3.3 ②④の頭の決め方

- `resolveWriterBrainDef(currentBrain)`(`scripts/cockpit.mjs:594-599`): 今の①の頭が Codex 系(`codex` か `codex-` で始まる、`isCodexBrainId` `:1316-1318`)ならその頭、そうでなければ `BRAINS.codex`。②(`:1983`)と④(`:2033`)の両方がこれを通る。理由は Claude の頭が `cwd` / `sandbox` / `finalAnswerOnly` を黙って無視するため(`:588-589`、`src/mind/memory.mjs:21`)。
- 文書側の決定では「②④は①と同じ頭」(`discussion/ai-cohost/memory/recall-flow.md:62`)、Claude の頭での②④は後回し(`:82`)。

### 3.4 ロールに「動かすモデル」を持たせたときに残る結び付き

1. **名前が頭の行に付いている。** `brains.mjs` の各行の `identity`(§3.1)と、`resolveBrainIdentity`(`brains.mjs:124`)。操縦席の今の名前は `getCurrentBrainIdentity = () => resolveBrainIdentity(currentBrain)` 1 本(`scripts/cockpit.mjs:1624`)で、サーバへ `currentBrainIdentity` として渡る(`:2144`)。
2. **名前の id が cody / chappy の 2 値に固定。** 名前の一文の組み立ては id が `cody` か `chappy` のときだけ表を引き、それ以外はコーディ(`src/mind/fire-orchestrator.mjs:280-288`)。操縦席サーバも受け取った identity を `resolveModelIdentity(...id)` で正規化し直す(`src/cockpit/cockpit-server.mjs:927-929`、`:2656`)。→ 新しい名前を渡しても、今のままではコーディに倒れる。
3. **会話指示が頭の id ごと。** 保存の鍵(§2)、API の検査(`cockpit-server.mjs:1588`)、編集画面の id 一覧(`view-logic/conversation-instruction.mjs:14-21`)、`getProfile(currentBrain)`(`scripts/cockpit.mjs:1753`)。
4. **頭の id の直書き。** `/api/brain` の受理値 6 つ(`cockpit-server.mjs:1948-1955`)、画面の頭の札 `BRAIN_LABELS`(`src/cockpit/view-logic/health.mjs:185-189` 付近)。
5. **頭の種類で分かれる処理。** Claude の env ガード(`scripts/cockpit.mjs:1741`)、少しずつ声にする道の可否(`fire-orchestrator.mjs:842`)、Codex の残量・fast・文脈の圧縮(`scripts/cockpit.mjs:1665`、`:1759`、`:1952`、`:1909`)。これらは頭の性質なので、ロールではなく頭に付いたままになる【推測】。
6. **②④の頭が①の頭から決まる**(§3.3)。ロールが頭を持つと、②④の頭もロール経由で決まる形になる。
7. **頭の切り替えで名前と会話指示が一緒に替わる。** `onSetBrain` は `currentBrain` を書き換えて文脈の版を進めるだけ(`scripts/cockpit.mjs:1947-1954`)。次の Fire で名前と会話指示を引き直す(`:1729`、`:1753`)。記憶の置き場・声は替わらない。

## 4. 声の話者の決まり方

| 何 | 場所 | 中身 |
|---|---|---|
| 声の方式 | 設定 `ttsEngine`、`createTtsEngineHooks`(`scripts/cockpit.mjs:890`、`:904-922`)、起動時の値 `desiredTtsEngine`(`:1594`)、Start ごとの保存 `:2200-2205` | `aivis` / `elevenlabs`。全体で 1 つ |
| AivisSpeech の話者 | 起動引数 `--speaker`(`scripts/cockpit.mjs:136`、`:147`、ヘルプ `:1527`) | 設定ファイルには無い |
| 話者の既定 | `src/voice/tts-client.mjs:29` `DEFAULT_SPEAKER_ID = 888753760`(まお ノーマル、`:100`)、適用 `:112` | `--speaker` が無いとき |
| `--speaker` が流れる先 | `scripts/cockpit.mjs:1596`(AivisSpeech の engine)、`:1599`(ElevenLabs の読みの口 = AivisSpeech の `/accent_phrases`)、`:1601`(同)、`:1880-1883`(`productionSpeakDeps` → 発火の胴体の既定の engine `src/mind/fire-orchestrator.mjs:379`、`:609`、`:673`、`:1128`) | ElevenLabs を使うときも、読み(口の時間割の材料)は AivisSpeech の話者で取る(`src/voice/engines/elevenlabs-voice-engine.mjs:142-145`) |
| ElevenLabs の声 | `src/voice/engines/elevenlabs-voice-engine.mjs:59-61` `ELEVENLABS_TTS_DEFAULTS.voiceId = "Ona22sJYfzcps6cE1jVk"`、`modelId = "eleven_v4_turbo"` | 上書きは deps の `voiceId`(`:97`、`:126-129`)。操縦席は渡していない(`scripts/cockpit.mjs:1598-1602`)。使われるのは最初のメッセージ(`:285`)と文ごとの送信(`:430`) |
| engine の作り直し | `createVoiceEngineManager.prepare(kind)`(`scripts/cockpit.mjs:1031-1036`) | **種類が同じなら使い回す**(ElevenLabs が `down` のときだけ作り直す)。声の id や話者が替わっても作り直す道は今は無い |
| ほかの使い手 | `src/cli/cli.mjs:158`、`:208`、`scripts/preflight-tts.mjs`、`scripts/preflight-e2e.mjs` | 会話 CLI と試験の道具も `--speaker` / 既定の話者を使う |

- ロールの声に移すときに触る場所(事実の一覧): `parseCockpitArgs` の `--speaker`、`createVoiceEngineManager` に渡す `aivisDeps` / `elevenLabsDeps`(`:1595-1602`、ここに `voiceId` を足す口がある)、`productionSpeakDeps`(`:1880-1883`)、`prepare` の使い回しの条件(`:1032-1035`)、設定 `ttsEngine` の hooks(`:904-922`)。

## 5. 名前の手がかりの使われ方

| 手がかり | 使う所 | 引き方 | 頭を替えたとき |
|---|---|---|---|
| `whisperPrompt` | Whisper の initial prompt(語彙の寄せ)。`src/cockpit/cockpit-server.mjs:1325-1330` で `promptProvider` を作り、`src/ears/ear-pipeline.mjs:591-592` → `src/ears/whisper-inference.mjs:117-118`、`:130` で発話ごとに読む | 今の identity から | 耳を作り直さずに次の発話から替わる(`cockpit-server.mjs:1319-1321`) |
| `voiceCallVariants` | 従来の発火の予定の「呼びかけ」の照合(`src/mind/fire-scheduler.mjs:758`)。`cockpit-server.mjs:2361-2364` で provider を渡す | 今の identity から。provider が無いか不正な値なら古い既定 `NAME_VARIANTS_V0`(コーディ系、`fire-scheduler.mjs:232`、`:485-487`、`:497`) | 次の照合から替わる |
| `commentCallVariants` | コメントの中の呼びかけの照合(`fire-scheduler.mjs:801`)。`cockpit-server.mjs:2365-2368` | 同上。古い既定 `NAME_VARIANTS_TEXT_V0`(`fire-scheduler.mjs:207`、`:492-495`) | 同上 |
| `localSttHotwords` | Zipformer の hotwords だけ(Parakeet は使わない)。設定ファイルのキー → `getLocalStt`(`cockpit-settings-store.mjs:377-386`)→ `scripts/cockpit.mjs:2196` → Start ごとに読む(`cockpit-server.mjs:1264` 付近)→ `ear-pipeline.mjs:530` → `local-stt-client.mjs:189` → `local-stt-worker-core.mjs:62-70` | **identity とは無関係。** 設定か既定 `["チャッピー", "コーディ"]`(`local-stt-engines.mjs:71`) | 替わらない(次の Start で設定を読み直すだけ) |
| `canonicalName` | 名前の一文(`fire-orchestrator.mjs:287`)、判定の問いと会話のラベル(`cockpit-server.mjs:2655-2660` の `currentSoulName`) | `resolveModelIdentity` 経由(cody / chappy のみ) | 次の判定・次のセッションから |
| `displayName` | 操縦席の見出しと会話指示の編集画面(`cockpit-server.mjs:930-943` の snapshot、`src/cockpit/ui/header.mjs:45-55`、`src/cockpit/ui/conversation-instruction-editor.mjs:14-15`) | 同上 | snapshot ごと |

- ElevenLabs の文字起こし(`src/ears/elevenlabs-stt.mjs`)には名前の手がかりを渡す口が見当たらない(`src/ears` で `prompt` / `keyterm` を grep して、Whisper 以外に当たらなかった)。
- layer-classification §6 の「古い名前の揺れ(`fire-scheduler.mjs:207`、`:232`)が今も使われる道があるか」: 操縦席はいつも `currentBrainIdentity` を渡す(`scripts/cockpit.mjs:2144`)ので、操縦席の道では provider が使われ、古い既定は provider が配列を返さないときの保険になる(`fire-scheduler.mjs:497` のコメント)。provider を渡さない呼び方(テストなど)では古い既定が使われる。

## 6. 文書の書き方の決まり

### 6.1 全体の決まり(`discussion/_conventions.md`)

- `_map.md` は直下の一覧・状態・リンク・次に読む文書を示す軽い地図。本文は詰め込まない。子のディレクトリの詳細は子の `_map.md` に任せる(`:127-144`)。
- 状態の例: `Draft`, `In discussion`, `Accepted`, `Needs review`, `Blocked`, `Superseded`(`:144`)。
- 新しいファイルは意味のある英語のケバブケース。既存の連番規則があれば従う。メタファイルは先頭に `_`(`:238-244`)。
- 事実・仮説・設計判断・実験結果・未決事項を混ぜない(`:197-208`)。
- ai-cohost の行(`:163`): 実装成果物はトピック内 `implementation/`(runtime-player 方式)。

### 6.2 `discussion/ai-cohost/architecture/_map.md`

- 冒頭の一文: 設計方向・設計判断を置き、裏付けの調査事実は research/ に分ける(`:3`)。
- 表の列: `Path | Content | Status`(`:5`)。Status は `Accepted(日付)` が基本で、「設計方向=Accepted(日付)。実装=〇〇閉鎖(日付)」のように方向と実装を分けて書く行が多い(`:9-14`)。
- ファイル名: 内容の名前(`conversation-pipeline-direction.md`、`runtime-player-model-host-roles.md`)か、段の番号 + 内容(`c4-control-channel-v0.md`)。
- 下に「未決事項(主要な設計分岐)」の表(`ID | 分岐 | 状態`、`D1`〜`D7`、`:17-25`)。
- 最後の行の追加は C6(2026-07 頃)。S 段以降(魂の側)の設計文書はここに足されていない。魂の側の設計は `discussion/ai-cohost/memory/`、`discord-vc/` など話題ごとのディレクトリに置かれている(例: `recall-flow.md`、`discord-vc/scope.md`)。

### 6.3 `discussion/ai-cohost/implementation/orchestration/_map.md`

- 冒頭: 「ai-cohost実装waveの計画とplanning gate成果物」(`:3`)。
- 表の列: `Path | Status | Content`(`:5`。architecture と列の順が違う)。
- ファイル名の対: `<題>-inventory.md`(棚卸し)と `<題>-wave-plan.md`(計画)。例: `memory-recall-inventory.md` / `memory-recall-wave-plan.md`(`:54-55`)、`voice-swap-*`(`:52-53`)。棚卸し無しの計画だけの例: `local-stt-wave-plan.md`(`:56`)、`latency-fix-plan.md`(`:57`)、閉鎖記録 `c7-closure-record.md`(`:21`)。
- 状態の書き方は時期で揺れている。
  - 2026-07: 「**完全閉鎖(日付)**: 根拠」(`:9-31`)、「完了(日付)。Verdict needs_design → ユーザー裁定N件で解消」(棚卸し、`:8`、`:10`)。
  - 2026-08〜09: 英語の大文字(`BOUNDED MACHINE / HUMAN PASS`、`MECHANICAL PASS / USER GATE PENDING`、`ACTIVE — Wave 1A / 1B launched`、`:7`、`:46-47`)。
  - 2026-10(直近): 日本語の短い形。棚卸しは「**完了(日付)**」(`:52`、`:54`)、計画は「**完了・人間ゲート合格(日付)**」(`:53`)、「**完了・思い出す流れは人間ゲート合格(日付)**」(`:55`)、「**人間ゲート合格(日付)**」(`:56`)、「**実配信で確認済み(日付)**」(`:57`)。
- Content 欄は 1〜2 文。直近の行は wave の並びを矢印と `∥` で書く(例 `:53`、`:55`「W1: … ∥ … → W2: … → W3: … → 人間ゲート 6 点」)。
- 行の並びは時系列ではない(`:7` の gpt-6-astra が先頭、s6 が s8 の後ろ `:37`)。直近は末尾に足している(`:52-57`)。
- 実装報告・レビューは `../waves/<題>/`、`../reviews/<題>/`(= `implementation/waves/`、`implementation/reviews/`)へのリンク(`:11`、`:44-46`)。

### 6.4 この文書の置き場について

- `discord-vc/_map.md` の Key Files の表(列 `Path | Content`)に research の文書が並んでいる。この文書はまだ載っていない(呼び出し側が足す想定)。

## 7. 未確認のこと

- `memories/` に今 `.git` と `_conventions.md` が実際にあるか、トピックのフォルダ名に `.` / `_` で始まるものがあるか。中身を開いていないので、コードの道から「あるはず」と読んだだけ。
- Codex が cwd から上へ何を読みに行くか(AGENTS.md、プロジェクトの `.codex/config.toml` など)。`config/read` に `cwd` を渡していること(`codex-session.mjs:963`)だけ確かめた。
- `cockpit-settings.local.json` に、6 つ以外の頭の id や、知らない最上位のキーが入っているか。読んでいない。
- `view-logic/health.mjs` の `BRAIN_LABELS` の全行と、操縦席の画面で頭の選択を描く部品(`ui/settings-drawer.mjs:390-396` 付近)の全体。id の直書きがあることだけ見た。
- 設定 `ttsEngine` と声の id を「ロールの持ち物」にするとき、Start ごとに `ttsEngine` を保存している今の流れ(`scripts/cockpit.mjs:2201`)とどう噛み合うか。コードからは決まらない。

## 8. 質問(呼び出し側へ)

1. ロールを替える単位は「起動 1 回」か「起動中にも替えられる」か。起動中に替えるなら、`createStreamRecordIdentity`(起動時に `dir` を固定)と保存の係(1 プロセスに 1 つ)の作りが関わる(§1.6)。
2. 記憶の git は「ロールごとに 1 つ」か「`memories/` に 1 つ」か。今のコードのまま `dir` だけ替えると、ロールごとに git ができる(§1.2、§1.6)。今の `memories/.git` の履歴をどう扱うかは、この選び方次第。
3. チャッピー以外のロールの `_conventions.md` も、今の種(「チャッピー」の名前入り)から置いてよいか。種は 1 つしかない(§1.3)。
