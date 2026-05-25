# Runtime Evaluation Semantics Reference Report Map

> `discussion/reports/runtime-evaluation-semantics-reference/` 直下の調査レポートだけを示す地図。

---

## 位置付け

この調査トピックは、Open Live2D Stack の Runtime評価セマンティクスを設計するために、Live2D Cubism SDK / Core 公式資料から参照できる runtime update / parameter operation / motion / expression / physics / pose / draw data / integrity check の情報を整理する。

Cubism SDK/Core は参考資料であり、Open Live2D Stack のオラクルではない。`.moc3` 互換や Cubism Core 依存を要求せず、Open Model Package と Shared Runtime evaluation core の設計材料として使う。

## 直下のファイル

| Path | Role | Status |
|------|------|--------|
| [_map.md](_map.md) | この調査トピックの入口地図 | 作成済み |
| [cubism-core-framework-evaluation-flow.md](cubism-core-framework-evaluation-flow.md) | Cubism Core / Framework の model load、parameter操作、update、drawable state取得、drawまでの評価flow整理 | 作成済み |
| [cubism-runtime-input-layers-motion-expression-physics-pose.md](cubism-runtime-input-layers-motion-expression-physics-pose.md) | motion / expression / physics / pose など parameterやpart状態へ影響するruntime入力層の整理 | 作成済み |
| [open-stack-runtime-evaluation-semantics-implications.md](open-stack-runtime-evaluation-semantics-implications.md) | Open Stack MVP の runtime評価順序、snapshot、diagnostics、MVP外項目への設計推奨 | 作成済み |

## 調査観点

| 観点 | 内容 |
|------|------|
| Core評価flow | `.moc3` load、parameter set/add/multiply、model update、drawable vertices / opacity / draw order / mask 取得、renderer draw |
| Runtime入力層 | motion、expression、physics、pose、parameter save/restore、update順序、上書き・加算・乗算など |
| Snapshot / diagnostics | Runtime state として何を観測できるか、どこまでAI/Validatorへ渡せるか |
| Open Stack変換 | Cubism依存を避けつつ、Open Model Package / Shared Runtime evaluation core にどう反映するか |
| MVP採用 | GUI Editor必須MVPで必要な範囲と、motion / expression / physics / pose などのMVP外境界 |

## 次の行動

1. Runtime評価セマンティクスの説明・議論フェーズで、MVPに採用する評価pipelineと snapshot 粒度をユーザーと確定する。
2. 確定した判断を `discussion/design/` の設計判断文書へ反映する。
3. `/goal` で設計作業を走らせる前に、設計完了条件と検証観点へ落とし込む。

## 未決事項

| 項目 | 状態 |
|------|------|
| Open Stack MVPのruntime評価順序 | 調査済み。推奨pipelineあり。ユーザー判断待ち |
| parameter範囲外値、missing parameter、invalid drawable の扱い | 調査済み。profile別 severity / clamp / fail 方針の設計判断待ち |
| runtime snapshotに含める粒度 | 調査済み。summary / targeted / full の切替案あり。既定値は設計判断待ち |
| motion / expression / physics / pose をMVP外に置く際のruntime診断 | 調査済み。unsupported sidecar diagnostics 案あり。schema slot 採否は設計判断待ち |
