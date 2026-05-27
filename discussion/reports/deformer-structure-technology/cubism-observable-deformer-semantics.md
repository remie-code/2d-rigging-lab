# Cubism Observable Deformer Semantics

> 調査日: 2026-05-25  
> 位置付け: Live2D Cubism Editor 公式資料から、ユーザーまたは外部ツールが観測できる deformer semantics を整理する。Cubism 公式資料は Open 2D Character Rigging Stack の参考資料であり、Open Stack のオラクルではない。未文書の内部実装は公式事実として扱わず、仮説または設計候補に分離する。

## 0. 参照範囲

### 0.1 公式ソース

- [About Deformers](https://docs.live2d.com/en/cubism-editor-manual/deformer/)
- [Warp Deformer](https://docs.live2d.com/en/cubism-editor-manual/making-and-placement-of-warp-deformer/)
- [Rotation Deformer](https://docs.live2d.com/en/cubism-editor-manual/making-and-rotation-of-rotationdeformer/)
- [Parent-Child Hierarchy Structure](https://docs.live2d.com/en/cubism-editor-manual/system-of-parent-child-relation/)
- [A Combination of Parent-Child Hierarchy](https://docs.live2d.com/en/cubism-editor-manual/combintion-of-parent-child-relation/)
- [Convenient Deformer Functions](https://docs.live2d.com/en/cubism-editor-manual/convenient-function-deformer/)
- [Deformer Palette](https://docs.live2d.com/en/cubism-editor-manual/deformerpalatte/)
- [Inspector Palette](https://docs.live2d.com/en/cubism-editor-manual/inspector-palette/)
- [Keyforms and Parent-Child Hierarchy Movement](https://docs.live2d.com/en/cubism-editor-manual/keyform-parent-chilid-relation/)
- [Edit Parameters](https://docs.live2d.com/en/cubism-editor-manual/edit-parameters/)
- [Keyforms X/Y Direction](https://docs.live2d.com/en/cubism-editor-manual/keyform-xydirection/)
- [Deformer Tutorial](https://docs.live2d.com/en/cubism-editor-tutorials/deformer/)
- [Face XY Tutorial](https://docs.live2d.com/en/cubism-editor-tutorials/xy/)
- [Motion Inversion](https://docs.live2d.com/en/cubism-editor-manual/inversion-of-movement/)
- [Apply 3D Rotation Expression](https://docs.live2d.com/en/cubism-editor-manual/apply-3d-rotation-expression/)

### 0.2 リポジトリ内の根拠文書

- `discussion/_conventions.md`
- `discussion/reports/deformer-structure-technology/_map.md`
- `discussion/design/initial-design-decisions-and-open-questions.md`
- `discussion/acceptance-criteria/03_MVP_Acceptance_Criteria.md`
- `discussion/acceptance-criteria/02_DomainAcceptanceCriteria/204_Deformation_Control_Structure.md`
- `discussion/scenarios/02_DomainAcceptanceCriteria/204_Deformation_Control_Structure.md`

## 1. 公式事実

### 1.1 Deformer の基本分類

Live2D Cubism Editor の公式マニュアルでは、Deformer は複数頂点をまとめて編集するための機能として説明される。種類は少なくとも次の2系統に分かれる。

| 種別 | 公式資料から観測できる役割 | 参照 |
|------|----------------------------|------|
| Warp Deformer | 内部のメッシュを面状に変形する。複数の ArtMesh や子 deformer をまとめて変形する用途で使われる。 | [About Deformers](https://docs.live2d.com/en/cubism-editor-manual/deformer/), [Warp Deformer](https://docs.live2d.com/en/cubism-editor-manual/making-and-placement-of-warp-deformer/) |
| Rotation Deformer | 内部のメッシュを角度指定で回転させる。回転中心、角度、ハンドル、標準角度などを編集できる。 | [About Deformers](https://docs.live2d.com/en/cubism-editor-manual/deformer/), [Rotation Deformer](https://docs.live2d.com/en/cubism-editor-manual/making-and-rotation-of-rotationdeformer/) |

公式資料から読み取れるのは、Editor 上の概念、作成手順、編集属性、検証機能である。Warp Deformer の内部補間式、Rotation Deformer の内部行列表現、評価順序の厳密仕様は、上記ページだけでは確定できない。

### 1.2 Warp Deformer

Warp Deformer は、選択したオブジェクトの親として作成できる。作成時には、挿入先パーツ、名前、追加先、Bezier division、conversion division、サイズなどを指定できる。

公式資料上、ユーザーが観測・編集できる主な属性は次である。

| 観測対象 | 公式資料上の意味 | Open Stack での注意 |
|----------|------------------|---------------------|
| 名前 / ID 相当 | Deformer Palette や Inspector 上で識別される名称。 | Open Stack では安定IDと表示名を分ける必要がある。 |
| 挿入先パーツ | 作成先または所属先のパーツ。 | runtime 評価対象というより authoring 上の整理単位として扱う。 |
| 追加先 | 選択オブジェクトの親にする、既存階層へ追加するなどの作成時配置。 | parent-child tree の変更 operation として記録する。 |
| Bezier division | Warp Deformer の編集・表現に関係する分割数として指定される。 | 内部アルゴリズムを同一視しない。Open Stack で保持するなら「Cubism参照属性」または Open 独自の格子属性として意味を定義する。 |
| Conversion division | Deformer の変換分割数として指定される。 | Open Stack の評価格子や制御点数に対応させる場合は別途設計が必要。 |
| サイズ / 範囲 | 子要素を覆う範囲として調整され、はみ出し検証にも関係する。 | bounds と authoring handle を区別して持つべき。 |
| 編集レベル / 制御点 | チュートリアルでは変形粒度を変えて制御点を動かす。 | keyform で保存される対象を、制御点状態なのか評価済み頂点なのか設計で決める必要がある。 |
| 元形状 | Inspector から元の形状を確認できる。 | validation と diff の基準状態として使える。 |

[Warp Deformer](https://docs.live2d.com/en/cubism-editor-manual/making-and-placement-of-warp-deformer/) は、Bezier division と conversion division の値選択や注意点を説明している。ただし、これらをどの数学的補間式で評価するかは公式マニュアル本文からは確定できない。

### 1.3 Rotation Deformer

Rotation Deformer は、作成後に位置、角度、ハンドル長を調整できる。Inspector から標準角度を設定でき、対象オブジェクトの親として設定できる。

公式資料上、ユーザーが観測・編集できる主な属性は次である。

| 観測対象 | 公式資料上の意味 | Open Stack での注意 |
|----------|------------------|---------------------|
| 位置 | 回転デフォーマの配置。実質的に回転中心の authoring 表現として使われる。 | pivot / origin と表示用ハンドル位置を分けるか検討する。 |
| 角度 | 回転デフォーマの現在角度。 | parameter keyform で補間される値か、local transform state かを明示する。 |
| 標準角度 | 現在角度を基準状態として設定できる。 | default pose と edited keyform の関係を明示する。 |
| ハンドル長 | 操作用ハンドルの長さ。 | runtime には不要な authoring metadata かもしれない。 |
| 子オブジェクト | 対象 ArtMesh または子 deformer が親子関係で格納される。 | rotation は子へ伝播する transform として扱えるが、内部式は仮説に留める。 |

Open Stack の設計では、Rotation Deformer を「pivot 付き2D affine transform」と見なす候補が自然だが、これは公式資料から確定する内部事実ではなく、Open 実装側の設計仮説である。

### 1.4 親子階層

公式資料は、親子関係について次の観測可能なセマンティクスを説明している。

- 親を変形すると子に反映される。
- 子を変形しても親には影響しない。
- Warp Deformer、Rotation Deformer、ArtMesh などを階層化できる。
- 階層は Deformer Palette、Inspector、作成時の追加先指定で操作できる。
- 親子の組み合わせにより、顔全体の大域変形、目・口・髪などの局所変形を分離できる。

参照: [Parent-Child Hierarchy Structure](https://docs.live2d.com/en/cubism-editor-manual/system-of-parent-child-relation/), [A Combination of Parent-Child Hierarchy](https://docs.live2d.com/en/cubism-editor-manual/combintion-of-parent-child-relation/), [Deformer Palette](https://docs.live2d.com/en/cubism-editor-manual/deformerpalatte/), [Inspector Palette](https://docs.live2d.com/en/cubism-editor-manual/inspector-palette/)

公式資料からは、少なくとも「親から子へ変形が伝播する tree 的な構造」は観測できる。一方で、循環参照が内部的にどう防止されるか、同一子が複数親を持てるか、評価順序の詳細などは、この範囲の公式資料だけでは確定できない。Open Stack では、親子関係を保存形式・Editor・Runtime・Validator で検証可能な有向階層として定義する必要がある。

### 1.5 Parameter / Keyform と Deformer の関係

公式資料上、Cubism Editor では Parameter に keyform を追加し、parameter 値に応じたオブジェクト状態を編集する。対象には ArtMesh だけでなく、deformer も含まれる。

観測できる事実は次である。

- Parameter Palette で parameter の範囲、現在値、keyform を扱う。
- keyform は parameter 上の特定値に紐づく状態として扱われる。
- 複数 parameter の組み合わせによる keyform 編集が可能である。
- 親子階層がある場合、親と子のどちらに keyform があるかによって、操作補助機能や反転機能の扱いが変わる。
- 「3D回転表現を適用」機能では、対象オブジェクトに Angle X / Y 等の keyform を作成または上書きする authoring 支援がある。

参照: [Edit Parameters](https://docs.live2d.com/en/cubism-editor-manual/edit-parameters/), [Keyforms X/Y Direction](https://docs.live2d.com/en/cubism-editor-manual/keyform-xydirection/), [Keyforms and Parent-Child Hierarchy Movement](https://docs.live2d.com/en/cubism-editor-manual/keyform-parent-chilid-relation/), [Motion Inversion](https://docs.live2d.com/en/cubism-editor-manual/inversion-of-movement/), [Apply 3D Rotation Expression](https://docs.live2d.com/en/cubism-editor-manual/apply-3d-rotation-expression/)

ただし、公式資料の UI 操作説明からは、`.cmo3` 内部で keyform がどの単位に保存されるか、deformer の制御点差分と ArtMesh の評価済み頂点差分がどのように分離されるかは確定できない。Open Stack は「parameter -> keyform -> target object state」という外部観測可能な関係を採用しつつ、保存単位を独自に明文化する必要がある。

### 1.6 Validation / convenience 機能

公式資料から、deformer に関係する検証・確認機能として次が観測できる。

| 機能 | 観測できる状態 | 重要度 |
|------|----------------|--------|
| Validate Deformer | 親 Warp Deformer から子要素の頂点がはみ出している状態を検出する。対象の絞り込みや選択に使える。 | Open Stack の deformer bounds validation に直結する。 |
| はみ出しハイライト | 親 Warp Deformer 外の頂点を表示上ハイライトする。 | Editor preview の警告表示に対応する。 |
| Select Uncompleted Deformer | 空の deformer、または未完成とみなされる deformer を選択する。 | 空 deformer validation に対応する。 |
| Model Statistics | deformer 数や空 deformer 数などの統計を確認できる。 | Validator / AI Agent がモデル構造を把握する入口になる。 |
| Verify Mapped Parameters | オブジェクトに関連付く parameter 数が多い状態を警告表示する。 | parameter/keyform complexity warning の参考になる。 |
| Motion Inversion の警告 | 親子の keyform が揃っていない場合や、対象が選択されていない場合に反転処理の制約が出る。 | keyform 欠落・親子 keyform 整合性の参考になる。 |
| Apply 3D Rotation Expression のエラー | デフォルト値に key がない場合など、適用前提を満たさない状態をエラーにする。 | authoring 支援機能の precondition validation として参考になる。 |

参照: [Convenient Deformer Functions](https://docs.live2d.com/en/cubism-editor-manual/convenient-function-deformer/), [Motion Inversion](https://docs.live2d.com/en/cubism-editor-manual/inversion-of-movement/), [Apply 3D Rotation Expression](https://docs.live2d.com/en/cubism-editor-manual/apply-3d-rotation-expression/)

公式の Validate Deformer は、主に親 Warp Deformer からの子頂点はみ出しを扱う。親子循環、存在しない target ID、parameter 未接続などは、Open Stack の AC では必要だが、今回参照した Cubism 公式資料だけでは同等の公式検証項目として確認できない。

### 1.7 チュートリアルから観測できる制作パターン

[Deformer Tutorial](https://docs.live2d.com/en/cubism-editor-tutorials/deformer/) と [Face XY Tutorial](https://docs.live2d.com/en/cubism-editor-tutorials/xy/) からは、次の制作上の意味が読み取れる。

- Deformer は個別パーツだけでなく、頭、体、腕、髪などのまとまりを動かすために使われる。
- 大域的な頭部・体の傾きと、目・口・髪などの局所変形は、階層を分けて扱う。
- 顔の Angle X / Y では、複数の ArtMesh と deformer をまとめて変形し、斜め方向の見た目を調整する。
- 3D 的な向き表現は、実際の3Dモデルの内部表現を意味するとは限らず、2D要素の keyform と deformer 編集による authoring 表現として扱われる。

Open Stack では、これらを Cubism UI の模倣ではなく、「複数 drawable / deformer を階層化し、parameter/keyform によって大域・局所変形を作れる制作能力」として再定義するのが妥当である。

## 2. リポジトリ要件

### 2.1 MVP AC からの要件

`discussion/acceptance-criteria/03_MVP_Acceptance_Criteria.md` は、MVPで `warp / rotation 相当 deformer、親子階層、parameter接続` を制作できることを要求している。特に AC-MVP-009 は次を必要条件にしている。

- warp deformer 相当と rotation deformer 相当を GUI Editor で作成できる。
- deformer 相当構造は、対象 drawable または子 deformer を持てる。
- deformer 相当構造は、親子階層、局所変形と大域変形、回転中心または制御格子、parameter / keyform 接続を持てる。
- 顔や体のまとまりを変形する warp 相当構造と、頭部または腕などを回転的に扱う rotation 相当構造を作成し、parameter に接続できる。
- Validator は、親子循環、親子サイズまたは対象範囲の不整合、存在しない対象ID、parameter未接続、runtime評価不能な deformer を報告できる。

AC-MVP-008、AC-MVP-011、AC-MVP-012、AC-MVP-013、AC-MVP-014 も deformer と関係する。Open Stack は parameter / keyform 補間、Editor preview、保存再読み込み、Runtime / Viewer state inspection、Validator report、AI Agent からの観測・diff・repair candidate を同じ package 構造上で扱う必要がある。

### 2.2 Domain AC からの要件

`discussion/acceptance-criteria/02_DomainAcceptanceCriteria/204_Deformation_Control_Structure.md` は、Open Editor が扱うべき変形制御構造として次を定義している。

| AC | 要件 | Cubism 公式資料との対応 |
|----|------|--------------------------|
| AC-DEF-001 | 描画要素または他の変形制御構造を子として持てること | deformer が ArtMesh や子 deformer を階層化できる点と対応する。 |
| AC-DEF-002 | 局所変形と大域変形を分離できること | チュートリアルの頭部・体・目・口・髪などの階層設計と対応する。 |
| AC-DEF-003 | 回転的変形と面変形を区別できること | rotation deformer と warp deformer の分類と対応する。 |
| AC-DEF-004 | 親子関係を管理し、親の変形が子に伝播すること | Parent-Child Hierarchy Structure と対応する。 |
| AC-DEF-005 | 親子関係、影響範囲、対象描画要素、parameter接続、変形時の破綻を検証できること | Validate Deformer だけでは不足するため、Open Stack 独自の validator 定義が必要。 |

### 2.3 シナリオ文書からの要件

`discussion/scenarios/02_DomainAcceptanceCriteria/204_Deformation_Control_Structure.md` は、Cubism 参照操作と Open Stack 期待結果を分けている。そこから、Open Stack が最低限観測可能にすべき構造は次である。

- deformer の種別: `warp deformer` / `rotation deformer`
- deformer ID、表示名、所属パーツ
- 子要素 ID 一覧: drawable / ArtMesh 相当、子 deformer
- 親 deformer ID と階層パス
- warp の変換分割数、Bezier 分割数、影響範囲
- rotation の回転中心、現在角度、標準角度、ハンドル長相当
- parameter 接続、keyform、対象 drawable、影響範囲
- 操作結果の構造化出力: 作成ID、変更された親子関係、警告有無、除外対象、diff
- validation warning / fail: 親外はみ出し、存在しない parameter、重複接続、参照切れ、影響範囲不整合

このシナリオ文書は、Cubism Editor の画面模倣ではなく、同等の制作能力と検証可能性を Open Editor に求めている。

## 3. Open Stack が表現を検討すべき観測可能プロパティ

| Property | 対象 | 公式資料で観測できること | Open Stack 表現候補 | Validation / Tool relevance |
|----------|------|--------------------------|----------------------|-----------------------------|
| `deformer.id` | warp / rotation | 名前や palette 上の識別は観測できる。 | 安定ID + 表示名。 | diff、operation、AI Agent 指定に必須。 |
| `deformer.kind` | warp / rotation | Warp と Rotation が明確に区別される。 | enum: `warp`, `rotation`。 | AC-DEF-003、runtime evaluation 分岐。 |
| `partId` | warp / rotation | 作成時の挿入先パーツを指定できる。 | authoring grouping metadata。 | Editor整理、selection、report grouping。 |
| `parentId` | drawable / deformer | 親子関係が設定・変更できる。 | nullable parent reference。 | 循環、欠落、評価順序検証。 |
| `children[]` | deformer | 子 ArtMesh / 子 deformer を持つ。 | parent から導出、または明示 children list。 | structure inspection、伝播対象確認。 |
| `hierarchyPath` | drawable / deformer | Palette 上で階層を観測できる。 | validator / viewer 用に導出。 | diagnostics の可読性。 |
| `bounds` | warp | Warp Deformer の範囲やサイズを調整できる。 | local bounds / authoring box。 | 子頂点はみ出し検証。 |
| `warp.bezierDivisions` | warp | 作成時・Inspector で分割数を指定できる。 | Cubism参照属性、または Open warp grid 属性。 | round-trip と編集UIに関係。 |
| `warp.conversionDivisions` | warp | 作成時・Inspector で分割数を指定できる。 | Open evaluator の制御格子と対応づけるか設計する。 | runtime vertex evaluation、警告。 |
| `warp.controlPoints` | warp | 編集レベルや制御点操作がチュートリアルで観測できる。 | keyform state として保持する候補。 | parameter補間、diff、repair。 |
| `warp.originalShape` | warp | Inspector で元形状を確認できる。 | bind pose / rest shape。 | reset、validation、visual diff。 |
| `rotation.pivot` | rotation | 位置調整により回転中心を操作する。 | local pivot point。 | 回転評価、Viewer inspection。 |
| `rotation.angle` | rotation | 角度を操作・確認できる。 | local rotation state。 | keyform補間、runtime state。 |
| `rotation.defaultAngle` | rotation | 標準角度を設定できる。 | bind/default rotation。 | default pose consistency。 |
| `rotation.handleLength` | rotation | ハンドル長を調整できる。 | authoring-only metadata。 | Editor再編集性。 |
| `parameterBindings[]` | deformer / drawable | parameter keyform による編集が観測できる。 | target object state keyed by parameter IDs and values。 | 未接続、欠落 parameter、range外検証。 |
| `keyforms[]` | deformer / drawable | parameter 値ごとの状態を編集できる。 | target-specific keyform map。 | interpolation、missing key diagnostics。 |
| `mappedParameterCount` | object | Verify Mapped Parameters で多すぎる接続を警告できる。 | derived metric。 | complexity warning。 |
| `locked / hidden / selected` | deformer / drawable | Palette で制作支援状態を扱う。 | editor-only state。 | runtime表示状態と混同しない。 |
| `validation.overhangs[]` | warp-child relation | 親 Warp Deformer 外の子頂点を検出できる。 | issue list with parent, child, vertex, distance。 | AC-DEF-005。 |
| `validation.emptyDeformer` | deformer | 空 deformer を検出・選択できる。 | issue on deformer with no children/effective target。 | cleanup、runtime不要要素検出。 |
| `sourceProvenance` | all | Cubism資料には直接のOpen要件はない。 | Open Stack独自 metadata。 | MVP rights / AI Agent provenance。 |

## 4. Validation 関連状態

### 4.1 公式資料から確認できる状態

| 状態 | 公式資料上の扱い | Open Stack での扱い候補 |
|------|------------------|--------------------------|
| 親 Warp Deformer から子頂点がはみ出す | Validate Deformer やハイライトで確認できる。動作自体は可能だが、負荷や調整対象として扱われる。 | `warning`。親ID、子ID、頂点IDまたは座標、はみ出し量、修復候補を出す。 |
| 空 deformer | Model Statistics や Select Uncompleted Deformer で確認できる。 | `warning` または `info`。runtimeに無影響なら cleanup candidate。 |
| object に関連付く parameter が多い | Verify Mapped Parameters で段階的に警告表示される。 | `warning`。MVPでは必須失敗ではなく制作複雑度警告が妥当。 |
| parent / child の keyform が揃っていない | Motion Inversion などの補助機能で処理制約として現れる。 | 反転・自動生成 operation の precondition warning。通常runtime評価の fail とは分ける。 |
| 3D回転表現の適用対象に必要な default key がない | Apply 3D Rotation Expression で error として扱われる。 | authoring assist operation の `error`。Open Stack MVPの必須validatorとは分離可能。 |
| 既存 keyform が上書きされる | Apply 3D Rotation Expression で事前に警告される。 | destructive operation preview / diff に含める。 |

### 4.2 リポジトリACから必要になる状態

次は Open Stack の AC / シナリオから必要だが、今回確認した Cubism 公式資料だけでは同等の公式 validator 項目としては確定できない。

| 状態 | 根拠 | Open Stack での扱い候補 |
|------|------|--------------------------|
| 親子循環 | AC-MVP-009、AC-DEF-004/005 | `fail`。runtime評価順序が定義できない。 |
| parentId / childId の参照切れ | AC-MVP-009、AC-MVP-013 | `fail`。構造ロードまたは評価不能。 |
| target drawable / deformer の存在しない参照 | AC-MVP-009 | `fail`。operation repair candidate を提示。 |
| parameter 未接続 deformer | AC-MVP-009、シナリオ SC-DEF-006 | `warning` または `fail`。静的deformerを許すかどうかで severity が変わる。 |
| 存在しない parameter ID への keyform 参照 | AC-MVP-008/009/013 | `fail`。parameter lookup が解決不能。 |
| keyform が parameter range 外にある | AC-MVP-008/013 | `fail` または `warning`。補間仕様次第。 |
| 親子サイズまたは対象範囲の不整合 | AC-MVP-009、SC-DEF-005 | `warning`。公式 overhang 検証と対応しやすい。 |
| runtime評価不能な deformer | AC-MVP-009/012/013 | `fail`。原因を algorithm unsupported、missing field、invalid numeric などに分解する。 |
| NaN / Infinity / bounds異常 | AC-MVP-013 の runtime load / representative parameter evaluation から派生 | `fail`。公式Cubism資料ではなくOpen runtime品質要件。 |

## 5. 仮説 / 仮定

以下は Open Stack の実装・保存形式を設計するうえで有用な仮説であり、Cubism 公式事実ではない。

1. Rotation Deformer は、Open Stack では `pivot + rotation + optional scale/handle metadata` を持つ2D transform node として表現できる可能性が高い。
2. Warp Deformer は、Open Stack では格子または cage による自由変形ノードとして表現できる可能性が高い。ただし Cubism の Bezier division / conversion division と同じ内部補間を再現する必要は、MVP要件では確認されていない。
3. deformer 階層は tree として表現するのが最小実装として自然である。DAG や複数親を許す必要があるかは未確認である。
4. keyform は「parameter 値の組み合わせ」と「対象 object の local state」を結びつける構造として表現するのが、Editor / Runtime / Validator / AI Agent で扱いやすい。
5. Warp Deformer の keyform state は、制御点差分として保存する案と、評価済み頂点差分として保存する案がある。MVPでは runtime deterministic evaluation と authoring再編集性のどちらを優先するかで選択が変わる。
6. Cubism の 3D回転表現は、Open Stack MVPでは必須機能ではなく、Angle X/Y keyform 作成を支援する authoring operation として後回しにできる可能性がある。

## 6. 設計含意

### 6.1 Open Model Package で保持すべき最小構造

MVPで Cubism 参照の制作能力を満たすには、Open Model Package は少なくとも次を保持する必要がある。

- `deformers[]`
  - `id`
  - `name`
  - `kind`: `warp` / `rotation`
  - `partId`
  - `parentId`
  - `children` または parent から導出可能な child index
  - `authoringVisible`, `locked` など runtime と分離した editor state
- `warp` 固有属性
  - bounds / authoring box
  - conversion divisions
  - Bezier divisions
  - rest shape
  - keyform ごとの control state
- `rotation` 固有属性
  - pivot
  - angle
  - default angle
  - handle length または editor handle metadata
- `parameterBindings`
  - target object ID
  - parameter IDs
  - key values
  - interpolation policy
  - target local state
- `validationMetadata`
  - check ID
  - target ID
  - severity
  - evidence
  - repair candidate
  - related AC / scenario

### 6.2 Runtime と Editor の責務分離

公式資料には、Editor 上の操作補助属性が多い。Open Stack では、次を混同しない必要がある。

| 分類 | 例 | Runtime に必要か |
|------|----|------------------|
| 評価に必要な状態 | parentId、kind、pivot、angle、warp control state、parameter keyforms | 必要 |
| authoring 再編集に必要な状態 | handle length、edit level、selection、lock、palette ordering | 原則 Editor 用。保存は必要でも runtime evaluation とは分離する。 |
| validation / diagnostics に必要な状態 | rest bounds、source provenance、ACリンク、operation history | runtime core には不要だが Validator / AI Agent には重要。 |

### 6.3 Validator の設計方針

公式 Validate Deformer は Open Stack validator の一部にすぎない。MVP validator は、公式資料で観測できる warning に加えて、Open Model Package と runtime evaluation の成立性を検証する必要がある。

推奨する severity の初期案は次である。

| Check | 初期 severity | 理由 |
|-------|---------------|------|
| 親子循環 | `fail` | 評価順序が定義できない。 |
| 参照切れ parent / child / target | `fail` | 保存形式またはruntimeロードの整合性が壊れる。 |
| 存在しない parameter 参照 | `fail` | keyform評価が解決できない。 |
| runtime unsupported deformer kind | `fail` | Viewer / Runtime要件を満たせない。 |
| 親 Warp からの子頂点はみ出し | `warning` | 公式資料でも動作自体は可能な調整対象として扱われる。 |
| 空 deformer | `warning` | 不要または未完成の可能性が高いが、即runtime失敗とは限らない。 |
| parameter 未接続 deformer | `warning` | 静的なまとめ用 deformer を許す場合がある。MVPミニモデルの必須可動対象なら `fail` に上げる。 |
| mapped parameter 過多 | `warning` | 公式にも複雑度警告として扱われる。 |
| authoring assist の precondition 不足 | `error` for operation | モデル全体の validator fail ではなく、操作実行不能として扱う。 |

### 6.4 AI Agent / Tool 可視性

AI Agent が検証・補助・repair candidate を扱うには、Editor の表示状態だけでなく、構造化 inspection API が必要である。

最低限、次の query が必要になる。

- deformer tree を ID、名前、種別、親、子、所属パーツで取得する。
- deformer ごとの local editable state と evaluated runtime state を分けて取得する。
- parameter から影響対象 deformer / drawable / keyform を逆引きする。
- deformer から接続 parameter / keyform を逆引きする。
- 指定 parameter 値で評価した drawable vertex state、bounds、diagnostics を取得する。
- validation issue から該当 deformer / child vertex / parameter / keyform へジャンプできる。
- 編集 operation の dry-run で、構造 diff、runtime diff、validation diff を出す。

## 7. 未決事項

1. Warp Deformer の Open 実装を、格子FFD、Bezier patch、MLS、cage deformation のどれに寄せるか。Cubism の分割数名を保持するだけでは、Open Runtime の評価仕様は決まらない。
2. `Bezier division` と `conversion division` を Open Package の正規属性にするか、Cubism参照由来の互換メタデータに留めるか。
3. Warp keyform を制御点状態として保存するか、評価済み mesh vertex state として保存するか。前者は再編集性、後者は runtime実装単純性に寄る。
4. Rotation Deformer の `handle length` を保存形式に含めるか。runtime には不要でも、Editor round-trip には必要な可能性がある。
5. deformer 親子構造を厳密な tree にするか、将来の共有・DAG を見越すか。MVPでは tree が妥当に見えるが、明文化が必要である。
6. parameter 未接続 deformer を常に warning にするか、MVP可動対象だけ fail にするか。
7. 空 deformer を保存禁止にするか、authoring途中の状態として保存可能にするか。
8. 親 Warp からの子頂点はみ出しを、どの閾値・座標系・評価時点で判定するか。
9. 3D回転表現を MVP に含めるか、Angle X/Y keyform 制作の参考・将来機能に留めるか。
10. Open Stack の標準 parameter 名を Cubism 標準名にどの程度寄せるか。MVP文書では標準名を参考 alias として保持できる場合は識別可能にする方針だが、必須スキーマは未確定である。

## 8. まとめ

Cubism 公式資料から観測できる deformer semantics は、主に次の外部仕様として整理できる。

- Warp Deformer と Rotation Deformer は、面状変形と回転的変形の異なる制作概念である。
- Deformer は ArtMesh や子 deformer を持ち、親の変形が子へ伝播する階層構造を作る。
- Parameter / keyform により、deformer や ArtMesh の状態を parameter 値に紐づけて編集できる。
- Editor は、deformer tree、Inspector、Parameter Palette、validation / highlight / statistics などを通じて、構造と問題状態をユーザーに見せている。
- 公式資料は、はみ出し、空 deformer、mapped parameter 過多、authoring assist の precondition などを確認する機能を示している。

一方で、Cubism の未文書内部アルゴリズムを Open Stack の仕様として採用すべきではない。Open Stack では、公式資料で観測できる制作能力を満たすために、deformer 種別、親子階層、parameter/keyform 接続、runtime評価、Validator issue、AI-readable diff を独自の明示仕様として定義する必要がある。
