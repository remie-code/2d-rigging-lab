# 口数配線+コーディ語彙登録 wave Domain A レビュー（test レーン）

> レーン: **test**（追加テストが要求を実際に固定しているか＝トートロジーでないこと・全緑の独立再実行・
> テストの規律）。
> レビュアー: Review-Sylph。呼び出し元: Orch-Sylph（口数配線+コーディ語彙登録 wave 実行責任者）。
> 対象: `apps/soul/agent/src/mind/fire-scheduler.test.mjs`・`src/cockpit/cockpit-server.test.mjs`・
> `scripts/cockpit.test.mjs`・`src/cockpit/cockpit-settings-store.test.mjs`・
> `src/cockpit/view-logic/control.test.mjs`・`src/cockpit/cockpit-ui.test.mjs`（追加分計 +27 本）。
> 判定基準: `discussion/ai-cohost/implementation/orchestration/verbosity-vocab-wave-plan.md` §3 Domain A・§4
> （特に §4-2）／`verbosity-vocab-inventory.md` §A-2／Gnome Claim
> `discussion/ai-cohost/implementation/waves/verbosity-vocab/domain-a.md`。日付: 2026-07-14。
> 読み取り専任。install/commit・実装変更は一切していない。全数字は自分で `node --test` を実行して確認。
> `.tmp/facex-*`・`packages/authoring-core` は不干渉。実 SDK/実マイク/実ネットは使用していない。

## 総合判定: **PASS（blocking ゼロ）**

追加 27 本は全て実装コード（`fire-scheduler.mjs` の `setVerbosity`/`VERBOSITY_BUNDLES`・`cockpit-server.mjs` の
`POST /api/verbosity`・`cockpit.mjs` の `createVerbosityHooks`・`cockpit-settings-store.mjs` の
`getVerbosityMode`/`setVerbosityMode`・`view-logic/control.mjs` のエラー文言関数・`ui/control-bar.mjs` の
`VerbositySelect`）を実際に駆動しており、getter を読むだけのトートロジーは無い。blocking 基準（§4-2:
呼びかけ/comment-call/turn 検出が口数の影響を受けないこと）はテストで固定されている。全体
706/706/0・ファイル別本数も Gnome Claim と完全一致。non-blocking の網羅性の抜けを 2 件指摘する（下記 §4）。

## 1. 自分で再実行した機械ゲート生数字

`cd apps/soul/agent && node --test`（全テスト・タイムアウト 300s・1 回で緑・空/interrupted なし・再試行不要）:

```
1..706
# tests 706
# pass 706
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 1608.4748
```

個別実行（いずれも 1 回で緑・Gnome Claim と全一致）:

| ファイル | 実行結果 | domain-a.md §4 Claim | 照合 |
|---|---|---|---|
| `src/mind/fire-scheduler.test.mjs` | **41/41**・fail 0 | 41（32+9） | 一致 |
| `src/cockpit/cockpit-server.test.mjs` | **79/79**・fail 0 | 79（74+5） | 一致 |
| `scripts/cockpit.test.mjs` | **36/36**・fail 0 | 36（30+6） | 一致 |
| `src/cockpit/cockpit-settings-store.test.mjs` | **28/28**・fail 0 | 28（24+4） | 一致 |
| `src/cockpit/view-logic/control.test.mjs` | **10/10**・fail 0 | 10（8+2） | 一致 |
| `src/cockpit/cockpit-ui.test.mjs` | **34/34**・fail 0 | 34（33+1） | 一致 |
| 合計追加 | **+27** | +27（9+5+6+4+2+1） | 一致 |

706 − 27 = 679 = Orch 確定ベースラインと整合。

## 2. テストケースごとの網羅照合

### 2-1. fire-scheduler.test.mjs（+9 本・:645-868）

実装（`fire-scheduler.mjs`）を読み、`setVerbosity`（:572-586）が `turnEndProbability`/`turnEndRefractoryMs`/
`silenceBaseMs`/`silenceJitterMs`/`silenceRefractoryMs`/`commentRefractoryMs`/`commentProbability` の 7 let
再代入＋`silenceBudget`/`commentBudget` の満額リセット＋`currentVerbosity` 更新を行うことを確認した上で、
9 本の対応を確認:

| # | テスト名（:行） | 固定している内容 | トートロジー判定 |
|---|---|---|---|
| 1 | 無退行: normal 束は既存 export 定数と完全同値（:645） | `VERBOSITY_BUNDLES.normal.*` が既存 `TURN_END_PROBABILITY` 等 9 定数と `assert.equal` で同値＋mode 未指定生成の `getVerbosity()==="normal"` | 値の二重管理が無いことの直接照合。トートロジーでない |
| 2 | 未知値/非文字列 → normal フォールバック（:669） | `"bogus"/123/null/undefined/""` の 5 種で `getVerbosity()==="normal"` | 実際に `createFireScheduler` へ渡して確認。良好 |
| 3 | **モード束の turn-end 確率が実際の発火判定に反映される**（:684） | `rng=0.5` 固定で quiet(0.15)/normal(0.35) は外れ（reqs.length=0）・chatty(0.70) は命中（reqs.length=1） | 発火可否という**挙動**で固定。ただし後述 §4-1 の抜けあり |
| 4 | 実行時切替で束が即座に切り替わる（:712） | `enabled` 中に `setVerbosity("chatty")` を呼び、同一 `rng=0.5` で normal→外れ・chatty→命中に変わることを確認 | 切替の即時性を挙動で固定。良好 |
| 5 | 予算を新モードの満額へリセット（:736） | silence 予算を 1 回消費（6→5）させてから `setVerbosity("chatty")` → `silenceBudgetRemaining()===12`（消費後の値ではなく満額）を確認 | 「満額リセット」の意図を正確に固定。ただし comment 側は未消費のまま確認（§4-2 参照） |
| 6 | getVerbosity: 既定/変更/未知 mode no-op（:760） | `setVerbosity("bogus")`/`null` が `currentVerbosity` も `silenceBudgetRemaining()` も変えないことを確認 | no-op が「表面の値」だけでなく「束」も変えないことまで固定。良好 |
| 7 | **blocking: comment-call は口数（quiet）の影響を受けない**（:781） | `verbosity:"quiet"`・`commentBudget:0`（明示上書き）・`rng: rngMiss`（確率外れ値）で 2 件連続 `comment-call` 発火・予算消費なし | §4-2 の核心。budget 切れでも確率が外れる値でも確実に発火することを実測。良好（詳細は §3） |
| 8 | **blocking: 呼びかけ（call）は口数（quiet）の影響を受けない**（:804） | `verbosity:"quiet"`・`rng: rngMiss` で 2 件連続 `call` 発火（不応期無視） | §4-2 の核心。良好（詳細は §3） |
| 9 | **blocking: turn 検出は口数モードに関わらず TURN_END_SILENCE_MS で不変**（:824） | quiet/normal/chatty の 3 モード全部で `TURN_END_SILENCE_MS-1`→未発火・`+1`→発火の境界を確認 | §4-2 の核心。3 モード全部を回している。良好（詳細は §3） |

### 2-2. cockpit-server.test.mjs（+5 本・:1958-2050、他に selfFire テストへの `verbosity:null` 確認 1 箇所 :1328）

`POST /api/verbosity` の実装（cockpit-server.mjs:898-923）を読み、5 本が実装の各分岐に対応することを確認:

1. scheduler 未生成（orchestrator 未注入）→ 503 + `error: /verbosity control not available/`（:1960）
2. 妥当 mode（chatty→quiet）で 200 + `state.verbosity` へ反映（`/api/state` で事前後を確認）（:1972）
3. 無効 mode（`bogus`/`123`/欠落の 3 パターン）→ 400 + `invalid verbosity mode`・state 不変を確認（:1995）
4. 起動時 `verbosityInitialMode:"chatty"` が `snapshot().verbosity` に反映（:2014）
5. `onSetVerbosity` 永続化フックへの橋渡し（chatty→quiet→無効 mode で呼ばれない）を確認（:2029）

全て `server.listen(0)` の実 HTTP loopback（node:http クライアント自作）で駆動しており、getter を読むだけの
トートロジーは無い。selfFire テストの `verbosity:null` 確認（:1328）も scheduler 未生成時の対称性を固定。

### 2-3. scripts/cockpit.test.mjs（+6 本・:453-508）

`createVerbosityHooks`（cockpit.mjs:326-344）を読み、6 本が対応することを確認:

1. 未記憶（null）→ 既定 "normal"
2. `defaultMode` 明示指定が効く
3. 記憶済み既知 3 モード（quiet/chatty）が `defaultMode` より優先
4. 記憶済み未知値 → `defaultMode` へフォールバック
5. `onSetVerbosity` → `settings.setVerbosityMode` へ橋渡し＋次回 `resolveInitialVerbosity()` に反映（round-trip を関数呼び出しで確認）
6. `settings.setVerbosityMode` が throw しても `onSetVerbosity` は握って続行（`assert.doesNotThrow`）

fake settings（`getVerbosityMode`/`setVerbosityMode` を持つ最小 fake）を注入し、実ファイル I/O には触れていない
純粋な橋渡しロジックの固定。良好。

### 2-4. cockpit-settings-store.test.mjs（+4 本・:426-498）

1. round-trip（set→get、別インスタンス再オープンでも読める、`null` 設定でクリア）: 実ファイル書き込み→
   `createFileSettingsStore` の新規インスタンスで読み直す構成で、メモリキャッシュへの依存を排除して確認
2. 他キー（device/channel/vision/audio/self-fire/chat）との同居: 複数キー設定後に個別に読めることを確認
3. corrupt JSON 耐性: 壊れた JSON ファイル・`{verbosityMode:123}`（非文字列値）の両方で `null` を返すことを確認
4. unwritable path: `setVerbosityMode` が例外を投げず、`getVerbosityMode` は `null` のまま

実ファイル I/O（一時ディレクトリ）を使った現実的な検証。良好。

### 2-5. control.test.mjs（+2 本・:107-116）

`verbosityPostErrorText`/`verbosityRequestErrorText`（view-logic/control.mjs:126-139）の fixture テスト。
503/400/500/200(null) の 4 分岐と catch 文言 1 本を固定。既存 `selfFirePostErrorText` 系と同型のテスト。良好。

### 2-6. cockpit-ui.test.mjs（+1 本・:505-529、他に settingsFromSnapshot の verbosity フィールド確認）

`VerbositySelect` の vnode テスト（:505）。`ui/control-bar.mjs:103-117` の実装を読み、以下を確認:

- `verbosity:"chatty"` → `select.props.value==="chatty"`（controlled・prop 駆動であることの直接固定）
- `verbosity:null`/未設定 → `"normal"` に畳む（server 側の未知値フォールバックと対称であることも実装コメントと一致）
- `onChange` prop が素通しされる（`select.props.onChange({target:{value:"chatty"}})` を呼び、呼び出し側へ
  そのまま渡ることを確認）
- 3 択（`VERBOSITY_OPTIONS`）が `option` として描画される

vnode 走査による構造固定であり、getter を読むだけではない。良好。

## 3. blocking（§4-2）固定の詳細検証

委任基準「呼びかけ（comment-call）・turn 検出が口数の影響を受けないこと」について、実装コードとテストを
突き合わせて以下を確認した。

- **comment-call**（fire-scheduler.mjs:526-531）: `textMatchesName(msg.text, commentNeedles)` が命中したら
  不応期・確率・予算チェックの**手前で** `return` する構造（コード上、`commentBudget`/`commentRefractoryMs`/
  `commentProbability` を一切参照しない分岐）。テスト（:781-802）は `commentBudget:0`（明示上書きで予算枯渇を
  強制）・`rng: rngMiss`（0.99・確率チェックがあれば必ず外れる値）を注入した上で、時間を進めずに 2 件連続で
  `handleChatMessage` を呼び、両方とも `comment-call` として発火し予算が消費されない（0 のまま）ことを確認して
  いる。「予算を使い切っても」「（時間を進めていない＝）不応期内でも」の両方を実測で固定できている。
- **call**（呼びかけ・:500-506）: 同様に不応期・確率を掛けない構造。テスト（:804-822）は `verbosity:"quiet"`・
  `rng: rngMiss` で 2 件連続 `call` 発火を確認。
- **turn 検出**（`turnEndSilenceMs`・:360, 471）: `createFireScheduler` の `turnEndSilenceMs` は
  `VERBOSITY_BUNDLES` を一切経由しない（`numberOr(options.turnEndSilenceMs, TURN_END_SILENCE_MS)` のみ）。
  テスト（:824-846）は quiet/normal/chatty の 3 モード全部で `TURN_END_SILENCE_MS-1` 未発火／`+1` 発火の境界を
  確認しており、モード非依存であることを実測で固定している。

以上、§4-2 の blocking 基準はテストで実行を伴って固定されている。**blocking 落ちなし**。

## 4. non-blocking（網羅性の指摘・修正不要または追加が望ましい観察）

1. **quiet と normal の turn-end 確率の相互区別が未検証**: :684 のテスト（`rng=0.5` 固定）は
   quiet(0.15)/normal(0.35) がどちらも「確率外れ」で `reqs.length===0` という同一結果になり、chatty(0.70) との
   区別はできているが、quiet と normal の**相互の**区別はこの 1 本では確認できない。:712 のテストで
   normal→chatty の切替差分は別途確認されているが、quiet 固有の値（0.15）が normal（0.35）と異なる発火率を
   生むことを直接示す境界値（例えば `rng=0.2`：quiet は外れ・normal は命中）のテストは無い。ただし
   `VERBOSITY_BUNDLES` はデータ定数として 3 値が明示されており（fire-scheduler.mjs:252-289）、値そのものの
   固定は別テスト（:645 の完全同値照合等）で担保されているため、実害は小さい。追加するなら
   `rng` を境界値にした quiet/normal 分離テストが望ましい。
2. **commentBudget の「消費後の値からのリセット」は未検証**: :736 のテストは `silenceBudget` を実際に 1 回
   消費（6→5）させてから `setVerbosity("chatty")` でリセットされることを確認しているが、`commentBudget` は
   未消費（初期値のまま）の状態から chatty 満額へ変わることしか確認していない。実装（fire-scheduler.mjs:
   582-583）は `silenceBudget`/`commentBudget` を同一パターンで単純代入しているため実装上のリスクは低いが、
   独立した検証としては「comment 応答を 1 回発火させて budget を減らしてから setVerbosity する」テストが
   あればより厳密になる。

いずれも wave 計画 §4 の blocking 基準（器コード不変・呼びかけ/turn 検出のモード非依存・POST 経路無退行・
3 チェック無退行）には抵触しない、テスト網羅性の観察に留まる。

## 5. テストの規律

- **fake clock**: `fire-scheduler.test.mjs` の `makeFakeClock()`（:32-61）は `Map` ベースの決定論的タイマ
  実装。実 `setTimeout`/`Date.now` は使用していない。
- **注入 RNG**: `rngHit`（:66・常に命中=0.0）/`rngMiss`（:67・常に外れ=0.99）を全テストで注入。`Math.random`
  への依存なし。
- **fake fetch/実 HTTP loopback**: `cockpit-server.test.mjs` は node:http クライアント自作（`httpRequest`/
  `getJson`/`postJson`、:26-54）で `server.listen(0)` へのみ到達。外部 URL・DNS 到達は無し。
- **fake settings**: `cockpit.test.mjs` の `makeFakeVerbositySettings`（:456-464）はメモリ内クロージャの
  fake で実ファイル I/O なし。`cockpit-settings-store.test.mjs` は実ファイル I/O だが一時ディレクトリのみ
  （実 SDK/実ネット到達なし）。
- **終了処理**: `fire-scheduler.test.mjs` の全ケースで `sch.dispose()` 呼び出しを確認（タイマ解放）。
  `cockpit-server.test.mjs` の全ケースで `try { … } finally { await server.close(); }` を確認。
- **タイムアウト**: `cockpit.test.mjs` の追加 6 本は `{ timeout: 5000 }` を明示。他ファイルはファイル単位で
  短時間完走（全体 706 本で 1.6 秒）しており、ハングの兆候なし。
- 実 SDK・実マイク・実 whisper-server・実 YouTube への到達はコード中に見当たらない（grep で `fetch(` の
  対象は全て `server.listen(0)` の loopback URL 経由、または `fetchImpl` 注入経由）。

## 6. Orch への申し送り

- 総合判定は **PASS**。blocking 落ちなし。
- non-blocking 2 件（§4）は修正必須ではないが、次回の余力があれば quiet/normal 境界分離テストと
  commentBudget 消費後リセットテストの追加を勧める。今回の wave 完了の妨げにはならない。
- Gnome の domain-a.md §3 質問 1〜3（`VerbositySelect` の新規コンポーネント抽出・`onChangeVerbosity` の
  直接テスト不可・comment 系の untested 扱い）はいずれも test レーンの観点からは正当な裁量判断／既存パターン
  の限界であり、追加の指摘事項はない。

## 7. §質問

なし（判断に迷う点は無かった）。
