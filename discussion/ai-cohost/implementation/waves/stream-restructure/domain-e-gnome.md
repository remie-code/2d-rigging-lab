# 配信の組み直し Domain E — 画面の組み直し 完了報告

Gnome → Orch-Sylph（2026-10-31）。計画 [stream-restructure-wave-plan.md](../../orchestration/stream-restructure-wave-plan.md) §1 Domain E・Status（A〜D の Undine の追認）、設計 [stream-restructure.md](../../../architecture/stream-restructure.md) §2・§3・§4・§6、体験 [stream-experience-sketch.md](../../../discord-vc/stream-experience-sketch.md) 場面 2・3・5、決めごと [scope.md](../../../discord-vc/scope.md) §18〜§20。ブランチ `ai-cohost/stream-restructure`（8eff48cf の上）。**コミットはしていない（stage もしていない）。**

実データには触れていない: `apps/soul/agent/cockpit-settings.local.json`（と `.bak*`）・`memories/`・`roles/`・`session-usage/`・`.env*.local` は開いていない・書いていない。操縦席は起動していない（`scripts/cockpit.mjs` はテストからの import とソースの文字列の照合だけ・`main()` は走らない）。ファイルを書くテストは `mkdtempSync(tmpdir())` の一時フォルダだけ。本物の LLM・外部 API は呼んでいない（偽の耳・orchestrator・判定・ロールの口と loopback の本物の cockpit-server）。作業後に `apps/soul/agent/roles/` が無いことを確かめた。②④の指示（`memory.mjs`・`recall.mjs`）・判定（`speak-now.mjs`・`comment-react.mjs`）・`conventions-seed.md`・`skills/` は差分なし（`git diff --quiet` / `git status` で確かめた）。

## 1. 機械ゲート

| ゲート | 結果 |
|---|---|
| `apps/soul/agent` で `node --test` | **1867 tests / 1867 pass / 0 fail / 0 cancelled / 0 skipped**（基準 1817 → **+50**） |
| 根で `pnpm run check:soul-zone` | pass（1565 source files scanned） |
| 依存・lockfile | `git diff --stat -- package.json pnpm-lock.yaml apps/soul/agent/package.json` が空（変更なし） |

増えた 50 件の内訳: `scripts/cockpit-role-edit.test.mjs` 13・`src/cockpit/cockpit-server-domain-e.test.mjs` 8・`src/cockpit/cockpit-ui-settings.test.mjs` 22・`src/roles/role-store.test.mjs` +5・`src/mind/model-identity.test.mjs` +1・`src/memory/memory-store.test.mjs` +1。

約束のテストが効くことは実装を一時的に壊して確かめた（戻して `git diff --stat` が元と一致することを確認）: 手動の発火の 409 を外す → `cockpit-server-domain-e`「POST /api/fire・/api/vision-fire: 場が閉じている間は 409…」が落ちる / 保存した URL へ始めるでつなぎにいく形に戻す → `cockpit-stream`「保存してある前回の YouTube の URL だけではつなぎにいかない…」が落ちる / openStream・closeStream の catch を外す → `cockpit-server-domain-e` の想定外の例外の 2 件が落ちる。

## 2. 作ったもの（対応表）

### 2.1 計画どおり（設計 §6）

| 約束 | どこをどう変えたか | テスト |
|---|---|---|
| タブを「配信の準備 / ロール / 運転 / 記憶 / ログ」の 5 つに | `ui/settings-drawer.mjs` の `SETTINGS_CATEGORIES`（id `prepare`/`role`/`drive`/`memory`/`log`）とパネル 5 つ。開くと配信の準備 | `cockpit-ui.test.mjs`「Cockpit Settings modal shell: … five internal tabs …」「keyboard/category seam」 |
| 配信の準備: 毎回見るもの（YouTube・ゲームの窓・**体があるときだけ**器の URL）と、たたんだもの（マイク・文字起こし・声の出力先・忙しい間のコメント） | 配信の準備のパネル。たたんだものは `<details class="prepare-more">`。器の URL は `channelFieldVisible(settings)`（`state.channel.body` か `state.role.body` が false なら出さず「体なし」の状態とひとことだけ） | `cockpit-ui-settings.test.mjs`「配信の準備: 毎回見るもの…とたたんだもの…の並び」・`channelFieldVisible` のテスト |
| select は保存した値を選んだ状態で出す（ゲームの窓・声の出力先） | `view-logic/settings.mjs` `savedDeviceSelection(options, saved, current, edited)`。一覧か保存した値（`visionTarget.title`・`audioDevice.name`）が届くたびに、選び直していなければ保存した値（無ければ先頭）へ。Set / Refresh のあとは保存した値に揃え直す。マイクは今までどおり `lastDevice` | 「savedDeviceSelection: …」「配信の準備: ゲームの窓・声の出力先の select は保存した値…」 |
| 場が開いている間はマイク・文字起こしは触れない。YouTube の URL とゲームの窓は触れる | `streamLocksInputs` でマイク・文字起こしだけ `disabled` + 案内 `STREAM_LOCKED_INPUTS_NOTE`。YouTube・Connect・ゲームの窓は固めない | 「配信の準備: 場が開いている間はマイク・文字起こしだけ触れない…」・`cockpit-stream`「設定のダイアログの「配信を始める」は…」 |
| 声の方式は配信の準備から外す（ロールの声へ） | 声の select（`tts-engine-select`）と `ttsEngine` の送り出しを外した。「配信を始める」の body は `{ device, sttEngine }`（声の方式はサーバの現況 = ロールの値） | `cockpit-ui.test.mjs`「声の方式は配信の準備から外れてロールの声になった…」 |
| ロール: 今日のロールの選択（場が閉じている間だけ） | ロールのパネルの `role-select` と Set を `disabled=${roleLocked}`（+ 案内）。サーバは今どおり 409 | 「ロール: 今日のロールの選択は場が閉じている間だけ…」・`cockpit-ui.test.mjs`「Settings modal「ロール」: 今日のロールの select…」 |
| ロールの編集（名前・モデル・性格の指示・声（方式・話者・声の id）・口数・話し始め・体） | ロールのパネルに見せる名前・呼び名・ローマ字・モデル・性格の指示（ボタン → 同じタブ内のページ）・声の方式・AivisSpeech の話者・ElevenLabs の声の id・口数（`VerbositySelect`）・話し始め（`SpeakStartSelect`）・体（チェック）・「ロールを保存」（`POST /api/role/edit`）。下書きは `view-logic/role.mjs` の `roleDraftFromStatus` / `roleDraftDirty` / `rolePatchFromDraft`。入力はどれも場の途中・置き場が無い起動では固まる | 「ロール: …ロールの編集（…）と新しいロール」「ロール: 保存は POST /api/role/edit…」「roleDraftFromStatus / roleDraftDirty / rolePatchFromDraft…」 |
| 新しいロールは今のロールを写して作る | 「新しいロール」の id・名前と「今のロールを写して作る」（`POST /api/role/new`）。入れ損ねは `newRoleIdError`（予約名を含む） | 同上・「newRoleIdError / …」 |
| 会話指示の編集をロールの編集の「性格の指示」に収める | `ConversationInstructionEditor` をロールのタブの中のページに（戻り先「← ロール」、見出し「性格の指示」、`locked` で場の途中は書けない）。旧 頭脳・会話のタブは無い | 「ロール: 今の会話指示の編集はロールの編集の「性格の指示」に収めた…」 |
| 運転: 自発・かぶり・手動の発火。口数・話し始めは外す | `ui/control-bar.mjs` の `DrivePanel` から口数・話し始め・忙しい間のコメントの行と POST を外した（部品はロールの編集・配信の準備が使う）。忙しい間のコメントは配信の準備のたたんだものへ | 「運転: 自発・かぶり・手動の発火だけ…」・`cockpit-ui-speak-now` / `cockpit-ui-comment` の書き換え（§4） |
| 記憶: そのロールの記憶（`place()` の roleId / dir） | `createRoleMemoryPlaces.placeInfo()`（`place()` と同じ決め方・置き場を作らない・準備を走らせない）→ `memoryStatus` に `available`・`roleId`・`roleName`・`dir` → `memoryPlaceLabel`（「チャッピー の記憶（…/memories/chappy）」、引っ越しの失敗の起動はその旨） | 「createRoleMemoryPlaces.placeInfo: …」「memoryPlaceLabel / memoryRecordButtonView…」「記憶: そのロールの記憶…」 |
| 「今日を記録」は場が開いている間だけ押せる見た目 | `memoryRecordButtonView(stream, busy)`（閉じている・開きかけ・閉じかけは disabled + 案内） | 同上 |
| ログ: 今のまま | 変更なし（`logSlot`） | 既存の「StartupNotices…」「HealthLine…」 |
| 上の帯にロールの名前 | `ui/app.mjs` `roleIdentityOf(settings)`（snapshot の `role` の id と見せる名前・無い古いサーバは `brain.identity`）を上の帯と題に | 「上の帯の名前はロールの名前…」 |
| 下の帯の運転設定の表示はロールの値 | `driveSummaryView` の口数・話し始めを `role.verbosity` / `role.speakStartMode` から（無ければ今の値） | 「下の帯の運転設定の表示: 口数・話し始めはロールの値…」 |
| 「タブは 6 つ」などの固定を仕様変更として直す | §4 の一覧 | — |

### 2.2 Domain A からの持ち越し

| 持ち越し | どこをどう変えたか | テスト |
|---|---|---|
| ロールの書き込み API（今のロールの編集・今のロールを写して新しいロール） | サーバ: `POST /api/role/edit`（body = 編集の中身）・`POST /api/role/new`（`{ id, name? }`）。フック `onUpdateRole` / `onCreateRole`。場が閉じていないと **409**（`/api/role` と同じ判定 `streamPhase !== "closed"`・閉じかけも断る）。確かめ: role-store に `applyRolePatch`（厳しく確かめて当てる・既定へ倒さず断る）と `copyRoleAs`。cockpit.mjs: `createRoleHooks` に `edit` / `create`（書き込みの失敗は投げる → 500・手元だけの既定のロールでは断る）、`createRoleEditHooks`（編集 → `onRoleEdited`・新しいロール → `onSetRole` で選ぶ）。性格の指示の `PUT` / `DELETE /api/conversation-instructions/:roleId` も場の途中は 409 | `cockpit-server-domain-e`「POST /api/role/edit: …」×3・「POST /api/role/new: …」・「PUT / DELETE …: 場の途中は 409」、`cockpit-role-edit`「createRoleHooks.edit: …」×5・「createRoleHooks.create: …」×2・「createRoleEditHooks…」×2、`role-store.test`「applyRolePatch…」×3・「copyRoleAs…」 |
| ロール id に Windows の予約名を拒む（置き場と `memoryDirForRole` の両方） | `model-identity.mjs` に `WINDOWS_RESERVED_NAMES`（con・prn・aux・nul・com0〜9・lpt0〜9）と `isWindowsReservedName`（大文字小文字を問わない）。`isRoleId` が予約名を通さない → `roleDir`・`readRole`・`listRoles`・`writeRole`・`memoryDirForRole`・`normalizeModelIdentity`・`POST /api/role/new` がどれも断る | `model-identity.test`「isRoleId: Windows の予約名は…」・`role-store.test`「isRoleId は Windows の予約名…」・`memory-store.test`「memoryDirForRole: Windows の予約名…」・`cockpit-server-domain-e`「POST /api/role/new: id の形（Windows の予約名を含む）…」 |
| 古い "brain" の種類と使われない CSS を消す | `settingsModalEventRoute` の `"brain"` を消した。CSS: `.conversation-instruction-selection*`・`.conversation-instruction-technical-label`・`.cockpit-settings-advanced`・`.btn-stop`（Stop を外したため）・`.drawer-close` | `cockpit-ui.test`「dirty event seam …（旧「頭脳」の種類は消した）」・`cockpit-ui-settings`「使われなくなった CSS…」 |
| `ui/header.mjs` の `ROLE_ID_SHAPE` の重複 | 画面側の写しを `view-logic/role.mjs` の 1 か所（`ROLE_ID_PATTERN`・`WINDOWS_RESERVED_NAMES`・`isRoleIdShape`）に寄せ、`header.mjs` と `view-logic/conversation-instruction.mjs` はそこから引く（ui / view-logic はブラウザへ配る木で mind を import できないため）。魂側と一致することをテストで固定 | `cockpit-ui-settings`「ロールの id の形: 画面側…は model-identity.mjs と同じ…」「…header.mjs は写しを持たず…」 |

### 2.3 Domain B からの持ち越し

| 持ち越し | どこをどう変えたか | テスト |
|---|---|---|
| 記憶タブは `place()` を使う | `placeInfo()`（`place()` と同じ決め方・副作用なし）→ 記憶のタブ。§5-9 | 2.1 の記憶の行 |
| 記憶の引っ越しの失敗を上の帯の警告にも出す | cockpit.mjs `startupMigrationWarnings(result)`（記憶の分の失敗 = alert「記憶の引っ越しに失敗した（この起動では記憶を読み書きしない）」・ロールの分の失敗も同様）→ サーバの新しいオプション `startupWarnings` → 警告の板に状態の警告として起動の間ずっと出す | `cockpit-role-edit`「startupMigrationWarnings: …server の startupWarnings で snapshot の warnings に出る」・「ロールの編集の結線（main）」 |

### 2.4 Domain C からの持ち越し

| 持ち越し | どこをどう変えたか | テスト |
|---|---|---|
| 器の URL の欄を `state.channel.body`（または `state.role.body`）で出し分ける | `channelFieldVisible` | 2.1 の配信の準備の行 |
| `.channel-status.bodyless` の色 | `color: var(--compacting)`（問題ではない状態なので静かな紫・「圧縮中」と同じ色） | 「器の状態「体なし」の色…」 |
| 体だけを編集したとき `roleHooks.current()` が新しい値を返す・編集の API が `sessionContextRevision` を上げる | `createRoleHooks.edit` が `current` を差し替え、main の `onRoleEdited` が `sessionContextRevision += 1`（頭・声の方式も揃える）。体は持ち回らない `currentBody()` がすぐ読む | `cockpit-role-edit`「createRoleHooks.edit: 体だけを編集すると…」・「POST /api/role/edit（本物の server・本物の createRoleHooks）: 体だけを編集すると roleHooks.current() が新しい値を返し、編集の API が sessionContextRevision を上げる・場の途中は 409」・「ロールの編集の結線（main）」 |

### 2.5 Domain D からの持ち越し

| 持ち越し | どこをどう変えたか | テスト |
|---|---|---|
| (1) YouTube の自動接続は「この起動で場を開く前に Connect したものだけ」 | `connectSavedChat` を `keepPreconnectedChat` に替えた: 場を開く前（閉じている間）に Connect した器官だけをそのまま持ち込む。保存した前回の URL へは「配信を始める」でつなぎにいかない（欄に前回の値が戻るのは今のまま）。前の場で Connect した器官は「配信を終える」で畳むので次の場に持ち込まない | `cockpit-stream`「配信を始める: 保存してある前回の YouTube の URL だけではつなぎにいかない…」（保存した URL だけでは開くときにつながない・場を開いてから Connect すればつながる・次の場に持ち込まない）・「…場を開く前に Connect 済みならそのまま（作り直さない）」・書き換えた「配信を始める: …の順」 |
| (4) 場が閉じている間の手動 Fire は断る（画面で disabled・サーバで 409） | サーバ: `POST /api/fire`・`/api/vision-fire` は `streamPhase !== "open"` で 409 `{ fired:false, reason:"stream-not-open", error }`（orchestrator に頼まない）。画面: `manualFireStreamView(stream)` → `FireButtons` の `streamBlocked`（disabled）+「配信を始めると押せる」。409 の理由は `fireNoteFromFireResponse` が出す | `cockpit-server-domain-e`「POST /api/fire・/api/vision-fire: 場が閉じている間は 409…」・`cockpit-ui-settings`「manualFireStreamView / fireNoteFromFireResponse / FireButtons…」 |
| (5) `openStream` / `closeStream` が想定外の例外で固まらない | `openStream`: 手順を `steps()` に分け、`run` が catch して `fail()`（起こしたかもしれないもの = 耳・セッション・器を全部畳み、`closed` + `stream.error`）。`fail()` 自身も畳むのが投げても閉じる。`closeStream`: catch で畳み残しをもう一度畳み（best-effort）、どの道でも最後に `closed` に戻して 500 を返す（Ctrl+C の `endStream` も同じ道） | `cockpit-server-domain-e`「配信を始める: 想定外の例外（工場関数の throw）でも opening のまま固まらず…」「配信を終える: 想定外の例外（写しの throw）でも closing のまま固まらず…」 |
| 「今日を記録」は場が開いている間だけ押せる見た目 | 2.1 の記憶の行 | 同上 |
| 始められなかった理由を出す所 | メイン画面の中央（`stream.error`）を正のまま。設定のダイアログの旧「マイクの行の `start failed:`」は無くし、配信の準備の「配信を始める」の下に**同じ `stream.error`**（`streamStartView`）を出す（ダイアログがメイン画面を覆うため）。§5-2 | 「配信の準備: 「配信を始める」は…stream.error（メイン画面と同じ値）…」 |
| 上の帯の状態のピルに場の状態 | 「考えてる」の次の順位で、開きかけ「始めてる」・閉じかけ「記録中」だけ出す（`.status-pill.recording` は中央の「記録中…」と同じ琥珀色）。開いている・閉じている間は今のまま | 「statusPillView: 場の開きかけ「始めてる」・閉じかけ「記録中」だけ出し…」 |

## 3. 変えたファイル（`apps/soul/agent/` 起点）

| ファイル | 新規/変更 |
|---|---|
| `src/mind/model-identity.mjs` | 変更（`WINDOWS_RESERVED_NAMES`・`isWindowsReservedName`・`isRoleId` が予約名を断る） |
| `src/roles/role-store.mjs` | 変更（`applyRolePatch`・`copyRoleAs`・名前の手がかりの作り直し） |
| `src/cockpit/cockpit-server.mjs` | 変更（`POST /api/role/edit`・`/api/role/new`・`applyRoleResult`・性格の指示の 409・手動の発火の 409・`keepPreconnectedChat`・open/close の try/catch・`startupWarnings`・JSDoc） |
| `scripts/cockpit.mjs` | 変更（`createRoleHooks.edit` / `create`・`createRoleEditHooks`・`createRoleMemoryPlaces.placeInfo`・`startupMigrationWarnings`・main の結線: `roleEditHooks`・`roleStatus` の編集の持ち物・`memoryStatus` の置き場・server へ `onUpdateRole` / `onCreateRole` / `startupWarnings`） |
| `src/cockpit/ui/settings-drawer.mjs` | 変更（5 タブに組み直し・配信の準備・ロールの編集・新しいロール・記憶のタブ・"brain" の種類の撤去・Stop の撤去） |
| `src/cockpit/ui/control-bar.mjs` | 変更（運転のタブから口数・話し始め・忙しい間のコメントを外す・`FireButtons` の `streamBlocked`・`VerbositySelect` / `SpeakStartSelect` の `disabled`） |
| `src/cockpit/ui/app.mjs` | 変更（`roleIdentityOf`・上の帯へ `stream`・運転のタブへ `stream`・ダイアログへ声の方式を渡さない） |
| `src/cockpit/ui/header.mjs` | 変更（`ROLE_ID_SHAPE` を消して `isRoleIdShape`・状態のピルへ `stream`） |
| `src/cockpit/ui/conversation-instruction-editor.mjs` | 変更（`locked`・戻り先「← ロール」・見出し「性格の指示」） |
| `src/cockpit/ui/styles.mjs` | 変更（`.channel-status.bodyless`・`.status-pill.recording`・配信の準備のたたみ・`.drawer-hint`・体のトグル・使われない CSS の削除） |
| `src/cockpit/view-logic/role.mjs` | **新規**（ロールの id の形の画面側の 1 か所・ロールの編集の下書き・器の欄の出し分け） |
| `src/cockpit/view-logic/conversation-instruction.mjs` | 変更（id の形を `role.mjs` から引く） |
| `src/cockpit/view-logic/settings.mjs` | 変更（`savedDeviceSelection`・`memoryPlaceLabel`・`memoryRecordButtonView`・`STREAM_LOCKED_INPUTS_NOTE`） |
| `src/cockpit/view-logic/control.mjs` | 変更（`manualFireStreamView`・409 の文言） |
| `src/cockpit/view-logic/glance-meters.mjs` | 変更（状態のピルの場の状態・下の帯の口数・話し始めをロールから） |
| `scripts/cockpit-role-edit.test.mjs` | **新規**（13 件） |
| `src/cockpit/cockpit-server-domain-e.test.mjs` | **新規**（8 件） |
| `src/cockpit/cockpit-ui-settings.test.mjs` | **新規**（22 件） |
| `src/roles/role-store.test.mjs`・`src/mind/model-identity.test.mjs`・`src/memory/memory-store.test.mjs` | 変更（追加のみ） |
| `scripts/cockpit-stream.test.mjs`・`src/cockpit/cockpit-server.test.mjs`・`src/cockpit/cockpit-ui.test.mjs`・`src/cockpit/cockpit-ui-speak-now.test.mjs`・`src/cockpit/cockpit-ui-comment.test.mjs` | 変更（§4 の仕様変更に伴う書き換え） |

`git diff --stat`（新規 4 ファイルは含まない）: 22 files changed, 1443 insertions(+), 615 deletions(-)（`settings-drawer.mjs` が 838 行の差分の大半）。

## 4. 期待値を変えた既存テスト（すべて仕様変更に伴うもの・計 26 件）

| ファイル | テスト | なぜ |
|---|---|---|
| `src/cockpit/cockpit-server.test.mjs` | 「cockpit POST /api/fire: 受理は 202・…」「…busy は 200 …」「cockpit POST /api/vision-fire: fire({ vision: true }) を呼び…」「…対象未設定は 200 …」「cockpit SSE: fire() の onState/onFire が…」「…onExpression が…」「…fire({vision:true}) の onVisionCaptured…」「…onUsage が usage イベントで…」「…fireVisionError（onDiagnostic 経由）…」「…onSoulTranscript の entry.latencyMs が…」「…entry に latencyMs が無ければ…」「…onUsage に brain 札が…」「…bargeIn 診断は…」の 13 件 | 持ち越し D (4): 場が閉じている間の手動の発火は 409。発火の前に偽の耳（`makeFakePipeline`）で場を開く 1 行（`openStreamForFire`）を足した。期待値そのものは不変。ただし「受理は 202」の `getBuffer()` は「耳未起動なら null」→ 場が開いている（耳が動いている）ので null でない、に替えた |
| `scripts/cockpit-stream.test.mjs` | 「配信を始める: ロールを固める → … → 器 → YouTube の順」 | 持ち越し D (1): 保存した URL では開くときにつながない。場を開く前に Connect してから始め、始めるの events から `chat.start` を外し「持ち込んだ器官を作り直さない」を確かめる形に |
| 同 | 「配信を始める: 保存してある YouTube の URL につながらなくても場は開く（器官は畳む）」→「…保存してある前回の YouTube の URL だけではつなぎにいかない（この起動で場を開く前に Connect したものだけ）」 | 同上（旧テストの前提「保存した URL へつなぎにいく」が仕様から外れた） |
| 同 | 「配信を終える: 写し → 畳む（YouTube・…）→ …」 | 同上。YouTube を畳む順を見るため、場を開いたあとで Connect する（ふだんの流れ・scope §19）1 行を足した。期待値は不変 |
| 同 | 「設定のダイアログの Start / Stop は場の関数…」→「設定のダイアログの「配信を始める」は場の関数…（Stop は下の帯の 2 回押しだけ）」 | ダイアログの Stop を外し（§5-2）、始めるの body から声の方式を外した（設計 §6）。変数名 `streamLocked` |
| `src/cockpit/cockpit-ui.test.mjs` | 「Cockpit Settings modal shell: … six internal tabs …」→「… five internal tabs …」 | 設計 §6 の 5 タブ |
| 同 | 「Cockpit Settings keyboard/category seam: …」 | タブの id が変わった |
| 同 | 「Cockpit Settings dirty event seam: back/category/brain/…」 | 持ち越し A: `"brain"` の種類を消した（`"brain"` は null を返すことを足した） |
| 同 | 「Settings modal「頭脳・会話」: 圧縮の下に「返事の速さ」…」「…圧縮を始める大きさ…」 | 頭の調整をロールのタブへ移した（パネルの id だけ。中身の確かめは不変） |
| 同 | 「Settings modal「頭脳・会話」: 頭脳の select はロールの select になり…」 | ロールのタブへ・ラベルが「今日のロール」 |
| 同 | 「設定の入出力タブ: 文字起こしの下に声の選択…」→「声の方式は配信の準備から外れてロールの声になった…」 | 設計 §6「声の方式はここから外す（ロールの声へ）」 |
| `src/cockpit/cockpit-ui-speak-now.test.mjs` | 「DrivePanel（運転タブ）: 口数の隣に話し始めのプルダウンが並ぶ…」→「ロールの編集…: 口数の隣に話し始め…・運転のタブには無い」 | 設計 §6「口数・話し始めは運転から外す（ロールへ）」 |
| `src/cockpit/cockpit-ui-comment.test.mjs` | 「DrivePanel（運転タブ）: 話し始めの隣に忙しい間のコメント…」→「配信の準備のたたんだもの…: 声の出力先の下に忙しい間のコメント…」 | 設計 §6「忙しい間のコメント」は配信の準備のたたんだもの |

## 5. 裁量（設計に無いことを決めた所と理由）

1. **頭の調整（圧縮を始める大きさ・Codex の fast）の置き場**: ロールのタブの下（「会話の圧縮」「返事の速さ」の見出しのまま）。設計 §2.2 では「技術のつまみ」でロールの外の設定だが、§2.1 の「頭の性質は頭に付いたまま」に沿い、モデルを選ぶ所の近くに置いた（5 タブに置き場が無いため）。値はロールではなく設定ファイルのまま（ロールを替えても変わらない）。→ 質問 4。
2. **設定のダイアログの「配信を始める」と Stop**: マイク・文字起こしの選択をサーバへ渡す道が要るので、配信の準備のいちばん下に「配信を始める」を残した（`{ device, sttEngine }`）。始められなかった理由はメイン画面と同じ `stream.error` をその下にも出す（ダイアログがメイン画面を覆うため・旧「マイクの行の `start failed:`」の重複は無くした）。1 回押しで終わる Stop は外した（終えるは下の帯の 2 回押しだけ＝誤って押しにくい）。配信中はボタンの代わりに「配信中（終えるときは下の帯の「配信を終える」）」。→ 質問 5。
3. **ロールの書き込み API**: `POST /api/role/edit`（今のロールだけ）・`POST /api/role/new`。どちらも場が閉じていないと 409（開きかけ・閉じかけも）。性格の指示（`PUT` / `DELETE /api/conversation-instructions/:roleId`）も同じ理由で場の途中は 409 にした（読むのは通る）。
4. **新しいロールは作ったら選ぶ**: 編集は今のロールだけなので、作ったロールをすぐ直せるよう `onSetRole` と同じ道で選ぶ。写すのはモデル・声・口数・話し始め・体・性格の指示（`instructions.md` の上書き）。名前は呼び名 = 見せる名前 = 入れた名前（空なら id）、ローマ字は空。→ 質問 2。
5. **名前を替えたときの名前の手がかり**: 呼び名かローマ字が替わったら、呼ばれ方（声・コメント）・whisper の手がかり・hotwords を新しい名前だけから作り直す（写した元の名前「チャッピー」で呼ばれたと取り違えないため）。見せる名前だけの変更では触らない。手がかりそのものの編集欄は作っていない。→ 質問 1。
6. **編集の確かめは厳しく**: 読むときの `normalizeRole`（読めない値は既定へ倒す）と違い、`applyRolePatch` は型の違う・範囲外の値を断る（入れ損ねで黙ってモデルや声が替わらないように）。画面でも `rolePatchFromDraft` が先に断る。
7. **手元だけの既定のロールでは編集・作成を断る**: 引っ越しに失敗した起動で `roles/` を作ると、次の起動の引っ越しが走らなくなるため。画面は「ロールの置き場が無いので直せない」と出して入力を固める（`role.editable`）。
8. **手動の発火の 409 は「開いている」以外すべて**: 閉じている・開きかけ（頭のセッションがまだ）・閉じかけ（畳んでいる）。AHK のホットキーの Fire も同じ 409。
9. **YouTube の持ち込み**: 前の場で Connect した器官は「配信を終える」で畳む（D のまま）ので、次の場には持ち込まない（「場を開く前に Connect したもの」= 閉じている間に Connect したもの、と読んだ）。
10. **記憶のタブの置き場**: `place()` を直接呼ぶと置き場の準備（git init・種の書き込み）が走る（D が場の始まりへ寄せた副作用）ので、同じ決め方で副作用の無い `placeInfo()` を足した。`dir` は絶対パスのまま出す。
11. **起動時の警告にロールの分の失敗も足した**: 記憶の分（Undine の追認）に加えて、ロールの分の失敗（既定のロールで動く）も同じ形で出す。
12. **状態のピル**: 「考えてる」の次に、開きかけ「始めてる」・閉じかけ「記録中」。開いている・閉じている間は今のまま（見た目を大きく変えない）。
13. **`.channel-status.bodyless`**: 問題ではない状態なので緑・赤・黄を避け、静かな紫（`--compacting`）。器の欄を出さないときも配信の準備に「体なし」の状態とひとことを出す。
14. **ロールの編集の下書き**: タブを替えても・ダイアログを閉じても残る（常時 mount）。今のロールが替われば作り直す。未保存の下書きで閉じるときの確認は出していない（確認は今どおり性格の指示のページだけ）。
15. **ゲームの窓・声の出力先の保存した値**: Refresh と Set のあとは保存した値に揃え直す（選び直しの印を戻す）。保存した値が一覧に無ければ先頭（今までどおり）。
16. **`/api/verbosity`・`/api/speak-start` はサーバに残した**: 画面からは呼ばなくなった（口数・話し始めはロールの編集）が、口は消していない（既存テストが使う）。これらは今もいつでも今のロールに書く。→ 質問 3・持ち越し。

## 6. 持ち越し

- **仕上げへ**:
  - README の Start / Stop・`/api/ears/*`・`--channel`・`/api/brain` の記述に、`/api/role/edit`・`/api/role/new`・手動の発火の 409・ダイアログの 5 タブを足す（D の持ち越しと合わせて）。
  - `/api/verbosity`・`/api/speak-start` を場の途中も受け付けて今のロールに書く（画面からは呼ばない）。場の途中は 409 にするか、口ごと消すかを決める（質問 3）。消す・409 にする場合は既存テストの書き換えが要る。
  - `cockpit-server.mjs` の古い JSDoc（「頭脳・会話」タブの言い方が数か所）・`view-logic/settings.mjs` の `TTS_ENGINE_OPTIONS` / `ttsEngineSelection` の「入出力タブ」の言い方。`ttsEngineSelection` は画面からは使われなくなった（テストが使うので残した）。
  - 画面のテストの多くはソースの文字列の照合（従来の流儀）。書き換えに弱い。
- **全体の突き合わせで見てほしいこと**:
  - ロールの編集のあと、場の始まりで新しい名前・モデル・性格・声・体が使われること（編集 → `sessionContextRevision` → 「配信を始める」の `openStreamSession` が作り直す）。
  - 声の方式の出どころ: 始めるの body から `ttsEngine` を外したので、声の方式はサーバの現況（ロールの選択・編集で入る）だけ。始めるの中の `onSetTtsEngine` は同じ値を今のロールに書き直す（害は無い）。
  - 新しいロールの記憶のフォルダは、最初の「配信を始める」で準備される（種の名前は新しい呼び名）。
- **人間ゲートで見てほしいこと**（計画 §6 の 6 に加えて）:
  - 設定のダイアログが「配信の準備 / ロール / 運転 / 記憶 / ログ」で、ゲームの窓と声の出力先に保存した値が選ばれている。たたんだもの（マイク・文字起こし・声の出力先・忙しい間のコメント）が普段は閉じている。
  - 体を使わないロールに直すと、配信の準備から器の URL の欄が消えて「体なし」が出る。体ありに戻すと出る。
  - 前回の YouTube の URL が欄に戻っていても、「配信を始める」ではつながない（場を開いてから Connect を押せばつながる）。
  - 場が閉じている間、運転のタブの Fire / Fire+視覚が押せない（AHK の Fire は 409 で何も起きない）。
  - ロールのタブで名前・モデル・声・口数・話し始め・体を直して保存 → 次の「配信を始める」から効く。配信中はロールのタブの入力が固まっている。新しいロールを作ると今のロールになる。
  - 閉じかけの間、上の帯の状態のピルが「記録中」になる。
  - 新しいロールを作る id に `con` などを入れると断られる。

## 7. 質問（Orch-Sylph / Undine へ・どれも実装は止めていない。別の読みならすぐ直せる）

1. **名前を替えたときの名前の手がかり**（§5-5）: 呼び名かローマ字を替えると、呼ばれ方・whisper の手がかり・hotwords を新しい名前だけから作り直す形にした。チャッピーの今の手がかり（「ちゃっぴー」などの揺れ・hotwords）は、チャッピーの名前を替えない限り触らない。名前の手がかりを画面で直せるようにする（揺れを足す）必要があるか。
2. **新しいロールは作ったら選ぶ**（§5-4）: 作ったロールがすぐ今のロールになる。作るだけで選ばない形がよければ数行で替えられる。
3. **`/api/verbosity`・`/api/speak-start`**（§5-16）: 画面からは外したが、口は残していて場の途中でも今のロールに書ける。設計 §2.1・§3（場の途中でロールの持ち物は替えない）に合わせて場の途中は 409 にするか、口ごと消すか。
4. **頭の調整（圧縮・Codex の fast）の置き場**（§5-1）: ロールのタブの下に置いた（値はロールではなく設定のまま）。運転のタブなど別の置き場がよいか。
5. **設定のダイアログの「配信を始める」**（§5-2）: マイク・文字起こしを選んで始める道として残した（メイン画面の「配信を始める」は前回の選択で始める）。マイク・文字起こしは選んだらすぐ保存する（ダイアログの始めるを無くす）形がよければ、保存の口を 1 つ足して替えられる。
