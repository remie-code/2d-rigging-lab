# ⑥ 驚いて少し身を引く — 正面ゲーム版 v1

2026-11-13 JST。Astra制作。狙いは「不意を突かれて一度引ける。でも対象から注意を外さず、見直す」。研究で必須の順序と証明された動きではなく、合意した演出仮説の初回試作。本人の演技受領は未判定。

- `startled-recoil.mp4`: 6.04秒、24fps、145frames、無音。大きな上体と配信想定小表示。実OBS配置は未確認。
- `contact-sheet.png`: 入口・見開き・引き・短い保持・復帰。
- `definition.json`: 全曲線/入力/viewport。`evidence.json`: 全frame入力・Stage実出力・PNG hash。
- `expression-overrides.json`: 採用済み「元パーツのみ」のopacity設定。
- `provenance.json`, `verification.json`: source/Export保持と描画証拠。

## 作った動き

0〜0.65秒は正面ニュートラル。0.65秒から目を素早く開き、0.9秒で見開きへ。頭は0.75秒から少し遅れて反応し、約0.98秒で短く顎が上がる。上体の小さな傾きとStageの奥行きがさらに遅れてついてくる。

約1.2〜1.5秒は引けた位置で対象を見る。姿勢はそこからゆっくり戻し、見開きは1.75秒まで保持して遅れて緩める。3.5秒で目も通常へ戻り、終端後を余分に映す。反応は一度だけで、反復する揺れは加えていない。瞳XYは全区間0、横向き0、通常blinkなし。口は閉口静止で、口パク機構・素材には変更なし。

## 表情とStage経路

基点は `C:/workspace/remie/rigging/astra-chan/workspace-notes/startled-expression-v3/saved-r839`。r839をそのまま描画すると抽出素材へ切り替わるため、本人採用の `startled-original-parts-v1/overrides.json` をsession内だけで適用する。元まつ毛/白目/眉と、元texture/UVの移行専用虹彩を使用。see-through抽出8drawableが全frame非表示であることを実評価で確認した。

初回の顔pitch＋StageYだけでは、奥へ引くより下へ沈む印象が強かった。そのため上下移動を最大約4pxへ抑え、既存StageMotionRuntimeのdepthInputによるscaleを少量加えた。実出力の最小scaleは0.948208（約5.2%の縮小）。拡縮はviewport中心を軸にソフトウェア描画へ投影している。

StageYは既存SpeechMotionStateの曲線経路、奥行きは既存Stage Presence driveのdepthInput→StageMotionRuntimeを試作用に駆動している。**奥行き曲線は製品の登録済みspeech-motionチャネルではなく、今回のオフライン入力**。製品へ同じ演技を接続する場合にはその扱いを別途決める必要がある。新しいエンジン機構は追加していない。

現rigには胴体pitch/実際の奥行き移動がない。上体の追随は小さいbody rollとStage縮小で示しており、肩や胸が立体的に後退する造形ではない。頭と身体の一体感、縮小が「引く」と読めるか、等速での間の長さは本人の動画判断へ渡す。

## 確認

主要姿勢を自分/rootが目視。顔の見開きが先行し、短く引いた後に姿勢→表情の順で戻る候補として提示。連続再生の美的採用をcontact sheetだけで確定していない。

全145framesの頂点が有限、抽出8素材非表示。MP4全decode成功。saved-r839、現authoring workspace、現用Exportの全ファイルhashが前後不変。モデル/Export/EXE/製品登録/commit/pushなし。通常の口パクや表情source自体は変更していない。

definition.jsonの初期出力がWindows CP932だったため、最終成果ではUTF-8に修正。日本語metadataを含む定義値は変わらず、描画入力も不変。provenanceに元bytes hashと修正後hashを記録した。

## 再現

repository rootで:

```powershell
node --import ./discussion/ai-cohost/experiments/speech-motion-startled-recoil-v1/loader.mjs discussion/ai-cohost/experiments/speech-motion-startled-recoil-v1/render.mjs
python discussion/ai-cohost/experiments/speech-motion-startled-recoil-v1/assemble.py
```

一時PNGは `tmp/speech-motion/startled-recoil-v1/frames`、完成MP4/contact sheetはこのディレクトリ。`--poses` は主要姿勢のみを出力する（Stage平滑化は全frameを評価）。loaderはローカルTypeScript実行とruntime-playerのbundler向けJSON importを補うだけで、製品コードを変更しない。依存するローカルモデルsnapshotと既存notes/toolsのTS loaderは上記固定pathを使用する。
