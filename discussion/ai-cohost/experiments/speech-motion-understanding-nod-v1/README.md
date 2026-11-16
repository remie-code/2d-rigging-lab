# 仕組みが腑に落ちて、一度うなずく — v1

2026-11-15。正面のゲームを見て「なるほど、吸い込ませて向こうのスイッチを押すんだ」と理解したときの、無音の映像試作。理解カテゴリ18例から代表場面を一つ選んだ。

## 製品登録

本人が試作映像と[受領のうなずきとの比較](../speech-motion-nod-comparison-v1/README.md)を確認し、採用した。[配布資産](../../../../apps/runtime-player/assets/speech-motions/understanding-nod.json)に `understanding-nod × game` として登録し、現用の `autonomous-default` スロットに配置した。採用した `understanding-nod-v1` の4.2秒のクリップ定義をそのまま使う。

ゲームの仕組み・説明・関係がつながって納得し、画面を見たまま一度うなずく場面をDecisionの候補説明に記載した。相方の話を受け取るうなずきには既存の `receive × partner` がある。両フォルダの隔離コピーを起動時ローダーで検証し、8演技・15ペア・12クリップを確認した。現用Playerは次回起動時に読み込む。実会話での選択と見え方は未確認。

## 演出

正面に注意を留める1.1秒の間から、0.62秒で頭を一度だけ下げる。底で0.12秒落ち着き、0.85秒で正面へ自然に戻す。2.69秒以降は回復後の姿勢を見せ、全体4.2秒。下降・復帰は五次smoothstep。頭Yの頂点は−13度。頭X/Z、胴体、瞳XYは0、通常目固定。Stageはscale=1・Y=0を定義に明記し、移動や拡大なし。口閉じは無音描画のみに適用し、performanceには含めない。

相手の発話に即応する短い受領頷きより、正面の対象を見て考えが落ち着いてから一度うなずく意図。反復、驚き、勝ち誇り、相手向きへの旋回は加えていない。通常目・無音の単独動作だけで「理解」と「受領」を確実に判別できるとは主張しない。場面と発話が意味を支える。

[会話中の運動研究](../../research/human-conversational-motion-2026-11.md)はタイミングと意図を分ける足場。この具体的な時間・曲線は創作仮説で、研究が有効性を保証した値ではない。比較の足場は既存の[speech-motion-received-v1](../speech-motion-received-v1/definition.json)。

## 再現

repo rootから実行する。

```powershell
node --experimental-transform-types --no-warnings --import ./apps/authoring-host/register-workspace-source-resolver.mjs discussion/ai-cohost/experiments/speech-motion-understanding-nod-v1/render.mjs
python discussion/ai-cohost/experiments/speech-motion-understanding-nod-v1/assemble.py
```

Node v24.19.0、Python/Pillow、ffmpeg。入力は既存の読取専用snapshot `C:/workspace/remie/rigging/astra-chan/workspace-notes/wry-smile-expression-v2/saved-r843`。別環境で再現するには同snapshotが必要。r844のlive source/exportは入力として使用せず、前後hashで不変確認する。新規モデル、表情、keyformは作らない。

実モデルのauthoring graph → runtime-core → software PNG。既存game-curiosity-v1の描画器と同じ視点。624×660のモデル像と212×224の小サイズ像を並べた1000×720 MP4。20fps・85フレーム（終端確認フレームを含むため動画コンテナは4.25秒）。生成物は `tmp/speech-motion/understanding-nod-v1/`。performance.jsonは再現可能な曲線、definition.jsonは描画条件。重いPNG・動画・全フレーム入力・全入力hashはtmp内にのみ保存する。

## 検証と限界

有限geometry、動画全decode、開始・終了PNG一致、Stage固定、snapshot/live source/live export不変を確認する。主要姿勢と小サイズのコンタクトシートを制作側で目視する。音声同期、OBS、実Playerでの発火時点と接続補正は映像試作の検証範囲外。

制作側目視では、コンタクトシートと最下点の大小フレームで控えめな下降姿勢を確認した。85フレームの有限geometry、動画全decode、始終PNG一致、入力snapshotとlive source/export不変はいずれも通過した。
