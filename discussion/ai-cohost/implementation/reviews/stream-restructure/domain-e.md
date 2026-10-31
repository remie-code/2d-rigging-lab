# 配信の組み直し Domain E — 画面の組み直し レビュー(1 回目、Review-Sylph)

レビュー対象: 作業ツリーの未コミットの差分(基準 8eff48cf)と未追跡の 4 ファイル。根拠にしたもの: 計画 `stream-restructure-wave-plan.md`(Status・§1 Domain E・§4)、設計 `stream-restructure.md` §2・§3・§4・§6、体験 `stream-experience-sketch.md` 場面 5、A〜D の報告とレビューの持ち越し、差分・対象ファイル・テスト。読み取り専任でソースは書き換えていない。

## 判定

**pass**(止めた指摘 0)。Undine に上げる分岐もなし。

## 機械ゲート

| ゲート | 結果 |
|---|---|
| `apps/soul/agent` で `node --test` | 1867 tests / 1867 pass / 0 fail / 0 cancelled / 0 skipped(基準 1817 + 50。Gnome の報告と一致) |
| 根で `pnpm run check:soul-zone` | pass(1565 source files scanned) |
| 依存・lockfile | `git diff 8eff48cf --stat -- package.json pnpm-lock.yaml apps/soul/agent/package.json` が空。`git status` にも出ない |

守りの決まり(§4-4):
- 実データ: `apps/soul/agent/roles/` は存在しない。`cockpit-settings.local.json` の更新日時は 10-29 21:00、`memories/` 直下は 10-29 以前のまま(中身は開いていない)。新しいテスト 3 本は `mkdtempSync(tmpdir())` の一時フォルダと偽の耳・orchestrator だけで、実データのパス・本物の LLM・外部 API の呼び出しは grep で見当たらない。
- `conventions-seed.md`・`memory.mjs`・`recall.mjs`・`speak-now.mjs`・`comment-react.mjs`・`skills/` は無差分。`_conventions.md` は git 管理外で触れていない。
- 鍵・環境変数: 差分に鍵を読む・出す・env に入れる箇所は無い。

## 完了条件との突き合わせ

### 1. 画面(設計 §6)— 適合

- タブ 5 つ「配信の準備 / ロール / 運転 / 記憶 / ログ」: `ui/settings-drawer.mjs` の `SETTINGS_CATEGORIES`、開くと配信の準備(`useState("prepare")`)。`cockpit-ui.test.mjs`「Cockpit Settings modal shell: …five internal tabs…」。
- 配信の準備: 毎回見るもの(YouTube の URL・ゲームの窓・器の URL)とたたんだもの(`<details class="prepare-more">`、マイク・文字起こし・声の出力先・忙しい間のコメント)。器の URL は `channelFieldVisible`(`channel.body` / `role.body` が false なら欄を出さず「体なし」とひとこと)。`cockpit-ui-settings.test.mjs`「配信の準備: 毎回見るものと…たたんだものの並び」。
- select は保存した値を選んだ状態: `savedDeviceSelection`(ゲームの窓は `visionTarget.title`、声の出力先は `audioDevice.name`。一覧か保存値が届くたびに、選び直していなければ保存値へ。Refresh / Set のあとも揃え直す)。マイクは従来どおり `lastDevice`。ソースを読んで effect の依存と編集済みの印の扱いに破綻は無い。
- 場の間はマイク・文字起こしだけ `disabled`(`streamLocksInputs`、開きかけ・閉じかけも含む)。YouTube・Connect・ゲームの窓は固めない。サーバの 409 は D から有効。`cockpit-stream`「設定のダイアログの「配信を始める」は…」・`cockpit-ui-settings`「配信の準備: 場が開いている間はマイク・文字起こしだけ触れない」。
- ロール: 選択(`role-select` と Set は場が閉じている間だけ・サーバも 409)、編集(名前 3 項目・モデル・性格の指示(同じタブ内のページ)・声の方式 / 話者 / 声の id・口数・話し始め・体)、新しいロール(今のロールを写し、モデル・声・口数・話し始め・体・性格の指示の上書きを写す。作ると今のロールになる)。下書きは `view-logic/role.mjs`、保存は `POST /api/role/edit`。
- 運転: 自発・かぶり・手動の発火だけ。口数・話し始めの行と POST を `DrivePanel` から外した(`cockpit-ui-speak-now` の書き換えが「運転のタブに無い」を直接見ている)。
- 記憶: `memoryStatus` に `available`・`roleId`・`roleName`・`dir`、`memoryPlaceLabel`。「今日を記録」は `memoryRecordButtonView`(閉じている・開きかけ・閉じかけは disabled + 案内)。
- 上の帯のロール名: `roleIdentityOf`(role があればそれ、無い古いサーバは `brain.identity`)。下の帯: `driveSummaryView` の口数・話し始めが `role.verbosity` / `role.speakStartMode` から。
- 画面テストの固定(6 → 5 など)は仕様変更として直っている。

### 2. A からの持ち越し — 適合

- ロールの書き込み API: `POST /api/role/edit`・`POST /api/role/new`、フック `onUpdateRole` / `onCreateRole`、確かめは `applyRolePatch`(型違い・範囲外は既定へ倒さず断る)と `copyRoleAs`。`cockpit-server-domain-e`「POST /api/role/edit: …」×3・「POST /api/role/new: …」、`role-store.test`、`cockpit-role-edit`「createRoleHooks.edit / create」。
- 場の途中の 409: `/api/role/edit`・`/api/role/new` は `streamPhase !== "closed"`(開きかけ・閉じかけも)で 409。性格の指示の `PUT` / `DELETE /api/conversation-instructions/:roleId` も同じ条件で 409(読みは通る)。テスト「…場が閉じていない間(開いている・閉じかけ)は呼ばずに 409…」「PUT / DELETE …: 場の途中は 409(読むのは通る)・閉じたら書ける」。
- Windows の予約名: `isRoleId`(`model-identity.mjs`)が `con`・`prn`・`aux`・`nul`・`com0〜9`・`lpt0〜9` を大文字小文字を問わず拒む。`roleDir`・`readRole`・`listRoles`・`writeRole`・`memoryDirForRole`・`normalizeModelIdentity`・`POST /api/role/new` が全部 `isRoleId` 経由。`memory-store.test`「memoryDirForRole: Windows の予約名…」・`role-store.test`・`model-identity.test`。
- 古い "brain" の種類: `settingsModalEventRoute` から消えた(`cockpit-ui.test`「…旧「頭脳」の種類は消した」)。CSS の使われない分(`.conversation-instruction-selection*`・`.drawer-close`・`.btn-stop` など)も削除、`cockpit-ui-settings`「使われなくなった CSS…」。
- `ui/header.mjs` の id の重複: `view-logic/role.mjs` の `ROLE_ID_PATTERN` / `WINDOWS_RESERVED_NAMES` / `isRoleIdShape` の 1 か所に寄せ、魂側と同じ入力の組で一致することをテストで固定(ui は mind を import できない制約下で妥当)。

### 3. B からの持ち越し — 適合

- 記憶タブ: `place()` そのものではなく `placeInfo()`(同じ決め方・`memoryDirForRole`・置き場を作らない)。D が `place()` に準備の副作用を寄せたため、表示のたびに git init が走らない形にしたのは筋が通る(裁量として評価)。
- 記憶の引っ越しの失敗の上の帯の警告: `startupMigrationWarnings` → サーバの `startupWarnings` → `warningBoard.setCondition`(起動の間ずっと出す)。`cockpit-role-edit`「startupMigrationWarnings: …snapshot の warnings に出る」。ロールの分の失敗も同様に足した(Undine の追認の範囲の自然な拡張)。

### 4. C からの持ち越し — 適合

- 器の URL の出し分け・`.channel-status.bodyless`(`var(--compacting)`)は上記のとおり。
- 体だけの編集で `roleHooks.current()` が新しい値を返す・編集 API が `sessionContextRevision` を上げる: `createRoleHooks.edit` が `current` を差し替え、`main()` の `onRoleEdited` が `sessionContextRevision += 1`。テスト `cockpit-role-edit`「createRoleHooks.edit: 体だけを編集すると…」・「POST /api/role/edit(本物の server・本物の createRoleHooks): 体だけを編集すると roleHooks.current() が新しい値を返し、編集の API が sessionContextRevision を上げる…」。

### 5. D からの持ち越し(Undine の追認)— 適合

- (1) YouTube の自動接続: `connectSavedChat` を廃し `keepPreconnectedChat()`(`chatClient != null` を返すだけ)。保存した前回の URL へは「配信を始める」でつなぎにいかず、場を開く前に Connect した器官だけがそのまま入る。前の場の器官は「配信を終える」の `foldChatClient()` で畳まれるので次の場に持ち込まれない。追認の読み(この起動で場を開く前に Connect したものだけ)と合う。テスト `cockpit-stream`「配信を始める: 保存してある前回の YouTube の URL だけではつなぎにいかない…」(保存 URL だけではつながない / 開いたあとの Connect はつながる / 終えたあと次の場に持ち込まない)・「…場を開く前に Connect 済みならそのまま(作り直さない)」。
- (4) 手動 Fire: サーバ `POST /api/fire`・`/api/vision-fire` が `streamPhase !== "open"` で 409(orchestrator に頼まない)、画面は `manualFireStreamView` → `FireButtons` の `streamBlocked`。テスト `cockpit-server-domain-e`「POST /api/fire・/api/vision-fire: 場が閉じている間は 409…」・`cockpit-ui-settings`「manualFireStreamView / fireNoteFromFireResponse / FireButtons」。
- (5) `openStream` / `closeStream` の固まり防止: `steps()` を `run` が try/catch し、`fail()` が `foldStream({ears:true, session:true})` を呼んで(それ自身が投げても)`closed` + `streamError` に戻す。`closeStream` は catch で畳み残しをもう一度畳み(best-effort)、どの道でも最後に `closed` に戻して 500 を返す。`fail` は `streamOpenedAtMs` も戻す。テスト `cockpit-server-domain-e`「配信を始める: 想定外の例外…」「配信を終える: 想定外の例外…」(どちらも「もう一度始められる」まで確認)。
- 「今日を記録」の見た目・始められなかった理由は中央が正: 設定のダイアログの「配信を始める」の下に同じ `stream.error`(`streamStartView`)を出し、旧「マイクの行の `start failed:`」は無くした。

### 6. 裁量の目安 — 適合

- メイン画面の中央・1 段目のつまみ(KILL・自発・かぶり)の置き場は変わっていない(`app.mjs` の差分は名前の引き方と `stream` の受け渡しだけ、`header.mjs` は ID 重複の解消と状態のピルの引数追加だけ)。

## 止めた指摘

なし。

## 「特に見てほしい点」への判定

1. **`/api/verbosity`・`/api/speak-start` の口が場の途中でも書ける件 → 止めない(持ち越し・仕上げ)。** 根拠: 体験の場面 5 の決定は「操縦席での上書きは作らない」、設計 §6 は「口数・話し始めはここ(運転)から外す」、計画 Domain E は「口数・話し始めは外す」。画面からの呼び出しは全部消え(`DrivePanel` から onChange と POST を削除、`doFetch("/api/speak-start"` が無いことを `cockpit-ui-speak-now` が固定)、ロールの編集は場の途中で固まり、サーバも `/api/role/edit` で 409 にしている。残っているのは画面から呼ばれない既存 API の口(HTTP を直接叩く以外に到達しない)で、設計 §2.1・§3 の「場の途中でロールを替えない」は「ロールの選択・編集」の話であり、この口を塞ぐ条項は設計にも scope §18〜§20 にも無い。§4 の止める根拠(設計への違反)にならない。なお、場の途中に書かれたときは scheduler の口数が即座に変わりロールに保存される点は記録しておく。仕上げで「`streamPhase !== "closed"` なら 409」にするのが小さくて安全(`cockpit-server.test` は場が閉じた状態で呼んでいる。`cockpit-stream.test` の 1010 行の `/api/verbosity` の呼び出しだけは場の状態を確認して直す)。口ごと消すか 409 かは Undine の判断で足りる。
2. **ロールの編集・作成 API と性格の指示の PUT/DELETE の 409 → 適合。** 上記 2 のとおり、いずれも `streamPhase !== "closed"` で 409(テストあり)。
3. **`keepPreconnectedChat` と追認 (1) → 合っている。** 保存 URL では場を開くときにつながない。場を開く前に Connect した器官だけ持ち込む。実装は `chatClient != null` を返すだけの関数で戻り値は捨てられている(下の持ち越し 4)。挙動は正しい。
4. **opening 中の例外 → 畳まれて closed に戻る。** `fail` が `foldStream({chat:false, ears:true, session:true})` を呼ぶ(`stopEars`・`closeSession`・`closeBody`)。`foldStream` は器を体の有無にかかわらず close する。畳むが投げても `closed` に戻す二重の守り。ただし、今ある 1 本目のテストが投げさせるのは発火の予定の工場関数(耳を起こす前)で、「耳を起こしたあとの例外で耳が畳まれる」ことを直接見るテストではない(`ears.record.created` は 1 のまま、`s.ears === "stopped"` は耳を起こす前でも成り立つ)。実装上、耳を起こしたあとに投げうる所は `runStreamHook`(例外を握る)と `keepPreconnectedChat`(投げない)だけなので実害は見えない。テストの緩さとして持ち越し 2 に記録。
   **closing 中の例外と記憶の最後の保存:** 例外が `foldStream` か転写の写しで起きると 3 の `saveFinal` を飛ばして catch へ入り、catch は畳み直すだけで保存はもう一度頼まない。結果、`closed` には戻るが、その場の最後の保存(記憶)は走らない。`saveFinal` 自身の失敗は `runStreamHook` が握るので catch に来ない。起きうるのは `foldStream` 内の想定外の throw(`stopEars` などはほぼ握っている)と転写の写しだけで、起きにくい。固まらないことが今回の約束であり、設計 §3「終える」の 3 の記憶の保存を例外時にも必ず頼む、とまでは書かれていないので止めない。持ち越し 3 に記録。
5. **期待値を変えた既存テスト 26 件 → すべて仕様変更によるもの。** 差分を読んで確かめた: `cockpit-server.test.mjs` の 13 件は手動 Fire の 409(D 追認 4)に伴い、`openStreamForFire` で場を開く 1 行と `pipelineFactory` の偽の耳を足しただけで、期待値は不変(「受理は 202」の `getBuffer()` が `null` → `notEqual(null)` に変わった 1 か所も、場が開いて耳が動いている結果)。`cockpit-stream.test.mjs` の 4 件は追認 (1) とダイアログの Stop 撤去・声の方式の撤去(設計 §6)。`cockpit-ui.test.mjs` の 7 件は 5 タブ化・旧 brain の種類の削除・頭の調整のタブ移動・声の方式の撤去(いずれも設計 §6 / A の持ち越し)。`cockpit-ui-speak-now`・`cockpit-ui-comment` の各 1 件は口数・話し始めと忙しい間のコメントの置き場移動(設計 §6)で、移った先の中身(`onRoleText("speakStartMode")`・`postJson("/api/comment-busy", { policy })`・たたんだものの中の並び)を見る形に書き換えており、弱めて通したものは見当たらない。無関係な assert の削除も見当たらない。
6. **守りの決まり → 違反なし**(上の機械ゲートの節)。

## 裁量の評価

Gnome の裁量 16 件のうち、評価を記録する。

- **5(名前を替えたときの名前の手がかりを新しい名前だけから作り直す)**: 妥当。写した元の名前で呼ばれたと取り違えない。チャッピーの今の手がかりは名前を替えない限り触らない。手がかりの編集欄は設計 §6 の編集の項目に無いので作らなくてよい。
- **4(新しいロールは作ったら選ぶ)**: 妥当。設計 §6「新しいロールは今のロールを写して作る」に反しない。編集が「今のロールだけ」なので、すぐ直せる形になる。
- **7(置き場の無い起動では編集・作成を断る)**: 妥当。`roles/` を作ると次の起動の引っ越しが走らなくなる、という D までの追認(手元だけの既定のロール)と整合している。
- **10(`placeInfo()`)**: 妥当(上記)。
- **2(設定のダイアログに「配信を始める」を残し、Stop は外す)**: マイク・文字起こしを選んで始める道として妥当。誤って押しにくい終えるは下の帯の 2 回押しだけになり、D の持ち越し(Stop が `micBusy` のまま待つ)も自然に消えた。質問 5 の別案は急がない。
- **1(頭の調整をロールのタブの下に置く)**: 妥当。値はロールでなく設定のまま、置き場だけの話。5 タブに置き場が無い中で、モデルを選ぶ所の近くという理屈は通る。
- **3(性格の指示の PUT/DELETE も場の途中は 409)**: 妥当で、設計 §2.1・§3 に沿う安全側。
- **8(手動 Fire の 409 は「開いている」以外すべて)**: 妥当。D 追認 4 の「場が閉じている間」より保守的(開きかけ・閉じかけも断る)だが、頭のセッションが場の始まりで作られる設計 §3 と整合する。
- **12(状態のピルに開きかけ・閉じかけ)・13(`bodyless` の色)・14(ロールの下書きは未保存でも閉じる確認なし)・15(保存値の揃え直し)**: 見た目の小さな補いで、設計に反しない。14 は未保存の編集を黙って捨てる危険がわずかにあるが、ダイアログを閉じても下書きは残る(常時 mount)ので実害は小さい。
- **16(`/api/verbosity`・`/api/speak-start` を残した)**: 上の判定のとおり、止めずに仕上げ。

## 持ち越し

### 仕上げへ

1. `/api/verbosity`・`/api/speak-start` を場の途中は 409 にするか口ごと消すか決める(上記、Gnome の質問 3)。
2. README の Start / Stop・`/api/ears/*`・`--channel`・`/api/brain` の記述に、`/api/role/edit`・`/api/role/new`・手動 Fire の 409・ダイアログの 5 タブを足す(A・D と合わせて)。
3. 古い JSDoc・コメントの「頭脳・会話」「入出力タブ」の言い方(`cockpit-server.mjs` 数か所・`cockpit-settings-store.mjs`・`ui/app.mjs`・`view-logic/settings.mjs`・`ui/styles.mjs` の 1 行)。`ttsEngineSelection` は画面から使われず、テストだけが使う。
4. `keepPreconnectedChat()` は戻り値を捨てる実質ノーオペの関数(中身は `chatClient != null`)。呼び出しをやめて追認の読みをコメントだけで残すか、戻り値を使うか(好みの範囲)。
5. 画面のテストの多くはソースの文字列の照合。リファクタに弱い。

### 全体の突き合わせへ

- ロールの編集 → `sessionContextRevision` → 「配信を始める」の `openStreamSession` が新しい名前・モデル・性格・声・体で作る、の通しを実機に近い形で。
- 声の方式の出どころ: 「配信を始める」の body から `ttsEngine` を外したので、声の方式はサーバの現況(ロールの選択・編集)だけ。`/api/ears/start` の body の `ttsEngine` は後方互換として残り、`onSetTtsEngine` が今のロールに書く(UI は使わない)。
- 新しいロールの記憶のフォルダは最初の「配信を始める」で準備される(種の名前は新しい呼び名)。
- `closeStream` が例外のとき、記憶の最後の保存を頼まない点(上記 4)。
- opening 中の例外のテストが「耳を起こしたあとの畳み」を直接見ていない点(同上)。

### 人間ゲートへ

- 設定のダイアログが「配信の準備 / ロール / 運転 / 記憶 / ログ」で、ゲームの窓・声の出力先に保存した値が選ばれている。たたんだもの(マイク・文字起こし・声の出力先・忙しい間のコメント)が普段は閉じている。
- 体を使わないロールに直すと配信の準備から器の URL の欄が消えて「体なし」が出る。体ありに戻すと出る。
- 前回の YouTube の URL が欄に戻っていても、「配信を始める」ではつながない(場を開いてから Connect で入る)。
- 場が閉じている間、運転のタブの Fire / Fire+視覚が押せない(AHK の Fire は 409)。
- ロールのタブで名前・モデル・声・口数・話し始め・体を直して保存 → 次の「配信を始める」から効く。配信中はロールのタブの入力が固まる。新しいロールを作ると今のロールになる。`con` などの id が断られる。
- 閉じかけの間、上の帯の状態のピルが「記録中」になる。
- 記憶の引っ越しに失敗した起動の警告が上の帯に出る(実機で再現しにくいので確認は任意)。

## Gnome の質問 1〜5 への意見

1. **名前の手がかり**: 今の形でよい。呼び名・ローマ字を替えたときだけ新しい名前から作り直し、編集欄は作らない(設計 §6 の編集項目に無い)。揺れを足したくなったら、そのときに足す。
2. **新しいロールは作ったら選ぶ**: 今の形でよい。写して作った直後に直す流れに合う。作るだけで選ばない形がよければ数行で替えられるが、急がない。
3. **`/api/verbosity`・`/api/speak-start`**: 場の途中は 409 にするのを勧める(口ごと消すと既存テストの書き換えが大きい)。ただし今回の合格条件ではなく仕上げで足りる。理由は判定の節のとおり。
4. **頭の調整の置き場**: ロールのタブの下のままでよい。置き場所の好みの範囲。
5. **ダイアログの「配信を始める」**: 今の形でよい。マイク・文字起こしを選んで始める道として自然で、メイン画面の始めるは前回の選択を使う。「選んだらすぐ保存」に替える案は、保存の口を足す作業の割に利益が小さい。

## 質問(Orch-Sylph / Undine へ)

1. 持ち越し 1(`/api/verbosity`・`/api/speak-start` の場の途中)を、全体の突き合わせの前に直すか、仕上げで直すか。直す形(409 か口ごと削除か)も合わせて決めてほしい。
2. `closeStream` の例外時に、写しを取れていれば最後の保存をもう一度頼む形にするか。今は固まらないことだけが約束なので、上げない場合はそのままでよい。
