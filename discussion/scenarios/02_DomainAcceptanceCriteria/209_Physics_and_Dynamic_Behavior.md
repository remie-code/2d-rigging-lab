# シナリオ: Physics and Dynamic Behavior

> 参照元AC: [209_Physics_and_Dynamic_Behavior.md](../../acceptance-criteria/02_DomainAcceptanceCriteria/209_Physics_and_Dynamic_Behavior.md)
> 状態: 精緻化ドラフト

## 0. このドラフトの目的

このファイルは、`AC-PHYS` を「人が Cubism Editor で物理演算を設定するときの操作粒度」まで降ろした場合、Undine がどの程度のシナリオを書けるかを確認するための試作である。

ここでは、Cubism Editor の画面構成を模倣することを目的にしない。ただし、Cubism Editor での参照操作を明示し、その操作によって成立している制作能力を Open Editor の検証可能な期待結果として書く。データモデル、保存形式の内部スキーマ、API、UIコンポーネント設計はこのドラフトの範囲外とする。

## 1. 公式事実

- Live2D Cubism では、顔が動いたときに髪がリアルタイムに揺れるような物理演算を設定し、書き出すことができる。物理演算は `[Modeling] -> [Open Physics Settings]` から設定でき、物理演算設定には Calculate FPS、グループ設定、入力設定、出力設定、物理モデル設定、振り子プレビューが含まれる。
  参照: [About Physics](https://docs.live2d.com/en/cubism-editor-manual/physics-operation/)
- 物理演算のグループは、前髪、スカートなど、揺らしたい体の部位ごとに作成できる。入力設定では、入力として扱うパラメータ、移動の扱い方、影響度、反転、正規化を設定できる。出力設定では、計算された揺れを適用する出力パラメータ、振り子番号、影響度、反転、倍率、最大出力を設定できる。
  参照: [About Physics](https://docs.live2d.com/en/cubism-editor-manual/physics-operation/)
- 物理モデル設定では、振り子を追加し、長さ、揺れやすさ、反応時間、収束速度などを調整できる。Duration は揺れの速さ、Ease of swinging は揺れの大きさ、Reaction time は入力への反応速度、Speed of convergence は揺れが収まる速さに関係する。
  参照: [About Physics](https://docs.live2d.com/en/cubism-editor-manual/physics-operation/), [How to Set Up Physics](https://docs.live2d.com/en/cubism-editor-manual/physical-operation-setting/)
- 物理演算の設定では、入力設定と物理モデル設定から計算した揺れが出力パラメータに適用される。出力の倍率や最大出力は、揺れが小さい場合や暴れる場合の調整に使われる。
  参照: [How to Set Up Physics](https://docs.live2d.com/en/cubism-editor-manual/physical-operation-setting/)
- Edit Physics Group では、物理グループの追加、複製、名称変更、処理順序の変更、削除、注意情報の確認ができる。同じ出力パラメータが複数グループから操作される場合や、処理順序上の入力と出力の関係に問題がある場合は注意情報が表示される。
  参照: [Edit Physics Group](https://docs.live2d.com/en/cubism-editor-manual/physics-group-information/)
- 物理演算設定は Cubism Editor で作成され、`.physics3.json` にまとめられる。SDK では `.physics3.json` から `CubismPhysics` のインスタンスを作成し、`Evaluate` / `evaluate` によって物理演算結果をモデルのパラメータへ適用する。
  参照: [Physics | SDK Manual](https://docs.live2d.com/cubism-sdk-manual/physics/)
- 組み込み用データの書き出しでは、`.physics3.json` は物理演算の設定値を含むデータとして扱われる。MOC3 書き出し時に物理設定ファイルを同時に出力でき、FPS情報を物理設定ファイルへ出力する設定もある。
  参照: [Data for Embedded Use](https://docs.live2d.com/en/cubism-editor-manual/export-moc3-motion3-files/)
- Cubism Viewer では、`.physics3.json` を選択すると Physics FPS、振り子グループ情報、振り子段数、入力、出力の概要を確認できる。物理計算結果はFPSによって変わり、Cubism 4.2 以降では physics ファイル内の FPS 情報をもとに計算される。
  参照: [Check Physics Information](https://docs.live2d.com/en/cubism-editor-manual/check-the-physics/)

## 2. リポジトリ事実

- 参照元ACは `AC-PHYS-001` から `AC-PHYS-006` までを定義している。
- 参照元ACは、具体的なデータ構造、I/F、Open Editor の画面構成、保存ファイル名をまだ定義していない。

## 3. 仮説

- Open Editor は、Cubism Editor と同じダイアログを持つ必要はないが、物理挙動グループ、入力、出力、計算条件、再生検証、保存・出力の結果をユーザーが観測できる必要がある。
- ここで使うパラメータ名 `ParamAngleX`, `ParamAngleZ`, `ParamBodyAngleX`, `ParamHairFrontSwingX` などは、検証粒度を示すための仮名であり、実装上の正式IDではない。
- 「AIに依頼する」操作は、自然言語、コマンド、パネル操作のいずれでもよい。ここでは、ユーザーの制作意図と確認可能な結果を中心に書く。

## 4. シナリオ記述方針

各シナリオは、次の2層を分けて書く。

- Cubism参照操作: 人が Cubism Editor で行う操作を、手順が再現できる粒度で書く
- Open Stack期待結果: このプロジェクトの Open Editor が、UI模倣ではなく同等の制作能力として満たすべき観測・構造・検証結果を書く

Given-When-Then は、次の対応で扱う。

- Given: 前提条件
- When: Cubism参照操作、または AI-native での実用操作
- Then: Open Stack期待結果

## SC-PHYS-001: 前髪用の物理挙動グループを作成し、入力と出力を結び付けられる

### Given

- 既存モデルが読み込まれている。
- 顔向きに相当する入力候補パラメータ `ParamAngleX`, `ParamAngleZ` が存在する。
- 前髪の揺れに相当する出力候補パラメータ `ParamHairFrontSwingX`, `ParamHairFrontSwingZ` が存在する。
- 前髪用の物理挙動グループはまだ存在しない。

### When: Cubism参照操作

1. `[Modeling] -> [Physics settings]` を開く。
2. `[Add]` から物理グループを作成し、名前を `Physics_HairFront` にする。
3. 入力設定に `ParamAngleX` を追加し、Type を `Angle`、影響度を `70%` にする。
4. 入力設定に `ParamAngleZ` を追加し、Type を `Angle`、影響度を `30%` にする。
5. 出力設定に `ParamHairFrontSwingX` と `ParamHairFrontSwingZ` を追加する。
6. それぞれの出力で使用する振り子番号、影響度、反転有無、倍率を設定する。
7. `Valid` を有効にし、顔向きパラメータを動かして前髪の揺れが出力パラメータへ反映されることを確認する。

### When: Open Stack実用操作

1. ユーザーが「前髪を、顔のX/Z角度に遅れて揺れるグループとして作りたい」と指定する。
2. 入力候補として `ParamAngleX`, `ParamAngleZ`、出力候補として `ParamHairFrontSwingX`, `ParamHairFrontSwingZ` を指定する。
3. 期待する寄与として、X方向を強め、Z方向を補助的に扱う方針を指定する。

### Then: Open Stack期待結果

- `Physics_HairFront` が、前髪用の物理挙動グループとして作成されたことを確認できる。
- グループには、入力 `ParamAngleX`, `ParamAngleZ` と、出力 `ParamHairFrontSwingX`, `ParamHairFrontSwingZ` の対応が含まれる。
- 入力ごとに、移動の扱い方、影響度、反転有無、正規化の有無を確認できる。
- 出力ごとに、対象パラメータ、振り子番号、影響度、反転有無、倍率を確認できる。
- 顔向き入力を変化させたとき、手動キー追加なしで前髪用出力パラメータが時間差を伴って変化する。
- 操作結果として、作成されたグループ名、入力一覧、出力一覧、未解決の入力・出力パラメータ、警告有無を取得できる。

### 検証するACの項目

- AC-PHYS-001: 物理挙動グループを定義できること
- AC-PHYS-002: 入力パラメータと出力パラメータを定義できること
- AC-PHYS-003: 遅延・慣性・揺れを表現できること

## SC-PHYS-002: 身体動作を入力に追加し、同じ前髪出力の揺れ方を調整できる

### Given

- `Physics_HairFront` が存在する。
- `Physics_HairFront` には、入力 `ParamAngleX`, `ParamAngleZ` と出力 `ParamHairFrontSwingX`, `ParamHairFrontSwingZ` が設定されている。
- 身体向きに相当する入力候補パラメータ `ParamBodyAngleX` が存在する。
- 現在の前髪の揺れは、顔向き入力に強く反応している。

### When: Cubism参照操作

1. `Physics_HairFront` の入力設定を開く。
2. 入力に `ParamBodyAngleX` を追加する。
3. Type を `Angle` に設定する。
4. `ParamAngleX` の影響度を下げ、`ParamBodyAngleX` の影響度を上げる。
5. 必要に応じて反転と角度正規化を調整する。
6. カーソルトラッキングまたはシーン再生で、身体動作に対する前髪の揺れを確認する。

### When: Open Stack実用操作

1. ユーザーが「前髪が顔だけでなく上半身の動きにも反応するようにしたい」と指定する。
2. 既存の `Physics_HairFront` に対して、入力 `ParamBodyAngleX` を追加する。
3. 顔向きより身体動作の寄与を少し強くする方針を指定する。

### Then: Open Stack期待結果

- `Physics_HairFront` に `ParamBodyAngleX` が入力として追加される。
- `ParamAngleX`, `ParamAngleZ`, `ParamBodyAngleX` の影響度が、同じ入力種別内で過剰な合計になっていないことを確認できる。
- 反転と正規化を適用した後の入力解釈を確認できる。
- 同じモーションを再生したとき、変更前後の前髪出力値の差分を比較できる。
- 変更後は、顔だけを傾けた場合と身体を動かした場合で、前髪の揺れの起点と大きさが区別できる。
- 入力調整の結果として、追加入力、変更された影響度、正規化範囲、警告有無を取得できる。

### 検証するACの項目

- AC-PHYS-002: 入力パラメータと出力パラメータを定義できること
- AC-PHYS-003: 遅延・慣性・揺れを表現できること
- AC-PHYS-006: 物理挙動を検証できること

## SC-PHYS-003: 振り子条件を調整し、遅れて戻る柔らかい前髪揺れを作れる

### Given

- `Physics_HairFront` が存在する。
- `Physics_HairFront` の入力と出力は設定済みである。
- 現在の前髪揺れは反応が速すぎ、停止後の余韻が短い。

### When: Cubism参照操作

1. `Physics_HairFront` の物理モデル設定を開く。
2. 振り子を1段追加する。
3. Duration を大きめにして、揺れの速度を遅くする。
4. Ease of swinging を `0.8` 付近に設定し、小さな入力でも揺れが見えるようにする。
5. Reaction time を `1` より小さくし、入力への反応を遅らせる。
6. Speed of convergence を `1` より小さくし、揺れが収まるまでの余韻を長くする。
7. 振り子プレビューとシーン再生で、前髪が入力より遅れて動き、遅れて止まることを確認する。

### When: Open Stack実用操作

1. ユーザーが「前髪の揺れを少し重く、入力より遅れて戻る感じにしたい」と指定する。
2. 対象として `Physics_HairFront` を指定する。
3. 現在の揺れと比較して、速度を遅くし、反応を鈍くし、収束を遅くする方針を指定する。

### Then: Open Stack期待結果

- `Physics_HairFront` の物理計算条件として、振り子段数、Duration、Ease of swinging、Reaction time、Speed of convergence に相当する条件を確認できる。
- 調整前後の再生で、入力ピークと出力ピークの時間差が増える。
- 入力が停止した後も、出力パラメータが即座に静止せず、収束条件に従って戻る。
- 揺れが出力パラメータ範囲を大きく超える場合は、出力倍率または最大出力の調整候補として警告できる。
- 操作結果として、変更された計算条件、再生時の最大出力、収束状態、警告有無を取得できる。

### 検証するACの項目

- AC-PHYS-003: 遅延・慣性・揺れを表現できること
- AC-PHYS-004: 物理計算条件を設定できること
- AC-PHYS-006: 物理挙動を検証できること

## SC-PHYS-004: 長い髪を多段振り子として設定し、根元から毛先へ揺れが伝わることを確認できる

### Given

- 長い髪に相当する出力パラメータ `ParamHairBack01`, `ParamHairBack02`, `ParamHairBack03`, `ParamHairBack04` が存在する。
- 顔向きと身体向きに相当する入力パラメータ `ParamAngleX`, `ParamBodyAngleX` が存在する。
- 後ろ髪用の物理挙動グループはまだ存在しない。

### When: Cubism参照操作

1. 物理グループ `Physics_HairBack` を作成する。
2. 入力設定に `ParamAngleX` と `ParamBodyAngleX` を追加する。
3. 物理モデル設定で、4段以上の振り子を作成する。
4. 出力設定に `ParamHairBack01` から `ParamHairBack04` を追加する。
5. 各出力に、根元から毛先へ対応する振り子番号を割り当てる。
6. 毛先側ほど揺れが大きく見えるように、倍率と反転有無を調整する。
7. シーン再生で、根元より毛先が遅れて大きく揺れることを確認する。

### When: Open Stack実用操作

1. ユーザーが「後ろ髪を4段の揺れとして、毛先ほど遅れて大きく揺らしたい」と指定する。
2. 入力として `ParamAngleX`, `ParamBodyAngleX` を指定する。
3. 出力として `ParamHairBack01` から `ParamHairBack04` を根元から毛先の順に指定する。

### Then: Open Stack期待結果

- `Physics_HairBack` が後ろ髪用の物理挙動グループとして作成される。
- `ParamHairBack01` から `ParamHairBack04` が、多段振り子の段に対応付けられていることを確認できる。
- 同じ入力変化に対して、根元側より毛先側の出力が遅れて大きく変化する。
- 振り子番号の不足、重複、出力順の不整合がある場合は検出できる。
- 出力倍率が過大で出力範囲を超える場合は、最大出力とともに調整候補を提示できる。
- 操作結果として、グループ名、振り子段数、出力と振り子番号の対応、各出力の最大値、警告有無を取得できる。

### 検証するACの項目

- AC-PHYS-001: 物理挙動グループを定義できること
- AC-PHYS-002: 入力パラメータと出力パラメータを定義できること
- AC-PHYS-003: 遅延・慣性・揺れを表現できること
- AC-PHYS-004: 物理計算条件を設定できること
- AC-PHYS-006: 物理挙動を検証できること

## SC-PHYS-005: 複数グループが同じ出力に影響する場合、処理順序と影響度の注意を確認できる

### Given

- `Physics_HairFront` が存在し、出力 `ParamHairFrontSwingX` を操作している。
- 装飾品用の物理グループ `Physics_RibbonFront` を作成できる。
- `Physics_RibbonFront` も、演出上 `ParamHairFrontSwingX` に影響させたいという制作意図がある。

### When: Cubism参照操作

1. `Physics_RibbonFront` を作成する。
2. `Physics_RibbonFront` の出力に `ParamHairFrontSwingX` を追加する。
3. Edit Physics Group を開く。
4. `Physics_HairFront` と `Physics_RibbonFront` の処理順序を確認する。
5. 同じ出力パラメータを複数グループが扱う注意情報を確認する。
6. 影響度を調整し、処理順序を変えた場合に最終的な影響比が変わることを確認する。

### When: Open Stack実用操作

1. ユーザーが「前髪とリボンの揺れを同じ横揺れパラメータにも少し混ぜたい」と指定する。
2. 既存の `Physics_HairFront` に加えて、`Physics_RibbonFront` を作成する。
3. 両方のグループが `ParamHairFrontSwingX` に出力する設定にする。

### Then: Open Stack期待結果

- `ParamHairFrontSwingX` が複数の物理挙動グループから出力されていることを検出できる。
- 対象グループの処理順序と、各グループの出力影響度を確認できる。
- 処理順序を変更した場合、同じ影響度指定でも最終的な出力への寄与が変わる可能性を警告できる。
- 入力として使うパラメータが、後段のグループで出力されるなど、処理順序上の伝播不能がある場合は注意として提示できる。
- 警告は即時失敗ではなく、制作意図に応じて処理順序または影響度を調整するための検証結果として扱える。
- 操作結果として、競合している出力パラメータ、関係するグループ、処理順序、影響度、注意種別を取得できる。

### 検証するACの項目

- AC-PHYS-001: 物理挙動グループを定義できること
- AC-PHYS-002: 入力パラメータと出力パラメータを定義できること
- AC-PHYS-006: 物理挙動を検証できること

## SC-PHYS-006: 計算FPSを設定し、再生結果がFPS条件と結び付いていることを確認できる

### Given

- 物理挙動グループ `Physics_HairFront` と `Physics_HairBack` が存在する。
- どちらのグループも、顔向きまたは身体動作を入力として揺れを出力する。
- 現在の Calculate FPS は未確認である。

### When: Cubism参照操作

1. Physics settings を開く。
2. Calculate FPS を `60` に設定する。
3. `Physics_HairFront` と `Physics_HairBack` を有効にする。
4. 同じシーンまたはカーソルトラッキングで揺れを再生する。
5. Calculate FPS を別の値に変更し、物理演算結果が変わる可能性を確認する。
6. 必要に応じて、意図する組み込み先のFPSに合わせて値を戻す。

### When: Open Stack実用操作

1. ユーザーが「ランタイムは60fps想定なので、物理も60fpsで確認したい」と指定する。
2. 対象モデルの物理計算条件として Calculate FPS を `60` に設定する。
3. 同じ入力モーションを使って、物理結果を再生する。

### Then: Open Stack期待結果

- 物理計算条件として Calculate FPS が `60` に設定されていることを確認できる。
- 再生・検証結果には、使用したFPS条件が明示される。
- FPS条件を変えて再計算した場合、出力パラメータの時系列差分を比較できる。
- 保存または出力時に、物理設定へFPS情報を含めるかどうかを確認できる。
- FPS情報が未設定の場合は、ランタイムやViewerでの結果差につながる可能性を警告できる。
- 操作結果として、Calculate FPS、再生に使った入力、出力時系列、FPS未設定警告有無を取得できる。

### 検証するACの項目

- AC-PHYS-004: 物理計算条件を設定できること
- AC-PHYS-005: 物理挙動を保存・出力できること
- AC-PHYS-006: 物理挙動を検証できること

## SC-PHYS-007: 物理挙動を保存・出力し、Viewerまたはランタイム相当で概要を検証できる

### Given

- `Physics_HairFront` と `Physics_HairBack` が設定済みである。
- Calculate FPS が `60` に設定されている。
- モデルは組み込み用データとして書き出せる状態である。

### When: Cubism参照操作

1. モデルファイルを保存する。
2. `[File] -> [Export embedded file] -> [Export as MOC3 file]` を実行する。
3. 書き出し設定で、物理設定ファイル `.physics3.json` の出力を有効にする。
4. 必要に応じて、FPS情報を物理設定ファイルへ出力する設定を有効にする。
5. 書き出した `.physics3.json` を Cubism Viewer で選択する。
6. Physics FPS、振り子グループ情報、振り子段数、入力、出力の概要を確認する。
7. ランタイム相当の再生で、物理演算結果がモデルパラメータへ適用されることを確認する。

### When: Open Stack実用操作

1. ユーザーが「このモデルの物理設定をランタイムで使える形で出力したい」と指定する。
2. 出力対象として、モデル本体、テクスチャ、物理挙動設定を選択する。
3. 出力後、物理設定の概要と再生結果を検証する。

### Then: Open Stack期待結果

- 定義済みの物理挙動が、モデル資産の一部として保存される。
- ランタイム利用可能な物理設定ファイル、またはそれに相当する出力物が生成される。
- 出力物から、Physics FPS、物理グループ、振り子段数、入力パラメータ、出力パラメータの概要を確認できる。
- ランタイム相当の評価で、入力パラメータの変化に応じて出力パラメータへ物理演算結果が適用される。
- 物理設定が不正で書き出せない場合は、不正なグループ、入力、出力、計算条件を特定できる。
- 操作結果として、出力対象、物理設定の有無、FPS情報の有無、検証結果、書き出し不能理由を取得できる。

### 検証するACの項目

- AC-PHYS-005: 物理挙動を保存・出力できること
- AC-PHYS-006: 物理挙動を検証できること

## 5. 未決事項

- Open Editor が物理挙動をどの粒度で「グループ」「入力」「出力」「計算条件」としてユーザーに見せるかは未決である。
- `.physics3.json` を直接の出力形式とするか、内部形式から Cubism 互換出力へ変換するかは未決である。
- 物理演算の数値検証を、時系列パラメータ値、プレビュー映像、警告レポートのどれを主オラクルとして扱うかは未決である。
- AI による自動設定で、Cubism公式の推奨値をどこまで採用し、作品ごとの調整余地をどのように残すかは未決である。
