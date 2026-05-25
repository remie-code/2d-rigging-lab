# シナリオ: AI-native Operation

> 参照元AC: [213_AI-native_Operation.md](../../acceptance-criteria/02_DomainAcceptanceCriteria/213_AI-native_Operation.md)
> 状態: 公式資料レビュー反映ドラフト

## 0. このドラフトの目的

このファイルは、`AC-AI` を「Open Live2D Stack が人間向けUIの自動操作ではなく、モデル制作・実行・検証・配信設定を構造化操作として扱えること」のシナリオへ降ろす。

Cubism Editor / SDK の API や runtime flow は参考事実として扱う。Open Live2D Stack の正は、Open Model Format、AC、シナリオ、validation rule、AI-readable report である。

## 1. 公式事実

- Cubism Editor の External API Integration は、Editor を server、外部アプリを client とし、WebSocket と JSON で request / response / event / error を扱う。
  参照: [Live2D Cubism Editor External API Integration](https://docs.live2d.com/en/cubism-editor-manual/external-application-integration-api/)
- Cubism SDK for Web では、`.model3.json` から参照を取得し、`.moc3` から model instance を作り、texture と renderer を関連付ける loading flow が示されている。
  参照: [About Models (Web)](https://docs.live2d.com/en/cubism-sdk-manual/model-web/)
- Cubism SDK では parameter を ID または index で操作でき、parameter 値の変更、model update、draw の順で runtime 結果へ反映する。
  参照: [Parameter Operation](https://docs.live2d.com/en/cubism-sdk-manual/parameters/)
- Cubism Core は `.moc3` の parameter に応じた vertex 情報などを計算するが、描画機能自体は持たない。
  参照: [Cubism Core API Reference](https://docs.live2d.com/en/cubism-sdk-manual/cubism-core-api-reference/)

## 2. リポジトリ事実

- 参照元ACは、Stack全体の構造化操作、安定識別、構造化応答、AC/仕様/シナリオによる探索空間制約、AIレビュー、人間操作との同じ正解への収束、provenance を要求している。
- `discussion/concept/modified_concept.md` は、AI Agent Interface を Open Live2D Stack の中核的な差別化要素として位置付けている。
- 既存の `222_Open_AI_Agent_Interface.md` は、AIエージェント向け interface そのものを扱う。本ファイルは、Stack横断の操作原則と検証シナリオを扱う。

## 3. 設計判断

- AI操作は、画面座標やスクリーンショットだけに依存する自動化ではなく、Open Stack の第一級概念に対する構造化commandとして扱う。
- Cubism由来の操作・API・IDは参考資料であり、Open Stack の schema や操作体系を無条件に従属させない。
- AI操作は、dry-run、preview、validation、human review、provenance を通じて、人間操作と同じAC・仕様・validation ruleへ収束する必要がある。

## 4. シナリオ記述方針

- Given: model、operation capability、agent権限、AC/シナリオ、validation rule を書く。
- When: AIエージェントまたは automation が実行する構造化操作を書く。
- Then: response、diff、runtime result、validation result、provenance、人間レビュー可能性を書く。

## SC-AI-001: Stack 全体の中核操作を構造化コマンドとして実行できる

### Given: 前提条件

- Open Model Package `RiggedAvatar_A` が存在する。
- Stack は、model format authoring、runtime evaluation、viewer inspection、package validation、VTuber app configuration の操作入口を持つ。
- AIエージェントは、read権限と dry-run edit権限を持つ session を開始している。

### When: Open Stack実用操作

1. AIエージェントが `inspect_model_structure` command を実行する。
2. AIエージェントが `evaluate_runtime_state` command で `ParamAngleX = 0` と `ParamAngleX = 30` の評価を要求する。
3. AIエージェントが `run_package_validation` command を実行する。
4. AIエージェントが `preview_vtuber_mapping` command で tracking input と parameter mapping の候補を確認する。
5. AIエージェントが各commandの結果を1つのoperation reportへまとめる。

### Then: Open Stack期待結果

- 各操作は、対象ID、操作種別、引数、権限、dry-run可否、関連ACまたはシナリオを構造化して持つ。
- 操作結果には、成功/失敗、変更なし/変更あり、runtime result、validation result、warning、次に必要な操作が含まれる。
- AIエージェントは、Editor UI の座標操作を経由せず、Stack のモデル概念を直接対象にできる。
- 操作できない機能は、曖昧な失敗ではなく、未実装、権限不足、前提不足、スコープ外として返される。

### 参照資料

- 公式参考: [Live2D Cubism Editor External API Integration](https://docs.live2d.com/en/cubism-editor-manual/external-application-integration-api/)
- 公式参考: [About Models (Web)](https://docs.live2d.com/en/cubism-sdk-manual/model-web/)

### 検証するACの項目

- AC-AI-001: Stack 全体の中核操作を構造化操作として表現できること
- AC-AI-003: 操作結果を構造化応答として返せること

## SC-AI-002: 操作対象を安定IDで識別し、UI座標に依存せず選択できる

### Given: 前提条件

- `RiggedAvatar_A` には、drawable `EyeL_Iris`、mesh `Mesh_EyeL_Iris`、vertex `vtx_EyeL_Iris_012`、deformer相当構造 `Warp_EyeL_Blink`、part `Part_EyeL`、parameter `ParamEyeLOpen`、keyform `kf_EyeL_Open_0` が存在する。
- 同じモデルを Open Editor と Open Viewer が読み込める。
- AIエージェントは、モデル構造の inspection response を取得できる。

### When: Open Stack実用操作

1. AIエージェントが `EyeL_Iris` に関連する編集可能対象を検索する。
2. AIエージェントが stable ID を使って `vtx_EyeL_Iris_012` を選択する。
3. AIエージェントが `ParamEyeLOpen = 0` の keyform に限定して dry-run vertex adjustment を実行する。
4. AIエージェントが Open Viewer の runtime state で同じ対象IDを再確認する。

### Then: Open Stack期待結果

- drawable、mesh、vertex、deformer相当構造、part、parameter、keyform、runtime state は、安定IDで参照できる。
- Editor と Viewer で対象を表すIDが対応し、人間とAIエージェントが同じ対象を確認できる。
- 画面位置、選択順、表示倍率、UI layout が変わっても、AI操作対象は変わらない。
- dry-run結果は、変更対象、関連する親子関係、影響を受ける runtime state を構造化して返す。

### 参照資料

- 公式参考: [Parameter Operation](https://docs.live2d.com/en/cubism-sdk-manual/parameters/)
- 公式参考: [Cubism Core API Reference](https://docs.live2d.com/en/cubism-sdk-manual/cubism-core-api-reference/)

### 検証するACの項目

- AC-AI-002: 操作対象を安定識別できること
- AC-AI-003: 操作結果を構造化応答として返せること

## SC-AI-003: 操作結果を構造化応答として返し、影響範囲と修復候補を説明できる

### Given: 前提条件

- `RiggedAvatar_A` の `ParamMouthOpenY = 0.5` で、口内 mesh の一部に潰れ候補がある。
- validation rule は、頂点交差、極端な三角形面積、見た目上の穴を検出候補として扱う。
- AIエージェントは、preview操作と validation 実行ができるが、保存権限は持たない。

### When: Open Stack実用操作

1. AIエージェントが `adjust_keyform_vertices` を dry-run で実行する。
2. AIエージェントが変更後の runtime state を評価する。
3. AIエージェントが validation を実行する。
4. AIエージェントが修復候補と残リスクを response として要求する。

### Then: Open Stack期待結果

- response には、command ID、status、対象ID、変更内容、影響範囲、runtime result、validation result が含まれる。
- `Fail`、`Needs review`、`Pass` の状態は、対象ACまたはシナリオと紐付けて返される。
- 修復候補は、実行済み変更ではなく提案として扱われ、ユーザー承認前に package 本体へ適用されない。
- 失敗時は、原因が入力不足、対象不明、validation fail、権限不足、未実装のどれかを区別できる。

### 参照資料

- 公式参考: [Cubism Core API Reference](https://docs.live2d.com/en/cubism-sdk-manual/cubism-core-api-reference/)
- 公式参考: [Verify model integrity](https://docs.live2d.com/cubism-sdk-manual/moc3-consistency/)

### 検証するACの項目

- AC-AI-003: 操作結果を構造化応答として返せること
- AC-AI-005: AIによるレビューを可能にすること

## SC-AI-004: AC・仕様・シナリオで探索空間を制約して編集レビューできる

### Given: 前提条件

- `discussion/scenarios/02_DomainAcceptanceCriteria/212_Model_Verification.md` の検証シナリオが存在する。
- `RiggedAvatar_A` には、目周辺の draw order と clipping mask の検証対象がある。
- AIエージェントは、自由な編集提案を作れるが、AC、仕様、シナリオ、validation rule による制約を受ける設定である。

### When: Open Stack実用操作

1. AIエージェントが目周辺の見た目破綻候補をレビューする。
2. AIエージェントが関連AC、関連シナリオ、validation rule を取得する。
3. AIエージェントが draw order の修正候補を生成する。
4. AIエージェントが候補ごとに、満たすAC、破る可能性があるAC、必要な人間確認を提示する。

### Then: Open Stack期待結果

- AIエージェントの探索空間は、AC、仕様、シナリオ、validation rule によって制約される。
- 公式Cubismの一般挙動と Open Stack の合格条件が異なる場合、公式挙動へ無条件に寄せず、参考事実と設計差分として記録できる。
- 修正候補は、対象ID、意図、想定diff、検証手順、未決事項を含む。
- ACまたはシナリオが不足している場合、AIエージェントは勝手に正解を作らず、AC変更候補または未決事項として返せる。

### 参照資料

- 公式参考: [About Draw Order](https://docs.live2d.com/en/cubism-editor-manual/draworder/)
- 公式参考: [Clipping Mask](https://docs.live2d.com/en/cubism-editor-manual/clipping-mask/)

### 検証するACの項目

- AC-AI-004: 探索空間をAC・仕様・シナリオで制約できること
- AC-AI-005: AIによるレビューを可能にすること

## SC-AI-005: AI操作と人間操作が同じモデル正解へ収束し、provenance を追跡できる

### Given: 前提条件

- 人間制作者が Open Editor で `ParamEyeLOpen = 0` の keyform を補正する操作手順を実行できる。
- AIエージェントも同じ対象に対して構造化commandで補正候補を作れる。
- Open Model Format、validation rule、scenario、runtime evaluation は、人間操作とAI操作の両方に同じ基準として適用される。

### When: Open Stack実用操作

1. 人間制作者が Open Editor で keyform を補正し、package を保存候補として作成する。
2. AIエージェントが同じ補正意図を構造化commandとして実行し、保存候補を作成する。
3. Open Package Validator が両方の保存候補を検証する。
4. AIエージェントが model diff、runtime diff、validation diff、provenance を比較する。

### Then: Open Stack期待結果

- 人間操作とAI操作は、同じ Open Model Format、同じAC、同じvalidation ruleに基づいて評価される。
- 両者の結果が意味論的に同等であれば、操作経路が違っても同じモデル正解へ収束したと判断できる。
- 差分がある場合、model diff、runtime diff、validation diff によって、どの対象・どの評価値・どの検証結果が異なるかを確認できる。
- provenance には、入力、操作主体、commandまたはUI操作、編集意図、承認状態、検証結果、修復提案の由来が記録される。

### 参照資料

- 公式参考: [Live2D Cubism Editor External API Integration](https://docs.live2d.com/en/cubism-editor-manual/external-application-integration-api/)
- 公式参考: [Parameter Operation](https://docs.live2d.com/en/cubism-sdk-manual/parameters/)

### 検証するACの項目

- AC-AI-006: AI操作と人間操作が同じモデル正解に収束すること
- AC-AI-007: provenance を追跡できること

## 5. 未決事項

- AI-native Operation と Open AI Agent Interface の正式な責務分担。
- 操作command、response、validation report、provenance の最小共通 schema。
- Cubism標準 parameter ID を、互換 alias、推奨名、または Open Stack の core schema のどれとして扱うか。
- AI操作の承認フロー、権限、不可逆操作の制限。
