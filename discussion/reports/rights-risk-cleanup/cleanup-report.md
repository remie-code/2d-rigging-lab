# Rights Risk Cleanup Report

## 実施日時

2026-05-26 15:57 JST; resumed and updated 2026-05-27 JST, resumed and finalized 2026-05-27 JST

## 根拠文書

- `memo/checkpoint.md`
- `discussion/_conventions.md`
- `discussion/_map.md`
- `discussion/design/_map.md`
- `discussion/design/module-contracts/_map.md`
- `discussion/reports/_map.md`
- 必要に応じて `discussion/acceptance-criteria/`, `discussion/scenarios/`, `discussion/design/`, `discussion/reports/` 配下の関連文書

## 検索した語句

- Project / naming: `Live2D`, `Open Live2D Stack`, `AI-native Live2D`, `Live2D-like`, `Live2D的`, `Live2D系`
- Cubism / affiliation risk: `Cubism`, `Cubism準拠`, `Cubism相当`, `Cubism互換`, `Cubism Editor`, `Cubism SDK`, `Cubism Core`, `SDK/Core`
- File format scope: `.moc3`, `moc3`, `.cmo3`, `cmo3`, `model3.json`, `motion3.json`, `physics3.json`
- Cubism-specific vocabulary: `ArtMesh`, `Deformer`, `Warp Deformer`, `Rotation Deformer`, `ParamAngleX`, `ParamAngleY`, `Angle X/Y`, `デフォーマ`
- Cubism-style parameter IDs: `ParamEyeOpen`, `ParamEyeLOpen`, `ParamEyeROpen`, `ParamMouthOpenY`, `ParamAngleZ`, `ParamHairSway`, and other `Param*` fixture IDs
- Misleading relationship terms: `互換`, `compatible`, `compatibility`, `clone`, `クローン`, `derivative`, `派生`

## 変更した範囲

- Root discussion maps and conventions:
  - `discussion/_conventions.md`
  - `discussion/_map.md`
- Acceptance criteria:
  - `discussion/acceptance-criteria/_map.md`
  - `discussion/acceptance-criteria/00_RootQuestion.md`
  - `discussion/acceptance-criteria/01_RootAcceptanceCriteria.md`
  - `discussion/acceptance-criteria/03_MVP_Acceptance_Criteria.md`
  - `discussion/acceptance-criteria/判断原則.md`
  - `discussion/acceptance-criteria/02_DomainAcceptanceCriteria/_map.md`
  - `discussion/acceptance-criteria/02_DomainAcceptanceCriteria/201_Input_Asset_and_Model_Intake.md` through `225_Open_Source_and_Rights_Hygiene.md`
- Concept:
  - `discussion/concept/_map.md`
  - `discussion/concept/modified_concept.md`
- Design:
  - `discussion/design/_map.md`
  - `discussion/design/ai-agent-connection-and-technology-stack.md`
  - `discussion/design/initial-design-decisions-and-open-questions.md`
  - `discussion/design/module-contract-design-decisions.md`
  - `discussion/design/module-contract-design-goal.md`
  - `discussion/design/module-contract-output-format-template.md`
  - `discussion/design/mvp-authoring-runtime/00-mvp-vertical-slice-architecture.md` through `06-self-review-and-open-questions.md`
  - `discussion/design/module-contracts/_map.md`
  - `discussion/design/module-contracts/ai-command-contract.md`
  - `discussion/design/module-contracts/fixtures-and-contract-tests.md`
  - `discussion/design/module-contracts/gui-operation-contract.md`
  - `discussion/design/module-contracts/module-boundaries.md`
  - `discussion/design/module-contracts/operation-contracts.md`
  - `discussion/design/module-contracts/package-file-format-contract.md`
  - `discussion/design/module-contracts/review-summary.md`
  - `discussion/design/module-contracts/runtime-core-contract.md`
  - `discussion/design/module-contracts/traceability-matrix.md`
  - `discussion/design/module-contracts/typescript-contracts.md`
  - `discussion/design/module-contracts/validator-contract.md`
- Reports:
  - `discussion/reports/_map.md`
  - `discussion/reports/cmo3-moc3-format-spec/_map.md`
  - `discussion/reports/cmo3-moc3-format-spec/moc3-format-report.md`
  - `discussion/reports/cubism-sdk-runtime-structure/_map.md`
  - `discussion/reports/deformer-structure-technology/_map.md`
  - `discussion/reports/deformer-structure-technology/cubism-observable-deformer-semantics.md`
  - `discussion/reports/deformer-structure-technology/mvp-deformer-design-recommendation.md`
  - `discussion/reports/deformer-structure-technology/open-deformation-algorithm-candidates.md`
  - `discussion/reports/runtime-evaluation-semantics-reference/_map.md`
  - `discussion/reports/runtime-evaluation-semantics-reference/cubism-core-framework-evaluation-flow.md`
  - `discussion/reports/runtime-evaluation-semantics-reference/cubism-runtime-input-layers-motion-expression-physics-pose.md`
  - `discussion/reports/runtime-evaluation-semantics-reference/open-stack-runtime-evaluation-semantics-implications.md`
  - `discussion/reports/viewer-preview-reference/_map.md`
  - `discussion/reports/viewer-preview-reference/cubism-editor-preview-observable-features.md`
  - `discussion/reports/viewer-preview-reference/cubism-viewer-runtime-observable-features.md`
  - `discussion/reports/viewer-preview-reference/open-stack-viewer-preview-design-implications.md`
- Scenarios:
  - `discussion/scenarios/_map.md`
  - `discussion/scenarios/03_MVP_Acceptance_Criteria.md`
  - `discussion/scenarios/02_DomainAcceptanceCriteria/_map.md`
  - `discussion/scenarios/02_DomainAcceptanceCriteria/201_Input_Asset_and_Model_Intake.md` through `225_Open_Source_and_Rights_Hygiene.md`, except files without relevant changed text
- New cleanup artifacts:
  - `discussion/reports/rights-risk-cleanup/_map.md`
  - `discussion/reports/rights-risk-cleanup/cleanup-report.md`

## 主な置換方針

- Project name:
  - `Open Live2D Stack` -> `Open 2D Character Rigging Stack`
  - `AI-native Live2D Editor` -> `AI-native 2D Character Rigging Editor`
  - `Live2D-like` / `Live2D的` -> `2D character rigging` / `2Dキャラクターの`
- Cubism-specific implementation vocabulary:
  - `Deformer` / `deformer` -> `RigControl` / `rig control` or `変形制御`
  - `Warp Deformer` -> `warp lattice control`
  - `Rotation Deformer` -> `rotation control`
  - `ArtMesh` -> `drawable mesh`
  - `ParamAngleX` / `ParamAngleY` -> `faceYaw` / `facePitch`
  - `Angle X/Y` -> `face yaw / pitch`
- Compatibility / dependency:
  - Cubism互換をMVP条件、Post-MVPの自然候補、成功条件に見せる記述を削除または `Cubism形式互換は対象外` に変更した。
  - `.moc3`, `.cmo3`, `.model3.json`, `.motion3.json`, `.physics3.json` は実装スコープ外と明記した。
  - Cubism SDK/Core は過去調査・リスク確認に限定し、依存しない方針へ整理した。
  - Cubism形式の読み込み、観測、解析、変換、再構築を、初期成功条件ではなく実装スコープ外として整理した。
  - Cubism Viewer / SDK / Core を、validation oracle、pass/fail oracle、参照実装、比較基準にしない方針へ整理した。
- Project-defined IDs:
  - Cubism-style `Param*` fixture IDs を `eyeOpen`, `leftEyeOpen`, `rightEyeOpen`, `mouthOpen`, `faceRoll`, `hairSway`, `bodyPitch`, `bodyRoll`, `breath` などへ変更した。
  - `standardAlias` / `standard parameter` は `recommendedAlias` / project-defined recommended parameter へ寄せた。
- Fixtures / samples:
  - rights-clean な自作・生成・明示許諾素材のみを使う。
  - 既存2Dキャラクター可動モデル、既存公式/第三者サンプル、第三者権利の不明な素材は fixture / sample / demo に使わない。

## 独立レビュー後の追加修正

Sylphレビューで、active AC / scenario / design に次の残リスクがあると確認した。

- `201`, `211`, `214`, `225` 周辺に、Cubism形式を移行元、参照元、比較元、将来拡張候補として扱えるように読める文言が残っていた。
- MVP AC / scenario、Model Verification、Animation、Runtime Export などに、Cubism Viewer / SDK / Core を検証基準または手順にしている箇所が残っていた。
- MVP / domain scenario に `ParamEyeOpen`, `ParamEyeLOpen`, `ParamMouthOpenY`, `ParamAngleZ`, `ParamHairSway` などの Cubism-style ID が残っていた。
- `Cubism Editor 準拠` と読める設計判断が module contract design に残っていた。

追加修正では、active docs の方針を次に統一した。

- Cubism形式は、入力・解析・変換・再構築・自動変換の対象にしない。
- Cubism Viewer / SDK / Core は Open Stack の pass/fail oracle にしない。
- Open Model Format、Open Runtime、Open Viewer、Open Package Validator、project-defined parameter ID を正とする。
- 既存外部アプリ完全互換は実装スコープ外とし、必要な場合は plugin 境界として別途検討する。

## 追補修正

独立レビューで、active AC / scenario / design 文書にまだ Cubism 形式の取り込み、移行支援、将来互換、SDK/Core 依存、Cubism由来IDを許すように読める箇所が残っていると指摘された。追補で次を修正した。

- `AC-IN-004`, `AC-EXPORT-006`, `AC-WF-006`, `AC-RIGHTS-003/005` を、Cubism形式の入力・解析・変換・再構築・将来拡張を扱わない方針へ揃えた。
- MVP AC / MVP scenario の `ParamEyeOpen`, `ParamMouthOpenY`, `ParamAngleZ` などを `eyeOpen`, `mouthOpen`, `faceRoll` などの project-defined stable ID へ置き換えた。
- `201`, `209`, `210`, `211`, `214`, `215`, `225` の scenario で、`.cmo3`, `.moc3`, `.model3.json`, `.motion3.json`, `.physics3.json` を参照入力、比較出力、移行元、将来互換候補にしないよう修正した。
- module contract 系の互換示唆fixture表現と traceability の移行参照表現を、project-defined / out-of-scope 方針へ修正した。

## 検証結果

追補後、`discussion/acceptance-criteria`, `discussion/scenarios`, `discussion/design`, `memo/checkpoint.md` に対して高リスク語句を再検索した。

- `Open Live2D`, `AI-native Live2D`, `Live2D-like`, `Live2D的`, `Live2D系`, `Cubism準拠`, `Cubism相当`, `Cubism互換`, `ParamAngleX/Y/Z`, `ParamEyeOpen`, `ParamMouthOpenY`, `ParamHairSway` は、active docs から除去済み。
- 残る `ArtMesh` / `Deformer` 系ヒットは、`memo/checkpoint.md` の禁止語リスト、または過去調査URLの path に限定される。
- Cubism形式や SDK/Core への言及は、過去調査・リスク確認・非対応宣言・実装スコープ外宣言に限定される。

## 文脈限定で残した表現

| 表現 | 残した場所 | 理由 |
|------|------------|------|
| `Live2D` / `Cubism` | `memo/checkpoint.md`, `discussion/reports/**`, 一部シナリオの過去調査セクション | 権利リスク、過去調査、非互換・非依存宣言を説明するため |
| `.moc3`, `.cmo3`, `.model3.json`, `.motion3.json`, `.physics3.json` | `memo/checkpoint.md`, report maps, rights / export / verification scenarios | 実装スコープ外であることを明示するため |
| `Cubism SDK/Core` | report maps and historical reports | 過去調査の対象名として残す。実装依存ではない |
| `ArtMesh`, `Deformer`, `Warp Deformer`, `Rotation Deformer`, `ParamAngleX`, `ParamAngleY` | 主に過去調査レポートと `memo/checkpoint.md` の禁止語リスト | 調査対象または禁止対象の用語として必要。実装契約では `drawable mesh`, `rig control`, `faceYaw`, `facePitch` を使う |
| `Param*` style IDs | `memo/checkpoint.md` の禁止語リスト、過去調査セクション | active AC / scenario / design では project-defined ID へ置換済み |

## 残リスク

- 過去調査レポート本文には Live2D / Cubism 固有名詞が多く残る。各 report map と本レポートで文脈限定したが、公開前には本文レベルでさらに圧縮または非公開化する判断が必要。
- `discussion/scenarios/02_DomainAcceptanceCriteria/` には過去調査由来の観測事項が残る。active scenario の検証手順は Open Stack 実用操作へ寄せたが、過去調査セクションが実装仕様として読まれないよう公開前確認が必要。
- 既存ディレクトリ名やファイル名に `cubism`, `moc3`, `deformer` が残る。履歴保持と参照維持のため今回は改名していない。
- `compatibility` / `互換` は Photoshop / split PNG / internal API compatibility など一般用途にも出るため、全文削除はしていない。

## 公開前の人間チェック

- README、package metadata、repository description、release notes、screenshots、demo names に Live2D / Cubism 互換・提携・承認・派生を示す表現がないこと。
- 過去調査レポートを公開範囲に含めるか、private/internal discussion として分離するか。
- fixture / sample / demo の全素材について、作成者、ライセンス、生成・編集手順、再配布可否、AI生成有無の provenance が揃っていること。
- 実装コード、schema、public API、CLI、UI表示に `Deformer`, `ArtMesh`, `ParamAngleX`, `ParamAngleY` などの固有名詞が入り込んでいないこと。
- `.moc3`, `.cmo3`, `.model3.json`, `.motion3.json`, `.physics3.json` の読み書き、解析、変換、再構築が実装・テスト・デモに含まれていないこと。
- Cubism SDK/Core の依存、同梱、ダウンロード手順、サンプル利用が公開成果物に含まれていないこと。

## 最終検索結果

2026-05-27 JST の最終検索では、active AC / scenario / design から次の高リスク表現は除去または否定文脈に限定した。

- `Open Live2D`, `AI-native Live2D`, `Live2D-like`, `Live2D的`
- `Cubism準拠`, `Cubism相当`, `Cubism Editor 準拠`
- `ParamAngleX`, `ParamAngleY`, `ParamAngleZ`, `ParamEyeOpen`, `ParamMouthOpenY`
- Cubism形式を移行元、比較元、参照実装、pass/fail oracle、将来拡張候補として扱う表現

## 権利者確認

公開直前には、必要に応じて Live2D Inc. / Cubism 権利者へ確認・許可取得を検討すること。特に、過去調査レポートを公開する場合、固有名詞・スクリーンショット・サンプル・SDK/Coreへの言及が誤認や権利侵害を招かないか人間が確認する。
