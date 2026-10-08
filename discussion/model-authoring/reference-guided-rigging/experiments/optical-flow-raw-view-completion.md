# 棄却前推定表示 completion

2026-09-25。限定follow-up完了。**独立レビューはsource・関連tests・実artifactの数理/不変性に限定してPASS**、修正loop 0、未解消source指摘なし。Gnome/Reviewの実browser検証は環境不可で未実施。rootが別途表示を目視した。**User Gate・推定採用・自然さ・rig品質は未判定**。

## 成果と操作

- [高解像度の比較ビュー](http://127.0.0.1:8769/optical-flow/viewer/index.html?manifest=../runs/comparison-1536-12/manifest.json)
- [baselineの比較ビュー](http://127.0.0.1:8769/optical-flow/viewer/index.html?manifest=../runs/baseline-768-12/manifest.json)
- [実装・検証記録](C:/workspace/remie/rigging/second-rigging-6-sol/reference-generation/optical-flow/viewer/raw-view-verification.md) / [操作説明](C:/workspace/remie/rigging/second-rigging-6-sol/reference-generation/optical-flow/viewer/README.md)
- [独立レビュー](../../../implementation/reviews/reference-guided-rigging/raw-view.md)

同位置の原画像切替を保ち、「棄却前の推定（破線・診断用）」で保存済み推定の経路を表示する。採用経路は実線・塗り丸、診断経路はピンク破線・空四角R1/R2/R3。初期off。正面の任意点へ利用できる。採用が止まる区間と補間近傍の棄却を簡潔に説明し、理由不明を往復不整合とは断定しない。

確認例は「顔・眼鏡」crop、正面起点(998,572)、棄却前表示on、1/2/3で切替。顎用の処理や座標hardcodeはなく、同じ計算を任意点に適用する。

## 検証と不変条件

[plan末尾の限定follow-up](../optical-flow-wave-plan.md)とAccepted User Gate全文・追加趣旨をGnome/Reviewへ継承。Orchはsourceを実装せず、別contextのGnomeがviewerを実装し、別Review-Sylphが独立確認した。

変更はviewerのflow.mjs/app.mjs/index.html/style.css/flow.test.mjs/README.mdとviewer内検証記録のみ。入力/run/flow/validity/閾値/推定器・計算sourceは不変、GPU再推定なし。両runのmanifest、各14artifact、全計算sourceの不変をreviewerが照合した。

rawは採否maskだけを外し、f01から移動先qを求め、qでraw f12をbilinear補間する。無効部が置換されうるf02は使用しない。非有限・画像外・記録から判明した復元不能値は追跡を止め、到達先を捏造しない。理由情報がない有限placeholderの由来は判別できない限界を明記。

関連Node **14/14 pass**、app構文検査pass。maskで採用が止まりrawは続く例、空間変化f12、画像外/非有限、raw offの既存挙動、理由欠損を確認。実artifactの顎と他の任意5点を独立bilinear計算で照合し一致した。

| run | raw中間 | raw最大 | 採用経路 |
|---|---|---|---|
| baseline | (1014.6031,571.2668) | (1016.9775,568.6567) | 第1区間停止 |
| 1536 | (1039.4805,570.8366) | (1076.0113,566.8146) | 第1区間停止 |

上表は起点(998,572)から得た測定値であり、対応の正解・美的閾値ではない。

## Browserの区別とroot観察

Gnomeの新規IAB作成は「Browser is not available: iab」、Gnome/Review双方のcua.getStateはapps:[]/browsers:[]だった。両担当は専用tabを作成できず、既存user tabも操作していない。独立browser検証・担当スクリーンショットは未実施/未取得。この不足をsource/testsのPASSで代替したとは記録しない。

rootは自身のcuaで新規専用tab3を開き、高解像度の顔crop・起点(998,572)・raw onで正面/中間/最大とR1/R2/R3を直接観察した。採用は初段停止のままraw3点が表示され、中間R2は顎先近傍、最大R3は顎先より少し左の下顎近傍と報告。baselineも別一時tabの最大画像で確認し、R2/R3がほぼ重なり首側に残って高解像度と明確に異なると観察した。原user tab2は未変更。これはrootの目視結果で、独立reviewerのbrowser証拠やユーザー品質承認とは分ける。

担当側browser作業は終了、sourceは凍結。地図登録とユーザーへの最終提示はroot所有。表示できた推定が利用に足るかはユーザー判断に残し、意味補正・格子適用は未着手のまま。

