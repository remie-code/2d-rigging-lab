# 操縦席UI改定 Domain A レビュー（test レーン）

> レーン: **test**（テストが実在し・主張どおりの挙動を実行を伴って固定し・決定論的で・実ネットに出ないか）。
> レビュアー: Review-Sylph。呼び出し元: Orch-Sylph（操縦席UI改定 wave 実行責任者）。
> 対象: `apps/soul/agent/src/cockpit/view-logic/*.test.mjs`（6 ファイル・28 本）・
> `src/cockpit/cockpit-static-assets.test.mjs`（6 本）・機能同値の照合元 `src/cockpit/cockpit.html`（不改変の正）・
> 背骨 `cockpit-server.test.mjs`（74 本）・`cockpit-page.test.mjs`（30 本・無改変）。日付: 2026-07-14。
> 読み取り専任・自分で再実行した生数字を根拠にする。install/commit/実装変更・実ネット到達は一切していない
> （検証はすべて loopback / ローカルファイル）。`.tmp/facex-*`・`screens/cockpit-ia-redesign.md` は不干渉。
> **総合判定（再確認 2 巡目・最終）: PASS（blocking ゼロ）。** 1 巡目で挙げた blocking 1 件
> （トラバーサルテストが主張する内部ガードを一度も実行を伴って踏んでいない）は、Gnome によるテスト追加
> 3 本＋コメント/Claim 訂正のみの追修正（実装ソース `cockpit-server.mjs` は不変）で解消を確認した（§0-2 参照）。
> 1 巡目（FAIL 判定時点）の記録は §0 以降に履歴として保存。

## 0-2. 再確認（2 巡目）— blocking 解消確認

### 経緯

1 巡目で指摘した blocking: static-assets のトラバーサルテスト 3 入力（生 `..`・`%2e%2e`・二段 `%2e%2e`）は
すべて WHATWG URL パーサ（handleRequest :726 の `new URL`）が pathname 段階で正規化するため
`tryServeUiAsset` の内部トラバーサルガード（:970 ルート脱出判定・:975 サブツリー逸脱判定）が**全 643 本の
どれからも一度も実行されず**、テストコメント/Claim の経路主張（「%2e%2e は正規化を通り抜けガードが弾く」）も
実測と食い違っていた。Orch の裁定により Gnome が追修正——変更は
`cockpit-static-assets.test.mjs`（6→9 本）と `domain-a.md` §3（防御層ごとの実測記述へ書き直し・初版の
誤経路主張の訂正明記）の 2 ファイルのみ・実装ソース不変。

### 1. 追加テスト 3 本が主張するガード分岐を実行を伴って踏むか — **確認: 踏んでいる（PASS）**

追加 3 本（`cockpit-static-assets.test.mjs` :141-158 / :160-175 / :177-193）を読み、`tryServeUiAsset`
（cockpit-server.mjs :952-993）の実装と突き合わせ、さらに**各入力がどの分岐に落ちるかを自分で機械トレース**
（pathname 正規化 → decodeURIComponent → firstSeg → path.resolve/relative → 各ガード評価を Node で再現実行）した:

```
"/vendor/..%2fcockpit-server.mjs"                 -> 層3 サブツリー逸脱ガード(:975)発火（relFromRoot="cockpit-server.mjs"）
"/vendor/..%2f..%2fears%2ftranscript-buffer.mjs"  -> 層2 ルート脱出ガード(:970)発火（relFromRoot="..\ears\transcript-buffer.mjs"）
"/vendor/..%5Ccockpit-server.mjs"                 -> 層3 発火（win32=本環境・path.resolve が \ を区切り解決）
"/vendor/../cockpit-server.mjs"                   -> 握らない（層0: pathname="/cockpit-server.mjs" に正規化済み）
"/vendor/%2e%2e/cockpit-server.mjs"               -> 握らない（層0: 同上）
"/vendor/%2e%2e/%2e%2e/package.json"              -> 握らない（層0: pathname="/package.json"）
```

各テストのコメントが主張する層（単段=層3・二段=層2・`..%5C`=win32 層3/非 win32 ENOENT）と**完全一致**。
到達の必然性もコードから決定論的: `..%2f` 系は pathname に残存（1 巡目の私の実測どおり）→ firstSeg="vendor"
∈ `UI_ASSET_SUBDIRS` なので `tryServeUiAsset` は**必ず握り**（:963 で false になる余地がない）、以降のガード
評価に必ず入る。

**偽装検出（反証構造の検証）**:

- **送信バイトの固定**: 追加 3 本は `net.connect` の raw socket でリクエスト行を手書き（:58-75）——クライアント
  側正規化の余地が構造的にゼロ。Node の HTTP サーバは `req.url` をデコードせず渡すため `..%2f` はサーバまで
  エンコードのまま届く。
- **echo アサート**: 404 JSON の error はサーバ側 pathname を echo する（既存フォールスルー :940・
  握った後の notFound :965 とも `not found: GET <pathname>`）。追加 3 本は**残存形**
  （`/vendor/..%2f…`）の echo を assert.match で要求——もし将来 pathname 導出が変わり層0 で消えるように
  なれば match が落ちて赤くなる。既存の層0 テスト（:107-132）は逆に**正規化済みの形**（`/cockpit-server.mjs` 等）
  の echo を要求＝「実装ガード非到達」の証拠を実行で固定。両者が相補。
- **実在ファイル標的**: 単段/`..%5C` の標的は実在の `cockpit-server.mjs`、二段の標的は実在の
  `src/ears/transcript-buffer.mjs`（実在と `createTranscriptBuffer` の含有を自分で確認）。ガードが無ければ
  `.mjs` 判定を通過して readFile が成功し **200＋ソース漏洩になるはず**の入力なので、404＋非漏洩
  （`doesNotMatch(/createCockpitServer\s*\(/`・`/createTranscriptBuffer/`）はガード実行の実効的な証明になっている。
  「主張する分岐を実行を伴って踏む」という 1 巡目の欠落は解消された。

### 2. 実装コード不変 — **確認: 変更なし（PASS）**

- `git diff --stat -- apps/soul/agent/src/cockpit/cockpit-server.mjs` → **80 insertions のまま**（追修正前と同一）。
- 1 巡目レビューで私が引用したコード片（:726-727 の `new URL`/pathname・:936-940 の握り分岐と既存 404・
  :952-993 の `tryServeUiAsset` 全体＝decodeURIComponent/:963 firstSeg/:965 notFound/:970 層2/:975 層3/
  :979 拡張子/:985 readFile）を今回再読し、**逐語一致**を確認。
- 他の被対象も不変: `git diff --stat -- cockpit-page.test.mjs cockpit.html cockpit-server.test.mjs` → 出力なし。
  view-logic 12 ファイルは 1 巡目時点の mtime のまま・テスト本数 28 不変・全体 +3 = static-assets の 6→9 のみ
  （643+3=646 の整合）。

### 3. コメント・domain-a.md §3 の経路説明の訂正 — **確認: 実測と一致（PASS）**

- `cockpit-static-assets.test.mjs` の層0 テスト（:107-132）は「WHATWG URL パーサが層0 で正規化・
  **実装ガード非到達**」と書き直され、1 巡目で誤りと指摘した「%2e%2e は正規化を通り抜ける」主張は撤去された。
- `domain-a.md` §3 は層0（パーサ正規化・ガード非到達・**初版の誤りを明記**）/層1（握り境界）/層2（ルート脱出・
  `..%2f` 二段が踏む）/層3（サブツリー逸脱・`..%2f` 単段が踏む・`..%5C` の OS 依存注記）の防御層ごとの記述に
  書き直され、上記の私の機械トレース結果と**全層一致**。echo による層識別・実在ファイル標的・raw socket の
  説明も実装/テストの現物と一致する。

### 4. 決定論・ネット純度 — **確認: 保たれている（PASS）**

- `rawSocketGet` は `net.connect({ host: u.hostname, … })` で、`u` は `server.listen(0)` が返す URL（サーバは
  `DEFAULT_COCKPIT_HOST="127.0.0.1"`・非 loopback host は throw する構造）＝ **loopback 限定**。外部 URL・DNS・
  実 fetch は無い。`Connection: close` で応答完結・実タイマ/乱数依存なし。
- 全体 646 本が 1.4 秒で完走（実ネット待ちの兆候なし）。cancelled 0・skipped 0・todo 0。

### 5. 自分で再実行した機械ゲート生数字

`cd apps/soul/agent && node --test`（タイムアウト 300s・1 回で緑・空/interrupted なし・再試行不要）:

```
1..646
# tests 646
# pass 646
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 1398.3158
```

`node --test src/cockpit/cockpit-server.test.mjs` → `1..74 / pass 74 / fail 0`（背骨無退行）。
`node --test src/cockpit/cockpit-static-assets.test.mjs` → `1..9 / pass 9 / fail 0`。
`node --test src/cockpit/cockpit-page.test.mjs` → `1..30 / pass 30 / fail 0`（無改変で緑のまま）。
`grep -c '^test('` → static-assets **9**（6+3）。全て Orch 提示の Claim（646/646・74/74・9/9）と完全一致。

### 2 巡目 総合判定

**PASS（blocking ゼロ）**。1 巡目で挙げた唯一の blocking（内部トラバーサルガードのゼロカバレッジ＋経路主張の
食い違い）は、`..%2f` 単段（層3）・`..%2f` 二段（層2）・`..%5C`（win32 層3）の 3 本の追加で解消された。
3 本とも raw socket で送信バイトを固定し、残存 pathname の echo アサートと実在ファイル標的の反証構造
（ガードが無ければ 200＋漏洩）で「ガード分岐の実行を伴った固定」を達成している。各入力がどの層に落ちるかは
私自身の機械トレースで全ケース確認済み・テスト/Claim の主張と完全一致。実装ソースは diff・逐語照合の両方で
不変、既存テストは全て無退行（646/646・74/74・30/30）、決定論・ネット純度も保たれている。
1 巡目の non-blocking 3 件（transcript.mjs ヘッダの行番号 1 ずれ・visionMarkerText の width 欠落未踏・
formatClock の DST 理論エッジ）はいずれも修正不要の観察であり、本追修正の対象外のまま変わらない（§5 参照）。
2 巡目の再確認で新規の non-blocking は発生していない。

---

# 以下、1 巡目（FAIL 判定時点）の記録（履歴保存）

> 1 巡目の総合判定・生数字（643/643・static-assets 6/6）は追修正前のもの。最終判定は上記 §0-2 を正とする。

## 0. 自分で再実行した機械ゲート生数字

`cd apps/soul/agent && node --test`（全テスト・タイムアウト 300s・1 回で緑・空/interrupted なし・再試行不要）:

```
1..643
# tests 643
# pass 643
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 1413.1543
```

個別実行（いずれも 1 回で緑）:

| 対象 | 実行結果 | Claim（domain-a.md §6） | 照合 |
|---|---|---|---|
| 全体 `node --test` | **643/643**・fail 0・skipped 0・todo 0 | 643/643（609+34） | 一致 |
| `cockpit-server.test.mjs` | **74/74**・fail 0 | 74/74（背骨・無退行） | 一致 |
| `cockpit-page.test.mjs` | **30/30**・fail 0 | 30/30（無改変で緑） | 一致 |
| `cockpit-static-assets.test.mjs` | **6/6**・fail 0 | 6 本 | 一致 |
| `view-logic/format-time.test.mjs` | 4/4 | 4 | 一致 |
| `view-logic/transcript.test.mjs` | 4/4 | 4 | 一致 |
| `view-logic/markers.test.mjs` | 5/5 | 5 | 一致 |
| `view-logic/ghost.test.mjs` | 5/5 | 5 | 一致 |
| `view-logic/status.test.mjs` | 7/7 | 7 | 一致 |
| `view-logic/usage.test.mjs` | 3/3 | 3 | 一致 |

- `grep -c '^test('` によるファイル別本数の機械照合: format-time 4 / transcript 4 / markers 5 / ghost 5 /
  status 7 / usage 3（計 **28**）+ static-assets **6** = **+34**。Claim の内訳と完全一致。skipped 0 / todo 0 /
  `test.skip|test.only|test.todo` の grep ヒット 0 ＝ 緑の偽装は無い。
- ベースライン 609 は実装前状態に戻せないため直接再実行はしていないが、643 − 34（新規の機械照合値）= 609 で
  Orch 確定ベースラインと整合。
- 無改変 Claim の裏取り: `git status --porcelain -- apps/soul/agent` の変更は `.gitignore`・`cockpit-server.mjs` の
  2 件＋新規（static-assets test・vendor/・view-logic/）のみ。`git diff --stat -- …/cockpit-page.test.mjs
  …/cockpit.html …/cockpit-server.test.mjs` → **出力なし**（page test・照合元 HTML・背骨 server test は不改変）。

## 1. view-logic fixture の機能同値性（最重要） — **PASS（全項目一致）**

domain-a.md §4 の対応表が指す cockpit.html の行を自分で読み、fixture の期待文字列と逐語照合した。さらに
status/ghost/markers 系は **cockpit.html の実ロジックを正規表現で切り出して `new Function` で駆動し、純関数の
出力と突き合わせる合成照合**（page test :298-352 と同じ流儀）を自分で実行した——**全ケース MATCH**。

### 1-1. 逐語照合（対応表の全行）

| 純関数 | cockpit.html 実体 | fixture 期待値との照合 |
|---|---|---|
| `pad` | :249（`(n < 10 ? "0" : "") + n`） | 一致。`100→"100"`（桁あふれを切らない）を assert 実在 |
| `formatHms` | :250-253 | 一致。`360_000_000→"100:00:00"`・1s 未満切り捨てまで固定 |
| `formatClock` | :254-257（`getHours/getMinutes/getSeconds`＝ローカル） | 一致。テストは**ローカル成分から epoch を作り戻す**方式（`new Date(2026,0,2,3,4,5).getTime()`）で TZ 非依存に検証＝Claim どおり |
| `computeUptimeMs` | :259（`earsListening ? (uptimeBaseMs + (Date.now() - uptimeAnchor)) : 0`） | 一致。stopped→0・**負クランプしない**（now<anchor で負値）まで assert 実在 |
| `resolveSpeaker` | :388（`d.speaker \|\| "you"`） | 一致。null/""/欠落→"you" 固定 |
| `speakerLabel` | :396（`viewer && displayName ? "viewer(名前)" : speaker`） | 一致。`viewer(taro)`・displayName 欠落/"" の劣化も固定 |
| `speakerRowClass` | :390（`"row speaker-" + speaker`） | 一致 |
| `latencyLabel` | :401-404（`latencyMs != null` のみ `(N.Ns)`） | 一致。**null/undefined→null（履歴行は非表示・live 行のみ）を両方 assert 実在**・`0→"(0.0s)"`（`!= null` の意味論）・toFixed(1) 丸めまで固定 |
| `fireMarkerText` | :456-457 | 一致。`"fired (3 lines, 42 chars injected)"`・欠落→`?` |
| `expressionRowText` | :474-478 | 一致。`"troubled 0.8 ✓4/✗1"`・word 欠落→`?`・applied/rejected 欠落→0 |
| `visionMarkerText` | :495-496 | 一致。`'saw "FooGame" (1920x1080, 123ms)'`・title/elapsed 欠落→`?` |
| `bargeInMarkerText` | :520-521 | 一致。`"interrupted (3/10 chars spoken, 250ms)"` |
| `selfFireMarkerText` | :539 | 一致。kind 非依存・欠落→`?` |
| `discardGhostLabel` | :828 | 一致。`"(discarded)"` |
| `diagnosticGhostLabel` | :830-855（diagnostic 全分岐） | 一致（§1-2 で全型を実行照合） |
| `selfFireGhostLabel` | :877 | 一致。`"(self-fire: silence not fired — busy)"` |
| `chatDiagnosticGhostLabel` | :888-897 | 一致（§1-2 で全 kind を実行照合） |
| `chatStatusView`/`chatDisplayState` | :294-306/:314 | 一致（§1-3 で切り出し駆動照合） |
| `shouldRestoreChatSource` | :311 | 一致。edited/欄非空/source なしの 3 否定条件を個別 assert |
| `channelStatusView` | :347-359 | 一致。`"ws://a/channel — connected"`・idle の**末尾スペース `"channel-status "`**（原実装踏襲）・url 欠落→`"(configured)"` まで固定 |
| `usageNoteText` | :547-554 | 一致。`"usage: input=1200 output=88"`・`vision:true→"usage(vision): …"`・欠落→`?` |

- **em-dash `—`（U+2014）の厳密再現**: `od -c -t x1` によるバイト照合で、cockpit.html 側（:355/:840/:844/:846/:849/:877/:895）
  と view-logic 側（ghost.mjs 6 箇所・status.mjs 1 箇所）がいずれも `e2 80 94` で**バイト一致**することを確認した。

### 1-2. 意図的非表示リスト（wave-plan §4 blocking 基準の核心） — **テストで固定されている（PASS）**

`ghost.test.mjs` に **null を返すことの assert が実在**する（実行を伴った固定）:

- `diagnosticGhostLabel`: `expressionBrokenTag`/`expressionRejected`/`expressionSendError` → null（:52-54）、
  `bargeIn` → null（専用マーカー行へ回る前提・:56）、未知型 `somethingNew`/型欠落 `{}` → null（:58-59）。
  page test :244-246（HTML 側に `=== "expressionBrokenTag"` 等の分岐が**無い**ことの doesNotMatch）と両面から固定。
- `chatDiagnosticGhostLabel`: 観測補助 4 種 `connected`/`stopped`/`ignoredRenderers`/`listenerError` → null
  （:77-80）＋ kind 欠落 → null（:81）。白名簿 5 種（notLive/ended/extractFailed/network/internalError）は表示。

さらに私自身が cockpit.html の diagnostic/selfFire/chatDiagnostic **リスナー本体を切り出して駆動**し
（`addGhostRow`/`addBargeInMarkerRow`/`addSelfFireMarkerRow` を fake フックで捕捉）、全 20 diagnostic 入力・
selfFire 3 入力・chatDiagnostic 10 入力について「HTML 実装が行を作る/作らない・作るならどの文字列か」と
純関数の出力が **ALL MATCH** することを確認した（bargeIn が ghost でなく `bargeInMarkerText` と同一文字列の
マーカーへ回ることも実行で一致）。

### 1-3. Disconnect 有効/無効の page test :298-352 との同結果性 — **実行照合で一致（PASS）**

page test と同じ方式（HTML から `renderChatStatus`/`applyChat` を切り出し fake byId で駆動）で 7 ケース
（dead＋connected:true / connecting / live / retrying / connected:false / state 欠落 / connected:false＋state:"live"）を
駆動し、`chatStatusView(chatDisplayState(chat))` の出力（text・className・disconnectDisabled）と**全ケース MATCH**:

- `dead` は connected:true でも `disconnectDisabled: true`（page test :321 と同値・snapshot 再送で誤再有効化しない）。
- 稼働 3 種（connecting/live/retrying）は有効＋`"chat-status <state>"`。
- connected:false は state:"live" が載っていても `"not connected"`＋無効（connected=false 優先・:314 の畳みと一致）。
- state 欠落＋connected:true は `"connecting"` 扱い（`c.state || "connecting"` と一致）。

## 2. 静的ルートテストの攻撃面カバレッジ — **1 件 blocking（§3）・他は PASS**

`cockpit-static-assets.test.mjs`（6 本）は **実 HTTP**（`createCockpitServer({})` → `listen(0)` → `http.request`・
モックなし）で駆動している。ケースの実在:

| 要求ケース | テスト | 確認 |
|---|---|---|
| 200 + text/javascript（実在 .mjs） | :39-53（vendor）・:55-67（view-logic） | 実在。**ディスク上の実バイトとの `Buffer.equals` 照合付き**（凍結 vendor の無改変配信まで固定・強い） |
| `..` トラバーサル拒否 | :74-76 | 実在。404 ＋ `doesNotMatch(/createCockpitServer/)`＝**ソース非漏洩を本文で直接 assert** |
| URL エンコードトラバーサル（%2e%2e） | :78-83（単段＋ルート脱出の二段） | 実在・404 実測。**ただし主張する防波堤を踏んでいない（§3 blocking）** |
| 非 .mjs 拡張子 404 | :89-101（`/vendor/cockpit.html`・`.js`） | 実在 |
| 存在しない .mjs 404 | :103-115(`does-not-exist.mjs`・未生成 `/ui/app.mjs`) | 実在 |
| 既存 404 フォールスルー無退行 | :117-129（`/not-an-asset.mjs` → JSON `{error:"not found: GET …"}` 形を assert） | 実在。加えて server test :458-460 の `/api/nope` 未知ルート 404 テストが 74 本の中で無退行（自分の再実行で緑） |

## 3. blocking: トラバーサルテストが主張する防波堤（内部ガード）を一度も実行していない

**事実（自分の実測）**: cockpit-server.mjs は pathname を `new URL(req.url, …).pathname`（:726-727）で得る。
WHATWG URL パーサは `%2e%2e` を double-dot segment として**パース時に正規化する**。Node での実測:

```
"/vendor/../cockpit-server.mjs"        -> pathname "/cockpit-server.mjs"
"/vendor/%2e%2e/cockpit-server.mjs"    -> pathname "/cockpit-server.mjs"   ← 正規化される
"/vendor/%2e%2e/%2e%2e/package.json"   -> pathname "/package.json"          ← 正規化される
"/vendor/..%2fcockpit-server.mjs"      -> pathname "/vendor/..%2fcockpit-server.mjs"  ← 残る（すり抜け）
"/vendor/..%5ccockpit-server.mjs"      -> pathname "/vendor/..%5ccockpit-server.mjs"  ← 残る（すり抜け）
```

つまり、テストの 3 つのトラバーサル入力（生 `..`・`%2e%2e`・二段 `%2e%2e`）は**すべて `tryServeUiAsset` に
入る前に無害化され**、第一区画判定（:963）で「握らない」→ 既存 404 フォールスルー、という**同一経路**に落ちる。
実装が主張する内部トラバーサルガード——`decodeURIComponent` 後の `path.resolve`/`path.relative` による
**ルート脱出判定（:970）とサブツリー逸脱判定（:975）は、テストスイート全 643 本のどれからも一度も実行されて
いない**（ゼロカバレッジの防波堤）。

- テストコメント（static-assets.test.mjs:77「%2e%2e は URL 正規化を通り抜け→ tryServeUiAsset の traversal
  ガードが弾く」）は**実測と食い違う**（%2e%2e は正規化を通り抜けない）。domain-a.md §3 の
  「`/vendor/%2e%2e/cockpit-server.mjs` → cockpit-server.mjs が第一区画になり弾かれる」も、実際に弾いているのは
  内部ガード（:975）ではなく「握らない」判定（:963）＋既存 404 であり、経路の主張がずれている。
- 内部ガードが**唯一の防波堤になる実在の攻撃クラスがある**: エンコードされたスラッシュ `..%2f`（および `..%5c`）は
  WHATWG 正規化をすり抜けて pathname に残り、`decodeURIComponent` で `..\/` に戻る——まさに :967-978 が
  受け持つ入力だが、**テストはこれを 1 本も踏んでいない**。将来 pathname の導出やデコード位置が変わる退行を
  現テストは検知できない。
- **実装は正しい（実装の穴ではない）**: 私自身が実サーバ（loopback）へ `..%2f` 系 5 種
  （`/vendor/..%2fcockpit-server.mjs`・`/vendor/..%2f..%2fpackage.json`・`.mjs で戻る脱出`・`..%5c`・
  `/vendor%2f..%2f…`）を投げ、**全て 404・ソース非漏洩**を確認した。よって必要な追修正は
  **テスト追加（`..%2f` の単段＋ルート脱出、期待 404＋非漏洩）とコメント/Claim の経路記述の訂正のみ**で、
  ソース変更は不要。
- 判定根拠: s7 test レーンの前例（「テストは緑だが主張する分岐が一度も実行されていない」を blocking と
  した基準）と同型。「URL エンコードトラバーサル拒否」として固定された入力が、実際にはトラバーサルとして
  サーバの防御コードに到達していない＝**主張どおりの挙動を実行を伴って固定できていない**。

## 4. 決定論・ネット純度 — **PASS**

- **view-logic テスト 6 本**: `grep` で `fetch`/`https`/`http.`/`Date.now`/`Math.random`/`setTimeout`/`setInterval`
  のヒット **0**。入力は全て固定リテラル。`formatClock` は「ローカル成分から epoch を作り戻す」方式
  （`new Date(2026,0,2,3,4,5)`）で TZ に依存せず決定論的（Claim どおりの検証方式であることをコード読解で確認）。
- **view-logic ソース 6 本**: `import`/`require` のヒット **0**（preact どころか依存ゼロの素の純関数）＝
  wave-plan blocking 基準 3「preact 非依存の純関数＋fixture 必須」を満たす。6 モジュール全てに fixture テストが対応。
- **static-assets テスト**: 到達先は `createCockpitServer({})` → `listen(0)` の loopback のみ。サーバ自体が
  非 loopback host を throw で拒否する構造（cockpit-server.mjs:85-89・`DEFAULT_COCKPIT_HOST="127.0.0.1"`）。
  外部 URL・DNS・実 fetch は無い。ポートは OS 任せ（listen(0)）で衝突しない。
- **実ネット不出**: vendor 取得（実装時の 1 回・curl）以後、機械テストは実ネットに出ない。全体 643 本が
  1.4 秒で完走していることも傍証。全実行で cancelled 0・skipped 0・todo 0。

## 5. blocking / non-blocking の分離

**blocking: 1 件**

1. **静的ルートの内部トラバーサルガード（cockpit-server.mjs:967-978）がゼロカバレッジ**（§3）。
   `%2e%2e` テストは WHATWG 正規化により「握らない→既存 404」経路しか踏んでおらず、テストコメントの
   「tryServeUiAsset の traversal ガードが弾く」という主張は実行を伴っていない。内部ガードが唯一の防波堤と
   なる `..%2f`（エンコードスラッシュ）系が未テスト。**修正はテストのみ**: `..%2f` 単段＋ルート脱出の 2 ケースを
   static-assets テストへ追加（期待 404＋ソース非漏洩・実装は私の実測で既に正しい）+ :77 コメおよび
   domain-a.md §3 の経路記述の訂正。

**non-blocking（軽微・修正不要または文書訂正のみ）:**

1. **transcript.mjs ヘッダの行番号 1 ずれ**: 「resolveSpeaker → :389」とあるが実体は cockpit.html:388
   （引用コード自体は正しい・他の対応行は全て正確）。文書精度の問題のみ。
2. **visionMarkerText の width/height 欠落ケースが fixture 未踏**: 欠落時は原実装・純関数とも
   `"…(undefinedxundefined, …)"` になる（機能同値は保たれている）。SSE 契約上 width/height は必ず載るため
   実害なし。網羅性の観察のみ。
3. **formatClock テストの理論エッジ**: `new Date(2026,0,2,3,4,5)` 等が DST 遷移でスキップされる時刻に当たる
   TZ が理論上あり得るが、使用している 3 時刻（1/2 03:04・6/13 14:25・12/31 00:00）に該当する実在 TZ は無く
   実質決定論的。観察のみ。

## 6. §質問（Orch への申し送り）

1. blocking 1 の追修正は「static-assets テストへの 2 ケース追加＋コメント訂正＋domain-a.md §3 の経路記述訂正」の
   狭い委任で足りると判断する（ソース不変・私の実測で実装の正しさは確認済み）。Gnome へ再委任時は、追加テストが
   `..%2f` を**エンコードのまま**送ること（`http.request` の path にそのまま渡す・rawGet 流儀）を明記されたい
   （fetch 系クライアントだと送信前に正規化される恐れがある）。
2. domain-a.md §2 の「preact 10.29.7 は独立検証不可（sha256 が正確なバイトを固定）」という記録は test レーン
   としては受容（vendor の実バイト配信は `Buffer.equals` テストで固定されている）。バージョン主張の真偽は
   spec レーンの領分として深追いしていない。
