# Wave 2 独立レビュー

判定: **PASS（実参照の計算・統合・表示に対する技術レビュー）**。2026-09-25。
Reviewer: `/root/flow_wave2/review_integration`。review loop 1、軽微なREADME記述修正1件を解消。阻害する未解消指摘なし。

**部位対応の全面承認、格子工程、rig品質、Accepted User Gateは pending。** baselineを提示入口として保持し、1536は任意比較とする。高解像度の自動採用はしない。

## Basisと独立性

[Wave計画](../../../model-authoring/reference-guided-rigging/optical-flow-wave-plan.md)、共通契約v1と境界補足、Wave 1 A/B completion/review、scope-and-decisions、deformer-transfer、motion-review、face-x-registrationを読んだ。User Gateは変更していない。

W=`C:/workspace/remie/rigging/second-rigging-6-sol`、O=`W/reference-generation/optical-flow`。計算source、viewer、tests、両runのmanifest/raw binary/観察PNG、実入力と重みを直接確認。Gnomeとは別contextで既存試験、独自数値検証、専用cua_replタブの実操作を行った。GPU競合を避け、本reviewで実参照推定は再実行していない。旧workspaceのrigging成果物、他試験解答、editor source、git履歴は参照していない。書き込みは本報告のみ。

## Sourceと再現条件

計算側6sourceの実hashは両runのsourceHashesと一致。入力3枚はalignment manifest・原本・各runのコピーのhashが全て一致し、2048×3072。registration hashも一致。重みは21,106,607bytes、SHA256 `ff5fadd56d26b40647388883af1547351ea17868b765c05b27231e72dd16a322`、固定C_T_SKHT_V2と一致。

cli.pyは各隣接区間で画像順を逆転してbackwardを別推定し、計4回modelを呼ぶ。forward場の負号反転による代用はない。geometry.pyは移動先のbackwardを参照して残差を評価し、f02は移動先のf12から合成する。白へのalpha合成、公式normalization、軸別canvas単位復元、CUDA必須、CPU fallbackなしを確認。推定・表示に画像の局所描き換え、warp補正、都合のよい点の移動を認めなかった。

| run | 推定格子 | updates / FB | 実行記録 | peak allocated / reserved |
| --- | --- | --- | --- | --- |
| baseline-768-12 | 512×768 | 12 / 3 canvas px + .05 | CUDA、4 calls、4.7473秒 | 554,787,840 / 773,849,088 bytes |
| comparison-1536-12 | 1024×1536 | 同じ | CUDA、4 calls、8.4615秒 | 8,158,143,488 / 10,791,944,192 bytes |

execution.jsonはmanifest内記録と一致。両runは入力・重み・計算sourceを共有し、変更条件は推定解像度。上記時間は保存実行記録で、本reviewによる独立GPU再計測ではない。baselineコマンドはOの専用venvで `-m flow_compute run --registration reference-generation/alignment/alignment-manifest.json --output <新規run> --max-dimension 768 --updates 12 --fb-absolute 3 --fb-relative .05`（cwd W、PYTHONPATH=O/src）。比較はmax-dimension1536。

## 独立試験とartifact照合

- Python unittest **22/22 pass、skipなし**。Node `--test --test-isolation=none viewer/flow.test.mjs` **9/9 pass**。cwdはW、既存専用venv使用。数理・入出力・adapter・境界・無効伝播の既存試験を再実行した。
- 両runの全image/vector/validity/reasons/FB residualをhash・shape・byte数・有限性で照合。validity=(reason==0)、candidate/reason countが実binaryと一致。FB残差の-1 sentinelはsample-invalidと一致。FB不整合と画像外・補間無効を区別して保持する。
- baselineのf02をproduction関数で再計算し、vector/validity/reasonsが全点完全一致。別実装のbilinear合成でも393,216点のvalidityが全一致し、採用点vector最大差7.30e-6 canvas px。1536もproduction再計算で1,572,864点のvector/validity/reasons完全一致。
- viewerの実trace実装で両run全格子点を独立走査。baseline 393,216点、1536 1,572,864点の全validityがf02と一致。採用候補は148,821 / 658,306点、到達位置最大差7.30e-6 / 6.01e-6px。これは背景を含む整合性診断で、部位精度指標ではない。
- 8観察点×両runのpoints.jsonとviewer traceが一致（最大差2.12e-6px以下）。到達不能点に架空の終点を追加していない。
- observe_run.pyを読み、evidence.jsonのscript/run hashを照合。4crop×3frame×2runの**24枚の原画像cropは、入力の白背景合成cropとpixel完全一致**。画像補正なし。点注釈版は元cropへ到達点だけを描く。
- 最初の独自PNG照合はPython既定cp932によるJSON読込エラーで停止。UTF-8明示で再実行し全pass。製品失敗ではない。

FBの逆fieldそのものは保存されていない。したがって保存artifactだけからFB residualを完全に独立再算出することはできない。source・既存FB試験・4calls実行記録・残差binary整合を確認した範囲のpassであり、この再現限界を隠さない。

## 実ブラウザの直接観察

cua_repl createBrowserTabで独立タブを新規作成し、既存ユーザー/Gnomeタブを選択していない。

- [baseline表示](http://127.0.0.1:8769/optical-flow/viewer/index.html?manifest=../runs/baseline-768-12/manifest.json)と[1536表示](http://127.0.0.1:8769/optical-flow/viewer/index.html?manifest=../runs/comparison-1536-12/manifest.json)をそれぞれロード。実参照・採否未判定表示とrun別の経路差を確認。全fetchはno-store、画像hash検証あり。
- 初期頭肩cropは(670,40,640,960)、起点(1000,450)。顔・眼鏡、頭・肩、髪、胴体・腰のcropを実操作。頭を外さず、帽子と肩、髪束・胴体を観察できる。
- 顔cropで正面→中間→最大を即時切替し、同じ画面範囲に画像を描画することをスクリーンショット確認。フェードやフロー補間なし。顔cropのDOM観測は(850,340,330,250)、表示約514.8×390px。sourceでもframeに依存しない同じcrop変換を使用。
- 正面画像のクリックで正面起点が変わり、中間/最大のクリックでは変わらないことを実確認。数値入力は常に正面座標。overlay offで原画像だけに戻り、無効・疎矢印・経路を切替可能。
- 鼻付近P1はbaselineで第2区間停止し、最大を「追跡できません」と表示。f12/中間表示にすると顔右側や輪郭等の赤mask・無効×を確認できる。帽子P5も第2区間停止。背景にも矢印や赤が出ることを直接観察し、foreground maskと扱っていない。
- 1536ロード時のloading/点指定disabled→成功を実観察。DOM矩形再取得にcua selector timeoutが発生した箇所は、最新AXとスクリーンショットを取得して実操作を継続した。表示・操作が壊れた証拠はなかった。

スクリーンショットとAXの生証跡は本reviewerのcua tool出力。原画像・点付き画像の再現可能な証拠は各run/observations/。

## 部位の観察と妥当性

Gnome観察表を数値一致だけで承認せず、browserと頭肩/髪の点付きPNGを直接見た。

| 部位 | 独立観察・扱い |
| --- | --- |
| 眼鏡橋P2 | baseline (1000,450)→(1054.9,448.7)→(1102.5,437.7)。3枚で橋付近へ移る候補。髪との重なりがあり、厳密な同一点の保証はない。1536は第2区間で停止。 |
| 左レンズ下縁P3 | 両runで下縁付近を追う候補。最大はbaseline(1040.7,496.0)、1536(1041.8,501.2)。1536の点は線へ少し近く見えるが全体精度の改善を意味しない。 |
| 鼻付近P1 | baselineは中間後に停止。1536は最大(1105.2,479.4)まで候補となるが、画像上は鼻側特徴より左の頬付近。正面P1も明瞭な特徴線を基準とした手作業GTではなく、**意味的誤対応の疑い**として扱う。確定誤対応や鼻の正解点と断定しない。 |
| 帽子P5 | 白い猫マーク内の点は中間まで、両runとも最大へ停止。無地・幅の描き変わり・可視面変化が残る。 |
| 前髪P6 | baselineは橋近傍まで3点候補、1536は第2区間停止。毛先の厳密な同一性は不確実。 |
| 後ろ髪P7/P8 | 左カールは細線/halo/白背景の近傍で採用保留。右長髪P8は両runで同じ大きな束内に留まるように見えるが個別線の対応は未保証。 |

観察報告は有用な候補、停止、意味的にまだ使えない点を分けており妥当。背景・haloや首/襟の描き変わりをFace-X運動の証拠にしていない。髪cropはviewport fitで全体を見られる一方、細い線の判別には原寸crop PNGも必要。この制約は任意pan/zoomを今回の必須範囲へ追加する理由にはしない。

## 指摘・修正・残limits

軽微: viewer/READMEがWave1の2crop/他frameクリック規則のままだった。実装に合わせて実参照cropと「正面表示のみ画像クリック有効、数値は常に正面座標」へ修正されたことを再読確認。source修正要求なし。

残limits: validityは確率でも意味的正解でもない。FB整合する誤対応を除外しきれない。逆field未保存、自由pan/任意cropなし、1選択点、赤maskは連続補間無効領域の完全表示ではない。描き変わり・遮蔽・個別毛束・不可視面は未解決。高解像度化は一律改善しない。これらを示した完成候補として技術passとし、格子工程へ進めるかはユーザー判断に残す。

## 確認した版

SHA-256:

| artifact | hash |
| --- | --- |
| baseline manifest | acd2d63aafde8a020eae67373edb00188896122c4188fc6427029f70b717bd4f |
| comparison manifest | 92bd4808d8717299127fb1d33d340cc1548b4c22e672c09face7eae5beec0bda |
| viewer/app.mjs | e939b95b2a54fadd2c670896317acc3eac74fd86be85462d4f4531f810e90b10 |
| viewer/flow.mjs | af3351a654e1233f1bf5ea2bb13ca51e8e3574b116f269f9aece9d9350e29833 |
| viewer/index.html | a9319ff855ab752300ccc8c5923a3009aaa3d0f455233d0567289b8cd4bd8546 |
| viewer/style.css | 32970a0f02dbc3de8fb7b26a38e85eef82fda5338b25ba5d18e9a00dd5ae8ad7 |
| scripts/observe_run.py | 82f87154160966637a36a3909f8612068b0d5531dee96e465d194a021d5a5709 |
