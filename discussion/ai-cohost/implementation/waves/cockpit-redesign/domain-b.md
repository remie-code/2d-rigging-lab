# 操縦席UI改定 Domain B: 観測+ヘッダ（主役の移植・preact コンポーネント層）

> Status: 実装完了・機械ゲート緑（2026-07-14）。Domain A の土台（凍結 vendor・静的配信・view-logic 6 モジュール）
> の上に、**観測フィード（主役・全行種）とヘッダ**を preact+htm（no-build）で移植した。cockpit.html は
> 1 バイトも触っていない（エントリ差し替えは Domain D）——ui/ は「置くだけで配信される」状態で待機する。
> 担当: Gnome（Orch-Sylph 委任）。対象パッケージ: `apps/soul/agent`（独立 npm・workspace glob 外＝lockfile 不変）。
> 契約の正: [../../orchestration/cockpit-redesign-wave-plan.md](../../orchestration/cockpit-redesign-wave-plan.md) §2/§3 Domain B /
> [../../orchestration/cockpit-redesign-inventory.md](../../orchestration/cockpit-redesign-inventory.md) §2-1・§4 /
> [../../screens/cockpit-redesign.md](../../screens/cockpit-redesign.md) §2・§7 視覚仕様（モック承認済み）/
> [domain-a.md](domain-a.md)（土台と §7 申し送り）。

## 0. このDomainが敷いた線（SSE → 状態 → view-logic → 描画）

```
GET /api/events（既存 13 SSE・ワイヤ契約不変）           GET /api/state（履歴復元・タブ開き直し）
  │                                                        │
  ▼ ui/app.mjs（エントリの骨組み・mount/App）              │
  SSE_EVENT_NAMES（13 イベントの購読リスト＝移植漏れゼロの機械的固定点・fixture が本数と名前を固定）
  │                                                        │
  ├─ タイムライン系（行を作る 9 イベント）─────────────────┤
  │    ▼ ui/rows.mjs  feedAfterSseEvent（単一経路・preact 非依存・nowMs 注入）
  │        └─ view-logic/*.mjs を呼んで「行レコード」（描画済みフィールドのみ）を構築
  │           transcript.mjs / markers.mjs / ghost.mjs（null=行を作らない）/ format-time.mjs
  │    ▼ ui/feed.mjs（観測フィード＝主役）: 行レコードを機械的に描くだけ + 自動スクロール hooks
  │
  └─ 非タイムライン系（state/discard カウンタ/soul/fire-note/usage/chatStatus）
       ▼ ui/app.mjs  applyNonFeedSseEvent → preact state
           ├─ ヘッダ層: ears/health → ui/header.mjs（view-logic/health.mjs 経由で導出）
           ├─ 計器層: usage/discarded/uptime → ui/feed.mjs の .feed-meta
           └─ Domain C の口: soul/fireNote/chatDisplay/settings（保持のみ・描画は Domain C）

スタイル: ui/styles.mjs（COCKPIT_CSS 文字列 + injectStyles）— mount 時に <style> 注入（裁定 §5）
入口:     mount(rootElement, options) だけが副作用を起こす（呼ぶのは Domain D の inline module）
```

- **鉄の設計規律の実装**: ui/*.mjs は export function/const のみ・**トップレベル副作用ゼロ**
  （document/EventSource/window にトップレベルで触れない・既定実装は `globalThis.*` を**関数実行時**に参照）。
  これにより Node からの import スモークが通る（standalone vendor が bare import ゼロで Node でも読める利点）。
- **表示文字列・状態導出は view-logic 経由のみ**（L0 裁定）: rows.mjs は view-logic の組み合わせ層で
  文字列を再実装しない（唯一の例外は fire-note の暫定移植 → §8-2）。feed.mjs / header.mjs に表示ロジックは無い。
- **サーバ・cockpit.html・page test・scripts/cockpit.mjs は 1 バイトも触っていない**（§6 で git 証明）。
  ui/*.mjs は Domain A の許可サブツリー方式により「置くだけで配信される」（§7 static-assets テストが固定）。

## 1. 実装/変更ファイル一覧

| ファイル | 種別 | 役割 |
|---|---|---|
| `src/cockpit/view-logic/health.mjs` | 新規（B-1 追加抽出） | ヘッダの「一目の健康」導出: `earsStatusView`（:267-270）・`healthStatusView`（applyHealth :360-366・falsy は **null=更新しない**）・`mergeHealth`（:271-274 の「欠落は前値保持」を state 遷移化）・`voiceOutputLabel`（applyAudioDevice :344 の文言のみ・裁量 §8-7）。 |
| `src/cockpit/view-logic/health.test.mjs` | 新規 | 上記 fixture（**5 本**・現 cockpit.html の表示文字列と機能同値）。 |
| `src/cockpit/ui/styles.mjs` | 新規（B-3） | §7 視覚仕様の CSS（`COCKPIT_CSS` 文字列 + `injectStyles(doc)` 冪等注入）。トップレベル副作用ゼロ。 |
| `src/cockpit/ui/rows.mjs` | 新規（B-2） | SSE イベント → 行レコード構築の純関数層（preact 非依存・nowMs 注入）。`feedAfterSseEvent` がタイムライン系 9 イベントの**単一経路**。speaking 行の規律・ghost null 遵守・履歴復元 `feedFromHistory`。 |
| `src/cockpit/ui/header.mjs` | 新規（B-2） | ヘッダ（名前 + Listening 発光ドット + whisper/ffmpeg 死活 + 声の出力先 + 右端 ⚙）。導出は view-logic/health.mjs 経由。⚙ は `onToggleSettings` prop（開閉フックのみ・引き出し本体は Domain C）。 |
| `src/cockpit/ui/feed.mjs` | 新規（B-2） | 観測フィード（主役）。行レコードの機械描画（`FeedRow`）+ 自動スクロール hooks（末尾追従・停止時「最新へ ↓」・判定は純関数 `isStuckToBottom`）+ usage/discarded/uptime の `.feed-meta` 計器行。 |
| `src/cockpit/ui/app.mjs` | 新規（B-2） | エントリの骨組み。`SSE_EVENT_NAMES`（13）購読 → feed/state 更新・`/api/state` 履歴復元（購読より先・原実装 init と同順）・uptime 1s 刻み・header/feed 結線・**運転バー/設定引き出しのプレースホルダ**（`.control-bar-slot`/`.settings-drawer-slot` + 結線の口コメント）。`mount(rootElement, options)` が唯一の副作用入口。 |
| `src/cockpit/cockpit-ui.test.mjs` | 新規（B-4） | ui 層の機械テスト **23 本**（import スモーク/構造/SSE リスト固定/rows fixture/vnode 走査/CSS トークン）。**配信サブツリー外**（src/cockpit/ 直下）に置き、node:test import 物を静的配信ツリーへ混ぜない。 |
| `src/cockpit/cockpit-static-assets.test.mjs` | **変更（追加+1 本・1 本の対象変更）** | 「ui/*.mjs 5 ファイルが 200 + text/javascript + 実バイト」を追加（置くだけで配信される事実の固定）。旧「/ui/app.mjs は 404（ui/ 未生成）」は ui/ 実体化で事実が変わったため対象を `/ui/does-not-exist.mjs` に変更（§8-6）。 |

**触っていないもの**: cockpit.html（913 行・移植元）・cockpit-page.test.mjs・cockpit-server.mjs（Domain A の
80 insertions のまま不変・§6）・scripts/cockpit.mjs・.gitignore・vendor（凍結）・Domain A の view-logic 6 モジュール
とテスト・器コード・契約 JSON・lockfile・package.json（新規 npm 依存ゼロ・devDep ゼロ維持・ビルド段ゼロ）。

## 2. コンポーネント構成と props 契約（Domain C/D が結線する口）

### `mount(rootElement, options?)` — ui/app.mjs（Domain D が呼ぶ唯一の入口）

```js
// cockpit.html の inline module（Domain D）はこれだけで立ち上がる想定:
//   <div id="app"></div>
//   <script type="module">
//     import { mount } from "./ui/app.mjs";
//     mount(document.getElementById("app"));
//   </script>
mount(rootElement, { eventSourceImpl?, fetchImpl?, nowImpl? })
```

- `injectStyles(rootElement.ownerDocument)`（冪等）→ `render(<App …options/>, rootElement)`。
- `eventSourceImpl`/`fetchImpl`/`nowImpl` は注入可能（既定は `globalThis.EventSource`/`globalThis.fetch`/`Date.now`
  を**関数実行時**に参照＝Node import 安全）。将来 linkedom 梯子を使う時の駆動口でもある。

### `App(props)` — 保持する状態と Domain C の口

| 状態 | 由来 | Domain B での用途 | Domain C の口 |
|---|---|---|---|
| `feed { rows, nextId }` | rows.mjs | Feed へ | —（観測は完結） |
| `ears` / `health` / `uptime`+`nowTick` / `discarded` / `usageNote` | SSE state・discard・usage / GET /api/state | Header・.feed-meta | — |
| `soul` | SSE soul（:857-859）の生 state | 保持のみ | 運転バーの busy 表示 + Fire disable（applySoulState :434-441 の導出は Domain C・`data-soul` でスロットに露出） |
| `fireNote` | SSE fire accepted:false（:863） | 保持のみ | 運転バーの fire-note 表示（`data-fire-note` で露出・Fire ボタン応答系 :555-589 は Domain C） |
| `chatDisplay` | SSE chatStatus（:884）+ applyState 時の `chatDisplayState(s.chat)`（applyChat :314 同値） | 保持のみ | 設定引き出しの chat 状態表示（`chatStatusView` へ渡す入力・単一経路維持） |
| `settings` | `settingsFromSnapshot(s)`（channel/visionTarget/selfFire/audioDevice/chat の生現況） | Header へ audioDevice のみ | 設定引き出し全区画 + 自発トグル現況 |
| `settingsOpen` | ⚙ クリック（Header の onToggleSettings） | 保持のみ | 引き出しの開閉（`.settings-drawer-slot` の `data-open` に露出・初回自動展開の判定も Domain C） |

- applyState 相当は `applyStateRef.current(snapshot)` に集約（POST 応答の snapshot 適用（:765 :792 :801 等）を
  Domain C が同じ単一経路で共有できる）。
- プレースホルダ実体: `.settings-drawer-slot`（`data-open`）と `.control-bar-slot`（`data-soul`/`data-fire-note`）。
  Domain C はスロットをコンポーネント（`ui/settings-drawer.mjs`/`ui/control-bar.mjs`）で置換する想定。

### `Header({ ears, health, audioDevice, onToggleSettings })` — ui/header.mjs

- `ears`: 生値（"listening"/"starting"/"stopped"）→ `earsStatusView` で文言+発光ドット。
- `health`: `{ whisper, ffmpeg }`（mergeHealth 済み・初期 `initialHealth()`）→ `healthStatusView` で色/文言/title。
- `audioDevice`: 生値 → `voiceOutputLabel` で「声の出力先」。
- `onToggleSettings`: ⚙ クリック。**開閉フックだけ**（引き出し本体は Domain C）。

### `Feed({ rows, usageNote, discarded, uptimeText })` — ui/feed.mjs

- `rows`: rows.mjs の行レコード配列（描画済みフィールドのみ＝feed に表示ロジック無し）。
- 自動スクロール: 既定は末尾追従（原実装 `scrollTop=scrollHeight` :383 等と同値）。ユーザーが上へ
  スクロールすると追従停止+「最新へ ↓」（モック §2）。判定は `isStuckToBottom`（閾値 40px・fixture 固定）。

## 3. 13 SSE イベントの移植対応表（移植漏れゼロの根拠）

**機械的根拠**: `SSE_EVENT_NAMES`（ui/app.mjs）が 13 イベントを列挙し、購読ループはこのリストだけから
`addEventListener` する（漏れ=リスト欠落=fixture「SSE_EVENT_NAMES: 既存 13 SSE イベントと 1:1」が落ちる）。
タイムライン系は `feedAfterSseEvent`（rows.mjs）の switch が単一経路で受ける（各分岐 fixture 固定）。

| # | イベント | 旧 cockpit.html（行） | 新実装（タイムライン効果 / 非タイムライン効果） |
|---|---|---|---|
| 1 | `state` | :816 → applyState :265-284 | feed: 無変化（fixture 固定）/ app.mjs applyStateRef（ears・mergeHealth・discarded・uptime 再同期+即時反映・chatDisplay=`chatDisplayState`・settings） |
| 2 | `vad` | :817-821 | feed: speechStart→speaking 出現・speechEnd/speechCancel→消滅・未知 type 無変化（`feedWithSpeaking`） |
| 3 | `transcript` | :822 → addTranscriptRow :386-408 | feed: `feedWithTranscript`（speaking 除去・appendedAtMs 時刻・speakerLabel/speakerRowClass/latencyLabel） |
| 4 | `expression` | :824 → addExpressionRow :466-482 | feed: `feedWithExpression`（expressionRowText） |
| 5 | `discard` | :825-829 | feed: `feedWithGhost(discardGhostLabel())` / app.mjs setDiscarded(d.discarded) |
| 6 | `diagnostic` | :830-855 | feed: **type=="bargeIn" を先に専用マーカー行へ分流**（L0 裁定・:842 → `feedWithBargeInMarker`）・他は `diagnosticGhostLabel` 経由（**null=行を作らない**＝意図的非表示 expressionBrokenTag/expressionRejected/expressionSendError+未知型・fixture 固定） |
| 7 | `soul` | :857-859 → applySoulState :434-441 | feed: 無変化 / app.mjs setSoul（busy disable 導出は運転バー=Domain C） |
| 8 | `fire` | :860-864 → addFireMarkerRow :448-461 | feed: accepted:true のみ `feedWithFireMarker`（atMs 時刻）/ app.mjs: 受理→fireNote クリア・非受理→"not fired: reason"（§8-2） |
| 9 | `visionCaptured` | :866 → addVisionMarkerRow :487-507 | feed: `feedWithVisionMarker`（visionMarkerText + サムネ data URI・**非保存**・jpegBase64 欠落は img 無し） |
| 10 | `usage` | :868 → applyUsage :547-554 | feed: 無変化 / app.mjs setUsageNote(`usageNoteText`) |
| 11 | `selfFire` | :874-878 → addSelfFireMarkerRow :531-543 | feed: fired:true→`feedWithSelfFireMarker`・fired:false→`feedWithGhost(selfFireGhostLabel)`（ゴースト） |
| 12 | `chatStatus` | :880-885 → renderChatStatus :294-306 | feed: 無変化 / app.mjs setChatDisplay(d.status \|\| "connecting")（表示本体=chatStatusView 描画は Domain C・単一経路維持） |
| 13 | `chatDiagnostic` | :888-897 | feed: `feedWithGhost(chatDiagnosticGhostLabel)`（notLive/ended/extractFailed/network/internalError のみ・観測補助 connected/stopped/ignoredRenderers/listenerError は **null=非表示**・fixture 固定） |

## 4. 保存オラクル観測層（inventory §2-1）の対応表

| 項目 | 旧（cockpit.html） | 新実装の場所 | 機械固定 |
|---|---|---|---|
| 耳ランプ+状態 | :152-155 + :267-270 | header.mjs + `earsStatusView`（view-logic/health.mjs） | health.test 4 本 + Header vnode スモーク |
| whisper/ffmpeg 死活 | :157-160 + applyHealth :360-366 | header.mjs `HealthStat` + `healthStatusView`/`mergeHealth`（欠落=前値保持・down=赤/reason 併記/title） | health.test + Header vnode スモーク |
| soul 状態（idle/thinking/speaking） | :220 + applySoulState :434-441 | app.mjs `soul` state に保持（表示・Fire disable は運転バー=Domain C・§8-5） | SSE リスト fixture |
| usage（input/output・vision 区別） | :222 + applyUsage :547-554 | app.mjs `usageNote`（`usageNoteText`）→ feed.mjs `.feed-meta`（§8-3） | view-logic usage fixture（Domain A）+ SSE 対応表 |
| discarded カウンタ | :231 + :275 :827 | app.mjs `discarded` → `.feed-meta` | — |
| uptime（listening 中ローカル刻み+state 再同期） | :245-262 + :276-278 | app.mjs `uptime{baseMs,anchorMs}`+`nowTick`（1s interval・cleanup 付き）+ `computeUptimeMs`/`formatHms` → `.feed-meta` | view-logic format-time fixture（Domain A） |
| Timeline 自動スクロール | :383 等（無条件末尾追従） | feed.mjs hooks（末尾追従・ユーザー上スクロールで停止+「最新へ ↓」＝モック §2 の改定仕様） | `isStuckToBottom` fixture |
| 行種1: 転写（you/soul/viewer(名前)・live 行のみ latency） | addTranscriptRow :386-408 | rows.mjs `feedWithTranscript` | fixture（viewer(taro)・(1.5s)・null） |
| 行種2: speaking 行（VAD 連動出現消滅） | :369-384 | rows.mjs `feedWithSpeaking`（二重 show 無視・transcript/ghost が除去・**マーカー行は除去しない**まで保存） | fixture |
| 行種3: ゴースト行（discard+diagnostic 各種・**意図的非表示リスト遵守**） | :417-429 :825-855 | rows.mjs `feedWithGhost`（**label null=行を作らない**を型で強制・label は view-logic ghost.mjs のみ） | fixture（非表示 4 型+観測補助 4 種） |
| 行種4: 発火マーカー | addFireMarkerRow :448-461 | rows.mjs `feedWithFireMarker`（who "fire"・marker "*"・atMs 時刻） | fixture |
| 行種5: 演出行（word/args/✓✗） | addExpressionRow :466-482 | rows.mjs `feedWithExpression` + feed.mjs サブ行の器（インデント+↳・§7） | fixture + FeedRow スモーク |
| 行種6: 視覚マーカー（サムネ img・data URI・非保存） | addVisionMarkerRow :487-507 | rows.mjs `feedWithVisionMarker`（thumbSrc）+ feed.mjs `<img class="vision-thumb">` | fixture |
| 行種7: barge-in マーカー（chars/elapsed） | addBargeInMarkerRow :512-525 | rows.mjs `feedWithBargeInMarker`（**diagnostic ハンドラ側で type=="bargeIn" を先に分流**・L0） | fixture |
| 行種8: 自発マーカー（kind・fired:false はゴースト） | addSelfFireMarkerRow :531-543 :874-878 | rows.mjs `feedWithSelfFireMarker` / `selfFireGhostLabel` | fixture |
| 行種9: chat 取得死のゴースト行 | :888-897 | rows.mjs 経由 `chatDiagnosticGhostLabel` | fixture |
| タブ開き直し履歴復元（GET /api/state.transcripts） | renderHistory :410-413 + init :899-909 | app.mjs init effect（`/api/state` → `feedFromHistory`（**全置換・履歴行は latency 無し**）→ applyState → **その後に** SSE 購読＝原実装と同順・購読先行の競合を構造回避） | `feedFromHistory` fixture |

## 5. 視覚仕様 §7 の実装（CSS 置き場の決定と配色トークン）

**CSS 置き場の裁定 = (a) `ui/styles.mjs` に CSS 文字列を export し、mount 時に `<style id="cockpit-styles">` を
冪等注入**。根拠: (1) ソース=実行物（配信される .mjs がスタイルの正本・dist 乖離なし）、(2) 静的配信が
`.mjs` のみで完結（`.css` 用のルート追加＝cockpit-server 変更が不要＝サーバ不可侵の規律に適合）、
(3) Domain D の cockpit.html 書き換えが「`<div id="app">` + inline module で `mount()`」だけの最薄になる。
自己完結（外部フォント/CDN ゼロ）・ビルド段ゼロ。

配色トークン（`:root` カスタムプロパティ・§7 承認値とその継承の別を明記）:

| トークン | 値 | 出自 |
|---|---|---|
| `--teal` | `#56d4b0` | §7 承認（こーでぃーのアイデンティティ色） |
| `--speaker-you` | `#7fb3ff` | §7 承認（you=青） |
| `--speaker-soul` | `#56d4b0` | §7 承認（soul=teal） |
| `--speaker-viewer` / `--viewer-text` | `#c99be8` / `#e9dcf2` | §7 承認（viewer=紫）/ 本文淡紫は現 :115 の意匠踏襲 |
| `--marker-self` | `#9fe3cd` | §7 承認（自発=淡 teal） |
| `--marker-barge` | `#e0928f` | §7 承認（barge-in=赤） |
| `--marker-expr` | `#86d98b` | §7 承認（演出行=緑） |
| `--ghost` | `#7d8695` | §7 承認（ゴースト=グレー斜体・italic は CSS 側） |
| `--marker-fire` / `--speaking` | `#f0c14b` | §7 指定なし → 現 cockpit.html :123/:19 の黄を継承 |
| `--marker-vision` | `#8fb7ff` | §7 指定なし → 現 :130 の淡青を継承 |
| `--up` / `--down` | `#57c7a3` / `#ff5d5d` | 死活の緑/赤（現 :17-18 継承） |
| `--bg` / `--panel` / `--panel-raised` / `--border` / `--fg` / `--muted` | `#0e1114` 等 | ダーク基調（§7）・モックの階調を CSS 手書き |
| `--radius` | `14px` | §7 承認（角丸 14px パネル） |

- 行レイアウト: 時刻は mono 小（`ui-monospace` 11px・本文は system-ui sans）・話者ラベル色分け・
  演出はサブ行（`.row.expression` インデント + `.sub-arrow` ↳）・視覚サムネ枠（54x96 上限+角丸+境界線）・
  ヘッダ/フィード/スロットは三層 flex カラム（フィードが `flex:1` で主役・観測フィードのみスクロール）。
- 主要トークンと ghost italic は fixture（`COCKPIT_CSS` 文字列検査）で固定。**描画の実確認はしていない**
  （人間ゲート=Domain D 後の領分・実ブラウザ/スクリーンショット不使用）。

## 6. 器不変・依存ゼロ・3チェック無退行（このセッション実行・生出力）

```
git diff --stat -- apps/runtime-player                              → 出力なし（器コード不変）
git diff --stat -- pnpm-lock.yaml apps/soul/agent/package.json      → 出力なし（lockfile・依存不変＝新規 npm 依存ゼロ・devDep ゼロ維持）
git diff --stat -- apps/soul/agent/src/cockpit/cockpit-server.mjs   → 80 insertions(+)（**Domain A 時点から不変**・本 Domain は 1 バイトも触っていない）
git diff --stat -- …cockpit.html …cockpit-page.test.mjs …scripts/cockpit.mjs → 出力なし（不可侵 3 ファイル無改変）
git status --porcelain -- apps/soul/agent
   M apps/soul/agent/.gitignore                        ← Domain A の変更のまま（本 Domain 不触）
   M apps/soul/agent/src/cockpit/cockpit-server.mjs    ← Domain A の変更のまま（本 Domain 不触）
  ?? apps/soul/agent/src/cockpit/cockpit-static-assets.test.mjs  ← Domain A 新規に +1 本/対象変更 1 本
  ?? apps/soul/agent/src/cockpit/cockpit-ui.test.mjs   ← 本 Domain 新規
  ?? apps/soul/agent/src/cockpit/ui/                   ← 本 Domain 新規（5 ファイル）
  ?? apps/soul/agent/src/cockpit/vendor/               ← Domain A のまま（凍結・無改変）
  ?? apps/soul/agent/src/cockpit/view-logic/           ← Domain A 12 + 本 Domain 2（health.mjs/health.test.mjs）
```

- **注記（正直な報告）**: `git diff --stat -- packages` には `packages/authoring-core` の変更 4 ファイル
  （runtime-export-assembly/texture-atlas-packing 系）が出るが、これは**セッション開始時点から存在する
  別セッション（facex/wave109 系）の作業**であり、本 Domain は一切触れていない（`.tmp/facex-*` と
  `screens/cockpit-ia-redesign.md` にも不干渉・読んでもいない）。
- **構造チェック 3 種**（`node scripts/check-*.mjs`・repo ルート・実装後に再実行）:
  - `check-dependencies.mjs`: **passed**。
  - `check-soul-zone-boundary.mjs`: **passed**（**1371 files** scanned＝実装前ベースライン 1363 + 本 Domain 新設 8
    〔ui 5 + health 2 + cockpit-ui.test 1〕・器↔魂 越境 import なし）。※ Domain A 報告の 1361 との差 +2 は
    上記別セッションの packages 新規 2 ファイル（本 Domain 無関係）。
  - `check-source-organization.mjs`: 違反は**器側既存赤 1 件のみ**（`apps/runtime-player/src/main/physiology/index.ts`・
    ブランチ既存ベースライン）。soul/agent スコープは違反ゼロ（新設は全て `.mjs`）。無退行。

## 7. 機械ゲート生数字（実行済み・タイムアウト付き）

`cd apps/soul/agent && node --test`（全テスト・タイムアウト 300s）:

```
# tests 675
# pass  675
# fail  0
```

- **実行前ベースライン 646（このセッションで再実行し一致確認）→ 実行後 675（+29）**。内訳:
  `view-logic/health.test.mjs` **5 本** + `cockpit-ui.test.mjs` **23 本** + `cockpit-static-assets.test.mjs` **+1 本**
  （9→10・ほか 1 本は対象変更で本数不変）= **+29**。既存 646 本は全通過（無退行）。
- **背骨 `cockpit-server.test.mjs` は 74/74 全緑のまま**（個別実行 `# tests 74 / # pass 74 / # fail 0`）＝
  ワイヤ契約 16+13+6 の無退行の一次証明。
- **`cockpit-page.test.mjs` は無改変で 30/30 緑**（個別実行）＝ cockpit.html を 1 バイトも触っていない証明。
- 新規/変更テスト個別実行: `cockpit-static-assets.test.mjs` **10/10**・`view-logic/health.test.mjs` **5/5**・
  `cockpit-ui.test.mjs` **23/23**。
- **SDK 実消費ゼロ・実ネットワーク不出**（本 Domain は外部アクセス 0 回・実マイク/実 YouTube/実ブラウザ不使用）。

## 8. §質問（Domain C/D への申し送り・迷った裁定点）

1. **App/Feed（hooks 使用）の htm テンプレートは Node 未実行（正直な限界）**: hooks はコンポーネント実行に
   preact の render 文脈を要するため、`App`/`Feed` の関数本体（html テンプレート評価・SSE effect・スクロール
   effect）は Node では実行していない（devDep ゼロ規律・linkedom は台帳の梯子のまま）。検証済みなのは
   import スモーク（トップレベル副作用ゼロ）+ hooks 非使用の `Header`/`HealthStat`/`FeedRow` の vnode 走査
   + rows/view-logic の全 fixture。**App/Feed の実描画・EventSource 実配線・自動スクロール実挙動は人間ゲート
   （Domain D 手順書）で確認を**。テスト注入口（eventSourceImpl/fetchImpl/nowImpl）は用意済み。
2. **fire-note 文言の view-logic 抽出は Domain C に委ねる（暫定移植）**: SSE fire accepted:false の
   `"not fired: " + (d.reason || "unknown")`（:863）は app.mjs に対応行コメント付きで暫定移植した。Fire ボタン
   応答（:562-563 の 503 文言/エラー文言）を移植する Domain C が、fire-note 文言体系ごと view-logic へ
   まとめて抽出する方が凝集する（applySoulState の抽出と同じ Domain C 裁量・domain-a.md §7-2 と同型の線引き）。
3. **usage/discarded/uptime の置き場はフィードパネル下端 `.feed-meta` に裁定**: §7 に明示位置が無く
   （旧: usage は fire セクション・discarded/uptime はフッタ）、三層 IA では観測層の計器なので観測フィードの
   パネル内下端に集約した。人間ゲートで違和感があれば CSS のみで移設可能（行レコード/状態は不変）。
4. **ヘッダの名前は「こーでぃー」にした**: 旧 cockpit.html の `<h1>Soul Cockpit</h1>` をモック §2/§7 の
   「こーでぃー」表記に置き換えた（モック承認済み意匠を正とする指示に従う）。`<title>` タグは cockpit.html
   側なので Domain D の裁量（モックに合わせるなら title も変える）。
5. **soul の thinking 表示はフィード行にしていない**: モック §2 に「○ こーでぃー thinking…」風の行が
   描かれているが、保存オラクル（inventory §2-1）の行種 9 つに thinking 行は無く、現実装にも存在しない
   （soul-status は運転層の span）。**新規行種の発明は振る舞い保存 wave の職域外**と裁定し、soul state は
   app.mjs に保持して運転バー（Domain C）の busy 表示へ渡す。フィード行化したければ followup で。
6. **static-assets テストの 1 本は対象変更した**: 旧「`/ui/app.mjs` は 404（ui/ 未生成の固定）」は ui/ 実体化で
   事実自体が変わるため `/ui/does-not-exist.mjs` に変更し、実在 5 ファイルの 200 配信テストを追加した
   （タスクのスコープ外リストに static-assets test は含まれず、「ケースを追加」指示の範囲内と判断）。
7. **view-logic/health.mjs に指示外 2 関数を足した（軽微・裁量）**: 指示の earsStatusView/healthStatusView に
   加え、`mergeHealth`（applyState :271-274 の「欠落は前値保持」を preact state 遷移で同値化するために必須）と
   `voiceOutputLabel`（ヘッダの「声の出力先」表示に必須・applyAudioDevice :344 の文言部・**設定引き出しの
   結線は Domain C** がこの同じ導出を使える）。ui/ 内での文字列組み立てを禁じる規律の帰結。
8. **Domain C の初期ロードの差し込み方**: 原実装 init（:899-909）の loadDevices → loadWindows →
   loadAudioDevices は未移植（設定引き出し=Domain C 領分）。app.mjs の init effect は
   「/api/state → 履歴復元 → applyState → SSE 購読」だけを担う。Domain C は独立の effect で
   devices/windows/audio-devices を取得する（原実装の直列順序はサーバ側に依存なし・並行でも
   ワイヤ契約上安全と判断するが、順序を保ちたければ init effect への差し込みを許す——結線時に裁定を）。
9. **`chatStatus` の "connecting" 既定と applyChat の単一経路**: SSE chatStatus は `d.status || "connecting"`、
   snapshot 側は `chatDisplayState(s.chat)`（null=未接続）で、両方 `chatDisplay` state（renderChatStatus :294-306 の
   入力と同義）に合流させた。Domain C は `chatStatusView(chatDisplay)` を描くだけで dead の Disconnect 無効化
   契約（domain-c.md §2）が保たれる。chatSourceEdited（入力中は source を復元しない）は Domain C 領分
   （`shouldRestoreChatSource` が view-logic に既にある）。
10. **行の保持は無制限（原実装踏襲）**: 旧実装はタイムライン行を無制限に積む。挙動保存のため上限を
    設けていない（長時間配信でのメモリはブラウザタブの寿命問題として現状と同等・followup 候補）。
