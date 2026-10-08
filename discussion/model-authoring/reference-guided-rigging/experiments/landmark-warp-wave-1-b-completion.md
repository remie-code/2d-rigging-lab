# Wave 1 B 完了報告: 変形計算・描画

- 判定: 人工入力での技術実装完了、独立 Review-Sylph PASS。
- レビュー: 初回レビュー後の修正1回、再レビューで合格（2 review passes）。
- Gnome が source/tests を実装し、別コンテキストの Review-Sylph が basis/source/tests/artifact を直接検証。Orch-Sylph は実装していない。
- 実画像 guided は未実行。Gate 1 / Gate 2 未承認、Wave 2 未開始。数値合格は自然さの判断を代替しない。

## 変更範囲

P = C:/workspace/remie/rigging/second-rigging-6-sol/reference-generation/landmark-warp

- P/src/warp/{__init__,__main__,flow,solver,render,pipeline}.py
- P/fixtures/warp/make_fixture.py、basic/、run-basic/。修正前の人工runはrun-basic-loop1/に退避。
- P/tests/warp/test_warp.py、verification.txt
- P/docs/warp.md、P/requirements.txt、P/.venv
- 独立レビュー: C:/workspace/remie/code/ai-native-live2d-editor/discussion/implementation/reviews/reference-guided-rigging/landmark-warp-wave-1-b.md

O の環境・requirements・runs、元PSD、既存成果物は変更していない。旧Astra成果物は参照していない（指定されたimplementation-orchestration skillのみ例外）。

## 検証結果と修正

GnomeとReview-Sylphの独立実行で15/15 unittest PASS。review再実行は1.308秒。identity、既知平行移動、affine flow、非一様forwardの逆描画、f12の移動先評価、f02無視、部品支持漏れ、不可視、非有限、支持なし、点と輪郭の相違、輪郭の再分割と方向反転、矛盾指定、fold/collapse、failed artifact、premultiplied alpha、静的前景順序、Gate revision/全frame hash、paired provenanceを検証した。

初回レビューで、同群の半透明レイヤが重なる合法入力を最大単層alphaで誤って拒否する不具合を再現。支持上限をsource-overの合成群alphaへ修正した。alpha128の2層と不透明/半透明の前景による遮蔽の回帰試験を追加し、再合成誤差0と出力pixel一致を確認した。

人工run: P/fixtures/warp/run-basic/manifest.json、status=complete、midpoint/endpoint × flow-only/guidedの4 outputs。reviewerが全source/input/output hashの一致を確認した。点残差の独立再評価はfaceがmidpoint 1→0.0721 px、endpoint 2→0.1442 px、eyewearが1→0.0705 px、2→0.1409 px。これは人工条件の指定追加の効果であり、自然さの合格値ではない。全局所面積が正の2周annulus meshによる独立probeでglobal overlap停止も確認した。既存real baseline manifestはadapterのread-only loadのみ確認し、実guidedは実行していない。

## 採用技術と裁量

P専用Python 3.11.0 / NumPy 2.4.6 / SciPy 1.17.1 / Pillow 12.1.1。正面座標の部品別三角形meshの変位を疎least squaresで求める。flow支持はsource-visible領域に限定し、faceとeyewearで未知数・支持を共有しない。2階差分・混合差分の正則化と微小identity gaugeを使用する。点はbarycentricのsoft対応、輪郭はclosest-segmentへの形状距離とし配列index対応にしない。描画は変形先三角形からsourceへbarycentric逆写像でpremultiplied RGBAを標本化する。

raw f01(p)とf12(p+f01(p))を連鎖しf02を開かない。validity/FB residualは技術的な支持重みであり確率ではない。flow-only/guidedは素材・flow・mesh・visible mask・正則化・描画条件を共有し、guidedだけ注釈行を追加する。fold/collapseとpixel centerで検出するglobal overlapは診断して出力を停止する。支持が全くなければ明示identity fallbackとwarningを記録する。

## CLIと消費契約

PowerShell:

```powershell
$P = 'C:/workspace/remie/rigging/second-rigging-6-sol/reference-generation/landmark-warp'
$env:PYTHONPATH = "$P/src"
& "$P/.venv/Scripts/python.exe" -m warp --assets <assets.json> --annotations <annotations.json> --flow <flow-manifest.json> --output <new-empty-run-dir> --spacing 8
```

実入力にはさらに --gate1-record <approval.json> が必要。recordはstatus=accepted、basis、revision、annotationSha256、frames:{neutral:sha,midpoint:sha,endpoint:sha}。注釈review.accepted、revision、実JSON bytes hash、flowの3画像の宣言/実hashとの一致を検証する。assets neutralImageも承認flow neutralとRGBA pixels一致を要求する。承認記録は人間の判断後にrootが扱い、実装側が代行作成しない。共通必須契約の変更はない。

出力manifestはlandmark-warp-run-v1。outputsはsceneと同じid/mode/targetFrameId/image/affectedMask/diagnosticsにsha256を追加する。相対pathはrun manifest基準のため、Dがsceneへ結合する際にリベースする。provenanceにinput/source hashes、annotation revision/hash、Gate証拠hash、全settings、software、比較条件を保持する。失敗runはstatus=failedであり、先行PNGがあっても成功扱いにしない。

## 限界と次の境界

f12生成参照側の部品maskがないためqが同じ部品であることは独立に保証できない。subpixel global overlapの連続単射性は未証明。soft拘束、輪郭の局所解と片方向距離、mesh密度、隠れた頂点の外挿、拡大補間に限界がある。新たに露出する元素材欠損は透明のままで、参照の貼付けや画像生成で埋めない。実画像の速度/メモリ/自然さはGate 1後のD統合で確認する。

Bの実browser検証は担当外で未実施。人工テストと独立レビューの合格をGate 1/2へ自動継承しない。BはWave 1完了で停止し、実参照guidedやWave 2を独断で開始しない。