# シナリオ: Private Authoring-to-Viewer Prototype

> 参照元AC: [../acceptance-criteria/03_MVP_Acceptance_Criteria.md](../acceptance-criteria/03_MVP_Acceptance_Criteria.md)
> Status: Accepted draft for current MVP baseline.

## 0. 目的

このシナリオは、現在のMVPである `Private Authoring-to-Viewer Prototype` を、入力素材からprivate viewerでの確認、validation、AI assistantによるdry-run/diff/repair suggestion、demo-safe captureまで一周できるかで検証する。

## 1. Source-of-Truth

### Repository Facts

- Root/MVPの正は `Private 2D Rigging Lab / Prototype` である。
- MVPは、private GUI editor、private runtime core、private viewer、project-defined model package、validator、AI assistant、demo-safe captureを対象にする。

### Design Decisions

- Active scenarioは、project-defined packageとprivate runtimeだけを正にする。
- Cubism形式の検査、読み込み、変換、再構築、互換出力はMVP成功条件に含めない。
- Public SDK、外部API、配布用アプリ、marketplace/registry、既存モデル読み込みはMVP外とする。

### Research Notes

- 過去のCubism調査はprivate research archiveとして扱う。
- 調査内容は設計上の注意点にはなり得るが、MVPの実装仕様や受け入れオラクルではない。

## SC-MVP-001: Rights-clean layered character artからprivate projectを作成できる

### Given

- ユーザーは自作または明示許諾済みのlayered character artを持っている。
- 入力素材にはprovenance、利用区分、demo表示可否が記録されている。

### When

1. ユーザーがprivate GUI editorで新規projectを作成する。
2. ユーザーがlayered character artをimportする。
3. editorがpart、drawable、mesh、texture参照、provenanceをproject-defined packageへ登録する。

### Then

- Projectには入力素材、part構造、drawable mesh、texture参照、provenanceが保存される。
- 権利状態または出典が不明な素材は、validationでNeeds reviewまたはFailになる。
- 既存Cubismモデルや公式/第三者モデルは入力成功条件に含まれない。

### 検証するAC

- AC-MVP-001
- AC-MVP-002
- AC-MVP-003
- AC-MVP-004

## SC-MVP-002: private editorでrig controlとkeyformを作成できる

### Given

- Projectには複数のpartとdrawable meshが登録されている。

### When

1. ユーザーがwarp lattice、rotation handle、mask、opacity、draw orderを設定する。
2. ユーザーがproject-defined parameter presetを作成し、semantic roleを付与する。
3. ユーザーがfaceYaw、facePitch、faceRoll、eyeOpen、mouthOpen、expressionなどのmanual authored parameter gridを編集する。
4. ユーザーがhair、cloth、accessoryなどにsecondary motionを設定する。

### Then

- 各rig controlは、親子関係、対象drawable、parameter接続、keyform、補間設定を持つ。
- face turnは手で作成されたparameter gridとして保存される。
- joint-area validationは、破綻しやすい接続部と隙間をreportできる。
- AIが自動でrigを完成させることはMVP成功条件にしない。

### 検証するAC

- AC-MVP-008
- AC-MVP-009
- AC-MVP-010

## SC-MVP-003: project-defined packageを保存しprivate runtime/viewerで再生できる

### Given

- Projectにはpart、drawable mesh、rig control、parameter、keyform、secondary motionが登録されている。

### When

1. ユーザーがproject-defined packageとして保存する。
2. ユーザーが保存したpackageをprivate GUI editorで再読み込みする。
3. ユーザーがprivate viewerで同じpackageを開く。
4. private runtime coreがparameter入力に対してdrawable状態を評価する。

### Then

- 保存前後でpart、drawable、mesh、rig control、keyform、provenance、validation metadataが保持される。
- private GUI editor previewとprivate viewerは、同じprivate runtime coreの評価結果を共有する。
- runtime snapshotは、デバッグ可能なparameter値、drawable transform、draw order、visibility、secondary motion状態を含む。

### 検証するAC

- AC-MVP-011
- AC-MVP-012

## SC-MVP-004: validatorとAI assistantがdry-run/diff/repair suggestionを返せる

### Given

- Project-defined packageには、意図的な欠落、過大変形、provenance不足、demo表示不可素材が含まれる。

### When

1. ユーザーがvalidatorを実行する。
2. ユーザーがAI assistantに検出結果の説明を求める。
3. AI assistantが修正案をdry-runとして提示する。
4. ユーザーがdiffを確認し、採用または破棄する。

### Then

- Validatorはpackage構造、rights/provenance、parameter範囲、mesh/keyform不整合、demo-safe分類をreportする。
- AI assistantは、実ファイルを直接変更する前にdiffとrepair suggestionを返す。
- AI assistantの提案には、根拠となるvalidation itemと変更対象が結び付いている。
- 自動採用や不可逆変更はMVP成功条件にしない。

### 検証するAC

- AC-MVP-013
- AC-MVP-014

## SC-MVP-005: demo-safe captureを準備できる

### Given

- ユーザーは配信または録画で見せる予定のprojectを持っている。

### When

1. ユーザーがdemo-safe preflightを実行する。
2. Validatorが素材、画面表示、ファイル名、内部形式名、rights/provenance、UI表示文言を確認する。
3. ユーザーがcapture用のprivate viewer sceneを開く。

### Then

- Demo表示可の素材だけでcaptureできる。
- 内部形式、依存関係、既存モデル読み込みを示唆する画面はdemo-safe対象外になる。
- Captureには、private prototypeであり互換ツールではない旨の短いdisclaimerを添えられる。

### 検証するAC

- AC-MVP-015

## SC-MVP-006: MVP外の経路を成功条件にしない

### Given

- ユーザーまたはreviewerが、public配布、外部API、script-only workflow、既存モデル読み込み、Cubism形式対応をMVP成功条件として追加しようとしている。

### When

1. ReviewerがMVP AC、scenario、demo/proposal文書を確認する。
2. MVPに含めるべきPrivate Prototype操作と、別trackへ分離すべき項目を分類する。

### Then

- MVP成功条件はPrivate Prototypeの一周に限定される。
- Streaming Demo Surface、Live2D Feature Proposal、Future Public Clean Subsetは、MVP本体とは別trackとして扱われる。
- Cubism形式、SDK/Core、既存モデル読み込み、公開・配布系機能はMVP外として記録される。

### 検証するAC

- AC-MVP-016

## 2. 未決事項

- MVP用のrights-clean layered character fixtureの最小構成。
- demo-safe preflightでどこまでUI文言を自動検査するか。
- AI assistantのdiff形式と採用UIの最小仕様。
