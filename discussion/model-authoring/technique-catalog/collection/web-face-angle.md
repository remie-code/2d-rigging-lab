# 集めるメモ（Web）: 顔の角度

> フェーズ1（集める）の生メモ。原文用語のまま、加工前。調査日: 2026-10-19。

## メモ

### パーツごとに別ワープデフォーマで視差を作る
- 出典: Live2D 公式 / Cubism Editor チュートリアル「5. Adding XY Facial Movement」
- リンク: https://docs.live2d.com/en/cubism-editor-tutorials/xy/
- 画像: https://docs.live2d.com/wp-content/uploads/2017/11/04.png
- 要点: 輪郭・各目・鼻・口・各眉・各耳・髪にそれぞれワープデフォーマを作り、パーツごとにずれ方を変えて奥行きを出す。デフォーマなしでアートメッシュに直接 XY を付けると眉だけで 3×3×3=27 形状が要る。

### ベジェ分割数はパーツの縦横比で決める
- 出典: Live2D 公式チュートリアル（同上）
- リンク: https://docs.live2d.com/en/cubism-editor-tutorials/xy/
- 画像: https://docs.live2d.com/wp-content/uploads/2017/11/05.png, https://docs.live2d.com/wp-content/uploads/2017/11/06_02.png
- 要点: 縦長 2×3、横長 3×2、正方形に近いもの 2×2 か 3×3。輪郭 2×3、目は 3×3 で内側 4 点で目を囲む、眉 2×2 で中央点を眉線上、鼻（点鼻）2×2・長い鼻 2×3、口 3×2 で口角に制御点、耳 2×2。

### 奥を細く、手前を広く（共通原則）
- 出典: Live2D 公式チュートリアル（同上）
- リンク: https://docs.live2d.com/en/cubism-editor-tutorials/xy/
- 画像: https://docs.live2d.com/wp-content/uploads/2017/11/17_02.png, https://docs.live2d.com/wp-content/uploads/2017/11/18_02.png
- 要点: どのデフォーマも奥側をやや細く・手前をやや広くしてパースを付ける。Y でも奥を少し狭める。静止形でなく、パラメータを動かしている途中の見え方で判断する。他の頭パーツを隠して輪郭だけで作業すると形を掴みやすい。

### 髪は既存の揺れデフォーマを親デフォーマで包む
- 出典: Live2D 公式チュートリアル（同上）
- リンク: https://docs.live2d.com/en/cubism-editor-tutorials/xy/
- 画像: https://docs.live2d.com/wp-content/uploads/2017/11/14.png, https://docs.live2d.com/wp-content/uploads/2017/11/15_2.png
- 要点: 髪揺れ用デフォーマの外側に XY 用の親を作る。親は子より小さくしない。前髪 2×2、他の髪 2×3（長い髪はもっと）。

### 斜め（四隅）は「4隅の形状を自動生成」してから手で直す
- 出典: Live2D 公式チュートリアル（同上）ほか多数
- リンク: https://docs.live2d.com/en/cubism-editor-tutorials/xy/
- 画像: https://docs.live2d.com/wp-content/uploads/2017/11/20.png, https://docs.live2d.com/wp-content/uploads/2017/11/23.png
- 要点: 角度 X に紐づくオブジェクトを全選択し、X と Y を指定して四隅を自動生成、鎖アイコンで X/Y を結合してぐるぐる回して破綻を直す。

### 輪郭を「線画」と「ベース」の 2 パーツに分ける
- 出典: 乾物ひもの / note「Live2D 高可動域モデルの顔の角度XYのすすめ①」
- リンク: https://note.com/himono_vtuber/n/na1eb00fbc3b4
- 画像: https://assets.st-note.com/production/uploads/images/46199590/picture_pc_2fb654530f9deadfd91e06d05df5d405.png, https://assets.st-note.com/production/uploads/images/46199621/picture_pc_8a003b36985845467ea302446e46aae9.gif
- 要点: 線画だけをマスクで消せるようにしておくと、横・上下を向いたときに顎線などを消して立体感を出せる。線画にもベースと同じ割り方のメッシュを複製。

### 角度X の輪郭: 幅を狭め、奥の頬をカーブ、手前の顎に丸み、手前のこめかみを引っ込める
- 出典: 乾物ひもの / note ①
- リンク: https://note.com/himono_vtuber/n/na1eb00fbc3b4
- 画像: https://assets.st-note.com/production/uploads/images/46199776/picture_pc_dc891736c23a0a61ed3c53869488ffcf.png, https://assets.st-note.com/production/uploads/images/46199844/picture_pc_5f033e058927833adae7c3245ce570f6.png
- 要点: 横向きでは奥行きで横幅が縮む。奥の頬は曲線、手前顎はゆるい丸み、手前こめかみは前髪からはみ出さないよう引っ込める。頬の膨らみは性別・年齢・絵柄で加減。

### 角度Y の輪郭はあまり変形させずずらす、反転は使わない
- 出典: 乾物ひもの / note ①
- リンク: https://note.com/himono_vtuber/n/na1eb00fbc3b4
- 画像: https://assets.st-note.com/production/uploads/images/46199936/picture_pc_68d116cd6f15290d1ccfcd07b426ef08.png
- 要点: 上下はデフォーマを大きく歪めず上下にずらす程度。上下は非対称なので「動きの反転」は使わず手作業。キャラごとの個体差が大きい。

### 四隅の自動生成はパースを考慮しない → 斜めにずらして補正
- 出典: 乾物ひもの / note ①
- リンク: https://note.com/himono_vtuber/n/na1eb00fbc3b4
- 画像: https://assets.st-note.com/production/uploads/images/46200036/picture_pc_3d9534274772fb472066435953fa774a.png, https://assets.st-note.com/production/uploads/images/46200061/picture_pc_153a62fcc44e44a39519b69708511900.png
- 要点: 自動生成の四隅は遠近が入らず歪んで見える。パースのかかっていない部分を斜め方向にずらして直す。デフォーマの編集レベル3が扱いやすい。

### 拡張補間で斜めのカクつきを消す
- 出典: 乾物ひもの / note ①
- リンク: https://note.com/himono_vtuber/n/na1eb00fbc3b4
- 画像: https://assets.st-note.com/production/uploads/images/46200166/picture_pc_68132ac87ee141d5b05fbe21e982f36c.png, https://assets.st-note.com/production/uploads/images/46200224/picture_pc_d880a2385fca94fa1a8c487d7063614b.gif
- 要点: X/Y の間を直線補間すると斜め移動がカクつくので、拡張補間で曲線的に補間させる。

### 顎の影パーツを新規に作りスライドさせる
- 出典: 乾物ひもの / note ①
- リンク: https://note.com/himono_vtuber/n/na1eb00fbc3b4
- 画像: https://assets.st-note.com/production/uploads/images/46200246/picture_pc_b237a98e20209caa3062ccc2572c6b61.png
- 要点: 原画にない顎影パーツを作って顔ベースにクリッピングし、専用デフォーマで角度に応じて滑らせる。線画には干渉させない。

### 不透明度0%のマスクパーツ＋マスク反転で顎線だけ消す
- 出典: 乾物ひもの / note ①
- リンク: https://note.com/himono_vtuber/n/na1eb00fbc3b4
- 画像: https://assets.st-note.com/production/uploads/images/46200305/picture_pc_9668b82cd2706bd7a919e11471a8a9f1.png, https://assets.st-note.com/production/uploads/images/46200341/picture_pc_29702ace755f82919fb7e4f22b746bb3.gif
- 要点: 透明なマスク用パーツで輪郭線画をクリッピングし「マスクの反転」。マスク側を動かして、横向き・上向きのときだけ顎線を削る。

### 鼻: 角度X で「く」の字、その線が顎につながる位置へ
- 出典: 乾物ひもの / note ①
- リンク: https://note.com/himono_vtuber/n/na1eb00fbc3b4
- 画像: https://assets.st-note.com/production/uploads/images/46200428/picture_pc_b438a34ef31d7b664c92d8b04927d312.png, https://assets.st-note.com/production/uploads/images/46200442/picture_pc_a9a6090a0eb699e43a4c82bd654f7678.png
- 要点: 鼻のデフォーマ中心は鼻の一番高い所に合わせる。横向きで鼻線を「く」の字にし、その線が顎のラインに繋がるよう置く。奥側を縮める。

### 正面で片側を向いた鼻は折れ目で分割
- 出典: 乾物ひもの / note ①
- リンク: https://note.com/himono_vtuber/n/na1eb00fbc3b4
- 画像: https://assets.st-note.com/production/uploads/images/46200464/picture_pc_0b888579c98eed911f175f8980602c2a.png, https://assets.st-note.com/production/uploads/images/46200481/picture_pc_c5df5878202d4fcd1d90523ca890797f.png
- 要点: 正面絵の時点で鼻が片側に向いていると、反対向きで歪みやすい。アートメッシュを直接動かすか、鼻の折れ目でパーツを分けて別々に動かす。

### 表情を完成させてから角度XYを作る
- 出典: 乾物ひもの / note ①
- リンク: https://note.com/himono_vtuber/n/na1eb00fbc3b4
- 画像: https://assets.st-note.com/production/uploads/images/46199396/picture_pc_a5f196d67f49d9b8536e54b5f8a18b93.png
- 要点: まばたき・口・眉などの表情を先に作り、その後に顔の角度XYに入る順序。

### 目元のくぼみ・まぶたの丸みを基準に目を動かす
- 出典: 乾物ひもの / note「すすめ②」
- リンク: https://note.com/himono_vtuber/n/n19828b07b8a3
- 画像: https://assets.st-note.com/production/uploads/images/48804547/picture_pc_c2f6e82d42b6565f1160f9013bc6d5c9.png, https://assets.st-note.com/production/uploads/images/48804591/picture_pc_e9d0ceccce7563cef3c80df79022e679.png
- 要点: 目は眼窩のくぼみの複雑な形をデフォーマに反映させる。上下はくぼみとまぶたの丸みが基準。斜めは輪郭や鼻と平行に並べ、曲面に沿う丸みを持たせる。閉じ目状態でも確認する。

### 眼球専用デフォーマを XY デフォーマの親に（黒目は凹、ハイライトは凸）
- 出典: 乾物ひもの / note ②
- リンク: https://note.com/himono_vtuber/n/n19828b07b8a3
- 画像: https://assets.st-note.com/production/uploads/images/48804622/picture_pc_1d6c1893a590426c18f96f438fc73260.png, https://assets.st-note.com/production/uploads/images/48804640/picture_pc_2a685c8f613c352af8ba7ec33213f267.png, https://assets.st-note.com/production/uploads/images/48804667/picture_pc_722db4d17379f00838df90727612aa63.gif
- 要点: 目全体デフォーマだけだと眼球がひしゃげて平面的になる。眼球用を親として足し、球体として崩れないよう調整。黒目は凹ませ（メッシュ直接）、ハイライトは盛り上げる（デフォーマ）。瞳孔を分けられるなら個別にずらす。

### 口は鼻筋〜顎の面に乗せ、奥を極端に縮める／口の形ごとに XY 形状を持つ
- 出典: 乾物ひもの / note ②
- リンク: https://note.com/himono_vtuber/n/n19828b07b8a3
- 画像: https://assets.st-note.com/production/uploads/images/48804682/picture_pc_d6305459c285b8b56efd81a5d470109d.png, https://assets.st-note.com/production/uploads/images/48804701/picture_pc_a88a317a9509ffde84c00d8000984791.png, https://assets.st-note.com/production/uploads/images/48804711/picture_pc_94df901e11c78c7e425f511850a490ed.png
- 要点: 口の奥側は強く縮め、デフォーマ中央をへこませると見栄えが良い。Y では鼻との距離を保つ。笑顔の開口に合わせた XY 形状だと閉じた「への字」で口下が間延びするため、口の XY デフォーマに口の開閉パラメータも掛け合わせる（例: X3×Y3×開閉2=18 点、多いと X3×Y3×開閉3×変形3=81 点）。公式は 3 つ以上の同時付けを非推奨。

### 口内（口の影・歯の影）は別デフォーマで角度ごとに
- 出典: 乾物ひもの / note ②
- リンク: https://note.com/himono_vtuber/n/n19828b07b8a3
- 画像: https://assets.st-note.com/production/uploads/images/48804818/picture_pc_a39633307dba8e17cfa4cac20d1e3144.png
- 要点: 口影と歯影を別デフォーマにし、角度で個別にずらす。下の歯が大きく動くなら角度と口の両方にパラメータを付ける。

### 眉と目の距離をデフォーマごと一定に保つ
- 出典: 乾物ひもの / note ②
- リンク: https://note.com/himono_vtuber/n/n19828b07b8a3
- 画像: https://assets.st-note.com/production/uploads/images/48804973/picture_pc_75de957b67b176491ab5bfa020bb485f.png
- 要点: 眉・頬は目の動きと平行に動かす。眉を上下させるときは目との距離を保つ。下向きで距離を縮めたいときはデフォーマも縦に縮める。頬は顔ベースにクリッピング。

### 耳の位置基準と、耳と輪郭の描画順チラつき対策
- 出典: 乾物ひもの / note ②
- リンク: https://note.com/himono_vtuber/n/n19828b07b8a3
- 画像: https://assets.st-note.com/production/uploads/images/48804989/picture_pc_36db6880867afe0cd08a31ed0dbb00c0.png, https://assets.st-note.com/production/uploads/images/48805017/picture_pc_7e8e2b12e90701528782804653e9a1c7.gif, https://assets.st-note.com/production/uploads/images/48805034/picture_pc_bee683b4c0f63094a6dbc5f52fd49671.gif
- 要点: 耳は正面から見て「目〜鼻先」の高さ帯に付いているものとして位置決め。可動域が大きいと耳を輪郭より前に出す必要があるが描画順切替はチラつくので、耳は最初から前に置き、顎と同じマスク反転で輪郭線を消す。

### 首: 上向き用に大きくはみ出して描く、斜め上で首を曲げて顎下を作る
- 出典: 乾物ひもの / note ②
- リンク: https://note.com/himono_vtuber/n/n19828b07b8a3
- 画像: https://assets.st-note.com/production/uploads/images/48805082/picture_pc_8a83bddc9177d9795a4f2ae7e68d829c.png, https://assets.st-note.com/production/uploads/images/48805111/picture_pc_2e9afddd286313e81f70ee05d17d8d40.gif, https://assets.st-note.com/production/uploads/images/48805114/picture_pc_78a8a80a88e5040d3aaa3e1562e901c5.gif
- 要点: 首パーツは上を向いたとき用に大きめにはみ出して作る。斜め上では首を大きく曲げて顎の下面を見せると立体的。首影に境目があれば別パーツで動かす。正面向きの体なら首 X はほぼ不要、体が斜めなら首も顔に合わせる。

### 前髪は大きな全体デフォーマ＋頭蓋骨の丸み
- 出典: 乾物ひもの / note「すすめ③」
- リンク: https://note.com/himono_vtuber/n/ne6f7c0fdfdaa
- 画像: https://assets.st-note.com/production/uploads/images/49963845/picture_pc_45372b9bc89aba4643e244b581fac263.png, https://assets.st-note.com/production/uploads/images/49963864/picture_pc_4f8db301ba7295579c965bdb51c9e3b3.png
- 要点: 毛束ごとに分かれた前髪は大きな全体デフォーマでまとめて動かすと破綻しにくい。頭蓋の丸みを意識しないと平面的になる。

### 筒状の横髪はパーツ複製して奥側を輪郭の下へ
- 出典: 乾物ひもの / note ③
- リンク: https://note.com/himono_vtuber/n/ne6f7c0fdfdaa
- 画像: https://assets.st-note.com/production/uploads/images/49963943/picture_pc_5495d6459be1c190762b8f80328b8550.png, https://assets.st-note.com/production/uploads/images/49963973/picture_pc_6235f9880ea335bc58b72f0da3c103c9.gif
- 要点: 描画順を切り替えるとチラつくので、横髪を複製して片方を輪郭より下の描画順に置き、横向き時は手前側だけを大きく変形させる。リボン状の横髪は上部だけ幅を縮め下部は元形を残す。上向きは幅を縮めて全体を上げ、下向きは上部のみ変形し下部は重力で下ろす。

### 交点（基準点）の考え方: 同じ奥行きの交点はずらさない
- 出典: 乾物ひもの / note ③
- リンク: https://note.com/himono_vtuber/n/ne6f7c0fdfdaa
- 画像: https://assets.st-note.com/production/uploads/images/49964156/picture_pc_b8ea35e057d03664358fbc65382c98c3.png, https://assets.st-note.com/production/uploads/images/49964169/picture_pc_c536fadd6f4a33b2622d30b3f58bfbb8.gif, https://assets.st-note.com/production/uploads/images/49964194/picture_pc_645680d0542829cf6295326463e22cb2.png
- 要点: 髪とハイライトのように同じ奥行きにある交点は角度が変わっても関係を保つ（ずれると「滑る」）。目頭と毛先のように奥行き差がある交点は、奥・手前・進行方向の順に押し出す。逆だと不自然。

### 後ろ髪の側面パーツを描き足す（側面は横向きで描いてから縮める）
- 出典: 乾物ひもの / note ③
- リンク: https://note.com/himono_vtuber/n/ne6f7c0fdfdaa
- 画像: https://assets.st-note.com/production/uploads/images/49964308/picture_pc_4748401ca44d30540dc3c4b74920cec3.png, https://assets.st-note.com/production/uploads/images/49964337/picture_pc_6dd3a8a0cb8ffac8121f237fd65b3710.png, https://assets.st-note.com/production/uploads/images/49964374/picture_pc_1ffd735ef946eac6ab849eb4f43e7e4d.png
- 要点: 側面が無い・狭いと横向きで後ろ髪の影色が露出する。原画にない側面パーツを追加し、正面では手前パーツに隠れるよう動かす（イラストレーターに確認を取る）。髪の根元の丸い部分を個別に分けると変形しやすい。

### つむじのある絵柄は下向き用に左右の影パーツを足す
- 出典: 乾物ひもの / note ③
- リンク: https://note.com/himono_vtuber/n/ne6f7c0fdfdaa
- 画像: https://assets.st-note.com/production/uploads/images/49964445/picture_pc_e5f109407d4687df208f9a4fa8388601.png, https://assets.st-note.com/production/uploads/images/49964477/picture_pc_10d8d365536c16fe1381dc934f80f578.gif
- 要点: 下を向くとつむじ周りに隙間が出る。左右に影パーツを追加し、つむじ本体はメッシュ直接、追加分はデフォーマで連動。

### 獣耳・頭頂小物は「目と平行」→前面だけ追加変形
- 出典: 乾物ひもの / note ③
- リンク: https://note.com/himono_vtuber/n/ne6f7c0fdfdaa
- 画像: https://assets.st-note.com/production/uploads/images/49964586/picture_pc_f2533fd611df10afdc79e3aa5961c38e.png, https://assets.st-note.com/production/uploads/images/49964608/picture_pc_49e4e7b270999f31a6202edb5f574af9.gif
- 要点: 獣耳は前面・奥・中のふさふさに分け、全体を目と平行に動かしてから横向き時に前面をさらに変形。カチューシャ・アホ毛など頭頂部は最もダイナミックに動くので交点を探して粘る。

### デフォーマ命名規則とはみ出し検証
- 出典: 乾物ひもの / note ③
- リンク: https://note.com/himono_vtuber/n/ne6f7c0fdfdaa
- 画像: https://assets.st-note.com/production/uploads/images/49963778/picture_pc_3fe44d7ddef32b04e7fafab72af629fd.png, https://assets.st-note.com/production/uploads/images/49963828/picture_pc_a1919011f86e90a468546db16d5c6e4a.png
- 要点: XY 系「〇〇の曲面」、物理「〇〇の揺れ」、Z「〇〇のZ」、表示切替「〇〇のONOFF」と用途で名付ける。子が親デフォーマからはみ出すと重くなる（ゲームでは厳禁、V 用途では動くこともある）ので「デフォーマの検証」で確認。

### 立体を頭の中に飼う: デフォーマ頂点を立体に沿わせ、X は水平・Y は垂直のみ
- 出典: 925（クニコ）/ note「角度XYを作る時、何を考えているのか 頭の中に立体を飼おう その①」/ Live2D アドカレ2024
- リンク: https://note.com/925__niconico/n/n5977ff68b787
- 画像: https://assets.st-note.com/img/1733992881-MaCJ8BRbOiFLk9H3sEwvhA7z.png, https://assets.st-note.com/img/1734954050-40gpB7UwExbrGDkYJIiV31oh.png, https://assets.st-note.com/img/1734954630-gy1E4Mk0ZKNqwIdOoXPuWjae.png
- 要点: 絵の形ではなくデフォーマの格子の形を見て作る。頂点は立体に沿って整列させ、X は水平移動、Y は垂直移動だけで骨格を作り、パース等の微調整は最後に少しだけ。

### 回り込み（円柱）: 奥行きは横幅だけで表し縦には縮めない
- 出典: 925（クニコ）/ note（同上）
- リンク: https://note.com/925__niconico/n/n5977ff68b787
- 画像: https://assets.st-note.com/img/1734959794-sbHBVtRZdopumyvTIW9clFX2.png, https://assets.st-note.com/img/1734955361-4Sct8TOv20VkjUysDlZJEihL.png
- 要点: 顎位置を決めてから奥半分・手前半分の幅を調整、奥の奥はさらに狭める。顔パーツの手前はあまり広げない。顔中心線とデフォーマ中心線を揃え、横の分割数は偶数に。

### 回転軸からの距離で移動量を変える（顎先・鼻・髪）
- 出典: 925（クニコ）/ note（同上）
- リンク: https://note.com/925__niconico/n/n5977ff68b787
- 画像: https://assets.st-note.com/img/1734956327-uElOyWI5kLAcQhV7Y4szvpi8.png, https://assets.st-note.com/img/1734957104-uhLGETdm4jBQ7cUXHSreF2AW.png
- 要点: 角度X は首の中心を軸とした回転と考え、軸から遠いほど横に大きく動かす。顎先の移動が足りないと顎を引いた・首の座りが悪い印象に。鼻は顔から飛び出しているので大きく横移動。髪は顔より軸から遠いので顔より少しだけ多く動かす。

### 顔の側面は立方体: 額は丸く、目〜頬は平ら、頬骨で角
- 出典: 925（クニコ）/ note（同上）
- リンク: https://note.com/925__niconico/n/n5977ff68b787
- 画像: https://assets.st-note.com/img/1734956729-sK9H14VN6adXBtW2nhxoQlGS.png, https://assets.st-note.com/img/1734960007-UiulYxD1MgcoRhHwISaeXPmW.png
- 要点: 目から耳までの距離は正面で狭く横向きで広い。輪郭の起伏として眉骨は出し、目は窪ませる。目尻がはみ出してもまつげに見えるなら許容。

### 耳は無理に変形させず輪郭側で合わせる
- 出典: 925（クニコ）/ note（同上）
- リンク: https://note.com/925__niconico/n/n5977ff68b787
- 画像: https://assets.st-note.com/img/1734955935-Grsq2UuB0AFygmk8ifxCPwYS.png
- 要点: 奥の耳は狭く手前は少し広くして平行移動。耳自体を歪めるより輪郭を調整する。

### 眉は目より大きく横に動かして彫りの深さを出す
- 出典: 925（クニコ）/ note（同上）
- リンク: https://note.com/925__niconico/n/n5977ff68b787
- 画像: https://assets.st-note.com/img/1734957505-g6l7VteWdchzraSOLxiDvEAR.png, https://assets.st-note.com/img/1734957657-OBs2hdzruHl3Do1yq4I57ZcT.png
- 要点: 眉は眉骨の上、目は窪みにあるものとして眉を多めに動かす。眉尻はあまり動かさず眉頭で調整、額の丸みに沿うカーブ。目デフォーマは「瞳」と「全体」に分け、全体は窪みに沿わせ白目だけ少し凸にすると閉じ目が自然。

### 口は鼻〜顎の傾斜に張り付く、舌は逆傾斜
- 出典: 925（クニコ）/ note（同上）
- リンク: https://note.com/925__niconico/n/n5977ff68b787
- 画像: https://assets.st-note.com/img/1734957878-xEJ3AjiZRaCtDygwoeBsW5V6.png, https://assets.st-note.com/img/1734958123-vX8QhNzuaqxmZ9GCewgVjsMf.png
- 要点: 口デフォーマの中心線を鼻から顎への傾斜に沿わせる。「お」など開いた口で中心を確認しながら作る。舌は口と逆向きの傾斜上にあるとしてデフォーマを分ける。

### 頭の丸み（球体）: 前髪・横髪のカーブ方向を全て揃える
- 出典: 925（クニコ）/ note（同上）
- リンク: https://note.com/925__niconico/n/n5977ff68b787
- 画像: https://assets.st-note.com/img/1734958715-gLX9J4BVl8RSNWMG5iA6xepb.png, https://assets.st-note.com/img/1734958471-ybOYrdxRkwI9tn4vc5EHsTLj.png
- 要点: デフォーマは頭に張り付く四角い紙と考える。髪束のカーブ方向がバラバラなのはよくある間違い。重なり・隙間は奥ほど重なり手前ほど広げる（生え際は変えすぎない）。奥の横髪はペラペラにならないよう回り込んだ生え際を考える。

### 後ろ髪は顔・前髪と逆方向へ、切り替えは顔の裏の隠れた所で
- 出典: 925（クニコ）/ note（同上）
- リンク: https://note.com/925__niconico/n/n5977ff68b787
- 画像: https://assets.st-note.com/img/1734959053-xTSWeG9rKz1pylsmXRwj6nfq.png
- 要点: 頭頂から後ろ髪まで一体でパーツ分けすると継ぎ目のない丸い頭に。後ろ髪は逆方向に移動し、手前側を狭く奥側を広く。立体感の切り替わりは顔に隠れる部分で行う。最後に首の座り（頭の中心が首に乗っているか）を確認。

### 前方のものほど動きが激しい／左右端の頂点は動かさない
- 出典: ガレージ暮らしのトライタム / はてなブログ「Live2Dの角度X,Yの作成」/ 2016-08-16
- リンク: https://traitam.hatenablog.com/entry/2016/08/16/Live2D%E3%81%AE%E8%A7%92%E5%BA%A6X,Y%E3%81%AE%E4%BD%9C%E6%88%90
- 画像: https://cdn-ak.f.st-hatena.com/images/fotolife/t/traitam/20160815/20160815224529.png, https://cdn-ak.f.st-hatena.com/images/fotolife/t/traitam/20160816/20160816214119.png, https://cdn-ak.f.st-hatena.com/images/fotolife/t/traitam/20160816/20160816222137.png
- 要点: 前髪の曲線が最もきつく後ろ髪が最も緩い。角度X では横移動のみ（Shift で軸固定）。内側の列を向く方向へ、最上下の頂点は反対方向に引く。左右端の頂点は動かさないと四隅ブレンドが楽。拡縮は使わず全体移動で統一。

### 輪郭の変形は控えめに、パーツ位置で向きを出す
- 出典: cgbox（VTuber解剖）/「顔の回転XYZの作り方とクオリティアップするためのノウハウ」/ 2019-07-25
- リンク: https://cgbox.jp/2019/07/25/live2d-kao-xy/
- 画像: ページ内にあり
- 要点: 輪郭を大きく変形させると立体に見えなくなる。目や口を横に動かして向きを表す。女性モデルは横向きで頬と頭部を少し出す。顎を軸に角度を決め、顎を動かしすぎるとしゃくれる。

### Y の注意: 下向きでつぶれない、上向きは髪上部縮小＋顎幅を少し小さく
- 出典: cgbox / 同上
- リンク: https://cgbox.jp/2019/07/25/live2d-kao-xy/
- 画像: ページ内にあり
- 要点: 下向きは口と鼻を大きめに下げ、顎は小さくしすぎない（つぶれて見える）。上向きは髪上部を縮め、顎幅を少し狭めるとのけぞり感。X ではつむじの位置は動かさない。首影も動かし光の方向を意識。

### 傾けたら後ろ髪・イヤリングを垂らす／Z に体の回転Z を混ぜる
- 出典: cgbox / 同上
- リンク: https://cgbox.jp/2019/07/25/live2d-kao-xy/
- 画像: ページ内にあり
- 要点: 角度Z で後ろ髪やアクセサリを重力方向へ垂らす。FaceRig 用モデルでは角度Z に体の回転Z を統合すると、頭が先・体が後から動く感じになる。

### 上を向いたときに輪郭線を消す（線画と塗り分離＋マスク反転、顎下影）
- 出典: cgbox /「【Live2D】顔が上を向いたときに輪郭線を消す方法」/ 2020-12-21
- リンク: https://cgbox.jp/2020/12/21/live2d-up-rinnkaku/
- 画像: ページ内にあり
- 要点: 顔の塗りと線画を分け、線画は手動メッシュ。不透明度0の範囲指定パーツでマスク反転し、角度Y に合わせて線が消えるよう動かす。首影と輪郭影の色を揃える。別作者例として正面0%→上向き100%の顎下影パーツ（真上向きでは顎線を残す方がバランスが良いとの例も）。

### 輪郭: 中心点→上下中心→向く側の側点の順で動かす／奥の耳は根元と先を少し狭める
- 出典: palkaloid / FREE版Live2D(15)「頭部X軸の設定」/ 2024
- リンク: https://palkaloid.com/578/set-x-head/
- 画像: https://palkaloid.com/wp-content/uploads/2024/05/76acfdbfa69e4ff77a5faa9504e61aa6.png, https://palkaloid.com/wp-content/uploads/2024/05/fb51e897422c78d21dcc0ca51b4b25b9-1-800x517.png
- 要点: まず中心を動かして向いた方向で顔と首を揃え、次に上下中心、最後に向く側の側点。縦移動は避け、奥行きを示す程度に少しだけ。耳は不透明度50%で基準に合わせてから変形、奥耳は高さを変えず根元と先を少し狭める。奥の目は目尻側を少し潰す。変形は控えめにしないと斜めで破綻。

### 鼻筋パーツを目や頬染めに重ねて奥行き
- 出典: palkaloid / 同上
- リンク: https://palkaloid.com/578/set-x-head/
- 画像: https://palkaloid.com/wp-content/uploads/2024/05/31acdfcb0af3e6b330f4aac508c47cf1-800x575.png
- 要点: 横向き時、鼻筋のパーツが奥の目や頬染めに少しかぶると奥行きが出る。口は最大開口の形で作業すると失敗が減る。頬染めは頭の子のワープで目に追従させ反転。

### 角度XY の作業順と、Y で増減させるもの
- 出典: 伊糖だねこ / note「Live2D練習記録⑥ ー モデリング 頭部のX・Y軸 ー」
- リンク: https://note.com/itodaneko/n/n966f2208b4a4
- 画像: https://assets.st-note.com/img/1765596382-urIoPkvlU8QKYy1WHtq0E37j.jpg, https://assets.st-note.com/img/1765596766-dkCg7Evl2DRNJjfpVs031r6B.jpg
- 要点: 作業順は輪郭→鼻→口→目→眉→前髪・横髪→髪飾り→耳・ヘッドドレス→後頭部・後ろ髪。下向きは顔周りの影を減らし、上向きは顎下の影を広げる。下向きでまつげ幅を広く、上向きで狭く。前髪は下向きで少し伸び、上向きで短く（毛先と目の距離が目安）。髪飾りは下向きで上面を見せる。

### 球体の小物は回転デフォーマへ、前髪は落ち影ごと 1 デフォーマ
- 出典: 伊糖だねこ / note ⑥
- リンク: https://note.com/itodaneko/n/n966f2208b4a4
- 画像: https://assets.st-note.com/img/1765596009-0cOzn6jHfgvtrLiuDCGEe9BY.jpg, https://assets.st-note.com/img/1765595938-BgJMH3f7xwKa1vODVZilLCXP.jpg
- 要点: 鈴のような球体はワープに入れると歪むので回転デフォーマに。前髪・横髪は落ち影も含めて 1 つのデフォーマで動かすと自然。輪郭影など細かい所はメッシュ直接（反転できないので両側作る）。

### 斜め顔を「フォームをブレンド」適用度50で作る
- 出典: 伊糖だねこ / note ⑥
- リンク: https://note.com/itodaneko/n/n966f2208b4a4
- 画像: https://assets.st-note.com/img/1765596974-mwZp4En6ogbRsr8T0jFl57qW.jpg, https://assets.st-note.com/img/1765597114-pucmdzEk9qxW3CYUG1j6iaoy.jpg
- 要点: 四隅を Ctrl+Shift+B のフォームブレンドで作るとパースが狂いにくい。適用度50が自然だった。ただ変形が小さめなので、強い斜めが欲しいなら四隅自動生成を検討。

### 角度Z の回転中心: 頭は顎付近・鼻と口の間、首は首の根元
- 出典: さらえみ「Live2Dで顔を横に振る『角度Z』の作り方」/ 2021-10-07、伊糖だねこ note⑤、朝野ねごと note
- リンク: https://saraemi.com/vtuber/2021/10/07/live2d_face_z/ , https://note.com/itodaneko/n/ne0c746dac25a , https://note.com/asanonegoto/n/nf34d2d32b760
- 画像: https://saraemi.com/vtuber/wp-content/uploads/2024/11/2110_live2d_z.webp, https://assets.st-note.com/img/1765172448-q61AX2i85MVByrmunSvefTIp.jpg, https://assets.st-note.com/production/uploads/images/55057766/picture_pc_773fc2ce3d8269e2a6a8c28f1f4b2e89.gif
- 要点: 頭の回転デフォーマ中心は顎中央〜顎の少し上（鼻と口の間とする記事も）、首の回転は首の根元。首の回転の中に頭の回転を入れ子に。首にワープを付け形を変えながら傾けるのも有効。

### 傾きは ±20〜30° 程度（付けすぎると怖い）、23〜25° 目安の例も
- 出典: 伊糖だねこ note⑤ / 朝野ねごと note「Live2D Memo 6」
- リンク: https://note.com/itodaneko/n/ne0c746dac25a , https://note.com/asanonegoto/n/nf34d2d32b760
- 画像: https://assets.st-note.com/img/1765172473-dbQjxWyhVetkH3uoiXqaT5Y8.jpg
- 要点: 角度Z の最大傾きは大きすぎると怖い印象。±20〜30°、別記事では 23〜25° が目安。

### 体Z を作ってから頭の位置を少し下げる／頭回転の親を上半身回転に
- 出典: 伊糖だねこ / note「Live2D練習記録⑤ ー モデリング Z軸 ー」
- リンク: https://note.com/itodaneko/n/ne0c746dac25a
- 画像: https://assets.st-note.com/img/1765172495-NCHxM7zSmFVZOInT3yhUJYRL.jpg
- 要点: 体から傾けると首の位置がずれるので体Z を作ってから頭部位置を調整、少し下げると自然。体Z 反転時に VTS で頭がずれた件は、頭部回転の親を「体の回転Z」に紐づく上半身回転にして減った。

### 傾き用に首を口元あたりまで描き足す／デフォルト角度±10°
- 出典: 猫様の下僕姉弟の生活 /「【Live2D Cubism 4】顔の傾きの作成」
- リンク: https://www.geboku-kyoudai.com/entry/Live2D-HeadTilt
- 画像: https://cdn-ak.f.st-hatena.com/images/fotolife/k/kamiya11/20200113/20200113145039.jpg, https://cdn-ak.f.st-hatena.com/images/fotolife/k/kamiya11/20200113/20200113151345.gif
- 要点: 首が短いと傾けたとき顔の下が見切れるので、首は口元あたりまで描き足す。顔が元々斜めなら回転基準を鼻筋に合わせて角度を付け、そのデフォルト角度に ±10° 加える例。

### 角度XY は角度Z と髪揺れの後に作る（枠と親子関係エラー回避）
- 出典: さらえみ「Live2Dで左右に振り向かせる『角度X』とぐるぐる回る顔の作り方」/ 2021-10-21、同「角度Y」/ 2021-10-20
- リンク: https://saraemi.com/vtuber/2021/10/21/live2d_face_x/ , https://saraemi.com/vtuber/2021/10/20/live2d_face_y/
- 画像: https://saraemi.com/vtuber/wp-content/uploads/2024/11/2110_live2d_x.webp, https://saraemi.com/vtuber/wp-content/uploads/2024/11/2110_live2d_y.webp
- 要点: XY デフォーマ枠は可動域を含めて髪揺れ・角度Z より大きく。横髪など輪郭の前後に出したいパーツは ±30 のときだけ描画順を変える。崩れたら反転ラフを下絵に読み込む。二次元なので少しオーバー気味に動かすと見栄えが良い。上向きは正面視で耳と髪が下がり頭頂の見える面が狭くなる、下向きはその逆。

### 回転の中心点は首の付け根、横髪より奥の髪は描画順 490 未満
- 出典: CastCraft ブログ「Live2Dの動かし方｜初心者向けパーツ別の手順と設定」
- リンク: https://castcraft.live/blog/464/
- 画像: https://images.ctfassets.net/3a5471szmrtv/5sFgP9jzON1dIYTIif2671/c978709a7b261d277d4100aae70ee7b9/article464-012.png, https://images.ctfassets.net/3a5471szmrtv/6EeguiYdJhtJ29PypDizVv/6e4cfaa66bd829cea36ab3963efb44ff/article464-013.png
- 要点: Y で上下を先に作ってから X。輪郭 2×3 でおでこと顔中心にハンドルができる。手前こめかみは前髪からはみ出さないよう引っ込め、顎位置は一定に保つ。横髪より奥の髪は描画順 490 未満にすると振り向きの前後関係が自然。

### 練りゴムなどの模型を見て面の形をつかむ
- 出典: イケメンが描きたい。（mayurishindoh）/「Live2Dモデルを作ろう！④ 頭部（顔）のXYと体のXYZ」/ 2022-09
- リンク: https://mayurishindoh.com/9026-2/
- 画像: https://mayurishindoh.com/wp-content/uploads/2022/09/Live顔のxyz000-01-800x566.png, https://mayurishindoh.com/wp-content/uploads/2022/09/Live顔のx004-01-800x566.jpg
- 要点: 2D の可愛さを優先しがちなので、粘土模型を角度を変えて観察して面を掴む。「輪郭の曲面」を基準にして他パーツを合わせる。横向きでは奥の耳を輪郭の向こうへ引っ込め手前の耳は少し広げる。口パク・目パチ・ランダム再生と組み合わせて確認。

### 頭全体を回転デフォーマに入れて斜めで頭が縮むのを防ぐ（楽な斜め顔）
- 出典: マジョホゥプ / note「楽したい人向けの角度付き顔の作り方」
- リンク: https://note.com/majohope/n/ne439fa0dd96e
- 画像: https://assets.st-note.com/img/1653977804297-ci1nehieDE.png, https://assets.st-note.com/img/1653977961515-8q1baqVIlS.png, https://assets.st-note.com/img/1653978222642-WtiK5HptjN.png
- 要点: ワープだけだと斜めで頭が縮むので、首の付け根中心の回転デフォーマに頭パーツをまとめ、斜めキーだけ回転させる。X±21 付近で作った形を斜め（X±30,Y±30）にコピーして ±21 キーを消す。斜めのスナップショットを正面上下の調整ガイドに。斜めは横向きの傾きを少し和らげる。

### 男性の鼻: 鼻背・鼻柱の 2 本線で構成、塗りは別パーツ
- 出典: りりっしゅ（note.lilish.com）/「青年期以上の男性キャラ特有の悩ましさ…角度Xの輪郭／鼻。」/ 2021-03
- リンク: https://note.lilish.com/live2d/live2d_log-004
- 画像: https://note.lilish.com/wp-content/uploads/2021/03/Live2D_log04_a1.png, https://note.lilish.com/wp-content/uploads/2021/03/Live2D_log04_a3.png, https://note.lilish.com/wp-content/uploads/2021/03/Live2D_log04_b3.jpg
- 要点: 正面で「｜」の鼻が横で「く」になる点に着目し、長い鼻背線と短い鼻柱線の 2 本で組む。輪郭は変形パスで内側ポリゴンを巻き込まないよう打つ。ペイントソフトで「こんな感じ」の下絵を作り読み込むと楽。高可動域にすると側面髪が必要になり作業量が激増。

### 鼻梁の高さで奥の目の一部を隠す（マスク）
- 出典: りりっしゅ /「再び挑む、角度Xにおける青年男性の鼻の高さ」/ 2021-03
- リンク: https://note.lilish.com/live2d/live2d_log-007
- 画像: https://note.lilish.com/wp-content/uploads/2021/03/Live2D_007_03.jpg, https://note.lilish.com/wp-content/uploads/2021/03/Live2D_007_05.jpg
- 要点: 高い鼻では鼻梁で奥の目が部分的に隠れる表現を多用し、そこにマスクが要る。奥の目と口にも強めに角度を付ける。奥の目のまぶたが輪郭影に触れるので、輪郭を「線画・着彩・影」の 3 つに分けたい。

### 鼻が別デフォーマなら鼻専用パラメータを用意（鼻だけ正面固定の不具合）
- 出典: Live2D クリエイターズフォーラム「顔のパラメータで鼻だけ正面のまま固定されてしまう」
- リンク: https://creatorsforum.live2d.com/t/topic/1052
- 画像: なし
- 要点: 鼻を顔デフォーマ外で別に変形させる設計では、鼻用に 3 点パラメータを紐づけないと角度X に追従しない。

### 口はワープで Face Angle X に追従させ、端で反対側へ寄せる
- 出典: Live2D Creators Forum「Rigging the mouth where it changes based on where the head is facing」
- リンク: https://community.live2d.com/discussion/1724/rigging-the-mouth-where-it-changes-based-on-where-the-head-is-facing
- 画像: なし
- 要点: 口を包むワープデフォーマを Face Angle X に紐づけ、パラメータ端で口を顔の向こう側へ移動させ必要なら歪める。

### XY 片側の動きは直交（上向き時に X 成分ゼロ）
- 出典: Live2D Creators Forum「x y movement lock」
- リンク: https://community.live2d.com/discussion/334/x-y-movement-lock
- 画像: なし
- 要点: 上を向くときは X 方向の動きがゼロ、横を向くときは Y がゼロ、という前提で X/Y 片方だけロックする機能が要望されている（＝軸ごとに純粋な成分で作る発想）。

### DesignDoll で角度ガイド画像を作る
- 出典: CBeam / Live2D Creators Forum「Easy accurate guide images for different angles」/ 2016-03
- リンク: https://community.live2d.com/discussion/333
- 画像: http://i.imgur.com/yVW4l4e.png, http://i.imgur.com/zZqtX40.png, http://i.imgur.com/ActoQO6.png
- 要点: 元スプライトを Image Overlay で重ね、DesignDoll の頭を合わせ、髪は一回り大きい半透明の頭で代用して回転させ、各角度を書き出してガイドにする。

### 角度ガイド枚数の目安（上・下・右・右上・右下 各30°）
- 出典: Yahoo!知恵袋 回答
- リンク: https://detail.chiebukuro.yahoo.co.jp/qa/question_detail/q11291711961
- 画像: なし
- 要点: 角度の参考として 30° で 5 枚、高可動域ならもっと。頬のふくらみや鼻筋の造形は表情でなく角度で変わるので角度情報が重要。

### 3D Expression ツールで初期デフォーマに傾きと軽いパース
- 出典: cillia / itch.io「Live2D Head Angle Workflow Example」/ 2024
- リンク: https://cillia.itch.io/live2d-head-angle-workflow-example
- 画像: https://img.itch.zone/aW1nLzE3MjQ4NjQ3LnBuZw==/original/gpbEtS.png, https://img.itch.zone/aW1hZ2UvMjg4NDA2Ny8xNzI0ODAxMi5wbmc=/original/kVn8pI.png
- 要点: デフォーマ階層を「横方向の一貫性」を保つ組み方にして四隅の補正作業を減らす（頭の付け根以外）。5.1 の 3D 表現ツールは主に初期デフォーマに傾き＋わずかなパースを付けるのに使う。首は頭に glue。

### 3D回転表現の適用（平面化→奥行き推定、カメラ位置・回転中心・パース強度）
- 出典: Live2D 公式マニュアル「Application of 3D Rotation Expression」
- リンク: https://docs.live2d.com/en/cubism-editor-manual/apply-3d-rotation-expression/
- 画像: https://docs.live2d.com/cms/wp-content/uploads/2025/10/Applicationof3DRotation_03-en.png, https://docs.live2d.com/cms/wp-content/uploads/2025/10/Applicationof3DRotation_04-en.png, https://docs.live2d.com/cms/wp-content/uploads/2025/10/Applicationof3DRotation_16-en.png
- 要点: まず平面化して平面回転を作り、その後に非デフォルトのキーフォームから奥行きを推定。カメラ位置・回転中心・Z オフセット・パース強度（0 で平行投影）・角度範囲・回転方式（主に四隅の見え方に影響）を設定。既存キーフォームは上書きされるので未編集の対象を登録する。

### 顔の動きの自動生成（正面向き限定、四隅は顔のみ）
- 出典: Live2D 公式マニュアル「顔の動きの自動生成」
- リンク: https://docs.live2d.com/cubism-editor-manual/face-auto-edit
- 画像: https://docs.live2d.com/cms/wp-content/uploads/2025/08/AutoGenerationOfFacialMotion_01-ja.png, https://docs.live2d.com/cms/wp-content/uploads/2025/08/AutoGenerationOfFacialMotion_08-ja.png
- 要点: 顔・左右目・左右目玉・左右眉・左右耳・口・鼻を別パーツに分けておく前提。正面向きの顔のみ対応。調整で「シフトレベル」「変形レベル」、眉のシフトを目のシフトに合わせる設定がある。

### 自動生成後の手直しポイント（奥側を持ち上げて立体感）
- 出典: Live2D 公式 juku（Live2D JUKU）講座「新機能[顔の動きを自動生成]で効率化！」
- リンク: https://juku.live2dcs.jp/en/course/course-39/
- 画像: なし
- 要点: 自動生成後、X で頬・首・頭・髪・ツインテ・耳・後ろ髪、Y で頭・髪・輪郭・鼻を手直し。品質アップとして顎線を消して顔に影を足す、後頭部素材を追加、メッシュを手で割り直す、分割数を変える、四隅で顔の奥側を持ち上げる。

### 自動生成の結果を構造の教材に（眉は角度用・位置用・曲面用の 3 段）
- 出典: k-illust.net「Live2D初心者でもできた！顔の動きの自動生成を活用する3つのメリット」/ 2025-10
- リンク: https://k-illust.net/l2d-kao202510/
- 画像: https://k-illust.net/wp-content/uploads/2025/10/l2d-1007-d9a.webp
- 要点: 旧来の四隅自動生成はパース無視で崩れるが、新機能はほぼ破綻なし。生成されたデフォーマのサイズや数が参考になり、眉が角度用・位置用・曲面用の 3 デフォーマ構成だった、という観察。

### 張りぼて問題: 大きな立体パーツは角度でパーツ差し替え
- 出典: ポケラボ / Wantedly ブログ（Live2D 制作記）
- リンク: https://www.wantedly.com/companies/pokelabo/post_articles/174340
- 画像: https://images.wantedly.com/i/skCShDf?w=1440, https://images.wantedly.com/i/EBwamW7?w=1440, https://images.wantedly.com/i/wuA9jXe?w=1440
- 要点: 歯車や大きなツインテールが張りぼて状に平面に見えたため、パーツを追加し一定角度で歯車 A→B に切り替え。切替前に A を B の形へ寄せて自然に。そのためメッシュを細かく割る。剛体・大きな立体は Live2D が苦手。X/Y 軸専用デフォーマを分けると反転が楽。

### ピクセルアートは曲げず、髪を奥行き層に分けて視差
- 出典: Steam コミュニティガイド「a Pixel-artists' Guide to Live2D」
- リンク: https://steamcommunity.com/sharedfiles/filedetails/?id=3028740531
- 画像: https://images.steamusercontent.com/ugc/2036244412586495214/E55B7D3C39269FE473992482767F014E255E438A/, https://images.steamusercontent.com/ugc/2036244699117190434/69D432B8CD9C5F46EA7650DA7AFFA9FE283EE60C/
- 要点: ピクセル絵はワープで曲げると崩れるので、前髪・中髪・後ろ髪（細分）に分けて移動量差だけで振り向きを作る。隣接層は輪郭線ごと少し重ね隙間を防ぐ。前髪に予備の輪郭線レイヤーを持たせて極端な角度でもシルエットを保つ。

### 隠れた首・前髪裏を先に描いておく、顔角度は専用ワープで
- 出典: Live2dTree「Live2D Tutorial」
- リンク: https://live2dtree.com/tutorial
- 画像: なし
- 要点: 頭は顔・フェイスライン・左右耳・首に分割。前髪が揺れると見える顔の部分、顔が動くと見える首の隠れ部分を描いておく。角度パラメータはアートに直接付けず顔角度用ワープへ（目の開閉×角度の組合せ爆発を防ぐ）。初心者は変換分割 5×5 か 9×9。

### 物理演算で体を顔に追従させる／体パラメータを複製して顔と体を分離
- 出典: 乾物ひもの / note「こんなことまで出来る！？Live2Dの裏技的物理演算活用法【Live2Dアドカレ2021】」
- リンク: https://note.com/himono_vtuber/n/n9015f0030d53
- 画像: https://assets.st-note.com/production/uploads/images/67523272/picture_pc_30b993b83235c7ae0ceef5c103f1e2d2.gif, https://assets.st-note.com/production/uploads/images/67525884/picture_pc_872c90e7e4561b6df428dc9809dcc4aa.gif
- 要点: 入力=顔の角度、出力=体の角度（種別「角度」、影響度60%）で、体が一瞬大きく動いて戻る生っぽさ。入出力を逆にすると大人っぽい動き。体パラメータを複製して物理入力用とモデリング用に分けると、顔と体を逆方向にも動かせる。
- seed 外

### 首の影を地肌と分け、影ははみ出して大きく描く
- 出典: palkaloid / FREE版Live2D(13)「首に横揺れの設定」（加えて X 投稿の手がかりあり）
- リンク: https://palkaloid.com/574/set-form-neck/
- 画像: https://palkaloid.com/wp-content/uploads/2024/05/0e976fdc316197a71c2c74ade7a4a6af-800x593.png
- 要点: 首影デフォーマは首デフォーマの子にして親より大きくしない。子（影）から先に作ると手戻りが少ない。首は目立たなくても全く動かさないと不自然。首が短い・細いと大きく傾けたとき合わない。

### 描画順の参考値（輪郭490〜510、耳470、眉は髪上820／髪下690 など）
- 出典: 旧 Live2D コミュニティ「【参考】描画順の参考」/ 2018-06 版リスト
- リンク: https://forum.live2d.com/discussion/966/%E5%8F%82%E8%80%83-%E6%8F%8F%E7%94%BB%E9%A0%86%E3%81%AE%E5%8F%82%E8%80%83
- 画像: なし
- 要点: 輪郭系 490〜510、耳 470（輪郭の後ろ）、首影 480、前髪 740、横髪内 720・外 710、後ろ髪 100。眉は髪の上（820）と下（690）で値を分けるなど、髪との前後が変わるパーツは個別値に。
- seed 外（描画順全般）

## X への手がかり
- @himono_vtuber（乾物ひもの、高可動域 顔XY シリーズ著者）: https://x.com/himono_vtuber — note ①②③ で確認。同記事内に担当モデル（@Amemori_Aoba, @Kuroyuri__V 等）とイラストレーター（@meimeikomeimei, @v_loAlo）のリンク。
- @925__niconico（925 クニコ、「頭の中に立体を飼おう」著者、添削受付あり）: https://x.com/925__niconico — note とアドカレ2024 で確認。#Live2Dアドカレ2024
- @daneko_ko（伊糖だねこ）: https://x.com/daneko_ko — note 練習記録⑤⑥
- @saraemiii（さらえみ）: https://x.com/saraemiii — saraemi.com
- @asano_negoto（朝野ねごと）: https://x.com/asano_negoto
- @majo_hope__（マジョホゥプ）: https://twitter.com/majo_hope__
- @obakasahara / @vtuberkaibou（cgbox 管理人）: cgbox.jp 記事末尾。上向き輪郭線記事内で紹介された投稿者 @uron_2L, @taniya001, @2ex_softball, @xsinryux_x（顎下影・顎線消しの例）
- @krt_hiwa（りりっしゅ）、記事内で参考にした @yamada_yuco（山田ゆこ、変形パスで輪郭を動かすポスト）、@1_tuka（一束、ケモ耳の奥行き）: note.lilish.com
- kawase（@kawase1234567）: 「顎ライン素材（正面では見えず上下左右でスライドして見せる）」「線消しマスクで耳と輪郭の線を消す」投稿 https://x.com/kawase1234567/status/1795685278616883359 , https://x.com/kawase1234567/status/1795686542348095636 — 検索結果で見かけた
- とりPRO（@yaseinoToriPro）: 「首は影と地肌を分ける、影は大きめにはみ出して良い」投稿 https://x.com/yaseinoToriPro/status/1381481876410408965 — 検索結果で見かけた
- Fenich（@shyfenich）: 無料 HEAD STUDY FILE（Head Separation Guide / XY Head Angles Guide）https://x.com/shyfenich/status/1763261284403789921 — 検索結果で見かけた
- @atasom: Angle X / Angle Y のリファレンス投稿 https://twitter.com/atasom/status/1426469166416941056 , https://twitter.com/atasom/status/1222612271588769792 — cillia の carrd ポータルで紹介
- @xaconite: 顔と髪のパーツ分け投稿 https://twitter.com/xaconite/status/1440743124993667072 — cillia の carrd ポータルで紹介
- @Live2DJUKU（Live2D 公式 JUKU）: juku 講座ページ
- 備考: kawase の投稿で「首はちょっと長めに描く」「首の影は広めに描くと立体感」という趣旨も検索要約に出ていた（投稿元未確認）。

## 検索記録
- 「Live2D 顔 角度XY コツ」/「Live2D face angle XY tips rigging」/「Live2D 振り向き 立体感 輪郭 作り方」: standard モードは要約中心でリンクが薄い。公式チュートリアル、ポケラボ、cillia、フォーラムが当たった。
- 「Live2D 顔の角度 付け方 ブログ 輪郭 ワープデフォーマ 奥側 縮める」（extended）: ここで乾物ひもの①②③、伊糖だねこ、castcraft、saraemi、unitypull、mayurishindoh が一気に出た。日本語の個人 note・ブログが最も厚い。
- 「Live2D 高可動域 顔 振り向き 描き足し 横顔 差分」: 乾物ひもの、知恵袋、palkaloid。
- 「Live2D head angle rigging tips perspective cheek ear nose」: 英語は YouTube と Gumroad/itch の有料 study file の販売ページばかり。販売ページ（mochibubu, yoshinoart, bepin）は本文が取れずタイトルのみで拾わず。
- 「Live2D Cubism 5.1 3D回転表現」: 公式マニュアルと自動生成の個人感想（k-illust）。
- 「reddit r/Live2D ...」: reddit.com はアクセス不可、ミラーも接続拒否。Reddit は未収集。
- 「Live2D 角度Z 回転デフォーマ 中心 顎 首」: cgbox、geboku、itodaneko⑤、asanonegoto、palkaloid。
- 「CLIP STUDIO TIPS Live2D 顔 角度」: 描き足し一般論（肘裏・髪の隙間）。顔角度固有は薄いので個別メモにせず。
- 「Live2D parallax ...」「パララックス 移動量 逆方向」: Steam ピクセルガイド、トライタム（前方ほど激しい）。
- 「Live2D 头部 XY 知乎 bilibili」: 中国語ソースはヒットせず、代わりに 925 の note を発見。Maoxy の改模講座（目と頭の角度XY研究回）は概要のみで中身なし。
- 「Live2Dアドカレ 顔 角度」: アドカレ2024 一覧を確認（顔角度は 925 の1本のみ）。
- 「Live2D 90 degree head turn」「超高可動域 横顔 90度」: 90° 振り向きの具体手法は無料資料では見つからず（有料講座のみ）。
- 「Live2D 顔XY 失敗 あるある 平面的」: cgbox、クリエイターズフォーラム。
- 「上を向く 首 描き足し 顎の下 影」: cgbox 上向き輪郭記事、X 投稿（kawase, とりPRO）、palkaloid 首。
- 「Live2D 鼻 角度X 鼻先 はみ出す」: りりっしゅ（男性鼻）、フォーラム（鼻固定）。
- YouTube（RF_QupbfiQw 等）は WebFetch で説明文が取れず断念。surume1ka.com、ugoiraman.com は DNS 解決失敗で未取得（surume1ka は「X は横のみ・Y は縦のみ」「上を向かせすぎると首が長く見える」趣旨が検索要約に出ていたが本文未確認）。toolify.ai と Patreon は 403。
- 途中で WebSearch のターン上限（200 回、全エージェント共有）に達したため、以降は既知 URL の WebFetch のみで補った。未着手の検索候補: VRoid/3D 下絵活用、奥の目・まつげの隠れ方、英語圏の個人ブログ（Ko-fi/Tumblr）、Inochi2D など他ツール側の知見。
