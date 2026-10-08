# Wave 2 D 完了報告: 承認指定と保存flowの実画像統合

**技術統合は独立レビューPASS。v2は4画像の生成が完了したが、自然さはroot目視で未達。Gate 2はユーザー未承認。** completeは生成状態であり、自然さ・完成rigの合格ではない。

実施: Orch-Sylph landmark_wave2 → 別Gnome gnome_integration → 別Review-Sylph review_integration。source実装とreviewを分離。初回preflight不一致の報告後、rootから限定ownershipを取得して再開した。再合成の限定修正1回、統合scriptのレビュー修正1回。実画像条件は既定v1と共通smoothness16のv2の2回。追加sweep/ablationは行っていない。

## 主成果物

P = C:/workspace/remie/rigging/second-rigging-6-sol/reference-generation/landmark-warp。

- 主比較: P/runs/comparison-1536-candidate-2-smooth16-v2/scene.json
- http://127.0.0.1:8769/landmark-warp/viewer/?scene=../runs/comparison-1536-candidate-2-smooth16-v2/scene.json
- 同directoryにflow-only-midpoint.png、guided-midpoint.png、flow-only-endpoint.png、guided-endpoint.png（各2048×3072）、manifest.json、8 mesh NPZ、affected masks、integration-check.json。
- observations/<output-id>-face.png と -head.pngは共通範囲の観察補助。元のフル出力も保持する。
- 初回失敗run: P/runs/comparison-1536-candidate-2-v1/。3画像とfailed manifest、fold/curve診断、scene-partial.jsonを保全。最大guidedは未生成。これは診断履歴で主提示ではない。
- 承認snapshot: P/runs/approved-inputs/root-feature-candidate-2/。
- 技術手順/条件/限界: P/docs/integration.md、P/docs/warp.md。
- 独立review: ../../../implementation/reviews/reference-guided-rigging/landmark-warp-wave-2.md。

## 変更と試験

rootから委譲された限定変更はsrc/warp/pipeline.py、新recomposition.py、tests/warp/test_recomposition.py、docs/warp.md。統合用scripts/integrate_run.py、tests/integration/test_integration.py、docs/integration.mdを追加。solver、部品支持規則、renderer、元素材、元画像、alignment、既存Oの推定結果は変更しない。root所有plan/mapは担当側で変更しない。

Aが既に受領した8bit量子化残差を、Bのraw RGBA最大差検査が透明RGB差と混同して拒否する不一致を修正した。通常はalphaとpremultiplied RGBで検査。既知実素材は独立照合した全入力・再合成pixel hash・支持証拠に固定する明示recomposition-evidenceだけで受理し、一般閾値を拡大しない。証拠PNGや差分を出力へ貼り込む経路はない。B対A検証済再合成はalpha差0、premultRGB最大1/255。B対元正面は既知量子化の最大約2.9686/255、alpha差1。

Gnomeおよび独立Reviewerがwarp19試験PASS（既存15+新規4）。透明RGB、局所色/alpha破損、pending証拠、素材/mask/neutral/順序/pixel/support hash改変拒否を含む。統合1試験内の2拒否probeも独立PASS。統合script初版の別flow/assets混入余地を解消し、解決pathと実hashをrun入力へ照合する。同3画像の別flowを誤結合しない。現物v2の入力は当初から正しく、修正で再描画はしていない。

全input/source/frame/output hash、4出力の寸法、8 NPZの面積診断、sceneリベース・所属を独立照合。v1からv2は全4条件共通のsmoothness 1→16のみで、判定閾値0.05、flow、指定、素材、sourceは不変。flow-only/guidedの違いは指定行の追加のみ。raw f01と到着点のf12を使用、f02を使わず、生成参照を貼り込まない。

## 承認の保全

ユーザーの「うん、示された点の対応関係はほぼ完ぺきだと思う」をrootがGate 1として受領したplan末尾を根拠に入力を固定した。提示draftとsceneはbytes保存し、実行snapshotの変更はreview.status/basisだけ。幾何・visibility・revision・provenanceと元candidate/sceneは不変。3画像とflowの実hash/宣言/gate一致を別Reviewerが確認した。

- 提示draft SHA256: 3c33d72d759c60a2ad98c75efaf11eb137c1100000353f9f9749f4874a4d7926
- 実行annotations SHA256: e1b0aa591a90c0c82cedbc659b1396a020d1cff59e218af6f9ffffdf590cd257
- gate1-record SHA256: dba53a86c870821184af600e900255d295b21fd0252bac250a19cd583cdfeb32
- scene SHA256: bd29901d0200bcb932656bab1b01920d5d0cd4d77f719a9292442af216697c8d
- 独立受領済recomposition evidence SHA256: 0e3a9f411d7293db524f15927cd61ca43e7bcae4a896db12fbda2e05c071ce9f

再合成evidenceのacceptedは技術証拠のreviewであり、ユーザーの自然さ承認ではない。

## 実画像で分かったこと

初回v1は最大guided顔の反転33・潰れ110、最小面積比約-0.04393で停止。反転の多くは正面右下頬の可視肌にあり、透明meshだけの過剰停止ではない。点誤差最大約0.205pxでも形が反転した。無制約least-squaresと事後面積検査の組合せは点一致だけでは形を守れない。

右輪郭の最終投影先弧長は単調、端点各1sampleで、多数点が同じ端点へ吸着する説明は支持されなかった。一方、左輪郭31sample中5点はtarget始点に投影し、最大距離約19.43px。輪郭の部分可視区間と片方向closest距離の限界は残る。右の短縮と内部flow/点要求との競合が疑われるが、ablation未実施のため因果は断定しない。曲線indexを物質点対応へ変更していない。

v2は共通smoothness=16で4画像生成、fold/collapseは0、最大guided顔の最小面積比約0.15398。ただしrootとReviewerの画像観察では中間左目/まつ毛の形崩れ、固定髪との顔境界不連続、最大左側の灰色の空きが残る。数値の改善を自然さ合格にはしない。

灰色域の限定照合: 最大canvas(972,514)の両出力はRGBA[217,214,215,255]でstatic-band-0と一致、上側bandのalphaは0。周囲9×9もalpha255。ここは透明穴ではなく顔の移動で露出した不透明静的下地。源素材不足とは断定せず、この1領域から全境界へ一般化しない。

眼鏡は両targetともflow支持0。flow-onlyはidentity、guidedはbridge対応2点とsmoothnessによる変形。rootは追随の改善を認めたが、参照の丸みより狭く斜めで形状再現が不足すると観察。眼鏡にもflowが寄与したとは称さない。

## 表示確認と残る境界

独立Review-SylphのIAB providerは利用不可で、独立browser未実施。ReviewerはPNG実見・source・契約・hash・試験を確認。rootは専用tab8でv2中間/最大、参照/flow-only/guided全切替、共通crop固定、overlay OFFを実操作確認した。これを独立browser PASSに読み替えない。

v1 partialの失敗metadataは現UI表面へ十分出ず、最大guidedは汎用disabledに見えるとrootが確認。診断履歴として失敗を文章で明示し、v2を主提示にする。source UIの追加改修は今回は行っていない。

次工程案は原因を分ける。薄い眼鏡のfractional maskを>=.99で切る現支持規則について、部品境界を越えて補間せず、可視寄与を連続重みとして扱えるかを検討する。ただし元flow自体は合成画素から得ており、背景混合のmotionを部品固有と保証できない。支持数を増やすだけでなくeye­wear単独の対応と画像で確認する必要がある。顔の内部形状制御、固定髪・静的下地の扱いも別課題。今回は提案のみで実装/再生成を追加しない。

Accepted User Gateは不変。Gate 1指定を変えず、Gate 2はこの実比較をユーザーが判断する。数値/内部試験で代替しない。編集可能grid/完成rig工程へ進む承認はまだない。
