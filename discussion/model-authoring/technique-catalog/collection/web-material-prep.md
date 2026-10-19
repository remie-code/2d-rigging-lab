# 集めるメモ（Web）: 素材(PSD)の分け方・パーツ分け

> フェーズ1（集める）の生メモ。原文用語のまま、加工前。調査日: 2026-10-19。

## メモ

### 素材分けPSD と 取り込み用PSD を分けて持つ
- 出典: Live2D 公式マニュアル「About Material Separation（素材分けについて）」
- リンク: https://docs.live2d.com/en/cubism-editor-manual/divide-the-material
- 画像: https://docs.live2d.com/cms/wp-content/uploads/2025/05/AboutMaterialSeparation_05-en.png , https://docs.live2d.com/cms/wp-content/uploads/2025/05/AboutMaterialSeparation_06-en.png
- 要点: フォルダ・レイヤーマスクを残した編集用PSDと、パーツごとに1レイヤーへ統合した取り込み用PSDを別ファイルで管理する。描き足しは編集用側でやるのが後々楽。

### 原画レイヤーに直接描かず、グループ＋新規レイヤー＋レイヤーマスクで切る
- 出典: Live2D 公式マニュアル「About Material Separation」/ castcraft.live（2026-05 更新）/ k-illust.net くうこ（2025-09-28）
- リンク: https://docs.live2d.com/en/cubism-editor-manual/divide-the-material , https://castcraft.live/blog/464/ , https://k-illust.net/l2d-parts/
- 画像: https://docs.live2d.com/cms/wp-content/uploads/2025/05/AboutMaterialSeparation_03-en.png , https://docs.live2d.com/cms/wp-content/uploads/2025/05/AboutMaterialSeparation_04-en.png
- 要点: 原画をコピーしてパーツ名のグループに入れ、マスクで切り抜き、描き足しは原画の下（または上）の新規レイヤーに。マスクなので消しすぎても戻せる。「原画が正義」で最後に原画と見比べる。

### 大きく動く部分・動くと露出する部分から先に描く
- 出典: Live2D 公式マニュアル「About Material Separation」
- リンク: https://docs.live2d.com/en/cubism-editor-manual/divide-the-material
- 画像: https://docs.live2d.com/wp-content/uploads/2019/02/72477dde401ce657b533c429cf0462c8.png
- 要点: 作業順として、大きく動くパーツと「他が動いたときに見えてくるパーツ」を優先して用意する。

### 首は口元（〜鼻先・目の下）まで長く描く
- 出典: Live2D 公式チュートリアル「Illustration Processing」/ ささめた「ささめた式Live2Dパーツ分け指南書」/ 夏水かなた「Live2Dパーツ分け補足」（2023-02-07）/ kawase（X 投稿）
- リンク: https://docs.live2d.com/en/cubism-editor-tutorials/psd/ , https://note.com/sasametaru/n/n990a34a92d02 , https://note.com/kanata_natsumi/n/n7f96b96b6e26 , https://x.com/kawase1234567/status/1827324930872242587
- 画像: https://docs.live2d.com/wp-content/uploads/2017/08/2017-09-01_11h47_27.png , https://assets.st-note.com/img/1665986431184-75d23fsU8A.png?width=1200
- 要点: 顔が動く・上を向くと首の上端が見えて途切れるので、見えている範囲より上まで（公式は口元、ささめたは鼻先、夏水は目の下まで）首を伸ばしておく。塗りだけでなく線も長く。

### 首の影は地肌と別パーツ、はみ出して大きめに
- 出典: とりPRO（X 投稿, 2021）/ ナナメ「パーツ分けのススメ」（2021-04-30）/ ずあき（hu-gsd.com, 2023-12-20）
- リンク: https://x.com/yaseinoToriPro/status/1381481876410408965 , https://note.com/7name/n/nbdd9d5a33287 , https://hu-gsd.com/lecture/how_to_make_live2d_models/
- 画像: https://assets.st-note.com/production/uploads/images/50270642/picture_pc_a1f5cf5eb4a487cb4fec1f59047b52eb.png?width=1200
- 要点: 頭→首の落ち影を地肌と分けると、顔を動かしたとき影の当たり方を変えられ奥行きが出る。首レイヤーでマスクする前提なので影ははみ出して大きく描いてよい。

### 頭部の落ち影（服→腕、頭→首）を独立させる
- 出典: ずあき「Live2Dモデルの作り方(我流)」（hu-gsd.com, 2023-12-20）/ kawase（X）
- リンク: https://hu-gsd.com/lecture/how_to_make_live2d_models/ , https://x.com/kawase1234567/status/1827324930872242587
- 画像: https://hu-gsd.com/wp-content/uploads/2023/12/a03e0e4f7f57a3cdb59a69d5f3c9ffbd-1024x532.png
- 要点: 落ち影を本体に焼き込まず別レイヤーにすると、頭や腕を動かしたとき影が追従・ずれてリアルになる。

### 隠れる部分は描き足さないと動いたとき切れる（基本原則）
- 出典: Live2D 公式チュートリアル「Illustration Processing」/ 一創テックブログ（2025-01-21）/ 西中ニシカのわーくすチャンネル（2021-12-25）
- リンク: https://docs.live2d.com/en/cubism-editor-tutorials/psd/ , https://www.issoh.co.jp/tech/details/4935/ , https://nnwarks.com/live2d_page2/
- 画像: https://docs.live2d.com/wp-content/uploads/2017/08/2017-09-01_11h45_18.png
- 要点: 前髪の下の額、まぶたの下の眼球、口の中など、初期位置で隠れている所も描く。省くと「顔を傾けたら髪の下に何も無かった」手戻りになる。

### 輪郭は髪で隠れる所まで肌色だけで塗る
- 出典: Live2D 公式チュートリアル「Illustration Processing」/ 白い鴉 kitagawatetsuro（2026-09-03）
- リンク: https://docs.live2d.com/en/cubism-editor-tutorials/psd/ , https://shiroikarasu.net/live2d-part-separation-illustrator-guide/
- 画像: https://docs.live2d.com/wp-content/uploads/2017/08/2017-09-01_11h47_05.png
- 要点: 前髪の下の額は見えている範囲より広めに肌で塗っておく。

### 白目は瞳の裏まで、瞳は全円で描く
- 出典: Live2D 公式チュートリアル / ClipStudioOfficial「Live2D用データをCLIP STUDIO PAINTで作る【後編】」/ sugar-cat Scrapbox / 白い鴉
- リンク: https://docs.live2d.com/en/cubism-editor-tutorials/psd/ , https://tips.clip-studio.com/en-us/articles/674?org=1 , https://scrapbox.io/sugar-dev/Live2D%E3%81%A7%E3%81%AF%E3%81%98%E3%82%81%E3%82%8B!%E7%B0%A1%E5%8D%98%E3%81%8B%E3%82%8F%E3%81%84%E3%81%84VTuber_%E3%81%AF%E3%81%98%E3%82%81%E3%81%AE1%E5%86%8A%E3%82%B7%E3%83%AA%E3%83%BC%E3%82%BA , https://shiroikarasu.net/live2d-part-separation-illustrator-guide/
- 画像: なし
- 要点: 目線が動くと瞳の下の白目が見えるので白目は全面塗る（塗っていないと透ける）。まつげで上が隠れる瞳も円として完成させておく。見上げた時に見える白目・まぶたの厚みも描く。

### 瞳は白目からはみ出して描く（クリッピング前提）
- 出典: ゆかり「Vtuber向け Live2d用 パーツ分けPSD作りで気を付けたいこと」（yrfwch.com, 2024-03-31）/ さらえみ（2022-01-13）/ ずあき
- リンク: https://yrfwch.com/how-to/2024/03/live2d_psdmaking-2 , https://saraemi.com/vtuber/2022/01/13/live2d_psd/ , https://hu-gsd.com/lecture/how_to_make_live2d_models/
- 画像: ページ内にあり
- 要点: Live2D 側で白目にクリッピングするので、瞳は白目の範囲を越えて描いておく。クリッピングを使えば片目分の絵で済むという話も。

### 白目の影はクリッピングでなくレイヤーマスクで
- 出典: パルミー「Live2Dのパーツ分けを解説！」（2024-06-14）
- リンク: https://www.palmie.jp/lessons/331
- 画像: https://palmie.s3.ap-northeast-1.amazonaws.com/lesson_articles/renewal/331/12-min.jpg
- 要点: クリッピングは Live2D 側で設定したいことが多いので、ペイントソフト上では白目範囲のマスクで影を塗る。

### まつげを目尻・目頭・二重などに細かく分ける
- 出典: Live2D 公式チュートリアル / パルミー / ささめた / 黒葛原 note（2026-03-04）
- リンク: https://docs.live2d.com/en/cubism-editor-tutorials/psd/ , https://www.palmie.jp/lessons/331 , https://note.com/sasametaru/n/n990a34a92d02 , https://note.com/tsudurahara/n/n14e969d0cc1f
- 画像: https://palmie.s3.ap-northeast-1.amazonaws.com/lesson_articles/renewal/331/10-min.jpg
- 要点: 跳ねる目尻部分とまつげ本体を分けると変形しやすい。パルミーは「メイン・目頭・目尻・二重」、黒葛原は上まつげを片目3分割。目尻の横まつげは瞬き用に必須という声。

### まぶたは「一本の棒」として動かす、飛び出た部分は別パーツ
- 出典: 谷屋楽（お絵かき図鑑「Live2Dのパーツ分けを解説！VTuberイラストの依頼で知っておきたいこと」, 2022-12-30）
- リンク: https://oekaki-zukan.com/articles/44668
- 画像: https://d2hq8z6bbc4zk8.cloudfront.net/wp-content/uploads/2022/12/21182316/3-min-2.jpg
- 要点: まぶたは棒を曲げるイメージで変形させるので、まつげや目尻の跳ねなど棒から飛び出る形は分けておく。重なるパーツは下のパーツに食い込むように塗り足す。

### 瞳孔・虹彩・ハイライトを別パーツ（レンズ奥行き、ハイライトのずらし）
- 出典: sugar-cat Scrapbox / パルミー / Live2D 解剖学 kasahara（2019-01-31）
- リンク: https://scrapbox.io/sugar-dev/Live2D%E3%81%A7%E3%81%AF%E3%81%98%E3%82%81%E3%82%8B!%E7%B0%A1%E5%8D%98%E3%81%8B%E3%82%8F%E3%81%84%E3%81%84VTuber_%E3%81%AF%E3%81%98%E3%82%81%E3%81%AE1%E5%86%8A%E3%82%B7%E3%83%AA%E3%83%BC%E3%82%BA , https://www.palmie.jp/lessons/331 , https://vtuberkaibougaku.site/2019/01/31/post-3424/
- 画像: https://palmie.s3.ap-northeast-1.amazonaws.com/lesson_articles/renewal/331/11-min.jpg
- 要点: 瞳孔は最初から別レイヤーで描く。ハイライトを瞳と違う動きにすると視線移動が自然・レンズの奥行きが出る。ハイライトの合成は「通常」（発光・覆い焼きは見え方が変わる）。

### 目の基本スタック（上から）
- 出典: renoa「Modeling 101: layering the character」（Live2D Creators Forum, 2016-02）
- リンク: https://community.live2d.com/discussion/318/modeling-101-layering-the-character
- 画像: https://us.v-cdn.net/5021645/uploads/editor/vi/asqsm047sqoi.gif , https://us.v-cdn.net/5021645/uploads/editor/cs/kt7t0sypxd2n.jpg
- 要点: 二重線→上まつげ→下まつげ→上まぶた→下まぶた→光→瞳→白目→顔。初心者は単色まぶたで隠す方式、慣れたらマスク方式（まぶたレイヤー不要）。

### 描き目（閉じ・ニッコリ）を別に用意
- 出典: ポケラボ クリエイティブ部（Wantedly, 2019-06-13）
- リンク: https://www.wantedly.com/companies/pokelabo/post_articles/173245
- 画像: https://images.wantedly.com/i/VtmSth5?w=1440 , https://images.wantedly.com/i/de7YigA?w=1440
- 要点: 目を5パーツ（まぶた・上まつげ・下まつげ・眼球・白目）に分けた上で、閉じ目・笑い目の描き目を2つ追加して計7パーツ。

### 口の中は一回り大きく、最大開口に合わせて描く
- 出典: Live2D 公式チュートリアル / 夏水かなた / ずあき / Wikiversity「Vtuber Technology and History」
- リンク: https://docs.live2d.com/en/cubism-editor-tutorials/psd/ , https://note.com/kanata_natsumi/n/n7f96b96b6e26 , https://hu-gsd.com/lecture/how_to_make_live2d_models/ , https://en.wikiversity.org/wiki/Vtuber_Technology_and_History
- 画像: https://docs.live2d.com/wp-content/uploads/2017/08/2017-09-01_11h46_40.png , https://assets.st-note.com/img/1690749929758-FQBASwxYJ8.png?width=1200
- 要点: 口内パーツは元絵より一回り大きく、口を一番開けた状態を基準に作る。口内クリッピング用は単色で塗ると確認しやすい。

### 唇に肌色の縁を付けて口内のはみ出しを隠す（肌色隠し）
- 出典: Live2D 公式チュートリアル / ClipStudioOfficial【前編】/ renoa（Live2D Forum）/ 谷屋楽
- リンク: https://docs.live2d.com/en/cubism-editor-tutorials/psd/ , https://tips.clip-studio.com/ja-jp/articles/578 , https://community.live2d.com/discussion/318/modeling-101-layering-the-character , https://oekaki-zukan.com/articles/44668
- 画像: https://docs.live2d.com/wp-content/uploads/2017/08/2019-05-13_11h32_03.png , https://d2hq8z6bbc4zk8.cloudfront.net/wp-content/uploads/2022/12/21182314/1-min-3.jpg
- 要点: 上唇・下唇は線だけ切り出さず周りに肌を少し残す。公式は動画・変形の少ない絵以外は肌色方式を推奨。マスク方式なら線のキワだけに肌色を乗せる。

### 口マスク・肌色隠しを使わない流派（グルー＋口内クリッピング）
- 出典: ずあき（hu-gsd.com）/ 夏水かなた
- リンク: https://hu-gsd.com/lecture/how_to_make_live2d_models/ , https://note.com/kanata_natsumi/n/n7f96b96b6e26
- 画像: https://hu-gsd.com/wp-content/uploads/2023/12/4a1058bcefd74ec08e6bf4fdff2357d1-1024x459.png
- 要点: 肌で口内を隠すのが主流だが、グルーと口内クリッピングで肌の塗り足し不要にでき、仕上がりがきれいという立場もある。

### 口周りにグラデーションをかけない、頬の赤みは別レイヤー
- 出典: 谷屋楽（お絵かき図鑑, 2022-12-30）
- リンク: https://oekaki-zukan.com/articles/44668
- 画像: https://d2hq8z6bbc4zk8.cloudfront.net/wp-content/uploads/2022/12/21182317/4-min-2.jpg
- 要点: 肌色隠しと干渉するので口周りの肌にはグラデを入れない（輪郭影程度はOK）。頬の赤みが口にかかると不自然なので分ける。前髪の影も可能なら別。

### 口は直線で描く／閉じ口から作る
- 出典: 黒葛原 note（2026-03-04）/ ささめた / r/Live2D の rigger コメント（検索スニペット経由）
- リンク: https://note.com/tsudurahara/n/n14e969d0cc1f , https://note.com/sasametaru/n/n990a34a92d02
- 画像: なし
- 要点: 直線は変形しても崩れにくいので口は一直線で描き、表情は動きで付ける。:3 口は丸さが必要で母音形に向かないので閉口・笑顔用に限るという rigger の声も。舌出し用の舌は元の舌と根元が重なるよう描く。

### 口の分け方バリエーション（上唇/下唇/上歯/下歯/舌/口内）
- 出典: 夏水かなた / 谷屋楽 / ClipStudioOfficial【前編】/ Heystack（BunlynnVT）
- リンク: https://note.com/kanata_natsumi/n/n7f96b96b6e26 , https://oekaki-zukan.com/articles/44668 , https://tips.clip-studio.com/ja-jp/articles/578 , https://heystacks.com/doc/889/making-your-own-2d-vtuber-model
- 画像: https://assets.st-note.com/img/1690749929758-FQBASwxYJ8.png?width=1200
- 要点: 舌と口内を分けると立体感。大きく口を開けた絵を用意すると変形で作りやすい。口の線と塗りを分けると母音で崩れにくい（kasahara）。

### 舌の位置で顔向きの奥行きを出す
- 出典: Live2D 解剖学 kasahara（2019-01-31）
- リンク: https://vtuberkaibougaku.site/2019/01/31/post-3424/
- 画像: なし
- 要点: 顔の向きに合わせて舌の位置をずらすと奥行きが出る。素材段階で舌を独立させておく理由になる。

### 輪郭の内側を塗りつぶさない／輪郭の線と塗りを分ける
- 出典: せみこ「Live2Dのパーツ分け」（note）/ 夏水かなた / ナナメ
- リンク: https://note.com/kamibukuro_0/n/n12d9227a6d56 , https://note.com/kanata_natsumi/n/n7f96b96b6e26 , https://note.com/7name/n/nbdd9d5a33287
- 画像: https://assets.st-note.com/img/1665940043027-yNmDtUtEsU.png?width=1200 , https://assets.st-note.com/production/uploads/images/50269902/picture_pc_4f16c5a041b256070ae5415a39c5af92.png?width=1200
- 要点: 顔の内側に陰影を入れると変形で歪むので縁だけ影を付ける。輪郭は線と塗りを分け、髪の影を間に挟むと輪郭線が覆われない。頬は輪郭からはみ出させる。

### 輪郭を細分化（ベース塗り／前髪の影／頬／生え際／線画／耳）
- 出典: ささめた「ささめた式Live2Dパーツ分け指南書」
- リンク: https://note.com/sasametaru/n/n990a34a92d02
- 画像: ページ内にあり
- 要点: 生え際パーツがあると、髪が揺れたときに地肌が不自然に見えるのを防げる。

### 閉じた輪郭線は固定線になって動くと破綻する
- 出典: 白い鴉 kitagawatetsuro「Live2Dパーツ分けでイラストレーターが気をつける注意点【2026年版】」（2026-09-03）
- リンク: https://shiroikarasu.net/live2d-part-separation-illustrator-guide/
- 画像: なし（base64 埋め込み）
- 要点: パーツ境界を線で閉じず塗りで処理する。境界には「のりしろ」（髪先は体の下へ、肩は腕の付け根の下へ、まぶたは目より少し大きく）。

### 髪は房（毛束）ごとに、隠れる部分も広めに
- 出典: ささめた / ナナメ / パルミー / ClipStudioOfficial（CELSYS × MUGENUP, alive 2019）
- リンク: https://note.com/sasametaru/n/n990a34a92d02 , https://note.com/7name/n/nbdd9d5a33287 , https://www.palmie.jp/lessons/331 , https://tips.clip-studio.com/en-us/articles/2684
- 画像: https://palmie.s3.ap-northeast-1.amazonaws.com/lesson_articles/renewal/331/03-min.jpg , https://assets.st-note.com/production/uploads/images/50219718/picture_pc_0b38307b6e1ed7498e55bc1923033054.gif?width=1200
- 要点: 揺れ・横向きで描画範囲が足りなくなるので、下に重なる毛束を広めに描く（中央の束が揺れても空白が見えない）。毛束ごとに分けると一塊に見えず自然に揺れる。

### 髪の層は「中間層を一番広く」、back-middle パーツを足す
- 出典: @MikazukiBlue のスレッド（Thread Reader, 2021-11-05）
- リンク: https://threadreaderapp.com/thread/1456767987873161216.html
- 画像: https://pbs.twimg.com/media/FDd3p0SWQAIoHOJ.jpg , https://pbs.twimg.com/media/FDd325SXEAMNcjJ.jpg , https://pbs.twimg.com/media/FDdzeNqXoAAE2Bo.jpg , https://pbs.twimg.com/media/FDd0iBhXMAQgt1C.jpg , https://pbs.twimg.com/media/FDd1pAaXoAIwdhz.jpg
- 要点: 前・横・後ろの3分割だけだと振り向きで中間が引き伸ばされる。頭を球として真上から考え、前→後ろに並べたとき真ん中の層が最も幅広になるよう分け、45度などで出る隙間を埋めるフィラーを最初から作る。上下角度でも同じ（ツンツン髪・毛皮で特に）。

### 横髪と後ろ髪の間に髪束を挟む
- 出典: ささめた
- リンク: https://note.com/sasametaru/n/n990a34a92d02
- 画像: ページ内にあり
- 要点: 間に束を一枚入れると横顔（振り向き）時の違和感が減る。上の MikazukiBlue の中間層と同系統。

### 横髪の縁は正面から見た書き込みにしておく
- 出典: ゆかり（yrfwch.com, 2024-03-31）
- リンク: https://yrfwch.com/how-to/2024/03/live2d_psdmaking-2
- 画像: ページ内にあり
- 要点: 後ろ髪の塗りパーツを作り、横髪の縁を正面視の描き込みにしておくと、顔を左右に振ったときにそのまま横髪として使える。

### 後頭部（頭頂・つむじ）を描き込む
- 出典: ナナメ / 谷屋楽 / ささめた / 夏水かなた
- リンク: https://note.com/7name/n/nbdd9d5a33287 , https://oekaki-zukan.com/articles/44668 , https://note.com/sasametaru/n/n990a34a92d02 , https://note.com/kanata_natsumi/n/n7f96b96b6e26
- 画像: https://assets.st-note.com/img/1665986911308-6sFM86IHXZ.png?width=1200
- 要点: 頭を下げると後頭部が見えるので塗り込んでおく。つむじ・結び目は後ろ髪の塗りにクリッピング。つむじを乗算にするか、通常にするならその部分の髪を線と塗りに分ける。

### 後ろ髪は首を傾けても体からはみ出さない余白を
- 出典: 白い鴉 kitagawatetsuro（2026-09-03）
- リンク: https://shiroikarasu.net/live2d-part-separation-illustrator-guide/
- 画像: なし
- 要点: 首を傾けた時に後ろ髪が体の外へ不自然に出ないよう、後ろ髪側に余裕（体の下に潜る分）を持たせる。

### 髪の表と根元を別レイヤーに
- 出典: 谷屋楽（お絵かき図鑑）
- リンク: https://oekaki-zukan.com/articles/44668
- 画像: https://d2hq8z6bbc4zk8.cloudfront.net/wp-content/uploads/2022/12/21182315/2-min-3.jpg
- 要点: 重なるパーツは全部分け、表面と根元も分ける。モデラーに任せると塗り足し作業が発生する。

### 髪の落ち影は髪束ごとに分ける
- 出典: 夏水かなた / Live2D 解剖学 kasahara / Yahoo!知恵袋 q10295315515（2024-03-21）/ ClipStudioOfficial（alive 2019）
- リンク: https://note.com/kanata_natsumi/n/n7f96b96b6e26 , https://vtuberkaibougaku.site/2019/01/31/post-3424/ , https://detail.chiebukuro.yahoo.co.jp/qa/question_detail/q10295315515 , https://tips.clip-studio.com/en-us/articles/2684
- 画像: https://assets.st-note.com/img/1665984650116-eWAtE9lPx7.png?width=1200
- 要点: 束を別々に揺らすなら影も束単位で分けないと影と髪がずれる（前髪1パーツなら影も1パーツ）。影を肌にクリッピングすれば輪郭外にはみ出さない。髪と少し違う動きをさせると立体感。肌側に描くか髪側に描くかは意見が割れる。

### 影は「通常」で描く（乗算は重なりで濃くなる）
- 出典: ClipStudioOfficial（alive 2019）/ ナナメ / Yahoo!知恵袋 q14267235169
- リンク: https://tips.clip-studio.com/en-us/articles/2684 , https://note.com/7name/n/nbdd9d5a33287 , https://detail.chiebukuro.yahoo.co.jp/qa/question_detail/q14267235169
- 画像: なし
- 要点: 影パーツを分けて動かすと乗算では重なった所が濃くなるので、見えている影色のまま通常モードで描き足す。逆に付属品の落ち影は乗算レイヤーに分けるという流派（パルミー）もある。

### 落ち影は輪郭より一回り大きく塗り足す
- 出典: ClipStudioOfficial（alive 2019）/ 夏水かなた / finnleton「Live2Dイラスト #1 3D効果の作成」（CLIP STUDIO TIPS）
- リンク: https://tips.clip-studio.com/en-us/articles/2684 , https://note.com/kanata_natsumi/n/n7f96b96b6e26 , https://tips.clip-studio.com/ja-jp/articles/17278
- 画像: https://assets.st-note.com/img/1666544082511-BWpgLI7oGf.png?width=1200
- 要点: Live2D 側でクリッピングするので影ははみ出してよい。finnleton は塗りの選択範囲を約100px拡張して影レイヤーを作り、3D 効果を出しやすくする。

### 線画を塗りの下に置く（交差時の重なり回避）
- 出典: finnleton（CLIP STUDIO TIPS「Live2Dイラスト #1」）/ めぃまぁ「綺麗なLive2Dの髪を作る技術」（2021-07-16）
- リンク: https://tips.clip-studio.com/ja-jp/articles/17278 , https://note.com/memoryview/n/n4c8f9913b301
- 画像: https://assets.st-note.com/production/uploads/images/56893222/picture_pc_0b03c2d0255d24dcaefa4a0f87ceaea7.jpg?width=1200
- 要点: パーツ同士が交差したとき線が変に重ならないよう線と塗りを分け描画順を工夫する。めぃまぁは逆に「色を線より前に出すと塗りが線を汚す」と注意。

### アンチエイリアス線は塗りとの間に隙間ができる → 線を太く
- 出典: めぃまぁ（note, 2021-07-16）
- リンク: https://note.com/memoryview/n/n4c8f9913b301
- 画像: https://assets.st-note.com/production/uploads/images/56896825/picture_pc_88d7829703ab0bb0d5dff617f7fe7137.png?width=1200 , https://assets.st-note.com/production/uploads/images/56897082/picture_pc_81ee7025fc198042ddce354428c76f42.png?width=1200
- 要点: 二値線なら色レイヤーを線部分でトリミングできるが、AA 付き線だと隙間が出るので線を太くしてボケを無くす。色と線を同形メッシュにすると完全に同じ動きになる（seed 外寄り）。

### 線画と塗りを分ける／統合する問題
- 出典: ClipStudioOfficial（alive 2019）/ Live2D 公式チュートリアル / ナナメ
- リンク: https://tips.clip-studio.com/en-us/articles/2684 , https://docs.live2d.com/en/cubism-editor-tutorials/psd/ , https://note.com/7name/n/nbdd9d5a33287
- 画像: https://docs.live2d.com/wp-content/uploads/2017/08/2017-09-01_11h49_51.png
- 要点: 動く可能性のある部位は描く段階で線と塗りを分けておく。一方で取り込み時は各パーツ1レイヤーへ統合が必要（公式）。モデラーによって線/塗り別納品を希望する場合あり。

### 襟裏・袖の内側・フード内側など「裏面パーツ」を線と塗り両方で
- 出典: 夏水かなた / 西中ニシカのわーくすチャンネル / 白い鴉 / ゆかり
- リンク: https://note.com/kanata_natsumi/n/n7f96b96b6e26 , https://nnwarks.com/live2d_page2/ , https://shiroikarasu.net/live2d-part-separation-illustrator-guide/ , https://yrfwch.com/how-to/2024/03/live2d_psdmaking-2
- 画像: https://assets.st-note.com/img/1665979014939-yK96AyNE0b.png?width=1200 , https://assets.st-note.com/img/1665979014980-wyXlVt9EmZ.png?width=1200
- 要点: 首が動くと襟裏が見えるので、首の奥・首の手前の位置に襟裏を置く。襟と首の間の隙間、脇、袖の中に続く腕も描いておく。

### 首の前後位置は肩回りと襟裏の間（レイヤー順で苦労しやすい）
- 出典: 西中ニシカのわーくすチャンネル（2021-12-25）
- リンク: https://nnwarks.com/live2d_page2/
- 画像: なし
- 要点: 手前から 前髪・眉→顔パーツ→横髪→肩回り→首→襟裏などの服→腕→腕より後ろの服→後ろ髪。肩回りは腕の付け根と首の根元を隠す要パーツ。

### スカート・マントは表と裏（前面と背面）を分ける
- 出典: ClipStudioOfficial【後編】/ ゆかり / 一部のまとめ（検索結果）
- リンク: https://tips.clip-studio.com/en-us/articles/674?org=1 , https://yrfwch.com/how-to/2024/03/live2d_psdmaking-2
- 画像: なし
- 要点: 一枚だと動かしたとき他パーツを突き抜ける。前後で脚を挟むように分け、裏側まで描くと裏が見える揺れも作れる。

### 模様は生地の外まではみ出して描く
- 出典: ゆかり（yrfwch.com）/ せみこ（note）/ ささめた
- リンク: https://yrfwch.com/how-to/2024/03/live2d_psdmaking-2 , https://note.com/kamibukuro_0/n/n12d9227a6d56 , https://note.com/sasametaru/n/n990a34a92d02
- 画像: なし
- 要点: 裾・タイツ・入れ墨などの柄は線・柄・塗りを分け、塗りにクリッピングする前提で範囲より長めに描く。回転時に既存の柄を引き伸ばさず「見えていなかった部分」として出せる。

### 関節部はシンプルなデザインに、網タイツ・チェック・半透明は避ける
- 出典: ClipStudioOfficial「Live2Dでイラストを動かそう！」（MUGENUP 解説, alive 2019）
- リンク: https://tips.clip-studio.com/en-us/articles/2684
- 画像: なし（ページ内図版の直接 URL は取れず）
- 要点: 衣装はパーツ設計を前提にデザインする。関節に柄や重なる半透明素材があると破綻しやすい。リボン等を継ぎ目に重ねると違和感が目立たない。

### 揺れもの（鎖・紐）は真っ直ぐに描く
- 出典: ClipStudioOfficial（alive 2019）
- リンク: https://tips.clip-studio.com/en-us/articles/2684
- 画像: なし
- 要点: 最初から曲がった形は Live2D で伸ばしにくいので、まっすぐ描いて動きで曲げる。

### 腕は上腕・前腕・手、肘の内側を描き足す。関節は丸く
- 出典: Live2D 公式チュートリアル / ClipStudioOfficial【後編】/ ささめた / 黒葛原
- リンク: https://docs.live2d.com/en/cubism-editor-tutorials/psd/ , https://tips.clip-studio.com/en-us/articles/674?org=1 , https://note.com/sasametaru/n/n990a34a92d02 , https://note.com/tsudurahara/n/n14e969d0cc1f
- 画像: https://docs.live2d.com/wp-content/uploads/2017/08/2017-09-01_11h49_11.png
- 要点: 前腕が伸びるために肘の内側を描き足す。ささめたは関節を丸く、黒葛原は実験的に直線カット。肘周りの切り方はモデラーで違うので相談（谷屋楽）。

### 胴体を胸・胴・脇に分け、脇と胴で腕を挟む
- 出典: ささめた
- リンク: https://note.com/sasametaru/n/n990a34a92d02
- 画像: ページ内にあり
- 要点: 腕を脇パーツと胴パーツで挟む構成にすると、体が横を向いたときに立体感が出る。

### 脚は「塗り・線画・膝」が最低限、スカートの影は1パーツ
- 出典: ささめた
- リンク: https://note.com/sasametaru/n/n990a34a92d02
- 画像: ページ内にあり
- 要点: スカートの影を左右の脚用に2分割しなくてよい（Live2D でクリッピング先は任意に選べる）。太ももの影がはっきりしていれば別に。

### 指を関節ごとに分ける / 開き手・握り手の差分
- 出典: kasahara「握りこぶしの作り方」（cgbox.jp, 2020-05-11）/ HappyElements 太田垣諒（alive 2015, gamebiz 2015-07-01）
- リンク: https://cgbox.jp/2020/05/11/live2d-hand-nigiru/ , https://gamebiz.jp/news/145843
- 画像: なし
- 要点: 握る動作には指を第一〜第三関節まで分け、隠れる部分も描き、関節位置を黒線で描き込む。手間を省くなら複数の手パーツを切り替える。

### 腕差分は必要数だけ（差分ごとに再セットアップが要る）
- 出典: ポケラボ（Wantedly, 2019-06-13）/ HappyElements（alive 2015）
- リンク: https://www.wantedly.com/companies/pokelabo/post_articles/173245 , https://gamebiz.jp/news/145843
- 画像: https://images.wantedly.com/i/z6Xzay4?w=1440
- 要点: 腕組み・バンザイなどは腕パーツ切替で作るが、差分ごとに同じ上腕を再セットアップするので数を絞る。

### 変形量の大きい部位は「変形しやすいテクスチャ」を用意（着物の袖を三角形で）
- 出典: HappyElements 太田垣諒（alive 2015, gamebiz）
- リンク: https://gamebiz.jp/news/145843
- 画像: なし
- 要点: 肘は変形しやすい形のテクスチャを用意して Modeler 上で肘の形にする。着物の袖は三角形のテクスチャをポリゴンの割り方で袖形に再構成。見た目どおりに描かない発想。
- seed 外（テクスチャ設計寄り）

### 立体的で複雑なパーツは正面と側面に分ける
- 出典: ポケラボ（Wantedly, 2019-06-13）
- リンク: https://www.wantedly.com/companies/pokelabo/post_articles/173245
- 画像: https://images.wantedly.com/i/LThuoPC?w=1440
- 要点: 正面面と側面を別パーツにしておくと後で角度調整しやすい。Live2D はワープ中心なので回転の破綻は気にしすぎなくてよい。

### 丸い頭は立体的に見え、動きを付けやすい
- 出典: Live2D 公式チュートリアル「Illustration Processing」
- リンク: https://docs.live2d.com/en/cubism-editor-tutorials/psd/
- 画像: なし
- 要点: 描く段階で頭の形を丸く取っておくと立体感・動かしやすさが上がる。髪を後で調整するなら最初から描き足しを大きめに。

### 前髪を顔パーツより先に分ける
- 出典: ClipStudioOfficial（alive 2019）
- リンク: https://tips.clip-studio.com/en-us/articles/2684
- 画像: なし
- 要点: 輪郭は髪に隠れていることが多いので髪を先に切り出す。アホ毛2本は独立、前の方は描き足し不要・後ろの方は要描き足し。耳上を塗り足して頬から髪が生えて見えるのを防ぐ。髪留めが頭に密着していれば分ける。

### 耳は描き足し、もみあげの下の耳も
- 出典: ClipStudioOfficial（alive 2019）/ 黒葛原
- リンク: https://tips.clip-studio.com/en-us/articles/2684 , https://note.com/tsudurahara/n/n14e969d0cc1f
- 画像: なし
- 要点: もみあげで隠れた耳を描き足す。黒葛原は耳の内側だけ動かす予定でパーツ化。

### ボタンを1個ずつ、フリルを分ける
- 出典: 黒葛原 note / せみこ note
- リンク: https://note.com/tsudurahara/n/n14e969d0cc1f , https://note.com/kamibukuro_0/n/n12d9227a6d56
- 画像: なし
- 要点: ジャケットのボタンは個別パーツ、シャツのフリルは少し揺らすため分ける。異なる生地は別パーツ。

### 左右対称パーツでも左右別々に（ジャケット・襟）
- 出典: Live2D 解剖学 kasahara（2019-01-31）
- リンク: https://vtuberkaibougaku.site/2019/01/31/post-3424/
- 画像: なし
- 要点: 襟やジャケットを1パーツにすると顔・体を左右に向けたとき歪む。左右に分割しておく。

### 中心線をキャンバス中央に、偶数サイズ、対称定規
- 出典: せみこ / ささめた / ゆかり / Heystack（BunlynnVT）/ k-illust くうこ / CLIP STUDIO ASSETS「レイヤーを左右に分割」
- リンク: https://note.com/kamibukuro_0/n/n12d9227a6d56 , https://note.com/sasametaru/n/n990a34a92d02 , https://yrfwch.com/how-to/2024/03/live2d_psdmaking-2 , https://heystacks.com/doc/889/making-your-own-2d-vtuber-model , https://k-illust.net/l2d-parts/ , https://assets.clip-studio.com/en-us/detail?id=2104503
- 画像: なし
- 要点: 正面対称モデルは中心線を厳密にキャンバス中央へ合わせ、対称定規で描く（モデラーが正確に反転できる）。左右分割オートアクションのため横ピクセル偶数。左右の分離は対称で描き終えた最終段階で。

### キャンバスサイズの目安（縦5000〜8000px、10000超は不具合）
- 出典: せみこ / ささめた / さらえみ / ゆかり / Heystack
- リンク: https://note.com/kamibukuro_0/n/n12d9227a6d56 , https://note.com/sasametaru/n/n990a34a92d02 , https://saraemi.com/vtuber/2022/01/13/live2d_psd/ , https://yrfwch.com/how-to/2024/03/live2d_psdmaking-2 , https://heystacks.com/doc/889/making-your-own-2d-vtuber-model
- 画像: なし
- 要点: アップに耐えるなら縦5000〜8000px程度、ささめたは横4000〜6000×縦6000〜8000。10000px超で不具合の可能性。1920×1080 に顔を置いて見え方を試す。

### 合成モードは通常・乗算・加算のみ
- 出典: Live2D 公式「Notes on PSD creation」/ ささめた / 夏水かなた / Heystack / sugar-cat Scrapbox
- リンク: https://docs.live2d.com/en/cubism-editor-manual/precautions-for-psd-data/ , https://note.com/sasametaru/n/n990a34a92d02
- 画像: なし
- 要点: Cubism の合成リストに無いモードは通常として読まれ、VTube Studio 等も3種しか対応しない。

### PSD のカラー設定（RGB・8bit・sRGB へ「変換」）、塗り（Fill）は100%扱い
- 出典: Live2D 公式「Notes on PSD creation」/ ゆかり / Live2D 解剖学 kasahara
- リンク: https://docs.live2d.com/en/cubism-editor-manual/precautions-for-psd-data/ , https://yrfwch.com/how-to/2024/03/live2d_psdmaking-2 , https://vtuberkaibougaku.site/2019/01/31/post-3424/
- 画像: https://docs.live2d.com/cms/wp-content/uploads/2025/10/NotesOnPSDCreation_01-en.png
- 要点: CMYK・グレースケール・16bit 以上は不可。sRGB はプロファイル指定でなく変換。Photoshop の「塗り」は100%として読まれるので、頬染め等の薄さは不透明度で。パス情報は統合前に削除。

### ArtMesh 端に線が出る → 端をぼかす
- 出典: Live2D 公式「Notes on PSD creation」
- リンク: https://docs.live2d.com/en/cubism-editor-manual/precautions-for-psd-data/
- 画像: https://docs.live2d.com/wp-content/uploads/2021/12/2021-12-14_19h06_45.png
- 要点: トラッキングソフトでアートメッシュの縁に線が見える場合は、素材の縁をぼかしておく。

### 半透明のゴミピクセルは RGBA(0,0,0,0) まで消す
- 出典: Live2D Creators Forum「Live2D Modeller Import PSD Bug」（Archeia / Live2D スタッフ, 2016-08）/ k-illust くうこ / castcraft
- リンク: https://community.live2d.com/discussion/comment/1073 , https://k-illust.net/l2d-parts/ , https://castcraft.live/blog/464/
- 画像: なし
- 要点: ほぼ透明でも RGB が黒でない画素は不透明扱いされ、余分な drawable やアトラスの巨大バウンディングボックスを生む。境界効果や色付き背景でゴミを探す。

### はみだしの扱い（離れたゴミは消せるが線に重なるものはイラスト側で）
- 出典: ゆかり（yrfwch.com）
- リンク: https://yrfwch.com/how-to/2024/03/live2d_psdmaking-2
- 画像: なし
- 要点: 離れた位置のはみだしはメッシュを掛けなければ消えるが、線に接するはみだしはイラストで修正が要る。

### レイヤー名の規則（一意、左右はキャラ視点、矢印・接頭辞・階層名）
- 出典: ナナメ / ささめた / 夏水かなた / ずあき / パルミー / Heystack / renoa / 公式
- リンク: https://note.com/7name/n/nbdd9d5a33287 , https://note.com/sasametaru/n/n990a34a92d02 , https://note.com/kanata_natsumi/n/n7f96b96b6e26 , https://hu-gsd.com/lecture/how_to_make_live2d_models/ , https://www.palmie.jp/lessons/331
- 画像: https://palmie.s3.ap-northeast-1.amazonaws.com/lesson_articles/renewal/331/05-min.jpg , https://hu-gsd.com/wp-content/uploads/2023/12/2627dfa745ea4d7d4884c386a6d02f13-1024x545.png
- 要点: 名前は重複させない（取り込みエラー回避）。左右はキャラ自身から見て。「瞳←/瞳→」「顔_目_眼球_左」「前髪_サイド_最上」「bellshine_add」など流派色々。英字にすると言語問題を避けられる（GAMP は日本語名が文字化け）。

### クリッピング・合成モードをレイヤー名に記号で残す
- 出典: せみこ / ゆかり
- リンク: https://note.com/kamibukuro_0/n/n12d9227a6d56 , https://yrfwch.com/how-to/2024/03/live2d_psdmaking-2
- 画像: なし
- 要点: ペイントソフトのクリッピングは Live2D に引き継がれないので「●」「【c】」（連続は【c-】【-c】）、「【加算】」などで名前に印を付ける。フォルダにはクリッピングできず、マスク用途とクリッピングは併用不可。

### 統合しないフォルダに「*」（Live2D_Preprocess スクリプト）
- 出典: ナナメ / さらえみ / Live2D 公式チュートリアル
- リンク: https://note.com/7name/n/nbdd9d5a33287 , https://saraemi.com/vtuber/2022/01/13/live2d_psd/ , https://docs.live2d.com/en/cubism-editor-manual/script-download/
- 画像: なし
- 要点: Photoshop の公式統合スクリプトでグループを一括統合する際、統合したくないフォルダ名に * を付ける。統合前後の両方を保存。

### 完成一枚絵を最上段に置く・確認用画像を共有
- 出典: 夏水かなた / ゆかり / せみこ
- リンク: https://note.com/kanata_natsumi/n/n7f96b96b6e26 , https://yrfwch.com/how-to/2024/03/live2d_psdmaking-2 , https://note.com/kamibukuro_0/n/n12d9227a6d56
- 画像: なし
- 要点: 完成形の1枚絵を PSD 最上部に、差分込みの書き出しイメージ（jpg/png）も渡すとクリッピングや色味のトラブルが減る。

### 新衣装では変更パーツに【変更】印、変更なしは1レイヤーに
- 出典: 夏水かなた（note, 2023-02-07）
- リンク: https://note.com/kanata_natsumi/n/n7f96b96b6e26
- 画像: なし
- 要点: 衣装追加時に差分管理しやすくする命名運用。差分パーツは「○○_差分」か差分フォルダへ。
- seed 外（運用寄り）

### 修正 PSD を後から「差し替え」読み込みできる
- 出典: さらえみ（2022-01-13）
- リンク: https://saraemi.com/vtuber/2022/01/13/live2d_psd/
- 画像: なし
- 要点: モデリング後でも修正・追加した PSD を読み込み「差し替え」で反映・新パーツ追加できる。パーツ分けは完璧でなくてよい（夜八さんも「後で直すことがある」, GameBusiness alive 2022）。
- 関連: https://www.gamebusiness.jp/article/2023/01/03/21196.html

### 分けすぎの方が分けなさすぎよりマシ（後から分けるのは大変）
- 出典: 黒葛原 note / Live2D 解剖学 kasahara / Live2D 公式
- リンク: https://note.com/tsudurahara/n/n14e969d0cc1f , https://vtuberkaibougaku.site/2019/01/31/post-3424/
- 画像: なし
- 要点: 統合は簡単だが後から分けるのは大変なので描く段階では細かめ。ただし分けすぎはモデリング工数とパーツ上限（FREE版100アートメッシュ等）に響く。

### 「重なっている部位だけ分ける」を基本にする
- 出典: 谷屋楽（お絵かき図鑑）
- リンク: https://oekaki-zukan.com/articles/44668
- 画像: https://d2hq8z6bbc4zk8.cloudfront.net/wp-content/uploads/2022/12/21182312/0-min.jpg
- 要点: 絵描きが全部やらなくても分からない所はモデラーが分割する。斜め横向きの輪郭・母音口・表情はラフがあれば再現してもらえる。

### 線画の段階で明確な別部位を分けておく
- 出典: パルミー / castcraft / Heystack
- リンク: https://www.palmie.jp/lessons/331 , https://castcraft.live/blog/464/ , https://heystacks.com/doc/889/making-your-own-2d-vtuber-model
- 画像: https://palmie.s3.ap-northeast-1.amazonaws.com/lesson_articles/renewal/331/06-min.jpg , https://palmie.s3.ap-northeast-1.amazonaws.com/lesson_articles/renewal/331/07-min.jpg
- 要点: 最初は大まかに線画と塗り、前髪・輪郭・左右の耳・後ろ髪などは線画時点で分割。各パーツは「線画＋下塗り」を1フォルダに。

### 制作スタイル別の分け方（最初から分けて描く／描いてから切る／一枚で描きつつ分ける）
- 出典: YouTube「vtuber model separation guide !【techniques & breakdown】」（youtube-transcript.ai の書き起こし）
- リンク: https://youtube-transcript.ai/docs/vtuber-model-separation-guide-techniques-breakdown-1 （元動画 https://www.youtube.com/watch?v=WGpvSTThQUU ）
- 画像: なし
- 要点: 厚塗り系は一枚で描いて光・色の馴染みを保ちつつ後で投げ縄で切り、縁を整える。いずれの場合も可視範囲を越えて描き込み、陰影まで付ける。

### underfill（素体の下塗り）方式・裸の素体を残す
- 出典: Heystack「Making Your Own 2D VTuber Model」（BunlynnVT のワークフロー）/ bepin（Gumroad 商品説明）
- リンク: https://heystacks.com/doc/889/making-your-own-2d-vtuber-model , https://bepin.gumroad.com/l/boyvtuber
- 画像: なし
- 要点: 服の下に素体（裸のベース）を残しておくと衣装替えが容易。髪の下の頭皮・スカートの下の脚も全部描く（紙人形の発想）。underfill 層は統合しない。

### 付属品の落ち影は本体に描かず乗算レイヤーへ
- 出典: パルミー（2024-06-14）
- リンク: https://www.palmie.jp/lessons/331
- 画像: https://palmie.s3.ap-northeast-1.amazonaws.com/lesson_articles/renewal/331/04-min.jpg
- 要点: バンダナ・ヘッドホン・パーカーなど可動部にかかる影は、付属品が動いても追従できるよう独立させる。

### 左右反転コピーはフォルダごと
- 出典: ポケラボ（Wantedly, 2019-06-13）
- リンク: https://www.wantedly.com/companies/pokelabo/post_articles/173245
- 画像: https://images.wantedly.com/i/yeKv6RF?w=1440
- 要点: 個別にコピーするとグルーが正しく動かず元位置へ引っ張られる。Editor 側の話だが、片側だけ描いて反転させる素材設計の前提になる。
- seed 外（Editor 操作寄り）

### フード用マスク画像を用意して中身を隠す
- 出典: 星詠れい「衣類のパーツ分けとモデリングの手法参考事例」（game.deaf-ray.com, 2024-06-23）※事例元は ののん。(@nonon_yuno)
- リンク: https://game.deaf-ray.com/live2d-model-expression-clothing/
- 画像: なし
- 要点: フード形のマスク専用画像を作り、被った時は中のパーツを隠し、外した時はマスクを拡大して見せる。見えない「マスク専用素材」を PSD に入れておく発想。
- seed 外寄り

### AI 補助：素材分けPhotoshopプラグイン（切り抜き・塗りつぶし・塗り広げ）
- 出典: Live2D 公式（X 告知 2024-03〜, 正式版 2025-10-28 PR TIMES）/ MoguLive
- リンク: https://www.moguravr.com/live2d-cubism-5-material-separation-photoshop-plugin/ , https://prtimes.jp/main/html/rd/p/000000130.000024818.html
- 画像: なし
- 要点: 選択範囲周囲から新規レイヤーの色・アルファを推論して隠れ部分を半自動で塗り広げる。PRO 必須。手での仕上げはなお必要という声。
- seed 外（ツール）

### 自動レイヤー分解研究（See-through / Qwen-Image-Layered）
- 出典: lilting.ch
- リンク: https://lilting.ch/articles/see-through-anime-layer-decomposition , https://lilting.ch/en/articles/qwen-image-layered-live2d-face-parts
- 画像: なし
- 要点: 一枚絵を前髪・後ろ髪・顔・服などの意味レイヤーに分解し、髪の裏の頭や服の下の体をインペイント補完する研究・試行。
- seed 外（ツール/研究）

### 一枚絵からのパーツ分けは高くつく
- 出典: r/Live2D コメント（検索スニペット経由, 2023-01）/ ClipStudioOfficial
- リンク: https://nyc1.lr.ggtyler.dev/r/Live2D/comments/10nu9zp/separation_for_a_model/j6azbmh/?context=3 （本文取得不可）
- 画像: なし
- 要点: 平坦な PNG を分けてもらう費用は最初から分けて描いたモデルとほぼ同じ（欠けを描き直すため）。最初から動かす前提で描く方が得。

## X への手がかり
- @taniya001（谷屋楽 / Live2Dモデラー）パーツ分け図解: https://twitter.com/taniya001/status/1269289840136171520 , https://twitter.com/taniya001/status/1269290266260672513 （お絵かき図鑑記事で引用）
- @yaseinoToriPro（とりPRO）首の影と地肌を分ける話: https://x.com/yaseinoToriPro/status/1381481876410408965 （検索結果）
- @kawase1234567（kawase / イラストレーター＆Live2Dモデラー）首と頭部のパーツ分け: https://x.com/kawase1234567/status/1827324930872242587 （検索結果）
- @MikazukiBlue 髪レイヤリングのスレッド（2021-11-05）: 元ツイート ID 1456767987873161216（Thread Reader で閲覧）
- @naphiria 口のパーツ分けガイド: https://x.com/naphiria/status/1764770449097957557 （Heystack ガイドで紹介）
- @__himey 髪ガイド: https://twitter.com/__himey/status/1302233959544233984 （Heystack）
- @HamuAria 髪ガイド: https://twitter.com/HamuAria/status/1395001595109195783 （Heystack）
- @shyfenich 頭部ガイド: https://x.com/shyfenich/status/1763261437143548221 （Heystack）
- Roxoah（ko-fi で体・顔のレイヤリングガイド配布: https://ko-fi.com/s/0d1042a5f3 , https://ko-fi.com/s/11da3f7dc8 ）（Heystack）
- @7name_（ナナメ）note「パーツ分けのススメ」著者
- @kanata_natsumi（夏水かなた）
- @memoryview（めぃまぁ）
- @saraemiii（さらえみ）
- @yrfw_ch（ゆかり）
- @Zuaki_（ずあき）
- @obakasahara（kasahara / Live2D 解剖学）
- @HoshiyomiRay（星詠れい）、記事内で @nonon_yuno（ののん。）、@handmadesiyouzu（もめん）の衣装事例が紹介
- @373lim_jj（라이브투디 / 韓国のパーツ分け専業）
- @palmie_oekaki（パルミー公式）
- @Live2D 公式（素材分けプラグイン告知: https://x.com/Live2D/status/1820746930588443080 ほか）
- ささめた（@sasametaru と思われるが未確認）、せみこ（note: kamibukuro_0、X 未確認）

## 検索記録
- 「Live2D パーツ分け コツ」「Live2D 素材 描き足し 隠れる部分」「Live2D パーツ分け 首 描き足し 上を向く」: 標準検索だとココナラ・ランサーズ等の制作代行販売ページばかりで実質ゼロ。拾わず。
- 「Live2D PSD layer separation tips」: 公式 docs（素材分け・Illustration Processing・PSD注意点）、CLIP STUDIO TIPS、Live2D フォーラム。
- 「Live2D パーツ分け 注意点 note」: sugar-cat Scrapbox 経由で note（ナナメ、せみこ）を発見。GameBusiness の alive 2022 記事は具体技法薄め。
- 「Live2D art rigging-ready tips mistakes reddit」「Faf Live2D commission guide」: Reddit は redlib ミラー経由のスニペットのみ、本文取得は接続拒否。Faf のガイドは見つからず。Google Docs の共有ガイドは 400 で読めず。
- 拡張検索（extended）に切り替えると個人ブログ・note が大量に出てきた: 「pixiv Live2D パーツ分け 講座 描き足し 解説」→パルミー、CLIP STUDIO TIPS 前後編、nnwarks、k-illust、黒葛原。「Live2D 首 パーツ分け 顎下 影 上向き」→ X 投稿2件、お絵かき図鑑（谷屋楽）、saraemi、hu-gsd。「Live2D 服 パーツ分け スカート 裏地」→ yrfwch、deaf-ray、せみこ。「Live2D 厚塗り パーツ分け 影」→ 知恵袋、finnleton、白い鴉。「live2d hair layering guide」→ ささめた、夏水かなた、めぃまぁ、MikazukiBlue スレッド、Live2D フォーラム。
- 「vtuber model art tips for riggers extend skin under hair」: Heystack ガイド（X への手がかり多数）、Wikiversity、Steam の Pixel-artists' Guide（429 で読めず）、toolify（403）。
- 「Live2D 素材分けPhotoshopプラグイン」: 公式 X、MoguLive、PR TIMES。
- 「Live2D パーツ分け 手 差分 指」: cgbox（kasahara）、Live2D 解剖学。
- 「Live2D 鼻 頬 パーツ 角度」は検索予算切れで実施できず（鼻・頬の角度用素材、XY 用の斜め輪郭は手薄）。
- 拾わなかったもの: ココナラ/ランサーズ/Fiverr/carrd の販売・料金ページ（パーツ数の相場程度の情報のみ）、clipstudio.net の横顔の描き方（Live2D 無関係）、appirits の PDF（テキスト抽出不可）、cathy.devdungeon（DNS 解決不可）、soultyragevin の Notion（中身取得不可）。
