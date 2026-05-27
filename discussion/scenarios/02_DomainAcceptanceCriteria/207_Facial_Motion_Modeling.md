# シナリオ: Facial Motion Modeling

> 参照元AC: [../../acceptance-criteria/02_DomainAcceptanceCriteria/207_Facial_Motion_Modeling.md](../../acceptance-criteria/02_DomainAcceptanceCriteria/207_Facial_Motion_Modeling.md)
> Status: Accepted draft for Private Prototype MVP.

## 0. 目的

このシナリオは、Private Prototypeで顔可動を手作業で作成し、project-defined parameterとmanual authored parameter gridで検証する。

## 1. Source-of-Truth

### Design Decisions

- 顔可動はproject-defined scalar controlsとkeyformで表す。
- faceYaw、facePitch、faceRollは外部互換名ではなく、project内のsemantic role付きparameterとして扱う。
- Camera、tracking、配信アプリ連携はMVP外である。

### Research Notes

- 旧Cubism由来の顔向き操作や外部標準の前提は、現在のMVP仕様ではない。

## SC-FACE-001: 目と眉の表情を編集できる

### Given

- Projectには目、まぶた、眉のdrawable meshがある。

### When

1. ユーザーがeyeOpen、eyeSmile、browRaiseなどのproject-defined parameterを作成する。
2. ユーザーが各parameterにkeyformを設定する。
3. Runtime previewで表情を確認する。

### Then

- 目と眉の開閉、笑み、上下移動をkeyformで調整できる。
- 左右差のある調整もproject-defined parameterとして保存できる。
- 過大変形や閉じ目時の破綻はvalidatorでreportされる。

### 検証するAC

- AC-FACE-001
- AC-FACE-003
- AC-FACE-008

## SC-FACE-002: 口形と表情差分を編集できる

### Given

- Projectには口、歯、舌、頬などのdrawable meshがある。

### When

1. ユーザーがmouthOpen、mouthSmile、expressionSmileなどのparameterを作成する。
2. ユーザーが口形と表情差分のkeyformを作る。
3. Editorが同時作用時の見た目をpreviewする。

### Then

- 口形と表情は同時に評価できる。
- 破綻しやすい重なりや隙間はvalidatorでwarningになる。
- Lip sync入力や外部tracking連携はMVP成功条件にしない。

### 検証するAC

- AC-FACE-004
- AC-FACE-005
- AC-FACE-006

## SC-FACE-003: 手作業の顔向きgridを作成できる

### Given

- ユーザーは正面素材から、左右・上下・傾きの見た目を手で調整したい。

### When

1. ユーザーがfaceYaw、facePitch、faceRollのparameterを作成する。
2. ユーザーがmanual authored parameter gridを開く。
3. ユーザーがgrid cellごとにmesh、draw order、opacity、mask、secondary motion影響を調整する。

### Then

- 顔向き風の変化は、手で作ったgridとkeyformとして保存される。
- Gridの未調整cell、左右不整合、過大変形はvalidatorでreportされる。
- Private viewerは同じpackageを読み、同じparameter入力で再現する。

### 検証するAC

- AC-FACE-007
- AC-FACE-008

## 2. 未決事項

- MVP fixtureに含める顔パーツの最小構成。
- Face gridの編集UIを2D gridにするか、parameter inspector中心にするか。
