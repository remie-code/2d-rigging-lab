# 「朗読と合いの手」wave — Domain B（配線+操縦席+docs）test 妥当性レビュー

> レビュー担当: Review-Sylph（test レーン）。呼び出し元: Orch-Sylph。
> 検証対象: `discussion/ai-cohost/implementation/waves/reading-interjection/domain-b.md`（Gnome 自己申告）。
> 根拠文書: [reading-interjection-wave-plan.md](../../orchestration/reading-interjection-wave-plan.md) §1/§3/§4。
> 実施内容: 自分でテストソースを読み・自分で `node --test` を実行し・生出力のみを根拠に判定。

## 総合判定: PASS

blocking な問題は見つからなかった。全緑・実測・born-disabled/interjection の本物の分岐検証・既存テストの無退行・実消費ゼロをすべて自分で確認した。nit 数件のみ（末尾参照）。

## 1. `node --test`（全体）— 自分で実行した生サマリ

### 1 回目

```
1..886
# tests 886
# suites 0
# pass 886
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 6492.4817
```

### 2 回目（フレーク確認・再実行）

```
1..886
# tests 886
# suites 0
# pass 886
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 6469.8389
```

2 回とも `tests 886 / pass 886 / fail 0 / cancelled 0`。フレークは観測されなかった。
Domain A 完了時点のベースライン 863（domain-a.md §10 記載・Gnome 自己申告）に対し +23 = 886 で一致。
Gnome 自己申告（domain-b.md §8）の生サマリと私が実行した生サマリは同一。

## 2. §3 Domain B テスト項目 × 対応テストの充足表

すべて `apps/soul/agent/src/cockpit/cockpit-server.test.mjs` 他のテストソースを自分で読み、
かつ対応する `apps/soul/agent/src/cockpit/cockpit-server.mjs` 他のソース分岐を突き合わせて確認した。

| 項目 | 該当テスト | 実効性 |
|---|---|---|
| POST /api/barge-in 6 種 | cockpit-server.test.mjs:2518-2611（実質 5 テストで 6 観点をカバー） | 充足（§3 参照） |
| born-disabled 伝播（blocking） | cockpit-server.test.mjs:2619-2667（2 テスト） | 充足・本物（§4 参照） |
| onFireRequest interjection 2 種 | cockpit-server.test.mjs:2697-2736 | 充足・本物（§5 参照） |
| settings-store bargeInEnabled 4 種 | cockpit-settings-store.test.mjs:360-425 | 充足 |
| view-logic 4 種 | control.test.mjs:163-204 | 充足・ソース実装と一致 |
| Pill/page テスト | cockpit-ui.test.mjs:523-536, 640-643, 475 | 充足（falseケース欠は nit） |
| createBargeInHooks 5 種（既定 true 確認） | scripts/cockpit.test.mjs:469-505 | 充足 |

補足: POST /api/barge-in の「6 種」は Gnome の domain-b.md §6 列挙と一致し、テストコード上は 5 個の
`test(...)` ブロック（503・切替+既定ON確認・非boolean強制・永続化フック・broadcastState）で 6 観点
（gate未生成503／enabled:true反映／enabled:false反映／非boolean拒否／永続フック呼び出し／SSE反映）を
カバーしている（"enabled:true 反映"と"enabled:false 反映"が 1 テスト内の 2 assert に同居）。数え方の
違いであり抜けではない。

## 3. POST /api/barge-in 6 種の実効性

`cockpit-server.mjs:950-969` を読み、テストと突き合わせた。

- **①②enabled:true/false 反映**: `const enabled = body.enabled === true; bargeInGate.setEnabled(enabled);`
  → テスト（:2530-2552）は既定 ON（`s0.json.bargeIn = {enabled:true}`）から出発し false→true 往復を
  `r.json.bargeIn` と `server.bargeInStatus()` の両方で確認。本物。
- **③非 boolean 拒否**: `body.enabled === true` の厳密比較がソースコードそのもの。テスト（:2554-2572）は
  `{enabled:"true"}` / `{enabled:1}` / `{}` の 3 パターンすべてで `enabled:false` 強制を確認。本物
  （`==` ではなく `===` を使っている事実をテストが積極的に固定している）。
- **④gate 未生成 503**: `if (!bargeInGate) { sendJson(res, 503, ...); return; }` を、
  `fireOrchestratorFactory` 未注入（=`fireOrchestrator` が truthy にならず gate 未構築）のテスト（:2518-2528）
  で固定。
- **⑤永続フック呼び出し**: `onSetBargeInEnabled(bargeInGate.isEnabled())` の呼び出しをテスト（:2574-2592）
  が `persisted` 配列で記録・false→true の順で呼ばれることを確認。
- **⑥broadcastState/SSE 反映**: テスト（:2594-2611）が SSE `state` イベントの `data.bargeIn.enabled` と
  `GET /api/state` の両方を確認。

## 4. born-disabled 伝播テスト（blocking）の実効性評価 — 本物

`cockpit-server.mjs:1283-1300` を読んだ。

```js
if (fireOrchestrator && typeof fireOrchestrator.interrupt === "function") {
  bargeInGate = createBargeInGate({
    enabled: bargeInInitialEnabled,   // 構築時点で直接渡す（後追い setEnabled なし）
    onConfirm: () => { void fireOrchestrator.interrupt(); ... }
  });
}
```

`bargeInInitialEnabled = options.bargeInInitialEnabled !== false`（:447、`!== false` で既定 true）。

さらに `apps/soul/agent/src/mind/barge-in.mjs`（Domain A・今回無変更）の `createBargeInGate` を読み、
`let enabled = options.enabled !== false;`（構築時に確定）と `handle(event) { if (disposed || !enabled || ...) return; }`
（disabled 中は VAD イベントを即座に無視・タイマーすら張らない）を確認した。「gate は生まれた瞬間から
disabled が確定しており、構築後の setEnabled 後追いではない」という Gnome の主張は**コード上正しい**。

テスト側（cockpit-server.test.mjs:2619-2667）は:
- disabled 側: `bargeInInitialEnabled:false` で構築 → `server.bargeInStatus()` が即座に `{enabled:false}`
  （**同期証拠**・タイマー不要）→ VAD `speechStart` を送り第一段+第二段のフル猶予
  （`BARGE_IN_MIN_SPEECH_MS + BARGE_IN_GRACE_MS + 200` = 2400ms）待っても `interruptCount` が 0 のまま。
- 既定（未指定）側: `server.bargeInStatus()` が `{enabled:true}` → 同じ VAD シナリオで、第一段通過直後
  （`BARGE_IN_MIN_SPEECH_MS + 100` = 300ms 時点）ではまだ `interruptCount:0`（第二段へ移行しただけ、
  という二段構えの中間状態も確認）→ 第二段満了後（`BARGE_IN_GRACE_MS + 200` = 2200ms 追加）で
  `interruptCount:1`。

この対比（disabled では 2400ms 待っても 0 のまま／enabled では約 2.5 秒後に 1）は「構築直後から
enabled/disabled が確定している」ことを直接固定している。「born-enabled してから toggle した」パターン
ではなく「生まれた瞬間から disabled」を検証している、という Gnome の主張は実装・テストとも裏付けが取れた。
既定（未指定）で ON になることも、この 2 テスト双方の `server.bargeInStatus()` 同期チェックと
POST /api/barge-in テスト（§3 ①②）の両方で二重に固定されている。

## 5. onFireRequest interjection テストの実効性評価 — 本物（飾りではない）

`cockpit-server.mjs:1332-1345` の実コード:

```js
onFireRequest: (req) => {
  const kind = req && req.kind;
  const firePromise =
    req && req.kind === "silence"
      ? fireOrchestrator.fire({ vision: true })
      : fireOrchestrator.fire({ vision: "preferred" });
  ...
}
```

`fireSchedulerFactory`（テスト注入オプション・:1326-1328、未指定なら本番と同じ `createFireScheduler`）
経由で、テスト側 `makeFakeFireSchedulerCapture()`（cockpit-server.test.mjs:2676-2695）は factory に渡された
`opts.onFireRequest`（＝上記コードそのもの）を握るだけの fake scheduler を返す。テストはこのコールバックを
直接 `{kind:"interjection"}` で呼び出す（:2707, 2728）。

これは **fake なのは scheduler 側だけで、`onFireRequest` の中身（vision 振り分けの三項演算子）は
cockpit-server.mjs 本体の未改変コード**である。よってテストは「本物の分岐」（`kind==="silence"` でなければ
`vision:"preferred"`、interjection もその他枝に落ちる）を実際に通している。fire({vision:"preferred"}) 呼び出し
（`fakeOrch.record.lastFireOptions` で確認）と selfFire SSE への `kind:"interjection"` 素通し
（SSE `selfFire` イベントの `data.kind` で確認）の両方を実測。

本番経路（`scripts/cockpit.mjs`）は `fireSchedulerFactory` を指定していないことも `scripts/cockpit.mjs` を
grep して確認済み（`createCockpitServer` 呼び出し箇所に該当オプションなし）——テスト注入が本番の
挙動を変えていないことも確認した。

## 6. settings-store / view-logic / hooks の妥当性

- **settings-store bargeInEnabled 4 種**（roundtrip・他キーとの同居・corrupt/非bool→null・unwritable path
  握り）はソース（`cockpit-settings-store.mjs`）を見ずとも `getSelfFireEnabled`/`setSelfFireEnabled` と
  完全同型のテストパターンで、既存 selfFireEnabled 系の 4 テストと 1:1 対応している。妥当。
- **view-logic 4 種**: `control.mjs:207-238` の `bargeInToggleView`/`bargeInPostErrorText`/
  `bargeInRequestErrorText` の実装を読み、テストの期待値（`barge-in-status` クラス名・503文言・
  set failed 文言など）が実装と完全一致することを確認した。
- **createBargeInHooks 5 種**: `scripts/cockpit.mjs:329-344` の実装（`defaultEnabled=true` が
  selfFire の `false` との明示的非対称）と、テスト（scripts/cockpit.test.mjs:469-505）の
  「未記憶→defaultEnabled(true)フォールバック」「defaultEnabled明示指定」「記憶済みbool優先」
  「onSetBargeInEnabled橋渡し」「throw握り」の 5 テストが対応。`main()` 内で実際に
  `createBargeInHooks(settings, true)` が呼ばれ、`resolveInitialEnabled()` の戻り値が
  `createCockpitServer({ bargeInInitialEnabled: ... })` へ渡る配線（`scripts/cockpit.mjs:480-481,711-713`）
  も実ソースで確認した（born-disabled 伝播の起点）。

## 7. UI 配線（app.mjs/control-bar.mjs）の実効性

domain-b.md §7-2 が「裁量追加」と明記する `app.mjs`/`styles.mjs` の配線を実ソースで確認した:
`app.mjs` の `settingsFromSnapshot` が `bargeIn: (s && s.bargeIn) ?? null` を返し、`<ControlBar bargeIn=...>`
へ橋渡し（app.mjs:80-83, 257）。`control-bar.mjs` の `onToggleBargeIn`（:240-258）が実際に
`POST /api/barge-in` を叩き `applySnapshot` で反映する。この配線がなければ `BargeInPill` は永久に
「not available」のまま、という Gnome の指摘は正しく、実際に配線されている。

## 8. 既存テストの無退行 — 確認済み（additive のみ）

`git diff` を自分で読んだ（cockpit-server.test.mjs / cockpit-settings-store.test.mjs / control.test.mjs /
cockpit-ui.test.mjs の 4 ファイル全て）。

- cockpit-server.test.mjs: 変更は (a) import 1 行追加、(b) `makeFakeOrchestrator` に `interruptCount`
  フィールドと `interrupt()` メソッドを追加（コメントで「既存呼び出しには無害」と明記・実際 diff 上も
  既存 assert は 1 行も変更されていない）、(c) ファイル末尾への新規 test 追加のみ。
- cockpit-settings-store.test.mjs: 末尾追加のみ（純増）。
- control.test.mjs: import 行に 3 シンボル追加＋末尾に新規 test 4 個追加のみ。既存 test の中身は無変更。
- cockpit-ui.test.mjs: import 行更新＋`settingsFromSnapshot` の期待値オブジェクトに `bargeIn` キーを
  追加（既存の他キーの期待値は変更なし）＋import スモークのリストに `BargeInPill` 追加＋新規 test 2 個
  （BargeInPill vnode・CSS 存在確認）追加。既存 assert は 1 つも弱められていない。

全体 `node --test` が fail 0 であることも合わせ、既存の self-fire/verbosity/kill/転写/SSE/vision 系
テストは緑のまま無退行と判断できる。

## 9. 実消費ゼロ — 確認済み

テストソースを読んだ範囲で実 LLM/TTS/net/mic への依存は見当たらない。`makeFakeOrchestrator`・
`makeFakePipeline`・`makeFakeFireSchedulerCapture` はすべて注入 fake。`cockpit-settings-store.test.mjs`
は OS tmpdir（`mkdtempSync(join(tmpdir(), ...))`）への実ファイル I/O を使うが、これは既存 selfFireEnabled
等のテストと同型の既存パターンであり、外部ネットワーク/実プロセスではない。born-disabled テストの
実タイマー待ちも `setTimeout` のみで実 I/O ではない。

## 10. born-disabled 実タイマー待ちテストのフレーク risk 評価

- disabled 側: 2400ms の実時間待ち後に `interruptCount===0` を確認するのみ（下限方向の主張なし）。
  CI が遅延しても、タイマーが「発火しない」ことの確認は安全側（遅延で早まって発火することはない）。
  フレークリスクは低い。
- 既定 ON 側（`{timeout:10000}` 明示）: 300ms 時点で中間的に `interruptCount===0` を確認する箇所がある。
  ここは理論上、CI が極端に混雑してイベントループが数秒単位でブロックされた場合、300ms 待ちの間に
  実際には第一段+第二段の両方のタイマーが「積み残しで一気に発火」し得るため、この中間 assert が
  まれに崩れる可能性はゼロではない（ただし通常の CI 負荷では起きない）。2 回の実行では両方安定して
  `pass` だった。
- 全体テスト実行時間は Domain A 時点の約 1.8 秒から約 6.4〜6.5 秒に伸びている（主因はこの 2 テストの
  合計 ~4.9 秒の実時間待ち）。886 テスト全体で 6.5 秒程度は実害があるレベルではないが、CI が今後
  テスト数を増やしていくと累積コストになりうる。Gnome 自身が followup 候補（cockpit-server.mjs への
  タイマー注入経路の追加）として記録済み（domain-b.md §7-4）——この対応は本 wave のスコープ外との
  判断は妥当。

## 11. 抜け・弱い assert の指摘（すべて nit・non-blocking）

1. POST /api/barge-in の非 boolean 強制テスト（cockpit-server.test.mjs:2554-2572）は `"true"`/`1`/`{}`
   （欠落）の 3 パターンのみで、明示的な `{enabled: null}` ケースが無い。`body.enabled === true` の
   厳密比較であれば null も false に畳まれるはずだが、null 自体は他 API（kill 等）で「型検証」の対象に
   なることがあり、barge-in では黙って false 化する仕様（selfFire と同型）である以上、明示ケースが
   あるとより丁寧だった。
2. `BargeInPill` vnode テスト（cockpit-ui.test.mjs:523-536）は null と `{enabled:true}` の 2 ケースのみで
   `{enabled:false}`（checked:false かつ disabled:false）の vnode 描画確認が無い。ただし既存の
   `SelfFirePill` vnode テストも同型の抜けを持っており（写経元と同じパターン）、Domain B 固有の劣化では
   ない。
3. born-disabled の 2 テストのうち disabled 側にのみ `{timeout:10000}` の明示指定が無い（既定 ON 側にのみ
   ある）。実害は無い（disabled 側は node:test の既定タイムアウトで問題なく収まっている＝2 回の実行で
   確認済み）が、一貫性の観点では気になる点。
4. `bargeInGate` は `fireOrchestrator.interrupt` が関数のときのみ構築される分岐だが、「fireOrchestrator は
   存在するが interrupt が関数でない」ケースの単体テストは無い（gate 未生成 503 テストは
   `fireOrchestratorFactory` 自体を未注入にするパターンのみ）。実務上 fire-orchestrator.mjs は常に
   interrupt を持つため起こりにくい分岐だが、境界としては未検証。

## 12. Orch への質問・申し送り

- Gnome が domain-b.md §7-6 で挙げている質問（`fireSchedulerFactory` オプション追加がレビューで
  許容されない場合の代替方針）について、**test 妥当性の観点からは現状の実装で問題ないと判断する**。
  理由: (a) `onFireRequest` 内の vision 振り分けロジック自体はコード無改修であり、テストは
  fake scheduler 経由でその「本物の」コールバックを直接駆動しているだけで飾りではない、
  (b) `fireOrchestratorFactory`/`pipelineFactory` と同型の既存パターンに沿っている、
  (c) 本番 `scripts/cockpit.mjs` は指定しておらず HTTP ワイヤ契約（POST/GET/SSE の形）には一切影響しない。
  ただし「テスト専用オプションを本番コードに追加すること自体の是非」は設計判断（spec/design レーン）の
  範疇であり、そちらの判定が優先されるべき点は申し添える。
- §11 の nit 4 件はいずれも blocking ではなく、現状のまま次段階へ進めて差し支えないと判断する。
