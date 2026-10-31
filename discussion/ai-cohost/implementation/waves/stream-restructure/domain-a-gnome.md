# 配信の組み直し Domain A — ロールと引っ越し(設定の分)完了報告

Gnome → Orch-Sylph(2026-10-31)。計画 [stream-restructure-wave-plan.md](../../orchestration/stream-restructure-wave-plan.md) §1 Domain A。ブランチ `ai-cohost/stream-restructure`(719c6edb の上)。**コミットはしていない(stage もしていない)。**
実データには触れていない: `apps/soul/agent/cockpit-settings.local.json`(と `.bak*`)・`apps/soul/agent/memories/`・`.env*.local` は読んでいない・書いていない・動かしていない。操縦席は起動していない。テストは全て OS temp のフォルダだけを使う。手元に `apps/soul/agent/roles/` と `apps/soul/agent/tmp/restructure-backups/` は作っていない(作業後に無いことを確かめた)。依存・lockfile は変えていない。

## 1. 変えたファイル

パスは `apps/soul/agent/` 起点。

| ファイル | 中身 |
|---|---|
| `src/roles/role-store.mjs`(新規) | ロールの置き場 `roles/<role-id>/`(`role.json` と `instructions.md`)の読み書き。`normalizeRole`(項目ごとに確かめ、読めない値はその項目だけ既定)・`readRole` / `writeRole` / `listRoles`・`readRoleInstructions` / `writeRoleInstructions`(無い・空なら既定の本文)・`roleIdentity`(名前を受け取る側の ModelIdentity の形へ)・`roleFromIdentity`(cody / chappy の表から作る)・`createRoleInstructionStore`(会話指示の API の置き場の口をロールの instructions.md に向ける)。`DEFAULT_ROLES_DIR` |
| `src/roles/role-migration.mjs`(新規) | 起動時の引っ越し(設定の分)。`migrateSettingsToRoles({ rolesDir, settingsPath, backupDir })`(置き場を引数に取る・投げない)・`planRolesFromSettings`(純関数)・`formatRoleMigrationReport`(1 回分の表示の行)・`migrationBackupDir`・`DEFAULT_MIGRATION_BACKUP_ROOT` |
| `src/roles/role-store.test.mjs`(新規) | 10 件 |
| `src/roles/role-migration.test.mjs`(新規) | 10 件 |
| `src/mind/model-identity.mjs` | id の型を string に。`ROLE_ID_PATTERN` / `isRoleId`、`normalizeModelIdentity`(形だけ確かめて通す・cody / chappy 以外も)。cody / chappy の表と `resolveModelIdentity` はひな形・既定として残す |
| `src/mind/brains.mjs` | 各行の `identity` と `resolveBrainIdentity` を外した(頭は名前を持たない) |
| `src/mind/fire-orchestrator.mjs` | `buildFireSystemPrompt` の名前の一文を `normalizeModelIdentity` に(ローマ字が無ければ括弧ごと省く・cody / chappy は今と同じバイト)。`CONVERSATION_INSTRUCTION_BRAIN_IDS` は古い設定の読み口と引っ越しだけに使う旨の注記 |
| `scripts/cockpit.mjs` | `createRoleHooks`(旧 `createBrainHooks` の置き換え)・`resolveRoleVoice`・`applyRoleHotwords`・`buildRoleSessionSystemPrompt`(旧 `buildBrainSessionSystemPrompt`)を足し、`createBrainHooks` を外した。`createConversationInstructionHooks` に `isKnownId`。`createVoiceEngineManager` に `voiceKey`(種類が同じでも声が替われば作り直す・`ensure` も同じ)。`main()`: 起動時に `migrateSettingsToRoles` を呼んで結果をターミナルへ 1 回出す → `createRoleHooks` → 口数・話し始め・声の方式の hooks をロールの口(`roleSettings`)で作る → 頭・名前・性格の指示・声(話者・声の id)・hotwords をロールから引く → `onSetBrain` を `onSetRole` に、サーバへ `onSetRole` / `roleStatus` / `currentRoleIdentity` / `notices` を渡す。`--speaker` のヘルプ |
| `src/cockpit/cockpit-server.mjs` | `POST /api/brain` を `POST /api/role` に(形の確かめ・耳が動いている間は 409・`onSetRole` の答えで 400 / 200・新しいロールの口数・話し始め・声の方式をサーバの現況に入れる)。オプション `currentBrainIdentity` → `currentRoleIdentity`、`onSetBrain` → `onSetRole`、`roleStatus` と `notices` を足した。snapshot に `role` と `notices`。名前は `normalizeModelIdentity` で通す(頭からは引かない・provider が無ければ `brain.identity` は null・判定の名前は既定のコーディ)。会話指示の API の鍵をロールの id に(応答の `brainId` → `roleId`・hooks の `isKnownId` で知らないロールを 400) |
| `src/cockpit/cockpit-settings-store.mjs` | `getRoleChoice` / `setRoleChoice`(今選んでいるロール)。`getBrainChoice` の注記 |
| `src/cockpit/cockpit-settings-store.test.mjs` | roleChoice の往復 1 件 |
| `src/cockpit/ui/header.mjs` | `IDENTITY_PAIRS`(cody / chappy の 2 組の許可リスト)をやめ、形(id がロールの id の形・見せる名前が 32 字までの空でない文字列)だけを確かめる |
| `src/cockpit/ui/settings-drawer.mjs` | 頭脳タブの中の最小限: 頭脳の select → ロールの select(snapshot の `role.roles` から・`POST /api/role`)。会話指示の編集は今のロール(snapshot の `role`)の instructions.md だけ |
| `src/cockpit/ui/conversation-instruction-editor.mjs` | 頭ごとの select を外し、今のロールの名前とモデルを読むだけで見せる。ロールが分からない間は書けない |
| `src/cockpit/view-logic/conversation-instruction.mjs` | 鍵をロールの id に(`isConversationInstructionRoleId`・応答の `roleId`)。`roleOptionsView` / `currentRoleView` を足し、頭の id の表(`CONVERSATION_INSTRUCTION_BRAIN_IDS` / `_OPTIONS`)と `conversationBrainIdentity` を外した |
| `src/cockpit/view-logic/settings.mjs` | `brainPostErrorText` → `rolePostErrorText`、`requestErrorText` の `brain` → `role` |
| `src/cockpit/ui/app.mjs` | `settingsFromSnapshot` に `role` と `notices`。`StartupNotices`(ログのタブの上に引っ越しの結果の行) |
| `src/cockpit/ui/styles.mjs` | `.startup-notices` の 2 行 |
| `.gitignore` | `/roles/` と `/roles.migrating-*/`(先頭の `/` で直下だけ。無いと `src/roles/` のコードまで無視する) |
| テスト(期待値の変更は §2) | `scripts/cockpit.test.mjs`、`src/cockpit/cockpit-server.test.mjs`、`src/cockpit/cockpit-ui.test.mjs`、`src/cockpit/view-logic/conversation-instruction.test.mjs`、`src/cockpit/view-logic/settings.test.mjs`、`src/mind/brains.test.mjs`、`src/mind/model-identity.test.mjs`(追加 1 件) |

## 2. 期待値を変えた既存テスト

全て仕様変更(頭の選択 → ロールの選択・名前と会話指示がロールへ)に伴うもの。

| テスト | 何が変わったか | 理由 |
|---|---|---|
| `brains.test.mjs`「6 brain entries bind to the exact frozen Cody/Chappy identities」「identity resolver preserves Cody fallback…」 | 1 件「頭は名前を持たない」に置き換え(identity が無いこと・ラベル・codex-55 が無いこと) | 名前を頭から切り離した(設計 §2.1) |
| `cockpit.test.mjs`「createBrainHooks: …」8 件 | 削除。代わりに `createRoleHooks` の 4 件 | 頭の選択をロールの選択に替えた |
| `cockpit.test.mjs`「buildBrainSessionSystemPrompt: …」3 件 | `buildRoleSessionSystemPrompt` の 2 件(cody / chappy の一文は同じ・教えは残る・壊れた名前はコーディ)と、名前がロールから引ける 1 件に置き換え | 名前と指示はロールから(頭の id から引かない) |
| `cockpit.test.mjs`「brain 切替×in-flight: codex / codex-astra …」 | 頭の指示を `promptForBrain`(頭の系統のロールの名前で組む)に。不変条件(次の Fire の境目で替わる・player を作り直さない)は同じ | 同上 |
| `cockpit.test.mjs`「conversation instruction revision: production session seam…」 | 指示の組み立てを `buildRoleSessionSystemPrompt(チャッピー, 本文)` に。流れの確かめは同じ | 同上 |
| `cockpit-server.test.mjs`「conversation instruction API: defaults… / durable persistence failure… / reset persistence failure…」 | 応答の `brainId` → `roleId` | 会話指示の鍵がロールの id |
| `cockpit-server.test.mjs`「conversation instruction API: unknown brain IDs… / unavailable hooks…」 | エラー文言 `brain id` → `role id`。知らない id は fake の `isKnownId` で断る | 同上 |
| `cockpit-server.test.mjs` の fake `makeFakeConversationInstructionHooks` | `isKnownId` を足した(旧テストの id をロールの id として知っている) | 同上 |
| `cockpit-server.test.mjs`「POST /api/brain: …」7 件と「GET /api/state: snapshot に brain が載る」 | 削除。代わりに `POST /api/role` の 5 件(503 と旧口の 404・snapshot の role / brain / 名前・選択で口数・話し始め・声の方式が替わる・知らない / 形の違うロール・耳が動いている間の 409)と notices の 1 件。頭だけ渡したときの `brain.identity` は null(頭から名前を作らない) | 同上 |
| `cockpit-server.test.mjs` の `makeFakeBrainWiring` | `brainStatus` だけの fake に縮めた(観測層の brain 札のテストは期待値そのまま) | `onSetBrain` が無くなった |
| `cockpit-server.test.mjs`「current identity providers…」「current identity provider is the public-state authority…」「conversation instruction privacy…」と、speak-now 2 件・コメント判定 2 件・コメント反応 1 件 | オプション名 `currentBrainIdentity` → `currentRoleIdentity`(期待値は同じ)。providers のテストにはロールの名前(ミオ・空の手がかり)が通る確かめを足した | 名前の provider はロールのもの |
| `cockpit-ui.test.mjs`「settingsFromSnapshot: …」 | `role: null` / `notices: []` を足した | snapshot に role と notices |
| `cockpit-ui.test.mjs`「TopBar identity: …」 | cody / chappy の 2 組の許可リストの確かめを、形の確かめ(ミオも通る・形の違うものは中立)に | 名前はロールが持つ |
| `cockpit-ui.test.mjs`「Cockpit Settings dirty event seam…」 | `requestEditorBrain` の正規表現 1 行を外した(ほかの確かめは同じ) | 編集画面の頭の切り替えが無くなった |
| `cockpit-ui.test.mjs`「conversation identity seam: six editor brains…」 | ロールの select の結線の確かめ(`roleOptionsView`・`POST /api/role`・今のロールの保存)に置き換え | 同上 |
| `cockpit-ui.test.mjs`「conversation instruction editor vnode: six brain choices…」「…魂がいつも足す教え…」 | 頭の select が無いこと・ロールの名前とモデルの表示・ロールが分からない間は書けない、に。教えのテストは props だけ | 同上 |
| `conversation-instruction.test.mjs`「contract: exactly six technical brain IDs…」「editor identity uses supplied canonical active facts…」 | ロールの id の形の確かめ・`roleOptionsView` / `currentRoleView` の確かめに置き換え | 同上 |
| `conversation-instruction.test.mjs`「response validation…」と controller の各テスト | 応答と state の `brainId` → `roleId`(旧の応答は受け取らない確かめを足した) | 同上 |
| `settings.test.mjs` の 2 か所 | `brainPostErrorText` → `rolePostErrorText`、`requestErrorText("brain")` → `("role")` | `POST /api/role` |

## 3. テスト結果

- `apps/soul/agent` で `node --test`: **1732 pass / 0 fail / 0 skipped / 0 cancelled**(作業前の基準 1713 pass を確かめてから始めた)。
- リポジトリの根で `pnpm run check:soul-zone`: **pass**(1558 files scanned)。
- 足したテスト(約束の分): ロールの読み書き(往復・無い/壊れたファイル・項目ごとの既定・`instructions.md` が空なら既定・会話指示の口)、引っ越しの関数(古い設定 → chappy・cody/指示の優先順/モデルの決め方/声・口数・話し始め・hotwords の写し/写しができる/古いキーが残り設定ファイルを書き換えない/`roles/` があれば 2 回目は何もしない/まっさら/壊れた設定/写しが取れなければ作らない/表示の行)、名前がロールから引けること(ミオなど cody / chappy 以外)、`POST /api/role`、声が替われば engine を作り直す(`prepare` と `ensure`)、`--speaker` がロールの値を上書きする、hotwords の重ね、roleChoice の往復、`normalizeModelIdentity`、ログのタブの知らせ。本物の LLM・外部 API は呼んでいない。

## 4. 写しの置き場と git check-ignore

- 写しの置き場: `apps/soul/agent/tmp/restructure-backups/restructure-<YYYYMMDD-HHMMSS>/`(1 回の引っ越しで 1 つ・設定ファイルは同じ名前で写す)。リポジトリの根の `.gitignore:19 tmp/` で無視される。
- `git check-ignore -v` の結果:
  - `apps/soul/agent/roles/chappy/role.json` → `apps/soul/agent/.gitignore:66:/roles/`
  - `apps/soul/agent/roles/cody/instructions.md` → `apps/soul/agent/.gitignore:66:/roles/`
  - `apps/soul/agent/roles.migrating-1234/x` → `apps/soul/agent/.gitignore:67:/roles.migrating-*/`
  - `apps/soul/agent/tmp/restructure-backups/restructure-20261031-090000/cockpit-settings.local.json` → `.gitignore:19:tmp/`
  - `apps/soul/agent/src/roles/role-store.mjs` → 該当なし(exit 1。コードは無視されない。最初に付けた `roles/` は `src/roles/` まで無視したので先頭に `/` を付けた)

## 5. 裁量(設計に無いことを決めた所)

1. **今選んでいるロールの保存先**: 設定ファイルのキー `roleChoice`(ロールの外に残る設定と同じ置き場・中身は `roles/<id>/`)。無いとき(引っ越しの直後など)は今までの `brainChoice` の系統で選ぶ(GPT 系 → `chappy`、それ以外・未記憶 → `cody` = 今までの既定の Claude/Cody と同じ)。それも無ければ id の順で最初のロール。引っ越しは設定ファイルに `roleChoice` を書かない(設定ファイルは読むだけ)。
2. **`roles/` も設定ファイルも無いまっさらな起動**: 写すものが無いので写しは取らず、既定の値で `chappy` と `cody` を作る(結果は `seeded`・表示は「設定ファイルが無いので、既定の値でロールを作った。」)。
3. **`roles/` はあるがロールが 1 つも読めないとき**: 引っ越しはしない。手元だけの既定のロール(こーでぃーの名前・頭は claude)で動き、置き場には書かない(`roles/` を作らないので、引っ越しが失敗したときも次の起動でもう一度走れる)。会話指示の API はこの手元のロールを知らないので編集できない。
4. **引っ越しの途中の失敗**: いったん `roles.migrating-<pid>/` に書き、全部書けてから `roles/` へ名前を変える。失敗したら作業用を消し、`roles/` を作らずに失敗で返す(ターミナルは WARN・画面にも同じ行)。写しが取れなければロールを作らない。
5. **チャッピーの「ほかの GPT 系の上書き」の順**: GPT-6.1 Sol → 今の `brainChoice`(GPT 系なら) → 頭の表の順(codex, codex-56-sol, codex-astra)。今聞いている指示を、ほかより先に拾うため。
6. **声の写し**: 設定にある `ttsEngine` は両方へ。AivisSpeech の話者と ElevenLabs の声の id は設定に無い(起動引数かコードの既定)ので `null`(= コードの既定)にした。`--speaker` の値はロールに焼き込まない(起動引数のまま上書きに使う)。
7. **hotwords**: 設定に `localSttHotwords` があればその値、無ければ今の既定 `["チャッピー", "コーディ"]` を両方のロールへ写す(今と同じ聞こえ方)。動いている間はロールの hotwords が設定の値を上書きする(ロールが `null` なら設定か既定のまま)。
8. **耳が動いている間のロールの選択**: `POST /api/role` は 409 で断る(場の途中でロールを替えない・設計 §2.1。場ができる Domain D までは「耳が動いている = 場の途中」とみなした)。旧 `POST /api/brain` は動いている間も替えられたので、ここは挙動が変わる。
9. **`instructions.md` の書き方**: 引っ越しで指示が既定のときはファイルを書かない(無い = 既定)。「既定へ戻す」は空のファイルにする(消さない)。
10. **role.json の形**: §1 の role-store.mjs の冒頭に書いた version 1。読めない値はその項目だけ既定(呼び名が無ければ id・頭は claude・口数 normal・話し始め speak-now・声 aivis・体 true)。
11. **口数・話し始め・声の方式の書き込み先**: 運転のタブ(control-bar)の口数・話し始めの POST と、Start の声の方式の記憶は、今のロールの role.json に書く(値の出どころをロールにしたため。タブから外すのは Domain E)。
12. **会話指示の編集画面**: 今のロールだけを編集する(編集画面の頭ごとの select は外した)。API は `/api/conversation-instructions/<role-id>`、応答は `roleId`。
13. **サーバの口の名前**: `currentBrainIdentity` → `currentRoleIdentity`。名前の provider が無いとき、`brain.identity` は null、判定の名前は既定のコーディ(頭の id から名前を作らない)。
14. **引っ越しの結果の画面の出し方**: snapshot の `notices` に起動 1 回分の行を載せ、ログのタブの上に出す(引っ越しが起きた起動のときだけ行がある・その起動の間は出たまま)。指示の本文は出さない(どの頭の上書きを使ったか・モデル・写しの置き場だけ)。
15. **見出しの名前の確かめ**: `IDENTITY_PAIRS` の代わりに、id がロールの id の形・見せる名前が 32 字までの空でない文字列か、だけを見る。
16. `createBrainHooks` と `resolveBrainIdentity` は使い手が無くなったので外した(残すと名前と頭の結び目が戻りうるため)。

## 6. 次のドメインへの申し送り

- **Domain B(記憶)**: 今のロールは `main()` の `roleHooks.currentId()` / `roleHooks.current()`(呼び名は `.name.canonical`)。引っ越しの写しのフォルダは `main()` で `migrationBackupDir(DEFAULT_MIGRATION_BACKUP_ROOT, Date.now())` をその場で作って渡している → 記憶の分も同じフォルダへ写すなら、この値を定数に上げて両方に渡す。`migrateSettingsToRoles` の結果は `backupDir` を返す。表示は `formatRoleMigrationReport` に件数を足す形。`main()` の記憶の 4 か所(`prepareMemoryFolder`・`createStreamRecordIdentity`・②・④)はまだ `DEFAULT_MEMORY_DIR` のまま。耳が止まっている間はロールを替えられるので、記憶の置き場をロールに合わせる所(起動時に 1 回決める今の作り)とどう噛み合わせるかは B / D で決める必要がある。
- **Domain C(体なし)**: ロールの体は `roleHooks.current().body` と snapshot の `role.body` で読める。挙動にはつないでいない。
- **Domain D(場)**: `POST /api/role` の 409 は `earsState !== "stopped"` で判定している → 場が開いているかに差し替える。`onSetRole` は選んだロールの口数・話し始め・声の方式を返し、サーバがそれを scheduler と Start の既定に入れる。ロールの切替でセッションは次の Fire の境目で作り直される(`sessionContextRevision`)。声は次の Start(か Start より前の Fire)で話者・声の id が違えば作り直す(`voiceKey`)。
- **Domain E(画面)**: 頭脳タブにロールの select と Set を置いただけ。snapshot の `role` は `{ id, displayName, brain, body, roles: [{ id, displayName, brain }] }`。上の帯は今も `settings.brain.identity` を読む(`settings.role` に替えてもよい)。運転のタブの口数・話し始めの POST は今のロールに書く。`settingsModalEventRoute` の `"brain"` の種類と、CSS の `.conversation-instruction-selection` は使われなくなった(消していない)。ロールの編集(名前・モデル・声・体)の画面と、ロールの書き込み口(`roleHooks.update` はあるが API は無い)は E の範囲。
- **範囲の外に残した古い記述**: `apps/soul/README.md:424`、`:457` が `POST /api/brain` を説明している(範囲外なので触っていない)。設定ファイルの `brainChoice` / `conversationInstructions` などの古いキーは読むだけで、操縦席はもう書かない。

## 7. 質問

1. 耳が動いている間のロールの選択を 409 で断る形(§5-8)を、Domain D までのつなぎとしてよいか。旧 `POST /api/brain` は配信の途中でも頭を替えられた。
2. まっさらな起動(設定ファイルも無い)で既定のロール 2 つを作る形(§5-2)でよいか。設計 §2.4 は「古い設定か記録があるときだけ動く」と書いているが、ロールが 1 つも無いと動けないため作るようにした。
3. 引っ越しで AivisSpeech の話者を `null`(コードの既定)にした(§5-6)。ユーザーがいつも `--speaker` 付きで起動しているなら、その値をロールに写したほうが Domain E の編集画面では分かりやすい。今は `--speaker` が上書きするので、聞こえ方は今と同じ。
4. `apps/soul/README.md` の `POST /api/brain` の記述を誰が直すか(どのドメインの範囲か)。
