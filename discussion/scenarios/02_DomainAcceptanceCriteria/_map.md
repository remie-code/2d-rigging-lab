# Domain Acceptance Criteria Scenarios Map

> `discussion/scenarios/02_DomainAcceptanceCriteria/` 直下のファイルだけを示す地図。

---

## 位置付け

この階層は、`discussion/acceptance-criteria/02_DomainAcceptanceCriteria/` に対応するドメイン別シナリオを置く。

現在の既存シナリオは、Cubism参照操作を材料として残しつつ、Open Live2D Stack の期待結果へ読み替える途中状態である。

Domain 15-25 は、Open Live2D Stack 自身の Model Format / Runtime / SDK / Viewer / VTuber App / Validator / API / AI Agent Interface / Sample Model / Documentation / Rights Hygiene を正とする新規シナリオとして起草済みである。

## 直下のファイル

| Path | Role | Status |
|------|------|--------|
| [_map.md](_map.md) | この階層の入口地図 | 更新済み |
| [201_Input_Asset_and_Model_Intake.md](201_Input_Asset_and_Model_Intake.md) | 入力素材・既存モデル受け入れのシナリオ | `.cmo3` 非要求とCubism runtime package移行元扱いを反映済み |
| [202_Drawable_Structure.md](202_Drawable_Structure.md) | 描画要素構造のシナリオ | 用語更新済み・詳細再確認待ち |
| [203_Mesh_Structure.md](203_Mesh_Structure.md) | メッシュ構造のシナリオ | 用語更新済み・詳細再確認待ち |
| [204_Deformation_Control_Structure.md](204_Deformation_Control_Structure.md) | 変形制御構造、ワープデフォーマ、回転デフォーマ、親子関係、検証のシナリオ | 用語更新済み・Deformer相当概念の再設計待ち |
| [205_Parameter_and_Keyform_Semantics.md](205_Parameter_and_Keyform_Semantics.md) | パラメータとキーフォームのシナリオ | 用語更新済み・詳細再確認待ち |
| [206_Part_Visibility_and_Composition_Semantics.md](206_Part_Visibility_and_Composition_Semantics.md) | パーツ、表示、構成状態のシナリオ | 用語更新済み・詳細再確認待ち |
| [207_Facial_Motion_Modeling.md](207_Facial_Motion_Modeling.md) | 顔可動のシナリオ | 用語更新済み・詳細再確認待ち |
| [208_Body_and_Secondary_Motion_Modeling.md](208_Body_and_Secondary_Motion_Modeling.md) | 身体・副次部位可動のシナリオ | 用語更新済み・詳細再確認待ち |
| [209_Physics_and_Dynamic_Behavior.md](209_Physics_and_Dynamic_Behavior.md) | 物理・動的挙動のシナリオ | 用語更新済み・詳細再確認待ち |
| [210_Animation_and_Timeline_Production.md](210_Animation_and_Timeline_Production.md) | アニメーション・タイムライン制作のシナリオ | 用語更新済み・MotionSync/LipSync境界の再確認待ち |
| [211_Runtime_Export_and_Compatibility.md](211_Runtime_Export_and_Compatibility.md) | Open Model Package 出力と runtime readiness のシナリオ | Open Package / Open Runtime 前提へ更新済み |
| [212_Model_Verification.md](212_Model_Verification.md) | モデル検証のシナリオ | 用語更新済み・Open Validator前提の詳細再確認待ち |
| [215_Open_Model_Format.md](215_Open_Model_Format.md) | Open Model Format と Open Model Package のシナリオ | 新規Open Stackドメイン 起草済み |
| [216_Open_Runtime_Core.md](216_Open_Runtime_Core.md) | Open Runtime / Core の読み込み・評価・描画統合・inspectionのシナリオ | 新規Open Stackドメイン 起草済み |
| [217_Open_SDK.md](217_Open_SDK.md) | Web / TypeScript SDK、model loading、parameter control、rendering integrationのシナリオ | 新規Open Stackドメイン 起草済み |
| [218_Open_Viewer.md](218_Open_Viewer.md) | Open Viewer による読み込み・操作・inspection・validation reportのシナリオ | 新規Open Stackドメイン 起草済み |
| [219_Open_VTuber_App.md](219_Open_VTuber_App.md) | Open Model Format前提の配信用アプリ、tracking mapping、AI設定補助のシナリオ | 新規Open Stackドメイン 起草済み |
| [220_Open_Package_Validator.md](220_Open_Package_Validator.md) | Open Package Validator のschema・参照・mesh・runtime load・AI-readable reportのシナリオ | 新規Open Stackドメイン 起草済み |
| [221_Open_External_API.md](221_Open_External_API.md) | parameter、model state、automation、WebSocket/HTTP/plugin境界のシナリオ | 新規Open Stackドメイン 起草済み |
| [222_Open_AI_Agent_Interface.md](222_Open_AI_Agent_Interface.md) | AIエージェント向けの構造化観測・操作・diff・test・repair/provenanceのシナリオ | 新規Open Stackドメイン 起草済み |
| [223_Open_Sample_Model_Set.md](223_Open_Sample_Model_Set.md) | Open Source公開可能なsample model setとvalidation failure sampleのシナリオ | 新規Open Stackドメイン 起草済み |
| [224_Documentation_Tutorial_AC_System.md](224_Documentation_Tutorial_AC_System.md) | Documentation / Tutorial / AC Systemを行動可能な正解として維持するシナリオ | 新規Open Stackドメイン 起草済み |
| [225_Open_Source_and_Rights_Hygiene.md](225_Open_Source_and_Rights_Hygiene.md) | Open Source公開可能性と権利・依存分離のシナリオ | 新規Open Stackドメイン 起草済み |

## 次の行動

1. Domain 15-25 のシナリオを、Open Model Format / Runtime / Viewer / Validator の最小仕様へ落とす
2. 既存 Domain 01-10, 12 のシナリオから `.moc3` 互換出力前提を洗い出す
3. Domain 13-14 のシナリオ化方針を決める

## 未決事項

| 項目 | 状態 |
|------|------|
| 公式マニュアル由来の操作メモを各シナリオファイル内に置くか、別トピックへ分離するか | 未決 |
| 新規 Open Stack ドメインのシナリオID接頭辞 | Domain 15-25 では `SC-FORMAT` / `SC-RUNTIME` / `SC-SDK` / `SC-VIEWER` / `SC-VTUBER` / `SC-VALIDATOR` / `SC-API` / `SC-AGENT` / `SC-SAMPLE` / `SC-DOC` / `SC-RIGHTS` を仮採用 |
