# レビューレポート: landmark-warp Wave 1 B 変形計算・描画

- 判定: 合格（Wave 1 の人工入力による技術基盤）
- ループ: 初回レビュー → 修正1回 → 再レビュー
- 担当: 独立 Review-Sylph。実装変更なし。
- Basis: discussion/model-authoring/reference-guided-rigging/landmark-warp-wave-plan.md の共通交換契約 v1、Wave 1 B、Accepted User Gate、および implementation-orchestration skill。
- P: C:/workspace/remie/rigging/second-rigging-6-sol/reference-generation/landmark-warp
- 変更対象: P/src/warp/{__init__,__main__,flow,solver,render,pipeline}.py、tests/warp/test_warp.py と verification.txt、fixtures/warp/{make_fixture.py,basic,run-basic,run-basic-loop1}、docs/warp.md、requirements.txt、専用 .venv。旧 run-basic-loop1 は修正前証跡であり最終 PASS artifact ではない。

## 設計適合

- raw adapter: flow.py:49,72,86。f01(p) と f12(p+f01(p)) を canvas px で連鎖し、f02 を読まない。invalid raw をゼロへ置換せず、有限性・範囲・validity・FB residual を支持重みに分離。実保存 baseline-768-12 manifest の read-only load も成功（f01 shape=(768,512,2)、manifestと8 field/diagnosticファイルの9 hashes）。実 guided は実行していない。
- 部品別支持: pipeline.py:94 と solver.py:88。face/eyewear で未知変位と支持を独立に作り、source-visible mask によって f01 の補間寄与を制限。隠れた領域の運動は外挿と明記。支持なしは identity fallback と warning。
- 点と輪郭: solver.py:58,70,119。点は barycentric 位置の2D対応。輪郭は等弧長 source sample から target segment への距離拘束であり、target 配列 index の物質点対応を作らない。反転順序と再分割の試験あり。
- 逆描画: render.py:22。変形先三角形から source へ barycentric 逆算し、premultiplied RGBA で補間。forward の単純負符号ではない。layer stack 順の合成と静的前景を保持。
- 診断: pipeline.py:20、solver.py:88、pipeline.py:171。不可視の埋め値、非有限、未知/曖昧 part、同一source点の矛盾を拒否。flow支持数、無支持頂点、点/輪郭残差、fold/collapse を記録。折返し・潰れは該当画像を出さず failed manifest にする。
- 比較条件: pipeline.py:116,156。同一入力・mesh・支持・正則化・renderer の2 targets×2 modesで、guidedのみ注釈行を追加。run outputs はscene-v1互換、pathはrun manifest基準。source/input/output hashとsettingsを保存。
- Gate保護: pipeline.py:102。real-referenceにはaccepted annotation revision/JSON bytes hashと3 frameの実ファイルhashに一致するGate recordが必要。素材neutralも承認flow neutralのpixelと照合。Gate確認を実装者による本人認証と称していない。
- source画像のみを移動し、生成参照の貼り付け・欠損画素の新規生成・差分画像での補修はない。元素材の再合成誤差を検査する。

## 指摘と修正確認

初回に1件のmust-fixを検出。旧pipelineの群alpha上限が各layer alphaのmaxだったため、alpha128のface layer 2枚からなる合法なsource-over寄与（約0.751957、8bitで192）を、max約0.501961超過として拒否した。独立人工probeで `ValueError: visible mask outside group source alpha` を再現してGnomeへ返却した。

修正後pipeline.py:139は `1 - product(1 - alpha_i)` を群alpha上限とする。tests/warp/test_warp.py:152の回帰試験を直接確認し、同群2層mask192、不透明前景0、半透明前景95、再合成誤差0、4出力の指定pixel一致を確認した。既存契約の正当な半透明重なりを受理する修正であり、差分補修ではない。

## 独立検証証跡

実装者の報告に依存せず、source・全テスト・fixture生成器・docs・run manifest・NPZ・PNGを直接確認した。

```powershell
$env:PYTHONPATH='C:/workspace/remie/rigging/second-rigging-6-sol/reference-generation/landmark-warp/src'
$env:PYTHONDONTWRITEBYTECODE='1'
& 'C:/workspace/remie/rigging/second-rigging-6-sol/reference-generation/landmark-warp/.venv/Scripts/python.exe' -m unittest discover -s 'C:/workspace/remie/rigging/second-rigging-6-sol/reference-generation/landmark-warp/tests/warp' -v
```

最終結果: 15 tests、1.308s、OK。identity、平行移動、空間変化するflowと真の逆描画、f12移動先評価、f02無視、部品漏れ、支持なし、非有限、不可視/矛盾、曲線の意味、fold/collapse、失敗artifact、透明度/順序、Gate/revision/hash、paired provenanceをカバー。

追加の独立確認:

- すべての局所三角形の面積が正（min area=2.781152949）の2周annulus変形を作り、rasterizeが `global mesh overlap detected at rendered pixel centers` で停止することを確認。局所Jacobian検査だけで終わっていない。
- 保存NPZを用いて同じ指定に対する残差を独立再計算。midpoint faceはflow-only 1.0000→guided 0.0721px、eyewear 1.0000→0.0705px。endpoint faceは2.0000→0.1442px、eyewear 2.0000→0.1409px。指定追加の効果がある。自然さの評価値ではない。
- 最終fixtures/warp/run-basic/manifest.jsonはcomplete、outputs=4。sourceHashes/inputHashes/output sha256のすべてを実ファイルと再照合して一致。
- guided-endpoint.pngを画像として直接確認。人工face/eyewear、静的前景と移動結果が描画されている。browserはB対象外で未実施。

## 裁量判断

部品別piecewise-affine mesh、LSMR、2階差分正則化、soft点拘束、反復closest-segment曲線拘束、微小identity gauge、可視支持の保守的閾値はplanの技術裁量範囲。重みは確率ではなく、設定と限界をdocsに記録している。

点拘束単体試験の0.2px→0.36px許容変更は、要求変位約3.606pxに対するsoft拘束残差約0.272pxを扱う。planに0.2pxの必達仕様はなく、別のpaired runで残差改善も確認できるため、失敗隠しとは判定しない。拘束は厳密一致ではなく診断で残差を公開する。

## 残課題と適用限界

必須修正の残件なし。ただし以下をWave 2へ継承する。

- f12側の部品maskは存在せず、qに同じ物質があることは独立に証明されない。source支持とFB/validityのヒューリスティックが残る。
- global overlap検知は描画pixel centerに限られ、subpixelを含む連続単射性は未証明。
- 曲線は片方向形状距離でありtarget全長の被覆保証はない。soft重み/spacing、局所最適、拡大補間の限界がある。
- 実素材でのメモリ、速度、境界、露出欠損と自然さはGate 1後のWave 2対象。runをsceneへ結合するときは相対pathをリベースする。
- Gate 1/Gate 2未承認。今回のPASSや数値をユーザーによる指定・自然さ判断に代用しない。格子/rig保存工程へ進む承認ではない。