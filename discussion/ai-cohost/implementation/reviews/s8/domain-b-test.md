# S8 Domain B レビュー（test 適合レーン）

担当: Review-Sylph（test 適合・読み取り専任）
対象: `apps/soul/agent/src/cockpit/cockpit-server.test.mjs`（POST /api/kill 7 件）・
`apps/soul/agent/src/cockpit/view-logic/control.test.mjs`（kill 系純関数 4 件）・
`apps/soul/agent/src/cockpit/cockpit-ui.test.mjs`（KillSwitch vnode 3 件 + 既存更新）

## 判定: **合格**

## 1. 生集計（自分で実測・再実行）

`apps/soul/agent` を cwd に `node --test` フルスイート:

```
1..751
# tests 751
# suites 0
# pass 751
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 2581.8244
```

期待どおり 751/751/0。Gnome 報告の集計（738→751・net +13）と一致。

念のため対象 3 ファイルのみ単独実行し、kill 関連 14 件が全て ok であることも個別に確認済み:

```
ok 77 - cockpit POST /api/kill: orchestrator 未注入なら 503
ok 78 - cockpit GET /api/state: snapshot に killed キーが載る（初期 false・orchestrator 未注入でも既定 false）
ok 79 - cockpit POST /api/kill: {killed:true} → 200・snapshot.killed:true・orchestrator.kill() が呼ばれる・SSE state が流れる
ok 80 - cockpit POST /api/kill: {killed:false} → 200・snapshot.killed:false・orchestrator.revive() が呼ばれる
ok 81 - cockpit POST /api/kill: 非 boolean（文字列）は 400・state は変わらない
ok 82 - cockpit POST /api/kill: body 欠落（killed が undefined）は 400
ok 83 - cockpit S8 born-killed: fireOrchestratorFactory の hooks に initialKilled（サーバ現況）が渡る
ok 117 - KillSwitch vnode: killed=false は「■ KILL」ボタン・status 非表示（S8 実装済み）
ok 118 - KillSwitch vnode: killed=true は復帰ボタン + 「殺し中」status（バー全体の視覚化は control-bar の killing class）
ok 119 - KillSwitch vnode: onClick は呼び出し側のハンドラをそのまま素通しする
ok 122 - COCKPIT_CSS: 運転バー/設定引き出しの意匠トークン（§7: KILL 赤枠・畳み・chevron・pill）
ok 133 - killSwitchView: killed=false は「■ KILL」ボタン・status 非表示
ok 134 - killSwitchView: killed=true は復帰ボタン・「殺し中」status + killed class
ok 135 - killPostErrorText: 503/!ok の文言・成功は null（POST /api/kill）
ok 136 - killRequestErrorText: catch 文言
```

## 2. 要求×テスト対応表

| 要求（wave 計画 §Domain B / domain-b.md） | テスト | 判定 |
|---|---|---|
| orchestrator 未注入なら 503 | `cockpit POST /api/kill: orchestrator 未注入なら 503` | ◯ |
| `{killed:true}` → 200・snapshot.killed:true | 同上テスト内 `assert.equal(r.json.killed, true)` | ◯ |
| fake orchestrator の kill() が呼ばれた記録 | `assert.equal(fakeOrch.record.killCount, 1)` | ◯ |
| SSE state フレームに killed:true が実際に流れる | `client.waitFor((e) => e.event === "state" && e.data.killed === true)` — 実 SSE クライアントで data フレームをパースして確認（下記 §3 参照） | ◯ |
| `{killed:false}` → revive() 呼ばれ snapshot.killed:false | `cockpit POST /api/kill: {killed:false} → …` | ◯ |
| 非 boolean → 400 | `非 boolean（文字列）は 400・state は変わらない` | ◯ |
| body 欠落 → 400 | `body 欠落（killed が undefined）は 400` | ◯ |
| 初期 snapshot に killed（false） | `GET /api/state: snapshot に killed キーが載る（初期 false）` | ◯ |
| born-killed 配線（initialKilled が factory へ渡る） | `S8 born-killed: …` | △（下記 §5-2 参照。initialKilled=false ケースのみ固定） |
| killSwitchView(false/true) の構造体 | `killSwitchView: killed=false/true …` 2 件 | ◯ |
| killPostErrorText（503/!ok/成功 null） | `killPostErrorText: 503/!ok の文言・成功は null` | ◯ |
| killRequestErrorText | `killRequestErrorText: catch 文言` | ◯ |
| KillSwitch vnode: killed=false は「■ KILL」 | `KillSwitch vnode: killed=false …` | ◯ |
| KillSwitch vnode: killed=true は「殺し中」+ 復帰 | `KillSwitch vnode: killed=true …` | ◯ |
| KillSwitch vnode: onClick 素通し | `KillSwitch vnode: onClick は…素通しする` | ◯ |

## 3. テスト品質所見

- **決定論**: 全テストが `makeFakeOrchestrator`（in-memory fake・fire/kill/revive/getKilled を記録するだけ）と実 HTTP/SSE クライアント（`http.request` 直叩き、外部ネットワーク非依存）で完結している。実タイマ依存は SSE `waitFor` のタイムアウト（3000ms・`unref()` 済み）のみで、これは既存の SSE テスト全体で使われている枯れた機構。
- **`{timeout}` 付与**: 個々の `test()` 呼び出しに明示 timeout オプションは無いが、これは既存の cockpit-server.test.mjs 全体の慣習（SSE `waitFor` 側の有界待ちでハングを防ぐ設計）と同型であり、Domain B 固有の後退ではない。
- **主張と assert の一致（最重要点）**: 「SSE state に killed が流れる」という主張について、`openSseClient` は実際に `event:`/`data:` フレームをパースして `events` 配列に貯め、`waitFor(pred)` で述語一致を待つ実装になっている（同ファイル冒頭の共通ヘルパ、S2.5 から継続利用）。テスト 3 (`{killed:true} → …`) はこの `waitFor` を使って `e.data.killed === true` を実際に検証しており、**返り値 snapshot だけで済ませていない**。「kill() が呼ばれた」も `fakeOrch.record.killCount` という fake 側の実呼び出し記録で確認しており、見せかけではない。
- **fake 拡張の非破壊性**: `makeFakeOrchestrator` に追加された `kill`/`revive`/`getKilled`/`initialKilledSeen` 等のフィールドは、既存の `fire()`/`getState()`/`dispose()` 呼び出し箇所（POST /api/fire・SSE fire/expression/usage/diagnostic 系の既存テスト群）に一切触れておらず、751 件フルスイートが緑であることからも既存挙動への影響がないことを実測で確認済み。

## 4. 既存テスト改変の妥当性判定（`git diff -- apps/soul/agent/src/cockpit/cockpit-ui.test.mjs` を実見して判定）

3 箇所の改変を実見した。

1. **KillSwitch 予約テストの置換**: 旧テスト `KillSwitch vnode: 枠のみ・disabled（S8 予約・no-op）` は `KillSwitch({})` を呼び `button.props.disabled === true` を固定していた（S8 実装前の暫定仕様）。新実装の `KillSwitch` は `view`/`onClick` を必須 props として要求し `disabled` を持たない設計（裁量判断 2 に明記・snapshot.killed に「使えない」信号が無いため）。旧テストをそのまま残せば `KillSwitch({})` は `view` が `undefined` になり `view.className`/`view.label` の参照で例外になる実装（`control-bar.mjs:136-137`)ため、旧テストの継続は物理的に不可能であり、置換は妥当。置換後は 3 件（killed=false/true の表示・onClick 素通し）に分解されており、削除ではなく実装済み内容への正当な移行と判断する。ごまかし（disabled チェックを削除しただけで何も検証しなくなる、等）ではない。
2. **`settingsFromSnapshot` の deepEqual 期待値**: 2 箇所とも `killed` フィールドの追加のみで、既存フィールド（channel/visionTarget/selfFire/verbosity/audioDevice/chat）の期待値は一切変更されていない。実装側 `killed: (s && typeof s.killed === "boolean") ? s.killed : false`（`ui/app.mjs`）が返すフィールドが増えたことに対する必然的な追従であり、既存アサーションを緩めていない。妥当。
3. **`COCKPIT_CSS` テストへの追加行**: 既存アサーション（`.control-bar {`・`.kill-switch` 赤枠の正規表現マッチ等）は変更されず、新規 2 行（`.control-bar .kill-switch.killed` / `.control-bar.killing` の `includes` 確認）が追加されただけ。同ファイル内の他の CSS 存在確認（`.settings-drawer.open` 等）も同じ `assert.ok(...includes(...))` 粒度であり、これより弱いテストではない。実装（`styles.mjs` diff で該当セレクタが実在することを確認済み）の後追いで「何もテストしていない」状態にはなっていない。妥当。

3 箇所とも「無関係な変更を revert しない」制約に抵触せず、S8 実装完成に伴う正当な更新と判断する。

## 5. カバレッジ不足・所見

1. **onClickKill の `nextKilled` 計算を直接叩く統合テストが無い（vnode レベルのみ）**: spec レーンの指摘どおり存在する。原因を実装側で確認したところ、`ControlBar`（`control-bar.mjs:148-`）は `useState` を使う hooks 使用コンポーネントであり、`cockpit-ui.test.mjs` の `collectText`/`collectElements`（関数コンポーネント展開方式・同ファイル 442-444 行のコメントに明記）では hooks 使用コンポーネントを走査できない。これは `onToggleSelfFire`（自発トグル）や `onChangeVerbosity`（口数モード）と全く同じ既存の構造的制約であり、**Domain B 固有の欠落ではない**。テストは view-logic（`killSwitchView` 側で class/label/status の対応）とコンポーネント葉（`KillSwitch` の vnode）の 2 層で固定しており、既存様式との整合を優先した設計判断として妥当と判断する。
2. **born-killed テストは `initialKilled=false` ケースのみを固定**（△）: `cockpit-server.mjs:1145-1147` を確認したところ、`fireOrchestratorFactory` は `createCockpitServer` 構築時に一度だけ呼ばれる（POST /api/kill 後に再度呼ばれる経路は無い）。かつ `killed` 変数の初期値は `let killed = false;`（:442）でハードコードされており、`createCockpitServer` の options に初期 killed 状態を注入する仕組みは無い。したがって実装の現状の構造では「`killed=true` の状態で `fireOrchestratorFactory` が呼ばれる」経路自体が存在せず、テストで `initialKilled=true` ケースを再現しようがない。テスト名は「born-killed」を掲げているが実質固定しているのは「起動直後は false」の一点のみであり、これは実装の構造的制約であって Gnome の手落ちではないと判断する（Domain A 側 `fire-orchestrator.mjs:180-182` の JSDoc にも同じ不変が書かれており、実際の「キル中に生まれる orchestrator」不変は cockpit プロセスが動き続ける限り再生成が起きないこの実装では現実には発火しない設計）。
3. **`fire-hotkey.ahk` の `^!k` 追加に対応する機械テストは無い**: AutoHotkey スクリプトは Node 環境で実行できない性質のものであり、wave 計画 §5 choke point に「AutoHotkey スクリプトの再読み込み」がユーザー作業として明記されている。機械テスト対象外として扱うのが妥当で、不足とは判定しない。

## 質問

1. 上記 §5-2（born-killed テストが `initialKilled=false` ケースのみを固定している点）について、意図どおりか確認したい。もし将来 Domain A 側で `fireOrchestratorFactory` が実行中に再呼び出しされる経路（例: orchestrator の再生成・ホットスワップ等）が追加される計画があるなら、その時点で `initialKilled=true` ケースのテストが必要になる。現状の Domain B 実装・テストの範囲では対応不要と判断したが、設計意図の確認を推奨する。
2. 特にブロッキングの懸念はない。上記はいずれも軽微な所見であり、判定は「合格」で確定する。
