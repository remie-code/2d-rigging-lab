# シナリオ: Part, Visibility, and Composition Semantics

> 参照元AC: [206_Part_Visibility_and_Composition_Semantics.md](../../acceptance-criteria/02_DomainAcceptanceCriteria/206_Part_Visibility_and_Composition_Semantics.md)
> 状態: シナリオ精緻化ドラフト

## 0. このドラフトの目的

このファイルは、`AC-PART` を「人が Cubism Editor でパーツ、表示状態、差し替え、合成状態を設定・確認するときの操作粒度」まで降ろし、Open Editor が同等の制作能力として満たすべき結果を検証可能にするためのドラフトである。

ここでは、Cubism Editor のパレット構成や保存形式を模倣することを目的にしない。ただし、Cubism Editor での参照操作を明示し、その操作によって成立している制作能力を Open Editor の観測可能な期待結果として書く。データモデル、API、ファイルI/Fの設計はこのファイルの範囲外とする。

## 1. 公式事実

- Live2D Cubism の「パーツ」は、目、鼻などキャラクター構成要素ごとのグループ単位であり、フォルダとして多階層にできる。同じパーツに ArtMesh やデフォーマを所属させると、パーツ単位の表示、ロック、選択などを扱いやすくなる。組み込み時にも、表示などの機能はパーツIDで制御される。
  参照: [About Parts](https://docs.live2d.com/en/cubism-editor-manual/parts/)
- Parts palette は、パーツ分類によるオブジェクト管理、選択、表示、ロック、所属確認に使われる。新規パーツ作成時には名前、Part ID、描画順、選択オブジェクトを子に入れるかを指定できる。パーツパレット上でドラッグ&ドロップすると、パレット順や所属パーツを変更できる。
  参照: [Parts palette](https://docs.live2d.com/en/cubism-editor-manual/partspalatte/)
- Parts palette 上の順序を変更しても、描画順の値が優先されるため通常はキャンバス表示は変わらない。ただし ArtMesh の描画順が同じ場合は、Parts palette の上にあるものが前面に表示される。
  参照: [Parts palette](https://docs.live2d.com/en/cubism-editor-manual/partspalatte/), [About Draw Order](https://docs.live2d.com/en/cubism-editor-manual/draworder/)
- Inspector palette では、ArtMesh の ID、所属パーツ、所属デフォーマ、クリッピングID、描画順、不透明度、乗算色、スクリーン色、Color blend、Alpha blend などを変更できる。
  参照: [Inspector palette](https://docs.live2d.com/en/cubism-editor-manual/inspector-palette/)
- 描画順は ArtMesh や ArtPath などの Drawable Object の重なり順を表し、値は `0` から `1000` で、高い値ほど前面に表示される。描画順はパラメータに割り当てて変化させることもでき、複数オブジェクトをパーツ単位で制御する Draw Order Group もある。
  参照: [About Draw Order](https://docs.live2d.com/en/cubism-editor-manual/draworder/)
- Clipping Mask は、マスクとして使う ArtMesh の ID を、切り抜かれる ArtMesh の Clipping ID に指定して設定する。複数の ArtMesh ID はカンマ区切りで指定でき、クリッピング関係からマスク側または被クリップ側を選択できる。SDK利用時はマスク数や描画結果に制約があり、実機確認が必要になる場合がある。
  参照: [Clipping Mask](https://docs.live2d.com/en/cubism-editor-manual/clipping-mask/)
- Blend mode はオブジェクトの合成に関する機能で、ArtMesh と、Offscreen drawing が有効な Part に設定できる。Color blend は RGB の合成、Alpha blend はアルファの合成を扱う。Alpha blend を設定する対象は Offscreen drawing が有効なパーツ内に置く想定であり、そのパーツ内では、Blend mode が設定されたオブジェクトより描画順が低い全オブジェクトに影響する。
  参照: [Blend mode](https://docs.live2d.com/en/cubism-editor-manual/blend-mode/)
- Offscreen drawing は、パーツ内の複数オブジェクトを一度メモリ上に描画してからキャンバスへ転送する機能で、複数オブジェクト全体の不透明度変更、全体クリッピング、乗算色・スクリーン色、Blend mode 適用などを可能にする。Offscreen drawing は Part に設定され、有効にすると Draw Order Group も有効になる。
  参照: [Offscreen drawing](https://docs.live2d.com/en/cubism-editor-manual/offscreen-drawing/)
- Pose Settings は、モデルやモーションで作成した腕などの切り替え機構を `pose3.json` に反映するための設定である。複数パーツを同じグループ番号に入れると、そのグループでは1つのパーツだけが表示される。アニメーションデータ内の `Live2D Parts Visibility` は Step カーブが推奨され、異なるカーブでは意図しない動きになる可能性がある。
  参照: [Pose Settings](https://docs.live2d.com/en/cubism-editor-manual/pose-setting/)
- ポーズ切り替えを作るには、切り替え対象パーツをモデルデータ上で分け、アニメーション側で表示対象に `100`、非表示対象に `0` のキーを入れる。MOC3 書き出し時には、切り替え対象パーツをすべて表示しておくか、Export Hidden Parts を有効にしないと、正しく切り替えられない。
  参照: [Create Motion with Pose Switching](https://docs.live2d.com/en/cubism-editor-manual/change-pose/)
- 組み込み用データでは、`.moc3` がアプリケーションで使うモデル実体であり、`.model3.json` は MOC3 やテクスチャ等を関連付けるJSONである。書き出し設定には hidden parts、hidden ArtMesh、表示情報ファイル `.cdi3.json` などの出力項目がある。
  参照: [Data for Embedded Use](https://docs.live2d.com/en/cubism-editor-manual/export-moc3-motion3-files/), [File Types and Extensions](https://docs.live2d.com/en/cubism-editor-manual/file-type-and-extension/)

## 2. 仮説

- Open Editor がどのような内部データ構造、操作API、保存形式を採用するかは未決である。このファイルでは、ユーザーが観測できる制作結果、検証結果、プレビュー差分、エクスポート後の再現性だけを期待結果として扱う。
- 公式ドキュメントは Cubism Editor / Viewer / SDK の具体操作と制約を説明しているが、Open Editor における自然言語操作、検証レポート、差分説明の形式は定義していない。そのため、AI-native 期待結果の表現は、このプロジェクト上の検証可能な能力としての仮説である。
- 「ランタイム再現性」は、Cubism SDK 互換の完全な内部形式を要求する意味ではなく、書き出し後に表示、差し替え、合成が制作意図と一致して確認できることを指す仮説として扱う。

## 3. シナリオ記述方針

各シナリオは Given-When-Then の3層で書く。

- Given / 前提条件: モデル内に存在するパーツ、ArtMesh、デフォーマ、表示状態、差し替え候補などを具体名で書く
- When / Cubism参照操作: 人が Cubism Editor または Viewer で行う実務操作を、再現できる粒度で書く
- Then / Open Stack期待結果: このプロジェクトの Open Editor が、UI模倣ではなく同等の制作能力として満たすべき観測、プレビュー、検証、出力結果を書く

期待結果では、パーツID、ArtMesh名、表示状態、不透明度、描画順、クリッピング関係、Offscreen drawing、Blend mode、ポーズ切り替えの結果を検証可能な対象として扱う。一方で、内部データモデル、API名、永続化スキーマ、ファイルレイアウトは定義しない。

## SC-PART-001: 目の構成要素をパーツ階層にまとめ、所属と表示対象を確認できる

### Given / 前提条件

- 既存モデルが読み込まれている。
- 左目に相当する ArtMesh `EyeL_White`, `EyeL_Iris`, `EyeL_Highlight`, `EyeL_Line` が存在する。
- 左目まばたき用デフォーマ `Warp_EyeL_Blink` が存在する。
- これらの要素は、まだ左目専用パーツにまとまっていない。
- 親パーツ `Head` が存在する。

### When / Cubism参照操作

1. `EyeL_White`, `EyeL_Iris`, `EyeL_Highlight`, `EyeL_Line`, `Warp_EyeL_Blink` を選択する。
2. Parts palette の `[New Part]` から新規パーツを作成する。
3. 名前に `Eye Left`、Part ID に `Part_Eye_L` を指定する。
4. 作成時に、選択オブジェクトを新規パーツの子に入れる設定を有効にする。
5. 作成された `Part_Eye_L` を親パーツ `Head` の配下へ移動する。
6. Parts palette で `Part_Eye_L` を展開し、左目の ArtMesh とデフォーマが同じパーツ配下にあることを確認する。
7. `Part_Eye_L` の選択、展開、表示切り替えが左目要素に対してまとめて効くことを確認する。

### Then / Open Stack期待結果

- `Part_Eye_L` が、目の構成要素をまとめるパーツとして観測できる。
- `Part_Eye_L` は、`Head` 配下の多階層パーツとして扱える。
- `EyeL_White`, `EyeL_Iris`, `EyeL_Highlight`, `EyeL_Line`, `Warp_EyeL_Blink` が `Part_Eye_L` に所属していることを確認できる。
- パーツ作成・移動によって、意図していない描画順変更、クリッピング変更、デフォーマ親子変更は発生しない。
- 操作後に、パーツ階層、所属要素、表示対象範囲、描画に影響した変更の有無を説明できる。

### 検証するACの項目

- AC-PART-001: パーツ構造を管理できること
- AC-PART-002: パーツ単位の表示状態を制御できること

## SC-PART-002: アクセサリをパーツ単位で表示・非表示にし、子ArtMeshの不透明度を調整できる

### Given / 前提条件

- 既存モデルが読み込まれている。
- メガネ用パーツ `Part_Glasses` が存在する。
- `Part_Glasses` には ArtMesh `Glasses_Frame`, `Glasses_Lens_L`, `Glasses_Lens_R`, `Glasses_Highlight` が所属している。
- `Glasses_Frame` は不透明度 `100%`、`Glasses_Lens_L` と `Glasses_Lens_R` は不透明度 `40%` で表示されている。

### When / Cubism参照操作

1. Parts palette で `Part_Glasses` の表示状態をオフにする。
2. キャンバス上で、フレーム、レンズ、ハイライトがまとめて見えなくなることを確認する。
3. `Part_Glasses` の表示状態をオンに戻す。
4. `Glasses_Lens_L` と `Glasses_Lens_R` を選択する。
5. Inspector palette で不透明度を `25%` に変更する。
6. `Glasses_Frame` の不透明度は `100%` のまま、レンズだけが薄くなることを確認する。

### Then / Open Stack期待結果

- `Part_Glasses` を非表示にしたとき、所属するフレーム、レンズ、ハイライトがプレビュー上でまとめて非表示になる。
- `Part_Glasses` を再表示したとき、所属要素が再び描画対象になる。
- 子ArtMesh単位の不透明度変更により、`Glasses_Lens_L` と `Glasses_Lens_R` だけが `25%` 相当の見た目になる。
- パーツ単位の表示状態と ArtMesh 単位の不透明度が混同されず、それぞれ独立した操作結果として確認できる。
- 操作後に、非表示対象、再表示対象、不透明度変更対象、変更されなかった対象を説明できる。

### 検証するACの項目

- AC-PART-002: パーツ単位の表示状態を制御できること

## SC-PART-003: 描画順とパーツパレット順の関係を保ったまま前後関係を調整できる

### Given / 前提条件

- 既存モデルが読み込まれている。
- 顔パーツ `Part_Face` に ArtMesh `Face_Base` が存在し、描画順は `500` である。
- 前髪パーツ `Part_HairFront` に ArtMesh `HairFront_Main` が存在し、描画順は `700` である。
- 口パーツ `Part_Mouth` に ArtMesh `Mouth_Line` と `Mouth_Shadow` が存在し、どちらも描画順は `610` である。
- Parts palette 上では、`Mouth_Line` が `Mouth_Shadow` より上に並んでいる。

### When / Cubism参照操作

1. キャンバスで `HairFront_Main` が `Face_Base` より前面に表示されていることを確認する。
2. Parts palette 上で `Part_HairFront` を `Part_Face` より下へ移動する。
3. 描画順が変わっていなければ、`HairFront_Main` が引き続き `Face_Base` より前面に表示されることを確認する。
4. `Mouth_Line` と `Mouth_Shadow` の描画順が同じ `610` であることを確認する。
5. Parts palette 上で `Mouth_Shadow` を `Mouth_Line` より上へ移動する。
6. 同じ描画順の範囲では、Parts palette の順序変更によって前後関係が変わることを確認する。

### Then / Open Stack期待結果

- 描画順の数値が異なる場合、パーツパレット上の整理順よりも描画順が優先される。
- `HairFront_Main` と `Face_Base` の前後関係は、Parts palette 上の移動だけでは変わらない。
- 同じ描画順を持つ `Mouth_Line` と `Mouth_Shadow` では、Parts palette 上の順序が前後関係へ影響する。
- パーツ整理のための移動と、実際の描画前後関係を変える操作を区別して説明できる。
- 操作後に、描画順値、パレット順、前面に出る対象、見た目が変わった理由を検証できる。

### 検証するACの項目

- AC-PART-001: パーツ構造を管理できること
- AC-PART-002: パーツ単位の表示状態を制御できること
- AC-PART-004: 表示状態のランタイム再現性を保持できること

## SC-PART-004: 目のハイライトと黒目を白目ArtMeshでクリッピングし、マスク関係を確認できる

### Given / 前提条件

- 既存モデルが読み込まれている。
- 左目用 ArtMesh `EyeL_White`, `EyeL_Iris`, `EyeL_Highlight_1`, `EyeL_Highlight_2` が存在する。
- `EyeL_Iris`, `EyeL_Highlight_1`, `EyeL_Highlight_2` は、まだ `EyeL_White` による Clipping Mask を持っていない。
- `EyeL_Iris` と `EyeL_Highlight_*` は、白目の外側へはみ出して見える状態を作れる。

### When / Cubism参照操作

1. Inspector palette で `EyeL_White` の ID を確認してコピーする。
2. `EyeL_Iris`, `EyeL_Highlight_1`, `EyeL_Highlight_2` を選択する。
3. Inspector palette の Clipping ID に `EyeL_White` の ID を指定する。
4. キャンバス上で、黒目とハイライトが白目の形状内に切り抜かれることを確認する。
5. `EyeL_Iris` を選択し、Clipping ID からマスク側の ArtMesh を選択できることを確認する。
6. `EyeL_White` を選択し、Reverse Clipping で `EyeL_White` をマスクとして使っている ArtMesh を確認する。

### Then / Open Stack期待結果

- `EyeL_Iris`, `EyeL_Highlight_1`, `EyeL_Highlight_2` が `EyeL_White` をマスクとして切り抜かれる。
- 黒目やハイライトを白目外へ移動しても、表示される範囲はマスク形状内に制限される。
- マスク側から被クリップ対象を確認でき、被クリップ対象側からマスクを確認できる。
- クリッピング関係は、単なるパーツ所属や表示オン/オフとは別の合成関係として説明できる。
- SDK利用を想定する場合、マスク数やマスク状態に関する警告があれば、制作時に確認すべき事項として提示できる。

### 検証するACの項目

- AC-PART-002: パーツ単位の表示状態を制御できること
- AC-PART-004: 表示状態のランタイム再現性を保持できること

## SC-PART-005: Offscreen drawing を使って頬染めパーツ全体の合成をまとめて調整できる

### Given / 前提条件

- 既存モデルが読み込まれている。
- 頬染め用パーツ `Part_CheekBlush` が存在する。
- `Part_CheekBlush` には ArtMesh `Cheek_L_Base`, `Cheek_R_Base`, `Cheek_Sparkle` が所属している。
- 頬染め全体を、顔の上にまとめて薄く重ねたい制作意図がある。
- `Cheek_L_Base` と `Cheek_R_Base` は通常合成、`Cheek_Sparkle` は明るく見せる合成を使いたい。

### When / Cubism参照操作

1. `Part_CheekBlush` を選択する。
2. Inspector palette で `Part_CheekBlush` の Offscreen drawing を有効にする。
3. Offscreen drawing の不透明度を `70%` に設定する。
4. `Cheek_Sparkle` の Color blend を `Screen` または同等の明るく合成する設定にする。
5. キャンバス上で、頬染めパーツ内の複数 ArtMesh が一度まとまった見た目として顔に重なることを確認する。
6. Model statistics または同等の確認手段で、Offscreen drawing の利用箇所が増えたことを確認する。

### Then / Open Stack期待結果

- `Part_CheekBlush` 配下の複数 ArtMesh が、パーツ全体としてまとめて合成される。
- パーツ全体の不透明度変更により、頬染め全体が `70%` 相当で顔に重なる。
- `Cheek_Sparkle` の合成設定は、頬染めパーツ内の合成結果として確認できる。
- Offscreen drawing を有効にしたことで、単体 ArtMesh の不透明度変更とは異なる、パーツ全体の合成操作として説明できる。
- 描画負荷や高度な合成モードの利用は、制作上の警告または確認事項として提示できる。

### 検証するACの項目

- AC-PART-002: パーツ単位の表示状態を制御できること
- AC-PART-004: 表示状態のランタイム再現性を保持できること

## SC-PART-006: 腕差分をポーズ切り替えとして扱い、同時表示されない構成を検証できる

### Given / 前提条件

- 既存モデルが読み込まれている。
- 左腕差分パーツ `Part_ArmL_A` と `Part_ArmL_B` が存在する。
- 右腕差分パーツ `Part_ArmR_A` と `Part_ArmR_B` が存在する。
- `Part_ArmL_A` と `Part_ArmR_A` は通常腕、`Part_ArmL_B` と `Part_ArmR_B` は別ポーズ腕である。
- 腕Aと腕Bが同時に完全表示されると、肩や肘の重なりが破綻する。

### When / Cubism参照操作

1. モデルデータ上で、腕Aと腕Bを切り替え対象として別パーツに分ける。
2. Animation View の Model Track で `Live2D Parts Visibility` を開く。
3. 腕Aを表示するフレームでは、`Part_ArmL_A` と `Part_ArmR_A` に `100`、`Part_ArmL_B` と `Part_ArmR_B` に `0` のキーを入れる。
4. 腕Bを表示するフレームでは、`Part_ArmL_A` と `Part_ArmR_A` に `0`、`Part_ArmL_B` と `Part_ArmR_B` に `100` のキーを入れる。
5. Viewer の Pose Settings で、左腕A/Bを同じグループ、右腕A/Bを同じグループとして設定する。
6. 必要に応じて Fade(ms) を調整し、腕切り替え時の重なりが目立ちすぎないことを確認する。

### Then / Open Stack期待結果

- 腕Aと腕Bは、削除や上書きではなく、切り替え可能な複数部品状態として保持される。
- 左腕グループでは `Part_ArmL_A` と `Part_ArmL_B` のうち意図した一方だけが最終表示対象になる。
- 右腕グループでは `Part_ArmR_A` と `Part_ArmR_B` のうち意図した一方だけが最終表示対象になる。
- `100` と `0` による表示状態の切り替え、Step 相当の切り替えタイミング、フェード中の重なり確認を区別して説明できる。
- 腕差分の同時表示による破綻がある場合、差し替え設定または素材重なりの調整対象として提示できる。

### 検証するACの項目

- AC-PART-003: ポーズ・差し替え表現を扱えること
- AC-PART-004: 表示状態のランタイム再現性を保持できること

## SC-PART-007: 切り替え対象パーツを含めて書き出し、ランタイムで表示状態を再現できる

### Given / 前提条件

- `Part_ArmL_A`, `Part_ArmL_B`, `Part_ArmR_A`, `Part_ArmR_B` のポーズ切り替え設定が存在する。
- 編集中のプレビューでは腕Aと腕Bの切り替えが意図通りに見えている。
- 書き出し前の編集状態では、現在表示中でない腕差分パーツが非表示になっている可能性がある。
- ランタイム確認用に、書き出し後のモデルを Viewer または同等の確認環境で読み込める。

### When / Cubism参照操作

1. MOC3 書き出し前に、切り替え対象パーツがすべて書き出し対象に含まれる状態か確認する。
2. 非表示の切り替え対象パーツがある場合、すべて表示してから書き出す、または Export Hidden Parts を有効にする。
3. 必要に応じて `.pose3.json` と `.model3.json` を書き出す。
4. 書き出したモデルを Viewer またはランタイム確認環境で読み込む。
5. 腕A表示、腕B表示、切り替え中の各状態を再生し、編集時の表示意図と一致するか確認する。
6. 非表示パーツや hidden ArtMesh を書き出さなかった場合、切り替え対象が欠落することを確認する。

### Then / Open Stack期待結果

- 書き出し前に、切り替え対象パーツが出力対象に含まれているか検証できる。
- 書き出し後の確認環境で、腕A表示、腕B表示、切り替え中の表示状態が制作意図と一致する。
- hidden parts や hidden ArtMesh の書き出し条件により、差し替え対象が欠落するリスクを警告できる。
- `.moc3`, `.model3.json`, `.pose3.json` など、表示再現に必要な成果物が揃っているか確認できる。ただし具体的なファイル内部構造はこのシナリオでは定義しない。
- 編集中のプレビューと書き出し後の表示に差異がある場合、対象パーツ、表示状態、欠落した差分、合成差分を説明できる。

### 検証するACの項目

- AC-PART-003: ポーズ・差し替え表現を扱えること
- AC-PART-004: 表示状態のランタイム再現性を保持できること
