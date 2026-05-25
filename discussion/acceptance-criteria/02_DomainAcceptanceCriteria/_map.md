# Domain Acceptance Criteria Map

> `discussion/acceptance-criteria/02_DomainAcceptanceCriteria/` 直下のファイルだけを示す地図。

---

## 位置付け

この階層は、Open Live2D Stack のドメイン別ACを保持する。

Domain 01-14 は、旧AI-native Live2D Editor向けACを Open Stack 前提へ再編したもの。

Domain 15-25 は、Open Model Format、Runtime、Viewer、SDK、VTuber App、Validator、External API、AI Agent Interface、Sample Model、Documentation、Rights Hygiene を補うために追加したもの。

## 直下のファイル

| Path | Domain | Status |
|------|--------|--------|
| [_map.md](_map.md) | この階層の入口地図 | 更新済み |
| [201_Input_Asset_and_Model_Intake.md](201_Input_Asset_and_Model_Intake.md) | Input Asset and Model Intake | Open Stack 前提へ更新済み |
| [202_Drawable_Structure.md](202_Drawable_Structure.md) | Drawable Structure | Open Editor文脈へ用語更新済み |
| [203_Mesh_Structure.md](203_Mesh_Structure.md) | Mesh Structure | Open Editor文脈へ用語更新済み |
| [204_Deformation_Control_Structure.md](204_Deformation_Control_Structure.md) | Deformation Control Structure | Open Editor文脈へ用語更新済み |
| [205_Parameter_and_Keyform_Semantics.md](205_Parameter_and_Keyform_Semantics.md) | Parameter and Keyform Semantics | Open Editor文脈へ用語更新済み |
| [206_Part_Visibility_and_Composition_Semantics.md](206_Part_Visibility_and_Composition_Semantics.md) | Part, Visibility, and Composition Semantics | Open Editor文脈へ用語更新済み |
| [207_Facial_Motion_Modeling.md](207_Facial_Motion_Modeling.md) | Facial Motion Modeling | Open Editor文脈へ用語更新済み |
| [208_Body_and_Secondary_Motion_Modeling.md](208_Body_and_Secondary_Motion_Modeling.md) | Body and Secondary Motion Modeling | Open Editor文脈へ用語更新済み |
| [209_Physics_and_Dynamic_Behavior.md](209_Physics_and_Dynamic_Behavior.md) | Physics and Dynamic Behavior | Open Editor文脈へ用語更新済み |
| [210_Animation_and_Timeline_Production.md](210_Animation_and_Timeline_Production.md) | Animation and Timeline Production | Open Editor文脈へ用語更新済み |
| [211_Runtime_Export_and_Compatibility.md](211_Runtime_Export_and_Compatibility.md) | Open Model Package Export and Runtime Readiness | Open Package / Open Runtime 前提へ更新済み |
| [212_Model_Verification.md](212_Model_Verification.md) | Model Verification | Open Runtime / Viewer / Validator 前提へ更新済み |
| [213_AI-native_Operation.md](213_AI-native_Operation.md) | AI-native Operation | Stack横断のAI操作へ更新済み |
| [214_Workflow_Replacement.md](214_Workflow_Replacement.md) | Workflow Independence | Cubism非依存ワークフローへ更新済み |
| [215_Open_Model_Format.md](215_Open_Model_Format.md) | Open Model Format | 新規追加 |
| [216_Open_Runtime_Core.md](216_Open_Runtime_Core.md) | Open Runtime / Core | 新規追加 |
| [217_Open_SDK.md](217_Open_SDK.md) | Open SDK | 新規追加 |
| [218_Open_Viewer.md](218_Open_Viewer.md) | Open Viewer | 新規追加 |
| [219_Open_VTuber_App.md](219_Open_VTuber_App.md) | Open VTuber App | 新規追加 |
| [220_Open_Package_Validator.md](220_Open_Package_Validator.md) | Open Package Validator | 新規追加 |
| [221_Open_External_API.md](221_Open_External_API.md) | Open External API | 新規追加 |
| [222_Open_AI_Agent_Interface.md](222_Open_AI_Agent_Interface.md) | Open AI Agent Interface | 新規追加 |
| [223_Open_Sample_Model_Set.md](223_Open_Sample_Model_Set.md) | Open Sample Model Set | 新規追加 |
| [224_Documentation_Tutorial_AC_System.md](224_Documentation_Tutorial_AC_System.md) | Documentation / Tutorial / AC System | 新規追加 |
| [225_Open_Source_and_Rights_Hygiene.md](225_Open_Source_and_Rights_Hygiene.md) | Open Source and Rights Hygiene | 新規追加 |

## 次の行動

1. Domain 15-25 のシナリオ化優先順位を決める
2. Domain 01-10, 12 の既存シナリオを Open Stack 前提で再確認する
3. MVPに直結する Domain 15, 16, 18, 20, 23 を先に精緻化するか検討する

## 未決事項

| 項目 | 状態 |
|------|------|
| authoring format と runtime format を同一にするか分けるか | 未決 |
| Deformer相当構造をCubism類似にするか、AI-nativeな別構造にするか | 未決 |
| Domain 15-25 のシナリオ粒度 | 未決 |
