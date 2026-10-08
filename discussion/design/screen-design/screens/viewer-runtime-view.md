# Viewer / Runtime View 画面仕様

> 状態: Accepted v0 direction / Draft screen spec。
> 最終更新: 2026-06-24。

## 1. 役割

Viewer / Runtime Viewは、編集したproject-defined modelを「完成品としてどう見えるか」確認するための専用画面である。

この画面の主目的は、編集作業中の部品や制御構造ではなく、parameterを動かした時のキャラクター全体の見え方をユーザーが確認できるようにすることである。

Viewerはauthoring surfaceではない。Mesh、deformer、keyform、parameter definition、tree hierarchy、clipping設定を作成・編集しない。

Viewerはdiagnostics surfaceでもない。問題の原因追跡、raw evidence、operation log、artifact path、diff payloadの確認はDiagnostics / Evidence Viewへ委譲する。

## 2. 用語

### 作品確認

作品確認とは、人間が完成品としての見え方を判断する作業である。

主な問い:

- parameterを動かした時、キャラクターは自然に見えるか。
- mesh / deformer / keyform / opacity / clipping の結果が、最終表示として破綻していないか。
- 編集画面の補助線やハンドルなしで、モデル単体として見た時に違和感がないか。

作品確認の対象は、最終的に表示されるキャラクターである。

### 検査

検査とは、表示結果の原因や内部状態を確認する作業である。

主な問い:

- どのdrawable、deformer、parameter、keyform、mask、opacityが結果に影響しているか。
- runtime evaluationでwarningや欠落が出ているか。
- 保存復元、評価順、mask合成、parameter補間が仕様どおりか。

検査の対象は、runtime evaluationの中間状態や構造化情報である。

Viewer v0では、作品確認を主画面にし、検査は必要な時だけDiagnostics / Evidence Viewへ逃がす。

## 3. 基本判断

Viewer / Runtime View v0では、次を採用する。

- modalではなく専用Screen / Viewとして開く。
- Clean Stageを主領域にする。
- Runtime Controlsを主要操作面にする。
- Runtime Controls上部にrender source mode controlを置き、`Original` / `Atlas Runtime` を切り替えられるようにする。
- Runtime Controls内にVariant切り替えsectionを置き、render source mode controlの下、parameter searchの上に配置する。
- Variant切り替えsectionは折りたたみ可能にし、折りたたみ時も現在のactive Variant summaryだけは見えるようにする。
- parameter一覧の絞り込みは名前検索だけにする。
- parameter操作はsession-only overrideとして扱う。
- Variant切り替えはsession-only preview active selectionとして扱い、Projectのdefault active selectionやmembership定義を書き換えない。
- `Atlas Runtime` はcommitted texture atlas artifactを使うViewer-only modeであり、authoring stateを変更しない。
- atlas artifactがmissingまたはstaleの場合は `Atlas Runtime` をdisabledにし、選択中なら `Original` へfallbackする。
- authoring overlayは表示しない。
- runtime statusは常設しない。
- dynamics / physics playbackはRuntime Controls下部に将来接続位置だけ設計上予約する。

Viewer / Runtime View v0では、次を採用しない。

- mesh overlay。
- deformer lattice。
- selection bounds。
- control points。
- warp scale handles。
- mesh draft / rig draft。
- hit-test debug。
- presentation frame / crop guide。
- pinned / favorite parameters。
- parameter group / category filter。
- screenshot / export。
- Compare / Diff。
- authoring operation buttons。

## 4. 開き方

Viewer / Runtime Viewは、Authoring Workspaceから専用画面として開く。

基本遷移:

```text
Authoring Workspace
  -> Toolbox / View group / Viewer
  -> Viewer / Runtime View
  -> Back to Authoring Workspace
```

戻る時は、可能な限りAuthoring Workspace側のselection、active tool、active parameter contextを保持する。

Viewerをmodalにしない理由:

- parameterを連続的に動かしながら確認するため、短い確認dialogでは足りない。
- Canvas中央を塞ぐUIは完成品確認に向かない。
- Authoring Workspaceの情報量から一度切り離す方が、完成品として見やすい。

## 5. 画面構成

```text
+--------------------------------------------------------------------------------+
| Viewer Header                                                                  |
| Back / model name / reset pose                                                  |
+----------------------------------------------+---------------------------------+
| Clean Stage                                  | Runtime Controls                |
|                                              |                                 |
| finished model preview                       | render source mode              |
| no authoring overlays                        | parameter sliders / numbers     |
| session parameter overrides reflected        | parameter name search           |
| neutral gray background by default           | future playback slot            |
| view controls only                           |                                 |
+----------------------------------------------+---------------------------------+
+--------------------------------------------------------------------------------+
```

| 領域 | 役割 |
|---|---|
| Viewer Header | Authoringへ戻る導線、対象model名、pose resetを扱う。 |
| Clean Stage | 完成品としてのモデル表示を扱う。編集overlayは出さない。 |
| Runtime Controls | render source modeとparameter overrideを操作する主UI。Viewerで最も多く触る領域。 |
| Future Playback Slot | Runtime Controls下部に置く、将来のdynamics / physics playback操作の接続場所。v0では操作UIを出さない。 |

## 6. Clean Stage

Clean Stageは、現在のcommitted model stateにsession parameter overrideを適用した表示を行う。

表示するもの:

- drawable / mesh / deformer / opacity / clipping / parameter evaluationが反映されたモデル。
- background selection。例: dark、light、transparent / checker。
- 初期backgroundはneutral solid gray。
- view controls。例: fit、1:1、zoom、pan、reset view。
- 描画不能時だけ、Clean Stage内にempty / error stateを表示する。

表示しないもの:

- mesh line。
- deformer grid。
- selected bounds。
- control point。
- scale handle。
- layer bounds。
- draft preview badge。
- edit affordance。

背景やzoomは、完成品を見やすくするためのViewer stage設定であり、authoring overlayではない。

## 7. Runtime Controls

Runtime Controlsは、Viewer内での主要操作面である。

表示するもの:

- render source mode control: `Original` / `Atlas Runtime`。
- Variant切り替えsection。Variant Groupが存在する場合だけ表示する。
- parameter name search。
- parameter slider。
- numeric value input。
- changed parameter indication。
- reset selected / reset changed。
- reset all parameter overrides。

Runtime Controlsでは、parameter値を一時的に動かして完成品の見え方を確認する。

これらの操作はproject fileを変更しない。keyformの追加、更新、削除も行わない。

render source mode controlはRuntime Controls最上部に置く。Variant Groupが存在する場合は、その直下にVariant切り替えsectionを置く。parameter searchはVariant切り替えsectionの下に常設する。

```text
Runtime Controls
  Render Source
  [ Original ] [ Atlas Runtime ]
  Atlas Runtime unavailable reason (only when disabled)

  Variants                         [v]
  Expression: Default
  Outfit: Hoodie
  Accessory: Glasses On / Cat ears Off

  [ Reset variants ]

  [ Search parameters...        ]
  [ Reset changed ] [ Reset all ]

  Face Angle X     slider / number
  Face Angle Y     slider / number
  Face Angle Z     slider / number
  ...

  Future Playback Slot
```

parameter group / category filterはv0では置かない。Editor上でユーザーがparameter groupを意識する明確な操作導線がないため、名前検索だけを正式な絞り込み手段にする。

### Variants

Viewer / Runtime Viewでは、完成品確認としてVariant Groupごとのactive Variantを切り替えられるようにする。

このsectionは、Variant定義、membership、Group mode、default active selectionを編集する場所ではない。それらはVariant / Expression Managerの責務である。Viewerでは、あくまで「この差分を選んだ時に完成品としてどう見えるか」を確認する。

初期状態:

- ProjectにVariant Groupが存在しない場合、このsectionは表示しない。
- ProjectにVariant Groupが存在する場合、Viewer初期表示はGroupごとのdefault active selectionを使う。
- default active selectionが欠けているGroupは、Variant / Expression Manager側の補正規則に従ってDefaultまたは先頭Variantへ解決された状態を使う。

操作:

- `single select` Groupは、segment control、compact select、または同等の「1つだけ選ぶ」UIで切り替える。
- `multi toggle` Groupは、checkbox / toggle群でON/OFFを切り替える。
- GroupやVariant数が多い場合は、常時すべてを広げず、Groupごとのcompact rowまたはpopoverへ逃がしてよい。
- `Reset variants` は、Viewer内のpreview active selectionをProjectのdefault active selectionへ戻す。

折りたたみ:

- Variants sectionは折りたたみ可能にする。
- 折りたたみ時も、現在のactive Variant summaryを1行または短い複数行で表示する。
- 折りたたみ時にVariantの詳細操作UIは隠す。
- parameter slidersを確認している時間の方が長いため、Variants sectionがRuntime Controlsの縦幅を占有し続けないことを重視する。
- 折りたたみ状態はsession-local UI stateでよい。Project stateには保存しない。

表示への反映:

- Variant切り替えはClean Stageへ即時反映する。
- `Original` と `Atlas Runtime` の両方で同じactive Variant selectionを使う。
- `Atlas Runtime` がdisabledまたはstaleで `Original` にfallbackしても、active Variant selectionは維持する。
- Variant falseのDrawableは、parameter / keyform / opacity / dynamicsが表示を要求しても描画されない。
- Variant trueのDrawableは、既存のParts visibility、Drawable visibility、keyform opacity、clipping、mesh / deformer評価に従う。

保存:

- ViewerでのVariant切り替えはsession-only preview active selectionであり、Workspace SaveやPortable JSONへProject defaultとして保存しない。
- Projectのdefault active selectionを変更したい場合はVariant / Expression Managerで行う。

### Render Source Mode

`Original`:

- 既存Viewer behavior。
- original texture / original UVを使う。
- Apply済みatlas artifactの有無に関わらず、authoring graphのcommitted model stateを確認する。

`Atlas Runtime`:

- committed atlas artifactを使う。
- `textureAtlas.layoutSummary`、generated atlas texture entry、generated binary asset bytes、source signatureを検証する。
- Viewer projection上だけでtexture ref / bytes / dimensions / UVをremapする。
- `session.graph`、authoring `Drawable.textureId`、authoring `Mesh.uvs`、`Mesh.topologyRevision` を変更しない。
- atlas artifactがmissingまたはsource signature不一致でstaleの場合はdisabledにする。
- disabled中に選択された場合はeffective modeを `Original` へ戻す。

Runtime Controlsには詳細なartifact pathやsource signature payloadを出さない。必要な場合はDiagnostics / Evidence Viewへ委譲する。

Parameter Barとの違い:

| UI | 役割 |
|---|---|
| Parameter Bar | Authoring Workspaceでactive parameterを編集し、keyform操作を行う。 |
| Viewer Runtime Controls | Viewer内で複数parameterを動かし、完成品としての見え方を確認する。 |
| Variant / Expression Manager | Variant定義、membership、default active selectionを編集する。 |
| Viewer Variants section | Viewer内でsession-onlyにVariantを切り替え、完成品として確認する。 |

## 8. Runtime State 表示

Viewer v0ではruntime statusを常設しない。

表示できている状態で `Ready`、warning count、runtime source summaryを出さない。通常時に見ない情報を常設すると、作品確認の主画面が検査寄りになるためである。

描画不能、texture欠落、runtime evaluation失敗などで完成品表示が成立しない場合だけ、Clean Stage内にempty / error stateを表示してよい。

表示しないもの:

- `Ready`。
- warning count。
- runtime source summary。
- raw runtime evidence。
- operation ID。
- generated refs。
- artifact path全文。
- structured payload全文。
- Compare / Diff。

詳細確認が必要な場合はDiagnostics / Evidence Viewへ遷移する。

## 9. Dynamics / Playback 接続余地

Viewer v0ではdynamics / physicsを実装しない。

ただし、将来の髪揺れや物理演算確認はViewerの責務に入る。Viewerは「完成品として動いて見えるか」を確認する場所であるため、dynamics結果も最終的にはClean Stageへ反映されるべきである。

そのため、v0設計では次を予約する。

- Runtime Controls下部に、Future Playback Slotを置ける構成にする。
- session state上、parameter overrideと将来のsimulation stateを分けて扱える名前にする。
- reset poseとreset simulationを将来分離できる導線にする。
- runtime evaluationは、将来 `frameIndex`、`deltaTimeMs`、`previousState`、`resetReasons` を受け取れる形に寄せる。

v0の画面上には、再生できないplay / pause / step buttonを出さない。

必要なら、Future Playback Slotに小さく次のような静的表示だけを置いてよい。

```text
Motion / Physics: Not configured
```

この表示はRuntime Controls下部のFuture Playback Slotに置くplaceholderであり、操作可能UIではない。

## 10. 除外事項

### Presentation Frame / Crop Guide

v0では扱わない。

Viewer v0の目的は、書き出し構図や配信用カメラ枠ではなく、モデル単体が完成品としてどう見えるかを確認することである。

### Screenshot / Export

v0では扱わない。

画像書き出しや配信・カメラ連携は、モデルを実際に動かす側のアプリケーション責務として扱う。Editor側Viewerにexportを持ち込まない。

### Compare / Diff

v0では扱わない。

Default poseとの差分、保存前後差分、authoring previewとの差分、revision diffは、人間が視覚的に意味を取りにくい。必要になった場合もDiagnostics / Evidence側の検査機能として扱う。

### Pinned / Favorite Parameters

v0では扱わない。

便利ではあるが、何をpinするか、どこに保存するか、session-onlyかproject stateかが曖昧になりやすい。初期Viewerはparameter name searchとchanged indicationで十分とする。

### Parameter Group / Category Filter

v0では扱わない。

Editor上でユーザーがparameter groupを意識するタイミングがないため、Viewerにもgroup / category filterを置かない。絞り込みはparameter name searchだけにする。

## 11. 他UIとの関係

| UI | Viewer / Runtime Viewとの違い |
|---|---|
| Authoring Workspace Canvas | 編集対象のselection、draft、tool overlay、control handlesを扱う。 |
| Mesh Tool | mesh生成、preview、Apply、overlay確認を扱う。 |
| Rig Tool | deformer作成、hierarchy編集、control point編集、keyed deformation編集を扱う。 |
| Parameter Bar | keyform authoringの操作面。 |
| Parameter Manager | parameter definitionを管理する。 |
| Diagnostics / Evidence View | raw evidence、warning詳細、検査情報を扱う。 |
| Viewer / Runtime View | 完成品としての見え方を、clean stageとruntime controlsで確認する。 |

## 12. v0受け入れ観点

Viewer / Runtime View v0は、次を満たせばよい。

- Authoring Workspaceから専用Viewer screenへ移動できる。
- ViewerからAuthoring Workspaceへ戻れる。
- Clean Stageに現在のcommitted modelが表示される。
- Authoring overlayが表示されない。
- Runtime Controlsでparameterを動かせる。
- Runtime ControlsでVariant Groupごとのactive Variantを切り替えられる。
- Variant Groupがない場合、Variant sectionは表示されない。
- Viewer初期表示ではProjectのdefault active selectionが反映される。
- ViewerのVariant切り替えはsession-onlyであり、Project default active selectionを書き換えない。
- Variants sectionは折りたたみ可能であり、折りたたみ時もactive Variant summaryが見える。
- parameter名検索がrender source mode controlの下に常設される。
- parameter group / category filterは表示されない。
- parameter overrideはsession-onlyであり、project authoring stateを書き換えない。
- reset操作でparameter overrideを戻せる。
- Runtime Controls最上部で `Original` / `Atlas Runtime` を切り替えられる。
- `Atlas Runtime` はcommitted atlas artifactを使い、authoring stateを変更しない。
- atlas artifactがmissingまたはstaleの場合は `Atlas Runtime` がdisabledになり、`Original` へfallbackする。
- parameter名検索はrender source mode controlとVariant sectionの下に置く。
- clipping、opacity、mesh、deformer、keyform評価がViewer表示にも反映される。
- Variant predicateがViewer表示にも反映され、すべてのVariant対象Drawableが同時表示される状態にならない。
- runtime statusは常設されない。
- 描画不能時だけClean Stage内にempty / error stateを表示できる。
- 初期backgroundはneutral solid grayである。
- Future Playback SlotはRuntime Controls下部に配置できる。
- screenshot / export、Compare / Diff、crop guide、favorite parameterを実装しない。

## 13. 確定済み事項

- parameter group / category filterはv0に含めない。
- render source mode controlはRuntime Controls最上部に置く。
- Variant Groupが存在する場合、Variant切り替えsectionはrender source mode controlの下、parameter searchの上に置く。
- Variants sectionは折りたたみ可能にし、折りたたみ時もactive Variant summaryを表示する。
- ViewerでのVariant切り替えはsession-only preview active selectionであり、Project default active selectionは変更しない。
- parameter searchはrender source mode controlまたはVariant切り替えsectionの下に置く。
- Viewer supports `Original` / `Atlas Runtime`; `Atlas Runtime` uses committed atlas artifact and is disabled when missing/stale.
- runtime statusは常設しない。
- 初期backgroundはneutral solid grayにする。
- Future Playback SlotはRuntime Controls下部に置く。
