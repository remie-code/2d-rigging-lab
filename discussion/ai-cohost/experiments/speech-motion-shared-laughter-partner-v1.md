# 一緒に笑う — 相方向けの試作

2026-11-12。本人採用。視聴者・画面向けとして本人採用された[瞳固定v2](speech-motion-shared-laughter-v2/README.md)を土台に、GPT-6 Astraが配信者である相方向けの演技を制作した。ユーザーは「めっちゃいい、これでいこう」と採用し、[モーション登録](../implementation/orchestration/shared-laughter-registration-plan.md)を依頼した。製品での実会話確認は別。

## 合意した演出

正面から相方（チャッピーの右、画面左）へ顔と上体を向け始め、その途中から笑顔になる。向き直りが落ち着く頃に、採用した大小二拍の弾みをつなぐ。揺れが収まって開眼しても、少し相方を向いた姿を残す。「向き終わってから笑う」と区切らず、一続きの共有として作る。

瞳XYは制作時位置0固定、通常瞬きは重ねない。注意対象は顔と上体の向きで表す。横回転の上限±24°を守り、上限まで動かすことを目的にしない。

## 範囲と評価

読み取り元はsaved-r824。モデル造形・atlas・現用Export・製品登録は変更せず、無音・仮口パクの動画で演技を確認する。大表示と配信サイズを併記し、正面から開始、閉眼、大小の弾み、開眼、対象を向いた収まりまでを示す。

評価したいのは「相方へ笑いかけてくれた」と読めるか、向き直りと笑顔が別々の操作に見えないか、瞳の違和感が再発しないか。提示動画は本人採用済み。

動作定義・描画・検証の原本は[speech-motion-shared-laughter-partner-v1/](speech-motion-shared-laughter-partner-v1/)に保存する。

## 試作結果

[相方版動画](speech-motion-shared-laughter-partner-v1/partner.mp4)は6.25秒・20fps、大表示と配信内を想定した小表示を併記。無音・仮口パク。[主要姿勢](speech-motion-shared-laughter-partner-v1/contact-sheet.png)と[動作定義](speech-motion-shared-laughter-partner-v1/definition.json)を保存した。

顔・上体を画面左へ向けながら笑みを立ち上げ、向きがほぼ落ち着く頃に二拍の弾みへつなぐ。最大の顔横回転は約-17°で、終端は-14.5°へ少し戻して相方への向きを保つ。rootは主要姿勢を目視し、方向と閉眼・弾み・開眼の順序を確認した。ユーザーが動画を確認し、この演技を採用した。

[検証記録](speech-motion-shared-laughter-partner-v1/verification.json)では、v2の笑顔曲線・Stage Y・仮口パク定義を保持し、全125frameで瞳XY=0、通常瞬きなし、横回転上限内、Stage終端0。開始・一拍目・終端は通常Host PNGと一致。入力snapshot全hash不変、動画全デコード成功。実音声・配信・製品接続の動作確認ではない。

## 製品登録の追記

2026-11-12、採用原本を保持して現用r825へ登録し、普段の通常exe/portableを更新した。旧6組と新3組の配布再生・独立レビュー合格。上記の「製品未登録」「Export不変」は試作時の記録。現在の到達点・再起動手順・バックアップは[登録完了](../implementation/waves/shared-laughter-registration/completion.md)を参照。本人の実会話確認待ち。
