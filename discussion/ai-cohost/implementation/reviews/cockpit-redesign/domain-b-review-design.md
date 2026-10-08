# 操縦席UI改定 Domain B レビュー（design レーン）

> レビュアー: Review-Sylph（design レーン）。呼び出し元: Orch-Sylph（操縦席UI改定wave実行責任者）。読み取り専任（唯一の書き込みは本成果物）。
> 日付: 2026-07-14。対象: Domain B「観測+ヘッダ」= `src/cockpit/ui/{app,feed,header,rows,styles}.mjs` + `view-logic/health.mjs`（+ health.test.mjs）+ `cockpit-ui.test.mjs` + `cockpit-static-assets.test.mjs` の追加/対象変更。
> 観点: 「動くか」でなく「この上に Domain C（運転バー+設定引き出し）と Domain D（統合エントリ）を安全に積めるか」「うちらの部品が認知負債として積み上がらない構造か」（inventory §4 L0決定5）。Gnome 成果物 domain-b.md の主張を転記せず、全ファイルを自分で読み・cockpit.html の対応行と突き合わせ・テストを自分で実行して確認した。
> 総合判定: **PASS**（blocking なし。non-blocking 5 件＝いずれも記録/Domain C 申し送りで解消する軽微事項）。

---

## 0. 自分で再実行した機械ゲート・器不変確認（生結果）

```
cd apps/soul/agent && node --test
```
→ `# tests 675` `# pass 675` `# fail 0`（1 回で緑・再試行不要・1.4s）。Orch 確定ベースライン 675/675 と一致。

個別実行（明示ファイル指定・いずれも 1 回で緑）:
- `node --test src/cockpit/cockpit-ui.test.mjs src/cockpit/view-logic/health.test.mjs` → **28/28**（23+5・domain-b.md §7 の申告と一致）。
- `node --test src/cockpit/cockpit-server.test.mjs src/cockpit/cockpit-page.test.mjs src/cockpit/cockpit-static-assets.test.mjs` → **114/114**（74+30+10）＝背骨（ワイヤ契約 16+13+6）無退行・cockpit.html 無改変・ui/ 5 ファイル配信の三点を自分で確認。

```
git status --porcelain -- apps/soul/agent
```
→ `M .gitignore` / `M src/cockpit/cockpit-server.mjs`（いずれも Domain A のまま）/ `?? cockpit-static-assets.test.mjs` / `?? cockpit-ui.test.mjs` / `?? ui/` / `?? vendor/` / `?? view-logic/`。
`git diff --stat -- …cockpit-server.mjs` → **80 insertions(+)** = Domain A 時点と同一（本 Domain がサーバへ 1 バイトも触っていない申告の裏付け）。cockpit.html / cockpit-page.test.mjs / scripts/cockpit.mjs は diff なし。

ui/ の副作用面の機械確認: `document.`/`window.`/`new EventSource`/`globalThis.fetch(` 等の直接使用を ui/*.mjs 全体に grep → **0 件**（styles.mjs は引数 `doc` 経由・app.mjs は `rootElement.ownerDocument` と「関数実行時の `globalThis.*` 参照」のみ＝設計規律どおり）。

---

## 1. view-logic 経由規律の遵守（L0 裁定・最重要）— PASS（non-blocking 3 件）

rows.mjs / feed.mjs / header.mjs / app.mjs の全行を精読し、cockpit.html の対応行（:265-315 / :360-366 / :386-543 / :547-554 / :813-897）と突き合わせた。**条件分岐による表示導出・表示文字列の組み立ては view-logic 呼び出しに閉じている**:

- rows.mjs: 行テキストは全て `speakerLabel`/`latencyLabel`/`fireMarkerText`/`expressionRowText`/`visionMarkerText`/`bargeInMarkerText`/`selfFireMarkerText`/`discardGhostLabel`/`diagnosticGhostLabel`/`selfFireGhostLabel`/`chatDiagnosticGhostLabel`/`formatClock` の呼び出し（rows.mjs:27-45 の import に閉じる）。rows.mjs 内に残るリテラル（`whoText:"fire"`・`markerText:"*"`・`"!!"`・`"~"` 等）は**条件分岐のない行レコード仕様の定数**（原実装 :453-454 :472 :493 :518 :537 の DOM 構築部の写し）で、導出の再実装には当たらない。`thumbSrc` の data URI 連結（rows.mjs:133）は表示文字列でなく URI の機械組み立て（原実装 :502 同値）。
- feed.mjs: FeedRow は行レコードの機械写像のみ。header.mjs: `earsStatusView`/`healthStatusView`/`voiceOutputLabel` 経由のみ。
- app.mjs: fire-note 暫定移植（app.mjs:128 `"not fired: " + ((d && d.reason) || "unknown")`）は §8-2 で Domain C 申し送り済みの既知例外。**それ以外の文字列導出の漏れは無い**。

non-blocking（いずれも実害なし・記録と Domain C 申し送り）:

1. **header.mjs:40-41 のフォールバック構造体リテラル**: `healthStatusView(...) || { text: "unknown", className: "hstat unknown", title: "" }`。app.mjs は `initialHealth()`（常に truthy な {status:"unknown"}）+ `mergeHealth`（欠落は前値保持）で health を渡すため、**このフォールバックには実際には到達しない**（デッドコード）。到達したとしても値は `healthStatusView(initialHealth().whisper)` と同一なので表示は割れないが、「表示構造体のリテラルが view-logic 外にある」形は規律の字面に反する。`health && health.whisper` が falsy になる経路が無い以上、フォールバックごと削るか initialHealth を通すのが綺麗（Domain C/D のついで修正で可・単独修正は不要）。
2. **app.mjs:134 の SSE 側 chat 正規化リテラル**: `setChatDisplay((d && d.status) || "connecting")`（原 :884 同値）。snapshot 側は `chatDisplayState(s.chat)`（view-logic）なのに SSE 側だけ既定値の畳みが app.mjs に残る非対称。fire-note（§8-2）と同様、Domain C が chat 結線時に status.mjs へ片寄せすると単一経路が完全になる（§4 申し送り 5）。
3. **feed.mjs:47-49 speaking 行の固定文言**（`"you"`・`"······(speaking)"`）: 行レコードに text を持たない唯一の行種で、feed.mjs が定型文言を持つ。rows.mjs:13 のコメントで例外と明示済み・fixture（cockpit-ui.test.mjs:333）で固定済み・導出なしの定数。記録のみ。

## 2. rows.mjs の単一経路設計 — PASS

- **switch 単一経路**: `feedAfterSseEvent`（rows.mjs:214-245）がタイムライン系 9 イベント（vad/transcript/expression/discard/diagnostic/fire/visionCaptured/selfFire/chatDiagnostic）を 1 つの switch で受け、default（state/soul/usage/chatStatus）は**同一 feed を返す**。app.mjs の SSE ハンドラ（:154）は全イベントを無差別にこの単一経路へ流すため、「タイムラインに行を作るか」の判断が rows.mjs に完全集約されている。移植漏れは `SSE_EVENT_NAMES`（13 本 deepEqual fixture）+ 各分岐 fixture の二重固定。diagnostic の bargeIn 先行分流（rows.mjs:229・原 :842）も fixture 固定（test:209-216）。
- **行レコード=描画済みフィールドのみ**: 8 行種すべて timeText/whoText/markerText/text/rowClass/latText/thumbSrc の描画済み値だけを持ち、FeedRow（feed.mjs:43-86）は kind ごとの機械写像に保たれている（唯一の例外は §1-3 の speaking 定型）。**Domain C/D がフィード描画に触る理由が構造的に無い**。
- **speaking 行の規律**: 原実装と 1 対 1 で確認した——(a) transcript/ghost は積む前に除去（rows.mjs:71/:90 ↔ 原 :387/:418 removeSpeakingRow）、(b) マーカー 5 種は除去しない（feedWithFireMarker 等が rowsWithoutSpeaking を呼ばない ↔ 原 addFireMarkerRow 等も removeSpeakingRow を呼ばない＝speaking がタイムライン途中に残る挙動まで保存）、(c) 二重 show は同一 feed（rows.mjs:174 ↔ 原 :375）、(d) feedWithGhost の label null は speaking 除去すら起きない（rows.mjs:89 早期 return ↔ 原実装で addGhostRow 自体が呼ばれない）。fixture（test:115-135, 137-146）が全て固定。
- **immutable 遷移+同一参照返却**の設計が秀逸: 「行を作らない」ケースで同一オブジェクトを返すため、(a) fixture が `assert.equal`（参照一致）で「何も起きない」を厳密に検査でき、(b) preact の setState が同値スキップで再 render を節約する。id 単調増加（appended が nextId を消費）で履歴復元後も key 衝突しない（fixture test:267-274）。
- 履歴復元 `feedFromHistory`（全置換・latText は契約上自然に null）も原 renderHistory（:410-413）と同値。原実装の「innerHTML 消去後に speakingRow 変数が dangling する」微妙な挙動は emptyFeed からの再構築で構造的に消えている（同値以上）。

## 3. トップレベル副作用ゼロの実態 — PASS

- **grep 実測 0 件**（§0）: ui/*.mjs に `document.`/`window.`/`new EventSource` の直接使用なし。EventSource/fetch は `props.eventSourceImpl || globalThis.EventSource` / `props.fetchImpl || globalThis.fetch` を**関数（effect）実行時**に解決（app.mjs:146-148）。styles.mjs の DOM 操作は `injectStyles(doc)` の引数経由のみ。`Date.now` の直接参照（app.mjs:83）は Node にも存在するため import 安全性を損なわない。
- **mount() が唯一の副作用入口**（app.mjs:221-224）: injectStyles → render の 2 手のみ。SSE 購読・fetch・interval はすべて App の effect 内（cleanup 付き: es.close/clearInterval/cancelled フラグ・app.mjs:173-176, 183-184）。アンマウント時のリーク経路なし。
- **注入口の設計**: eventSourceImpl/fetchImpl/nowImpl の 3 点は、将来の linkedom 梯子（台帳管理）でヘッドレス駆動する時の口として過不足ない。nowMs を rows.mjs の純関数へ引数で通す形（app.mjs:154 `now()` → feedAfterSseEvent）も純関数性を保っている。
- 検証の複層性: import スモーク（test:43-54）単体では厳密証明にならない（`globalThis.document` のようなプロパティ参照は Node でも ReferenceError にならない）が、構造テスト（import 閉包・test:58-74）+ 私の grep（§0）で複層的に担保されている。non-blocking の注記に留める（§6-弱点でなく設計事実の記録）。
- stale closure の確認: SSE effect は初回 render のクロージャだが、捕まえるのは setState 群（preact で安定）と applyStateRef（ref 経由で常に最新）のみ。props は mount 後に変わらない。堅牢。

## 4. Domain C の口（props 契約）の十分性 — PASS（不足 2 点を具体列挙・委任プロンプト必須）

domain-b.md §2 の表と実装（app.mjs:94-99, 201-210）を Domain C の全要件（運転バー: Fire/Fire視覚/自発トグル/口数/KILL・引き出し: Channel/YouTube/マイク/出力先/視界・初回自動展開）に対して突き合わせた。**賄えているもの**:

- busy disable: `soul` 生 state 保持+SSE soul 連動（app.mjs:123-124）。applySoulState（:434-441）の導出を Domain C が view-logic へ抽出する線引きは domain-a.md §7-2 と整合。
- snapshot 応答の適用: `applyStateRef.current(snapshot)` 共有で channel Set（:765）/chat connect/disconnect（:792 :801）/ears start/stop（:745 :808）の応答適用が単一経路になる。設計として正しい。
- 自発トグル: `settings.selfFire`（null=not available 判定材料）保持。preact の controlled component 化（checked=state・onChange のみ POST）で原実装の `selfFireSyncing` フラグ（:323 :636）が**構造的に不要になる**——programmatic な checked 変更は change イベントを発火させないため。挙動保存の観点で健全。
- 引き出し: channel（`channelStatusView` 済）/chat（`chatDisplay`+`chatStatusView`+`shouldRestoreChatSource` 済）/audioDevice（`voiceOutputLabel` 共有）/visionTarget（生値保持）。初期ロード 3 種（devices/windows/audio-devices）は独立 effect の裁定（§8-8）済み。
- settingsOpen: 開閉 state と onToggleSettings は結線済み。スロット置換時に `onClose={() => setSettingsOpen(false)}` を渡す口はコメントで明示（app.mjs:201-205）。

**不足（Domain C 委任プロンプトに必ず含める）**:

1. **「初回=設定空」の判定材料が不完全**: `settingsFromSnapshot(null)`（初期値・全 null）と「/api/state 取得済みだが設定が空」が**同型で区別できない**。引き出しの初回自動展開（cockpit-redesign.md §4）を settings だけで判定すると、(a) fetch 完了前に一瞬誤展開する、(b) fetch 失敗時（app.mjs:167 catch）に開くべきか否かが未定義になる。→ Domain C は App に **stateLoaded フラグ**（init effect の then で立てる・app.mjs:162-165 への 1 行追加）を足し、「stateLoaded && 設定空 → setSettingsOpen(true) を一度だけ」の形で実装すること（App のスロット置換編集は想定内の領分）。
2. **`setSoul` が §2 の表に無い**: Fire/vision-fire ボタン応答（原 :564 :583 `applySoulState(res.j.state || "idle")`）は soul state の**直接更新**を要する（応答 j は {fired, state, reason} 形で snapshot ではない＝applyStateRef 経路に乗らない）。domain-b.md §2 は「fireNote + setFireNote」を明記するが setSoul は表にない。スロット置換時に `soul`/`setSoul`/`fireNote`/`setFireNote` の 4 点を ControlBar へ渡すこと。

## 5. CSS 設計（styles.mjs）— PASS

- **注入の実装品質**: `injectStyles(doc)` は id 存在チェックで冪等（styles.mjs:219）・doc falsy ガード・`doc.head || doc.documentElement` フォールバック。mount 時注入のタイミングは render 前（app.mjs:222-223）で FOUC の構造的余地なし。裁定 (a)（.mjs 内 CSS 文字列）の根拠 3 点（ソース=実行物・サーバ不可侵・Domain D 最薄）は妥当で、`.css` 配信ルート追加＝cockpit-server 再改変を避けた判断は wave の規律に適合。
- **カスタムプロパティ体系の拡張性**: :root トークン（styles.mjs:29-57）は §7 承認値と現 cockpit.html 継承値の別がコメント+domain-b.md §5 の表で追跡できる。Domain C が引き出し/運転バーで使う面（--panel-raised/--border/--radius/--teal/--muted/--down）は全て揃っており、追加は COCKPIT_CSS テンプレートリテラルへの追記で済む。スロットの flex 配置（:209-210 `flex: 0 0 auto`）は三層レイアウトに既に組み込まれ、実体が入っても `.cockpit` の flex column（:69-75）が崩れない。
- **§7 意匠の実装網羅**: ヘッダ（teal の h1・発光ドット `.dot.on` box-shadow:96・右端 ⚙）・角丸 14px パネル（--radius）・時刻 mono 11px（:166-171）・話者色分け（:177-180）・演出サブ行インデント+↳（:189-191）・サムネ枠 54x96 上限（:194-202）・barge-in 赤・ゴースト斜体・三層 flex（feed-panel `flex:1 1 auto` + `min-height:0` で観測フィードのみスクロール:119-135）。モック §7 の要求を CSS 手書き・外部フォント/CDN ゼロで満たす。
- **ダークテーマ固定の妥当性**: `color-scheme: dark` 固定はモック承認済みの「基調: ダーク」（§7）の実装であり、ライト対応は要件外。妥当。
- 細部（記録のみ）: 演出行の ◆ マーカー（原 :472）はモック §7 のサブ行意匠（↳）に置換された。text 文字列自体は原実装同値（fixture 固定）で、器の変更は domain-b.md §5 に明記済み＝モック承認済み意匠を正とする wave-plan §2 に適合。

## 6. テスト構造（cockpit-ui.test.mjs 23 本）— PASS

層構成を読み、「Domain C/D の変更に壊れにくく・退行を検知する」バランスを評価した:

- **自動拡張する構造テスト**（test:58-74）が白眉: `readdirSync(UI_DIR)` で ui/*.mjs を**全走査**して import 閉包（vendor/view-logic/ui 内のみ・node:* 禁止）を検査するため、**Domain C が control-bar.mjs/settings-drawer.mjs を置いた瞬間から自動的に検査対象になる**。`files.length >= 5` の下限（>=）も追加に耐える。ブラウザコード純度の規律が「新参ファイルの検査漏れ」なしに維持される。
- **壊れにくさ**: SSE_EVENT_NAMES の deepEqual はワイヤ契約の写像（Domain C/D は SSE を増やさない＝不変であるべき固定点）。Header vnode スモークは includes ベース（props 追加に耐える）。CSS 検査はトークン存在+ghost italic のみ（Domain C の CSS 追記に耐える）。
- **退行検知**: rows fixture（(4)(5) 計 13 本）が全 9 行種の表示文字列・意図的非表示（diagnostic 4 型+chatDiagnostic 4 種）・speaking 規律・bargeIn 分流・id 一意性を固定。view-logic fixture（Domain A の 28+5 本）と層が違う（あちらは導出関数の入出力・こちらは結線と行レコード形）ため重複でなく相補。
- **既知の限界**（§8-1 の正直申告どおり）: App/Feed の hooks 本体（SSE effect・自動スクロール実挙動）は Node 未実行。注入口（eventSourceImpl 等）は用意済みだが本テストでは未使用＝人間ゲート（Domain D 手順書）とlinkedom 梯子（台帳）へ正しく申し送られている。devDep ゼロ規律との整合が取れた受容。
- **Domain C への含意（non-blocking・申し送り 8）**: vnode 走査ヘルパ `collectText`（test:317-329）は「関数コンポーネントは hooks 非使用前提で展開」する。Domain C の ControlBar/SettingsDrawer はローカル state（連打防止・入力欄）で hooks を使う公算が高く、**この流儀の vnode 走査は使えない**。rows.mjs と同型の「純関数（表示導出・状態遷移）を view-logic/rows 相当へ分離し fixture で固定・コンポーネントは薄く」の設計を先に立てること。

## 7. Domain D への滑走路 — PASS

- **mount 契約は最薄を達成**: cockpit.html 書き換えは `<div id="app">` + inline module 2 行（import mount → mount(...)）のみで立つ。CSS は mount が注入するため HTML 側 `<style>` は不要。inline module は page test :72 の `<script src>` 全面禁止に当たらない（inventory §1-3 の織り込みどおり）。
- **タイトル/名前の申し送りは明確**: `<h1>こーでぃー</h1>`（header.mjs:44）はモック §2/§7 承認意匠を正とする裁定・`<title>` は Domain D 裁量、と §8-4 に明記。曖昧さなし。
- **Domain D 委任プロンプトに含めるべき注意 2 点**:
  1. **旧 `<style>`（cockpit.html:1-237 相当）は完全撤去必須**: styles.mjs が body/html/#app/.row 等の同名セレクタを注入するため、旧 CSS が中途半端に残ると外観が予測不能に崩れる。「旧バニラ JS 撤去の確認（死コードゼロ）」（wave-plan §3 Domain D）に「旧 CSS の完全撤去」を明示的に含めること。
  2. 人間ゲート手順書に **App/Feed の hooks 実挙動**（EventSource 実配線・自動スクロール末尾追従と「最新へ↓」・履歴復元・uptime 刻み）を §8-1 由来の確認項目として明記すること（機械テストが構造上届いていない領域の穴埋め）。

---

## 8. blocking / non-blocking の総括

**blocking: なし。**

**non-blocking（5 件・記録と申し送りで解消）**:
1. header.mjs:40-41 のフォールバック構造体リテラル（実到達しないデッドコード・view-logic 外の表示リテラル。Domain C/D のついでに削除可）。
2. app.mjs:134 の SSE chatStatus 正規化リテラル（snapshot 側 chatDisplayState との非対称。Domain C の chat 結線時に status.mjs へ片寄せ）。
3. feed.mjs:47-49 speaking 行の固定文言（行レコード規律の明示済み例外・fixture 固定済み・記録のみ）。
4. import スモーク単体は副作用ゼロの厳密証明でない（globalThis プロパティ参照は落ちない）が、構造テスト+grep で複層担保（記録のみ）。
5. collectText の hooks 非使用前提（Domain C コンポーネントには不適用＝設計指針の申し送り・§6）。

## 9. Domain C 委任プロンプトへの申し送り（Orch へ・具体列挙)

1. **stateLoaded フラグの追加**（§4 不足 1・必須）: 初回自動展開の判定は「settings が空」だけでは不能（初期値と取得済み空が同型・fetch 失敗時未定義）。App の init effect 成功時に立てるフラグを足し「stateLoaded && 設定空 → 一度だけ自動展開」で実装。
2. **setSoul を ControlBar へ渡す**（§4 不足 2・必須）: Fire/vision-fire 応答の applySoulState 相当（:564 :583）に必要。soul/setSoul/fireNote/setFireNote の 4 点セット。応答 j は snapshot でないので applyStateRef には乗らない。
3. **fire-note 文言体系の view-logic 抽出**（domain-b.md §8-2 承継): app.mjs:128 の暫定移植 + Fire ボタン 503/エラー文言(:562-563 :581-582 :586)をまとめて抽出すると凝集する。
4. **applySelfFire（:324-340）と applyVisionTarget（:317-320）の表示導出を view-logic へ抽出**（domain-a.md §7-2 の線引きどおり Domain C 領分）。channel は channelStatusView 済・audioDevice は voiceOutputLabel 共有で済んでいる。
5. **SSE chatStatus の正規化 `(d.status) || "connecting"` を status.mjs へ片寄せ**（§1 non-blocking 2・任意だが 3 と同時にやると単一経路が完全になる）。
6. **自発トグルは controlled component 化で selfFireSyncing 不要**（§4）: 挙動保存の確認点は「programmatic 反映で POST が飛ばないこと」＝構造で満たされる。settings.selfFire null=not available（disable）も忘れず。
7. **Fire 連打防止のローカル busy**（:556 :574 即時 disable → SSE soul/応答で復帰）は ControlBar ローカル state で移植（App の soul とは別物である点に注意）。
8. **テスト設計指針**（§6): ControlBar/SettingsDrawer は hooks を使うと本 wave の vnode 走査流儀が使えない。表示導出・状態遷移を純関数に分離して fixture 固定・コンポーネントは薄く。構造テスト（import 閉包）は新ファイルを自動検査するので追加作業不要。
9. **初期ロード 3 種（devices/windows/audio-devices）は独立 effect**（domain-b.md §8-8 承認済み・順序保持が必要と判断したら init effect への差し込みを結線時に裁定）。
10. **エラー欄 5 つ（devices/channel/chat/vision/conversation の各 error 表示）の置き場**を引き出し設計に含めること（原実装は区画ごとの span・:609 :673 :722 :741 等）。
11. **CSS は COCKPIT_CSS への追記**: 既存トークン（--panel-raised/--border/--radius/--teal/--muted/--down）を再利用。cockpit-ui.test の CSS 検査はトークン存在検査なので追記で壊れない。

## 10. Domain D への申し送り（Orch へ）

1. 旧 `<style>` の完全撤去を「旧バニラ JS 撤去」と並ぶ明示項目に（§7-1・styles.mjs の同名セレクタと衝突）。
2. `<title>` の裁量（§8-4・モックに合わせるなら変更）。
3. 人間ゲート手順書に hooks 実挙動（EventSource 実配線・自動スクロール・「最新へ↓」・履歴復元・uptime）を明記（§7-2）。

---

**総合判定: PASS。** blocking なし。view-logic 経由規律・単一経路・副作用ゼロ・CSS・テスト構造のいずれも「Domain C/D を安全に積める」水準にあり、L0 決定 5（認知負債として積み上がらない構造化）の実装として健全。上記 non-blocking 5 件と Domain C 申し送り 11 点・Domain D 申し送り 3 点を Orch へ引き継ぐ。
