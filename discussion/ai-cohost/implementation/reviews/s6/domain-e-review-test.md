# S6 追撃 Domain E レビュー — test レーン

> レビュー担当: Review-Sylph（test レーン）。対象: `discussion/ai-cohost/implementation/waves/s6/domain-e.md`
> （§4 テスト表・§5 1アサーション変更理由・§9 生数字）。
> 検証対象ファイル: `apps/soul/agent/src/mind/fire-orchestrator.test.mjs`（+11本）・
> `apps/soul/agent/src/cockpit/cockpit-server.test.mjs`（変更1アサーション）・
> 参考: `apps/soul/agent/src/mind/fire-orchestrator.mjs`。

## 判定: **PASS**

`fire({vision:"preferred"})` の新分岐11本はすべて全fake（session/capture/speak/channel/player）注入で
決定論的。`fire-orchestrator.test.mjs` は git diff 上**追加のみ**（既存861行目までの改変ゼロ）。
`cockpit-server.test.mjs` の変更は申告どおり**1アサーション+コメントのみ**（削除行を実物確認）。
silence・手動視覚Fireの既存中止テスト（`vision-no-target`・`vision-capture-failed`）は無変更・全通過。
`node --test` は自分で実行し 518/518 緑・ハングなし・プロンプト正常復帰。ただし **domain-e.md の個別
ファイル内訳数値に1件の誤記**（fire-orchestrator.test.mjs「40→51」は誤りで、実測は「39→50」）を発見。
全体総数518・cockpit-server 60本は正確なので blocking にはしないが、Gnomeへの訂正申し送りとして記録する。

## 1. 自分で再実行した生数字

```
$ cd apps/soul/agent && node --test 2>&1 | tail -8
1..518
# tests 518
# suites 0
# pass 518
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 1670.1361
```

```
$ cd apps/soul/agent && node --test src/mind/fire-orchestrator.test.mjs 2>&1 | tail -8
1..50
# tests 50
# suites 0
# pass 50
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 276.9815
```

```
$ cd apps/soul/agent && node --test src/cockpit/cockpit-server.test.mjs 2>&1 | tail -8
1..60
# tests 60
# suites 0
# pass 60
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 597.9055
```

- 実行1回で完走・ハングなし・プロンプト正常復帰（3回とも1回目で成功、再試行不要）。
- 全体総数518・cockpit-server 60本は Gnome §9 申告と一致。
- **fire-orchestrator.test.mjs は 50本（Gnome申告「51本」ではない）**。新規分岐11本は
  `node --test ... | grep 'preferred'` で個別確認し、テスト名33〜43番の11本が該当することを確認した
  （下記§3の逐条どおり）。ベースライン（HEAD版・変更前）を `git show HEAD:...fire-orchestrator.test.mjs`
  で一時ファイルへ展開し単体実行したところ **39本**（既存分）。39+11=50 で実測と一致する。
  domain-e.md §1/§9 の「fire-orchestrator.test.mjs: 40 → 51（+11）」という数値は **off-by-one の誤記**
  （正しくは「39 → 50（+11）」）。増分「+11」自体・全体総数「518」は正しい。

```
$ git show HEAD:apps/soul/agent/src/mind/fire-orchestrator.test.mjs > apps/soul/agent/src/mind/_baseline_fo.test.mjs
$ cd apps/soul/agent && node --test src/mind/_baseline_fo.test.mjs 2>&1 | tail -8
1..39
# tests 39
# pass 39
# fail 0
（確認後ただちに削除・実ファイルへの影響なし）
```

## 2. 無退行の裏取り（git diff で削除行の実物確認）

```
$ git diff -- apps/soul/agent/src/mind/fire-orchestrator.test.mjs | grep -E "^-[^-]"
（出力なし）
```
- 削除行ゼロ。diff は単一hunk `@@ -861,6 +861,267 @@` で、既存861行目までは完全無変更・
  以降に11本ぶんの新規テストを追記しているだけ（純粋追加）。

```
$ git diff -- apps/soul/agent/src/cockpit/cockpit-server.test.mjs | grep -E "^-[^-]"
-    // 呼びかけ命中の you 発話 → fire() が 1 回（call = 通常 Fire・vision オプション無し）。
-    assert.equal(fakeOrch.record.lastFireOptions, undefined); // call は通常 Fire（fire() 引数なし）。
```
- 削除はこの2行（うち1行はコメント、1行が実アサーション）のみ。置き換え後は
  `assert.deepEqual(fakeOrch.record.lastFireOptions, { vision: "preferred" })` + 更新コメント。
  申告どおり「1アサーション+コメントのみ」で、他のアサーション（`fireCount` 等）・他テストは無変更。

- silence・手動視覚Fireの既存中止テスト（`fire-orchestrator.test.mjs` 704行目
  `対象未設定（getVisionTarget→null）は...fireVisionError(no-target)`、689行目
  `キャプチャ失敗(${kind})は...vision-capture-failed`、739/762/791/830/845行目の未注入・throw・
  busy・耳未起動・dispose）はいずれも diff 範囲外（861行目より前）＝無変更。実行結果でも全通過を確認。

## 3. 新規11本の逐条確認（全fake・決定論）

`node --test src/mind/fire-orchestrator.test.mjs` のテスト名33〜43番に対応。

| # | 分岐 | 固定内容 | 決定論の担保 |
|---|---|---|---|
| 1 | 対象あり+キャプチャ成功 | `fired:true`・`vision:true`・content配列が画像先行（`type:"image"`→`type:"text"`）・onVisionCaptured 1回・`onUsage{vision:true}` | fake session.ask固定応答・`makeFakeCapture`固定バイト列 |
| 2 | 対象未設定（`getVisionTarget:()=>null`） | 中止せず`fired:true`・`vision:undefined`・capture非呼出・ask文字列・onVisionCaptured 0・`onUsage{vision:false}`・`fireVisionError`診断なし | getVisionTarget固定null |
| 3 | getVisionTarget未注入（既定） | 同上（省略形） | オプション省略 |
| 4–7 | キャプチャ失敗4種（notFound/minimized/failed/timeout） | 中止せず`fired:true`・`vision:undefined`・capture 1回試行・ask文字列・`fireVisionDegraded{kind,message}`診断が出る・`fireVisionError`（中止診断）は出ない・onVisionCaptured 0・`onUsage{vision:false}` | `makeFakeCapture({error:{kind,message}})` で4種を`for`ループ固定 |
| 8 | 劣化フォールバックの単一受理 | `onFire`の`accepted:true`が1回だけ（vision:trueの受理のみ・劣化後の通常askはaccept再emitしない） | capture失敗固定・`fires.filter(accepted===true).length===1`で直接検証 |
| 9 | 対象未設定+空窓 | 通常Fireと同じ`empty-window`で中止・ask非呼出・`onFire{accepted:false,reason:"empty-window"}` | `windowMs:0`+`nowImpl`固定オフセットで全エントリを窓外へ |
| 10 | busy中 | 無視され`reason:"busy"`・キャプチャすら呼ばれない | `deferred()`ゲートで最初のfire()をthinking中に固定してから2発目を撃つ |
| 11 | 耳未起動 | `ears-not-running` | `getBuffer:()=>null` |

- 全11本が `fakeChannel`/`fakePlayer`/fake `session.ask`/`makeFakeSpeak`/`makeFakeCapture` のみを使用。
  実SDK・実マイク・実PowerShell・実タイマは不使用（#10のbusy判定も`deferred()`+`Promise.resolve()`の
  マイクロタスク待ちで同期的に確定させており、実時間のsleepに依存しない）。
- 各テストに `{ timeout: 5000 }` が付与されハング時は自動失敗する構え。

## 4. カバレッジの穴（non-blocking）

1. **数値申告の誤記**（§1で確認済み）: domain-e.md §1表・§9の「fire-orchestrator.test.mjs: 40→51」は
   「39→50」の誤り。総数518・増分+11・cockpit-server 60本は正確。テストの正しさ自体には無関係だが、
   Gnomeの記録訂正を推奨。
2. **preferred発火中のbarge-in（interrupt）の明示テストが無い**: `askWithVision`成功時は
   `processAskedReply`を通り、speaking中の再生実区間追跡・interrupt()処理はvisionフラグに関係ない
   共通コード（既存のbarge-inテスト群がその経路を別途カバー）。コード構造上のリスクは低いが、
   「visionモードでbarge-inが起きても同じsoul追記経路を通る」ことを直接固定したテストはない。
3. **劣化後のspeak呼び出しの明示確認が薄い**: キャプチャ失敗4種（#4-7）は`result.replyText`で
   間接確認しているが、`fakeSpeak.spoken`配列への直接アサーションはない（#2の対象未設定テストのみ
   `fakeSpeak.spoken[0].text`を直接見ている）。実害はほぼ無いが、4-7でも同様の直接確認があれば
   より堅牢。
4. **turn-end結線の直接テストなし（domain-e.md §8-4でGnome自身が認めている既知の分業）**:
   `cockpit-server.mjs`の分岐は `req.kind === "silence" ? fire({vision:true}) : fire({vision:"preferred"})`
   という**単純な二値分岐**（"call"/"turn-end"という文字列はコード上一切登場せず、silence以外は
   全て同一のelse節を通る）。static readで確認した限りcallとturn-endは文字どおり同一コードパスであり、
   call用の`cockpit-server.test.mjs`テスト（line 1242）が通っていればturn-end側の分岐選択も論理的に
   健全と言える。ただし `cockpit-server.test.mjs` にはturn-end kindでの明示的な結合テストは無い
   （§8-4のとおり、cockpit-serverがscheduler内部生成でtimer注入口が無いためタイマ依存kindの結合
   テストが困難という既存の構造的制約 — Domain D時点から同じ制約）。

いずれも「新分岐に決定論テストが皆無」「隠れた退行」「実SDK/実マイク混入」「ハング」には該当せず、
blocking基準を満たさない。

## 5. blocking / non-blocking まとめ

- **blocking: なし。**
- **non-blocking**: 上記§4の4件（数値誤記1件・カバレッジの軽微な穴3件）。特に1件目（数値誤記）は
  Gnomeへの記録訂正を推奨（domain-e.md §1表・§9を「39→50」に修正）。

## §質問（Orch への申し送り）

- 質問1（要訂正確認）: domain-e.md §1表・§9の「`src/mind/fire-orchestrator.test.mjs`: 40 → 51（+11）」
  は実測「39 → 50（+11）」の誤記と判断した。総数518・増分+11は正しいため機械ゲート合否には影響しない
  が、記録の正確性としてGnomeに訂正を依頼してよいか、Orchの判断を仰ぎたい。
- domain-e.md §8-4「turn-end結線の分業」についてはtestレーンとしてはコード上（static read）で
  callと同一elseブランチであることを確認し妥当と判断したが、結合テストとして固定するかどうかは
  設計判断（spec/designレーンの管轄）に委ねる。
