# Validation / Diagnostics v0 画面・表示仕様

> 状態: Draft screen spec / Wave84後の議論反映。旧Diagnostics / Evidence Viewの「debug/evidenceを大量に読む画面」という前提を、現行Editor向けの「決定論的に検知できる問題と、失敗原因へアクセスするための表示体系」へ更新する。

## 1. 役割

Validation / Diagnostics v0は、モデルの自然さや完成度を採点する画面ではない。

目的は、ユーザーが次の問いに答えられること。

- どのDrawable / Deformer / Parameter / Dynamics Groupに、決定論的に検知できる問題があるか。
- 問題がある場合、どの対象を開けばよいか。
- Mesh生成が失敗またはfallbackした時、原因をユーザーが読み取り、Codexへ伝えられるか。

この機能は「その場の警告」「ツリー上の小さな警告」「Validate / Diagnostics一覧」の3層で扱う。一覧画面だけを主役にしない。

## 2. 設計原則

- 決定論的に判定できるものだけを出す。
- 「自然な揺れか」「良いdeformer hierarchyか」「keyformが足りているか」のような品質推測はしない。
- 通常のViewer確認を邪魔しない。Viewerを開く前に大量警告を表示しない。
- 基本severityはWarningでよい。v0では賢い重要度判定に寄せない。
- 問題行から対象へ移動できることを重視する。
- 修復、自動生成、auto-fix、AI repairはv0に含めない。
- Mesh生成失敗は履歴一覧に蓄積しない。失敗直後のMesh Tool内で原因へアクセスできればよい。

## 3. 表示面

### 3.1 その場のInspector警告

操作直後に気づくべき問題は、対象tool / inspector内に表示する。

対象:

- Mesh Tool
  - Mesh生成失敗。
  - fallback mesh。
  - trianglesが0、または明確に異常な生成結果。
  - 診断情報コピー。
- Dynamics Tool
  - input parameter参照切れ。
  - output parameter参照切れ。
  - output parameterにkeyformがない。
  - 同一output parameterを複数Dynamics Groupが使おうとする操作のブロック。
- Rig / Drawable文脈
  - Deformerまたはkeyform対象なのにmeshがないDrawable。

### 3.2 ツリー上の小さな警告

問題のある対象がParts Tree / Deformer Tree上に見えている場合、小さな警告アイコンを出す。

対象例:

- meshなしなのにDeformer配下またはkeyform対象になっているDrawable。
- 参照切れの対象行が決定できる場合のDrawable / Deformer。

ツリー上の警告は控えめにする。常に詳細文を表示するのではなく、hover / focusで短い説明を出し、詳細はDiagnostics一覧または対象Inspectorへ委譲する。

### 3.3 Validate / Diagnostics一覧

全体の問題をまとめて読む入口。

ToolboxまたはApp Bar上のValidate / Diagnostics entryに警告バッジを表示し、何か決定論的な問題があることを知らせる。

一覧の各行は次を持つ。

- warning icon。
- category。
- short title。
- target type。
- target name / id。
- short explanation。
- jump action。
- 必要な場合だけcopy details。

修復操作は持たない。

## 4. v0対象の診断

### 4.1 Mesh未生成なのにDeformer / Keyform対象

条件:

- DrawableがDeformerに属しているがmeshを持たない。
- DrawableまたはDrawable描画に影響するtargetにkeyformがあり、変形反映にmeshが必要だがmeshを持たない。

表示場所:

- Parts Tree / Deformer Treeの該当Drawable行。
- Rig / Drawable文脈の警告。
- Diagnostics一覧。

推奨文言:

```text
このDrawableはDeformerまたはkeyformの対象ですが、meshがありません。変形が描画に反映されません。
```

操作:

- 対象Drawableへ移動。
- 可能ならMesh Toolへ自動切り替え。

Viewer前の大きな警告表示はしない。複数ある場合にうるさくなるため。

### 4.2 Mesh生成失敗 / fallback / triangles 0

条件:

- Mesh preview generationが失敗した。
- fallback meshになった。
- trianglesが0、または生成結果が明確に異常。

表示場所:

- Mesh Tool preview / result area。
- Mesh Tool Inspector内の生成結果詳細。

Diagnostics一覧には過去履歴として残さない。失敗直後に原因へアクセスできればよい。

表示内容:

- 短い失敗理由。
- 使用algorithm id。
- preset。
- drawable name / id。
- texture bounds。
- alpha bounds。
- contour count。
- sampled boundary count。
- vertices / triangles。
- fallback step。
- filtered triangle count。
- failure reason。
- 必要に応じたdebug payload。

操作:

- 診断情報をコピー。
- Mesh presetまたは対象Drawableを確認する。

この経路は、ユーザーが失敗原因をCodexへ伝えるために重要である。

### 4.3 Dynamics input / output parameter参照切れ

条件:

- Dynamics input parameter idが存在しない。
- Dynamics output parameter idが存在しない。

表示場所:

- Dynamics Group list。
- Dynamics Group Inspector / Edit画面。
- Diagnostics一覧。

操作:

- 該当Dynamics Groupへ移動。
- Editを開く。

Viewer Runtime Controlsには表示しない。Viewerは完成モデル確認の場であり、診断表示を混ぜない。

### 4.4 Dynamics output parameterにkeyformがない

条件:

- Dynamics Groupのoutput parameterは存在する。
- しかし、そのparameterに対応する描画変化keyformが存在しない。

表示場所:

- Dynamics Tool Validation。
- Diagnostics一覧。

推奨文言:

```text
output parameterにkeyformがありません。Dynamics値は計算されますが、描画に反映されない可能性があります。
```

この診断は、揺れの自然さを判定するものではない。計算結果が見た目へ届かない可能性を決定論的に知らせるだけである。

### 4.5 複数Dynamics Groupが同じoutputへ書く

方針:

- 通常UIでは、この状態を作れないようにする。
- Create / Edit時に既存Groupのoutputと衝突するparameterは選択不可、またはApply不可にする。
- 読み込み済みデータや古いデータで衝突が存在する場合のみ、Diagnostics一覧へ出す。

表示内容:

- output parameter name / id。
- 競合するDynamics Group名一覧。
- 各Groupへのjump action。

### 4.6 Keyform / Deformer / Drawable参照切れ

条件:

- keyformが存在しないParameterを参照している。
- keyform targetが存在しないDrawable / Deformerを参照している。
- Deformer child参照が存在しない。
- Deformer parent参照が存在しない。
- その他、保存データ・操作結果として参照先が消えている。

表示場所:

- Diagnostics一覧を主役にする。
- 各Inspectorには出さない。Inspectorごとに置き場所を増やすとUIが散るため。

操作:

- 可能なら関連するParameter / Drawable / Deformerへ移動。
- 修復はv0ではしない。

### 4.7 Deformer parent cycle

現在のUIでは通常作れない想定。

ただし壊れたデータ、古いデータ、将来の操作追加で発生した場合に備え、Diagnostics一覧では検出してよい。

表示内容:

- cycleに含まれるDeformer名 / id。
- Deformer Treeへのjump action。

## 5. v0で扱わないもの

- 完成度スコア。
- 統計ダッシュボード。
- 自然なDeformer hierarchyかどうかの判定。
- Dynamicsの揺れが自然かどうかの判定。
- keyform不足の推測判定。
- 非表示 / hidden / import由来状態の一般警告。
- save/load成立性のユーザー向け診断。
- clipping関係の一般警告。
- Mesh生成失敗履歴のグローバル蓄積。
- 自動修復、AI repair、auto-fix。
- pixel oracle、full renderer検査。

## 6. 画面イメージ

```text
Toolbox / App Bar
  [Validate ⚠ 3]

Diagnostics
  Filter: [All] [Mesh] [Dynamics] [References]

  ⚠ Mesh
    Drawable "hair_front_l" has no mesh but is bound to a Deformer.
    [Jump to Drawable] [Open Mesh Tool]

  ⚠ Dynamics
    Group "Hair Dynamics" output parameter has no keyform.
    [Jump to Dynamics Group]

  ⚠ References
    Keyform target deformer "warp_12" is missing.
    [Jump to Parameter]
```

Mesh Tool内:

```text
Mesh Preview
  ⚠ Mesh generation used fallback.
  Reason: contour triangulation failed.
  [Show details] [Copy diagnostic details]
```

Dynamics Tool内:

```text
Validation
  ⚠ output parameterにkeyformがありません。Dynamics値は計算されますが、描画に反映されない可能性があります。
```

## 7. 実装時の注意

- 既存validator / Product Preflight / package diagnosticsと重複しすぎない。Editor内の人間向け診断として必要な粒度にする。
- 診断計算はEditor操作を重くしない。必要ならsession projectionや既存stateから軽量に生成する。
- Diagnostics一覧はread-onlyとする。
- Jump actionは対象を選択し、必要なら対応toolへ切り替える。ただしユーザーのデータを変更しない。
- Mesh診断コピーは、Codexへ貼れるテキストを優先する。
- 画面名は実装時に `Validation / Diagnostics` としてよい。旧 `Diagnostics / Evidence View` のevidence-heavy scopeはv0主目的ではない。

## 8. 未決事項

- Validate / Diagnostics entryをToolboxに置くか、App Barに置くか。
- 警告バッジの件数は全件数にするか、category countにするか。
- Blocker severityをv0で導入するか。一律Warningで開始する案が優勢。
- Mesh生成診断payloadの正確な項目名と保存範囲。
- Jump actionでどこまで自動tool切り替えするか。
