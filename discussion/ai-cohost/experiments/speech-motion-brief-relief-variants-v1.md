# 短く息を抜く — 対象別3案

2026-11-11。GPT-6 Astraによる創作試作。**3案ともユーザー採用。** ユーザーは3列比較に「いいんじゃないかな」と評価し、演技×対象方式への接続を依頼した。2026-11-12のcontext-checkの残る判断は[概念文書§7](../concept/speech-motion-performance-and-attention.md#7-製品接続のcontext-check2026-11-12確定)に記録。

## 制作の合意

[演技と注意の対象](../concept/speech-motion-performance-and-attention.md)に基づき、「短く息を抜く」を演技として共通にし、対象別に一続きの動きを作り込む。他の対象を見ていた前提を持たず、全案で同じ正面ニュートラルから始める。笑みや眉の追加は行わない。

相方試作と配置への一度目の了承後、ユーザーは配置を「ゲーム画面はむしろ正面でいい。視聴者の方向は上」と訂正した。**今回の出力はこの最新指定を反映する。**

| 案 | 対象の方向 | 演出 |
|---|---|---|
| ゲーム画面 | 正面 | 正面への注意を保ったまま、頭・姿勢が小さく緩む。頭が下がるぶんを視線で補い、続きを見守る |
| 相方 | キャラ右、画面左 | 目が先に向き、顔と上体が少し追う。向く途中で緩み、相方への注意を保って持ち直す |
| 視聴者 | 正面より上 | 上への視線が先行し、顔が小さく追う。上方への注意を保ちながら短く緩み、持ち直す |

危機の途中で短く息を抜ける反応を狙い、休み切る・大きく吸気する・発見する・挨拶する演技には広げていない。ステージ上下は採用済み。旧安堵v1への「最後に機械的に上に戻る」という指摘を受け、沈みから基準高さまで一続きの緩やかな復帰を作った。Stage Yの自然解除後まで動画に含め、解除時の戻りを映像外へ隠していない。

## 保存物

[版付き原本](speech-motion-brief-relief-variants-v1/)に保存。モデルは `C:/workspace/remie/rigging/astra-chan/exports/astra-chan-runtime` r804を読み取り利用。

- [3列比較MP4](speech-motion-brief-relief-variants-v1/comparison.mp4): 左からゲーム・相方・視聴者。
- 個別MP4: [ゲーム](speech-motion-brief-relief-variants-v1/game.mp4) / [相方](speech-motion-brief-relief-variants-v1/partner.mp4) / [視聴者](speech-motion-brief-relief-variants-v1/viewers.mp4)
- [主要フレーム](speech-motion-brief-relief-variants-v1/contact-sheet.png)
- [動作定義](speech-motion-brief-relief-variants-v1/definition.json) / [再現手順](speech-motion-brief-relief-variants-v1/README.md)
- [モデル識別](speech-motion-brief-relief-variants-v1/provenance.json) / [フレーム入力と表示値](speech-motion-brief-relief-variants-v1/evidence.json) / [検証結果](speech-motion-brief-relief-variants-v1/verification.json)

全案無音・24fps・125フレーム、約5.208秒。個別は520×548、比較は1560×548。同じ画角、開始PNGは一致。Stage Y最大はゲーム12.5px・相方14px・視聴者12px。これらは試作の記録であり、安堵一般の適正値ではない。

## 確認と制限

Astra制作担当が画像を目視して調整し、rootも最終3案の主要フレームを確認した。保存描画の確認に成功し、MP4四本の全フレームをデコード確認。相方版は承認時の定義・全PNG・MP4のハッシュと一致し、追加2案の制作に伴って変更していない。

頭・体・視線はruntimeモデル評価器に直接渡すオフライン描画。Stage Yは製品の `SpeechMotionState` と `RuntimePlayerStageMotionRuntime` の補間・開始・自然解除・Presence Offでの合成を使用する。GUI/実WebSocket/音声/Decision接続を通した確認ではない。

頭・体・視線は終端の対象向き姿勢を保持し、製品presetの区間終了時の解除は未再現。Stage Yの解除は動画内に含む。実行時の現在姿勢からの接続、製品での表示条件と解除は、以下のWave 1の記録を参照。

## 次の判断

Wave 1で[製品用r804クリップ](../../../apps/runtime-player/src/main/control-channel/contract/speech-motion-r804-clips.json)に各原本の曲線を収録し、演技×対象の直接指定に登録した。[Wave 1の確認項目と表示検証](../implementation/waves/performance-attention/wave1-basis.md)を参照。二問Decisionと実発話への接続はWave 2で扱う。
