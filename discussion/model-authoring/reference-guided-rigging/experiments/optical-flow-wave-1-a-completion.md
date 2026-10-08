# Optical Flow Wave 1 A completion

2026-09-25。状態: **計算基盤と独立技術レビュー pass**。修正1 loopで指摘を解消。実参照の最終推定・viewer統合・見た目の評価・Accepted User Gateは **Wave 2 pending**。

## Basisと責務

[Accepted Wave計画](../optical-flow-wave-plan.md) と共通交換契約 reference-flow-v1（root採用の境界補足を含む）に従った。Orch-Sylph `/root/flow_wave1_a` が管理、別contextのGnome `gnome_compute` がsource実装、別contextのReview-Sylph `review_compute` が独立検証した。Orchはsource実装を行っていない。Accepted User Gate全文を両担当へ継承し、変更していない。

W: C:/workspace/remie/rigging/second-rigging-6-sol  
O: W/reference-generation/optical-flow

A所有のsrc、tests、scripts、weights、.venv、requirements、README、fixtures/compute、smokeのみを実装対象とした。入力・rig・editor sourceを変更していない。Bのviewer/fixturesは所有外。画像を外部サービスへ送信していない。

## 選定と裁量判断

公式実装と重みがあり、独自CUDA extensionのビルドを必要とせず、前処理とflowの意味が明示されたtorchvision RAFT Largeをbaselineに採用。`Raft_Large_Weights.C_T_SKHT_V2` を明示固定する。最新/最高精度やアニメ絵での品質を保証する選択ではない。

公式根拠: [RAFT-Large](https://docs.pytorch.org/vision/stable/models/generated/torchvision.models.optical_flow.raft_large.html)、[前処理とforward flowの公式例](https://docs.pytorch.org/vision/stable/auto_examples/others/plot_optical_flow.html)、[固定版v0.23.0 source](https://github.com/pytorch/vision/blob/v0.23.0/torchvision/models/optical_flow/raft.py)、[公式version組合せ](https://pytorch.org/get-started/previous-versions/)。

専用venvにPython3.11.0、torch2.8.0+cu128、torchvision0.23.0+cu128を導入。GPUはRTX4070 SUPER、driver595.97、CUDA runtime12.8。global Pythonは変更していない。初期pip22.3の名称解決問題をvenv内pip25.2固定で解消した。torch wheel約3.46GBは既存pip cacheを利用し、同じdownloadの並列重複はしていない。

公式重みは21,106,607bytes、SHA-256 `ff5fadd56d26b40647388883af1547351ea17868b765c05b27231e72dd16a322`。全12依存のversion/wheel SHA-256はrequirements-lock.txt、配布URLと実取得hashはsmoke/pip-install-report.json、重み情報はweights/weights-provenance.jsonに保存。取得時・実行時の重み検証を行う。

## 実装結果

[READMEと再実行手順](C:/workspace/remie/rigging/second-rigging-6-sol/reference-generation/optical-flow/README.md) に詳細を集約。

- `src/flow_compute/{geometry,bundle,raft,cli,__main__,__init__}.py`: 登録入力のhash/サイズ/順序、RGBA白合成とRGB前処理、CUDA推定、canvas単位復元、forward隣接flowとf02合成、診断、manifest/raw binary入出力。
- `tests/test_{geometry,bundle,adapter}.py`: 数理、入出力、adapterの検証。
- `scripts/{setup.ps1,download_weights.py,flow.py,test.py}`、requirements.txt/requirements-lock.txt: 環境再現と実行入口。
- [計算fixture](C:/workspace/remie/rigging/second-rigging-6-sol/reference-generation/optical-flow/fixtures/compute/translation-v1/manifest.json): canvas320×240。f01は40×30格子で(12,-4)、f12は80×60格子で(8,6)、f02は(20,2)。人工invalid patchを含む。実参照の結果ではない。
- [最終sourceでの独立GPU成果物](C:/workspace/remie/rigging/second-rigging-6-sol/reference-generation/optical-flow/smoke/review-gpu-001/manifest.json): 最終6sourceのhash、入力、条件、全binary、実測を保存。gpu-001は修正前の初回証拠として区別。

交換契約の必須項目・意味は維持。optional diagnosticsにreason bits、FB residual、candidate/reason countを追加した。非finite、画像外、入力無効、補間先無効、FB不整合を区別する。画像外は無効、画像内の端の半セルのみ延長、非ゼロ寄与neighbor全てfinite/validの場合だけ補間採用。異密度でもF02(p)=F01(p)+F12(p+F01(p))で合成する。

実推定のvalidityは幾何条件とforward/backward consistencyのheuristicを通った候補。既定閾値は3 canvas px + .05*(||F||+||B||)。確率・正解保証・完全な遮蔽検出ではない。人工fixtureのvalidityは幾何条件と人工invalid patch。白背景合成をforeground maskとは扱わない。

## 独立検証と修正

[独立レビュー報告](../../../implementation/reviews/reference-guided-rigging/wave-1-a.md) は **pass、未解消指摘なし**。

- 22 testsを独立再実行し全pass、skipなし。dtype/shape/bytes/hash/サイズ/finite、前処理、軸別resize復元、既知の空間変化field合成、異密度、境界、無効伝播、FB診断、CUDA無し失敗を確認。
- 独立reviewで、格子中心の往復変換の丸め誤差が隣接invalidを誤って拾うP2を発見。field indexの機械精度の整数近傍のみsnapする修正と回帰を追加。canvas境界は緩めず、真の微小寄与では無効を伝播。追加160中心probeもpass。
- 独立GPU smoke: synthetic canvas288×192、推定192×128、12updates、4 model forward、CUDA実行成功。3.6302秒、peak allocated48,145,408bytes。CPU fallbackなし。実モデルの人工画像平均EPE f01約0.10513/f12約0.07998 canvas pxは観測値であり数学・見た目ACに使っていない。
- 最終sourceHashes、画像/vector/validity/reasons/residualのhash・bytes・有限性、診断count、f02再計算と保存値、実参照3枚の元hash/2048×3072を独立照合。
- pip check、lockと実取得report/installed versions照合はpass。空の別venvへの再インストールは独立レビューでは未実施。

## Wave 2への実行入口

Wをcwdにする。詳細はREADME参照。推定は同時に競合させない。

```powershell
$flowRoot = 'reference-generation/optical-flow'
$python = "$flowRoot/.venv/Scripts/python.exe"
& $python "$flowRoot/scripts/test.py"
& $python "$flowRoot/scripts/flow.py" check-inputs --registration reference-generation/alignment/alignment-manifest.json
& $python "$flowRoot/scripts/flow.py" run --registration reference-generation/alignment/alignment-manifest.json --output "$flowRoot/runs/trial-001" --max-dimension 768 --updates 12 --fb-absolute 3 --fb-relative 0.05
& $python "$flowRoot/scripts/flow.py" validate "$flowRoot/runs/trial-001/manifest.json"
```

2048×3072入力の既定推定格子は512×768、保存vector単位はcanvas px。既存outputは上書きせず別runを作る。OOM時はoutput名.failure.jsonに条件を残し、別outputでmax-dimensionを下げる等の再試験が可能。小画像smokeは実参照解像度の実行可否を保証しない。

## 残課題と判定境界

Wave 2で実参照を推定しB viewerへ接続する。顔・眼鏡・帽子・前髪・後ろ髪の対応、整合した誤対応、描き変わり、背景/halo、不可視面と遮蔽を画像上で観察する必要がある。source/tests/GPU passはAccepted User Gateの代替ではない。

実画像でのroot観察とユーザーによる「使える対応/使えない対応を説明でき、格子への次工程に進める」判断は未実施。完成rig品質、格子適用、他軸へ承認を拡大しない。

地図登録とWave 1 A/B受領・Wave 2起動判断はroot所有。
