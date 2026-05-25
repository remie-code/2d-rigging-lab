# シナリオ: Open AI Agent Interface

> 参照元AC: [222_Open_AI_Agent_Interface.md](../../acceptance-criteria/02_DomainAcceptanceCriteria/222_Open_AI_Agent_Interface.md)
> 状態: 新規Open Stackドメイン シナリオドラフト

## 0. このドラフトの目的

このファイルは、`AC-AGENT` を AIエージェントが Open Live2D Stack のモデル制作・編集・検証を行うための構造化インターフェースのシナリオへ降ろす。

このドメインでは、構造化観測、構造化操作、diff、validation report、repair suggestion、provenance を中核に置く。スクリーンショットや自然文だけに依存した操作は成功条件にしない。

## 1. リポジトリ事実

- 参照元ACは、model structure inspection、operation command、diff extraction、scenario-based test execution、repair suggestion と provenance tracking を要求している。
- `discussion/concept/modified_concept.md` は、AI Agent Interface を Open Live2D Stack の中核的な差別化要素として位置付けている。
- Open AI Agent Interface は、Open Model Format、Runtime、Viewer、Validator、External API と横断的に接続する。

## 2. 設計判断

- AIエージェントの操作は、UI操作の録画ではなく、Open Stack のモデル概念に対する構造化commandとして扱う。
- エージェントが実行した変更は、diff と provenance によって人間がレビューできる必要がある。
- 修復候補は提案と実変更を分離し、勝手な不可逆変更を成功条件にしない。

## 3. シナリオ記述方針

- Given: model、validation report、agent権限、操作対象を書く。
- When: inspect、command実行、diff抽出、scenario test、repair suggestion生成を書く。
- Then: 構造化観測、実行結果、差分、検証結果、provenance を観測可能に書く。

## SC-AGENT-001: model structure と runtime state を構造化観測できる

### Given: 前提条件

- `RiggedAvatar_A` は Open Viewer または Runtime に読み込まれている。
- model には、part、drawable、mesh、parameter、keyform、deformer相当構造、expression、physics、motion が含まれる。
- AI Agent Interface は read権限を持つagent sessionを開始できる。

### When: Open Stack実用操作

1. AIエージェントが model structure inspection を要求する。
2. AIエージェントが `ParamAngleX = 0` の runtime state snapshot を要求する。
3. AIエージェントが validation result と diagnostics を要求する。

### Then: Open Stack期待結果

- inspection response には、各要素のID、種類、親子関係、参照先、編集可能性、関連ACまたは検証項目が含まれる。
- runtime state snapshot には、parameter値、評価済みdrawable state、mask state、警告/エラーが含まれる。
- validation result は、check ID、status、対象ID、根拠、修復候補を含む。
- AIエージェントは、自然文説明だけでなく、機械処理可能な構造として対象を選択できる。

### 検証するACの項目

- AC-AGENT-001: model structure inspection を提供できること

## SC-AGENT-002: 構造化 operation command で編集・検証・保存を実行できる

### Given: 前提条件

- `RiggedAvatar_A` の左目drawable `EyeL_UpperLid` は編集可能である。
- `ParamEyeLOpen = 0` の keyform に軽微な形状不自然さが validation report で Needs review として記録されている。
- AIエージェントは edit権限を持つが、保存前レビューが必要な設定である。

### When: Open Stack実用操作

1. AIエージェントが `adjust_keyform_vertices` command を作成する。
2. command には、対象parameter、keyform、drawable、vertex IDs、変更量、編集意図を含める。
3. AIエージェントが preview実行を要求する。
4. AIエージェントが validation を実行し、保存候補を作成する。

### Then: Open Stack期待結果

- operation command は、対象ID、操作種別、引数、権限、dry-run可否、編集意図を構造化して持つ。
- preview結果には、変更後runtime state、validation result、想定diffが含まれる。
- 保存候補は、ユーザー承認前の提案状態として扱われ、元packageを上書きしない。
- command実行ログは、後続のdiff/provenanceから参照できる。

### 検証するACの項目

- AC-AGENT-002: operation command を提供できること
- AC-AGENT-005: repair suggestion と provenance tracking を提供できること

## SC-AGENT-003: model diff、runtime diff、validation diff を抽出できる

### Given: 前提条件

- `RiggedAvatar_A` の編集前snapshotが保存されている。
- AIエージェントが `ParamEyeLOpen = 0` の keyform を補正した編集後snapshotが存在する。
- 編集前後で Open Package Validator が実行済みである。

### When: Open Stack実用操作

1. AIエージェントが model diff を要求する。
2. AIエージェントが `ParamEyeLOpen = 0` の runtime diff を要求する。
3. AIエージェントが validation diff を要求する。
4. AIエージェントが diff summary をレビュー用に保存する。

### Then: Open Stack期待結果

- model diff には、変更された parameter、keyform、drawable、vertex、metadata/provenanceが含まれる。
- runtime diff には、評価済みvertex差分、visibility/opacity差分、diagnostics差分が含まれる。
- validation diff には、解消したNeeds review、新規warning、新規Failの有無が含まれる。
- diff summary は、人間レビューと自動テストの両方が同じ対象IDで参照できる。

### 検証するACの項目

- AC-AGENT-003: diff extraction を提供できること
- AC-AGENT-001: model structure inspection を提供できること

## SC-AGENT-004: AC/シナリオに基づくテスト実行とレビューを支援できる

### Given: 前提条件

- `discussion/scenarios/02_DomainAcceptanceCriteria/218_Open_Viewer.md` の SC-VIEWER-002 が存在する。
- `RiggedAvatar_A` は Viewer で読み込み可能である。
- AIエージェントは scenario runner または同等の検証実行APIへアクセスできる。

### When: Open Stack実用操作

1. AIエージェントが SC-VIEWER-002 をテスト対象として選択する。
2. AIエージェントが Given に必要な model、Viewer、parameter一覧を確認する。
3. AIエージェントが When の操作を automation API または test runner で実行する。
4. AIエージェントが Then の観測結果を validation report として保存する。

### Then: Open Stack期待結果

- test execution report には、参照シナリオID、検証するAC、実行環境、入力、観測結果、Pass/Fail/Needs reviewが含まれる。
- Given不足がある場合、AIエージェントは不足artifactを Fail ではなく準備不足として報告できる。
- Then の各期待結果に対して、対応する観測証拠が記録される。
- ACベースレビューでは、実装がシナリオのどの項目を満たし、どこが未実装かを分離して説明できる。

### 検証するACの項目

- AC-AGENT-004: scenario-based test execution を提供できること
- AC-AGENT-003: diff extraction を提供できること

## SC-AGENT-005: repair suggestion と provenance tracking を提供できる

### Given: 前提条件

- `BrokenAvatar_BadTriangleIndex.openpackage` の validation report が存在する。
- report には、範囲外triangle index、対象mesh ID、影響drawableが Fail として記録されている。
- AIエージェントは repair suggestion を生成できるが、直接保存する権限はない。

### When: Open Stack実用操作

1. AIエージェントが validation report を読み込む。
2. AIエージェントが修復候補を複数生成する。
3. AIエージェントが各候補の影響範囲、リスク、必要な人間確認を記録する。
4. ユーザーが候補の1つを選び、AIエージェントが preview command を作成する。

### Then: Open Stack期待結果

- repair suggestion には、対象ID、失敗理由、候補操作、想定diff、検証手順、リスクが含まれる。
- provenance には、元report ID、生成したagent、使用した根拠、ユーザー承認状態、実行されたcommand IDが記録される。
- 未承認の提案は package本体に適用されない。
- 修復後に再validationした場合、元Failが解消したか、新規問題が出たかを追跡できる。

### 検証するACの項目

- AC-AGENT-005: repair suggestion と provenance tracking を提供できること
- AC-AGENT-002: operation command を提供できること

## 4. 未決事項

- AI Agent Interface と External API の正式な責務分担。
- agent権限、承認フロー、不可逆操作の制限。
- scenario runner の入力形式。
- provenance の保存場所と署名/改ざん検知。
