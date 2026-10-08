# Tracking Input Mapping Baseline

> Runtime PlayerでiFacialMocapなどのtracking inputをRuntime Exportのparameterへ割り当てるための初期設計メモ。

## 1. Purpose

この文書は、Runtime Player wave4以降で `iFacialMocap Input Adapter + Core Mapping` を計画する時の入口である。

外部仕様そのものは [../research/ifacialmocap-input-adapter-research.md](../research/ifacialmocap-input-adapter-research.md) を読む。この文書では、調査結果と現在のRuntime Export parameter contractを前提に、最初のmapping方針を整理する。

## 2. Current Basis

Repository facts:

- Runtime Export parameterには `parameterId`, `displayName`, `semanticRole`, `projectPresetAlias`, `runtimeRole`, `externalInput`, `readOnly`, `min`, `max`, `default` が含まれる。
- Playerが外部入力で直接書いてよい候補は `runtimeRole: "external-input"` / `externalInput: true` のparameterである。
- `computed-dynamics-output` や `hidden-from-direct-controls` はPlayerの通常入力mapping対象にしない。
- Preset parameterには `projectPresetAlias` があり、`face.angle.x`, `eye.left.open`, `mouth.open` などの意味的な識別に使える。

Research facts:

- iFacialMocapはARKit系blendshape値、head rotation / position、left/right eye rotationを送る。
- blendshape値は `0..100` とされるため、adapterでは `0..1` に正規化する。
- head / eye rotationはdegreeとして扱う。
- head positionの単位、軸、符号、安定性は実機確認が必要である。

## 3. Mapping Architecture

Mappingはinput adapterとは分ける。

```text
iFacialMocap raw frame
  -> source-specific parser
  -> normalized tracking frame
  -> mapping / calibration layer
  -> runtime parameter values
  -> runtime-core evaluation + dynamics
  -> Stage render
```

理由:

- iFacialMocap固有のframe形式とRuntime Exportのparameter名を結合しない。
- 将来VMC/OSCなどのinput sourceを追加しても、normalized tracking frame以降を再利用する。
- calibration、invert、scale、dead zone、smoothing、lost tracking時の挙動をadapterから分離する。

## 4. Wave4 Core Mapping Set

Wave4の目標は「全ARKit blendshape対応」ではなく、ライブ表示として成立する最小の顔入力である。

推奨する最初のmapping set:

| Tracking source | Runtime parameter target | Initial handling |
|---|---|---|
| head rotation | `face.angle.x`, `face.angle.y`, `face.angle.z` | 必須。軸と符号は実機frameで確認する |
| left/right eye rotation | `eyeball.x`, `eyeball.y` | 可能なら対応。左右eye rotationを合成するか片目ごとに平均する |
| eye blink blendshape | `eye.left.open`, `eye.right.open` | 初期invert ON。mapping単位でinvert切替可能にする |
| jaw / mouth open blendshape | `mouth.open` | 優先対応 |
| mouth smile blendshape | `mouth.smile` | 優先対応 |
| mouth form related blendshape | `mouth.form` | 使えるblendshapeが明確なら対応、曖昧なら後回し |
| brow blendshape | `brow.left.y`, `brow.right.y`, `brow.left.form`, `brow.right.form` | wave4で余力があれば対応 |
| cheek blendshape | `cheek` | 後回しでよい |
| mouth vowel A/I/U/E/O | `mouth.vowel.*` | TODO。モデリング負荷が高く、初期対応対象にしない |
| hair/accessory sway | `hair.*.sway.*`, `accessory.sway.*` | 直接mappingしない。Dynamicsのoutputとして扱う |
| body angle | `body.angle.x/y/z` | 直接tracking signalは期待しない。後続の派生演出で扱う |

## 5. Head Position Policy

Wave4では、head positionを直接Stage motionやBody Angleへ反映しなくてもよい。

ただし、取得とDebug表示は必須とする。

理由:

- 将来、Body follow head、接近によるStage scale、モデル表示位置の平行移動に必要になる。
- 特にBody Angle Z相当は、head rotationだけでなくhead positionの左右移動や奥行き変化を使って推定する可能性がある。
- ここをwave4で捨てると、後続の自然なライブ演出で入力層を作り直すことになる。

## 6. Runtime Parameter Selection Rules

自動mappingは次の優先順位でtarget parameterを探す。

1. `runtimeRole === "external-input"` かつ `externalInput === true`。
2. `projectPresetAlias` が期待roleに一致する。
3. 必要なら `semanticRole` と `displayName` を補助的に使う。

避けること:

- `displayName` だけに依存したmapping。
- `computedDynamicsOutputParameterIds` への直接書き込み。
- `Body Angle` へのiFacialMocap head signalの無断投入。
- Stage scale / translationをRuntime parameter mapping層に混ぜること。

## 7. Calibration And Invert

Wave4で最低限必要な調整:

- `Look Forward` / calibrationでhead rotation基準をゼロにできる。
- eye blink -> eye open は初期invert ON。
- 各mappingにはinvertを持てるようにする。
- scaleは初期値を持つ。細かな調整UIをどこまで出すかはwave4 planning-gateで決める。

## 8. Debug Requirements

通常UIにはparameter一覧を出さない。

Debug panelには次を出せるようにする。

- raw iFacialMocap frame
- parsed blendshape list
- head rotation / position raw values
- eye rotation raw values
- normalized tracking frame
- mapped runtime parameter values
- unmapped tracking signals
- missing target parameters

Debugは通常閉じる。Stage Windowには出さない。

## 9. Wave Order

Recommended order:

1. Wave3: Default Runtime Pose v0
   - Runtime Exportを読み込んだ静止状態で、default parameter / keyform / opacity / deformerが反映される。
   - iFacialMocap連携の前提となる「正しい静止表示」を作る。
2. Wave4: iFacialMocap Input Adapter + Core Mapping v0
   - 受信、parse、normalized frame、core mapping、Debug表示を作る。
   - head positionは利用しなくても取得・表示する。
3. Later: Head Pose Derived Body And Stage Motion
   - head rotation / positionからbody follow、Stage scale、Stage translationを推定する。

## 10. Open Questions

- 現行iOS版iFacialMocapの実frameに含まれるblendshape名一覧。
- head / eye rotationの軸と符号。
- head positionの単位、軸、符号、安定性。
- PCからのhandshakeが必須か、passive listenで足りるか。
- Wave4でbrowまで含めるか、face / eyes / mouthに絞るか。
- Mapping設定を永続化するか、v0では固定規則 + Debugに留めるか。
