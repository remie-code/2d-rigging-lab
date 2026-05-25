# CMO3 / MOC3 Format Spec Research Map

> `discussion/reports/cmo3-moc3-format-spec/` 直下の調査ファイルだけを示す地図。

---

## 位置付け

この階層は、Live2D の `.cmo3` と `.moc3` について、仕様公開状況、既存実装、読み書き実装可能性、シナリオへの影響を調査する。

## 直下のファイル

| Path | Role | Status |
|------|------|--------|
| [_map.md](_map.md) | この階層の入口地図 | 起草済み |
| [cmo3-format-report.md](cmo3-format-report.md) | `.cmo3` の仕様公開状況と読み書き実装可能性の調査 | 作成済み |
| [moc3-format-report.md](moc3-format-report.md) | `.moc3` の仕様公開状況と読み書き実装可能性の調査 | 作成済み |
| [format-feasibility-summary.md](format-feasibility-summary.md) | `.cmo3` / `.moc3` の比較結論とSC-IN-004への示唆 | 作成済み |
| [sdk-web-local-loader-plan.md](sdk-web-local-loader-plan.md) | Cubism SDK for Web の入手方法、ローカル利用方針、`.moc3` 構造抽出サンプル案 | 作成済み |

## 調査観点

- 公式事実: Live2D公式ドキュメント、SDK、Editorマニュアル、ライセンス上の記述
- 公開仕様: 仕様文書、ファイルフォーマット説明、公式または準公式の記述
- 既存実装: OSSやツールが `.cmo3` / `.moc3` をどう扱っているか
- 実装可能性: 読み込み、書き込み、編集保持、再出力のどこまで現実的か
- シナリオ影響: `SC-IN-004` やMVPの読み込み・再出力条件をどう扱うべきか

## 暫定仮説

| 項目 | 仮説 | 状態 |
|------|------|------|
| `.cmo3` | Cubism Editor の編集プロジェクト形式であり、独立実装の読み書きをMVP/ACコミットメントにするのは現実的でない | 調査結果で支持 |
| `.moc3` | ランタイム利用の組み込み用モデルデータであり、SDK/Core経由ロードは現実的だが、独立した編集・再出力は現実的でない | 調査結果で支持 |

## 未決事項

| 項目 | 状態 |
|------|------|
| `.cmo3` を読み書き対象に含めるべきか | 独立読み書きは非推奨。認識のみ、Editor媒介、または研究スパイク扱いが候補 |
| `.moc3` は仕様で扱えるのか、SDK経由のロード対象として扱うべきか | ローカル利用前提で、同梱せずSDK/Core adapter経由ロード対象として扱う |
| MVPで対象にする既存モデル資産の入口を `.cmo3` と `.model3.json` / `.moc3` のどちらに置くべきか | `.model3.json` + `.moc3` ランタイムパッケージを優先候補にする |
