# Reports Map

> `discussion/reports/` 直下の調査トピックディレクトリだけを示す地図。下層の詳細は各調査トピック内の `_map.md` に委譲する。

---

## 位置付け

`reports/` は、技術調査、成立性調査、外部仕様・実装状況のレポートを保持するトピックである。

Live2D / Cubism 関連レポートは過去調査・リスク確認用の private research archive であり、Private 2D Rigging Lab / Prototype の仕様・実装・UX根拠としては扱わない。

現在の方針では、Cubism SDK/Core、既存Cubismモデル、`.cmo3`、`.moc3`、`.model3.json`、`.motion3.json`、`.physics3.json`、`.pose3.json` の検査・読み込み・解析・変換・再構築を行わない。

## 現行オーナーへの導線

`reports/` の過去調査は現行実装・設計の正本ではない。性能、Runtime、設計、PSD修正の現在状態は次のオーナーを読む。

| Concern | Current owner | Archive/reference boundary |
|------|------|------|
| Editor / Runtime performance and dynamics | [../render-performance/_map.md](../render-performance/_map.md) | `editor-render-performance/` is a pre-Perf Wave 2 historical baseline. |
| Runtime Player implementation and product gates | [../runtime-player/_map.md](../runtime-player/_map.md) and [runtime-core-contract.md](../design/module-contracts/runtime-core-contract.md) | `runtime-evaluation-semantics-reference/` is historical reference only. |
| Current design contracts and Preview / Viewer boundary | [../design/module-contracts/_map.md](../design/module-contracts/_map.md) and [../design/mvp-authoring-runtime/00-mvp-vertical-slice-architecture.md](../design/mvp-authoring-runtime/00-mvp-vertical-slice-architecture.md) | `deformer-structure-technology/` and `viewer-preview-reference/` do not replace accepted project-defined contracts. |
| PSD import UV remap | [`canvas-projection.ts`](../../apps/editor/src/workspace/canvas/canvas-projection.ts), [`canvas-render-scene-adapter.ts`](../../apps/editor/src/workspace/canvas/canvas-render-scene-adapter.ts), and [package-file-format-contract.md](../design/module-contracts/package-file-format-contract.md) | `psd-import-fidelity/` records H1 and the implemented fix as evidence. |

Cubism archive restart, if ever proposed, remains outside current work and requires a separate permission / legal / scope review.

## 直下のファイル

| Path | Role | Status |
|------|------|--------|
| [_map.md](_map.md) | `reports/` 直下の入口地図 | Private baselineへ更新済み |

## 直下のディレクトリ

| Path | Role | Status |
|------|------|--------|
| [cmo3-moc3-format-spec/](cmo3-moc3-format-spec/) | `.cmo3` と `.moc3` の過去調査。現在は形式不採用を記録 | Private historical evidence / current exclusion |
| [cubism-sdk-runtime-structure/](cubism-sdk-runtime-structure/) | Cubism SDK/Coreで `.moc3` をロードした後に観測できるランタイム構造の過去調査 | Private historical evidence / implementation sourceではない |
| [deformer-structure-technology/](deformer-structure-technology/) | 変形構造に関する過去調査とproject-defined設計候補 | Historical reference / current runtime contractが正 |
| [viewer-preview-reference/](viewer-preview-reference/) | Editor preview / Viewer 設計に向けた過去参照調査 | Historical reference / current MVP architectureが正 |
| [runtime-evaluation-semantics-reference/](runtime-evaluation-semantics-reference/) | Runtime評価セマンティクス設計に向けた過去参照調査 | Historical reference / current runtime contractが正 |
| [rights-risk-cleanup/](rights-risk-cleanup/) | 権利・商標・互換誤認リスク整理 | Current legal/scope gate。Demo and Proposal Hygieneへ接続 |
| [editor-render-performance/](editor-render-performance/) | Editor/Viewer 描画パフォーマンスの静的診断（ホットパス・評価層・描画層・ボトルネック仮説） | Historical baseline (2026-07-07)。現行性能は [render-performance](../render-performance/_map.md) |
| [psd-import-fidelity/](psd-import-fidelity/) | PSDインポート時のH1（`contentInset` 未適用）診断と修正後の証拠 | Current evidence: `8640d12` でUV remap実装済み。実装オーナーは上記ソースとpackage contract |
| [map-freshness-audit/](map-freshness-audit/) | `discussion/**/_map.md` の鮮度、親子整合、歴史的mapとしての妥当性を調べるリポジトリ内監査 | Completed / final review pass (2026-08-08) |

## 次の行動

1. 性能、Runtime、設計、PSDの現行状態を確認するときは、上記のcurrent ownerを先に読む。historical archiveの古いnext actionは現行作業として再開しない。
2. map鮮度の更新は [map-freshness-audit/](map-freshness-audit/) の契約と owner report に従い、監査出力を保持する。
3. 配信デモや提案資料に出す情報は、別途 Streaming Demo Surface / Live2D Feature Proposal 文書で制御する。

## 未決事項

| 項目 | 状態 |
|------|------|
| Cubism inspector / archive experiment を再開するか | 現行作業ではない。必要なら permission / legal / scope review を先行する |
| 各Cubism参照レポートにsuperseded headerを個別追加するか | follow-up候補（現行実装の前提にはしない） |
| SC-IN-004など旧intake scenarioをいつ移行するか | follow-up候補（reports archiveの現行nextではない） |
