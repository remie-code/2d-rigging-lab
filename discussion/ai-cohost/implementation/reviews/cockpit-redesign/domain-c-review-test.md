# 操縦席UI改定 Domain C レビュー（test レーン）

> レーン: **test**（テストが実在し・主張する挙動を実行を伴って固定し・決定論的で・実ネットに出ないか）。
> レビュアー: Review-Sylph。呼び出し元: Orch-Sylph（操縦席UI改定 wave 実行責任者）。
> 対象: `apps/soul/agent/src/cockpit/view-logic/control.test.mjs`（8 本）・`view-logic/settings.test.mjs`（11 本）・
> `view-logic/status.test.mjs`（8 本＝+1 本）・`cockpit-ui.test.mjs`（30 本＝+7 本）・
> `cockpit-static-assets.test.mjs`（10 本・列挙拡張）・機能同値の照合元 `cockpit.html`（不改変の正）・
> 実装 `ui/{control-bar,settings-drawer,app}.mjs`・`view-logic/{control,settings,status}.mjs`。
> 日付: 2026-07-14。読み取り専任・自分で再実行した生数字を根拠にする。install/commit/実装変更・実ネット到達は
> 一切していない（検証はすべて loopback / ローカルファイル / scratchpad 上の合成照合スクリプト）。
> `.tmp/facex-*`・`screens/cockpit-ia-redesign.md` は不干渉。
> **総合判定: PASS（blocking ゼロ・non-blocking 5 件＝すべて修正不要の観察）。**
> **時限手法（旧 IIFE 切り出し × 新 view-logic の機械照合）を Domain C の全移植対象に適用し、
> 113 入力ケース・264 アサーション ALL MATCH を旧コード実行で確認した（§1）。Domain D で照合元が
> 消える前の最後の照合は完了である。**

## 0. 自分で再実行した機械ゲート生数字

`cd apps/soul/agent && node --test`（全テスト・タイムアウト 300s・1 回で緑・空/interrupted なし・再試行不要）:

```
1..702
# tests 702
# pass 702
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 1591.3627
```

個別実行（いずれも 1 回で緑・fail 0・cancelled 0・skipped 0・todo 0）:

| 対象 | 実行結果 | Claim（domain-c.md §7 / Orch ベースライン） | 照合 |
|---|---|---|---|
| 全体 `node --test` | **702/702** | 702/702 | 一致 |
| `cockpit-server.test.mjs` | **74/74** | 74/74（背骨＝ワイヤ契約 16+13+6 無退行） | 一致 |
| `cockpit-page.test.mjs` | **30/30** | 30/30（無改変で緑＝cockpit.html 不触の証明） | 一致 |
| `cockpit-ui.test.mjs` | **30/30** | 30 本（23→30・+7） | 一致 |
| `cockpit-static-assets.test.mjs` | **10/10** | 10 本（本数不変・列挙拡張） | 一致 |
| `view-logic/control.test.mjs` | **8/8** | 8 本 | 一致 |
| `view-logic/settings.test.mjs` | **11/11** | 11 本 | 一致 |
| `view-logic/status.test.mjs` | **8/8** | 8 本（7→8・+1） | 一致 |

- 本数の機械照合（`grep -c '^test('`）: control **8** / settings **11** / status **8** / cockpit-ui **30** /
  static-assets **10**。`test.skip|test.only|test.todo` のヒット **0** ＝ 緑の偽装は無い。
- 加算の整合: 実行前ベースライン 675（Domain B レビューで確定した数字）+ 8 + 11 + 1 + 7 = **702**。一致。
- 器・不可侵の裏取り（git 実測）: `git diff --stat -- …cockpit.html …cockpit-page.test.mjs …scripts/cockpit.mjs
  …cockpit-server.test.mjs` → **出力なし**。`cockpit-server.mjs` は **80 insertions のまま**（Domain A 時点と同一＝
  本 Domain はサーバ 1 バイト不触の Claim と一致）。`pnpm-lock.yaml`・`package.json` → 出力なし（依存不変・
  devDep ゼロ維持）。

## 1. fixture の機能同値性（最重要） — **PASS（旧 IIFE 実行照合 113 ケース・264 アサーション ALL MATCH）**

**時限手法の適用（この C レビューが最後の機会・Domain B test レビュー §9-3 の申し送りどおり実施）**:
cockpit.html の旧 IIFE から対象関数/ハンドラを brace-matching で切り出し、`new Function` + fake byId/document/
fetch で**実際に駆動**し、書き込まれた textContent/className/disabled/checked/value/option 列を新 view-logic
関数の同入力出力と機械照合する合成スクリプトを scratchpad で自作・実行した（リポジトリには置かない・使い捨て）。
fetch ハンドラは fake fetch（応答キュー/reject）で then/catch チェーンまで完走させ、SSE ハンドラは fake
EventSource で subscribe 全体を駆動して fire/chatStatus のリスナを捕捉・発火した。

**結果: 113 入力ケース・264 アサーション ALL MATCH（fail 0）。**
照合器の実効性は反証実験で確認: 旧ソースの文言を 2 箇所故意に破壊（"not fired: "→"NOT-FIRED: "・
"not configured"→"NOT-CONFIGURED"）した変異体で再実行すると**正確に 7 アサーションが fail**
（fire 応答×2 ボタン + SSE fire + visionTargetLabel）＝照合は旧コードの実行結果を本当に検証している。

### 1-1. 照合グループ逐条（旧コード駆動＝実行照合したもの）

| グループ | 旧（実行駆動） | 新（照合先） | 入力 | 判定 |
|---|---|---|---|---|
| G1 | `applySoulState` :434-441 | `soulStatusView` | thinking/speaking/idle/未知/null/undefined/"" の 7 入力 × text/class/両ボタン disabled の 4 面 | **MATCH** |
| G2 | `applySelfFire` :324-340（selfFireSyncing 前置込み） | `selfFireToggleView` | null/undefined/{enabled:true}/{enabled:false}/{}/{enabled:1}/{enabled:""} の 7 入力 × disabled/checked/statusText/statusClassName（**off の末尾スペース class 込み**） | **MATCH** |
| G3 | `applyVisionTarget` :317-322 | `visionTargetLabel` | title あり/null/""/vt null/undefined の 5 入力 | **MATCH** |
| G4 | `applyChannel` :347-359 | `channelStatusView`（A 固定済みの再照合） | 8 入力（未設定 3 形・connected/error/connecting/connection 欠落 idle 末尾スペース/url 欠落 "(configured)"） | **MATCH** |
| G5 | `renderChatStatus` :294-306 | `chatStatusView` | connecting/live/retrying/dead/null/undefined/"" × text/class/**disconnectDisabled**（dead 無効込み） | **MATCH** |
| G6 | `applyAudioDevice` :342-345 | `voiceOutputLabel`（B 固定済みの再照合） | name あり/""/null/undefined | **MATCH** |
| G7 | `loadDevices` :704-726（selectDeviceIfPresent :698-703 込み・fake select/createElement） | `micDeviceListView` + `initialDeviceSelection` + `requestErrorText("loadDevices")` | 8 ケース（**lastDevice 一致→選択・不一致→先頭**・空+error 無/有・一覧+error 併記・devices null/欠落・fetch reject） | **MATCH** |
| G8 | `loadWindows` :592-613 | `windowListView` + `requestErrorText("loadWindows")` | 6 ケース（**label "title (processName)"** :605・空・空+error・windows null・欠落・reject） | **MATCH** |
| G9 | `loadAudioDevices` :656-677 | `audioDeviceListView` + `requestErrorText("loadAudioDevices")` | 5 ケース | **MATCH** |
| G10/G11 | `btn-fire` :555-570 / `btn-vision-fire` :573-589 の click ハンドラ全体（fake fetch 駆動） | `fireNoteFromFireResponse` + `fireRequestErrorNote` + soul 反映式 | 各 6 ケース（503・fired:false+reason・reason 欠落・**202 fired:true=ノート不変**・j null・reject）× 最終 note/soul 引数/**押下時 "" クリア**（:557 :575 = 新 :122）の 3 面 | **MATCH** |
| G12 | `self-fire-toggle` change ハンドラ :635-652 | `selfFirePostErrorText` + `selfFireRequestErrorText` | 5 ケース（503・500+error・500 空 j・**成功 200＝旧 applySelfFire(res.j.selfFire) の引数が新 applySnapshot(res.j) と同源**・reject） | **MATCH** |
| G13/G14 | `btn-vision-target-set` :615-631 / `btn-audio-device-set` :679-695 | `visionTargetPostErrorText` / `audioDevicePostErrorText` + `requestErrorText` | 各 5 ケース（503/500+error/500 空/成功=部分適用引数の同源確認/reject） | **MATCH** |
| G15 | `btn-channel-set` :753-770 | `channelPostErrorText` + `requestErrorText("channel")` | 4 ケース。**token 秘匿: 成功時のみ入力欄クリア・失敗/reject では生 URL が残る**（旧挙動）＝新 :223-224 と同分岐。成功時 applyState(res.j)＝snapshot 全体 | **MATCH** |
| G16 | `btn-chat-connect` :776-796（chatSourceEdited を var で包み観測） | `chatConnectErrorText` + `CHAT_EMPTY_SOURCE_ERROR` | 空 source 2 形（""/空白のみ・fetch 不発）+ 6 ケース（503/400/500+error/500 j null/成功/reject）。**成功時のみ chatSourceEdited=false**（:791 = 新 :250）・**Connect ボタン busy 復帰**（:780→:795 = 新 connectBusy） | **MATCH** |
| G17 | `btn-chat-disconnect` :797-803 | `requestErrorText("chatDisconnect")` | 成功（applyState 引数）/reject | **MATCH** |
| G18 | `btn-start` :730-750（setBusy 込み） | `earsStartFailureText` + `requestErrorText("earsStart")` | 4 ケース（409 transitioning・500 空 j・成功・reject）。**失敗時 applyState(res.j.state)/成功時 applyState(res.j)**（= 新 :187/:190 の分岐）・busy 復帰 | **MATCH** |
| G19 | `btn-stop` :804-811 | `requestErrorText("earsStop")` | 成功/reject + busy 復帰（**エラー欄クリア無し = 原実装踏襲**も暗黙照合: 旧初期値 "" のまま） | **MATCH** |
| G20 | `subscribe` :814-897 全体を fake ES で駆動し fire/chatStatus リスナを発火 | `fireNoteFromSseFire`（app.mjs :137 の統合先）+ `chatDisplayFromSseStatus`（:143 の片寄せ先） | fire 4 入力（accepted:true→""・false+reason・false・**accepted 欠落 {}**）+ chatStatus 5 入力（live/dead/**{} 欠落→connecting**/""/null） | **MATCH** |

### 1-2. 実行照合不能だったもの（コード読解 / 設計照合で閉じた・その別を明記）

- **`shouldAutoOpenSettings`**: 旧実装に対応物が存在しない（新導線・cockpit-redesign.md §4）。照合先は
  domain-c.md §5-1 の判定式であり、**6 条件（s falsy / channel.configured / visionTarget.title /
  audioDevice.name / chat.source / device）すべてについて fixture が真偽両分岐を固定している**ことを
  逐条確認した（true 側 2 本: 全 null 形 + {configured:false}/{title:null}/{name:null} 形・false 側 7 assert:
  5 条件各 1 + null/undefined）。stateLoaded ガード（fetch 失敗時に開かない）は app.mjs :176-179 の
  コード読解で確認（App 未実行 = §8-5 の既定の限界・fixture は「s falsy → false」で判定式側の防波堤を固定）。
- **`fireNoteFromSseFire(null)` / `chatDisplayFromSseStatus(null)` の fixture ケース**: 旧実装は
  `JSON.parse(ev.data)` 経由のため null が来ると `d.accepted`/`d.status` で throw する＝**旧で発生不能な
  入力の頑健化**。機能同値の照合対象外（挙動差を作らない・非 null 入力は G20 で全 MATCH）。
- **新実装ハンドラ（control-bar.mjs fireWith / settings-drawer.mjs の各 on*）の実行**: hooks 内クロージャの
  ため Node 単体では駆動不能（L0 既定の限界・§8-5 に正直に記録済み）。照合は「旧ハンドラの実行出力 =
  view-logic fixture 期待値」+「新ハンドラが view-logic を呼ぶ薄い層である」コード読解（本レビューで
  control-bar.mjs / settings-drawer.mjs 全読・分岐構造が旧と同順であることを行対応コメントと突き合わせ）。

## 2. controlled 化の固定と syncing 廃止の保護分析（指定検証点） — **PASS**

旧 `selfFireSyncing` :323 が防いでいた挙動を列挙し、新実装での担保を確認:

| 旧 syncing が防いでいたもの | 新実装での担保 | 判定 |
|---|---|---|
| (a) applySelfFire の `toggle.checked = x` programmatic 書き込みが change を再発火して POST 無限ループ | DOM 仕様上 checked **プロパティ**代入は change を発火しない（旧ガードは防御的）。preact controlled でも render 時の props 反映は同じプロパティ設定であり change 非発火。**checked が snapshot 由来のみ・onChange が POST のみ**という一方向流の構造で層が一つ増えた | 同等以上 |
| (b) syncing=true の同期窓中のユーザー change 無視 | 窓は同期実行中のみ＝ユーザーイベントは割り込めず実質ゼロ幅。失われても挙動差なし | 差なし |
| (c) （副作用）503/エラー時に checkbox がユーザー操作のまま残る（表示とサーバ不整合） | controlled のためエラー文言 set の再 render で snapshot 由来へ戻る。**厳密同値でない微差**だが domain-c.md §8-3 に正直に記録済み・UI=サーバ状態の一貫性としては改善方向 | 記録済みの微差 |

機械固定の最小性: `selfFireToggleView` fixture（null=not available/disabled・enabled on/off・{} 縮退・
**末尾スペース class の逐語**）が導出の全分岐を固定し（G2 で旧実行と 7 入力 MATCH）、`SelfFirePill` vnode
走査（cockpit-ui.test :446-460）が「input.props.checked が view 由来・disabled 反映・onChange が関数」の
**写像**を実行を伴って固定する。「onChange がユーザー操作でのみ発火する」は preact のフレームワーク挙動で
あり L0（本体未実行）の限界内＝人間ゲート項目（§8-5 に記録済み）。一方向流を支える最小固定として妥当。

## 3. no-op の固定（口数モード・KILL） — **PASS（verbosity の non-blocking 観察 1 件）**

- **KILL**: `KillSwitch` vnode で `button.props.disabled === true` を固定（:462-467）+ CSS 赤枠検査（:497）。
  実装 :95 は **onClick ハンドラ自体を持たない**（コード読解）＝ no-op は二重に確実。
- **口数モード**: `VERBOSITY_OPTIONS` の 3 択を deepEqual で固定（:418-422）。**「verbosity が fetch に
  乗らない」ことはテストでは固定されていない**（ControlBar 本体未実行のため機械固定不能）。コード読解で
  確認: control-bar.mjs 内の verbosity の全出現は useState :109・value 表示 :182・onChange setVerbosity :183
  のみで、fetch body は `"{}"`（fire :123）と `JSON.stringify({ enabled })`（self-fire :149）の 2 種だけ＝
  **どのリクエストにも verbosity は乗らない**。→ non-blocking 1（linkedom 梯子導入時に fetch spy で固定可能）。

## 4. +7 本（cockpit-ui.test）の実効性 — **PASS**

- `collectElements` は関数コンポーネントを `node.type(node.props)` で**実際に実行**して展開（hooks 非使用が
  前提・collectText と同流儀）＝ vnode 走査は実行を伴う検証。
- FireButtons: disabled の 3 態（soulStatusView("thinking") 由来 busy / localBusy / idle 有効）を
  **view-logic との合成で**固定＝「busy 中 Fire disable」（旧 :439-440 の二重の防波堤の UI 側）が
  soulStatusView.fireDisabled 経由で機械描画される経路を固定。ラベル文言（Fire / Fire+視覚）込み。
- SettingsSelect: select.props.value・option 列の value/label 機械描画（部品内導出ゼロ）を固定。
- DrawerStatus: `"drawer-status " + view.className` の class 合成と text を chat dead / channel connected の
  2 現物（view-logic 実出力を入力に使う＝合成の照合）で固定。
- CSS 意匠 8 点（:495-504）: 実在を styles.mjs で確認（.control-bar :209 / kill-switch 赤枠 :271 /
  display:none :280 / .open :281 / chevron appearance:none :336 / pill :247 / 色ドット :344 / .err :367）。
  旧スロット CSS 2 行（.control-bar-slot/.settings-drawer-slot）は grep ヒット 0 ＝削除済み（死コードゼロの
  Claim と一致）。
- 限界の認知: 葉部品の走査であり ControlBar/SettingsDrawer 本体が葉部品へ正しい view を渡す結線は未実行
  （§8-5 記録済み・テストファイル :396-399 のコメントにも同じ限界が明記されている＝経路主張の誇張なし）。

## 5. 決定論・ネット純度 — **PASS**

- **view-logic 新 3 ファイル + テスト**（control/settings/status × .mjs/.test.mjs）:
  `Date.now|Math.random|setTimeout|setInterval|fetch|EventSource|http|URL リテラル` の grep ヒット **0**
  （完全な純関数 + 純 fixture・時刻概念自体が無い）。
- **cockpit-ui.test.mjs**: 同 grep でコメント 2 件のみ（Domain B レビュー時の状態を維持）。時刻 fixture は
  ローカル成分から epoch を作る TZ 非依存方式のまま。
- **fetch 注入の徹底**: control-bar.mjs / settings-drawer.mjs の fetch 参照は
  `fetchImpl || globalThis.fetch`（:120 :144 / :112）＝**関数実行時参照のみ**でトップレベル参照ゼロ
  （import スモーク通過が構造証明・grep で全出現確認）。
- **static-assets**: 到達先は `createCockpitServer({}).listen(0)` の loopback のみ（サーバ不変を diff 確認済み）。
- 全体 702 本が **1.59 秒**で完走（実ネット待ちの兆候なし）。cancelled/skipped/todo すべて 0。
- **ControlBar/SettingsDrawer 本体（hooks）未実行は domain-c.md §8-5 に正直に記録**（人間ゲート確認点の
  列挙付き）＝ L0 既定の限界の内側・blocking ではない。

## 6. static-assets 列挙拡張 — **PASS**

- 「ui/*.mjs は置くだけで配信される」テスト（:226-241）の列挙に control-bar.mjs / settings-drawer.mjs が
  追加され、**実 HTTP GET → 200 + text/javascript + `Buffer.equals` ディスク実バイト照合**で固定（弱い存在
  チェックでない）。1 ケース内ループ拡張で本数 10 のまま＝ Claim と一致。
- トラバーサル 3 本（`..%2f` 単段/二段・`..%5C` raw socket）は無傷で残存・緑（Domain A 追修正の解消状態は
  退行していない）。

## 7. wave-plan §3/§4 基準との照合

- §3 Domain C テスト要求「view-logic（トグル状態導出・disable 条件・redact）純関数 + server test 無退行」:
  トグル状態導出 = selfFireToggleView（G2 MATCH）・disable 条件 = soulStatusView.fireDisabled +
  chatStatusView.disconnectDisabled（G1/G5 MATCH）・redact = channelStatusView が redact 済み snapshot を
  表示する構造（G4 MATCH・生 URL は G15 で成功時クリアを旧実行照合）・server test 74/74 ✓。
- §4 基準 3「view-logic は preact 非依存の純関数 + fixture 必須」: 新 3 モジュールとも import は無し
  （settings.mjs/control.mjs）または view-logic 内のみ・fixture 全数対応 ✓。基準 5（devDep ゼロ・
  終了処理）: テストは node:test/assert 標準のみ・サーバ使用テストは try/finally close ✓。

## 8. blocking / non-blocking の分離

**blocking: 0 件**

**non-blocking（すべて修正不要の観察・Orch/後続 Domain の裁量）:**

1. **verbosity no-op の機械固定なし**: 「選択がどこにも送られない」はコード読解でのみ確認（§3）。ControlBar
   本体未実行の L0 限界内。linkedom 梯子を導入する日が来たら fetch spy での固定が安価。人間ゲート手順書に
   「口数は触っても挙動が変わらない」を明記する §8-1 の申し送りが機械固定の代替として機能する。
2. **shouldAutoOpenSettings の「キー自体の欠落」形が一部未踏**: fixture は chat:{source:null} 形のみで
   s.chat が falsy（欠落）の入力は未踏（channel/visionTarget/audioDevice/device の null 形は踏んでいる）。
   実装は `s.chat && s.chat.source` で安全・GET /api/state の snapshot は chat を常に含む（ワイヤ契約）ため
   実運用で発生しない。網羅性の観察のみ。
3. **fireNoteFromSseFire(null) / chatDisplayFromSseStatus(null) の fixture は旧実装で発生不能な入力**:
   旧は JSON.parse 経由のため null 到達時は throw（＝発生経路なし）。新の null 頑健化は挙動差を作らない
   防御であり、機能同値照合の対象外として扱った（§1-2）。
4. **Domain B レビュー non-blocking 1（閉域テストの import 検出正規表現の穴）は未対応のまま**: Domain C の
   新 2 ファイルの import も全て `import … from` 形（実 import を目視確認・side-effect import/dynamic import
   ゼロ）のため実害は引き続き無い。検出器の網羅化は任意のまま Domain D へ持ち越し。
5. **Domain B レビュー non-blocking 3（injectStyles の fake doc 実行固定）も未対応のまま**: Domain C は
   styles.mjs に CSS 追記のみで injectStyles 不触。任意事項のまま。

## 9. §質問（Orch への申し送り）

1. **旧 IIFE 照合は完了・Domain D 発進可**: Domain B test レビュー §9-3 の「Domain D 発進前が最後の機会」に
   従い、Domain C 移植対象の全ハンドラ（fire/vision-fire 応答・self-fire トグル・channel/chat/vision/audio/
   ears の全 POST 応答と catch・3 つの一覧ロード・SSE fire/chatStatus・apply 系 6 関数）を旧コード実行で照合
   し ALL MATCH を記録した。**test レーン観点で cockpit.html の旧 IIFE を照合元として保持し続ける理由は
   もう無い**（Domain D の撤去に異存なし）。合成照合スクリプトは scratchpad 使い捨て（リポジトリ不置）。
2. non-blocking 1（verbosity の fetch spy）は s6-followup §12 の実配線時にどのみちテストを書く場所なので、
   その時まで寝かせるのが自然。
3. §8-5 の人間ゲート確認点（Fire busy→復帰 / 503 文言 / トグル追従 / Channel クリア / source 復元 /
   dead 無効 / lastDevice / Refresh / 初回自動展開と二回目直行）は本レビューの照合結果と整合しており、
   Domain D の手順書にそのまま採用してよい。特に「初回自動展開」は fixture が §5-1 の 6 条件を真偽両分岐で
   固定済みのため、手順書側は「設定空で起動→開く」「何か 1 つ記憶済み→開かない」の 2 点で足りる。
