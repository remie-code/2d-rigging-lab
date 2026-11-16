# 正面のゲームへの関心 — v1

2026-11-14。本人承認の演出案を元のStage強度で映像化した試作。2026-11-15にStageを25%に弱めたBを採用し、製品に登録した。[比較と製品登録](../speech-motion-game-curiosity-stage-comparison-v1/README.md)

## 演出仮説
正面に注意が留まり、頭が少し先に寄る構えを見せてから全体が近づく。寄ったところで首を傾け、見る間を置く。対象から視線を外さず姿勢だけゆっくり戻す。「何だろう、もう少し見たい」が中心。横peek、驚き、警戒、頷き、苦笑は足さない。研究は注意・身体表現の足場であり、この曲線の有効性を保証するものではない。

頭Yは0.65秒後から先行し−2.8度。全体の寄りは1秒後から2.2秒まで8.5%拡大。その後頭Zを4.5度傾け、上体Zは遅れて0.65度だけ伴う。3.8秒付近まで見る間を置き、5.75秒に姿勢を戻す。6.4秒まで正面への注意を残して映す。通常目を保持、瞳XY0、blinkなし、口閉静止。無音で音声同期なし。

## 入力と出力の分離
Git側は本README、performance.json（元のStage強度の試作定義）、definition.json（描画条件）、render.mjs、assemble.py、input-provenance.json、verification.jsonのみ。生成動画・PNG・コンタクトシート・全frame入力は `tmp/speech-motion/game-curiosity-v1/`。

入力は既存の安定snapshot `C:/workspace/remie/rigging/astra-chan/workspace-notes/wry-smile-expression-v2/saved-r843`。巨大snapshotをこのrepoへ複製しない。現在のsource/Exportはr844だが、登録時r843→844は造形保持・manifest更新だったことをrootが確認。入力snapshotへの外部依存があり、別環境ではこのsnapshotの取得が必要。hashだけで復元できると扱わない。

## Stageの実現
現行clipのstage.scale/yと同じ単位・五次smoothstepの曲線を定義。今回はオフライン描画viewportの中心拡縮とY移動へ適用した。身体の前後リグではなく全体の拡縮で寄る感じを作る。頭だけを奥行き方向へ動かしたものではない。Playerの実スケジューラ・接続補正を通した統合試験ではなく、採用後に実行系との一致確認が必要。Stage以外のモデル入力はauthoring graph→runtime-core→software描画。

## 再現
repo rootから:
```powershell
node --experimental-transform-types --no-warnings --import ./apps/authoring-host/register-workspace-source-resolver.mjs discussion/ai-cohost/experiments/speech-motion-game-curiosity-v1/render.mjs
python discussion/ai-cohost/experiments/speech-motion-game-curiosity-v1/assemble.py
```
Node v24.19.0、Python/Pillow、ffmpegが必要。6400ms・20fps、129frames。viewportと固定条件はdefinition/performanceを参照。描画器の開始repo HEADはe4f67106e099b25e6aa1f3f0fa41152f03709811。共同作業の未commit差分を含むため、実際に使用した入口ファイルhashもinput-provenanceへ記録する。全frame入力・画像hashはtmp/evidence.json。

## 観察と未確認
映像の自然さ・配信サイズでの読み取りは候補の目視評価とし、機械確認と分ける。実OBSや音声同期での受領確認ではない。全体の寄りが「関心」ではなく単なるカメラズームに感じられるか、傾きが疑念に寄るかは本人と動画で判断する。現用source/Exportは前後の全ファイルhashで不変確認する。

制作側の主要姿勢目視では、正面を保ち寄り→傾き→見る間→復帰の順序が読めた。小サイズでも寄りの大きさは分かる。驚き/困りの表情は加えず、カメラ寄りの印象が残る候補として提出。129frameの描画、動画全decode、始終PNG一致、snapshot/live source/Export不変を確認した。

## 本人評価と次の比較（2026-11-15）
Stageが強く、そちらへ意識を持っていかれるとの指摘を受け、Stageをなくすか弱める案を比較した。[なし・25%・50%・元の強さの同期比較](../speech-motion-game-curiosity-stage-comparison-v1/README.md)
