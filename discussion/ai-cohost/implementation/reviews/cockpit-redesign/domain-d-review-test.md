# 操縦席UI改定 Domain D レビュー（test レーン）

> **2 巡目追記あり（§7・2026-07-14）**: 1 巡目 non-blocking W4（feedAfterSseEvent の 3 ディスパッチ
> 未踏）に対する Gnome の追修正（cockpit-ui.test に assert 3 本追加・rows.mjs 不変）を test レーンで
> 再確認 → **穴解消を反証実験で実証・PASS 維持**。1 巡目の記録（§0〜§6）は履歴として不変。

> レーン: **test**（テストが実在し・主張する挙動を実行を伴って固定し・決定論的で・実ネットに出ないか。
> 本 Domain の焦点は **新 page test 4 本の実効性** と **旧 30 本 → 新固定先対応表の網羅性**）。
> レビュアー: Review-Sylph。呼び出し元: Orch-Sylph（操縦席UI改定 wave 実行責任者）。
> 対象: `apps/soul/agent/src/cockpit/cockpit-page.test.mjs`（旧 30 本 → 新 4 本・ヘッダ対応表）・
> 照合元 `git show HEAD:…/cockpit-page.test.mjs`（旧 30 本の実物・382 行）・新固定先
> `view-logic/*.test.mjs`（9 ファイル 53 本）/`cockpit-ui.test.mjs`（30 本）/`cockpit-static-assets.test.mjs`
> （10 本）/`cockpit-server.test.mjs`（74 本・不変）・実装 `cockpit.html`（27 行）/`ui/*.mjs`（7 ファイル）。
> 日付: 2026-07-14。読み取り専任・自分で再実行した生数字を根拠にする。install/commit/実装変更・実ネット
> 到達は一切していない（検証はすべて loopback / ローカルファイル / scratchpad 上の変異照合スクリプト）。
> `.tmp/facex-*`・`screens/cockpit-ia-redesign.md` は不干渉。
> **総合判定: PASS（blocking ゼロ・non-blocking 6 件＝修正不要の観察 1 件を除き安価な任意改善）。**
> **旧 30 本を HEAD から 1 本ずつ読み、新固定先の実在と固定内容を逐条照合した（§1）。対応欠落ゼロ・
> 人間ゲート移管（旧 17 等）の明記は正直。弱化は 5 系統を特定したが、いずれも L0 裁定の内側か
> 実体実在を私が grep 実測で確認済み＝blocking なし。新 4 本は変異 14 種の反証実験で実効性を実証（§2）。**

## 0. 自分で再実行した機械ゲート生数字

`cd apps/soul/agent && node --test`（全テスト・タイムアウト 300s・1 回で緑・空/interrupted なし・再試行不要）:

```
1..676
# tests 676
# pass 676
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 1525.5524
```

個別実行（いずれも 1 回で緑・fail 0・cancelled 0・skipped 0・todo 0）:

| 対象 | 実行結果 | Claim（domain-d.md §6 / Orch ベースライン） | 照合 |
|---|---|---|---|
| 全体 `node --test` | **676/676** | 676/676 | 一致 |
| `cockpit-server.test.mjs` | **74/74** | 74/74（背骨＝ワイヤ契約 16+13+6 無退行） | 一致 |
| `cockpit-page.test.mjs`（新） | **4/4** | 4/4 | 一致 |
| `cockpit-ui.test.mjs` | **30/30** | 30/30（D-4 の 2 修正で無退行） | 一致 |
| `cockpit-static-assets.test.mjs` | **10/10** | 10/10 | 一致 |
| view-logic 9 テストファイル一括 | **53/53** | 53/53 | 一致 |

- **算術の整合: 702（C レビューで私自身が確定したベースライン）− 30（旧 page test 撤去）+ 4（新）= 676**。一致。
- 本数の機械照合（`grep -c '^test('`）: page **4** / ui **30** / static **10**。`test.skip|test.only|test.todo`
  のヒット **0**（page/ui とも）＝緑の偽装は無い。
- 器・不可侵の裏取り（git 実測）: `git diff --stat -- …cockpit-server.test.mjs pnpm-lock.yaml
  …package.json apps/runtime-player packages` → server test・lockfile・package.json・器・packages は
  **出力なし**（不変）。`cockpit-server.mjs` は **80 insertions のまま**（Domain A 時点と同一＝本 Domain
  不触の Claim と一致）。
- **sha256 全一致**（domain-d.md §1 の記録 vs 私の実測）: cockpit.html `d11a5768…` ✓ /
  cockpit-page.test.mjs `7fbb5613…` ✓ / settings-drawer.mjs `23d0650e…` ✓ / header.mjs `63ae43a9…` ✓ /
  vendor `72284e8e…` ✓（凍結無改変）。

## 1. 旧 30 本 → 新固定先の逐条対応検証（最重要） — **PASS（対応欠落ゼロ・弱化 5 系統は §5 で判定）**

旧 30 本を `git show HEAD:` から自分で全読し、番号付け（旧 1〜30 = ファイル内出現順）が新 page test
ヘッダ対応表・domain-d.md §2 と**一致することを確認**した上で、各本が固定していた挙動の新固定先を
実物（テスト/実装/手順書）で照合した。判定凡例: **強**=regex 固定 → 実行固定へ強化 / **同**=同等 /
**弱 (Wn)**=固定手段が弱まった（§5 で blocking/non-blocking 判定）。

| 旧 | 固定していたもの（HEAD 実物） | 新固定先（実在を自分で確認したもの） | 判定 |
|---|---|---|---|
| 1 | GET / 200+text/html+**9 リージョン id**（ears-status/health-whisper/health-ffmpeg/device-select/btn-start/btn-stop/timeline/footer-discarded/footer-uptime） | page(1)（実 HTTP: 200+text/html+div#app+inline module 逐語）+ Header vnode（Listening/whisper/ffmpeg/出力先/⚙ 実行走査）。mic/Start/Stop・計器・timeline の**区画実在**は SettingsSelect vnode+Feed `.feed-meta`（コード実在 :128-130 確認）+ **human-gate §4-1/§6** | 同/弱 W1 |
| 2 | `new EventSource("/api/events")`・/api/devices・/api/state・/api/ears/start・/api/ears/stop・SSE 4 種購読 regex | SSE_EVENT_NAMES **13 本** deepEqual（4→13 へ強化・改名検知可）+ app.mjs :158-165 購読ループ（コード）+ **私の grep 実測: UI コードの fetch/ES 到達面 16 面全実在**（§1-1）+ server test 74（片側固定） | 強/弱 W2 |
| 3 | 自己完結 4 regex（script src / link stylesheet / https? src・href / @import url） | page(3): **同一 4 regex + `from https?:` 追加＝旧の厳密スーパーセット**（変異実験 §2-2 で退行ゼロを実証） | **強** |
| 4 | `latencyMs != null` 分岐の regex | latencyLabel fixture（null/undefined→null・0→"(0.0s)"・丸め）+ feedFromHistory fixture（履歴 3 行全 latText null）+ FeedRow vnode（latText null 非描画） | **強** |
| 5 | discard ハンドラ内 footer-discarded 文字列 + addGhostRow | feedAfterSseEvent discard fixture（ghost 行 "(discarded)" 実行固定）。**カウンタ表示**は app.mjs :131（コード）+ Feed .feed-meta `.footer-discarded`（コード実在確認）+ human-gate §6 | 強/弱 W1 |
| 6 | asrFailure 分岐 + addGhostRow の regex | ghost.test（"(asr failed)"）+ cockpit-ui.test diagnostic fixture（実行） | **強** |
| 7 | addGhostRow 本体 `"row ghost"` + CSS `--muted` | rows fixture（kind:ghost）+ COCKPIT_CSS 検査（ghost italic = §7 承認の新意匠）。CSS 規則 `.row.ghost` 実在は styles.mjs :184-185（私の grep 実測） | 同/弱 W3 |
| 8 | btn-fire/soul-status/fire-note id + POST /api/fire regex | FireButtons vnode（disable 3 態 + ラベル実行走査）+ control.test（fireNoteFromFireResponse 5 態 = 503 文言込み）+ fireWith("/api/fire")（control-bar.mjs :169 grep 実測） | 同/弱 W2 |
| 9 | soul 購読 + applySoulState disable の regex | soulStatusView fixture（7 入力・C レビュー G1 で旧実行照合 MATCH 済み）+ FireButtons vnode（thinking 両 disable 実行） | **強** |
| 10 | fire リスナ accepted===true + マーカー/setFireNote | feedAfterSseEvent fire fixture（true/false）+ fireNoteFromSseFire fixture（4 態） | **強** |
| 11 | addFireMarkerRow 本体（class/includedCount/injectedChars）+ CSS `--speaking` | fireMarkerText fixture（3 態）+ rows fixture（whoText/markerText/text/atMs 優先）。CSS 規則 `.row.fire-marker` 実在 = styles.mjs :187（grep 実測・機械検査対象外） | 強/弱 W3 |
| 12 | fireEmptyReply/fireError 分岐 regex | ghost.test（両型 + message 欠落 →"unknown"） | **強** |
| 13 | `"row speaker-" + speaker` + CSS `.row.speaker-soul .who` | speakerRowClass fixture + rows fixture。CSS 規則実在 = styles.mjs :178（grep 実測） | 強/弱 W3 |
| 14 | channel-url/btn-channel-set/channel-status の id 実在 | settings-drawer onChannelSet（コード :210-229・対応行コメント）+ channelStatusView fixture + human-gate §4-2 | 弱 W1 |
| 15 | POST /api/channel + 入力値送信 regex | onChannelSet :213-216（`JSON.stringify({url:raw})`・grep 実測）+ server test | 弱 W2 |
| 16 | applyChannel 実在 + applyChannel(s.channel) + CSS 色 2 種 | channelStatusView fixture 8 態（C レビュー G4 旧実行照合 MATCH）+ app.mjs applyState :121 + DrawerStatus vnode（class 合成実行固定）。CSS 規則実在 = styles.mjs :353-355（grep 実測） | 強/弱 W3 |
| 17 | Set 後 `value = ""` の regex（token 秘匿） | onChannelSet :226 `setChannelUrl("")`（:766 対応行コメント）+ **human-gate §4-2 が確認点**。**hooks 内実挙動 = 機械固定不能の人間ゲート移管が、対応表・domain-d.md §2・human-gate.md の 3 箇所に正直に明記** | 同（移管正直） |
| 18 | expression 購読 + addExpressionRow 呼出の regex | feedWithExpression fixture（実行）+ expressionRowText fixture（3 態）。**ただし feedAfterSseEvent("expression") ディスパッチは未踏**（§5 W4）・対応表の「cockpit-ui.test（feedAfterSseEvent）」記載は実体と 1 箇所ずれ | 強/弱 **W4** |
| 19 | addExpressionRow 本体（word/applied/rejected）+ CSS `--accent` | expressionRowText fixture + rows fixture + FeedRow vnode（↳ 実行走査）。CSS 規則実在 = styles.mjs :189-191（grep 実測） | 強/弱 W3 |
| 20 | expressionUnknownTag 表示 + 3 種 doesNotMatch | ghost.test（unknown tag + 意図的非表示 3 種 null）+ cockpit-ui.test（**同一 feed 参照 assert = 「行を作らない」の最強不変証明**） | **強** |
| 21 | chat-source/btn-chat-connect/btn-chat-disconnect/chat-status の id 実在 | settings-drawer 結線（コード :232-266）+ chatStatusView fixture + human-gate §4-5 | 弱 W1 |
| 22 | POST /api/chat/connect + source 送信 + disconnect の regex | onChatConnect/onChatDisconnect（コード・対応行コメント・grep 実測）+ server test | 弱 W2 |
| 23 | applyChat 実在 + CSS 3 種（live/retrying/dead） | chatStatusView fixture（class 3 態）+ chatDisplayState fixture + shouldRestoreChatSource fixture（5 態 = source 復元・入力中非復元）。CSS 規則実在 = styles.mjs :356-359（grep 実測） | 強/弱 W3 |
| 24 | viewer displayName regex + `viewer(` + CSS | speakerLabel fixture（viewer(taro) + displayName 欠落劣化 2 形）+ rows fixture（"row speaker-viewer"）+ COCKPIT_CSS 検査（--speaker-viewer トークンあり）+ 規則実在 :179-180 | **強** |
| 25 | chatStatus 購読 + renderChatStatus 単一経路 regex | chatDisplayFromSseStatus fixture（5 態・欠落 →connecting）+ cockpit-ui.test（chatStatus は行を作らない）+ app.mjs :142-143 | **強** |
| 26 | **new Function 駆動**: dead→disabled true・3 稼働態・not connected | chatStatusView fixture が**同一の入力空間**（dead/3 稼働態/falsy 3 態 × text/class/disconnectDisabled）を宣言的に固定。C レビュー G5 で旧コード実行照合 MATCH 済み。domain-d.md §7-2 の整理（「駆動しないと検証できない構造が消えた」）は**正確** | **同** |
| 27 | 単一経路 regex（renderChatStatus 委譲・disabled=false 不在） | chatStatusView が唯一の導出関数 + `chatView.disconnectDisabled` の**参照が settings-drawer.mjs :360 の 1 箇所のみ**（grep 実測 = 単一経路の構造証明） | **同** |
| 28 | chatDiagnostic 購読 + 4 kind + addGhostRow | chatDiagnosticGhostLabel fixture（表示 5 種 + 観測補助 4 種 null + kind 欠落 null）+ feedAfterSseEvent fixture（notLive 表示 + 補助 4 種同一 feed） | **強** |
| 29 | chatBufferAbsent 分岐 regex | diagnosticGhostLabel fixture（"(chat: ears not running — comment did not merge)" 逐語） | **強** |
| 30 | addSelfFireMarkerRow が d.kind をそのまま描く regex | selfFireMarkerText fixture（silence/comment-call/{}→"?"）+ rows fixture + feedAfterSseEvent selfFire fixture（fired 両分岐） | **強** |

**集計**: 強 15 / 同 3 / 強・弱併記 8 / 弱のみ 4。**対応先が実在しない旧テストはゼロ**。人間ゲート移管
（旧 17 の入力欄クリア・旧 1/14/21 の区画実在・旧 5 のカウンタ表示）は human-gate.md の当該節に確認
チェックボックスが**実在**することを全て照合した（§4-1/§4-2/§4-5/§6）。

### 1-1. W2（URL 結線）の実測補完

fetch URL 結線の機械固定が「コード対応行コメント + server test 片側固定」へ弱化した分は、私が grep で
**UI コードの到達面 16 面全部の実在を確認**した: EventSource `/api/events`（app.mjs :158）・
`/api/state`（app.mjs :169）・`/api/devices`/`/api/windows`/`/api/audio-devices`/`/api/ears/start`/
`/api/ears/stop`/`/api/channel`/`/api/chat/connect`/`/api/chat/disconnect`/`/api/vision-target`/
`/api/audio-device`（settings-drawer.mjs）・`/api/fire`/`/api/vision-fire`/`/api/self-fire`
（control-bar.mjs）。URL が 1 つでも誤っていれば server test は守れないが人間ゲート §4〜§5 の当該操作で
即 FAIL する（検知経路あり）。

## 2. 新 4 本の実効性 — **PASS（変異 14 種の反証実験で実証）**

### 2-1. (1) エントリ構造・(4) 起動配線スモーク

- **(1)**: 実 HTTP（`createCockpitServer` → `listen(0)`）で 200+text/html を取り、div#app・
  `<script type="module">`・`import { mount } from "./ui/app.mjs"`・`mount(document.getElementById("app"))`
  の 4 点を assert.match。**現物 cockpit.html :21-24 と逐語一致**を目視照合（アサーションが実 HTML と
  乖離していない）。
- **(4)**: specifier を**応答 body から抽出して辿る現物駆動**（ハードコードでない = HTML の import 行が
  変わればまず抽出 assert.ok が落ちる）。GET / → /ui/app.mjs（200 + text/javascript）→ app.mjs の実 body に
  vendor への相対 import を assert.match → /vendor/htm.preact.standalone.mjs（200 + JS MIME + 非空）と
  **縦一列を同一サーバで実 HTTP 確認**。`server.close()` は finally（テスト 1 回で完走 = 終了処理実証）。
  横方向（ui 7 ファイル相互 import 閉包・全ファイル配信）は cockpit-ui.test 構造テスト +
  static-assets.test（**ui 7 ファイルを Buffer.equals ディスク実バイト照合**・:226-237 を実読）が
  固定済み——「代表縦経路のみ」というテスト内コメントの役割宣言は正確で誇張なし。

### 2-2. (2) 死コードゼロ・(3) 自己完結の反証実験（scratchpad 変異照合・リポジトリ不触）

テストの regex を**逐語複製**し、現物 cockpit.html に旧 UI 断片/外部依存を差し込んだ変異 14 種へ適用:

| 変異 | 結果 |
|---|---|
| baseline（現物） | 両テスト素通り（誤検知なし）✓ |
| A: 旧 DOM `id="channel-url"` 復活 | (2) が**検知** ✓ |
| B: 旧 IIFE `byId(` 復活 | (2) が**検知** ✓ |
| C: 旧 CSS `.row.ghost` セレクタ復活 | (2) が**検知** ✓ |
| D: 旧 DOM `id="timeline"` 復活 | (2) が**検知** ✓ |
| E: FOUC 根拠コメント削除 | (2) が**検知** ✓ |
| F: `<script src>` 追加（ローカルでも） | (3) が**検知** ✓ |
| G: 外部 stylesheet 追加 | (3) が**検知**（2 regex 重複検知）✓ |
| H: import 文が外部 URL（esm.sh） | (3) が**検知**（新設 `from https?:` の実効）✓ |
| I: `<img src="https:…">` 追加 | (3) が**検知** ✓ |
| J: `@import url(https:…)` 追加 | (3) が**検知** ✓ |
| K: protocol-relative `src="//…"` | **素通り**（旧テストも同一の穴 = 継承） |
| L: dynamic `import("https://…")` | **素通り**（inline module 化で新たに意味を持つ穴・旧でも素通り） |
| M: `@import "https:…"`（url() なし形） | **素通り**（旧から継承） |
| N: 実行時 `fetch("https://…")` | **素通り**（旧から継承・静的検査の原理的限界） |

- **旧 UI 復活の検知力**: 代表識別子（byId・旧 id 6 種・旧セレクタ 2 種）はいずれも旧 913 行 HTML に
  実在した識別子（旧テスト自身が match で固定していたもの = 選定根拠が旧テストと同源）で、変異 A〜E が
  全て検知された。**楔として実効**。
- **自己完結の検出力**: 新 regex 集合は旧の**厳密スーパーセット**（検出力の退行ゼロ・H で追加分の実効を
  実証）。素通り 4 種のうち 3 種（K/M/N）は旧テストから継承した既知の限界、1 種（L）は §5 W5。

## 3. 決定論・ネット純度 — **PASS**

- **新 page test 4 本**: `Date.now|Math.random|setTimeout|setInterval|EventSource|https?://` の grep
  ヒット **0**。テスト (2)(3) は readFileSync のみ（ネット接触ゼロ）。(1)(4) の到達先は
  `createCockpitServer({…}).listen(0)` が返す URL のみ（`DEFAULT_COCKPIT_HOST="127.0.0.1"`・
  cockpit-server.mjs は 80 insertions のまま不変を diff で確認）＝ **loopback 限定・実ネット到達点ゼロ**。
- ポートは OS 割当（listen(0)）で衝突なし・server.close は finally・全体 676 本が **1.53 秒**で完走
  （実ネット待ちの兆候なし）。cancelled/skipped/todo すべて 0。
- SSE 購読・タイマ（app.mjs の setInterval :193）はテスト中に一切実行されない（page test はモジュールを
  HTTP で**配るだけ**で import しない・App 本体は全テストを通じ未実行 = L0 裁定の既定）。

## 4. テスト資産全体の最終形（Orch 完了報告の材料） — **役割分担は明確・空隙は記録済み + 1 点**

cockpit 関連 171 本の最終構成と役割（今回全レイヤを自分で実行・全緑）:

| 層 | テスト | 本数 | 役割 |
|---|---|---|---|
| ワイヤ契約 | cockpit-server.test.mjs | 74 | **無退行の背骨**（16 エンドポイント × 13 SSE × 6 設定キー・本 wave 全域で 1 バイト不変） |
| 表示ロジック | view-logic/*.test.mjs（9 ファイル） | 53 | 表示文字列・状態導出の fixture（旧実装と機能同値 = B/C レビューの旧コード実行照合 113+53 ケース ALL MATCH 実績） |
| UI 構造 | cockpit-ui.test.mjs | 30 | import スモーク・閉域・SSE リスト・rows fixture・vnode 走査・CSS 代表検査 |
| 配信 | cockpit-static-assets.test.mjs | 10 | トラバーサル防止・MIME・ui 7 + vendor + view-logic の実バイト配信 |
| エントリ | cockpit-page.test.mjs（新） | 4 | 最薄エントリ構造・死コードゼロ・外部ネットワーク非依存・起動配線縦スモーク |

- **重複**: 同一対象の異層検証（例: chatStatusView の fixture=導出 と DrawerStatus vnode=写像、
  feedWith* fixture=行構築 と FeedRow vnode=描画）で、無駄な二重固定ではなく設計どおりの積層。
- **空隙**: (a) hooks 本体（App/Feed/ControlBar/SettingsDrawer）未実行 = L0 裁定・human-gate.md §6 +
  followup §3（linkedom 梯子・トリガ付き）に記録済み。(b) **feedAfterSseEvent の
  transcript/expression/visionCaptured の 3 ディスパッチ未踏**（§5 W4・本レビューの新規発見）。
  (c) CSS 規則実在の機械検査は代表のみ（W3・実体は全実在を実測）。(d) エントリの `<title>` 非固定
  （domain-d.md §7-1 が意図として明記 = 1 行修正を機械が縛らない裁量・正直）。
- 総本数 30→4（−26）の理由付け（「検証対象自体が view-logic/ui へ移管済み」）は §1 の逐条照合の
  とおり**事実**。新 4 本が固定するのはエントリ層に新しく生まれた契約のみ、という切り分けも正確。

## 5. blocking / non-blocking の分離

**blocking: 0 件**

**non-blocking（W1〜W3 は L0 裁定内の観察・W4/W5 は安価な任意改善・6 は文書精度）:**

1. **W1（旧 1/5/14/21）: 区画・入力・計器の「画面に載る」機械固定が human-gate へ移管**: hooks 本体
   未走査の構造的帰結（L0 裁定の内側）で、human-gate.md §4-1/§4-2/§4-5/§6 に確認点が実在することを
   照合済み。旧固定も「id 文字列が HTML にある」程度の弱い regex だった。観察のみ。
2. **W2（旧 2/8/15/22）: fetch URL 結線の機械固定 → コード対応行コメント + server test 片側固定**:
   私の grep 実測で UI 到達面 16 面全実在（§1-1）。linkedom 梯子導入時に fetch spy で固定可能
   （followup §3 のトリガ運用のまま）。観察のみ。
3. **W3（旧 7/11/13/16/19/23）: CSS 規則実在の機械検査が旧より狭い**: 旧 page test が regex 固定していた
   規則（.row.fire-marker/.row.expression/.row.speaker-soul/.channel-status 色 3 種/.chat-status 色 4 種）は
   新 CSS 検査（§7 トークン + 代表 8 点）の対象外。**全規則の実体は styles.mjs :177-206/:353-359 に実在を
   grep 実測**——欠落ではなく検査対象の絞り込みで、視覚は人間ゲートの領分という wave-plan 裁定内。
   気になるなら cockpit-ui.test の CSS 検査へ数行で足せる。観察のみ。
4. **W4（旧 18・本レビューの新規発見）: feedAfterSseEvent の transcript / expression / visionCaptured の
   3 ディスパッチ case が fixture 未踏**: 単一経路 feedAfterSseEvent の 13 イベント中 10 は fixture が
   踏んでいるが、この 3 つは feedWith*（両端）だけが固定され、**委譲 1 行（case → feedWith* 呼び出し）が
   機械固定外**。例えば `case "transcript"` を誤変更しても 676 本は緑のまま（人間ゲート §6 行種 1/5/6 で
   検知はされる）。B レビューの合成照合（13 イベント × 53 ケース）で旧実行と MATCH 済みの実績があり
   実装は正しいが、恒久テストとしての穴。**修正は cockpit-ui.test に assert 3 本の追加のみ**（推奨・
   本 wave 内でも追撃でも可）。併せてヘッダ対応表・旧 18 の「cockpit-ui.test（feedAfterSseEvent）」は
   実体が feedWithExpression fixture である点で 1 箇所前のめり（対応表の記載精度）。
5. **W5: 自己完結検査の残穴**: protocol-relative `//`・`@import "…"`（url() なし形）・実行時 fetch は
   旧から継承した既知の限界（検出力の退行はゼロ = §2-2）。**dynamic `import("https://…")` だけは
   inline module 化で新たに意味を持つ穴**（旧 IIFE には存在し得なかった形）。`/import\s*\(\s*["']https?:/i`
   の 1 regex 追加で塞げる（ui 側閉域テストの同種穴 = B レビュー non-blocking 1 とセットで安価）。任意。
6. **followup §8 の non-blocking 残の列挙が design レーン中心**: test レーンの持ち越し（閉域検出器の
   import 形の穴 = B-1・injectStyles の fake doc 実行固定 = B-3）が台帳に明示されていない（verbosity
   fetch spy は §1・linkedom は §3 で実質カバー）。文書精度のみ。

## 6. §質問（Orch への申し送り）

1. **W4（feedAfterSseEvent の 3 ディスパッチ）だけは「安価 × 中核行種（転写行を含む）」の組**なので、
   人間ゲート前に Gnome へ 3 assert の追加を委任する価値がある（cockpit-ui.test :205 以降の既存 fixture 群
   と同型・5 分仕事・676→679）。ただし人間ゲート §6 が同じ穴を検知できるため、ゲート後の追撃に回しても
   リスクは限定的——裁量に委ねる。
2. 新 4 本の (2) 死コードゼロは domain-d.md §7-3 のとおり指示外の裁量追加だが、反証実験の検知力
   （変異 A〜E 全検知）から test レーンとしては**残す価値がある**と判定する（削除不要）。FOUC コメント
   assert（/FOUC/）は文言依存で brittle だが、意図的な楔（正本 styles.mjs の明記を守る）として機能して
   おり許容。
3. 旧 30 本の照合元（HEAD の旧 page test）は git 履歴に恒久保存されるため、C レビュー §9-1 の「旧 IIFE
   照合は D 発進前が最後」のような時限性は本件には無い（将来も `git show HEAD~n:` で再照合可能）。
4. 数字の最終確認: 全体 676 = server 74 + page 4 + ui 30 + static 10 + view-logic 53（cockpit 171）+
   その他の魂テスト 505。Orch ベースライン（676/676・74/74・4/4・30/30・10/10）と**全一致**・
   claim との不一致ゼロ。機械ゲートの test レーン要件は充足——**残るは人間ゲートのみ**という
   domain-d.md の Status に test レーンとして異存なし。
   （**※ §6-1 の申し送りは 2 巡目 §7 で消化された** = W4 を Gnome が追修正・穴解消を実証済み。
   数字は 676→**679** へ更新。）

## 7. 2 巡目: W4 追修正の test レーン再確認（2026-07-14） — **PASS（穴解消を反証実験で実証）**

### 7-0. 経緯

1 巡目 non-blocking §5-W4（feedAfterSseEvent の transcript / expression / visionCaptured の 3 ディスパッチ
case が fixture 未踏 = 両端の feedWith* だけ固定・委譲 1 行が機械固定外）に対し、Gnome が **cockpit-ui.test
に assert 3 本を追加**（30→33）+ 対応表旧 18 の記載訂正で応えた。Orch から「rows.mjs 不変・test レーンのみ
再確認（spec/design 再走不要）・穴が実際に塞がれたかを反証実験で実証」の委任。読み取り専任・リポジトリの
rows.mjs は一切触らず（scratchpad の変異照合のみ）。

### 7-1. rows.mjs 不変の確認（実装コードが変わっていない）

- rows.mjs は untracked（A/B/C 新設ファイル）のため `git diff` は構造上空 → **実装不変の裏取りは
  sha256**: 実測 `29f8897c6a5c096ee7bc3f2cadba13676caf9aef6e86f71f7a1a92f3e6812495` は **domain-d.md §1
  の記録および 1 巡目に私が全読した内容と同一ハッシュ**（1 バイトも変わっていない）。`git status
  --porcelain -- ui/rows.mjs` → `??`（untracked のまま = 追跡開始も削除もなし）。
- 変更は cockpit-ui.test.mjs（テストのみ・+3 本）+ 対応表訂正のみ。Orch の裏取り（rows.mjs diff 空）と一致。

### 7-2. W4 穴解消の反証実験（scratchpad・rows.mjs 不触） — **穴は実際に塞がれた**

rows.mjs を scratchpad へコピー（view-logic への相対 import を実ファイルの file URL に付け替えただけ・
**ロジックは無改変**）し、feedAfterSseEvent の 3 case を 1 つずつ壊した変異版を作って、追加 assert 3 本
（cockpit-ui.test :220-253 を逐語移植）を各変異版に対して実行した:

| 変異（壊し方） | transcript assert | expression assert | vision assert | 標的が RED か |
|---|---|---|---|---|
| healthy（無変異） | GREEN | GREEN | GREEN | —（誤検知なし ✓） |
| **M1**: `case "transcript"` 改名 → default 落ち（rows 空） | **RED** | GREEN | GREEN | **YES ✓** |
| **M2**: expression の行構築取り違え（`feedWithExpression`→`feedWithTranscript`） | GREEN | **RED** | GREEN | **YES ✓** |
| **M3**: `case "visionCaptured"` 改名 → default 落ち | GREEN | GREEN | **RED** | **YES ✓** |

- **核心の実証**: 3 変異すべてで**対応する標的 assert が RED 化**し、非標的は GREEN（各 assert が独立の
  `emptyFeed()` から始まる = 相互汚染なし）。健全版は全 GREEN（偽陽性なし）。変異版は「置換適用=yes」を
  スクリプトが確認済み（no-op 変異による偽装検知の防止）。
- **M2 が最重要**: case ラベルを残したまま**別の行構築関数へ取り違え**た変異でも RED になる = テストが
  「両端の feedWith* 固定」でなく **feedAfterSseEvent のディスパッチ本体（case → 正しい行構築関数の対応）を
  踏んでいる**ことの構造証明。row.kind（transcript↔expression）・row.thumbSrc（vision 固有・他の行構築
  関数には無い）・rowClass（speakerRowClass 由来）等の**その case でしか生まれないフィールド**を検証点に
  選んでおり、取り違えを確実に捕捉する。W4 の穴は塞がれた。

### 7-3. 対応表旧 18 の訂正

cockpit-page.test.mjs :54 を再読: 旧 `cockpit-ui.test（feedAfterSseEvent）+ markers.test` の前のめり括弧
（1 巡目 §5-W4 で指摘）が **`markers.test（expressionRowText）+ cockpit-ui.test`** に訂正済み。今や
cockpit-ui.test が feedAfterSseEvent のディスパッチを実際に踏むため、無印の「cockpit-ui.test」は
feedWithExpression fixture とディスパッチ assert の両方を正しく包含する。記載精度の指摘は消化された。

### 7-4. 決定論・ネット純度の維持（追加 3 本）

追加 assert 3 本は既存 (4)/(5) 節と同じ流儀: `feedAfterSseEvent`（純関数）+ `emptyFeed`（純関数）のみ・
時刻は T0/T1 の注入固定値（`Date.now`/`Math.random`/`setTimeout`/`fetch`/`EventSource`/URL リテラルの
新規混入ゼロ）。fake も外部到達も無い。cockpit-ui.test 全 33 本の grep 純度は 1 巡目から不変。

### 7-5. 2 巡目の生数字（自分で再実行・タイムアウト付き・1 回で緑）

| 対象 | 実測 | Orch 報告 | 照合 |
|---|---|---|---|
| 全体 `node --test` | **679/679**（fail/cancelled/skipped/todo 全 0） | 679/679 | 一致 |
| `cockpit-server.test.mjs` | **74/74** | 74/74 | 一致 |
| `cockpit-ui.test.mjs` | **33/33**（skip/only/todo 0） | 33/33 | 一致 |
| `cockpit-page.test.mjs` | **4/4** | 4/4 | 一致 |

算術 676（1 巡目確定）+ 3 = **679**。本数機械照合 `grep -c '^test('` cockpit-ui = **33**・偽装ヒット 0。

### 7-6. 2 巡目 最終判定 — **PASS**

W4 は Gnome の追修正（テストのみ・rows.mjs 不変を sha256 で確認）で解消。反証実験で 3 case の誤変更が
実際に RED 化することを実証（両端固定でなくディスパッチ本体を踏む）。決定論・ネット純度は維持。生数字
679/679 全一致・claim との不一致ゼロ。1 巡目 §5 の non-blocking 残（W1/W2/W3/W5/§5-6）は**いずれも
本 wave の合格条件外の観察 or 安価な任意**のまま据え置き（W4 のみが「安価 × 中核」として消化された）。
**test レーンとして Domain D は無条件 PASS——残るは人間ゲートのみ。**
