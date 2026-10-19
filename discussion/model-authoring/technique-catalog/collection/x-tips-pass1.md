# 集めるメモ（X）: 第1巡（ハッシュタグ・汎用語）

> フェーズ1（集める）の生メモ。原文用語のまま、加工前。調査日: 2026-10-19〜20。L0 がアプリ内ブラウザ（ユーザーのログイン）で閲覧のみ。

## この巡の性質（観測）

- X の Live2D テクニック投稿は**ほとんどが短い動画**。本文は一行の題名程度のことが多く、中身は動画にある。L0 は動画を見られないため、「要点」は本文（キャプション）からわかる範囲に留まる。
- 「画像」欄は動画サムネイル（`*_video_thumb`）または添付画像（`pbs.twimg.com/media`）の直接 URL。`pbs.twimg.com/media/...` はログインなしで取得できることを確認した（WebFetch で JPEG 取得、2026-10-20）。サムネイル URL も同じホストだが個別には未確認。
- 投稿リンクは `https://x.com/<handle>/status/<id>`。

## メモ

### 靴は前側を広く描いてマスク
- 出典: kawase（@kawase1234567）/ 2026-10-17
- リンク: https://x.com/kawase1234567/status/2111275275258605894
- 画像: https://pbs.twimg.com/amplify_video_thumb/2111085194430304256/img/Z-14DI3zpq5kfddD.jpg（動画）
- 要点: 靴の前側を広めに描いておき、マスクで切ると変形が楽になる。

### 反射光は「周囲の色」を乗算で乗せる
- 出典: kawase（@kawase1234567）/ 2026-10-16
- リンク: https://x.com/kawase1234567/status/2111275275258605894 の引用元（kawase 2026-10-16 の投稿。URL 未取得）
- 画像: ページ内にあり（動画）
- 要点: 反射光を黄や白で入れるより、周囲のキーカラーを乗算で載せる方が透明感が出る場合がある。体 X の動きに合わせて色を入れている。

### ふとももを「たゆたゆ」させる
- 出典: kawase（@kawase1234567）/ 2026-10-17
- リンク: https://x.com/kawase1234567/status/2111365286435983669
- 画像: https://pbs.twimg.com/amplify_video_thumb/2111365227447287809/img/ckObu8OlcJjYWZvi.jpg（動画）
- 要点: 太ももに柔らかい揺れを入れるのが大事、という主張（中身は動画）。

### 差分の切り替えで「多腕」に見えないよう重みを調整
- 出典: kawase（@kawase1234567）/ 2026-10-19
- リンク: https://x.com/kawase1234567/status/2112176093390397689
- 画像: https://pbs.twimg.com/media/HU_zMScbkAAPkNT
- 要点: 腕差分をゆっくり切り替えると一瞬腕が多く見えるのはエラー。ブレンドシェイプの重み付けで差分1と差分2が同時に出ないようにする。

### 肘をきれいに繋げるコツ
- 出典: Live2D JUKU 公式（@Live2DJUKU）/ 2026-08-22
- リンク: https://x.com/Live2DJUKU/status/2091088026982297813
- 画像: https://pbs.twimg.com/ext_tw_video_thumb/2091084274271428608/pu/img/HwduHkHxVRAm_q3b.jpg（動画）
- 要点: 肘の接続部をきれいに見せる方法（中身は動画）。

### 耳横の輪郭線の消し方
- 出典: Live2D JUKU 公式（@Live2DJUKU）/ 2026-09-19
- リンク: https://x.com/Live2DJUKU/status/2101234863961690414
- 画像: https://pbs.twimg.com/ext_tw_video_thumb/2101231152019460096/pu/img/BMMtmGWqkEgmOuSX.jpg（動画）
- 要点: 顔を回したときの耳横の輪郭線の処理（中身は動画）。

### 「動いている感」が増す体の XY
- 出典: Live2D JUKU 公式（@Live2DJUKU）/ 2026-10-03
- リンク: https://x.com/Live2DJUKU/status/2106308358781452407
- 画像: https://pbs.twimg.com/ext_tw_video_thumb/2106304561904529408/pu/img/9uWnbCsLfIlXT-J6.jpg（動画）
- 要点: 体 XY の作り方のコツ（中身は動画）。

### ほっぺぷく（口を動かしても崩れない）
- 出典: Live2D JUKU 公式（@Live2DJUKU）/ 2026-10-10
- リンク: https://x.com/Live2DJUKU/status/2108845011337171114
- 画像: https://pbs.twimg.com/ext_tw_video_thumb/2108841288779059200/pu/img/M4yejdoOk4aepORu.jpg（動画）
- 要点: 頬を膨らませる表現の作り方（中身は動画）。

### もぐもぐできる口
- 出典: Live2D JUKU 公式（@Live2DJUKU）/ 2026-09-11
- リンク: https://x.com/Live2DJUKU/status/2098335750433722866
- 画像: https://pbs.twimg.com/ext_tw_video_thumb/2098332088600776704/pu/img/xPnahOFkyMchK9dh.jpg（動画）
- 要点: 咀嚼する口の作り方（中身は動画）。

### 男性モデルのあご・えらの動かし方
- 出典: Live2D JUKU 公式（@Live2DJUKU）/ 2026-09-06
- リンク: https://x.com/Live2DJUKU/status/2096523821302133164
- 画像: https://pbs.twimg.com/ext_tw_video_thumb/2096520046218747905/pu/img/wg8LYZSmRd-dEPxO.jpg（動画）
- 要点: 男性の骨ばった顎・えらを角度変化でどう動かすか（中身は動画）。

### 物理演算を4つの流れで解説
- 出典: Live2D JUKU 公式（@Live2DJUKU）/ 2026-09-05
- リンク: https://x.com/Live2DJUKU/status/2096176525674733683
- 画像: https://pbs.twimg.com/ext_tw_video_thumb/2096172757583360000/pu/img/uKBrtVB78fpQZTTW.jpg（動画）
- 要点: 物理演算の組み立てを4段階で説明（中身は動画）。

### 顔の角度 Y での口の移動量
- 出典: Live2D JUKU 公式（@Live2DJUKU）/ 2026-08-29
- リンク: https://x.com/Live2DJUKU/status/2093624774488674796
- 画像: https://pbs.twimg.com/ext_tw_video_thumb/2093620970342973440/pu/img/AG1CP9rVDSUiiMg0.jpg（動画）
- 要点: 上下を向いたとき口をどれだけ動かすかの目安（中身は動画）。

### 添削アーカイブ（ビフォーアフター付き）
- 出典: Live2D JUKU 公式（@Live2DJUKU）/ 2026-01-02
- リンク: https://x.com/Live2DJUKU/status/2006923435939869075
- 画像: https://pbs.twimg.com/ext_tw_video_thumb/2006919652551831552/pu/img/HfsqHkRr6bie3Nn0.jpg（動画）
- 要点: 講師がモデルを添削した無料アーカイブがある、という告知。手がかりとして有望。

### 「顔がペラい」問題への答え
- 出典: @studiomomokoart / 2025-05-22
- リンク: https://x.com/studiomomokoart/status/1925464189029818850
- 画像: なし（取得できず。動画）
- 要点: 顔に立体感が出ない問題への自分なりの解法（中身は動画）。

### ワープで口形状を時短で作る（片側を作って反対側へ特殊貼り付け）
- 出典: @Vil_Rib / 2026-07-09
- リンク: https://x.com/Vil_Rib/status/2075173834261692702
- 画像: https://pbs.twimg.com/amplify_video_thumb/2075173713889435648/img/rqgeqhhJNuqceC3I.jpg（動画）
- 要点: 口線をワープに入れて片側だけ変形し、フォームの特殊な貼り付けで反対側へ反転コピー。不要になったらデフォーマを子に適用してメッシュへ移す。

### 輪郭線の処理: 輪郭塗りを複製・拡大して色を変える
- 出典: @Vil_Rib / 2025-06-23
- リンク: https://x.com/Vil_Rib/status/1937106757488365850
- 画像: https://pbs.twimg.com/amplify_video_thumb/1936611534513610752/img/S7QsdvuOU1nuld_H.jpg（動画）
- 要点: 輪郭塗りを複製して拡大し線色にすると、パーツ数・マスク数が減る。線は薄くなるより細くなる方が好み。

### 境界線の細かい処理（濃い色パーツを後ろへ）
- 出典: @Vil_Rib / 2025-10-24
- リンク: https://x.com/Vil_Rib/status/1981680624432976102
- 画像: https://pbs.twimg.com/amplify_video_thumb/1981679595058266112/img/ee-Mn5YMqQHhFLJQ.jpg（動画）
- 要点: 濃い色のパーツを薄い色の後ろに回して線が細っていくように見せる。後ろの影色を下にずらして顎の下を表す。

### デフォーマを 360° 回転させる最速の方法
- 出典: @Harawaka025 / 2026-06-14
- リンク: https://x.com/Harawaka025/status/2066121307272642849
- 画像: https://pbs.twimg.com/amplify_video_thumb/2066121241396916224/img/E2ypj-xykihVFKt7.jpg（動画）
- 要点: デフォーマをきれいに一回転させる方法（中身は動画）。

### 長髪の物理を Pendulum 番号の調整で改善
- 出典: @KoumoriVa / 2025-07-21
- リンク: https://x.com/KoumoriVa/status/1947418566837616789
- 画像: https://pbs.twimg.com/amplify_video_thumb/1947417642106818560/img/x3OGt_8lihfJZlaU.jpg（動画）
- 要点: 物理の出力に使う振り子の番号（Pendulum No）を変えるだけで長髪の揺れが良くなる。

### 頭の角度: 3D 回転のあとにブレンドシェイプで立体感を足す
- 出典: @yuseong_live2d / 2026-08-18
- リンク: https://x.com/yuseong_live2d/status/2089676175719420292
- 画像: https://pbs.twimg.com/amplify_video_thumb/2089655360122667008/img/fNJPYebx2b8pjDa6.jpg（動画）
- 要点: 頭の角度は 3D 回転（エディタ機能）を当てた後、ブレンドシェイプで丸みを追加すると生き生きする。

### ヒップスウェイの作り方
- 出典: @yuseong_live2d / 2026-09-08
- リンク: https://x.com/yuseong_live2d/status/2097282536967918062
- 画像: https://pbs.twimg.com/amplify_video_thumb/2097260750687592448/img/xV38XGLkODwyJQss.jpg（動画）
- 要点: 腰の揺れの組み方。物理は試しながら値を詰めるのがおすすめ。

### 歩行アニメーション（パラメータごとのリグ）
- 出典: @yuseong_live2d / 2026-04-14
- リンク: https://x.com/yuseong_live2d/status/2044032848500523476
- 画像: https://pbs.twimg.com/amplify_video_thumb/2044032791982288901/img/VfQI-Bj1p4j3UPLt.jpg（動画）
- 要点: 歩行をパラメータごとにリグしてアニメにした。足の沈み込みや肉の揺れを足すとよさそう、とのこと。

### 笑顔になると眉が下がる現象の解決
- 出典: @angel3yumeuchan / 2026-05-13
- リンク: https://x.com/angel3yumeuchan/status/2054482568423309554
- 画像: https://pbs.twimg.com/amplify_video_thumb/2054480790244007936/img/bymFmNBUjSV3lzt7.jpg（動画）
- 要点: 目の笑顔と眉の干渉で眉が下がってしまう問題の直し方（中身は動画）。

### 瞳の揺れ 3 タイプ
- 出典: @angel3yumeuchan / 2026-07-25
- リンク: https://x.com/angel3yumeuchan/status/2080933878957846810
- 画像: https://pbs.twimg.com/amplify_video_thumb/2080933797500215297/img/JbzMYyYuB8tBRg3t.jpg（動画）
- 要点: 瞳を揺らす表現を3種類並べた比較（中身は動画）。

### ふわふわスカートの揺らし方
- 出典: @angel3yumeuchan / 2026-07-02
- リンク: https://x.com/angel3yumeuchan/status/2072598802834571511
- 画像: https://pbs.twimg.com/amplify_video_thumb/2072598252000866305/img/2Qi0nr4hGGlnVVng.jpg（動画）
- 要点: 柔らかいスカートの揺れの組み方（中身は動画）。

### パーツ分けあるある: 白目の形（目玉はまぶたの外に出ない）
- 出典: @wa_Ta_ta__ / 2026-09-17
- リンク: https://x.com/wa_Ta_ta__/status/2100528813461680589
- 画像: https://pbs.twimg.com/amplify_video_thumb/2100219856851468288/img/ITpMMsMhY1EBZdLy.jpg（動画）
- 要点: 白目は目尻でまぶたの外にはみ出さない形にする。目頭の描き方で瞳の見え方が変わる。整合性が大事。

### パーツ分けあるある: 目の透け対策パーツ
- 出典: @wa_Ta_ta__ / 2026-08-27
- リンク: https://x.com/wa_Ta_ta__/status/2092945242236342290
- 画像: https://pbs.twimg.com/amplify_video_thumb/2092944386611134464/img/21-gqrOhBDHPkqGJ.jpg（動画）
- 要点: 目を閉じたときの透けを防ぐパーツは、肌色を統合するだけでは色が変わる。まつ毛より下の見た目を保ったまま、まつ毛の形で統合する。

### パーツ分けあるある（シリーズの趣旨）
- 出典: @wa_Ta_ta__ / 2026-08-18
- リンク: https://x.com/wa_Ta_ta__/status/2089564503272988771
- 画像: なし
- 要点: イラスト段階のパーツ分けの質がモデリングの質を決める、という前提で注意点を連載している。

### ズボンのパースを左右の足で変える（腰振りダンス）
- 出典: @himono_vtuber / 2026-06-02
- リンク: https://x.com/himono_vtuber/status/2061811732293857652
- 画像: https://pbs.twimg.com/amplify_video_thumb/2061811600764624896/img/o2gf9UoWzR65hhdW.jpg（動画）
- 要点: 腰を振る動きでは、左右の足でズボンのパースを変えると少ない工数で立体感が出る。

### ストロークによるメッシュ割りの幅を個別に変える
- 出典: @himono_vtuber / 2025-11-11
- リンク: https://x.com/himono_vtuber/status/1988200229318074460
- 画像: https://pbs.twimg.com/amplify_video_thumb/1988200175933026306/img/PeZtYlumzTBCxoeI.jpg（動画）
- 要点: エディタの操作の小技（メッシュ幅を Ctrl+ドラッグで個別に調整）。

### 対称デフォーマ用のコピー＆ペースト（Ctrl+Shift+C/V）
- 出典: @TuaMiao / 2026-08-17
- リンク: https://x.com/TuaMiao/status/2089185523390963842
- 画像: https://pbs.twimg.com/amplify_video_thumb/2089184283315593216/img/XpenmHOft099y6GO.jpg（動画）
- 要点: 左右対称のデフォーマ形状を反転コピーする機能。作業効率の小技。

### 口の開閉に伴う顎: 角度 X では顎を少し引く
- 出典: @aimin_chiyoko / 2025-07-01
- リンク: https://x.com/aimin_chiyoko/status/1939970954169356772
- 画像: https://pbs.twimg.com/amplify_video_thumb/1939969432823934976/img/die1145dHq1EW7mZ.jpg（動画）
- 要点: 口を開けて顎を下げるとき、横を向いた状態で真下に下げると顎が長く見える。角度 X では少し引くように動かす。

### バイバイ: 前腕だけでなく二の腕も動かす
- 出典: @aimin_chiyoko / 2026-03-14
- リンク: https://x.com/aimin_chiyoko/status/2032737595164340403
- 画像: なし（取得できず。動画）
- 要点: 手を振る動きは二の腕も一緒に動かすとリッチになる。前腕はアニメで打ち、袖・二の腕・手首の揺れは物理。指先も少し動かすと柔らかい。

### 涙ぽろぽろの簡単な作り方
- 出典: @BURAI_VC2008 / 2022-09-07
- リンク: https://x.com/BURAI_VC2008/status/1567457599876120578
- 画像: https://pbs.twimg.com/ext_tw_video_thumb/1567457548009357312/pu/img/zT-D2FnW4N3XAN2i.jpg（動画）
- 要点: 涙が流れる表現の作り方（中身は動画）。

### 鎖状の物理は関節ごとに分けて回転デフォーマで
- 出典: @Luoli1101 / 2025-12-12
- リンク: https://x.com/Luoli1101/status/1999623469735248151
- 画像: https://pbs.twimg.com/amplify_video_thumb/1999623005706813442/img/BJ2825e1Ovatpv8b.jpg（動画）
- 要点: 鎖のような揺れものは、絵師に関節ごとに分けてもらい、回転デフォーマで組むと歪まない。

### 口の複数差分へ元の口を変形させて繋ぐ
- 出典: @Luoli1101 / 2026-05-12
- リンク: https://x.com/Luoli1101/status/2054067868887871785
- 画像: https://pbs.twimg.com/amplify_video_thumb/2054067669255745538/img/IvmjXetpDAqkI9Ui.jpg（動画）
- 要点: 絵師が口を複数パターン描いた場合、元の口を追加の形へ向けて変形させると表情の切り替えが滑らかになる。

### 体・服の奥行きはマスクで（追加のパーツ分けで X の可動域が広がる）
- 出典: @Luoli1101 / 2026-04-03
- リンク: https://x.com/Luoli1101/status/2040144690373431310
- 画像: https://pbs.twimg.com/amplify_video_thumb/2040144573444562944/img/E0aODKyJen7E_jfW.jpg（動画）
- 要点: マスクは体や服の奥行きに欠かせない。絵師が余分にパーツを分けておくと体 X の回転幅を広げられ、物理と合わせて自然になる。

### 一枚絵の複雑な装飾をグルー＋デフォーマで擬似立体に
- 出典: @Luoli1101 / 2026-03-22
- リンク: https://x.com/Luoli1101/status/2035647560409657739
- 画像: https://pbs.twimg.com/amplify_video_thumb/2035647452569845760/img/LYBBUK5G7fzvIpQ0.jpg（動画）
- 要点: 一枚レイヤーの複雑なアクセサリーは、グルーとデフォーマでハイライトと影を分けて擬似的な奥行きを出す。点を一つずつ動かすより速い。

### 尻尾のスキニング: まっすぐに伸ばしてからスキニングして曲げ直す
- 出典: @Luoli1101 / 2025-10-22
- リンク: https://x.com/Luoli1101/status/1981036028283801946
- 画像: https://pbs.twimg.com/amplify_video_thumb/1981035332792406016/img/9g4AG5W1X27BZnbs.jpg（動画）
- 要点: 曲がった尻尾は、一度まっすぐにしてからスキニングし、元の形に戻すと壊れない。

### ツインテールの立体感: パールを1つずつ分けて反転マスク
- 出典: @ryuou_nta / 2026-09-26
- リンク: https://x.com/ryuou_nta/status/2103866343686860881
- 画像: https://pbs.twimg.com/amplify_video_thumb/2103864613272231936/img/9AFztT5JG7nMu555.jpg（動画）
- 要点: ツインテールの飾りの玉を一つずつ分け、反転マスクで前後関係を作って立体感を出す。

### 上着を脱いだときの腕の揺れをブレンドシェイプの重みの制限で調整
- 出典: @ryuou_nta / 2026-10-16
- リンク: https://x.com/ryuou_nta/status/2111008228264022189
- 画像: https://pbs.twimg.com/amplify_video_thumb/2111007546471505920/img/Gv7y4Lc0BY6yeO35.jpg（動画）
- 要点: 衣装差分で腕の揺れ方を変えたいとき、ブレンドシェイプの重みの制限で揺れを調整する。

### グルーの重みをパラメータで制御（もちを食べるモーション）
- 出典: @ryuou_nta / 2026-01-02
- リンク: https://x.com/ryuou_nta/status/2006941249706889253
- 画像: https://pbs.twimg.com/amplify_video_thumb/2006941183520669696/img/gm1zZDr_N3pfqtSX.jpg（動画）
- 要点: グルーの効き具合をパラメータで変えて、伸びるもちを表現する。

### 肩揺れのデフォーマを差分の動きと兼用
- 出典: @totorichu / 2026-03-06
- リンク: https://x.com/totorichu/status/2029915072626389452
- 画像: https://pbs.twimg.com/amplify_video_thumb/2029914200492101638/img/eDGrXnchGXWT54Fp.jpg（動画）
- 要点: 肩の揺れ用デフォーマを差分の動きにも使い、ブレンドシェイプの重みで差分のときだけ揺れを抑える。

### パラメータを組み合わせると破綻するときの解決策
- 出典: @yamada_yuco / 2026-09-21
- リンク: https://x.com/yamada_yuco/status/2102026114785051055
- 画像: https://pbs.twimg.com/amplify_video_thumb/2102025594842275840/img/Ku-s5BYxIOENVZWX.jpg（動画）
- 要点: 複数パラメータを同時に動かしたときの形の崩れを直す方法（初心者向け、中身は動画）。

### 頭の Y: マイナスで大きく、プラスで小さく
- 出典: @adpn2395 / 2026-09-16
- リンク: https://x.com/adpn2395/status/2100142693196374443
- 画像: https://pbs.twimg.com/amplify_video_thumb/2100142676175986688/img/ZSisD94sc4RWpDB0.jpg（動画）
- 要点: 頭の Y 軸で、マイナス側はサイズを大きく、プラス側は小さくすると立体的に見える。

### あご下パーツと鼻の輪郭パーツ、後頭部と首を1パーツに
- 出典: @piyokinoko / 2026-09-15
- リンク: https://x.com/piyokinoko/status/2099696552860418535
- 画像: https://pbs.twimg.com/amplify_video_thumb/2099052304158863360/img/za2r6Jvs42uXrV_h.jpg（動画）
- 要点: あご下と鼻の輪郭を別パーツにすると角度で効く。後頭部と首を一つのパーツにすると、後頭部〜耳〜首のラインが出る。

### もちもちの作り方（ミニキャラ・マスコット向け）
- 出典: @yumaru_y0 / 2026-09-13
- リンク: https://x.com/yumaru_y0/status/2099065830483104137
- 画像: https://pbs.twimg.com/amplify_video_thumb/2099065718658727936/img/UDjdYch12cpI2fSS.jpg（動画）
- 要点: 柔らかく弾む「もちもち」表現の作り方（中身は動画）。

### ブレンドシェイプの使いどころ（角度補正、物理との併用）
- 出典: @_shin_sinsin / 2026-08-29
- リンク: https://x.com/_shin_sinsin/status/2093581371772137626
- 画像: https://pbs.twimg.com/amplify_video_thumb/2093580844636229632/img/QUW0xQQdFY018rhQ.jpg（動画）
- 要点: ブレンドシェイプとは何か、角度補正に使うべきか、物理との併用など。FANBOX 記事（https://sosogibana-shin.fanbox.cc/posts/12461637）あり。

### 親のワープデフォーマが揺れと目閉じに与える影響
- 出典: @_shin_sinsin / 2025-12-14
- リンク: https://x.com/_shin_sinsin/status/2000107415816331518
- 画像: なし
- 要点: 角度 XY のデフォーマが、子の揺れや目閉じにどう影響するかの解説記事の告知（FANBOX）。

### ワープデフォーマの基本仕様の解説
- 出典: @_shin_sinsin / 2025-11-26
- リンク: https://x.com/_shin_sinsin/status/1993582665401049244
- 画像: https://pbs.twimg.com/media/G6qg3jobAAAy_lA
- 要点: ワープの仕様をデータ付きで解説する連載（https://sosogibana-shin.fanbox.cc/posts/10856505）。

### Z 軸の斜めの動き方の違いで印象が変わる
- 出典: @tsukutori_irona / 2026-08-26
- リンク: https://x.com/tsukutori_irona/status/2092622820182557002
- 画像: https://pbs.twimg.com/amplify_video_thumb/2092622598765207552/img/lv-s-ae8tIUmP_qj.jpg（動画）
- 要点: 同じ Z 軸の傾きでも動かし方で印象が大きく変わる。YouTube Shorts で解説あり。

### 体の上下に髪や服の揺れを紐付ける（歩行）
- 出典: @takanome_illust / 2026-08-26
- リンク: https://x.com/takanome_illust/status/2092581521484050929
- 画像: https://pbs.twimg.com/tweet_video_thumb/HQpXycibUAAHflI.jpg（動画）
- 要点: 歩くモーションで、体の上下動に髪や服の揺れを紐付けると良い感じになる。

### 顔・体の X に対して Z を物理の揺れで入れる
- 出典: @RedDevil0427 / 2026-10-19
- リンク: https://x.com/RedDevil0427/status/2112110756879560929
- 画像: https://pbs.twimg.com/amplify_video_thumb/2111990203271553024/img/LwnqKXW1JN2gD2El.jpg（動画、Before/After）
- 要点: 顔・体を左右に振ったとき、それぞれの Z（傾き）が物理演算で遅れて入るようにする。初心者がまず試すべき、とのこと。

### 頭 Z デフォーマに XY のキーも打って動きを制限（首ちょん切れ対策）
- 出典: @zombieFFF / 2025-11-01
- リンク: https://x.com/zombieFFF/status/1984559913843229084
- 画像: なし
- 要点: 頭の Z デフォーマに XY のキーも打って動きを制限すると、首が切れて見える問題が解決した。Z のときの首の形も調整する。

### サイドの髪を複製して頭の後ろへ、Angle X でずらし乗算で暗く
- 出典: @Ururuka_Noy / 2025-12-07
- リンク: https://x.com/Ururuka_Noy/status/1997670369696927913
- 画像: https://pbs.twimg.com/amplify_video_thumb/1997669874571866112/img/f-NyhBjsUU5uqNEI.jpg（動画）
- 要点: 横髪のパーツを複製して頭の後ろに置き、角度 X でずらして乗算で暗くすると、追加の絵なしで奥行きが出る。

### 尻尾が硬く見えるなら根元・中間・先端にパラメータを分ける
- 出典: @NaoDoragonENV / 2025-12-22
- リンク: https://x.com/NaoDoragonENV/status/2003153831081759061
- 画像: https://pbs.twimg.com/ext_tw_video_thumb/2003153819505418240/pu/img/KDCBugpSugz8T-lb.jpg（動画）
- 要点: 尻尾の各部（根元→中間→先端）に別々のパラメータを付けると、小さな差でよく動いて見える。

### まぶたが眼球を突き抜けるなら白目のマスクを
- 出典: @NaoDoragonENV / 2026-02-16
- リンク: https://x.com/NaoDoragonENV/status/2023463421824401685
- 画像: https://pbs.twimg.com/ext_tw_video_thumb/2023463410701074434/pu/img/_SLgWHrUXNNkvHzu.jpg（動画）
- 要点: 白目の周りにマスクを作ると、まぶたが眼球を突き抜ける問題を防ぎ、閉じも滑らかになる。

### 瞳とまつ毛が重なる部分の線画が無い絵柄での瞳のパーツ分け
- 出典: @Uta_rainfall / 2025-10-25
- リンク: https://x.com/Uta_rainfall/status/1982197364518527197
- 画像: https://pbs.twimg.com/amplify_video_thumb/1982179701826228225/img/EU2xhgWXBaQMh_7t.jpg（動画）
- 要点: 絵柄によって瞳のパーツの分け方が変わる。実際はハイライト・瞳孔→瞳の二重クリッピングなどもっと複雑。

### 円形アートメッシュで擬似的に立体に見せる
- 出典: ののん。（@nonon_yuno）/ 2023-07-12
- リンク: https://x.com/nonon_yuno/status/1678962389625061380
- 画像: https://pbs.twimg.com/media/F0zTXqhaMAANt28.jpg
- 要点: 円形メッシュを応用して球のような立体に見せる方法（正方形のパーツが必要）。練習用データ配布あり。

### 1パーツでも指を揺らす・動かす（一時変形の応用）
- 出典: ののん。（@nonon_yuno）/ 2022-12-17
- リンク: https://x.com/nonon_yuno/status/1603949867902304258
- 画像: https://pbs.twimg.com/ext_tw_video_thumb/1603949744065478656/pu/img/KBdVCcbFx35iF2Yw.jpg（動画）
- 要点: 指が分かれていない一枚の手でも、指を揺らしたり動かしたりする作り方。

### 口パーツ: 肌パーツの不透明度を 0 にして輪郭のグラデに対応
- 出典: ののん。（@nonon_yuno）/ 2023-03-25
- リンク: https://x.com/nonon_yuno/status/1639718802605654017
- 画像: なし（取得できず。動画）
- 要点: 口の肌パーツの不透明度を 0 にする扱いで、輪郭にグラデがあっても口の動きに対応できる。

### 口の形の早見表（悲しい・困り口）
- 出典: ののん。（@nonon_yuno）/ 2022-02-11
- リンク: https://x.com/nonon_yuno/status/1491966727550214150
- 画像: https://pbs.twimg.com/media/FLSHG-OVUAAh1Pt
- 要点: 表情ごとに口の形を切り替える早見表。悲しい・困りの表情用。

### 腕パーツのメッシュの打ち方
- 出典: ののん。（@nonon_yuno）/ 2024-06-13
- リンク: https://x.com/nonon_yuno/status/1801077139191845101
- 画像: https://pbs.twimg.com/media/GP61GWAaYAAf3Bh
- 要点: 腕パーツのメッシュの打ち方の参考。左右対称なら片方を打って反転複製。

### パーツ複製グルー
- 出典: ののん。（@nonon_yuno）/ 2026-05-17
- リンク: https://x.com/nonon_yuno/status/2055861126186098830
- 画像: https://pbs.twimg.com/amplify_video_thumb/2055860750074380288/img/pguKAEDy0sS-6hhk.jpg（動画）
- 要点: パーツを複製してグルーで繋ぐ技法を覚えると、いろいろなグルーに応用できる。

### 講座まとめ（輪郭影、口の形の早見表、閉じ口のイメージ ほか）
- 出典: ののん。（@nonon_yuno）/ 2022-12-09
- リンク: https://x.com/nonon_yuno/status/1601222476390092800
- 画像: https://pbs.twimg.com/media/FjivT_QakAARaFv
- 要点: 講座シリーズの索引投稿。輪郭影を簡単に作る方法など、個別投稿へのリンクがある。

### 物理の入力に差分スイッチを繋ぐと振り子が中心からずれる問題
- 出典: SODA ART（@SODAART_class）/ 2026-07-09
- リンク: https://x.com/SODAART_class/status/2075124513625592293
- 画像: https://pbs.twimg.com/amplify_video_thumb/2075124408482779136/img/aVJGwvO-ypXt1VM-.jpg（動画）
- 要点: 差分の切り替えスイッチを物理の入力に入れると、切り替えと同時に揺れて生き生きする。ただし振り子の静止位置が中心からずれやすく、その対処法。

### 前の長い布の三段物理をもっと柔らかく
- 出典: SODA ART（@SODAART_class）/ 2025-12-09
- リンク: https://x.com/SODAART_class/status/1998373177492435049
- 画像: なし（取得できず。動画）
- 要点: 長い布を三段の物理で揺らすときに柔らかさを出す方法。多層の曲面（ワープ）で包む処理が一般的。

### 物理で三路スイッチを作る
- 出典: SODA ART（@SODAART_class）/ 2026-06-02
- リンク: https://x.com/SODAART_class/status/2061734339856261293
- 画像: https://pbs.twimg.com/amplify_video_thumb/2061733363921338368/img/K2XHyM3ZSLKX0qI-.jpg（動画）
- 要点: 打ち消し合う物理パラメータ1組で、三段階の切り替えスイッチを作る。

### 一枚の後ろ髪をどう動かすか（前髪の隠れ具合で判断）
- 出典: SODA ART（@SODAART_class）/ 2025-11-19
- リンク: https://x.com/SODAART_class/status/1991015647921516973
- 画像: https://pbs.twimg.com/amplify_video_thumb/1991015514622357504/img/cK96TcnWpIFQqAZf.jpg（動画）
- 要点: 後ろ髪が一枚絵でも、前髪が十分隠していれば一枚に曲面を被せて処理する。毛先が分かれていれば別の扱い。

### 手のパーツ差分を作るときの問題
- 出典: SODA ART（@SODAART_class）/ 2026-09-22
- リンク: https://x.com/SODAART_class/status/2102392608844845203
- 画像: https://pbs.twimg.com/amplify_video_thumb/2102392539936636928/img/aduVDamwGwT3xZQN.jpg（動画）
- 要点: 手の差分パーツを作るときによくぶつかる問題とその解決（中身は動画）。

### 左右鏡像のパーツはデフォーマを反対側へコピー
- 出典: @twtnw_v / 2023-10-04
- リンク: https://x.com/twtnw_v/status/1709534467227095164
- 画像: https://pbs.twimg.com/ext_tw_video_thumb/1709530303247855616/pu/img/jr1F85aWfzJW_0tl.jpg（動画）
- 要点: 形が左右対称のパーツは、片側のデフォーマとキーを反対側へ反転コピーできる。

### 旧モデルと新モデルの比較（修正点の列挙）
- 出典: @tsu_____te / 2026-10-17
- リンク: https://x.com/tsu_____te/status/2111606007021629826
- 画像: https://pbs.twimg.com/amplify_video_thumb/2111601021806100480/img/o2w7o-R0I8ouBTd3.jpg（動画）
- 要点: 瞳位置の修正で自然な可動域に、口を9点→6点で制作、髪の物理をデフォーマで作成、動き→揺れの順で作って揺れデフォーマのはみ出しを0に補正。

### Live2D Tips まとめ（顎の線を消す、変形パスの揺らし方、袖の根元、手のひらリグ）
- 出典: @yukinashGG_sub / 2026-03-02
- リンク: https://x.com/yukinashGG_sub/status/2028427931782111735
- 画像: https://pbs.twimg.com/amplify_video_thumb/2028427496967061504/img/MxyTVE0BQBwc7pW9.jpg（動画）
- 要点: 4つの小技のまとめ投稿。個別投稿が手がかりになる。

### 簡単に可動域を増やす（角度 X とは別のブレンドシェイプにも X の動きを）
- 出典: @amatuka_Live2D / 2025-12-12〜13
- リンク: https://x.com/amatuka_Live2D/status/1999657963053810109 、 https://x.com/amatuka_Live2D/status/1999428518921617444
- 画像: https://pbs.twimg.com/amplify_video_thumb/1999657715967373312/img/CS2IpTVh1GOo1pzy.jpg（動画）
- 要点: 角度 X とは別にブレンドシェイプのパラメータを作り、形状のコピペで X の動きを付けると可動域を簡単に増やせる。

### 体の物理の分解（Body Physics Breakdown）／狐耳の分解
- 出典: @___IixXxiI___ / 2025-12-09、2025-12-04
- リンク: https://x.com/___IixXxiI___/status/1998400797227507754 、 https://x.com/___IixXxiI___/status/1996596663553863989
- 画像: https://pbs.twimg.com/amplify_video_thumb/1998400266987798528/img/uOQytzeX5dLpNe-Z.jpg（動画）
- 要点: 体の揺れと狐耳の組み方を分解して見せる動画。

### パーツを追加しないヤンデレ目のトグル
- 出典: @___IixXxiI___ / 2025-12-17
- リンク: https://x.com/___IixXxiI___/status/2001309737716195621
- 画像: https://pbs.twimg.com/amplify_video_thumb/2001306899350949888/img/k_Ph6zZaYY8oHNKk.jpg（動画）
- 要点: 新しいパーツなしで、瞳の表現を変える感情トグルを作る。

### 尻尾の分解（Tail asset breakdown）
- 出典: @Ara_Ara_Arazuki / 2025-11-23
- リンク: https://x.com/Ara_Ara_Arazuki/status/1992687875092263239
- 画像: https://pbs.twimg.com/amplify_video_thumb/1992687000344727553/img/wJpBgbkdYwQAXX5n.jpg（動画）
- 要点: 尻尾素材のパーツ構成の分解（中身は動画）。

### 変形パスを閉じて円にできる
- 出典: @ArthurDreamur / 2025-11-11
- リンク: https://x.com/ArthurDreamur/status/1988373420141408609
- 画像: https://pbs.twimg.com/amplify_video_thumb/1988358523328024576/img/7iM8SF5fF_j6LI9O.jpg（動画）
- 要点: 変形パスのツールで、パスを閉じて円にするオプションがある。

### 瞳のギミック（魚が泳ぐ、瞬きでラメがきらめく）／みつあみの振り子揺れ修正
- 出典: @UIMIU_110 / 2026-02-16、2026-02-13
- リンク: https://x.com/UIMIU_110/status/2023476989672456204 、 https://x.com/UIMIU_110/status/2022248430941475091
- 画像: https://pbs.twimg.com/amplify_video_thumb/2023475999791607813/img/JTIQtYRsTdSgTs5r.jpg（動画）
- 要点: 瞳の中の演出、みつあみを振り子らしく揺らす修正。水中らしさのために収束を遅めにしている。

### 目のうるうる・ちゅるん揺れ、表情筋、顔の四隅
- 出典: @sakura_omochi01 / 2026-03〜05
- リンク: https://x.com/sakura_omochi01/status/2055589079341772840 、 https://x.com/sakura_omochi01/status/2049428480631402995 、 https://x.com/sakura_omochi01/status/2057401011535511710 、 https://x.com/sakura_omochi01/status/2029527343862022533
- 画像: https://pbs.twimg.com/amplify_video_thumb/2049384073001603072/img/pkSebbsWk-1sHJuP.jpg（動画）
- 要点: 制作途中の動画。目の潤み・揺れ、表情筋、顔の四隅（斜めの角度）などの見本。解説は少ない。

### 卵の殻の立体感
- 出典: @ibuki_bud / 2026-10-16
- リンク: https://x.com/ibuki_bud/status/2111088437508100274
- 画像: https://pbs.twimg.com/amplify_video_thumb/2111087137412255744/img/HkJ4mctt-WNnIphN.jpg（動画）
- 要点: 小物（卵の殻）の立体的な回転の見本（中身は動画）。

### 帽子のツバの構造
- 出典: @Tamura_Akari / 2026-10-12
- リンク: https://x.com/Tamura_Akari/status/2109556209930080263
- 画像: なし（取得できず。動画）
- 要点: キャップのツバを作り込む構造（中身は動画）。

### 文字を書く表現（くるっとする所は分割して繋ぐ）
- 出典: @Tamura_Akari / 2025-07-20
- リンク: https://x.com/Tamura_Akari/status/1947057444267696370
- 画像: https://pbs.twimg.com/amplify_video_thumb/1947055877669699584/img/_SLMHej2Xr2xU1et.jpg（動画）
- 要点: 文字が書かれていく表現。曲がって戻る部分は分割して繋ぐ。

### パーツ分けを Live2D 内でする方法（緊急用）
- 出典: @tsukutori_irona / 2026-08-22
- リンク: https://x.com/tsukutori_irona/status/2091181755843920270
- 画像: https://pbs.twimg.com/amplify_video_thumb/2091181408459141120/img/RwHPFz1d6_ID9ScL.jpg（動画）
- 要点: パーツ分けが足りなかったときにエディタ内で分ける方法。ただし緊急用で、最初に分けておくのが基本。

### 物理で上着のジッパーを動かす（空パラメータの最大/最小を制御）
- 出典: @live2dtree（再掲アカウント）/ 2026-10-13
- リンク: https://x.com/live2dtree/status/2109841570908295675
- 画像: https://pbs.twimg.com/ext_tw_video_thumb/1679268551725826049/pu/img/TlJlBBnuK7_AEGcQ.jpg（動画）
- 要点: 空のパラメータの範囲を制御して、物理でジッパーの開閉を動かす。

### 口を閉じる途中に特定の形を挟む
- 出典: @live2dtree（再掲アカウント）/ 2026-10-17
- リンク: https://x.com/live2dtree/status/2111411916757139901
- 画像: https://pbs.twimg.com/amplify_video_thumb/1976021063831080960/img/hYghxXdoKBJ3HrTw.jpg（動画）
- 要点: 口が閉じる途中に特定の変形を足すと自然になる。唇の形、歯の見え方、舌の動きも詰める。

### 深度を分けて X/Y のパースの細部を足す
- 出典: @ArianAdiyaksa / 2026-10-13
- リンク: https://x.com/ArianAdiyaksa/status/2109800458512683218
- 画像: https://pbs.twimg.com/amplify_video_thumb/2109621204822937600/img/BNK-YmIHpbtYAbob.jpg（動画）
- 要点: 奥行きを別に分けて X/Y の遠近の細部を足す。難しいのは物理や目のフォームとぶつからないようにすること。

### 無料のパーツ分け（カッティング）チュートリアルの紹介
- 出典: @rize2D / 2026-10-14
- リンク: https://x.com/rize2D/status/2110343167841026149
- 画像: https://pbs.twimg.com/amplify_video_thumb/2105101172956635136/img/TfPr8QjT9y-Av7_h.jpg（動画）
- 要点: プロのリガーによる無料のパーツ分けチュートリアルの紹介。手がかり。

### Infinity Donuts System のやり方
- 出典: @kw_nmnm / 2026-03-07
- リンク: https://x.com/kw_nmnm/status/2030346576359751807
- 画像: https://pbs.twimg.com/amplify_video_thumb/2030344387105005568/img/15iR2KCKMjlND_Cj.jpg（動画）
- 要点: 何かを無限に回す仕組み（名前のみ。中身は動画）。

## X への手がかり（深掘り候補のアカウント・シリーズ）

- @Live2DJUKU: 「#Live2DTips」で週1程度の解説動画。添削アーカイブもある。
- @nonon_yuno（ののん。）: 「Live2D講座」連番シリーズ（66回以上）。まとめ投稿あり。
- @SODAART_class: 「Live2D小技巧分享」シリーズ（中国語・日本語）。授業の質問への回答形式。
- @wa_Ta_ta__: 「パーツ分けあるある注意点」シリーズ（イラストレーター向け）。
- @_shin_sinsin: FANBOX でワープ・ブレンドシェイプの仕様解説。
- @Vil_Rib、@Luoli1101、@angel3yumeuchan、@yuseong_live2d、@NaoDoragonENV、@kawase1234567: 説明文付きの tips が多い。
- @live2dtree: Live2D 投稿の再掲アカウント（タグで分類あり）。
- @Metenee_39: Coloso で有料講座（頭部・身体のモデリング）。

## 検索記録

- 「Live2D コツ」（話題）: 有用 5〜6 件、雑多な投稿も混じる。
- 「#Live2DTips」（話題・最新）: 最も密度が高い。最新順で 2025-10 頃まで遡った。
- 「Live2D 小技」（話題）: 中国語圏の SODA ART が多い。関係ない投稿も多い。
- 「Live2D講座」（話題）: ののん。の講座シリーズが中心。
- 投稿の大半が動画で、本文だけでは中身がわからないものが多い。
