# 集めるメモ（Web）: 髪、物理の揺れ

> フェーズ1（集める）の生メモ。原文用語のまま、加工前。調査日: 2026-10-19。

## メモ

### 毛先と中央のタイミングをずらして柔らかく
- 出典: CGWORLD「『バンドリ! ガールズバンドパーティ!』の登場キャラを魅力的にした、Live2Dによるモーション制作」/ 2017-09
- リンク: https://cgworld.jp/feature/201709-cgw230HS-bang-2.html
- 画像: ページ内にあり
- 要点: 初期は髪揺れが硬かったが、髪の先端と真ん中の動きのタイミングをずらしたら複雑で柔らかい揺れになった。物理演算は補助に使い、最終的にはほぼ手付けのキーで仕上げた。

### ツインテールの弾み: 裏側パーツを描き足して伸縮 / 毛先を細かく分割
- 出典: CGWORLD（同上）/ 2017-09
- リンク: https://cgworld.jp/feature/201709-cgw230HS-bang-2.html
- 画像: ページ内にあり
- 要点: 同じツインテールでもキャラごとに揺れ方を変える。弾む動きには裏側のパーツを描き足して伸縮させ、柔らかい印象には毛先を細かくパーツ分けする。

### 「ふわふわ感」: 髪は先端まで動くように作る
- 出典: gamebiz / 西根奈都実（Live2Dアニメーター）セミナーレポート / 2017-08-08
- リンク: https://gamebiz.jp/news/189592
- 画像: ページ内にあり
- 要点: 女の子の柔らかさを出すため、髪の毛先まで動くように作り「ふわふわ感」にこだわった。顔周り（髪含む）は衣装替えでも使い回すので力を入れる価値がある。

### 子パーツを親デフォーマからはみ出させない（計算量）
- 出典: gamebiz（同上）/ 乾物ひもの note（下記）でも同趣旨
- リンク: https://gamebiz.jp/news/189592
- 画像: なし
- 要点: 子が親から少しでもはみ出すと計算量が増える。Cubism には「親デフォーマからはみ出した頂点をハイライト」「デフォーマの検証」がある。
- seed 外

### 物理演算は入力・物理モデル・出力の3要素 / ダミー風パラメータ
- 出典: Qiita @aoneko_aoneko「【Live2D】物理演算の基本とダミーパラメータを使った風表現のススメ」/ 2018-02-03
- リンク: https://qiita.com/aoneko_aoneko/items/798bab14b759d67b2a6c
- 画像: https://qiita-user-contents.imgix.net/https%3A%2F%2Fqiita-image-store.s3.amazonaws.com%2F0%2F232924%2F9ac47a5c-8161-a3e1-59d2-316a085977aa.gif?ixlib=rb-4.1.1&auto=format&gif-q=60&q=75&s=2e70cb4c77912547ad05d4477fb8db31 （風による揺れ）、https://qiita-user-contents.imgix.net/https%3A%2F%2Fqiita-image-store.s3.amazonaws.com%2F0%2F232924%2Feab374b7-b841-69e5-fc24-8cd3478b99e9.gif?ixlib=rb-4.1.1&auto=format&gif-q=60&q=75&s=09a7e2654401788be22db04aa5e0ee66 （髪揺れ例）
- 要点: 「風」用のダミーパラメータを作って物理入力にし、一定振幅で動かすと静止中も髪がそよぐ。首の動きと組み合わせ可。振り子シミュレーションなので途中で風の振幅を変えると不自然になり、突風は手付けが必要。

### 物理演算の確認は Viewer ではなくアニメータ上で / ベイク忘れ注意
- 出典: Qiita @aoneko_aoneko（同上）
- リンク: https://qiita.com/aoneko_aoneko/items/798bab14b759d67b2a6c
- 画像: なし
- 要点: Viewer で良く見えてもアニメータ上だと想定通りに動かないことが多く、モデラーとアニメータを何度も往復して調整する。動かない原因がアニメーションベイク忘れだった例あり。

### 入力の正規化で「頭を傾けたとき髪が真下に垂れて静止」させる
- 出典: Live2D 公式 Cubism Editor マニュアル「物理演算設定」
- リンク: https://docs.live2d.com/cubism-editor-manual/physics-operation/
- 画像: https://docs.live2d.com/cms/wp-content/uploads/2025/12/About-Physics_06-ja.gif ほか About-Physics_01〜12-ja
- 要点: 角度入力の正規化（デフォ -10/0/10）をモデルごとに調整し、頭の傾きに対して髪が重力方向に垂れて止まるようにすると品質が上がる。位置Xは通常デフォルトのまま。

### 振り子4項目の意味（長さ・揺れやすさ・反応速度・収束の速さ）
- 出典: Live2D 公式 Cubism Editor マニュアル「物理演算設定」
- リンク: https://docs.live2d.com/cubism-editor-manual/physics-operation/
- 画像: ページ内にあり
- 要点: 長さ小=速く、大=ゆっくり。揺れやすさ目安 0.7〜0.99。反応速度は多段では「親の動きに対する子の反応」。収束の速さ大=早く収まる。出力は親振り子との相対角度×倍率。

### 最大出力100%付近に合わせる（出力調整アップ/ダウン）
- 出典: Live2D 公式マニュアル「物理演算の設定方法」
- リンク: https://docs.live2d.com/cubism-editor-manual/physical-operation-setting/
- 画像: https://docs.live2d.com/cms/wp-content/uploads/2025/07/How_to_Set_Up_Physics_33-ja.png
- 要点: 最大出力が100%を大きく超えると振り切れてカクつく。足りなければ「出力調整（アップ）」。多段スキニングの髪では倍率20前後が目安とされる。振り子Noと出力パラメータ数がずれると綺麗に揺れない。

### 入力を「体の回転Y」にするとジャンプで髪がふわっと広がる
- 出典: Live2D 公式マニュアル「物理演算の設定方法」
- リンク: https://docs.live2d.com/cubism-editor-manual/physical-operation-setting/
- 画像: https://docs.live2d.com/cms/wp-content/uploads/2025/07/How_to_Set_Up_Physics_09-ja.gif
- 要点: 上下方向の動きを入力にして、跳ねた時に髪が浮く表現を作れる。

### 左右対称の揺れ物は出力「反転」で広がる動きに
- 出典: Live2D 公式マニュアル「物理演算の設定方法」
- リンク: https://docs.live2d.com/cubism-editor-manual/physical-operation-setting/
- 画像: https://docs.live2d.com/cms/wp-content/uploads/2025/07/How_to_Set_Up_Physics_35-ja.gif
- 要点: 左右の髪を1グループにまとめ、片側の出力を反転すると、同方向に揺れるのでなく「ふわっと開く」動きになる。

### 角度X と 体の回転X の影響度バランスで揺れ量が激変
- 出典: Live2D 公式マニュアル「物理演算の設定方法」
- リンク: https://docs.live2d.com/cubism-editor-manual/physical-operation-setting/
- 画像: https://docs.live2d.com/cms/wp-content/uploads/2025/07/How_to_Set_Up_Physics_12-ja.gif , https://docs.live2d.com/cms/wp-content/uploads/2025/07/How_to_Set_Up_Physics_13-ja.gif
- 要点: 角度Xを弱く・体Xを強くすると髪はほとんど揺れない。影響度の割り振り自体が揺れ方のデザインになる。

### 揺れの動きの自動生成（髪揺れ / 角度Zによる垂れ下がり）
- 出典: Live2D 公式マニュアル「揺れの動きの自動生成」
- リンク: https://docs.live2d.com/cubism-editor-manual/auto-generation-of-sway-motion/
- 画像: https://docs.live2d.com/cms/wp-content/uploads/2024/06/髪揺れ.gif , https://docs.live2d.com/cms/wp-content/uploads/2024/06/角度Z.gif , https://docs.live2d.com/cms/wp-content/uploads/2025/08/AutoGenerationOfSwayMotion_09-ja.png
- 要点: ワープデフォーマ対象に、支点（上下左右）・揺れの大きさ（横/縦）・柔らかさ・拡大縮小を指定して揺れキーを生成。「柔らかさ」を上げると上部はほぼ動かず下部だけ揺れる。デフォーマサイズから初期値を推定。

### 揺れ自動生成の支点を任意位置に（要望）
- 出典: Live2D Creators Forum
- リンク: https://creatorsforum.live2d.com/t/topic/3876
- 画像: なし
- 要点: 自動生成の揺れの支点を上下左右以外の任意位置にしたいという要望スレ。支点＝根元の位置が揺れの質を決めるという認識が見える。

### 揺れは大げさに作り、出力側で絞る
- 出典: CGbox kasahara「【Live2D】髪揺れの作り方とクオリティアップするためのノウハウ」/ 2019-08-07
- リンク: https://cgbox.jp/2019/08/07/live2d-kamiyure/
- 画像: ページ内にあり（base64埋め込み）
- 要点: 物理で端まで振り切れることはまずないので、揺れのキーは大きめに作って出力設定で調整する。

### 前髪は控えめ・後ろ髪は大きく、髪ごとに物理モデルを変えてバラバラに揺らす
- 出典: CGbox（同上）
- リンク: https://cgbox.jp/2019/08/07/live2d-kamiyure/
- 画像: ページ内にあり
- 要点: 全部同じ設定だと一斉に揺れて不自然。髪ごとに物理セットを変えるとバラけて自然。長い髪は反応速度を落とす。

### 横揺れだけだと規則的 → 縦の動きを足す（ポニーテール向き）
- 出典: CGbox（同上）
- リンク: https://cgbox.jp/2019/08/07/live2d-kamiyure/
- 画像: ページ内にあり
- 要点: デフォーマで作る髪揺れは横だけだと機械的。縦方向の伸縮を加えると自然で、ポニーテールに合う。胸揺れにも同じ技法。

### 角度Zで髪を下に垂らすように傾ける
- 出典: CGbox（同上）
- リンク: https://cgbox.jp/2019/08/07/live2d-kamiyure/
- 画像: ページ内にあり
- 要点: 頭の傾きに対して髪を重力方向へ垂らす形を角度Zで付けておくと揺れも綺麗。正規化でも調整できるがやりすぎは不自然。

### スキニングは回転デフォーマが形状変化を伝えない問題への対策
- 出典: CGbox（同上）
- リンク: https://cgbox.jp/2019/08/07/live2d-kamiyure/
- 画像: ページ内にあり
- 要点: 回転デフォーマの子は位置しか受けないので、スキニング前にアートメッシュ側へ直接パラメータを打ち、XYはデフォーマ側で調整する。スカートや後ろ髪は変形パスだと絵が歪むので多階層デフォーマ推奨。

### 多段は段々短く / 揺れやすさ0.8〜0.95 / ゆったり例: 反応0.5・収束1.5
- 出典: CGbox kasahara「【Live2D】髪揺れを滑らかに！物理演算の設定を完全解説」/ 2020-04-14
- リンク: https://cgbox.jp/2020/04/14/live2d-buturi/
- 画像: ページ内にあり（base64）
- 要点: 多段振り子は下の段ほど長さを短くすると綺麗。固い髪は反応速度大、ボブや長い後ろ髪のゆったり揺れは反応小。同じ揺れの横髪群はグループ複製して出力先だけ差し替えると効率的。

### 「ゆるふわ」プリセット: 2段（全体＋毛先）、収束0.4前後
- 出典: note うなぬん「初心者でもできる！髪のふわふわ物理演算設定！【Live2Dアドカレ2021】」/ 2021-12
- リンク: https://note.com/unanun/n/n3bdcb636bb4e
- 画像: ページ内にあり
- 要点: 揺れは全体用と毛先用の2段に。元の動きを1.2倍程度大げさに作り、拡張補間を有効化。例値: 1段目 長さ10/揺れ0.95/反応0.75/収束0.53、2段目 長さ7/揺れ0.86/反応0.82/収束0.47。揺れやすさは0.01刻みで効く。

### 反応速度を下げる＝髪が顔に遅れてついてくる
- 出典: note うなぬん（同上）
- リンク: https://note.com/unanun/n/n3bdcb636bb4e
- 画像: ページ内にあり
- 要点: 反応速度を下げると振り子が反応するまでの遅れが増え、頭の後から髪が追いかける感じになる。1段だけだと単調で物足りない。

### スキニング髪: 頭頂のパラメータは使わない / 1段目は揺れないクッション振り子
- 出典: note ゾンビうつけくん（ZombieFFF）「初心者でも10分でプロ級！『スキニング』で髪をサラサラに揺らす全手順」/ 2026-02-15
- リンク: https://note.com/zombiefff/n/n683311cdc7da
- 画像: ページ内にあり
- 要点: 変形パス3〜4本でスキニング。物理出力には頭頂部のパラメータを入れず、1段目を揺れない振り子にして緩衝にする。上→下で値を「高・低・やや高」に。スキニングは揺れが大きめに出るので最大出力を控えめに。多段は重くなるので必要箇所だけ。

### 3Dっぽい髪揺れ: 毛先揺れ / X1ねじれ / X2左右 / Y1すぼまり / Y2上下 の5系統
- 出典: note ゾンビうつけくん「まるで3D?! みたいな髪揺れを作ろう！」/ 2026-01-18
- リンク: https://note.com/zombiefff/n/n8a51825e01b6
- 画像: ページ内にあり
- 要点: 毛先はアートメッシュのブレンドシェイプ、X系は毛束ごとのデフォーマ、Y系はその親デフォーマで作り、4隅自動生成で組み合わせを埋める。物理はX・Y・毛先で別グループにし、毛先グループの入力をX2とY2（Y2は反転）にする＝揺れの連鎖。

### スキニング自動生成パラメータ範囲が±30〜45で物理が効かない
- 出典: 旧Live2Dコミュニティ tsukue「スキニングで髪がほぼ揺れない場合の話題…」/ 2019-09
- リンク: https://forum.live2d.com/discussion/1629/
- 画像: なし
- 要点: 回転デフォーマ用生成パラメータが±30、変形パスからのスキニングが±45になり、倍率1だと±1しか動かないため揺れない。範囲を±1程度に直すか倍率を大きくする。

### 髪の根元を全パラメータで固定する（27方向チェック）
- 出典: 旧Live2Dコミュニティ Mania「髪の物理演算の動き」/ 2016-10
- リンク: https://forum.live2d.com/discussion/493/
- 画像: なし
- 要点: 横を向くと髪が「ボワンボワン」跳ねた原因は物理設定でなく、角度X・角度Y・髪揺れの組み合わせで根元位置がずれていたこと。最上部の頂点が動かないよう合わせ、モニターに付箋で根元位置を印すと楽。

### 添削で繰り返される指摘: 根元を揺らさない / 0起点で往復させない
- 出典: Live2D JUKU「Live2D作品添削生配信！」各回まとめ
- リンク: https://juku.live2dcs.jp/en/course/course-22/
- 画像: https://img.youtube.com/vi/my7cGxG1c_A/maxresdefault.jpg （#101 髪の多段揺れ）, https://img.youtube.com/vi/j8KIm04cbRE/maxresdefault.jpg （#55 揺れのコツ）
- 要点: 根元は動かさず半分より下を揺らす。パラメータを一方向に動かしたとき形が行って戻る（0を起点に往復する）キーにしない。長さの違う髪は物理を分ける。先端ほど振れ幅が大きくなる振り子のイメージで。

### 根元から毛先へ2〜3振り子、毛先ほど軽く / 揺らしすぎは酔う
- 出典: shiroikarasu.net kitagawatetsuro「Live2Dの物理演算（Physics）の設定【2026年版】」/ 2026-08-29
- リンク: https://shiroikarasu.net/live2d-physics-settings-guide/
- 画像: ページ内にあり（base64）
- 要点: 毛先ほど軽く。アクセサリーは本体より一拍遅れる程度。主役は髪で他は控えめ、揺らしすぎると視聴者が酔う。確認項目: 大きく振っても体を突き抜けないか、止めたら収まるか。

### 症状別切り分け:「数値をいじるのは最後」
- 出典: shiroikarasu.net「Live2Dで髪が揺れない・動きが不自然を直す方法【2026年版】」/ 2026-08-07
- リンク: https://shiroikarasu.net/live2d-physics-not-working-fix/
- 画像: なし
- 要点: 揺れない時は 入力→出力ID→元の変形量→物理強度 の順に疑う。頭と髪が同時に動いて見える→反応速度を遅く。安っぽい→2段で毛先だけ遅らせる。配信ソフトのスムージングと二重がけに注意。

### Y軸（上下）でだけ左右の髪を逆に揺らす
- 出典: VTuber解剖学 kasahara「【Live2D】X軸とY軸でそれぞれ揺れ方を変える方法」/ 2021-09-27
- リンク: https://vtuberkaibougaku.site/2021/09/27/live2d-yure-xy/
- 画像: ページ内にあり
- 要点: 左右の髪それぞれ入力に角度X・角度Yを入れ、片側だけ角度Y入力を反転すると、上下を向いた時だけ左右の髪が逆方向（開く/閉じる）に動く。

### パーツ分け: 前髪・横髪・後ろ髪→毛束、長い髪は一房単位 / XY・Z・揺れの入れ子
- 出典: note ナナメ「Live2Dの見栄えを良くしてみよう:髪の毛編」/ 2019-02-16
- リンク: https://note.com/7name/n/ncc81f4864d63
- 画像: https://assets.st-note.com/production/uploads/images/10008491/picture_pc_4dc4c70f6c00f3c0c5943f3308feaa77.gif?width=1200 （奥行き・重力感）, https://assets.st-note.com/production/uploads/images/10008488/picture_pc_307c5a094b9dd431b59ec88505df34c6.jpg?width=1200 （入れ子）
- 要点: デフォーマは XY → Z → 揺れ の順に入れ子。XYとZで奥行きと重力感を意識。スキニング後は元絵パーツを非表示ロックして二重表示を防ぐ。

### デフォーマ階層: Face Rotation > 髪XY > 髪Swing、分割数は髪形で
- 出典: Live2D Cubism 4.0 Cookbook（r3dhummingbird, GitBook）
- リンク: https://r3dhummingbird.gitbook.io/live2d-cubism-cookbook/modeling-and-rigging/deformer-hierarchy
- 画像: なし
- 要点: 物理用ワープは角度XYのワープの内側にネストして頭の動きを継承。横長の前髪は3x2、長い横髪・後ろ髪は2x3のグリッドが目安。

### 後ろ髪は角度Xで顔・前髪と逆方向へ / 頭頂部は前髪カーブと同方向
- 出典: 検索スニペット（note 伊糖だねこ / castcraft 等の角度X解説）
- リンク: https://castcraft.live/blog/464/
- 画像: ページ内にあり
- 要点: 後ろ髪は頭の奥にあるので振り向き時に顔と逆に動かし、手前の幅を狭く奥を広く。奥の髪パーツは描画順を下げて前後関係を保つ。
- （未精読。スニペットからの要約）

### 角度Zのしなり: 左右同時に作って「動きの反転」、真下に引っ張る
- 出典: note 愛（live2Dの習得記録）「左右同時制作！髪のしなり攻略法 楽で綺麗！『一括反転』」/ 2026-03-29
- リンク: https://note.com/hoshinotomoshibi/n/n65070f426678
- 画像: https://assets.st-note.com/img/1774748012-fJrPjcetKxAl4mRhZg98MGaD.png?width=1200
- 要点: 後ろ髪をまとめワープに入れ、角度Z -30で左右の髪を同時に見ながらしなりを作り、反転で+30を生成。単純回転だと板状になり顔にめり込むので、点を真下方向へ引いて重みとカーブを出す。

### 前髪・横髪・後ろ髪それぞれに XY ボックスを持たせて遠近を合わせる
- 出典: note 愛（hoshinotomoshibi）「前髪・横髪・後ろ髪の『XYボックス』で遠近感を揃える」/ 2026-04-23
- リンク: https://note.com/hoshinotomoshibi/n/n9e013165fe16
- 画像: https://assets.st-note.com/img/1776929242-XGbNufZDF9sEd1cRwlhSreBp.png
- 要点: 角度Z（傾き）とXY（振り向き）を別デフォーマに分けると後で直しやすい。片側の極値の形を Ctrl+Shift+C/V で反対側へコピーして手直し。

### 前髪は大きなデフォーマでまとめて、毛先（物理）側から設定
- 出典: note 乾物ひもの「Live2D 高可動域モデルの顔の角度XYのすすめ③」/ 2021-04-19
- リンク: https://note.com/himono_vtuber/n/ne6f7c0fdfdaa
- 画像: https://assets.st-note.com/production/uploads/images/49963845/picture_pc_45372b9bc89aba4643e244b581fac263.png?width=1200
- 要点: 毛束ごとに別デフォーマだと調整地獄なので大きなデフォーマでまとめると破綻しにくい。毛先（物理演算）側から順に設定するとはみ出しを防ぎやすい。頭蓋骨の丸みを意識。

### 筒状の横髪は複製して輪郭を2枚で挟む
- 出典: note 乾物ひもの（同上）
- リンク: https://note.com/himono_vtuber/n/ne6f7c0fdfdaa
- 画像: https://assets.st-note.com/production/uploads/images/49963973/picture_pc_6235f9880ea335bc58b72f0da3c103c9.gif?width=1200
- 要点: 横髪パーツを複製し、奥側は輪郭より下の描画順にして、横向き時は手前だけ大きく変形。描画順切替のチラつきを避けつつ奥行きを出す。リボン状の横髪は上部だけ幅を縮め下部は形を残す。

### 横髪: 上を向くと幅を縮めて上へ / 下を向くと上部だけ変形し下はストンと垂らす
- 出典: note 乾物ひもの（同上）
- リンク: https://note.com/himono_vtuber/n/ne6f7c0fdfdaa
- 画像: https://assets.st-note.com/production/uploads/images/49964011/picture_pc_11c141f0b04f595489cd702e54f08f0d.gif?width=1200
- 要点: 上向きでは顔が反るので髪が斜め後ろに引かれる表現、下向きでは重力で下部はそのまま落とす。

### 「交点」基準で滑りを防ぐ（髪ハイライト、髪と目・眉）
- 出典: note 乾物ひもの（同上）
- リンク: https://note.com/himono_vtuber/n/ne6f7c0fdfdaa
- 画像: https://assets.st-note.com/production/uploads/images/49964169/picture_pc_c536fadd6f4a33b2622d30b3f58bfbb8.gif?width=1200
- 要点: 奥行きがほぼ同じもの（髪とハイライト）は交点を固定しないと滑って見える。奥行き差がある髪と目・眉は、横を向くと手前の髪が進行方向へ押し出される。基本順「奥→手前→進行方向」。

### 後ろ髪の側面パーツを追加して横向きの隙間・影を隠す / 側面は横向きで描いて縮める
- 出典: note 乾物ひもの（同上）
- リンク: https://note.com/himono_vtuber/n/ne6f7c0fdfdaa
- 画像: https://assets.st-note.com/production/uploads/images/49964308/picture_pc_4748401ca44d30540dc3c4b74920cec3.png?width=1200
- 要点: 後ろ髪の側面が無い/狭いと横を向いた時に隙間から影が見える。原画に無ければ追加（イラストレーターに確認）。側面の髪は横向き状態で描いて正面時に縮めると綺麗。後頭部の丸い部分は別パーツにすると変形しやすい。

### つむじのある絵柄は下向きで隙間 → 影パーツを左右に追加
- 出典: note 乾物ひもの（同上）
- リンク: https://note.com/himono_vtuber/n/ne6f7c0fdfdaa
- 画像: https://assets.st-note.com/production/uploads/images/49964477/picture_pc_10d8d365536c16fe1381dc934f80f578.gif?width=1200
- 要点: つむじが描かれていると下を向いた時に大きな隙間ができる。影パーツを左右に足してデフォーマで連動させる。

### 後ろ髪のデフォーマ構成例: 回転 → 物理1 → 物理2 → アートメッシュ
- 出典: note 乾物ひもの（同上）
- リンク: https://note.com/himono_vtuber/n/ne6f7c0fdfdaa
- 画像: https://assets.st-note.com/production/uploads/images/49964433/picture_pc_6f9fc9d11a612e43f796fbe4837cb0bd.gif?width=1200
- 要点: 回転デフォーマで大まかに、アートメッシュ直接変形で微調整、その間に物理用変形を挟む。ツインテ・リボン等の側面小物は側面の髪に合わせ回り込むように動かす。

### 物理で体を顔に追従させる / 体Yバウンドで弾みを足す
- 出典: note 乾物ひもの「こんなことまで出来る！？Live2Dの裏技的物理演算活用法【Live2Dアドカレ2021】」/ 2021-12-11
- リンク: https://note.com/himono_vtuber/n/n9015f0030d53
- 画像: https://assets.st-note.com/production/uploads/images/67524302/picture_pc_c020dd9931f23b9724922dc9e4796ac4.gif?width=1200 , https://assets.st-note.com/production/uploads/images/67533034/picture_pc_6a27936105bdf809c3c37e3ebd73e868.gif?width=1200
- 要点: 入力=顔角度、出力=体角度で体が一瞬遅れて戻る動き。位置X振り子で中継パラメータを動かし角度へ反転して戻すと「弾み」を作れる。中継パラメータで上半身と下半身の動きをブレンド。
- seed 外

### 多段振り子: 前髪・横髪は1段、後ろ髪Xは4段 / 毛先を一番下に並べる
- 出典: note 伊糖だねこ「Live2D練習記録⑧ ー 猫耳と尻尾・物理演算 ー」/ 2026-01-16
- リンク: https://note.com/itodaneko/n/n3b5e2ada3f4b
- 画像: https://assets.st-note.com/production/uploads/images/244267845/picture_pc_272cbae41c6ad159eb374e3e6d5e7afb.gif?width=1200
- 要点: 複数ブレンドシェイプを毛先から根元へ段階的に大きく作り、出力に根元を上・毛先を下で並べる。角度X用の揺れには角度Zを少し、角度Y用には位置を混ぜると豊かになる。

### 猫耳ピコ: 眉の上下や目の開閉を物理入力に混ぜる
- 出典: note 伊糖だねこ（同上）
- リンク: https://note.com/itodaneko/n/n3b5e2ada3f4b
- 画像: https://assets.st-note.com/img/1768554063-9SkmKzfqwRl6veFQAu2WboyV.jpg?width=1200
- 要点: 頭の角度だけでなく眉・目の開閉を振り子入力にして感情連動で耳が動く。尻尾は体の回転Xで逆に動くので反転。
- seed 外

### 入力影響度は合計115%以下 / position と angle の取り違えで高速反転
- 出典: live2d-e（tumblr）「A look at Physics in 4.0」/ 2020-06-19
- リンク: https://live2d-e.tumblr.com/post/621382565322948609/a-look-at-physics-in-40
- 画像: https://64.media.tumblr.com/f610be8e7b67e7e5a25cdac0a89c125d/fb274ebda560169d-2b/s500x750/6693862bb24c1bb313167dafeb62cd004b237054.png （変形による揺れ）
- 要点: 耳や髪は回転させるだけでなくコマ撮り的に変形させると自然。入力種別を誤って position にすると揺れでなく高速で反転する。

### 前髪はX方向のみ、斜めに傾けない
- 出典: 兼子「【Live2D】物理演算とは何か？物理演算を使った髪揺れの設定方法を解説する」/ 2023-06-24
- リンク: https://otimusya24.com/physics-calculation/
- 画像: https://www.otimusya24.com/wp-content/uploads/2023/06/反応速度.gif , https://www.otimusya24.com/wp-content/uploads/2023/06/収束.gif
- 要点: 前髪は基本的に横方向だけ動かし斜めに倒さない。髪の揺れは頭の影響を体より大きく。長い髪ほど長い振り子。

### Cubism2: 同じ要素の物理は基本設定（質量・距離）で作り分ける
- 出典: Live2D Cubism 2 Manual「01. 物理演算の設定」（cybernoids）
- リンク: https://sites.google.com/cybernoids.jp/cubism2/editor/live2dviewer/phisics/setting
- 画像: ページ内にあり
- 要点: 複数の横髪など同種の揺れも基本設定の値を少しずつ変えて作り分けると良い（一斉に揺れない）。

### 髪ふわ（ParamHairFluffy）: 揺れ時に内側から外へ広がる標準パラメータ
- 出典: Live2D 公式「標準パラメータリスト」
- リンク: https://docs.live2d.com/en/cubism-editor-manual/standard-parameter-list/
- 画像: なし
- 要点: 標準で「髪ふわ」が定義されており、値を上げると髪が外へ広がる。揺れに合わせたふくらみ表現用。

### 長い髪は上下用と「広がり/すぼまり」用の2パラメータ
- 出典: 検索スニペット（Live2D系リギングガイド、出典ページ未特定）
- リンク: https://vtubermodelcommissions.com/live2d-vtuber-model-physics-settings-explained/
- 画像: なし
- 要点: 長い髪は1〜2デフォーマにそれぞれ「上下」と「扇状に開く/すぼむ」の2パラメータを持たせる。不安定なトラッキングは物理がジッターを増幅するので、まずトラッキングを直す。高めの減衰を推奨。
- （ページ取得失敗。スニペットからの要約）

### 振り子が原点付近で張り付く / 戻りで「キック」するバグ
- 出典: Live2D Creators Forum「[BUG] Sticky Physics」/ 2021-12〜2025-05
- リンク: https://community.live2d.com/discussion/1232/bug-sticky-physics
- 画像: なし
- 要点: 振り子が原点付近で止まる・カチカチする現象。位置X入力の範囲内で起きやすい。回避: 不要なら位置X範囲を0、角度範囲を±180に広げ出力影響度を下げる、原点をずらす。

### 後ろ横髪を足すと揺れが豪華に（描画順の目安）
- 出典: X kawase（@kawase1234567）投稿（検索スニペット経由）/ 2024-06
- リンク: https://x.com/kawase1234567/status/1800863566624661510
- 画像: なし
- 要点: 横髪は「輪郭の後ろ〜両肩の前」、後ろ横髪は「後ろ髪の前」に置くことが多い。後ろ横髪は無くても成立するがあると髪揺れが豪華に見える。

### 隠れる部分の描き足し・のりしろ・髪影も束ごとに分ける
- 出典: shiroikarasu.net「Live2Dパーツ分けでイラストレーターが気をつける注意点」/ vtuberkaibougaku「パーツ分けが必須！」/ castcraft（検索スニペット経由）
- リンク: https://shiroikarasu.net/live2d-part-separation-illustrator-guide/ , https://vtuberkaibougaku.site/2019/01/31/post-3424/
- 画像: ページ内にあり
- 要点: 髪の裏側や首元など動かすと見える所を描き足す。境目は隣接パーツの下へ潜り込ませる（のりしろ）。髪を束ごとに揺らすなら髪影も束ごとに分ける。分けが大まかだと角度X・髪揺れが不自然。
- （未精読。スニペットからの要約）

### 首を頭にグルーして首補正を減らす / 3D表現ツールで初期デフォーマ
- 出典: cillia（itch.io）「Live2D Head Angle Workflow Example」
- リンク: https://cillia.itch.io/live2d-head-angle-workflow-example
- 画像: https://img.itch.zone/aW1nLzE3MjQ4NjQ3LnBuZw==/original/gpbEtS.png
- 要点: 首を頭に接着して首の角度補正を最小化。ワープ階層を水平の一貫性が保たれるよう組み、角の補正作業を減らす。Cubism 5.1の3D表現ツールで傾き・軽い遠近を付ける。
- seed 外

### 物理に唯一の正解はない、プリセットは髪の長さ・パラメータの作りで要調整
- 出典: cillia（itch.io）「Live2D Hair Physics Example Project」
- リンク: https://cillia.itch.io/live2d-hair-physics
- 画像: https://img.itch.zone/aW1nLzgyNDAzMzAucG5n/original/Za54Rv.png
- 要点: 複数手法の髪物理を収録した学習用プロジェクト。スカート・ドレス・アクセサリーにも同じ考え方を応用できる。

### 後ろ髪パーツ追加で硬さを和らげる / 無料版の物理上限30
- 出典: HillE（itch.io devlog）「wispy 2.0」/ 2024-02-08
- リンク: https://hillendymion.itch.io/wispy-model/devlog/678690/wispy-20
- 画像: なし
- 要点: 後ろ髪パーツを足してモデルの硬さを軽減、前髪側デフォーマを拡大してトラッキング改善。物理設定数の上限（30）がボトルネックに。

### ワープだけで滑らかな髪物理（パラメータ1つ追加）
- 出典: X Ran（@pixelvertice）「Live2D Protips #4」（検索スニペット経由）/ 2020-11
- リンク: https://x.com/pixelvertice/status/1325006975898300416
- 画像: なし
- 要点: ワープデフォーマかメッシュ変形だけで、スキニングより少ないパラメータ・デフォーマで滑らかな髪物理を作れる、パラメータを1つ足すだけで改善するという趣旨。

### VTube Studio 側の物理倍率・風
- 出典: DenchiSoft VTubeStudio Wiki「VTS Model Settings」
- リンク: https://github.com/DenchiSoft/VTubeStudio/wiki/VTS-Model-Settings
- 画像: なし
- 要点: 物理強度ベース0〜100（50=Cubism Editor相当）、物理グループごとに倍率0〜2で強度と風を調整可能。風はランダムな力で実験的、モデル次第で見栄えが悪い。物理ファイルはモデルと一緒に書き出さないと登録されない。
- seed 外（ランタイム側）

### Physics+ for Live2D: 振り子手組みの代わりにリアルタイム物理
- 出典: absement（itch.io）「Physics+ for Live2D」
- リンク: https://absement.itch.io/live2d-physics
- 画像: ページ内にあり
- 要点: 髪や布をリアルタイム物理シミュレーションに乗せる外部ツール。風や重力変化など Live2D 単体で難しい動きを扱える。
- seed 外（代替ツール）

### 物理の前に構造を固める / 毛先の曲線は手動メッシュ、細長三角形を避ける
- 出典: VIVERSE Team「VTuber Rigging & Live2D Workflow」/ 2026-05-14（Kira Omori 動画ベース）
- リンク: https://news.viverse.com/post/vtuber-rigging-tips-and-tricks-for-beginners-workflow
- 画像: https://news.viverse.com/wp-content/uploads/2026/05/image-27-1024x576.png
- 要点: コアの動きが固まる前に物理を組まない。髪の毛先など複雑な曲線は手動でメッシュを詰め、動きの大きい所で細長い三角形を作らない（つぶれる）。上を向いた時に髪が頭から飛ばないよう角度X/Y/Zの入力ウェイトを調整。

## X への手がかり
- Ran（@pixelvertice）「Live2D Protips」シリーズ。#4 が髪物理（https://x.com/pixelvertice/status/1325006975898300416）。検索結果に直接出てきた。
- kawase（@kawase1234567）横髪・後ろ横髪の描画順の投稿（https://x.com/kawase1234567/status/1800863566624661510）。パーツ分け検索で出てきた。
- Live2D JUKU 公式（@Live2DJUKU）揺れの動きの自動生成の紹介投稿（https://x.com/Live2DJUKU/status/2035627549280420309）。
- HillE（@EricHill1232）wispy モデル devlog の作者。
- 乾物ひもの、うなぬん、ゾンビうつけくん、愛（hoshinotomoshibi）、伊糖だねこ はいずれも note で髪・物理の解説を連載しており、X アカウントもある可能性が高い（未確認）。
- Live2D アドベントカレンダー（2021 等）は X/Qiita 経由で多くのモデラーが寄稿しており、まとめページを当たると芋づる式に見つかりそう。

## 検索記録
- 「Live2D 髪揺れ 物理演算 コツ」「Live2D hair physics tips natural」「Live2D 前髪 パーツ分け 作り方 揺れ」: 書籍紹介・itch.io の有料サンプル・ココナラ等の依頼ページが多く、具体知は薄い。
- 「note.com Live2D 髪揺れ 物理演算 設定値」（extended）: ここで個人ブログ・note が一気に出た（CGbox、ゾンビうつけくん、兼子、saraemi、shiroikarasu、vtsuku 等）。日本語は extended モードの方が当たりが良い。
- 「Live2D 後ろ髪 角度X 逆方向 奥行き 立体感 髪」: note の制作記録系（乾物ひもの、愛、925、伊糖だねこ）が出て、角度XY周りの経験知が濃い。
- 「Live2D パーツ分け 髪 裏側 描き足し 振り向き」: イラストレーター向けパーツ分け記事（shiroikarasu、vtuberkaibougaku、お絵かき図鑑、castcraft）。スニペットのみで拾った分は「未精読」と明記。
- 「r/Live2D hair physics looks stiff」「reddit live2d hair physics rigging advice」: Reddit 本体はほぼ取れず（ミラー経由の help thread ルールのみ）。英語圏は itch.io 有料プロジェクト（cillia、Kuroama）と YouTube が中心で、本文が読めるテキスト解説は少ない。
- 「Live2D ツインテール ポニーテール 揺れ」「Live2D アホ毛 揺れ」: 既出サイトの再ヒットが多い。アホ毛特有の技法は見つからず。
- 「VTube Studio physics settings hair」: 公式 Wiki が中心（ランタイム側なので seed 外扱い）。
- 「Live2D community hair physics jitter」: Creators Forum のバグスレを拾った。
- 「alive Live2D 講演 髪」: alive 講演レポートは見つからず、代わりに Live2D JUKU 添削配信の回リストが当たった。
- 「Inochi2D hair physics」: 関連情報なし。
- 「Live2D 前髪 眉 透ける」: 具体解説見つからず。
- 取得失敗: cgworld 本文（ナビのみ）、appirits PDF（バイナリ）、vtubermodelcommissions（取得エラー）、toolify（403）、geboku-kyoudai（接続拒否）。cgworld はスニペットの内容で記録。
- 未取得だが候補: saraemi.com の物理演算/スキニング記事、vtsuku.com、nnwarks.com、cg-method.com、note 925（角度XYの立体の考え方）、note himono「角度XYのすすめ①」、Kuroama itch.io devlog、YouTube（Live2D JUKU 添削 #101 等）。
