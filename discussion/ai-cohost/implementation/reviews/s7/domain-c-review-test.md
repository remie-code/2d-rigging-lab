# S7 Domain C（操縦席+docs）レビュー — test レーン

> レビュアー: Review-Sylph（test レーン）。2026-07-14。
> 判定基準: [../../orchestration/s7-wave-plan.md](../../orchestration/s7-wave-plan.md) §3 Domain C・§4 blocking 基準。
> Gnome 成果物: [../../waves/s7/domain-c.md](../../waves/s7/domain-c.md)。

## 0. 追修正 再確認（2 巡目）

design レーンが検出した契約 FAIL（`applyChat` が `connected` 真偽だけで無条件に Disconnect ボタンを
再有効化してしまい、`dead`（終端）後の snapshot 再送でも Disconnect が誤って有効に戻る）を Gnome が
`cockpit.html` の `renderChatStatus` 単一経路化で修正し、対応するテストを追加した（606→609、+3）。以下、
自分でコードと実行結果を確認した再レビュー結果。**判定: PASS（blocking 指摘なし・穴 2 件は解消済み）**。

- **単一経路化の実装確認**: `cockpit.html` の `applyChat`（L307-315）は `renderChatStatus(c.connected ?
  (c.state || "connecting") : null)` を呼ぶのみで disabled を直接操作しない。SSE `chatStatus` ハンドラ
  （L880-885）も `renderChatStatus(d.status || "connecting")` を呼ぶのみ。両経路が同一関数 `renderChatStatus`
  （L294-306）に委譲しており、disabled 判定は `!(state === "connecting" || state === "live" || state ===
  "retrying")` の 1 箇所のみ（dead・null は無効）。二重管理の食い違いという契約 FAIL は構造的に解消されている。
- **追加テスト①「dead disables even when connected」（cockpit-page.test.mjs L298-332）**: 正規表現の存在
  チェックに留まらず、`html.match(/function renderChatStatus\([\s\S]*?\n    \}/)` と
  `function applyChat\([\s\S]*?\n    \}` で実ソースから両関数本体を**そのまま**切り出し、`new Function("byId",
  ...)` で実行可能な関数として再構築し、fake `byId`（`chat-source`/`chat-status`/`btn-chat-disconnect` の
  素朴なプレーンオブジェクト）を注入して `applyChat` を実際に駆動している。`{connected:true, state:"dead"}` →
  `disabled===true`、`connecting/live/retrying` → `disabled===false`+状態別 className、`connected:false` →
  `disabled===true`+`"not connected"` を固定しており、実ロジックの分岐を実際に踏んでいる。切り出し正規表現
  `\n    \}`（改行+4スペース+`}`）は関数内の if/else の閉じ括弧（6スペース）とは一致しない実装インデントで、
  意図通り関数全体のみを正しく抽出できることをファイル実物の行を読んで確認した。jsdom 等の新規 DOM ライブラリ
  は使っておらず（grep で jsdom 系 import 無し・`package.json`/`package-lock.json` に差分無し）、`new
  Function` という標準機構のみで実現している。
- **追加テスト②「単一経路の委譲」（cockpit-page.test.mjs L334-352）**: `renderChatStatus` 本体に disabled
  代入と3状態の比較が存在すること、`applyChat` 本体が `renderChatStatus(` を呼び `disabled = false` を直接
  書いていないこと（`assert.doesNotMatch(afn[0], /disabled\s*=\s*false/)`）、SSE `chatStatus` ハンドラ本体も
  `renderChatStatus(` を呼ぶことを固定。二重経路化への回帰を構造面から防ぐアサーションになっている。
- **既存1本の期待値更新（L285-292 「subscribes SSE chatStatus and updates the status display」）**:
  domain-c.md §5 の記述と付き合わせ、`assert.match(m[1], /renderChatStatus\(/)` への更新であることを確認。
  以前は chatStatus ハンドラ内の直接的な表示更新を確認していたと推測されるが、更新後は「単一経路への委譲」
  という**より強い**構造的契約を確認しており、機能意図の後退ではなく構造変更に伴う正当な更新と判断した。
- **connect throw→500 テスト（cockpit-server.test.mjs L1732-1802）**: `makeThrowingChatClientFactory(mode)`
  ヘルパが `"factory-throw"`（factory 自体が器官生成前に throw）と `"start-reject"`（器官は生成されフックも
  結線されるが `start()` が throw）の両モードを提供。テスト本体はこの両方を実行し、①`start-reject`: 500 +
  器官 1 個生成 + `isStopped()===true`（foldChatClient で畳まれ dead）+ `listenerCounts()` が
  `{msg:0,st:0,dg:0}`（フック全撤去・リーク無し）+ `/api/state` で `chat.connected===false`・
  `chat.state===null`、②`factory-throw`: 500 + `clients.length===0`（器官ゼロ）+ `chat.connected===false`
  を固定している。fake factory は `makeFakeChatClientFactory` と同型の口（start/stop/getState/onMessage/
  onStatus/onDiagnostic/isStopped/listenerCounts）のみで構成され、実 HTTP・実 YouTube・実 SDK には一切出ない
  （grep で `live-chat-client.mjs`/`createLiveChatClient` の import が新規テストコードに無いことを確認）。
  以前 non-blocking として記録した「connect throw→500 未テスト」の穴はこれで解消。
- **同時 Connect race の穴**: s7-followup.md §8 に non-blocking として記録済みであることを確認（今回の追修正
  スコープ外・引き続き non-blocking の申し送り）。
- **自分で実行した機械ゲート（2巡目）**: `cd apps/soul/agent && node --test --test-timeout=300000` を実行し
  1 回で自然終了（ハング無し）。

  ```
  # tests 609
  # suites 0
  # pass 609
  # fail 0
  # cancelled 0
  # skipped 0
  # todo 0
  # duration_ms 1309.6426
  ```

  個別ファイルでも内訳を裏付け: `node --test src/cockpit/cockpit-server.test.mjs` → tests 74（従来 73+1）、
  `node --test src/cockpit/cockpit-page.test.mjs` → tests 30（従来 28+2）。606→609 の内訳（cockpit-server
  +1・cockpit-page +2）と一致。domain-c.md §5 の「# tests 609」もこの実測と一致。
- **無退行**: `git diff --stat`（working tree、S7 Domain C 一式は未 commit のため HEAD 比較で全体が additive
  として出るが）で `package.json`/`package-lock.json` に差分無し（新規 npm 依存追加なし）を確認。追修正で
  変更されたテスト期待値は前述の 1 本のみで、他は純粋 additive。

**追修正 再確認の結論: PASS。design レーン契約 FAIL は正しく閉じられ、以前記録した non-blocking 穴のうち
「connect throw→500 未テスト」は解消。決定論・ネット純度（fake 器官 factory のみ）を保ったまま 606→609 が
全緑・無退行であることを自分の実行で確認した。**

---

## 判定（初回レビュー・606/606 時点）: **PASS**

自分で実行した `node --test` は 606/606（全緑・ハング無し・自然終了）。ネット/SDK/マイク純度（fake 器官
factory 注入・実 YouTube/実ネット/実 SDK/実マイクへの到達経路ゼロ）・ライフサイクル縦検証の網羅・UI 構造
テスト・settings 永続化・S1〜S6 無退行（既存テストは 1 行も改変されず全て additive）をコード実物と自分の
実行結果から確認した。blocking 指摘なし。non-blocking の軽微なカバレッジの穴が 3 点ある（§5）。

## 1. 自分で実行した機械ゲート生数字

```
$ cd apps/soul/agent && node --test --test-timeout=300000
# tests 606
# suites 0
# pass 606
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 1237.3674
```
自然終了（プロンプト復帰・ハングなし・1 回で完走・再試行不要）。domain-c.md §5 の主張（606/606・
Domain B 後 583→606=+23）と一致。

個別ファイル実行（`node --test <file>` 単体）:

```
src/cockpit/cockpit-server.test.mjs          → tests 73 / pass 73 / fail 0
src/cockpit/cockpit-page.test.mjs            → tests 28 / pass 28 / fail 0
src/cockpit/cockpit-settings-store.test.mjs  → tests 24 / pass 24 / fail 0
scripts/cockpit.test.mjs                     → tests 30 / pass 30 / fail 0
```

domain-c.md 内訳の主張（cockpit-server 65→73=+8 / cockpit-page +8 / settings-store +4 / cockpit.test +3、
合計 +23）を、各ファイルの S7 セクションを実際に読んで test() ブロックを数えることで裏付けた:
- cockpit-server.test.mjs: L1542/1598/1627/1658/1679/1690/1702/1717 の 8 本（Connect 結線・呼びかけ縦串・
  Disconnect・再 Connect 作り直し・close 畳み・503・400・snapshot.chat.source）。
- cockpit-page.test.mjs: L251/259/266/276/285/293/307/315 の 8 本（入力/ボタン/POST・applyChat・viewer 行・
  chatStatus・chatDiagnostic・chatBufferAbsent・selfFire kind 非依存）。
- cockpit-settings-store.test.mjs: L359/374/387/411 の 4 本（chat source roundtrip/クリア/他キー同居/
  unwritable）。
- scripts/cockpit.test.mjs: L465/475/483 の 3 本（createChatSourceHooks 橋渡し/status/失敗寛容）。
8+8+4+3=23、606-583=23 と整合。

## 2. ネット/SDK/マイク純度（最重要観点）

- `cockpit-server.test.mjs` の `makeFakeChatClientFactory()`（L1499-1540）は `createLiveChatClient` と同型の
  口（`start/stop/getState/getSource/onMessage/onStatus/onDiagnostic`）を持つ fake で、実体は
  `src/chat/live-chat-client.mjs` の JSDoc 型（L79-83）と突き合わせて一致を確認した。テストは
  `emitMessage/emitStatus/emitDiagnostic` で駆動しており、実 HTTP・実 YouTube・実 SDK には一切出ない。
- `cockpit-server.test.mjs` / `scripts/cockpit.test.mjs` を grep し、`live-chat-client.mjs` や
  `createLiveChatClient` を import している箇所が無いことを確認した（本番結線は `scripts/cockpit.mjs:53,542`
  のみで、テストファイルからは import されていない）。
- 耳（マイク）側も既存 fake pipeline（`makeOnAppendPipeline`）を再利用しており、実マイク・実 ffmpeg・実
  whisper には出ない（S2.5 以来の既存 in-memory fake の再利用）。
- factory 未注入時の 503（L1690）・空 source の 400（L1702）が、器官を生成しない（`fakeChat.record.clients.length===0`）
  ことまで固定しており、「テストできない実射」を回避する経路自体を固定している。

## 3. ライフサイクル縦検証の網羅性

cockpit-server.mjs の実装（L1191-1212 `connectChat` / L1161-1179 `foldChatClient` / L877-909 の POST ハンドラ /
L1258-1275 の `close()`）を読み、domain-c.md §2 の主張とテストの対応を逐条確認した。

| 契約 | 実装箇所 | テストでの固定 |
|---|---|---|
| 生成→start→フック結線（onMessage/onStatus/onDiagnostic 各 1 件） | L1191-1211 | L1542 `listenerCounts()` で `{msg:1,st:1,dg:1}` を直接検証 |
| onMessage→ingestChatMessage→viewer 行 SSE（displayName 付き） | L1197-1199 | L1542, L1598 |
| onStatus→chatStatus SSE・getState 反映で snapshot.chat.state | L1201 | L1542（`client.emitStatus("live")` → SSE + `/api/state`） |
| onDiagnostic→chatDiagnostic SSE | L1202 | L1542 |
| onSetChatSource(source) 永続化橋渡し | L1204-1210 | L1542（`persisted` 配列で検証） |
| 呼びかけコメントで fire({vision:"preferred"}) 縦串 | onMessage→ingestChatMessage→scheduler | L1598（fireCount=1・kind="comment-call"） |
| Disconnect: stop+フック全撤去+以後合流しない | L904-909, foldChatClient | L1627（`listenerCounts()===0` + 畳み後の emitMessage が合流しないこと） |
| 再 Connect: 旧器官を畳んで新 source で作り直す（同一インスタンス restart 無し） | connectChat 冒頭の foldChatClient() | L1658（`clients.length===2`・旧 `isStopped()===true`） |
| close(): 稼働中の器官も畳む | L1262 | L1679 |
| snapshot.chat の source/connected/state 3 値 | L466-469 | L1542, L1717 |

いずれも fake 器官の `emitMessage/emitStatus/emitDiagnostic` と `isStarted()/isStopped()/listenerCounts()` を
使った決定論的な検証で、実装コードを実際に読んだ上でテストの assert が実装の分岐と 1:1 で対応していることを
確認した。★ 特に「viewer append が handleTranscript の you 経路（呼びかけ照合）を誤起動しない」ことは
L1379（Domain B のテスト）と L1598（Domain C の結線縦串）の双方で `fireCount===1`（2 ではない）として固定
されており、cockpit-server.mjs L594-609 の `onTranscript` 実装（soul 除外の条件に viewer を additive に
加えた 1 行変更）と対応が取れている。

## 4. UI 構造テスト（cockpit-page.test.mjs）

domain-c.md §3 が主張する 8 要素（入力欄+Connect/Disconnect+chat-status・POST 配線・applyChat 復元・
viewer 行・chatStatus 購読・chatDiagnostic ゴースト・chatBufferAbsent ゴースト・selfFire kind 非依存）を
`cockpit.html` の実コードと突き合わせた（すべて Grep で実在確認済み・行番号は前掲）:
- `id="chat-source"`/`btn-chat-connect`/`btn-chat-disconnect`/`chat-status`（L183-187）。
- `applyChat(c)`（L289-305）: 記憶 source の復元（入力中は上書きしない・`chatSourceEdited` フラグ）・
  `connected`/`state` からの色分けクラス・Disconnect 無効化ロジック。
- `addTranscriptRow`（L376-398）: `speaker==="viewer" && d.displayName` で `viewer(名前)` ラベルを描画
  （displayName 欠落時は素の `viewer` に劣化）。
- SSE `chatStatus`（L870-878）・`chatDiagnostic`（L881-889、notLive/ended/extractFailed/network/internalError
  のみゴースト表示・observational な connected/stopped/ignoredRenderers/listenerError は非表示）・
  `diagnostic type:"chatBufferAbsent"`（L839）。
- `addSelfFireMarkerRow`（L521-533）は `d.kind` を kind 非依存でそのまま描画（comment/comment-call が既存の
  call/turn-end/silence と同型に載る）。

テストは正規表現による HTML 文字列マッチ（既存の cockpit-page.test.mjs 全体の流儀＝「見た目はテストしない」
と明記済み・S2.5 以来）であり、実ブラウザ実行の検証ではないが、実コードの構造・関数名・条件式が実在すること
は確認した。既存流儀からの逸脱ではない。

## 5. settings 永続化（cockpit-settings-store.test.mjs）

`getChatSource`/`setChatSource`（cockpit-settings-store.mjs L135-141）の実装は他キー（lastDevice/
lastChannelUrl/visionTarget/audioDevice/selfFireEnabled）と同型の `asStringOrNull` + `writeMerged`
（read-modify-write）。4 本のテスト（L359 roundtrip・L374 クリア・L387 他キー同居・L411 unwritable）が
実装と 1:1 対応することを確認した。unwritable テストは親要素をファイルにして mkdir/writeFile を必ず失敗
させる手法で、`writeMerged` の try/catch（握って続行）を確実に踏む構造になっている。

## 6. S1〜S6 無退行

- `git diff` で全 4 テストファイルの削除行を確認した。
  - `cockpit-server.test.mjs`: 削除行ゼロ（純粋 additive）。
  - `cockpit-page.test.mjs`: 削除行ゼロ。
  - `cockpit-settings-store.test.mjs`: 削除行ゼロ。
  - `scripts/cockpit.test.mjs`: 削除行 1 行のみ、内容は import リスト末尾へのカンマ追加
    （`createSelfFireHooks` → `createSelfFireHooks,` + `createChatSourceHooks` 追加）で意味的変更なし。
- 実装側 `cockpit-server.mjs` の diff に現れる削除行（7 箇所）を全て文脈込みで確認した。いずれも
  「既存行末へのカンマ追加+フィールド追加」（`speaker:` → `displayName:` 追加、`audioDevice:` → `chat:`
  追加）または「コメント文言の拡張」「既存 if 条件への `|| speaker==="viewer"` の additive 追加」であり、
  既存の you/soul 経路のロジックを変更するものは無かった。
- `node --test` 全体 606/606 緑（fire-orchestrator・barge-in・cockpit・chat・ears・mind 等の既存テストを
  含む）。close() で node:test が自然終了しており、タイマ/プロセスのリークは見られなかった。

## 7. カバレッジの穴（non-blocking・初回レビュー時点）

> **2巡目追記**: 下記 2 は追修正で解消済み（§0 参照）。1・3 は今回のスコープ外で未解消のまま
> non-blocking として残る。同時 Connect race の穴は s7-followup.md §8 に記録済み。

1. **`connectChat` 内の `onSetChatSource` 失敗寛容パス自体の cockpit-server.test.mjs でのテスト不在**:
   実装（cockpit-server.mjs L1204-1210）は `onSetChatSource` の throw を try/catch で握って Connect を
   継続する契約だが、`cockpit-server.test.mjs` にはこの分岐（永続化フックが throw しても Connect が
   200 で完了する）を直接叩くテストが見当たらない。`onSetChannelUrl` 等の既存の同型パターンで先例が
   あるかもしれないが、S7 固有のこのパスの直接固定は無い。non-blocking（onSetChatSource 自体の失敗寛容は
   `scripts/cockpit.test.mjs` L483 で別途固定されている）。**（2巡目時点でも未解消・引き続き non-blocking）**
2. ~~**POST /api/chat/connect の生成/start throw→500 パスのテスト不在**~~: **解消済み（2巡目）**。
   実装（L891-899）は `chatClientFactory` や `client.start()` が想定外 throw した場合に
   `foldChatClient()` して 500 を返す防波堤を持つが、これを固定するテストが無かった。追修正で
   `cockpit-server.test.mjs` L1732-1802 に `makeThrowingChatClientFactory("factory-throw"|"start-reject")`
   を使う専用テストが追加され、両モードで 500 + 器官畳み（isStopped/listenerCounts 全ゼロ）+
   `chat.connected===false` を固定していることを§0 で確認した。
3. **cockpit.html の JS は正規表現マッチでのみ検証**: 実ブラウザでの実行・DOM 描画確認は行われていない
   （既存の cockpit-page.test.mjs 全体の流儀であり、S7 Domain C 固有の後退ではない）。人間ゲート手順書で
   実際の見た目確認に委ねられている（domain-c.md §6）。non-blocking・言及のみ。

いずれも blocking 基準（§4 の 1〜5：器不変・実ネット不出・器官独立・決定論・無退行）には抵触しない付随的な
穴であり、機械ゲートを止める理由にはならないと判断した。

## 8. §質問（Orch-Sylph への申し送り）

- なし。test レーンとして判断に迷う点は無かった。§7 の non-blocking 3 点は追加テストの提案として記載した
  のみ。domain-c.md §7 の §質問（バッファ所有権 escalate・factory 全注入裁定・start() await 裁定・paid
  kind 区別なし・実疎通未検証項目）は Orch/Undine 裁定領域であり、test レーンの機械ゲート判定には影響しない
  （テストはこれらの v0 裁定を正しく実装どおりに固定していることを確認済み）。

## 結論（初回・606/606 時点）

- **判定: PASS（blocking 指摘なし）**。
- 606/606 緑・自然終了・ハング無しを自分の実行で確認。ネット/SDK/マイク純度（fake 器官 factory 注入・
  実 createLiveChatClient は import されない）・Connect/Disconnect/再 Connect/close の全ライフサイクル
  縦検証・UI 構造テスト・settings 永続化・S1〜S6 無退行（削除行ゼロ or 無害な additive のみ）を実物のコード
  と自分の実行結果から確認した。
- non-blocking: onSetChatSource 失敗寛容パス・500 防波堤パスの直接テスト追加を推奨（次の追撃 wave か
  followup 台帳向き）。

## 結論（2巡目・追修正後 609/609 時点・最終）

- **判定: PASS（blocking 指摘なし）**。§0 に詳細。
- design レーン契約 FAIL（applyChat の dead 時 Disconnect 誤再有効化）は `renderChatStatus` 単一経路化で
  構造的に解消され、実ロジックを `new Function` で切り出して駆動する専用テスト 2 本（dead-state 駆動・
  単一経路委譲）で固定されていることをコード実物から確認した。DOM ライブラリ等の新規依存は無い。
- 初回 non-blocking 穴のうち「connect throw→500 未テスト」は追修正で解消（factory-throw/start-reject
  両モード・器官畳み・リーク無しまで固定）。残る non-blocking 穴は「onSetChatSource 失敗寛容パスの直接
  テスト不在」「cockpit.html JS は正規表現マッチのみ」の 2 点、および s7-followup.md §8 記録の同時 Connect
  race（いずれも blocking 基準には抵触しない）。
- 自分で実行した `node --test --test-timeout=300000`（1 回で自然終了・ハング無し）: `# tests 609 / # pass
  609 / # fail 0 / # duration_ms 1309.6426`。個別ファイルでも cockpit-server.test.mjs 74・
  cockpit-page.test.mjs 30 と内訳（+1/+2）を裏付けた。既存テストの期待値変更は cockpit-page.test.mjs の
  1 本のみ（chatStatus ハンドラの委譲確認への更新・後退ではない）で、他は純粋 additive。
  `package.json`/`package-lock.json` に差分無し（新規依存なし）。無退行を自分の実行と diff で確認した。
