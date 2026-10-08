# 棄却前推定表示: 限定独立レビュー

2026-09-25。Reviewer: `/root/flow_wave2/review_integration`。修正loop 0。

判定: **PASS（source・関連tests・実artifactの数理/不変性に限定）**。未解消のsource指摘なし。**本reviewerによる実browser検証は環境利用不可のため未実施**。rootの別途目視報告は下記に分離する。User Gate、推定の採用、自然さ、rig品質は未判定。

## Basisと範囲

[Wave計画の限定follow-up](../../../model-authoring/reference-guided-rigging/optical-flow-wave-plan.md)「棄却前の推定を可視化する（2026-09-25合意）」と追加User Gateを読了。implementation-orchestrationに従いGnomeとは別contextで確認し、sourceは編集していない。

W=`C:/workspace/remie/rigging/second-rigging-6-sol`、O=`W/reference-generation/optical-flow`。source対象はviewer/flow.mjs、app.mjs、index.html、style.css、flow.test.mjsとREADME。両runのmanifestと既存binaryを直接読んだ。旧Astra成果物、他試験解答、editor source/ref/closed-problems/research、git履歴を参照していない。GPU再推定なし、レポート以外の書き込みなし。

## Source適合

- sampleのignoreMaskはvalidity棄却だけを外す。非ゼロ寄与の非有限vector、非有限起点/計算結果、画像外起点は停止。reasonBits.nonfiniteの記録がある有限placeholderも復元不能として停止する。
- traceRawはraw f01から中間qを求め、そのqでraw f12をbilinear補間する。masked f02は参照しない。canvas内の端の半セルだけ延長する。
- 画像外への到達位置は診断結果として返せるがcomplete=falseとなり、次fieldは参照しない。画面内の到達点として捏造しない。
- 任意の正面点に同じ演算を適用する。顎座標、手作業正解、輪郭/ランドマーク、意味補正、位置補正はsourceに埋め込まれていない。
- raw表示は初期off。traceDisplayのoffでは既存採用経路だけを返し、raw続きを評価しない。描画sourceはrawをピンク破線/空四角R1–R3、採用経路を実線/塗り丸に分ける。診断用で採用候補ではないと説明し、座標はdetailsへ収納する。raw/overlay切替と即時frame切替の配線を確認した。実際の描画品質は本reviewでは未観察。
- 第1/第2区間を分け、非ゼロ補間近傍の棄却を説明する。往復不整合はreasonMapと該当bitがある場合だけ「記録を含む」と表現し、理由なしは「詳細は未特定」。現在runのFB bitは16。residualは読み込まず、不在をFB不整合と推論しない。
- optional reasonsのbyte数と提供されたhashをloaderで検証する。理由が記録されていない有限placeholderの起源は識別できないことをREADMEが明記する。

## 独立実行の証拠

cwd Wで `node --test --test-isolation=none reference-generation/optical-flow/viewer/flow.test.mjs` を実行し **14/14 pass、skipなし**。`node --check reference-generation/optical-flow/viewer/app.mjs` もpass。

新規関連ケースは、両区間mask停止/raw続行、空間変化f12のq評価、f02不使用、画像外後の次field非参照、非有限/非有限由来placeholder停止、重み0の無視、reason16のみFB説明、raw offの採用経路不変を含む。既存9件も通過。広いPython/GPU再検証は行っていない。

両runのmanifest hashが[Wave2 review](wave-2.md)で記録した値と一致。各runにつき画像3枚、vector3、validity3、reasons3、FB residual2の計14artifactをmanifest hashと独立照合。計算側全6sourceのhashもmanifestと一致。したがって入力・flow・mask・条件・推定器sourceの変更を認めなかった。

| run | manifest SHA-256 |
| --- | --- |
| baseline-768-12 | acd2d63aafde8a020eae67373edb00188896122c4188fc6427029f70b717bd4f |
| comparison-1536-12 | 92bd4808d8717299127fb1d33d340cc1548b4c22e672c09face7eae5beec0bda |

起点(998,572)を実binaryから独立ロードして確認。両runとも採用経路は第1段の補間近傍maskで停止し、rawのみ3点となる。

| run | raw中間 | raw最大 |
| --- | --- | --- |
| baseline | (1014.603053,571.266783) | (1016.977515,568.656652) |
| 1536 | (1039.480508,570.836645) | (1076.011312,566.814571) |

両区間の寄与近傍にreason16が実在することも確認。顎に限定されない検証として、同じ起点と(1000,450)、(675,630)、(1400,1200)、(351.25,812.75)、(1766.5,2001.125)の計6点×2runを別bilinear実装で計算し、viewer raw計算との差は0だった。確認用座標はsourceの正解hardcodeではない。raw-probe-results.jsonの顎結果も独立計算と一致。

## Browser確認の分離

本reviewerのcua_repl `cua.getState()` は `{apps:[],browsers:[]}` を返した。既存ユーザーtabには触れず、別技術によるbrowser代替や繰返し再試行は行っていない。前回Wave2のbrowser PASSを今回の変更へ継承しない。本担当のbrowser作業は終了、今回作成したtabなし。

Orch経由で受領したroot報告（本reviewerの直接観察ではない）: rootは専用tab3で1536、顔crop、正面(998,572)、raw ONの3frameとR1/R2/R3を確認。採用初段停止、raw3点。中間R2は顎先近傍、最大R3は顎先より少し左の下顎近傍に見える。元user tab2は未変更。これはUser Gateではない。rootの画面確認は独立source/testsレビューの代用ではなく、別の目視証拠である。

## 結論と残limits

source・数理・artifactに阻害指摘なし。診断経路は保存された推定を見えるようにするだけで、採用maskを変更しない。意味的対応の正しさ、誤差が利用に足るか、表示の見やすさは数値通過から結論しない。非有限由来の記録がないplaceholderは判別不能、復元できない情報は作らない。格子適用・意味補正は未着手。ユーザーはrootの実表示を見て判断する。

## レビュー対象版

SHA-256（O相対）:

| file | hash |
| --- | --- |
| viewer/flow.mjs | c9a359302d1d7d7003f75776609d467f40220cd34e965012ad811730bdee775c |
| viewer/app.mjs | 156876e33f8805fc14c553c946104aa3a7e420116f18262c1d01a05a642af5ae |
| viewer/index.html | c73f3ba9175f3b14f874a4f4a9b1aca9fb4b610ca018e1606c88005cc7c793ea |
| viewer/style.css | 6c5f323e6cb9ac426e2cb0e9b09697f8ba379ba403efb418bc3a4fe7d296c1d9 |
| viewer/flow.test.mjs | c1a45f7963f6ea7f4875dcb0c7d8ecf465624a95525b5da0d30ec6513634501b |

追記（最終記録確認）: raw-source-hashes.jsonの6ファイルを実ファイルのSHA-256へ照合し全一致。README、raw-view-verification.mdの最終記載も確認した。Orch経由の追加root観察では、baselineも別一時tabで同じ顎点/raw ON/最大を確認し、R2/R3がほぼ重なって首側に残り、1536と明確に異なったとのこと。これはrootの観察報告であり、本reviewer自身のbrowser確認には数えない。rawの取得可否と対応としての利用可否を分けてユーザーへ提示する。
