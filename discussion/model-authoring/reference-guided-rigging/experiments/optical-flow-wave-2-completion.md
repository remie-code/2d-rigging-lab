# Optical Flow Wave 2 completion

2026-09-25。状態: **実参照の試作・統合・独立技術レビュー PASS**。review loop 1、軽微なREADME説明修正1件を解消。Accepted User Gateは **pending**。格子工程・rig適用は開始していない。

## 成果と選定run

- [提示入口: baseline-768-12](http://127.0.0.1:8769/optical-flow/viewer/index.html?manifest=../runs/baseline-768-12/manifest.json)
- [任意比較: comparison-1536-12](http://127.0.0.1:8769/optical-flow/viewer/index.html?manifest=../runs/comparison-1536-12/manifest.json)
- 実manifest: [baseline](http://127.0.0.1:8769/optical-flow/runs/baseline-768-12/manifest.json) / [1536](http://127.0.0.1:8769/optical-flow/runs/comparison-1536-12/manifest.json)
- [部位観測と原画像・点付きPNG](C:/workspace/remie/rigging/second-rigging-6-sol/reference-generation/optical-flow/runs/baseline-768-12/observations/report.md)、[同じ8点の解像度比較](C:/workspace/remie/rigging/second-rigging-6-sol/reference-generation/optical-flow/runs/baseline-768-12/observations/comparison.md)、[実装検証記録](C:/workspace/remie/rigging/second-rigging-6-sol/reference-generation/optical-flow/runs/baseline-768-12/observations/verification.md)。

原画像を同じ位置・倍率で即時切替。実参照用の頭・肩、顔・眼鏡、髪、胴体・腰cropを追加し、初期点は眼鏡橋(1000,450)。画像クリックは正面表示時のみ、数値指定も常に正面起点であることを明示した。経路・疎矢印・不確実領域と原画像だけの表示を切り替えられる。人工fixtureは別kindのまま維持。

指定baselineの後、root依頼で入力・12updates・FB閾値3px+.05を固定して解像度だけ比較した。baselineは推定512×768、CUDA4.7473秒、peak allocated554,787,840 bytes。1536は1024×1536、8.4615秒、8,158,143,488 bytes。ともに4 model forward、OOMなし、CPU fallbackなし。入力・計算source・重みhash、条件、診断、実行記録を各runへ保存した。高解像度は一律改善せず、rootが画像確認のうえbaselineを入口、1536を任意比較とする方針を了承した。これはUser Gateではない。

## 部位観察

| 部位 | baselineでの点・観察 | 1536比較と限界 |
|---|---|---|
| 眼鏡橋P2 | (1000,450)→(1054.9,448.7)→(1102.5,437.7)。橋近傍を追う候補 | 第2区間停止。髪との重なりがあり厳密な同一点は未保証 |
| 左レンズ下縁P3 | (930,509)→(979.8,508.1)→(1040.7,496.0)。同じ下縁近傍 | 最大(1041.8,501.2)で線へ少し近い候補。全体改善の証明ではない |
| 鼻付近P1 | (998,487)→(1051.0,486.1)→停止 | 最大(1105.2,479.4)までvalidity1だが頬側に見える。正面も明瞭な特徴線を使う手作業GTではなく、意味的誤対応の疑い |
| 右レンズ外縁P4 | (1100,458)→(1141.8,458.3)→停止 | 第1区間から停止。最大での幅変化・遮蔽が残る |
| 帽子猫P5 | (1130,276)→(1164.6,274.9)→停止 | 両run停止。描き変わりと可視面変化を分離できない |
| 前髪P6 | (1020,449)→(1072.5,447.9)→(1115.4,437.1) | baselineは候補でも毛先同一性が不確実、1536は第2区間停止 |
| 後ろ髪P7/P8 | 左カール(675,630)と右長髪(1400,1200)は最大まで候補 | 左カールは細線/halo近傍で保留、1536は初段停止。右長髪は両runで大きな束内に留まるが個別線は未保証 |

[baselineの顔点付き画像](C:/workspace/remie/rigging/second-rigging-6-sol/reference-generation/optical-flow/runs/baseline-768-12/observations/face-endpoint-points.png)と[1536の顔点付き画像](C:/workspace/remie/rigging/second-rigging-6-sol/reference-generation/optical-flow/runs/comparison-1536-12/observations/face-endpoint-points.png)をrootも直接確認済み。各run reportから3frameの原画像・点付き頭/顔/髪/胴体crop、全精度座標へ辿れる。停止先を捏造せず、失敗・不確実例を残した。

## 分担と独立review

[Accepted plan](../optical-flow-wave-plan.md)に従い、Orch `/root/flow_wave2`、別contextのGnome `gnome_integration`、独立Review-Sylph `review_integration`で実行。Accepted User Gate全文を両担当へ継承し変更していない。Orchはsourceを実装していない。

変更はO/viewerのapp.mjs・index.html・style.css、両README、scripts/observe_run.py、2run成果物。計算src、承認済み入力、既存alignmentビュー、rig、editor sourceは不変。専用venvを再利用し依存追加なし。GPU推定は直列。

[独立レビュー wave-2.md](../../../implementation/reviews/reference-guided-rigging/wave-2.md)は **PASS、未解消blockingなし**。Python22/22、Node9/9、両runのinput/source/重み・全binary/診断照合、f02全点再計算、viewer trace全393,216/1,572,864格子とのvalidity一致、8点×2runの経路一致、原画像crop24枚のpixel一致を確認。独立cua browserでcrop・即時切替・正面のみクリック・overlay・停止・実画像の意味的限界を確認した。数値成功を部位の自然さpassにはしていない。

GnomeとreviewerのC側browser操作は終了。Gnomeの成果専用tabはbaselineを保持し、review専用tabは閉じた。rootが最終手動確認可能。地図とwave状態の登録はrootへ依頼する。

## 残る限界とUser Gate

validity1はFB heuristic候補で確率・意味的正解ではない。背景・halo、首/襟の描き変わりは運動証拠にしない。遮蔽・不可視面・個別毛束・画像生成差分は未解決。逆field自体は未保存で、保存artifactだけからFB residualを完全独立再算出できない点も明記した。自由pan/任意cropなし、選択点1つ、赤maskは連続補間の無効領域の完全表示ではない。

使える候補とまだ使えない候補を画像上で説明できる完成候補として提出する。rootの最終UI確認とユーザーによる「格子への次工程に進める」判断はpending。追加推定や格子工程を自動開始しない。

