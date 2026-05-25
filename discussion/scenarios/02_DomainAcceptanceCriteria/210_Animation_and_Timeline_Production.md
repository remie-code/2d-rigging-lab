# シナリオ: Animation and Timeline Production

> 参照元AC: [210_Animation_and_Timeline_Production.md](../../acceptance-criteria/02_DomainAcceptanceCriteria/210_Animation_and_Timeline_Production.md)
> 状態: 精緻化ドラフト

## 0. このドラフトの目的

このファイルは、`AC-ANIM` を「人が Cubism Editor でモデルを配置し、タイムライン上でパラメータ値を記録し、再生・書き出し・検証する操作粒度」まで降ろした場合、Open Editor がどの制作能力を満たすべきかを確認するためのドラフトである。

ここでは、Cubism Editor の画面構成やデータ形式を模倣することを目的にしない。ただし、Cubism Editor での参照操作を明示し、その操作によって成立しているアニメーション制作能力を、Open Editor の検証可能な期待結果として書く。

データモデル、保存形式、API、UIコンポーネント設計はこのシナリオの対象外とする。必要な場合でも、ここでは「観測できる結果」「制作上成立すべき振る舞い」までに留める。

## 1. 公式事実

- Cubism Editor でアニメーションを作成するには、モデルをシーンに配置する必要がある。新規アニメーションファイルには新しいシーンが作成され、シーン名、サイズ、長さ、フレームレートなどを設定できる。モデルはタイムラインパレットへドラッグ&ドロップして配置できる。
  参照: [Model loading and placement](https://docs.live2d.com/en/cubism-editor-manual/loading-model-and-placement/)
- Animation View は、モデルファイルを読み込み、設定済みパラメータを動かしてタイムライン上にキーフレームモーションを作成するためのビューである。
  参照: [About the View Area](https://docs.live2d.com/cubism-editor-manual/about-viewarea/?locale=en_us)
- タイムラインパレットでは、モーションの作成や再生を行える。トラックとプロパティには、モデリングビューで作成したパラメータ、表示設定、トラック全体のプロパティなどが表示される。
  参照: [Timeline palette](https://docs.live2d.com/en/cubism-editor-manual/timelinepalatte/)
- タイムラインパレットでは、モデル、音声などをシーンに配置した後、各プロパティグループ内でキーフレームを編集できる。アニメーション全体の長さは Duration の操作で変更できる。
  参照: [Displaying and operating the timeline palette](https://docs.live2d.com/en/cubism-editor-manual/timeline-basic-operation-timelinepalette/)
- Dope Sheet では、タイムライン上にキーを挿入してアニメーションを作成する。フレームを選択し、`Live2D Parameters` のスライダーを動かす、または数値を入力することで、そのパラメータ値のキーを挿入できる。組み込み用途では、意図しない動きを防ぐため frame 0 にキーフレームを挿入することが推奨されている。
  参照: [Basic Dope Sheet Operation](https://docs.live2d.com/en/cubism-editor-manual/timeline-basic-operation-dopesheet/)
- Graph Editor では、パラメータ変化をグラフで確認しながらアニメーションを作成できる。Cubism Editor には複数種類の補間カーブがあり、初期値は Smooth である。
  参照: [Graph Editor](https://docs.live2d.com/en/cubism-editor-manual/grapheditor/)
- パラメータ操作は記録できる。記録中に動かしたパラメータはキーフレームとしてタイムラインに出力される。
  参照: [Record Parameter Operations and Generate Animations](https://docs.live2d.com/en/cubism-editor-manual/recording-parameters/)
- 組み込み用モーションファイルは、アニメーションデータまたはアニメーションシーンを選択して書き出す。書き出し結果は `.motion3.json` ファイルになる。
  参照: [Data for Embedded Use](https://docs.live2d.com/en/cubism-editor-manual/export-moc3-motion3-files/)
- Cubism Viewer では、組み込み用に書き出したモデルと `.motion3.json` モーションを読み込み、モーションを再生して確認できる。編集用の `.cmo3` や `.can3` は Viewer の読み込み対象ではない。
  参照: [Loading Models and Motion](https://docs.live2d.com/en/cubism-editor-manual/load-model-and-motion/), [About Cubism Viewer (for OW)](https://docs.live2d.com/en/cubism-editor-manual/cubism3-viewer-for-ow/)
- Cubism の物理演算は、顔や体の動きに連動した髪や衣服の揺れをリアルタイムに作るために設定できる。物理演算の Calculate FPS を変えると計算結果が変わるため、動きを確認する必要がある。
  参照: [About Physics](https://docs.live2d.com/en/cubism-editor-manual/physics-operation/)
- 物理演算による揺れは、Animation Workspace のタイムライン上のキーフレームとしてベイクできる。ベイク後はシーンを再生し、動きに問題がないか確認する。
  参照: [Bake Animation from Physics](https://docs.live2d.com/en/cubism-editor-manual/physics-operation-bake/)

## 2. 公式資料で不足する点・仮定

- 公式資料は Cubism Editor の操作と Cubism 形式の書き出しを説明しているが、Open Editor が自然言語、生成補助、自動補正をどこまで持つべきかは定義していない。ここでは、操作入力の形ではなく、完成するアニメーション制作能力を検証対象にする。
- `AC-ANIM-005` の「滑らかさ」「意図しない急変」「物理挙動との整合性」について、AC内に数値閾値はない。したがって本ドラフトでは、検出対象と観測結果をシナリオ化し、具体的な合否閾値は未決事項として扱う。
- `AC-ANIM-004` の「ランタイムまたは外部利用可能なモーション資産」は、Live2D 実務上は `.motion3.json` が代表例である。ただし、このプロジェクトが独自中間形式も出力対象に含めるかは未決である。本ドラフトでは、外部再生可能性を満たす代表例として `.motion3.json` を扱う。
- 物理演算、リップシンク、視線追従などをタイムラインへベイクする範囲は、AC上は詳細化されていない。本ドラフトでは物理演算のみを品質検証の代表ケースとして扱う。

## 3. シナリオ記述方針

各シナリオは Given-When-Then で書く。

- Given: 制作対象、モデル状態、シーン状態などの前提条件を書く
- When / Cubism参照操作: 人が Cubism Editor で行う実務操作を、手順が再現できる粒度で書く
- Then / Open Stack期待結果: このプロジェクトの Open Editor が、UI模倣ではなく同等の制作能力として満たすべき観測・再生・検証結果を書く

Open Stack期待結果では、具体的なデータスキーマ、API名、画面部品名を定義しない。必要な情報が観測・比較・書き出し・検証できることだけを書く。

## SC-ANIM-001: 読み込み済みモデルを新規シーンのアニメーション対象として配置できる

### Given / 前提条件

- 作成済みまたは読み込み済みの Live2D モデル `Avatar_A` が存在する。
- `Avatar_A` には、少なくとも `ParamAngleX`, `ParamAngleY`, `ParamMouthOpenY` が存在する。
- まだアニメーションシーンは作成されていない、または新規シーンを追加できる状態である。
- アニメーションの基準として、長さ `3秒`、フレームレート `30fps` を使う方針が決まっている。

### When / Cubism参照操作

1. `[File] -> [New] -> [Animation]` を実行する。
2. 自動作成されたシーン、または新規追加したシーンを選択する。
3. シーン名を `Idle_Turn_Test` にする。
4. シーンの長さを `3秒`、フレームレートを `30fps` に設定する。
5. `Avatar_A` のモデルファイルをタイムラインパレットへドラッグ&ドロップする。
6. タイムライン上に `Avatar_A` のトラックが作成され、ビュー上にモデルが表示されることを確認する。
7. `Live2D Parameters` のプロパティグループを開き、`ParamAngleX`, `ParamAngleY`, `ParamMouthOpenY` が編集対象として表示されることを確認する。

### Then / Open Stack期待結果

- `Avatar_A` を、時間軸を持つアニメーション対象として扱える。
- `Idle_Turn_Test` は、長さ `3秒`、フレームレート `30fps` の再生範囲を持つシーンとして扱える。
- `Avatar_A` のアニメーション対象パラメータを、タイムライン上で選択・参照できる。
- モデル配置後、現在時刻におけるモデルの表示状態をプレビューできる。
- モデル配置に失敗した場合は、モデル未読込、パラメータ不一致、参照切れなど、制作上修正できる理由を確認できる。

### 検証するACの項目

- AC-ANIM-001: モデルを時間軸上に配置できること

## SC-ANIM-002: タイムライン上の特定フレームにパラメータ値を記録できる

### Given / 前提条件

- `Idle_Turn_Test` シーンに `Avatar_A` が配置されている。
- シーンの長さは `3秒`、フレームレートは `30fps` である。
- `Avatar_A` の `ParamAngleX` は、最小値 `-30`、標準値 `0`、最大値 `30` の範囲で動かせる。
- 組み込み用途での意図しない初期動作を避けるため、frame `0` に基準キーを置く方針である。

### When / Cubism参照操作

1. タイムラインのインジケータを frame `0` に移動する。
2. `Live2D Parameters` の `ParamAngleX` を `0` にして、キーを挿入する。
3. インジケータを frame `15` に移動する。
4. `ParamAngleX` を `30` にして、キーを挿入する。
5. インジケータを frame `30` に移動する。
6. `ParamAngleX` を `0` に戻して、キーを挿入する。
7. Dope Sheet 上で、`ParamAngleX` の frame `0`, `15`, `30` にキーがあることを確認する。
8. Graph Editor に切り替え、各キーの時刻と値が意図どおりであることを確認する。

### Then / Open Stack期待結果

- `ParamAngleX` に対して、frame `0` の値 `0`、frame `15` の値 `30`、frame `30` の値 `0` を記録できる。
- 記録済みの各キーは、時刻、対象パラメータ、値を制作上確認できる。
- frame `0` に基準キーが存在するため、再生開始直後の値が不定にならない。
- パラメータ値が範囲外に指定された場合は、範囲外であることを検出し、制作上修正できる形で通知できる。
- キーの追加、移動、削除後も、タイムライン上のパラメータ値を再確認できる。

### 検証するACの項目

- AC-ANIM-002: タイムライン上でパラメータ変化を記録できること
- AC-ANIM-005: アニメーション品質を検証できること

## SC-ANIM-003: キーフレーム間の補間を再生し、動きの意図を確認できる

### Given / 前提条件

- `Idle_Turn_Test` シーンに `Avatar_A` が配置されている。
- `ParamAngleX` には、frame `0: 0`、frame `15: 30`、frame `30: 0` のキーが存在する。
- `ParamAngleY` には、frame `0: 0`、frame `15: -10`、frame `30: 0` のキーを追加できる。
- 制作意図は、顔が右へ向きながら少し下がり、開始姿勢へ戻る短いループ候補である。

### When / Cubism参照操作

1. `ParamAngleY` に frame `0: 0`、frame `15: -10`、frame `30: 0` のキーを挿入する。
2. Graph Editor で `ParamAngleX` と `ParamAngleY` を表示する。
3. `ParamAngleX` の補間を Smooth にする。
4. `ParamAngleY` の補間も Smooth にする。
5. frame `0` から frame `30` までを再生する。
6. frame `7` または `8` 付近で、`ParamAngleX` が `0` と `30` の間、`ParamAngleY` が `0` と `-10` の間の中間姿勢になっていることを確認する。
7. 補間を Linear に変更して再生し、速度変化の印象が変わることを確認する。
8. 必要に応じて Step に変更し、瞬間的な切り替えとして再生されることを確認する。

### Then / Open Stack期待結果

- 複数キーフレーム間のパラメータ値を補間して、時間進行に応じたモデル状態として再生できる。
- Smooth、Linear、Step など、補間方針の違いによる再生結果の差を確認できる。
- 同じ時間範囲内で複数パラメータが同時に変化する場合、それぞれの補間結果を合成したモデル状態をプレビューできる。
- 再生中または停止位置で、現在フレームのモデル状態と主要パラメータ値を確認できる。
- 補間方針を変えても、元のキーフレーム時刻とキー値は意図せず失われない。

### 検証するACの項目

- AC-ANIM-002: タイムライン上でパラメータ変化を記録できること
- AC-ANIM-003: キーフレーム間の変化を再生できること

## SC-ANIM-004: 手動パラメータ操作を記録してタイムライン上のキーに変換できる

### Given / 前提条件

- `Avatar_A` は `Idle_Turn_Test` シーンに配置されている。
- `ParamMouthOpenY` は、最小値 `0`、最大値 `1` の範囲で口開閉を表す。
- 制作者は、短い「あいう」風の口開閉を手動操作で記録したい。
- 既存の `ParamAngleX` と `ParamAngleY` のキーは保持する必要がある。

### When / Cubism参照操作

1. タイムラインのインジケータを frame `0` に移動する。
2. パラメータ記録を開始する。
3. 再生または記録中に、`ParamMouthOpenY` を frame `5` 付近で `0.8`、frame `10` 付近で `0.2`、frame `15` 付近で `1.0`、frame `20` 付近で `0` になるように操作する。
4. 記録を停止する。
5. `ParamMouthOpenY` のタイムラインに、操作結果に対応するキーが作成されていることを確認する。
6. `ParamAngleX` と `ParamAngleY` の既存キーが消えていないことを確認する。
7. scene を再生し、顔向きと口開閉が同時に反映されることを確認する。

### Then / Open Stack期待結果

- 手動または生成補助による時間変化を、タイムライン上の編集可能なキーとして記録できる。
- 記録対象である `ParamMouthOpenY` の変化だけが追加され、既存の顔向きキーが意図せず削除・上書きされない。
- 記録結果は、再生、修正、削除、再記録ができる通常のアニメーションキーとして扱える。
- 記録結果の密度が高すぎる場合は、編集しやすさに影響する可能性を確認できる。
- 記録したキーと既存キーを同時に再生したとき、モデル状態が時間軸上で一貫して合成される。

### 検証するACの項目

- AC-ANIM-002: タイムライン上でパラメータ変化を記録できること
- AC-ANIM-003: キーフレーム間の変化を再生できること

## SC-ANIM-005: 作成したアニメーションを外部再生可能なモーション資産として出力できる

### Given / 前提条件

- `Idle_Turn_Test` シーンに、`Avatar_A` の顔向きと口開閉のキーが設定されている。
- シーンの再生範囲は frame `0` から frame `90` までである。
- 書き出し対象には、`Avatar_A` のパラメータモーションを含める。
- 書き出し前に、不要な非表示トラックが外部利用対象に混ざらないことを確認する方針である。

### When / Cubism参照操作

1. 書き出し対象のアニメーションデータ、または `Idle_Turn_Test` シーンを選択する。
2. `[File] -> [Export Embedded File] -> [Export motion file]` を実行する。
3. Motion Data Settings で、書き出すシーンに `Idle_Turn_Test` を指定する。
4. 書き出し対象のモデルに `Avatar_A` を指定する。
5. 書き出し対象パラメータに、`ParamAngleX`, `ParamAngleY`, `ParamMouthOpenY` を含める。
6. 非表示または不要な要素が書き出し対象に入らないことを確認する。
7. `.motion3.json` として書き出す。
8. Cubism Viewer に組み込み用モデルと書き出した `.motion3.json` を読み込み、モーションを再生する。

### Then / Open Stack期待結果

- 作成したアニメーションを、ランタイムまたは外部確認環境で再生可能なモーション資産として出力できる。
- 出力結果には、選択したシーンの再生時間、対象モデル、対象パラメータの時間変化が反映される。
- 書き出し対象に含めたパラメータと含めなかったパラメータを、制作上確認できる。
- 外部確認環境で再生したとき、顔向きと口開閉の時間変化が Open Editor 上のプレビューと同じ制作意図として確認できる。
- 書き出し不可の場合は、アニメーションデータ未選択、モデル未選択、対象パラメータなし、参照切れなど、修正可能な理由を確認できる。

### 検証するACの項目

- AC-ANIM-004: モーション資産を出力できること
- AC-ANIM-005: アニメーション品質を検証できること

## SC-ANIM-006: 急変・範囲外・物理挙動との不整合を検出し、修正対象を特定できる

### Given / 前提条件

- `Avatar_A` には、顔向きパラメータ `ParamAngleX` と髪揺れに関係する物理設定が存在する。
- `Idle_Turn_Test` シーンには、`ParamAngleX` の顔向きキーが設定されている。
- frame `40` から frame `41` の間に、`ParamAngleX` が `-30` から `30` へ急変するキーを作成できる。
- 物理演算の Calculate FPS とシーンのフレームレートが異なる状態を作れる。
- 品質検証の具体的な数値閾値は未決である。

### When / Cubism参照操作

1. `ParamAngleX` に、frame `40: -30` と frame `41: 30` のキーを作成する。
2. scene を再生し、顔向きが1フレームで大きく変化することを確認する。
3. Graph Editor で `ParamAngleX` のカーブを表示し、frame `40` から frame `41` の変化量を確認する。
4. 物理設定で Calculate FPS を確認する。
5. 必要に応じて、物理演算の結果をタイムラインへベイクする。
6. scene を再生し、顔向きの急変に対して髪揺れが制作意図に合っているか確認する。
7. 問題がある場合、対象フレーム、対象パラメータ、物理設定、関連するキーを確認する。

### Then / Open Stack期待結果

- 隣接フレーム間または短時間内の大きな値変化を、急変候補として検出できる。
- パラメータ範囲外のキー値、または範囲端に張り付く不自然な動きを検出できる。
- 物理演算の計算条件とシーン再生条件が制作意図に影響し得る場合、その差異を確認できる。
- 物理ベイク後のキーと元の手付けキーを比較し、動きの破綻候補を確認できる。
- 検証結果から、対象フレーム、対象パラメータ、関連キー、関連する物理設定を修正候補として特定できる。
- 合否閾値が未設定の場合は、検出結果を警告または確認事項として扱い、確定的な失敗判定として扱わない。

### 検証するACの項目

- AC-ANIM-003: キーフレーム間の変化を再生できること
- AC-ANIM-005: アニメーション品質を検証できること

## 4. 残る設計判断

- アニメーション品質検証の閾値を、フレーム間の値差、速度、加速度、補間カーブ形状、モデル表示差分のどれで定義するか。
- `.motion3.json` を必須出力とするか、Open Editor 独自形式を中間成果物として認めるか。
- 物理演算、リップシンク、視線追従、外部アプリ連携記録のうち、`AC-ANIM` の最低受け入れ範囲に含めるものはどれか。
- 書き出し後の外部確認を、Cubism Viewer での手動確認まで求めるか、自動検証可能な再生比較まで求めるか。
