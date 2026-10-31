# 配信の組み直し(ロール・場・体なしの口)planning inventory

> Status: 棚卸し完了(2026-10-31)。設計は [../../architecture/stream-restructure.md](../../architecture/stream-restructure.md)(以下「設計」)。wave 計画はまだ無い。
> 棚卸しは Sylph 1 本(読み取りのみ・コードは変えていない)。前提の調査 [../../discord-vc/research/restructure-cockpit-map-2026-10.md](../../discord-vc/research/restructure-cockpit-map-2026-10.md)(以下「地図」)と [../../discord-vc/research/restructure-role-state-2026-10.md](../../discord-vc/research/restructure-role-state-2026-10.md)(以下「ロールの棚卸し」)に書いた事実は繰り返さず、§ を指す。
> パスは断りがなければ `apps/soul/agent/` 起点。地図の行番号は 8e0c1d6a 時点のもの。HEAD(4e0cbba7)までに `apps/` の変更は無い(`git diff --stat 8e0c1d6a HEAD -- apps` が空)ので、そのまま使える。
> `.env*.local`・`cockpit-settings.local.json`(と .bak)・`memories/` の中身は開いていない。【推測】と書いたもの以外はコードか文書で確かめた。

## 1. 前例の wave 計画の形

直近 3 本(声の差し替え・記憶の作り直し・ローカルの文字起こし)と、その前の型(配信間記憶)を読んだ。

### 1.1 章立て

- **直近の型**(`memory-recall-wave-plan.md`、`voice-swap-wave-plan.md`):
  - 冒頭の引用ブロック: Status(wave ごとの完了・コミット・突き合わせのリンクを追記していく)、根拠(合意・棚卸しへのリンク)、レビューの粒度の一文(`memory-recall-wave-plan.md:3-9`、`voice-swap-wave-plan.md:3-4`)。
  - §0 形: 全 wave に共通の絵(コードブロック)と、境の約束(`memory-recall-wave-plan.md:11-24`、`voice-swap-wave-plan.md:6-26`)。
  - §1〜§3 Wave ごとの節。中に `### Domain X — 名前(触るパス)`。wave の間に「### Wave N からの申し送り(Wave N+1 の完了条件に含める)」の番号付き一覧(`memory-recall-wave-plan.md:55-61`、`:80-84`、`voice-swap-wave-plan.md:69-87`)。
  - §4 依存と並列、§5 モデル配分、§6 人間ゲート(`memory-recall-wave-plan.md:109-127`、`voice-swap-wave-plan.md:120-140`)。
- **1 wave・1 ドメインの型**(`local-stt-wave-plan.md`): §0 合意 → §1 Domain(番号付きの作業項目) → §2 人間ゲート。モデル配分の節は無い(`:1-55`)。
- **前の型**(`stream-memory-wave-plan.md`、2026-07): §1 ゴールとゲート(ゴール・機械ゲート・人間ゲート)→ §2 設計の枠 → §3 ドメイン分割 → §4 blocking レビュー基準 → §5 choke point → §6 Status。方式の行に Orch-Sylph とモデルを書く(`:3-5`)。
- 棚卸し(inventory)の型: 冒頭に Status・合意・計画へのリンク・「棚卸しは Sylph N 本」(`memory-recall-inventory.md:1-4`)。本文は話題ごとの節に、`ファイル:行` 付きの箇条書きと小さな表。前の型は「リポジトリ事実」と「L0 設計判断」を節で分ける(`stream-memory-inventory.md:6`、`:16`)。

### 1.2 ドメインの書き方

- 見出しは「Domain 記号 — 何をするか(主なパス)」(`memory-recall-wave-plan.md:28`、`:40`、`:65`、`:88`)。記号は計画を通して A, B, C… と続く(wave ごとにやり直さない)。
- 本文は「何を作る/変えるか」の箇条書き。実機で確かめることがあれば「最初に実機で…確かめる。だめなら…」と書く(`memory-recall-wave-plan.md:31-33`)。
- 消すもの(撤去)は節を分けて列挙する(`memory-recall-wave-plan.md:73-77`)。
- 期待値が変わる既存テストは「仕様変更に伴うものだけ直し、一覧を報告する」(`memory-recall-wave-plan.md:78`)。
- 並列のドメインどうしの接点は、関数の形まで計画に書く(`voice-swap-wave-plan.md:110-115`「D と E の接点」・`:121`「ファイルは重ねない」)。

### 1.3 受け入れ基準の書き方

- 直近の型には「受け入れ基準」という節が無い。代わりに:
  - ドメインの本文の中に「テストは偽物で固定する」「本物の API は叩かない」「実機確認は短く」と書く(`memory-recall-wave-plan.md:38`、`:53`、`voice-swap-wave-plan.md:108`)。
  - 申し送りの一覧を「次の wave の完了条件に含める」と書いて、受け入れ基準の役をさせる(`memory-recall-wave-plan.md:55`、`:80`)。
  - 機械ゲートは Status の行に結果として書く: 「機械ゲート PASS(soul 1596/1596・soul-zone)」(`memory-recall-wave-plan.md:3`)、`voice-swap-wave-plan.md:3` は runtime-player の件数も並べる。
- 前の型は明示する: 機械ゲート(全緑・ベースライン件数・実 LLM 消費ゼロ・依存/lockfile 不変・ワイヤは足すだけ)と、blocking レビュー基準 6 項目(`stream-memory-wave-plan.md:34`、`:64-71`)。

### 1.4 人間ゲートの書き方

- 最後の wave のあとに 1 回。番号付きで 4〜6 項目。各項目は「ユーザーが何をすると、何が見える/起きる」の形(`memory-recall-wave-plan.md:120-127`、`voice-swap-wave-plan.md:132-140`、`local-stt-wave-plan.md:47-55`)。
- 1 項目目に無退行を置く例がある(`voice-swap-wave-plan.md:134`「AivisSpeech のまま、今と同じに聞こえて口も動く」)。
- 結果は `waves/<題>/human-gate.md` に残し(冒頭に Status と準備)、計画の Status 行と `_map.md` の Status 欄を「完了・人間ゲート合格(日付)」に書き換える(`waves/memory-recall/human-gate.md:1-10`、`_map.md:53`、`:55`)。部分合格は部分のまま書く(`_map.md:55`「思い出す流れは人間ゲート合格」)。

### 1.5 モデル配分

| 計画 | 構造 | Orch | Gnome | レビュー |
|---|---|---|---|---|
| memory-recall(2026-10) | Gnome → Undine 直接。wave 末に Sylph の軽い突き合わせ 1 回 | 無し | opus | sonnet(1 レーン)(`memory-recall-wave-plan.md:115-118`) |
| voice-swap(2026-10) | 同上(ユーザー 2026-10-18「これまで Gnome 単独でやっていたくらい」) | 無し | opus | sonnet(1 レーン)(`voice-swap-wave-plan.md:4`、`:128-131`) |
| local-stt(2026-10) | 1 ドメイン Gnome + 軽い突き合わせ 1 回 | 無し | 記載なし | 記載なし(`local-stt-wave-plan.md:5`) |
| stream-memory(2026-07) | 単一 Orch-Sylph が A→B 順次。各ドメイン Review-Sylph 3 レーン | opus | sonnet | sonnet × 3(`stream-memory-wave-plan.md:5`) |
| reading-interjection・verbosity-vocab(2026-07) | 同上 | opus | sonnet | sonnet × 3(`reading-interjection-wave-plan.md:5`、`verbosity-vocab-wave-plan.md:52`) |

- `.claude/agents/Gnome.md`・`Sylph.md` の frontmatter に `model` は無い。SKILL の規則 7 は「`model` は必ず明示」(`.claude/skills/implementation-orchestration/SKILL.md:146-148`)。
- SKILL の本来の形は Undine → Orch-Sylph → Gnome / Review-Sylph(`SKILL.md:28-53`)。2026-10 の 3 本はこれを使わず、Gnome の報告が Undine に直接返っている(`waves/memory-recall/domain-a-report.md:3`「Gnome → Undine」)。

### 1.6 ブランチと worktree

- ブランチ: 話題ごとに `ai-cohost/<題>` を切り、master へ merge commit で戻す(`git log --merges`: `4c0b9ea4 Merge branch 'ai-cohost/memory-recall'`、`8450062a … 'ai-cohost/local-stt'`、`8e0c1d6a … 'ai-cohost/discord-receive-probe'`)。
- コミットの粒度(memory-recall のブランチ): 計画の文書 1 つ(`9f4dbf36 docs(ai-cohost): plan the memory rebuild…`)→ wave ごとに feat 1 つ(`344198c5` W1、`f0a8828e` W2、`9d0dfbdd` W3)。voice-swap は Status にコミットの hash を書く(`voice-swap-wave-plan.md:3`)。
- Gnome はコミットしない。報告の冒頭に「コミットはしていない」と書く(`waves/memory-recall/domain-c-report.md:3`、`waves/local-stt/domain-l-report.md:4`「ブランチ ai-cohost/local-stt(c5f838a8 の上)。コミットはしていない」)。コミットしているのが誰かは文書に無い【推測: Undine】。
- worktree: `git worktree list` は本体 1 つだけ。並列のドメインも 1 つの作業ツリーを共有してきた。Agent の `isolation: "worktree"` を使った前例は見当たらない。2026-08 の英語の計画には「共有の汚れた作業ツリー。自分の担当の hunk だけ触る・stage/commit しない」を全委任文に入れる決まりがある(`model-identity-wave-plan.md:329-331`、`cockpit-settings-modal-wave-plan.md:256`)。
- 同じファイルを触るドメインは、並列にせず順にした前例がある: 「D は … C とは cockpit.mjs と cockpit-server.mjs を共有する。そのため C の後に順に行う」(`memory-recall-wave-plan.md:113`)。並列にするときは「ファイルは重ねない」と書いた(`voice-swap-wave-plan.md:121`)。

### 1.7 報告とレビューの置き場

| 物 | 置き場 | 例 |
|---|---|---|
| ドメインの完了報告(Gnome) | `implementation/waves/<題>/domain-<記号>-report.md` | `waves/memory-recall/domain-a-report.md` 〜 `domain-d-report.md` |
| 仕上げ(突き合わせのあとの直し) | `waves/<題>/wave-<N>-fixes-report.md` | `waves/memory-recall/wave-2-fixes-report.md` |
| 人間ゲート | `waves/<題>/human-gate.md` | `waves/memory-recall/human-gate.md` |
| 突き合わせ(Sylph) | `implementation/reviews/<題>/wave-<N>.md`(1 ドメインなら `review.md`) | `reviews/memory-recall/wave-1.md`、`reviews/local-stt/review.md` |

- 報告の冒頭: 「Gnome → Undine(日付)。計画: [リンク] §N Domain X。コミットはしていない。」+ 実データに触れたかどうか(`waves/memory-recall/domain-c-report.md:3-4`)。本文は §1 変更ファイルの表(ファイル | 中身)から始まり、最後に「質問」(`domain-b-report.md:84`)。
- 突き合わせの冒頭: 「Review-Sylph(1 レーン・軽め)→ Undine。対象: 未コミットの作業ツリー(直前のコミット …)。基準: …。コードは変更していない。」→ `## 判定` → `## テスト`(`node --test` の件数と `pnpm run check:soul-zone`)→ 見る点ごとの結果 → 差異(要修正)→ 注記(`reviews/memory-recall/wave-2.md:1-30`、`wave-3.md:1-7`)。
- `_map.md` の行は「Path | Status | Content」。Content に wave の並びを `∥` と `→` で書く(`_map.md:53`、`:55`)。

## 2. 設計の各部分が触るファイル

地図 §2〜§5、ロールの棚卸し §1〜§5 で行まで出ている所は、ここでは「どの部分の何に当たるか」だけを書く。新しく確かめた所は行を足した。

### 2.1 設計 §2.1・§2.2 ロール(名前・手がかり・指示・モデル・声・口数・話し始め)

| ファイル | 塊(行) | 何に当たるか |
|---|---|---|
| (新規)ロールの読み書き【推測: `src/roles/` などの新モジュール】と `roles/<id>/role.json`・`instructions.md` | — | 置き場。`roles/` はまだどの `.gitignore` にも入っていない(`git check-ignore roles/chappy/role.json` が該当なし)。`.gitignore` は `apps/soul/agent/.gitignore` に単体で並べる流儀(`:30`、`:41`、`:55`、`:58`) |
| `src/mind/model-identity.mjs` | id の型 `:13`、表 `:52-70`、既定 `:74`、`resolveModelIdentity` `:83-88` | 名前と名前の手がかり。id が cody / chappy の 2 値に固定(ロールの棚卸し §3.2・§3.4-2) |
| `src/mind/brains.mjs` | 各行の `identity` `:56-107`、`resolveBrainIdentity` `:124-127` | 頭に名前が付いている結び目(ロールの棚卸し §3.4-1) |
| `src/mind/fire-orchestrator.mjs` | 既定の本文 `:205-207`、`CONVERSATION_INSTRUCTION_BRAIN_IDS` `:230-237`、`resolveConversationInstructionProfile` `:255-269`、`buildFireSystemPrompt` `:280-288` | 性格の指示・名前の一文 |
| `src/mind/speak-now.mjs` / `comment-react.mjs` | 性格の 1 文 `speak-now.mjs:86-100`、`getVerbosity`/`getName` の受け口 `:195`、`:218`、`comment-react.mjs:189`、`:212` | 口数と名前の出どころ(設計 §5)。中身は変えず、渡す値の出どころだけ |
| `scripts/cockpit.mjs`(上の部品) | `parseCockpitArgs` の `--speaker` `:136`、`:147`。会話指示の hook `:414-460`。口数 `:764-807`。頭の選択 `:808-838`。声の方式 `:904-935`。声の engine の持ち主 `:957-1132`(使い回しの条件 `prepare` `:1031-1036`)。話し始め `:1185-1225` | 設定から引いている値をロールから引く口 |
| `scripts/cockpit.mjs`(`main()`) | 設定の hook の生成 `:1548-1577`。声の engine の deps `:1594-1602`(`speaker: args.speaker` `:1596`、`:1599`、`:1601`)。`currentBrain`・名前の唯一の引き口 `:1615`、`:1624`。頭のセッションの生成 `:1715-1775`(env ガード `:1741`、指示 `:1752-1755`)。`productionSpeakDeps` `:1880-1883`。受理の設定 `:1900-1917`。頭の変更 `onSetBrain` `:1939-1954`。サーバへの口 `:2136-2250`(名前 `:2144`、Start での stt/tts 保存 `:2193-2205`) | 頭の選択 → ロールの選択 |
| `src/cockpit/cockpit-server.mjs` | 口の取り込み `:672-681`(口数 `:672-673`、名前・会話指示 `:679-681`)、話し始め `:740-741`。snapshot の identity `:919-942`(正規化 `:927-929`)。Start の声の確かめ `:1242-1261`・engine の用意 `:1296-1316`。whisper の手がかり `:1325-1330`。会話指示の応答 `:1508-1553`・API `:1575-1635`(照合 `:1588`)。`/api/verbosity` `:1823-1849`、`/api/speak-start` `:1850-1874`、`/api/brain` `:1933-1967`(受理値 `:1948-1955`)。発火の予定の名前の揺れ `:2359-2370`、口数の初期値 `:2354`。`applySpeakStartMode`・`currentSoulName` `:2647-2660` | 同上(サーバ側) |
| `src/cockpit/cockpit-settings-store.mjs` | 会話指示 `:214-243`、口数・頭・声・話し始め `:298-330`、ローカル文字起こし `:377-386` | ロールへ移したあとも古いキーは残す(設計 §2.4)。読むのはロールのほうだけ |
| `src/ears/local-stt/local-stt-engines.mjs` | hotwords の既定 `:71`、正規化 `:117-134` | 名前の手がかりの hotwords(設計 §2.1 の表) |
| 画面(§2 で最小限) | `view-logic/conversation-instruction.mjs:14-35`(頭の id の直書き)、`view-logic/health.mjs:183-198`(`BRAIN_LABELS`)、`ui/settings-drawer.mjs:106`(`BRAIN_OPTIONS`)・`:388-399`・`:546-556`・`:964-1006`(頭脳の select と会話指示の入口)、`ui/conversation-instruction-editor.mjs:12-30`、`ui/header.mjs:36-38`(**表示名の許可リスト `IDENTITY_PAIRS` が cody / chappy の 2 組に固定**。外れると中立の題に倒れる `:43-51`) | 頭脳タブの中でロールを選ぶ |
| テスト | `src/mind/model-identity.test.mjs`(4 件)、`brains.test.mjs`(5)、`fire-orchestrator.test.mjs`(109)、`scripts/cockpit.test.mjs`(口数 `:1181-`・頭 `:1238-`・頭の配線の模写ハーネス `:1358-1464`)、`cockpit-server.test.mjs`(会話指示の偽物 `:203`・`/api/brain` `:2649-2816`・名前の取り口 `:2817-2870` 付近)、`cockpit-settings-store.test.mjs`(55)、`view-logic/conversation-instruction.test.mjs`(13)、`cockpit-ui.test.mjs:725`(6 つの頭の選択肢)・`:915`(頭脳区画の 6 選択肢) | 期待値が変わる |

### 2.2 設計 §2.3 記憶をロールごとに

- 置き場の決め方と使い手は、ロールの棚卸し §1.1・§1.6 の表のとおり。触るのは `src/memory/memory-store.mjs:40`(既定の置き場)、`scripts/cockpit.mjs:1630`(準備)、`:1635`(本体のファイル名)、`:1986`(②の `dir`)、`:2037`(④の `dir`)、`src/mind/memory.mjs:309`(既定の `dir`)。
- 種の名前の差し替え: `prepareMemoryFolder` はもう `seedPath` を受け取る(`src/memory/memory-store.mjs:152-157`、`:188-198`)。種の中の「チャッピー」は `src/memory/conventions-seed.md:3`、`:37`、`:49`(ロールの棚卸し §1.3)。「差し替えた種」を渡す口(本文を渡すか、一時ファイルか)は今は無い。
- テスト: `memory-store.test.mjs:45-46` が `DEFAULT_MEMORY_DIR` の形を固定。ほかは一時フォルダを注入(§4)。
- 今の `memories/` には `.git` がある(memory-recall の Domain B が 2 回コミットした: `waves/memory-recall/domain-b-report.md:3`、`:44-48`。人間ゲートの記録に「別の git。移し替え済み」`waves/memory-recall/human-gate.md:10`)。

### 2.3 設計 §2.4 起動時の引っ越し

- 起動時に自動で何かを移すコードの前例は無い。前の移し替え(8 件)は Gnome が手作業で行い、記憶の git に 2 回コミットした(`waves/memory-recall/domain-b-report.md:44-48`)。
- 読む元: 設定ファイル(`cockpit-settings-store.mjs:116` `DEFAULT_SETTINGS_PATH`、`createFileSettingsStore({ path })` で差し替え可 `:167-168`)。会話指示の上書きは `getConversationInstructionOverrides()`(`cockpit-settings-store.test.mjs:156` で使用)。古い直下の形も読める(`:214-230`、テスト `:142-156`)。
- 写しの置き場の候補(事実): リポジトリ根の `.gitignore:19 tmp/` が `apps/soul/agent/tmp/` も無視している(`git check-ignore -v` で確認。今は `tmp/discord-receive` がある)。`cockpit-settings.local.json.bak*` は `apps/soul/agent/.gitignore:58` で無視(手元に `cockpit-settings.local.json.bak-20261027` がある)。`memories/` 自体も `:41` で無視。新しい名前のフォルダは、どれにも当たらなければ `.gitignore` への追記が要る。
- `main()` は `createFileSettingsStore()` を引数なしで作る(`scripts/cockpit.mjs:1549`)。`main()` は export されていない(`:1533`、直接起動の判定 `:2353`)。→ 引っ越しを `main()` に直接書くと、置き場を注入したテストができない【推測: 置き場を引数に取る関数に分ける形になる】。
- 【推測】`memories/` の中身を `memories/chappy/` へ移すには、自分の子へ親を rename できないので、子を 1 つずつ移す形になる。`.git` を含む。Windows では開いているファイルがあると rename が失敗しうる。確かめていない。

### 2.4 設計 §4 体なしで声を出す

止まる所と差し替えの候補は地図 §4.1・§4.2 の表(番号 1〜14)。設計は候補 2(運び手の「器は任意」)を採った。

| ファイル | 塊(行) | 何に当たるか |
|---|---|---|
| `src/voice/speech-streamer.mjs`(876 行) | 口の t=0 の約束 `:27`、`:477`。channel の確かめ `:105-107`。既定の `releaseMouth` `:125-130`。`flush` の `appendSpeech` `:391-406`。終わりの `endSpeech` `:437`。`activate` の `openSpeech` → `player.open` `:447-483`。一括の `speakOnce` `:781-847` | 器を飛ばして手元の再生器だけで鳴らす |
| `src/mind/fire-orchestrator.mjs` | 受理の設定 `:586`、`acquireResources` `:601-616`。`releaseMouth`(割り込み・キル)`:633-667`。`streamReleaseMouth` `:686-693`。運び手へ channel を渡す `:840-852`、`:1128-1140`。`applyExpressions` `:928-960`(呼び出し `:1094`、`:1116`) | 体が無いときの診断を黙らせる・表情タグを捨てる |
| `src/mind/soul-skills.mjs` | `listSoulSkills`(`:52`)・`loadSoulSkills`(`:82`)は `options.names` を受け取れる(既定 `SOUL_SKILL_NAMES` `:29` = expression / screen / recall) | 体が無いとき `expression` を外す。呼んでいるのは `scripts/cockpit.mjs:1752-1755` |
| `scripts/cockpit.mjs` | `createLazyChannel` の URL の断り `:207-216`。`createSessionProxy` の URL の確かめ `:373-375`。器の生成 `:1700-1706`。`applyDesiredFireSettings` の URL の差し替え `:1810-1844`。`acquireAcceptedFireResources` の URL の確かめ `:1886-1888`・`channelUrl` などの metadata `:1900-1917`。発火の工場へ channel `:2094` 付近。器の状態 `:2107-2129`。案内の文 `:2257-2272` | 器の URL の確かめを「ロールに体があるときだけ」にする |
| 遅延の記録 | `src/mind/fire-latency.mjs:21-22`(声の区間に器の往復が入るという説明)。`src/mind/session-usage-log.mjs:104-131`(`replyLatencyUsageRecord`)。札を足す所 `src/cockpit/cockpit-server.mjs:2241-2248`。書く所 `scripts/cockpit.mjs:2245-2249` | 「体なし」の印 |
| 画面 | `src/cockpit/view-logic/status.mjs:80-92`(`channelStatusView`)。`ui/settings-drawer.mjs:835-851`(器の URL 欄) | 体なしの表示。器の欄を体があるときだけ出す(設計 §6) |
| テスト | `speech-streamer.test.mjs`(577 行・21 件)、`fire-orchestrator.test.mjs`(4133 行・109 件)、`scripts/cockpit.test.mjs` の `createLazyChannel`(`:116-441`)・`createSessionProxy`(`:443-600`)、`fire-diagnostics.test.mjs:16`(`createLazyChannel` を import)、`fire-latency.test.mjs`、`session-usage-log.test.mjs`(7 件)、`view-logic/status.test.mjs` | URL が無ければ断る、を固定している既存テスト(`cockpit.test.mjs:240-251`、`:443-457`)は期待値が変わる |

### 2.5 設計 §3 場(配信を始める / 終える)

今の始まりと終わりの散らばりは地図 §3.1〜§3.4 の表。ここでは新しく確かめたことだけ足す。

| ファイル | 塊(行) | 何に当たるか |
|---|---|---|
| `src/cockpit/cockpit-server.mjs` | 閉包の状態(`killed` `:822`、判定・係の入れ物 `:830-845`)。耳の寿命 `startEars` `:1195-1468`・`stopEars` `:1471-1506`。`/api/ears/start` `:1658-1683`(`transitioning` で同時の操作を 409)・`/api/ears/stop` `:1684-1697`。`/api/kill` `:1902-1932`。`/api/chat/connect` `:1984`。`/api/memory-record` `:2062`。発火の予定 `:2326-2381`、speak-now `:2383-2451`、コメント反応 `:2453-2509`、思い出しの係 `:2512-2563`。`applySpeakStartMode` の `reset` `:2647-2652`。YouTube の合流 `:2682-2952`(耳が止まっていれば積まない `:2725`)。`getTranscript` `:3107`。`close` `:3119-3197` | 始める / 終える の 1 本の関数、積み残しを捨てる、場の状態 |
| 積み残しを捨てる口(事実) | `speak-now.mjs` と `comment-react.mjs` は `reset()` を持つ(`speak-now.mjs:208`、`:354`、`comment-react.mjs:202`、`:386`)。**`fire-scheduler.mjs` と `recall-desk.mjs` は `reset` を持たず `dispose` だけ**(`fire-scheduler.mjs:435-448` の返り値の型、`recall-desk.mjs:91-98`)。`barge-in.mjs` も `dispose` だけ(`:200`) | 場の始まりで捨てるには、口を足すか作り直すか |
| `scripts/cockpit.mjs` | 記録の名前を起動時に 1 回決める `:1626-1646`(`:1635`)。頭の文脈の記録 `:1654-1687`(`createSessionUsageLog()` `:1656`)。声の用意 `:1777-1808`。記憶の保存と思い出し `:1975-2042`(20 分のタイマー `:2007`、手動 `:2015`、耳の Stop `:2021-2024`)。先に頭を作る `:2131-2134`。耳の hook `:2208-2220`。待ち受け `:2252-2273`。`shutdown` `:2278-2345`(SIGINT `:2346`) | 場ごとの記録・頭のセッションを場で作る・Ctrl+C の道 |
| `src/mind/memory.mjs` | `createStreamRecordIdentity` `:147-159` | 場ごとに作り直す |
| `src/mind/session-usage-log.mjs` | ファイルの単位 `:136-144` | 場ごとのファイル |
| 画面 | 配信前の大ボタン `ui/conversation.mjs:74-82`(「準備・設定を開く」)、その判定 `view-logic/glance-meters.mjs:184-186`(`isPreStream` = 耳が listening / starting でない)、結線 `ui/app.mjs:157`、`:302`、`:340`。マイクと Start / Stop は設定の入出力タブの中(`ui/settings-drawer.mjs:888-899`、`onStart` `:579-605`、Start の body に `sttEngine`・`ttsEngine` `:587`) | 「配信を始める」ボタン、場が開いている間のマイク・文字起こしの固定 |
| テスト | `cockpit-server.test.mjs`: Start / Stop `:412-560`、`close()` `:967`、`:1100`、`:2142`、キル `:2519-2620`、耳の Stop と保存 `:3205-3260`。`scripts/cockpit.test.mjs`: 耳の Stop → 保存の模写ハーネス `:1025-1085`、shutdown の模写ハーネス `:1124-1190`。`cockpit-page.test.mjs`、`view-logic/glance-meters.test.mjs` | 「同じ並びの最小ハーネス」で固定している所は、場の関数に合わせて書き直しになる【推測】 |

### 2.6 設計 §6 画面

| ファイル | 塊(行) | 何に当たるか |
|---|---|---|
| `src/cockpit/ui/settings-drawer.mjs`(1071 行・1 つのコンポーネント `CockpitSettingsModal` `:250-1067`) | タブの定義 `SETTINGS_CATEGORIES` `:138-145`(接続・入出力・頭脳・会話・記憶・運転・ログの 6 つ)。状態 `:268-310`(初期タブ `"connections"` `:310`)。一覧の取得 `:486-527`。復元の effect `:529-574`。ハンドラ `:576-800`。パネル: 接続 `:831-885`(器 `:835-851`・YouTube `:852-883`)、入出力 `:886-963`(マイク+Start/Stop `:888-899`・文字起こし `:900-912`・声 `:913-925`・声の出力先 `:929-946`・ゲームの窓 `:947-962`)、頭脳・会話 `:964-1044`(会話指示 `:965-982`・頭脳 `:984-1006`・圧縮 `:1007-1023`・fast `:1024-1042`)、記憶 `:1045-1056`、運転 `:1057-1060`(`driveSlot`)、ログ `:1061-1063` | 配信の準備 / ロール / 運転 / 記憶 / ログ に組み直す |
| select の初期値(事実) | マイクは保存した `lastDevice` を選ぶ(`:492`)。**ゲームの窓(`:504`)と声の出力先(`:516`)は `initialDeviceSelection(options, null)` で先頭を選ぶ**(保存値を見ていない)。器の URL 欄は空で始まり、Set のあと空に戻す(`:282`、`:631`「生 URL を残さない」)。YouTube は snapshot から戻す(`:529-544`)。頭・文字起こし・声は snapshot から戻す(`:552-574`)。選ぶ関数は `view-logic/settings.mjs:131-134` | 設計 §6「select は保存した値を選んだ状態で出す」 |
| `src/cockpit/ui/control-bar.mjs` | `VerbositySelect` `:140`、`SpeakStartSelect` `:161`、`CommentBusySelect` `:188`、`DrivePanel` `:213`(口数・話し始めの POST `:306-345`、並び `:382-383`) | 運転から口数・話し始めを外す。忙しい間のコメントは配信の準備へ |
| `src/cockpit/view-logic/glance-meters.mjs` | `driveSummaryView` `:201-208`(口数・話し始めを下の帯に出す) | 下の帯の運転設定はロールの値 |
| `src/cockpit/ui/header.mjs` | `IDENTITY_PAIRS` `:36-38`、`identityDisplayName` `:43-51`、`cockpitDocumentTitle` `:54-59` | 上の帯にロールの名前 |
| `src/cockpit/ui/app.mjs` | 名前の引き口 `:271`、`:315-317`、`:326`。設定の開閉 `:157`、`:302`。会話パネル `:340` | — |
| `src/cockpit/ui/conversation.mjs` | `:74-82` | 場が閉じているときのボタン |
| `src/cockpit/ui/bottom-bar.mjs` | 歯車「準備・設定」`:34-35` | — |
| テスト | `cockpit-ui.test.mjs`(1057 行・54 件)。**タブの数をソースの正規表現で固定**: `role="tabpanel"` がちょうど 6 つ(`:592-599`)、タブの id の並び(`:630`)。`settings-drawer.mjs` を文字列で読むテストが他に `:401`、`:428`、`:681`、`:1040`。`view-logic/settings.test.mjs`(23 件)、`view-logic/glance-meters.test.mjs`、`view-logic/control.test.mjs` | 期待値が変わる |

### 2.7 重なりの表(複数の部分が同じファイルを触る所)

「§2」= ロール・名前・指示・声・口数・話し始め、「§2.3」= 記憶、「§2.4」= 引っ越し、「§3」= 場、「§4」= 体なし、「§6」= 画面。

#### `scripts/cockpit.mjs`(2361 行)

| 塊(行) | §2 | §2.3 | §2.4 | §3 | §4 | §6 |
|---|---|---|---|---|---|---|
| `parseCockpitArgs` `--speaker` `:129-160` | ○ | | | | | |
| `createLazyChannel` `:179-351` | | | | | ○ | |
| `createSessionProxy` `:353-380` | | | | | ○ | |
| 設定の hook(会話指示・口数・頭・声・話し始め)`:414-460`、`:764-838`、`:904-935`、`:1185-1225` | ○ | | | | | |
| `createVoiceEngineManager` `:957-1132` | ○(声の id・話者で作り直す) | | | | | |
| `main()` 設定の生成 `:1548-1577` | ○ | | ○(起動時の引っ越しをここより前か直後に) | | | |
| 声の deps `:1594-1602` | ○ | | | | | |
| `currentBrain`・名前 `:1606-1624` | ○ | | | ○(場の間は固める) | | |
| 記憶の用意・記録の名前 `:1626-1646` | | ○ | ○ | ○(場ごとに作り直す) | | |
| 頭の文脈の記録 `:1654-1687` | | | | ○ | | |
| 器 `:1700-1706` | | | | | ○ | |
| 頭のセッションの生成 `:1715-1775` | ○(指示・モデル) | | | ○(場の始まりで作る) | ○(教えを外す `:1752-1755`) | |
| 声の出口 `:1777-1808` | | | | ○ | | |
| 次の発火の境目 `:1810-1844` | ○ | | | | ○ | |
| 発火の資源 `:1880-1919` | ○(`speaker`・設定の凍結) | | | | ○(URL の確かめ) | |
| 頭の変更 `:1939-1954` | ○ | | | ○(閉じている間だけ) | | |
| 記憶の保存・思い出し `:1975-2042` | | ○(`dir`) | | ○(タイマー・引き金) | | |
| 発火の工場 `:2044-2105` | | | | | ○ | |
| 器の URL・状態 `:2107-2129` | | | | | ○ | ○ |
| 先に頭を作る `:2131-2134` | | | | ○ | ○ | |
| `createCockpitServer({...})` `:2136-2250` | ○ | ○ | | ○ | ○ | ○ |
| 待ち受け・案内 `:2252-2273` | | | | ○ | ○ | |
| `shutdown` `:2275-2349` | | | | ○ | | |

#### `src/cockpit/cockpit-server.mjs`(3318 行・1 つの閉包)

| 塊(行) | §2 | §3 | §4 | §6 |
|---|---|---|---|---|
| 口の取り込み `:638-805` | ○ | ○(場の hook) | | ○ |
| 閉包の状態 `:806-903` | | ○ | | |
| snapshot `:904-1098`(identity `:919-942`) | ○ | ○(場の状態) | ○(体なし) | ○ |
| 耳の寿命 `:1187-1506`(声の確かめ `:1242-1316`・whisper の手がかり `:1325-1330`) | ○ | ○ | | |
| 会話指示 `:1508-1553`、`/api/conversation-instructions` `:1575-1635` | ○ | | | ○ |
| `/api/ears/start`・`stop` `:1658-1697` | ○(Start の body の tts) | ○ | | ○ |
| `/api/verbosity`・`/api/speak-start` `:1823-1874` | ○ | | | ○ |
| `/api/kill` `:1902-1932` | | ○ | | |
| `/api/brain` `:1933-1967` | ○ | ○ | | ○ |
| `/api/channel` `:1968`、`/api/chat/*` `:1984-2017`、`/api/memory-record` `:2062` | | ○ | ○(channel) | ○ |
| 発火の結線・遅延 `:2185-2305` | | | ○(印 `:2241-2248`) | |
| 発火の予定 `:2326-2381`(名前 `:2359-2370`) | ○ | ○ | | |
| speak-now・コメント反応 `:2383-2509` | ○(口数) | ○(reset) | | |
| 思い出しの係 `:2512-2563` | | ○ | | |
| 判定の小道具 `:2642-2680` | ○ | ○ | | |
| YouTube `:2682-2952` | | ○ | | |
| 寿命 `:2953-3198`(close `:3119-3197`) | | ○ | | |

#### そのほか

| ファイル | 触る部分と塊 |
|---|---|
| `src/mind/fire-orchestrator.mjs`(1981 行) | §2: `:205-288`(指示・名前)。§4: `:586-693`、`:840-852`、`:928-960`、`:1128-1140`。行は離れている |
| `src/voice/speech-streamer.mjs`(876 行) | §4 だけ |
| `src/cockpit/ui/settings-drawer.mjs`(1071 行) | §2: 頭脳タブ `:964-1006` と state `:299`、`:388-399`、`:546-556`。§3: Start / Stop `:888-899`・`onStart` `:579-605`。§4: 器の欄 `:835-851`。§6: 全体(タブ `:138-145`・全パネル `:831-1063`・初期値 `:486-574`) |
| `src/cockpit/ui/control-bar.mjs` | §2(口数・話し始めの値の出どころ)と §6(運転から外す) |
| `src/cockpit/ui/header.mjs` | §2(`IDENTITY_PAIRS` の 2 組固定)と §6(上の帯にロールの名前) |
| `src/cockpit/ui/app.mjs`・`conversation.mjs`・`view-logic/glance-meters.mjs` | §3(配信を始めるボタン・`isPreStream`)と §6(下の帯) |
| `src/mind/session-usage-log.mjs` | §3(ファイルの単位 `:136-144`)と §4(遅延の行 `:104-131`) |
| `src/mind/memory.mjs` | §2.3(`dir` `:309`)と §3(`createStreamRecordIdentity` `:147-159`) |
| `src/cockpit/cockpit-settings-store.mjs` | §2(新しいキーを足すなら)と §2.4(古いキーを読む) |
| `src/mind/model-identity.mjs`・`brains.mjs` | §2 だけ |
| `src/memory/memory-store.mjs` | §2.3 だけ |
| テストで重なるもの | `scripts/cockpit.test.mjs`(§2・§3・§4)、`cockpit-server.test.mjs`(§2・§3・§4・§6)、`cockpit-ui.test.mjs`(§2・§6)、`fire-orchestrator.test.mjs`(§2・§4) |

### 2.8 並列にしたときにぶつかるか(材料)

- 事実: 前例は 1 つの作業ツリーを共有し(§1.6)、同じファイルを共有するドメインは順にした(`memory-recall-wave-plan.md:113`)。
- 事実: `cockpit-server.mjs` の `createCockpitServer` は 638〜3198 行が 1 つの閉包で、§2・§3・§4・§6 のすべてが入る(地図 §2.2.2)。`scripts/cockpit.mjs` の `main()` も 1533〜2351 行の 1 つの閉包で、`createCockpitServer({...})` の引数の並び `:2136-2250` を §2・§2.3・§3・§4・§6 が触る。
- 事実: §4 の大部分(`speech-streamer.mjs`、`fire-orchestrator.mjs` の `:586-693`・`:840-960`・`:1128-1140`、`soul-skills.mjs`)は、§2 の塊(`fire-orchestrator.mjs:205-288`)と行が離れている。§4 で `scripts/cockpit.mjs` に入る所は `:179-380`(上の部品)と `:1700-1919`・`:2094`・`:2107-2134`。§2 も `:1715-1919` に入る。
- 事実: 設計 §8 の並べ方は 1 → 2 → (3 は 1 のあと)→ 4 → 5。
- 【推測】§2 と §4 を同時に動かすと、`scripts/cockpit.mjs` の `ensureFireResources`(`:1715-1775`)と `acquireAcceptedFireResources`(`:1880-1919`)、`cockpit-server.mjs` の Start(`:1242-1316`)で同じ関数の中に手が入る。§4 のうち運び手と発火の胴体(`speech-streamer.mjs`・`fire-orchestrator.mjs` の §4 の塊)だけを先に分ければ、ファイルの上ではほぼ重ならない。
- 【推測】§3 と §6 はどちらも `settings-drawer.mjs` の Start / Stop・マイクの欄と、`app.mjs`・`conversation.mjs` のボタンに入る。

## 3. テストの土台

- 走らせ方: `apps/soul/agent` で `node --test`(`package.json` の `"test": "node --test"`)。リポジトリの根で `pnpm run check:soul-zone`(`package.json:18`、特区の import の向きだけを見る `scripts/check-soul-zone-boundary.mjs:4-15`)。前例の突き合わせはこの 2 つを必ず回している(`reviews/memory-recall/wave-2.md` §テスト)。
- 件数(2026-10-31 に実行): **1713 件 pass / 0 fail / 0 skipped、約 62 秒**。推移: memory-recall 1596 → local-stt 1648 → latency-fix 1668 → 今 1713。
- テストのファイル: 約 95 本、37,501 行。大きいのは `cockpit-server.test.mjs`(6006 行・トップレベルの test 205 件)、`fire-orchestrator.test.mjs`(4133 行・109 件)、`scripts/cockpit.test.mjs`(2672 行・124 件)、`fire-scheduler.test.mjs`(1458 行)、`codex-session.test.mjs`(1407 行)、`cockpit-settings-store.test.mjs`(1068 行・55 件)、`cockpit-ui.test.mjs`(1057 行・54 件)。
- **操縦席の画面のテスト**(DOM での描画はしない。依存も足さない):
  - `view-logic/*.test.mjs`: 純関数の表示の文言・状態(settings 23 件、conversation-instruction 13 件、glance-meters、glance-timeline、health、control など)。
  - `cockpit-ui.test.mjs`: (1) `ui/*.mjs` を Node で import できること(トップレベルの副作用ゼロ)。(2) `ui/*.mjs` の import が `../vendor/`・`../view-logic/`・`./` に閉じていること。(3) `rows.mjs` の fixture。(4) hooks を使わない部品の vnode を走査(`:8-17`)。hooks を使う `SettingsDrawer` 本体は描画せず、**ソースを文字列で読んで正規表現で確かめる**(`:401`、`:428`、`:592-599`、`:681`、`:1040`)。キーボードの移動はタブの偽物の配列で確かめる(`:630-660`)。
  - `cockpit-ui-comment.test.mjs`・`cockpit-ui-glance.test.mjs`・`cockpit-ui-recall.test.mjs`・`cockpit-ui-speak-now.test.mjs`: 機能ごとの画面のテスト。
  - `cockpit-page.test.mjs`: 本物のサーバで `GET /` と UI の静的配信が 200 になること(見た目は人間ゲート、`:9-20`)。
  - サーバの API は `cockpit-server.test.mjs` が本物の HTTP / SSE で叩く(`httpRequest`・`postJson`・`openSseClient` `:29-140`、偽の耳 `makeFakePipeline` `:151`、偽の発火 `makeFakeOrchestrator` `:991`、偽の頭の結線 `makeFakeBrainWiring` `:2635`、設定はメモリの `createInMemorySettingsStore`(`cockpit-server.mjs:329-342`))。
- **`cockpit.mjs` の `main()` を通すテストは無い。** `main()` は export されず(`scripts/cockpit.mjs:1533`)、ファイルを import しても直接起動の判定(`:2353-2354`)で走らない。代わりに:
  - 上の部品(export されている hook・`createLazyChannel`・`createSessionProxy`・`createMemoryRecorder` など)を個別にテスト。
  - `main()` の並びを写した「模写ハーネス」: 耳の Stop → 保存(`scripts/cockpit.test.mjs:1025-1085`)、shutdown(`:1124-1190`)、頭の配線(`:1358-1464`)。
  - `main()` のソースを文字列で読んで正規表現で確かめるテストが 3 本(`:2104-2110`、`:2154-2168`、`:2170-` 付近。圧縮・fast・書き出し役の結線)。
  - ほかに `no-sherpa-in-parent.test.mjs:21`、`:78` が `scripts/cockpit.mjs` の import の木を読む。

## 4. 引っ越しのテストに使える既存の型

- **一時フォルダで本物の git を動かす**: `src/memory/memory-store.test.mjs`(16 件)。`mkdtempSync(join(tmpdir(), "memory-store-test-"))`(`:27-29`)、`t.after(() => rmSync(root, { recursive: true, force: true }))`、git は `pinnedGitArgs(dir, args)` で親のリポジトリを触らないように読む(`:31-43`)。入れ子のパス(`join(root, "nested", "memories")`)を作らせて結果の形を `deepEqual` で確かめる(`:56-74`)。冪等(`:76-`)。
- **②の本物の git の通し**: `src/mind/memory.test.mjs:543-` で `prepareMemoryFolder({ dir: path.join(root, "memories") })` → 偽物の②が書く → コミットが 1 つ積まれる、を確かめる。
- **パスだけ渡して FS を使わない**: `src/mind/recall.test.mjs:29`(`const DIR = "C:/tmp/memories-test"`、偽物の `create`)。
- **設定ストア**: `src/cockpit/cockpit-settings-store.test.mjs`(55 件)。`mkdtempSync(join(tmpdir(), "cockpit-settings-test-"))`(`:13-15`)に JSON を書いて `createFileSettingsStore({ path })` で読む。往復(`:17-`)、壊れた・無いファイルは null(`:46-`)、既定の置き場の形(`:83`)、**古い形の会話指示(直下の地図)を読む**(`:142-156`)、壊れた値・壊れた JSON(`:172-198`)。引っ越しの「古い設定 → ロール 2 つ」の入力はこの書き方で作れる。
- **一時フォルダでファイルを置く・移す**: `scripts/fetch-local-stt-models.test.mjs`(`mkdtempSync` `:46`、`planLocalSttModelFetch({ modelsDir, existsImpl })` で存在の判定を注入 `:30-33`)。
- **メモリの設定**: `createInMemorySettingsStore`(`src/cockpit/cockpit-server.mjs:329-342`)。サーバのテストの既定。

## 5. 未確認のこと

- `memories/` の今の中身(`.git` の有無は記録から「ある」と読んだだけ・直下のフォルダ名・`.` / `_` で始まる物)。開いていない。
- `cockpit-settings.local.json` に今どのキーと会話指示の上書きが入っているか(引っ越しで「どの指示を使ったか」が変わる)。開いていない。
- Codex が `memories/<role>/` から上へ git の根を探すか(設計 §9)。
- `fire-scheduler.mjs` のタイマーが耳の Stop のあとも発火を頼むか(地図 §7)。`reset` が無いことだけ確かめた。
- `settings-drawer.mjs` のハンドラ(`:576-800`)の 1 つずつの中身は、Start・頭・器の分だけ読んだ。

## 6. 質問(呼び出し側へ)

1. 直近の 3 本は Orch-Sylph を置かず Gnome → Undine 直接・wave 末に軽い突き合わせ 1 回だった(§1.5)。この組み直しも同じ粒度か、SKILL の本来の形(Orch-Sylph + Review-Sylph)に戻すかは、文書からは決まらない。
2. 並列にするなら 1 つの作業ツリーの共有で行くか、`isolation: "worktree"` を使うか。worktree の前例は無い(§1.6)。
