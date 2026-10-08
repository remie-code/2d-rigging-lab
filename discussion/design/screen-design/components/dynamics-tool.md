# Dynamics Tool コンポーネント仕様

> 状態: Revised draft / 2026-06-18。Wave82後の議論に基づき、Dynamics / Physics v0 のAuthoring UXを再定義する。古い「軽量binding editor」前提ではなく、複数driver入力から仮想振り子simulationを作り、既存parameterへadditive offsetを反映する調整Toolとして扱う。

## 1. 役割

Dynamics Toolは、Authoring Workspace上で **parameter-driven secondary motion** を作るActive Toolである。

ユーザーが既に作ったparameter / keyform / deformerの上に、髪・リボン・服飾のような「遅れて揺れ、減衰して戻る」動きを後付けする。

```text
複数 Driver parameters
  -> 入力正規化と重み付き合成
  -> 仮想振り子 simulation
  -> Dynamics output offset
  -> base parameter value + offset
  -> 既存 parameter / keyform / deformer evaluation
```

Dynamics Toolの主責務:

- Dynamics Groupを作成・選択・編集する。
- 複数driver parameterを入力として登録する。
- v0では1つの仮想振り子を編集する。
- v0では1つの既存output parameterへDynamics offsetを加算し、effective valueとして反映する。
- Parameter Barから独立したDynamics preview inputで、係数を調整しながらCanvas上の揺れを確認する。
- invalid binding、同一outputの競合、range不足などを警告する。

Dynamics Toolの責務ではないもの:

- 完成品としてのruntime確認画面。
- motion/timeline authoring。
- Viewer playback UIの先行実装。
- mesh頂点をparameter / deformerを経由せず直接物理で動かすdirect vertex physics。
- 通常のParameter Bar編集やcurrent pose previewの代替。
- cloth / collision / IK。
- Cubism Physics互換、`.physics3.json` import/export。

Viewer / Runtime Viewは、作成済みDynamicsを完成品として確認するsurfaceである。Dynamicsが何を計算するかをViewer UIが先に定義してはいけない。

## 2. 得るべきUX

ユーザーが得るべき体験:

> 複数のdriver parameterを影響度つきで1つの揺れ入力に合成し、その入力から仮想振り子を計算して、1つのoutput parameterを自然に揺らせる。ユーザーは作成時presetから始め、Canvas上でdriverを動かしながら少数の物理値を調整できる。

典型フロー:

```text
1. Dynamics Toolを選ぶ
2. Group listを見る
3. New Groupを押す
4. 作成時presetを選ぶ
   例: Hair / Ribbon / Soft Cloth / Rigid Accessory
5. Driver Inputsを追加する
   例: Face Angle X, Face Angle Z, Body Angle X
6. Output parameterを選ぶ
   例: Hair Sway X
7. Length / Sway / Reaction / Convergence / Output strengthを調整する
8. CreateでGroupを作成する
9. 作成されたGroup rowを開く
10. Group Inspectorでdriver previewを動かし、時間経過で揺れと収束を見る
11. Previewを見ながらQuick Tuneでよく触る係数を調整する
12. 構造設定が必要ならEditで詳細設定を調整し、Applyする
13. Viewerで完成品として確認する
```

重要なUX境界:

- Dynamics Tool previewは **調整用preview**。
- Viewer previewは **完成品確認preview**。
- 係数編集、binding編集、validation repairはDynamics Tool側。
- Viewerは authored dynamics の結果を表示するが、Dynamicsのdomain contractを定義しない。
- Dynamics Tool中はParameter Barの通常編集をdisableし、preview driver値はInspector-localに閉じる。
- Dynamics Tool previewでは、driver以外のparameterはdefault値として扱う。
- current poseや他parameterとの組み合わせ確認はViewerの責務に寄せる。

手入力値の位置付け:

- Authoring中にユーザーがslider等でparameterを動かす行為は、実runtimeで外部アプリや顔認識が供給する入力値を代替するための調整操作である。
- そのため、通常入力値とDynamics結果を「保護すべき手入力」と「別種の計算値」として分けすぎない。
- Dynamics Toolでは、調整対象を明確にするためにParameter Bar操作からは分離するが、output parameter自体は既存parameter体系の中で扱う。

## 3. v0モデル

v0の最小shape:

```text
DynamicsGroup
  id
  name
  enabled
  presetId
  inputs[]
  pendulums[]
  outputs[]
```

v0で実際に有効にする範囲:

```text
inputs.length >= 1
pendulums.length === 1
outputs.length === 1
```

ただしUIとデータ構造は最初からlistとして扱う。将来、Add Pendulum / Add Outputを有効化しても画面全体を作り直さなくてよい形にする。

### 3.1 Inputs

Driver input:

```text
Input
  parameterId
  kind
  influencePercent
  invert
  normalization
```

`kind`:

- `angle`
- `positionX`
- `positionY`

`normalization`:

```text
Normalization
  min
  center
  max
```

初期値はparameter定義のmin / default / maxから自動で埋める。ユーザーが必要に応じて編集できる。

複数driverはv0から必須である。髪揺れは顔角度だけでなく体角度にも影響を受けるため、1 driver制約では実用に足りない。

入力合成:

```text
source(t) =
  sum(normalize(input_i.value, input_i.normalization, input_i.kind)
      * input_i.influencePercent
      * input_i.invertSign)
```

入力順序に意味はない。上下移動UIはv0では不要。

### 3.2 Pendulum

> **Superseded by [design/dynamics-world-frame-chain.md](../../dynamics-world-frame-chain.md)（dynamics-file-v3）**。
> v0 の Pendulum（length / sway / reactionSpeed / convergenceSpeed の 4 ノブ）と入力正規化
> （min/center/max・influencePercent・invert）は破棄され、以下へ置換された:
> - **入力**: `{ kind, scale }`（rest 基準は常にパラメータ default、重み・反転は scale の符号と大きさへ一本化）
> - **チェーン**: `{ rootOffset, segmentLengths[], damping, gravityScale }`（世界系 Verlet 質点チェーン、グループに 1 本・N≥1 段）
> - **出力**: `{ segmentIndex, scale, limit }`（頭フレームから見た振り子角 θ_local = θ_world − φ を読む。§3.5）
> - **実行時状態**: `{ particles:[{x,y,px,py}], tick, resetCounter }`（旧 angle/angularVelocity/previousSource* は消滅）
> 以下 §3.2 の pendulum 記述は歴史的経緯として残す。

v0では1つの仮想振り子を持つ。

```text
Pendulum
  length
  sway
  reactionSpeed
  convergenceSpeed
```

Cubism風の名称との対応:

| UI label | 意味 | 内部的な役割 |
|---|---|---|
| Length | 振り子の長さ | 周期・重さ・遅れの印象に影響する |
| Sway | 揺れやすさ | driverの速度/加速度が振り子へ与える外力の強さ |
| Reaction Speed | 反応速度 | root/input変化へどれくらい素早く追従するか |
| Convergence Speed | 収束の速さ | damping。高いほど早く揺れが収まる |

内部状態:

```text
PendulumState
  angle
  angularVelocity
  previousSource
  previousSourceVelocity
```

v0で必要な性質:

- 同じdriver値でも、止まっている時と急に動いた直後でoutputが違う。
- driverの変化速度/加速度が揺れを生む。
- 揺れは復元力で戻り、dampingで収束する。

計算の概念:

```text
sourceVelocity = derivative(source)
sourceAcceleration = derivative(sourceVelocity)

angularAcceleration =
  restoringForce(angle, length, reactionSpeed)
  + sourceAcceleration * sway
  - angularVelocity * convergenceSpeed

angularVelocity += angularAcceleration * dt
angle += angularVelocity * dt
```

この式は実装固定ではなく、UX上必要なsimulation特性を示す。実装時は安定性、dt clamp、determinism、testabilityを優先する。

### 3.3 Outputs

v0では1つのoutput parameterを持つ。

Output parameterは、Dynamics専用に分離された特殊parameterである必要はない。`Hair Front Sway X` のような既存preset parameterや、ユーザーが作成したcustom scalar parameterをDynamics outputとして選べることを基本方針にする。

Dynamics outputはparameterの絶対値ではなく **offset** である。

```text
Output
  parameterId
  kind
  strength
  invert
  limit
```

`kind`:

- `angle`
- `positionX`
- `positionY`

output計算:

```text
outputBase = current base value for output parameter
outputOffset = pendulum.angle * strength * invertSign
rawEffectiveOutput = outputBase + outputOffset
effectiveOutput = clamp(rawEffectiveOutput, outputBase - limit, outputBase + limit)
```

output parameterのmin / maxも最終clampに使う。

評価時の意味:

```text
stored parameter definition/value
  -> default/range/semantic identityとして残る

dynamics output
  -> その評価frameのoffsetとして計算される

effective parameter value
  -> base parameter value + dynamics offset
  -> 既存parameter / keyform / deformer evaluationが読む
```

Dynamicsはproject state上のparameter default値や、通常のParameter Bar操作値を直接書き換えない。書き換えるのは評価時のeffective valueである。

v0の合成方針は **additive offset model** とする。

```text
effective output = base output + one Dynamics Group offset
```

Dynamics Tool previewでは、driver以外のparameterをdefault値に固定するため、多くの場合 `base output === output default` になる。そのため見かけ上は旧replace案と同じ結果になりやすい。

Viewer / Runtimeでは、base outputはViewer controls、外部runtime入力、将来のmotion playbackなどから来る現在値になり得る。その場合もDynamicsはbaseを置き換えず、offsetとして加算される。

ただしv0で許可するのは「base + 1つのDynamics Group offset」までである。複数Dynamics Groupを同じoutputへ合成するmixerはFuture scopeとして明示的に別設計する。

### 3.4 Output Ownership

同じoutput parameterを複数Dynamics Groupが直接書くことはv0では禁止する。

理由:

- 複数offsetの合成順序、clamp、reset、評価順序が曖昧になる。
- ユーザーが「この値をどのDynamicsが作っているか」を追いにくくなる。
- ほとんどの複合入力ケースは、複数Dynamicsではなく1つのDynamics Groupに複数Inputsを入れることで解決できる。

v0方針:

```text
one output parameter <= one Dynamics Group
```

必要なvalidation:

- output parameterが他Dynamics Groupで使用済みならblocking error。
- 同一group内でも同じoutput parameterの重複はblocking error。

将来、複数Dynamicsを1つのoutputへ混ぜる必要が出た場合は、明示的なMixer / Blend層を設計する。v0では暗黙合成しない。

## 4. 作成時Preset

v0のPresetは **作成時の初期値セット** である。

Presetが設定するもの:

- inputsの初期influence候補。
- normalizationの初期値。
- pendulum length / sway / reactionSpeed / convergenceSpeed。
- output strength / limit。

Preset例:

| Preset | 意図 |
|---|---|
| Hair | 長め、やや大きく、遅れて揺れる |
| Ribbon | 短め、反応速め、比較的大きく揺れる |
| Soft Cloth | 重め、遅め、収束は中程度 |
| Rigid Accessory | 小さく、早めに収束する |

v0でやること:

- `Create Dynamics Group`時にpresetを選ばせる。
- 作成後に値を触ったら実質`Custom`扱いにする。

v0でやらないこと:

- User presetの保存。
- Preset読み込み / 上書き保存 / 名前変更 / 削除。
- 調整済みgroupへ無言でpresetを再適用すること。

将来`Apply preset`を入れる場合は、上書き範囲を明示する。

## 5. Inspector構成

Dynamics Inspectorは、一覧、既存Groupの詳細、作成、編集を同じ画面に同時表示しない。初期/通常状態は軽いGroup listだけにする。

### 5.1 List State

```text
Dynamics Tool

Groups
  Hair Dynamics        On
  Hair Back Dynamics   On
  Ribbon Dynamics      Off

  + New Group
```

List stateの責務:

- Dynamics Groupの一覧を見る。
- Group rowをクリックして、そのGroupのInspectorへ入る。
- `New Group`で新規作成Inspectorへ入る。

List stateに表示しないもの:

- 選択中GroupのPreview。
- Settings / Inputs / Advanced / Pendulum / Outputs。
- Validation detail。
- Create / Apply / Delete button。

理由:

- Dynamics Toolを開いた直後にユーザーへ重い設定フォームを見せない。
- 「一覧を見て対象Groupを選ぶ」状態と「Groupを編集/previewする」状態を分ける。
- Inspectorの縦幅を、今ユーザーが行う操作にだけ使う。

### 5.2 Existing Group Inspector State

Group rowをクリックすると、そのGroupのInspectorへ遷移する。

```text
< Back to Groups

Dynamics Group
  Name
  Enabled

Preview
  Driver scrub / sample controls
  Reset Preview

Quick Tune
  Strength   Limit
  Length     Sway
  Reaction   Convergence

Actions
  Edit
  Delete Group
```

Existing Group Inspector stateの責務:

- 既存Groupのpreviewを行う。
- driver preview sliderを動かしながら、Canvas上で時間経過の揺れと収束を見る。
- よく触る係数をQuick Tuneで調整する。
- `Edit`で編集Inspectorへ入る。
- `Delete Group`で既存Groupを削除する。
- `Back to Groups`で一覧へ戻る。

Existing Group Inspector stateに表示しないもの:

- Settings / Inputs / Advanced / Pendulum / Outputsの編集フォーム。
- Source / Angle / Offset / Effective のようなraw solver summary。
- Create / Apply button。
- New Group button。

#### 5.2.1 Preview Area

Preview Areaは、調整中のdriver入力とresetだけを置く。

```text
Preview
  Face Angle X      [slider] [value]
  Reset Preview
```

Preview Areaで行うこと:

- driver preview値をInspector-localに動かす。
- driver値の変化をもとに、時間経過でpendulum simulationを進める。
- Canvas上で、既存parameter / keyform / deformerにDynamics outputが反映された結果を見る。
- `Reset Preview`で、pendulum angle、angular velocity、previous sourceなどのpreview simulation stateを初期化する。

Preview Areaに表示しないもの:

- `Source`
- `Angle`
- `Offset`
- `Effective`

理由:

- これらは実装者・debugger向けの値であり、通常ユーザーが揺れの良し悪しを判断する材料になりにくい。
- Canvas上の動きこそが主要feedbackである。
- Inspectorの縦幅は、driver sliderとQuick Tuneを同時に見えるように使う。

必要なら、raw solver summaryは将来のDiagnostics / Evidence View、またはdev/debug modeに逃がす。

#### 5.2.2 Quick Tune

Quick Tuneは、Previewを見ながら頻繁に触る係数だけをExisting Group Inspectorに出す簡易調整UIである。

> **Superseded by [design/dynamics-world-frame-chain.md](../../dynamics-world-frame-chain.md) §9（player v2 語彙）**。
> Quick Tune の項目は runtime-player チューニングプロファイル v2 の語彙へ揃えた（下表 v0 は破棄）:
>
> | Control | 種別 | 適用先 |
> |---|---|---|
> | Output x（`outputScale`）| 乗数 | 出力 `scale` への倍率 |
> | Limit（`limit`）| 直接値 | 出力オフセット絶対値の上限 |
> | Damping（`damping`）| 直接値 | チェーン減衰 [1/s] |
> | Gravity（`gravityScale`）| 直接値 | 重力倍率 |
> | Length x（`lengthScale`）| 乗数 | 全 `segmentLengths` への倍率（周期の微調整）|
>
> 倍率フィールドは committed base に対する係数（既定 1.0）、直接値は group.chain / output の値をそのまま編集する。

Quick Tuneに出す項目（v0。上記 v3 で置換済み）:

| Control | Source field | 意味 | 優先度 |
|---|---|---|---|
| Strength | Output `strength` | 最終的にどれくらい揺れるか | 最高 |
| Sway | Pendulum `sway` | driver変化がどれくらい揺れを生むか | 高 |
| Reaction | Pendulum `reactionSpeed` | input/rootへどれくらい速く反応するか | 高 |
| Convergence | Pendulum `convergenceSpeed` | 揺れがどれくらい早く収束するか | 高 |
| Length | Pendulum `length` | 周期・重さ・遅れの印象 | 中 |
| Limit | Output `limit` | 揺れすぎ防止の上限 | 中 |

Quick Tuneに出さない項目:

- driver parameter選択。
- input kind。
- input追加/削除。
- input influence / invert。
- Advanced normalization min / center / max。
- output parameter選択。
- output kind。
- output invert。
- name / enabled以外の構造設定。
- validation detail。

理由:

- Previewしながら詰めたいのは「揺れの量、遅れ、反応、余韻」である。
- input/output bindingやnormalizationは、揺れを確認する前に構造を作るためのEdit画面の項目である。
- 通常Preview画面では、driver sliderとQuick Tuneが同時に視界へ入ることを優先する。

Quick Tuneの編集方針:

- 操作中はCanvas previewへ即時反映する。
- operation historyへ毎frame commitしてはいけない。
- 実装時は、drag完了時に1回commitする、または明示的なApply相当でcommitするなど、historyを汚さない粒度にする。
- どちらのcommit方式を採る場合でも、Preview中に値を触った結果がCanvas上で即座に確認できることを優先する。

### 5.3 Create Group Inspector State

`New Group`を押すと、新規作成Inspectorへ遷移する。

```text
< Back to Groups

Settings
  Name
  Enabled
  Creation preset

Inputs
  Normalization table
    Angle: min / center / max
    Position X: min / center / max
    Position Y: min / center / max

  Input rows
    Parameter
    Kind
    Influence %
    Invert
    Remove
    + Add Input

Pendulum
  Pendulum 1
    Length
    Sway
    Reaction Speed
    Convergence Speed

  + Add Pendulum
    disabled/reserved in v0

Outputs
  Output row
    Parameter
    Kind
    Strength
    Limit
    Invert

  + Add Output
    disabled/reserved in v0

Validation
  Missing input
  Missing output
  Output already owned
  Invalid normalization
  Unsafe coefficient range

Actions
  Create
  Cancel
```

Create Group Inspector stateの責務:

- 新規Dynamics Groupのdraftを編集する。
- `Create`でGroupを作成する。
- `Cancel`または`Back to Groups`でdraftを破棄して一覧へ戻る。

Create Group Inspector stateに表示しないもの:

- 既存Group preview。
- Apply button。
- Delete Group button。

### 5.4 Edit Group Inspector State

既存Group Inspectorの`Edit`を押すと、編集Inspectorへ遷移する。

```text
< Back to Group

Settings
  Name
  Enabled
  Creation preset / Custom indication

Inputs
  Normalization table
    Angle: min / center / max
    Position X: min / center / max
    Position Y: min / center / max

  Input rows
    Parameter
    Kind
    Influence %
    Invert
    Remove
    + Add Input

Pendulum
  Pendulum 1
    Length
    Sway
    Reaction Speed
    Convergence Speed

  + Add Pendulum
    disabled/reserved in v0

Outputs
  Output row
    Parameter
    Kind
    Strength
    Limit
    Invert

  + Add Output
    disabled/reserved in v0

Validation
  Missing input
  Missing output
  Output already owned
  Invalid normalization
  Unsafe coefficient range

Actions
  Apply
  Cancel
```

Edit Group Inspector stateの責務:

- 既存Dynamics Groupのdraftを編集する。
- `Apply`で既存Groupを更新する。
- `Cancel`または`Back to Group`で変更を破棄し、既存Group Inspectorへ戻る。

Edit Group Inspector stateに表示しないもの:

- Create button。
- New Group button。
- Preview controls。ただしApply後に戻る既存Group InspectorでPreviewできる。

### 5.5 State Model

```text
mode:
  list
  groupInspector(groupId)
  createGroup(draft)
  editGroup(groupId, draft)
```

遷移:

```text
list -- New Group --> createGroup
list -- Group row --> groupInspector
groupInspector -- Back to Groups --> list
groupInspector -- Edit --> editGroup
groupInspector -- Delete Group --> list
createGroup -- Create --> groupInspector(createdGroup)
createGroup -- Cancel / Back --> list
editGroup -- Apply --> groupInspector(updatedGroup)
editGroup -- Cancel / Back --> groupInspector(groupId)
```

この状態分離により、`Create`と`Apply`が同時に見えることを避ける。既存Groupを開いただけで全設定フォームが展開されることも避ける。

## 6. Preview責務

Dynamics Toolはpreview責務を持つ。

ただし、ここでのpreviewは完成品再生ではなく、係数調整のためのauthoring previewである。

Previewは初期/通常のList stateでは表示しない。Group rowをクリックしてExisting Group Inspector stateへ入った時に表示する。

Dynamics Tool中は、Parameter Barを通常のparameter editing surfaceとして使わない。Parameter Barは表示していてもdisabled状態にし、ユーザーが「keyform/parameter編集をしている」のではなく「Dynamicsのdriver previewを操作している」と分かる状態にする。

Dynamics previewのparameter map:

```text
1. 全parameterをdefault値で初期化する
2. Dynamics Inspector-localのdriver preview値だけを適用する
3. Dynamics simulationを進める
4. output parameterのDynamics offsetを計算する
5. base output(default) + offsetをeffective valueにする
6. 既存のparameter / keyform / deformer evaluationに渡してCanvasへ描画する
```

このため、Dynamics Tool previewはcurrent authored poseを混ぜない。非driver parameterはdefaultであり、現在のViewer状態やParameter Bar状態は入らない。

Dynamics Tool previewは、driver値変更時に1 stepだけ反映するものでは足りない。Group Inspectorを開いてpreviewしている間は、animation clockによりsimulation stateを時間経過で進める。

時間経過previewの概念:

```text
preview clock tick
  -> 現在のInspector-local driver preview値を読む
  -> 前frameからのdtでpendulum stateを進める
  -> output offsetを計算する
  -> effective parameter mapへ反映する
  -> Canvasへ描画する
  -> 次frameへ続く
```

これにより、driver sliderを動かした後も、内部状態の`angularVelocity`、復元力、dampingによって揺れと収束が継続して見える。ユーザーは「入力した瞬間の変形」ではなく、「揺れ方の余韻」を見ながら係数を詰められる。

Dynamics Tool previewで必要なもの:

- driver inputを一時的に動かす。
- driver inputが止まった後も、時間経過で振り子の揺れと収束を見る。
- previewしながら、よく触る係数を同じ視界内で調整する。
- simulationをresetする。
- Canvas上で、output parameterが既存deformer/keyform評価へ反映された結果を見る。

Preview値はsession-onlyであり、project stateやoperation historyへcommitしない。

Canvasは場所と既存描画/evaluation pipelineを再利用する。ただし、入力されるparameter mapはDynamics Tool専用であり、通常Canvasのselect / mesh / rig編集状態とは分離する。

Canvasに表示してよいもの:

- selected dynamics groupの対象/影響summary。
- output方向やmagnitudeの軽いoverlay。
- warning state。
- authored modelにpreview outputを適用した結果。

Canvasに表示しないもの:

- raw simulation trace全文。
- solver debug table。
- validator payload全文。
- evidence path。

これらは必要ならDiagnostics / Evidence Viewへ送る。

## 7. Viewerとの関係

Viewer / Runtime ViewはDynamicsの完成品確認surfaceである。

Viewerで扱うべきもの:

- authored dynamics込みのmodel表示。
- current poseや外部runtime入力に近い状態での完成品確認。
- time progression。毎frame Dynamics simulationを進め、揺れの遅れと収束を確認する。
- runtime-style simulation reset。振り子角度、速度、前回入力などの内部状態を初期化する。
- Dynamicsが有効か、未設定か、warningがあるかのsummary。

Viewerで扱わないもの:

- input normalization編集。
- input list編集。
- pendulum係数編集。
- output binding編集。
- output ownership repair。
- raw simulation trace。
- frame stepping。1frameずつsimulationを進めるdebug操作はViewer機能として不要。

重要:

- Runtime Motion / Playback UIをDynamics定義より先に作らない。
- ViewerはDynamics contractを消費する側であり、先にDynamics contractを定義する側ではない。
- Dynamics Tool previewが非driver parameterをdefaultに固定する一方、Viewerは「現在の入力値を与えた時に完成品がどう見えるか」を確認する場所である。
- Viewer / Runtime Controlsでは、Dynamics-owned output parameterはread-only / derived表示にする。ユーザーが直接操作するのはdriver parameterであり、outputはDynamics結果として表示する。

## 8. 他UIとの関係

| UI | Dynamics Toolとの関係 |
|---|---|
| Parameter Bar | Dynamics Tool中は通常編集をdisableする。driver previewはDynamics Inspector-local controlsで行う。 |
| Parameter Manager | driver/output候補を提供する。既存preset/custom parameterをoutputにできる。Dynamics専用parameter作成を必須にしない。 |
| Rig Tool / Deformer Tree | output parameterが既存keyform/deformerを動かすため、Dynamicsは直接deformerを所有しない。 |
| Canvas / Preview | 調整用previewを表示する。Dynamics Tool中はauthoring previewであり、Viewerではない。 |
| Viewer / Runtime View | authored dynamicsの完成品確認を行う。driver parameterは操作できるが、Dynamics-owned output parameterはread-only / derived表示にする。 |
| Product Preflight | missing binding、output ownership conflict、invalid normalization、unsafe coefficientsをwarning/blockingとして扱う。 |
| Diagnostics / Evidence View | simulation state、validator detail、operation evidence、effective output traceを必要時に確認する。 |

## 9. Cubism風UI項目との対応

> **Superseded by [design/dynamics-world-frame-chain.md](../../dynamics-world-frame-chain.md)（dynamics-file-v3）**。
> v3 での主な差分:
> - **Cardinality**: pendulum は「チェーン 1 本・セグメント N≥1」へ、output は複数解禁（segmentIndex で紐付け）。
> - **入力 rows**: 影響度/反転/正規化は撤去し `kind + scale`（deg/unit または cm/unit、符号で反転）。
> - **物理ノブ**: 長さ/揺れやすさ/反応速度/収束の速さ → `segmentLengths[] / damping / gravityScale`。
> - **出力設定**: kind/strength/invert は撤去し `segmentIndex + scale + limit`。
> - **Quick Tune**: §5.2.2 の player v2 語彙（Output x / Limit / Damping / Gravity / Length x）。

参考画像にあるCubism風項目を、このEditorでどう扱うか:

| Cubism風項目 | v0方針 | 理由 |
|---|---|---|
| 入力プリセット 読み込み/保存/名前変更/削除 | v0では作成時presetのみ | user preset管理は初期実用に必須ではない。無言上書きリスクもある。 |
| 入力の正規化 min/center/max | 採用 | 複数input合成に必要。初期値はparameter定義から自動。 |
| 入力 rows: 入力/種別/影響度/反転 | 採用 | v0から複数driverが必須。 |
| 入力 rowsの上下移動 | v0不要 | input合成は順序非依存。 |
| 物理モデルpreset 読み込み/保存/名前変更/削除 | v0では作成時presetのみ | 初期値セットで足りる。user preset管理は後続。 |
| 振り子追加 | UI構造は用意、v0ではdisabled/reserved | 将来の多段振り子へ備えるが、v0は1 pendulum。 |
| 振り子複製 | v0不要 | 1 pendulumでは不要。多段化時に再検討。 |
| 振り子削除 | v0不要 | v0では必ず1 pendulum。 |
| 振り子上下移動 | v0不要 | 1 pendulumでは不要。多段化時に順序意味が出る。 |
| 長さ | 採用 | 周期・重さの主要係数。 |
| 揺れやすさ | 採用 | driver変化が揺れを生む強さ。 |
| 反応速度 | 採用 | input/rootへの追従感を調整する。 |
| 収束の速さ | 採用 | dampingとして自然さに直結する。 |
| 振り子図 | v0 optional | あると理解しやすいが、Canvas上の結果確認を優先する。 |
| 出力設定 | 採用 | output parameter、kind、strength、limit、invertが必要。 |
| 複数Output | UI構造は用意、v0では1 output | まずはoutput ownershipを単純に保つ。 |
| Source / Angle / Offset / Effective summary | 通常Previewでは非表示 | 数値を見てもユーザーが調整判断しづらい。Canvas上の動きとQuick Tuneを優先する。必要ならDiagnostics / debugへ逃がす。 |
| Quick Tune | 採用 | Preview中によく触るStrength / Sway / Reaction / Convergence / Length / Limitだけを同じ視界に置く。 |

## 10. Tool State

| State | 内容 |
|---|---|
| List | 初期/通常状態。Group一覧と`New Group`だけを表示する。 |
| Group Inspector | 既存Group詳細状態。Preview、Quick Tune、Edit、Delete、Back to Groupsを表示する。 |
| Create Group | 新規Group draft状態。Settings / Inputs / Advanced / Pendulum / Outputs / ValidationとCreate / Cancelを表示する。 |
| Edit Group | 既存Group draft状態。Settings / Inputs / Advanced / Pendulum / Outputs / ValidationとApply / Cancelを表示する。 |
| Invalid Draft | Create/Edit中にinput/output不足、output ownership conflict、invalid normalizationなどでCreate/Apply不可。 |
| Previewing | Group Inspector中にsession-only preview inputとanimation clockでsimulationを時間経過させている。 |
| Quick Tuning | Group Inspector中にCanvas previewを見ながらStrength / Sway / Reaction / Convergence / Length / Limitを調整している。 |

## 11. Validation

Blocking:

- inputが0件。
- outputが0件。
- v0でoutputが複数件。
- v0でpendulumが0件または複数件。
- output parameterが他Dynamics Groupにownedされている。
- input normalizationが不正。例: min >= center、center >= max。
- output parameterが存在しない。
- driver parameterが存在しない。

Warning:

- input influenceが全て0。
- coefficientが極端でsimulationが不安定になりやすい。
- output limitが0または極端に小さい。
- output strengthが0。
- Viewer / Runtime Controls上でDynamics-owned output parameterが直接編集可能に見えている。v0ではread-only / derived表示にする。

## 12. 確定事項と残る設計余地

> **Superseded by [design/dynamics-world-frame-chain.md](../../dynamics-world-frame-chain.md)（dynamics-file-v3）**。
> 以下の確定事項のうち、pendulum ノブ・output kind/strength/invert・input normalization に関する項目は v3 で失効:
> - validation の改廃は v3 §7 が正（新設 `chainSegmentsInvalid` / `outputSegmentIndexOutOfRange` / `zeroInputScale` / `outputScaleZero`、改定 `unstableSettings`、廃止 `normalizationInvalid` / cardinality / `outputStrengthZero` / `inputInfluenceZero`）。
> - Quick Tune の語彙は v3 §9（player v2）。
> - output kind は撤去（出力は `segmentIndex + scale + limit`）。normalization は撤去（入力は `kind + scale`）。
> time progression / reset simulation / preview を進める UX 方針は v3 でも維持。

確定事項:

- output kindは自動推定しない。初期値は`angle`でよく、ユーザーが`angle / positionX / positionY`を選択する。
- input normalization UIはAdvanced sectionに閉じる。通常はparameter定義のmin / default / maxから自動設定する。
- Dynamics Tool previewは時間経過でsimulationを進める。driver変更時の1 step反映だけでは、揺れと収束を調整するUXとして不足する。
- Existing Group Inspectorではraw solver summaryを通常表示しない。Canvas上の動き、driver slider、Quick Tuneを優先する。
- Quick TuneにはStrength / Sway / Reaction / Convergence / Length / Limitを置く。input/output bindingやnormalizationはEdit画面に残す。
- Viewer v1で扱うDynamics確認はtime progressionとreset simulationまで。frame steppingはViewer機能として不要。
- Dynamics-owned output parameterはViewer / Runtime Controlsでread-only / derived表示にする。
- v0はadditive offset modelで実装する。`replace` modeは作らない。

残る設計余地:

- 複数Dynamics Groupを同じoutput parameterへ混ぜるMixer / Blend層。Viewerで必要になった時に正式設計する。
- Viewer v1でtime progression / reset simulationをどのUIに置くか。

### 12.1 Simulation State Separation

実装境界として、solver定義とmutable state instanceを分ける。

共通にするもの:

- Dynamics Group定義。
- input normalization / input合成。
- pendulum solver。
- output offset計算。
- clamp規則。

分けるもの:

| State | 役割 | 寿命 |
|---|---|---|
| runtime-core simulation state | Viewer / Runtimeで実際にtime progressionするための状態。各Dynamics Groupのpendulum angle、angular velocity、previous source、previous source velocity、前回dtなどを持つ。 | runtime session中 |
| Editor Dynamics preview state | Dynamics Tool内の調整用状態。Inspector-local driver preview値、preview reset状態、選択中groupの一時simulation stateを持つ。 | editor tool session中 |

設計意図:

- Dynamics Toolで係数やdriver previewを試しても、Viewer / Runtime側の再生状態を汚さない。
- Viewerでreset simulationしても、Dynamics Toolの調整用preview stateを壊さない。
- 両者は同じsolverを呼ぶため、計算結果の意味は一致する。
- ただしmutable state instanceは共有しない。

望ましい実装境界:

```text
stepDynamics(definition, previousState, inputValues, dt)
  -> nextState
  -> outputOffsets
```

`definition`はproject stateに保存される。`previousState`はruntime-coreまたはEditor previewがそれぞれ保持する。

## 13. 関連機能ID

- `UX-FEAT-024`: Dynamics group authoring / update
- `UX-FEAT-025`: Dynamics preview / effective output / diagnostics
- 一部 `UX-FEAT-007`: Viewer / Runtime surface
- 一部 `UX-FEAT-020`〜`UX-FEAT-023`: composition / rig targetとの関係
- 一部 `UX-FEAT-028` / `UX-FEAT-029`: Product Preflight / validation
