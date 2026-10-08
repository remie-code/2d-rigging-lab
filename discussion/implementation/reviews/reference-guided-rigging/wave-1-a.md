# Wave 1 A 独立レビュー

2026-09-25。判定: **技術レビュー pass**。修正1 loopで指摘を解消。実参照の対応品質・比較画面・User Gateは **Wave 2 pending**。本判定は格子への適用やrig品質の承認ではない。

Reviewer: `/root/flow_wave1_a/review_compute`（Review-Sylph）。実装Gnomeとは別context。sourceを編集せず、実source、公式仕様、tests、binary、manifest、重み、環境記録を独立確認した。レビュー担当自身がCUDA smokeを別outputへ実行した。

## Basisと範囲

[Wave計画](../../../model-authoring/reference-guided-rigging/optical-flow-wave-plan.md)、scope-and-decisions.md、deformer-transfer.md、motion-review.md、experiments/face-x-registration.mdを確認。rootからの契約補足（canvas有効域 `[0,W)×[0,H)`、内側半セルのみ延長、非ゼロ寄与neighbor全valid、validityは精度保証でない）を適用した。Accepted User Gateを変更していない。

作業root Wは `C:/workspace/remie/rigging/second-rigging-6-sol`。Oは `W/reference-generation/optical-flow`。O/src、tests、scripts、requirements、README、weights、fixtures/compute、smokeを対象とした。B所有viewerとfixtures/viewerは本レビュー対象外。旧workspace成果物を参照していない。

## 指摘と修正確認

**P2・解消済み:** geometry.pyのsampleで、canvas座標からfield indexへの往復丸め誤差を真の補間寄与として扱い、格子中心上の有効点を隣接invalidのため無効にする場合があった。例: canvas=(2048,100)、field=(1,11)、index7のみvalid。centersから生成した点の逆変換が6.999999999999999となり、修正前はSAMPLE_INVALIDを返した。

Gnomeがfield indexの整数近傍だけ `4*float64 epsilon*max(1,abs(index))` でsnapする修正を実施。canvas内判定は厳密のまま。既存回帰に加え、reviewerはcanvas幅13/17/101/2048、field幅3/6/7/11/13の計160中心を独立に照合し全てpass。真の1e-9格子単位の寄与でinvalidが伝播する回帰もpass。未解消の指摘なし。

## 独立検証結果

- **全22 tests pass、skipなし。** 専用venvで `python -m unittest discover -s reference-generation/optical-flow/tests -v` を独立実行。初回17 tests時点でも独立実行し、その後に上記不具合を追加probeで発見した。
- **入出力:** frame順序・ペア順序、画像hash・共通canvas、raw little-endian float32 `[H,W,2]` のdx/dy、uint8 validity、bytes/shape/finite、manifest相対URL、既存出力上書き拒否を確認。実参照3枚をalignment-manifestから読み、元hashと2048×3072を照合した。
- **前処理・adapter:** RGBAを白へ合成してRGB化、bilinear/antialias=False、公式transformによる[-1,1]、8倍数かつ各辺128以上、最終iterationを使用。CUDA固定でCPU fallbackなし。canvasと推定格子の実寸法からdx/dyを軸別に復元する。
- **座標・合成:** pixel-edge-centers、異密度格子、`F02(p)=F01(p)+F12(p+F01(p))`、空間変化field、半セル延長、画像外、非finite、無効な中間、非ゼロ寄与neighbor、到着先、無効復活禁止をsourceと実行で確認。nonfinite保存時はfinite placeholderと無効理由を要求し、推定器のnonfiniteはrun失敗となる。
- **fixtureとbinary:** translation-v1、gpu-001、review-gpu-001の画像/vector/validity hash・bytes・有限性を確認。diagnostic reasons/residualのhash・shape・finite、reasonCounts/candidateCountと実binary、validityとreason bitsの整合を追加照合。f02再計算が保存vector/validityと完全一致した。translation-v1は40×30/80×60の異密度と人工invalid patchを含む。
- **依存と再現性:** requirements-lockの全12依存version/hashをpip-install-reportの実取得記録と照合し、installed distribution versionとも一致。独立 `pip check` は問題なし。setup.ps1、test.py、READMEの再実行手順と失敗記録を確認。空の別venvへの再インストールは独立レビューでは再実行していない。

## 独立CUDA実行の証拠

[review-gpu-001/manifest.json](C:/workspace/remie/rigging/second-rigging-6-sol/reference-generation/optical-flow/smoke/review-gpu-001/manifest.json) と [execution.json](C:/workspace/remie/rigging/second-rigging-6-sol/reference-generation/optical-flow/smoke/review-gpu-001/execution.json)。ReviewerがWをcwdに以下を実行しexit 0を確認した。

```powershell
$env:PYTHONPATH = 'C:/workspace/remie/rigging/second-rigging-6-sol/reference-generation/optical-flow/src'
& reference-generation/optical-flow/.venv/Scripts/python.exe -m flow_compute smoke --output reference-generation/optical-flow/smoke/review-gpu-001
```

RTX 4070 SUPER、torch2.8.0+cu128/torchvision0.23.0+cu128、CUDA runtime12.8。synthetic canvas288×192、推定192×128、12updates、4 model forward calls。elapsed3.6302秒、peak allocated48,145,408bytes。execution.jsonとmanifestのexecutionが一致し、manifest中の全6sourceHashesが最終sourceと一致する。

平均EPEはf01=0.10513、f12=0.07998 canvas px。この人工画像での学習器実測であり、数理の既知解・見た目AC・User Gateの合否には使っていない。gpu-001は初回sourceの記録、review-gpu-001を最終sourceの証拠とする。

## 公式情報と重み照合

[公式RAFT例](https://docs.pytorch.org/vision/stable/auto_examples/others/plot_optical_flow.html) の前処理・forward flow・最終iteration、[公式RAFT-Large仕様](https://docs.pytorch.org/vision/stable/models/generated/torchvision.models.optical_flow.raft_large.html) のC_T_SKHT_V2、[固定版v0.23.0実装](https://github.com/pytorch/vision/blob/v0.23.0/torchvision/models/optical_flow/raft.py) の重みURLを確認した。[公式過去version一覧](https://pytorch.org/get-started/previous-versions/) はtorch2.8.0/torchvision0.23.0/cu128の組を掲載している。

実重みは21,106,607bytes、SHA-256 `ff5fadd56d26b40647388883af1547351ea17868b765c05b27231e72dd16a322`。実ファイル、weights-provenance、GPU manifest、adapter固定値、download scriptの照合が一致する。

## Wave 2へ引き継ぐ限界

validity=1は幾何条件とFB consistency heuristicを通った候補であり、対応精度・確率・完全な遮蔽検出ではない。人工fixtureのvalidityは幾何条件と人工patchだけ。READMEとprovenanceはこれらを明記している。白背景合成はforeground maskではなく、背景/haloを部位運動の証拠にしない。

実参照512×768推定、顔・眼鏡・帽子・前髪・後ろ髪の対応品質、viewer接続と同位置表示、rootの画像観察、ユーザー判断は未実施。本レビューは小画像CUDA実行から実参照解像度の実行可否や見た目を保証しない。Accepted User Gateを満たしたとの主張なし。
