# Runtime Evaluation Semantics Reference Report Map

> `discussion/reports/runtime-evaluation-semantics-reference/` 直下の調査レポートだけを示す地図。

---

## 位置付け

この調査トピックは、Open 2D Character Rigging Stack の Runtime評価セマンティクスを検討した過去調査を保管する。Live2D Cubism SDK / Core 関連の記述は歴史的参照・リスク確認に限定し、仕様・実装・UXの根拠にはしない。

Cubism SDK/Core は参考資料であり、Open 2D Character Rigging Stack のオラクルではない。`.moc3` 互換や Cubism Core 依存を要求せず、Open Model Package と Shared Runtime evaluation core は独自仕様として扱う。

## 直下のファイル

| Path | Role | Status |
|------|------|--------|
| [_map.md](_map.md) | この調査トピックの入口地図 | Historical evidence index（現行runtime oracleではない） |
| [cubism-core-framework-evaluation-flow.md](cubism-core-framework-evaluation-flow.md) | Cubism Core / Framework の model load、parameter操作、update、drawable state取得、drawまでの評価flow整理 | 作成済み |
| [cubism-runtime-input-layers-motion-expression-physics-pose.md](cubism-runtime-input-layers-motion-expression-physics-pose.md) | motion / expression / physics / pose など parameterやpart状態へ影響するruntime入力層の整理 | 作成済み |
| [open-stack-runtime-evaluation-semantics-implications.md](open-stack-runtime-evaluation-semantics-implications.md) | Open Stack MVP の runtime評価順序、snapshot、diagnostics、MVP外項目への設計推奨 | 作成済み |

## 現行正本への導線

- Shared Runtime の評価順序・snapshot・unsupported layers: [runtime-core-contract.md](../../design/module-contracts/runtime-core-contract.md)
- Editor Preview / Viewer / Runtime の境界: [MVP vertical-slice architecture](../../design/mvp-authoring-runtime/00-mvp-vertical-slice-architecture.md)
- Cubism 非互換・権利スコープ: [rights-risk-cleanup map](../rights-risk-cleanup/_map.md)

この階層の Cubism 観測と Open Stack 推奨は、上記の accepted project-defined contract を置き換えない。

## 調査観点

| 観点 | 内容 |
|------|------|
| Core評価flow | `.moc3` load、parameter set/add/multiply、model update、drawable vertices / opacity / draw order / mask 取得、renderer draw |
| Runtime入力層 | motion、expression、physics、pose、parameter save/restore、update順序、上書き・加算・乗算など |
| Snapshot / diagnostics | Runtime state として何を観測できるか、どこまでAI/Validatorへ渡せるか |
| Open Stack変換 | Cubism依存を避けつつ、Open Model Package / Shared Runtime evaluation core にどう反映するか |
| MVP採用 | GUI Editor必須MVPで必要な範囲と、motion / expression / physics / pose などのMVP外境界 |

## 歴史的フォローアップ（現行作業ではない）

1. 過去調査での評価 pipeline / snapshot 論点は、上記の runtime contract へ反映済み。ここから新たな設計タスクを起こさない。
2. 仕様変更を検討する場合は、現行 contract の変更提案として別途 review する。
3. 当時の未検証項目を再開する場合は、Cubism 除外・権利・スコープ境界を先に確認する。

## 歴史的未決（現行作業ではない）

以下は過去調査の候補・判断待ちを保存した register である。現行仕様の未完了タスクとして解釈しない。

| 項目 | 状態 |
|------|------|
| Open Stack MVPのruntime評価順序 | 過去調査時点の推奨 pipeline（現行作業ではない）。現行は [runtime-core-contract.md](../../design/module-contracts/runtime-core-contract.md) を正とする |
| parameter範囲外値、missing parameter、invalid drawable の扱い | 過去調査時点の設計候補（現行作業ではない）。現行判断は runtime contract / validator contract を参照 |
| runtime snapshotに含める粒度 | 過去調査時点の切替案（現行作業ではない）。現行 snapshot は runtime-core contract を正とする |
| motion / expression / physics / pose をMVP外に置く際のruntime診断 | 過去調査時点の unsupported sidecar diagnostics 案（現行作業ではない）。現行スコープは accepted contract を参照 |
