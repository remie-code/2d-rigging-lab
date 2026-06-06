# Design Map

> `discussion/design/` 直下のファイル・ディレクトリだけを示す地図。下層や個別設計ファイルを作る場合は、その階層の `_map.md` に詳細を委譲する。

---

## 位置付け

`design/` は、Private 2D Rigging Lab / Prototype の設計論点、設計判断、未決事項、調査待ち、設計が満たすべき検証観点を保持するトピックである。

現在のMVPは Private Authoring-to-Viewer Prototype であり、private GUI editor、private runtime core、private viewer、project-defined model package、validator、AI assistant、demo-safe capture を中心に扱う。

設計文書本文はPrivate Prototype baselineへ用語整理済みである。歴史的なファイル名が残るものもあるが、active designはRoot concept / Root AC / MVP ACに従う。

## 直下のファイル・ディレクトリ

| Path | Role | Status |
|------|------|--------|
| [_map.md](_map.md) | `design/` 直下の入口地図 | Private baselineへ更新済み |
| [initial-design-decisions-and-open-questions.md](initial-design-decisions-and-open-questions.md) | MVP更新前後の設計判断、委任範囲、要調査・要議論事項 | Private baseline語彙へ整理済み |
| [ai-agent-connection-and-technology-stack.md](ai-agent-connection-and-technology-stack.md) | AI assistant 接続方式と技術スタック方針 | Private baseline語彙へ整理済み |
| [codex-friendly-automation-policy.md](codex-friendly-automation-policy.md) | Editor/repo は提案・推論・自動分類を持たず、Codex/LLM が人間同等操作を deterministic API で実行するための自動化境界。Wave50の explicit PSD structural expansion は semantic recognition ではなく、明示選択された構造初期状態 scaffold に限定 | Accepted user decision / Wave49-Wave50 basis |
| [module-contract-design-decisions.md](module-contract-design-decisions.md) | module contract design の判断ログ | Private baseline語彙へ整理済み。過去判断は参考 |
| [gpt-5.5-pro-review-001-response.md](gpt-5.5-pro-review-001-response.md) | `memo/gpt-5.5-pro-review/reveiw_001.md` への対応分類と反映結果 | Current response record |
| [gpt-5.5-pro-review-002-response.md](gpt-5.5-pro-review-002-response.md) | `memo/gpt-5.5-pro-review/review_002.md` へのRE3対応分類とDynamics復帰反映結果 | Historical response record; Dynamics details superseded by review_003 |
| [gpt-5.5-pro-review-003-response.md](gpt-5.5-pro-review-003-response.md) | `memo/gpt-5.5-pro-review/review_003.md` へのRE-FINAL対応分類とDynamics確定版反映結果 | Historical response record; RuntimeState evidence details superseded by review_004 |
| [gpt-5.5-pro-review-004-response.md](gpt-5.5-pro-review-004-response.md) | `memo/gpt-5.5-pro-review/review_004.md` へのP0/P1/P2対応分類とRuntimeState evidence反映結果 | Current response record |
| [module-contract-design-goal.md](module-contract-design-goal.md) | module contract design の到達目標、要求粒度、トレーサビリティ要求 | Private baseline語彙へ整理済み |
| [module-contract-output-format-template.md](module-contract-output-format-template.md) | module contract成果物の共通書式・ファイル別テンプレート | 参考 |
| [module-contracts/](module-contracts/_map.md) | TypeScript + Web 向け contract-first module design 成果物群 | Private baseline語彙へ整理済み |
| [mvp-authoring-runtime/](mvp-authoring-runtime/_map.md) | GUI Editor必須の Authoring-to-Runtime MVP を実装へ進める前に固定すべき縦切り設計文書群 | Private baseline語彙へ整理済み |

## 現在の設計焦点

| 項目 | 状態 |
|------|------|
| MVP縦切り | Private GUI editor -> project-defined package -> private runtime core/viewer -> validator -> AI assistant の一周 |
| Package | project-defined model packageを正にする。Cubism形式は検査・読み込み・変換対象にしない |
| Source import | `layered-character-psd-profile-v1` を汎用layered character art import profileとして採用。Live2D / Cubism import profileではない |
| Runtime / Viewer | private runtime coreをEditor previewとViewerで共有する |
| Minimum Open Dynamics v1 | Current MVP。`RuntimeSequenceFrameDto[]` 正本、`RuntimeEvaluationContextDto`、単一/sequence RuntimeState evidence、1 group = 1 output、`scalarDampedFollowV1`固定式として確定 |
| Validator | package / runtime / rights / provenance / demo-safe capture を構造化reportにする |
| AI / Codex-friendly operation | Editor/repo は提案・推論・auto-riggingを行わない。外部Codex/LLMが操作案を作り、repoは人間同等操作のdeterministic state / operation / dry-run / diff / validation / approval / commit / evidence surfaceを提供する |
| GPT-5.5 Pro review 001 | P0/P1/P2の反映可能指摘を反映。詳細は [gpt-5.5-pro-review-001-response.md](gpt-5.5-pro-review-001-response.md) |
| GPT-5.5 Pro review 002 | RE3-001〜RE3-020と実装前チェックリストを反映。Dynamics詳細はreview_003で上書き |
| GPT-5.5 Pro review 003 | RE-FINAL-001〜RE-FINAL-018と確定版チェックリストを反映。RuntimeState evidence詳細はreview_004で上書き |
| GPT-5.5 Pro review 004 | P0/P1/P2を反映。RuntimeSequence / artifact ref詳細はreview_005で上書き |
| GPT-5.5 Pro review 005 | P0/P1/P2を反映。RuntimeState sequence artifact / RuntimeEvaluationContext統合詳細はreview_006で上書き |
| GPT-5.5 Pro review 006 | RuntimeState単体/sequence artifact分離、RuntimeEvaluationContext統合、Operation/AI/Fixture証拠参照規約を反映。RuntimeStateSequenceArtifactのinitial/post-frame意味論とdeterministic replay evidence詳細はreview_007で上書き |
| GPT-5.5 Pro review 007 | RuntimeStateSequenceArtifactの `states[0]` initial / `states[i + 1]` post-frame規約、`states.length = frameCount + 1`、`runtime.stateSequenceLengthMismatch`、evidence fields、`policy.default({})` を反映。`memo/gpt-5.5-pro-review/review_007_fix_summary.md` に修正サマリを記録 |
| Demo / Proposal | Streaming Demo Surface と Live2D Feature Proposal はprivate実装から分離する。専用文書を追加済み |

## 次の行動

1. 実装着手時に、設計文書からmodule contract / testsへ落とす。
2. Demo-safe preflightとproposal reviewを、必要に応じてvalidator/Codex-facing operation surface設計へ反映する。
3. Future integration boundaryを再開する場合は、別途ユーザー判断でscopeを切る。

## 未決事項

| 項目 | 状態 |
|------|------|
| AI Agent は Editor に接続するか、package に対して外部処理するか | 3層連携としてDraft設計済み。Future integration surface化はMVP外 |
| Runtime は Editor preview と Viewer で同一実装にするか | Shared private runtime coreを共有する方針 |
| GUI Editor の画面仕様としてどの項目を決めるか | Draft設計済み。実装時に詳細化 |
| RigControl構造の技術的正体 | Private Prototype内のproject-defined構造として整理継続 |
| Runtime評価セマンティクスの設計判断 | compositionMode、mask opacity 0、missing texture severity、epsilonPolicy は実装前未決 |
