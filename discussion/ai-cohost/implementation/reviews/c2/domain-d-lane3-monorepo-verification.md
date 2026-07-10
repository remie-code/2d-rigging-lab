# C2 wave 最終 clean review — レーン③ 独立モノレポ検証

> レビュー担当: Review-Sylph(opus)。委任元: Orch-Sylph。日付: 2026-07-11。ブランチ: feature/2d-rigging-eco-system。
> レーン: 独立モノレポ検証(最終状態のビルド健全性・退行なし・無変更フットプリントの独立確認)。source 不修正・テスト実行のみ。
> 検証対象報告: `discussion/ai-cohost/implementation/waves/c2/domain-d-final-integration.md`(報告値を独立に再現/反証)。

---

## 判定

**合格(PASS)** — blocking ゼロ。

Domain D の報告値(runtime-player 606 pass / 2 fail、ルート typecheck exit 0、packages 240 files / 1492 pass、無変更フットプリント、pnpm install 不実施)を**独立にすべて再現**した。食い違いなし。既知 baseline fail 2 件のみが fail で、それ以外全 pass。フットプリントは要求スコープ内に収まり、保護対象(Editor / packages / schema / lockfile / workspace / package.json dependencies)は無変更。

---

## 1. 自分で実行した全コマンドと結果

### 1.1 runtime-player app(`apps/runtime-player`)

| 検証 | コマンド | 結果 |
|---|---|---|
| typecheck | `npx tsc --noEmit -p tsconfig.json` | **exit 0(エラーゼロ)** |
| アプリ回帰 run 1 | `npx vitest run -c vitest.config.ts` | **606 pass / 2 fail(608 中)**, exit 1 |
| アプリ回帰 run 2 | 同上 | **606 pass / 2 fail** |
| アプリ回帰 run 3 | 同上 | **606 pass / 2 fail** |
| C2 固有テスト | `npx vitest run … src/main/{live-mapping,physiology,role-composition}` | **117 pass / 0 fail(12 files)**, exit 0 |

- **3 連続ランすべて 606 pass / 2 fail で完全一致。フレークなし。** テスト件数・失敗内容ともにラン間で一致。
- exit 1 は既知 baseline fail 2 件に起因(下記 §2)。C2 の作業範囲外。

#### C2 固有テストの内訳(全 pass、決定論再現)

3 ドメインのディレクトリを明示ターゲットで実行し、全 12 files / 117 tests が安定 pass:

- `live-mapping/headless-slot-resolver.test.ts`(11) — 頭無しリゾルバ
- `live-mapping/runtime-parameter-frame-equivalence.test.ts`(20) — **等価性 golden**(退行ゼロ固定)
- `live-mapping/runtime-parameter-frame.test.ts`(19)、`runtime-export-auto-mapping.test.ts`(3)、`vowel-lipsync-estimator.test.ts`(10)、`live-mapping-state.test.ts`(6)
- `physiology/blink-behavior-fixture.test.ts`(4)、`blink-behavior.test.ts`(15)、`physiology-generator.test.ts`(8) — **physiology fixture / generator**
- `role-composition/autonomous-frame-heart.test.ts`(11) — **フレーム心臓**、`input-subsystem.test.ts`(7) — **合成**、`role-selection-stub.test.ts`(3)

等価性 golden・physiology fixture・心臓テストは複数ラン(フルラン 3 回 + 固有ラン 1 回)を通じて安定 pass。**決定論は実効。**

### 1.2 ルート(monorepo 整合)

| 検証 | コマンド | 結果 |
|---|---|---|
| ルート typecheck | `pnpm run typecheck`(= `tsc --noEmit` 全体) | **exit 0** |
| packages 回帰 | `pnpm run test:unit`(= `vitest run packages …`) | **240 files / 1492 tests 全 pass、exit 0** |

- ルート typecheck 通過 = runtime-player の型も含め monorepo 全体が整合。
- packages 回帰は本 wave 非対象だが実行し、**packages 側に退行ゼロ**を独立確認(完走)。

---

## 2. 既知 baseline fail の独立確認(2 件)

3 ラン全てで同一の 2 件のみが fail。両者とも Wave21 Dynamics Tune 由来の `effectiveDynamicsTuning: null` フィクスチャドリフト(期待 4 key に対し受信 5 key、diff は `+ "effectiveDynamicsTuning": null,` のみ):

1. `src/main/broadcast-source/browser-source-server.test.ts` > "Runtime Player Browser Source server > serves current Runtime Export payload to authorized Browser Source clients"
2. `src/stage/browser-source/browser-source-server-message.test.ts` > "readBrowserSourceRuntimeExportResponse > accepts the not-loaded response shape"

- 出力 diff を実機で確認済み(両者とも `+ "effectiveDynamicsTuning": null,` の 1 key ドリフトのみ)。
- **C2 wave の変更範囲(live-mapping / physiology / role-composition)とは無関係・不接触。** タスクが指定した既知 baseline 2 件に一致。fail はこの 2 件を超えていない → **非 blocking**。

---

## 3. 無変更フットプリントの独立確認

### 3.1 tracked 変更(`git status --porcelain` / `git diff --stat`)

- source 3 件(A/C 成果、Domain D 不接触): `live-mapping/runtime-parameter-frame.ts`、`role-composition/input-subsystem.ts`、`role-composition/input-subsystem.test.ts`
- docs 7 件: `discussion/ai-cohost/` 配下の map/architecture/wave-plan(§3 で列挙のとおり)
- diff stat 合計: 10 files, +311 / −275。

### 3.2 untracked(新規)— 全てスコープ内

`git status --porcelain --untracked-files=all` の untracked を `apps/runtime-player/src/main/(live-mapping|physiology|role-composition)/` および `discussion/ai-cohost/` で除外フィルタ → **残りゼロ(ALL IN SCOPE)**。新規 source(headless-slot-resolver、physiology/ 一式、autonomous-frame-heart、各 golden/test)と reviews/c2・waves/c2 の docs のみ。スコープ外の untracked は存在しない。

### 3.3 保護対象の無変更(独立確認)

`git diff --name-only -- pnpm-lock.yaml pnpm-workspace.yaml '**/package.json' 'apps/editor/**' 'packages/**'` → **出力ゼロ(全て無変更)**。個別に:

- **Editor(`apps/editor/`)**: 無変更。
- **packages 全域(`packages/**`)**: 無変更(package-format / Runtime Export schema 含む)。
- **lockfile(`pnpm-lock.yaml`)・`pnpm-workspace.yaml`**: 無変更。
- **`apps/runtime-player/package.json`(dependencies / devDependencies)**: 無変更(name-only diff にエントリなし)。

### 3.4 `pnpm install` 痕跡なし

- 検証開始時・全テスト実行後の両方で `git status --porcelain -- pnpm-lock.yaml pnpm-workspace.yaml apps/runtime-player/package.json` が**出力ゼロ**。lockfile は一連の検証を通じて無変更 → **pnpm install 副作用なし**。
- **当方(Review-Sylph)も `pnpm install` を実行していない。** 既存 node_modules のツール(tsc / vitest)のみ使用。

---

## 4. Domain D 報告値との一致/相違

| 項目 | Domain D 報告 | 当方独立再現 | 一致 |
|---|---|---|---|
| runtime-player typecheck | exit 0 | exit 0 | ✅ |
| runtime-player vitest | 606 pass / 2 fail(3 ラン一致) | 606 pass / 2 fail(3 ラン一致) | ✅ |
| 既知 baseline fail | 上記 2 件のみ | 同一 2 件のみ、diff 内容一致 | ✅ |
| ルート typecheck | exit 0 | exit 0 | ✅ |
| packages test:unit | 240 files / 1492 pass, exit 0 | 240 files / 1492 pass, exit 0 | ✅ |
| lockfile/workspace/package.json | 無変更 | 無変更 | ✅ |
| Editor/packages/schema | 無変更 | 無変更 | ✅ |
| untracked スコープ | ALL IN SCOPE | ALL IN SCOPE | ✅ |
| pnpm install | 不実施 | 不実施(lockfile 無変更で確認) | ✅ |

**重大な食い違い: なし。** Domain D の全報告値を独立に再現。

---

## 5. blocking 差分

**なし。** blocking 条件(fail が baseline 2 件超過 / typecheck 不通過 / フットプリントがスコープ超過 / pnpm install 痕跡 / テスト不安定 fail / Domain D 報告値と重大な食い違い)は**いずれも該当せず**。

---

## 6. 裁量注記(非 blocking)

- **CRLF 警告**: `git diff` 実行時に `LF will be replaced by CRLF` 警告が複数出るが、これは Windows チェックアウトの line-ending 正規化に伴う無害な警告で、内容変更ではない(diff の実体は §3 のとおり)。判定に影響なし。
- **exit 1 の解釈**: runtime-player フルラン vitest は既知 baseline 2 件により exit 1 を返す。これは C2 の失敗ではなく既存 baseline の反映であり、C2 固有テスト単独ランは exit 0。CI 上では baseline fail 2 件のハンドリング(既知 skip / xfail 化)が将来望ましいが、C2 wave の作業範囲外・非 blocking。
- Domain D 報告 §5 の Q1(自律ホスト degraded ページでの Browser Source URL コピー UI surface)・Q2(送信タイムスタンプ決定論化)は、いずれも本レーン(モノレポ検証)の範囲外の運用/設計論点。当該レーンとしては合否に影響しないため転記のみ。

---

## 7. 質問(呼び出し元 Orch-Sylph へ)

- **なし(本レーンとして)。** 独立モノレポ検証の全観点が green で、判断に迷う点はなかった。他 2 レーン(AC/contract、docs/integration)の判定と統合のうえ、最終「完全閉鎖」判定(手動美的ゲート合格後の L0 領分)は上位に委ねる。

---

## 8. 実行コマンド一覧(再現用)

```powershell
# runtime-player
cd apps/runtime-player
npx tsc --noEmit -p tsconfig.json                                  # exit 0
npx vitest run -c vitest.config.ts                                 # x3: 606 pass / 2 fail
npx vitest run -c vitest.config.ts src/main/live-mapping src/main/physiology src/main/role-composition  # 117 pass

# root
pnpm run typecheck                                                 # exit 0
pnpm run test:unit                                                 # 240 files / 1492 pass

# footprint
git status --porcelain --untracked-files=all
git diff --name-only -- pnpm-lock.yaml pnpm-workspace.yaml '**/package.json' 'apps/editor/**' 'packages/**'  # empty
```
