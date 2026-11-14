# 驚いて少し引く — 表情参照の相談

2026-11-12。ユーザーが次の制作として⑥驚きへ進むことに同意し、笑みと同じ参照画像→see-through部品化→既存パーツを目標へ変形しopacityで受け渡すアプローチを提案した。参照v1を「いいと思う」と採用し、表情変化の試作を依頼した。

## 目標

「予想外のものが来て、思わず一瞬目を見開く」を最初の目標にする。恐怖や絶叫まで大きく振らず、通常の口パクと共存できるよう、口は落ち着いた小さい開きに留め、目と眉で驚きを表す。表情の移行単体を確認した後、身を引く動きと合わせる想定。

## 第一稿

[保存した正面画像](shared-laughter-expression/neutral-r804.png)を編集対象に、内蔵imagegenで[驚きの参照v1](startled-expression/startled-front-v1.png)を作成。元の正面姿勢・衣装・髪飾りを保ち、開いた目と持ち上がる眉、小さく開いた口を描いた。透過PNG。rootが生成画像を目視し、口に頼らず目元で驚きを読める相談用候補として提示する。

本人の参照採用済み。[生成prompt](startled-expression/generation.md)。次に下記の表情試作へ進む。驚いて引く身体モーションと製品登録は別段階。

元の228区間では驚き系18件、そのうち身/顔を引く意図13件という分析見積もりがあるが、今回の一表情で13件に対応できると確定したものではない。[分類と実例](../experiments/speech-motion-coverage-2026-11-12.md)。

## 表情試作の開始

GPT-6 Astraへsee-through抽出と造形を依頼。開始source/現用Exportは笑い登録後のr825。sourceの開始状態を保存したうえで驚き専用入力を追加し、目標絵と同じ印象を目視で作る。驚き0では通常眼・既存笑顔・視線・口パクを維持する。現用Export・exe・製品登録は今回更新しない。

参照overlayを固定して目元/眉/瞳中心を比較し、パーツの受け渡しでは二重線・色抜け・白目によるまつ毛の隠れを確認する。移行単体動画は頭と上体を固定、瞳XY0、通常瞬きなし、口も静止。別途、既存母音・左右向きの共存を比較する。数学的な拡縮推測を目標にせず、参照の見え方を造形の基準とする。

制作記録は [startled-expression-v1](C:/workspace/remie/rigging/astra-chan/workspace-notes/startled-expression-v1/README.md)。採用目標・切出し素材・開始状態・再現用定義・比較画像・動画を保持し、試作の本人受領は実際の絵と動きで判断する。

## 表情試作 v1 — source r837

see-throughで左右のまつ毛・白目・虹彩・眉の8パーツを抽出し、正式intakeで追加。独立した `param_startled`（0〜1）に旧素材の変形と新素材へのopacity受渡しを作成した。通常から見開きに近づけ、終盤で素材を交代する。口と髪は変更していない。sourceはr837へ保存、before-r825とsaved-r837を制作記録に保持した。

[6秒の移行動画](C:/workspace/remie/rigging/astra-chan/workspace-notes/startled-expression-v1/startled-expression.mp4)は通常→驚き→保持→通常。瞳XY0、通常瞬きなし、口・頭・上体・Stage静止、無音。驚いて引くモーションや発話同期ではない。[参照・試作・通常顔の比較](C:/workspace/remie/rigging/astra-chan/workspace-notes/startled-expression-v1/face-comparison.png)と[目元比較](C:/workspace/remie/rigging/astra-chan/workspace-notes/startled-expression-v1/eye-comparison.png)も保存。rootは比較と主要フレームを目視し、中央の瞳・広がる白目・上がる眉で見開きが読める候補として受領した。本人の美的採用は未確認。

驚き0の通常/閉眼/視線/既存笑顔/横向きの5条件は基点r825とPNG一致、既存keyform保持、保存再読込とHost描画経路の一致を確認。左右±24°と既存母音も限定確認。現用r825 Export全ファイルは不変で、製品登録・atlas更新・commit/pushなし。

残差: 原画より抽出線が柔らかい。元モデルの前髪が目尻を覆う。交換窓に旧虹彩のハイライトや細線が薄く残る箇所がある。笑顔と驚きの同時重畳は未設計。strict診断は基点787→789 errors（新左右maskのruntimeEvidenceMissing追加2件）、warning4→12、blocking0であり全体passではない。詳細は制作記録を参照。

## 縮尺と左右バランスの再確認

ユーザーは試作の目が大きすぎ、参照と縮尺・左右バランスが合わない印象を指摘。rootも顔全体に対する目元の比率と髪による隠れを見直し、モデル修正前に縮尺を合わせた重ね合わせを提示する依頼を受けた。

[比較HTML](startled-expression/alignment-v1/index.html)と[表示画像](startled-expression/alignment-v1/overlay-comparison.png)を保存。r837保存描画を固定し、既存参照描画だけを一様96%・移動(10,20)pxで再配置した。鼻先・顎・頭頂を目安にした視覚上の仮位置合わせで、眼を基準に個別変形してはいない。参照opacityを変え、単独表示・重ね合わせ・目元拡大を見られる。画像生成とモデルの輪郭差があるため全点の一致を保証する配置ではない。入力経路と変換は[inputs.json](startled-expression/alignment-v1/inputs.json)に保存。source・現用Exportは変更なし。本人とこの比較から認知を合わせる段階。

ユーザーが比較対象を訂正。意図は「驚き参照と、変形前の元の通常顔」を重ね、驚きパーツの縮尺と配置を考えること。上記はrootが驚き試作と比較してしまったため、その目的の比較にはなっていなかった。

[通常顔との比較HTML](startled-expression/alignment-neutral-v1/index.html)と[表示画像](startled-expression/alignment-neutral-v1/overlay-comparison.png)を作成。通常顔は驚き0・笑み0・瞳XY0・開眼1のframe000で、編集前r825との一致確認済み。通常顔を固定し、参照全体の縮尺・横位置・縦位置・濃さを変更できる。初期値96%/(10,20)は検討用の仮配置であり、採用したパーツ配置ではない。モデル変更なし。以後はこの通常顔との比較から基準を相談する。

## 仮配置の採用とv2制作

ユーザーが「この縮尺で置いてみようか。表情変化の作成に移ってくれ」と依頼。rootはブラウザ上の現在値を取得できなかったため表示済み96%・横10px・縦20pxを基準として進めると明示し、ユーザーが「仮配置のもので大丈夫」と確認した。これにより上の仮配置をv2の制作基準として採用。

元の参照描画（708×744、worldあたり1.2px）からHost座標へ戻すと、scale0.8064、origin(535.2133333333,-36.6933333333)、rotation0。これは比較画面で合意した一様変換の再現用であり、目の形を数式で決める基準ではない。参照overlayをこの配置で固定し、r837から部品の大きさ・位置と遷移を調整する。

Astraへv2を依頼。see-through抽出済み8パーツを再利用し、終端を新基準へ合わせ、通常顔から旧パーツを変形してopacityで受け渡す。本人評価対象は顔全体での目の大きさ、左右の開口と瞳の位置、移行の自然さ。単体動画は口・瞳・頭・上体・Stage静止、通常blinkなし。既存通常顔・笑顔・口パクを保持し、現用r825 Export/製品は更新しない。

予定保存先: `C:/workspace/remie/rigging/astra-chan/workspace-notes/startled-expression-v2`。v1を残し、before-r837とv2保存正本・比較・動画・再現記録を保持する。

## 表情試作 v2 — source r838

承認した配置をHostで再現した重ね合わせをroot/Astra双方が確認し、抽出8パーツのmeshと驚き専用8keysetを配置し直した。新しいパーツやキーは増設せず、驚き0の通常状態・既存笑顔・口は保持。source r838とsaved-r838、before-r837を保存した。

[単体動画v2](C:/workspace/remie/rigging/astra-chan/workspace-notes/startled-expression-v2/startled-expression.mp4)、[新基準参照・v2・通常顔](C:/workspace/remie/rigging/astra-chan/workspace-notes/startled-expression-v2/face-comparison.png)、[旧v1を含む比較](C:/workspace/remie/rigging/astra-chan/workspace-notes/startled-expression-v2/v1-v2-comparison.png)、[制作・検証記録](C:/workspace/remie/rigging/astra-chan/workspace-notes/startled-expression-v2/README.md)。動画は6.05秒、通常→驚き→保持→通常、口・瞳・頭・上体・Stage静止、通常blinkなし。

rootは顔全体比較・終端overlay・主要フレームを目視。新基準の左右瞳中心と白目開口が揃い、v1で画面右の目が外側へ寄る印象は弱まった候補として受領。表情の美的採用と連続移行の最終判断は本人確認待ち。

驚き0の通常/閉眼/視線/既存笑顔/横向き5条件でr825のPNGと一致。保存再読込、Hostと動画経路の終端描画一致、MP4 decode成功。strictはr837と同じ789errors/12warnings/0blocking、今回の追加診断なし。現用r825 Export全hash不変。抽出線の柔らかさ、交換窓の微細な旧ハイライト/細線の重なり、元の髪・口の違いは残る。詳細と限定的な母音/横向き確認は制作記録へ。

## v2への指摘 — 瞳の受け渡しの不連続

2026-11-13、ユーザーは「瞳が切り替わる時に結構不連続に見える」「切り替わる時に位置やサイズは一致していたほうがいい」と指摘した。v2で残差として記録した交換窓は本人に明確な違和感を与えており、採用とはしない。

Astraへv3の調整を依頼。承認された参照配置と驚き終端は保ち、旧虹彩を新虹彩の見かけの位置・大きさへ合わせてからopacityを受け渡す。切替前・途中・後と逆方向の復帰を拡大して確認する。フェードを長くして二重瞳を隠す方針ではなく、受渡し時の位置・輪郭の連続性を確かめる。通常/既存笑顔/口パク・現用r825 Exportは保持。予定保存先は `workspace-notes/startled-expression-v3`、本人確認用に全体移行と切替区間の拡大比較を用意する。

調査では交換窓内の旧/新それぞれの虹彩頂点は停止しており、旧虹彩の到達形自体が新素材とずれていた。横広・斜めの外周、瞳孔位置と旧白目maskによる下端の切れを修正。既存虹彩meshを細分する初案は通常yaw+24°に描画差を生じたため保存案から外し、元meshを保持して驚き移行専用の複製2枚へ局所変形を隔離した。通常/閉眼/半閉/視線/笑顔/左右yaw±24°/驚き終端の8条件がr838とPNG一致する候補を確認。rootは切替前・中・後の比較で位置と外周のずれが減ったことを目視した。虹彩内部の色模様の差は残り、本人の動画確認はこれから。

### v3保存と提示

source r839とsaved-r839、before-r838を[制作記録](C:/workspace/remie/rigging/astra-chan/workspace-notes/startled-expression-v3/README.md)へ保存。[等速移行動画](C:/workspace/remie/rigging/astra-chan/workspace-notes/startled-expression-v3/startled-expression.mp4)と[両眼の往復スロー比較（上v2・下v3）](C:/workspace/remie/rigging/astra-chan/workspace-notes/startled-expression-v3/iris-handoff-v2-v3-slow.mp4)、[切替フレーム比較](C:/workspace/remie/rigging/astra-chan/workspace-notes/startled-expression-v3/transfer-comparison.png)を用意した。

rootは両眼の切替比較と初期専用パーツ受渡しシートを目視。旧側の斜め/角張った輪郭と瞳中心の飛びが減り、終端を保った候補として受領。素材の色模様・副ハイライトの差は残るため、完全な同一像とはしない。本人の連続動画の採用判断待ち。

8条件PNG一致、元全meshと非驚きkeyform不変、保存再読込・Hostと動画終端一致、動画decode成功を確認。専用化前に発見した通常yawの差は解消済み。strict追加95件は細分専用meshが引き継いだUV余白の範囲診断で、全体passではない。現用r825 Export全hash不変、製品登録・exe更新・commit/pushなし。

## 元パーツだけでの比較案

2026-11-13、ユーザーは「切り替える必要がないかもしれない、元のパーツだけで表現できている気がする」と提案し、切り替えない版の確認を依頼した。see-throughの素材採用を前提に完成を急がず、現時点の旧パーツ変形だけの表現を比較する。

Astraへ比較用variantを依頼。r839を読み、抽出8枚（目・眉）への交換を止め、旧側のまつ毛/白目/虹彩/眉を驚き終端まで残す。元textureを使う移行用虹彩複製は使用可。単なる途中値停止ではなく、0〜1の同じ表情時間曲線で変形し復帰する。今回新たに造形を追い込むことはせず、同画角/同時刻でv3切替ありと元パーツのみを見比べる。現source/Exportを変更しない試作用copyまたはin-memory variant。

予定正本は `workspace-notes/startled-original-parts-v1`。同期比較動画と終端比較で、驚きの印象と交換をなくした移行の自然さをユーザーが判断する。口/瞳/頭/上体/Stage静止・通常blinkなしを継承。

### 比較版の保存

[切替ありv3と元パーツのみの同期比較](C:/workspace/remie/rigging/astra-chan/workspace-notes/startled-original-parts-v1/v3-vs-original-parts.mp4)を作成。左がv3、右が元パーツのみ。[元パーツのみ単独動画](C:/workspace/remie/rigging/astra-chan/workspace-notes/startled-original-parts-v1/original-parts-only.mp4)、[終端比較](C:/workspace/remie/rigging/astra-chan/workspace-notes/startled-original-parts-v1/endpoint-comparison.png)、[再現・確認記録](C:/workspace/remie/rigging/astra-chan/workspace-notes/startled-original-parts-v1/README.md)を保存した。

r839を読み取り、in-memory overrideだけで8抽出素材を非表示、旧側opacityを維持した。虹彩の移行専用複製は元texture/UV、maskは元白目を使用。追加造形なし。0/.03/.5/.8/1の確認点で抽出素材の表示0、全frameの表情入力0〜1と時刻はv3と一致。通常0の描画一致、両動画decode成功、source r839と現用r825 Exportの全hash不変を確認。モデル保存/製品接続は行っていない。

rootは終端比較を目視し、元パーツのみでも見開きが読み取れ、元の瞳模様が続く候補と判断。まつ毛/眉/白目の形に抽出参照との差が残る。切替をやめる案の採用と、動きの印象は本人の動画判断待ち。

## 元パーツのみの採用と、身を引くモーションへ

2026-11-13、ユーザーは比較右側の元パーツのみ版を「圧倒的にいい」と採用した。目標画像へ近づけることと、目標画像から抽出した素材へ交換することは別。元の形状から変形で表現できる場合は、元の瞳模様が連続することに価値がある。閉眼笑顔のように形状の変化が大きいケースまで、素材交換を否定する判断ではない。

採用版は `startled-original-parts-v1/overrides.json` による試作用の表現であり、source r839にはまだ保存していない。現用r825 Exportにも未反映。次の試作はこの採用版を使う。

モーションは⑥「驚いて少し身を引く」。rootが提案した「不意を突かれて一度引ける。でも対象から注意は外さず、見直す」という流れに対し、ユーザーが制作を承認した。まず正面のゲーム画面向けを作る。

1. 目が素早く開き始め、対象へ注意が集まる。
2. 少し続いて頭が短く引け、上体がついていく。
3. 引けた姿勢で短く留まり、目を開いたまま対象を見直す。
4. 姿勢を滑らかに戻し、見開きも遅れて緩める。

この順序は[既存調査](../research/human-conversational-motion-2026-11.md)を足場にした演出仮説であり、研究が直接保証する身振りではない。正面ニュートラル開始、通常瞬き・視線移動は重ねず、元パーツだけの表情と身体の時間差を映像で判断する。制作はAstraが担当し、再現可能な定義と動画を保存する。美的採用と製品登録は試作後の別判断。

### 正面の身引き v1

[試作動画](../experiments/speech-motion-startled-recoil-v1/startled-recoil.mp4)と[再現記録](../experiments/speech-motion-startled-recoil-v1/README.md)を保存。約6秒・24fps、元パーツのみの表情で、口は静止・無音・通常瞬きなし・瞳XY0。表情、頭、身体全体の反応を順に立ち上げ、見開きを保つ間を置いてから戻す。

頭の傾きと上下動だけの初案は「沈む」印象が強かったため、既存Stage Presenceのdepth入力を試作用レンダラで使い、奥へ引ける印象を追加した。実出力の最小scaleは約0.948、上下は最大約4px。発話モーションからdepthを指定する製品接続はまだなく、今回の動画はその接続が実装済みという意味ではない。source r839・保存snapshot・現用r825 Exportは不変。

rootは主要フレームを目視し、見開きの先行、引けた姿勢、姿勢が戻ってから目元が緩む順序を確認した。テンポ・身を引く印象・動きの強さは本人の動画評価待ち。

## 強い驚きとしての採用と登録合意

2026-11-13、ユーザーは「結構強く驚いている」「これはこれでいい」と評価した後、今回の驚きを採用した。軽い驚きや、驚いて身を乗り出す反応は別の表現として残る。旧分析の「身/顔を引く13件」が全件この強度に合うと判定したわけではない。

Decision候補は「驚いて思わず身を引く」。説明は「予想外の出来事や情報に、目を見開いて反射的に顔や身体を引く。短く動きを止め、対象を見つめてから落ち着く反応。軽く意外に思うだけの反応や、興味を持って身を乗り出す反応は含まない。」で合意。演技と対象の独立判定を継続する。

視聴者・ゲーム画面は今回の同一クリップを使う。相方版はあり得るが今回は作らず、選ばれた未制作ペアを文脈ごと記録し、実例から制作を考える。ユーザーの登録依頼を受け、[登録・配布計画](../implementation/orchestration/startled-recoil-registration-plan.md)を起動した。製品反映は進行中であり、試作採用と配布完了を区別する。

### 製品登録と配布の完了

2026-11-13、採用overrideを保存したr840を正規Exportし、画面/視聴者の2ペア、演技Stage奥行きと目元競合制御を登録。現用Exportと普段の通常exe/portableを更新し、両配布先からr840の読込を確認した。既存9組の描画互換、新演技のNative/Browser再生・口パク・Presence Off・解除、相方の未制作記録は内部検証合格。試作原本は保持。現在の到達点とバックアップは[登録完了](../implementation/waves/startled-recoil-registration/completion.md)を参照。Playerと起動済みSoulの再起動後、本人の実会話確認が残る。
