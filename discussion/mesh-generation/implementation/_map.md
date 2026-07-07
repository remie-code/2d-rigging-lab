# Mesh Generation Implementation Map

> mesh-generation トピックの実装オーケストレーション成果物の地図(runtime-player方式でトピック内に閉じる)。

## 直下のディレクトリ

| Path | Role | Status |
|---|---|---|
| [orchestration/](orchestration/) | wave 計画 | mesh-wave1-plan.md 作成済み(Planned) |
| [waves/](waves/) | wave ごとの Gnome 実装報告・final report | 作成済み(wave1 全ドメイン報告 A/B/C/R + final report + domain-d 統合報告) |
| [reviews/](reviews/) | wave ごとの Review-Sylph レビューレポート | 作成済み(wave1 全ドメインレビュー: a/b(design+tests)/c/r) |

## 主要ファイル

| Path | Content | Status |
|---|---|---|
| [orchestration/mesh-wave1-plan.md](orchestration/mesh-wave1-plan.md) | Mesh Wave 1 計画(A:中立部品抽出 / B:v7コア / C:世代切替UI / D:統合 の順次バッチ) | 実行完了 |
| [waves/mesh-wave1/final-report.md](waves/mesh-wave1/final-report.md) | Mesh Wave 1 final report(全ドメイン要約・統合検証実数値・既知事項・ユーザー目視評価 gate 手順・評価後の Mesh Wave 2 方針) | 作成済み・ユーザー目視評価待ち |

## Mesh Wave 1 実装結果(全ドメイン pass)

Domain A/B/C/R すべて実装完了・Review-Sylph 合格。統合(Domain D)で全体検証を実施し、mesh 起因の新規 fail ゼロを確認した。

| Domain | 内容 | 判定 | ループ | 報告 | レビュー |
|---|---|---|---|---|---|
| A | 中立部品抽出(`mesh-geometry/**` 新設・v6 委譲切替、v6挙動バイト同一) | completed | 1 | [domain-a-report.md](waves/mesh-wave1/domain-a-report.md) | [domain-a-review.md](reviews/mesh-wave1/domain-a-review.md) |
| B | v7コア(margin-contour パイプライン・契約V7系統・ディスパッチャ分岐) | completed | 1 | [domain-b-report.md](waves/mesh-wave1/domain-b-report.md) | [design](reviews/mesh-wave1/domain-b-review-design.md) / [tests](reviews/mesh-wave1/domain-b-review-tests.md) |
| C | 世代切替UI(v6/v7 method トグル + 3プリセット) | completed | 1 | [domain-c-report.md](waves/mesh-wave1/domain-c-report.md) | [domain-c-review.md](reviews/mesh-wave1/domain-c-review.md) |
| R | 既存 baseline fail 是正(check:deps 誤検知・追従漏れテスト・tutorial recipe custom id 化) | completed | 2 | [domain-r-report.md](waves/mesh-wave1/domain-r-report.md) | [domain-r-review.md](reviews/mesh-wave1/domain-r-review.md) |
| D | 統合(トグルラベル v6/v7 差替・全体検証・ドキュメント整合・final report) | completed | 1 | [domain-d-report.md](waves/mesh-wave1/domain-d-report.md) | — |

統合検証(Domain D 実測): authoring-core 276/276・operation/validator/runtime-core 732/0・authoring-host 82/82・typecheck/check:deps/check:source すべて pass。apps/editor は 435 passed / 4 failed(4 fail は wave106 P3 由来の既知 baseline `diagnostics-jump-actions.test.ts`・mesh 非起因)。詳細は [final-report.md](waves/mesh-wave1/final-report.md)。

## 次の行動

1. **ユーザー目視評価 gate** を実施する(手順は [waves/mesh-wave1/final-report.md](waves/mesh-wave1/final-report.md) の該当節が正)
2. 評価合格後: v6削除を Mesh Wave 2 として計画
