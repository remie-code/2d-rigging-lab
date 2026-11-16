# 関心モーション — Stage強度の同期比較

2026-11-15。元のgame-curiosity-v1でStageが目立つという本人指摘に対する比較試験。本人は B「弱め（25%）」を採用した。

## 製品登録

採用版を [外部演技資産の interest.json](../../../../apps/runtime-player/assets/speech-motions/interest.json) の `interest × game` に `game-curiosity-v1` として登録し、現用の `autonomous-default` スロットへ配置した。気になるものを見つけ、少し寄って見ようとする演技。元のモデル入力と6.4秒のタイミングを使い、Stageのピークは1.02125倍、Yは1.75px。口パクは通常の制御を使う。

配布資産、起動時の読み込み、Stage Presence Offを含む限定テストは39件合格。現用Playerは次回起動時に新しい定義を読み込む。実会話での選択と見え方は未確認。

A「なし」、B「弱め（25%）」、C「控えめ（50%）」、D「元の試作」。Stage scaleとYの元の差分を同時に0/.25/.5/1倍する。scale=1+(original−1)×factor、y=original×factor。同じ包絡・時間・補間で、別の演技タイミングではない。ピークは順に1/1.02125/1.0425/1.085倍と0/1.75/3.5/7px。

頭・身体・目の全入力は元v1と同じ。瞳XY0、通常目、口静止、blinkなし。129frames、20fps、6.45秒、同期開始。各パネルに大表示と仮の配信サイズを添える。

## 正本と生成物
入力は隣の `speech-motion-game-curiosity-v1/performance.json` と `definition.json`、本フォルダのvariants.json。原モデルは既存 `C:/workspace/remie/rigging/astra-chan/workspace-notes/wry-smile-expression-v2/saved-r843` をread-only使用。元v1の再現依存・Stage viewport方式を継承する。Dは元tmpの129枚のhashを元evidenceと確認して再利用。A/B/Cは同じ評価済みsceneを各Stage viewportへ描画し、既存PNGの逆拡縮による品質差を避ける。

出力は `tmp/speech-motion/game-curiosity-stage-comparison-v1/` の comparison.mp4、A.mp4〜D.mp4、comparison-sheet.png、全frame入力evidence.json、provenance.json。重い生成物をdiscussionへ保存しない。

## 再現
repo rootから:
```powershell
node --experimental-transform-types --no-warnings --import ./apps/authoring-host/register-workspace-source-resolver.mjs discussion/ai-cohost/experiments/speech-motion-game-curiosity-stage-comparison-v1/render.mjs
python discussion/ai-cohost/experiments/speech-motion-game-curiosity-stage-comparison-v1/assemble.py
```
Node/Python/Pillow/ffmpegとMeiryoフォント。元v1のtmp/framesとevidenceが無ければ先に元v1/render.mjsを実行する。モデルsnapshotが別環境で無ければその取得が必要。

比較映像のStageは元と同じオフラインviewport中心の拡縮/Y。source/Export全hash不変と非Stage入力の全frame一致を検査した。

制作側は同時刻の保持姿勢と開始→寄り→復帰のフレーム列を目視した。Aでも頭と首の反応は残り、Bは全体サイズの変化がかなり控えめ。Cは寄りが見え、Dは顔と肩の拡大に注意が向きやすい。

assemble完了後に `python discussion/ai-cohost/experiments/speech-motion-game-curiosity-stage-comparison-v1/verify.py` で全frameの非Stage入力一致、振幅比、始終画像、Dの元画像一致と不変確認を小さいverification.jsonへまとめる。
