# Domain Acceptance Criteria Scenarios Map

> `discussion/scenarios/02_DomainAcceptanceCriteria/` 直下のファイルだけを示す地図。

---

## 位置付け

この階層は、`discussion/acceptance-criteria/02_DomainAcceptanceCriteria/` に対応するドメイン別シナリオを置く。

公式 Cubism Editor / SDK 資料は参考資料であり、Open Live2D Stack のオラクルではない。シナリオの正は `discussion/concept/modified_concept.md` と `discussion/acceptance-criteria/` 配下のACである。

## 公式資料レビュー状況

| 項目 | 状態 |
|------|------|
| レビュー日 | 2026-05-25 |
| 対象 | Domain 201-225 |
| 結論 | 全Domain ACに対応するシナリオファイルを確認し、不足シナリオを追加済み |
| 追加ファイル | `213_AI-native_Operation.md`, `214_Workflow_Replacement.md` |
| 追加シナリオ | `SC-IN-008`, `SC-DEF-006`, `SC-EXPORT-006`, `SC-VERIFY-011`, 213/214の全シナリオ |
| 参考URL記録 | 追加シナリオ内、および下記「参照した主な公式資料」に記録 |

## 参照した主な公式資料

| Topic | Official reference |
|------|------|
| Editor Manual入口 | [Live2D Cubism Editor Manual](https://docs.live2d.com/cubism-editor-manual/top/) / [English](https://docs.live2d.com/en/cubism-editor-manual/top/) |
| 制作フロー | [Production Flow](https://docs.live2d.com/cubism-editor-manual/workflow/) |
| PSD入力 | [Import PSDs](https://docs.live2d.com/en/cubism-editor-manual/psd-import/), [Notes on PSD creation](https://docs.live2d.com/en/cubism-editor-manual/precautions-for-psd-data/), [About Source Image and Model Guide Image](https://docs.live2d.com/en/cubism-editor-manual/original-picture/) |
| ArtMesh / Mesh | [About ArtMeshes](https://docs.live2d.com/en/cubism-editor-manual/concept-of-artmesh/), [Automatic Mesh Generator](https://docs.live2d.com/en/cubism-editor-manual/mesh-edit/), [Edit Mesh manually](https://docs.live2d.com/en/cubism-editor-manual/mesh-edit-manual/) |
| Parts / draw order / clipping | [About Parts](https://docs.live2d.com/en/cubism-editor-manual/parts/), [About Draw Order](https://docs.live2d.com/en/cubism-editor-manual/draworder/), [Clipping Mask](https://docs.live2d.com/en/cubism-editor-manual/clipping-mask/) |
| Deformer | [About Deformers](https://docs.live2d.com/en/cubism-editor-manual/deformer/), [Warp Deformer](https://docs.live2d.com/en/cubism-editor-manual/making-and-placement-of-warp-deformer/), [Rotation Deformer](https://docs.live2d.com/en/cubism-editor-manual/making-and-rotation-of-rotationdeformer/), [Parent-Child Hierarchy Structure](https://docs.live2d.com/en/cubism-editor-manual/system-of-parent-child-relation/), [Validate Deformer Function](https://docs.live2d.com/en/cubism-editor-manual/convenient-function-deformer/) |
| Parameter / keyform | [About Parameters](https://docs.live2d.com/en/cubism-editor-manual/parameter/), [Parameter Adjustment](https://docs.live2d.com/en/cubism-editor-manual/edit-parameters/), [Keyforms X/Y](https://docs.live2d.com/en/cubism-editor-manual/keyform-xydirection/), [Standard Parameter List](https://docs.live2d.com/en/cubism-editor-manual/standard-parameter-list/) |
| Physics / animation | [About Physics](https://docs.live2d.com/en/cubism-editor-manual/physics-operation/), [Physics Settings](https://docs.live2d.com/en/cubism-editor-manual/physical-operation-setting/), [Animation Preparation](https://docs.live2d.com/en/cubism-editor-manual/animation-preparation/), [Timeline basic operation](https://docs.live2d.com/en/cubism-editor-manual/timeline-basic-operation-dopesheet/) |
| Export / Viewer | [Data for Embedded Use](https://docs.live2d.com/en/cubism-editor-manual/export-moc3-motion3-files/), [Selection of Cubism Viewer](https://docs.live2d.com/en/cubism-editor-manual/selection-of-viewer/), [Loading Models and Motion](https://docs.live2d.com/en/cubism-editor-manual/load-model-and-motion/) |
| Editor external API | [Live2D Cubism Editor External API Integration](https://docs.live2d.com/en/cubism-editor-manual/external-application-integration-api/) |
| SDK Manual入口 | [Live2D Cubism SDK Manual](https://docs.live2d.com/en/cubism-sdk-manual/top/) |
| Runtime loading | [About Models (Web)](https://docs.live2d.com/en/cubism-sdk-manual/model-web/) |
| Runtime parameter / sidecars | [Parameter Operation](https://docs.live2d.com/en/cubism-sdk-manual/parameters/), [Motion](https://docs.live2d.com/en/cubism-sdk-manual/motion/), [Expression](https://docs.live2d.com/en/cubism-sdk-manual/expression/), [Physics](https://docs.live2d.com/en/cubism-sdk-manual/physics/), [Pose](https://docs.live2d.com/en/cubism-sdk-manual/pose/) |
| Core / validation | [Cubism Core API Reference](https://docs.live2d.com/en/cubism-sdk-manual/cubism-core-api-reference/), [Cubism Core](https://docs.live2d.com/en/cubism-sdk-manual/cubism-core/), [Verify model integrity](https://docs.live2d.com/cubism-sdk-manual/moc3-consistency/), [Cubism 5.3 compatibility](https://docs.live2d.com/en/cubism-sdk-manual/compatibility-with-cubism-5-3/) |

## レビューで得た重要な参考事実

- Cubism は `.cmo3` / `.can3` などの authoring file と、`.moc3` / `.model3.json` / sidecar JSON などの runtime file を分ける。Open Stack では authoring format と runtime format を同一にするか分けるかが未決である。
- Cubism SDK は `.model3.json` から参照を取得し、`.moc3` から model instance を作り、parameter 操作後に update / draw する。Open Runtime はこの flow を参考にできるが、Cubism Core には依存しない方針を維持する。
- Cubism標準 parameter ID は motion reuse に役立つ参考事実である。Open Stack では、互換alias、推奨名、core schema のどれとして扱うか判断が必要である。
- Cubism 5.3 の offscreen / blend / render order 変更は、Open Stack で draw order だけではなく render order / offscreen / blend を第一級に扱う必要を示す参考事実である。
- MotionSync / LipSync は公式 workflow に存在するが、`modified_concept.md` では当面スコープ外である。既存 `SC-FACE-007` は参考・将来拡張候補としてスコープ注記を追加済み。

## 直下のファイル

| Path | Role | Review status |
|------|------|------|
| [_map.md](_map.md) | この階層の入口地図 | 公式資料レビュー結果を反映済み |
| [201_Input_Asset_and_Model_Intake.md](201_Input_Asset_and_Model_Intake.md) | 入力素材・既存モデル受け入れのシナリオ | `SC-IN-008` を追加し、Open Model Package読み込みを補完済み |
| [202_Drawable_Structure.md](202_Drawable_Structure.md) | 描画要素構造のシナリオ | 既存シナリオでAC充足。追加なし |
| [203_Mesh_Structure.md](203_Mesh_Structure.md) | メッシュ構造のシナリオ | 既存シナリオでAC充足。公式資料由来の詳細操作は将来細分化候補 |
| [204_Deformation_Control_Structure.md](204_Deformation_Control_Structure.md) | 変形制御構造のシナリオ | `SC-DEF-006` を追加し、parameter接続検証を補完済み |
| [205_Parameter_and_Keyform_Semantics.md](205_Parameter_and_Keyform_Semantics.md) | パラメータとキーフォームのシナリオ | 既存シナリオでAC充足。追加なし |
| [206_Part_Visibility_and_Composition_Semantics.md](206_Part_Visibility_and_Composition_Semantics.md) | パーツ、表示、構成状態のシナリオ | 既存シナリオでAC充足。composition/blend/offscreenはAC拡張候補 |
| [207_Facial_Motion_Modeling.md](207_Facial_Motion_Modeling.md) | 顔可動のシナリオ | 既存シナリオでAC充足。`SC-FACE-007` にLipSyncスコープ注記を追加 |
| [208_Body_and_Secondary_Motion_Modeling.md](208_Body_and_Secondary_Motion_Modeling.md) | 身体・副次部位可動のシナリオ | 既存シナリオでAC充足。追加なし |
| [209_Physics_and_Dynamic_Behavior.md](209_Physics_and_Dynamic_Behavior.md) | 物理・動的挙動のシナリオ | 既存シナリオでAC充足。`.physics3.json` は参考・将来互換論点として整理 |
| [210_Animation_and_Timeline_Production.md](210_Animation_and_Timeline_Production.md) | アニメーション・タイムライン制作のシナリオ | 既存シナリオでAC充足。ID変更後のanimation link破綻などは将来細分化候補 |
| [211_Runtime_Export_and_Compatibility.md](211_Runtime_Export_and_Compatibility.md) | Open Model Package 出力と runtime readiness のシナリオ | `SC-EXPORT-006` を追加し、Cubism互換非要求を明示 |
| [212_Model_Verification.md](212_Model_Verification.md) | モデル検証のシナリオ | `SC-VERIFY-011` を追加し、AI-readable reportを補完済み |
| [213_AI-native_Operation.md](213_AI-native_Operation.md) | Stack横断のAI-native操作シナリオ | 新規作成済み |
| [214_Workflow_Replacement.md](214_Workflow_Replacement.md) | Cubism非依存ワークフローのシナリオ | 新規作成済み |
| [215_Open_Model_Format.md](215_Open_Model_Format.md) | Open Model Format と Open Model Package のシナリオ | 既存シナリオでAC充足。manifest詳細は将来仕様化候補 |
| [216_Open_Runtime_Core.md](216_Open_Runtime_Core.md) | Open Runtime / Core のシナリオ | 既存シナリオでAC充足。evaluation lifecycle詳細は将来細分化候補 |
| [217_Open_SDK.md](217_Open_SDK.md) | Open SDK のシナリオ | 既存シナリオでAC充足。ID/index APIなどは将来細分化候補 |
| [218_Open_Viewer.md](218_Open_Viewer.md) | Open Viewer のシナリオ | 既存シナリオでAC充足。Cubism reference import modeは将来候補 |
| [219_Open_VTuber_App.md](219_Open_VTuber_App.md) | Open VTuber App のシナリオ | 既存シナリオでAC充足。OBS出力、plugin、physics strength、idle motionはAC拡張候補 |
| [220_Open_Package_Validator.md](220_Open_Package_Validator.md) | Open Package Validator のシナリオ | 既存シナリオでAC充足。追加なし |
| [221_Open_External_API.md](221_Open_External_API.md) | Open External API のシナリオ | 既存シナリオでAC充足。atomic frame update等は将来細分化候補 |
| [222_Open_AI_Agent_Interface.md](222_Open_AI_Agent_Interface.md) | AI Agent Interface のシナリオ | 既存シナリオでAC充足。Cubism由来観測の参考事実ラベルは将来強化候補 |
| [223_Open_Sample_Model_Set.md](223_Open_Sample_Model_Set.md) | Open Source公開可能なsample model setのシナリオ | 既存シナリオでAC充足。追加なし |
| [224_Documentation_Tutorial_AC_System.md](224_Documentation_Tutorial_AC_System.md) | Documentation / Tutorial / AC System のシナリオ | 既存シナリオでAC充足。AC-DOC-003表題は文言整理候補 |
| [225_Open_Source_and_Rights_Hygiene.md](225_Open_Source_and_Rights_Hygiene.md) | Open Source公開可能性と権利・依存分離のシナリオ | 既存シナリオでAC充足。追加なし |

## AC変更候補

- `AC-FACE`: MotionSync / LipSync は当面スコープ外のため、顔可動ACに音声リップシンクを含めるか、将来拡張として明示分離するか確認が必要。
- `AC-PART`: ドメイン名は composition semantics を含むが、AC本文は display / pose / runtime再現中心である。blend / offscreen / render-order を明示するAC追加候補がある。
- `AC-DEF-005`: parameter接続が検証対象として重要なら、独立ACへ分ける候補がある。
- `AC-VTUBER`: concept上の OBS向け出力、plugin連携、physics strength、idle motion をACへ追加するか、明示的に後回しにするか判断が必要。
- `AC-DOC-003`: 表題は runtime / SDK / Viewer / Editor manual だが、本文は VTuber App / Validator も含む。表題の文言整理候補。
- `AC-VERIFY-006`: AI-readable report の最小語彙として status、severity、target ID、AC/scenario links、evidence、repair candidate、provenance を明文化する候補。

## 次の行動

1. AC変更候補を Salamander / ユーザー判断へ回すか決める。
2. 将来細分化候補を MVP仕様化時に、Open Model Format / Runtime / Viewer / Validator の具体仕様へ落とす。
3. Cubism reference import mode、render-order/offscreen/blend、VTuber app配信profileの優先度を検討する。

## 未決事項

| 項目 | 状態 |
|------|------|
| authoring format と runtime format を同一にするか分けるか | 未決 |
| Deformer相当構造をCubism類似にするか、AI-nativeな別構造にするか | 未決 |
| Cubism標準 parameter ID を互換alias、推奨名、core schema のどれにするか | 未決 |
| Open VTuber App のOBS出力、plugin、physics strength、idle motionをACへ追加するか | 未決 |
| render order / offscreen / blend をどのDomain ACで第一級に扱うか | 未決 |
