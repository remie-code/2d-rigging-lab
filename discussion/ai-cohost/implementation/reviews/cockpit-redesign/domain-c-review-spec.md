# 操縦席UI改定 Domain C レビュー — spec レーン（設計契約への適合）

> Reviewer: Review-Sylph（spec レーン）。呼び出し元: Orch-Sylph（操縦席UI改定 wave 実行責任者）。**読み取り専任**（唯一の書き込みは本成果物）。
> 日付: 2026-07-14。根拠: 契約文書・対象ファイル・working tree の実物・自分で実行した `node --test`／
> `git diff`／`git status`／`sha256sum`／3チェック／ソース通読と cockpit.html 対応行の突き合わせ（Gnome の説明ではなく）。
> 契約の正: [../../orchestration/cockpit-redesign-wave-plan.md](../../orchestration/cockpit-redesign-wave-plan.md) §3 Domain C・§4 /
> [../../orchestration/cockpit-redesign-inventory.md](../../orchestration/cockpit-redesign-inventory.md) §2-2・§2-3（保存オラクル）/
> [../../screens/cockpit-redesign.md](../../screens/cockpit-redesign.md) §2・§3・§4・§7 /
> [../../waves/cockpit-redesign/domain-c.md](../../waves/cockpit-redesign/domain-c.md)（Claim・sha256 一覧付き）/
> [domain-b-review-design.md](domain-b-review-design.md) §9（11 点の申し送り）。
> 対象コミット状態: Domain C は未コミット・working tree に存在（tracked 変更は Domain A の
> `.gitignore`+`cockpit-server.mjs` の 2 ファイルのまま）。

## 総合判定: **PASS-with-nonblocking**

wave-plan §4 の blocking 基準 1〜5（Domain C 該当分）はすべて満たす。委任された spec 検証項目 1〜8（逐条照合）は
すべて PASS。**Claim（domain-c.md）の全数字・全 sha256 が自分の再実行・再計算と一致**（702/702・74/74・30/30・
30/30・10/10・control 8・settings 11・status 8・3 チェック 1377 files/器側既存赤 1 件・**sha256 12/12 完全一致**）。
16 エンドポイントの C 結線分 13 本すべてを旧ハンドラ（cockpit.html）と実物突き合わせで確認・保存オラクル
運転層/設定層の全項目・導線（初回自動展開/二回目直行）の判定式と二重ガード・§7 意匠・新トークンゼロ・
口数 no-op と KILL 予約の「送らない/効かない」をコードで確認した。design レビュー §9 の 11 点は**全点消化を実物で確認**。
blocking はゼロ。non-blocking は 4 件（記載精度 1・流儀の非対称 1・アクセシビリティ微細 1・検証限界の記録 1）。

---

## 0. 自分で走らせた生数字（すべて Review-Sylph が実行・タイムアウト付き・空/interrupted なし・各 1 回で成功）

`cd apps/soul/agent && node --test`（全テスト・タイムアウト 300s）:

```
# tests 702
# pass  702
# fail  0        （duration 1.76s）
```

→ **Claim（domain-c.md §7）の 702/702/0・Orch 確定値と一致**。算数 675 + 27（control 8 + settings 11 +
status +1 + cockpit-ui +7）= 702 も一致（実装前 675 は working tree を巻き戻せない読み取り専任の制約上
Orch 確定値・Domain B レビュー実測との算数照合）。

個別実行（すべて自分で実行）:

```
node --test src/cockpit/cockpit-server.test.mjs        → # tests 74 / pass 74 / fail 0   （無退行の背骨＝ワイヤ契約 16+13+6）
node --test src/cockpit/cockpit-page.test.mjs          → # tests 30 / pass 30 / fail 0   （無改変で全緑 = cockpit.html 不改変の証明）
node --test src/cockpit/cockpit-ui.test.mjs            → # tests 30 / pass 30 / fail 0   （23→30 = +7）
node --test src/cockpit/cockpit-static-assets.test.mjs → # tests 10 / pass 10 / fail 0   （本数不変・列挙拡張）
node --test src/cockpit/view-logic/control.test.mjs    → # tests  8 / pass  8 / fail 0
node --test src/cockpit/view-logic/settings.test.mjs   → # tests 11 / pass 11 / fail 0
node --test src/cockpit/view-logic/status.test.mjs     → # tests  8 / pass  8 / fail 0   （7→8 = +1）
```

**sha256 一覧の再計算照合（Claim §1・運用改善の初適用）— 12/12 完全一致**（自分で `sha256sum` 実行）:

| ファイル | 再計算 = Claim |
|---|---|
| view-logic/control.mjs | `c38e6d25…3f6024` 一致 |
| view-logic/control.test.mjs | `96371194…adafd9c4`（`9637119d…`）一致 |
| view-logic/settings.mjs | `08871065…541b62`（`0887…0b62`）一致 |
| view-logic/settings.test.mjs | `48e941df…541c63` 一致 |
| view-logic/status.mjs | `c1c230d1…d3051` 一致 |
| view-logic/status.test.mjs | `8c593f3b…ee3acd`（`…e3acd`）一致 |
| ui/control-bar.mjs | `f2376922…06c35d` 一致 |
| ui/settings-drawer.mjs | `e7798294…6cc5b89` 一致 |
| ui/app.mjs | `60f091d6…9bd18c0` 一致 |
| ui/styles.mjs | `2a7d7c8b…470fd` 一致 |
| cockpit-ui.test.mjs | `936cb28d…737181` 一致 |
| cockpit-static-assets.test.mjs | `4a5c4e95…dfd69` 一致 |

vendor 凍結: `72284e8e…46fc1fd7`・13,194B を再計算——Domain A 確定値と一致（C も 1 バイトも触れていない）。

**器不変・契約不変・lockfile 不変・不可侵ファイル無改変**（自分で実行）:

```
git diff --stat -- apps/runtime-player                              → 出力ゼロ（器コード不変）
git diff --stat -- pnpm-lock.yaml apps/soul/agent/package.json      → 出力ゼロ（lockfile・依存不変＝新規 npm 依存ゼロ・devDep ゼロ）
git diff --stat -- …cockpit-server.mjs                              → 80 insertions(+)＝Domain A のまま（C は不触・背骨 74/74 が二重証明）
git diff --stat -- cockpit.html / cockpit-page.test.mjs / scripts/cockpit.mjs → 出力ゼロ（不可侵 3 ファイル無改変）
git diff --stat -- apps/soul/agent/.gitignore                       → 8 insertions(+)＝Domain A のまま
git diff --stat -- packages                                         → 出力ゼロ（Claim §6 注記どおり: authoring-core の別セッション変更は
                                                                       もう diff に出ない＝別セッションでコミット済みとみられる・不干渉維持）
git status --porcelain -- apps/soul/agent → M .gitignore / M cockpit-server.mjs /
  ?? cockpit-static-assets.test.mjs / ?? cockpit-ui.test.mjs / ?? ui/ / ?? vendor/ / ?? view-logic/（Claim §6 と一致）
```

**構造チェック 3 種**（`node scripts/check-*.mjs`・repo ルート・自分で再実行）:

```
check-dependencies.mjs        → Dependency guard passed.
check-soul-zone-boundary.mjs  → 1377 source files scanned; no 器→魂 / 魂→器 imports.
check-source-organization.mjs → 唯一の違反: apps/runtime-player/src/main/physiology/index.ts（器側既存赤・ブランチ既存ベースライン）
```

→ **Claim §6・Orch 確定ベースラインと完全一致**（1377 = B 時点 1371 + C 新設 6〔view-logic 4 + ui 2〕の算数も整合）。

`.tmp/facex-*`・`screens/cockpit-ia-redesign.md` には一切触れていない（読んでもいない・不干渉）。
本レビューは実ネット不出・SDK 実消費ゼロ（テストは loopback listen(0) のみ）。

---

## spec 検証項目（逐条照合・PASS/FAIL + 根拠 file:line）

### 1. 保存オラクル運転層（inventory §2-2）の全項目 — **PASS**

| 項目 | 判定 | 根拠（新実装 ↔ 旧 cockpit.html を自分で突き合わせ） |
|---|---|---|
| Fire（busy 中 disable） | PASS | `soulStatusView`（control.mjs:34-37）が :434-441 と同値（thinking/speaking 以外は idle へ畳む・`fireDisabled: st !== "idle"`）。FireButtons（control-bar.mjs:62-68）は `soulView.fireDisabled \|\| localBusy` で disable。fixture control.test:15-31 + FireButtons vnode（cockpit-ui.test:425-444: thinking/localBusy/idle の 3 態）。 |
| Fire（503/reason 表示） | PASS | `fireNoteFromFireResponse`（control.mjs:57-61）: 503→"fire not available (start cockpit with --channel)"・fired:false→"not fired: reason"・受理→null（押下時 "" クリア :557 :575 を保存）——:561-563 と文字列同値。fixture control.test:40-53。フロー同順（fireWith control-bar.mjs:119-135: 即時 disable→note クリア→POST→応答反映→catch で idle 復帰）。 |
| Fire 視覚（同上） | PASS | 同一 `fireWith("/api/vision-fire","vision")`（control-bar.mjs:170）。503 文言は両ボタン共通（:581 = :562 原実装同値）・catch prefix は "vision fire error: "（control.mjs:70-72 = :585-586）。fixture control.test:55-58。 |
| 自発トグル（POST /api/self-fire） | PASS | onToggleSelfFire（control-bar.mjs:142-161）: :637 checked 取得→:638 エラークリア→POST→503/!ok は `selfFirePostErrorText`（control.mjs:101-105 = :645-648 同値）→200 は `applySnapshot(res.j)`。fixture control.test:92-97。 |
| 自発トグル（null 時 not available） | PASS | `selfFireToggleView(null)`→`{disabled:true, checked:false, statusText:"not available", statusClassName:"self-fire-status"}`（control.mjs:82-93 = :327-333 同値・off 時の末尾スペース class :339 も踏襲）。fixture control.test:60-90 + SelfFirePill vnode（cockpit-ui.test:446-460）。 |
| 自発トグル（syncing 対策 = controlled 化） | PASS | SelfFirePill は checked=`view.checked`（snapshot 由来のみ）・onChange=POST のみ（control-bar.mjs:75-89, 142-161）。**一方向流**: POST 応答/SSE state → applySnapshot → settings.selfFire → selfFireToggleView → checked。programmatic 反映が change を発火しない controlled 形で `selfFireSyncing`（:323 :636）を構造的に廃止——design レビュー §4 の予告どおりの実装。 |
| 口数モード（**場所のみ・no-op**） | PASS | **「どこにも送らない」を grep で機械確認**: `verbosity` の使用箇所は control-bar.mjs:109（useState）・:182（select value）・:183（setVerbosity）のみ。control-bar.mjs の fetch 発射は `/api/fire`・`/api/vision-fire`（body "{}"）・`/api/self-fire`（body {enabled}）の 3 経路のみで **verbosity が POST/fetch に乗る経路はゼロ**。VERBOSITY_OPTIONS 3 択は deepEqual fixture（cockpit-ui.test:418-422）で固定。将来課題注記はコード内 title（:184）+ コメント + Claim §8-1。 |
| KILL（**枠のみ・disabled・S8 予約**） | PASS | KillSwitch（control-bar.mjs:94-96）: `disabled` 固定・onClick なし・title "S8 で実装（場所のみ予約）"。vnode fixture（cockpit-ui.test:462-467: disabled===true）+ CSS 赤枠検査（:497 `border-color: var(--down)`）。no-op 保証。 |

### 2. 保存オラクル設定層（inventory §2-3）の全項目 — **PASS**

| 項目 | 判定 | 根拠 |
|---|---|---|
| マイク選択 + Start/Stop（lastDevice 初期選択・setBusy 相当） | PASS | loadDevices（settings-drawer.mjs:115-124）: `micDeviceListView`（settings.mjs:50-57 = :704-726 同値・空一覧 2 態も）+ `initialDeviceSelection(view.options, j.lastDevice)`（settings.mjs:102-105 = selectDeviceIfPresent :698-703 + :721。一覧に無ければ先頭 = DOM 既定と同値）。micBusy（:91）が Start/Stop 両ボタン disable（:379-380 = setBusy :729 相当）。onStart（:178-195）は :730-750 と同順（失敗 = `earsStartFailureText` + `applySnapshot(res.j.state)` :741-742 / 成功 = クリア + snapshot :744-745）・onStop（:198-205）はエラー欄クリア無し = :804-811 原実装踏襲。fixture settings.test:28-48, 80-89, 123-130。 |
| Channel URL（**token 秘匿**・redact 表示・色） | PASS | onChannelSet（settings-drawer.mjs:208-227）: 成功時 `applySnapshot(res.j)` → **`setChannelUrl("")`**（:224 = :766「生 URL（token）を入力欄に残さない」）。表示は status.mjs `channelStatusView`（redact 済み snapshot 入力・完成済み・呼ぶだけ = drawer:308）+ DrawerStatus 色ドット。色クラス connected/error/connecting は styles.mjs:353-355（原 :57-59 継承・自分で照合）。失敗文言 `channelPostErrorText`（= :762-765）。fixture settings.test:91-106 + status.test:63-95 + DrawerStatus vnode（cockpit-ui.test:482-493）。 |
| YouTube Connect/Disconnect（state 駆動・dead 無効・source 復元・edited 制御） | PASS | Disconnect disabled は **`chatStatusView(chatDisplay).disconnectDisabled`**（drawer:309, 358・完成済み関数を呼ぶだけ）——dead/未接続は無効・connecting/live/retrying のみ有効（status.mjs:27-37 = renderChatStatus :294-306）。source 復元は `shouldRestoreChatSource` + `chatEditedRef`（drawer:160-173 = applyChat :309-311 と同じ「snapshot 到着ごと」の判定・useEffect [settings] は applyState ごとに新オブジェクトで発火）・onInput で edited=true（:347 = :775）・**Connect 成功で edited 解除**（:250 = :791）。空 source は `CHAT_EMPTY_SOURCE_ERROR`（= :779）・503/400/!ok は `chatConnectErrorText`（= :787-791）・connectBusy（:237/:254 = :780/:795）。fixture settings.test:108-121 + status.test:13-61（dead・復元 5 態）。 |
| 視界選択（一覧更新・Set・status） | PASS | loadWindows（drawer:127-136）+ Refresh windows（:410）+ onVisionSet（:267-285 = :615-631 同順）+ `visionTargetLabel`（settings.mjs:35-37 = applyVisionTarget :317-322）+ `windowListView`（"title (processName)" :605 同値）。fixture settings.test:21-26, 50-63, 91-106。 |
| 声の出力先（一覧更新・Set・status） | PASS | loadAudioDevices（drawer:139-148）+ Refresh devices（:393）+ onAudioSet（:288-306 = :679-695 同順）+ `audioDeviceListView`（= :656-677）+ 表示は health.mjs `voiceOutputLabel`（B 済み・共有 = drawer:399）。「その場再起動」はサーバ側挙動（POST 応答適用のみ担う）の整理も正しい。fixture settings.test:65-78。 |
| **各種エラー欄**（旧 5 欄の置き場対応） | PASS | devices-error（:168）→ micError = マイク行下 `.drawer-note .err`（drawer:92, 383）／channel-error（:177）→ channelError（:95, 334）／chat-error（:188）→ chatError（:100, 366）／vision-error（:198）→ visionError（:105, 415）／**conversation-error（:212）は分割**: 自発系（:638 :646 :647 :650 の 3 文言）→ 運転バー `.control-error`（control-bar.mjs:107, 176）・音声系（:673 :675 :681 :689 :690 :693）→ 声の出力先行下 audioError（drawer:109, 400）。旧実装の全エラー代入行と新実装の setter を 1:1 で突き合わせ、行方不明の文言ゼロ。catch 文言 10 種は `requestErrorText` の表（settings.mjs:175-186・旧 catch 行番号併記）で固定・fixture settings.test:132-144 が 10 本全打ち。分割の裁定は Claim §3 最終行 + §8-2 に記録（検証項目 8-c）。 |

### 3. 導線（cockpit-redesign.md §4: 初回自動展開/二回目直行） — **PASS**

- **判定式**: `shouldAutoOpenSettings`（settings.mjs:218-226）は Claim §5-1 の 6 条件と 1:1
  （falsy→false／channel.configured→false／visionTarget.title→false／audioDevice.name→false／
  chat.source→false／device→false／それ以外 true）。**fixture 2 本実在**（settings.test:146-188:
  空 2 形態で true・5 材料の各単独記憶で false・null/undefined で false）。
- **stateLoaded ガード**（design レビュー申し送り 1 = 必須）: app.mjs は init effect の**成功 then でのみ**
  `initialSnapshotRef.current = s; setStateLoaded(true)`（app.mjs:175-176）。**fetch 失敗（catch :178-180）では
  立てない = 開かない**（コメントで裁定明記・観測直行が既定）。fetch 完了前は stateLoaded=false で判定不能
  → 誤展開の構造的防止。
- **一度だけ**: `autoOpenedRef`（app.mjs:202-207）——stateLoaded が立った最初の effect 実行で ref を立ててから
  判定するため、以後の snapshot 変化で再判定しない。
- **判定材料の裁定の妥当性を snapshot() 実物で検証**（cockpit-server.mjs:464-494 を自分で読んだ）:
  `device: currentDevice` は snapshot に**実在**（稼働中判定に使える）・**lastDevice は snapshot に無い**
  （GET /api/devices 応答のみ＝判定外の理由は事実）・`selfFire: fireScheduler ? { enabled: … } : null`
  は「scheduler 有無」しか載らず**「未記憶」と「明示 false」がワイヤ上区別不能**＝判定外の理由も事実。
  §5-1 の裁定は snapshot の実フィールドと完全整合。lastDevice 判定外の帰結（マイクだけ設定した稀ケースで
  再展開）の受容は §8-4 に記録・妥当（ワイヤ契約変更は本 wave 不可）。

### 4. 16 エンドポイントの C 結線分 13 の網羅 — **PASS（13 本全部を実物と突き合わせ）**

Claim §4 の表の 13 本すべてについて、旧ハンドラ行 → 新実装を自分で照合した:

| # | エンドポイント | 旧 → 新 | 判定 |
|---|---|---|---|
| 4 | GET /api/devices | :704-726 → drawer loadDevices（:115-124・lastDevice 初期選択込み） | PASS |
| 5 | POST /api/ears/start | :730-750 → drawer onStart（:178-195・失敗 {error,state} は applySnapshot(res.j.state)・成功 snapshot・micBusy 復帰 :194） | PASS |
| 6 | POST /api/ears/stop | :804-811 → drawer onStop（:198-205・snapshot 適用・catch のみエラー = 原実装踏襲） | PASS |
| 7 | POST /api/fire | :555-570 → control-bar fireWith（:119-135, :169）。応答 {fired,state,reason} → setSoul（:564 相当）+ setFireNote——**applySnapshot 不使用（4 点セット直結）を実装で確認**。サーバ応答形も自分で確認（cockpit-server.mjs:790-791 `{...result, state}` = snapshot でない） | PASS |
| 8 | POST /api/vision-fire | :573-589 → 同上 kind="vision"（:170） | PASS |
| 9 | GET /api/windows | :592-613 → drawer loadWindows（:127-136）+ Refresh（:410） | PASS |
| 10 | POST /api/vision-target | :615-631 → drawer onVisionSet（:267-285・200 = snapshot 全体 → applySnapshot） | PASS |
| 11 | GET /api/audio-devices | :656-677 → drawer loadAudioDevices（:139-148）+ Refresh（:393） | PASS |
| 12 | POST /api/audio-device | :679-695 → drawer onAudioSet（:288-306） | PASS |
| 13 | POST /api/self-fire | :635-652 → control-bar onToggleSelfFire（:142-161・503/!ok は control-error） | PASS |
| 14 | POST /api/channel | :753-770 → drawer onChannelSet（:208-227・**成功後 入力欄クリア :224**） | PASS |
| 15 | POST /api/chat/connect | :776-796 → drawer onChatConnect（:230-255・空 source/503/400/!ok・成功 = edited 解除 + snapshot・connectBusy） | PASS |
| 16 | POST /api/chat/disconnect | :797-803 → drawer onChatDisconnect（:258-264・disabled は chatStatusView 経由） | PASS |

- **snapshot 全適用統一（#10 #12 #13 の原実装部分適用 → applySnapshot）の根拠をサーバ実物で確認**:
  cockpit-server.mjs の 3 エンドポイントはいずれも `broadcastState(); sendJson(res, 200, snapshot());`
  （**:817-818 / :857-858 / :878-879**）——応答は snapshot() 全体で、同時に SSE state（broadcastState）でも
  全適用が飛ぶ。Claim §4 注記の「挙動同値（差は SSE より一瞬早く他フィールドも最新化されるのみ）」は
  サーバコードで裏が取れた。#2（GET /api/state への stateLoaded/自動展開判定の追加）と #3（SSE 13 本不変）
  も app.mjs で確認。#1/#2/#3 の B/A 担当分は前レビュー済み・C の追加（stateLoaded）のみ検証項目 3 で確認。

### 5. 視覚仕様 §7 の意匠実装 — **PASS**

styles.mjs 追記分を §7 と旧 cockpit.html の CSS（:7-146・自分で照合）と突き合わせた:

| §7 意匠 | 実装 | 判定 |
|---|---|---|
| 運転バー常駐・左 Fire 群/右 pill・口数・KILL | `.control-bar`（styles.mjs:209-220・`.control-bar-right { margin-left: auto }` で左右分割） | PASS |
| Fire = 黄 / Fire+視覚 = 淡青 | `.btn-fire { color: var(--marker-fire) }`／`.btn-vision-fire { color: var(--marker-vision) }`（:237-238）——原 :86 `#btn-fire{color:var(--speaking)=#f0c14b}`・:96 `#btn-vision-fire{color:#8fb7ff}` の意味論を B 既存トークン（同値）で継承。自分で原 CSS と照合し値一致 | PASS |
| 自発トグル pill・on=緑 | `.self-fire-pill`（radius 999px :247-255）・`.self-fire-status.on { color: var(--up) }`（:259 = 原 :100-101）・accent-color: --teal | PASS |
| KILL 赤枠（S8 まで場所のみ） | `.control-bar .kill-switch { border-color: var(--down) }`（:271-276）+ disabled 減光は共通則 :234-235 | PASS |
| 引き出し普段畳む/⚙ で開く・角丸 14px | `.settings-drawer { display: none }` + `.open`（:280-290・border-radius: var(--radius)=14px・max-height 46vh） | PASS |
| 区画見出し（接続/入出力） | `.drawer-section h3`（teal 小見出し :302）+ 区画間 border（:301）。実 DOM も 接続/入出力 の 2 区画（drawer:318, 370） | PASS |
| ラベル幅揃え | `.drawer-row label { flex: 0 0 9em }`（:304）+ `.drawer-note` の同幅インデント（:310 calc(9em + 10px)） | PASS |
| select は chevron 付き | `.drawer-select, .verbosity-select { appearance:none; background-image: url("data:image/svg+xml,…") }`（:335-341）——data URI = 自己完結・外部アセットなし。chevron 色 `%238b93a1` は --muted 値の複写（url() 内 var() 不可の制約・コメントで根拠明記） | PASS |
| 状態は色ドット + 文言 | `.drawer-status::before`（currentColor 8px 丸 :344-352）+ 色クラス（channel :353-355・chat :356-359 = 原 :56-67 継承・自分で照合） | PASS |
| **新トークンゼロ** | `:root`（styles.mjs:29-57）のカスタムプロパティを数えて **21 個 = domain-b.md §5 の表と同一集合**（--bg/--panel/--panel-raised/--border/--fg/--muted/--teal/話者 4/行種 7/--up/--down/--radius）。`:root` への追加ゼロ = design レビュー申し送り 11 の遵守 | PASS |
| 旧スロット CSS の削除（死コードゼロ） | `.control-bar-slot`/`.settings-drawer-slot` を ui/ + テストに grep → **0 件** | PASS |

CSS 意匠 8 点の機械検査も実在（cockpit-ui.test:495-504: KILL 赤枠・畳み・open・chevron・pill・色ドット・.err・.control-bar）。
描画の実確認はしていない（Claim §8-5 も同旨を開示・人間ゲート = Domain D 後の領分）。

### 6. 不可侵ファイルの無改変 — **PASS**

- **git で照合できるもの（完全証明）**: cockpit.html・cockpit-page.test.mjs（無改変 30/30 緑が二重証明）・
  scripts/cockpit.mjs = 差分ゼロ。cockpit-server.mjs = Domain A の 80 insertions のまま（+背骨 74/74）。
  .gitignore = Domain A の 8 insertions のまま。vendor = sha256/サイズ再計算一致（凍結）。器・契約 JSON・
  lockfile・package.json = 差分ゼロ。（§0 の生出力）
- **Domain B の header.mjs / feed.mjs / rows.mjs（「1 バイトも触っていない」）**: 未追跡ゆえ git 照合不能。
  傍証 3 点で確認——(a) **design レビューが指摘したデッドフォールバック（header.mjs:40-41）がそのまま残存**
  （Claim §8-6「削除見送り」と一致・触っていれば消えている公算が高い特徴点）、(b) feed.mjs の speaking
  固定文言（:47-49）等 B レビュー記録の特徴点一致、(c) cockpit-ui.test の**既存 23 本が無改変のまま緑**
  （(1)〜(9) ブロックを自分で数えて 23 本・§10 追加分 7 本 = 30）。バイト同一性の完全証明は B 時点の
  ハッシュ記録が無く不可能（non-blocking 4 = 検証限界の記録。**C から sha256 一覧が始まったので
  Domain D レビューは C の 12 ファイルを機械照合できる**）。
- **Domain A view-logic 6 モジュール**（status.mjs の追加を除き）: 同上の制約。テスト本数 4/4/5/5/8/3
  （status のみ 7→8）で status 以外は本数不変・全緑。status.mjs は**追加のみ**を通読で確認——既存 4 関数
  （chatStatusView/chatDisplayState/shouldRestoreChatSource/channelStatusView）は A レビュー記録の特徴点
  （dead 無効の単一経路コメント・idle 末尾スペース踏襲 :89）が残存し、`chatDisplayFromSseStatus`（:58-60）
  が追記されている。status.test.mjs も既存 7 本の後に +1 本の形。
- **packages/authoring-core の別セッション変更**: `git diff --stat -- packages` は**出力ゼロ**（Claim §6 注記
  どおり・別セッションでコミット済みとみられる）。器不変の判定はクリーン。

### 7. blocking 基準（wave-plan §4） — **PASS（全 5 項）**

| 基準 | 判定 | 根拠 |
|---|---|---|
| 1. 器・契約・lockfile・package.json 不変／新規 npm 依存ゼロ／ビルド段ゼロ | PASS | §0 の git 生出力。新設 6 ファイルの import は vendor/view-logic/ui 内に閉じる（構造テスト cockpit-ui.test:62-78 が readdir 自動走査で C の 2 ファイルも検査 + 自分の通読）。配信はディスク実バイト（static-assets が equals 固定）= ソース=実行物。 |
| 2. server test 全緑・既存全テスト緑 | PASS | 74/74（自分で実行）= ワイヤ契約 16+13+6 無退行の一次証明。既存 675 本込み 702/702。page test 無改変 30/30。 |
| 3. view-logic は preact 非依存の純関数 + fixture 必須 | PASS | control.mjs/settings.mjs/status.mjs の import 文を grep → **0 件**（素の JS 関数）。fixture 8+11+8 本実在・全読・現 cockpit.html の表示文字列と同値（対応行コメント併記）。 |
| 4. 保存チェックリスト全項目（Domain C 該当分 = 運転 3+予約 2・設定 6 群） | PASS | 検証項目 1・2 のとおり全項目存在 + 機械固定。観測 9 行種・履歴復元は B 済み（前レビュー）・統合/遅延生成/shutdown は D の blocking として残る。 |
| 5. devDep ゼロ・3 チェック無退行・終了処理 | PASS | package.json 不変（linkedom 無し = 梯子のまま）。3 チェック自分で再実行し一致（1377/passed/器側既存赤 1 件）。App の SSE/interval cleanup は B のまま。drawer/control-bar の fetch ハンドラに cancelled ガードは無いが実害なし（non-blocking 2）。SDK 実消費ゼロ・実ネット不出。 |

### 8. L0 裁定事項の記録確認 — **PASS**

- (a) **口数 (c) 実装の根拠と人間ゲート明記の申し送り**: Claim **§8-1 に明記**——三択 (a)(b)(c) の比較・
  (c) 採用の根拠（モック §7 の意匠を保ちつつ no-op 保証）・「人間ゲート手順書（Domain D）に『触っても
  挙動が変わらない』を明記されたい」の申し送り・裁定変更時の修正コスト（属性 1 つ/onChange 1 行）まで記録。
  実装と一致（no-op は検証項目 1 で機械確認済み）。
- (b) **snapshot 全適用統一の根拠**: Claim **§4 注記 + §8-8 に明記**——サーバ応答が snapshot() 全体である
  こと（:818 :858 :879）+ broadcastState 同時発火による実質同値の論証。**サーバ実物で裏取り済み**
  （検証項目 4）。「異論があれば部分適用へ戻すのは容易（ただし単一経路は崩れる）」の可逆性記録も適切。
- (c) **conversation-error 分割の根拠**: Claim **§8-2 に明記**——旧実装の共用実態（自発系と音声系が同一欄）・
  三層 IA での分離必然性・「自発エラーが音声エラーを上書きする相互汚染が構造的に消える（挙動同値以上）」
  の論証。実装と一致（検証項目 2 のエラー欄行で 1:1 確認）。

### design レビュー §9（11 点の申し送り）の消化 — **全点消化を実物で確認**

1. stateLoaded フラグ → app.mjs:108, 175-176（成功 then のみ）✓　2. setSoul 4 点セット → app.mjs:238-242 ✓
3. fire-note 文言体系の view-logic 抽出 → control.mjs 3 関数 + app.mjs:137 で B 暫定移植（旧 app.mjs:128）を統合 ✓
4. applySelfFire/applyVisionTarget の導出抽出 → selfFireToggleView（control.mjs）/ visionTargetLabel（settings.mjs）✓
5. SSE chatStatus 正規化の片寄せ → chatDisplayFromSseStatus（status.mjs:58-60）+ app.mjs:143 ✓
6. controlled 化で selfFireSyncing 不要 → 検証項目 1 ✓　7. Fire 連打防止ローカル busy → localBusy ✓
8. テスト設計指針（hooks 分離・葉部品 vnode）→ cockpit-ui.test §10 の設計（コメントで申し送り 8 を明示参照）✓
9. 初期ロード 3 種は独立 effect → settings-drawer.mjs:151-156 ✓　10. エラー欄 5 つの置き場 → 検証項目 2 ✓
11. CSS は COCKPIT_CSS へ追記・既存トークン再利用 → 検証項目 5（新トークンゼロ）✓

---

## blocking / non-blocking の分離

### blocking — **ゼロ件**（wave-plan §4 の Domain C 該当分すべてクリア・上記逐条表参照）

### non-blocking — 4 件（いずれも対処任意・Domain D または記録で解消）

1. **Fire 連打防止の範囲が原実装より広い（記載精度）**: 原実装は**押した方のボタンだけ**即時 disable
   （:556 は #btn-fire のみ・:574 は #btn-vision-fire のみ——もう片方は SSE soul/応答到着まで押せる）。
   新実装は `localBusy` が FireButtons **両方**に効く（control-bar.mjs:63）＝POST 発射中は両ボタン即時
   disable。二重 POST 防止として改善方向の差分（サーバ側 busy 保護は従来どおり本体）だが、厳密同値では
   ないので §8-3（自発トグルの同種開示）と並ぶ開示があるとより正確だった。Claim §3 の表の disable 式からは
   読み取れる。対処不要・人間ゲートで違和感が出る類でもない。
2. **drawer/control-bar の fetch ハンドラに cancelled ガードが無い（流儀の非対称・実害なし）**: app.mjs の
   init effect は `cancelled` フラグで unmount 後の setState を防ぐが、drawer の初期ロード/各 POST ハンドラと
   control-bar の fireWith には無い。両コンポーネントは App と同寿命（常時 mount）で、unmount 後の
   setState は preact では無害（no-op）のため実害ゼロ。将来 linkedom 梯子で mount/unmount を繰り返す
   テストを書く時に気づく類。記録のみ。
3. **label の for 属性の対応先が消えた（アクセシビリティ微細）**: drawer の `label for="device-select"` 等
   （:372, 386, 403）に対応する id が SettingsSelect の select に無い（原実装は id="device-select" 等で対応
   していた・新実装は className のみ）。channel-url/chat-source の input は id あり対応済み。機能・保存
   オラクルへの影響ゼロ。Domain D のついでに SettingsSelect へ id prop を足すか label の for を外すと正確。
4. **検証限界の記録（構造上の制約・blocking ではない）**: (a) 実装前ベースライン 675 は Orch 確定値・
   B レビュー実測との算数照合のみ、(b) Domain B の ui 3 ファイル + Domain A view-logic の B→C 間バイト
   同一性は特徴点傍証のみ（B 時点にハッシュ記録が無い——**C から sha256 一覧が始まり、D レビューでは
   C の 12 ファイルが機械照合可能になった**＝B spec レビューの提案が実装された形）、(c) ControlBar/
   SettingsDrawer 本体（hooks）の実描画・fetch フロー・controlled 実挙動は機械で見ていない（Claim §8-5 が
   正直に開示・人間ゲート必須項目の列挙も十分）。

---

## §質問（domain-c.md §8）の spec 判定 — いずれも non-blocking

| # | 質問 | spec 判定 |
|---|---|---|
| 1 | 口数は (c)「選択可能・効果ゼロ」で実装 | **non-blocking（L0 裁定記録あり・検証項目 8-a）**。no-op はコードで機械確認済み。人間ゲート手順書への明記は Orch → Domain D 委任プロンプトで管理を。裁定 (a)/(b) への変更コストも記録済みで可逆。 |
| 2 | conversation-error の分割 | **non-blocking（検証項目 8-c）**。旧 5 欄の全文言の行方を 1:1 で確認・行方不明ゼロ。相互汚染の構造的解消は挙動同値以上の整理として妥当。 |
| 3 | 自発トグル失敗時の checked 挙動の微差 | **non-blocking（正直な開示）**。controlled 化の必然的帰結で「UI 表示 = サーバ状態」への改善方向。人間ゲート確認点の指定（未結線で not available・結線済みで snapshot 追従）も適切。 |
| 4 | 自動展開判定に lastDevice を使えない | **non-blocking**。snapshot() 実物で裏取り済み（検証項目 3）。受容の論証（稼働すれば s.device で直行・ワイヤ契約変更は本 wave 不可）は妥当。 |
| 5 | ControlBar/SettingsDrawer 本体の Node 未実行 | **non-blocking（inventory §3 L0 決定どおりの検証範囲）**。検証済み層（view-logic fixture 27 本 + 葉部品 vnode 5 種 + import スモーク + 構造テスト自動走査）と未検証層の線引きが明確。人間ゲート必須項目 9 点の列挙は Domain D 手順書の直接材料になる。 |
| 6 | header.mjs のデッドフォールバック削除見送り | **non-blocking**。「原則不変」優先は妥当・Domain D の旧 CSS 撤去と併せる整理も自然。残存を実物で確認（不変の傍証を兼ねる）。 |
| 7 | SettingsDrawer 常時 mount・CSS で畳む | **non-blocking（設計裁定として妥当）**。初期ロード 1 回（原実装 init と同値）・入力欄状態の保持・畳み中も表示最新の 3 論点が揃う。開閉で effect が再走しない構造は「置くだけで配信される」テストと同様に事実で確認。 |
| 8 | snapshot 全適用への統一 | **non-blocking（検証項目 8-b・サーバ実物で裏取り済み）**。 |
| 9 | Domain D への引き継ぎ最終形 | **non-blocking**。mount 契約不変（cockpit-ui.test の import スモークが固定）・inline module 2 行・旧 style/IIFE 完全撤去・手順書項目の集約先（§8-1 §8-3 §8-5）が明確。 |

---

## Orch への申し送り

- spec レーンとして Domain C は wave-plan §3 Domain C/§4・inventory §2-2/§2-3・cockpit-redesign.md §2/§3/§4/§7 の
  要求を逐条で満たす。**13 エンドポイント結線の全数突き合わせ**（サンプルでなく 13 本全部・サーバ応答形の
  実物確認込み）・保存オラクル運転層/設定層の全項目・token 秘匿・dead 無効・source 復元・lastDevice
  初期選択・導線の二重ガード（stateLoaded + autoOpenedRef）・口数 no-op と KILL 予約の機械確認、
  いずれも自分でソース/原実装/実行結果を file:line まで確認した。
- **Claim の全数字・全 sha256 が自分の再実行・再計算と一致**（702/702・74/74・30/30・30/30・10/10・8・11・8・
  1377 files・器側既存赤 1 件・**sha256 12/12 + vendor**）。sha256 一覧の運用改善（B spec レビュー提案）の
  初適用は成功——**Domain D レビューは C の 12 ファイルの無改変を機械照合できる**。
- design レビュー §9 の 11 点は全点消化を実物で確認（Claim の主張と一致）。
- **Domain D 委任プロンプトに含めるべき事項（本レビューからの追加分）**:
  (a) 人間ゲート手順書に Claim §8-1（口数 no-op）・§8-3（自発トグル失敗時の checked 復帰）・§8-5（9 点の
  確認項目・特に Channel Set 後の入力欄クリア・初回自動展開/二回目直行の再現手順）を確実に反映すること。
  (b) non-blocking 3（SettingsSelect の id/label for 対応）はついで修正の候補。
  (c) 旧 `<style>`・旧 IIFE の完全撤去（B レビューからの承継）+ `<title>` 裁量。
  (d) D レビューでは C の sha256 12 ファイル照合を回すこと（無改変検証の機械化・初運用）。
- 人間ゲートへ: 機械で見ていない層は ControlBar/SettingsDrawer 本体の実描画・fetch フロー・controlled
  実挙動（Claim §8-5 の列挙どおり）。spec 上の残余リスクはここに集中しており、手順書の 9 点が過不足ない。
