# Parameter Manager 画面仕様

> 状態: Draft screen spec。Parameter定義を管理し、Preset parameterとCustom parameterを区別して扱う。

## 1. 役割

Parameter Managerは、project内のparameter定義を一覧・作成・確認・編集する専用画面である。

この画面はcurrent valueを動かす場所ではない。current value操作とkeyform authoringはParameter Barとparameter-aware Inspectorが扱う。Parameter Managerは「どのparameterが存在し、それがPreset由来かCustomか、どこで使われているか」を管理する。

Parameter preset / facadeの上位設計は [../../parameter-preset-ecosystem.md](../../parameter-preset-ecosystem.md) を参照する。

基本方針:

- Parameter BarとParameter Managerを分離する。
- Preset parameterとCustom parameterを明確に分ける。
- Preset parameterは常設の意味カタログ兼parameter surfaceとして、初期状態からTableに全て表示する。
- semantic roleはPreset parameterだけが持つ。
- Custom parameterはroleを持たず、`none` / `Custom` 扱いにする。
- Preset parameterはrole、group、range、sign conventionを固定し、削除不可にする。
- Custom parameterはユーザーが作成・編集・削除できる。
- Usage / Impactは常設大パネルではなく、summaryとdetailsで扱う。
- warning / errorはCheck Stripにsummary表示し、通常時は画面を圧迫しない。
- note / memo欄は初期仕様に置かない。

## 2. 開き方

Parameter Managerは、Authoring Workspaceから開く専用Manager / Task画面として扱う。

```text
Authoring Workspace
  -> Parameter Bar / App Bar / Toolbox
  -> Parameter Manager
  -> parameterを作成・確認・編集
  -> Close
  -> Authoring Workspace
```

Parameter Barからの導線:

```text
Parameter Bar
  -> [Manage]
  -> Parameter Manager
```

作業中に最小限のparameterを作る場合はQuick Createを使ってよい。ただし、Preset選択、usage確認、詳細編集はParameter Managerへ送る。

## 3. 画面配置

```text
+--------------------------------------------------------------------------------+
| Parameter Manager                                      [+ Custom] [Close]       |
+--------------------------------------------------------------------------------+
| [All] [Face] [Eyes] [Mouth] [Brow/Cheek] [Body] [Secondary] [Custom]  Search   |
+--------------------------------------------------------------------------------+
| Parameters                                      | Parameter Details             |
|-------------------------------------------------|-------------------------------|
| > Face Angle X   Preset locked    -30 / 0 / 30  | Kind: Preset locked           |
| Eye Left Open    Preset locked      0 / 1 / 1   | Display name                  |
| Mouth Open       Preset locked      0 / 0 / 1   | Stable id: locked             |
| Custom Smile     Custom             0 / 0 / 1   | Role: face.angle.x locked     |
|                                                 | Group: Face locked            |
|                                                 | Range: -30 / 0 / 30 locked   |
|                                                 |                               |
|                                                 | [Set Active]                  |
|                                                 | Usage: Used by 2 targets      |
|                                                 | [View Usage]                  |
+--------------------------------------------------------------------------------+
| 1 warning: Custom Smile is unused.                                      [Review]|
+--------------------------------------------------------------------------------+
```

主領域:

| 領域 | 役割 |
|---|---|
| Header | `+ Custom`、Closeを置く。 |
| Filter Row | group label filter、search、warnings filterを置く。 |
| Parameter Table | project内parameterを一覧し、選択する。 |
| Parameter Details | 選択parameterの詳細、lock状態、usage summary、主要actionを表示する。 |
| Check Strip | warning / errorがある時だけsummaryを表示する。 |

## 4. Group Filter

Parameter groupは左ペインとして常設しない。上部のlabel button / segmented filterとして扱う。

```text
[All] [Face] [Eyes] [Mouth] [Brow/Cheek] [Body] [Secondary] [Custom]
```

理由:

- Parameter数は多くても数十程度であり、階層ツリーで管理する対象ではない。
- 左ペインを置くと、Parameter TableとDetailsの幅を圧迫する。
- groupは構造管理ではなく絞り込み用途で足りる。

Filter Rowに置くもの:

- group label filter
- search box
- only warnings toggle

置かないもの:

- group tree
- group作成専用ペイン
- nested group management

## 5. Parameter Table

Parameter Tableは、project内に存在するparameter一覧である。Preset parameterは常時存在し、未使用でもTableに表示する。

表示すべきもの:

| Column | 内容 |
|---|---|
| Name | 人間向け表示名。Presetの場合は標準名またはdisplay label override。 |
| Kind | `Preset locked` または `Custom`。 |
| Range | min / default / max summary。 |
| Used | usage count summary。 |
| Warning | warning badge。問題がない場合は表示しない。 |

例:

```text
Name             Kind            Range        Used
Face Angle X     Preset locked   -30/0/30     2
Eye Left Open    Preset locked     0/1/1      0
Mouth Open       Preset locked     0/0/1      1
Breath           Preset locked     0/0/1      0
Custom Smile     Custom            0/0/1      0
```

Tableに常時表示しないもの:

- raw operation id
- generated refs
- full stable ref
- validation payload
- full usage list

roleとstable idは重要だが、Tableには常時出さずDetails側に置く。人間が一覧で判断したい主情報は、Name、Kind、Range、Usedである。

## 6. Parameter Details

Parameter Detailsは、選択parameterの詳細とactionを表示する右ペインである。

### 6.1 Preset parameter

Preset parameterは、外部facadeやCamera Captureが参照できるsemantic contractを持つ。そのため、大部分の定義はlockする。

表示するもの:

- Kind: `Preset locked`
- display name
- stable id
- role
- group
- type
- min / default / max
- range meaning / sign convention summary
- usage summary

編集できるもの:

- display name override / local label

編集できないもの:

- stable id
- role
- group
- type
- min / default / max
- sign convention
- delete

主action:

- Set Active
- View Usage

Preset parameterは削除不可にする。削除できるようにすると、preset role catalogとfacade mappingの信頼性が下がる。

### 6.2 Custom parameter

Custom parameterはsemantic roleを持たないproject-local parameterである。

表示するもの:

- Kind: `Custom`
- display name
- stable id
- role: `none`
- group: `Custom`
- type
- min / default / max
- usage summary

編集できるもの:

- display name
- stable id
- type
- min / default / max

編集できないもの:

- role

Custom parameterに任意roleを付けるUIは置かない。外部連携したいcustom parameterがある場合は、Facade / Mapping側で明示的にparameter idへ接続する。

主action:

- Set Active
- Duplicate
- View Usage
- Delete
- Refactor stable id

stable id変更は単なるrenameではなく、既存参照更新を伴うrefactor actionとして扱う。既存usageがある場合は、変更前にimpact confirmationを表示する。

## 7. Usage Details

Usageは常時大きなパネルとして表示しない。Details内ではsummaryだけを表示し、必要時にdetailsを開く。

```text
Usage
Used by 3 targets
[View Usage]
```

`View Usage` で表示するもの:

```text
Face Angle X usage
- Warp Deformer: Head Warp / lattice keyforms
- Rotation Deformer: Neck Rotate / angle keyforms
- Drawable: left_eye_highlight / opacity keyforms
```

表示粒度:

- target type
- target display name
- keyformed property
- keyform count
- invalid / missing reference badge

通常表示しないもの:

- raw operation payload
- generated refs全文
- evidence path
- validation report全文

Usage Detailsが必要になる主な場面:

- このparameterがどのkeyformで使われているか知りたい。
- stable id refactorの影響範囲を確認したい。
- range変更でout-of-range keyformが出るか確認したい。
- delete前に参照が残っていないか確認したい。

## 8. Check Strip

Check Stripはwarning / error summaryである。問題がない場合は表示しない、または非常に低い高さに留める。

例:

```text
1 warning: Custom Smile is unused. [Review]
```

表示対象:

- duplicate stable id
- invalid range
- default out of range
- keyform out of range
- missing parameter reference
- unused custom parameter

Preset parameterは常時存在するため、`Used = 0` でもwarningにしない。未使用Presetは正常状態である。

Check Stripは問題の入口であり、常設のdebug/evidence surfaceではない。詳細はReview action、Usage Details、Diagnostics / Evidence Viewへ送る。

## 9. 作成フロー

### 9.1 Preset

Preset parameterは作成フローを持たない。

初期状態からrole catalog全体がParameter Tableに表示され、keyformやbindingが設定されない限りruntime上の効果を持たない。

```text
Project open
  -> Preset parameters are already listed
  -> User selects a preset parameter
  -> User sets keyforms / bindings when needed
  -> Used count increases
```

これにより、ユーザーが必要なPresetを個別に追加して回るUXを避ける。

### 9.2 Custom

`+ Custom` はroleなしのproject-local scalar parameterを作成する導線である。

```text
[+ Custom]
  -> display name / stable id / min / default / max
  -> Create
  -> Custom rowとしてParameter Tableに追加
```

Custom parameterは自由度を持つが、semantic roleは持たない。

## 10. 他UIとの関係

| UI | Parameter Managerとの関係 |
|---|---|
| Parameter Bar | active parameterとcurrent valueを操作する。`Manage` からParameter Managerを開く。 |
| Parameter-aware Inspector | 選択対象のpropertyをkeyformとしてAdd / Update / Deleteする。parameter定義の詳細管理はしない。 |
| Rig Tool | Warp / Rotation keyformでparameterを参照する。必要ならParameter Managerでpreset/custom parameterを作成する。 |
| Drawable Inspector | opacity keyformでparameterを参照する。 |
| Dynamics Tool | 初期は手動binding中心。semantic role体系を直接支配しない。 |
| Variant / Expression Manager | 初期は差分idとmappingで扱い、parameter role体系を直接支配しない。 |
| Viewer / Runtime View | displayName、range、defaultを使ってmanual controlsを表示する。 |
| Camera Capture Facade | Preset role、range meaning、sign conventionを参照してexternal inputをmappingする。 |
| Diagnostics / Evidence View | raw refs、operation traces、validation evidenceを扱う。通常UIには混ぜない。 |

## 11. 通常表示しないもの

- operation ID
- generated refs全文
- evidence path
- raw runtime evidence
- validator payload全文
- command result payload全文
- tracker固有input source
- calibration / smoothing詳細
- export alias

これらは通常UIの視認性を悪化させるため、Diagnostics / Evidence View、Camera Capture Facade、またはCodex-facing structured surfaceへ分離する。

## 12. 関連機能ID

現行の `UX-FEAT-001`〜`UX-FEAT-037` の棚卸では、Parameter Managerは次の既存機能の正式ホームになる。

- `UX-FEAT-002`: Parameter list
- `UX-FEAT-003`: Parameter creation / operation status

関連する既存機能:

- 一部 `UX-FEAT-007`: Viewer / Runtime parameter controls
- 一部 `UX-FEAT-020`〜`UX-FEAT-025`: composition / rig / dynamics parameter references
- 一部 `UX-FEAT-028` / `UX-FEAT-029`: Product Preflight / validation
- 一部 `UX-FEAT-034`: runtime / package evidence summary

## 13. 未決事項

- Preset parameterのdisplay name overrideをv0で許可するか。
- Preset roleごとのmin/default/maxとsign conventionをParameter Detailsでどの粒度まで表示するか。
- Custom parameterのtypeをscalar以外へ広げる時期。
- stable id auto suggestionの規則。
- unused custom parameterをwarningにするかinfoにするか。
- Range変更時のexisting keyform rescaleを許可するか、単にreject / warnにするか。
