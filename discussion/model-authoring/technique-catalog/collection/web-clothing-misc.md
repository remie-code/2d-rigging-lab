# 集めるメモ（Web）: 服とアクセサリー、その他の表現・総合的なコツ

> フェーズ1（集める）の生メモ。原文用語のまま、加工前。調査日: 2026-10-19。

## メモ

### スカート系は変形パスでなく複数階層のワープデフォーマで揺らす
- 出典: kasahara / CGbox / 2020-12-05
- リンク: https://cgbox.jp/2020/12/05/live2d-shake-part/
- 画像: ページ内にあり（埋め込み形式で直接 URL 取得不可）
- 要点: 横幅の広いパーツ（スカート、後ろ髪）は変形パスだと絵が歪むので、ワープデフォーマを重ねて揺れを作る。しっぽのような曲がるものはスキニングが向く。

### イヤリングは「重心の位置」で作り方を変える
- 出典: kasahara / CGbox / 2020-12-05
- リンク: https://cgbox.jp/2020/12/05/live2d-shake-part/
- 画像: ページ内にあり
- 要点: 下に重心がある（鎖つき）ものは、ワープで全体、回転で先端を揺らす二段構えにし、振り子1段目と2段目に割り当てる。全体に重心がある硬いものは回転デフォーマだけで作る（ワープは硬いものを歪ませる）。

### リボンは3分割＋変形パス、結び目の両端に点を打って結び目を固定
- 出典: kasahara / CGbox / 2020-12-05
- リンク: https://cgbox.jp/2020/12/05/live2d-shake-part/
- 画像: ページ内にあり
- 要点: 結び目を動かさずに端だけ揺らす。中央と下側で別パラメータを用意し、下側を左右逆に揺らす例もある。変形パスとワープを組み合わせると「ゆらゆら」になる。歪むときは線変形の幅を調整。

### 複数ワープの揺れは「親が全体、子ほど先端」
- 出典: kasahara / CGbox / 2020-12-05
- リンク: https://cgbox.jp/2020/12/05/live2d-some-deform/
- 画像: ページ内にあり
- 要点: デフォーマ階層の数とパラメータ数・振り子の数を揃え、出力では振り子の順を親から子へ並べる。縦のベジェ分割は3以上（縦長なら4）が目安。

### 自然な揺れは控えめに、首に一拍遅れて追従
- 出典: もん11 / note / 2026-05-13
- リンク: https://note.com/monn_11/n/n6f9a671479bd
- 画像: ページ内にあり
- 要点: 大きく揺らすより控えめな揺れのほうが自然に見えやすい。配信では長時間映るので、派手さより見続けて違和感のない動きを優先する。小さなパーツにも少し動きを入れると情報量が増える。

### 凹凸パーツは反射面を細かく分け、面ごとにタイミングをずらして光らせる
- 出典: もん11 / note / 2026-05-13
- リンク: https://note.com/monn_11/n/n6f9a671479bd
- 画像: ページ内にあり
- 要点: 宝石的な表現の応用。反射面ごとに少しずれたタイミングで光らせると立体感が出る。

### ローブの裾を波状に手作業でなびかせる（ループ用パラメータ）
- 出典: ゆにぷる / unitypull / 2021-03-18
- リンク: https://unitypull.com/live2d-costume/
- 画像: https://unitypull.com/wp-content/uploads/2021/03/b20_3-min.png , https://unitypull.com/wp-content/uploads/2021/03/b20_4-min.png , https://unitypull.com/wp-content/uploads/2021/03/b20_6-min.png
- 要点: 0〜40 の揺れパラメータに5点キーを打ち、最後を最初と同形にしてループさせる。波を機械的に横へずらす方式は、波の形が不均一だったり奥行きがあると破綻したので、振幅の増減・平面の波打ち・ランダム変化を手で付けた。表地と裏地は別パーツで別々に動かす。

### 服の裾の振り子は横方向にも設定する／アクセサリーは本体より一拍遅れる程度
- 出典: kitagawatetsuro / shiroikarasu.net / 2026-08-29
- リンク: https://shiroikarasu.net/live2d-physics-settings-guide/
- 画像: ページ内にあり（埋め込み形式）
- 要点: 裾に横方向の振り子を入れると歩行や体の傾きに反応しやすくなる。リボン・イヤリングは重さを強くしすぎず一拍遅れる程度。全部を大きく揺らすと画面が落ち着かないので、髪を主役にして他は控えめにする。

### 風の向きを決めて描き起こす／スカートは足を挟んで手前と奥に分ける（Cubism 2 時代のチュートリアル）
- 出典: KAZUYA / Live2D Cubism 2 Manual（ユーザーチュートリアル）/ 2015
- リンク: https://sites.google.com/cybernoids.jp/cubism2/tutorials/user_tutorials/kazuya1
- 画像: http://www.cynos.jp/tutorials/kazuya/03-7_GIF01.gif , http://www.cynos.jp/tutorials/kazuya/02-5_GIF01.gif
- 要点: 揺れたとき見える範囲が変わるので、スカートは足を挟むように手前/奥で分ける。パスは「線」、曲面デフォーマは「面」として動かす意識。マフラーだけ動きの向きを逆にして「全部同じ動き」の不自然さを避ける。

### 揺れループの中のまばたき頻度
- 出典: KAZUYA / Live2D Cubism 2 Manual / 2015
- リンク: https://sites.google.com/cybernoids.jp/cubism2/tutorials/user_tutorials/kazuya1
- 画像: ページ内にあり
- 要点: 揺れループを3回複製してそのうち1回にだけまばたきを入れ、瞬きが多すぎて不自然になるのを防ぐ。
- seed 外

### スキニングは角度XYZを全部作り終えてから
- 出典: さらえみ / saraemi.com / 2021-11-02（2024-11-18 更新）
- リンク: https://saraemi.com/vtuber/2021/11/02/live2d_skinning/
- 画像: https://saraemi.com/vtuber/wp-content/uploads/2024/11/2111_live2d_skinning.webp
- 要点: スキニング後は構造が複雑になり角度の後付けがほぼ不可能。スキニング前に XY パラメータをワープだけでなくパーツ自体にも付けておかないと、XY の動きがリセットされる。裂ける・変に歪むときはメッシュが粗い。

### フリルの表裏をグルーで固定してはみ出しを防ぐ
- 出典: rariemonn / note（Live2D アドカレ2021）/ 2021-12-05
- リンク: https://note.com/rariemonn/n/nd4eee57f9de3
- 画像: https://assets.st-note.com/production/uploads/images/67130662/picture_pc_6ce65bfbfa882055ad6ada2b239d0470.jpg?width=1200
- 要点: ひらひらしたフリルの表と裏がずれてはみ出さないようグルーで留める。同様に、輪郭線と顔塗り、口の線とマスク用塗りなど「同位置・同可動」の別パーツをグルーで接合しておくと、間に落ち影や頬の赤みを挟める。

### 一枚のパーツを分割してグルーでつなぎ、上は角度XY・下は揺れに割り当てる
- 出典: rariemonn / note / 2021-12-05
- リンク: https://note.com/rariemonn/n/nd4eee57f9de3
- 画像: https://assets.st-note.com/production/uploads/images/67132932/picture_pc_d9afe2db2bcef947e031e28ab1d0b5bd.jpg?width=1200
- 要点: 横髪・後ろ髪の例だが、大きなパーツの一部だけにデフォーマを効かせたいときの汎用手法。パラメータの組み合わせ数（確認パターン）を抑えられる。

### パーカーのフードは呼吸デフォーマから外す
- 出典: Jujube / note（Live2D アドカレ2019）/ 2019-12-11
- リンク: https://note.com/dreamemulator/n/n3aaf39e93d96
- 画像: https://assets.st-note.com/production/uploads/images/16773190/picture_pc_c3cad5fec38b0001fa96c6e7da10691e.png?width=1200
- 要点: Breath デフォーマ配下にあると呼吸で不自然に膨らむパーツ（フード等）は呼吸から分離する。呼吸は男性は腹式、女性は胸式で変形を分ける。

### 「小技は全部乗せればよいわけではない」
- 出典: Jujube / note / 2019-12-11
- リンク: https://note.com/dreamemulator/n/n3aaf39e93d96
- 画像: なし
- 要点: 固視微動（瞳の微ブレ）、表情の重ね掛け、口内の角度別の見え方などを紹介したうえで、絵柄やキャラに合うものを取捨選択せよという姿勢。仮面っぽく浮く場合は首と頭のつながりを疑う。
- seed 外（目・口・首を含む総合）

### 体のXYZに「反動の揺れ」を二段目として足す
- 出典: 音芽ケイ / note（Live2D アドカレ2023）/ 2023-12
- リンク: https://note.com/otome_kay/n/nbb434c9a0054
- 画像: ページ内にあり
- 要点: 体の XYZ を二段階で作り、二段目を物理演算の揺れにする。振り子3（2段揺れ）で出力は振り子2、X/Y は入力を位置、Z は角度、影響度50程度。全体が揺れるので部位ごとにアートメッシュを分けると綺麗。

### 遅延パラメータの段階的かけ合わせ・反動・呼吸を入力にした常時モーション
- 出典: 乃樹坂くしお / note（Live2D アドカレ2023）/ 2023-12-09
- リンク: https://note.com/ku_shi/n/n6c99cfcb3c4a
- 画像: https://assets.st-note.com/production/uploads/images/123995307/picture_pc_5b313aae45a8c12c9c98c3c724a639e7.gif , https://assets.st-note.com/img/1702052761916-SBvRUdBR6s.png
- 要点: 角度X を入力にした遅延1〜3を作り、前の遅延を次の入力にかけ合わせて段階的に遅らせる。動き始めに逆方向の反動を入れる設定はネックレス等に効く。呼吸パラメータを入力にすると、モーションファイルなしで羽・装飾・浮遊マスコットを常時動かせる。

### 物理演算で体を顔に追従させる・バウンドパラメータを作る
- 出典: 乾物ひもの / note（Live2D アドカレ2021）/ 2021-12-11
- リンク: https://note.com/himono_vtuber/n/n9015f0030d53
- 画像: https://assets.st-note.com/production/uploads/images/67524302/picture_pc_c020dd9931f23b9724922dc9e4796ac4.gif , https://assets.st-note.com/production/uploads/images/67533034/picture_pc_6a27936105bdf809c3c37e3ebd73e868.gif
- 要点: 顔角度→体角度の物理演算でオーバーシュートさせ「動いて少し戻る」を出す（顔と体を逆にすると大人っぽい動き）。体パラメータを複製して物理演算専用にし、トラッキング側と分離する。体Y→「体Yバウンド」→体角度と二段のグループで「ぽよん」と弾ませる。cillia の学習用モデルが元ネタ。
- seed 外（体・連動寄りだが総合的コツとして）

### トラッキング用と物理演算用のパラメータを分ける（VTube Studio 側の事情）
- 出典: Steam コミュニティ VTube Studio 議論（検索結果の要約経由）
- リンク: https://steamcommunity.com/app/1325860/discussions/0/3056241311833122100/
- 画像: なし
- 要点: VTube Studio では物理演算が最後に計算されて値を上書きするので、物理演算の出力に使ったパラメータは手動やアニメーションで動かせない。出力専用パラメータを分けて設計する。書籍『Live2D モデリング&アニメーションTips』にも「トラッキングと物理演算のパラメータを分ける」項目あり。

### 後追い（フォロースルー）用に別のデフォーマ階層を持つ
- 出典: 彩。 / note（Live2D アドカレ2023）/ 2023-12-13
- リンク: https://note.com/greenshieru_01/n/n5850482284c5
- 画像: https://assets.st-note.com/img/1701931277210-8n8XnpLgqM.png , https://assets.st-note.com/img/1701931396839-66oTnb6hPU.png
- 要点: アニメーションの12原則のフォロースルーを応用し、止まる・向きを変える瞬間に遅れてブレーキがかかるパーツを別階層で持たせる。物にも応用できる。

### 前後をまたぐパーツは2枚置いて不透明度で入れ替える
- 出典: ひたつら / note（Live2D アドカレ2019）/ 2019-12-24
- リンク: https://note.com/tatoosk/n/nc4eaf5e531c6
- 画像: https://assets.st-note.com/production/uploads/images/17131268/picture_pc_c4b413eafb29ec11dcda264152987866.png?width=1200
- 要点: 向きによって顔の前後が入れ替わるパーツは、顔の上と下に同じパーツを置き同じ XY デフォーマに入れ、角度X で不透明度を切り替える。描画順切り替えなら枚数は増えないが瞬時に入れ替わる。腕を体の前に出すのにも使える。
- seed 外（総合）

### 体の傾きと軸移動をスイッチパラメータで切り替える
- 出典: ひたつら / note / 2019-12-24
- リンク: https://note.com/tatoosk/n/nc4eaf5e531c6
- 画像: https://assets.st-note.com/production/uploads/images/17126982/picture_pc_8c9d944dcc5b6ebb418037c3a96fadaf.png?width=1200
- 要点: 体Z に ParamBodySwitch を2点で組み合わせ、同じ体Z入力で「傾き」と「軸移動（横揺れ・屈伸）」を切り替える。
- seed 外

### マスク反転で半透明影の重なりをきれいにする（公式の小技投稿）
- 出典: Live2D Creative Studio（X 投稿、検索結果のスニペット経由）
- リンク: https://x.com/live2dcs/status/1304359029280563203
- 画像: ページ内にあり（未確認）
- 要点: クリッピング先 ID を貼り付けて「マスクを反転」にチェックすると、半透明アートメッシュを重ねて影を作れる。

### マスク反転の応用アイデア集（影・透け・食べかけ・穴）
- 出典: kasahara / CGbox / 2020-12-24
- リンク: https://cgbox.jp/2020/12/24/live2d-masuku-hanntenn/
- 画像: ページ内にあり
- 要点: 上向き時の輪郭線消し、髪の透け、食べかけ表現、穴から出入り、背景色の部分変化、髪束影の重なり部分をきれいに見せる、など。マスク反転用素材は PSD 段階で塗り・不透明度100%で作る必要がある。

### 上を向いたら輪郭線を消し、顎下の影を出す
- 出典: kasahara / CGbox / 2020-12-21
- リンク: https://cgbox.jp/2020/12/21/live2d-up-rinnkaku/
- 画像: ページ内にあり
- 要点: 顔塗りと線画を分け、マスク反転で上向き時に輪郭線を隠す。塗りの輪郭部の影と首影の色味を統一する。顎下・首元に重ねる影パーツを別に用意し、正面0%→上向き100%にすると立体感が出る。
- seed 外（顔の角度寄り。影の動かし方として拾う）

### マスク素材を不透明度0%にして「重なった所だけ見せる」
- 出典: たびがらす / たびライフ / 2022-05-02
- リンク: https://tabi-life.blog.jp/archives/13808821.html
- 画像: https://livedoor.blogimg.jp/sorte_-unqsgumz/imgs/c/c/cc763714.png , https://livedoor.blogimg.jp/sorte_-unqsgumz/imgs/a/3/a3f7e06f.png
- 要点: 前髪越しの眉の透け表現。マスクは元画像を1色で塗りつぶした複製（ぼかしも反映）。複数アートメッシュへの適用は、デフォーマをコピーしてクリッピング欄に貼るのが早い。
- seed 外（クリッピングの使い方として拾う）

### 光と影を「暗い下地＋半透明グラデの明るいパーツ」で変形させて動かす
- 出典: xsinryux_x / Live2D コミュニティフォーラム（Live2D アドカレ2021 で紹介）/ 2017-09〜10
- リンク: https://forum.live2d.com/discussion/780
- 画像: https://us.v-cdn.net/5021544/uploads/editor/lr/dkvp68vdcccu.jpg , https://us.v-cdn.net/5021544/uploads/editor/b9/z5b7geovhypc.gif , https://us.v-cdn.net/5021544/uploads/editor/kv/ais42e18i5qa.gif
- 要点: 全体を影色にした下地の上に、半透明へグラデーションする明るいパーツを重ね、グラデ部分のポリゴンを分割して中間だけ動かすことで影の境界を角度X/Y に連動させる。手の影にも応用。

### 乗算色を黒にしてスクリーン色で塗りつぶす／親デフォーマに色を設定して一括
- 出典: Live2D 公式マニュアル「乗算色・スクリーン色」
- リンク: https://docs.live2d.com/en/cubism-editor-manual/multiply-color-screen-color/
- 画像: https://docs.live2d.com/cms/wp-content/uploads/2025/08/Multiply_ScreenColor_10-en.png , https://docs.live2d.com/cms/wp-content/uploads/2025/08/Multiply_ScreenColor_07-en.png , https://docs.live2d.com/cms/wp-content/uploads/2025/08/Multiply_ScreenColor_11-en.png
- 要点: 乗算色だけだと色がくすむので、乗算を黒にしてスクリーン色で色を入れると鮮やか。キーフォームで補間できるので動きと一緒に色が変えられる。親デフォーマの色は子に伝わる。モデル全体の色で夕方・夜の環境光を表す。

### 追加パーツなしで光らせる: 複製して加算・不透明度0%→揺れ最大で100%
- 出典: makotok1 / note / 2024-12-07
- リンク: https://note.com/makotok1/n/n8658f50c085c
- 画像: https://assets.st-note.com/production/uploads/images/164675120/picture_pc_9b6c20ede089094b4f6de7f905589cda.gif?width=1200
- 要点: 光らせたいパーツを複製し、ブレンド方式を加算・不透明度0%にし、乗算色/スクリーン色で色調整。揺れパラメータが最大値のとき不透明度を上げると、揺れた瞬間にキラッとする。

### アクセサリー揺れはまず振り子2本（X/Y で計4パラメータ）から
- 出典: makotok1 / note / 2024-12-07
- リンク: https://note.com/makotok1/n/n8658f50c085c
- 画像: https://assets.st-note.com/img/1733468619-YLIRehmb5pnAVtJ0SxCEyaiN.jpg?width=1200 , https://assets.st-note.com/production/uploads/images/164670490/picture_pc_2c1d71ac2d7baa1b2437e623f723734e.gif?width=1200
- 要点: 支点が5点あっても上半分を1、下半分を2に割り振る。入れ子の回転デフォーマで下ほど角度が大きくなり「しなる」。チェーンはワープでカーブと伸縮、ひし形や星などの硬質パーツは向きの変化を形状変形で X2/Y2 に入れる。

### 光の反射は「反射だけのパーツ」を重ねて透明度をパラメータで切り替える
- 出典: traitam / ガレージ暮らしのトライタム / 2018-01-28
- リンク: https://traitam.hatenablog.com/entry/2018/01/28/Live2D%E3%81%A7%E5%85%89%E3%81%AE%E5%8F%8D%E5%B0%84%E3%82%92%E8%A1%A8%E7%8F%BE%E3%81%99%E3%82%8B
- 画像: https://cdn-ak.f.st-hatena.com/images/fotolife/t/traitam/20180128/20180128142334.gif
- 要点: 光源（剣）の遠近に合わせて反射パラメータを動かす。本来は部位ごとに反射パラメータを分けるのが望ましいとしている。

### 眼鏡: 全体と左右のつるを別の曲面デフォーマに、つるは正面で折りたたむ
- 出典: ナナメ / note / 2019-02-16
- リンク: https://note.com/7name/n/nea1ae239dd4a
- 画像: https://assets.st-note.com/production/uploads/images/10008256/rectangle_large_type_2_894aabbce8dbe28a66a830caaaadf036.png?width=1200
- 要点: つるは描画順グループで深度を変え、顔の向きに応じて前後を整える。細長い線で作り、正面では折りたたんで隠しておく。

### 眼鏡のレンズはマスクにして反射をクリッピング、反射は位置を動かさず不透明度だけ
- 出典: もいもい / note / 2025-07-18（検索結果要約と本文で確認）
- リンク: https://note.com/moimoi_sp/n/n1375ae2f2d09
- 画像: ページ内にあり
- 要点: レンズの代わりに不透明度0のマスクを置き、反射をそこにクリッピング。反射光は位置を固定して不透明度だけ変えると眼鏡らしい光り方になる（検索要約では50〜80%程度）。まつ毛との描画順も要調整。

### 腕のシワごとに素材を分ける／アートパスで筋や影の出現・消失
- 出典: Live2D Creative Studio / Live2D 公式 note / 2020-08-21
- リンク: https://note.com/live2dnote/n/nd71e19f0ad92
- 画像: https://assets.st-note.com/production/uploads/images/31896766/picture_pc_bf5c2aaac177acd76520d7a0b085bb9a.png?width=1200 , https://assets.st-note.com/production/uploads/images/31965556/picture_pc_c9078b652480c58ead91a18a3df7fc77.gif?width=1200
- 要点: 可動域を広げるためシワ単位で素材を分割。指の筋はアートパスで3段階に変形しつつ不透明度で出し消し。足りない手の形はアートパスで補う。小物（飴）は中身と外袋の動きに差をつけて立体感。

### 落ち影は乗算を使わず「影用の複製＋マスク」で色味を優先
- 出典: Live2D Creative Studio / Live2D 公式 note / 2020-08-21
- リンク: https://note.com/live2dnote/n/nd71e19f0ad92
- 画像: https://assets.st-note.com/production/uploads/images/31963904/picture_pc_de3f94fdf1f24ecf4dde5842282f2756.png?width=1200
- 要点: 通常の机と影用の机を用意しマスクで影の範囲を切り抜く。影の動きはフォームアニメーションで影用ワープを変形させる（モデルデータには影響しない）。

### アートパスは服のしわのような線表現向け
- 出典: Live2D 公式「機能比較」ページ
- リンク: https://www.live2d.com/en/cubism/comparison/
- 画像: なし
- 要点: 輪郭線や服のしわなどの線表現を、元イラストの質を保ったままパラメータで変形させる用途として公式が位置づけている（PRO 機能、埋め込みモデル不可等の制約あり）。

### デフォーマ親子の組み合わせ定石（公式）
- 出典: Live2D 公式マニュアル「親子関係の組み合わせ」
- リンク: https://docs.live2d.com/en/cubism-editor-manual/combintion-of-parent-child-relation/
- 画像: https://docs.live2d.com/cms/wp-content/uploads/2025/11/Combi_Parent-Child_02-en.png , https://docs.live2d.com/cms/wp-content/uploads/2025/11/Combi_Parent-Child_04-en.png
- 要点: 回転親＋ワープ子は首、回転＋回転は腕脚の関節、ワープ親＋回転子は呼吸や肩すくめ。ワープ子はワープ親からはみ出さない（はみ出し点は計算コストも増える）。「はみ出した子に合わせて親を拡張」コマンドあり。

### 定番のデフォーマ階層（Body Z > Body Y > Breath > …、XY ワープの中に揺れワープ）
- 出典: Live2D Cubism 4.0 Cookbook（GitHub, RuolinZheng08）
- リンク: https://github.com/RuolinZheng08/gitbook-live2d-cookbook/blob/master/modeling-and-rigging/deformer-hierarchy.md
- 画像: なし
- 要点: 顔回転の中の各パーツに Angle XY 用ワープを被せ、揺れるもの（髪・アクセサリー）はその内側に物理用ワープ（例: Hair Front XY > Hair Front Swing）を入れる。前髪は 3x2、長い横髪・後ろ髪は 2x3 などパーツ形状でベジェ分割を変える。

### 装飾品は呼吸デフォーマの子に入れる
- 出典: castcraft blog / 2026-05-04 更新
- リンク: https://castcraft.live/blog/464/
- 画像: https://images.ctfassets.net/3a5471szmrtv/mRFQ7oUkFYWMDJlchgk4F/0fdcb7ae2816654320adc71a285c23d5/article464-026.png
- 要点: 腕や胸元の装飾品も呼吸デフォーマ配下にすると体と連動して自然なアイドリングになる。最大出力を100%超にすると範囲を振り切ってカクつく。

### 肩周り・服は角度Xのテンプレ由来のキーを消して作り直す／襟の貫通確認
- 出典: 西中ニシカ / nnwarks / 2021-12-25
- リンク: https://nnwarks.com/live2d_page8/
- 画像: https://nnwarks.com/wp-content/uploads/2020/11/live2d_page8_5.jpg , https://nnwarks.com/wp-content/uploads/2020/11/live2d_page8_9.jpg
- 要点: テンプレートのままの角度X は崩れやすいので消去し、服の移動量に合わせて肩回りを動かす（腕にめり込んでも可）。上向きでフード上部が崩れるので、被さる首・顔・髪を非表示にして修正。襟など首に被さるものは首を表示して貫通チェック。

### 服は横振りで見える部分まで描いておかないと「縦に潰れるだけ」になる
- 出典: 検索結果要約（Yahoo!知恵袋の回答ほか）
- リンク: https://detail.chiebukuro.yahoo.co.jp/qa/question_detail/q13246908083
- 画像: なし
- 要点: 体をサイドに振ったときに見える服の側面が描かれていないと、変形が細く潰れるだけで違和感が大きい。

### 布の表裏は別パーツに（間のパーツが布にめり込む）
- 出典: ClipStudioOfficial / CLIP STUDIO TIPS「Live2D用データをCLIP STUDIO PAINTで作る #2」
- リンク: https://tips.clip-studio.com/en-us/articles/674?org=1
- 画像: なし
- 要点: スカートの表と裏が1パーツだと、間に置いたパーツが動いたとき布にめり込む。動かすと見える場所（肘の裏など）は下地色→影→線画クリップの順で描き足す。

### スカートの裏側パーツがなければ表を複製して乗算で裏地にする
- 出典: YouTube Shorts「【Live2D Tips】スカート揺れ作り方」（検索結果の説明文経由）
- リンク: https://www.youtube.com/shorts/e0HDPMuvLWo
- 画像: なし
- 要点: 裏地が用意されていない場合の代用。イラストレーターやクライアントへの確認も推奨。書籍『Live2D モデリング&アニメーションTips』にも「スカートに裏地をつける」項目あり。

### フリルはほんの少しだけ揺らすためだけに分ける／ベストの影は乗算クリップ
- 出典: 黒葛原 / note
- リンク: https://note.com/tsudurahara/n/n14e969d0cc1f
- 画像: ページ内にあり
- 要点: シャツのフリルを別パーツにして微揺れさせる。ベストの影はシャツやズボンにクリッピング＋乗算。ボタンは1つずつ別レイヤー。揺れものは元の線を真っ直ぐ下に垂らして描いてから動かす（検索要約）。「分けなさすぎより分けすぎの方が綺麗」。

### 扇子: 全羽同じ変形＋±90°、止まる位置は物理演算に任せる
- 出典: hamstercrumbs / itch.io
- リンク: https://hamstercrumbs.itch.io/live2d-physics-based-fan
- 画像: https://img.itch.zone/aW1hZ2UvMTQ4MzQ3Ny84NjUwNTkwLmdpZg==/original/0llU8k.gif
- 要点: グルー・楕円補間・物理演算で、羽を1枚ずつ手で変形させずに扇子の開閉を作る。小さな Y/Z 角度で掃くような動きを足す。
- seed 外（小物ギミック）

### 服・アクセサリー物理の見本プロジェクト（「正解は一つではない」）
- 出典: cillia / itch.io / 2023
- リンク: https://cillia.itch.io/live2d-clothing-physics-example-project
- 画像: https://img.itch.zone/aW1hZ2UvMjAzOTUwMy8xMTk5NjI0OS5wbmc=/original/qHHp9g.png , https://img.itch.zone/aW1hZ2UvMjAzOTUwMy8xMTk5NjIyOS5wbmc=/original/8%2FmPMR.png
- 要点: 複数の手法を並べて試せる有料プロジェクト。プリセットは保存できるが、パラメータやオブジェクトの作り方次第でほぼ毎回調整が必要。髪物理の考え方は服やアクセサリーにも流用できる（cillia の portal でも言及）。別衣装は元衣装と同じポーズで作るのが効率的とも。

### 羽: クリッピングマスク＋カリングでテクスチャを差し替え、笑顔で羽ばたく
- 出典: Cutie Dragon / Ko-fi（検索結果の説明文経由、ページは 403）
- リンク: https://ko-fi.com/s/0506d4541f
- 画像: なし
- 要点: 羽ばたき中に裏表のテクスチャをカリング付きクリッピングで切り替える。笑顔パラメータで羽ばたきが反応する。学習用の無料サンプル。

### 物理演算講座の「よくあるミス」項目（公式 JUKU）
- 出典: Live2D JUKU「揺れ・物理演算をマスターしよう」/ 2022-04-01
- リンク: https://juku.live2dcs.jp/course/course-9/
- 画像: https://juku.live2dcs.jp/wp-content/uploads/2023/02/講座9_3.png
- 要点: 多段揺れの振り子 No の指定ミス、出力設定が高すぎる、振り子が揺れすぎる、物理演算グループの優先順位、を典型ミスとして挙げる。応用で「ひねるような揺れ」「宝石をキラッと」「呼吸に連動して腕」「まばたきで目のエフェクト」「空のパラメータで風を吹かせる」。

### 宝石・金属のキラキラ表現（公式 JUKU 動画）
- 出典: Live2D JUKU「エフェクトの作り方 ～キラキラ編～」
- リンク: https://juku.live2dcs.jp/en/movie/movie-249/ , https://juku.live2dcs.jp/movie/movie-250/
- 画像: なし
- 要点: 多面体の宝石の透明感・反射・屈折とそのデフォーマ構造、金属製髪飾りの光らせ方を扱う（詳細はメンバー限定）。nizima では物理演算で大きく揺れたときに光るイヤリングを JUKU が参考用に配布。

### 書籍『Live2D モデリング&アニメーションTips』の服・アクセ関連項目
- 出典: 唐揚丸・乾物ひもの・ののん。・fumi / 技術評論社 / 2024-10
- リンク: https://gihyo.jp/book/2024/978-4-297-14429-6
- 画像: なし
- 要点: 目次に「スカートに裏地をつける」「アクセサリーなどを簡単に光らせる」「簡単な光の反射」「首の影を別パーツに」「つむじや結び目を別パーツに」「クリッピングと反転マスクの併用」「ブレンドシェイプで揺れ」「トラッキングと物理演算のパラメータ分離」「バウンド・遅延パラメータ」「変形の無効化」など。

### Physics は構造が固まってから／親デフォーマは子を完全に包む
- 出典: VIVERSE Team / VIVERSE News / 2026-05-14
- リンク: https://news.viverse.com/post/vtuber-rigging-tips-and-tricks-for-beginners-workflow
- 画像: https://news.viverse.com/wp-content/uploads/2026/05/image-27-1024x576.png
- 要点: コアの動きが固まる前に物理を組まない。見上げたとき髪が頭から飛ばないよう Angle X/Y/Z の入力ウェイトを調整。頬染めや影は Clipping ID で範囲に閉じ込める。1つのメッシュやデフォーマにパラメータを詰め込みすぎない。

### 物理は控えめな値から（裾・袖・軽いアクセサリーの二次運動）
- 出典: VIVERSE News「How to Rig a 2D VTuber Model in Live2D Cubism」
- リンク: https://news.viverse.com/post/rig-2d-vtuber-model-live2d-cubism
- 画像: ページ内にあり（未確認）
- 要点: 物理はジャケットの裾・袖・軽い小物の二次運動向け。強い値はジッターっぽく見えるので弱めから。最終確認で極端値のメッシュ裂けと、よく使う表情でのクリッピングの隙間をチェック。

### アクセサリーは高めの減衰、重力方向をモデルの向きに合わせる
- 出典: vtubermodelcommissions.com（検索結果の要約経由、ページ取得は失敗）
- リンク: https://vtubermodelcommissions.com/live2d-vtuber-model-physics-settings-explained/
- 画像: なし
- 要点: アクセサリーは高い減衰、髪は中〜高。減衰が低すぎると延々と揺れる。プリセットの重力方向を鵜呑みにしないとアクセサリーが不自然に漂う。誤設定は jitter・lag・「jelly」な動きの原因。

### 入力が「位置」だと揺れずにパタパタ反転する／入力合計の上限
- 出典: tylergaciaposey / live2d-e（Tumblr）/ 2020-06-19
- リンク: https://live2d-e.tumblr.com/post/621382565322948609/a-look-at-physics-in-40
- 画像: https://64.media.tumblr.com/8e5fea97b5cc724d6f0bf637333e5152/fb274ebda560169d-d1/s500x750/80ec90a2187cd2dfc36fb8153bb88df75dbea477.png （振り子設定画面）
- 要点: 入力種別を角度でなく位置にすると素早く反転してスイングにならない。長いものは振り子を複数。出力影響は 100 から始めて調整。（入力合計の上限を 115% と書いているが本人も自信なし。他記事では 100%）

### 物理演算の設定はパラメータ調整がすべて終わってから／まず10段プリセット
- 出典: 西中ニシカ / nnwarks / 2021-12-25
- リンク: https://nnwarks.com/live2d_page16/
- 画像: https://nnwarks.com/wp-content/uploads/2020/12/live2d_page16_5.jpg
- 要点: 入力は揺らす場所に近いもの（前髪なら頭）。10段プリセットでも「いい感じ」に揺れる。揺れにくければ揺れやすさを少し上げる・入力影響を上げる。収束を下げるとゆったり収まる。

### 対称パーツは片側を作って反転コピー／パラメータのキーは最小限
- 出典: 或iA / note（Live2D アドカレ2023）/ 2023-12-13
- リンク: https://note.com/aria_0629/n/n9681ecd86602
- 画像: なし
- 要点: 初心者のミスとして、左右を別々に作る、キーを打ちすぎる（予期せぬ動き・データ破綻）、デフォーマが少なすぎる（揺れの豊かさが出ない）、絵師の絵柄を崩す、を挙げる。
- seed 外（総合）

### 左右非対称なパーツはデフォーマだけ反転して中身を差し替える
- 出典: Tara（@TaraRaizu）/ X 投稿（検索結果のスニペット経由）
- リンク: https://x.com/TaraRaizu/status/1958569506533491079
- 画像: なし
- 要点: 形が似ているが完全対称ではない髪束などで、デフォーマだけを反転して別のアートメッシュを入れると、ゼロからやり直さずに済む。
- seed 外（総合）

### ブレンドシェイプ運用の注意（公式）
- 出典: Live2D 公式マニュアル「ブレンドシェイプ」（検索結果の要約経由）
- リンク: https://docs.live2d.com/en/cubism-editor-manual/blend-shape/
- 画像: なし
- 要点: 全パラメータのデフォルト値にキーを打ってデフォルト形状をロック。デフォルト形状を変えると全ブレンドシェイプの挙動が変わる。同じオブジェクトの同じ属性を同時に複数で操作するとモデルが複雑化する。

### 腕の物理は上腕と前腕のつなぎ目をグルーで
- 出典: surume1ka.com（検索結果の要約経由、ページ取得は DNS エラー）
- リンク: https://surume1ka.com/archives/2238
- 画像: なし
- 要点: 角度Y や体の回転Y に合わせて腕をふんわり揺らす。上腕・前腕のつなぎ目は事前にグルーでバインドすると不自然な形になりにくい。
- seed 外（腕）

## X への手がかり
- @live2dcs（Live2D Creative Studio）: マスク反転で影を作る小技投稿 https://x.com/live2dcs/status/1304359029280563203 （検索で直接ヒット）。公式 note「白井くん」記事の制作元。
- @Live2D 公式の参考ツイート https://twitter.com/Live2D/status/1203517857059033088 （乾物ひもの氏の物理演算記事で参照）
- @cillia: 体バウンド等の物理演算学習モデルの作者。乾物ひもの氏の記事で参照。portal は https://cillialive2d.carrd.co/
- @himono_vtuber（乾物ひもの）: 物理演算裏技、書籍共著者
- @ku_shi（乃樹坂くしお）: 遅延物理演算
- @makotok1: アクセサリー揺れ・光表現
- @rariemonn765（rariemonn）: グルー活用法
- @MegaJujube（Jujube）: 生きてる感テクニック
- @greenshieru_01（彩。）: 後追い（フォロースルー）
- @tatoosk_karaage（ひたつら）: 高可動域、前後切り替え
- @7name_（ナナメ）: 眼鏡、きれいなデータ
- @monn_157（もん11）: 自然な揺れ・反射面の時間差
- @TaraRaizu（Tara）: 非対称パーツの反転デフォーマ小技
- ハッシュタグ「#スカート揺らそう企画」: BOOTH のなつき農園「スカート揺れサンプル」の説明文で見かけた。スカート揺れの作例が集まっている可能性。
- ハッシュタグ「#Live2Dアドカレ」: Adventar の Live2D Advent Calendar（2019: https://adventar.org/calendars/4268 、2021: https://adventar.org/calendars/7003 、2023: https://adventar.org/calendars/8580 ）。未読の候補記事多数（例: 2021-12-06「回転ギミックと透明マスクを使った前後跨ぎギミック」fanbox、2023-12-10 アニメ風水面の光、2023-12-18 メッシュ辺のつなぎ方、2021-12-01「きれいなLive2Dデータを作ろう」）。

## 検索記録
- 「Live2D 服 揺れ コツ」「Live2D 上級 テクニック まとめ」「Live2D スカート 揺れ 作り方 デフォーマ」「Live2D 乗算色 スクリーン色 活用」「Live2D デフォーマ 階層 組み方 定石」「Live2D リボン 揺れ 物理演算 note」（standard モード）: 書籍・itch.io の有料サンプル・公式マニュアルばかりで、個人ブログがほぼ出なかった。
- site:note.com 指定は note がヒットせず無効だった。extended モードに切り替えると note・個人ブログ（CGbox、saraemi、unitypull、nnwarks、castcraft 等）が出るようになった。
- 「Live2D 服 しわ 袖 裾 揺れ モデリング 解説 ブログ」「Live2D クリッピング 反転マスク 使い方 テクニック 影 服」「Live2D メガネ 眼鏡 角度 モデリング」「Live2D Advent Calendar アドカレ 物理演算」「Live2D 宝石 キラッ 光 反射」「Live2D フリル ネクタイ 襟 揺れ」「Live2D スカート 裏地 足 前後 描き足し」「Live2D 風 なびき 常時 揺れ」（extended）: アドカレ一覧が最も効率の良い入口だった。
- 英語「Live2D advanced rigging tips clothing physics」「Live2D rigging mistakes beginners」「Live2D multiply color screen color shading」「Live2D deformer hierarchy best practice」「Live2D rigging secondary motion squash stretch」「Live2D hat rigging」「Live2D wings cape rigging」「Iron Vertex Live2D tips」: 販促ブログ（VIVERSE 等）、有料コース（Coloso、Gumroad、itch.io）、YouTube が中心で、文章で読める具体的テクニックは日本語より少ない。Reddit は本体がヒットせずミラーのスニペットのみ（腕の振り子を3点→2点に減らしたら良くなった、という話を見かけたが元スレ URL を特定できず不採用）。
- 帽子・袖のシワ・ネクタイ専用の解説は見つからなかった（帽子は「頭の角度に直接付けるか augmented physics」程度の言及のみ）。
- 動画（YouTube、TikTok）は説明文しか読めないため、Shorts 1件のみ説明文ベースで拾った。Coloso 等の有料講座は目次レベルで中身が読めないため拾っていない。
- ko-fi（403）、surume1ka（DNS エラー）、vtubermodelcommissions（取得失敗）は検索結果の要約のみで記録。
