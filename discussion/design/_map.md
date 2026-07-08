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
| [parameter-preset-ecosystem.md](parameter-preset-ecosystem.md) | Parameter presetをCore Parameter / Preset Profile / Ecosystem Facadeに分け、Camera Captureを中心にsemantic consumer、role catalog、初期preset候補を整理する設計メモ | Draft design basis |
| [vowel-lipsync-mapping.md](vowel-lipsync-mapping.md) | 母音（あいうえお）リップシンク: iFacialMocap の ARKit blendshape から nearest-reference 推定で `param_mouth_vowel_*` を駆動する写像層スロット5本 + キャリブレーション統合（母音参照フレーム）。実測データ駆動（ユーザー発音キャプチャが一次ソース）+ リップシンク ON/OFF トグル | **Implemented**（wave107 final complete / clean review pass。実機ユーザー gate 待ち。実装記録: `../implementation/waves/wave107/wave107-final-integration-report.md`） |
| [vowel-lipsync-mouth-open-coupling.md](vowel-lipsync-mouth-open-coupling.md) | 母音リップシンク時、`param_mouth_open` の駆動元を生 jawOpen から発話強度 w へ差し替える後続設計。母音の形は「開き切り前提」で描かれ親子デフォーマで合成されるため、開きを w に結合して箱と形を噛み合わせる。トグル無効/非対応時は jawOpen 駆動を温存。vowel-lipsync-mapping の後続 | **Implemented**（wave22 final complete / clean review pass。第一増分＝最小構成。実機ユーザー gate 待ち。実装記録: `../runtime-player/implementation/waves/wave22/wave22-final-integration-report.md`。実機観測で平滑化(B)と jawOpen 味付け(a)を判断） |
| [vowel-lipsync-shape-blend.md](vowel-lipsync-shape-blend.md) | 母音の"形"のパチつき解消: 単一勝者(argmax)を解除し、母音を合計≈1の正規化凸ブレンド（softmax(τ=0.30×距離中央値) × per-母音 strength bias → 正規化 × 強度 s）で同時出力。mouth_open=s（Wave22 の mouth_open=w を一般化）。え寄生は目視で benign→素の softmax。cp17 解除。推定器本体に手が入る後続 | **Implemented**（wave23 / source・tests complete / clean review pass。実機ユーザー gate 待ち。実装記録: `../runtime-player/implementation/waves/wave23/wave23-final-integration-report.md`。平滑化(B)・鋭さツマミ(B')は保留） |
| [dynamics-world-frame-chain.md](dynamics-world-frame-chain.md) | Dynamics v1 = 世界系 Verlet 質点チェーン（`dynamics-file-v3`）。v0 `additivePendulumV0` の平衡点欠陥（重力項不在）の診断、物理式の正、単位ベース新スキーマ、判断要7件の裁定、破壊半径台帳へのリンク | Accepted / wave106 implemented（全層置換完了・final clean integration review pass。実装記録: `../implementation/waves/wave106/_map.md`） |
| [canvas-evaluation/](canvas-evaluation/_map.md) | Canvas / Previewに描くための評価パイプライン、parameter-driven deformation、draft合成、overlay / hit test の設計トピック | Draft design basis |
| [screen-design/](screen-design/_map.md) | GUI Editorを中心とする画面設計、画面遷移、主要領域、表示情報分類、人間向けUIとCodex/evidence surface境界の設計トピック | In discussion |
| [mesh-generation/](mesh-generation/_map.md) | Drawable RGBA alpha maskから初期meshを生成するアルゴリズム、品質基準、fallback境界の設計トピック | Draft algorithm design |
| [mesh-rendering/](mesh-rendering/_map.md) | 生成済みmeshで画像を破綻なく描くrenderer contract、WebGL2 primary方針、texture preparation / atlas境界、Canvas2D撤退条件の設計トピック | Draft architecture basis |
| [texture-atlas/](texture-atlas/_map.md) | Texture Atlasの対象抽出、packing algorithm、artifact semantics、runtime remap境界の設計トピック | Active design basis |
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
| Mesh generation | Screen UXは `screen-design/`、生成アルゴリズムは [mesh-generation/](mesh-generation/_map.md) に分離。V2系統のrefinementに加え、輪郭帯を明示生成する `auto-outline-v4-contour-band` を次wave sidecar候補として設計中 |
| Mesh rendering | [mesh-rendering/](mesh-rendering/_map.md) で、mesh内画像描画をCanvas2D実装ではなく共有renderer contractとして定義。PrimaryはWebGL2、Editor Preview / Viewerは共有renderer、Canvas2Dは短期移行足場として扱う |
| Texture Atlas | [texture-atlas/](texture-atlas/_map.md) で、現行shelf packingの課題と次の `single-page-skyline-v1` packing algorithm targetを整理。Texture Atlas Taskの画面UXは [screen-design/screens/texture-atlas-task.md](screen-design/screens/texture-atlas-task.md) を参照 |
| Canvas evaluation | 次の主目標は、Parameter Barを動かしたときにCanvas上の絵そのものが変形・回転・フェードして見えること。AuthoringSession + parameterValues + draft state から [CanvasEvaluatedScene](canvas-evaluation/canvas-evaluation-pipeline-v0.md) を作る評価層を設計中 |
| Parameter preset ecosystem | [parameter-preset-ecosystem.md](parameter-preset-ecosystem.md) で、Core Parameter、Preset / Profile、Ecosystem Facade / Mappingを分離し、Camera Capture / Face Trackingを最重要semantic consumerとして初期role catalogを整理中 |
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
| Pre-Wave51 Editor UX screen spec | Discussion開始。Sylph棚卸後に画面遷移、主要領域、表示情報分類、人間UI/Codex surface境界をユーザー判断で固定する |
| RigControl構造の技術的正体 | Private Prototype内のproject-defined構造として整理継続 |
| Runtime評価セマンティクスの設計判断 | compositionMode、mask opacity 0、missing texture severity、epsilonPolicy は実装前未決 |
| Parameter preset / facade | Draft設計開始。role schema、axis sign convention、normalized/degree-like単位、eyeball/gaze関係、mouth form/vowel関係、smoothing/calibration schemaは未決 |
