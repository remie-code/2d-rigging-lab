# S7 Domain C レビュー（design レーン）

> レビュアー: Review-Sylph（design レーン）。呼び出し元: Orch-Sylph。読み取り専任（唯一の書き込みは本成果物）。
> 日付: 2026-07-14。対象: `apps/soul/agent`（S7 Domain C「操縦席+docs のチャット結線」実装）。
> **総合判定（追修正 再確認・2 巡目）: PASS**（1 巡目で検出した観点③の契約 FAIL は解消を確認。blocking 0 件・
> non-blocking 3 件は記録のみ・追加修正不要）。

## 追修正 再確認（2 巡目）

**スコープ**: 1 巡目で検出した観点③の契約 FAIL（`applyChat` が ended→dead 後の state snapshot 経由で
Disconnect ボタンを誤って再有効化する）に対する Gnome の追修正が、契約 FAIL を閉じたか・退行が無いかのみを
狭く再確認する。変更ファイル: `cockpit.html`（`renderChatStatus` 新設 + `applyChat`/SSE `chatStatus` の委譲統一）・
`cockpit-page.test.mjs`（+2・既存 1 本期待値更新）・`cockpit-server.test.mjs`（+1・connect throw→500）・
`domain-c.md`（§1/§2/§3/§5 更新・609）・`s7-followup.md`（§8 race 追記）。

### ① 契約 FAIL が閉じたか — **解消を確認**

`cockpit.html:294-306` に `renderChatStatus(state)` を新設し、`applyChat(c)`（:307-315）は
`renderChatStatus(c.connected ? (c.state || "connecting") : null)` を呼ぶだけに、SSE `chatStatus` ハンドラ
（:880-885）も `renderChatStatus(d.status || "connecting")` を呼ぶだけに統一されている。両経路とも
Disconnect の disabled は `renderChatStatus` 内の 1 箇所（:304-305
`!(state === "connecting" || state === "live" || state === "retrying")`）でのみ決まり、**state の値**
（`connected` の真偽ではない）で判定する。

ended→dead 後に `applyChat` が `{connected:true, state:"dead"}` を受けても
`renderChatStatus("dead")` → `disabled = true` となり、旧実装の「無条件 `disabled=false`」（1 巡目で検出した
箇所）は消えている（`applyChat` 本体に `disabled = false`／`disabled=false` の直書きは無いことを実ソースで
確認・`cockpit-page.test.mjs:347` の `assert.doesNotMatch(afn[0], /disabled\s*=\s*false/)` と一致）。

**実ロジックを駆動するテストで固定済み**であることも確認した。`cockpit-page.test.mjs:298-332` は
`renderChatStatus`/`applyChat` の関数本体を HTML から正規表現で切り出し、fake `byId` で実行し、
`drive({connected:true, state:"dead", source:null})` の結果 `btn-chat-disconnect.disabled === true` を実アサート
している（1 巡目レビューが指摘した「`cockpit-page.test.mjs` は静的構造チェックのみで実 DOM 挙動を検証しない」
という穴も、この追加テストで埋まった）。`connecting`/`live`/`retrying` は disabled=false + 状態別 CSS クラス、
未接続は disabled=true + "not connected" も同テストでアサート済み。もう 1 本
（:334-352）は `applyChat`/SSE ハンドラの両方が `renderChatStatus(` 呼び出しを含み、`applyChat` が
`disabled=false` を直書きしないことを固定する重複防止テスト。

domain-c.md §2（:103-108）の追記も実装と一致：「Disconnect の有効/無効は chat state 値で一貫決定」
「SSE chatStatus と state snapshot 経由の両経路が同じ判定を通す」の記述が `renderChatStatus` の実装と符合する。

**結論: 観点③の契約 FAIL は解消。domain-c.md §2 契約と実装（両経路とも state 値で一貫）が一致した。PASS。**

### ② 退行の有無 — **無し**

- CSS: `.chat-status`/`.chat-status.live`/`.connecting`/`.retrying`/`.dead`（cockpit.html:63-67）は変更前と
  同じ 4 状態クラス構成。`renderChatStatus` の `el.className = "chat-status " + state` は旧実装と同じクラス名
  を生成するため見た目の退行は無い。
- viewer 行（`addTranscriptRow`）・`chatDiagnostic` ゴースト行・`chatBufferAbsent` ゴースト・`selfFire`
  マーカー描画のロジックは今回の差分に含まれておらず（`renderChatStatus`/`applyChat`/`chatStatus` ハンドラ
  以外に変更箇所なし）、1 巡目レビュー §4 で確認した PASS が維持される。
- 606/606（1 巡目）→ 609/609（今回自分で再実行・後述）で、追加された 3 本以外に既存テストの失敗は無い。

### ③ 修正 2（connect throw→500）の固定 — **確認**

`cockpit-server.mjs:891-899` の `connectChat(raw)` 呼び出しを try/catch し、catch で `foldChatClient()` →
500 `{error: "chat connect failed: ..."}`。`cockpit-server.test.mjs:1768-1801`
（`makeThrowingChatClientFactory` の `start-reject`/`factory-throw` 2 モード）で実アサート:
- `start()` reject: 器官は 1 個生成されるが `foldChatClient()` で `isStopped()===true`・
  `listenerCounts()` が `{msg:0, st:0, dg:0}`（フック全撤去・リーク無し）・`GET /api/state` の
  `chat.connected===false`・`chat.state===null` を確認。
- factory 自体の throw: `record.clients.length===0`（器官はそもそも作られていない）・500・
  `chat.connected===false` を確認。

いずれも「盲目の 200」を返さず、器官/フックのリークも残さない実装であることがテストで機械的に担保されている。

### ④ doc 整合 — **一致**

domain-c.md §5（:142-154）の生数字ブロックは `# tests 609 / # pass 609 / # fail 0` で、自分の再実行結果と
一致。§1 のファイル一覧（:62,63,68,69）・§2（:98-108）・§3（:110-115 表）は実装（`renderChatStatus` 新設・
`connectChat` の try/catch・テスト本数の内訳）と食い違いなし。s7-followup.md §8（:113-119）に
「`POST /api/chat/connect` の同時 2 件 race」の記録が残っており、1 巡目レビューの non-blocking 申し送り
（§7-3 相当）が反映されている。

### ⑤ 自分で再実行した機械ゲート（生結果・2 巡目）

```
cd apps/soul/agent && node --test --test-timeout=300000
```
→ 自然終了（ハングなし）。`1..609 / # tests 609 / # pass 609 / # fail 0 / # cancelled 0 / # skipped 0 / # todo 0`
（duration_ms 1269.5888）。domain-c.md §5 の報告値 609 と一致。

```
git diff --stat -- apps/runtime-player packages
git diff --stat -- pnpm-lock.yaml apps/soul/agent/package.json
```
→ 両方とも出力ゼロ（器コード・lockfile・package.json 不変を確認）。

### 2 巡目の判定

**blocking: 0 件。観点③の契約 FAIL は解消。総合判定を PASS-with-findings → PASS に更新する。**

non-blocking（追加修正不要・記録のみ）:
1. `POST /api/chat/connect` の同時 2 件 race（1 巡目 §2/§6-2・s7-followup.md §8 に記録済み）。UI のボタン
   disable で通常操作では再現しないため severity 低。
2. domain-c.md §7-2〜§7-5（1 巡目 non-blocking 3・4 相当）は design レーン外（spec/人間ゲートの領分）として
   1 巡目で既に異論なしと判断済み・再確認の必要なし。

以下、1 巡目のレビュー本文を保存として残す（§0〜§8 は 1 巡目時点の記録）。

---

観点は s7-wave-plan.md §3 Domain C・§4 blocking レビュー基準 1〜5 ／ s7-planning-inventory.md §3「器官の起動/
停止の流儀」／ Gnome 成果物 domain-c.md（§2 ライフサイクル契約・§3 UI データ経路・§7 §質問）／消費した
domain-a.md（状態機械・§7-2 restart 無し・§7-3 notLive）・domain-b.md（attach 点・§9-1 escalate）。design レーン
の 6 観点（① ライフサイクル所有と factory 注入 ② teardown の堅牢性 ③ notLive/ended 状態機械の UI 反映
④ UI SSE データ経路 ⑤ 秘匿情報の非漏洩 ⑥ 堅牢性の穴）を、自分でファイルを読み・自分でコマンドを実行して確認
した（Gnome の報告値を転記していない）。

---

## 0. 自分で再実行した機械ゲート（生結果）

```
cd apps/soul/agent && node --test --test-timeout=300000 src/cockpit/cockpit-server.test.mjs \
  src/cockpit/cockpit-settings-store.test.mjs src/cockpit/cockpit-page.test.mjs scripts/cockpit.test.mjs
```
→ 自然終了・プロンプト復帰（ハングなし）。`1..155 / # pass 155 / # fail 0`（4 ファイル合算）。

```
cd apps/soul/agent && node --test --test-timeout=300000
```
→ 自然終了。`1..606 / # tests 606 / # pass 606 / # fail 0 / # cancelled 0 / # skipped 0 / # todo 0`。
domain-c.md §5 の報告値 606 と一致。プロセスが自力で終了した（`close()` のタイマ/プロセスリーク無し主張の
直接的裏付け）。

---

## 1. ライフサイクル所有と factory 注入の妥当性（観点①）— **PASS**

- `cockpit-server.mjs:359-419` でチャット器官の生成/Connect/停止を **cockpit-server が所有**する設計を確認
  （`chatClientFactory`/`onSetChatSource`/`chatSourceStatusImpl` を option 分解・`chatClient`/`chatUnsubs`
  を内部状態として保持）。ear-pipeline の `pipelineFactory` と同型の「オプション注入 factory・POST 駆動」流儀。
- `connectChat(source)`（:1191-1212）は `chatClientFactory({ source })` を呼ぶだけで、器官の中身（innertube 取得）
  を一切知らない。`scripts/cockpit.mjs:53` の `import { createLiveChatClient } from "../src/chat/live-chat-client.mjs"`
  と `cockpit.mjs:542 chatClientFactory: createLiveChatClient` を確認し、**cockpit-server.mjs 自体には
  `src/chat/**` への import が 1 つも無い**ことを `grep -n "src/chat" apps/soul/agent/src/cockpit/cockpit-server.mjs`
  で実行して確認済み（ヒット 0 件・コメントのみ言及）。domain-c.md §4 が主張する
  `check-soul-zone-boundary.mjs` passed（cockpit-server は器官を import しない）は実ソースと整合する。
- `createChatSourceHooks`（cockpit.mjs:325-338）は Channel URL/visionTarget と同型の薄い settings 橋渡し。
  cockpit.test.mjs:465-492 で橋渡し/status/失敗寛容の 3 本を確認（実行結果 155/155 pass に含まれる）。
- §質問2（domain-c.md §7-2「fireOrchestratorFactory と同型の全注入にした」裁定）は責務境界（cockpit-server が
  器官の中身から独立）として妥当と判断する。ear-pipeline の実 import 既定 pipelineFactory とは異なる形にした
  理由（本番配線を cockpit.mjs 側に集約）も、実疎通での fetch ヘッダ調整（followup §4）を見据えると合理的。

**結論: factory 全注入・cockpit-server 所有のライフサイクル設計は wave-plan §3 Domain C の指示と一致し、逆方向
import も無い。PASS。**

---

## 2. teardown の堅牢性（観点②）— **PASS**

`foldChatClient()`（cockpit-server.mjs:1161-1179）を読了:

- 購読解除は `for (const unsub of chatUnsubs) { try { unsub(); } catch {} }` → best-effort（:1162-1168）。
- `chatClient` を **先に `null` へ代入してから** `c.stop()` を呼ぶ（:1170-1178）——stop() 内で診断リスナー等が
  何か副作用を起こしても `chatClient` は既に null なので二重に触られない設計。
- `chatUnsubs = []` で配列をクリア（:1169）——再 Connect 時に古い unsub を残さない。
- `stop()` 自体は try/catch で包み、既に dead でも冪等に扱う（:1173-1177）。

**再 Connect（同一 restart 無し）**: `connectChat()` 冒頭で必ず `foldChatClient()` を呼んでから新規生成
（:1192）。テスト「Connect 再操作: 既存器官を畳んで新 source で作り直す」（cockpit-server.test.mjs:1658-1677）
で `first.isStopped()===true` かつ `fakeChat.record.clients.length===2` を実アサートしていることを確認
（domain-a.md §7-2「操縦席側で作り直す」裁定の実装として一致）。

**disconnect/close の冪等性**: 「Disconnect: stop() + フック購読解除で畳み・以後のコメントは合流しない」
（:1627-1656）で、disconnect 後に `client.emitMessage(...)` を呼んでも viewer エントリが増えないことを実アサート
（購読解除が実効していることの直接証拠）。「close(): 稼働中のチャット器官も畳む」（:1679-1688）で
`client.isStopped()` が close 前 false→close 後 true になることを確認。`close()` 本体（:1258-1262）は
`foldChatClient()` を**最初に**呼んでから他のリソース（bargeInGate/fireScheduler/fireOrchestrator/SSE/pipeline）
を畳む順序。

**二重 Connect/未 Connect 時の安全性**: 未 Connect で disconnect → `foldChatClient()` は `chatUnsubs=[]`（無害）・
`chatClient` は既に null なので何もしない → 200 が冪等に返る（コードの `if (chatClient)` ガードで確認・:1170）。

**結論: リーク（タイマ・購読・プロセス）は無い。0 節の実行で 606/606 pass・プロセス自然終了を自分で確認して
おり、teardown の堅牢性は machine ゲートでも裏付けられている。PASS。**

一点、blocking ではないが記録しておく懸念（§6-races 参照）: `connectChat()` は `foldChatClient()` →
`chatClientFactory(...)` → `chatUnsubs.push(...)` → `await onSetChatSource(source)` → `await client.start()`
という非同期シーケンスで、`await onSetChatSource` の地点でイベントループに制御が戻る。この間に**別の**
POST `/api/chat/connect` が割り込むと、先着リクエストの `client` ローカル変数は後着の `foldChatClient()` で
既に `stop()` 済みの器官を指したまま `await client.start()` を呼ぶ（`start()` は `stopped` ガードで no-op に
劣化するため実害はクラッシュ等ではないが、先着リクエストの 200 レスポンスがどちらの器官を指すか曖昧になる）。
UI 側は Connect ボタンを押下直後に disable する（cockpit.html:770）ため通常操作では再現しないが、決定論テスト
での固定は無い（cockpit-server.test.mjs に該当ケースなし）。

---

## 3. notLive/ended の状態機械が UI に正しく出るか（観点③）— **FAIL（design 観点・machine ゲートには非該当）**

domain-c.md §2 の契約: 「**ended（終了）は dead（終端）→ UI は chat-status=dead（赤）+ Disconnect 無効化**」。

実装を突き合わせると、**この無効化ロジックが二重管理されており、片方の経路で契約を満たしていない**:

- `cockpit.html:870-878`（SSE `chatStatus` イベントハンドラ）は `st === "dead"` のとき
  `byId("btn-chat-disconnect").disabled = (st === "dead")` を正しく行う。
- しかし `cockpit.html:289-305`（`applyChat(c)` 関数・`state` SSE イベントおよび初期化時の
  `GET /api/state` から呼ばれる）は、`c.connected`（= サーバ側 `chatClient != null`）が true である限り
  `st = c.state || "connecting"` を求めて表示するだけで、`st === "dead"` の判定を一切せず、無条件で
  `byId("btn-chat-disconnect").disabled = false;`（:304）にしてしまう。

`chatClient` は器官が **ended → dead に自律遷移しても `null` に戻らない**（cockpit-server 側は
`onStatus("dead")` を `broadcastChatStatus` に転送するだけで `foldChatClient()` を呼ばない——
:1191-1212 の `connectChat` 内・:904-909 の disconnect ハンドラ・:1258 の `close()` 以外に
`foldChatClient()` の呼び出し箇所は無いことを `grep -n "foldChatClient()" cockpit-server.mjs` で確認）。
つまり ended 後は `snapshot().chat = { connected: true, state: "dead", ... }` のままであり、この snapshot が
以下のいずれかの経路で `applyChat` に渡ると Disconnect ボタンが**誤って再有効化**される:

1. **ページ再読み込み**（`init()` → `GET /api/state` → `applyState(s)` → `applyChat(s.chat)`）。ended 検知後に
   タブを開き直すと、chatStatus SSE の履歴は失われるため、`applyChat` だけが実行され、確実にこの不整合が
   再現する。
2. ended 検知後に **他の操作**（耳の start/stop・Channel URL 設定・vision-target 設定・audio-device 設定など）
   が `broadcastState()`（cockpit-server.mjs:493 の呼び出し箇所は :510,:656,:683,:796,:836,:857,:873,:900,:907
   の計 9 箇所）を経由して SSE `"state"` を再送すると、同じく `applyChat` が呼ばれて再現する。

**実害の評価**: ボタンが「押せる」ように見えても、押した結果は `POST /api/chat/disconnect` → `foldChatClient()`
（既に dead な器官への冪等 `stop()`）→ 200 → `applyChat` が改めて `connected:false` を描画し「not connected」
に落ち着く。**データ破損・二重発火・クラッシュ等の実害はない**（disconnect は冪等）。したがって wave-plan §4
の blocking 基準（器/契約/lock 不変・実ネット不出・器官独立性・スケジューラ決定論・3 チェック無退行）には
抵触しない——**machine ゲート観点では non-blocking**。ただし本レビューの観点③（「notLive/ended の状態機械が
UI に正しく出るか」）は明確に **FAIL**: Gnome 自身が domain-c.md §2 に明記した契約と実装が食い違っており、
`cockpit-page.test.mjs` は静的構造チェックのみ（実 DOM 挙動は検証しない旨がファイル冒頭コメントに明記済み
——:10「見た目はテストしない」）ため、この不整合は機械テストでは検出されない穴になっている。

**該当箇所**: `apps/soul/agent/src/cockpit/cockpit.html:289-305`（`applyChat`）と `:870-878`
（`chatStatus` イベントハンドラ）の重複ロジックの不一致。

**修正の方向性（提案・実装はしていない）**: `applyChat(c)` 内で `st === "dead"` のときも
`disabled = true` にする 1 行を足せば、`state` snapshot 経由でも `chatStatus` イベント経由でも一貫する
（`connected` の真偽ではなく `state` の値で disable を決めるよう統一）。

---

## 4. UI の SSE データ経路の正しさ（観点④）— **PASS**（③の1点を除く）

- **viewer 行**: `addTranscriptRow`（cockpit.html:376-398）が `speaker === "viewer" && d.displayName` のとき
  `viewer(名前)` を、それ以外は素の `speaker` 文字列を描く（:386）。displayName 欠落時は `viewer` へ劣化する
  実装を確認——Domain B の `formatLine`（fire-injection.mjs、注入描画側）の劣化仕様と対称。CSS
  `.row.speaker-viewer .who/.text`（cockpit.html:115-116）で別色。cockpit-server.mjs の `ingestChatMessage`
  （:1096-1128）が SSE `"transcript"` を 1 回だけ放送する実装（:1114-1122）と、Domain B が固定した「viewer 除外
  ＝耳の onTranscript は放送しない」設計により二重放送は起きない（Domain B の担当領域だが、cockpit-server.mjs
  側で `ingestChatMessage` が唯一の viewer 放送元であることをコードで確認した）。
- **chatStatus**: `broadcastChatStatus`（:1135-1138）→ SSE `"chatStatus"` → `cockpit.html:870-878` が
  connecting/live/retrying/dead を CSS クラスに反映。
- **chatDiagnostic ゴースト行**: `broadcastChatDiagnostic`（:1146-1155）は info をそのまま透過。
  `cockpit.html:881-890` が notLive/ended/extractFailed/network/internalError のみゴースト行に出し、
  観測補助診断（connected/stopped/ignoredRenderers/listenerError）を非表示にするフィルタを確認
  （domain-c.md §3 の記述と一致）。過剰表示回避の方針は S3 の抑制方針の踏襲であり妥当。
- **chatBufferAbsent ゴースト行**: `ingestChatMessage`（:1103-1111）がバッファ無しのとき
  `handleDiagnostic({ type: "chatBufferAbsent", ... })` を呼び、`cockpit.html:839` が
  `(chat: ears not running — comment did not merge)` を描く。Domain B §5 の escalate 前提（耳未起動時は
  合流させない）を UI が正直に見せる設計として妥当。
- **selfFire kind 表示**: `cockpit.html:864-868` の `selfFire` イベントハンドラは kind に応じた分岐を持たず
  `addSelfFireMarkerRow(d)` に丸投げする実装（kind 非依存）で、comment/comment-call も call/turn-end/silence と
  同型に描かれることを確認（domain-c.md §3 の主張と一致）。

**結論: viewer 行・chatStatus・chatDiagnostic・chatBufferAbsent・selfFire の 5 経路はいずれも Domain B が流す
SSE 形と整合しており、過剰表示を避けるフィルタも妥当。PASS（Disconnect ボタンの状態表示のみ §3 で個別に FAIL
とした）。**

---

## 5. 秘匿情報の非漏洩（観点⑤）— **PASS**

- `cockpit-settings-store.mjs:135-141`（`getChatSource`/`setChatSource`）は文字列をそのまま read-modify-write
  で永続化するだけで、token を分離・redact する処理は無い——**設計上それでよい**理由は、chatSource は
  YouTube の**公開**視聴 URL/video ID（`https://youtube.com/watch?v=...` 等）であり、Channel URL
  （`ws://...?token=...` 形式・cockpit-server.mjs:870-872 のコメントで「URL 自体はここに保持/ログしない」と
  明記され `channel-url` 入力欄が POST 後に clear される設計・cockpit.html:756）とは非対称に扱ってよい対象
  だからである。
- `cockpit.html` の `chat-source` 入力欄は Connect 成功後もクリアされない実装（:781 `chatSourceEdited = false`
  のみで value はクリアしない）——これは Channel URL の `channel-url` クリア（:756）と対照的だが、chatSource
  には token が含まれない前提なので意図的な非対称であり妥当。
- `broadcastChatDiagnostic`（:1146-1155）は info を `kind/message/atMs/delayMs/attempt` の 5 フィールドに
  絞って転送しており、任意の追加フィールド（仮に器官側が url 等を誤って積んでも）を SSE に漏らさない
  ホワイトリスト方式になっている——設計として堅牢。
- `snapshot().chat.source`（:467）は settings 由来の source をそのまま返すが、これも公開 URL/ID であり、
  Channel の `channelStatusImpl()` が redact 済みであることを要求される非対称設計（:456 のコメント参照）とは
  別の扱いで問題ない。

**結論: token を扱わない設計判断が settings-store・SSE 両方で一貫しており、秘匿情報漏洩の経路は見当たらない。
PASS。**

---

## 6. 堅牢性の穴（観点⑥）— **概ね PASS・カバレッジの穴を 2 件記録（non-blocking）**

エッジケースごとの実装確認:

| エッジケース | 実装の扱い | テストの有無 |
|---|---|---|
| factory 未注入で connect | 503（cockpit-server.mjs:879-883） | あり（:1690-1700・実アサート済み） |
| source 空 | 400（:886-890） | あり（:1702-1715） |
| `start()` throw（想定外・factory 自体の throw 含む） | POST ハンドラの try/catch（:891-899）が `foldChatClient()` + 500 で畳んで正直に返す実装を確認 | **無し**（cockpit-server.test.mjs に該当テストが見当たらない・`grep -n "chat connect failed" cockpit-server.test.mjs` はヒット 0） |
| 永続化失敗（`onSetChatSource` throw） | `connectChat` 内 try/catch で握り Connect を継続（:1204-1210） | あり（cockpit.test.mjs:483-492 の `createChatSourceHooks` throw 握りテスト・settings-store 側の unwritable path テストも別途あり） |
| 器官が dead 後の再 Connect | 新規 factory 呼び出しで別インスタンスを作る（restart 無し） | あり（:1658-1677） |
| 同時 2 リクエストの Connect（race） | §2 で記録した通り実害は限定的だが未固定 | **無し** |

**結論**: 主要なエッジケースは実装・テストとも妥当。以下 2 点は non-blocking のテストカバレッジの穴として
記録する（実装自体は正直で安全側に倒れているため blocking 化はしない）:

1. `connectChat` 内の想定外 throw（factory 自体が同期/非同期で throw するケース）を駆動する決定論テストが無い。
   実装（`foldChatClient()` を挟んで 500 を返す・:891-899）自体はコードレビューで妥当と判断できるが、
   fake factory に `throw` させる 1 本があれば「盲目の 200」を返さないことが機械的に担保される。
2. `POST /api/chat/connect` の同時実行（1 件目が `await onSetChatSource`/`await client.start()` で
   一時停止している間に 2 件目が割り込む）を固定するテストが無い。UI 側のボタン disable で通常操作では
   再現しないため severity は低い。

---

## 7. blocking / non-blocking 判定

**blocking: 0 件。**

- ライフサイクル所有・factory 注入・soul-zone 越境: 違反なし（§1）。
- teardown リーク（タイマ/購読/プロセス）: 無し（§2・0 節の実行で 606/606・プロセス自然終了を自分で確認）。
- 器/契約/lock 不変・機械テスト実ネット不出: domain-c.md §4/§5 の主張は自分の再実行で裏付けられた。
- スケジューラ決定論・S1〜S6 無退行: Domain B の管轄（本レビューでは追加確認不要・606/606 pass に含まれる）。

**non-blocking（Orch-Sylph への申し送り。1 件は design 契約との齟齬＝修正推奨、他は Gnome 自身が
domain-c.md §7 に明記済みの申し送りで design レーンとして追加の異論なし）**:

1. **【修正推奨・§3 で検出】`applyChat`（cockpit.html:289-305）が ended→dead 後の `state` snapshot 経由
   （ページ再読み込み・他操作の broadcastState 経由）で Disconnect ボタンを誤って再有効化する。
   domain-c.md §2 の契約（「dead は Disconnect 無効化」）と実装が食い違う。実害は限定的（disconnect は冪等）
   だが、`cockpit-page.test.mjs` が「見た目はテストしない」方針のため機械テストでは検出されない。1 行の修正
   （`st==="dead"` の判定を `applyChat` にも足す）で解消できる見込み。**Orch-Sylph の裁定を仰ぐ**（このまま
   人間ゲートへ進めるか、先に直すか）。
2. `connectChat` の想定外 throw を駆動するテストが無い（§6-1）。実装は正直に 500+畳みで応答するため機能面の
   懸念ではないが、回帰の早期検知のためテスト追加が望ましい。
3. 同時 2 件の `POST /api/chat/connect` の race（§2・§6-2）は UI のボタン disable で通常operationでは再現
   しないため severity 低。
4. domain-c.md §7-2〜§7-5（factory 全注入の裁定・start() await の裁定・paid 区別なしの裁定・実疎通未検証項目）
   はいずれも Gnome/Domain B からの申し送りであり、design レーンの観点（本レビューの①〜⑥）からは§7-2 を
   §1 で・§7-3 を §2/§6 で確認済み。§7-4（paid 区別なし）・§7-5（実疎通未検証）は design レーン外
   （spec/人間ゲートの領分）と判断し、追加の異論なし。

---

## 8. §質問（Orch-Sylph への申し送り・判断が必要な点）

1. **Disconnect ボタンの dead 状態表示不整合（§3・§7-1 の修正要否）**: 機械ゲートの blocking 基準には
   抵触しないが、Gnome 自身が明記した契約（domain-c.md §2）との齟齬であり、人間ゲート（実疎通で ended を
   実際に踏む場面がある）で視認される可能性がある。Orch-Sylph の裁定として、(a) 人間ゲート前に 1 行修正して
   contract を満たすか、(b) non-blocking のまま人間ゲートへ進め followup に積むか、どちらを取るか判断を
   仰ぎたい。
2. **§6 のテストカバレッジ 2 件（想定外 throw・同時 Connect race）**: 追加テストを Domain C の追撃として
   要求するか、s7-followup 台帳の軽微項目（§8）に合流させるかの裁定を仰ぎたい。
