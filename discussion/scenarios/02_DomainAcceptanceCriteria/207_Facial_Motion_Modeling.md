# シナリオ: Facial Motion Modeling

> 参照元AC: [207_Facial_Motion_Modeling.md](../../acceptance-criteria/02_DomainAcceptanceCriteria/207_Facial_Motion_Modeling.md)
> 状態: 粒度確認用ドラフト

## 0. このドラフトの目的と状態

このファイルは、`AC-FACE` を「人が Cubism Editor で顔可動を作るときの操作粒度」まで降ろした場合、Undine がどの程度のシナリオを書けるかを確認するための試作である。

ここでは、Cubism Editor の画面構成を模倣することを目的にしない。ただし、Cubism Editor での参照操作を明示し、その操作によって成立している制作能力を Open Editor の検証可能な期待結果として書く。

データモデル、保存形式、API、UI コンポーネント設計はこのドラフトの範囲外である。シナリオ内の要素名、パラメータ名、表情名は、検証用フィクスチャとして正誤を判断しやすくするための具体名であり、実装上の命名規則を定義するものではない。

## 1. 公式事実

- Live2D Cubism のパラメータは、`Angle X` や `Mouth Open/Close` のような特定の動きを表す設定であり、キー間の形状は自動的に補間される。
  参照: [About Parameters](https://docs.live2d.com/en/cubism-editor-manual/parameter/)
- パラメータにキーを追加すると、変形形状をキーフォームとして登録できる。キーはパラメータパレット、編集ダイアログ、パラメータ調整ポップアップから編集でき、正確な値は数値入力で指定できる。
  参照: [Add/Delete Keys to/from parameters](https://docs.live2d.com/en/cubism-editor-manual/edit-parameters/)
- 標準パラメータリストでは、通常の閉じた目・口を `0`、通常の開いた目・口を `1` とする原則が示されている。標準例には `ParamEyeLOpen`, `ParamEyeROpen`, `ParamEyeBallX`, `ParamEyeBallY`, `ParamBrowLY`, `ParamBrowLAngle`, `ParamBrowLForm`, `ParamMouthForm`, `ParamMouthOpenY`, `ParamAngleX`, `ParamAngleY`, `ParamAngleZ` などが含まれる。
  参照: [Standard Parameter List](https://docs.live2d.com/en/cubism-editor-manual/standard-parameter-list/)
- まばたき設定では、パラメータ値そのものではなく `Eye open/close` に掛け合わせる割合を設定する。割合は `0` から `1.0` の範囲で、`0` が閉じ目、`1.0` が現在設定されている開き目の最大値である。
  参照: [Eye Blinking Setting](https://docs.live2d.com/en/cubism-editor-manual/eye-blink-settings/)
- `Eyeball X` と `Eyeball Y` は、左右・上下の視線移動を作るために `-1`, `0`, `1` のキーを設定する例が公式マニュアルにある。2つのパラメータを結合表示すると `3 x 3` の9方向キーフォームとして確認できるが、結合表示は表示方法だけを変え、設定内容には影響しない。
  参照: [Keyforms (Make X, Y Movements)](https://docs.live2d.com/en/cubism-editor-manual/keyform-xydirection/)
- 口の開閉では、変形レベル `[2]` で上口・下口に別々の変形パスを作って開閉運動を作る例が示されている。変形レベル `[3]` では閉じ口の変形用に上下の ArtMesh をまとめた変形パスを作る例が示されている。
  参照: [Level edit](https://docs.live2d.com/en/cubism-editor-manual/edit-level/)
- 公式チュートリアルには、「あいうえお」の口の作り方をサンプルデータで学ぶ教材がある。
  参照: [20分でわかる「あいうえお」](https://docs.live2d.com/cubism-editor-tutorials/mouth-aiueo/)
- リップシンクを使うには、モデル側で `Mouth open/close` の Lip-sync 設定が必要である。音声ファイルからリップシンクを適用すると、モデルの `[Lip-sync]` に音量キーフレームが追加され、音量、スケール、デフォルト値、効果を調整できる。
  参照: [Creating Scenes with Background Music and Audio](https://docs.live2d.com/en/cubism-editor-manual/generating-scene-from-audio-file/)
- 表情作成では、表情に関係する部分だけにキーフレームを打つ。顔の角度や髪揺れのような表情に無関係な領域にはキーを使わず、`mouth open/close`, `eyeball X`, `eyeball Y` のようにモーションで動く可能性があるパラメータは値の決定に注意する必要がある。
  参照: [Create Facial Expressions in Animation View](https://docs.live2d.com/en/cubism-editor-manual/create-facial-expressions/)
- Cubism Viewer では、表情用に書き出した `motion3.json` を読み込んで表情を追加し、切り替えのフェード値と表情に含まれるパラメータ値を確認できる。
  参照: [Expression Settings and Export](https://docs.live2d.com/en/cubism-editor-manual/setting-and-exporting-facial-expressions/)
- 表情値は、標準設定では別途作成したモーションのパラメータ値に差分として加算される。表情側で `Eyeball X` や `Eyeball Y` を非デフォルト値にすると、目線モーション再生時に意図しない方向を見ることがある。
  参照: [Facial Expression Mechanism](https://docs.live2d.com/4.2/en/cubism-editor-manual/facial-expression-system/)
- Cubism Editor には、オブジェクトへ割り当てられたパラメータ数を確認する `Verify Mapped Parameters` があり、通常パラメータとブレンドシェイプの割り当て数を確認できる。
  参照: [Add/Delete Keys to/from parameters](https://docs.live2d.com/en/cubism-editor-manual/edit-parameters/)

## 2. リポジトリ事実

- 参照元 AC は `discussion/acceptance-criteria/02_DomainAcceptanceCriteria/207_Facial_Motion_Modeling.md` にあり、`AC-FACE-001` から `AC-FACE-008` までを定義している。
- 本ファイルは、`discussion/scenarios/02_DomainAcceptanceCriteria/` 配下で参照元 AC と同名のシナリオファイルとして作成する。
- 粒度と見出し構成は、同階層の `204_Deformation_Control_Structure.md` を主なサンプルとしている。

## 3. 仮説・範囲外

- 公式資料は顔可動の制作手順や標準パラメータを示しているが、`AC-FACE-008` の「輪郭が破綻しない」「隠れ部分の露出が破綻しない」などを自動判定する閾値は定義していない。このドラフトでは、破綻判定を「検証可能な警告・差分として観測できること」として扱う。
- 口形状について、公式標準パラメータは `ParamMouthForm` を示しているが、母音ごとの正式パラメータIDまでは定義していない。このドラフトでは、`A`, `I`, `U`, `E`, `O` の口形状を検証用ラベルとして使う。
- シナリオ内の `FaceGuide_*`, `EyeL_*`, `Mouth_*` などの名称は、検証用モデルに置く具体名であり、Open Editor の内部データモデル名ではない。
- Cubism Editor の参照操作は公式ドキュメントに基づく実務手順として書くが、このドラフト作成時点で実機操作はしていない。

## 4. シナリオ記述方針

各シナリオは、次の3層を分けて書く。

- Given / 前提条件: 検証用モデル、対象 ArtMesh、パラメータ、表情、音声などの初期状態を書く。
- When / Cubism参照操作: 人が Cubism Editor で行う操作を、手順が再現できる粒度で書く。
- Then / Open Stack期待結果: このプロジェクトの Open Editor が、UI模倣ではなく同等の制作能力として満たすべき観測・構造・検証結果を書く。

`Then / Open Stack期待結果` では、「どの情報を観測できれば正誤を判断できるか」を書く。具体的な保存形式、API名、UI部品名、内部データ構造は定義しない。

## SC-FACE-001: 左右の目に開眼・半目・閉眼の状態を定義できる

### Given / 前提条件

- 既存モデルが読み込まれている。
- 左目に相当する ArtMesh `EyeL_Lash`, `EyeL_White`, `EyeL_Iris`, `EyeL_Highlight` が存在する。
- 右目に相当する ArtMesh `EyeR_Lash`, `EyeR_White`, `EyeR_Iris`, `EyeR_Highlight` が存在する。
- 左右の目に対して、開閉パラメータ `ParamEyeLOpen`, `ParamEyeROpen` を設定できる。
- 目の閉じ時に瞳が露出しないよう、白目またはまぶたに相当するクリッピング・隠蔽関係を確認できる。

### When / Cubism参照操作

1. 目以外のパーツをロックする。
2. `EyeL_Lash`, `EyeL_White`, `EyeL_Iris`, `EyeL_Highlight` を選択する。
3. `ParamEyeLOpen` に `0`, `0.5`, `1` のキーを追加する。
4. `ParamEyeLOpen = 1` で通常の開眼形状を確認する。
5. `ParamEyeLOpen = 0.5` で上まぶたを下げ、半目として読める形状に調整する。
6. `ParamEyeLOpen = 0` で上まぶたと下まぶたが閉じ、瞳とハイライトが不自然に露出しない形状に調整する。
7. `ParamEyeLOpen` を `0` から `1` までゆっくり動かし、中間でまぶたや白目が反転しないことを確認する。
8. 右目でも同じ手順を `ParamEyeROpen` に対して行う。

### Then / Open Stack期待結果

- 左右の目について、開眼、半目、閉眼の状態を独立に定義できる。
- `ParamEyeLOpen` と `ParamEyeROpen` は、`0` が閉眼、`1` が通常開眼として観測できる。
- 中間値 `0.5` では、閉眼と開眼の単純な切り替えではなく、半目として判断できる形状が観測できる。
- 閉眼時に `EyeL_Iris`, `EyeR_Iris`, `EyeL_Highlight`, `EyeR_Highlight` がまぶた外へ不自然に露出しない。
- `0`, `0.25`, `0.5`, `0.75`, `1` の確認点で、まぶた形状の反転、白目の過剰露出、瞳の飛び出しを警告として検出できる。
- 操作結果として、対象の左右、対象 ArtMesh、開閉値、登録済みキーフォーム、警告有無を構造化して取得できる。

### 検証するACの項目

- AC-FACE-001: 目の開閉を定義できること
- AC-FACE-008: 顔可動の整合性を検証できること

## SC-FACE-002: まばたき制御を目の開閉演技に重ねられる

### Given / 前提条件

- `ParamEyeLOpen`, `ParamEyeROpen` に開閉キーフォームが設定済みである。
- 目の開閉値が `0.8` のように、完全開眼ではない演技状態を作れる。
- まばたき制御を有効にする設定を確認できる。

### When / Cubism参照操作

1. モデルワークスペースで `Settings for Eye Blinking and Lip-sync` を開く。
2. 左右の目の開閉パラメータをまばたき対象として設定する。
3. アニメーション側で、目の開閉演技として `ParamEyeLOpen = 0.8`, `ParamEyeROpen = 0.8` の状態を用意する。
4. まばたきの割合を `1.0`, `0`, `1.0` の順に変化させる。
5. まばたきの効果が `0` のときは無効、`100` のときは有効になることを確認する。

### Then / Open Stack期待結果

- 目の開閉演技と、まばたき用の割合制御を区別して定義できる。
- まばたき割合 `1.0` では、現在の目の開閉演技値を保つ。
- まばたき割合 `0` では、現在の目の開閉演技が完全開眼でなくても閉眼状態になる。
- まばたき効果を無効化した場合、目の開閉演技だけが残る。
- まばたき制御が左右の目へ適用される対象と、適用されない対象を説明できる。
- 操作結果として、対象パラメータ、現在の開閉演技値、まばたき割合、効果、乗算後の評価値を取得できる。

### 検証するACの項目

- AC-FACE-001: 目の開閉を定義できること
- AC-FACE-008: 顔可動の整合性を検証できること

## SC-FACE-003: 視線を左右・上下・斜めの9方向へ移動できる

### Given / 前提条件

- 左右の瞳に相当する ArtMesh または瞳位置用デフォーマ `EyeL_Iris`, `EyeR_Iris`, `Warp_EyeL_Position`, `Warp_EyeR_Position` が存在する。
- 視線移動用パラメータ `ParamEyeBallX`, `ParamEyeBallY` を設定できる。
- 白目または目の開口範囲によって、瞳の可視範囲を確認できる。

### When / Cubism参照操作

1. `Warp_EyeL_Position` を選択する。
2. `ParamEyeBallX` に `-1`, `0`, `1` のキーを追加する。
3. `ParamEyeBallX = 1` で瞳を画面右方向へ移動する。
4. `ParamEyeBallX = -1` で瞳を画面左方向へ移動する。
5. `ParamEyeBallY` に `-1`, `0`, `1` のキーを追加する。
6. `ParamEyeBallY = 1` で瞳を上方向へ移動し、`ParamEyeBallY = -1` で下方向へ移動する。
7. `ParamEyeBallX` と `ParamEyeBallY` を結合表示し、中央を含む9方向のキーフォームを確認する。
8. 右目にも同じ視線移動を設定し、左右の瞳が同じ方向を向くことを確認する。

### Then / Open Stack期待結果

- 視線方向を、左右、上下、中央、斜め4方向を含む9方向として定義できる。
- `ParamEyeBallX` と `ParamEyeBallY` の組み合わせごとに、瞳位置の評価結果を確認できる。
- 左右の瞳が同じ方向へ動くか、意図して寄り目・離れ目になるかを区別できる。
- 各方向で瞳とハイライトが白目または目の開口範囲から不自然に外へ出ない。
- 目を半目または閉眼に近づけた状態でも、瞳がまぶた外へ露出する組み合わせを警告として検出できる。
- 操作結果として、視線方向、左右瞳の位置、目の開閉値との組み合わせ、露出警告有無を取得できる。

### 検証するACの項目

- AC-FACE-002: 視線・瞳移動を定義できること
- AC-FACE-008: 顔可動の整合性を検証できること

## SC-FACE-004: 眉の上下・傾き・形状変化で怒りと驚きを作れる

### Given / 前提条件

- 左眉 `BrowL` と右眉 `BrowR` に相当する ArtMesh が存在する。
- 眉の上下、傾き、形状変化に相当するパラメータを設定できる。
- 検証用の表情ラベルとして `Angry`, `Surprise`, `Troubled` を使う。

### When / Cubism参照操作

1. 眉以外のパーツをロックする。
2. `BrowL` を選択し、`ParamBrowLY` に `-1`, `0`, `1` のキーを追加する。
3. `ParamBrowLY = 1` で眉を上げ、`ParamBrowLY = -1` で眉を下げる。
4. `ParamBrowLAngle` に `-1`, `0`, `1` のキーを追加する。
5. `ParamBrowLAngle = -1` で怒りとして読める傾きを作る。
6. `ParamBrowLForm` に `-1`, `0`, `1` のキーを追加し、困り眉や驚き眉として読める変形を作る。
7. 右眉でも左右の向きを考慮して同等の設定を行う。
8. 左右の眉パラメータを組み合わせ、怒り、驚き、困りの表情として破綻しないことを確認する。

### Then / Open Stack期待結果

- 眉の上下、傾き、形状変化を別々の関心として定義できる。
- 左眉と右眉で、左右対称に動く設定と非対称に動く設定を区別できる。
- `Angry`, `Surprise`, `Troubled` の各表情で、眉の位置、角度、形状が期待ラベルと矛盾しない。
- 眉が目や髪に不自然にめり込む、または顔輪郭から外れる組み合わせを警告として検出できる。
- 操作結果として、眉対象、上下値、角度値、形状値、表情ラベル、左右差、警告有無を取得できる。

### 検証するACの項目

- AC-FACE-003: 眉の可動を定義できること
- AC-FACE-006: 表情状態を定義できること
- AC-FACE-008: 顔可動の整合性を検証できること

## SC-FACE-005: 口の閉口・半開き・開口を定義できる

### Given / 前提条件

- 口の上側 `Mouth_Upper`, 下側 `Mouth_Lower`, 口内 `Mouth_Inside`, 歯または舌 `Mouth_Teeth`, `Mouth_Tongue` に相当する要素が存在する。
- 口の開閉パラメータ `ParamMouthOpenY` を設定できる。
- 口内要素が口の外へ露出するかを確認できる。

### When / Cubism参照操作

1. 口以外のパーツをロックする。
2. `Mouth_Upper`, `Mouth_Lower`, `Mouth_Inside` を選択する。
3. `ParamMouthOpenY` に `0`, `0.5`, `1` のキーを追加する。
4. `ParamMouthOpenY = 0` で閉口形状を作る。
5. `ParamMouthOpenY = 0.5` で半開き形状を作る。
6. `ParamMouthOpenY = 1` で通常の開口形状を作る。
7. 変形パスや頂点を調整し、閉口時に口内、歯、舌が肌色領域や唇線の外へはみ出さないようにする。
8. `ParamMouthOpenY` を `0` から `1` まで動かし、中間値で唇線がつぶれたり反転したりしないことを確認する。

### Then / Open Stack期待結果

- 口の閉口、半開き、開口を、連続した開閉状態として定義できる。
- `ParamMouthOpenY = 0` は閉口、`ParamMouthOpenY = 1` は通常開口として観測できる。
- `ParamMouthOpenY = 0.5` では、閉口と開口の中間として自然な半開き形状を観測できる。
- 閉口時に `Mouth_Inside`, `Mouth_Teeth`, `Mouth_Tongue` が不自然に露出しない。
- 中間値で上唇、下唇、口内の位置関係が破綻しない。
- 操作結果として、開閉値、対象要素、口内露出、唇線の交差、反転警告有無を取得できる。

### 検証するACの項目

- AC-FACE-004: 口の開閉を定義できること
- AC-FACE-008: 顔可動の整合性を検証できること

## SC-FACE-006: 発話用の「あいうえお」口形状を切り替えられる

### Given / 前提条件

- 口の開閉シナリオ `SC-FACE-005` 相当の口要素が存在する。
- 発話表現として `A`, `I`, `U`, `E`, `O` の口形状を検証用ラベルとして扱う方針がある。
- 口の開閉量と口形状を組み合わせて確認できる。

### When / Cubism参照操作

1. `Mouth_Upper`, `Mouth_Lower`, `Mouth_Inside`, `Mouth_Teeth`, `Mouth_Tongue` を選択する。
2. 口形状用のパラメータまたはキーフォーム編集対象を選択する。
3. `A` 形状として、縦に開いた口を作る。
4. `I` 形状として、横に引かれた浅い口を作る。
5. `U` 形状として、すぼめた口を作る。
6. `E` 形状として、横幅と開きのある口を作る。
7. `O` 形状として、丸く開いた口を作る。
8. 各口形状を、`ParamMouthOpenY = 0.25`, `0.5`, `1` の開閉量と組み合わせて確認する。

### Then / Open Stack期待結果

- 発話表現に対応する複数の口形状を、口の開閉量とは別の関心として定義できる。
- `A`, `I`, `U`, `E`, `O` の各形状が、同じ開閉量でも見分けられる。
- 口形状を切り替えても、閉口時の口内隠蔽や開口時の唇線整合が保たれる。
- 口形状と開閉量の組み合わせで、口内、歯、舌、唇線が反転または過剰露出する状態を警告として検出できる。
- 操作結果として、口形状ラベル、開閉量、対象要素、形状差分、露出警告有無を取得できる。

### 検証するACの項目

- AC-FACE-004: 口の開閉を定義できること
- AC-FACE-005: 口形状を定義できること
- AC-FACE-008: 顔可動の整合性を検証できること

## SC-FACE-007: 音声リップシンクで口の開閉を生成し、口形状と衝突しない

### Given / 前提条件

- `ParamMouthOpenY` に口の開閉状態が設定済みである。
- 口形状 `A`, `I`, `U`, `E`, `O` のいずれかを選択できる。
- 検証用の WAV 音声 `voice_aiueo.wav` が用意されている。
- モデルに Lip-sync 設定を追加できる。

### When / Cubism参照操作

1. モデルワークスペースで `Settings for Eye Blinking and Lip-sync` を開く。
2. `Mouth open/close` の Lip-sync チェックを有効にして保存する。
3. アニメーションワークスペースでモデルを再読み込みする。
4. `voice_aiueo.wav` をタイムラインに配置する。
5. `[Animation] -> [Apply Lip-sync from the Audio File]` を実行する。
6. `[Lip-sync]` に音量キーフレームが追加されることを確認する。
7. 音量、スケール、デフォルト値、効果を調整し、口の開閉量が音声に追従することを確認する。
8. 口形状を `A`, `I`, `U`, `E`, `O` のいずれかへ切り替えた状態で、リップシンク由来の開閉が破綻しないことを確認する。

### Then / Open Stack期待結果

- 音声入力から口の開閉量を生成し、既存の口開閉状態へ反映できる。
- Lip-sync 設定が不足している場合、生成前に不足設定を警告として提示できる。
- 音量が小さい音声に対して、スケールやデフォルト値の調整によって口の開閉範囲を制御できる。
- リップシンク由来の開閉量は、口形状 `A`, `I`, `U`, `E`, `O` を上書きせず、組み合わせとして評価できる。
- 音声の無音区間で口が開き続ける、または音量ピークで口が過剰に破綻する状態を警告として検出できる。
- 操作結果として、音声範囲、生成された開閉カーブ、スケール、デフォルト値、効果、口形状との組み合わせ警告を取得できる。

### 検証するACの項目

- AC-FACE-004: 口の開閉を定義できること
- AC-FACE-005: 口形状を定義できること
- AC-FACE-008: 顔可動の整合性を検証できること

## SC-FACE-008: 笑顔・怒り・困り・驚きの表情状態を切り替えられる

### Given / 前提条件

- 目、眉、口、頬に相当する顔要素が存在する。
- 表情ラベル `Smile`, `Angry`, `Troubled`, `Surprise` を作成できる。
- 目線、口開閉、顔向きのようにモーション側でも動くパラメータを識別できる。

### When / Cubism参照操作

1. アニメーションビューで表情用シーンを作成する。
2. 表情に関係する目、眉、口、頬のパラメータだけにキーを打つ。
3. `Smile` では、目の笑み、眉の緩み、口角上げを設定する。
4. `Angry` では、眉の傾き、目の細め、口形状の緊張を設定する。
5. `Troubled` では、眉の困り形状、口の弱い開きまたは下がりを設定する。
6. `Surprise` では、目の見開き、眉上げ、口の開きを設定する。
7. 顔角度、髪揺れ、通常の視線移動など、表情に無関係なパラメータへ不要なキーを打っていないことを確認する。
8. 表情用 `motion3.json` を Cubism Viewer に読み込み、表情フォルダ、フェード値、表情内パラメータ値を確認する。

### Then / Open Stack期待結果

- `Smile`, `Angry`, `Troubled`, `Surprise` の表情状態を定義し、切り替えられる。
- 各表情は、目、眉、口、頬など表情に関係する対象の変化として説明できる。
- 表情に無関係な顔向き、髪揺れ、身体パラメータが混入した場合、意図確認が必要な警告として扱える。
- 表情切り替え時に、フェードまたは遷移幅に相当する切り替え挙動を確認できる。
- 目線や口開閉のようなモーション側パラメータと表情差分が衝突する可能性を検出できる。
- 操作結果として、表情名、対象パラメータ、表情値、標準値との差分、切り替え設定、混入警告を取得できる。

### 検証するACの項目

- AC-FACE-006: 表情状態を定義できること
- AC-FACE-008: 顔可動の整合性を検証できること

## SC-FACE-009: 顔の左右・上下・傾きを定義し、顔部品が追従する

### Given / 前提条件

- 顔輪郭 `Face_Outline`, 鼻 `Nose`, 左右の目、左右の眉、口に相当する要素が存在する。
- 顔向きパラメータ `ParamAngleX`, `ParamAngleY`, `ParamAngleZ` を設定できる。
- 顔向きによって隠れる側の輪郭、目、口端、髪際を確認できる。

### When / Cubism参照操作

1. 顔全体の大域変形対象を選択する。
2. `ParamAngleX` に `-30`, `0`, `30` のキーを追加する。
3. `ParamAngleX = -30` と `30` で、顔を左右に向けた形状を作る。
4. `ParamAngleY` に `-30`, `0`, `30` のキーを追加する。
5. `ParamAngleY = -30` と `30` で、顔を上下に向けた形状を作る。
6. `ParamAngleX` と `ParamAngleY` を組み合わせ、中央を含む9方向を確認する。
7. `ParamAngleZ` に `-30`, `0`, `30` のキーを追加し、顔の傾きを作る。
8. 顔向きごとに、目、鼻、口、眉、輪郭、髪際の位置関係が自然に追従することを確認する。

### Then / Open Stack期待結果

- 顔の左右、上下、傾きを別々に定義できる。
- `ParamAngleX`, `ParamAngleY`, `ParamAngleZ` の組み合わせに対して、顔全体の評価結果を確認できる。
- 顔向きが変わったとき、目、鼻、口、眉が顔輪郭に対して一貫した位置へ移動する。
- 隠れる側の目、口端、輪郭、髪際が、顔向きに反して過剰に露出しない。
- 顔向きの中間値で、輪郭のつぶれ、パーツの置き去り、左右反転、描画順の破綻を警告として検出できる。
- 操作結果として、顔向き値、対象部品、相対位置、隠蔽状態、描画順警告、中間値警告を取得できる。

### 検証するACの項目

- AC-FACE-007: 顔の向きを定義できること
- AC-FACE-008: 顔可動の整合性を検証できること

## SC-FACE-010: 顔可動の複合状態を検証できる

### Given / 前提条件

- `SC-FACE-001` から `SC-FACE-009` 相当の目、視線、眉、口、表情、顔向きが設定済みである。
- 検証対象として、複数パラメータが同時に動く状態を作れる。
- 検証用の代表組み合わせとして `Smile + Blink`, `Angry + LookLeft`, `Surprise + MouthOpen`, `FaceRight + LookCenter`, `FaceUp + MouthO` が用意されている。

### When / Cubism参照操作

1. `Verify Mapped Parameters` で、顔要素に割り当てられた通常パラメータとブレンドシェイプ数を確認する。
2. 目の開閉、視線、眉、口開閉、口形状、表情、顔向きを1つずつ動かし、単独では破綻しないことを確認する。
3. 代表組み合わせ `Smile + Blink`, `Angry + LookLeft`, `Surprise + MouthOpen`, `FaceRight + LookCenter`, `FaceUp + MouthO` を作る。
4. 各組み合わせについて、最小値、最大値、中間値をスクラブする。
5. 輪郭、目、鼻、口、眉、髪際、隠れ部分、描画順を確認する。
6. パラメータの中間値で、潰れ、反転、過剰露出、部品の置き去りが起きないか確認する。

### Then / Open Stack期待結果

- 顔可動を単独状態だけでなく、複数パラメータの組み合わせとして検証できる。
- 輪郭が破綻する組み合わせを警告として検出できる。
- 目、鼻、口、眉の位置関係が顔向きと矛盾する組み合わせを警告として検出できる。
- 隠れるはずの部分が露出する組み合わせを警告として検出できる。
- 髪や顔周辺パーツとの前後関係が破綻する組み合わせを警告として検出できる。
- 中間値で不自然な潰れ、反転、跳ね、急な表示切り替えが起きる組み合わせを警告として検出できる。
- 操作結果として、検証した組み合わせ、問題種別、対象部品、問題が発生するパラメータ値、修正対象候補を取得できる。

### 検証するACの項目

- AC-FACE-001: 目の開閉を定義できること
- AC-FACE-002: 視線・瞳移動を定義できること
- AC-FACE-003: 眉の可動を定義できること
- AC-FACE-004: 口の開閉を定義できること
- AC-FACE-005: 口形状を定義できること
- AC-FACE-006: 表情状態を定義できること
- AC-FACE-007: 顔の向きを定義できること
- AC-FACE-008: 顔可動の整合性を検証できること
