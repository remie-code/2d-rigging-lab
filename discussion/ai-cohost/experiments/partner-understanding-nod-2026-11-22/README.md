# 相方を見て納得するうなずき

「よし、それでいこう。」と相方の案に乗る場面を想定した試作。先に相方へ目と顔を向け、一拍置いて一度うなずく。顔を上げた後も相方を見てから正面へ戻る。

比較動画では左から [相方への相づち](../../../../apps/runtime-player/assets/speech-motions/receive.json)、[画面を見たまま納得](../../../../apps/runtime-player/assets/speech-motions/understanding-nod.json)、[今回の相方向け試作](clip.json) を同時に再生する。各クリップの長さを保ち、同じモデルと画角で口を閉じて比較する。

リポジトリ直下から `python discussion/ai-cohost/experiments/partner-understanding-nod-2026-11-22/preview.py` で再生成できる。既存の [比較用レンダラー](../game-curiosity-astra-62/render.mjs) と同じモデル素材を使い、`tmp/speech-motion/partner-understanding-nod-2026-11-22/comparison.mp4` に出力する。

## 採用と元の発話での再判定

3本の比較で相方向けを採用。`understanding-nod × partner` に `understanding-nod-partner-v1` を登録した。画面版は従来のクリップを使う。[登録定義](../../../../apps/runtime-player/assets/speech-motions/understanding-nod.json)

11/21 10:40（日本時間）の `fire-51`、原記録ID先頭 `fdbc1c03` を使用。配信者が「というわけでその方向性でいこう」と話し、チャッピーが「よし、それでいこう。」と返した。旧方式では本人の意図タグつきで納得×相方を選んだものの、相方版が未制作だった。

11/22に同じ返事の一文と記録された直前会話を現行の文単位Decisionへ渡した。同じ返事の先行文は空。元の意図タグを除き、全30演技を候補に3回実行し、3回とも納得×相方を直接選び、採用した3.55秒のクリップへ解決できた。これは同じ一場面での再判定結果。
