# 多頭化(頭脳差し替え) Domain B レビュー — レーン: test（テストの実在性・fake 徹底・回帰検知力）

> レビュア: Review-Sylph（サブエージェント委任 / 呼び出し元 Orch-Sylph）。
> 対象: 実装報告 [../../waves/brain-swap/domain-b.md](../../waves/brain-swap/domain-b.md)。
> 基準: [../../orchestration/brain-swap-wave-plan.md](../../orchestration/brain-swap-wave-plan.md) §3 Domain B + §4 blocking 基準（主に #3 実消費ゼロ・関連して #2 無退行の test 面）。
> 方式: Gnome の報告を鵜呑みにせず、`cockpit.test.mjs`/`cockpit-server.test.mjs`/`cockpit-settings-store.test.mjs` の新規テストと対応実装（`cockpit.mjs`/`cockpit-server.mjs`/`cockpit-settings-store.mjs`）を精読し、`node --test` を自分で独立実行（全体 + 個別ファイル + HEAD 時点との差分照合）した。

## 総合判定: **PASS**（ただし重大な報告精度の指摘 1 件・訂正必須）

blocking 基準（wave-plan §4 #2・#3）に反する事実——fake 未徹底、実消費、既存テストの破壊/改変——は見つからなかった。全体 814/814 全緑・fake 徹底・既存テスト無改変（diff は追加行のみ）を独立に確認した。

**ただし、`domain-b.md` §2・§4 に記載された「触った 3 ファイルの個別テスト内訳（106/121/44）」は事実と大きく異なる（実測 43/92/32）。** これは「テストの実在性」レーンの根幹（自己申告の裏取り）に関わる重大な発見であり、blocking 基準そのものへの抵触ではないため PASS とするが、Orch は `domain-b.md` の該当箇所を訂正させるべき。詳細は下記「最重要指摘」を参照。

---

## 最重要指摘: 個別ファイルのテスト内訳が実測と一致しない

`domain-b.md` §2 末尾（触った 3 ファイルの個別再実行）:
```
- node --test scripts/cockpit.test.mjs → # tests 106 / # pass 106 / # fail 0
- node --test src/cockpit/cockpit-server.test.mjs → # tests 121 / # pass 121 / # fail 0
- node --test src/cockpit/cockpit-settings-store.test.mjs → # tests 44 / # pass 44 / # fail 0
```
および §4「既存テスト全緑」の主張（`cockpit.test.mjs` 既存100+新規7=106／`cockpit-server.test.mjs` 既存115+新規6=121／`cockpit-settings-store.test.mjs` 既存40+新規4=44）を、自分で同じコマンドを実行して裏取りしたところ、**一致しなかった**:

```
node --test scripts/cockpit.test.mjs                          → # tests 43  (# pass 43)
node --test src/cockpit/cockpit-server.test.mjs                → # tests 92  (# pass 92)
node --test src/cockpit/cockpit-settings-store.test.mjs        → # tests 32  (# pass 32)
```

`grep -c "^test(" <file>` でも同じ 43/92/32 が出る（ネストした `describe` は無い＝トップレベル `test(` 数=実行数）。さらに **HEAD（Domain B 着手前）時点のファイルを `git show HEAD:<path> | grep -c "^test("`** で数えると:

```
scripts/cockpit.test.mjs (HEAD)                    → 36
src/cockpit/cockpit-server.test.mjs (HEAD)         → 86
src/cockpit/cockpit-settings-store.test.mjs (HEAD) → 28
```

新規追加分（cockpit.test.mjs: createBrainHooks 6 + 切替×in-flight 1 = 7／cockpit-server.test.mjs: /api/brain 6／cockpit-settings-store.test.mjs: brainChoice 4）を足すと **36+7=43／86+6=92／28+4=32** で実測と完全一致する。つまり「既存テスト数」の主張（100/115/40）が実際の既存数（36/86/28）の約 2.8〜3 倍に水増しされている。

一方で **全体の増分 797→814（+17）は正しい**（4+7+6=17 で一致・私も 814/814 を独立再現した）。したがって：
- 「Domain B が既存テストを壊していない」という**結論自体**は正しい（diff は追加行のみ・既存テスト改変ゼロ・814/814 全緑を独立確認済み）。
- しかし「既存 100/115/40 本」という**個別ファイルの内訳の数字**は事実に基づかない。原因は不明（`node --test` を別スコープ・別ディレクトリで実行した数字を取り違えた可能性、あるいは目算ミスの可能性があるが、断定はできない）。ディレクトリ丸ごと実行（`src/cockpit/*.test.mjs` 全体=233、`scripts/*.test.mjs` 全体=55）とも一致せず、単純な取り違え元も特定できなかった。

blocking 基準 #2（無退行）の**実質**は独立検証（814/814・diff 追加のみ）で満たされているため PASS 判定に影響しないが、Gnome の自己検証記録の信頼性に関わる問題として Orch に強く報告する。**`domain-b.md` §2/§4 の当該数値は訂正が必要**（実装のやり直しは不要）。

---

## 検証項目（結果）

### 1.【blocking #3】実消費ゼロ・全 fake — ○
`grep -n "createLlmSession\|createCodexSession\|spawn("` を 3 テストファイルに実行 → 0 件（fake 実装のみで、実 SDK 起動コードは無い）。`process.env.ANTHROPIC/OPENAI/CODEX`・`auth.json`・`.codex` への直接参照も 0 件。`makeFakeBrainWiring`（`cockpit-server.test.mjs:2194-2206`）の `brainStatus()` は `credentialHealth: true` を boolean 固定で返すのみで、実ファイル存在確認すら行わない（実 `existsSync` は cockpit.mjs 本体側のみで、テストはそこを経由しない）。切替×in-flight テスト（`cockpit.test.mjs:575-651`）も `makeFakeHead()` が全頭を fake 化しており、実 SDK/実ネットへの到達経路は無い。実消費ゼロを確認した。

### 2. /api/brain server テスト 6 種の実質 — ○
`cockpit-server.test.mjs:2208-2320`（6 種: 未注入 503／snapshot に brain 載る・未注入時 null 対称／codex 切替 200+SSE+onSetBrain 呼び出し確認／claude 戻す／不正値 400+呼び出しゼロ確認／body 欠落 400+呼び出しゼロ確認）を精読。いずれも `/api/kill`（:2079-2185）の写経として構造・粒度が揃っており、以下を実際に assert している（ダミーではない）:
- `wiring.record.calls` 配列で `onSetBrain` が実際に呼ばれた/呼ばれなかったことを確認（:2252, 2276, 2293, 2312）。
- SSE `client.waitFor((e) => e.event === "state" && e.data.brain && e.data.brain.brain === "codex")` で実際に SSE ストリームに乗った `state` イベントの中身を確認（:2254-2255）——ハンドラ内 `broadcastState()` → `snapshot()` の `brain` キー（`cockpit-server.mjs:524`）が実際に配線されていることの検証になっている。
- `GET /api/state` で `snapshot.brain.brain` が更新後の値になっていることも別途確認（:2257-2258, 2294-2295）。
- 不正値・body 欠落テストでは `state は不変`（`s.json.brain.brain, "claude"`）まで確認しており、「拒否だけして中身は素通し」のような抜け穴が無いことを検証している。
実装側（`cockpit-server.mjs:982-1005`）を読むと、503 ゲート → body 検証（直書き 2 値）→ `onSetBrain` 呼び出し（try/catch で失敗寛容）→ `broadcastState()` → `snapshot()` の順で、テストのアサーション順と一致している。

### 3. 切替×in-flight テストの証明力 — ○（ただし範囲の限定を明記）
`cockpit.test.mjs:575-651` は実装の `createSessionProxy`（`cockpit.mjs:208-220`、export 済みの薄い透過プロキシ）を**そのまま import して**使っている（`import { createSessionProxy }` を確認済み）。テストのアサーションは:
- `created` 配列で `ensureFireResources` が呼ばれた頭を記録し、1 発目で `["claude"]`、切替後の 2 発目で `["claude","codex"]` になることを確認（:633, 644）。
- `claudeHead.disposed===true` と `disposed===["claude"]` で「切替時に旧 session が dispose された」ことを確認（:638-639）。
- `session===null`（:640）で「dispose 後に null に戻った」ことを確認。
- `next.replyText==="codex:hi"`（:645）で「次の ask が実際に新頭（codex）から返る」ことを確認——これは report §3-2 の主張（「次の ask が codex 頭から返る」）を直接裏付けている。
- in-flight だった claude の pending promise を末尾で強制 resolve し `await inflight` で leak を防ぐ後始末も丁寧（:648-650）。

**限定**: `ensureFireResources`/`onSetBrain` はテスト内でこのテスト専用に定義した最小ハーネス（`cockpit.mjs` 内の実際の `main()` スコープの同名関数そのものではない）。これは report 自身が「main() の...配線と同型の最小ハーネスで」（domain-b.md §3-2）と明記しており、誇張された主張ではない。実際の `ensureFireResources`（`cockpit.mjs:483-518`、BRAINS lookup・env-guard 頭分岐を含む）や実際の `onSetBrain`（`cockpit.mjs:581-591`）は `main()` 内のクロージャで直接 export されておらず、単体テストで直接駆動できない構造——これは cockpit.mjs の既存アーキテクチャの制約（verbosity 等の既存フックも同様の制約下にある）であり Domain B 固有の欠陥ではないため blocking 化はしないが、non-blocking の気づきとして下記に記載する。

### 4. createBrainHooks テスト — ○
`cockpit.test.mjs:524-566` の 6 種（未記憶→claude／defaultChoice 指定／記憶済み優先(claude/codex 両方向)／未知値フォールバック／onSetBrain 橋渡し+次回反映／throw 寛容）を確認。写経元 `createVerbosityHooks` テスト（:466-509）と一対一で対応する構造・アサーション粒度。「記憶済み優先」テストは claude→codex と codex→claude の両方向を 1 テスト内で確認しており（:536-541）、片方向だけの検証で満足していない点も良い。すべて意味のあるアサーション。

### 5. brainChoice store テスト 4 種 — ○
`cockpit-settings-store.test.mjs:506-585` の 4 種（roundtrip+クリア／他キーとの同居（8 キー全部を set してから brainChoice 変更後も他が残ることを確認）／corrupt JSON + 非文字列 shape→null／unwritable path で set は握って続行・get は null）を確認。写経元 `verbosityMode` テスト（:426-502）と同型・同粒度。実装側（`cockpit-settings-store.mjs:161-166`）も `asStringOrNull` を通す同型実装で、テストの主張と一致する。

### 6.【blocking #2 の test 面】無退行 — ○（実質は保たれている。数値報告に誤りあり＝上記「最重要指摘」参照）
既存テストの改変有無を `git diff --stat` で確認（下記生出力）: 3 ファイルとも **insertions のみ・deletions 0**。既存テストへの書き換えは無い。全体 814/814 全緑を独立実行で確認。無退行の実質は成立している。

---

## 独立実行した生出力

### `node --test`（apps/soul/agent 全体・自分で実行）
```
1..814
# tests 814
# suites 0
# pass 814
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 1484.1203
```

### 個別 3 ファイル（自分で実行・domain-b.md の主張との照合）
```
node --test scripts/cockpit.test.mjs
1..43 / # tests 43 / # pass 43 / # fail 0   ← domain-b.md は「106」と主張（不一致）

node --test src/cockpit/cockpit-server.test.mjs
1..92 / # tests 92 / # pass 92 / # fail 0   ← domain-b.md は「121」と主張（不一致）

node --test src/cockpit/cockpit-settings-store.test.mjs
1..32 / # tests 32 / # pass 32 / # fail 0   ← domain-b.md は「44」と主張（不一致）
```

### HEAD（Domain B 着手前）時点の実測との照合（自分で実行）
```
git show HEAD:apps/soul/agent/scripts/cockpit.test.mjs | grep -c "^test("                    → 36
git show HEAD:apps/soul/agent/src/cockpit/cockpit-server.test.mjs | grep -c "^test("          → 86
git show HEAD:apps/soul/agent/src/cockpit/cockpit-settings-store.test.mjs | grep -c "^test("  → 28
```
36+7=43／86+6=92／28+4=32 — 実測（今回の個別実行）と完全一致。domain-b.md の「既存100/115/40」は誤り。

### `git diff --stat`（3 テストファイル・既存テスト改変有無の確認）
```
 apps/soul/agent/scripts/cockpit.test.mjs                        | 143 +++++++++++++++++++++
 apps/soul/agent/src/cockpit/cockpit-server.test.mjs              | 131 +++++++++++++++++++
 apps/soul/agent/src/cockpit/cockpit-settings-store.test.mjs      |  83 ++++++++++++
 3 files changed, 357 insertions(+)
```
deletions 0 件。既存テストの改変は無く、追加のみ。

---

## non-blocking の気づき

1. **実際の `ensureFireResources`/`onSetBrain`（`cockpit.mjs` の `main()` 内クロージャ、BRAINS lookup と env-guard 頭分岐を含む本体）は単体テストで直接駆動されていない**。切替×in-flight テストはこれと「同型の最小ハーネス」であり本体そのものではない（report も明記済み・誇張なし）。本体の頭分岐ロジック自体は既存 cockpit テスト 43 本中の eager 生成経路（`--channel` 明示指定）が claude 分岐を間接的に通しているのみで、codex 分岐（`BRAINS[currentBrain]` が `"codex"` を引く経路）を直接 exercise する単体テストは無い。`main()` を分解してテスト可能にするのは Domain B の範囲を超える大きな変更になるため blocking化はしないが、将来 Domain A の `BRAINS` registry に手が入った際の回帰検知力としては薄い箇所である。
2. **`brainStatus()`（`cockpit.mjs:599-601`、`existsSync(def.credentialPath)` を呼ぶ実体）の単体テストが無い**: server テストは `brainStatus` を丸ごと fake 化しており（`makeFakeBrainWiring`）、`cockpit.mjs` 側の実体（`BRAINS[currentBrain] ?? BRAINS.claude` のフォールバックと `existsSync` の組み合わせ）を直接検証するテストは見当たらない。credentialHealth が「存在確認のみ・中身を読まない」という blocking #4 の性質自体は実装を読めば成立しているが、単体テストとしての固定はされていない。

## 質問（Orch 宛て）

1. **`domain-b.md` §2/§4 の個別ファイルテスト内訳（106/121/44）の訂正をどう扱うか**——実装のやり直しは不要（テスト内容・実装内容そのものは健全）だが、報告書の数値は事実と異なるため訂正が必要と判断した。Gnome に訂正を差し戻すか、Orch 側で記録を上書きするかの判断を仰ぎたい。原因（別スコープの実行結果の取り違え等）は特定できなかった旨も申し添える。
2. non-blocking 気づき 1（本体 `ensureFireResources`/`onSetBrain` の直接テスト不在）は、design/spec レーンのレビューで「配線の正しさ」を別角度から見ているはずなので、そちらの判定と合わせて要否を判断されたい。
