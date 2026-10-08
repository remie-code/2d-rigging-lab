# Mesh Wave 1.1 Plan: v7 評価往復1の修正(境界非クランプ + 密度再調整)

> 目視評価 往復1 の欠陥2件を単一ドメインで修正する小wave。設計の正は改訂済み concept-design と [evaluation-log.md](../../evaluation-log.md) 往復1。

## 1. Status

- Status: Planned / ready for orchestration
- Target wave: Mesh Wave 1.1(評価往復1対応)
- 前提: Mesh Wave 1 全ドメイン pass(未コミットで作業ツリーに残置)

## 2. Oracles / User Decisions(2026-07-07 確定)

- [concept-design.md](../../concept-design.md) §2-1(作業空間の仮想パディング)・§3(不変条件「膨張の非クランプ」追加)が唯一の正
- 密度: **L(=R) = 28 / 42 / 64px**(大きく動く high / 標準 medium / あまり動かない low)。r・ε の導出式(r = clamp(0.012×最大辺, 4, 16)、ε=0.8r)は据え置き
- トグルの寿命は未決のまま(本waveでは触れない)
- Model Allocation: L0 = fable / Orch-Sylph・Gnome・Review-Sylph = opus 明示必須

## 3. Domain E: v7 境界パディング + 密度再調整

Domain id: `mesh-wave1_1-v7-padding-density`

Allowed write scope:

- `packages/authoring-core/src/mesh-generation-v7-*.ts`(パイプライン・パラメータ・margin-contour)と v7 テスト
- `packages/authoring-core/src/mesh-geometry/**` は**追加的変更のみ許可**(パディング補助が中立部品として自然な場合)。既存シグネチャ・数値挙動の変更禁止(v6 バイト同一ゲート維持)
- Domain report / review files(`waves/mesh-wave1.1/domain-e-report.md`, `reviews/mesh-wave1.1/domain-e-review.md`)

Forbidden write scope: v6系ファイル / 契約(`mesh-generation-contract.ts`)/ `apps/**` / preview スキーマ / 新規依存・lockfile / コミット / `pnpm install`。

Required implementation:

1. **仮想パディング**: 作業空間を全周 pad = ⌈r + ぼかし半径⌉ 拡張した座標系で v7 全工程(二値化〜Lloyd)を実行し、ステージ座標・bounds へ写像するときに pad オフセットを補正。最終 MeshDto の bounds は輪郭を包含する形で元 drawable bounds の外へ拡張。UV は従来どおり 0..1 クランプ
2. **密度定数の更新**: L = 28/42/64px(named constants の根拠コメントに「評価往復1でユーザー確定」と出典を記す)

Required tests:

- **境界非クランプ(本waveの核)**: 絵がキャンバス端に接する fixture で、(a) 輪郭頂点が元 bounds の外に出ること、(b) 旧端ライン上への頂点整列(張り付き)が消えること、(c) 被覆保証が維持されること
- bounds 拡張の正しさ(全頂点が新 bounds 内・pad 補正の整合)
- 密度: プリセットごとの実測輪郭頂点間隔が新 L に整合・単調性維持
- 既存不変条件の無傷: 決定性 / ε<r / UV[0,1] / 零面積なし / 多島 / 穴埋め(v7 既存16件は期待値更新可、意味論の緩和は禁止)
- v6 回帰14個を含む既存テスト全 green(mesh-geometry を触った場合は特に)

Escalate if: previewMesh 検証や消費側が「bounds 外拡張」を reject する構造が見つかった場合(統合層の変更が要るなら L0 裁定)。

## 4. Handling Rules

- `.claude/skills/implementation-orchestration/SKILL.md` の全規則に従う(分離 / ループ上限5 / 在席ポーリング / 閉域 / モデル明示)
- レビューは単一 Review-Sylph。観点: concept-design 改訂(§2-1/§3)との突合・テスト再実行・スコープ逸脱なし
- 必須文言: 「Orch-Sylph自身は実装担当ではない。source implementation は必ず別コンテキストの Gnome に委譲し、レビューは必ず別コンテキストの Review-Sylph に委譲すること。これを分離できない場合は実装せず escalate / blocked として報告すること。」
