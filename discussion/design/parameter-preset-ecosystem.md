# Parameter Preset Ecosystem / Facade 設計メモ

> 状態: Draft design basis。Parameter presetを「よく使う名前セット」ではなく、外部入力・runtime facade・将来exportと接続可能な意味カタログとして扱うための設計メモ。

## 1. 目的

Parameter presetは、単なるUI上の初期値リストではない。

Camera Capture / Face Trackingのような外部入力は、parameterをただの数値ではなく「顔向きX」「口開き」「目線」などの意味を持つ値として要求する。そのため、preset設計ではparameterがこのエコシステム内でどのように読まれ、動かされ、外部と対応付けられるかを考慮する。

ただし、Editor内部のCore Parameterを外部エコシステムの仕様で汚染しない。内部構造、preset上の意味、外部公開・外部入力とのmappingは分離する。

## 2. 基本分離

Parameter関連の情報は、次の3層に分ける。

```text
Core Parameter
  -> Preset / Profile
    -> Ecosystem Facade / Mapping
```

| 層 | 役割 | 持つ情報 | 持たない情報 |
|---|---|---|---|
| Core Parameter | Editor内部で参照されるparameter定義 | stable id、display name、type、min/default/max、group、usage refs | tracker固有入力、外部format固有名、自動推論結果 |
| Preset / Profile | 人間・Codex・外部facadeが共有できる意味カタログ | role、推奨range、min/default/maxの意味、sign convention、group、説明 | MediaPipe等の具体input source、ユーザー個別calibration |
| Ecosystem Facade / Mapping | 外部入力・外部API・将来exportとの対応表 | input source、input transform、smoothing、calibration、export alias、runtime API名 | Core Parameterの永続構造そのもの |

設計上の重要判断:

- Core Parameterは特定tracker、特定export形式、特定LLM skillに依存しない。
- Preset / Profileは意味を持ってよい。むしろCamera Captureのために意味が必要である。
- Facade / Mappingは差し替え可能にする。外部入力source、変換式、calibrationはCore Parameterへ混ぜない。
- Editor本体はsemantic recognitionやauto classificationをしない。ユーザーまたは外部Codex/LLMが明示的にpresetを選び、mappingする。

## 3. Consumer分類

Parameter consumerは、semantic roleを強く要求するものと、Core Parameter情報だけで成立するものに分ける。

### 3.1 Strong Semantic Consumer

role設計へ強い圧をかけるconsumer。

| Consumer | なぜroleが必要か | 現時点の扱い |
|---|---|---|
| Camera Capture / Face Tracking | tracker入力をface angle、eye open、mouth open、eyeballなどへ接続する必要がある | 最重要consumer |
| Motion Capture / Body Tracking | body angleや上半身傾きなど、入力意味とparameter roleを対応させる必要がある | 将来重要。body angleはpresetに含める |
| External Runtime API / Facade | 外部から「顔Xを動かす」「口を開く」のような意味操作を提供する可能性がある | Facade層で扱う |
| Future Export / Compatibility Facade | 外部形式や他runtimeへ出すとき、roleに基づいたmappingが必要になりうる | 将来scope。Coreへ混ぜない |

### 3.2 Weak / Optional Semantic Consumer

roleがあると便利だが、v0のpreset設計を支配させないconsumer。

| Consumer | 扱い |
|---|---|
| Viewer Manual Controls | 基本はid、displayName、rangeで足りる。標準presetを優先表示したい場合も、Editor側の表示順を決め打ちすればよい。 |
| Physics / Dynamics | 手動bindingならnon-semanticで成立する。標準presetに含まれるparameterがhuman readableに意味を取れることは有用。 |
| Variant / Expression | 差分idと外部操作mappingで足りる。ひとまずnon-semanticとして扱う。 |
| Codex / LLM Agent Skill | roleは有用だが、LLM側skillの吸収可能範囲が広い。Editor本体のrole仕様を肥大化させない。 |

### 3.3 Non-semantic Consumer

Core Parameter情報で成立するconsumer。

| Consumer | 必要な情報 |
|---|---|
| Authoring Parameter Bar | id、displayName、min/default/max、current value |
| Parameter Manager | id、displayName、type、group、range、usage refs |
| Keyform Editor / Inspector | parameter id、current value、keyform positions |
| Canvas Preview Evaluation | parameter value、keyform interpolation result |
| Validation / Product Preflight | duplicate id、missing refs、out-of-range keyforms、unused parameter |
| Save / Load / Project Storage | parameter definitions、values、references |
| Undo / Redo / Operation Log | stable refs、operation payload |
| Test / E2E Surface | stable ids、structured state、deterministic values |
| Diagnostics / Evidence View | raw refs、operation traces、validation evidence |

## 4. Camera Captureが要求する情報

Camera Capture / Face Trackingは、Parameter Preset / Profileにsemantic roleを要求する代表consumerである。

### 4.1 role

roleは単なる名前ではなく、外部入力や標準操作がparameterをどう解釈するかを示す。

例:

```text
role: face.angle.x
meaning: 顔の左右向き
default meaning: 正面
min meaning: 左右どちらかの端
max meaning: 反対側の端
```

roleがないparameterは、tracker入力から意味をもって接続できない。

### 4.2 input source

具体的なinput sourceはFacade / Mapping側の責務である。

Core ParameterやPreset / Profileは、MediaPipe、ARKit、独自trackerなどの具体sourceを知らない。Preset / Profileが公開するroleへ、Facade / Mappingがtracker固有inputを接続する。

### 4.3 range

rangeは3つに分ける。

| 項目 | 所属 | 内容 |
|---|---|---|
| 数値範囲 | Core Parameter | min/default/max |
| 範囲の意味 | Preset / Profile | min/default/maxがどの状態を表すか |
| 外部入力の変換 | Facade / Mapping | raw tracker inputをCore Parameter範囲へ写す方法 |

Core Parameterに `-30..30` があっても、`-30` がユーザー視点の左向きか右向きかは分からない。これはrole/profile側で定義する。

### 4.4 sign convention

sign conventionはrange意味の一部として扱う。

例:

```text
face.angle.x:
  min: user-facing left
  default: center
  max: user-facing right
```

実際のtracker inputが反対符号を返す場合は、Facade / Mappingが変換する。

### 4.5 smoothing / calibration

smoothingは、外部入力値の揺れを滑らかにする処理である。

例:

```text
raw yaw: 0.01, 0.03, -0.02, 0.04...
```

顔が止まっていてもtracker値は揺れる。そのままparameterへ入れるとモデルが震えるため、移動平均や低域フィルタで滑らかにする。

calibrationは、ユーザーやカメラ環境に合わせて基準値・範囲を調整する処理である。

例:

- ユーザーの正面顔を `face.angle.x = 0` として記録する。
- ユーザーが実際に左を向ける範囲をparameterのmin側へ対応させる。

smoothing / calibrationはCore Parameterではなく、Camera Capture Facade / Runtime Input Pipeline側の責務である。ただし、role/profileが「defaultは正面」「min/maxは左右端」などの意味を持たないと、calibration側も基準を決められない。

## 5. Preset Role分類

初期preset roleは、次の3種類に分ける。

### 5.1 Primary Capture Roles

Camera / tracker / manual runtime inputで直接駆動されるrole。

例:

- face angle
- eye open / blink
- eyeball movement
- mouth open
- body angle

### 5.2 Expression / Shape Roles

表情や形状の意味を持つrole。初期実装で深く触らなくても、preset入口として存在させ、意味だけは考えておく。

例:

- brow
- smile
- cheek
- mouth form / vowel
- gaze

### 5.3 Secondary Motion Roles

dynamics / runtime / time-drivenで動くrole。

髪揺れは、camera inputが直接駆動するprimary semantic parameterというより、face / bodyの動きに追従するsecondary motion parameterである。

呼吸はcamera captureではなく、runtime/time-driven semantic parameterとして扱う。

例:

- breath
- hair sway
- accessory sway

## 6. 初期Preset Role Catalog

これは「必ず全てkeyform実装するリスト」ではない。ユーザーまたはCodexが必要なものを選んでparameterを作るための意味カタログである。

Range基本方針:

| 種類 | Range | Default |
|---|---:|---:|
| Face angle | `-30 .. 30` | `0` |
| Body angle | `-10 .. 10` | `0` |
| 中央基準の移動 / 形状 | `-1 .. 1` | `0` |
| weight / 開閉 / 表情強度 | `0 .. 1` | `0` |
| eye open | `0 .. 1` | `1` |
| breath | `0 .. 1` | `0` |

Axis sign convention:

- `x`: `-` が画面左、`+` が画面右。
- `y`: `-` が下、`+` が上。
- `z`: `+` が画面上の時計回り。
- trackerや外部runtimeの符号が異なる場合は、Facade / Mapping層で変換する。

### Face

| Role | Range | Default | 意味 |
|---|---:|---:|---|
| `face.angle.x` | `-30 .. 30` | `0` | 顔の左右向き |
| `face.angle.y` | `-30 .. 30` | `0` | 顔の上下向き |
| `face.angle.z` | `-30 .. 30` | `0` | 顔の傾き / roll |

### Eyes

| Role | Range | Default | 意味 |
|---|---:|---:|---|
| `eye.left.open` | `0 .. 1` | `1` | 左目の開き |
| `eye.right.open` | `0 .. 1` | `1` | 右目の開き |
| `eyeball.x` | `-1 .. 1` | `0` | 目玉 / 視線の左右移動 |
| `eyeball.y` | `-1 .. 1` | `0` | 目玉 / 視線の上下移動 |
| `gaze.x` | `-1 .. 1` | `0` | 視線・注視方向の左右表現 |
| `gaze.y` | `-1 .. 1` | `0` | 視線・注視方向の上下表現 |

`eyeball.*` と `gaze.*` の関係は後続設計で精査する。v0では、目線移動の直接操作として `eyeball.*` を優先候補にする。

### Mouth

| Role | Range | Default | 意味 |
|---|---:|---:|---|
| `mouth.open` | `0 .. 1` | `0` | 口の開き |
| `mouth.smile` | `0 .. 1` | `0` | 口元の笑み |
| `mouth.form` | `-1 .. 1` | `0` | 口形の連続的変化 |
| `mouth.vowel.a` | `0 .. 1` | `0` | 母音Aに対応する口形weight |
| `mouth.vowel.i` | `0 .. 1` | `0` | 母音Iに対応する口形weight |
| `mouth.vowel.u` | `0 .. 1` | `0` | 母音Uに対応する口形weight |
| `mouth.vowel.e` | `0 .. 1` | `0` | 母音Eに対応する口形weight |
| `mouth.vowel.o` | `0 .. 1` | `0` | 母音Oに対応する口形weight |

`mouth.form` / `mouth.vowel.*` は当面深く触らなくても、概念としてpreset入口に残す。

### Brow / Cheek

| Role | Range | Default | 意味 |
|---|---:|---:|---|
| `brow.left.y` | `-1 .. 1` | `0` | 左眉の上下 |
| `brow.right.y` | `-1 .. 1` | `0` | 右眉の上下 |
| `brow.left.form` | `-1 .. 1` | `0` | 左眉形状 |
| `brow.right.form` | `-1 .. 1` | `0` | 右眉形状 |
| `cheek` | `0 .. 1` | `0` | 頬・照れ・頬上げなどの表情要素 |

### Body

| Role | Range | Default | 意味 |
|---|---:|---:|---|
| `body.angle.x` | `-10 .. 10` | `0` | 体の左右向き |
| `body.angle.y` | `-10 .. 10` | `0` | 体の上下向き / 前後傾き |
| `body.angle.z` | `-10 .. 10` | `0` | 体の傾き / roll |

Body angleは初期presetに含める。顔だけでなく体の動きがあると、runtime previewの見え方が大きく改善する。

### Secondary Motion

| Role | Range | Default | 意味 |
|---|---:|---:|---|
| `breath` | `0 .. 1` | `0` | time-drivenな呼吸motion driver |
| `hair.front.sway.x` | `-1 .. 1` | `0` | 前髪の左右揺れ |
| `hair.front.sway.y` | `-1 .. 1` | `0` | 前髪の上下揺れ |
| `hair.side.sway.x` | `-1 .. 1` | `0` | 横髪の左右揺れ |
| `hair.side.sway.y` | `-1 .. 1` | `0` | 横髪の上下揺れ |
| `hair.back.sway.x` | `-1 .. 1` | `0` | 後ろ髪の左右揺れ |
| `hair.back.sway.y` | `-1 .. 1` | `0` | 後ろ髪の上下揺れ |
| `accessory.sway.x` | `-1 .. 1` | `0` | アクセサリの左右揺れ |
| `accessory.sway.y` | `-1 .. 1` | `0` | アクセサリの上下揺れ |

Secondary Motion roleは、Camera Captureが直接要求するroleではなく、dynamics / runtime / time-driven driverが使うroleとして扱う。

## 7. 非ゴール

- Editor本体がPSDやpart名からsemantic roleを自動推定すること。
- Core Parameterにtracker固有input sourceや外部format名を混ぜること。
- 初期実装で全preset roleの編集UIやkeyform authoringを完成させること。
- Physics / Dynamics / Variant / Expressionのためにrole体系を過度に広げること。
- Cubism等の外部形式互換を前提にCore Parameter schemaを固定すること。

## 8. 未決事項

- role schemaの正式フィールド名。
- `eye.open` と blink roleを分けるか。
- `eyeball.*` と `gaze.*` の関係。
- `mouth.form` と `mouth.vowel.*` の共存方法。
- Secondary Motion roleをparameter presetとして作るか、dynamics templateとして扱うか。
- Parameter Manager上のgroup taxonomyとpreset選択UI。
- Camera Capture Facade / Runtime Input Pipelineのsmoothing / calibration schema。
- role versioningと将来export facadeでのalias管理。
