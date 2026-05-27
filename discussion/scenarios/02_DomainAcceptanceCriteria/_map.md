# Domain Acceptance Criteria Scenarios Map

> `discussion/scenarios/02_DomainAcceptanceCriteria/` 直下のファイルだけを示す地図。

---

## 位置付け

この階層は、`discussion/acceptance-criteria/02_DomainAcceptanceCriteria/` に対応するドメイン別シナリオを置く。

現在のRoot/MVP baselineは Private 2D Rigging Lab / Prototype である。Domain scenarioは、Current / Optional / Future分類へ整理済みである。

Live2D / Cubism 関連資料は過去調査・リスク確認用であり、Private Prototype のオラクルではない。シナリオの正は [../../concept/modified_concept.md](../../concept/modified_concept.md)、[../../acceptance-criteria/00_RootQuestion.md](../../acceptance-criteria/00_RootQuestion.md)、[../../acceptance-criteria/01_RootAcceptanceCriteria.md](../../acceptance-criteria/01_RootAcceptanceCriteria.md)、[../../acceptance-criteria/03_MVP_Acceptance_Criteria.md](../../acceptance-criteria/03_MVP_Acceptance_Criteria.md) である。

## 直下のファイル

| Path | Role | Current migration status |
|------|------|------|
| [_map.md](_map.md) | この階層の入口地図 | Private baselineの注意書きへ更新済み |
| [201_Input_Asset_and_Model_Intake.md](201_Input_Asset_and_Model_Intake.md) | 入力素材・project package受け入れのシナリオ | Private Prototypeへ更新済み |
| [202_Drawable_Structure.md](202_Drawable_Structure.md) | 描画要素構造のシナリオ | Private Prototypeへ更新済み |
| [203_Mesh_Structure.md](203_Mesh_Structure.md) | メッシュ構造のシナリオ | Private Prototypeへ更新済み |
| [204_Deformation_Control_Structure.md](204_Deformation_Control_Structure.md) | 変形制御構造のシナリオ | Private Prototypeへ更新済み |
| [205_Parameter_and_Keyform_Semantics.md](205_Parameter_and_Keyform_Semantics.md) | パラメータとキーフォームのシナリオ | project-defined presetへ更新済み |
| [206_Part_Visibility_and_Composition_Semantics.md](206_Part_Visibility_and_Composition_Semantics.md) | パーツ、表示、構成状態のシナリオ | Private Prototypeへ更新済み |
| [207_Facial_Motion_Modeling.md](207_Facial_Motion_Modeling.md) | 顔可動のシナリオ | manual authored parameter gridへ更新済み |
| [208_Body_and_Secondary_Motion_Modeling.md](208_Body_and_Secondary_Motion_Modeling.md) | 身体・副次部位可動のシナリオ | manual seam + hairSway keyformへ更新済み |
| [209_Physics_and_Dynamic_Behavior.md](209_Physics_and_Dynamic_Behavior.md) | 動的挙動のシナリオ | Current MVP for Minimum Open Dynamics v1 RuntimeState evidenceへ更新済み |
| [210_Animation_and_Timeline_Production.md](210_Animation_and_Timeline_Production.md) | アニメーション・タイムライン制作のシナリオ | Optional / current MVP外へ分類済み |
| [211_Runtime_Export_and_Compatibility.md](211_Runtime_Export_and_Compatibility.md) | package save/runtime readinessのシナリオ | project-defined packageへ更新済み |
| [212_Model_Verification.md](212_Model_Verification.md) | モデル検証のシナリオ | demo-safe分類を含め更新済み |
| [213_AI-native_Operation.md](213_AI-native_Operation.md) | AI assistant / validator操作シナリオ | assistant / validator語彙へ更新済み |
| [214_Workflow_Replacement.md](214_Workflow_Replacement.md) | private workflow independenceシナリオ | Private Prototypeへ更新済み。historical filenameのみ維持 |
| [215_Open_Model_Format.md](215_Open_Model_Format.md) | project-defined model packageシナリオ | Private Prototypeへ更新済み。historical filenameのみ維持 |
| [216_Open_Runtime_Core.md](216_Open_Runtime_Core.md) | private runtime coreシナリオ | Private Prototypeへ更新済み。historical filenameのみ維持 |
| [217_Open_SDK.md](217_Open_SDK.md) | future SDK boundaryシナリオ | Future / current MVP外へ分類済み |
| [218_Open_Viewer.md](218_Open_Viewer.md) | private viewerシナリオ | Private Prototypeへ更新済み。historical filenameのみ維持 |
| [219_Open_VTuber_App.md](219_Open_VTuber_App.md) | future streaming app boundaryシナリオ | Future / current MVP外へ分類済み |
| [220_Open_Package_Validator.md](220_Open_Package_Validator.md) | private package validatorシナリオ | Private Prototypeへ更新済み。historical filenameのみ維持 |
| [221_Open_External_API.md](221_Open_External_API.md) | future integration API boundaryシナリオ | Future / current MVP外へ分類済み |
| [222_Open_AI_Agent_Interface.md](222_Open_AI_Agent_Interface.md) | AI assistant interfaceシナリオ | assistant / validator語彙へ更新済み |
| [223_Open_Sample_Model_Set.md](223_Open_Sample_Model_Set.md) | future clean fixture/sample boundaryシナリオ | Future / private fixture以外はcurrent MVP外 |
| [224_Documentation_Tutorial_AC_System.md](224_Documentation_Tutorial_AC_System.md) | documentationシナリオ | Private baselineとmemo対応完了確認へ更新済み |
| [225_Open_Source_and_Rights_Hygiene.md](225_Open_Source_and_Rights_Hygiene.md) | demo/proposal hygieneシナリオ | Demo and Proposal Hygieneへ更新済み |

## 次の行動

1. Current scenarioを実装時のtest/contractへ落とす。
2. Future scenarioを再開する場合は、別途ユーザー判断、scope再定義、rights/dependency reviewを行う。
3. Demo/proposal運用時に、demo policyとproposal templateを更新する。

## 未決事項

| 項目 | 状態 |
|------|------|
| Cubism参照操作の扱い | Scenario内では非対応・private research archive文脈へ限定済み |
| 公開・配布系scenario | Future / out of current MVP扱いで保持 |
