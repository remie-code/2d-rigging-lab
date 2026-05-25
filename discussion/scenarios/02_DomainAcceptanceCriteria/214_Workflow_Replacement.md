# シナリオ: Workflow Independence

> 参照元AC: [214_Workflow_Replacement.md](../../acceptance-criteria/02_DomainAcceptanceCriteria/214_Workflow_Replacement.md)
> 状態: 公式資料レビュー反映ドラフト

## 0. このドラフトの目的

このファイルは、`AC-WF` を「Cubism エコシステムに依存しない制作・実行・配信ワークフローとして Open Live2D Stack が成立すること」のシナリオへ降ろす。

Cubism Editor / Viewer / SDK の制作・出力・読み込みフローは参考資料として扱う。ただし、Open Live2D Stack の初期成立条件は Cubism互換ではなく、Open Model Format、Open Runtime / Viewer、Open Package Validator、Open VTuber App、AI-native operation が連携して成立することである。

## 1. 公式事実

- Cubism の制作フローは、素材分け、モデリング、アニメーション、書き出しへ進む構成として説明されている。
  参照: [Production Flow](https://docs.live2d.com/cubism-editor-manual/workflow/)
- Cubism の組み込み用データには、texture、`.moc3`、`.model3.json`、physics、motion、user data、display information などが含まれる。
  参照: [Data for Embedded Use](https://docs.live2d.com/en/cubism-editor-manual/export-moc3-motion3-files/)
- Cubism Viewer では、`.moc3` または `.model3.json` を読み込み、motion、expression、physics などを確認できる。
  参照: [Loading Models and Motion](https://docs.live2d.com/en/cubism-editor-manual/load-model-and-motion/)
- Cubism SDK for Web では、`.model3.json` の参照をもとに model、texture、renderer を結び付け、parameter 操作後に model update と draw を行う。
  参照: [About Models (Web)](https://docs.live2d.com/en/cubism-sdk-manual/model-web/), [Parameter Operation](https://docs.live2d.com/en/cubism-sdk-manual/parameters/)
- Cubism Editor は外部アプリと WebSocket / JSON によって連携できる。
  参照: [Live2D Cubism Editor External API Integration](https://docs.live2d.com/en/cubism-editor-manual/external-application-integration-api/)

## 2. リポジトリ事実

- 参照元ACは、Open Model Format 中心の制作、Open Runtime / Viewer による確認、新規モデル制作、配信利用、AI拡張、Cubism からの移行を参照ワークフローとして扱うことを要求している。
- `discussion/concept/modified_concept.md` は、Cubism Editor 単体の置換ではなく、Open Model Format、Runtime、SDK、Viewer、VTuber App、Validator、External API、AI Agent Interface を含む Open Live2D Stack への変更を定義している。
- `.moc3` 互換出力、`.cmo3` 復元、Cubism Viewer / VTube Studio 互換は初期成立条件ではない。

## 3. 設計判断

- 制作・実行・配信ワークフローの中心は Open Model Format と Open Model Package に置く。
- Cubism runtime package は、移行元、比較元、参照資料として扱えるが、Open Stack の pass/fail oracle にしない。
- AI拡張ワークフローは、単なるUI自動化ではなく、構造化観測、構造化操作、validation、diff、provenance を通じて成立させる。

## 4. シナリオ記述方針

- Given: 入力素材、Open Model Package、Runtime / Viewer / Validator / VTuber App、AI操作環境を書く。
- When: 制作、確認、配信、AI補正、Cubism参照移行の操作列を書く。
- Then: Cubism依存なしに成立する成果、検証結果、参考差分、未決事項を分けて書く。

## SC-WF-001: Open Model Format 中心の制作から出力までを通せる

### Given: 前提条件

- 制作者は、PSDまたは権利的に利用可能な静的2D素材 `Avatar_Source_A` を持っている。
- Open Editor または authoring tool が、drawable、mesh、part、parameter、keyform、deformer相当構造、physics、motion、metadata を編集対象として扱える。
- Open Runtime / Viewer / Package Validator が利用できる。

### When: Open Stack実用操作

1. 制作者が `Avatar_Source_A` を Open Editor に取り込む。
2. 制作者が drawable、mesh、part、parameter、keyform を作成する。
3. 制作者が runtime preview で parameter 操作と描画結果を確認する。
4. 制作者が Open Package Validator で構造、参照、runtime load、metadata を検証する。
5. 制作者が Open Model Package として保存または出力する。

### Then: Open Stack期待結果

- 素材入力から package 出力まで、Open Model Format を中心にした制作ワークフローとして完結できる。
- 出力 package は、Open Runtime / Viewer で読み込み、parameter 操作に応答する。
- Validator は、必須資産、任意資産、未対応資産、欠落情報を区別して報告できる。
- Cubism Editor、`.cmo3`、`.moc3`、`.model3.json` は、このワークフローの必須前提にならない。

### 参照資料

- 公式参考: [Production Flow](https://docs.live2d.com/cubism-editor-manual/workflow/)
- 公式参考: [Data for Embedded Use](https://docs.live2d.com/en/cubism-editor-manual/export-moc3-motion3-files/)

### 検証するACの項目

- AC-WF-001: Open Model Format を中心にした制作ワークフローを成立させること
- AC-WF-003: 新規モデル制作ワークフローを段階的に成立させること

## SC-WF-002: Open Runtime / Viewer で確認ワークフローを完結できる

### Given: 前提条件

- `RiggedAvatar_A.openpackage` は Open Package Validator を通過済みである。
- package には、parameter、expression、motion、physics、draw order、mask に相当する検証対象がある。
- Open Viewer は runtime state inspection と validation report 表示を持つ。

### When: Open Stack実用操作

1. ユーザーが Open Viewer で `RiggedAvatar_A.openpackage` を読み込む。
2. ユーザーが parameter slider または同等の操作で顔、身体、髪、口、目を動かす。
3. ユーザーが expression、motion、physics を適用し、draw order と mask の状態を確認する。
4. ユーザーが runtime state inspection と validation report を確認する。

### Then: Open Stack期待結果

- Open Viewer は、Open Runtime を用いて package を表示できる。
- parameter、expression、motion、physics、draw order、mask、validation result を確認できる。
- runtime state inspection には、入力parameter、評価済みdrawable state、mask state、warning/error が含まれる。
- Cubism Viewer で読み込めるかどうかは参考比較にできるが、Open Viewer確認ワークフローの成否条件ではない。

### 参照資料

- 公式参考: [Loading Models and Motion](https://docs.live2d.com/en/cubism-editor-manual/load-model-and-motion/)
- 公式参考: [About Models (Web)](https://docs.live2d.com/en/cubism-sdk-manual/model-web/)

### 検証するACの項目

- AC-WF-002: Open Runtime / Viewer による確認ワークフローを成立させること

## SC-WF-003: 新規モデル制作ワークフローを段階的に成立させる

### Given: 前提条件

- 新規モデル `StarterAvatar_A` の素材分け済み画像がある。
- 初期段階では、すべての機能が完成していなくても、最小 drawable、mesh、parameter、keyform、runtime preview、validation を利用できる。
- 制作者は、顔可動、身体可動、物理、motion を段階的に追加する方針である。

### When: Open Stack実用操作

1. 制作者が最小 drawable と mesh を作成する。
2. 制作者が `ParamAngleX` 相当の parameter と keyform を追加する。
3. 制作者が runtime preview で parameter 反映を確認する。
4. 制作者が髪揺れなどの physics を追加する。
5. 制作者が簡単な motion または idle 状態を追加する。
6. 制作者が各段階で package validation を実行する。

### Then: Open Stack期待結果

- 新規モデル制作は、すべての周辺機能を一度に要求せず、段階ごとに成立性を確認できる。
- 各段階で、追加された機能、まだ未対応の機能、次に必要な作業を validation report で確認できる。
- 後段の機能追加によって、前段で成立していた drawable、mesh、parameter、runtime preview が破損していないか確認できる。
- 制作者とAIエージェントは、同じACとシナリオに基づいて進捗をレビューできる。

### 参照資料

- 公式参考: [About ArtMeshes](https://docs.live2d.com/en/cubism-editor-manual/concept-of-artmesh/)
- 公式参考: [About Parameters](https://docs.live2d.com/en/cubism-editor-manual/parameter/)
- 公式参考: [About Physics](https://docs.live2d.com/en/cubism-editor-manual/physics-operation/)

### 検証するACの項目

- AC-WF-003: 新規モデル制作ワークフローを段階的に成立させること

## SC-WF-004: Open VTuber App で配信利用ワークフローを成立させる

### Given: 前提条件

- `RiggedAvatar_A.openpackage` は Open Viewer で表示確認済みである。
- Open VTuber App は、tracking input、parameter mapping、smoothing、expression hotkey、model transform、OBS向け表示に相当する機能を持つ。
- 配信用 profile `Streaming_Profile_A` を保存できる。

### When: Open Stack実用操作

1. ユーザーが Open VTuber App で `RiggedAvatar_A.openpackage` を読み込む。
2. ユーザーが webcam または tracking input を接続する。
3. ユーザーが tracking input を model parameter へ mapping する。
4. ユーザーが smoothing、expression hotkey、position、scale、rotation を調整する。
5. ユーザーが OBS 等の配信環境で利用できる表示状態を確認する。
6. ユーザーが `Streaming_Profile_A` を保存する。

### Then: Open Stack期待結果

- Open VTuber App は Open Model Package を読み込み、tracking input を parameter へ反映できる。
- expression hotkey、model position、scale、rotation、smoothing などの配信設定を確認・保存できる。
- 配信前に package validation と mapping validation を実行し、未接続tracking field、未使用parameter、表示不能状態を報告できる。
- OBS等の配信利用は、Cubism / VTube Studio 互換ではなく、Open VTuber App のワークフローとして成立する。

### 参照資料

- 公式参考: [About Models (Web)](https://docs.live2d.com/en/cubism-sdk-manual/model-web/)
- 公式参考: [Parameter Operation](https://docs.live2d.com/en/cubism-sdk-manual/parameters/)

### 検証するACの項目

- AC-WF-004: 配信利用ワークフローを成立させること

## SC-WF-005: AI拡張ワークフローで補正・レビュー・自動化できる

### Given: 前提条件

- `RiggedAvatar_A.openpackage` の validation report に、目周辺の mask warning と口中間値の mesh Needs review がある。
- AIエージェントは、model structure、runtime state、validation report、scenario を読み取れる。
- AIエージェントは、dry-run repair suggestion を作れるが、保存には人間承認が必要である。

### When: Open Stack実用操作

1. AIエージェントが validation report を読み込む。
2. AIエージェントが対象 drawable、mesh、parameter、keyform、mask を stable ID で特定する。
3. AIエージェントが修復候補を生成し、runtime preview と validation を dry-run で実行する。
4. 人間が候補を確認し、採用または却下する。
5. 採用された候補について、AIエージェントが provenance と diff を記録する。

### Then: Open Stack期待結果

- AIエージェントは、Open Stack の構造化情報に基づいて補正・レビュー・自動化を行える。
- 修復候補には、対象ID、根拠、想定diff、影響範囲、残リスク、人間確認事項が含まれる。
- 人間承認前の候補は、package本体へ不可逆に適用されない。
- AI操作の結果は、人間操作と同じ Open Model Format、AC、validation rule によって評価される。

### 参照資料

- 公式参考: [Live2D Cubism Editor External API Integration](https://docs.live2d.com/en/cubism-editor-manual/external-application-integration-api/)
- 公式参考: [Cubism Core API Reference](https://docs.live2d.com/en/cubism-sdk-manual/cubism-core-api-reference/)

### 検証するACの項目

- AC-WF-005: AI拡張ワークフローを成立させること

## SC-WF-006: Cubism既存資産を移行元・比較元として扱い、初期成立条件から分離できる

### Given: 前提条件

- ユーザーが所有する Cubism runtime package `Avatar_Cubism_Reference/` が存在する。
- package には `.moc3`、`.model3.json`、texture、任意の `.physics3.json`、`.motion3.json` が含まれる。
- 元の `.cmo3`、PSD、authoring履歴は存在しない、または参照できない。
- Open Stack は、Cubism既存資産を移行元または比較元として登録できる。

### When: Cubism参照操作

1. Cubism Viewer で `.model3.json` を読み込み、表示、motion、expression、physics を確認する。
2. `.model3.json` が参照する `.moc3`、texture、sidecar JSON を確認する。
3. 元の authoring 情報が runtime package から直接復元できる範囲とできない範囲を確認する。

### When: Open Stack実用操作

1. ユーザーが `Avatar_Cubism_Reference/` を Open Stack に参照資料として登録する。
2. Open Stack が、移行可能な runtime metadata と、復元できない authoring state を区別して report する。
3. ユーザーが手動またはAI支援で Open Model Format へ再構築する対象を選ぶ。
4. Open Stack が Open Model Package としての成立性を Open Runtime / Viewer / Validator で検証する。

### Then: Open Stack期待結果

- Cubism既存資産は、移行元、比較元、参考事実として扱える。
- `.moc3` 出力、`.cmo3` 復元、Cubism Viewer / VTube Studio 互換は、Open Stack の初期成立条件に含めない。
- Cubism package から取得できる情報、手動入力が必要な情報、推定した情報、取得不能な情報を区別できる。
- Cubism公式挙動と Open Stack の方針が衝突する場合、参考事実、設計判断が必要な差分、未決事項として記録できる。

### 参照資料

- 公式参考: [Data for Embedded Use](https://docs.live2d.com/en/cubism-editor-manual/export-moc3-motion3-files/)
- 公式参考: [Loading Models and Motion](https://docs.live2d.com/en/cubism-editor-manual/load-model-and-motion/)
- 公式参考: [Verify model integrity](https://docs.live2d.com/cubism-sdk-manual/moc3-consistency/)

### 検証するACの項目

- AC-WF-006: Cubism からの移行を参照ワークフローとして扱えること

## 5. 未決事項

- authoring format と runtime format を同一にするか分けるか。
- Open VTuber App の初期ACに、OBS透過出力、plugin連携、physics strength、idle motion をどこまで明示するか。
- Cubism標準 parameter ID を Open Stack の推奨aliasとして扱うか、別schemaとして扱うか。
- Cubism既存資産から Open Model Format へ移行する際の、手動入力、推定、AI補完の境界。
