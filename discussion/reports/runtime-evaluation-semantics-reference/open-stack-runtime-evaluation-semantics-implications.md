# Open Stack Runtime Evaluation Semantics Implications

> 状態: Preliminary design recommendation  
> 対象: Open 2D Character Rigging Stack MVP の runtime 評価セマンティクス
> 前提: 本レポートは、Cubism SDK runtime 参照レポートが未完成でも使える暫定推奨である。Open Stack の正は repository AC / scenario とし、Cubism SDK 公式資料は参考資料としてのみ使う。

## 1. Repository facts

- `discussion/acceptance-criteria/03_MVP_Acceptance_Criteria.md` は、MVPを「GUI Editor で制作し、Open Model Package として保存・再読み込みし、Runtime / Viewer で parameter 操作に応じて表示し、Validator と AI Agent が構造化して扱える Authoring-to-Runtime 一周」と定義している。
- `AC-MVP-008` は、parameter、範囲、keyform、補間を GUI Editor で制作し、Runtime が keyform 間の中間値を補間して Viewer slider 操作で連続的な変化を確認できることを要求している。
- `AC-MVP-009` は、warp / rotation 相当 deformer、親子階層、対象 drawable または子 deformer、回転中心または制御格子、parameter / keyform 接続を要求している。
- `AC-MVP-011` は、Editor preview が parameter 操作により keyform、deformer、clipping、draw order、part 表示状態を反映することを要求している。
- `AC-MVP-012` は、Viewer が保存済み package を読み込み、parameter 値の変更に応じて評価済み drawable state、vertex、visibility、opacity、draw order、mask 状態、diagnostics を構造化 runtime state として取得できることを要求している。
- `AC-MVP-013` は、Validator が schema、asset、mesh、drawable、parameter、deformer、mask、runtime load、代表 parameter 評価を構造化 report として出せることを要求している。
- `AC-MVP-014` は、AI Agent が runtime state snapshot、operation dry-run / preview、model diff、runtime diff、validation diff を扱えることを要求している。
- `AC-MVP-015` は、Cubism Editor、Cubism SDK/Core、`.cmo3` 復元、`.moc3` 互換出力を必須依存にしないことを要求している。
- `discussion/scenarios/03_MVP_Acceptance_Criteria.md` の `SC-MVP-003` は、保存済み package を Viewer で開き、parameter slider により表示と runtime state が変化し、snapshot に parameter 値、評価済み drawable state、vertex、visibility、opacity、draw order、mask 状態、diagnostics が含まれることを期待している。
- `SC-MVP-004` は、Validator と AI Agent が validation report、model structure、dry-run operation、model diff、runtime diff、validation diff、repair 候補、影響範囲、provenance、再検証手順を扱うことを期待している。
- `discussion/design/initial-design-decisions-and-open-questions.md` は、`rotation2d` を pivot 付き 2D transform / affine node、`warpLattice2d` を 2D control lattice deformation node とする方向を採用している。
- 同文書は、warp 補間を `bilinear-grid-v1` から始め、package に interpolation / evaluator version を持たせる方針、bind space の第一候補を deformer local rest space とする方針、deformer tree を parent-before-child に評価する方針を採用している。
- `discussion/design/ai-agent-connection-and-technology-stack.md` は、MVP の第一候補を Web-first TypeScript とし、編集処理の正を GUI event handler ではなく shared operation core / model core / validator core に置く方針を示している。
- `discussion/reports/viewer-preview-reference/open-stack-viewer-preview-design-implications.md` は、Editor preview と Viewer が Shared Runtime evaluation core を共有し、Editor-only production support state と runtime-visible model state を混同しないことを推奨している。

## 2. Reference facts

- Cubism SDK for Web の model 資料では、`.model3.json` が model 関連ファイル参照を管理し、`.moc3` から作った model instance に対して parameter を操作し、描画情報を取得する流れが説明されている。
- 同資料では、parameter 操作を頂点へ反映するには `CubismModel.update` を実行し、その後 renderer 側に描画を命令する流れが示されている。
- Cubism SDK の parameter operation 資料では、parameter 操作には overwrite、add、multiply があり、計算順序によって見た目が変わるため、どの component がどの順で計算するかを共有する必要があると説明されている。
- Cubism Editor の parameter 資料では、parameter は Angle X や Mouth Open/Close のような動きを表し、key 間の形状が自動補間されると説明されている。
- Cubism Editor の key 追加資料では、ArtMesh または deformer を選択して parameter に keyform を登録する操作が説明されている。
- Cubism Editor の deformer 資料では、warp deformer と rotation deformer が区別され、rotation deformer は形状を保って回転的に扱う用途として説明されている。
- Cubism Editor の親子階層資料では、親 deformer の変形は子へ反映されるが、子の変形は親へ影響しないと説明されている。
- Cubism Editor の clipping mask 資料では、clipping は mask にする ArtMesh ID を参照して設定され、mask の状態が不正な場合は warning が出ると説明されている。
- Cubism SDK の model consistency 資料では、不特定の `.moc3` を読む場合に読み込み前の整合性検証が推奨されている。
- Cubism SDK には motion、expression motion、physics、pose など parameter または part opacity に影響する runtime layer があるが、MVP AC はこれらを完全制作・完全再生の対象にしていない。

## 3. Assumptions

- MVP runtime は、保存済み Open Model Package と dirty authoring graph の両方を同じ正規化 runtime graph に変換して評価する。
- Runtime は毎回の評価を deterministic に行う。浮動小数点の完全 bit 一致までは要求しないが、Editor preview、Viewer、Validator の比較では同一 runtime core と同一 epsilon policy を使う。
- MVP の parameter 入力は、Viewer slider、Editor preview slider、operation dry-run から来る明示的な値を主対象にする。time-based motion、expression asset、full physics、pose は評価スロットだけ予約し、既定では無効にする。
- MVP の keyform は、少なくとも 1 parameter axis の線形補間を確実に扱う。顔 Angle X / Y の斜め方向など multi-parameter blend は、MVP完了条件を満たすために仕様化が必要だが、本レポートでは未決事項として残す。

## 4. Design recommendation

### 4.1 MVP runtime が定義すべき評価セマンティクス

Open Stack MVP は、少なくとも次を明示的に定義するべきである。

| Semantics | MVPで固定する内容 |
|---|---|
| Runtime input | `package revision` または `dirty authoring graph revision`、parameter override、evaluation profile、snapshot detail level を入力にする |
| Parameter value model | `min` / `max` / `default` / `current` / `rawInput` / `clamped` / `source` を区別する |
| Parameter range policy | GUI slider は範囲内に制約する。構造化APIやfile入力の範囲外値は `clamp-with-diagnostic` を既定とし、Validator strict profile では fail にできる |
| Missing parameter policy | keyform / deformer / opacity / visibility / draw order が存在しない parameter を参照した場合は `blocking`。外部入力にだけ存在する未宣言 parameter は `warning` 付き no-op |
| Keyform interpolation | MVP baseline は `linear-1d-v1`。target property ごとに evaluator version を持たせる |
| Keyform composition | 同じ target property に複数 writer がある場合は、明示的な `compositionMode` と `compositionOrder` がない限り diagnostic にする |
| Deformer kinds | `rotation2d` と `warpLattice2d` を MVP runtime-visible node として固定する |
| Bind space | `warpLattice2d` の vertex bind は deformer local rest space を第一候補として固定し、snapshot に明示する |
| Deformer order | deformer graph は topological sort し、parent-before-child で評価する。cycle は `blocking` |
| Mesh evaluation | rest mesh vertex と UV を読み、deformer chain 後の final vertex を drawable state として返す。UV は MVP では変形しない |
| Mask resolution | clipping は mask drawable stable ID の参照として解決し、missing / hidden / zero-area / cycle-like invalid relation を diagnostics にする |
| Opacity / visibility | Editor-only hide / lock / select と runtime visibility を分ける。opacity は数値、visibility は boolean として別に評価する |
| Draw order | `drawOrder` は runtime-visible numeric field とし、低い値を奥、高い値を手前とする。描画リストは `drawOrder` 昇順、tie は package stable order で決定する |
| Diagnostics | load / normalization / parameter / keyform / deformer / mesh / mask / drawOrder / render の phase を分け、human UI と AI-readable report で同じ語彙を使う |
| Snapshot | 評価入力、評価済み state、diagnostics、trace、evaluator version を持つ構造化 snapshot を返す |

### 4.2 MVP ordered evaluation pipeline

MVP の推奨評価順序は次の通り。

1. **Package / graph input を受け取る**  
   Viewer は保存済み Open Model Package を入力にする。Editor preview は dirty authoring graph を入力にするが、どちらも同じ normalized runtime graph へ変換する。

2. **Schema、manifest、asset reference、rights / provenance の load diagnostics を作る**  
   ここで必要 asset、texture、mesh、drawable、parameter、deformer、mask の ID table を作る。読み込み不能な必須要素は `blocking` にする。

3. **Runtime graph を正規化する**  
   drawable、mesh、part、parameter、keyform、deformer tree、mask relation、draw order を stable ID で解決する。暗黙順序は、この時点で明示的な evaluation order / stable order に変換する。

4. **Parameter base state を初期化する**  
   各 parameter の current は default から始める。Viewer / Preview / dry-run から渡された override を適用する。raw input、clamped value、source、range diagnostic を保存する。

5. **Future-compatible parameter layer slots を処理する**  
   MVP では `motion`、`expressionAsset`、`fullPhysics`、`pose` は無効スロットとして記録する。将来追加時は overwrite、add、multiply の演算種別と順序を snapshot trace に出す。

6. **Keyform sampler を評価する**  
   parameter 値に基づき、drawable mesh delta、deformer state、opacity、visibility、draw order などの target property を評価する。MVP baseline は `linear-1d-v1`。同一 property への多重 writer は明示 composition がない限り diagnostic にする。

7. **Deformer tree を parent-before-child で評価する**  
   `rotation2d` は pivot 付き 2D affine transform として local matrix を作る。`warpLattice2d` は deformer local rest space の bind coordinate と `bilinear-grid-v1` により lattice 変形を作る。各 node は local state、world/effective state、bounds、diagnostics を持つ。

8. **Drawable mesh を評価する**  
   rest vertex を出発点に、所属する deformer chain を評価済み順序で適用し、final vertex、bounds、vertex hash、必要なら full vertex payload を生成する。triangle index、UV、texture reference はこの段階で整合性を再確認する。

9. **Opacity / visibility を評価する**  
   drawable runtime visibility、part runtime visibility、keyform 由来 visibility、opacity を合成する。opacity `0` と visibility `false` は同義にしない。Editor-only hide / lock / select は runtime state に混ぜない。

10. **Clipping / mask を解決する**  
    clipping target から mask drawable ID list を解決し、mask group / permutation key、mask bounds、mask source state、target state を作る。mask source が欠落、非表示、評価不能、zero-area の場合は diagnostics を出す。

11. **Draw order と draw list を確定する**  
    各 drawable の evaluated drawOrder を決め、`drawOrder` 昇順、tie は stable package order で draw list を作る。visibility false の drawable を draw list から除外するか、diagnostics 用に非描画 entry として保持するかは snapshot detail level で選べるようにする。

12. **Runtime snapshot と diagnostics を返す**  
    renderer は snapshot の draw list と drawable state を使って描画する。Validator / AI Agent は同じ snapshot を使って runtime diff、validation diff、repair candidate を作る。

### 4.3 Parameter values

Parameter は「入力値」と「評価値」を分ける。

| Field | 意味 |
|---|---|
| `id` | stable ID。標準 parameter alias とは別に保持する |
| `displayName` | 人間向け名 |
| `standardAlias` | `ParamAngleX` など Cubism 参考名または Open Stack 推奨名 |
| `min` / `max` / `default` | package が宣言する範囲と初期値 |
| `rawInput` | UI / API / dry-run から受け取った値 |
| `value` | clamp / normalization 後に評価へ使う値 |
| `clamped` | raw input が範囲外だったか |
| `sources` | `default`、`viewerOverride`、`editorPreviewOverride`、`operationDryRun`、将来の `motion` など |
| `diagnostics` | NaN、Infinity、範囲外、missing ID、未使用など |

MVP の既定動作は、UI では範囲外値を作らせず、file / API 経由の範囲外値は clamp して `warning` を出す。ただし Validator strict profile と MVP acceptance runner では、代表 parameter 評価に必要な値が不正な場合 `fail` にできる。

### 4.4 Keyforms

Keyform は「parameter 値に対する target property の評価関数」として扱う。

- MVP は `linear-1d-v1` を baseline にする。
- keyform は target ID、target property、parameter ID、key value list、key state、interpolation version を持つ。
- key state は、mesh vertex absolute state、mesh delta、deformer local state、opacity、visibility、drawOrder など property ごとに型を分ける。
- target property ごとに、writer が 1つならその値を採用する。
- writer が複数ある場合は、`compositionMode` が必要である。MVP の暫定候補は `replace`、`additiveDelta`、`multiplyOpacity` だが、正式仕様は未決とする。
- 顔 Angle X / Y の斜め方向は、MVP scenario が要求するため、`linear-1d-v1` の独立適用で足りるか、`bilinear-parameter-grid-v1` のような 2D keyform evaluator を MVP に入れるかを早期に決める必要がある。

### 4.5 Deformer tree

Deformer tree は runtime-visible graph として保存・評価する。最終 vertex だけを保存して runtime で焼き込み結果を読む方式は、GUI 再編集、Validator、AI diff の要件を満たしにくい。

| Node | MVP評価 |
|---|---|
| `rotation2d` | pivot、angle、optional translation / scale から local affine matrix を作る。MVP GUI は shear / arbitrary matrix editor を出さない |
| `warpLattice2d` | rest domain、lattice rows / columns、rest control points、keyform control point positions、`interpolationMethod: bilinear-grid-v1`、`interpolationVersion` を使う |
| hierarchy | parent-before-child。親の評価結果は子 drawable / child deformer へ伝播し、子は親へ逆伝播しない |
| bind space | 第一候補は deformer local rest space。vertex ごとの bind coordinate を保存し、keyform ごとに再 bind しない |
| invalid graph | cycle、missing parent、missing child、undefined interpolation、NaN / Infinity は `blocking` または `error` |

### 4.6 Drawable mesh

Drawable mesh 評価は次を固定する。

- rest mesh は `vertices`、`uvs`、`triangles`、`textureId`、`partId` を持つ。
- Runtime は rest vertex を deformer chain に通し、final vertex を作る。
- UV は MVP では rest UV を使う。UV animation や texture switching は Post-MVP とする。
- triangle index 範囲外、退化 triangle、NaN vertex、missing texture は diagnostics にする。
- Snapshot は、既定では vertex count、bounds、hash、sample を返し、AI diff / Validator 詳細モードでは full vertex array を返せるようにする。

### 4.7 Clipping / mask

MVP の clipping / mask は、Cubism の実装互換ではなく、mask relation を deterministic に解決できることを重視する。

- clipping target は `maskDrawableIds` を stable ID list として持つ。
- mask group は、同じ mask ID set を共有する targets をまとめられる。ただし SDK target 互換の mask packing は MVP 外に置く。
- mask source drawable も通常の runtime evaluation を受け、final mesh、opacity、visibility、bounds を持つ。
- mask source が missing、visibility false、zero-area、評価不能の場合は、Viewer では `error` として表示し、MVP review profile では fail 候補にする。
- mask relation の循環は、ArtMesh 参照 graph として検出できる範囲で diagnostics にする。
- Snapshot には、mask source、target list、mask bounds、mask group key、resolution status を含める。

### 4.8 Opacity / visibility

Opacity と visibility は混同しない。

- `opacity` は `0.0` から `1.0` の連続値とする。範囲外は clamp と diagnostic。
- `runtimeVisibility` は描画対象かどうかの boolean とする。
- `editorHidden`、`locked`、`selected`、`hovered`、`activeTool` は Editor-only state とし、Shared Runtime core の正規 state には入れない。
- part opacity / part visibility を MVP に含める場合も、drawable effective opacity / visibility へ展開した結果と、元の part contribution を snapshot に分けて持つ。
- opacity `0` の drawable は、mask source として意味を持つ場合があるため、visibility false と同義にしない。

### 4.9 Draw order

Draw order は、Editor preview、保存再読み込み、Viewer、Validator、AI diff で一致する必要がある。

- `drawOrder` は numeric value とする。
- 低い値を奥、高い値を手前とし、renderer draw list は back-to-front のため昇順に並べる。
- 同値の場合は package stable order、さらに必要なら stable ID lexical order を tie breaker にする。
- draw order を keyform で変化させる場合は、evaluated drawOrder と original drawOrder を snapshot に分けて持つ。
- runtime visibility false の drawable は描画しないが、diagnostics と inspection のため snapshot には残せるようにする。

### 4.10 Editor preview / Viewer / Shared Runtime core

Editor preview と Viewer は、同じ Shared Runtime evaluation core を使う。

| Layer | 責務 |
|---|---|
| `shared-runtime-core` | parameter 解決、keyform sampling、deformer 評価、mesh 評価、mask 解決、draw list 生成、snapshot / diagnostics 生成。DOM、Canvas、WebGL、Editor UI state に依存しない |
| `authoring-graph-adapter` | dirty authoring graph、未保存 operation、編集中 keyform を normalized runtime graph に変換する |
| `package-loader-adapter` | 保存済み Open Model Package を normalized runtime graph に変換する |
| `preview-surface` | Editor-only overlay、selection、lock、hide、dirty warning、tool state を扱う。runtime state に混ぜない |
| `viewer-surface` | package load 状態、parameter slider、runtime snapshot、diagnostics panel を扱う。authoring 編集はしない |
| `validator-ai-bridge` | snapshot、diagnostics、model diff、runtime diff、validation diff、repair candidate を同じ stable ID で扱う |

受け入れ基準として、同じ normalized runtime graph と同じ parameter input を与えた場合、Editor preview と Viewer は同じ snapshot を返す必要がある。比較は full vertex payload または vertex hash + bounds + diagnostic list で行う。

## 5. Runtime snapshot field proposal

MVP snapshot は、常に full vertex を返す重い形式ではなく、summary と detail を切り替えられる構造にする。

```json
{
  "schemaVersion": "open-runtime-snapshot-v1",
  "runtimeCoreVersion": "0.1.0",
  "snapshotId": "snap_...",
  "createdAt": "ISO-8601",
  "source": {
    "surface": "editorPreview | viewer | validator | aiDryRun",
    "packageId": "pkg_...",
    "packageRevision": "rev_...",
    "packageHash": "sha256:...",
    "authoringRevision": "op_...",
    "dirty": false
  },
  "evaluation": {
    "profile": "preview | viewer | validatorStrict | aiDryRun",
    "coordinateSystem": "open-stack-canvas-v1",
    "numericPrecision": "float64-js",
    "epsilonPolicy": "runtime-epsilon-v1",
    "snapshotDetail": "summary | targeted | full",
    "evaluatorVersions": {
      "parameter": "parameter-stack-v1",
      "keyform": "linear-1d-v1",
      "rotation2d": "affine-pivot-v1",
      "warpLattice2d": "bilinear-grid-v1",
      "mask": "mask-relation-v1",
      "drawOrder": "numeric-stable-ascending-v1"
    }
  },
  "inputs": {
    "parameterOverrides": [
      {
        "parameterId": "ParamAngleX",
        "rawValue": 0.4,
        "source": "viewerSlider"
      }
    ],
    "disabledFutureLayers": [
      "motion",
      "expressionAsset",
      "fullPhysics",
      "pose"
    ]
  },
  "parameters": [
    {
      "id": "ParamAngleX",
      "displayName": "Angle X",
      "standardAlias": "ParamAngleX",
      "min": -30,
      "max": 30,
      "default": 0,
      "rawInput": 12,
      "value": 12,
      "clamped": false,
      "sources": ["default", "viewerSlider"],
      "diagnosticIds": []
    }
  ],
  "keyformSamples": [
    {
      "targetId": "def_face_warp",
      "targetKind": "deformer",
      "property": "controlPointPositions",
      "parameterIds": ["ParamAngleX"],
      "evaluatorVersion": "linear-1d-v1",
      "sampleWeights": [
        { "keyValue": 0, "weight": 0.6 },
        { "keyValue": 30, "weight": 0.4 }
      ]
    }
  ],
  "deformers": [
    {
      "id": "def_head_rot",
      "kind": "rotation2d",
      "evaluationIndex": 3,
      "parentId": null,
      "bindSpace": "deformerLocalRest",
      "localState": {
        "pivot": [0, 0],
        "angleDegrees": 8,
        "translation": [0, 0],
        "scale": [1, 1]
      },
      "effectiveMatrix": [1, 0, 0, 1, 0, 0],
      "bounds": { "min": [-1, -1], "max": [1, 1] },
      "diagnosticIds": []
    }
  ],
  "drawables": [
    {
      "id": "draw_eye_l",
      "partId": "part_eye_l",
      "meshId": "mesh_eye_l",
      "textureId": "tex_main",
      "vertexCount": 42,
      "vertexPayload": {
        "mode": "summary",
        "hash": "sha256:...",
        "bounds": { "min": [-0.2, 0.1], "max": [0.1, 0.3] },
        "sample": [[-0.2, 0.1], [0.1, 0.3]]
      },
      "uvHash": "sha256:...",
      "opacity": 1,
      "runtimeVisibility": true,
      "editorHiddenIgnored": true,
      "drawOrder": 320,
      "maskGroupId": "mask_eye_l",
      "diagnosticIds": []
    }
  ],
  "masks": [
    {
      "maskGroupId": "mask_eye_l",
      "maskDrawableIds": ["draw_eye_white_l"],
      "targetDrawableIds": ["draw_eye_l", "draw_eye_highlight_l"],
      "bounds": { "min": [-0.3, 0.0], "max": [0.2, 0.35] },
      "status": "resolved",
      "diagnosticIds": []
    }
  ],
  "drawList": [
    {
      "drawableId": "draw_eye_l",
      "drawOrder": 320,
      "stableOrder": 17,
      "renderable": true
    }
  ],
  "diagnostics": [
    {
      "id": "diag_...",
      "checkId": "parameter.range.clamped",
      "status": "warning",
      "severity": "warning",
      "phase": "parameter_resolution",
      "targetId": "ParamAngleX",
      "targetKind": "parameter",
      "message": "Parameter input was clamped to declared range.",
      "evidence": { "rawValue": 45, "min": -30, "max": 30, "value": 30 },
      "relatedAc": ["AC-MVP-008", "AC-MVP-012"],
      "impact": "Evaluation can continue, but the caller supplied an out-of-range value.",
      "repairCandidate": { "kind": "setParameterWithinRange", "confidence": "high" },
      "provenance": { "operationId": "op_...", "source": "aiDryRun" }
    }
  ],
  "trace": {
    "operationIds": ["op_..."],
    "modelObjectIdsTouched": ["ParamAngleX", "def_head_rot", "draw_eye_l"],
    "sourceUrls": []
  }
}
```

## 6. Diagnostics severity proposal

MVP diagnostics は、人間向け warning と AI-readable report で同じ severity を使う。

| Severity | 意味 | 例 | MVP扱い |
|---|---|---|---|
| `info` | 評価継続に影響しない観測情報 | future layer が無効、full vertex payload が省略された | Pass |
| `warning` | 評価は継続できるが、意図違い、移植差、品質低下、strict profile fail の可能性がある | parameter clamp、空 deformer、mask 数増加、child vertex が warp domain 外 | Preview / Viewer で表示。Validator strict では fail 候補 |
| `error` | 対象要素は壊れているが、fallback または対象除外で snapshot 生成は可能 | missing optional texture、退化 triangle、mask source hidden、特定 drawable 評価不能 | Viewer は部分表示可。MVP review では fail 候補 |
| `blocking` | deterministic evaluation または package load が成立しない | schema 不正、必須 asset 欠落、deformer cycle、NaN in matrix、missing required parameter reference | Preview / Viewer / Validator の該当評価を fail |

補助 field として、`status` は `pass` / `warning` / `fail` / `needs_review` / `not_applicable` を使う。`severity` は影響度、`status` は特定 check の判定結果として分ける。

推奨 phase:

- `package_load`
- `graph_normalization`
- `parameter_resolution`
- `keyform_sampling`
- `deformer_evaluation`
- `mesh_evaluation`
- `mask_resolution`
- `opacity_visibility`
- `draw_order_resolution`
- `render_preparation`
- `validation`
- `ai_dry_run`

## 7. Rationale

MVP AC は、Runtime を単なる表示器ではなく、Editor preview、Viewer、Validator、AI Agent が共有する評価基盤として要求している。そのため、Open Stack は「parameter を変えたら何がどの順に決まり、どの state と diagnostics が返るか」を MVP 時点で固定する必要がある。

Cubism SDK では parameter 操作後に model update を行い、renderer が描画するという flow があり、また overwrite / add / multiply の順序で結果が変わることが公式資料上も説明されている。ただし Open Stack MVP は Cubism SDK/Core 互換を正にしないため、この事実は「runtime layer の順序を仕様化しないと見た目がずれる」という設計根拠として使う。

`rotation2d` と `warpLattice2d` を runtime-visible graph node として保存する理由は、GUI 再編集、operation log、Validator、AI diff が同じ stable ID を参照できるようにするためである。最終 vertex だけを保存すると、Viewer 表示はできても、Editor preview と AI repair が制作構造へ戻れない。

Editor preview と Viewer は同じ Runtime core を使うべきである。Preview 専用評価と Viewer 専用評価を分けると、保存前には正しく見えたが保存後 Viewer で崩れる、またはその逆が起きる。これは `AC-MVP-011` と `AC-MVP-012` の連続性を壊す。

一方、Editor-only state を Runtime core に入れないことも同じくらい重要である。selection、lock、editor hide、overlay、active tool、dirty warning は制作支援状態であり、保存済み package の runtime 表示結果とは分離する必要がある。

## 8. MVP vs Post-MVP

| Area | MVP | Post-MVP / future-compatible |
|---|---|---|
| Parameter operation | default + explicit UI/API override。future layer slot は snapshot に記録するが無効 | motion、expression、tracking、procedural layer の overwrite / add / multiply stack |
| Keyform | `linear-1d-v1` baseline。target property と evaluator version を保存 | multi-parameter grid、Bezier / stepped / extended interpolation、blend shape weight limits |
| Rotation | `rotation2d` pivot 付き 2D affine。GUI は angle / pivot 中心 | shear、arbitrary matrix editor、3D rotation helper、IK / bone-like controls |
| Warp | `warpLattice2d`、deformer local rest bind、`bilinear-grid-v1` | Bezier / bicubic lattice、Cubism-like conversion / Bezier division import mapping、MLS / ARAP |
| Mesh | rest vertices + UV + triangle、final vertices、bounds/hash/full detail切替 | texture switching、UV animation、GPU-specific optimized buffers |
| Mask | stable ID relation、mask group、bounds、resolution diagnostics | SDK target-specific mask packing、high precision mask、platform-specific mask limits |
| Opacity / visibility | drawable / part effective opacity、runtime visibility、Editor-only hide 分離 | pose-driven part switching、motion part opacity curve、advanced blending |
| Draw order | numeric stable order、tie breaker 固定 | platform renderer policy、Unity-like sorting layer compatibility、advanced group draw order |
| Motion | MVP外。layer slot と diagnostics のみ | `.motion3.json` 相当 asset、timeline playback、fade、event/user data |
| Expression asset | MVP外。parameter-driven expression は keyform として作る | `.exp3.json` 相当 asset、add/multiply/overwrite expression stack |
| Full physics | MVP外。髪揺れは parameter-driven または簡易 keyform | `.physics3.json` 相当、gravity/wind、stabilization、time-step policy |
| Pose | MVP外 | part opacity switching、virtual parameter compatibility、motion interaction |
| SDK target compatibility | Cubism SDK/Core 非依存。Web-first TypeScript core を正にする | `.moc3` / `.model3.json` export、Cubism Viewer / SDK comparison、Native/Unity/Web target profiles |

## 9. Risks

- multi-parameter keyform blend が未決である。顔 Angle X / Y と斜め方向を MVP でどう表すかが曖昧だと、Editor preview と Viewer の一致が危うくなる。
- parameter 範囲外値を clamp にするか fail にするかは、Preview / Viewer と Validator strict profile で異なる可能性がある。profile ごとの規則を明示しないと AI dry-run と人間操作の結果がずれる。
- `bilinear-grid-v1` は検証しやすいが、顔や髪の見た目品質が不足する可能性がある。将来 Bezier / bicubic を入れられるよう evaluator version を必須にする必要がある。
- bind space を deformer local rest space に固定する場合、authoring graph から runtime graph への正規化時に座標変換を誤ると、保存再読み込みと runtime diff が壊れやすい。
- mask source が visibility false または opacity 0 の場合の扱いを誤ると、Editor preview と Viewer / SDK target の差が出やすい。
- Snapshot に full vertex を常時入れると、AI diff には便利だが UI 応答性と保存量に影響する。summary / targeted / full の切替が必要である。
- Cubism SDK 参照レポート完成後、Cubism runtime layer の順序や mask / pose の挙動と本推奨の差分が見つかる可能性がある。ただし MVP の正は AC/scenario であり、互換のために MVP core を不安定にしない。

## 10. Open questions

- 顔 Angle X / Y の斜め方向は、`linear-1d-v1` の独立合成で MVP 可とするか、`bilinear-parameter-grid-v1` のような 2D keyform evaluator を MVP に含めるか。
- 同じ target property に複数 parameter / keyform writer がある場合の `compositionMode` を、`replace`、`additiveDelta`、`multiply` のどこまで MVP で固定するか。
- parameter 範囲外値は、Viewer / Preview では clamp warning、Validator strict では fail という profile 分離でよいか。
- deformer-level opacity / visibility を MVP に含めるか、drawable / part / keyform 側に限定するか。
- part opacity / part visibility を runtime core の一次 state とするか、drawable effective state へ展開した trace として扱うか。
- mask source が opacity 0 だが visibility true の場合、mask として有効とするか。MVP profile と将来 SDK target profile で分けるか。
- draw order の keyform 変化を MVP に含めるか、MVP では static drawOrder の保存・再読み込み・Viewer一致だけに限定するか。
- Runtime snapshot は既定で full vertex を含めるか、summary + targeted detail を既定にするか。
- Shared Runtime core に package loader を含めるか、loader は adapter として分離し、core は normalized runtime graph だけを受け取るか。
- Cubism 標準 parameter alias と Open Stack 固有 parameter ID をどの層で対応付けるか。
- Post-MVP の motion / expression / physics / pose layer を導入するとき、MVP snapshot の `disabledFutureLayers` をどの migration schema に接続するか。

## 11. Source URLs

Cubism / Live2D 公式参考:

- About Models (Web): https://docs.live2d.com/en/cubism-sdk-manual/model-web/
- Parameter Operation: https://docs.live2d.com/en/cubism-sdk-manual/parameters/
- Verify model integrity: https://docs.live2d.com/cubism-sdk-manual/moc3-consistency/
- About Parameters: https://docs.live2d.com/en/cubism-editor-manual/parameter/
- Add/Delete Keys to/from parameters: https://docs.live2d.com/en/cubism-editor-manual/edit-parameters/
- About Deformers: https://docs.live2d.com/en/cubism-editor-manual/deformer/
- Warp Deformer: https://docs.live2d.com/en/cubism-editor-manual/making-and-placement-of-warp-deformer/
- Rotation Deformer: https://docs.live2d.com/en/cubism-editor-manual/making-and-rotation-of-rotationdeformer/
- Parent-Child Hierarchy Structure: https://docs.live2d.com/en/cubism-editor-manual/system-of-parent-child-relation/
- Clipping Mask: https://docs.live2d.com/en/cubism-editor-manual/clipping-mask/
- About Draw Order: https://docs.live2d.com/en/cubism-editor-manual/draworder/
- About Motion: https://docs.live2d.com/en/cubism-sdk-manual/motion/
- About Expression Motion: https://docs.live2d.com/en/cubism-sdk-manual/expression/
- Physics: https://docs.live2d.com/en/cubism-sdk-manual/physics/
- About Pose: https://docs.live2d.com/en/cubism-sdk-manual/pose/
- Platform support status: https://docs.live2d.com/en/cubism-sdk-manual/platform/
- Comparison of Cubism SDKs: https://docs.live2d.com/en/cubism-sdk-manual/cubismsdk-compare/
