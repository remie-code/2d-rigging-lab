# Wave106 Domain A — Gnome4 修正報告（レビュー指摘2点クローズ）

- 呼び出し元: Orch-Sylph（Wave106 Domain A `wave106-core-replacement`）
- 役割: Gnome（実装）— 狭い局所修正ループ
- オラクル: `discussion/design/dynamics-world-frame-chain.md` §5（命名表）・§7（validator 改廃）
- 判定: **completed**

## スコープ遵守

- 変更ファイルは全て `packages/validator-core/src/**` に限定（check-catalog.ts + テスト4ファイル）。
- `dynamics-semantic.ts` の validator **実装ロジックは非改変**（発火 checkId 確認のための読み取りのみ実施）。catalog を実装の真に合わせる方向で修正。
- Forbidden 領域（package-format / contracts / runtime-core 本体、apps、parameter-resolution / advanceRuntimeState、新規依存 / install）への変更なし。

## 修正1（穴A）: `packages/validator-core/src/check-catalog.ts` の dynamics 診断カタログ改廃

### catalog checkId ↔ 実装 checkId 一致確認

実装 `packages/validator-core/src/validators/dynamics-semantic.ts` が発火する dynamics checkId を grep で列挙し、catalog をこれに一致させた。実装が発火する dynamics checkId の全集合（11件）:

| 実装で発火する checkId | 実装 severity | 実装 phase | catalog 側 |
|---|---|---|---|
| `dynamics.inputMissing` | error | dynamics_semantic | 維持 ✓ |
| `dynamics.chainSegmentsInvalid` | blocking | dynamics_semantic | 新設 ✓ |
| `dynamics.outputSegmentIndexOutOfRange` | blocking | dynamics_semantic | 新設 ✓ |
| `dynamics.driverMissing` | error | dynamics_semantic | 維持 ✓ |
| `dynamics.outputMissing` | error | dynamics_semantic | 維持 ✓ |
| `dynamics.outputTargetDuplicate` | error | dynamics_semantic | 維持 ✓ |
| `dynamics.zeroInputScale` | warning | dynamics_semantic | 改名 ✓ |
| `dynamics.outputScaleZero` | warning | dynamics_semantic | 改名 ✓ |
| `dynamics.outputLimitTooSmall` | warning | dynamics_semantic | 維持 ✓ |
| `dynamics.unstableSettings` | warning | dynamics_semantic | 維持（description 更新）✓ |
| `dynamics.runtimeEvidenceMismatch` | error | representative_evaluation | 維持 ✓ |

catalog の dynamics entry 集合 = 上記11件と完全一致（発火 checkId = catalog entry、過不足なし）。

**severity についての設計判断**: タスク指示は新設2件を「error（blocking）」と表現していたが、実装 `dynamics-semantic.ts` は両者を `severity: "blocking"` で発火する（`createDynamicsCheck({ severity: "blocking" })`, 行 109 / 344）。catalog はソルバ実装の真に合わせる原則に従い `defaultSeverity: "blocking"` とした（catalog の `SeveritySchema` は blocking を許容。既存の blocking entry 多数あり）。

### 改廃対応表

| 区分 | checkId | 対応 |
|---|---|---|
| 削除 | `dynamics.invalidPendulumCardinality` | catalog entry 削除（§7 廃止） |
| 削除 | `dynamics.invalidOutputCardinality` | catalog entry 削除（§7 廃止） |
| 削除 | `dynamics.normalizationInvalid` | catalog entry 削除（フィールド消滅、§7 廃止） |
| 改名 | `dynamics.zeroInputInfluence` → `dynamics.zeroInputScale` | checkId 改名、severity=warning 維持、description を新語彙へ |
| 改名 | `dynamics.outputStrengthZero` → `dynamics.outputScaleZero` | checkId 改名、severity=warning 維持、description を新語彙へ |
| 新設 | `dynamics.chainSegmentsInvalid` | entry 追加、defaultSeverity=blocking、phase=dynamics_semantic |
| 新設 | `dynamics.outputSegmentIndexOutOfRange` | entry 追加、defaultSeverity=blocking、phase=dynamics_semantic |
| 維持 | `dynamics.inputMissing` | description 更新（"v0 additive pendulum" → "world-frame chain"） |
| 維持 | `dynamics.driverMissing` | description そのまま（旧語彙なし） |
| 維持 | `dynamics.outputMissing` | description そのまま（"additive output parameter" は §3.5 加算合成の語義として正確、維持） |
| 維持 | `dynamics.outputTargetDuplicate` | description そのまま（同上） |
| 維持 | `dynamics.outputLimitTooSmall` | description そのまま（旧語彙なし） |
| 維持 | `dynamics.unstableSettings` | description 更新（"pendulum coefficients" → "chain coefficients"） |
| 維持 | `dynamics.runtimeEvidenceMismatch` | description そのまま（旧語彙なし） |

新設/改名 entry の `phase`（"dynamics_semantic"）・`profiles`（["viewer","strict","acceptance","aiDryRun"]）・`relatedAC`（["AC-MVP-010","AC-MVP-013"]）は既存 dynamics entry と同形に揃えた。

集計: 削除3 / 改名2 / 新設2 / 維持7（うち description 更新3: inputMissing, zeroInputScale・outputScaleZero の改名 description, unstableSettings）。

### description 旧語彙撤去

"v0 additive pendulum" / "pendulum" / "normalization" / "strength" / "influence" などの旧語彙を維持/改名 entry から除去し、"world-frame chain" / "chain" / "scale" / "segment" の新語彙へ更新。

## 修正2（穴B）: テスト4ファイルの solverKind リテラル置換

`evaluatorVersions.dynamics: "additivePendulumV0"` → `"worldFrameChainV1"`（§5 命名表）を機械置換:

- `packages/validator-core/src/mask-composition-diagnostics.test.ts:488`
- `packages/validator-core/src/rig-control-runtime-evidence.test.ts:752`
- `packages/validator-core/src/rig-control-semantic.test.ts:674`
- `packages/validator-core/src/validator-core.test.ts:387`

`worldFrameChainV1` はコードベース全体で既に採用済みの正規値（runtime-core/snapshot.ts, runtime-options.ts 等）であり、型は既にこのリテラルを受理する（tsc green で確認）。

## 検証結果（実行コマンドと出力）

### validator-core テスト
```
npx vitest run packages/validator-core
→ Test Files  3 failed | 36 passed (39)
→      Tests  3 failed | 265 passed (268)
```
3 failed の内訳（**すべて dynamics 無関係の HEAD baseline 赤**、責務外）:
- `warp-lattice-diagnostics.test.ts` — `rigControl.warpLatticeUnsupportedProperty`（Wave32 warp lattice）
- `rig-control-runtime-evidence.test.ts`（7→1 failed に減少）— 残1件も `rigControl.warpLatticeUnsupportedProperty`（warp lattice）。他6件は穴B修正で pass 化
- `wave30-tutorial-mini-model-contract-fixtures.test.ts` — tutorial recipe duplicate parameter（"tutorial recipe×preset" baseline）

dynamics/catalog 関連テストはすべて green。穴A・穴B に起因する赤ゼロ。
（baseline 確認: stash で私の変更を戻すと `rig-control-runtime-evidence.test.ts` は 7 failed に悪化。私の穴B修正が 6 件を回復させたことを確認済み。）

### grep 証跡（残置ゼロ）
```
grep additivePendulumV0 packages/            → ZERO（0 occurrences / 0 files）
grep 'invalidPendulumCardinality|invalidOutputCardinality|normalizationInvalid|
      zeroInputInfluence|outputStrengthZero' check-catalog.ts → ZERO（0 occurrences）
```

### tsc
```
npx tsc --noEmit  → EXIT 0（型エラー0、packages error 0 維持）
```

### packages 全体（14赤 baseline 不変の確認）
```
npx vitest run packages
→ Test Files  13 failed | 220 passed (233)
→      Tests  14 failed | 1407 passed (1421)
```
既存 14赤のまま（増加なし）。減らす義務なしの範囲。

## 網羅テスト（発火 checkId ⊆ catalog）について

check-catalog の網羅を検証する専用テスト（validator が発火する全 checkId が catalog に登録済みであることを assert するもの）は既存構造に**存在しない**。各テストファイルは `defaultCheckCatalog.has("...")` で個別 checkId の登録有無を点検するのみで、dynamics の網羅点検 spec は無い。既存構造に自然に収まる網羅テストの追加余地が薄いため、今回は**網羅テスト未追加**（catalog ↔ 実装の一致は本報告の対応表と grep で人手確認済み）。

質問なし。
