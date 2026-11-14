# See-through の更新調査と RTX 4070 SUPER での比較案

調査日 2026-11-12。対象は公式の See-through、手元の Windows WebUI、閉じ目参照からの Live2D 素材分解。

## 判断

**現在の NF4 WebUI を制作に使い続ける。細い閉じ目線や透明縁の仕上がりが問題になる場合は、公式の bf16 を別環境で比較する。** 公式 README が現行とする V3（最大23レイヤー）は、手元の推論コードが指定する LayerDiff 3D と同じ世代。5月ごろの導入以降、確認できた公式の更新は主にドキュメント、コミュニティ連携、Hugging Face のライセンス情報だった。閉じ目の分離や透明縁を改善する新しい公式重みは確認できなかった。 [公式 README](https://github.com/shitagaki-lab/see-through) · [公式のコミット履歴](https://github.com/shitagaki-lab/see-through/commits/main/) · [LayerDiff NF4 の履歴](https://huggingface.co/24yearsold/seethroughv0.0.2_layerdiff3d_nf4/commits/main)

## 公開版と変更履歴

| 対象 | 2026-11-12 に確認できた内容 |
|---|---|
| 公式ソフトウェア | GitHub Releases は空。取得できた `main` のコミット履歴では、最新表示が 8/5 の `7f139bb`（PNGAL の紹介追加）。7/20 は ACM の出版情報、7/4 は Anime2.5DRig の紹介、6/30 は AMD ROCm の導入手順。コミット一覧は取得時点のキャッシュを含むため、最新表示の SHA を現時点の先端と同一とは確定していない。 [Releases](https://github.com/shitagaki-lab/see-through/releases) · [履歴](https://github.com/shitagaki-lab/see-through/commits/main/) |
| 透明レイヤー生成 | 公式 README の世代名は **V3**。配布 ID は bf16 が `layerdifforg/seethroughv0.0.2_layerdiff3d`、NF4 が `24yearsold/seethroughv0.0.2_layerdiff3d_nf4`。bf16 の重みは 3/9、NF4 は 4/2 に掲載。9/28 の変更は LICENSE・NOTICE・モデルメタデータ。4/14 は V3 の学習コード・設定・データ処理の公開。 [公式 README](https://github.com/shitagaki-lab/see-through#changelog) · [bf16 の履歴](https://huggingface.co/layerdifforg/seethroughv0.0.2_layerdiff3d/commits/main) · [NF4 の履歴](https://huggingface.co/24yearsold/seethroughv0.0.2_layerdiff3d_nf4/commits/main) |
| 深度推定 | 公式 CLI の配布 ID は bf16 が `24yearsold/seethroughv0.0.1_marigold`、NF4 が `24yearsold/seethroughv0.0.1_marigold_nf4`。NF4 の重みは 4/2 に掲載。9/28 の変更は LICENSE・NOTICE・モデルメタデータで、Stable Diffusion 2 由来の条件を追記している。 [公式 NF4 CLI](https://github.com/shitagaki-lab/see-through/blob/main/inference/scripts/inference_psd_quantized.py) · [Marigold NF4 の履歴](https://huggingface.co/24yearsold/seethroughv0.0.1_marigold_nf4/commits/main) |
| 低 VRAM 推論 | 4/2 に公式 NF4 と group offload の案内、4/16 に bf16 block swap の VRAM 最適化。いずれも5月ごろより前。 [公式のコミット履歴](https://github.com/shitagaki-lab/see-through/commits/main/) · [公式の VRAM 目安](https://github.com/shitagaki-lab/see-through#low-vram-users) |
| Windows WebUI | 該当する公開フォークは `BeamManP/see-through-webui`。最新タグは 4/5 の **v0.2.0**（`d71d195`）。v0.1.0 からの変更は Python ベースのインストーラー、依存固定、CUDA・ディスク確認、診断など。 [WebUI リポジトリ](https://github.com/BeamManP/see-through-webui) · [v0.2.0 リリース](https://github.com/BeamManP/see-through-webui/releases/tag/v0.2.0) |

論文の arXiv v1 は 2/3。単一画像から意味ごとの RGBA レイヤーを生成し、隠れた範囲を補い、ピクセル単位の疑似深度から描画順を推定する。V3 の PSD は、目や髪などの素材を切り出す出発点にできる。変形に合わせた細分割、メッシュ、リグの設計は別工程になる。 [arXiv](https://arxiv.org/abs/2602.03749) · [ACM SIGGRAPH 論文](https://doi.org/10.1145/3799902.3811209) · [公式 README の Live2D に関する説明](https://github.com/shitagaki-lab/see-through#discussion-is-this-image-to-live2d)

## 手元の Windows 環境

`C:/AI/see-through-webui` のファイルを読み取りで確認した。フォルダーには5月12日付のファイルやディレクトリがある。README と起動構成は BeamManP フォークの系統と整合する。元の ZIP と `.git` が見つからず、導入時のタグ・コミットは特定できていない。

- `tools/webui.py:156–199` は入力を RGBA PNG に変換し、`inference/scripts/inference_psd_quantized.py` を起動する。NF4 と bf16 を選択できる。WebUI はどちらにも `--no_group_offload` を渡す。
- 手元の推論スクリプトは上記の LayerDiff・Marigold 各 ID を指定し、LayerDiff の標準ステップ数は30。深度解像度の既定は手元の720に対し現行の公式 NF4 CLI は768。手元は左右分割が既定で有効で `--no_tblr_split` を持つ。公式 NF4 CLI は `--tblr_split` で有効化する。公式 README の NF4 コマンド例のコメントは深度720と記載しているため、再現時は CLI の引数を明示する。 [公式 NF4 スクリプト](https://github.com/shitagaki-lab/see-through/blob/main/inference/scripts/inference_psd_quantized.py) · [公式の VRAM 目安](https://github.com/shitagaki-lab/see-through#low-vram-users)
- `.hf_cache/hub` で調査時に読めた `refs/main` は LayerDiff NF4 が `96f9311`、Marigold NF4 が `aad13aa`。前者は公開先の9/28版、後者は4/2の重み公開版で公開先の最新表示 `e53b344` より古い。稼働中の分解で HF から不足ファイルを取得していたため、この記録から導入時の revision やジョブが読み込んだ全コンポーネントの revision は確定できない。 [LayerDiff NF4 の履歴](https://huggingface.co/24yearsold/seethroughv0.0.2_layerdiff3d_nf4/commits/main) · [Marigold NF4 の履歴](https://huggingface.co/24yearsold/seethroughv0.0.1_marigold_nf4/commits/main)
- 手元の `inference/scripts/` に block swap のエントリーポイントはない。公式の block swap は同じ世代の bf16 LayerDiff と bf16 Marigold を使う。bf16 で検証する際に VRAM を抑える選択肢になる。 [公式 block swap スクリプト](https://github.com/shitagaki-lab/see-through/blob/main/inference/scripts/inference_psd_blockswap.py)

## RTX 4070 SUPER 12 GB での NF4 基準実行

2026-11-12 に閉じ目参照を現行 WebUI で分解した。設定は NF4、1280、seed 42、LayerDiff 30ステップ、深度720、左右分割あり。WebUI の経過時間は8分24秒。`stats.json` の総処理時間は472.959秒で、内訳として LayerDiff 339.932秒、Marigold 14.070秒、PSD 組み立て3.155秒が記録された。PyTorch の最大割り当て量は6.686 GiB。頭部推論時に WebUI が表示した GPU 全体の使用量は約11.8 GB で、計測対象が異なる。

抽出した閉じ目 PSD は太いまつ毛の弧と薄いまぶた線を保持していた。肌色・白・暗色の背景で目立つ肌の付着は見られず、線は原画よりやや柔らかかった。試作に使えると判断し、Astra にモデルへの組み込みを依頼した。出力は `C:/AI/see-through-webui/workspace/webui_output/laugh-closed-eyes-from-neutral-v3_1794482639/`。

## RTX 4070 SUPER 12 GB での比較案

公式 README の1280での目安は bf16 通常が12〜16 GB、bf16＋group offload が約10 GB、bf16 block swap が約8 GB、NF4＋group offload が約8 GB。group offload は同 README で約1.5倍の処理時間が目安。Windows WebUI の README は1280で約9 GBを挙げている。計測条件とオフロード設定が異なるため、同じ計測方法で実機を比較する。公式の NF4 対 bf16 の PSNR 約30 dB、SSIM 約0.96は、今回の閉じ目線や透明縁の指標を直接測った値ではない。 [公式の VRAM 目安](https://github.com/shitagaki-lab/see-through#low-vram-users) · [Windows WebUI の VRAM 目安](https://github.com/BeamManP/see-through-webui#vram-と解像度の目安)

1. 現行 WebUI の分解結果から、RGBA に変換済みの入力 PNG、解像度、seed、左右分割設定、PNG・PSD とログを基準として保存する。
2. 公式リポジトリを別ディレクトリに置き、公式の CUDA 手順に沿って独立した Python 環境を作る。使用した Git SHA と HF のモデル revision を記録し、別の `HF_HOME` と出力先を指定する。通常の WebUI ジョブの完了後に比較を始める。 [公式の環境構築](https://github.com/shitagaki-lab/see-through#environment-setup)
3. 同じ公式 checkout で、同一の入力、seed 42、LayerDiff 30ステップ、同じ解像度・深度解像度・左右分割設定の NF4 と bf16 を比較する。基準と合わせるなら解像度は基準ログの値、深度解像度は720にそろえる。下記は1280、左右分割ありの例。まず block swap を試す。VRAMに余裕があって速度も比較したい場合は、公式の通常 bf16 CLI を group offload 付きで追加する。NF4 の基準だけで輪郭がつぶれる場合は、入力を同じ範囲で少し寄せた試行を別条件として記録する。 [公式 NF4 スクリプト](https://github.com/shitagaki-lab/see-through/blob/main/inference/scripts/inference_psd_quantized.py) · [公式 block swap スクリプト](https://github.com/shitagaki-lab/see-through/blob/main/inference/scripts/inference_psd_blockswap.py)

```powershell
python inference/scripts/inference_psd_quantized.py --srcp closed-eyes.png --save_dir workspace/compare-nf4 --quant_mode nf4 --resolution 1280 --resolution_depth 720 --seed 42 --num_inference_steps 30 --save_to_psd --tblr_split
python inference/scripts/inference_psd_blockswap.py --srcp closed-eyes.png --save_dir workspace/compare-bf16 --resolution 1280 --resolution_depth 720 --seed 42 --num_inference_steps 30 --save_to_psd --tblr_split
```

4. 元絵と同じ座標で目元を拡大し、左右の閉じ目線の欠損・二重化、まつ毛と眉の混入、閉じ目参照にない白目・虹彩の混入、肌や髪の付着を確認する。中間 RGBA の目レイヤーと最終 PSD の両方を、白・黒・肌色の背景で合成して確認する。この比較は推論経路全体の比較。中間 RGBA と PSD に差があれば、後処理・左右分割の影響を見る。LayerDiff の NF4 は UNet と両テキストエンコーダーを量子化し、透明 VAE は bf16 配布と共通。精度の影響を追加で切り分けるなら、同一の公式 NF4 CLI で `--quant_mode nf4` と `--quant_mode none` を比較する。実際に素材を重ね、動かしたときの前髪や肌との境界も確認する。 [LayerDiff NF4 モデルカード](https://huggingface.co/24yearsold/seethroughv0.0.2_layerdiff3d_nf4)
5. 処理時間、GPU 全体のピーク使用量、CPU RAM、OOM の有無、手修正に要した時間を記録する。手元の `stats.json` の `peak_vram_gb` は PyTorch の最大割り当て量なので、block swap とそろえる計測には両方で同じ GPU 監視方法を使う。bf16 の採用は、別の seed またはもう1枚の閉じ目参照でも改善が再現し、追加の処理時間に見合う場合に判断する。

## 関連ツールと未確認事項

- **ComfyUI-See-through** は同系統のモデルを使う。レイヤー生成、深度、後処理、PSD 保存をノードに分けられるため、中間 RGBA の観察や工程比較に向く。派生の `tk_seethrough` は頭部詳細パスを省略できるが、細い閉じ目線を取りたい比較では有効な状態を基準にする。 [ComfyUI-See-through](https://github.com/jtydhr88/ComfyUI-See-through) · [tk_seethrough](https://github.com/tackcrypto1031/tk_seethrough)
- **PNGAL** は表情差分生成と See-through による分解を組み合わせる。表情作成からの工程全体を変えたい場合の比較候補であり、公式 README の紹介から閉じ目分解モデル自体の品質向上は確認できない。 [公式 README のコミュニティ連携](https://github.com/shitagaki-lab/see-through#community-support)
- NF4 の基準実行を記録済み。実機での bf16 の処理時間、VRAM、NF4 との閉じ目線・アルファ縁の品質差、および既存制作物に対する PSD の互換性は未確認。
