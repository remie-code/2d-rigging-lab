# 操縦席UI改定 Domain A: 土台（vendor配置 + 静的配信 + view-logic純関数化の口）

> Status: 実装完了・機械ゲート緑（2026-07-14）。振る舞い保存のリファクタ+IA再設計+外観刷新 wave の**土台**。
> 能力waveでなく、合格の定義は「現操縦席の全機能が新しい見た目と構造で動き続けること」。本 Domain は
> その土台（凍結 vendor・UI アセットの静的配信ルート・**保存オラクルの表示側の固定点** = view-logic 純関数）を
> 敷き、無退行の背骨 `cockpit-server.test.mjs`（74本）を全緑のまま保った。
> 担当: Gnome（Orch-Sylph 委任）。対象パッケージ: `apps/soul/agent`（独立 npm・workspace glob 外＝lockfile 不変）。
> 契約の正: [../../orchestration/cockpit-redesign-wave-plan.md](../../orchestration/cockpit-redesign-wave-plan.md) §2/§3 Domain A /
> [../../orchestration/cockpit-redesign-inventory.md](../../orchestration/cockpit-redesign-inventory.md) §1・§2・§4 /
> [../../screens/cockpit-redesign.md](../../screens/cockpit-redesign.md) §7 視覚仕様。

## 0. このDomainが敷いた線（パイプライン）

```
ブラウザ（cockpit.html の inline module・Domain D が最終形にする）
  │  import { html, render, useState } from "./vendor/htm.preact.standalone.mjs"   ← A-1
  │  import { … } from "./ui/app.mjs"（Domain B/C が作る preact 部品）
  │      └─ ui/* は view-logic/* の純関数を呼ぶ薄い層に（表示文字列導出は preact 非依存）  ← A-3
  │
  ▼ GET /vendor/*.mjs · /ui/*.mjs · /view-logic/*.mjs
cockpit-server.mjs（handleRequest の 404 手前に追加した静的ルート）                    ← A-2
  │  UI_ASSET_SUBDIRS = {vendor, ui, view-logic} 配下の .mjs のみ・トラバーサル防止・text/javascript
  │  **既存 16 エンドポイント×13 SSE×6設定キーのワイヤ契約は 1 バイトも変えない**（追加ルートのみ）
  ▼
src/cockpit/vendor/htm.preact.standalone.mjs（凍結・無改変・コミットして持つ）          ← A-1
src/cockpit/view-logic/*.mjs（preact 非依存の純関数・node:test で fixture 固定）          ← A-3
```

- **A-1/A-2/A-3 は互いに疎**: vendor はブラウザが読むだけの凍結ソース（実行時 npm 依存を 1 つも増やさない）。
  静的ルートは追加のみでワイヤ契約に触れない。view-logic は `html`/`render` を一切 import しない素の JS 関数
  （node:test でブラウザ非依存に速く回る＝制約 b）。
- **cockpit.html は 1 バイトも触っていない**（Domain D の最終書き換えまで生かす＝旧 page test を緑に保つ）。
  ui/* の preact コンポーネントも本 Domain では作らない（Domain B/C）。view-logic は現 cockpit.html の当該ロジックと
  **機能同値**（各関数に対応行をコメントで明記・fixture は現在の表示文字列と一致）。

## 1. 実装/変更ファイル一覧

| ファイル | 種別 | 役割 |
|---|---|---|
| `src/cockpit/vendor/htm.preact.standalone.mjs` | 新規（凍結・無改変） | preact+htm standalone バンドル単一ファイル（hooks 込み・bare import ゼロ）。出所は §2。**冒頭に出所コメントを書き足していない**（凍結ファイル無改変・出所はこの docs に記録）。 |
| `src/cockpit/view-logic/format-time.mjs` | 新規 | 時刻/経過整形の純関数（`pad`/`formatHms`/`formatClock`/`computeUptimeMs`）。 |
| `src/cockpit/view-logic/transcript.mjs` | 新規 | 転写行の表示導出（`resolveSpeaker`/`speakerLabel`/`speakerRowClass`/`latencyLabel`）。 |
| `src/cockpit/view-logic/markers.mjs` | 新規 | マーカー行の文字列導出（`fireMarkerText`/`expressionRowText`/`visionMarkerText`/`bargeInMarkerText`/`selfFireMarkerText`）。 |
| `src/cockpit/view-logic/ghost.mjs` | 新規 | ゴースト行ラベル導出（`discardGhostLabel`/`diagnosticGhostLabel`/`selfFireGhostLabel`/`chatDiagnosticGhostLabel`）。**意図的非表示リスト**を null で厳密に遵守。 |
| `src/cockpit/view-logic/status.mjs` | 新規 | 接続状態導出（`chatStatusView`/`chatDisplayState`/`shouldRestoreChatSource`/`channelStatusView`）。 |
| `src/cockpit/view-logic/usage.mjs` | 新規 | usage 表示整形（`usageNoteText`）。 |
| `src/cockpit/view-logic/*.test.mjs`（6本） | 新規 | 各 view-logic 純関数の fixture（node:test）。合計 28 本。 |
| `src/cockpit/cockpit-static-assets.test.mjs` | 新規 | 静的配信ルートの実 HTTP テスト（200/traversal/非mjs/404）。**9 本**（レビュー追修正で `..%2f` 単段/二段・`..%5C` の**実装ガード到達**ケース 3 本を raw socket 送信で追加・§3）。 |
| `src/cockpit/cockpit-server.mjs` | **変更（追加のみ）** | UI アセット静的ルート `tryServeUiAsset` を 404 手前に追加。imports に `node:path`/`node:url`、module 定数 `COCKPIT_DIR`/`UI_ASSET_SUBDIRS`、option `uiRootPath` を追加。**既存 16 エンドポイント×13 SSE×6設定キーの分岐・レスポンス形は無改変**。 |
| `apps/soul/agent/.gitignore` | **変更（要注意・§7-1）** | 既存の un-anchored `vendor/`（whisper バイナリ用）が UI vendor まで巻き込むため、`!src/cockpit/vendor/` の負規則で 1 サブツリーだけ無視を解いた（vendor をコミットして持つ・plan §2/§3 の要求を満たす）。 |

**器コード（`apps/runtime-player/**`・`packages/**`）・契約 JSON・`pnpm-lock.yaml`・`apps/soul/agent/package.json`
は完全不変**（§5 の `git diff --stat` で確認・**新規 npm 依存ゼロ**＝vendor はブラウザ配信・実行時依存に非算入・
Node 組み込み `node:path`/`node:url` の追加のみ）。cockpit.html・cockpit-page.test.mjs・scripts/cockpit.mjs は無改変。

## 2. vendor取得記録（A-1・このwaveで唯一許可された外部ネットワークアクセス）

| 項目 | 値 |
|---|---|
| 取得 URL | `https://unpkg.com/htm@3.1.1/preact/standalone.mjs` |
| バージョン | htm **3.1.1**（URL でピン・検証済み） / preact **10.29.7**（inventory §1-1 の主張。**minified バンドルに平文バージョン文字列は無く独立検証は不可**——sha256 が正確なバイトを固定する） |
| 配置先 | `apps/soul/agent/src/cockpit/vendor/htm.preact.standalone.mjs` |
| サイズ | **13,194 bytes**（棚卸し §1-1 の「生 13,194B」と一致） |
| sha256 | `72284e8e9079c87817145df1110f74e8a2aa040b2fc384922e18dfcb46fc1fd7` |
| 取得日時 | 2026-07-14T00:16:38Z（UTC・curl 実行時） |
| 取得方法 | `curl -sSL "…" -o … --max-time 30`（**`--compressed` を付けない**＝identity encoding で生ソース。HTTP 200・Content-Type `text/javascript; charset=utf-8`・1 発成功・再試行不要） |
| 無改変確認 | 冒頭 `var e,n,_,t,o,r,u,l={},…`（minified preact・注入コメントなし）。ファイル冒頭に出所コメントを**書き足していない**（凍結ファイル無改変・plan 指示）。 |

**import スモークテスト**（scratchpad で一時実行・リポジトリには残さない・**オフライン**）: `import * as m from "<vendor>"` して
`html`/`render`/`h`/`Component`/`createContext`/`useState`/`useEffect`/`useRef`/`useReducer`/`useMemo`/`useCallback`/
`useContext`/`useErrorBoundary` の **13 全てが `function` として export** されていることを確認（+ `useDebugValue`/
`useImperativeHandle`/`useLayoutEffect` も export）。さらに `html\`<div>…</div>\`` が vnode（type="div"）を、`h("span",…)` が
vnode（type="span"）を返すことを確認＝棚卸し §1-1「hooks 込み・bare import ゼロ・Node からも読める」の裏取り成功。

## 3. 静的ルートの契約（A-2・`cockpit-server.mjs` の追加）

`handleRequest` の末尾 404（`sendJson(res, 404, …)`）の**直前**に、UI アセット静的配信を追加した。配置により、
そこへ落ちてくる GET は**非 API・非 root だけ**（既存 16 エンドポイントは全て上の分岐で return 済み）。

- **ルート解決**: `COCKPIT_DIR = path.dirname(fileURLToPath(import.meta.url))`（= このモジュール＝実 UI ツリーの場所）を
  既定に、`options.uiRootPath` で差し替え可能（新設・**既定値で既存呼び出し `scripts/cockpit.mjs` は無改変で動く**）。
- **握る条件（フォールスルー境界）**: リクエストパスの第一区画が `UI_ASSET_SUBDIRS = {vendor, ui, view-logic}` の
  ときのみこのハンドラが応答を握る。それ以外（`/api/…` 等）は `false` を返し**既存 404 に委譲**（他ルートの 404
  レスポンス形を 1 バイトも変えない）。
- **パストラバーサル防止**（防御層ごとの実測・**レビュー追修正 2026-07-14 で経路説明を実測どおりに訂正**）:
  - **層0（WHATWG URL パーサ・実装ガード非到達）**: 生 `..` と `%2e%2e`（および `%2e%2e` 二段）は `handleRequest`
    冒頭の `new URL(req.url, …)` が **pathname 段階でドットセグメント正規化して消す**（URL 仕様: `%2e%2e` は
    double-dot path segment として `..` と同一視）。正規化後の第一区画（例 `cockpit-server.mjs`）が許可サブツリー外
    なので `tryServeUiAsset` は握らず false → **既存 404 フォールスルー**。この経路では下記の実装ガードは
    **一度も実行されない**（初版の「traversal ガードが弾く」という説明は誤りだった＝testレーン blocking 指摘）。
  - **層1（握り境界）**: `decodeURIComponent`（不正 %エンコードは握らず既存 404 へ）+ 第一区画が
    `UI_ASSET_SUBDIRS` のときのみ握る。
  - **層2（ルート脱出ガード・`..%2f` 二段が踏む）**: `path.resolve(uiRootPath, rel)` → `path.relative(uiRootPath,
    resolved)` が `""`/`..` 始まり/絶対 なら 404。到達する実入力: `/vendor/..%2f..%2fears%2ftranscript-buffer.mjs`
    （`%2f` はエンコードされたスラッシュ＝URL パーサはセグメント `..%2fxxx` をドットセグメントと**見なせず**
    pathname に残す。decode 後に `vendor/../../ears/…` となり relative が `..` 始まりになる）。
  - **層3（サブツリー逸脱ガード・`..%2f` 単段が踏む）**: 正規化後の**第一区画**が許可サブツリー外なら 404。
    到達する実入力: `/vendor/..%2fcockpit-server.mjs`（decode → `vendor/../cockpit-server.mjs` → resolve/relative →
    第一区画 `cockpit-server.mjs`）。`..%5C`（エンコードされたバックスラッシュ）も win32 では `path.resolve` が
    `\` を区切りとして解決しこの層で 404（非 win32 では単一ファイル名扱い→ENOENT 404・どちらでも非漏洩）。
  - どの層で止まったかは **404 JSON の error がサーバ側 pathname を echo する**ことでテストから区別できる
    （層0 なら `..` が消えた正規化済みの形・層2/3 なら `..%2f` が残った形）。層2/3 のテストはターゲットを
    **実在ファイル**（cockpit-server.mjs / src/ears/transcript-buffer.mjs）にし「ガードが無ければ 200+漏洩に
    なるはず」を 404+非漏洩で実証。送信は raw socket（net.connect・リクエスト行手書き）でクライアント側
    正規化の恐れを構造的に排除し、届いた pathname は echo アサートで二重固定。
- **許可拡張子固定**: `.mjs` のみ（それ以外は 404）。
- **MIME**: `content-type: text/javascript; charset=utf-8`（module script は JS MIME 必須）+ `cache-control: no-store`
  （serveIndex と同型）。読み出しは `readFile`（Buffer をそのまま配信＝凍結 vendor の無改変配信）。
- **404 の扱い**: 存在しない `.mjs`・非 `.mjs`・トラバーサル・非アセットパス、いずれも 404（握った場合は
  `{ error: "not found: GET <path>" }`＝既存フォールスルーと同形）。

**ワイヤ契約 16+13+6 不変の根拠**: 追加は 404 手前の 1 分岐＋ヘルパ 1 個のみで、既存の各 `if (method===… && pathname===…)`
分岐・`snapshot()`・SSE event 名/ペイロード・`serveIndex`・設定キー永続化に一切触れていない。背骨
`cockpit-server.test.mjs`（74本＝16 HTTP エンドポイント×13 SSE×6設定キーのワイヤ契約）が**全緑のまま**（§6）＝一次証明。
「未知ルートは 404 JSON」既存テスト（`/api/nope`）も無退行（第一区画 `api` は許可サブツリー外＝フォールスルー）。

## 4. view-logic純関数の契約（A-3・保存オラクルの表示側の固定点）

現 cockpit.html の「SSE/state データ → 表示文字列」変換を preact 非依存の純関数へ括り出した。**cockpit.html は改変せず**、
新規に純関数を作り機能同値にした（現 HTML は Domain D で書き換えるまで生かす）。各関数のヘッダに現 cockpit.html の
対応行を明記し、fixture は現在の表示文字列と一致させた。

| 関数 | 対応（cockpit.html） | 入力 → 出力（固定した表示文字列の例） |
|---|---|---|
| `pad(n)` | :249 `pad` | `9→"09"`・`10→"10"`・`100→"100"`（時の桁あふれを切らない） |
| `formatHms(ms)` | :250-253 `fmtHms` | `3_661_000→"01:01:01"`・`360_000_000→"100:00:00"` |
| `formatClock(epochMs)` | :254-257 `fmtClock` | ローカル HH:MM:SS（TZ 非依存に検証: ローカル成分から epoch を作り戻す） |
| `computeUptimeMs({listening,baseMs,anchorMs,nowMs})` | :258-261 `renderUptime` の ms 計算 | listening: `base+(now-anchor)`・stopped: `0`（負クランプしない＝原実装踏襲） |
| `resolveSpeaker`/`speakerLabel`/`speakerRowClass`/`latencyLabel` | :386-408 `addTranscriptRow` | `viewer+displayName→"viewer(taro)"`・欠落 viewer→`"viewer"`・`latencyMs!=null` のとき `1500→"(1.5s)"`・履歴(null/undefined)→`null`（live 行のみ） |
| `fireMarkerText` | :456-457 `addFireMarkerRow` | `{includedCount:3,injectedChars:42}→"fired (3 lines, 42 chars injected)"`・欠落→`?` |
| `expressionRowText` | :474-478 `addExpressionRow` | `{word:"smile",applied:2,rejected:0}→"smile ✓2/✗0"`・args あり→`"troubled 0.8 ✓4/✗1"` |
| `visionMarkerText` | :495-496 `addVisionMarkerRow` | `{title:"FooGame",width:1920,height:1080,elapsedMs:123}→'saw "FooGame" (1920x1080, 123ms)'` |
| `bargeInMarkerText` | :520-521 `addBargeInMarkerRow` | `{charsSpoken:3,totalChars:10,elapsedMs:250}→"interrupted (3/10 chars spoken, 250ms)"` |
| `selfFireMarkerText` | :539 `addSelfFireMarkerRow` | `{kind:"silence"}→"self-fire (silence)"`（kind 非依存） |
| `discardGhostLabel` | :828 discard | `"(discarded)"` |
| `diagnosticGhostLabel` | :831-855 diagnostic 全分岐 | asrFailure/fireEmptyReply/fireError/expressionUnknownTag/fireVisionError/bargeInStopError/bargeInMouthCloseRejected/bargeInMouthCloseError/chatBufferAbsent の各ラベル（em-dash `—` 込みで厳密再現）。**表示しない型は `null`** |
| `selfFireGhostLabel` | :877 selfFire fired:false | `{kind:"silence",reason:"busy"}→"(self-fire: silence not fired — busy)"` |
| `chatDiagnosticGhostLabel` | :888-897 chatDiagnostic | notLive/ended/extractFailed/network/internalError のみラベル・**観測補助(connected/stopped/ignoredRenderers/listenerError)は `null`** |
| `chatStatusView`/`chatDisplayState`/`shouldRestoreChatSource` | :294-315 `renderChatStatus`/`applyChat` | `"dead"→{text:"dead",className:"chat-status dead",disconnectDisabled:true}`（connected でも dead は Disconnect 無効＝snapshot 再送で誤再有効化しない・page test:321 と一致）・稼働(connecting/live/retrying)→有効 |
| `channelStatusView` | :347-359 `applyChannel` | connected→`"channel-status connected"`・idle→`"channel-status "`（末尾スペース＝原実装踏襲）・text は `url + " — " + conn` |
| `usageNoteText` | :547-554 `applyUsage` | `{usage:{input_tokens:1200,output_tokens:88}}→"usage: input=1200 output=88"`・`vision:true→"usage(vision): …"`・欠落→`?` |

**意図的非表示リストの遵守**（wave-plan §4・page test :244-246 が根拠）: `diagnosticGhostLabel` は
`expressionBrokenTag`/`expressionRejected`/`expressionSendError` に対し `null` を返す（行を作らない＝演出行の ✗N が
既に伝える二重表示を避ける・壊れ括弧の除去痕はノイズ）。また `type=="bargeIn"` は**ゴーストでなく専用マーカー行**
（`bargeInMarkerText`）へ回るため `diagnosticGhostLabel` では `null`（診断ハンドラが先に bargeIn を marker へ分岐する前提）。
未知型・型欠落も拡張予約で `null`。`chatDiagnosticGhostLabel` は観測補助の内部診断 4 種を `null` で非表示。

## 5. 器不変・依存ゼロ・3チェック無退行の確認（このセッション実行）

```
git diff --stat -- apps/runtime-player packages                    → 出力なし（器コード不変）
git diff --stat -- pnpm-lock.yaml apps/soul/agent/package.json     → 出力なし（lockfile・依存不変＝新規依存ゼロ）
git diff --stat -- *channel-*-contract* *contract*.json            → 出力なし（契約 JSON 不変）
git status --porcelain -- apps/soul/agent
  M apps/soul/agent/.gitignore                       ← §7-1（要注意・vendor の無視解除）
  M apps/soul/agent/src/cockpit/cockpit-server.mjs   ← 静的ルート追加のみ
  ?? apps/soul/agent/src/cockpit/cockpit-static-assets.test.mjs
  ?? apps/soul/agent/src/cockpit/vendor/             ← htm.preact.standalone.mjs（負規則で追跡可に）
  ?? apps/soul/agent/src/cockpit/view-logic/         ← 6 モジュール + 6 テスト
```

- `.tmp/facex-*`（別セッション領分）は一切触っていない・読んでいない。`discussion/.../screens/cockpit-ia-redesign.md`
  も本 Domain の作成物ではない（別経路の未追跡ファイル・不干渉）。
- **構造チェック 3 種**（`node scripts/check-*.mjs`・repo ルートで実行）:
  - `check-dependencies.mjs`: **passed**（EXIT=0・Dependency guard passed）。
  - `check-soul-zone-boundary.mjs`: **passed**（EXIT=0・**1361 files** scanned＝ベースライン 1347 + 新設 14〔vendor 1 + view-logic 12 + static-assets test 1〕・器↔魂 越境 import なし）。
  - `check-source-organization.mjs`: EXIT=1 だが**唯一の違反は `apps/runtime-player/src/main/physiology/index.ts`**
    （器コード・barrel-only 違反・ブランチ既存ベースライン＝本 Domain で不変）。**私のスコープ（soul/agent）には
    違反ゼロ**（source-org は `.ts` のみ検査し、新設は全て `.mjs`）。無退行。

## 6. 機械ゲート生数字（実行済み・タイムアウト付き）

`cd apps/soul/agent && node --test`（全テスト・新規込み・タイムアウト 300s）:

```
# tests 646
# pass  646
# fail  0
```

- **実行前ベースライン 609 → 実行後 646（+37）**。内訳: view-logic 純関数 fixture **28 本**（format-time 4 /
  transcript 4 / markers 5 / ghost 5 / status 7 / usage 3 = 28）+ 静的ルート **9 本**（初版 6 + レビュー追修正の
  ガード到達ケース 3〔`..%2f` 単段=層3・`..%2f` 二段=層2・`..%5C`〕）= **+37**。既存 609 本は全通過（無退行）。
  追修正で**実装コード（cockpit-server.mjs）は 1 バイトも触っていない**（`git diff --stat -- …cockpit-server.mjs` が
  追修正前後で同一の `80 insertions(+)`＝変更はテストと本文書のみ）。
- **背骨 `cockpit-server.test.mjs` は 74/74 全緑のまま**（`node --test src/cockpit/cockpit-server.test.mjs` → `# tests 74 / # pass 74 / # fail 0`）＝ワイヤ契約 16+13+6 の無退行の一次証明。
- 新規テスト個別: view-logic 6 ファイル **28/28**・static-assets **6/6**。**cockpit-page.test.mjs は無改変で 30/30 緑**
  （cockpit.html を 1 バイトも触っていない＝旧 page test の regex が全て通る）。
- **SDK 実消費ゼロ**（vendor 取得の 1 回だけが外部ネット・以後の機械テストは実ネット/実マイク/実 SDK/実 YouTube 不出）。

## 7. §質問（Domain B/C・人間ゲート・迷った裁定点）

1. **`.gitignore` を触った（要承認・最重要の申し送り）**: 既存 `apps/soul/agent/.gitignore:8` の
   `vendor/`（un-anchored・S2 で whisper.cpp バイナリ用に新設）が**任意深さの vendor/ を無視するため
   `src/cockpit/vendor/` まで巻き込み**、plan §2/§3 が要求する「vendor をコミットして持つ」が満たせなかった。
   最小修正として `!src/cockpit/vendor/` + `!src/cockpit/vendor/*.mjs` の負規則で**この 1 サブツリーだけ無視を解いた**
   （whisper vendor＝`apps/soul/agent/vendor/` は無視のまま・`git check-ignore` で両方確認済み）。代替の `git add -f`
   は非永続（新クローンに載らない）ため不採。**タスク §5 が想定した「変更は cockpit-server.mjs のみ」から逸脱**するので
   明示報告する。この修正の是非（別解: root .gitignore 方針・vendor 配置パス変更）は Orch/レビューで裁定を。
2. **view-logic は列挙された集合に限定した（applySoulState 等は未抽出）**: タスクが列挙した 10 群
   （時刻/転写/各マーカー/ghost/status/usage）を忠実に抽出した。**列挙外**の `applySoulState`（Fire ボタン disable +
   soul-status 導出・:434）・`applyHealth`（:360）・`applyVisionTarget`（:317）・`applySelfFire`（:324）・`applyAudioDevice`（:342）は
   運転バー/ヘッダの component 層（Domain B/C）の領分と判断し**抽出していない**。`applySoulState` は `chatStatusView` と
   同型の純導出なので Domain C が view-logic に足すと綺麗（Domain C の裁量）。過剰抽出で Domain B/C の職域を侵さない
   ための線引き。追加抽出が要れば申し出を。
3. **status.mjs に `chatDisplayState`/`shouldRestoreChatSource` を追加した（軽微・裁量）**: タスクは
   `renderChatStatus` の Disconnect 導出と `applyChannel` 色クラスを明示指定。`applyChat`（:307-315）の
   「connected/state → 表示 state」畳み（`chatDisplayState`）と「記憶済み source 復元可否」（`shouldRestoreChatSource`）も
   同じ表示側の純導出で Domain C が必ず要るため**併せて抽出**した。純関数追加のみで低リスクだが、明示指定外なので記す。
4. **静的ルートは許可サブツリー方式を採った（設計裁定）**: 「ルート配下限定」を、UI ルート直下の
   `cockpit-server.mjs`/テスト等を**配らない**ため `{vendor,ui,view-logic}` の許可サブツリー限定で実装した（単純に
   「UI ルート配下の全 .mjs」だとサーバ source を HTTP で漏らす）。`ui/` は Domain B/C が作るまで空だが、ルートとしては
   既に許可済み（Domain B/C は server に触れず `ui/*.mjs` を置くだけで配信される）。この判断が UX/構造の意図と合うか確認を。
5. **`options.uiRootPath` を新設した**: タスクの二択（import.meta.url 導出 or option 新設）のうち option 新設を採用
   （既定は導出値＝`scripts/cockpit.mjs` は無改変で動く）。テストが fixture ルートを差し込めるが、本 Domain のテストは
   実 UI ツリー（実 vendor/view-logic）を配って強い検証にした。Domain D が cockpit.mjs で明示指定する必要は無い（既定で足りる）。
6. **エントリ（cockpit.html の inline module）は Domain D の領分**: 静的ルートは `/vendor` `/ui` `/view-logic` を配れる状態に
   したが、`cockpit.html` の `<script type="module">import … from "./ui/app.mjs"</script>` 化は本 Domain では**やっていない**
   （cockpit.html 不改変の規律・Domain D）。Domain B/C の部品が揃い次第 Domain D がエントリを差し替える前提。
   相対 import の解決（`/ui/app.mjs` から `../vendor/*` → `/vendor/*`・`../view-logic/*` → `/view-logic/*`）は許可サブツリーに
   収まることを確認済み。
7. **preact のパッチバージョンは独立検証不可（記録の正直さ）**: htm 3.1.1 は URL でピン（検証済み）。preact 10.29.7 は
   inventory §1-1 の主張で、**minified バンドルに平文バージョン文字列が無く**独立検証できなかった（`preact` リテラルも
   0 件）。sha256（§2）が正確なバイトを固定するので実害は無いが、「preact 10.29.7」は inventory 由来の値として扱う。
8. **人間ゲートは本 Domain の対象外（規律の明記）**: 実ブラウザでの描画・保存チェックリストの 1 個ずつの確認・
   三層 IA/導線は人間ゲート（Domain D が手順書）。本 Domain は vendor 取得の 1 回を除き実ネット不出・実 SDK 消費ゼロ・
   実マイク/実 YouTube 不使用。view-logic の**描画**（vnode）は検証していない（純関数の入出力のみ・linkedom は台帳の梯子）。
```
