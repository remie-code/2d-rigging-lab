# 集めるメモ（Web）: 目と眉、口

> フェーズ1（集める）の生メモ。原文用語のまま、加工前。調査日: 2026-10-19。

## メモ

### 上瞼は大きく、下瞼はわずかに（筋肉から考える閉じ目）
- 出典: ANYCOLOR クリエイター講演（alive 2024）セッションレポート / GameBusiness.jp / 2025-01-28
- リンク: https://www.gamebusiness.jp/article/2025/01/28/23826.html
- 画像: https://www.gamebusiness.jp/imgs/zoom/150762.jpg 、 https://www.gamebusiness.jp/imgs/zoom/150761.jpg
- 要点: 目を閉じるとき、上眼瞼挙筋側（上瞼）が大きく、眼輪筋側（下瞼）は少しだけ動くと考える。上瞼が大きく下がるぶん閉じ目の位置は下がる。ただし上瞼を動かしすぎると幼い顔がさらに幼く見えることがある（幼い顔は目の配置が低め、大人は高めが基本）。派手さより「地味だけどリアル」な動きを重視。

### 閉じ目の違和感を減らす（Tips 17〜22 の章立て）
- 出典: 『Live2D モデリング&アニメーションTips』唐揚丸・乾物ひもの・ののん。・fumi（技術評論社）書誌ページ / 丸善ジュンク堂
- リンク: https://www.maruzenjunkudo.co.jp/products/9784297144296
- 画像: なし
- 要点: 目次だけ確認。閉じ目の違和感対策を「まつ毛のワンポイント」「閉じ目の位置」「閉じ目の横幅」「眼球の位置」「眼球の幅とパース」「ハイライトを見せる」に分解している。他に「まばたきしたときのまつ毛の揺れ」「閉じ口と開け口の形の早見表」「効率的なあいうえお」「編集レベル2と3で口を簡単に作る」「片目制作による時短」「ブレンドシェイプで表情差分」など。

### 閉じ目は「まつ毛を下まつ毛まで下ろす」＋白目クリッピングで眼球を隠す
- 出典: Live2D 公式チュートリアル「3. Adding Facial Expressions」
- リンク: https://docs.live2d.com/en/cubism-editor-tutorials/expression/
- 画像: https://docs.live2d.com/wp-content/uploads/2017/10/01-1.png 、 https://docs.live2d.com/wp-content/uploads/2017/10/05-1.png 、 https://docs.live2d.com/wp-content/uploads/2017/10/08_03.png
- 要点: 眼球を非表示にしてから、まつ毛メッシュを下まつ毛のラインまで下げ、目頭・目尻に変形パスを当てて閉じ目を作る。眼球は白目にクリッピングし、白目自体も閉じ側でまつ毛に覆われるよう変形させて閉じ時に眼球を隠す。デフォルト形状のロック（Lock Default Forms）で誤編集を防ぐ。

### 眉は3点キー、驚きは眉の中央を上げる
- 出典: Live2D 公式チュートリアル「3. Adding Facial Expressions」
- リンク: https://docs.live2d.com/en/cubism-editor-tutorials/expression/
- 画像: https://docs.live2d.com/wp-content/uploads/2017/10/12-1.png 、 https://docs.live2d.com/wp-content/uploads/2017/10/14_2.png
- 要点: 眉変形に3点キーを打ち、-1 で下がり眉、反対側で上がり眉。驚きの表情は眉全体ではなく中央を持ち上げる。

### 口の閉じは「下唇を上唇に合わせる」、口内はみ出しは肌色メッシュ拡張か口内縮小
- 出典: Live2D 公式チュートリアル「3. Adding Facial Expressions」
- リンク: https://docs.live2d.com/en/cubism-editor-tutorials/expression/
- 画像: https://docs.live2d.com/wp-content/uploads/2017/10/16_2.png 、 https://docs.live2d.com/wp-content/uploads/2017/10/18_2.png
- 要点: 口変形では上唇を先に作り、肌色部分に変形パスを入れて唇が肌の頂点を引っ張らないようにする。下唇は閉じたとき上唇の裏に隠れて線が透けやすいので上唇の形に揃える。口内が肌色からはみ出すなら肌色メッシュを広げるか、閉じ時に口内を縮めるパラメータを足す。

### 口の開閉は編集レベル2で上下別々、閉じは編集レベル3で上下同じ変形パス
- 出典: Live2D 公式マニュアル（口の開閉チュートリアル・編集レベル）
- リンク: https://docs.live2d.com/en/cubism-editor-manual/edit-level/
- 画像: ページ内にあり
- 要点: 開いた口は上唇・下唇それぞれに別の変形パスを当てて作り、閉じた口は上下両方のアートメッシュに同じ変形パスを当ててまとめて閉じる。

### 目・口は「通常閉じ=0 / 通常開き=1」、範囲外は 0.1 刻みで足す
- 出典: Live2D 公式マニュアル「Standard Parameter List」「Parameter Adjustment」
- リンク: https://docs.live2d.com/en/cubism-editor-manual/standard-parameter-list/
- 画像: なし
- 要点: EyeOpen は 0〜1（ギュッと閉じは -0.5 等、見開きは上限を伸ばす）、MouthOpenY は 0〜1（大口は 1.5 等）。EyeSmile は 0〜1、BrowY/X/Angle/Form は -1〜1（負が怒り寄り）、MouthForm は +笑顔/-怒り、ParamCheek は 0〜1 で頬染め。

### 表情データで口開閉を半開きにしない
- 出典: Live2D 公式マニュアル「Facial Expression Mechanism」
- リンク: https://docs.live2d.com/en/cubism-editor-manual/facial-expression-system/
- 画像: なし
- 要点: 表情（exp）側で口開閉を 0.2 のような半開き値にすると、リップシンク時に口が閉じきらず不自然になる。閉じきらせたいなら表情値は 0。

### 白目も塗っておく・口内は一回り大きく描く・唇には肌色の塗り足し
- 出典: Live2D 公式チュートリアル「1. Illustration Processing」
- リンク: https://docs.live2d.com/en/cubism-editor-tutorials/psd/
- 画像: https://docs.live2d.com/wp-content/uploads/2017/08/2017-09-01_11h46_40.png 、 https://docs.live2d.com/wp-content/uploads/2017/08/2019-05-13_11h32_03.png
- 要点: 白目はクリッピング元だが、眼球に隠れる部分も眼球が動けば見えるので塗っておく。まつ毛は跳ねる目尻部分と分けると変形しやすい。口内は閉じ口で見えないよう分け、元絵より一回り大きく描く。唇に肌色の塗り足しを付けて口内を隠す方式を推奨（クリッピングは動画用や唇が厚い／口の変形が少ない絵向け）。

### まばたきはまず 0 と 1 の2点、全パーツに打ってから中間を足す
- 出典: 伊糖だねこ / note「Live2D練習記録③ ー モデリング 目ー」
- リンク: https://note.com/itodaneko/n/n7d73fd172f6d
- 画像: https://assets.st-note.com/img/1764566040-f9hQsnq2a45kMWVuyL6vOBGZ.jpg?width=1200
- 要点: まつ毛・白目・二重線など使う全パーツに先に2点キーを打つとキー打ち忘れを防げ、中間キーは2点間の補間から始められる。開閉は 0 / 0.5（ジト目）/ 1.0 / 1.2（見開き）。半目でもハイライトが見えるようにすると見栄えが良く、表情差分にも流用できる。

### 笑顔目は「開閉=0 の上で」笑顔1.0を作る
- 出典: 伊糖だねこ / note「Live2D練習記録③」、愛（live2Dの習得記録）/ note「谷型の閉じ目から『笑顔の閉じ目』を作る手順まとめ」
- リンク: https://note.com/itodaneko/n/n7d73fd172f6d 、 https://note.com/hoshinotomoshibi/n/n0538bd256cf1
- 画像: https://assets.st-note.com/img/1771314815-w1lLUmySY73gE0MRCkIPDKhi.png?width=1200 、 https://assets.st-note.com/img/1771315385-N2ZRQwgA69iek38TDtafmuJI.png?width=1200
- 要点: 笑顔目は閉じた状態なので、開閉0に合わせてから EyeSmile 1.0 を作ると開いた目に笑顔の影響が出ない。谷型の閉じ目を少しずつ山型（にっこり）に寄せ、まつ毛→下まつ毛→白目→涙袋→二重の順にカーブに沿わせる。白目は山型ラインの裏に押しつぶすと自然。

### 笑顔の値 0.85 で中途半端な半目を避ける / ジト目 0.5 も用意
- 出典: もいもい / note「Live2Dモデル制作～販売まで④ -顔のモデリング-」
- リンク: https://note.com/moimoi_sp/n/n7cd8b45dbc5f
- 画像: ページ内にあり
- 要点: 笑顔と閉じ目の数値関係を詰め、笑顔を 0.85 にすると中途半端な半目になりにくいとのこと。後から差分を求められる前提でジト目（0.5）も作っておく。目・眉・口・輪郭のメッシュは手動、ほかは自動。

### 笑顔目で瞳が残る問題：閉じ目パーツを上に重ね、目全体は上・閉じ目は下へ
- 出典: Live2D Creators Forum「efficient way to animate this eye smile that does not contain eyelash but a pupil」
- リンク: https://community.live2d.com/discussion/1473/efficient-way-to-animate-this-eye-smile-that-does-not-contain-eyelash-but-a-pupil
- 画像: https://us.v-cdn.net/5021645/uploads/editor/0u/bc5jjdicd7en.png
- 要点: まつ毛がなく瞳だけの絵柄で笑顔目にすると瞳が上に残る。瞳を上へ逃がすと不自然だったので、閉じ目パーツを開き目の上に重ねて適切なキーでだけ表示し、目全体を上に動かしつつ閉じ目パーツは下へ動かすと良く見えた、という自己解決。

### キャッチライトをまぶたと一緒に動かす
- 出典: Live2D Creators Forum（Tod）「improving quality of eye movement」
- リンク: https://community.live2d.com/discussion/27/improving-quality-of-eye-movement
- 画像: https://img.youtube.com/vi/doA-ULmGAqI/0.jpg
- 要点: 開閉で目を変形するとき、キャッチライト（ハイライト）もまぶたに合わせて動かすとキャラの質が上がる。

### ハイライトは瞳より動きを小さく（視差）
- 出典: 朝野ねごと / note「Live2D備忘録4 目を動かす」
- リンク: https://note.com/asanonegoto/n/n4ba462b24dba
- 画像: https://assets.st-note.com/production/uploads/images/54844186/picture_pc_12f48ba59d2f6bb50e7c4f32ce6ba1eb.gif?width=1200 、 https://assets.st-note.com/production/uploads/images/54843744/picture_pc_9ea5ccee3b0b1ef092f9195a2937a1a9.jpg?width=1200
- 要点: ハイライトを黒目と別パーツにして移動幅を小さくすると立体感が出る。黒目は白目が少し見える程度までに留める。目玉X/Yを結合して「4隅の形状を自動生成」で斜めを作る。

### 眼球感：瞳は逆方向に少し、ハイライトは進行方向に少し
- 出典: ゾンビうつけくん / note「眼球感のある目モデリング」/ 2026-01-18
- リンク: https://note.com/zombiefff/n/n608157fc2ab8
- 画像: ページ内にあり
- 要点: 「目の中」を基準に、ハイライトは視線の進行方向へ、瞳は逆方向へわずかにずらして視差を作る。進行方向側の目の輪郭と瞳を少し中心へ圧縮し、ハイライトは膨らませる／傾けて球面感を出す。やりすぎない、原画の良さの範囲で。

### 瞳を視線方向に潰す（realistic pupils）
- 出典: Live2D Creators Forum（renoa, 2016）「Modeling Tip: How to achieve realistic pupils」
- リンク: https://community.live2d.com/discussion/302/modeling-tip-how-to-achieve-realistic-pupils
- 画像: https://us.v-cdn.net/5021645/uploads/editor/eh/weena6rgnet6.jpg 、 https://us.v-cdn.net/5021645/uploads/editor/ea/gqa3ar258vy1.gif
- 要点: 目玉X/Yの各点で、瞳デフォーマを見ている方向へ潰す（球面上を移動しているように見える）。コメントで、アイラインにもデフォーマを重ねて瞳に合わせて少しずらす案。

### 顔XYで黒目は凹ませ、ハイライトは盛り上げる / 奥側の目は圧縮
- 出典: 乾物ひもの / note「Live2D 高可動域モデルの顔の角度XYのすすめ②」、ととり / note「破綻しづらい顔XYのコツ」
- リンク: https://note.com/himono_vtuber/n/n19828b07b8a3 、 https://note.com/totorichu/n/n69afe2904021
- 画像: https://assets.st-note.com/production/uploads/images/48804667/picture_pc_722db4d17379f00838df90727612aa63.gif?width=1200 、 https://assets.st-note.com/img/1701917687343-ytIjHRSGWQ.png 、 https://assets.st-note.com/img/1701917992923-pWgsvVoDm1.png
- 要点: 眼球専用の親デフォーマで、黒目は凹ませハイライトは盛り上げる。瞳孔を分けられるなら個別にずらすと塗りが歪みにくい。斜めは4隅自動生成後、輪郭や鼻と平行に、目が曲面上にある丸みを付ける。顔の向きに対し瞳を逆方向へごくわずかにずらす。奥側の目は圧縮。まつ毛は横向きで少し出っ張るので専用デフォーマ。白目・瞳・まつ毛（二重まで）でデフォーマを分けないと瞳が歪む。閉じ目でも都度確認。

### まつ毛は目玉XYではなく顔の角度に付ける
- 出典: r/Live2D スレッド「is there any way to make my life easier」のコメント（検索結果の抜粋経由、本文未読）
- リンク: https://www.reddit.com/r/Live2D/comments/1gxe1s8/is_there_any_way_to_make_my_life_easier
- 画像: なし
- 要点: 目玉X/Yは虹彩と瞳の向き用。まつ毛は頭と一緒に動くので AngleX/Y か augmented physics で付ける。デフォーマ階層を正しくしておくと同じ修正を全キーで繰り返さずに済む。

### 驚きで瞳を縮め、ハイライトを大きく（重み制限で開閉と分離）
- 出典: 伊糖だねこ / note「Live2D練習記録③」
- リンク: https://note.com/itodaneko/n/n7d73fd172f6d
- 画像: https://assets.st-note.com/img/1764567691-s7DEgXWmNnMi5uIK1UOoYRzv.jpg?width=1200
- 要点: ブレンドシェイプ「驚き」1.0で瞳を細く、ハイライトを大きくする。開閉で瞳まで細くならないよう重みの制限に目の開閉を入れ、目が 1.0〜1.2（見開き）のときだけ驚きが 100% になるようグラフを調整。

### まつ毛揺れ・ハイライト揺れ・瞳拡縮を物理で
- 出典: 伊糖だねこ / note「Live2D練習記録③」
- リンク: https://note.com/itodaneko/n/n7d73fd172f6d
- 画像: ページ内にあり
- 要点: まつ毛揺れ用ブレンドシェイプ（-1〜1）を作り、物理の入力を目の開閉（影響度100）にしてまばたき時にまつ毛を揺らす。「ハイライト揺れ」「ハイライト拡縮」「瞳拡縮」も目の開閉＋瞳XYを入力に物理で動かす。出力が 100 程度を超えないよう調整。

### しいたけ目：揺れ1（拡縮）＋揺れ2（ポコッと飛び出し）を物理で
- 出典: ゾンビうつけくん / note「しいたけ目の作り方」
- リンク: https://note.com/zombiefff/n/nf2758894e049
- 画像: https://assets.st-note.com/production/uploads/images/263111187/rectangle_large_type_2_8ae6a9a03b4d77d496929a3ffd43a45e.png?width=1200
- 要点: 差分目に表示／揺れ1（拡縮）／揺れ2（ワープで上下左右へ突き出す）の3パラメータ。目の開閉・笑顔・見開きにはまぶたに沿うデフォーマで追従、その上に目玉XY用、さらに顔XY用デフォーマ。物理入力は目開閉・笑顔・呼吸・角度XYZ＋ランダム、揺れ2の最大出力を強めにして「ポコポコ感」。

### ハイライトの揺れ（瞳と分離したハイライトを下・回転・拡大）
- 出典: Warudo ドキュメント「Live2D Eye Wiggle」（3D向けだが Live2D 風表現の再現）
- リンク: https://docs.warudo.app/docs/blueprints/templates/eye-wiggle
- 画像: なし
- 要点: Live2D でよくある「目のうるうる揺れ」を再現するには、ハイライトを瞳から分けて「下へ」「回転」「拡大」の3種の形を用意し、振り子物理で駆動する、という分解。
- seed 外（3D 側の資料。Live2D 表現の分解として拾った）

### 表情差分の目（キラ目・ハート目・ぐるぐる目）は瞳の上・白目にクリップ・瞳WD追従
- 出典: もいもい / note「Live2Dモデル制作～販売まで⑦ -差分のモデリング-」、伊糖だねこ / note「Live2D練習記録⑨ ー 差分作成ー」
- リンク: https://note.com/moimoi_sp/n/n1375ae2f2d09 、 https://note.com/itodaneko/n/ne16209ddafb5
- 画像: https://assets.st-note.com/img/1752752314-kSzNolpJPIwdXEuqmgC65RUx.png 、 https://assets.st-note.com/img/1752753212-S0Zr72EfiV3ptAHqdyQnuDU1.png
- 要点: 差分目は瞳より上に置き白目にクリッピング、瞳のワープデフォーマを親にして視線に追従させ、0→1 で不透明度 0→100%。「><」目は逆に通常の目を 100→0%。同系統の差分は排他にして重ならないよう注意。怒り眉には少し赤面を足すと良い。

### 頬ぷくー：0 では閉じ口の高さに潰しておく・口が開いたら重み制限で消す
- 出典: 伊糖だねこ / note「Live2D練習記録⑨ ー 差分作成ー」
- リンク: https://note.com/itodaneko/n/ne16209ddafb5
- 画像: ページ内にあり
- 要点: 頬膨らみパーツは 0 のとき閉じ口の高さまで潰しておき急に出現しないようにする。輪郭は口Xの変形を流用して膨らませ、口の横幅パラメータに追従させる。口開閉で重み制限をかけて開口時は消し、顔の角度Xで奥側の頬を消す。

### 頬は顔ベースにクリッピングすれば単純な変形で済む
- 出典: 乾物ひもの / note「Live2D 高可動域モデルの顔の角度XYのすすめ②」
- リンク: https://note.com/himono_vtuber/n/n19828b07b8a3
- 画像: ページ内にあり
- 要点: 頬（チーク）は顔のベースにクリッピングしておけば顔XYでも簡単な変形で済む。左右で分かれている場合はそれに合わせた変形が要る。

### 眉は上下で目との距離を一定に / 眉変形 -1 を目に近づけすぎない
- 出典: 乾物ひもの / note、伊糖だねこ / note「Live2D練習記録④ ー モデリング 口・眉毛 ー」
- リンク: https://note.com/himono_vtuber/n/n19828b07b8a3 、 https://note.com/itodaneko/n/n54b795f16f7f
- 画像: https://assets.st-note.com/production/uploads/images/48804973/picture_pc_75de957b67b176491ab5bfa020bb485f.png?width=1200 、 https://assets.st-note.com/img/1764739928-iN3ZF9GlxDkevbJ6CYnSojs0.jpg
- 要点: 顔XYで眉を上下させるとき、デフォーマと目の距離を一定に保つ。幅だけ縮めるとツリ眉で眉が目に被る。下を向いて眉と目を詰めたいならデフォーマも縦に縮める。眉変形はアートメッシュに直接 -1 下アーチ / 1 上アーチ、上下はデフォーマで管理して掛け合わせを安定させる。-1 の形を目に近づけすぎると上下で目に重なる。

### 眉のパラメータは「変形」と「上下」の2つに絞る
- 出典: 伊糖だねこ / note「Live2D練習記録④」、もいもい / note「④ -顔のモデリング-」
- リンク: https://note.com/itodaneko/n/n54b795f16f7f 、 https://note.com/moimoi_sp/n/n7cd8b45dbc5f
- 画像: なし
- 要点: 標準の眉パラメータ4種（Y/X/Angle/Form）は全部使わず、変形と上下だけで十分。角度は変形で代用でき、管理しやすく破綻しにくい。

### 眉は変形パスで「どの値で止めても線が美しい」ように、移動はデフォーマ階層で
- 出典: 愛（live2Dの習得記録）/ note「眉の動きが完成！ワープデフォーマーと変形パスの活用」
- リンク: https://note.com/hoshinotomoshibi/n/n4add5ff33c9a
- 画像: ページ内にあり
- 要点: 眉変形は変形パスで頂点を一つずつ詰め、困り眉（-1）は滑らかなU字、山型（1）は勢いのあるアーチ。途中のどの値でも線が崩れないか確認。角度（回転）・左右スライド・上下はそれぞれ別のデフォーマに分けて階層化。

### 彫りの深い顔：眉の上に「目隠し」パーツを入れて肌にクリッピング
- 出典: hal / note「Live2Dで彫りの深いモデリングをする」
- リンク: https://note.com/hal0x0/n/ne8c9fa8c0a6b
- 画像: ページ内にあり
- 要点: 男性キャラなど目と眉の間が狭いと、表情で目パーツが眉より上にはみ出す。眉の上に目隠しパーツを置いて顔の肌にクリッピングすると防げる。輪郭のワープは目・眉・頬骨の頂点を意識して配置すると凹凸のある変形が作りやすい。

### 前髪の透け感は反転マスクで
- 出典: Live2D 公式マニュアル「Inverted Mask」
- リンク: https://docs.live2d.com/en/cubism-editor-manual/invert-mask/
- 画像: https://docs.live2d.com/cms/wp-content/uploads/2024/11/InvertedMask_06-en.gif
- 要点: 前髪を半透明画像にクリッピングして「マスクの反転」を使うと、前髪越しに下が透けて見える表現になる（眉・目が前髪越しに見える用途に近い）。反転マスクは SDK 4.0 以降の出力のみ。
- seed 外（髪側だが眉・目の見え方に関わる）

### 口：直線の長い上口・下口から作り、マスク反転＋グルー片側100%
- 出典: めぃまぁ / note「Live2Dで綺麗かつ簡単に口を作る方法」
- リンク: https://note.com/memoryview/n/n821d96613347
- 画像: https://assets.st-note.com/production/uploads/images/52410508/picture_pc_0d752294e7696d658d9d13b921b968ba.png?width=1200 、 https://assets.st-note.com/production/uploads/images/52413943/picture_pc_4b223ea51c491ed38ac39ea22fbb9876.png?width=1200
- 要点: 曲線は逆に曲げると荒れるので、長めの直線の上口・下口から作る（上下はコピペで揃える）。上マスクは下へ、下マスクは上へはみ出さない向きで。口内を上下マスク名でクリッピングしてマスク反転、上口↔下マスク・下口↔上マスクをグルーで繋ぎ重みは片側100%。マスクは非表示ではなく不透明度0%。

### 口：肌色延長もグルーも使わない方式（口中を3頂点ラインで唇に沿わせる）
- 出典: makotok1 / note「Live2Dで『肌色延長』や『グルー』を使わずに口を作る方法」
- リンク: https://note.com/makotok1/n/n77e3665a6c9f
- 画像: https://assets.st-note.com/production/uploads/images/16389063/rectangle_large_type_2_92c63376d66b14aa7f54b186c48a8d10.jpeg?width=1200 、 https://assets.st-note.com/production/uploads/images/16389617/picture_pc_96e925d32da42d91c7596c809bea1434.gif?width=1200
- 要点: 口上・口下・口中の3パーツ。口中のメッシュを上・中・下の3頂点ラインにして口上・口下の線に沿わせ、開閉でできる隙間とはみ出しを潰す。合わなければ 0.3 / 0.5 に中間キー。肌にグラデがあっても違和感が出にくく、ポリゴンの翻りも起きにくいが、調整は手間。

### 口のメッシュ：公式の数値（幅8・間隔5・頂点3）、上口メッシュを下口へコピペ
- 出典: 愛（live2Dの習得記録）/ note「『理想の口の動き』を目指して。公式動画と向き合ったメッシュ割りの記録」
- リンク: https://note.com/hoshinotomoshibi/n/nf9c1bacce499
- 画像: https://assets.st-note.com/img/1772164665-XMWxaYVUJZdH9Girh1f8zwBl.png 、 https://assets.st-note.com/img/1772167788-cdh7oaPYpUr1IsWjQSRbVGK2.png
- 要点: 先にクリッピングを設定してから作業。上口・下口はストロークによるメッシュ割（メッシュ幅8・繰り返し間隔5・頂点3）で手動、歯・舌・口内は自動。外側と内側に頂点を均等に。上口のメッシュをコピーして下口に貼ると閉じ口のラインが揃う。

### 開閉 0/0.3/0.7/1.0 × 変形3点 = 12点で母音を配置、輪郭（顎）も連動
- 出典: 朝野ねごと / note「Live2D備忘録5 口を動かす」
- リンク: https://note.com/asanonegoto/n/nfdb59e366bd5
- 画像: https://assets.st-note.com/production/uploads/images/54964575/picture_pc_ebef397d85272c2c5bcf58083b1bd8f7.gif?width=1200 、 https://assets.st-note.com/production/uploads/images/55033242/picture_pc_c34d585ec073f3e1fa15f1636802f6dd.gif?width=1200
- 要点: 口の線上に5点ずつ。開閉4点×変形3点を結合した12点のグリッドに、すぼめ・う・い・お・あ・え等を割り当てる。輪郭にも同じキーを打ち、口を開くと顎を少し下げ、横に開くと少し上げる。

### 「い」は変形0.5×開閉0.2 に追加キー / 口変形はデフォーマで、母音はアートメッシュで
- 出典: 伊糖だねこ / note「Live2D練習記録④ ー モデリング 口・眉毛 ー」
- リンク: https://note.com/itodaneko/n/n54b795f16f7f
- 画像: https://assets.st-note.com/img/1764739600-9i3bc4kXI1dDqYEmOwrJAPjM.jpg 、 https://assets.st-note.com/img/1764739663-RryBkvl8TMAeEN02gi9PbsuG.jpg
- 要点: 口変形 -1 で幅狭く口角下げ、1 で幅広く口角上げ（上下唇を1つのデフォーマでも滑らか）。開閉は2点打ってから 0.5 を追加。あ・え・おは結合グリッド上でアートメッシュ編集、「い」は結合を外して変形0.5・開閉0.2 に追加キー。ブレンドシェイプ「口_輪郭X」（口幅で頬が動く）「口_輪郭Y」（開口で顎が下へ伸びる）。古い口形表は FaceRig 向けで VTube Studio と合わないことがある。

### 顎は「開いた口の隙間ぶん」下げる、母音ごとに下げ量を変える
- 出典: 愛（live2Dの習得記録）/ note「あいうえおに合わせて顎を動かす方法」
- リンク: https://note.com/hoshinotomoshibi/n/n599374f5a880
- 画像: https://assets.st-note.com/img/1774945770-ZdW2J4RMoH57ifhengPtX8Vv.png?width=1200 、 https://assets.st-note.com/img/1774945795-TkfFDdHhz85bmsPxJUnc1EvL.png?width=1200
- 要点: 口全体・顔塗り・輪郭を「あご全体」親デフォーマにまとめ、開いた口の隙間と同じだけ顎を下げる。「あ」しっかり、「い」は控えめ（可愛く見える）、「う」「え」は中間、「お」は「あ」並みで縦ライン意識、「大きなあ」はさらに少し。「む」「ニッコリ」ではあえて動かさない。

### 口角が上がると下まぶた（頬）も動く / ウェブカメラ勢は目を開ききらないので 0.7 を綺麗に
- 出典: 黒葛原 / note「のんびりセルフ受肉していく④まばたき・あいうえお編」
- リンク: https://note.com/tsudurahara/n/nfe713c24f798
- 画像: ページ内にあり
- 要点: 口角が上がるときに頬と下まぶたを一緒に動かし、口の開きに顎を連動。ウェブカメラ利用者は目を全開にしないことが多いので、0.7 の半開きでもまつ毛が綺麗に見えるようキーを追加。目玉の動きでまぶたも少し動かすと自然。母音は開閉3×変形3の9点で あいうえお＋ん。

### 口のデフォーマ全体に動きを付ける・キーは少しずつ / 口XYに舌・下奥歯を入れてパース
- 出典: ととり / note「破綻しづらい顔XYのコツ」
- リンク: https://note.com/totorichu/n/n69afe2904021
- 画像: https://assets.st-note.com/img/1701920810864-aNxN12Xu67.png
- 要点: パーツの一部だけに顔XYの変形を付けると開閉時に破綻しやすいので、口デフォーマ全体を動かす。キーはまず口開閉の0/1、次に口変形2点、気になる所だけ個別に。口XYの中に舌や下奥歯を入れてパースを付け、付け終えたら外すとパースが保たれる。

### 口は鼻筋から顎へつながるように、奥側を極端に縮める
- 出典: 乾物ひもの / note「Live2D 高可動域モデルの顔の角度XYのすすめ②」
- リンク: https://note.com/himono_vtuber/n/n19828b07b8a3
- 画像: https://assets.st-note.com/production/uploads/images/48804690/picture_pc_db7da772913db348ffecd3c823e6d38b.gif?width=1200
- 要点: 顔XYで口は鼻筋が顎へつながるラインに乗せ、奥側を極端に縮め、デフォーマ中央をへこませる。Yでは鼻との距離を保つ。へ字口など絵柄によっては口形ごとに角度用デフォーマの形を変える必要があり、口の動きパラメータを追加する。3つ以上のパラメータ同時付けは避ける。

### 複雑な口：上唇/下唇/舌/口幅/口X/頬ぷくを別パラメータで、歯はデフォーマで
- 出典: Animaze マニュアル「Live 2D Model Creation Process for Complex Mouth Geometries」
- リンク: https://animaze.us/manual/gettingstarted2d/complexparam
- 画像: https://cdn.animaze.us/media/wysiwyg/Screenshot_2021-11-12_at_16.12.27.png 、 https://cdn.animaze.us/media/wysiwyg/Screenshot_2021-11-12_at_16.27.02.png 、 https://cdn.animaze.us/media/wysiwyg/Screenshot_2021-11-12_at_16.41.04.png
- 要点: 開閉では唇・口内・舌・歯にキー、顎ワープを顔の曲面側に置いて連動。口変形は開閉0と1の両方で作る。上唇・下唇は別ワープで +1 外へ / -1 内へ。舌は全開時に上へ伸ばし、閉じ時の隠れた舌形も整える。口幅（すぼめ）は歯以外。口Xは片側の口角を少し上げて冷笑に。上の歯の上下程度ならパラメータ組合せでなくデフォーマで。組み合わせたらランダムに動かして遷移を詰める。

### VBridger の口：Funnel は開閉1以外ですぼむ、PressLip で唇結び、JawOpen は歯・舌・輪郭側
- 出典: みずのひら（水平ななめ）/ note「VBridgerでの口の作り方」
- リンク: https://note.com/mzhrarara/n/ncb952254d590
- 画像: https://assets.st-note.com/img/1649932074659-2aBtZ0Xh37.png 、 https://assets.st-note.com/img/1649932989875-uhUpWWwaFi.png 、 https://assets.st-note.com/img/1649933525656-OvXyXSIb1a.png
- 要点: 口開閉・変形は唇と口内ベースだけを動かし、歯や舌は ParamJawOpen で（輪郭も一緒に）。MouthFunnel は開閉1以外ですぼむように、開閉0×すぼめ1 を「う」に。PressLipOpen は -1 で唇を結び 1 で緩める（リップを塗らない絵柄だと効果が見えにくい）。MouthShrug は唇＋口内のデフォーマ、その親に PuckerWiden（-1 細め / 1 横に広げ）。JawOpen だけ開いて口が閉じたままだと怖い見た目になる。

### パーフェクトシンク：閉じ口前提のシェイプは口開時に重み制限
- 出典: 椎丈 / note「パーフェクトシンク対応モデルを作ってVBridgerを知る」
- リンク: https://note.com/shitake898/n/n539191645e26
- 画像: https://assets.st-note.com/img/1748884908-oEcsZIHgwty9jbuQ0UKAlYdr.png?width=1200 、 https://assets.st-note.com/img/1748905796-QtbwZSNuY01mPsvAi9KB6oUR.png?width=1200
- 要点: mouthRollLower（下唇を噛む）・mouthFunnel・mouthShrugLower は口を閉じた状態を想定しているので、口が開いたら動かないよう重みを制限。cheekPuff は輪郭に変形パス、口開閉時は重み制限。mouthLeft/Right は斜め上へずらし顎・頬も動かす。jawOpen を口開閉に足すと顎が長くなりやすい。tongueOut は組合せの手調整が膨大で、トラッキング精度も低い。

### 唇の赤み・ハイライトは別パーツ、舌・歯・口の影も分けて振り向きで動かす
- 出典: フィル・フィッツジェラルド / note「Live2D初心者講座⑤パーツ分け編 口について」
- リンク: https://note.com/phil_ampmv/n/nea229fbe19db
- 画像: https://assets.st-note.com/production/uploads/images/21110715/picture_pc_09eeb557ce2b947dc9f56c136e0fd4cd.jpg?width=1200 、 https://assets.st-note.com/production/uploads/images/21111922/picture_pc_29eb0009a1acbdc87f7b1679d94fddea.jpg?width=1200
- 要点: パーツ分けは開いた口から考える（閉じ口を想像しやすく、口内パーツの描き忘れも防げる）。上下唇は肌色部分ごと、隙間なく。唇から離れた肌はよく動くので唇の赤み・ハイライトは別パーツに（赤みは下唇にクリップ）。口内はベタ塗り（歯・舌をクリップするため）。舌・歯・口の影は別にして振り向き・傾きで動かすと奥行き。歯は「い」のときだけ見せる手も。

### イラスト側の下絵：閉じ目・ニコ目、母音は「あ・い・お」必須
- 出典: 夏水かなた / note「Live2Dパーツ分け補足（イラストレーター向け）」
- リンク: https://note.com/kanata_natsumi/n/n7f96b96b6e26
- 画像: https://assets.st-note.com/img/1690749929758-FQBASwxYJ8.png?width=1200 、 https://assets.st-note.com/img/1665988029206-Q3cmLPkGCL.png?width=1200
- 要点: 口は上唇・下唇・上歯・下歯・舌・口内に分け、口の形は最大に開いたときに合わせて描く。下絵として閉じ目とニコ目、母音「あ・い・お」（できれば「う・え」）を用意。しいたけ目など差分パーツも。口マスクの要否はモデラー次第なので確認。

### イラスト側：上向きまつ毛は閉じ目用に別レイヤー、上唇の色は分ける、頬は輪郭外まで
- 出典: せみこ / note「Live2Dのパーツ分け」
- リンク: https://note.com/kamibukuro_0/n/n12d9227a6d56
- 画像: ページ内にあり
- 要点: 片目を作って反転するので左右の目は似せて描く。閉じ目用に上向きまつ毛を別レイヤー。上唇の色は分けると動きが綺麗。頬（赤面・ハートなど）は顔にクリップされるので輪郭からはみ出して描く。顔全体は塗りつぶさず縁だけ影。

### 舌・八重歯：肌八重歯→口内八重歯へ滑らかに切り替える
- 出典: gemini works / BOOTH「Live2D Study File 01: Mana-chan」商品説明
- リンク: https://booth.pm/en/items/5811084
- 画像: https://booth.pximg.net/1ed7063a-58b9-48f7-a308-8ffda5b13fcd/i/5811084/52403cb7-08eb-4d6d-8b7d-fcf6689fce38_base_resized.jpg
- 要点: 口を閉じているときは唇の外（肌）に乗る八重歯、開くと口内の八重歯に滑らかに切り替わる口。母音トラッキング（Mouth X）、頬ぷく、舌出し、VBridger 版も含む学習用 cmo3。

### 舌出しのデフォーマ階層（フル口形をトラッキング可能なまま）
- 出典: Maoxy / beehiiv「Maoxy Live2D Study File: Expressive VBridger Tongue Out Setup」
- リンク: https://maoxyart.beehiiv.com/p/maoxy-live2d-study-file-expressive-vbridger-tongue-out-setup-cmo3-with-preview-video
- 画像: https://media.beehiiv.com/cdn-cgi/image/fit=scale-down,quality=80,format=auto,onerror=redirect/uploads/asset/file/e6d68cf7-5309-4ba7-822b-0e4ffd354db8/Preview.png?t=1783815320
- 要点: 舌出し用のデフォーマ階層を組み、全口形をトラッキングできる状態のまま舌出しを足す。VBridger パラメータはブレンドシェイプの重み設定で構成（詳細は有料ファイル内）。

### 涙モーション・ぷるぷる目の学習データ
- 出典: orangemikan / BOOTH「Live2Dプリンプリン目+淚モーション」
- リンク: https://booth.pm/ja/items/4781976
- 画像: https://booth.pximg.net/5ea2f0a6-79d0-41e9-b60d-c69ffad02a03/i/4781976/79bd4913-1185-4d06-a63b-cb12cb5522fc_base_resized.jpg
- 要点: 目のパーツ分け PSD とデフォーマ構造、涙が流れる can3 モーション。中身未確認（目の揺れ・涙は「ぷるぷる目」系の表現として需要がある、という手がかり）。

### 口はヘッド回転デフォーマの子のワープへ / 半透明のノイズは不透明物で覆う
- 出典: Live2D Creators Forum「Modeling 101: layering the character」「Cleaning up the mouth area」「Mouth open doesn't follow head angle XY」
- リンク: https://community.live2d.com/discussion/318/modeling-101-layering-the-character 、 https://community.live2d.com/discussion/72/cleaning-up-the-mouth-area 、 https://community.live2d.com/discussion/1176/mouth-open-doesn-t-follow-head-angle-xy
- 画像: なし
- 要点: 口は上唇・下唇・歯・口内の4層（下の歯は無くてもよいキャラが多い）。唇は口内の上に乗るのでマスク無しでも可、歯・舌のはみ出し防止にはマスク。口パーツ全体をヘッド回転デフォーマ子のワープに入れて顔XYに追従。口まわりの半透明部分に出るノイズは不透明オブジェクトで覆う。

### 口を開くと顔XYが元に戻る → デフォーマの親子関係を疑う
- 出典: Live2D Creators Forum「mouth not following x form when open」（Live2D サポート回答）
- リンク: https://community.live2d.com/discussion/1266/mouth-not-following-x-form-when-open
- 画像: https://us.v-cdn.net/5021645/uploads/editor/fm/f652q7czvswt.png
- 要点: 閉じ口では顔Xに追従するのに、開くと元位置に戻る症状は、口開閉キーを打っているワープの親子関係が誤っている可能性。

### 顔の向きで口が顔の反対側へ移る（ソニック型）
- 出典: Live2D Creators Forum「Rigging the mouth where it changes based on where the head is facing」
- リンク: https://community.live2d.com/discussion/1724/rigging-the-mouth-where-it-changes-based-on-where-the-head-is-facing
- 画像: なし
- 要点: マズル型キャラのように、顔の向きで口が左右反対側に回り込む表現は、口にワープを付けて角度Xに結び、端の角度で反対側へ移す。
- seed 外（デフォルメ／ケモ系の口）

### リップシンク：口が閉じるまで 100〜300ms、口の縦と横を分けて割り当て
- 出典: Live2D 公式 / note「新機能！nizima LIVEリップシンク解説！！」
- リンク: https://note.com/live2dnote/n/nf9f6c2e5b218
- 画像: https://assets.st-note.com/img/1680241754485-lvJOsHu7PM.png?width=1200
- 要点: 音声が止まって口が閉じるまでの時間を 0ms にすると機械的なパクパクになる。100〜300ms で実際の口に近づく。母音ごとに入力倍率を個別調整。開閉だけをリップシンク、他はカメラ、のように縦・横を分けて割り当てる構成も。

### VTube Studio：笑顔・目の笑顔の入力は真顔≒0／満面=1／すぼめ=-1 に合わせる
- 出典: coconala ブログ「【VTube Studio】動きのセットアップ方法」、DenchiSoft VTubeStudio Wiki「VTS Model Settings」
- リンク: https://coconala.com/blogs/3913222/631906 、 https://github.com/DenchiSoft/VTubeStudio/wiki/VTS-Model-Settings
- 画像: なし
- 要点: トラッキング入力の範囲を、真顔で約0、満面の笑顔で1、すぼめた唇で-1 になるよう合わせる。力を抜いた閉じ口が出力で 0 付近になるのが理想。VTS の標準入力は MouthOpen / MouthSmile、Brows は左右まとめた上下、MouthX で口の横ずれ。
- seed 外（トラッキング側の調整。モデル側の作り込みの前提として拾った）

## X への手がかり
- @zombieFFF（ゾンビうつけくん）: note「眼球感のある目モデリング」「しいたけ目」の著者。解説動画一覧スプレッドシートへのリンクあり。
- @memoryview（めぃまぁ）: note「綺麗かつ簡単に口を作る方法」の著者。
- @makotok1: note「肌色延長やグルーを使わずに口を作る方法」の著者。
- @asano_negoto（朝野ねごと）: note「Live2D備忘録」シリーズ（目・口）の著者。
- @daneko_ko（伊糖だねこ）: note「Live2D練習記録」シリーズの著者。記事中で口形参考として @Amase_Oruko（天瀬おるこ）に言及。
- @ainosistem（愛）/ @KAYAMARU_art（花弥丸）: note「live2Dの習得記録」（口メッシュ、眉、笑顔閉じ目、顎）の著者とイラスト担当。
- @himono_vtuber（乾物ひもの）: note「高可動域モデルの顔の角度XYのすすめ」の著者。書籍『Live2D モデリング&アニメーションTips』共著者（他に唐揚丸・ののん。・fumi）。
- @totorichu（ととり）: note「破綻しづらい顔XYのコツ」の著者。口の線は乾物ひもの氏の技法と明記。
- @H0x0Hal（hal）: note「彫りの深いモデリング」の著者。
- @moimoi_sp（もいもい）: note「Live2Dモデル制作～販売まで」シリーズ（顔・差分）の著者。
- @phil_ampmv（フィル・フィッツジェラルド）: note「Live2D初心者講座 パーツ分け編 口」の著者。
- @kanata_natsumi（夏水かなた）: note「パーツ分け補足（イラストレーター向け）」の著者。
- @nanam_mzh（水平ななめ / みずのひら）: note「VBridgerでの口の作り方」の著者。
- @SHITAKE898（椎丈）: note「パーフェクトシンク対応モデルを作ってVBridgerを知る」の著者。
- BOOTH の口・目の学習用 cmo3（レート.SOJ「口 学習用モデル」 https://booth.pm/ja/items/6821415 は「過去のSNS投稿の口の作り方」に対応するとのこと。元投稿は X の可能性あり）。
- ANYCOLOR 講演（alive 2024）の登壇者名・アカウントはレポート中に記載なし。

## 検索記録
- 「Live2D 目パチ コツ」: pixiv 百科事典ばかりで不発。
- 「Live2D 口の作り方 母音 あいうえお」「Live2D mouth rigging tips vtuber」: 公式「あいうえお20分」チュートリアル（動画中心で本文は薄い）、VTuber 向け総論記事（viverse 等）、Fiverr 出品。総論は具体性が低く拾わず。
- 「Live2D eye blink rigging tips」「live2d eye physics iris bounce」: Live2D Creators Forum、r/Live2D（reddit.com は取得不可。検索抜粋のみ）、YouTube ミラー・要約サイト（chaindesk.ai はリンク切れ、yt.d0.cx は取得不可）、有料 cmo3（Gumroad / itch.io / Patreon）。
- docs.live2d.com 内検索（目・口・表情・パラメータ・反転マスク・素材分け）: 公式チュートリアルは画像が直接取れて基礎として有用。
- note.com 内検索（目 モデリング コツ / 口パク / 眉 / 目 笑顔 / 舌 歯 口内 / 涙 頬 赤面 / VBridger）: 個人モデラーの制作記録・備忘録が最も具体的で、今回の主な収穫源。数値（0.85、0.3/0.7、100〜300ms 等）や順序の知見が多い。
- BOOTH 内検索（学習用 cmo3）: 学習データの商品説明は「何を作り込んでいるか」の手がかりにはなるが中身は有料・未確認。
- 「VBridger mouth parameters」「Perfect Sync」: 英語の文章解説は少なく、日本語 note のほうが具体的だった。
- 「眉 前髪 透け」「頬 ぷくー CheekPuff」「ウインク」「舌出し」「へ字口」「口角 片方」「涙」: 一般検索ではほぼ不発。note 内検索で一部回収。ウインク・涙・歯の専用解説は見つからず。
- Animaze マニュアル、Warudo ドキュメント、VTube Studio Wiki: トラッキングソフト側の資料。モデル側の作り込みに関わる部分だけ拾った。
- Google Docs の英語チュートリアル集（Live2D rigging tutorials まとめ）はリダイレクト先が 400 で読めず。
- dev.to の初心者体験記、Fiverr/coconala の出品、pixiv 百科事典は具体的テクニックが薄く拾わず。
