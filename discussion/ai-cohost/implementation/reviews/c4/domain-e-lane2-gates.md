# C4 clean review — Lane-B（機械ゲート独立再実行・Domain E 追加分）

> Review-Sylph（Lane-B=機械ゲート）→ Orch-Sylph。全機械ゲートを**自分で独立に再実行**し、Domain E 報告 §1 の主張を実出力で照合。Domain E 追加分（normalizedRanges 同期テスト・exchange note 実語彙化）の妥当性を検証。読み取り専任（テスト実行のみ、ソース無改変）。
> **判定: 合格（PASS）。** 10ゲート全て Domain E 報告の主張と一致。既知 baseline は実 fail 出力で正確に分類。持続駆動テスト 3/3 安定緑。Domain E 追加テストは偽陰性でない。`pnpm install` 未実行。

---

## 1. 機械ゲート結果マトリクス（あなたの実行結果 vs 報告主張）

| # | ゲート | 私の実行結果 | exit | Domain E 報告主張 | 一致 |
|---|---|---|---|---|---|
| 1 | runtime-player typecheck (`pnpm -C apps/runtime-player run typecheck`) | `tsc --noEmit` エラーなし | 0 | PASS | ✓ |
| 2 | root typecheck (`pnpm run typecheck:root`) | `tsc --noEmit` エラーなし | 0 | PASS | ✓ |
| 3 | runtime-player 全体テスト (`vitest run -c vitest.config.ts`) | **823 passed / 2 failed**（825 total、136 files: 134 passed / 2 failed） | 1 | 823/2 | ✓ |
| 4 | check:deps (`node scripts/check-dependencies.mjs`) | `Dependency guard passed.` | 0 | PASS | ✓ |
| 5 | check:source (`node scripts/check-source-organization.mjs`) | 1 違反 = `physiology/index.ts`（barrel-only）のみ | 1 | 1 既知 C3 baseline | ✓ |
| 6 | check:soul-zone (`node scripts/check-soul-zone-boundary.mjs`) | `passed: 1243 source files scanned; no 器→魂 / 魂→器` | 0 | PASS 1243 | ✓ |
| 7 | check:soul-zone:fixtures (`node scripts/check-soul-zone-boundary-fixtures.mjs`) | `fixture regressions passed: 5 cases.`（valid緑 + 単一行/多行違反を赤で固定） | 0 | PASS 5 cases | ✓ |
| 8 | 持続駆動テスト x3（flaky 最終確認） | **3/3 green**、安定タイミング 924/934/931ms、RTT p95 予算内（テスト内 assert）・縦貫通・切断/再接続 | 0×3 | （Domain D）安定 | ✓ |
| 9 | lockfile 無変更 (`git diff --stat pnpm-lock.yaml pnpm-workspace.yaml`) | 差分0行（空） | 0 | 無変更 | ✓ |
| 10 | composite check (`pnpm run check`) | typecheck 緑 → test:unit **240 files / 1492 tests 全緑** → check:deps 緑 → **check:source で exit1（既知 C3 baseline のみ）** で停止。それ以前は全緑 | 1 | 同一（既知 baseline のみで停止） | ✓ |

**総合**: 10ゲート全て、Domain E 報告 §1 の主張と**完全一致**。相違なし。

---

## 2. 既知 baseline の正確な分類（実 fail 出力を確認）

### 全体テストの 2 failed（gate 3、実出力で内訳確認）
両方とも **browser-source の `effectiveDynamicsTuning: null` フィールド不一致**（Received に `effectiveDynamicsTuning: null` が余分に含まれ toStrictEqual が外れる）:

1. `src/main/broadcast-source/browser-source-server.test.ts:150` — `serves current Runtime Export payload …`（**payload 系**、not-loaded/empty レスポンスに `effectiveDynamicsTuning` が付く）。
2. `src/stage/browser-source/browser-source-server-message.test.ts:216` — `readBrowserSourceRuntimeExportResponse > accepts the not-loaded response shape`（**not-loaded 系**）。

→ task が指定した既知 baseline（`browser-source-server.test.ts` の payload 系 / `browser-source-server-message.test.ts` の not-loaded 系）と**厳密一致**。**この2件以外の test fail はゼロ**（fail 出力は上記2ブロックのみ、`[1/2]`/`[2/2]` で全 fail 列挙）。C4 は browser-source を1バイトも触っていない（因果的に無関係）。

### check:source の 1 違反（gate 5・gate 10）
`apps/runtime-player/src/main/physiology/index.ts: index.ts must remain a barrel-only entrypoint` の**1件のみ**。C3 で committed 済みの既存ファイル（C4 未接触、physiology/ 配下は git 無変更）。**この違反以外の check:source 違反はゼロ**。

### composite check の exit1 の帰属
`typecheck && test:unit && check:deps && check:source && check:soul-zone` のうち、**check:source で初めて exit1**。それより前（typecheck / test:unit 1492件 / check:deps）は全緑。exit1 は**既知 C3 baseline のみに帰属**。check:soul-zone は composite からは未到達だが単独で緑（gate 6）。

---

## 3. 持続駆動テストの flaky 安定性（複数回実行）

| 実行 | 結果 | 所要 | exit |
|---|---|---|---|
| RUN 1 | ✓ 1 passed | 924ms | 0 |
| RUN 2 | ✓ 1 passed | 934ms | 0 |
| RUN 3 | ✓ 1 passed | 931ms | 0 |

3/3 安定緑。タイミングのばらつきは 924〜934ms（±10ms 程度）で極めて安定。単一テスト「drives head-horizontal through WS→overlay→heart, survives disconnect/reconnect, keeps frames flowing, and meets the RTT p95 budget」が RTT p95 予算・縦貫通・停滞なし・切断/再接続をテスト内で assert。flaky 兆候なし。

---

## 4. Domain E 追加分の妥当性（偽陰性の有無）

### 4.1 normalizedRanges 同期テスト（報告 §4.3）— **偽陰性でない・妥当**
`contract/channel-protocol-contract.test.ts` に describe「normalizedRanges ↔ TS classifier sync」（2件）を追記。コードを読んで検証:

- **Test 1（完全性）**: `Object.keys(intentSetPayloadSchema.normalizedRanges)` の Set == `semanticSlotDefinitions.map(d => d.sourceKind)` の Set を `toStrictEqual`。
  - `semanticSlotDefinitions` の distinct sourceKind を実確認 → **9種**（head-centered / gaze-centered / body-x / body-z / blink-left / blink-right / mouth-open / mouth-smile / mouth-vowel）。JSON `normalizedRanges` のキーも**同一9種**。現状一致で緑。
  - JSON からキーを削れば Set 不一致 → **赤**。新 sourceKind を registry に足して JSON 未更新 → **赤**。orphan キー → **赤**。→ 実効性あり。
  - vacuous-pass 懸念: `normalizedRanges` が空でも Test 2 のループは走らないが、**Test 1 が空 Set ≠ 9要素 Set で赤**になるため combination で防波堤成立。偽陰性ではない。
- **Test 2（値同期）**: 各 `normalizedRanges[sourceKind]` を `semanticSlotNormalizedRange(sourceKind)`（TS）と `toStrictEqual`。centered/body 系は `{min:-1,max:1}`、weight/vowel 系は `{min:0,max:1}` で JSON と一致。JSON の値を1つでも書き換えれば → **赤**。→ 実効性あり。
- **既存契約テストへの影響**: 契約テストは **6→8 tests、全緑**（単独ラン `8 passed` を確認）。既存6件は無改変で緑。破壊なし。

### 4.2 exchange note 実語彙化（報告 §4.2）— **note 文言のみ・妥当**
`channel-exchange-examples.json` happyPath の note を確認: line 19 `"Turn the head via the head-horizontal slot for 800ms."`。
- 実 payload は `{ "slotId": "head-horizontal", "value": 0.4, "ttlMs": 800 }` で**不変**（`face.angle.x` は payload/schema/TS 型のどこにも無い）。
- `control-channel/` 配下を grep → `face.angle.x` の残存は **`reference-driver-sustained-drive.test.ts` のコメント1箇所のみ**（"fixture の face.angle.x 相当" という説明文で、fixture 実体ではない）。**exchange-examples.json からは完全に消えている**（Domain E の主張どおり）。
- `JSON.parse` 相当で純 JSON（コメント/trailing なし）を確認。note 文言以外のロジック変更なし。
- ※ 補足: `control-channel/` ディレクトリ全体が git 未追跡（`??`）のため git diff で「文言のみ」の delta を機械提示できない（Domain A がディレクトリごと新規作成、E が内部を編集したため）。ただし現ファイル内容（純JSON・note=head-horizontal・payload 不変・face.angle.x 消滅）は上記で直接確認済みで、主張と矛盾しない。

### 4.3 normalizedRanges テストの import が方向検査に無関係か — **無関係・確認**
追加 import は `semanticSlotDefinitions` / `SemanticSlotSourceKind`（`../../live-mapping/semantic-slot-definitions`）と `semanticSlotNormalizedRange`（`../semantic-slot-normalized-range`）。いずれも**器内（vessel）参照**（`live-mapping/` と `control-channel/` 直下）。`apps/soul` への参照ではなく、魂↔器境界に無関係。check:soul-zone は追加後も緑（1243 files、gate 6）で実証。

---

## 5. 判定

**合格（PASS）。**

- 10 機械ゲート全て、あなた自身の独立再実行で Domain E 報告 §1 の主張と一致（相違ゼロ）。
- fail・違反は既知 baseline（Wave21 browser-source 2件 + C3 physiology/index.ts 1件）のみで、実出力から正確に分類。C4 起因の fail・違反はゼロ。
- 持続駆動テスト 3/3 安定緑（flaky 兆候なし）。
- Domain E 追加分（normalizedRanges 同期テスト・exchange note）は妥当で偽陰性なし。既存テストを破壊せず、方向検査にも無影響。
- lockfile 無変更、`pnpm install` 未実行。

機械ゲート観点での C4 閉鎖 blocker は**なし**。

---

## 6. 質問（Orch/Undine 判断が要る点、blocking なし）

1. **exchange note の git 追跡状態**: `control-channel/` ディレクトリが未追跡（`??`）のため、note の「文言のみ変更」を git diff で機械証明できない（ディレクトリごと新規のため delta が取れない）。内容自体は純JSON・payload 不変で正しいので機械ゲート判定には影響しないが、閉鎖記録時に「Domain A 新規作成分に E が内部編集」という経緯を残すと後日の監査が明快。この温度感で問題ないか。
2. 本レビューは Lane-B（機械ゲート・Domain E 追加分）に限定。もう1レーン（統合整合）とは独立に評価しており未統合。統合判定は Orch-Sylph 側で。
