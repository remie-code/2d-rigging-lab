# Mesh Generation Implementation Map

> mesh-generation トピックの実装オーケストレーション成果物の地図(runtime-player方式でトピック内に閉じる)。

## 直下のディレクトリ

| Path | Role | Status |
|---|---|---|
| [orchestration/](orchestration/) | wave 計画 | Mesh Wave 1/1.1/1.2/1.3 計画・実行完了 |
| [waves/](waves/) | wave ごとの Gnome 実装報告・final report | Wave 1/1.1/1.2/1.3 の report と final artifacts 作成済み |
| [reviews/](reviews/) | wave ごとの Review-Sylph レビューレポート | Wave 1/1.1/1.2/1.3 のレビュー完了 |

## 主要ファイル

| Path | Content | Status |
|---|---|---|
| [orchestration/mesh-wave1-plan.md](orchestration/mesh-wave1-plan.md) | Mesh Wave 1 計画(A:中立部品抽出 / B:v7コア / C:世代切替UI / D:統合 の順次バッチ) | 実行完了 |
| [orchestration/mesh-wave1.1-plan.md](orchestration/mesh-wave1.1-plan.md) | Mesh Wave 1.1 計画(Domain E: v7 境界仮想パディング + 密度再調整) | 実行完了([domain-e-report.md](waves/mesh-wave1.1/domain-e-report.md) / [domain-e-review.md](reviews/mesh-wave1.1/domain-e-review.md)) |
| [orchestration/mesh-wave1.2-plan.md](orchestration/mesh-wave1.2-plan.md) | Mesh Wave 1.2 計画(Domain F: editor original 経路 contentInset UV remap = PSDインポート位置ズレ修正。原因調査は [reports/psd-import-fidelity/](../../reports/psd-import-fidelity/import-position-mismatch-investigation.md)) | 実行完了(pass・コミット済 8640d12) |
| [orchestration/mesh-wave1.3-plan.md](orchestration/mesh-wave1.3-plan.md) | Mesh Wave 1.3 計画(Domain G: authoring-host perception「AIの眼」の同 H1 修正。editor 版 1.2 の姉妹) | 実行完了 |
| [waves/mesh-wave1.3/domain-g-report.md](waves/mesh-wave1.3/domain-g-report.md) | Mesh Wave 1.3 Domain G report | 完了・review 適合 |
| [reviews/mesh-wave1.3/domain-g-review.md](reviews/mesh-wave1.3/domain-g-review.md) | Mesh Wave 1.3 Domain G review | 適合 |
| [waves/mesh-wave1/final-report.md](waves/mesh-wave1/final-report.md) | Mesh Wave 1 final report(全ドメイン要約・統合検証実数値・ユーザー目視評価 gate 手順・Wave 2 方針) | 完了。往復2評価で「v6/v7一長一短」・Wave2棚上げに更新 |

## Mesh Wave 1 実装結果(全ドメイン pass)

Domain A/B/C/R すべて実装完了・Review-Sylph 合格。統合(Domain D)で全体検証を実施し、mesh 起因の新規 fail ゼロを確認した。Wave 1.1/1.2/1.3 も各 report/review が完了し、contentInset UV remap は current source/test に入っている。

| Domain | 内容 | 判定 | ループ | 報告 | レビュー |
|---|---|---|---|---|---|
| A | 中立部品抽出(`mesh-geometry/**` 新設・v6 委譲切替、v6挙動バイト同一) | completed | 1 | [domain-a-report.md](waves/mesh-wave1/domain-a-report.md) | [domain-a-review.md](reviews/mesh-wave1/domain-a-review.md) |
| B | v7コア(margin-contour パイプライン・契約V7系統・ディスパッチャ分岐) | completed | 1 | [domain-b-report.md](waves/mesh-wave1/domain-b-report.md) | [design](reviews/mesh-wave1/domain-b-review-design.md) / [tests](reviews/mesh-wave1/domain-b-review-tests.md) |
| C | 世代切替UI(v6/v7 method トグル + 3プリセット) | completed | 1 | [domain-c-report.md](waves/mesh-wave1/domain-c-report.md) | [domain-c-review.md](reviews/mesh-wave1/domain-c-review.md) |
| R | 既存 baseline fail 是正(check:deps 誤検知・追従漏れテスト・tutorial recipe custom id 化) | completed | 2 | [domain-r-report.md](waves/mesh-wave1/domain-r-report.md) | [domain-r-review.md](reviews/mesh-wave1/domain-r-review.md) |
| D | 統合(トグルラベル v6/v7 差替・全体検証・ドキュメント整合・final report) | completed | 1 | [domain-d-report.md](waves/mesh-wave1/domain-d-report.md) | — |

統合検証(Domain D の当時の実測): authoring-core 276/276・operation/validator/runtime-core 732/0・authoring-host 82/82・typecheck/check:deps/check:source すべて pass。apps/editor は 435 passed / 4 failed(4 fail は wave106 P3 由来の既知 baseline `diagnostics-jump-actions.test.ts`・mesh 非起因)。これは Wave 1 時点の evidence であり、後続 Wave108 は packages 241 files / 1492 tests、Wave109 は packages 242 files / 1500 tests を pass と記録する。

## 次の行動

1. **トピック保留**: 往復2のユーザー評価は完了し、v6/v7は一長一短。v6 default + v7 toggle を維持する。
2. Wave 2(v6削除)を再開する場合は、v6/v7 quality criteria と toggle 寿命についてユーザー承認を先に得る。自動 pass や Wave108/109 の rendering contract を品質勝利の根拠にしない。
