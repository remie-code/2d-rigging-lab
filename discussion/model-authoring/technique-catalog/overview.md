# 技法の全体像（フェーズ1）

> 集めるフェーズのメモ（collection/）から起こした、どんな技法があるかの見取り図。加工前。分類は暫定。作成日: 2026-10-20。

## 読み方

- 元にしたのは [collection/](collection/_map.md) の 9 ファイル（Web 6、X 3）。メモの見出しは合わせて約 500（同じ記事が複数ファイルに重複して載っているものを含む）。
- 分類は seed（ファイルの分け方）に合わせず、メモを一件ずつ見て下から組み立てた。軸は二つある。「部位をまたぐ考え方」は、部位が違っても繰り返し出てきた発想。「系統別の見取り図」は、部位や表現ごとのまとまり。一つの技法が両方に、また複数の系統に出てくることがある。
- 件数は、その系統に入ると判断したメモ見出しのおおよその数。厳密な集計ではない。
- 代表例は `短い名前 — ファイル の見出し「…」` の形で書いた。リンク先のファイルで見出しを探すと、出典・リンク・画像・要点がある。
- 確かさの印:
  - 〔動画〕 X 投稿で、中身は動画。要点は本文（キャプション）から読める範囲だけ。
  - 〔要約〕 検索スニペット・検索要約・商品説明だけで書かれたもの。本文は読めていない。
  - 〔外〕 Live2D 以外の出典（3D 向け、一般アニメ論など）。
- 評価（どれが良いか）、このシステムで実現できるかの判定、システム語彙への翻訳はしていない。それは加工フェーズで行う。

## 部位をまたぐ考え方

### 隠れる部分の描き足し（約 45 件）
初期位置では見えないが、動くと見えてくる所を先に描いておく。いちばん多く出てきた考え方で、素材の準備の話はほとんどがこれに行き着く。
- 首を長く描く — [collection/web-material-prep.md](collection/web-material-prep.md) の見出し「首は口元（〜鼻先・目の下）まで長く描く」
- 白目と瞳を全部描く — [collection/web-material-prep.md](collection/web-material-prep.md) の見出し「白目は瞳の裏まで、瞳は全円で描く」
- 後ろ髪の側面を足す — [collection/web-face-angle.md](collection/web-face-angle.md) の見出し「後ろ髪の側面パーツを描き足す（側面は横向きで描いてから縮める）」
- 境界ののりしろ — [collection/web-material-prep.md](collection/web-material-prep.md) の見出し「閉じた輪郭線は固定線になって動くと破綻する」

### マスク・クリッピングで重なりと見え方を処理する（約 30 件）
描画順だけでは解けない「ここだけ見せる／ここだけ隠す」を、マスク（反転マスク、不透明度 0 の見えない素材）で解く。
- 顎の線だけ消す — [collection/web-face-angle.md](collection/web-face-angle.md) の見出し「不透明度0%のマスクパーツ＋マスク反転で顎線だけ消す」
- 鼻で奥の目を隠す — [collection/web-face-angle.md](collection/web-face-angle.md) の見出し「鼻梁の高さで奥の目の一部を隠す（マスク）」
- 見えないマスク専用の素材 — [collection/web-material-prep.md](collection/web-material-prep.md) の見出し「フード用マスク画像を用意して中身を隠す」
- まぶたの突き抜けを防ぐ — [collection/x-tips-pass1.md](collection/x-tips-pass1.md) の見出し「まぶたが眼球を突き抜けるなら白目のマスクを」〔動画〕

### 視差・奥行き（約 30 件）
手前のものほど大きく動かし、奥のものほど細く・小さくする。パーツごとに別のデフォーマを持たせて、ずれ方を変える。
- パーツごとに別ワープ — [collection/web-face-angle.md](collection/web-face-angle.md) の見出し「パーツごとに別ワープデフォーマで視差を作る」
- 奥を細く手前を広く — [collection/web-face-angle.md](collection/web-face-angle.md) の見出し「奥を細く、手前を広く（共通原則）」
- 瞳とハイライトを逆にずらす — [collection/web-eyes-brows-mouth.md](collection/web-eyes-brows-mouth.md) の見出し「眼球感：瞳は逆方向に少し、ハイライトは進行方向に少し」
- 曲げずに層の移動量だけで — [collection/web-face-angle.md](collection/web-face-angle.md) の見出し「ピクセルアートは曲げず、髪を奥行き層に分けて視差」

### 立体を想定して形を決める（約 20 件）
絵の形ではなく、頭は球、顔の側面は面、首は円柱、肘は円、と立体を頭に置いてデフォーマの格子を動かす。奥行きの同じ点どうしの関係（交点）を崩さない。
- 頭の中に立体を飼う — [collection/web-face-angle.md](collection/web-face-angle.md) の見出し「立体を頭の中に飼う: デフォーマ頂点を立体に沿わせ、X は水平・Y は垂直のみ」
- 回転軸からの距離 — [collection/web-face-angle.md](collection/web-face-angle.md) の見出し「回転軸からの距離で移動量を変える（顎先・鼻・髪）」
- 交点を保つ — [collection/web-face-angle.md](collection/web-face-angle.md) の見出し「交点（基準点）の考え方: 同じ奥行きの交点はずらさない」
- 肘を円で設計 — [collection/web-body-arms-linkage.md](collection/web-body-arms-linkage.md) の見出し「肘は「上腕側を半円、前腕の切れ目を半円の中心に通す」＋回転デフォーマを半円の中心へ」

### 時間差・遅れ・ばらつき（約 25 件）
全部を同時に・同じように動かさない。末端ほど遅らせ、似たもの同士でも設定を少しずつ変える。物理演算でもキーでも出てくる。
- 毛先と中央のタイミング — [collection/web-hair-physics.md](collection/web-hair-physics.md) の見出し「毛先と中央のタイミングをずらして柔らかく」
- 体を遅らせる — [collection/web-body-arms-linkage.md](collection/web-body-arms-linkage.md) の見出し「顔と体を同時に動かさない（体が遅れて追従／体の向きに顔が付いてくる）」
- 遅延パラメータの多段 — [collection/web-body-arms-linkage.md](collection/web-body-arms-linkage.md) の見出し「物理演算の「遅延」パラメータを多段連結して時間差を作る」
- 髪ごとに物理を変える — [collection/web-hair-physics.md](collection/web-hair-physics.md) の見出し「前髪は控えめ・後ろ髪は大きく、髪ごとに物理モデルを変えてバラバラに揺らす」

### 反動・弾み（約 10 件）
止まるときに少し行き過ぎて戻る、動いた後に揺り戻す。時間差と近いが、「行き過ぎ」を独立した層（二段目のデフォーマや専用の振り子）で持たせる点が特徴。
- 行き過ぎて戻る — [collection/web-body-arms-linkage.md](collection/web-body-arms-linkage.md) の見出し「反動・ブレーキ（止まる時に少し行き過ぎて戻る）、腕は発話・頭と同時に動き出す」
- 体 XYZ の二段目を揺れに — [collection/web-body-arms-linkage.md](collection/web-body-arms-linkage.md) の見出し「体 XYZ に反動の揺れ（2 段目を揺れとして別に作る）」
- フォロースルー用の階層 — [collection/web-clothing-misc.md](collection/web-clothing-misc.md) の見出し「後追い（フォロースルー）用に別のデフォーマ階層を持つ」

### 付け根を固定し、先端ほど大きく（約 15 件）
揺れも回転も「どこから動くか」を先に決める。根元は全パラメータで動かさず、先へ行くほど振れ幅を大きくする。
- 根元を 27 方向で固定 — [collection/web-hair-physics.md](collection/web-hair-physics.md) の見出し「髪の根元を全パラメータで固定する（27方向チェック）」
- 結び目を留める — [collection/web-clothing-misc.md](collection/web-clothing-misc.md) の見出し「リボンは3分割＋変形パス、結び目の両端に点を打って結び目を固定」
- 付け根を意識 — [collection/x-tips-pass3-gaps.md](collection/x-tips-pass3-gaps.md) の見出し「揺れものは「付け根」を意識する」〔動画〕
- 腕の根元は鎖骨 — [collection/web-body-arms-linkage.md](collection/web-body-arms-linkage.md) の見出し「腕を上げる時の根元は肩ではなく鎖骨」

### 重力と重さ（約 10 件）
傾けたら垂れる、重いものはゆっくり長く揺れる。重心の位置で組み方を変える。
- 傾けても真下に垂れる — [collection/web-hair-physics.md](collection/web-hair-physics.md) の見出し「入力の正規化で「頭を傾けたとき髪が真下に垂れて静止」させる」
- 重心で作り方を変える — [collection/web-clothing-misc.md](collection/web-clothing-misc.md) の見出し「イヤリングは「重心の位置」で作り方を変える」
- 素材の重さに値を合わせる — [collection/x-tips-pass2-en.md](collection/x-tips-pass2-en.md) の見出し「物理の重さ調整: 重い三つ編みと短い巻き毛で値を変える」〔動画〕
- 体の重心を戻す — [collection/web-body-arms-linkage.md](collection/web-body-arms-linkage.md) の見出し「腰を動かせ（重心を支持基底面の上に戻す）」

### 連動（ある動きに別のパーツを従わせる）（約 25 件）
口が開けば顎が下がる、口角が上がれば頬と下まぶたが動く、のように動きの因果を別パーツへ伝える。物理演算の入力に表情や呼吸を入れる使い方もここに入る。
- 口の開きで顎 — [collection/web-eyes-brows-mouth.md](collection/web-eyes-brows-mouth.md) の見出し「顎は「開いた口の隙間ぶん」下げる、母音ごとに下げ量を変える」
- 上腕で胴・襟も — [collection/web-body-arms-linkage.md](collection/web-body-arms-linkage.md) の見出し「腕は手→前腕→上腕の順に作る／上腕を動かすと胴体・襟・脇・胸も動かさないと脱臼に見える」
- 感情で耳が動く — [collection/web-hair-physics.md](collection/web-hair-physics.md) の見出し「猫耳ピコ: 眉の上下や目の開閉を物理入力に混ぜる」
- 呼吸に装飾を乗せる — [collection/web-body-arms-linkage.md](collection/web-body-arms-linkage.md) の見出し「呼吸パラメータに翼などを連動、同期しすぎるなら反応区間の違う親デフォーマを重ねる」

### 変形しやすい素直な形で用意する（約 12 件）
見た目どおりに描かず、変形で崩れにくい形（直線、まっすぐ、単純な面）で用意して、形は動きで付ける。
- 揺れものはまっすぐ — [collection/web-material-prep.md](collection/web-material-prep.md) の見出し「揺れもの（鎖・紐）は真っ直ぐに描く」
- 口は直線 — [collection/web-material-prep.md](collection/web-material-prep.md) の見出し「口は直線で描く／閉じ口から作る」
- 袖を三角形のテクスチャで — [collection/web-material-prep.md](collection/web-material-prep.md) の見出し「変形量の大きい部位は「変形しやすいテクスチャ」を用意（着物の袖を三角形で）」
- 一度まっすぐにしてスキニング — [collection/x-tips-pass1.md](collection/x-tips-pass1.md) の見出し「尻尾のスキニング: まっすぐに伸ばしてからスキニングして曲げ直す」〔動画〕

### 前後関係の入れ替え（約 10 件）
向きによって前後が入れ替わるパーツを、描画順の切替（瞬時でちらつく）、複製して二枚で挟む、不透明度で入れ替える、のどれかで扱う。
- 横髪を複製して挟む — [collection/web-face-angle.md](collection/web-face-angle.md) の見出し「筒状の横髪はパーツ複製して奥側を輪郭の下へ」
- 二枚を不透明度で入れ替え — [collection/web-clothing-misc.md](collection/web-clothing-misc.md) の見出し「前後をまたぐパーツは2枚置いて不透明度で入れ替える」
- 耳を最初から前に置く — [collection/web-face-angle.md](collection/web-face-angle.md) の見出し「耳の位置基準と、耳と輪郭の描画順チラつき対策」

### 複製から素材を作る（約 10 件）
新しい絵を描かずに、既存パーツを複製して色・合成・位置を変え、影・裏地・光・線・盛り上がりを足す。
- 横髪の複製で奥の髪 — [collection/x-tips-pass1.md](collection/x-tips-pass1.md) の見出し「サイドの髪を複製して頭の後ろへ、Angle X でずらし乗算で暗く」〔動画〕
- 頭の複製で目元・唇の膨らみ — [collection/x-tips-pass2-en.md](collection/x-tips-pass2-en.md) の見出し「目と唇の盛り上がりを頭部パーツの複製から作る（新規の絵なし）」〔動画〕
- 複製を加算で光らせる — [collection/web-clothing-misc.md](collection/web-clothing-misc.md) の見出し「追加パーツなしで光らせる: 複製して加算・不透明度0%→揺れ最大で100%」
- 表の複製で裏地 — [collection/web-clothing-misc.md](collection/web-clothing-misc.md) の見出し「スカートの裏側パーツがなければ表を複製して乗算で裏地にする」〔要約〕

### 役割を分けて組み合わせの爆発を抑える（約 15 件）
一つのパーツやデフォーマに載せるパラメータを少なくする（目安は 2〜3 個）。角度は専用ワープへ、パーツを分割してグルーで繋ぎ、上と下で担当を分ける。
- 角度は専用ワープへ — [collection/web-face-angle.md](collection/web-face-angle.md) の見出し「隠れた首・前髪裏を先に描いておく、顔角度は専用ワープで」
- 分割してグルーで分担 — [collection/web-clothing-misc.md](collection/web-clothing-misc.md) の見出し「一枚のパーツを分割してグルーでつなぎ、上は角度XY・下は揺れに割り当てる」
- 1 パーツ 3 パラメータまで — [collection/web-body-arms-linkage.md](collection/web-body-arms-linkage.md) の見出し「指・袖は腕と同じパラメータに登録して一緒に動かす／1 パーツのパラメータは最大 3 つ」
- 舌出しの分担 — [collection/x-tips-pass3-gaps.md](collection/x-tips-pass3-gaps.md) の見出し「舌出しの構造（1デフォーマあたりのパラメータは3つ以下、アートメッシュは描画順切替だけ）」

### 条件付きで効かせる（重みの制限・排他）（約 12 件）
ある形を「別のパラメータがこの範囲にあるときだけ」効かせる、同系統の差分を同時に出さない。ブレンドシェイプの重みの制限がよく使われる。
- 見開きのときだけ驚き — [collection/web-eyes-brows-mouth.md](collection/web-eyes-brows-mouth.md) の見出し「驚きで瞳を縮め、ハイライトを大きく（重み制限で開閉と分離）」
- 口が開いたら頬ぷくを消す — [collection/web-eyes-brows-mouth.md](collection/web-eyes-brows-mouth.md) の見出し「頬ぷくー：0 では閉じ口の高さに潰しておく・口が開いたら重み制限で消す」
- 腕差分を同時に出さない — [collection/x-tips-pass1.md](collection/x-tips-pass1.md) の見出し「差分の切り替えで「多腕」に見えないよう重みを調整」

### 作る順序（約 15 件）
後から足すと壊れる・やり直しになる順番がある。表情 → 角度、動き → 揺れ、構造 → 物理、角度 → スキニング、が繰り返し出てくる。
- 表情を先に — [collection/web-face-angle.md](collection/web-face-angle.md) の見出し「表情を完成させてから角度XYを作る」
- 構造を固めてから物理 — [collection/web-hair-physics.md](collection/web-hair-physics.md) の見出し「物理の前に構造を固める / 毛先の曲線は手動メッシュ、細長三角形を避ける」
- スキニングは角度の後 — [collection/web-clothing-misc.md](collection/web-clothing-misc.md) の見出し「スキニングは角度XYZを全部作り終えてから」

### 現実の動きから考え、動きで性格を出す（約 12 件）
筋肉・骨（鎖骨、首の支点）・呼吸の仕組みを自分の体や模型で確かめる。同じ動きでも量や方向の違いで、元気・おしとやか・大人っぽさなどの性格が出る。
- 筋肉から閉じ目 — [collection/web-eyes-brows-mouth.md](collection/web-eyes-brows-mouth.md) の見出し「上瞼は大きく、下瞼はわずかに（筋肉から考える閉じ目）」
- 首は鎖骨から曲げる — [collection/web-body-arms-linkage.md](collection/web-body-arms-linkage.md) の見出し「首の回転支点は見た目より奥、首は鎖骨の付け根から段階的に曲げる」
- 肩と脚で性格づけ — [collection/web-body-arms-linkage.md](collection/web-body-arms-linkage.md) の見出し「肩を首と同方向に倒すと元気、逆方向でおしとやか／軸足と脚のポーズで性格づけ」

### 控えめに（約 10 件）
配信では長く映るので、派手さより見続けて違和感のない量にする。変形しすぎ・揺らしすぎ・傾けすぎを戒める声が各部位にある（反対の声は「意見が割れているもの」を参照）。
- 揺れは控えめに — [collection/web-clothing-misc.md](collection/web-clothing-misc.md) の見出し「自然な揺れは控えめに、首に一拍遅れて追従」
- 輪郭はあまり歪めない — [collection/web-face-angle.md](collection/web-face-angle.md) の見出し「輪郭の変形は控えめに、パーツ位置で向きを出す」
- 小技を全部乗せない — [collection/web-clothing-misc.md](collection/web-clothing-misc.md) の見出し「「小技は全部乗せればよいわけではない」」

## 系統別の見取り図

### 素材と準備

#### パーツ分けの方針（約 25 件）
何をどこまで、どの単位で分けるか。線と塗り、重なり、左右、細かさの判断。
- 線と塗りを分ける — [collection/web-material-prep.md](collection/web-material-prep.md) の見出し「線画と塗りを分ける／統合する問題」
- 分けすぎの方がまし — [collection/web-material-prep.md](collection/web-material-prep.md) の見出し「分けすぎの方が分けなさすぎよりマシ（後から分けるのは大変）」
- 対称でも左右別々 — [collection/web-material-prep.md](collection/web-material-prep.md) の見出し「左右対称パーツでも左右別々に（ジャケット・襟）」
- 描き方の流儀別 — [collection/web-material-prep.md](collection/web-material-prep.md) の見出し「制作スタイル別の分け方（最初から分けて描く／描いてから切る／一枚で描きつつ分ける）」

#### PSD の仕様と受け渡し（約 20 件）
取り込める形式・色・合成モード、命名、ゴミ画素、キャンバスの中心線など、技術的な約束ごと。
- 編集用と取り込み用 — [collection/web-material-prep.md](collection/web-material-prep.md) の見出し「素材分けPSD と 取り込み用PSD を分けて持つ」
- 合成モードは 3 種 — [collection/web-material-prep.md](collection/web-material-prep.md) の見出し「合成モードは通常・乗算・加算のみ」
- 透明のゴミ画素 — [collection/web-material-prep.md](collection/web-material-prep.md) の見出し「半透明のゴミピクセルは RGBA(0,0,0,0) まで消す」
- 中心線と偶数幅 — [collection/web-material-prep.md](collection/web-material-prep.md) の見出し「中心線をキャンバス中央に、偶数サイズ、対称定規」

### 頭と顔

#### 顔の角度 XY（輪郭・鼻・耳）（約 40 件）
振り向き・上下の向きを、輪郭の幅、鼻の「く」の字、耳の位置、斜め（四隅）の補正で作る。最も資料の厚い系統。
- 輪郭の X — [collection/web-face-angle.md](collection/web-face-angle.md) の見出し「角度X の輪郭: 幅を狭め、奥の頬をカーブ、手前の顎に丸み、手前のこめかみを引っ込める」
- 鼻の「く」の字 — [collection/web-face-angle.md](collection/web-face-angle.md) の見出し「鼻: 角度X で「く」の字、その線が顎につながる位置へ」
- 上下の注意 — [collection/web-face-angle.md](collection/web-face-angle.md) の見出し「Y の注意: 下向きでつぶれない、上向きは髪上部縮小＋顎幅を少し小さく」
- 斜めの作り方 — [collection/web-face-angle.md](collection/web-face-angle.md) の見出し「斜め（四隅）は「4隅の形状を自動生成」してから手で直す」
- 大きな立体は差し替え — [collection/web-face-angle.md](collection/web-face-angle.md) の見出し「張りぼて問題: 大きな立体パーツは角度でパーツ差し替え」

#### 首・顎下・輪郭線（約 20 件）
上を向いたときの顎の線、顎下の影、首との接続、顔が仮面のように浮く問題。
- 上向きで輪郭線を消す — [collection/web-face-angle.md](collection/web-face-angle.md) の見出し「上を向いたときに輪郭線を消す（線画と塗り分離＋マスク反転、顎下影）」
- 顎の影を滑らせる — [collection/web-face-angle.md](collection/web-face-angle.md) の見出し「顎の影パーツを新規に作りスライドさせる」
- 首の影を分ける — [collection/web-material-prep.md](collection/web-material-prep.md) の見出し「首の影は地肌と別パーツ、はみ出して大きめに」
- 首の太さと仮面感 — [collection/web-body-arms-linkage.md](collection/web-body-arms-linkage.md) の見出し「輪郭が仮面のように浮く時は首が太すぎる／首かしげでは首も一緒に動かす」

#### 頭の傾き Z と頭・首・体の親子（約 15 件）
回転の中心をどこに置くか、頭・首・体の回転をどう入れ子にするか、傾きの上限。
- 回転の中心 — [collection/web-face-angle.md](collection/web-face-angle.md) の見出し「角度Z の回転中心: 頭は顎付近・鼻と口の間、首は首の根元」
- 三段の入れ子 — [collection/web-body-arms-linkage.md](collection/web-body-arms-linkage.md) の見出し「頭→首→体の Z 連動を親子で組む（首の Z 曲面に頭の Z 回転を入れる）」
- 足し算の傾けすぎ — [collection/web-body-arms-linkage.md](collection/web-body-arms-linkage.md) の見出し「頭の回転軸は「頭と首の繋ぎ目」、首は別パラメータで頭より大きく傾け、足し算の傾けすぎに注意」

#### 目の開閉と眼球（約 30 件）
まばたき、笑顔目、眼球の球面感、ハイライトの動き、まつ毛の扱い。
- 閉じ目の基本 — [collection/web-eyes-brows-mouth.md](collection/web-eyes-brows-mouth.md) の見出し「閉じ目は「まつ毛を下まつ毛まで下ろす」＋白目クリッピングで眼球を隠す」
- 笑顔目は閉じの上に — [collection/web-eyes-brows-mouth.md](collection/web-eyes-brows-mouth.md) の見出し「笑顔目は「開閉=0 の上で」笑顔1.0を作る」
- 瞳を視線方向に潰す — [collection/web-eyes-brows-mouth.md](collection/web-eyes-brows-mouth.md) の見出し「瞳を視線方向に潰す（realistic pupils）」
- まぶたは一本の棒 — [collection/web-material-prep.md](collection/web-material-prep.md) の見出し「まぶたは「一本の棒」として動かす、飛び出た部分は別パーツ」
- まつ毛は顔の角度に — [collection/web-eyes-brows-mouth.md](collection/web-eyes-brows-mouth.md) の見出し「まつ毛は目玉XYではなく顔の角度に付ける」〔要約〕

#### 眉（約 10 件）
眉の変形・上下・角度の分け方と、目との距離の保ち方。
- 変形パスで滑らかに — [collection/web-eyes-brows-mouth.md](collection/web-eyes-brows-mouth.md) の見出し「眉は変形パスで「どの値で止めても線が美しい」ように、移動はデフォーマ階層で」
- 彫りの深い顔の目隠し — [collection/web-eyes-brows-mouth.md](collection/web-eyes-brows-mouth.md) の見出し「彫りの深い顔：眉の上に「目隠し」パーツを入れて肌にクリッピング」
- 眉頭と眉尻を別に — [collection/x-tips-pass2-en.md](collection/x-tips-pass2-en.md) の見出し「眉の表情を重ねる: Y 移動と曲がりのブレンドを組み合わせる」〔動画〕

#### 口の構造と口内（約 25 件）
唇・口内・歯・舌の分け方、口内のはみ出しの隠し方（流派が多い）、角度がついたときの口と歯。
- 口内は一回り大きく — [collection/web-material-prep.md](collection/web-material-prep.md) の見出し「口の中は一回り大きく、最大開口に合わせて描く」
- 編集レベルで開閉を作る — [collection/web-eyes-brows-mouth.md](collection/web-eyes-brows-mouth.md) の見出し「口の開閉は編集レベル2で上下別々、閉じは編集レベル3で上下同じ変形パス」
- 口は鼻〜顎の傾斜に — [collection/web-face-angle.md](collection/web-face-angle.md) の見出し「口は鼻〜顎の傾斜に張り付く、舌は逆傾斜」
- 歯を立体で回す — [collection/x-tips-pass3-gaps.md](collection/x-tips-pass3-gaps.md) の見出し「歯の立体モデル（角度 XY と、角度がついた状態の開閉）」〔動画〕

#### 母音・リップシンク・トラッキング用の口（約 20 件）
開閉×変形の格子に母音を置く、VBridger／パーフェクトシンク向けの口、リップシンクの閉じ方。
- 12 点の格子に母音 — [collection/web-eyes-brows-mouth.md](collection/web-eyes-brows-mouth.md) の見出し「開閉 0/0.3/0.7/1.0 × 変形3点 = 12点で母音を配置、輪郭（顎）も連動」
- VBridger の口 — [collection/web-eyes-brows-mouth.md](collection/web-eyes-brows-mouth.md) の見出し「VBridger の口：Funnel は開閉1以外ですぼむ、PressLip で唇結び、JawOpen は歯・舌・輪郭側」
- 表情で半開きにしない — [collection/web-eyes-brows-mouth.md](collection/web-eyes-brows-mouth.md) の見出し「表情データで口開閉を半開きにしない」
- 閉じる途中の形 — [collection/x-tips-pass1.md](collection/x-tips-pass1.md) の見出し「口を閉じる途中に特定の形を挟む」〔動画〕

#### 表情差分と顔の演出（約 20 件）
差分目（キラ目・しいたけ目・ヤンデレ目）、目の揺れ、頬、涙、瞳の中のギミック。
- 差分目の置き方 — [collection/web-eyes-brows-mouth.md](collection/web-eyes-brows-mouth.md) の見出し「表情差分の目（キラ目・ハート目・ぐるぐる目）は瞳の上・白目にクリップ・瞳WD追従」
- 目の揺れを物理で — [collection/web-eyes-brows-mouth.md](collection/web-eyes-brows-mouth.md) の見出し「まつ毛揺れ・ハイライト揺れ・瞳拡縮を物理で」
- 涙の跡 — [collection/x-tips-pass3-gaps.md](collection/x-tips-pass3-gaps.md) の見出し「涙が流れた「跡」を作る（白と影色の2パーツ）」〔動画〕
- 涙の軌道を回転で — [collection/x-tips-pass3-gaps.md](collection/x-tips-pass3-gaps.md) の見出し「涙を回転デフォーマで作り、アイドリング切替で表現」〔動画〕
- まばたきで動く瞳 — [collection/x-tips-pass3-gaps.md](collection/x-tips-pass3-gaps.md) の見出し「歯車の動く瞳（まばたきに紐付けた物理でカタカタ動く）」〔動画〕

### 髪と揺れ

#### 髪のパーツ分けと層（約 20 件）
前・横・後ろの間を埋める中間層、毛束の単位、髪影の分け方、つむじ・後頭部。
- 中間層を一番広く — [collection/web-material-prep.md](collection/web-material-prep.md) の見出し「髪の層は「中間層を一番広く」、back-middle パーツを足す」
- 房ごとに広めに — [collection/web-material-prep.md](collection/web-material-prep.md) の見出し「髪は房（毛束）ごとに、隠れる部分も広めに」
- 髪影も束ごとに — [collection/web-material-prep.md](collection/web-material-prep.md) の見出し「髪の落ち影は髪束ごとに分ける」
- 後ろ横髪で豪華に — [collection/web-hair-physics.md](collection/web-hair-physics.md) の見出し「後ろ横髪を足すと揺れが豪華に（描画順の目安）」〔要約〕

#### 振り向き・上下の向きに合わせた髪（約 15 件）
顔の角度に髪をどう追従させるか。前髪は大きくまとめ、後ろ髪は逆へ、横髪は上下で変形の仕方を変える。
- 前髪は大きくまとめる — [collection/web-face-angle.md](collection/web-face-angle.md) の見出し「前髪は大きな全体デフォーマ＋頭蓋骨の丸み」
- カーブ方向を揃える — [collection/web-face-angle.md](collection/web-face-angle.md) の見出し「頭の丸み（球体）: 前髪・横髪のカーブ方向を全て揃える」
- 後ろ髪は逆方向 — [collection/web-face-angle.md](collection/web-face-angle.md) の見出し「後ろ髪は顔・前髪と逆方向へ、切り替えは顔の裏の隠れた所で」
- 横髪の上下 — [collection/web-hair-physics.md](collection/web-hair-physics.md) の見出し「横髪: 上を向くと幅を縮めて上へ / 下を向くと上部だけ変形し下はストンと垂らす」

#### 物理演算の設定（約 35 件）
振り子の 4 項目、入力の選び方と影響度、出力の倍率、多段、うまく揺れないときの切り分け。
- 振り子の 4 項目 — [collection/web-hair-physics.md](collection/web-hair-physics.md) の見出し「振り子4項目の意味（長さ・揺れやすさ・反応速度・収束の速さ）」
- 入力の配分が揺れを決める — [collection/web-hair-physics.md](collection/web-hair-physics.md) の見出し「角度X と 体の回転X の影響度バランスで揺れ量が激変」
- 出力の反転で開く — [collection/web-hair-physics.md](collection/web-hair-physics.md) の見出し「左右対称の揺れ物は出力「反転」で広がる動きに」
- 風のダミーパラメータ — [collection/web-hair-physics.md](collection/web-hair-physics.md) の見出し「物理演算は入力・物理モデル・出力の3要素 / ダミー風パラメータ」
- 症状別の切り分け — [collection/web-hair-physics.md](collection/web-hair-physics.md) の見出し「症状別切り分け:「数値をいじるのは最後」」

#### 揺れものの組み方（デフォーマ・スキニング）（約 25 件）
揺れを受け止める構造。ワープの多層、回転デフォーマの連鎖、スキニング、揺れの成分分解。
- 幅広い布は多層ワープ — [collection/web-clothing-misc.md](collection/web-clothing-misc.md) の見出し「スカート系は変形パスでなく複数階層のワープデフォーマで揺らす」
- 親が全体、子が先端 — [collection/web-clothing-misc.md](collection/web-clothing-misc.md) の見出し「複数ワープの揺れは「親が全体、子ほど先端」」
- 揺れを 5 成分に分ける — [collection/web-hair-physics.md](collection/web-hair-physics.md) の見出し「3Dっぽい髪揺れ: 毛先揺れ / X1ねじれ / X2左右 / Y1すぼまり / Y2上下 の5系統」
- 縦の伸縮を足す — [collection/web-hair-physics.md](collection/web-hair-physics.md) の見出し「横揺れだけだと規則的 → 縦の動きを足す（ポニーテール向き）」

#### 柔らかさ・肉感（約 6 件）
太もも、胸、もち、マスコットなど、弾む柔らかいものの表現。件数は少なく、ほとんど動画で中身未見。
- 太ももの揺れ — [collection/x-tips-pass1.md](collection/x-tips-pass1.md) の見出し「ふとももを「たゆたゆ」させる」〔動画〕
- もちもち — [collection/x-tips-pass1.md](collection/x-tips-pass1.md) の見出し「もちもちの作り方（ミニキャラ・マスコット向け）」〔動画〕
- グルーの効きで伸びるもち — [collection/x-tips-pass1.md](collection/x-tips-pass1.md) の見出し「グルーの重みをパラメータで制御（もちを食べるモーション）」〔動画〕

### 体

#### 体の角度と重心（約 20 件）
体の XYZ、腰と脚、斜めの合成、左右の脚のパース。
- 体 Z は弧で曲げる — [collection/web-body-arms-linkage.md](collection/web-body-arms-linkage.md) の見出し「体 Y は 3 点（上・中・下）、体 Z は「横スライドではなく弧状に曲げる」、足は浮かせない」
- 手前の大きいパーツから — [collection/web-body-arms-linkage.md](collection/web-body-arms-linkage.md) の見出し「体 XY は「手前で大きく動くパーツ」から作る。腕は下向きで上がり、上向きで下がる」
- 左右の脚でパースを変える — [collection/x-tips-pass1.md](collection/x-tips-pass1.md) の見出し「ズボンのパースを左右の足で変える（腰振りダンス）」〔動画〕
- 傾きと軸移動の切替 — [collection/web-clothing-misc.md](collection/web-clothing-misc.md) の見出し「体の傾きと軸移動をスイッチパラメータで切り替える」

#### 呼吸とアイドリング（約 10 件）
止まっている間の生きている感じ。呼吸の範囲と膨らむ場所、微細なブレ、呼吸に乗せる装飾。
- 呼吸の範囲を広げる — [collection/web-body-arms-linkage.md](collection/web-body-arms-linkage.md) の見出し「呼吸パラメータの範囲を -2〜2 に広げる（深呼吸・ため息用）」
- 吸うのは遅く吐くのは速く — [collection/web-body-arms-linkage.md](collection/web-body-arms-linkage.md) の見出し「呼吸の一般アニメ原則：吸うのは遅く吐くのは速い、肩は胸の後から、腕はさらに遅れる」〔外〕
- 目の微細なブレ — [collection/web-body-arms-linkage.md](collection/web-body-arms-linkage.md) の見出し「固視微動（目の微細なブレ）をアイドルに入れる」

#### 腕・肘・肩（約 20 件）
回転で細って見える腕の補正、手前に突き出す表現、肘の繋ぎ方、関節のずれ。
- 上げた腕の太さ補正 — [collection/web-body-arms-linkage.md](collection/web-body-arms-linkage.md) の見出し「腕を上げると細く見えるので太さ補正パラメータを足す」
- 手前へ突き出す — [collection/web-body-arms-linkage.md](collection/web-body-arms-linkage.md) の見出し「腕の「立体表現」パラメータ（手前に突き出す）を肩・肘・手首回転に加える」
- 球体関節の肘 — [collection/web-body-arms-linkage.md](collection/web-body-arms-linkage.md) の見出し「球体関節のような丸い肘パーツ／前腕の伸縮パラメータで回転弧を縮める」
- 関節をグルーで留める — [collection/web-body-arms-linkage.md](collection/web-body-arms-linkage.md) の見出し「グルーで肩・肘の関節ずれを一括解決（体 Y × 回転デフォーマの肩ずれ）」

#### 手と指（約 10 件）
指の回転と開閉、掌の裏表、握り、一枚の手で指を動かす。
- 指を 360° 回す — [collection/web-body-arms-linkage.md](collection/web-body-arms-linkage.md) の見出し「指 1 本を -180〜180 回転＋開閉で作る（素材を開閉区間で分けて裏返りを防ぐ）」
- 掌の裏表 — [collection/web-body-arms-linkage.md](collection/web-body-arms-linkage.md) の見出し「手の裏表：掌パーツを反転して少し描き込めば裏面に／手首を隠すパーツ」
- シワ単位とアートパス — [collection/web-clothing-misc.md](collection/web-clothing-misc.md) の見出し「腕のシワごとに素材を分ける／アートパスで筋や影の出現・消失」

### 服と身に着けるもの

#### 服（スカート・襟・袖・フード・フリル）（約 20 件）
表と裏、襟裏、裾のなびき、関節にかかる柄、胸と襟の隙間。
- 表と裏を分ける — [collection/web-material-prep.md](collection/web-material-prep.md) の見出し「スカート・マントは表と裏（前面と背面）を分ける」
- 襟裏・袖の内側 — [collection/web-material-prep.md](collection/web-material-prep.md) の見出し「襟裏・袖の内側・フード内側など「裏面パーツ」を線と塗り両方で」
- 裾を手で波打たせる — [collection/web-clothing-misc.md](collection/web-clothing-misc.md) の見出し「ローブの裾を波状に手作業でなびかせる（ループ用パラメータ）」
- 袖の根元は太めに — [collection/x-tips-pass3-gaps.md](collection/x-tips-pass3-gaps.md) の見出し「袖の根元は太めに描く（腕を上げても破綻しない）」〔動画〕

#### アクセサリー・小物（眼鏡・帽子・装飾・持ち物）（約 20 件）
硬いもの・球体・折りたたむもの・厚みのあるものの扱い。
- 眼鏡のつる — [collection/web-clothing-misc.md](collection/web-clothing-misc.md) の見出し「眼鏡: 全体と左右のつるを別の曲面デフォーマに、つるは正面で折りたたむ」
- 帽子のツバは 3 面 — [collection/x-tips-pass3-gaps.md](collection/x-tips-pass3-gaps.md) の見出し「帽子のツバは裏面・中間・表面の3面を用意してスライド」〔動画〕
- 球体は回転デフォーマ — [collection/web-face-angle.md](collection/web-face-angle.md) の見出し「球体の小物は回転デフォーマへ、前髪は落ち影ごと 1 デフォーマ」
- 扇子の開閉 — [collection/web-clothing-misc.md](collection/web-clothing-misc.md) の見出し「扇子: 全羽同じ変形＋±90°、止まる位置は物理演算に任せる」

#### 獣耳・尻尾・羽（約 10 件）
人の体にないパーツ。根元から先へのパラメータの分け方、表情や呼吸との連動。
- 獣耳は目と平行に — [collection/web-face-angle.md](collection/web-face-angle.md) の見出し「獣耳・頭頂小物は「目と平行」→前面だけ追加変形」
- 尻尾を三区間に — [collection/x-tips-pass1.md](collection/x-tips-pass1.md) の見出し「尻尾が硬く見えるなら根元・中間・先端にパラメータを分ける」〔動画〕
- 尻尾を呼吸に — [collection/web-body-arms-linkage.md](collection/web-body-arms-linkage.md) の見出し「尻尾を呼吸パラメータに連動」
- 羽の裏表を切替 — [collection/web-clothing-misc.md](collection/web-clothing-misc.md) の見出し「羽: クリッピングマスク＋カリングでテクスチャを差し替え、笑顔で羽ばたく」〔要約〕

### 光・差分・動き

#### 光・影・色（約 20 件）
落ち影を独立させる、影の境界を動かす、乗算色・スクリーン色、光らせる・反射させる。
- 落ち影を独立 — [collection/web-material-prep.md](collection/web-material-prep.md) の見出し「頭部の落ち影（服→腕、頭→首）を独立させる」
- 影の境界を動かす — [collection/web-clothing-misc.md](collection/web-clothing-misc.md) の見出し「光と影を「暗い下地＋半透明グラデの明るいパーツ」で変形させて動かす」
- 乗算色とスクリーン色 — [collection/web-clothing-misc.md](collection/web-clothing-misc.md) の見出し「乗算色を黒にしてスクリーン色で塗りつぶす／親デフォーマに色を設定して一括」
- 反射面ごとに時間差 — [collection/web-clothing-misc.md](collection/web-clothing-misc.md) の見出し「凹凸パーツは反射面を細かく分け、面ごとにタイミングをずらして光らせる」

#### 差分・スイッチ・ギミック（約 20 件）
腕差分・衣装差分の切替、物理やパラメータで作るスイッチ、ジッパー・文字・食べかけなどの特殊表現。
- 差分は数を絞る — [collection/web-material-prep.md](collection/web-material-prep.md) の見出し「腕差分は必要数だけ（差分ごとに再セットアップが要る）」
- 差分スイッチを物理入力に — [collection/x-tips-pass1.md](collection/x-tips-pass1.md) の見出し「物理の入力に差分スイッチを繋ぐと振り子が中心からずれる問題」〔動画〕
- 空パラメータで物理を制限 — [collection/x-tips-pass2-en.md](collection/x-tips-pass2-en.md) の見出し「空のドライブパラメータで肩の物理を制限（腕ポーズ差分と両立）」〔動画〕
- マスク反転の応用 — [collection/web-clothing-misc.md](collection/web-clothing-misc.md) の見出し「マスク反転の応用アイデア集（影・透け・食べかけ・穴）」
- 文字を書く — [collection/x-tips-pass1.md](collection/x-tips-pass1.md) の見出し「文字を書く表現（くるっとする所は分割して繋ぐ）」〔動画〕
- 擬似的な球 — [collection/x-tips-pass1.md](collection/x-tips-pass1.md) の見出し「円形アートメッシュで擬似的に立体に見せる」

#### モーション（歩行・ループ・手振り）（約 8 件）
モデルの組み方そのものより、それを動かすアニメーションの作り方。seed 外として拾われたものが多い。
- 歩行は片道制 — [collection/web-body-arms-linkage.md](collection/web-body-arms-linkage.md) の見出し「歩行ループは「片道制」（-30 に着いたら 30 へ直接戻す）」
- ループで頭と体をずらす — [collection/web-body-arms-linkage.md](collection/web-body-arms-linkage.md) の見出し「ループモーションで角度 Z と体 Z を約 2 フレームずらす」
- 手を振るなら二の腕も — [collection/x-tips-pass1.md](collection/x-tips-pass1.md) の見出し「バイバイ: 前腕だけでなく二の腕も動かす」

### 制作の基盤

#### リグ構造の定石（デフォーマ階層・分割数・はみ出し）（約 20 件）
親子の組み合わせ方、定番の階層、ベジェ分割数、子が親からはみ出さないこと、命名。
- 親子の組み合わせ — [collection/web-clothing-misc.md](collection/web-clothing-misc.md) の見出し「デフォーマ親子の組み合わせ定石（公式）」
- 定番の階層 — [collection/web-clothing-misc.md](collection/web-clothing-misc.md) の見出し「定番のデフォーマ階層（Body Z > Body Y > Breath > …、XY ワープの中に揺れワープ）」
- 分割数は縦横比で — [collection/web-face-angle.md](collection/web-face-angle.md) の見出し「ベジェ分割数はパーツの縦横比で決める」
- 命名とはみ出し検証 — [collection/web-face-angle.md](collection/web-face-angle.md) の見出し「デフォーマ命名規則とはみ出し検証」

#### 自動生成と時短の操作（約 20 件）
エディタの自動生成（四隅、3D 回転表現、顔の動き、揺れ）、反転コピー、テンプレート、AI 補助。
- 3D 回転表現 — [collection/web-face-angle.md](collection/web-face-angle.md) の見出し「3D回転表現の適用（平面化→奥行き推定、カメラ位置・回転中心・パース強度）」
- 揺れの自動生成 — [collection/web-hair-physics.md](collection/web-hair-physics.md) の見出し「揺れの動きの自動生成（髪揺れ / 角度Zによる垂れ下がり）」
- 片側を作って反転 — [collection/x-tips-pass1.md](collection/x-tips-pass1.md) の見出し「左右鏡像のパーツはデフォーマを反対側へコピー」〔動画〕
- 素材分けの AI 補助 — [collection/web-material-prep.md](collection/web-material-prep.md) の見出し「AI 補助：素材分けPhotoshopプラグイン（切り抜き・塗りつぶし・塗り広げ）」

#### トラッキング・実行環境との接続（約 12 件）
VTube Studio などで使われる前提に合わせた作り込み。パラメータの分離、入力範囲、ID の合わせ方。
- トラッキング用と物理用を分ける — [collection/web-clothing-misc.md](collection/web-clothing-misc.md) の見出し「トラッキング用と物理演算用のパラメータを分ける（VTube Studio 側の事情）」〔要約〕
- 入力範囲を合わせる — [collection/web-eyes-brows-mouth.md](collection/web-eyes-brows-mouth.md) の見出し「VTube Studio：笑顔・目の笑顔の入力は真顔≒0／満面=1／すぼめ=-1 に合わせる」
- ハンドトラッキングの ID — [collection/web-body-arms-linkage.md](collection/web-body-arms-linkage.md) の見出し「VTube Studio ハンドトラッキング用パラメータ ID を合わせておく」

## 意見が割れているもの

- **口内のはみ出しの隠し方**: 唇に肌色を残す「肌色隠し」（公式が推奨）／マスク反転＋グルー片側 100%／グルー＋口内クリッピングで肌の塗り足しを不要に／肌色延長もグルーも使わず口中を 3 頂点ラインで沿わせる／肌パーツの不透明度を 0 に。出典: [collection/web-material-prep.md](collection/web-material-prep.md)「唇に肌色の縁を付けて口内のはみ出しを隠す（肌色隠し）」「口マスク・肌色隠しを使わない流派（グルー＋口内クリッピング）」、[collection/web-eyes-brows-mouth.md](collection/web-eyes-brows-mouth.md)「口：直線の長い上口・下口から作り、マスク反転＋グルー片側100%」「口：肌色延長もグルーも使わない方式（口中を3頂点ラインで唇に沿わせる）」、[collection/x-tips-pass1.md](collection/x-tips-pass1.md)「口パーツ: 肌パーツの不透明度を 0 にして輪郭のグラデに対応」
- **影の合成モード**: 通常で描く（乗算は重なると濃くなる）／付属品の落ち影は乗算レイヤー／乗算を使わず影用の複製＋マスク／首影を乗算で作る例。出典: [collection/web-material-prep.md](collection/web-material-prep.md)「影は「通常」で描く（乗算は重なりで濃くなる）」「付属品の落ち影は本体に描かず乗算レイヤーへ」、[collection/web-clothing-misc.md](collection/web-clothing-misc.md)「落ち影は乗算を使わず「影用の複製＋マスク」で色味を優先」、[collection/web-body-arms-linkage.md](collection/web-body-arms-linkage.md)「首の影は「輪郭塗りのコピーを乗算にして下にずらし、線画にクリッピング」」〔要約〕
- **髪の落ち影を肌側と髪側のどちらに描くか**: 割れている、とだけ記録がある。出典: [collection/web-material-prep.md](collection/web-material-prep.md)「髪の落ち影は髪束ごとに分ける」
- **線と塗りの前後**: 線画を塗りの下に置いて交差時の重なりを避ける／色を線より前に出すと塗りが線を汚す。出典: [collection/web-material-prep.md](collection/web-material-prep.md)「線画を塗りの下に置く（交差時の重なり回避）」
- **肘の切り方**: 関節を丸く／直線カット／円で設計して頂点を円に沿わせる／球体関節風の丸いパーツを挟む。モデラーごとに違うので相談、という声も。出典: [collection/web-material-prep.md](collection/web-material-prep.md)「腕は上腕・前腕・手、肘の内側を描き足す。関節は丸く」、[collection/web-body-arms-linkage.md](collection/web-body-arms-linkage.md)「肘は「上腕側を半円、前腕の切れ目を半円の中心に通す」＋回転デフォーマを半円の中心へ」「球体関節のような丸い肘パーツ／前腕の伸縮パラメータで回転弧を縮める」
- **動きの量**: 揺れのキーは大げさに作って出力で絞る、二次元なので少しオーバー気味が見栄えする／控えめが自然、揺らしすぎは視聴者が酔う。「作る量」と「見せる量」の違いで両立しているだけかもしれない。出典: [collection/web-hair-physics.md](collection/web-hair-physics.md)「揺れは大げさに作り、出力側で絞る」「根元から毛先へ2〜3振り子、毛先ほど軽く / 揺らしすぎは酔う」、[collection/web-face-angle.md](collection/web-face-angle.md)「角度XY は角度Z と髪揺れの後に作る（枠と親子関係エラー回避）」、[collection/web-clothing-misc.md](collection/web-clothing-misc.md)「自然な揺れは控えめに、首に一拍遅れて追従」
- **顔と体のどちらが先に動くか**: 体が遅れて追従／体が先で顔が後から向く（同じ公式チュートリアル内で両方）／顔と体を逆にすると大人っぽい。出典: [collection/web-body-arms-linkage.md](collection/web-body-arms-linkage.md)「顔と体を同時に動かさない（体が遅れて追従／体の向きに顔が付いてくる）」「物理演算で「入力=顔の角度、出力=体の角度」→体が遅れて付いてきて少し戻る」、[collection/web-face-angle.md](collection/web-face-angle.md)「傾けたら後ろ髪・イヤリングを垂らす／Z に体の回転Z を混ぜる」
- **体 XY をどのパラメータに付けるか**: 体の回転パラメータに付けて物理で顔に追従させる／トラッキングが体を検知しないので顔 XY に体 XY を割り当てるのが一般的。出典: [collection/web-body-arms-linkage.md](collection/web-body-arms-linkage.md)「体 XY は顔 XY ではなく体の回転パラメータに付け、物理演算で顔に追従させる」「Live2DEX で胴体が動かない時はパラメータ ID の付け替え」
- **前後が入れ替わるパーツの扱い**: 描画順の切替はちらつくので複製して挟む／±30 のときだけ描画順を変える／二枚を不透明度で入れ替える。出典: [collection/web-face-angle.md](collection/web-face-angle.md)「筒状の横髪はパーツ複製して奥側を輪郭の下へ」「角度XY は角度Z と髪揺れの後に作る（枠と親子関係エラー回避）」、[collection/web-clothing-misc.md](collection/web-clothing-misc.md)「前後をまたぐパーツは2枚置いて不透明度で入れ替える」
- **斜め（四隅）の作り方**: 四隅を自動生成して手で直す／自動生成はパースが入らないので斜めにずらして補正／フォームブレンド適用度 50／頭を回転デフォーマに入れて楽に／新しい自動生成はほぼ破綻しない。出典: [collection/web-face-angle.md](collection/web-face-angle.md)「斜め（四隅）は「4隅の形状を自動生成」してから手で直す」「四隅の自動生成はパースを考慮しない → 斜めにずらして補正」「斜め顔を「フォームをブレンド」適用度50で作る」「頭全体を回転デフォーマに入れて斜めで頭が縮むのを防ぐ（楽な斜め顔）」「自動生成の結果を構造の教材に（眉は角度用・位置用・曲面用の 3 段）」
- **絵を描く側がどこまで分けるか**: 分けすぎの方がまし／重なっている所だけ分ければよく、分からない所はモデラーが分ける。出典: [collection/web-material-prep.md](collection/web-material-prep.md)「分けすぎの方が分けなさすぎよりマシ（後から分けるのは大変）」「「重なっている部位だけ分ける」を基本にする」
- **眉のパラメータの数**: 標準の 4 種は使わず変形と上下の 2 つで十分／自動生成では角度用・位置用・曲面用の 3 デフォーマ構成だった。出典: [collection/web-eyes-brows-mouth.md](collection/web-eyes-brows-mouth.md)「眉のパラメータは「変形」と「上下」の2つに絞る」、[collection/web-face-angle.md](collection/web-face-angle.md)「自動生成の結果を構造の教材に（眉は角度用・位置用・曲面用の 3 段）」
- （程度の差）**首をどこまで長く描くか**: 口元／鼻先／目の下／耳の中央。出典: [collection/web-material-prep.md](collection/web-material-prep.md)「首は口元（〜鼻先・目の下）まで長く描く」、[collection/web-body-arms-linkage.md](collection/web-body-arms-linkage.md)「首は耳の中央くらいまで描いておく／首デフォーマを 2 つ（胴体側と顔との付け根）」〔要約〕
- （事実が不確か）**物理の入力影響度の合計上限**: 115% とする記事（本人も自信なしと注記）／他記事では 100%。出典: [collection/web-clothing-misc.md](collection/web-clothing-misc.md)「入力が「位置」だと揺れずにパタパタ反転する／入力合計の上限」

## 見えている穴

### 中身を読めていないもの
- **X の大半**: 第 1〜3 巡の約 120 件のほとんどが動画で、要点は本文の一行だけ。何をどう組んでいるかは動画を見ないとわからない。[collection/x-tips-pass1.md](collection/x-tips-pass1.md) の「この巡の性質（観測）」
- **Reddit**: 本体もミラーも取得できず、検索スニペットのみ。英語圏の実務の声がほぼ抜けている（Web 全ファイルの検索記録）。
- **YouTube**: 説明文・書き起こしが取れず、タイトルだけ記録した候補がある（[collection/web-body-arms-linkage.md](collection/web-body-arms-linkage.md) の検索記録に 4 本）。
- **有料の講座・学習データ・書籍**: Coloso の講座、BOOTH / itch.io / Gumroad の cmo3、書籍『Live2D モデリング&アニメーションTips』は目次や商品説明まで。
- **リンク集**: チュートリアルリンク集の Google Doc（PDF 本文が取り出せず）、英語の Live2D rigging tutorials まとめ（400 エラー）、Notion の練習リグ記事（JS 描画で取得不可）。
- **取得に失敗したページ**: surume1ka、ugoiraman、cgworld 本文、vtubermodelcommissions、ko-fi、toolify、Patreon、appirits の PDF。一部は検索要約だけで記録してある（〔要約〕の印）。

### 探したが見つからなかったもの
- 90° 近い振り向き（超高可動域の横顔）の具体手法。無料資料には無く、有料講座のみ（[collection/web-face-angle.md](collection/web-face-angle.md) の検索記録）。
- ウインク、ネクタイ、襟の専用解説。X 第 3 巡でもほぼ無し（[collection/x-tips-pass3-gaps.md](collection/x-tips-pass3-gaps.md)）。
- アホ毛に特有の技法（[collection/web-hair-physics.md](collection/web-hair-physics.md)）。
- 袖のシワの専用解説。帽子は X で 2 件だけ（[collection/web-clothing-misc.md](collection/web-clothing-misc.md)、[collection/x-tips-pass3-gaps.md](collection/x-tips-pass3-gaps.md)）。
- Inochi2D など他ツール側の知見（[collection/web-hair-physics.md](collection/web-hair-physics.md)）。
- 中国語圏の資料は SODA ART の X 投稿程度、韓国語圏は手がかりのアカウントだけ（[collection/web-face-angle.md](collection/web-face-angle.md)、[collection/web-material-prep.md](collection/web-material-prep.md)）。

### 検索の上限などで探せていないもの
- Web 調査の途中で検索の回数上限（全エージェント共有で 200 回）に達し、以降は既知 URL の取得だけで補った。未着手として残った候補: 3D 下絵（VRoid 等）の活用、奥の目・まつ毛の隠れ方、英語圏の個人ブログ（Ko-fi / Tumblr）（[collection/web-face-angle.md](collection/web-face-angle.md) の検索記録）。
- 鼻・頬の角度用の素材、XY 用の斜めの輪郭の素材は予算切れで手薄（[collection/web-material-prep.md](collection/web-material-prep.md) の検索記録）。
- 髪・物理の未取得候補: saraemi の物理演算／スキニング記事、vtsuku、nnwarks、cg-method、Kuroama の devlog、JUKU 添削配信の動画（[collection/web-hair-physics.md](collection/web-hair-physics.md) の検索記録）。
- X は第 1 巡が 2025-10 頃まで遡った所で止まり、第 2 巡（英語）・第 3 巡（手薄な部位）はそれぞれ検索語 1 つだけ。

### 系統として薄いもの（集まった範囲で見て）
- 柔らかさ・肉感、モーション、獣耳・尻尾・羽は件数が少なく、ほとんどが動画か seed 外として拾われたもの。
- 男性キャラ（顎・えら、鼻の高さ、彫りの深さ）と、ミニキャラ・マスコットは、個別の記事が数本あるだけ。
- 全身・脚・歩行は上半身に比べて少ない（配信では胸から上しか映らない、という前提の声もある）。

## 深掘りの入口

- **Live2D アドベントカレンダー（2019 / 2021 / 2023 / 2024）**: 玄人の記事が年ごとにまとまっていて、Web 調査で最も効率の良い入口だった。未読の候補記事も挙がっている（前後跨ぎギミック、水面の光、メッシュ辺のつなぎ方、きれいなデータの作り方など）。[collection/web-clothing-misc.md](collection/web-clothing-misc.md) の「X への手がかり」、[collection/web-body-arms-linkage.md](collection/web-body-arms-linkage.md) の「X への手がかり」
- **Live2D JUKU**: X の #Live2DTips（週 1 程度の解説動画）、添削生配信のアーカイブ（ビフォーアフター付き）、揺れ・物理演算の講座、帽子の回の配信。[collection/x-tips-pass1.md](collection/x-tips-pass1.md) の「添削アーカイブ（ビフォーアフター付き）」、[collection/web-hair-physics.md](collection/web-hair-physics.md) の「添削で繰り返される指摘: 根元を揺らさない / 0起点で往復させない」
- **ののん。の Live2D 講座シリーズ**（X、66 回以上、索引投稿あり）: [collection/x-tips-pass1.md](collection/x-tips-pass1.md) の「講座まとめ（輪郭影、口の形の早見表、閉じ口のイメージ ほか）」
- **note の連載**: 乾物ひもの「高可動域モデルの顔の角度XYのすすめ」①②③、925（クニコ）「頭の中に立体を飼おう」、伊糖だねこ「Live2D練習記録」①〜⑨、愛「live2Dの習得記録」、もいもい「Live2Dモデル制作～販売まで」、朝野ねごと「Live2D備忘録」。各 Web ファイルの「X への手がかり」に著者名がある。
- **書籍『Live2D モデリング&アニメーションTips』**（唐揚丸・乾物ひもの・ののん。・fumi）: 目次だけで技法名が多数見える。[collection/web-clothing-misc.md](collection/web-clothing-misc.md) の「書籍『Live2D モデリング&アニメーションTips』の服・アクセ関連項目」、[collection/web-eyes-brows-mouth.md](collection/web-eyes-brows-mouth.md) の「閉じ目の違和感を減らす（Tips 17〜22 の章立て）」
- **CGbox / VTuber解剖学（kasahara）**: 髪揺れ、物理、マスク反転、顔の回転などの解説記事が並ぶサイト。Web 各ファイルに多数。
- **@_shin_sinsin の FANBOX**: ワープデフォーマとブレンドシェイプの仕様をデータ付きで解説する連載。[collection/x-tips-pass1.md](collection/x-tips-pass1.md) の「ワープデフォーマの基本仕様の解説」
- **X のシリーズ物**: SODA ART「Live2D小技巧分享」、@wa_Ta_ta__「パーツ分けあるある」、@yukinashGG_sub の tips まとめ、英語の「Rigging Tip」（@maoxyart、@DrakeLive2d、@NaoDoragonENV）、再掲アカウント @live2dtree。[collection/x-tips-pass1.md](collection/x-tips-pass1.md) と [collection/x-tips-pass2-en.md](collection/x-tips-pass2-en.md) の「X への手がかり」
- **リンクの束**: Heystack のガイド（X の髪・口・頭部ガイドへのリンク多数）、cillia の carrd ポータル、未読のチュートリアルリンク集（Google Doc）。[collection/web-material-prep.md](collection/web-material-prep.md) の「X への手がかり」、[collection/web-body-arms-linkage.md](collection/web-body-arms-linkage.md) の検索記録
- **ハッシュタグ #スカート揺らそう企画**: スカート揺れの作例が集まっている可能性。[collection/web-clothing-misc.md](collection/web-clothing-misc.md) の「X への手がかり」
