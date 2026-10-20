# 集めるメモ（Web）: 体の角度と呼吸、腕と手、パーツ間の連動

> フェーズ1（集める）の生メモ。原文用語のまま、加工前。調査日: 2026-10-19。

## メモ

### 顔と体を同時に動かさない（体が遅れて追従／体の向きに顔が付いてくる）
- 出典: Live2D 公式 / Cubism Editor チュートリアル「Motion Quality Improvement Tips」
- リンク: https://docs.live2d.com/en/cubism-editor-tutorials/motion-hint/
- 画像: https://docs.live2d.com/wp-content/uploads/2019/05/bd3c788e616a7bbb0259bec5654bbbb6.gif , https://docs.live2d.com/wp-content/uploads/2019/05/c453ec39eca8103aef653ffc575a3c16.gif , https://docs.live2d.com/wp-content/uploads/2018/05/01666329704521214235324ff14326fa.gif
- 要点: 頭だけ回すと不自然なので体の X・Z も一緒に動かす。ただし完全同時は機械的に見えるので、体を少し遅らせる（逆に体が先行して顔が後から向く形もある）。

### 反動・ブレーキ（止まる時に少し行き過ぎて戻る）、腕は発話・頭と同時に動き出す
- 出典: Live2D 公式 / 同上
- リンク: https://docs.live2d.com/en/cubism-editor-tutorials/motion-hint/
- 画像: https://docs.live2d.com/wp-content/uploads/2019/05/b03d955ff82239a724c7e1e691343a57.gif , https://docs.live2d.com/wp-content/uploads/2019/05/e60ce489197c2a67770d561bc4aab3be.gif
- 要点: 動きの終わりは少しオーバーシュートしてから収まる。腕の動き出しをセリフや頭の動きに合わせると全身で動作を始めたように見える。顔向き変化時にまばたきを入れる。大人男性はぶれを抑え、少女は全身を大きく＋首かしげ多め。

### 体 Y は 3 点（上・中・下）、体 Z は「横スライドではなく弧状に曲げる」、足は浮かせない
- 出典: Live2D 公式 / Cubism Editor チュートリアル「4. Adding Body Movement」
- リンク: https://docs.live2d.com/en/cubism-editor-tutorials/deformer/
- 画像: https://docs.live2d.com/wp-content/uploads/2017/10/22_02.png , https://docs.live2d.com/wp-content/uploads/2017/10/24_02.png
- 要点: 上下用と傾き用でワープデフォーマを 2 段にする。体 Z の傾きは弧状のしなりで作り、足は接地を保つよう変形させる。男性キャラは重心移動を入れると自然。

### 腕を上げると細く見えるので太さ補正パラメータを足す
- 出典: Live2D 公式 / 同上
- リンク: https://docs.live2d.com/en/cubism-editor-tutorials/deformer/
- 画像: https://docs.live2d.com/wp-content/uploads/2017/10/17_02.png , https://docs.live2d.com/wp-content/uploads/2017/10/12_02.png
- 要点: 腕は回転デフォーマに入れ、基準角度を腕の向きに合わせておく。回転だけだと上げた腕が痩せて見えるので、アートメッシュ側に太さ調整を入れる。

### 標準パラメータに「肩すくめ」「腕 A/B」「手」がある（必要時のみ）
- 出典: Live2D 公式 / Cubism Editor マニュアル「Standard Parameter List」
- リンク: https://docs.live2d.com/en/cubism-editor-manual/standard-parameter-list/
- 画像: なし
- 要点: 体の回転 XYZ は ±10、呼吸 0〜1、ParamShoulderY（肩すくめ）、ParamArmLA/RA/LB/RB（±30、腕を A/B の 2 系統）、ParamHandL/R が用意されている。可動域の大きい腕では 50 や 100 も使うとの注記。

### 3D 回転表現は「まだキー編集していないオブジェクト」に使う
- 出典: Live2D 公式 / Cubism Editor マニュアル「Application of 3D Rotation Expression」
- リンク: https://docs.live2d.com/en/cubism-editor-manual/apply-3d-rotation-expression/
- 画像: ページ内にあり
- 要点: 自動生成で既存キーフォームが置き換わるため、手付け前のものに適用する。パース強度 0 で平行投影、上げるとカメラが近い見え方。体の回転にも使われる（itch.io の body study も体 XYZ にこの機能を使用）。

### 体 X と体 Y を別々に作り、結合（4 隅の合成）で斜めを作る
- 出典: Live2D Creators Forum / Hecate の回答
- リンク: https://community.live2d.com/discussion/1933/questions-about-body-xyz-rigs
- 画像: なし
- 要点: 左右と上下を独立に作り、パラメータ横の鎖アイコンで結合して斜め方向を補完させる。手で斜めを全部作らなくてよい。

### 体 XY は顔 XY ではなく体の回転パラメータに付け、物理演算で顔に追従させる
- 出典: もいもい / note「Live2Dモデル制作～販売まで⑥ -身体のモデリング-」/ 2025-07-16
- リンク: https://note.com/moimoi_sp/n/n5310a594e40d
- 画像: https://assets.st-note.com/img/1752669920-ev9WIpP5KSTykUizOmC67Nl3.png?width=1200 , https://assets.st-note.com/img/1752670359-iW9lywF7ZjOLbcNq0sRTQh1V.png?width=1200
- 要点: 後の修正が楽で、物理で自然な追従になる（代わりにプレビューは物理設定画面でしか見られない）。体 Z は崩れやすいので顔 Z と同じパラメータに乗せている。脚以外を大きな 1 枚のワープに入れて呼吸・Z カーブ・頭連動の首 Z を付ける。

### 下を向くと手を少し開く／脚は極端な傾きの時だけ膝を曲げる
- 出典: もいもい / note（同上）/ 2025-07-16
- リンク: https://note.com/moimoi_sp/n/n5310a594e40d
- 画像: https://assets.st-note.com/img/1752564321-0SXQ73GgsnWiMJdVNof8mD1L.png?width=1200
- 要点: 腕は XY 程度に抑え、手先だけブレンドシェイプで揺らす。下向き時に手を広げると女性らしく見える。脚は安定重視でほぼ固定、体 Y 下で膝をやや内に、極端な Z でわずかに曲げる。

### 尻尾を呼吸パラメータに連動
- 出典: もいもい / note（同上）/ 2025-07-16
- リンク: https://note.com/moimoi_sp/n/n5310a594e40d
- 画像: https://assets.st-note.com/img/1752587347-CQXxJWoVwK4mvHLnrkeESz97.png?width=1200
- 要点: 常時動く呼吸パラメータに尻尾の動きを紐付けて生き物感を出す。尻尾はデフォーマパス＋スキニング（重いので表示切替を用意）。
- seed 外（揺れもの寄り）

### 呼吸パラメータの範囲を -2〜2 に広げる（深呼吸・ため息用）
- 出典: トライタム / はてなブログ「呼吸パラメータのススメ」/ 2016-06-08
- リンク: https://traitam.hatenablog.com/entry/2016/06/08/%E5%91%BC%E5%90%B8%E3%83%91%E3%83%A9%E3%83%A1%E3%83%BC%E3%82%BF%E3%81%AE%E3%82%B9%E3%82%B9%E3%83%A1
- 画像: http://cdn-ak.f.st-hatena.com/images/fotolife/t/traitam/20160608/20160608231341.png , http://cdn-ak.f.st-hatena.com/images/fotolife/t/traitam/20160608/20160608231615.gif
- 要点: 通常アイドリングは ±1 で往復させ、±2 の端に「深く吸う（息をのむ）」「吐き切る（ため息・意気消沈）」を割り当てて演技に使う。

### 呼吸の変形を性別で変える／フードなどは呼吸デフォーマから外す
- 出典: Jujube / note「Live2Dモデルの生きてる感をUPさせるひと手間」/ 2019-12-11（Live2Dアドカレ2019）
- リンク: https://note.com/dreamemulator/n/n3aaf39e93d96
- 画像: https://assets.st-note.com/production/uploads/images/16773190/picture_pc_c3cad5fec38b0001fa96c6e7da10691e.png?width=1200
- 要点: 男性は腹式・女性は胸式を意識して膨らむ場所を変える。呼吸で不自然に膨らむパーツ（パーカーのフード等）は Breath のデフォーマから分離する。

### 輪郭が仮面のように浮く時は首が太すぎる／首かしげでは首も一緒に動かす
- 出典: Jujube / note（同上）/ 2019-12-11
- リンク: https://note.com/dreamemulator/n/n3aaf39e93d96
- 画像: ページ内にあり
- 要点: 顔が浮いて見える原因が首の太さのことがある。アニメ的に首を細めにし、頭を傾けるときは首も動かす。

### 固視微動（目の微細なブレ）をアイドルに入れる
- 出典: Jujube / note（同上）/ 2019-12-11
- リンク: https://note.com/dreamemulator/n/n3aaf39e93d96
- 画像: https://assets.st-note.com/production/uploads/images/16772281/picture_pc_7dc7e3b0b8420356e85a87134d6ed44e.gif?width=1200
- 要点: 見つめていても目は微かに動き、横移動はカクッと動く。アイドリングに瞳の小さなブレを入れる（やりすぎると眼振に見える）。
- seed 外

### 角度 Z の頭回転の親を「体の回転 Z」に紐付く上半身回転にする
- 出典: 伊糖だねこ / note「Live2D練習記録⑤ ー モデリング Z軸 ー」/ 2025-12-08（2026-01-27 追記）
- リンク: https://note.com/itodaneko/n/ne0c746dac25a
- 画像: https://assets.st-note.com/img/1765172448-q61AX2i85MVByrmunSvefTIp.jpg , https://assets.st-note.com/img/1765172609-vzqMh06f13Ok2GTrF9wcInPU.jpg , https://assets.st-note.com/img/1765172708-HQCEhkOoIurKMBi9WRxnVa5c.jpg
- 要点: 体が傾いたら頭部を回転デフォーマごと左右にずらし少し下げる。体 Z 反転で頭がずれる問題は、頭回転の親を上半身回転にすると減った。頭 Z は ±20〜30 程度が上限（傾けすぎは怖い）。

### 体 Z は関節ごとの回転デフォーマ＋硬さ補いのワープ、靴は回さない
- 出典: 伊糖だねこ / note（同上）
- リンク: https://note.com/itodaneko/n/ne0c746dac25a
- 画像: https://assets.st-note.com/img/1765172609-vzqMh06f13Ok2GTrF9wcInPU.jpg
- 要点: 腰・肩・肘・股関節・膝に回転デフォーマ、手・首・上半身・スカートにワープ。球体パーツ（鈴など）は歪ませたくないのでワープに入れない。物理で「角度 Z → 体の回転 Z」の追従。

### 体 XY は「手前で大きく動くパーツ」から作る。腕は下向きで上がり、上向きで下がる
- 出典: 伊糖だねこ / note「Live2D練習記録⑦ 体のX・Y軸と角度補正」/ 2026-01-07
- リンク: https://note.com/itodaneko/n/ndbaa6da2927f
- 画像: https://assets.st-note.com/production/uploads/images/242066373/picture_pc_31f7010e18a16ba10d7bd24f43dc9406.gif?width=1200
- 要点: 胸→胴→襟→袖→首の順。手前の脚を約 1% 大きく、腕は約 3% 拡縮して袖に合わせる。体 Y 下で内股・腕が上がる、上で膝が伸び腕が下がる。左右非対称なので反転コピーせず手動。

### 角度補正ブレンドシェイプ（特定角度だけ効く補正）と腕の前後を描画順パラメータで切替
- 出典: 伊糖だねこ / note（同上）/ 2026-01-07
- リンク: https://note.com/itodaneko/n/ndbaa6da2927f
- 画像: https://assets.st-note.com/img/1767776276-WCFfDzuhAr87SVP4oJR0ycEp.jpg?width=1200 , https://assets.st-note.com/img/1767776393-CwZSQUHELjb9inksIqyGxB4O.jpg?width=1200
- 要点: 0〜1 の補正用ブレンドシェイプを作り「重みの制限」で特定角度のみ効かせる。腕とスカートの前後は左右別のパラメータで描画順を切替。XYZ が掛け合わさらないよう位置用デフォーマを親に置く。

### 頭→首→体の Z 連動を親子で組む（首の Z 曲面に頭の Z 回転を入れる）
- 出典: 朝野ねごと / note「Live2D備忘録6 頭を傾ける」/ 2021-06-21
- リンク: https://note.com/asanonegoto/n/nf34d2d32b760
- 画像: https://assets.st-note.com/production/uploads/images/55066299/picture_pc_ba56138317f18e5af1e1270547345d3e.gif?width=1200 , https://assets.st-note.com/production/uploads/images/55067903/picture_pc_188317d44eeba001195e29e4e343ceb6.gif?width=1200
- 要点: 首の Z 曲面の中に頭の Z 回転を入れ、さらに身体のワープの中に首 Z 曲面を入れて三段の連動にする。呼吸は身体 Z 曲面に 2 点、1 で体を少し伸ばし肩と胸を開く。

### 首パーツは上向き用に大きくはみ出して描く／斜め上で首を大きく曲げて顎下を出す
- 出典: 乾物ひもの / note「Live2D 高可動域モデルの顔の角度XYのすすめ②」/ 2021-04-02
- リンク: https://note.com/himono_vtuber/n/n19828b07b8a3
- 画像: https://assets.st-note.com/production/uploads/images/48805082/picture_pc_8a83bddc9177d9795a4f2ae7e68d829c.png?width=1200 , https://assets.st-note.com/production/uploads/images/48805111/picture_pc_2e9afddd286313e81f70ee05d17d8d40.gif?width=1200 , https://assets.st-note.com/production/uploads/images/48805114/picture_pc_78a8a80a88e5040d3aaa3e1562e901c5.gif?width=1200
- 要点: 上を向いたとき用に首は大きめに。首の影に境目があるなら影を別パーツにして動かす（首影は乗算で描いた例）。体が正面なら首の X 移動はほぼ不要、体が斜めなら首も顔に合わせる。

### 首の影は「輪郭塗りのコピーを乗算にして下にずらし、線画にクリッピング」
- 出典: もいもい / note「Live2Dモデル制作～販売まで④ -顔のモデリング-」
- リンク: https://note.com/moimoi_sp/n/n7cd8b45dbc5f
- 画像: ページ内にあり
- 要点: 顔の輪郭塗りパーツを複製し、影色より薄い乗算色・乗算ブレンドにして少し下へずらす。XY の 3 点打ちで向きに合わせて調整。（検索結果の要約経由、本文は未確認）

### 首は耳の中央くらいまで描いておく／首デフォーマを 2 つ（胴体側と顔との付け根）
- 出典: 恒石涼平 ほか / note（検索結果の要約経由）
- リンク: https://note.com/ryodist/n/n73e8fbcb6f7d
- 画像: ページ内にあり
- 要点: 斜め下を向いた時に見える範囲を考えると耳〜鎖骨をカバーする量が要る。変形は縮めるより大きくする方が難しい。（この 2 点は検索要約からで本文と対応未確認）

### 頭の回転軸は「頭と首の繋ぎ目」、首は別パラメータで頭より大きく傾け、足し算の傾けすぎに注意
- 出典: 恒石涼平 / note「185 Live2D編k：頭を傾けるのは結構複雑」/ 2021-12-07
- リンク: https://note.com/ryodist/n/n73e8fbcb6f7d
- 画像: https://assets.st-note.com/img/1638844015465-pj1XNa1zUX.png , https://assets.st-note.com/img/1638844509235-27Yed2Ajiy.png
- 要点: 頭の軸は顎より少し上。頭 Z は左右 18 度程度。首元中心の回転で首 Z を別に作り、首元と体の接続部はワープで整える。頭と首の傾きが合算されると傾きすぎるので実使用の最大値は控えめに。

### 首の回転支点は見た目より奥、首は鎖骨の付け根から段階的に曲げる
- 出典: 谷屋楽 / note「Live2Dモデリング Tips 現実ではどう動く？当たり前を大事に」/ 2021-04-28
- リンク: https://note.com/taniya001/n/n4ce363b09452
- 画像: https://assets.st-note.com/production/uploads/images/50838619/picture_pc_b5eee2aac78c742009da4b5442b628b9.png?width=1200 , https://assets.st-note.com/production/uploads/images/50837199/picture_pc_b3b790cc722eb01af8ff2670a6be76ee.gif?width=1200
- 要点: 首を横に倒すと支点が奥にあるため少し横にスライドして見える。見た目の接点で一気に折らず、鎖骨の付け根から段々曲げる。自分の鎖骨のくぼみに指を当てて確かめる。

### 腕を上げる時の根元は肩ではなく鎖骨
- 出典: 谷屋楽 / note（同上）
- リンク: https://note.com/taniya001/n/n4ce363b09452
- 画像: https://assets.st-note.com/production/uploads/images/50837437/picture_pc_5caedbc265e178411a58e3a6d656d85e.png?width=1200
- 要点: 腕の動きを鎖骨側から設計する。肩を大きく上げる等の筋肉の影響が大きい動きは手で調整。襟は前側と後ろ側で表裏を分けて首へのめり込みを防ぐ。

### 腕の「立体表現」パラメータ（手前に突き出す）を肩・肘・手首回転に加える
- 出典: makotok1 / note「Live2D 腕の立体表現のススメ」/ 2019-11-27
- リンク: https://note.com/makotok1/n/n66c575df14c9
- 画像: https://assets.st-note.com/production/uploads/images/16362299/picture_pc_3dcf0200e7d66aecd240fafcb2eca442.gif?width=1200 , https://assets.st-note.com/production/uploads/images/16362316/picture_pc_aaea4611b5a621cdc04400ca32db2197.gif?width=1200 , https://assets.st-note.com/production/uploads/images/16362409/picture_pc_e9db2ca378d04534ab8fdcfebc27f490.gif?width=1200
- 要点: 肩〜肘・肘〜手首・手の 3 グループをそれぞれワープで包み、外側から調整。手前に来るほど大きく、肩からの長さを短く（短縮法）。肘回転パラメータとの全組合せで破綻しないようにする。

### 肩から手先へ向かうほどキーを後ろにずらすと腕がしなやか
- 出典: makotok1 / note（同上）
- リンク: https://note.com/makotok1/n/n66c575df14c9
- 画像: https://assets.st-note.com/production/uploads/images/16362361/picture_pc_f689af9e09437d76f251027dfb3bad26.gif?width=1200
- 要点: モーション付けで、回転 3 種のキーを打ってから立体パラメータを足し、末端ほどタイミングを遅らせる（オーバーラップ）。

### 肘は「上腕側を半円、前腕の切れ目を半円の中心に通す」＋回転デフォーマを半円の中心へ
- 出典: kw_nmnm / はてなブログ「Live2Dで可動域の広い腕もとい肘を作るときのコツ」/ 2018-11-06
- リンク: https://kw-nmnm.hatenablog.com/entry/2018/11/06/203151
- 画像: https://cdn-ak.f.st-hatena.com/images/fotolife/k/kw_nmnm/20181106/20181106201508.png , https://cdn-ak.f.st-hatena.com/images/fotolife/k/kw_nmnm/20181106/20181106201616.png , https://cdn-ak.f.st-hatena.com/images/fotolife/k/kw_nmnm/20181106/20181106202034.gif
- 要点: 原画段階で関節を円で設計し、補助の透けた円を置いて位置合わせ。まず無変形で回して破綻しない状態にしてから、頂点を円の表面に沿って滑らせて肘を作る。キーは切りの良い角度で最大 5 点程度。肩・手首にも応用可。

### 球体関節のような丸い肘パーツ／前腕の伸縮パラメータで回転弧を縮める
- 出典: marunaru / note「Live2Dモデリングでダイナミックに動く腕を作ろう！」/ 2021-03-31
- リンク: https://note.com/marunaru82/n/n03aea05f41d0
- 画像: https://assets.st-note.com/production/uploads/images/46928428/picture_pc_e676000bc6616038287a248266daa6f0.png?width=1200 , https://assets.st-note.com/production/uploads/images/46906378/picture_pc_a7c0301c1ae764f469e0adc1f458d4e6.gif?width=1200 , https://assets.st-note.com/production/uploads/images/46907667/picture_pc_71b97e55bdbe34b95d72dbbe8d32044c.gif?width=1200
- 要点: 円形の関節パーツを挟めば上腕と前腕は繋がるだけでよい。前腕を縮めると回転弧が小さくなり腕を上げた時に立体的に見える。回転ガイド付近の影は薄くしてもらう。柄物袖・肘丈袖・垂れ袖は高コスト。

### 腕は手→前腕→上腕の順に作る／上腕を動かすと胴体・襟・脇・胸も動かさないと脱臼に見える
- 出典: 恒石涼平 / note「186 Live2D編l：腕を動かして身振り手振り」/ 2022-01-14
- リンク: https://note.com/ryodist/n/n2a2b17463aeb
- 画像: https://assets.st-note.com/production/uploads/images/67713441/picture_pc_1a282b8d5cbe7e650f21f806b99e3ee0.gif?width=1200 , https://assets.st-note.com/production/uploads/images/67717097/picture_pc_8ce6d5b7c6a7f52215ba006f5c533615.gif?width=1200 , https://assets.st-note.com/img/1639440701866-4REjLsnN9x.png?width=1200
- 要点: 手首を内に曲げると甲が少し出て内側が膨らむ、外に曲げると甲が反り掌に窪み。肘を上げる時は丸め、内曲げで少し出っ張らせる。肩の上下に合わせて服が引っ張られるようにする（胸の形を崩さない程度）。2 パラメータの同時動作を必ず確認。

### 指・袖は腕と同じパラメータに登録して一緒に動かす／1 パーツのパラメータは最大 3 つ
- 出典: kw_nmnm / はてなブログ「【Cubism2.1】FGOバトルキャラ風Live2Dモデルの作り方【後編】」/ 2017-04-25
- リンク: https://kw-nmnm.hatenablog.com/entry/2017/04/25/224340
- 画像: https://cdn-ak.f.st-hatena.com/images/fotolife/k/kw_nmnm/20170424/20170424004830.png
- 要点: 肩→肘→手首の回転デフォーマを人形の関節のように入れ子に。左右と上下を同じパーツに載せると組合せ地獄になるので親子デフォーマに分けて割り振る。呼吸や手足など大きな動きを先、揺れものは後。動いていないパーツにもごく小さなブレを入れる。

### グルーで肩・肘の関節ずれを一括解決（体 Y × 回転デフォーマの肩ずれ）
- 出典: rariemonn / note「Live2Dグルー活用法」/ 2021-12-05（Live2Dアドカレ2021）
- リンク: https://note.com/rariemonn/n/nd4eee57f9de3
- 画像: https://assets.st-note.com/production/uploads/images/67129488/picture_pc_c5adcfcfee8b5088fc4d300bb908ffe3.gif?width=1200 , https://assets.st-note.com/production/uploads/images/67130026/picture_pc_2e146884b14bb96a7d329651f6b79a1d.gif?width=1200
- 要点: 体 Y と回転デフォーマを併用すると肩がずれやすいがグルーで繋げば一度で済む。胸の付け根の固定にも使う。重みは既定で半々、片側 100% にすると編集しやすい。

### 横髪・後ろ髪をグルーで上下分割し「上は顔 XY 追従、下は揺れ」
- 出典: rariemonn / note（同上）
- リンク: https://note.com/rariemonn/n/nd4eee57f9de3
- 画像: https://assets.st-note.com/production/uploads/images/67132932/picture_pc_d9afe2db2bcef947e031e28ab1d0b5bd.jpg?width=1200
- 要点: パーツを分けてグルーで繋ぎ、担当パラメータを分けることで 1 パーツあたりのパラメータ数を 2 つに抑える。
- seed 外（髪だが連動の考え方として）

### 物理演算で「入力=顔の角度、出力=体の角度」→体が遅れて付いてきて少し戻る
- 出典: 乾物ひもの / note「こんなことまで出来る！？Live2Dの裏技的物理演算活用法」/ 2021-12-11（Live2Dアドカレ2021）
- リンク: https://note.com/himono_vtuber/n/n9015f0030d53
- 画像: https://assets.st-note.com/img/1639199811467-ug50c4DNXI.png , https://assets.st-note.com/img/1639202245611-AvPJgX8xrV.png
- 要点: 体の追従に加え「一瞬大きく動いて少し戻る」動きで生き生きする。顔と体を逆にすると大人っぽく色気のある動き。体パラメータを複製し元を入力・複製を出力にするとトラッキングアプリで顔と体を別調整できる。

### 体 Y バウンド（弾み）と上半身・下半身の分離
- 出典: 乾物ひもの / note（同上）
- リンク: https://note.com/himono_vtuber/n/n9015f0030d53
- 画像: https://assets.st-note.com/img/1639204762044-mpGEjIvulo.png , https://assets.st-note.com/img/1639206760719-nxf8OidBOg.png
- 要点: 体 Y を位置 X 入力にした専用の振り子を体追従グループに足し、反転有無でキビキビ／ゆったり切替（グループ順に注意）。上半身＝体 Y、下半身＝位置 Y に分け、前かがみで脚が伸び反ると曲がる。入力・中継・出力パラメータを挟んで物理でブレンドする手法も。

### 体 XYZ に反動の揺れ（2 段目を揺れとして別に作る）
- 出典: 音芽ケイ / note「体のXYZに反動の揺れを入れると、なんとなくクオリティが上がるお話。」/ 2023-12-23（Live2Dアドカレ2023）
- リンク: https://note.com/otome_kay/n/nbb434c9a0054
- 画像: https://assets.st-note.com/production/uploads/images/125349573/picture_pc_461407dd25ca79c4f85b0e870a117b8a.gif?width=1200 , https://assets.st-note.com/production/uploads/images/125349616/picture_pc_8fc46b82234f54a33a9f7b382a36a43c.gif?width=1200 , https://assets.st-note.com/img/1703301658575-qr0safli73.png?width=1200
- 要点: 体 XY は位置入力、Z は角度入力の振り子（3 点・出力は 2 段目）で、動いた後に戻る反動を出す。体 XYZ を二段階で作り二段目を揺れ用に。Y の反動が最も映える、胸揺れのないモデルに効く。

### 物理演算の「遅延」パラメータを多段連結して時間差を作る
- 出典: 乃樹坂くしお / note「Live2D制作における物理演算の遅延の導入」/ 2023-12-09
- リンク: https://note.com/ku_shi/n/n6c99cfcb3c4a
- 画像: https://assets.st-note.com/img/1702050358068-YD9CDODH1n.png , https://assets.st-note.com/img/1702051413363-fsRJego13U.png , https://assets.st-note.com/production/uploads/images/123995307/picture_pc_5b313aae45a8c12c9c98c3c724a639e7.gif
- 要点: 前段の出力を次段の入力にする遅延パラメータを 3 段つなぎ、段ごとに遅らせる。体の回転にも同様に適用、上半身と下半身の時間差でひねりを表現。動き始めに逆ベクトルを加える反動、呼吸に遅延をかけて装飾を自動で動かす手法も。

### 腰を動かせ（重心を支持基底面の上に戻す）
- 出典: 納内れお / note「Live2Dモデルはとにかく腰を動かせ！」/ 2021-04-16
- リンク: https://note.com/nanaireo/n/n1449ceb4e242
- 画像: https://assets.st-note.com/production/uploads/images/45892938/picture_pc_6878bfea0ffaaab5541186af5674267b.gif?width=1200 , https://assets.st-note.com/production/uploads/images/45892995/picture_pc_cd4429caa2d8522ffbca6129b602c8d2.gif?width=1200 , https://assets.st-note.com/production/uploads/images/45892956/picture_pc_2875bc24702145dc2da16844a7c7bc74.gif?width=1200
- 要点: 上半身だけ傾けると転びそうに見えるので腰も一緒にずらす。片脚重心で斜に構える、肩と腰を互い違いに傾けるとセクシー。腕や脚で重心補正しすぎるとバンザイ等の手アニメと干渉する。鏡で自分を観察。

### 肩を首と同方向に倒すと元気、逆方向でおしとやか／軸足と脚のポーズで性格づけ
- 出典: 飛鳴りんつ / note「Vtuberモデルをもっと“自分らしく”動かそう！Z軸のススメ」/ 2021-12-17（Live2Dアドカレ2021）
- リンク: https://note.com/597_lintz/n/na996f6e982b3
- 画像: https://assets.st-note.com/production/uploads/images/67960475/picture_pc_fbec364204d3f6660ca8952bdbb0fbda.gif?width=1200 , https://assets.st-note.com/production/uploads/images/67960512/picture_pc_73b5150a4f1e2df9fda0cceb7c751f85.gif?width=1200 , https://assets.st-note.com/production/uploads/images/67960574/picture_pc_2580280d281d7159a37eab991e451eac.gif?width=1200
- 要点: 体 Z の重心は腰から上を動かし軸足を変える（がっしり男性向き）。片足を曲げて浮かす＝かわいい、伸ばして上げる＝おてんば、接地のまま体重移動＝お姉さん。首と肩を近づける動きはリズミカルで歌枠向き。

### 手の裏表：掌パーツを反転して少し描き込めば裏面に／手首を隠すパーツ
- 出典: めてねぇ / note「ここが知りたかった!!LIVE2Dハンドトラッキング」/ 2021-12-12（Live2Dアドカレ2021）
- リンク: https://note.com/metenee_28/n/ncd00689b814d
- 画像: https://assets.st-note.com/production/uploads/images/67501214/picture_pc_c826e7bd20eb463c46d7779398f453e7.gif , https://assets.st-note.com/production/uploads/images/67501945/picture_pc_6ecdd6b3f4238ab285df878194e5d5c3.gif
- 要点: 掌と腕は別パーツにしてグルー接続。指の第一関節に表裏パーツ（カリング利用）、第三関節上に線を描くと握り拳の山が作りやすい。手首を隠すパーツがあれば裏返し用の前腕パーツが不要。陰影やシワは少なめに。

### 指 1 本を -180〜180 回転＋開閉で作る（素材を開閉区間で分けて裏返りを防ぐ）
- 出典: hal / note「Live2Dで手を作ってみる」/ 2022-04-24
- リンク: https://note.com/hal0x0/n/naff761d33fb4
- 画像: https://assets.st-note.com/production/uploads/images/77089435/picture_pc_e422db422e1756e378925a586ae3b86b.gif , https://assets.st-note.com/img/1650784698038-ixexSaeY4B.jpg , https://assets.st-note.com/img/1650791840483-uJaUnbWQTh.jpg
- 要点: 基準は基節を曲げず指をふんわり曲げた形。回転 X を ±180/±90/0、開閉 0/0.5/1 で打つ。0〜0.5 と 0.5〜1 で指先・中節の素材を分ける。爪はカリングで裏返ると非表示。「キーを打たずにロスト」させると残像が出ない。

### 手差分は肘下から描き直し、不透明度で切替（通常腕は少し上がりながら消える）
- 出典: 伊糖だねこ / note「Live2D練習記録⑨ ー 差分作成ー」
- リンク: https://note.com/itodaneko/n/ne16209ddafb5
- 画像: ページ内にあり
- 要点: 通常の腕を変形させて手差分を作るより、肘下から差分を描いた方が楽。差分が現れ通常が消える不透明度に、動きも付けて自然に切替える。（検索要約経由）

### 腕差分は排他（同系統の腕を同時表示しない）／指は動かすなら 1 本ずつ分ける
- 出典: もいもい / note「⑦ -差分のモデリング-」、せみこ / note「Live2Dのパーツ分け」
- リンク: https://note.com/moimoi_sp/n/n1375ae2f2d09 , https://note.com/kamibukuro_0/n/n12d9227a6d56
- 画像: ページ内にあり
- 要点: 腕差分の表示時は似た腕差分を 0 にして同時表示を防ぐ。指を動かすなら 1 本ずつ分割、手 1 パーツでも多少は動かせる。（検索要約経由）

### 歩行ループは「片道制」（-30 に着いたら 30 へ直接戻す）
- 出典: ヱノプルギスの夜 / note「【Live2D】キャラクターを歩かせてみる」/ 2021-07-27
- リンク: https://note.com/enoken/n/n9feebec64419
- 画像: https://assets.st-note.com/production/uploads/images/57540718/picture_pc_acff06d3d08cd00a04341716bca36122.png?width=1200 , https://assets.st-note.com/production/uploads/images/57575122/picture_pc_b789cce743aeb7b42bdd34b715dfcefa.png?width=1200
- 要点: 往復させず 30→-30 で一周させ、両端で同じ位置になるよう設定。前に出す動きは戻すより速いので -20 を前出し位置に。肘・膝は可動域分を描き足し丸みを持たせる。奥の腕は関節分けせず 1 パーツ。
- seed 外（歩行）

### ループモーションで角度 Z と体 Z を約 2 フレームずらす
- 出典: makotok1 / note「Live2Dの自然できれいなループモーションの作り方」/ 2021-12-18
- リンク: https://note.com/makotok1/n/nad6a9605bac8
- 画像: https://assets.st-note.com/production/uploads/images/67793283/picture_pc_c271f3f58ba594e79d969e07fbd5615f.gif?width=1200
- 要点: 体の傾きに頭が少し遅れて付いてくるように 2 フレーム程度オフセット。始点終点はキー無しで作り、全体をコピーして前後に貼ると継ぎ目のカーブが滑らかになる。

### 呼吸パラメータに翼などを連動、同期しすぎるなら反応区間の違う親デフォーマを重ねる
- 出典: Live2D Creators Forum / Joyco / 2020-05
- リンク: https://community.live2d.com/discussion/738/is-there-any-way-to-make-an-automatic-param-like-param-breath
- 画像: なし
- 要点: 呼吸以外の自動往復パラメータが無いので、呼吸に翼等を紐付け、呼吸範囲の異なる区間で反応する親デフォーマを積んで一斉に動くのを避ける。

### 呼吸の一般アニメ原則：吸うのは遅く吐くのは速い、肩は胸の後から、腕はさらに遅れる
- 出典: AnimSchool Blog / Neave Lifschits「Breathing Life Into Your Animation」/ 2024-11-15
- リンク: https://blog.animschool.edu/?p=845
- 画像: ページ内にあり
- 要点: 胸の上下は吸気ゆっくり・呼気速め。肩は胸の膨張に少し遅れて追従、腕はさらに遅れて硬さを消す。頭・首は控えめ。3D アニメの記事だが Live2D の呼吸にも転用できそう。
- seed 外（Live2D 以外の出典）

### 腕のネスト過多でキーフォームが重くなる→トグルごとにデフォーマを分ける
- 出典: Live2D Creators Forum「Keyforms lag and crash」
- リンク: https://community.live2d.com/discussion/1459/keyforms-lag-and-crash
- 画像: なし
- 要点: 上腕 1 つのデフォーマに複数の腕トグルを全部載せると補間数が爆発して重くなる。トグルごとに 1 デフォーマに分けたら大きく改善した、という報告。（検索要約経由）

### Live2DEX で胴体が動かない時はパラメータ ID の付け替え
- 出典: ぬるい / nuluI / note「Live2DEX：上半身だけのモデルで胴体部分が動かないときの備忘録」/ 2021-06-19
- リンク: https://note.com/_o_o_o_o_o____oo/n/n779a75ec9f1c
- 画像: なし
- 要点: アプリ側が体を動かさない仕様の場合、顔角度の ID を体の回転に割り当て直すなど ID を入れ替えて首と一緒に胴体を動かす。トラッキングアプリは体 XY を検知しないので顔 XY に体 XY を割り当てるのが一般的（乾物ひもの記事でも同趣旨）。

### VTube Studio ハンドトラッキング用パラメータ ID を合わせておく
- 出典: DenchiSoft / VTube Studio Wiki「Hand Tracking」、まいん / note「Live2D 手と腕・ハンドトラッキング」/ 2024-04-20
- リンク: https://github.com/DenchiSoft/VTubeStudio/wiki/Hand-Tracking , https://note.com/main385/n/n351aa6c9794d
- 画像: https://raw.githubusercontent.com/wiki/DenchiSoft/VTubeStudio/img/vts_hands_1.png
- 要点: HandLeft/RightPositionX/Y/Z（±10）、AngleX/Z（±180）、Open、指ごとの 0〜1 などの ID と一致させると自動設定が効く。腕だけなら手・前腕・肘・上腕で足り、肘を上腕にグルーで追従させると見栄えが整う。

### 角度 XY は「頂点を立体に沿わせ、X は水平・Y は垂直だけ、パースは最後に少し」
- 出典: 925（クニコ）/ note「角度XYを作る時、何を考えているのか 頭の中に立体を飼おう その①」/ 2024-12-23（Live2Dアドカレ2024）
- リンク: https://note.com/925__niconico/n/n5977ff68b787
- 画像: https://assets.st-note.com/img/1734956327-uElOyWI5kLAcQhV7Y4szvpi8.png , https://assets.st-note.com/img/1734958715-gLX9J4BVl8RSNWMG5iA6xepb.png
- 要点: 首の中心を回転軸と見なし、軸から遠い部分（顎・鼻）ほど大きく横へ動かす。最後に頭の中心が首の中心に乗っているか確認（SD は特に重要）。早い段階のパースは全体がちぐはぐになる。
- seed 外（顔の角度だが首との関係あり）

### 有料講座の目次に見える技法名（中身未確認）
- 出典: Coloso / BailyStudio、UNAGIdon の講座ページ
- リンク: https://coloso.global/products/live2dstudio-bailystudio-us , https://coloso.global/products/live2drigger-unagidon-us
- 画像: ページ内にあり
- 要点: 「体を作る前に頭を隠す」「シェイプ反転のブレンドで体 Y」「多段の体 Z（Multi-Stage Body）」、「cup arms / fan arms / waving arms の XYZ」「上半身物理（胸・服・腕）」「持ち物（カップ・扇子）の物理と ON/OFF アニメ」など。技法名のみ。

## X への手がかり
- @MegaJujube（Jujube、呼吸の性別差・首の太さ）— note「生きてる感をUPさせるひと手間」。記事内で投稿 https://twitter.com/MegaJujube/status/1204577038339735552 , https://twitter.com/MegaJujube/status/1204576934228684800 。同記事で次担当 @kyouhei_0210 を紹介
- @daneko_ko（伊糖だねこ、体 Z / 体 XY / 角度補正の練習記録シリーズ）
- @asano_negoto（朝野ねごと、頭→首→体の Z 連動）
- @himono_vtuber（乾物ひもの、首のはみ出し・物理による体追従・体 Y バウンド）
- @makotok1（腕の立体表現・ループモーション）
- @kw_nmnm（肘の円設計）
- @marunaru82（球体関節風の肘・前腕伸縮）
- @rariemonn765（グルー活用）
- @Kay_Live2D（音芽ケイ、体 XYZ の反動）
- @ku_shi（乃樹坂くしお、物理の遅延多段）
- @nanaireo（納内れお、腰を動かせ）
- @597_lintz（飛鳴りんつ、Z 軸と肩・脚の性格づけ）
- @taniya001（谷屋楽、鎖骨起点・首の支点）
- @Metenee_28（めてねぇ、ハンドトラッキング用の手）
- @H0x0Hal（hal、指の 360 度回転）
- @bazbed（ヱノプルギスの夜、歩行ループ）
- @nuluI_（ぬるい、Live2DEX の ID 付け替え）
- @925__niconico（925、角度 XY の立体思考）
- @shiranui_bzw（shiralive2d、物理ウィンドウでのパラメータ連結と“secret bug”の動画）
- @ramdroidrigs（チュートリアルリンク集の Google Doc「LIVE2D YEEE」内にリンクあり）
- @Baily_ovo（BailyStudio、Coloso 講師）、@UNAGIdonYADE（UNAGIdon、Coloso 講師）
- Live2Dアドベントカレンダー（2019/2021/2023/2024）が玄人知見の集積点。各年の担当者一覧から X アカウントを辿れそう

## 検索記録
- 「Live2D 体の動き コツ 体X 体Y 体Z」「Live2D 首 つなぎ目 上を向く 首の裏」「Live2D 腕 作り方 肘 曲げ グルー」「Live2D 呼吸 パラメータ 作り方 肩 上下」「Live2D 体の回転 note 解説 デフォーマ 角度」: ドメイン指定なしだと Wikipedia・ニュース・Fiverr 等ノイズが多く空振り気味。
- 同系の語を note.com / hatenablog.com 等に絞ると一気に当たる（「Live2D 体 首 肩 呼吸 コツ」「Live2D 腕 差分 手 パーツ分け コツ」「Live2D 首 上を向く 下を向く 首の影 パーツ」「Live2D 体X 立体 回転 肩 奥 手前 パース」「Live2D 腕 物理演算 揺れ 体に追従 手」「Live2Dアドカレ 体 腕 肩 動き」「Live2D 肩 鎖骨 首の付け根 変形 コツ」「Live2D 腰 ひねり 重心 体 傾き 足 接地」「Live2D 袖 腕 連動 服 引っ張られ」「Live2D 振り向き 体が先 頭が後 モーション 時間差」「Live2D 腕 描画順 前後 入れ替え」）。日本語の個人 note が圧倒的に情報密度が高い。
- 公式（docs.live2d.com）: 「体の動きをつける チュートリアル」「3D回転表現 体 腕 公式マニュアル」。チュートリアル・モーション品質改善 Tips・標準パラメータ一覧・3D 回転表現が有用。
- 英語: 「Live2D body angle X Y Z rigging tips」「live2d arm rigging tutorial elbow bend tips」「vtuber rigging tips body follow head physics」「live2d shoulder arm rig deformer tips（community.live2d.com 限定）」「"Live2D" "body X" rig "parallax"」「live2d vtuber arm toggle hand tracking rig tips blog」「live2d body rigging guide breath parameter」。英語圏は Gumroad / Coloso / Fiverr / carrd の販売ページが多く、無料の文章解説は少ない。肘の英語検索は Adobe Character Animator / Maya の話ばかりで Live2D 固有でないため不採用。
- Reddit はクロール不可（ドメインがブロック）。YouTube は説明文・書き起こしが取得できず（タイトルのみ）。候補だけ記録: 「Body z 'Step' Rigging」https://www.youtube.com/watch?v=I4UszLnod54 、「Advanced Body Angles」https://www.youtube.com/watch?v=I-GTExhIRjQ 、「Drawing for Live2D: Advanced Components Arms and Hands」https://www.youtube.com/watch?v=o1bkiRK9ACI 、「Ep9 Body X & Y」https://www.youtube.com/watch?v=cUiXr7tUkg4 。
- チュートリアルリンク集 Google Doc（https://docs.google.com/document/d/1ycbCeShtHCMHfVxQuTDRhsVfNGLfBqLwlPsQjiCZmjo ）は PDF 本文が取り出せず中身未確認。Notion の練習リグ記事（duokhay.notion.site、「Body Lean Z を Body X と組み合わせて変形問題を解決」と検索スニペットにあり）は JS 描画で本文取得不可。
- 書籍「Live2D モデリング&アニメーションTips」（技術評論社）目次に「呼吸に連動した動き」系の Tips がある模様（目次タイトルのみ）。
- 一部メモ（首の影の乗算手順、首を耳の中央まで描く、手差分の不透明度切替、腕差分の排他、Keyforms lag）は検索エンジンの要約経由で、本文を開いて確認していない（各見出しに付記）。
