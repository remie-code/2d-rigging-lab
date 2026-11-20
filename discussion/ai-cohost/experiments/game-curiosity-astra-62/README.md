# 丸い仕掛けを見つけたときの好奇心

同じ[配信の発話](../game-interest-classification-2026-11-14.md)を使い、左にGPT-6 Astraによる登録版、右にGPT-6.2 Astraによる新作を置く。右側は[全28本の比較後に採用・配置済み](../motion-library-astra-62/README.md)。

新版は「もう見つけている」と「この先どう動くのか見たい」を分けて作った。一文目は視線に少し遅れて顔が対象へ落ち着く。二文目の入りで首を傾け、頭を下げても目は対象を離れず、問い終わっても少し待つ。演技の入力は [performance.json](performance.json) にある。

## 再生・再生成

リポジトリのルートで次を実行する。

```powershell
python discussion/ai-cohost/experiments/game-curiosity-astra-62/preview.py
```

出力は `tmp/speech-motion/astra-62-curiosity/comparison.mp4`。両者ともastra-chanのr843スナップショット、20 fps、同じ画角を使う。左は `apps/runtime-player/assets/speech-motions/interest.json` の `targets.game` を等速再生する。比較時のリポジトリは `4caa13b8`。右の定義はこの実験に同梱した。

音声はWindowsの日本語音声Microsoft Harukaで同じ台詞を読み直し、共通の振幅による簡易口パクを付けた。配信録音を使用した比較ではない。再生成にはモデルの保存先、Windows PowerShell、Node、Python、Pillow、ffmpeg、メイリオが必要。
