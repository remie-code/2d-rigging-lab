# 「受け取った」v1 保存セット

2026-11-10。ユーザー評価: 「全然悪くない」「すごくいい」。将来の採用は未決だが、再現できるよう保存する依頼を受けた。[実験本文](../speech-motion-received-v1.md)。

| ファイル | 内容 |
|---|---|
| [definition.json](definition.json) | 動作の正本。時間・補間・各パラメータの基準値と振幅・描画範囲 |
| [received-v1.gif](received-v1.gif) | ユーザーが評価したGIFそのもの |
| [contact-sheet.png](contact-sheet.png) | 代表コマ |
| [motion.json](motion.json) | 初回生成時の入力とモデル評価後の実効値（20fpsで採取） |
| [provenance.json](provenance.json) | 使用モデルrevision 335の全4ファイルのSHA-256、描画コードのgit commit、実行環境 |
| [render.mjs](render.mjs) | 定義を読み込み実モデルからPNG列と評価値を再生成 |
| [loader.mjs](loader.mjs) | リポジトリのTypeScriptを読む実行アダプター |
| [assemble.py](assemble.py) | PNG列を共通パレットのGIF・コマ一覧へ変換 |

## 再生成

リポジトリルートで、依存導入済みのNode 24.19.0・Python 3.11/Pillow 12.1.1を使用:

```powershell
node --import ./discussion/ai-cohost/experiments/speech-motion-received-v1/loader.mjs discussion/ai-cohost/experiments/speech-motion-received-v1/render.mjs
python discussion/ai-cohost/experiments/speech-motion-received-v1/assemble.py
```

出力先は `tmp/speech-motion/received-v1-replay/`。保存済みGIFを上書きしない。モデルを別の場所に置いた場合はrender.mjsの第1引数にモデルフォルダ、第2引数に出力先を渡し、assemble.pyにも同じ出力先を渡す。

動き自体は `definition.json` に保存しており、特定の描画コードから独立して読める。パラメータ名・数値の意味はastra-chan固有。別モデルへそのまま同じ数値を適用して同じ見た目になるとは限らない。

同じ見た目の再描画には、外部にある `C:/workspace/remie/rigging/astra-chan/exports/astra-chan-runtime` と、記録した版のリポジトリの評価器・描画器が必要。モデル本体（約103MB）はこのセットには複製していない。モデルが変更されていればSHA-256確認で停止し、別のモデルを同じものとして扱わない。評価済みのGIFはモデルがなくても閲覧できる。

## 保存後の再現確認

2026-11-10に上記の保存スクリプトで再生成。元のPNG全65枚と再生成PNG全65枚のSHA-256が一致し、組み立てたGIFも評価済みGIFとSHA-256が一致した（`2258e7d35cf55433dd2173dddeb940341ee56c6e1d46e166472c5fd54980ec41`）。別環境・将来の評価器での一致は未検証。
