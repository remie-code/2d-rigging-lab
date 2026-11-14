# 一緒に笑う v2 — 瞳の固定による切り分け

2026-11-12。ユーザーはv1の身体の動きを高評価する一方、閉眼時に瞳が上へ吸い込まれる印象を指摘。表情移行中に視線や瞬きを重ねない方向を議論し、まず瞳を表情制作時の位置に固定した比較を依頼した。

提示後、ユーザーが「これでいこう」と採用。視聴者向け・画面向けの両方にこの版を使う方針。製品登録や汎用的な目元制御の実装を受領したものではない。

## 変更と成果物

- `definition.json` の `param_eyeball_y` のみ全区間0へ変更した。閉眼中だけの制御や、開眼後の視線復帰を製品実装したものではない。
- 頭・身体・Stage Y・笑顔曲線・仮口パクはv1と同一。通常瞬きなし。sourceは同じsaved-r824を読み取り使用、モデル造形と現用Exportは変更していない。
- [調整版動画](viewers.mp4): 6.25秒、20fps、無音・仮口パク、大表示＋小表示。
- [左右比較動画](gaze-comparison.mp4): 左v1、右v2。顔拡大。
- [閉眼途中の比較](closing-comparison.png): 0.6/0.8/1.0秒。

rootが比較画像を目視したところ、初期の上方への瞳の偏りは弱まるが、後半の見た目は両版で近い。これだけで違和感が解消したとは判定せず、動画の本人確認へ渡す。表情変形自体の修正は今回行っていない。

## 確認

`isolation-check.json` に全125frameの瞳Y以外のモデル入力とStage出力の一致を記録。`verification.json` は開始・一拍目・終端のHost PNG一致、通常瞬きなし、Stage終端0、source全hash不変を記録。二つのMP4は全デコード確認。実音声同期・製品接続は未実施。

## 再現

v1 READMEと同じNode resolver環境を用いる。`SHARED_LAUGHTER_OUT`に出力先を指定し、このディレクトリの`render.mjs`、`verify.mjs`を実行。その出力先を第一引数として`assemble.py`を実行する。既定出力先は`tmp/speech-motion/shared-laughter-v2-reproduction`。

`compare.py`はこのディレクトリのframesと、repoの`tmp/speech-motion/shared-laughter-v1/frames`を比較する。v1のフレームがなければv1の保存定義・render.mjsから同パスへ再生成できる。
