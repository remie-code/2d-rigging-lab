# C4 Domain D レビュー（Lane3: test adequacy）— 特区 apps/soul + 参照ドライバ + 持続駆動テスト + 方向ルール検査

> Review-Sylph（Lane3=test adequacy）→ Orch-Sylph。読み取り専任。他2レーンとは独立評価。
> 判定基準: c4-wave-plan.md §6(Domain D)/§8 AC/§10 blocking、c4-control-channel-v0.md §1。
> 検証は Gnome 報告の記述検証ではなく、**自分でテストコードを読み・テストを4回実行し・検査を直接走らせて**確認した。

## 判定: 合格

全テスト要件が実アサーションで充足。blocking な不足なし。持続駆動テストは4回連続 PASS で flaky 兆候なし。方向ルール検査は違反fixtureで実際に赤くなることを直接確認。lockfile 無変更・apps/soul に package.json なしを機械確認。

---

## 各テスト要件の充足（自分で確認したもの）

### 1. ドライバ単体（シナリオ進行・再接続）— 充足（統合テストに内包）
独立した driver 単体テストは無く、`reference-driver-sustained-drive.test.ts`（spawn 統合）に内包される。そこで観測が固定されている:
- `report.intentCount === 8`（gaze2 + tilt2 + resume2 + reconnect2 = 全フェーズ通過）
- `report.acceptedCount === 8` / `report.rejectedCount === 0`（全 accepted）
- `report.reconnected === true`（切断後の新socketで reconnectPhase 2件が accepted されて初めて true になる = 再接続成立が固定）
- `report.contractSource === "contract-json"`（フォールバックでなく実契約 JSON を読んだことを固定 → 偽陰性防止）

ドライバは任意の拒否・応答不着・hello不着で throw→exit 1 するので、8件全 accepted かつ reconnected の固定は各フェーズ進行と再接続成立を実効的に担保する。
- non-blocking: 個々のフェーズの「順序」自体は直接assertしていない（集約値で担保）。また usage(exit2)・接続不能(exit1) のエラー経路は自動テスト化されていない（report §3 は手動確認）。wave plan §6 は要求していないので non-blocking。

### 2. 持続駆動統合（blocking）— 充足
`reference-driver-sustained-drive.test.ts` の実アサーションを確認:
- **フレーム停滞なし**: `finalSequence - baselineSequence > 20`（~929ms/16ms で実測~58前進）**かつ全frameの厳密単調増加ループ**。単調増加チェックが停滞/退行を捕捉する。強い。
- **RTT p95<100ms**: `report.rttMs.count === 8` かつ `report.rttMs.p95 < 100` かつ `report.gate.p95WithinBudget === true`。計測値そのものを assert。
- **縦の貫通**: baseline を connect 前に `parameterValues[ParamAngleX] === 0` で固定 → 決定論スタブ生成器（head-horizontal=0 固定）注入により baseline が厳密0 → `head-horizontal=0.5`（ttl600）が centered 写像で +15 に写る → `ParamAngleX >= 5` の frame が1つ以上存在することを assert。**非0の帰属が一意**で偽陰性しにくい。witness の ParamAngleX は AC §8「face.angle.x が動く」に対応。
- **切断→基底復帰**: driver close + delay(120) 後に `parameterValues[ParamAngleX] === 0` を assert。

### 3. 方向ルール検査の実効（blocking）— 充足（直接実証）
自分で直接実行して確認:
- `node scripts/check-soul-zone-boundary-fixtures.mjs` → `passed: 3 cases`（exit 0）
- fixture 個別直撃:
  - `--root .../invalid-vessel-imports-soul` → **exit 1**、メッセージ「器のコードが特区 apps/soul を import」（ルール1）
  - `--root .../invalid-soul-imports-vessel` → **exit 1**、メッセージ「特区 apps/soul が器のコードを import」（ルール2、`.ts` 参照）
  - `--root .../valid` → **exit 0**
- fixtures 回帰テストは `combinedOutput.includes(expectedOutput)` で**ルール毎の固有メッセージ**まで照合しており、「どの exit 1 でもよい」ではなく正しい違反種別を固定している。2種の違反（器→魂・魂→器コード）が両方テスト済み。
- valid fixture は `.json` 契約を **import 文で**参照しても緑になることを実証（ルール2の .json 許容パスを踏む）。憲章§6.2 と整合。
- **現状で緑（実違反ゼロ）**: `node scripts/check-soul-zone-boundary.mjs` → `passed: 1243 source files scanned; no 器→魂 imports and no 魂→器 code imports.`

### 4. apps/soul に package.json/依存なし・lockfile無変更（blocking）— 充足（機械確認）
自分で確認:
- `find apps/soul -name package.json` → 該当なし。
- `git diff pnpm-lock.yaml pnpm-workspace.yaml` → **空（0行）**。`git status --short` も空。
- wave plan Subagent Contract 「lockfile無変更は機械確認対象」を満たす。

### 5. 偽陰性・決定論性・flaky（blocking・最重要）— 充足
**自分で4回連続実行**: 全 PASS、実行時間 929/941/915/919ms（分散小）。flaky 兆候なし。

flaky 抑制の実装を確認（有効と評価）:
- 実時間圧縮（沈黙200ms・intent間30ms・再接続gap60ms → 全体~0.9秒）。`SOUL_DRIVER_PHASE_SCALE` で CI 調整余地あり。
- `port: 0`（ephemeral）でポート競合回避。
- `withTimeout` は **active タイマ**（unref しない）+ `clearTimeout` → 応答/hello 不着がイベントループ枯渇の沈黙 exit ではなく**記述的 reject** として surface（report §6 の unref→active 修正経緯と整合、コードで確認済み）。REPLY/HELLO timeout=4000ms、test timeout=30s と余裕大。
- 決定論スタブ生成器注入で baseline を厳密0に固定 → witness の帰属が一意、生成器ゆらぎ由来の偽陽性/偽陰性を排除。

偽陰性の非存在を確認:
- テストは空緑ではない。`ParamAngleX>=5` の witness、RTT count=8、reconnected=true、contractSource=contract-json、単調増加ループ、いずれも駆動が実際に通らないと落ちる実効アサーション。

---

## テスト結果（すべて自分で実行）
- 持続駆動テスト（focused）: `pnpm -C apps/runtime-player exec vitest run -c vitest.config.ts src/main/control-channel/reference-driver-sustained-drive.test.ts` → **1 file / 1 test PASS ×4連続**（929/941/915/919ms）。
- control-channel suite: `... src/main/control-channel` → **11 files / 55 tests 全 PASS**（Domain A/B/C 無退行 + Domain D）。
- 方向ルール検査: fixtures `passed: 3 cases`、real repo `passed: 1243 files`、fixture個別で違反赤・valid緑を直接確認。
- lockfile/workspace: `git diff` 空。apps/soul に package.json なし。
- 既知baseline: `browser-source-server.test.ts` / `browser-source-server-message.test.ts` の**2件 fail** を自分で再現。原因は `effectiveDynamicsTuning` フィールド不一致（Wave21 browser-source系）。Domain D は broadcast-source/browser-source を1バイトも触っておらず、control-channel/soul/scripts と別サブシステム。**Domain D と因果的に無関係**と確認。

---

## 不足

### blocking
なし。

### non-blocking（任意・将来）
1. driver のエラー経路（usage exit2 / 接続不能 exit1）は自動テスト化されていない（手動確認のみ）。wave plan は未要求。
2. 「apps/soul に package.json を置かない」不変条件は**時点確認**であり、将来 package.json が追加された場合を継続的にガードする自動検査は無い（方向ルール検査は import 依存の向きのみで package.json 存在は見ない）。wave plan は機械「確認」を求め継続ガードは求めていないため non-blocking。
3. 方向ルール検査は **import 文の specifier（相対 path）ベース**。node builtin/bare npm/alias、および readFileSync 等の非import I/O は対象外（裁定6の2ルール限定という設計意図に沿う）。よって「相対 import 以外の経路での魂→器コード漏れ」は検出しない。これは設計スコープ内の意図的限定で、参照ドライバは .json を readFileSync するのみなので現状問題なし。

---

## flaky 安定性の評価（自分で複数回実行した結論）
**低リスク。** spawn + 実タイマ + loopback WS を伴うが、(a) 実時間圧縮 (b) ephemeral port (c) active タイマによる停滞の非沈黙化 (d) 決定論スタブ生成器、が揃い、閾値は2桁の余裕（p95予算100msに対し実測~1.5–2ms、frame前進>20に対し~58）。自分の4回連続ランは全 PASS・分散小。CI が大幅に遅い場合の逃げ道（`SOUL_DRIVER_PHASE_SCALE`）も用意されている。escalate 条件（CIでflaky）は本ラン群では未観測。

## 質問
なし。判定に必要な事項は全て自分で実行・確認できた。
