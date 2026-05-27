# project-defined model package Design

> 状態: Draft
> 目的: MVPの project-defined model package について、ファイル構成、stable ID、operation log、versioning / migration、asset / provenance / rights metadata、schema validation と runtime validation の境界を固定する。

## 1. 根拠の分離

### 1.1 リポジトリ事実

- `AC-MVP-002` は、入力素材、texture、sample package、validation fixture、AI編集結果について、出典、作成者、ライセンス、生成・編集手順、AI利用有無、再配布可否を provenance として記録できることを要求する。
- `AC-MVP-004` は、drawable が stable ID、元素材対応、texture参照、初期配置、表示状態、opacity、draw order、part所属を持つことを要求する。
- `AC-MVP-011` は、保存と再読み込みで素材対応、drawable、texture、part、mesh、parameter、keyform、rig control、clipping、draw order、rights metadata、provenance が保持されることを要求する。
- `AC-MVP-013` は、package schema、format version、必須ファイル、asset reference、rights metadata、provenance、runtime load testを検証対象にしている。
- `AC-MVP-014` は、AI Agent が stable ID に基づく inspection、operation dry-run、diff、validation report を扱うことを要求する。

### 1.2 公式・参照事実

- RigControl参照レポートは、rig control definition、keyform state、operation log、validation reportが同じ stable ID を参照する必要があると整理している。
- Viewer / Preview参照レポートは、Editor-only production support state と runtime-visible model state を混同しないことを強調している。
- Runtime評価セマンティクス参照レポートは、snapshotに packageRevision、packageHash、authoringRevision、evaluatorVersions を含める案を提示している。

### 1.3 設計仮定

- MVP package はディレクトリ形式を第一候補にする。拡張子は例として `.openpackage/` を使う。
- MVP package の正規データはJSON系テキストを第一候補にする。binary assetは `assets/` に置く。
- schemaは実装リポジトリ内の共有schemaを正とし、package内へschema copyを必須同梱しない。

## 2. ファイル構成

MVP package は、AI-readable、差分管理、schema validation、runtime loadを優先し、単一巨大JSONではなく責務別ファイルに分ける。

```text
MVPAvatar_Clean.openpackage/
  manifest.json
  model/
    graph.json
    drawables.json
    meshes.json
    parameters.json
    keyforms.json
    rig-controls.json
    masks.json
    draw-order.json
    editor-state.json
  assets/
    sources/
      source-manifest.json
      *.png
      *.psd
    textures/
      texture-atlas.json
      *.png
    thumbnails/
      *.png
    provenance.json
    rights.json
  operations/
    log.jsonl
    checkpoints/
      checkpoint-manifest.json
  validation/
    reports/
      *.validation.json
  runtime/
    snapshots/
      *.runtime-snapshot.json
```

### 2.1 `manifest.json`

Package全体の入口である。

必須項目:

- `packageId`
- `packageDisplayName`
- `formatVersion`
- `packageRevision`
- `createdAt`
- `updatedAt`
- `schemaVersions`
- `evaluatorVersions`
- `modelFiles`
- `assetIndex`
- `operationLog`
- `rightsSummary`
- `provenanceSummary`
- `packageStableOrderVersion`

### 2.2 `model/graph.json`

モデル全体のID tableと参照graphを保持する。

- part tree
- drawable membership
- rig control hierarchy root
- target bindings
- stable package order
- coordinate system
- canvas size

`graph.json` は個別要素の詳細をすべて持たない。詳細は `drawables.json`、`meshes.json`、`parameters.json` などへ分ける。

### 2.3 `model/drawables.json`

drawable runtime-visible stateを保持する。

- `drawableId`
- `displayName`
- `partId`
- `sourceAssetId`
- `textureId`
- `meshId`
- `defaultOpacity`
- `runtimeVisibility`
- `baseDrawOrder`
- `maskTargetId`
- `sourceProvenanceId`

### 2.4 `model/meshes.json`

meshのrest stateを保持する。

- `meshId`
- `drawableId`
- `vertices`
- `uvs`
- `triangles`
- `vertexStableIds`
- `bounds`
- `generationProvenanceId`

MVPではUV animationやtexture switchingは持たない。

### 2.5 `model/parameters.json`

parameter定義を保持する。

- `parameterId`
- `displayName`
- `semanticRole`
- `min`
- `max`
- `default`
- `recommendedUiStep`

`semanticRole` はproject-defined preset内の説明・検証用roleであり、外部互換IDではない。

### 2.6 `model/keyforms.json`

keyformを、parameter値に対する target property の評価関数として保持する。

- `keyformSetId`
- `targetId`
- `targetKind`
- `targetProperty`
- `parameterIds`
- `evaluatorVersion`
- `compositionMode`
- `compositionOrder`
- `keys`

MVP baselineは `linear-1d-v1` とする。顔 face yaw / pitch の斜め方向をどう表すかは実装前未決事項に残す。

### 2.7 `model/rig-controls.json`

`rotation2d` と `warpLattice2d` を runtime-visible graph node として保持する。

共通項目:

- `rigControlId`
- `displayName`
- `kind`
- `partId`
- `parentId`
- `childDrawableIds`
- `childRigControlIds`
- `bindSpace`
- `enabled`

`rotation2d`:

- `pivot`
- `restAngle`
- `restTranslation`
- `restScale`
- `handleLength`

`warpLattice2d`:

- `domainBounds`
- `latticeColumns`
- `latticeRows`
- `restControlPoints`
- `controlPointStableIds`
- `interpolationMethod`
- `interpolationVersion`

MVPの既定は `bindSpace: rigControlLocalRest` と `interpolationMethod: bilinear-grid-v1` である。

### 2.8 `model/masks.json`

clipping / mask relationを保持する。

- `maskRelationId`
- `maskDrawableIds`
- `targetDrawableIds`
- `maskGroupHint`
- `enabled`

SDK target固有のmask packingはMVP外に置く。

### 2.9 `model/draw-order.json`

draw orderのruntime-visible sourceを保持する。

- `drawableId`
- `baseDrawOrder`
- `stableOrder`
- optional keyform target reference

低い値を奥、高い値を手前とする。tieは `stableOrder`、さらに必要ならstable ID lexical orderで決める。

### 2.10 `model/editor-state.json`

Editor-only production support stateを保持する。Runtime loaderは既定では無視する。

- selection
- lock
- editor hide
- tree expansion
- active tool
- canvas zoom / pan
- overlay preference
- recent warnings

`runtimeVisibility`、opacity、draw orderとは別名・別ファイルに分ける。

## 3. Stable ID 方針

Stable ID は、人間向け名、ファイル名、表示順から独立させる。

| 対象 | Prefix例 | 方針 |
|---|---|---|
| package | `pkg_` | package生成時に作成。renameで変えない |
| source asset | `src_` | asset hashとは別。差し替え時も同一素材対応なら保持可能 |
| texture | `tex_` | atlas再生成でファイル名が変わってもIDは保持 |
| part | `part_` | displayName変更で変えない |
| drawable | `draw_` | 元レイヤー名やpart変更で変えない |
| mesh | `mesh_` | drawableに紐づくが、再生成時はoperationで履歴を残す |
| parameter | `param_` | `faceYaw` などのaliasとは別 |
| keyform set | `keyset_` | target property単位で安定化 |
| rig control | `rig_` | hierarchy移動やdisplayName変更で変えない |
| mask relation | `maskrel_` | mask group最適化で変えない |
| operation | `op_` | operation logの不変ID |
| validation report | `val_` | report生成ごとに作る |
| runtime snapshot | `snap_` | snapshot生成ごとに作る |

ID生成は実装時に衝突しない方式へ委譲するが、MVP設計上は次を満たす必要がある。

- IDはpackage内で一意である。
- IDはrename、並べ替え、part移動、draw order変更で変えない。
- 外部assetのcontent hashは同一性検査に使うが、model objectのstable IDにはしない。
- AI Agent、Validator、operation log、runtime snapshot、diffは同じIDを参照する。

## 4. Operation Log

Operation log は `operations/log.jsonl` のappend-only JSONLを第一候補にする。

1行は1 transaction とする。ドラッグ中の細かいmousemoveは、必要ならraw sampleとして持てるが、正規operationはcommit時に圧縮する。

必須項目:

- `operationId`
- `transactionId`
- `timestamp`
- `actor`: `human`, `ai`, `migration`, `importer`, `validatorRepairCandidate`
- `surface`: `gui`, `file`, `structuredApi`, `migration`
- `operationType`
- `targetIds`
- `precondition`
- `payload`
- `result`
- `provenanceId`
- `validationReportId`
- `runtimeSnapshotIds`
- `reversible`

Operation log は次に使う。

- GUI undo / redo
- AI dry-run と実適用の比較
- GUI authoring evidence
- migration provenance
- repair candidateの根拠
- Acceptance Runnerが「GUI制作フローを通った」ことを判定する証拠

## 5. Versioning / Migration

### 5.1 Version fields

Packageは複数のversionを分けて持つ。

| Field | 意味 |
|---|---|
| `formatVersion` | package全体の互換性 |
| `schemaVersions` | 各JSONファイルのschema version |
| `evaluatorVersions` | runtime evaluatorの意味論version |
| `packageRevision` | package編集履歴上のrevision |
| `operationLogVersion` | operation entry schema |
| `migrationHistory` | 適用済みmigration |

### 5.2 Migration policy

- migrationは operation core を通る。
- migrationは自動で本体を静かに書き換えない。
- migration前後の model diff、validation diff、runtime diff を保存できる。
- migrationによって見た目が変わる可能性がある場合は `needs_review` とする。
- evaluator version変更は、schema migrationとは別に扱う。

## 6. Asset / Provenance / Rights Metadata

`assets/provenance.json` と `assets/rights.json` は、assetごとの権利と生成経路を持つ。

最低限必要な項目:

- `assetId`
- `assetKind`: `source`, `texture`, `thumbnail`, `generatedFixture`, `aiEdit`
- `filePath`
- `contentHash`
- `creator`
- `sourceUrl`
- `license`
- `redistributionAllowed`
- `createdAt`
- `generatedBy`
- `aiUsed`
- `transformHistory`
- `relatedOperationIds`
- `rightsStatus`: `cleared`, `needs_review`, `blocked`

Rights metadataは、MVP sample package、validation fixture、AI編集結果にも必須とする。

## 7. Schema Validation と Runtime Validation の境界

| 層 | 検証すること | 検証しないこと |
|---|---|---|
| Schema validation | JSON構造、必須field、型、enum、version、配列長の基本制約 | cross-file参照の存在、runtime評価可能性、見た目品質 |
| Package reference validation | manifestのfile存在、asset reference、ID table、重複ID、参照切れ | parameter値による評価結果 |
| Authoring semantic validation | part/drawable/mesh/keyform/rig control/maskの意味的整合、Editor-only state分離 | Renderer固有の描画差 |
| Runtime validation | normalized graphの評価、parameter range、keyform sampling、rig control graph、mesh final vertex、mask、draw order、diagnostics | GUI操作のしやすさ |
| Acceptance validation | MVP scenarioの証拠、GUI authoring evidence、代表parameter評価、AI diff | 商用品質、第三者形式対応、Post-MVP機能 |

Schema validation は「読める形」を保証するだけである。MVP達成には Runtime validation と Acceptance validation が必要である。

## 8. 実装前に決めるべき未決事項

- JSON Schemaでcross-file参照検証をどこまで表現し、どこからValidator coreへ委譲するか。
- `model/*.json` を分割ファイルにするか、初期実装では一部をまとめるか。ただし論理責務は分ける。
- operation logのdrag sampleを保存するか、commit transactionだけにするか。
- migration reportを `validation/` に置くか `operations/` に置くか。
- `editor-state.json` をpackageに常時保存するか、ユーザー設定として別保存できるようにするか。

## 9. Post-MVPでよい未決事項

- zip化やregistry配布形式。
- content-addressed asset store。
- package signing。
- collaborative editing用operation CRDT。
- 第三者形式連携向けの追加manifest（MVP外・権利確認前提）。
