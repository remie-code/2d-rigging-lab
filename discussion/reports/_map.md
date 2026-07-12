# Reports Map

> `discussion/reports/` 直下の調査トピックディレクトリだけを示す地図。下層の詳細は各調査トピック内の `_map.md` に委譲する。

---

## 位置付け

`reports/` は、技術調査、成立性調査、外部仕様・実装状況のレポートを保持するトピックである。

Live2D / Cubism 関連レポートは過去調査・リスク確認用の private research archive であり、Private 2D Rigging Lab / Prototype の仕様・実装・UX根拠としては扱わない。

現在の方針では、Cubism SDK/Core、既存Cubismモデル、`.cmo3`、`.moc3`、`.model3.json`、`.motion3.json`、`.physics3.json`、`.pose3.json` の検査・読み込み・解析・変換・再構築を行わない。

## 直下のファイル

| Path | Role | Status |
|------|------|--------|
| [_map.md](_map.md) | `reports/` 直下の入口地図 | Private baselineへ更新済み |

## 直下のディレクトリ

| Path | Role | Status |
|------|------|--------|
| [cmo3-moc3-format-spec/](cmo3-moc3-format-spec/) | `.cmo3` と `.moc3` の過去調査。現在はSDK/Core local-use方針をsupersedeし、形式不採用を記録 | Private research archive |
| [cubism-sdk-runtime-structure/](cubism-sdk-runtime-structure/) | Cubism SDK/Coreで `.moc3` をロードした後に観測できるランタイム構造の過去調査 | Private research archive / implementation sourceではない |
| [deformer-structure-technology/](deformer-structure-technology/) | 変形構造に関する過去調査とproject-defined設計候補 | Private research archive / 独自語彙への変換が必要 |
| [viewer-preview-reference/](viewer-preview-reference/) | Editor preview / Viewer 設計に向けた過去参照調査 | Private research archive / UX oracleではない |
| [runtime-evaluation-semantics-reference/](runtime-evaluation-semantics-reference/) | Runtime評価セマンティクス設計に向けた過去参照調査 | Private research archive / runtime oracleではない |
| [rights-risk-cleanup/](rights-risk-cleanup/) | 権利・商標・互換誤認リスク整理 | 参考。Demo and Proposal Hygieneへ接続 |
| [editor-render-performance/](editor-render-performance/) | Editor/Viewer 描画パフォーマンスの現状調査(ホットパス・評価層・描画層・ボトルネック仮説の順位付け) | Recorded(2026-07-07)。改善方針の議論に接続する現行調査 |
| [psd-import-fidelity/](psd-import-fidelity/) | PSDインポート時のパーツ位置・見た目の忠実度調査。インポート直後の位置ズレ(目・襟)の原因(H1: contentInset未適用) | Recorded(2026-07-12)。根本原因 H1 確定 |

## 次の行動

1. 過去調査レポートを実装agentへ渡す場合は、private research archiveであり実装の正ではないことを明示する。
2. 過去調査から設計へ反映する場合は、必ず独自語彙・独自データ構造・非互換方針へ変換してから記録する。
3. 配信デモや提案資料に出す情報は、別途 Streaming Demo Surface / Live2D Feature Proposal 文書で制御する。

## 未決事項

| 項目 | 状態 |
|------|------|
| 各Cubism参照レポートにsuperseded headerを個別追加するか | follow-up候補 |
| SC-IN-004など旧intake scenarioをいつ移行するか | follow-up候補 |
