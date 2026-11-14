# 苦笑・小さな首振り v1

2026-11-13。採用済み眉修正版r843を使った、画面・視聴者向け共通の正面モーション候補。表情採用と、この演技の受領は別。本人の動画評価待ち。

## 見るもの
`wry-headshake.mp4` は6.05秒・20fpsの無音試作。大きい顔/上体と仮の配信サイズを同時表示。`contact-sheet.png` は主要姿勢。

苦笑が先に浮かび、少し傾いた頭で一往復する。最初の画面左への振りは10度、戻す側は6.5度、最後は2.5度の小さい収まり。上体は遅れて小さくついてくる。首振りが収まった後も短く苦笑を残し、姿勢と表情を緩める。「強く否定」より困った状況を共におかしがる「やれやれ」が制作意図。具体的な軌跡は演出仮説であり、研究から保証された順序ではない。

## 使用チャネル
param_wry_smile、face_angle X/Y/Z、body_angle X/Z。瞳XY0、EyeOpen1、通常blinkなし、口閉固定。笑顔/驚き0。Stage変位は全区間0で、追加の奥行きや未実装機構は使用しない。最大yaw10度で24度上限内。

## 再現・保存
モデルは `C:/workspace/remie/rigging/astra-chan/workspace-notes/wry-smile-expression-v2/saved-r843` をread-only使用。source/export/製品登録の変更なし。新しい眉/目/口造形なし。
`definition.json` に時間と曲線、`evidence.json` に全frameの入力とPNG hash、`provenance.json` に基点ファイルhashと不変確認を収録。補間は区間ごとのquintic smoothstep。始終はニュートラルで止まり、終了前1秒以上映す。

repo rootから:
```powershell
node --experimental-transform-types --no-warnings --import ./apps/authoring-host/register-workspace-source-resolver.mjs discussion/ai-cohost/experiments/speech-motion-wry-headshake-v1/render.mjs
python discussion/ai-cohost/experiments/speech-motion-wry-headshake-v1/assemble.py
```
作業フレームは `tmp/speech-motion/wry-headshake-v1/`。authoring graph→runtime-core→software描画を使用し、現用Exportは使わない。

## 限定確認と残差
基点saved-r843・live source・現用Exportの全ファイルhashを前後比較。全frame頂点が有限、MP4全decodeを確認。入口/出口は同じニュートラル入力。眉と目の採用済み形を維持したまま首振りを評価する。
静止口なので参照の口角の笑みは追加していない。発話同期や実OBS配置での受領確認ではなく、配信小サイズは仮例。首振りが否定寄りに見えるか、間が自然かの最終判断は本人に残す。
