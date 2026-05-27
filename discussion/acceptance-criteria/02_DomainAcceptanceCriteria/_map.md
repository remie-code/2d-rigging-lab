# Domain Acceptance Criteria Map

> `discussion/acceptance-criteria/02_DomainAcceptanceCriteria/` 直下のファイルだけを示す地図。

---

## 位置付け

この階層は、ドメイン別ACを保持する。

現在のRoot/MVP baselineは Private 2D Rigging Lab / Prototype である。Domain AC本文は、Private PrototypeのCurrent範囲、Optional範囲、Future / out of current MVP範囲へ整理済みである。

## 直下のファイル

| Path | Domain | Status |
|------|--------|--------|
| [_map.md](_map.md) | この階層の入口地図 | Private baselineの注意書きへ更新済み |
| [201_Input_Asset_and_Model_Intake.md](201_Input_Asset_and_Model_Intake.md) | Input Asset and Project Package Intake | Current / Private Prototypeへ整理済み |
| [202_Drawable_Structure.md](202_Drawable_Structure.md) | Drawable Structure | Current / Private Prototypeへ整理済み |
| [203_Mesh_Structure.md](203_Mesh_Structure.md) | Mesh Structure | Current / Private Prototypeへ整理済み |
| [204_Deformation_Control_Structure.md](204_Deformation_Control_Structure.md) | Deformation Control Structure | Current / Private Prototypeへ整理済み |
| [205_Parameter_and_Keyform_Semantics.md](205_Parameter_and_Keyform_Semantics.md) | Parameter and Keyform Semantics | Current / project-defined presetへ整理済み |
| [206_Part_Visibility_and_Composition_Semantics.md](206_Part_Visibility_and_Composition_Semantics.md) | Part, Visibility, and Composition Semantics | Current / Private Prototypeへ整理済み |
| [207_Facial_Motion_Modeling.md](207_Facial_Motion_Modeling.md) | Facial Motion Modeling | Current / manual authored parameter gridへ整理済み |
| [208_Body_and_Secondary_Motion_Modeling.md](208_Body_and_Secondary_Motion_Modeling.md) | Body and Secondary Motion Modeling | Current / manual seam + hairSway keyformへ整理済み |
| [209_Physics_and_Dynamic_Behavior.md](209_Physics_and_Dynamic_Behavior.md) | Open Dynamics and Secondary Motion | Current MVP for Minimum Open Dynamics v1確定版へ更新済み |
| [210_Animation_and_Timeline_Production.md](210_Animation_and_Timeline_Production.md) | Animation and Timeline Production | Optional / current MVP外へ分類済み |
| [211_Runtime_Export_and_Compatibility.md](211_Runtime_Export_and_Compatibility.md) | Project Package Save and Runtime Readiness | Current / project-defined packageへ整理済み |
| [212_Model_Verification.md](212_Model_Verification.md) | Model Verification | Current / demo-safe分類を含め整理済み |
| [213_AI-native_Operation.md](213_AI-native_Operation.md) | AI Assistant Operation | Current / assistant・validatorへ整理済み |
| [214_Workflow_Replacement.md](214_Workflow_Replacement.md) | Private Workflow Independence | Current / historical filenameのみ維持 |
| [215_Open_Model_Format.md](215_Open_Model_Format.md) | Project-defined Model Package | Current / historical filenameのみ維持 |
| [216_Open_Runtime_Core.md](216_Open_Runtime_Core.md) | Private Runtime Core | Current / historical filenameのみ維持 |
| [217_Open_SDK.md](217_Open_SDK.md) | Future SDK Boundary | Future / current MVP外へ分類済み |
| [218_Open_Viewer.md](218_Open_Viewer.md) | Private Viewer | Current / historical filenameのみ維持 |
| [219_Open_VTuber_App.md](219_Open_VTuber_App.md) | Future Streaming App Boundary | Future / current MVP外へ分類済み |
| [220_Open_Package_Validator.md](220_Open_Package_Validator.md) | Private Package Validator | Current / historical filenameのみ維持 |
| [221_Open_External_API.md](221_Open_External_API.md) | Future Integration API Boundary | Future / current MVP外へ分類済み |
| [222_Open_AI_Agent_Interface.md](222_Open_AI_Agent_Interface.md) | AI Assistant Interface | Current / assistant・validatorへ整理済み |
| [223_Open_Sample_Model_Set.md](223_Open_Sample_Model_Set.md) | Future Clean Fixture and Sample Boundary | Future / private fixture以外はcurrent MVP外 |
| [224_Documentation_Tutorial_AC_System.md](224_Documentation_Tutorial_AC_System.md) | Documentation / Tutorial / AC System | Current / Private baselineへ整理済み |
| [225_Open_Source_and_Rights_Hygiene.md](225_Open_Source_and_Rights_Hygiene.md) | Demo and Proposal Hygiene | Current / historical filenameのみ維持 |

## 次の行動

1. 実装時にCurrent domainをmodule contract / testsへ落とす。
2. Future domainを再開する場合は、別途ユーザー判断、rights/dependency review、scope再定義を行う。
3. Demo/proposal運用時にhygiene ruleを更新する。

## 未決事項

| 項目 | 状態 |
|------|------|
| Domain ACのmemo対応 | 完了 |
| Future Public Clean Subset 用Domain | SDK/API/配信アプリ/sample公開をFuture分類として保持。詳細設計は別課題 |
