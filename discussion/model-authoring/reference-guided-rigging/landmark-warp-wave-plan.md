# 点・輪郭を補助に使う変形画像の試作: wave計画

2026-09-25。ユーザーが2 waves・担当分離・レビュー粒度・2か所のhuman gateを了承し「計画を書いて起動してくれ」と指示。今回の成果物は変形画像の比較まで。編集可能なデフォーマ格子や既存rigへの保存は次工程。

## 目的と範囲
保存済みRAFTフローとrootが認識・指定する点/輪郭を併用し、正面の元素材から中間・最大の顔/眼鏡を変形描画する。点・線が見た目の改善に役立つかを試す。
対象: 顎先、見える目頭/目尻、口中央、左右頬〜顎の輪郭。眼鏡は独立した部品。鼻/髪/帽子/耳の新たな変形やBody各軸は今回追加しない。周辺素材は元絵のまま保持し、その影響を対象部位の品質と混同しない。
数値は理解・診断の参考であり、自然さの合格条件ではない。既存の生成参照を結果へ貼り付けたり、欠損を新規画像生成で埋めたりしない。

## 場所と保全
- W = C:/workspace/remie/rigging/second-rigging-6-sol
- R = W/reference-generation
- O = R/optical-flow（既存・read only）
- P = R/landmark-warp（今回の実装・成果物）
- D = C:/workspace/remie/code/ai-native-live2d-editor/discussion/model-authoring/reference-guided-rigging
- Reviews = C:/workspace/remie/code/ai-native-live2d-editor/discussion/implementation/reviews/reference-guided-rigging
- 元PSD = C:/workspace/remie/code/vtuber/images_3/全身.psd。書換禁止。
- 旧second-rigging-astraのrig成果物を参照しない。明示されたskillファイルだけ例外。
- editor source、ref/、closed-problems/、research/、git履歴の探索/変更は今回不要。
- 源画像、alignment、O/runs、推定器、既存viewerを変更しない。新しい結果はPへ出す。

## Accepted User Gate
### あなたが受け取るもの／行うこと
Gate 1で、正面・中間・最大の画像にrootが指定した点・輪郭を重ね、同じ位置・倍率で切り替えて見る。Gate 2で、参照画像・フローを使った変形画像・フローに点と輪郭を加えた変形画像を同じ位置・倍率で切り替えて見る。指定と結果の表示を切り替えられる。
### あなたが判断すること
Gate 1では、指定が意図した箇所・形を捉えているかを判断する。Gate 2では、顔の形と眼鏡の関係が見た目として改善したか、新しい違和感がないかを判断する。
### あなたが判断しないこと
ライブラリ導入、座標・計算・描画実装、内部テストの正否は担当側で確認する。今回は編集可能な格子や完成rigの品質を判断する段階ではない。
### 合格条件
Gate 1の具体的な指定をユーザーが確認した後に、その指定を確定入力として実画像試作へ進む。Gate 2では実画像の比較候補を受け取り、指定を加える方式が役立つかをユーザーが判断する。数値・内部テストの成功はこの判断を代替しない。
### 違和感や不足があった場合のフィードバック
ユーザーが画像・部位・挙動の違和感を示す。rootは参照、指定、フロー、変形計算、素材、合成のどこに原因があるかを分け、修正した具体物を再提示する。過去の版の承認を変更後へ自動継承しない。

## 確認済みbasisと未作成物
Context-checkのread-only inventory:
- 位置合わせ済み3画像は2048x3072 canvas。正面はR/source/normal-outfit-neutral-full.png、中間はR/alignment/midpoint-aligned.png、最大はR/alignment/endpoint-aligned.png。
- O/runs/baseline-768-12（512x768 field）とcomparison-1536-12（1024x1536 field）は同じ画像/重み/12 updates、解像度だけが異なる条件。manifestと各14artifactのhash一致を確認済み。
- f01/f12のraw vector、validity、reasons、FB residualがある。backward場自体は未保存。無効f02をraw連鎖として利用しない。
- 元PSDにeyewear単独PixelLayer、face/face、通常表情の左右目・眉・mouthがある。eyewear bbox=(862,404,1127,514)、face/face=(864,306,1136,575)、閉じmouth=(986,524,1015,530)。対象素材はNormal/opacity255/no clipping、ラスターマスクあり。マスクを無視した抽出は原表示と同じとは限らない。
- 保存PSDはmouth_aが表示。R/prepare-source.pyと同じく通常衣装/通常表情の閉じ口へ切り替えた作業用状態をメモリ内で作る。
- 元PSDの部品素材を抽出する基盤は未作成。生成参照側に部品レイヤやmaskはない。隠れた素材の十分性は描画で検証する。
- Oの専用Python3.11にはNumPy/Pillow/torch/torchvisionあり、SciPy/OpenCV未導入。global Pythonにはpsd-toolsあり。
- 対応点/曲線の保存形式、拘束付き変形、実参照のwarp previewは未実装。
- rootの顎先認知のみユーザーが画像で承認。ほかの点・曲線はこれから指定する。顎の可視化C:/Users/remie/.codex/visualizations/2026/09/22/01a0cb68-15e8-72b1-88b9-78b366ed6c09/chin-perception.htmlは観察根拠で、root製UIを技術PASSの代用にしない。
- root顎候補canvas座標: neutral(998,572), midpoint(1044,571), endpoint(1091,565)。目視の暫定指定で、pixel精度のGTや全輪郭の承認ではない。

## 設計とオーケストレーション
root/Undineは全体設計・User Gate・画像認知/指定・最終目視を所有する。実装、tests、大規模source精査へ潜らない。
各domainはOrch-Sylph -> 別context Gnome -> 別context Review-Sylph。Orchは実装しない。reviewerはbasis/source/tests/artifactを直接確認し、実装者の説明だけに依存しない。
各assignmentに次を必ず入れる:
「Orch-Sylph自身は実装担当ではない。source implementation は必ず別コンテキストの Gnome に委譲し、レビューは必ず別コンテキストの Review-Sylph に委譲すること。これを分離できない場合は実装せず escalate / blocked として報告すること。」
呼出prefixはrootから[subagent-call] 呼び出し元: Undine、Orchから[subagent-call] 呼び出し元: Sylph。
修正最大5loop。進捗待ちを理由に中断/代替実装しない。改善停滞やユーザー価値の判断が必要ならrootへescalate。技術選択（補間表現、必要依存、実装上の係数など）は根拠と限界を記録して担当が進めてよい。User Gate/範囲/比較の意味の変更権限はない。
他担当と共有workspaceであり、他者編集を戻さない。ownership外へは勝手に書かない。

## 共通交換契約 v1
すべてUTF-8 JSON。相対path/URLはそれを含むJSON基準。画像は共通canvasに配置済み、座標はpixel-edge-centers、単位canvas px。各入力のhashと由来を記録。人工/実画像のkindを区別する。
以下の必須フィールド・意味を固定し、任意diagnostics拡張可。必須契約を変更する場合はrootと全担当へ先に通知する。

### assets.json: landmark-warp-assets-v1（A所有）
- schema, kind: synthetic-fixture|real-reference, canvas:{width,height}, coordinateConvention:"pixel-edge-centers"
- neutralImage: 現在の正面合成画像path
- layers: [{id,partId,deformGroup,stackIndex,image,bbox}]
- imageはフルcanvasのRGBA PNG。bbox=[left,top,right,bottom]は情報で、追加transformではない。
- stackIndex昇順にsource-over。ラスターマスクは適用済みalpha。deformGroupはface|eyewear|null。顔肌・鼻・目眉・閉口をface群、眼鏡をeyewear群とし、今回動かさない層はnull。顔群内もレイヤ順は保持する。
- static層を単一背景へ雑に潰さない。動く層の前後の重なりを再現する静的bandなどの表現をAが選定し記録する。
- groups: [{id:"face"|"eyewear",visibleSourceMask}]。maskは正面合成でその群が見える領域/寄与を表すフルcanvas grayscale PNG。透明度、前景による遮蔽、曖昧な混合境界の定義を記録。全体alphaやflow validityを部品maskの代用にしない。
- provenance: PSD/source hash, appearance selection, export method, software等。
- 元絵再合成の比較でずれが残る場合、任意の差分画像で埋め合わせず原因を報告する。

### annotations.json: landmark-warp-annotations-v1（Aが形式/シリアライズ、rootが認知の内容）
- schema, canvas, coordinateConvention, revision, review:{status:"draft"|"accepted",basis}
- landmarks:[{id,partId,role:"correspondence",frames:{neutral:{xy,visibility},midpoint:{xy,visibility},endpoint:{xy,visibility}}}]
- xy=[x,y]またはnull。visibilityはvisible|occluded|outside|unmarked。visibleのときのみ有限xyを必須。不可視位置を0座標や推定で埋めない。
- curves:[{id,partId,role:"outline",frames:{neutral:{points,visibility},midpoint:{points,visibility},endpoint:{points,visibility}}}]
- pointsは順序つき[x,y]列。曲線は形への拘束であり、同じ配列indexを物質点の対応と解釈しない。左右の頬〜顎を別IDにする。可視部分のみ指定し、欠損部は埋めない。
- partIdはassets側のpartId/群への対応を一意に定義。solver/viewerは未知IDを黙って別群へ代入しない。
- rootの目視指定とflow推定値を出自で区別。既存observations/points.jsonを手指定GTとして流用しない。
- 点/曲線の信頼性を確率と称さない。必要なら任意メモと技術重みを別項目にする。

### scene.json: landmark-warp-scene-v1（AがGate 1用、Dが結果付き版、Cが消費）
- schema, kind, canvas, coordinateConvention
- assets: assets.jsonへのpath、annotations: annotations.jsonへのpath
- flowManifest: 既存reference-flow-v1 manifestへのpath（人工fixtureでは省略可）
- frames:[{id:"neutral"|"midpoint"|"endpoint",label,image,sha256?}]
- outputs:[{id,mode:"flow-only"|"guided",targetFrameId:"midpoint"|"endpoint",image,affectedMask?,diagnostics?}]
- outputsはGate 1では空配列。画像がないときに成功画像を捏造しない。
- Bは同じ形式のoutputsと実行条件/provenanceを持つrun manifestを返す。Wave 2 Dがsceneへ結合。
- 原画像/出力画像は同じcanvas。フル画像とcropを二重変換しない。
- Cはscene queryで読み込む。AのGate 1 sceneはP/assets/scene.json、annotationはP/annotations/candidate.jsonを想定。相互参照は出力時に実在と整合を確認する。

### flow adapter
既存Oの契約を保持: f01はneutral->midpoint、f12はmidpoint->endpoint、元canvas pixel単位。q=p+f01(p)、r=q+f12(q)。有限性と画像範囲を守る。無効結果を0に置く既存Python sampleをraw取得としてそのまま使わない。raw f02は存在すると仮定しない。採用mask/FB診断は重みの材料で正解ラベルではない。逆写像が必要な描画でforward flowの単純符号反転を使わない。

## Wave 1: 独立基盤（A/B/C並列）
### A 素材・指定データ
所有: P/src/input/, P/assets/, P/annotations/, P/fixtures/input/, P/tests/input/, P/docs/input.md。
PSD抽出、マスク/順序/所属、無変形再合成検証、契約のvalidator/serializerとGate 1 scene。sourceの認知内容を勝手に決めずrootから受領してファイル化する。root顎候補と残りunmarkedを初期データとして出してよいが、未指定のままGate 1完了としない。rootへ指定を受け渡す最小手順を提案。全機能注釈editorを新造する必要はない。
独立review: 閉じ口状態、PSD不変、alphaとマスク、重なり順、座標、同一描画再現、不可視データ拒否、未知部品の扱い。正解画像への差分の貼り込み禁止。
Aはpsd-toolsがある既存global環境を読み出しに使用可。導入が必要ならBと衝突させず相談。

### B 変形計算・描画
所有: P/src/warp/, P/fixtures/warp/, P/tests/warp/, P/docs/warp.md、P専用環境/requirements。
共通契約の人工素材・点線・既知fieldで実装し、Aの実素材に依存して待たない。既存Oのvenvやrequirementsを書換えず、P/.venv等の独立環境を使用。必要な通常ライブラリの導入はユーザー承認済み。バージョンを記録。
source正面を基準とする変位表現、部品内の滑らかさ、flowの支持/不確かさ、点/輪郭を組み合わせて解く。具体的な数値表現はBが絞って根拠を残す。内部計算に格子/meshを使えてもeditor rigの格子形式への保存はしない。
flow-only/guidedは素材・flow・可視領域・描画・正則化等を共有し、指定の追加による差を説明できる比較にする。条件変更があれば混同しない。
flowを使うのは該当部品が見える支持領域。眼鏡/髪/背景の推定を肌へ混ぜない。隠れた部分の運動は推定済みと称さず、補間と仮定を記録。非有限/画像外/矛盾する指定/支持なしを診断可能にする。指定を満たすための過剰な折返しや潰れを隠さない。
独立review: identity/既知平行移動/空間変化する変位、f12を移動先で読むこと、前後写像と描画、部品間漏れ、点と曲線の違い、不可視/非有限、比較条件。必要な検証だけ行い、数値で自然さを合格にしない。
実参照のguided変形はGate 1前に実行しない。

### C 比較表示
所有: P/viewer/, P/fixtures/viewer/, P/tests/viewer/, P/docs/viewer.md。
scene契約の人工入力から作成。Gate 1では3原画像+指定、Gate 2では参照/flow-only/guidedの即時切替。共通crop/倍率、overlay ON/OFF、点ID・部品所属・不可視/未指定、処理対象/対象外を必要十分に示す。左右並べるだけで比較を済ませず、アニメーション補間で原画像/結果を混ぜない。
読み込み/欠損/errorを明示。既存8769 serverはRをrootとして配信しておりPのページも使用可能。ブラウザ検証はcua_repl、自分専用tabで行い既存ユーザーtabを触らない。不可なら事実を報告し独立browser PASSと偽らない。
独立review: 座標と画像の対応、同位置/同倍率、scene違い/未作成outputs、overlay、loading/error、実browser。

## Wave 1受領とGate 1
rootはA/B/Cのcompletionと独立reviewを読む。途中の画像認知はrootが行い、Aへ座標/曲線の内容を渡す。指定をフローに合わせて改ざんしない。必要ならrootが各画像のcropを見て修正する。
A/Cを使った実画像のannotation表示をrootが直接見てからユーザーへ提示。ユーザーのGate 1確認まではWave 2を起動しない。技術的に完了した担当を待機させる。
Gate 1承認はannotation revisionと画像hashを記録し、変更後に自動継承しない。

## Wave 2: D 実画像統合
前提: Wave 1技術受領 + Gate 1承認。
別Orch D -> Gnome D -> Review D。P/runs/と統合記録を所有。必要なA/B/C source修正はownershipを引き継ぎ、独立reviewを付ける。
中間/最大を正面の元素材から描画。参照・flow-only・guidedの同条件比較を作る。2解像度のデータを比較に使用できるが、条件差を混ぜない。正面->最大の直接RAFT再推定は今回の既定作業に追加しない。
顔/眼鏡を対象として原素材から再合成し、髪/帽子/体の据置による影響と分ける。単独部品表示を補助に使えても、欠けや合成境界を隠すためにcropしない。新しく露出して元素材にない画素は限界として示す。
統合review: input/revision/hash/part対応、比較条件の一致、遮蔽/透明度/境界/前後順、実描画からUIまで、条件と残課題の記録。
root自身の目視->必要な修正->Gate 2提示。最終ユーザー判断前に格子/rig工程へ進めない。

## レビューの粒度・証拠
ファイルごとの承認儀式ではなく、A素材/指定、B数理/描画、C表示、D統合の責務と境界でreviewする。関連試験と実artifactを根拠にする。点線の意味を捉えたかという画像判断と、指定を正しく計算したかという技術判断を分ける。
各報告には変更一覧、試験結果、独立review、裁量、残課題、実browserの実施者と可否を記載。担当のbrowser不成立をroot目視で独立PASSにすり替えない。
報告先:
- D/experiments/landmark-warp-wave-1-a-completion.md
- D/experiments/landmark-warp-wave-1-b-completion.md
- D/experiments/landmark-warp-wave-1-c-completion.md
- D/experiments/landmark-warp-wave-2-completion.md
- Reviews/landmark-warp-wave-1-a.md, landmark-warp-wave-1-b.md, landmark-warp-wave-1-c.md, landmark-warp-wave-2.md
地図・この計画・User Gateはroot所有。担当は自分の報告のみ編集。

## 状態
A/B/C実装完了をrootが受領。Aは独立14試験、Bは独立15試験、Cは内部19試験がPASS。Cの独立browser再試行は担当環境のprovider不在により未実施。root環境では専用tabで実sceneの3画像切替と倍率変更を目視確認したが、独立browser PASSへ読み替えない。
root-feature-candidate-2 / draftを作成し、rootが3画像の同位置切替で目視済み。Gate 1のユーザー承認を受領。Wave 2 Dの技術統合を受領。4出力の比較試作あり、自然さ未達。Gate 2ユーザー判断待ち。技術の完成をhuman gate完了としない。



### Gate 1提示候補のroot観察
- candidate revision: root-feature-candidate-2 / draft。SHA256: 3c33d72d759c60a2ad98c75efaf11eb137c1100000353f9f9749f4874a4d7926。
- scene共通crop=[850,370,330,230]。目から顎を同倍率で比較し、全体表示も残す。scene SHA256: bd29901d0200bcb932656bab1b01920d5d0cd4d77f719a9292442af216697c8d。
- rootが原画像とoverlay ON/OFFを見て点/輪郭を指定。最大の左下顎の線が肌の内側を通る初期候補を修正し、上まぶた線の先端も再読取。フロー値へ寄せていない。最終3画像をbrowserで目視した。目視候補でありpixel精度の真値ではない。
- 目の指定は計画時の候補をそのまま埋めていない。解剖学的な目頭交点を読めない箇所はunmarked、髪で隠れた箇所はoccludedとして座標を作らない。別ID eye_left_inner_lid_tipは『目頭側の黒い上まぶた線の先端』で、解剖学的目頭と区別する。この選択もGate 1の確認対象。
- 可視の頬下部〜顎の2輪郭、顎先、口中央、上まぶた先端、独立eyewearのブリッジ接合2点を候補にした。レンズ極値を同じ物質点の対応とは扱わない。
- rootのブラウザ操作/目視は独立browserレビューではない。Cの独立browser未検証は残る。
- 表示URL: http://127.0.0.1:8769/landmark-warp/viewer/?scene=../assets/scene.json%3Fv%3Droot-feature-candidate-2 。scene更新が旧cacheで反映されなかったためqueryで区別。新cropとcandidate-2の表示を確認。
- ユーザーの判断は未取得。合意したGate 1でこの候補を確認してからWave 2へ進む。
### Gate 1ユーザー確認（2026-09-25）
ユーザーはcandidate-2の比較画面について「うん、示された点の対応関係はほぼ完ぺきだと思う」と評価した。rootは提示候補の対応指定を用いて実画像試作へ進めるGate 1承認として受領。計画済みWave 2を起動する。変形結果の品質やGate 2、完成rigへの承認ではない。
承認対象はrevision root-feature-candidate-2、提示draft SHA256 3c33d72d759c60a2ad98c75efaf11eb137c1100000353f9f9749f4874a4d7926、scene SHA256 bd29901d0200bcb932656bab1b01920d5d0cd4d77f719a9292442af216697c8d。3画像の実hashを実行用記録へ固定する。
Dは提示draftを保持したまま、P/runs/内に承認済み入力snapshotとgate1-recordを作成する。review.status/basisだけをacceptedへ変えたsnapshotを利用し、幾何・visibility・revisionが提示候補と同じことを独立照合する。提示draft hashと実行snapshot hashを両方残す。指定の意味や位置は変えない。
Cの独立browser未実施という制限は受領したまま継承し、実画像統合時にも表示を確認する。rootの表示確認を独立browser PASSと称しない。
### Wave 2統合修正の受領
承認snapshotは独立PASSだが、Aの既知8bit量子化残差をBのraw RGBA判定が拒否するため実run未実施だった。rootが報告を受領し、DへP/src/warp/pipeline.py、CLI入口、必要最小の再合成helper、対応tests/docsの限定ownershipを委譲した。premultiplied RGB/alphaの通常比較と、独立確認済み入力hash固定の再合成evidence経路を限定実装・レビューして実runへ進める。素材や承認指定の変更、差分貼込み、数値による自然さ判定はしない。
眼鏡は現行のmask支持条件でflow支持0。初回比較でflow-onlyはidentity、guidedはbridge2点と滑らかさのみになる見込みを明示する。まず実画像を生成し、薄い半透明部品の支持規則の改善は結果と診断を見て分けて判断する。
限定preflight修正はGnome実装後、別Reviewerで19試験とhash固定evidenceを独立PASS。承認指定と素材を保持し、高解像度保存フローによる中間/最大×flow-only/guidedの実画像生成を開始した。眼鏡の支持規則は初回条件を維持。結果の自然さとGate 2は未判定。
### Wave 2結果のroot受領
主提示はP/runs/comparison-1536-candidate-2-smooth16-v2/scene.json。中間/最大×flow-only/guidedの4出力を生成し、独立technical review PASS。初回v1は最大guidedの可視頬でfoldが発生したfailed診断履歴として保持。v2は同じ入力・指定・素材で両mode共通のsmoothnessを1から16へ変更し、4出力生成を得た。描画失敗の閾値を緩めたり指定を変更したりしていない。
rootは4face cropとbrowserの中間/最大・参照/flow-only/guidedの同位置切替、overlay OFFを確認。独立browser未検証と区別する。目/まつ毛の崩れ、眼鏡の丸み不足、固定髪と可動顔の不連続が残り、rootの自然さ判定は未達。眼鏡の位置追随はbridge2点由来、flow支持は0。変形の生成完了を自然さの合格としない。
最大左側の灰色領域は限定点(972,514)と周囲で、不透明なstatic-band-0の露出と独立確認。透明穴や元素材不足と断定しない。全領域への一般化はしない。
承認した指定を使う後段処理の実比較はできたが、これを完成rigへの進行承認としない。Gate 2ユーザー評価は未取得。現結果を提示し、次は薄い眼鏡の支持、顔内の形崩れ、固定周辺素材と下地の問題を分けて議論する。
比較URL: http://127.0.0.1:8769/landmark-warp/viewer/?scene=../runs/comparison-1536-candidate-2-smooth16-v2/scene.json