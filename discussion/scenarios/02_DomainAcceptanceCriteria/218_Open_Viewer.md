# シナリオ: Open Viewer

> 参照元AC: [218_Open_Viewer.md](../../acceptance-criteria/02_DomainAcceptanceCriteria/218_Open_Viewer.md)
> 状態: 新規Open Stackドメイン シナリオドラフト

## 0. このドラフトの目的

このファイルは、`AC-VIEWER` を Open Model Package の読み込み、parameter操作、expression/motion/physics確認、構造inspection、validation report保存のシナリオへ降ろす。

Open Viewer は Cubism Viewer 互換を成功条件にしない。初期の正は、Open Runtime と Open Package Validator の結果を人間とAIエージェントが確認できることである。

## 1. リポジトリ事実

- 参照元ACは、package読み込み、parameter操作、expression/motion/physics確認、model structure/runtime state inspection、validation report保存を要求している。
- `discussion/concept/modified_concept.md` は、Viewer を Runtime / Model Package の検証環境として独立した役割に位置付けている。
- MotionSync / LipSync と Video Editor は当面スコープ外である。

## 2. 設計判断

- Viewer は制作UIの代替ではなく、package と runtime behavior の確認環境として扱う。
- Viewer は視覚確認だけでなく、構造化 inspection と AI-readable report 出力を必須の検証対象にする。
- expression/motion/physics の確認は、音声解析や動画編集機能に拡張しない。

## 3. シナリオ記述方針

- Given: package、Viewer、Validator、Runtime、検証用入力状態を書く。
- When: load、slider操作、expression/motion/physics適用、inspection、report保存を書く。
- Then: 表示、state変化、構造化情報、保存されたreportを観測可能に書く。

## SC-VIEWER-001: Open Model Package を読み込んで初期表示できる

### Given: 前提条件

- `MinimalAvatar_A.openpackage` は Validator で Pass している。
- package には texture、drawable、mesh、parameter、package metadata が含まれる。
- Open Viewer は Open Runtime を使って package を読み込む。

### When: Open Stack実用操作

1. ユーザーが Open Viewer で `MinimalAvatar_A.openpackage` を選択する。
2. Viewer が package を読み込み、Runtime を初期化する。
3. ユーザーが load diagnostics と初期表示を確認する。

### Then: Open Stack期待結果

- Viewer はモデルを表示できる。
- package metadata、format version、model ID、読み込み日時またはsession IDを表示できる。
- load diagnostics には、schema結果、参照解決結果、runtime初期化結果が含まれる。
- 読み込み失敗時は、失敗したfile/path/fieldと復旧可能性を表示できる。

### 検証するACの項目

- AC-VIEWER-001: Open Model Package を読み込めること
- AC-VIEWER-005: validation report を表示・保存できること

## SC-VIEWER-002: parameter slider でモデル状態を変更し確認できる

### Given: 前提条件

- `RiggedAvatar_A` は Viewer に読み込まれている。
- `ParamAngleX`, `ParamEyeLOpen`, `ParamMouthOpenY` が Viewer の parameter panel に表示される。
- 各parameterには範囲、初期値、現在値が定義されている。

### When: Open Stack実用操作

1. ユーザーが `ParamAngleX` slider を `-1`, `0`, `1` に動かす。
2. ユーザーが `ParamEyeLOpen` slider を `1` から `0` に動かす。
3. ユーザーが各状態の runtime snapshot を保存する。

### Then: Open Stack期待結果

- slider操作に応じて Viewer の表示が変化する。
- slider UI は parameter の最小値、最大値、初期値、現在値を確認できる。
- snapshot には、操作したparameter、評価済みdrawable state、diagnosticsが含まれる。
- 範囲外入力が発生した場合、Viewer は Runtime の clamp/reject結果を表示できる。

### 検証するACの項目

- AC-VIEWER-002: parameter 操作を提供できること
- AC-VIEWER-004: model structure と runtime state を inspect できること

## SC-VIEWER-003: expression / motion / physics の適用結果を確認できる

### Given: 前提条件

- `RiggedAvatar_A` には expression `Smile`、短いmotion `IdleBlink`、髪揺れphysics `HairSway` が含まれる。
- これらは Open Model Format 内の参照として Validator で Pass している。
- 音声解析を必要とする MotionSync / LipSync はこの検証に含めない。

### When: Open Stack実用操作

1. ユーザーが Viewer で expression `Smile` を適用する。
2. ユーザーが motion `IdleBlink` を再生、一時停止、停止する。
3. ユーザーが physics `HairSway` の有効/無効を切り替える。
4. ユーザーが適用中の parameter source と runtime state を inspect する。

### Then: Open Stack期待結果

- expression適用により、対象parameterまたはdrawable state が変化する。
- motion再生中は、frameまたはtimeに応じた parameter変化を確認できる。
- physics有効時は、入力parameterに対する副次的な揺れが runtime state と表示に反映される。
- Viewer は expression、motion、physics の適用有無、参照ID、現在時刻、diagnostics を表示できる。

### 検証するACの項目

- AC-VIEWER-003: expression / motion / physics を確認できること
- AC-VIEWER-004: model structure と runtime state を inspect できること

## SC-VIEWER-004: model structure と runtime state を inspect できる

### Given: 前提条件

- `RiggedAvatar_A` は Viewer に読み込まれている。
- model には part、drawable、mesh、parameter、draw order、clipping/mask が存在する。
- Viewer は構造tree、runtime state panel、選択連動を提供する。

### When: Open Stack実用操作

1. ユーザーが構造treeから `Face/EyeL/Iris` drawable を選択する。
2. ユーザーが該当drawableの mesh、texture、uv、draw order、mask参照を確認する。
3. ユーザーが `ParamAngleX = 1` に変更して、選択drawableの評価済みvertexを確認する。
4. ユーザーが inspection snapshot を保存する。

### Then: Open Stack期待結果

- Viewer は選択した drawable の authoring ID と runtime drawable ID を対応付けて表示できる。
- mesh、vertex数、triangle数、texture参照、uv範囲、draw order、clipping/mask状態を確認できる。
- parameter変更後の評価済みvertexと、変更前との差分を確認できる。
- snapshot は AIエージェントが対象drawableの問題を特定できる構造化データとして保存される。

### 検証するACの項目

- AC-VIEWER-004: model structure と runtime state を inspect できること
- AC-VIEWER-002: parameter 操作を提供できること

## SC-VIEWER-005: validation report を表示し AI-readable に保存できる

### Given: 前提条件

- `BrokenAvatar_MissingTexture.openpackage` は、参照される texture を1つ欠落させた検証用packageである。
- Open Package Validator は、Pass / Fail / Needs review / Not applicable を返せる。
- Viewer は Validator を実行または結果ファイルを読み込める。

### When: Open Stack実用操作

1. ユーザーが Viewer で `BrokenAvatar_MissingTexture.openpackage` を開く。
2. ユーザーが validation を実行する。
3. ユーザーが validation result を画面で確認する。
4. ユーザーが report を JSON または同等の AI-readable 形式で保存する。

### Then: Open Stack期待結果

- Viewer は欠落textureを Fail として表示する。
- report には、対象ID、参照元field、欠落path、影響を受けるdrawable、修復候補が含まれる。
- Viewer は読み込み不能、部分読み込み、表示可能だが警告ありの状態を区別して表示できる。
- 保存されたreportは、AIエージェントが追加の修復操作やレビューに利用できる。

### 検証するACの項目

- AC-VIEWER-005: validation report を表示・保存できること
- AC-VIEWER-001: Open Model Package を読み込めること

## 4. 未決事項

- Viewer と Editor を同一アプリ内のモードにするか、独立アプリにするか。
- snapshot/report の保存形式。
- Viewer の画像差分検証を MVP に含めるか。
- physics の最小確認UIと数値表示範囲。
