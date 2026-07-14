# 操縦席UI改定 Domain B レビュー（test レーン）

> レーン: **test**（テストが実在し・主張する挙動を実行を伴って固定し・決定論的で・実ネットに出ないか）。
> レビュアー: Review-Sylph。呼び出し元: Orch-Sylph（操縦席UI改定 wave 実行責任者）。
> 対象: `apps/soul/agent/src/cockpit/cockpit-ui.test.mjs`（23 本）・`src/cockpit/view-logic/health.test.mjs`（5 本）・
> `src/cockpit/cockpit-static-assets.test.mjs`（10 本＝+1 本・1 本対象変更）・機能同値の照合元
> `src/cockpit/cockpit.html`（不改変の正）・実装 `src/cockpit/ui/*.mjs`（5 ファイル）/`view-logic/health.mjs`。
> 日付: 2026-07-14。読み取り専任・自分で再実行した生数字を根拠にする。install/commit/実装変更・実ネット到達は
> 一切していない（検証はすべて loopback / ローカルファイル / scratchpad 上の合成照合スクリプト）。
> `.tmp/facex-*`・`screens/cockpit-ia-redesign.md`・`packages/authoring-core` は不干渉。
> **総合判定: PASS（blocking ゼロ・non-blocking 7 件＝すべて修正不要の観察または文書精度）。**

## 0. 自分で再実行した機械ゲート生数字

`cd apps/soul/agent && node --test`（全テスト・タイムアウト 300s・1 回で緑・空/interrupted なし・再試行不要）:

```
1..675
# tests 675
# pass 675
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 1359.5442
```

個別実行（いずれも 1 回で緑）:

| 対象 | 実行結果 | Claim（domain-b.md §7 / Orch ベースライン） | 照合 |
|---|---|---|---|
| 全体 `node --test` | **675/675**・fail 0・skipped 0・todo 0 | 675/675 | 一致 |
| `cockpit-server.test.mjs` | **74/74** | 74/74（背骨・無退行） | 一致 |
| `cockpit-page.test.mjs` | **30/30** | 30/30（無改変で緑＝cockpit.html 不触の証明） | 一致 |
| `cockpit-ui.test.mjs` | **23/23** | 23 本 | 一致 |
| `view-logic/health.test.mjs` | **5/5** | 5 本 | 一致 |
| `cockpit-static-assets.test.mjs` | **10/10** | 10 本（9→10・+1 本/1 本対象変更） | 一致 |

- 本数の機械照合（`^test(` の行数）: cockpit-ui.test **23** / health.test **5** / static-assets.test **10**。
  `test.skip|test.only|test.todo` のヒット **0** ＝ 緑の偽装は無い。
- 加算の整合: 実行前ベースライン 646（Domain A レビュー 2 巡目で私自身が確定した数字）+ 23 + 5 + 1 = **675**。
  view-logic は 14 ファイル（Domain A の 12 ＋ health.mjs/health.test.mjs）で Domain A 分は不変。
- 器・不可侵の裏取り（git 実測）: `git diff --stat -- …cockpit.html …cockpit-page.test.mjs …scripts/cockpit.mjs
  …cockpit-server.test.mjs` → **出力なし**。`cockpit-server.mjs` は **80 insertions のまま**（Domain A 時点と同一＝
  本 Domain はサーバ 1 バイト不触の Claim と一致）。`pnpm-lock.yaml`・`package.json` → 出力なし（依存不変）。

## 1. rows.mjs fixture の機能同値性（最重要） — **PASS（合成照合 53 入力 + speaking 除去規律 ALL MATCH）**

fixture の逐語照合（cockpit.html の対応行を自分で読んで期待値と突き合わせ）に加え、Domain A レビューと同じ流儀で
**cockpit.html の subscribe() ハンドラ本体を正規表現で切り出し、fake フック（addGhostRow/addBargeInMarkerRow 等を
捕捉する偽物）で駆動して、新実装 `feedAfterSseEvent` の出力（行を作る/作らない・行種・ghost ラベル文字列）と
機械照合する合成テスト**を scratchpad で自作・実行した。入力は 13 イベント × 53 ケース
（diagnostic 全 13 表示/非表示型＋未知型＋type 欠落、chatDiagnostic 白名簿 5 種×message 有無＋観測補助 4 種＋kind 欠落、
fire accepted true/false/欠落、selfFire fired true/false/欠落、vad 5 種 ほか）——**全 53 ケース MATCH**。
さらに「speaking 行あり feed から駆動 → 旧ハンドラが除去する/しないと新実装で speaking 行が消える/残るの一致」も
全ケース MATCH。

### 1-1. 指定検証点 (a)〜(f)

| 検証点 | 判定 | 根拠 |
|---|---|---|
| (a) diagnostic の bargeIn **先**分流（:842） | **同値** | 旧 :830-855 は type の if-else if チェーン＝type は単一値なので排他マッチであり、**分岐順の違いで挙動差が出る入力は存在しない**（type が 2 型を同時に満たすことは不可能）。新実装は bargeIn を先に `feedWithBargeInMarker` へ、他は `diagnosticGhostLabel`（bargeIn は default→null＝ghost.mjs :57-58）。合成照合で bargeIn 含む全 diagnostic 型が一致。bargeIn 時に speaking 行を除去しない点も一致（旧 addBargeInMarkerRow は removeSpeakingRow を呼ばない＝新 feedWithBargeInMarker は appended のみ） |
| (b) ghost null が**行を作らない** assert の実在 | **実在** | cockpit-ui.test :137-146（`feedWithGhost(feed, null)` が**同一オブジェクト参照**を返す assert.equal＝最強の不変証明）・:218-231（意図的非表示 3 型＋未知型 `futureUnknown` が同一 feed）・:248-257（chat 観測補助 connected/stopped/ignoredRenderers/listenerError が同一 feed）。type/kind 欠落 `{}` は feedAfterSseEvent レベルでは未踏だが ghost.test（Domain A 固定）＋私の合成照合で null＝行なしを実行確認 |
| (c) speaking 行の規律 | **同値** | :115-135 が固定: 二重 show 無視（同一参照）・transcript/ghost は除去してから積む（旧 :387/:418 の removeSpeakingRow と対応）・**マーカー行（fire で代表）は除去しない**・hide はあれば除去/なければ同一 feed（旧 :375 `if (speakingRow) return;` /:370-373 と同値）。マーカー 5 種は全て共通の `appended()` 直呼びなので fire での固定が構造的に全種へ及ぶ。合成照合の除去規律クロスチェックも全ケース一致 |
| (d) feedFromHistory（全置換・latency 無し） | **同値** | :180-197。emptyFeed から積む＝旧 `timeline.innerHTML = ""`（:411）の全置換と同値。latText null は「履歴エントリに latencyMs が契約上載らない」入力での固定（旧 addTranscriptRow も新 feedWithTranscript も「あれば描く」で写像自体も同一）。空配列/undefined→空フィードも assert 実在 |
| (e) fire accepted:true のみマーカー | **同値** | :233-239。false→同一 feed の assert 実在。accepted **欠落**はテスト未踏だが実装は `d.accepted === true` の厳密比較（旧 :862 と同一の意味論）で、私の合成照合 `fire {}` が MATCH（→ non-blocking 4） |
| (f) selfFire fired 分岐 | **同値** | :241-246。fired:true→self-fire-marker・fired:false→ghost "(self-fire: silence not fired — busy)"。旧 :876 `if (d.fired)` truthy 判定と新 `d && d.fired` は同値（fired 欠落→ghost も合成照合で一致） |

### 1-2. 文字列・時刻・構造の逐語照合（対応行を自分で読んだもの）

- transcript: timeText は `(d && d.appendedAtMs) || nowMs`（旧 :392 `d.appendedAtMs || Date.now()` と同じ `||` 意味論）・
  rowClass `"row speaker-viewer"`（:390）・whoText `viewer(taro)`（:396）・latText `"(1.5s)"`（:401-404 toFixed(1)）・
  speaker 欠落→you（:388）——fixture :92-113 が全て固定。
- マーカー文字列: fired（:456-457）・troubled 0.8 ✓4/✗1（:474-478）・saw "FooGame" (1920x1080, 123ms)（:495-496）・
  interrupted（:520-521）・self-fire (silence)（:539）——fixture :148-178 が固定（マーカー記号 `*`/`!!`/`~`・
  whoText fire/expr/vision/barge-in/self・fire の atMs 優先 :452 込み）。vision の jpegBase64 欠落→thumbSrc null（:498）も固定。
- 行 id 単調増加・一意（preact key・履歴復元後も衝突しない）: :267-274 実在。
- **em-dash のバイト照合**: health.test.mjs / health.mjs / cockpit.html のダッシュ類コードポイントを機械抽出→
  3 ファイルとも **U+2014 のみ**（バイト一致）。

## 2. SSE_EVENT_NAMES 固定テストの実効性 — **PASS（名前まで固定）**

- cockpit-ui.test :78-84 は `assert.deepEqual` で **13 個の名前・配列順序を丸ごと固定**（本数だけの固定ではない＝
  改名漏れを検知できる）。
- cockpit.html の `addEventListener` 13 本（:816 state /:817 vad /:822 transcript /:824 expression /:825 discard /
  :830 diagnostic /:857 soul /:860 fire /:866 visionCaptured /:868 usage /:874 selfFire /:880 chatStatus /
  :888 chatDiagnostic）と**名前・出現順とも 1:1 一致**を自分で目視照合。
- ワイヤ契約側の正: cockpit-server.test.mjs が 13 イベント全種を**実受信**（`waitFor((e) => e.event === "…")`）で
  固定していることを grep で確認（74/74 緑＝背骨無退行）。
- 限界の認知: SSE_EVENT_NAMES → `addEventListener` の**実配線**（app.mjs :150-157 の購読ループ）は App 未実行のため
  実行を伴っていない（ソース読解では確認・リストだけから addEventListener する単一ループ）。これは §8-1 の既定の
  限界の内側であり、fixture が固定するのは「リストの中身」——テストの主張文言（「SSE_EVENT_NAMES: 既存 13 SSE
  イベントと 1:1」）はリストの固定として正確で、経路主張の誇張は無い。

## 3. import スモーク・構造テストの実効性 — **PASS（論理を反証実験で確認・検出器に軽微な穴＝non-blocking）**

- **「import が成功する＝トップレベル副作用があれば落ちる」の論理を自分の反証実験で確認**: scratchpad に
  (1) 裸の `document.title = "x"` を持つモジュール → import が **ReferenceError で失敗**、
  (2) `new globalThis.EventSource(…)` を持つモジュール → import が **TypeError で失敗**（globalThis 経由でも
  実行副作用は Node で落ちる）。よって「globalThis.document が無い Node で import が通る＝トップレベルで
  DOM/EventSource を実行していない」は成立。落ちないのは「globalThis.* を参照して保持するだけ」だが、それは
  副作用ではない。ui/*.mjs 5 ファイルのトップレベルは目視でも import/export のみ（本レビューで全読）。
- スモークは 21 export の型検査つき（:43-54）＝「import 出来た」の暗黙合格でなく明示 assert。
- 閉域テスト（:58-74）: 許可先 3 種（`../vendor/htm.preact.standalone.mjs` 逐語・`../view-logic/*.mjs`・`./*.mjs`
  かつ `/../` 禁止）＋ `node:*` 禁止。実 import 16 本（grep で全列挙）は全て許可先——**違反ゼロを実測**。
  検出正規表現は `import … from "…"` 形のみで、**side-effect import（`import "x"`）・dynamic import・
  `export … from` を検出しない穴**がある（現状該当コードは無い→ non-blocking 1）。

## 4. vnode 走査テストの実効性 — **PASS（正直な限界の記録も確認）**

- collectText は関数コンポーネントを `node.type(node.props)` で**実際に実行**して展開する（hooks 非使用が前提）——
  FeedRow/Header/HealthStat は実行を伴った検証になっている（node --test 23/23 の中で毎回実行）。
- FeedRow: **全 8 行種＋未知 kind** のテキスト描画を固定（speaking の固定文言 "you······(speaking)" は旧 :379-380 と
  逐語一致・latText null 分岐・expression の ↳・vision のサムネがテキストに漏れないことまで）。
- Header: こーでぃー/Listening/whisper/down — gone（reason 併記＝healthStatusView 経由の証明）/MV7+/⚙ の 6 assert。
- 限界: 走査はテキストのみで **class 属性（rowClass 等）・img src 属性は未検証**（文字列構築自体は rows fixture で
  固定済み→ non-blocking 2）。
- **App/Feed（hooks 使用）が Node 未実行である事実は domain-b.md §8-1 に正直に記録されている**ことを確認
  （html テンプレート評価・SSE effect・自動スクロール effect・EventSource 実配線は人間ゲートへ・注入口
  eventSourceImpl/fetchImpl/nowImpl 用意済み）。これは wave-plan の L0 裁定（devDep ゼロ・linkedom は台帳の梯子）の
  既定の限界であり blocking ではない。

## 5. L0 裁定 3（static-assets の対象変更 + 追加 1 本） — **PASS（意図保存を確認)**

- 旧「`/ui/app.mjs` は 404」テストが担っていた意図は 2 つ: (i) 存在しない .mjs は 404、(ii) ui/ 未生成の事実固定。
  ui/ 実体化で (ii) は**事実自体が消滅**（固定し続けたら逆に嘘になる）。(i) は新対象 `/ui/does-not-exist.mjs`
  （:209-222）で**保存**されている——`/view-logic/does-not-exist.mjs` と並べて同じ「存在しない .mjs → 404」を
  固定し、テスト内コメントで対象変更の理由（旧テストの意図と実在時 200 テストへの引き継ぎ）を明記。§8-6 の
  記録とも一致。
- 追加 1 本（:226-240）: ui 5 ファイル（app/header/feed/rows/styles）を**実 HTTP** で GET し
  200 + `text/javascript` + **`Buffer.equals` によるディスク実バイト照合**——「置くだけで配信される」Claim を
  弱い存在チェックでなくバイト同一性で固定しており実効的。
- Domain A 追修正のトラバーサル 3 本（`..%2f` 単段/二段・`..%5C` raw socket）は 10 本の中に無傷で残存・緑
  （1 巡目 blocking の解消状態は退行していない）。

## 6. 決定論・ネット純度 — **PASS**

- **cockpit-ui.test.mjs / health.test.mjs**: `Date.now`/`Math.random`/`setTimeout`/`setInterval`/`fetch`/
  `EventSource`/`http`/URL リテラルの grep ヒット **0**（コメント 2 件のみ）。時刻は `new Date(2026, 6, 14, …)` の
  **ローカル成分から epoch を作り戻す方式**（Domain A format-time.test と同じ流儀）で TZ 非依存・nowMs は全 fixture で
  注入（T0/T1 固定値）。実タイマ非依存: uptime の 1s 刻みは App 未実行のためテスト中に一切回らない
  （uptime の計算・整形は Domain A の format-time fixture が固定済み・本 Domain のテストが再固定しないのは
  重複回避として妥当）。
- **cockpit-static-assets.test.mjs**: 到達先は `createCockpitServer({})` → `listen(0)` が返す URL のみ
  （サーバは `DEFAULT_COCKPIT_HOST="127.0.0.1"`・Domain A レビューで検証済み・本 Domain でサーバ不変を diff 確認）＝
  **loopback 限定**。rawGet/rawSocketGet とも外部 URL・DNS・実 fetch 無し。
- 全体 675 本が **1.36 秒**で完走（実ネット待ちの兆候なし）。cancelled 0・skipped 0・todo 0。
- wave-plan §4 基準 3・5 の観点: health.mjs は import 文ゼロ（依存ゼロの純関数）+ fixture 5 本対応 ✓・
  devDep ゼロ維持（テストは node:test/assert/fs/path/url/http/net の標準のみ）✓。

## 7. health.test 5 本の機能同値 — **PASS（全項目一致）**

| 純関数 | cockpit.html 実体 | fixture 期待値との照合 |
|---|---|---|
| `earsStatusView` | :267-270（listening 判定 + 三項の文言 + `"dot " + on/off`） | 一致。未知値/undefined→Stopped 劣化（三項の else と同値）まで assert 実在。初期 ears="stopped" → "Stopped"/"dot off" は初期 HTML :153-154 とも同値 |
| `healthStatusView` | :360-366 applyHealth（`h.status + (h.status === "down" && h.reason ? " — " + h.reason : "")`・`"hstat " + h.status`・`title = h.reason \|\| ""`） | 一致。**down + reason null → 素の "down"**（`&&` 短絡）・title の 3 様まで固定。em-dash U+2014 バイト一致（§1-2） |
| `healthStatusView(falsy)` | :361 `if (!h) return;`（表示を更新しない） | 一致。null/undefined → **null** の assert 実在（view-logic 様式「null=更新しない」） |
| `mergeHealth` | :271-274（`if (s.health)` + applyHealth の `if (!h) return;` ＝欠落側は前の表示のまま） | 一致。s.health ごと欠落→**prev の同一参照**・片側欠落→前値保持・両方更新の 3 態を固定。preact state 遷移への写像として同値 |
| `voiceOutputLabel` | :344（`ad && ad.name ? ad.name : "default"`） | 一致。**空文字も falsy→"default"** まで固定 |

- `initialHealth()`（app.mjs）の「初期 unknown」も照合元 :158-159（`class="hstat unknown"`・"unknown"）と同値・
  fixture :307-312 実在。`settingsFromSnapshot` は null→全 null / 実 snapshot→素通しの 2 態固定（:293-305）。
- `isStuckToBottom`: 境界値（閾値ちょうど＝追従しない・閾値内・ぴったり末尾・上端）の 4 態固定（:278-289）。
  旧実装は無条件末尾追従（:383）なので「追従停止」はモック §2 の承認済み新仕様——テストは新仕様を固定しており
  挙動保存の枠外であることが cockpit-ui.test / feed.mjs 双方のコメントで明示されている。

## 8. blocking / non-blocking の分離

**blocking: 0 件**

**non-blocking（すべて修正不要の観察または文書精度・Orch/後続 Domain の裁量）:**

1. **閉域テストの import 検出正規表現に穴**: side-effect import（`import "./x.mjs"`）・dynamic `import()`・
   `export … from` を検出しない。現 ui/*.mjs に該当コードは無い（grep 実測ゼロ）ため実害なし。Domain C で
   ui/ ファイルが増える際に検出器としての網羅性を上げるなら `export\s+\*?\{?[^;]*from` と裸 import 形の追加が安価。
2. **vnode 走査がテキストのみ**: FeedRow の class 属性（rowClass・"row " + kind）と vision の img src 属性は
   vnode の props までは assert していない（文字列構築自体は rows fixture が固定・class は人間ゲート/CSS の領分）。
3. **injectStyles の doc あり経路（冪等注入）が未実行**: テストは null/undefined 安全のみ。fake doc
   （getElementById/createElement/head.appendChild の 4 メンバ）で「二重注入防止・<style id> 付与・CSS 全文注入」を
   Node で実行固定できる余地がある（5 行の薄い関数であり L0 限界の周辺・任意）。
4. **fire の accepted 欠落ケースが fixture 未踏**: 実装は `=== true` の厳密比較（旧 :862 と同一）で、私の合成照合
   `fire {}` で旧実装と一致（行なし）を実行確認済み。網羅性の観察のみ。
5. **expression 行のマーカー「◆」（旧 :472）が「↳」（sub-arrow）へ変更**: モック §7 承認済み意匠（サブ行
   インデント + ↳）としてテストは新意匠を固定しており、test レーンとしては一貫。表示文字列の「保存」対象からの
   意匠変更としての妥当性判断は spec/design レーンの照合事項（domain-b.md §4 行種 5 に記録済み）。
6. **domain-b.md §5 の `--viewer-text: #e9dcf2` に「本文淡紫は現 :115 の意匠踏襲」とあるが、現 cockpit.html :116 の
   実値は `#e6d2ec`**（:115 は who 色 `#d69be0`）。値は近似だが同値ではなく、行参照も 1 行ずれ。§7 承認値優先の
   枠内なので文書精度の問題のみ（design レーンの領分）。
7. **speaking 行と履歴復元の理論エッジ**: 旧実装は renderHistory（innerHTML=""）後も speakingRow 変数が残るため
   「speaking 表示中に復元」が起きると以後 speechStart が無視される。新実装は復元で必ず speaking 無し＝次の
   speechStart で出現。実運用では復元は SSE 購読**前**の 1 回のみ（新旧とも同順・app.mjs init effect）で発生経路が
   無く、挙動差は観測不能。観察のみ。

## 9. §質問（Orch への申し送り）

1. non-blocking 3（injectStyles の fake doc 実行固定）と 1（閉域検出の網羅化）は、Domain C が ui/ を触る際に
   同じテストファイルへ安価に足せる。Domain C の委任プロンプトに任意事項として一言添える価値はあるが、
   本 Domain の合格条件には関係しない。
2. non-blocking 5（◆→↳）と 6（--viewer-text の出自記述）は test レーンの権限外の意匠/文書判定を含むため、
   design レーンのレビューと突き合わせて閉じることを推奨する（テスト自体は新意匠・承認値を正しく固定している）。
3. 合成照合スクリプト（旧 subscribe 切り出し × feedAfterSseEvent の 53 入力照合）は scratchpad 使い捨てで
   リポジトリには置いていない。Domain D で cockpit.html の旧 IIFE が撤去されると照合元が消えるため、
   同種の照合を再走したい場合は Domain D 発進**前**が最後の機会になる（本レビューで全 MATCH を記録済み）。
