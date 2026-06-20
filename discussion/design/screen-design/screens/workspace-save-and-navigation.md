# Workspace Save / Navigation 画面仕様

> 状態: Accepted direction / Draft screen spec。Workspace Save v0 のUX方針、Header / Toolbox責務分離、保存タイミング、Portable JSONとの境界を定義する。

## 1. 役割

Workspace Saveは、日常作業を継続するための保存である。

Portable JSON Exportは、共有、バックアップ、別環境への持ち運び用の単一ファイルexportであり、Workspace Saveとは別責務である。Runtime Exportは、将来のruntime / camera capture連携向け成果物出力であり、この仕様では扱わない。

この画面仕様は、Editorを「workspace-first」にする。ユーザーがPSD import、mesh、deformer、dynamics、texture atlasなどの編集操作を始める時点で、作業先workspaceが存在していることを前提にする。

## 2. 保存概念

| Concept | 目的 | 主な形式 | UX上の位置 |
|---|---|---|---|
| Workspace Save | 編集作業の継続 | directory workspace | Header / Workspace menu |
| Portable JSON Export | 共有、バックアップ、移動 | single JSON download | Header / Workspace menu |
| Runtime Export | 実行環境向け成果物 | 未定 | Future scope |

Workspace SaveはPortable JSONの別名ではない。既存 `PackageDocument` の論理構造をfile setとして展開し、raw binary filesを参照pathに保存する。

## 3. Workspace Gate

workspaceが開かれていない初期状態では、編集画面を表示しない。

このGateは独立したlanding pageではない。既存のAuthoring Workspace shellのHeader領域を使い、Header内にworkspace作成/読込の主要操作を横並びで置く。Toolbox、Parts Tree、Canvas、Inspector、Parameter Barなどの編集領域は、workspaceが開かれるまで表示しない。

```text
+--------------------------------------------------------------------------------+
| Private 2D Rigging Lab   [Create Workspace] [Open Workspace] [Import Portable]  |
+--------------------------------------------------------------------------------+
|                                                                                |
|                         No workspace is open                                   |
|                                                                                |
+--------------------------------------------------------------------------------+
```

Gate前に表示しないもの:

- Toolbox
- Parts Tree
- Canvas / Preview
- Inspector
- Parameter Bar
- PSD Import
- Mesh / Rig / Dynamics
- Texture Atlas
- Validate
- Viewer
- Save

`Import Portable JSON` は、portable projectを読み込んだあと、そのままtemporary draftとして編集可能にしない。ユーザーはworkspace directoryを選び、`Create Workspace From Portable Project` としてworkspace化してから編集へ入る。

Temporary draftは作らない。これは、PSD由来textureやatlas artifactのような重いbinary assetを保存先未確定のままpendingにしないためである。

## 4. Create / Open Workspace

### 4.1 Create Workspace

ユーザーは保存先directoryを選ぶ。内部的にはそのdirectoryへworkspace metadataと初期package file setを作成する。

```text
Create Workspace
  -> choose directory
  -> write workspace.json
  -> write initial package file set
  -> enter Authoring Workspace
```

### 4.2 Open Workspace

ユーザー操作としてはdirectoryを選択する。内部処理では、そのdirectory内の `workspace.json` / `manifest.json` などを読み、workspaceとして妥当か検証する。

```text
Open Workspace
  -> choose directory
  -> validate workspace.json
  -> read package file set
  -> hydrate binary assets
  -> enter Authoring Workspace
```

`.ail2d-workspace` のような拡張子つきdirectory名は推奨してよいが、ユーザーにファイル選択を要求するUXではない。

## 5. Header / Toolbox 責務分離

Headerは、workspace / app-level操作を扱う。

Toolboxは、開いているworkspace内部でモデルを編集・確認するtool / task / viewを扱う。

### 5.1 Header

Headerに置くもの:

- workspace name
- save status: `Saved`, `Unsaved changes`, `Saving...`, `Save failed`
- Workspace menu
- Save
- Undo / Redo

Workspace menuに置くもの:

- Save
- Save As...
- Open Workspace...
- Create Workspace...
- Export Portable JSON...
- Import Portable JSON...

Headerから外すもの:

- Parameters
- Variants
- Texture Atlas
- Validate
- Viewer
- Import PSD

これらはworkspace内部の作業対象であり、Toolboxまたは各screen内の操作として扱う。

### 5.2 Toolbox

Toolboxに置くもの:

- Select
- Mesh
- Rig
- Dynamics
- Import PSD
- Parameters
- Variants
- Texture Atlas
- Validate
- Viewer

Toolboxから外すもの:

- Project Storage
- Open Workspace
- Create Workspace
- Save / Save As
- Portable JSON Export / Import

`Import PSD` はHeaderではなくToolboxに置く。PSD importは「アプリにファイルを開く」操作ではなく、「現在のworkspaceに素材を追加する」操作だからである。

## 6. 編集画面から別Workspaceを開く

編集中に別workspaceを開く導線は、HeaderのWorkspace menuに置く。

```text
[my-model.ail2d-workspace v]  Saved

Workspace menu:
  Save
  Save As...
  Open Workspace...
  Create Workspace...
  Export Portable JSON...
  Import Portable JSON...
```

Toolboxには置かない。別workspaceを開く操作はworkspace内部の編集toolではなく、作業場所を切り替えるapp-level操作である。

dirty stateがある場合は確認を挟む。

```text
Unsaved changes

[Save and Open] [Cancel]
```

v0では `Open without saving` を出さない方針を推奨する。Workspace-first UXでは、作業状態を失う操作を通常導線に置かない方がよい。

## 7. 保存タイミングと対象

Saveは「全ファイルを毎回書く」操作ではない。保存時にはsave planを作り、dirtyな軽量JSONと、未保存またはdigest不一致のbinaryだけを書き出す。

```text
Save Plan
  JSON documents:
    write if dirty
  Binary assets:
    write only if missing or digest mismatch
  Atlas artifacts:
    write only if committed and missing/stale on disk
  Preview / draft / transient state:
    do not write
```

### 7.1 軽量JSON

通常のSaveで更新してよい。

- graph
- drawables
- meshes
- parameters
- keyforms
- rig controls
- dynamics
- masks
- draw order
- editor-state
- manifest / source manifest / provenance / rights

### 7.2 入力由来の重いbinary

PSD importなどで生成されるtexture raw RGBAは、基本的に生成後は不変である。

Workspaceが既にある場合:

- import完了時にworkspaceへflushする。
- 以後のSaveでは、missingまたはdigest mismatchの場合だけ再書き込みする。

Workspaceがない場合:

- Workspace Gateにより通常発生しない。
- Portable JSON import時も、編集前にworkspace化するため、pending binaryを長時間保持しない。

PSD元ファイルbytesは保存対象にしない。保存するのは、Editorが実際に扱う抽出済みlayer raw RGBAと関連metadataである。

### 7.3 生成由来の重いartifact

Texture Atlasの `Generate Preview` は一時previewであり、保存対象にしない。

保存対象にするのは `Apply Atlas` 済みのcommitted runtime atlas artifactだけである。

- generated atlas raw RGBA
- texture atlas layout summary
- placements
- sourceSignature
- related binary asset reference

`Apply Atlas` 時点でworkspaceがあるなら、そのartifact binaryをworkspaceへflushしてよい。通常のSaveでは、artifactが未保存またはdigest不一致の場合だけ再書き込みする。

## 8. Directory Layout v0

既存 `PackageDocument` のfile set構造を優先する。

```text
<project>.ail2d-workspace/
  workspace.json
  manifest.json
  model/
    graph.json
    drawables.json
    meshes.json
    parameters.json
    keyforms.json
    rig-controls.json
    dynamics.json
    masks.json
    draw-order.json
    editor-state.json
  assets/
    sources/
      source-manifest.json
    textures/
      texture-atlas.json
      psd/<token>/<layer>.raw-rgba
      generated_atlas_page_0.raw-rgba
    thumbnails/
    provenance.json
    rights.json
  metadata/
    binary-asset-index.json
    byte-intake-summaries.json
```

`assets/atlas/` や `binary/` のような新規rootはv0では作らない。既存schemaの `BinaryAssetReference.packageRelativePath` と一致する場所にraw bytesを置く方が安全である。

`workspace.json` はentrypointとworkspace metadataに留める。package本体を二重管理する巨大 `project.json` はv0では作らない。

## 9. Project Storage Taskの扱い

現行のProject Storage Taskは、Portable JSON save/loadとstatus表示を扱うtoolbox taskとして存在している。

Workspace-first UXでは、Project StorageはToolboxから外し、HeaderのWorkspace menuまたはWorkspace detailsへ移す。

Portable JSON Export / Importは残すが、日常保存の主導線ではない。

## 10. 状態表示

ユーザーに見せる主状態:

- `Saved`
- `Unsaved changes`
- `Saving...`
- `Save failed`

内部的には、少なくとも以下を分ける。

- workspace target known
- document dirty
- binary assets pending
- atlas artifact pending
- last saved at
- last save error

UI上は単純な表示でよいが、保存実装は軽量JSONと重いbinary assetを同一dirty flagで扱わない。

## 11. 非ゴール

- Runtime Export
- camera capture連携
- file watcher / external edit merge
- collaboration / conflict resolution
- cloud sync
- workspaceなし temporary draft editing
- Save時の全binary強制再書き込み
- Portable JSONの廃止

## 12. 実装時の注意

- File System Access API非対応環境では、Workspace Saveをdisabledにし、Portable JSON Export / Importへfallbackする。
- path traversalを拒否する。`..`、absolute path、workspace外pathを受け入れない。
- binary indexは補助情報であり、矛盾時はpackage document内のreferencesと実ファイル検証を正とする。
- atlasがstaleな場合でもworkspace保存は可能だが、Viewer `Atlas Runtime` は既存仕様通りdisabled/fallbackする。
- `activeEntry="import"` が通常workspaceへ戻る意味で使われている現状命名は、将来的に中立なworkspace route名へ改める。

## 13. テスト観点

- Create Workspace後に編集UIが有効になる。
- Gate前にToolboxと編集操作が表示されない。
- Open Workspaceはdirectory選択からworkspaceをhydrateする。
- Portable JSON import後はworkspace化なしに編集へ入れない。
- SaveはJSON dirtyのみならbinaryを書き直さない。
- PSD import後のraw RGBAはworkspaceへ保存され、通常Saveで再書き込みされない。
- Apply Atlas後のgenerated atlas raw RGBAはworkspaceへ保存され、通常Saveで再書き込みされない。
- Save Asは別workspaceとしてfile setを作る。
- dirty状態でOpen Workspaceを選ぶとSave and Open / Cancelの確認が出る。
- Project StorageはToolboxから消え、Header Workspace menuからPortable JSON操作へ到達できる。
