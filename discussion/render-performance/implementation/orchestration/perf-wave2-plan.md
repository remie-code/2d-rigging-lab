# Perf Wave 2 Plan: 改善実装 第1弾(案A: 選択駆動遅延化 + 案D: deformerVertex 表示経路最適化)

> 設計の正は [improvement-design.md](../../improvement-design.md)(Accepted)。目標30fps。案A→案D+E→統合再計測の順次バッチ。

## 1. Status

- Status: Planned / ready for orchestration
- Target wave: Perf Wave 2
- Model Allocation: L0 = fable / Orch-Sylph・Gnome・Review-Sylph = opus 明示必須
- 前提: Perf Wave 1/1.2/1.3 の計測基盤(未コミットで作業ツリーに残置)

## 2. Wave Strategy

```text
Batch 1: Domain F(案A: rig control 選択駆動遅延化)
Batch 2(F 完了後): Domain G(案D+E: deformerVertex 表示経路最適化)
Batch 3: Domain H(統合: ベンチ before/after・ドキュメント整合・ユーザー計測003手順)
```

F と G は同じ canvas-evaluation.ts を触るため順次。各 Orch-Sylph は SKILL.md の分離規則に従う(ループ上限5)。

## 3. Domain F: 案A 選択駆動遅延化

Domain id: `perf-wave2-lazy-rig-controls`

Allowed write scope: apps/editor の評価・projection・オーバーレイ・preview 経路(canvas-evaluation.ts / canvas-projection.ts / canvas-preview-panel.tsx / rig ツールの preview フック等、設計実現に必要な範囲)と対応テスト / Domain report / review files(`waves/perf-wave2/domain-f-report.md`, `reviews/perf-wave2/domain-f-review.md`)。

Forbidden write scope: `packages/**` / 保存・export・provenance 経路 / 依存・lockfile / pnpm install / コミット / 計測フックの削除(維持すること)。

Required implementation([improvement-design.md](../../improvement-design.md) §2 が正):

- `CanvasEvaluatedScene.rigControls` を選択駆動の部分集合へ(必要 rig 集合 = 選択中 + preview draft + 評価に必要な祖先チェーン。非選択時は空)
- ドラッグ preview 経路も同じ遅延評価を通す
- オーバーレイ解決の追従(部分集合でも同一結果)
- 既存テストの全件前提を契約変更として書き換え(意味論の緩和禁止)

Required tests / gate:

- **描画等価(核)**: drawables 出力が変更前後で数値同一(スライダー操作相当の評価で byte 一致)
- **選択時等価**: rig 選択状態で評価された当該 rig の形状値が従来と同一
- **遅延の構造テスト**: 非選択時に rig control 評価が実行されないこと(時間でなく呼び出し構造で assert)
- 合成ベンチ(rigHeavy 含む)で artworkBoundsAndAssembly が大幅減(数値は report に記録)
- 既存テスト green(既知 baseline fail 4件除外可)/ typecheck / check:source / check:deps pass

Escalate if: 消費者分析(design-inputs §2)に反する「全件を必要とする消費者」が実装中に見つかった場合 / 祖先チェーンの解決が非自明な依存を持つ場合。

## 4. Domain G: 案D+E deformerVertex 表示経路最適化

Domain id: `perf-wave2-deformer-vertex-display-path`

Allowed write scope: apps/editor の表示評価経路(canvas-evaluation.ts の cloneMesh 境界以降が表示専用、design-inputs §5)と対応テスト / Domain report / review files(`waves/perf-wave2/domain-g-report.md`, `reviews/perf-wave2/domain-g-review.md`)。

Forbidden write scope: **保存・export・provenance に値が流れる経路(バイト互換不可侵)** / `packages/**` / 依存・lockfile / pnpm install / コミット / 計測フック削除。

Required implementation(design §3 が正): 表示経路の toFixed(12) 除去または数値演算置換 / 3重クローン削減 / unionRects spread 除去(案E)。

Required tests / gate:

- **二層分離の実証(核)**: 保存・export 経路の値が変更前後でバイト同一(該当経路のテスト green)。表示値は epsilon(1e-9)以内の等価
- 合成ベンチで deformerVertex が減少(数値記録)
- 既存テスト green(表示値の exact 一致前提テストは epsilon 等価へ更新可、ただし意味論の緩和禁止・更新理由を report に列挙)/ typecheck / check:source / check:deps pass

Escalate if: 表示/保存の分離点が design-inputs の想定(cloneMesh 境界)と異なる構造が見つかった場合。

## 5. Domain H: 統合(before/after・ドキュメント整合)

Domain id: `perf-wave2-final-integration`

- 合成ベンチ全規模の before/after 表を `discussion/render-performance/measurements/after-wave2-synthetic.md` に記録(Wave 1.3 の v3 を before として比較)
- モノレポ全体検証(tsc / テスト / check:deps / check:source。既知 baseline fail 4件は既知明示)
- 実装事実に合わせて関連ドキュメントを更新する。(improvement-design Status→Implemented / _map / 未決事項の棚卸し)
- **ユーザー実モデル計測003の手順**と「30fps 目標の判定方法」を final report に含める(`waves/perf-wave2/final-report.md`)

## 6. Handling Rules

- `.claude/skills/implementation-orchestration/SKILL.md` の全規則(分離 / 在席ポーリング / 閉域 / モデル明示 / ループ上限5)
- レビュー構成: **Domain F / G は2レーン**(設計適合=improvement-design 突合 / テスト妥当性=等価テストの実効性検証)、H は単一レーン
- 必須文言: 「Orch-Sylph自身は実装担当ではない。source implementation は必ず別コンテキストの Gnome に委譲し、レビューは必ず別コンテキストの Review-Sylph に委譲すること。これを分離できない場合は実装せず escalate / blocked として報告すること。」
- 設計に無い判断分岐は実装で埋めず escalate(L0 が裁定して improvement-design を改訂)
