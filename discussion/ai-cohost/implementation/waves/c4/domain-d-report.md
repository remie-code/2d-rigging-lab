# C4 Domain D 実装報告: 特区 apps/soul + 参照ドライバ + 持続駆動テスト + RTT計測 + 特区方向ルール検査

> Gnome(実装担当)→ Orch-Sylph。task=`cohost-c4-soul-zone-reference-driver`。
> 前提=Domain A(契約の家・サーバ・overlay store・採番)+ Domain B(overlay の heart 配線)+ Domain C(bridge・ページ・合成根のサーバ配線)完了。
> スコープ=特区 `apps/soul` の新設・依存ゼロ参照ドライバ・持続駆動の機械テスト・RTT p95 計測・特区方向ルール検査の2ルール新設と検証パイプライン組み込み。
> **Domain A/B/C の成果(`control-channel/` のサーバ・contract・store・検証、heart の overlay seam、bridge・ページ・degraded)は1バイトも再変更していない。** 参照ドライバは器のWSサーバへ外部プロセスとして繋ぐ WS クライアントであり、器コードを import しない(特区憲章§6.2)。

## 1. 作成/変更ファイル一覧

### 新規追加(Domain D 本体)

**特区 `apps/soul/`(package.json なし・依存ゼロ)**
- `apps/soul/README.md` — 特区の説明(憲章6条の要約・物理コスト回避=package.json を置かない旨・住人=参照ドライバ)。依存を持たない .md。
- `apps/soul/reference-driver/reference-driver.mjs` — 参照ドライバ本体。素の `.mjs`、依存ゼロ、Node 22 ネイティブ `WebSocket` クライアント。シナリオ駆動 + RTT p95 計測 + 契約 JSON 自己照合 + 未知イベント黙殺。

**持続駆動の機械テスト(器側 TS・vitest。ドライバを spawn)**
- `apps/runtime-player/src/main/control-channel/reference-driver-sustained-drive.test.ts` — Domain A の `RuntimePlayerControlChannelServer` を立て、Domain B の overlay 配線済み frame heart を実時計で回し、参照ドライバ(`apps/soul` の `.mjs`)を `child_process.spawn` で外部プロセスとして起動してシナリオを流す。縦の貫通・停滞なし・切断/再接続・RTT p95 を検証。

**特区方向ルール検査(`scripts/`)**
- `scripts/check-soul-zone-boundary.mjs` — 2ルールの検査。純関数 `findSoulZoneBoundaryViolations({ files })` を export(fixture 注入で単体検証可)+ CLI(`--root` で fixture を指せる standalone スキャナ、既存 `check:*` の流儀)。
- `scripts/check-soul-zone-boundary-fixtures.mjs` — fixture 回帰自己テスト(既存 `check-source-organization-fixtures.mjs` と同流儀)。valid=緑 / 2種の違反 fixture=赤 を固定。
- `scripts/soul-zone-boundary-fixtures/valid/**` — 緑 fixture(魂が契約 `.json` を import する例=許容 + 器が自身の兄弟のみ import)。
- `scripts/soul-zone-boundary-fixtures/invalid-vessel-imports-soul/**` — ルール1違反 fixture(器 → `apps/soul` を import)。
- `scripts/soul-zone-boundary-fixtures/invalid-soul-imports-vessel/**` — ルール2違反 fixture(`apps/soul` → 器コード `.ts` を import)。

### 変更した既存ファイル(1・shared・最小)
- `package.json`(root) — `check:soul-zone`(ガード)と `check:soul-zone:fixtures`(自己テスト)を追加し、`check:soul-zone` を composite `check` に連結。**diff は3行の追加のみ**(他は無変更、`git diff package.json` で確認)。現存の `check:deps`/`check:source` と同型(ガードを標準 `check` に統合し、fixture 回帰自己テストは分離)。

**Domain A/B/C ファイルは無変更**(`control-channel/` のサーバ本体・contract・store・validation・config/port、`autonomous-frame-heart.ts` の overlay seam、`input-subsystem.ts`、bridge・ページ・`runtime-player-main.ts`)。私の追加は上記の新規ファイル + package.json の3行のみ。

## 2. `apps/soul` に package.json/依存が無いこと・lockfile 無変更の証拠

- **`apps/soul` に package.json なし**: `ls apps/soul/package.json apps/soul/**/package.json` → 該当なし(裁定4。`apps/*` は workspace glob 内なので置けば `importers:` が増え install が要る)。
- **lockfile/workspace 無変更**: `git status --short pnpm-lock.yaml pnpm-workspace.yaml` → **空**。`git diff --stat pnpm-lock.yaml pnpm-workspace.yaml` → **空**(0行)。
- **`pnpm install` 未実行**・回避工作(手動 symlink・独自 resolver・tsconfig paths)なし。
- **新規依存なし**: `check:deps`(`node scripts/check-dependencies.mjs`)→ `Dependency guard passed.`。

## 3. 参照ドライバの起動コマンドと依存ゼロの確認

- **起動**: `node apps/soul/reference-driver/reference-driver.mjs "<ws-url>"`(裁定5。TS ではなく `.mjs`、tsx 等の依存を使わない)。素の Node で直実行。
- **依存ゼロの機構**: import は `node:fs` / `node:perf_hooks` / `node:url` / `node:path`(すべて Node 組込)と、グローバル `WebSocket`(Node 22 の undici 由来クライアント)のみ。npm 依存もトランスパイラも無い。器のWSサーバへ**繋ぐ側=WSクライアント**なので外部依存ゼロで書ける(サーバ実装は不要)。
- **標準実行の確認**:
  - 引数なし → usage を stderr に出し exit 2。
  - 接続不能URL → `reference-driver: Control Channel socket failed to open.` を stderr に出し exit 1(unref 廃止により停滞が沈黙終了せず記述的に surface する)。
- **シナリオ(設計§7)**: 注視(gaze-horizontal/vertical)→ 傾げ(head-tilt/head-horizontal)→ 沈黙(送信停止)→ 再開(gaze/head)→ 意図的切断(socket close)→ 再接続(新socket + head-tilt/eye-blink-left)。計8インテント。
- **TTL 両スタイル混在**: 明示 `ttlMs`(例 800/600/400/300/200)と省略(既定窓 = ストリーミング様式)を意図的に混ぜた(設計§4)。
- **hello 受信 → capabilities 確認**: server.hello の `supportedKinds` が契約の期待 kind(`intent.set`)を満たすか照合。満たさなければ失敗。
- **未知イベントの黙殺(寛容規則§3.5)**: 非JSON・未知kind・相関先の無い応答は無視して計数のみ(`unknownEventsIgnored`)。
- **意味スロット語彙・正規化域内の値**: `head-horizontal` 等の意味スロット語彙で、契約の正規化域内(centered -1..1 / weight 0..1)の値のみ送る(全て accepted される前提)。

## 4. 契約 JSON をどう参照したか(器コード import でないことの説明)

- ドライバは器側の契約 JSON `apps/runtime-player/src/main/control-channel/contract/channel-intent-set-payload-schema.json`(slotId enum)と `channel-exchange-examples.json`(server.hello 例)を **`readFileSync`** で読み(`import.meta.url` 相対で cwd 非依存)、①自分が送る slotId が契約語彙に収まっているか ②受け取った hello が契約の supportedKinds を満たすか を自己照合する。契約が読めない環境では組込の最小語彙にフォールバック(標準実行時は `contractSource: "contract-json"` を確認済み)。
- **これは「器コード import」ではなく「契約(fixture=JSON)の参照」**:
  1. `readFileSync` は **import 文ではない**ので、方向ルール検査(import 文の specifier のみを見る)の対象にすらならない。
  2. 仮に `.json` を import 文で読んだ場合でも、方向ルール検査のルール2は `.json`(契約=fixture)への特区外参照を**許容**する(器コード `.ts`/`.mjs` の import のみを違反とする)。憲章§6.2「魂が import してよいのは契約(型・fixture)だけ」と整合。
- valid fixture(`scripts/soul-zone-boundary-fixtures/valid/apps/soul/.../driver.mjs`)は、契約 `.json` を **import 文で**参照しても緑になることを実証している(魂→`.json` は許容の証拠)。

## 5. RTT 計測法と p95 実測値

- **計測法(裁定7)**: 各 `intent.set` について `performance.now()` で送信時刻を記録し、`replyTo` で相関した accepted/rejected 応答の受信時刻との差を RTT サンプルとする(全8インテント、2接続にまたがる)。
- **p95 算出**: nearest-rank(ソート後 `index = min(ceil(0.95·n), n) − 1`)。p50/p95/max/mean を標準出力の JSON レポート(`{"kind":"reference-driver-report", ..., "rttMs":{...}, "gate":{"p95BudgetMs":100,"p95WithinBudget":bool}}`)と stderr の人間向けサマリに出す。
- **ゲート閾値**: p95 < 100ms(loopback、緩め)。判定自体は持続駆動テスト(器側 vitest)が行う(`expect(report.rttMs.p95).toBeLessThan(100)` と `gate.p95WithinBudget === true`)。
- **実測(3連続ラン、loopback・同一マシン)**: p95 ≈ **1.5〜2.0ms**、p50 ≈ 0.5〜0.6ms、max ≈ p95(n=8 なので上位一致)。**100ms 予算に対し2桁の余裕**。`contractSource` は毎回 `contract-json`。

## 6. 持続駆動テストの実時間圧縮の設計(flaky 対策)

- **実時間圧縮**: 設計§1の「数分駆動」の性格(フレーム停滞なし・切断/再接続)を、ドライバの位相定数で**約1秒に畳んで**再現(沈黙200ms・インテント間30ms・再接続ギャップ60ms)。テスト全体は ~0.9秒で完了。wave plan §6「実時間は圧縮したシナリオでよい」に従う。環境変数 `SOUL_DRIVER_PHASE_SCALE` で更に伸縮可能(現状は既定=1のまま緑)。
- **ポート競合回避**: サーバは `port: 0`(ephemeral)。
- **停滞の非沈黙化**: ドライバの `withTimeout` は active タイマ(unref しない)で、応答/hello 不着はイベントループ枯渇による沈黙終了(exit 13)ではなく**記述的な reject**として surface する(実装中に unref 版で沈黙 exit 13 を踏み、active タイマ + `clearTimeout` に修正した経緯を反映)。
- **緩い閾値**: RTT p95 < 100ms(実測2桁余裕)・フレーム前進 > 20(実測 ~50前後)・overlay 上書き witness ≥ 5(実測 15)。
- **安定性確認**: 単独ラン4回連続 PASS(フレークなし)。CI 環境で flaky になった場合は escalate 条件だが、本ラン群では観測されず。
- **検証内容(wave plan §6・§8)**:
  - **フレーム停滞なし**: heart の sequence が baseline から healthy に前進(> 20)し、厳密単調増加(publish が overlay 反映で止まらない)。
  - **切断/再接続成立**: ドライバ report `reconnected === true`、8インテント全 accepted(再接続後の2インテント含む)、サーバは接続維持・再接続受理。
  - **RTT p95 < 100ms**: ドライバ計測値(§5)。
  - **`intent.set` で overlay が動く(縦の貫通)**: 生成器 baseline が `head-horizontal = 0`(witness param `ParamAngleX` は baseline 0)の下で、外部プロセス→WS→token→契約検証→overlay→heart を通って `head-horizontal = 0.5` が centered 写像で `ParamAngleX ≈ 15` に反映されるフレームを観測(fixture の face.angle.x 相当が動く縦貫通の実証)。切断後は baseline 0 へ復帰(切断→全失効→基底復帰)。

## 7. 方向ルール検査の2ルール・検証パイプライン組み込み・違反fixtureで赤くなることの実証・現状で緑

- **2ルールのみ(裁定6・憲章§6訂正。汎用DAG検証は作らない)**:
  1. **器 → 魂の禁止(§6.3)**: 特区外のコードが `apps/soul` を import したら違反。
  2. **魂 → 器コードの禁止(§6.2)**: 特区内のコードが器のコード(`.ts`/`.mjs` 等)を import したら違反。ただし `.json`(契約=fixture)への参照は許容。
- **検出機構**: import 文の specifier(static import / export-from / side-effect import / dynamic import / require)のみを見る。相対 import を POSIX で解決し、魂↔器の境界越えを判定。node builtin / bare npm / alias は path 解決できないので対象外(2ルールは魂↔器の path 越え依存に限る)。純関数 `findSoulZoneBoundaryViolations({ files })` に切り出し、fixture 注入で単体検証可能。
- **検証パイプライン組み込み**: root `package.json` の composite `check` に `check:soul-zone` を `check:deps`/`check:source` と並べて連結(CI が回る形)。`check:soul-zone:fixtures`(自己テスト)は現存の `check:deps`/`check:source` の自己テスト(`check-dependencies-guard-self-test.mjs`・`check-source-organization-fixtures.mjs`)と同型に、標準 `check` からは分離。
- **違反fixtureで赤くなることの実証(wave plan §8・§10 blocking観点)**: `check-soul-zone-boundary-fixtures.mjs` が3 fixture をガードに食わせ、**valid=exit 0(緑)・ルール1違反=exit 1(赤・「器のコードが特区 apps/soul を import」)・ルール2違反=exit 1(赤・「特区 apps/soul が器のコードを import」)** を固定。→ `Soul zone boundary fixture regressions passed: 3 cases.`。
- **現状で緑(実際の違反ゼロ)**: `node scripts/check-soul-zone-boundary.mjs` を実リポジトリに対し実行 → `Soul zone boundary guard passed: 1243 source files scanned; no 器→魂 imports and no 魂→器 code imports.`(参照ドライバは器コードを import していない = ルール2緑、器は魂を import していない = ルール1緑)。

## 8. テスト結果(実行コマンド・パス/全体件数・既知baselineとの区別)

- **持続駆動テスト(focused)**: `pnpm -C apps/runtime-player exec vitest run -c vitest.config.ts src/main/control-channel/reference-driver-sustained-drive.test.ts`
  → **1 file / 1 test PASS**(単独4回連続 PASS、フレークなし)。
- **control-channel 全体(focused)**: `pnpm -C apps/runtime-player exec vitest run -c vitest.config.ts src/main/control-channel`
  → **11 files / 55 tests 全 PASS**(Domain A/B/C の control-channel 既存テスト無退行 + 本 Domain の持続駆動テスト)。
- **runtime-player 全体**: `pnpm -C apps/runtime-player exec vitest run -c vitest.config.ts`
  → **821 passed / 2 failed(136 files: 134 passed / 2 failed)**。
  - **2件は既知 baseline(Wave21 browser-source系、`effectiveDynamicsTuning` フィールド不一致)**: `src/main/broadcast-source/browser-source-server.test.ts > serves current Runtime Export payload…` と `src/stage/browser-source/browser-source-server-message.test.ts > accepts the not-loaded response shape`。**Domain A/B/C 報告と同一の2件**で、私は browser-source を1バイトも触っていない(因果的に無関係)。
- **typecheck**: `pnpm -C apps/runtime-player run typecheck`(tsc --noEmit)→ **PASS**。root `pnpm run typecheck:root`(tsc --noEmit)→ **PASS**。
- **check:deps**: `node scripts/check-dependencies.mjs` → **passed**(新規依存なし)。
- **check:source**: `node scripts/check-source-organization.mjs` → 唯一の違反は `apps/runtime-player/src/main/physiology/index.ts`(**C3 既存 committed、私は未接触**。Domain A/B/C 報告と同一 baseline)。私の追加/変更ファイルは違反ゼロ。
- **check:soul-zone**: `node scripts/check-soul-zone-boundary.mjs` → **passed(緑)**。
- **check:soul-zone:fixtures**: `node scripts/check-soul-zone-boundary-fixtures.mjs` → **passed(3 cases: valid緑・違反2件赤)**。
- **lockfile/workspace**: 無変更(§2)。`pnpm install` 未実行。

## 9. 裁量判断(設計未定義を合理的に埋めた箇所)

1. **契約 JSON の参照 = `readFileSync`(import 文ではない)+ 方向検査は import 文のみ精査 + `.json` 参照はルール2で明示許容**(§4)。「契約 JSON の参照を器コード import と区別して許容する」設計要件を、二重(readFileSync=非import / .json=許容)に満たした。読めない環境ではフォールバック語彙(fixture=正を primary、robustness を secondary)。
2. **方向検査は2ルールのみ・import 文の specifier ベース**(§7)。汎用DAG検証・循環検出・bare npm 制約は作らない(裁定6)。魂↔器の path 越え依存に限定。ドライバの `spawn(node, [driverPath, url])` の path 文字列は import specifier ではないので誤検知しない(実リポジトリ緑で確認)。
3. **持続駆動テストの witness = `head-horizontal`(centered)+ 生成器 baseline を 0 に固定**(§6)。baseline が正確に 0 なので、published frame の非0値は overlay 経由の外部駆動だと一意に帰属できる(縦の貫通の明確な証拠)。実生成器を使うと baseline がゆらぎ帰属が曖昧になるため、決定論スタブ生成器を注入(heart の `createGenerator` seam。physiology/ は無変更)。
4. **RTT ゲート判定は器側 vitest に置く**(§5)。ドライバは p95 を計測・出力し、閾値判定(機械ゲート)は持続駆動テストが持つ(裁定5「TSの参照クライアント=器側の機械テストハーネス」に整合)。ドライバ自身は想定外拒否(全値域内なので通常ゼロ)があれば exit 1。
5. **`withTimeout` を active タイマ化(unref しない)+ `clearTimeout`**(§6)。停滞を沈黙 exit 13 でなく記述的 reject にするため。実装中に unref 版で沈黙終了を踏んで修正。
6. **`check:soul-zone:fixtures` は標準 `check` に含めない**(§7)。現存の `check:deps`/`check:source` と同型(ガードは標準 check・自己テストは分離)。ガード本体 `check:soul-zone` は composite `check` に統合済み(= 検証パイプラインへの組み込み)。
7. **実時間圧縮の位相定数はドライバ内に置き、`SOUL_DRIVER_PHASE_SCALE` で伸縮可能に**(§6)。CI flaky 時の調整余地を残しつつ既定=1で緑。

## 10. 質問 / 引き継ぎ(Orch/後続判断が要る点)

blocking な質問はなし(全機械ゲート緑、無退行、無変更制約遵守、lockfile 無変更)。以下は方向確認したい任意点:

1. **持続駆動テストの配置**: 器側 vitest の要件(裁定5・`pnpm install` 禁止)に従い `apps/runtime-player/src/main/control-channel/` に置いた(既存 runtime-player vitest が拾う)。repo-level の性格もあるが、既存依存で回すためこの配置とした。
2. **方向ルール検査の「テスト」形態**: 既存 `check:*` の流儀(fixture 回帰自己テスト `.mjs` + 純関数 export)を採用した。vitest ネイティブの単体テストは、repo-level スクリプトを runtime-player src に持ち込む形になり層が濁るため見送り(純関数は export 済みで、必要なら follow-up で vitest 化可能)。
3. **契約 JSON の物理配置(Domain A 引き継ぎ#4)**: 現状 `apps/runtime-player/src/main/control-channel/contract/` を `readFileSync` で参照。`packages/contracts` 等への昇格は実物の魂の日に検討(裁定8で繰延)で問題なし。ドライバは `import.meta.url` 相対参照 + フォールバックで、昇格時も追随が容易。

## ループ2追記(多行 import 検出漏れ修正 — Lane2 blocking)

3レーンレビューで Lane2(design)が blocking を1点指摘(方向ルール検査の実効性=C4 核心ゲート)。方向検査スクリプトに閉じて修正した。**Domain A/B/C ファイルは無変更、修正は `scripts/` 配下 + fixture のみ、package.json 無変更。**

### (a) 正規表現の是正内容(先行スクリプトとの対照)

- **問題**: `check-soul-zone-boundary.mjs` の pattern1 `/\b(?:import|export)\b[^;\n]*?\bfrom\s*["']…["']/g` の `[^;\n]*?` が**改行を除外**するため、prettier で折り返された**多行 named import**(`import {\n  foo,\n  bar\n} from "…"`)をルール1・ルール2の双方で取りこぼしていた。器側は TS+prettier で多行 import が常態なので現実的な回避経路であり、先行 `scripts/check-psd-parser-import-boundary.mjs`(`[^'"]` = 改行込みで多行捕捉)より退化していた。
- **是正**: pattern1 を先行スクリプトの流儀に揃え `[^;\n]*?` → **`[^'"]*?`**(引用符のみ除外＝specifier 境界で確実に停止、改行は跨ぐ)へ変更。他の specifier 種別(side-effect `import "x"` / dynamic `import("x")` / require `require("x")`)は既に `\s*`(改行込み)で多行対応済みのため無変更。**過剰一般化はしていない**(2ルールのスコープ維持、汎用DAG検証にしない)。
- **旧新の直接対照**(多行 fixture テキストに両正規表現を適用):
  - OLD(`[^;\n]*?`): captures `[]`(**取りこぼし**)。
  - NEW(`[^'"]*?`): captures `["../../../soul/reference-driver/driver.mjs"]`(**捕捉**)。

### (b) 追加した多行違反 fixture とそれが赤になる実証

多行 import **のみ**を含む独立 fixture root を2つ追加(既存の単一行 fixture・valid fixture は維持)。多行専用なので、多行検出が壊れると exit 0 に転び自己テストが即失敗する=回帰の固定点になる。
- `scripts/soul-zone-boundary-fixtures/invalid-vessel-imports-soul-multiline/apps/runtime-player/src/main/leak.ts` — 多行 named import で器→`apps/soul`。直接実行 → **exit 1**・`apps/runtime-player/src/main/leak.ts:1: 器のコードが特区 apps/soul を import しています（"../../../soul/reference-driver/driver.mjs" → apps/soul/reference-driver/driver.mjs）`。
- `scripts/soul-zone-boundary-fixtures/invalid-soul-imports-vessel-multiline/apps/soul/reference-driver/leak.mjs` — 多行 named import で魂→器コード(`channel-server.ts`)。直接実行 → **exit 1**・`apps/soul/reference-driver/leak.mjs:1: 特区 apps/soul が器のコードを import しています（"../../runtime-player/src/main/control-channel/channel-server.ts" → apps/runtime-player/src/main/control-channel/channel-server.ts）`。
- `check-soul-zone-boundary-fixtures.mjs` に2ケース追加(計 **5 cases**: valid緑 + 単一行違反2件赤 + 多行違反2件赤)。

### (c) 実リポジトリ緑・valid 緑の再確認(誤検知が増えていないこと)

- **実リポジトリ緑**: `node scripts/check-soul-zone-boundary.mjs` → `Soul zone boundary guard passed: 1243 source files scanned; no 器→魂 imports and no 魂→器 code imports.`(実在違反ゼロ。多行対応後も誤検知ゼロ)。
- **valid 緑維持**: fixtures 自己テストの `valid`(魂→`.json` 許容 import を含む)は exit 0 のまま。
- **誤検知しないことの機構**: NEW でも捕捉するのは実際に存在する `from "…"` specifier のみ。cross-boundary import を持たないファイルは capture 自体が生じないので新規誤検知は原理的に増えない。`spawn(process.execPath, [DRIVER_PATH, url])` の path 文字列・`path.resolve(..., "../../../../soul/…")` は `from` を伴わないため pattern1 に非マッチ(`import.meta.url` の `import` 語も直後に `from "…"` が無いので非マッチ)。実リポジトリ緑がこれを裏づける。

### (d) `check:soul-zone:fixtures` の結果

- `node scripts/check-soul-zone-boundary-fixtures.mjs` → **`Soul zone boundary fixture regressions passed: 5 cases.`**(exit 0)。
- `node scripts/check-soul-zone-boundary.mjs`(実リポジトリ) → **passed(緑、1243 files)**。
- typecheck(runtime-player + root)・持続駆動テスト(単独 PASS)は本修正の影響外(方向検査スクリプトのみの変更)。lockfile 無変更・`pnpm install` 未実行を再確認。
