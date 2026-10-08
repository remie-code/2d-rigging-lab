# Perf Wave 2 / Domain H 実装レポート — 統合 / before-after / ドキュメント整合

> 実装: Gnome（サブエージェント委任 / 呼び出し元 Orch-Sylph）
> Status: 完了
> スコープ: 統合・再計測・全体検証・ドキュメント整合・レポート作成のみ。**評価・描画ロジックは一切変更していない**（禁止事項遵守）。

---

## 1. やったこと

1. **合成ベンチ before/after 再計測**: `RUN_PERF_BENCH=1` で全4規模を2回計測（安定確認）。before は v3 の記録値を引用。→ `measurements/after-wave2-synthetic.md`（新規）。
2. **モノレポ全体検証**: root typecheck / apps/editor typecheck / root test:unit / apps/editor workspace テスト / check:deps / check:source を実行し数値記録（§3）。
3. **CI 経路の再確認**: root package.json / apps/editor package.json / root tsconfig を実読し、apps/editor がユニットテスト・型検査で root CI 経路に乗らない事実を確認（§4）。
4. **ドキュメント整合**: improvement-design（Status→Implemented）/ render-performance/_map.md（現況）/ improvement-approach（確認 → 更新不要）。
5. **wave final report**: `implementation/waves/perf-wave2/final-report.md`（新規。ドメイン要約・before/after・既知事項・計測003手順・切り分けガイド）。
6. **本レポート**: Domain H 総括（完了の合図）。

---

## 2. before-after 要約（evaluation 全体の削減率・主経路 = rig 非選択）

| scale | before avg (v3) | after avg | 削減率 |
|-------|-----------------|-----------|--------|
| light    | 0.835 ms/eval | 0.273 ms/eval | −67.3% |
| medium   | 13.690 ms/eval | 1.782 ms/eval | −87.0% |
| heavy    | 233.393 ms/eval | 20.329 ms/eval | −91.3% |
| rigHeavy | 89.153 ms/eval | 10.616 ms/eval | −88.1% |

- 主犯 `createCanvasEvaluatedRigControls`（`assembly.rigControls` スパン）が案A でゼロ化: rigHeavy **67.824 → 0.001 ms/eval（−99.998%）**。親 artworkBoundsAndAssembly も rigHeavy −99.94%。
- 第二標的 deformerVertex が案D+E で削減: medium −91% / heavy −92% / rigHeavy −79.7% / light −68.1%。
- 詳細・全スパン表・run1/run2 再現性は `measurements/after-wave2-synthetic.md`。

---

## 3. モノレポ全体検証（実測数値）

| 検証 | 結果 |
|------|------|
| root typecheck（`tsc --noEmit`） | **PASS（exit 0）** |
| apps/editor typecheck（`tsc -p apps/editor/tsconfig.json`） | **22 errors**（pre-existing と一致・F/G 変更ファイル起因 0） |
| root test:unit（packages） | **234 files / 1455 tests PASS**（fail 0） |
| apps/editor workspace | **283 passed / 4 skipped / 4 failed** |
| apps/editor canvas（F/G 主戦場） | **110 passed / 4 skipped** |
| check:deps | **PASS** |
| check:source | **PASS** |

### 既知除外（この2つのみ・他の fail はゼロ）

1. `diagnostics/diagnostics-jump-actions.test.ts` の 4 件（wave106 P3 既知）。全4件がこのファイルに閉じることを確認。apps/editor workspace の 4 failed はすべてこれ。
2. apps/editor pre-existing 型エラー 22 件（別 WIP 由来・別タスク化済み。F/G 変更ファイル canvas-evaluation.ts / canvas-projection.ts / canvas-evaluation.test.ts には 0 件）。

**上記以外の fail はゼロ**を確認した。

---

## 4. CI 経路の確認（事実 + 影響・未修正）

### 事実（実読で再確認）

- root `test:unit` = `vitest run packages --exclude ...` → **packages のみ・apps/editor 非対象**。
- apps/editor package.json に**ユニットテスト script なし**（dev/build/typecheck/test:e2e:psd-import(playwright)/preview のみ）。
- root `typecheck` = `tsc --noEmit`（root tsconfig）。root tsconfig の `include` は `packages/*` / `scripts` / `vitest.config.ts` のみで **`apps/**` 非対象**。apps/editor の型検査は `apps/editor/tsconfig.json` を個別に叩く必要。

### 影響

- **canvas 系ユニットテスト（canvas-evaluation.test.ts 等 = F/G の等価テスト）は root `pnpm check` / `test:unit` 経路では回らない**。今回の green は Domain H が `npx vitest run apps/editor/src/workspace/canvas` を明示実行して確認したもの。
- apps/editor の型検査（22 件含む）も root typecheck では検出されない。
- **修正はしていない**（方針判断はユーザー/L0。final-report §10 質問1 で escalate）。

---

## 5. ドキュメント整合の結果

| ファイル | 対応 |
|---------|------|
| `improvement-design.md` | Status を **Accepted → Implemented(Perf Wave 2, 2026-07-08)**（Accepted 履歴保持）。§6 に実装完了・削減率要約・after 文書参照を追記。案C保留・60fps 実数判断待ちは改変せず明記。 |
| `render-performance/_map.md` | improvement-design 行 Status→Implemented。implementation/ 行・measurements/ 行に Perf Wave 2 / after-wave2-synthetic を反映。「次の行動」を「Perf Wave 2 完了 → ユーザー実モデル計測003」に更新。確定済みに Wave 2 完了を追記。 |
| `improvement-approach.md` | **確認したが更新不要**。方針・合意事項（症状・診断仮説 A/B/C・二層分離原則・ユーザー判断5件・フェーズ計画）は実装事実と食い違いなし。§5 未決事項（目標値 / Runtime Player scope）は依然として真に未決のため保持。実装の status を主張する文書ではないため改変不要。 |
| `after-wave2-synthetic.md` | 新規作成（before/after 全スパン比較）。 |
| `final-report.md` | 新規作成（ドメイン要約・before/after・既知事項・計測003手順・切り分けガイド）。 |

**禁止**の遵守: 未合意方針の混入なし。案C（レンダー外化）は保留のまま改変せず。60fps 続行可否は「ユーザー実数判断待ち」のまま。ドキュメントには実装された事実のみを記載。

---

## 6. 作成・更新ファイル一覧（絶対パス）

**新規作成**:
- `C:\workspace\remie\code\ai-native-live2d-editor\discussion\render-performance\measurements\after-wave2-synthetic.md`
- `C:\workspace\remie\code\ai-native-live2d-editor\discussion\render-performance\implementation\waves\perf-wave2\final-report.md`
- `C:\workspace\remie\code\ai-native-live2d-editor\discussion\render-performance\implementation\waves\perf-wave2\domain-h-report.md`（本ファイル）

**更新**:
- `C:\workspace\remie\code\ai-native-live2d-editor\discussion\render-performance\improvement-design.md`（Status→Implemented, §6）
- `C:\workspace\remie\code\ai-native-live2d-editor\discussion\render-performance\_map.md`（現況反映）

**編集していない**（確認のみ）: `improvement-approach.md`（更新不要）。root `discussion/_map.md` / `discussion/reports/_map.md` / `discussion/_conventions.md`（tracked M だが Domain H は未編集の pre-existing 差分）。

---

## 7. ベンチ一時変更の復元確認

Domain H の計測では production / ベンチ / テストを一切改変していない（ベンチは `RUN_PERF_BENCH` を env から読む）。計測前後で `git status` が同一であることを確認済み → 一時変更なし・復元不要。

---

## 8. 委任前提との相違（重要・報告事項）

委任プロンプトは「未コミット束は3層（Mesh Wave 1/1.1 を含む）」としていたが、**実際の git status には mesh 系（mesh-geometry / v7系 / mesh-tool UI）が未コミットとして現れない**。これらは直近コミット（`6749b520` 等）で既にコミット済み。現在の未コミット束は **2層（Perf Wave 1.x 計測基盤 + Perf Wave 2 F/G）+ ドキュメント + runtime-player tgz 生成物**。切り分けガイド（final-report §8）はこの実態に合わせて作成した。

---

## 9. 判定と質問

**判定: pass**（F/G レビュー合格済み・全体検証は既知2除外以外 fail ゼロ・ドキュメント整合完了・全成果物作成済み）。

質問（詳細は final-report §10）:
1. **CI 経路**: apps/editor のユニットテスト・型検査を root CI に組み込むか（方針判断）。**未修正**。組み込む場合は別ドメイン化が必要。
2. **委任前提と git status の相違**（§8）: mesh 系は既コミット済み。切り分けガイドは実態（2層）で作成。認識相違があれば指摘されたい。
3. **pre-existing 型エラー 22 件**: 別 WIP 由来・別タスク化済みとの前提。Perf Wave 2 完了条件外とした。
4. **`discussion/_conventions.md` / root `discussion/_map.md` / `discussion/reports/_map.md` の pre-existing M 差分**: Domain H 未編集。切り分けコミット時に帰属確認を要す。
