# CMO3 / MOC3 Format Spec Research Map

> `discussion/reports/cmo3-moc3-format-spec/` 直下の調査ファイルだけを示す地図。

---

## 位置付け

この階層は、Live2D / Cubism 形式に関する過去調査を保管する private research archive である。

現在の方針では、Cubism SDK/Core、既存Cubismモデル、`.cmo3`、`.moc3`、`.model3.json`、`.motion3.json`、`.physics3.json`、`.pose3.json` の検査・読み込み・解析・変換・再構築を行わない。

この階層の内容は、リスク確認、非互換宣言、スコープ除外判断の文脈に限定する。実装仕様、runtime oracle、UI仕様、fixture source、配信素材、AI実装promptの正として使わない。

## 直下のファイル

| Path | Role | Status |
|------|------|--------|
| [_map.md](_map.md) | この階層の入口地図 | Historical evidence index（private research archive / current exclusion） |
| [cmo3-format-report.md](cmo3-format-report.md) | `.cmo3` の仕様公開状況と、実装対象外にする根拠の過去調査 | Private research archive |
| [moc3-format-report.md](moc3-format-report.md) | `.moc3` の仕様公開状況と、実装対象外にする根拠の過去調査 | Private research archive |
| [format-feasibility-summary.md](format-feasibility-summary.md) | 旧SDK/Core local-use方針をsupersedeし、現在の不採用方針を記録 | Superseded policy note / current exclusion |
| [sdk-web-local-loader-plan.md](sdk-web-local-loader-plan.md) | 過去のローカル実験計画。現方針では実装根拠にせず、Cubism SDK/Core 依存も採用しない | Superseded / reference only |

## 現在の判断

| 項目 | 現在の扱い |
|------|------------|
| `.cmo3` | 検査・読み込み・解析・変換・再構築しない |
| `.moc3` | 検査・読み込み・解析・変換・再構築しない |
| `.model3.json` and companion JSON | 検査・読み込み・解析・変換しない |
| Cubism SDK/Core | 使わない |
| 既存Cubismモデル | 入力、fixture、sample、comparison oracleにしない |

## 現行正本への導線

- 形式・SDK/Coreを採用しない境界: [module-boundaries.md](../../design/module-contracts/module-boundaries.md)
- 権利・商標・互換誤認の境界: [rights-risk-cleanup map](../rights-risk-cleanup/_map.md)

この階層の本文は、上記の現行正本を置き換えない歴史的証拠である。

## 歴史的未決（現行作業ではない）

以下は過去調査時点の保留事項であり、現在の実装・設計タスクとして再開しない。再開を提案する場合は、上記の権利・スコープ境界を確認した別トラックで扱う。

| 項目 | 状態 |
|------|------|
| 将来Cubism SDK/CoreやCubism形式調査を再開するか | 現在は行わない。必要なら別の permission / legal / scope review track として再提案する |
