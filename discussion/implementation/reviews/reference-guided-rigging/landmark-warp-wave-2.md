# Wave 2 D 独立レビュー

2026-09-25 / Review-Sylph: landmark_wave2/review_integration。実装は別Gnome、レビュー担当はsourceを編集しない。

## 現在の判定

最終技術判定: v2の承認入力・4出力・比較scene接続はPASS。自然さはroot目視で未達、Gate 2ユーザー承認は未取得。独立browser未実施。v1はfold/collapseでfailedの診断履歴。詳細と修正経緯は末尾まで時系列で記録。Gate 1承認をGate 2や完成rigの承認へ継承しない。

## Basis

landmark-warp-wave-plan.md全文、Wave 1 A/B/C completionと独立review、P/docs/warp.mdを直接確認。PはC:/workspace/remie/rigging/second-rigging-6-sol/reference-generation/landmark-warp。旧Astra rig成果物は参照していない。

Accepted User Gateを維持: Gate 1の具体的な指定をユーザーが同位置・同倍率で確認した後に実画像試作へ進む。Gate 2は参照・flow-only・guidedを同位置・同倍率で切り替え、指定overlayも切り替えて、顔の形と眼鏡の関係の改善と新しい違和感をユーザーが判断する。内部試験・数値は見た目の合格を代替せず、今回は格子や完成rigを判定しない。変更後の指定へ承認を自動継承しない。

## 承認snapshotの独立照合

対象: P/runs/approved-inputs/root-feature-candidate-2/。

- 元annotations/candidate.jsonとannotations-presented-draft.jsonはbytes一致、SHA256 3c33d72d759c60a2ad98c75efaf11eb137c1100000353f9f9749f4874a4d7926。
- 全JSON field再帰比較でannotations-accepted.jsonとの差はreview.statusとreview.basisのみ。幾何・visibility・revision・provenance・ID・partId・notesは不変。
- accepted SHA256 e1b0aa591a90c0c82cedbc659b1396a020d1cff59e218af6f9ffffdf590cd257。
- 元assets/scene.jsonとscene-presented.jsonはbytes一致。SHA256 bd29901d0200bcb932656bab1b01920d5d0cd4d77f719a9292442af216697c8d。コピーは証拠であり、元scene基準の相対pathを実行sceneとして誤用していない。
- snapshotに記録したdraft/accepted/scene/plan証拠/gate/assets/flowの7 hashを実ファイルで再計算し一致。
- sceneと高解像度flowの3frameを別々に解決し、実画像hash・各宣言hash・gate.framesを独立照合して全て一致。
- validate_annotationsとgate_checkを独立実行してPASS。
- 根拠はユーザーの「うん、示された点の対応関係はほぼ完ぺきだと思う」とrootの計画末尾のGate 1受領記録。実装者がユーザーの代わりに承認を創作したものではない。

## 実統合前のmust-fix境界

現行pipeline.pyはencode(recomposite)とneutralのraw RGBA最大差が1を超えると停止する。Aで許容済みの実素材再合成残差と整合しない。独立read-only probeでrawRGBAmax=255、alphaMax=1、premultRGBmax=2.96862745098038、premultRGBmean=0.0022779564、非透明画素rawMax=2を再現。透明RGBの最大差を無視するだけでも既知丸め差は閾値1を超える。

必要な修正は、透明RGBと可視差を分け、既知A量子化証拠を明示的に扱いながら意図的素材誤りを拒否できること。単純な閾値緩和や差分画像での修復は認めない。source ownershipを取得した実装担当の限定変更と追加試験を再レビューする。数値許容は自然さの合格条件ではない。

## 独立browser

このReview-Sylphがcua_replで専用IABタブ作成を試行したが、Browser is not available: iabで失敗。既存ユーザータブは操作していない。独立browser未実施を維持し、source接続確認・PNG実見・rootブラウザ観察を独立browser PASSへ読み替えない。

## 実支持領域の先行診断

solveや実runを行わず、既存adapterの高解像度flowと実source-visible maskを独立read-only評価した。既定spacing=8と同じstride=4で、faceはvisibleSamples=1762に対しmidpoint 1124点（weightSum=820.6854）、endpoint 791点（532.6843）。eyewearはvisibleSamples=101に対し両targetともflowSamples=0、weightSum=0だった。

従って現行条件の予想はflow-onlyの眼鏡がidentity fallback、guidedの眼鏡がbridge対応2点とsmoothnessだけで決まること。眼鏡へflowが寄与したと称してはならない。mask閾値や部品分離をこのレビューが独断で変更することはない。これは実描画未実行の先行診断であり、結果画像の挙動は今後のrunで確認する。

再合成先行probeはBのpremultiply/over/encodeを使用した。AのPillow再合成とは量子化経路が完全同一ではなく平均差に微差がある。A証拠を利用する限定受理設計では、B無変形再合成がA既知残差を増幅しないことを別途検証する必要がある。

## 停止境界

承認snapshot PASSと上記preflight blockerをOrchへ返却。B source所有者への限定変更権限確認待ちのため、この時点ではsource修正・実run・Gate 2 sceneの生成を行っていない。snapshot承認は実統合完了ではない。

## Gnomeの限定修正案に対する事前評価

提案は通常preflightをalphaとpremultiplied RGBの差<=1へ変更し、既知の量子化残差は明示的recomposition-evidenceを渡したhash固定入力のみ例外受理するもの。evidenceはassets/neutral/全layer・mask/A検証再合成PNG・report/B再合成pixel hashを束縛し、同一runの実行中に証拠を作って自己承認しない。B対A再合成のalpha差0・premultiplied RGB差最大1も記録する。

方向性は合理的。透明RGBを見た目の差へ数えず、既知A素材への限定例外と、別素材での不整合拒否を分離できる。ただしこれは未実装案の評価でありPASSではない。実装時に次を独立確認する。

- evidenceを適用する前に全hashと実際のB再合成pixel hashを再計算し、変更・欠落・別素材を拒否する。
- Aで許容した残差とB対A差を明示し、run provenanceへ例外使用と実測残差を残す。単なる一般許容閾値の拡大にしない。
- 通常経路と例外経路、透明RGBだけの差、実alpha/可視色の破損、evidence不一致の限定回帰試験を行う。
- evidenceの生成と承認は別の証拠として残し、数値的受理をGate 2自然さの合格へ転用しない。

source ownership待ちのため、この案は未実装。実runも未実行。実統合および実描画のreview判定は保留。

## 限定修正と再合成証拠の独立レビュー（更新）

**判定: source限定変更・既知入力の技術的例外はPASS。実run前の再合成blockerは解消。** rootのownership委譲後、別Gnomeがpipeline.py、新recomposition.py、test_recomposition.py、docs/warp.mdを変更。レビュー担当はsourceを変更していない。

sourceを直接確認し、通常経路がalpha最大差とpremultiplied RGB最大差を使い、raw透明RGBを可視差と混同しないことを確認。例外経路は明示evidenceのaccepted/reviewer/basis、素材参照の完全なhash集合、実再合成pixel hash、supporting artifact hashを検査する。source順序はassets JSON hashで固定。描画経路は証拠PNGや参照pixelsを受け取らず、差分修復なし。solver・支持規則・Gate 1検査は変更していない。run provenanceへ実測診断とevidence hashを残す。

独立再実行: 既存15 + 新4 = **19/19 unittest PASS、1.626秒**。透明RGBのみの差、局所色/alpha破損、pending・集合欠落・素材/mask/neutral/順序/pixel/support hash改変の拒否、実pipelineで例外を記録し差分を貼らないことを確認。

現物evidenceを実装者の検証関数だけに依存せず独立計算した。assets/neutral/14layer/2maskの18入力hash、3 supporting artifact hashが一致。独自の正規化premultiplied source-overと最終丸めで再合成し、保存B再合成PNGとpixel配列が完全一致。pixel SHA256=e316911600a4eef8198e716dc715719184529004d12f1aaa8d6dfeb12daf61d2。

- B対neutral: alpha最大差1、premultiplied RGB最大差2.9686274509803923、平均0.0022779564452327155、差1超2576画素（浮動誤差を避け1+1e-12基準）。
- B対Aの既承認再合成: alpha差0、premultiplied RGB最大差1、平均0.00002896489660724316、差1超0。
- B再合成の全身PNGを直接実見し、通常衣装・閉口・眼鏡を含む表示を確認した。browser実見ではない。

これにより既知A量子化残差を当該入力だけに許容する技術的根拠を確認。一般的な誤合成の黙認ではなく、hash変更時は再レビューが必要。

独立照合完了後、Orchの明示委譲に基づきevidenceのreview.status/basis/reviewerだけを更新した。元bytesをevidence-pending.jsonへ保全。非reviewフィールドの完全不変を再照合し、実check関数によるaccepted evidence受理も確認した。

- pending SHA256: 9c3b603985356baed9d09b9cfa271c1aa24b1b7ae11508cba34368b07172b662
- accepted evidence.json SHA256: 0e3a9f411d7293db524f15927cd61ca43e7bcae4a896db12fbda2e05c071ce9f

このacceptedは再合成証拠の独立技術reviewのみ。ユーザーのannotation snapshot、元素材、源画像を変更していない。Gate 2の自然さ・完成rigへの承認ではない。実runの出力と比較sceneのreviewは次段で行う。

## 初回実run v1の独立レビュー

対象: P/runs/comparison-1536-candidate-2-v1/。status=failedを正しく維持。3出力（flow-only中間、guided中間、flow-only最大）は存在するがguided最大は未生成であり、complete比較と称さない。

全input hash、source hash、3 PNGのhash/2048×3072寸法を実物照合。保存された6 mesh NPZから面積比を別計算しmanifest診断と一致。flow-onlyの眼鏡displacementは全頂点0。flow-only/guidedは同じsettings・素材・支持規則・rendererを共有し指定行のみ異なる。

最大guided顔を承認済みの同入力で独立にfitし、fold=33、collapse=110、最小面積比=-0.04393239016653603を再現。反転領域のsource bboxはx=1040..1080、y=511.706..551.265（正面画像右下の頬）、target bboxはx=1118.197..1141.650、y=498.923..535.492。33反転三角形中30のsource重心にvisible maskとface alphaの支持がある。透明mesh端だけの過剰停止とは扱えない。

技術的解釈: 現fitは二階差分smoothnessとsoft点/輪郭を使う無制約least-squaresで、正の面積は事後チェックのみ。点残差は最大約0.205pxでも、途中の局所圧縮・反転を防ぐ保証はない。座標やhash不整合は認めず、目標対応へ向かう変形の制御が不足した具体例とみる。閾値を下げて通すことは不可。根拠を記録した共通smoothness変更を両modeへ適用する再試行は、既存設計内の診断として妥当。指定変更や片modeだけの条件変更はしない。

画像を直接確認: 中間のflow-only/guided顔crop、最大flow-only頭部cropを実見。guidedの眼鏡は移動し、flow-onlyでは固定される。最大flow-onlyでは顔の移動により画像左側に大きな空きが現れる。これは固定前髪・後髪・耳等と動かしたface素材の境界も含み、face内部の目/まつ毛の引き伸ばしと区別する。画像が存在することを自然さの合格にはしていない。

rootの別観察: 中間の左目/まつ毛の斜め引き伸ばし、guided眼鏡の追随改善、最大flow-onlyの左顔側の空きと右側の肌片を指摘し、初回自然さは不合格と判断した。これはrootの観察であり、本reviewerの独立browser結果ではない。Gate 2ユーザー判断は未取得。

### closest-segmentの投影分布（v1の追加独立診断）

最大guidedを再現し、source輪郭の等弧長sampleを変形した後の最短target segmentを別計算した。右輪郭29sampleのtarget弧長は0→83.525へ単調増加、逆転0、始点/終点投影は各1点、6 segmentへの配分は[5,5,6,6,4,3]。したがって右下頬のfoldを、最終状態で多数の輪郭点が同一target端点へ吸着したことだけでは説明できない。flow-only右輪郭では始点へ2点、途中の同一折点へ3点が投影されたがguidedでは解消している。

左輪郭はguided31sample中5点がtarget始点へ投影、最大残差19.430px。部分的に見える区間の違いとclosest形状拘束の限界は別の課題として残る。左の現象を右下頬のfoldの直接原因と混同しない。

右側はsource曲線長110.753に対してtarget長83.525へ短縮し、位置も移る。境界と内部のflow/pointが要求する変位差を正向き制約のない平滑変形が繋ぐ際の圧縮という解釈が有力。ただし要因別の因果確定には追加ablationが必要であり、最終投影分布だけで断定しない。曲線のindex対応化は提案していない。

## 共通smoothness=16の再試行v2

対象: P/runs/comparison-1536-candidate-2-smooth16-v2/。**4出力生成・現物artifact/scene契約の技術照合はPASS。自然さは合格にしない。** v1から変わったsettingsはsmoothness 1→16のみと独立照合。input/source hashは全て同じ、両mode・両targetへ同条件を適用。

全input/source/frame/output hashを実ファイルで再計算。sceneのassets/annotations/flowManifestはrunが記録した正確な入力へ解決し、scene.outputsはrun.outputsと一致。8 NPZから面積比を別計算して診断と一致し、全三角形が既定下限0.05以上。guided最大顔の最小面積比は0.15398105120257352。source/rendererやmin_area_ratioを変更して通したものではない。

v2 scene.jsonとv1 scene-partial.jsonを独立validate_sceneで検証しPASS。v1はfailedラベルと3出力、最大guided欠損を保持。v2は4出力、Gate 2 pending。scene/run間の相対pathを二重変換していない。

v2 guided中間頭部、guided最大頭部、flow-only最大顔cropを独立実見。中間の左目/まつ毛の形崩れ、最大の顔左側の大きな空き、固定髪との境界不連続は残る。眼鏡の追随は対応点由来でありflow支持は0。折返し停止が解消したことを見た目の自然さと同一視しない。独立browserは依然未実施。

## 統合scriptの限定指摘

scripts/integrate_run.pyを直接確認。初版はannotation hashを照合する一方、CLI flowとsource scene側assetsをrunの実入力hashへ照合しない。今回v2現物は正しいが、同3frameを持つbaseline/1536などの別flowを誤って表示情報へ結合できる境界が残る。assets/flowの解決pathと実hashをrun.provenance.inputHashesへ照合し、別入力拒否の限定probeを追加するよう返却した。実runや出力PNGの再生成は不要。修正確認待ち。

## 統合script再レビューと最終技術判定

限定修正後のintegrate_run.pyとtests/integration/test_integration.pyを直接確認。assets/flowの解決絶対pathと実SHA256をrun.provenance.inputHashesへ照合してからsceneへ結合する。独立再実行で1 unittest内の2拒否probe（同じ3原画像を持つbaseline別flow、同bytesだが別pathのassets）がPASS、0.028秒。指摘は解消。v2画像の再生成は不要であり行っていない。

**最終判定: v2の承認入力→4条件の実描画→比較sceneの技術範囲はPASS。見た目の自然さは未達、Gate 2未承認、独立browser未実施。** v1はfailedの診断履歴、主提示はv2 complete。19件のwarp試験と、統合1試験内の2拒否probeを独立実行した。source実装とレビューは別contextで行った。

rootはv2でも自然さ未達と判断し、追加数値探索を止めた。fit-only ablationは実施していないため、flow/point/curve競合の因果分離は未完。今回の成功画像や数値から完成rig/格子工程へ進む承認は生じない。

表示制限: rootの実browser観察ではv1 partialの失敗metadata/labelが画面表面へ十分出ず、最大guidedは汎用disabledとして見える。partialは失敗診断履歴として明示的に紹介する必要がある。これはroot観察であり独立UI検証の代用ではない。v2は4出力を揃えた主比較として扱う。rootは専用tabでv2切替を確認中と報告されており、本reviewerはPNGと契約を検証した範囲を越えてbrowser PASSとは称さない。

残る問題は、中間の目/まつ毛の変形、固定周辺素材と顔移動による空き/境界不連続、眼鏡flow支持0、左輪郭の部分可視区間とclosest拘束の限界、姿勢に伴うsourceにない画素の扱い。ユーザーのGate 2評価を受け、原因別に次工程を設計する必要がある。


## 最大左側の灰色領域の限定画素確認

rootのbrowser観察を受け、v2最大のcanvas(972,514)と周辺をread-onlyで照合した。guided/flow-onlyの同点はRGBA=[217,214,215,255]で、static-band-0の同点と一致。static-band-1は[255,255,255,0]。正面では同点が肌色[255,241,237,255]だった。周囲9×9の両出力は全81画素alpha=255で、色分布はstatic-band-0と一致し、(968,510)/(976,518)/(980,520)の各対応画素も一致した。

従って、この観察箇所は最終PNGの透明穴ではなく、顔の移動によって露出した不透明な下側静的bandである。source顔素材の不足や透明checkerと断定しない。近傍1領域の確認であり、全境界・全画像の透明度を一般化した判断ではない。

rootはv2の全切替、共通crop固定、overlay OFFを実browserで確認済みと報告。独立browser未実施とは区別する。追加root観察として、眼鏡が参照の丸みより狭く斜めで、bridge2点だけでは形を十分に指定できていないと指摘した。source修正・再描画・追加探索は行っていない。
