# 短く息を抜く — ゲーム・相方・視聴者の3案

GPT-6 Astraによる無音の創作試作。全案、同じr804モデル・画角・正面ニュートラルから始まり、他の注意対象を見ていた前提を持たずに独立選択できる。製品の自動選択には未接続。

## 演技の違い

| 案 | 対象位置 | 一続きの演技 |
|---|---|---|
| ゲーム | 真正面 | 頭が緩む分を目で補い、真正面のゲームを見守りながら短く息を抜く。持ち直した後も正面への注視を保つ。横への向き変化は足さない。 |
| 相方 | キャラ右・画面左 | 目が先に相方へ向き、顔と小さな上体の向きが追う。顔が向く途中で短くほどけ、相方への注意を保って持ち直す。ユーザー承認済み版をそのまま保持。 |
| 視聴者 | 正面より少し上 | 上への目線が先行し、顔が小さく追う。視聴者への注意を保ちながら小さくほどけ、短い間の後に上への視線を残して持ち直す。 |

危機の途中で短く息を抜けた安堵。休み切らず、注意を維持する。事前の身構え・大きな吸気・発見動作・挨拶は足していない。笑み差分・眉・口パク・音声なし。曲線は対象ごとに作り、同じ動画のラベル替えや左右置換にはしていない。

Stage Y最大はゲーム12.5px・相方14px・視聴者12px。沈みの後、一本の長いquintic曲線で0へ回復する。ゲーム4.21秒・相方4.38秒・視聴者4.36秒に0へ戻り、製品の自然解除400msを含めた後にも余白がある。頭・胴・視線は対象への落ち着いた姿勢で止まる有限モーションで、ループ素材ではない。

## 成果物

- `game.mp4` / `partner.mp4` / `viewers.mp4`: 各520×548、24fps、125フレーム、約5.208秒、無音。
- `comparison.mp4`: ゲーム・相方・視聴者の順に3列同期比較。1560×548、同尺。
- `contact-sheet.png`: 各案の正面開始から5.12秒の終端まで8時点。
- `definition.json`: 時刻付きパラメータ・Stage Y・画角・対象位置・演技意図。
- `provenance.json`: r804モデル資産のパスとSHA256。描画前に照合し、読取のみ。
- `evidence.json`: 全フレームの入力パラメータと製品合成後のpan Y。
- `approved-partner-reference.json`: 2案追加前の承認済み相方定義・全125 PNG・MP4のSHA256。再生成の一致を検証。
- `verification.json`: MP4全フレームのデコード・尺・無音・解像度・相方同一性の確認結果。

## 描画経路と制限

頭・胴・視線は既存runtimeモデル評価器で評価し、software rendererでオフライン描画。Stage Yは製品 `SpeechMotionState` の補間・開始180ms・自然解除400msと `RuntimePlayerStageMotionRuntime` のPresence Off合成を使用。GUI・WebSocket・Control Channel・音声経由ではない。本番preset登録・Decision接続は未実施。

頭・胴等の終端は保存姿勢保持であり、製品presetの区間終了時の解除動作は再現していない。Stage Yの自然解除は動画内に含む。頭横向きは80%上限24度以内（相方最大19度、ゲーム・視聴者0度）。開始PNGは3案でバイト一致を検証する。

## 再現（repo直下のPowerShell）

```powershell
node node_modules/vitest/vitest.mjs run --config discussion/ai-cohost/experiments/speech-motion-brief-relief-variants-v1/vitest.config.mjs
python discussion/ai-cohost/experiments/speech-motion-brief-relief-variants-v1/assemble.py
python discussion/ai-cohost/experiments/speech-motion-brief-relief-variants-v1/verify.py
```

Node/Vitest、Python/Pillow、FFmpeg、Windowsの游ゴシックを使用。モデルの既定位置はprovenance内。`R804_MODEL`で同じハッシュのモデルの位置を指定できる。生成したフレームと再現出力は `tmp/speech-motion/brief-relief-variants-v1-reproduction/` に保存する。

方向はユーザーの最新訂正（ゲーム＝真正面、視聴者＝上）を反映。途中のゲーム下方・視聴者カメラ正面案は未採用で、最終定義・動画へは使用しない。

## 今回の確認結果

最新方向の保存定義による描画検証1件が通過。3案の開始PNG一致、r804資産ハッシュ一致、横向き上限、Stage Y範囲・終端0・終了後0を確認した。相方の定義・全125 PNG・MP4はユーザー承認時と完全一致。4本のMP4全125フレームをデコードし、音声ストリームがないことを確認した。Astraが最新の3案主要フレームを実際に目視し、正面注視のゲーム、横への関わりを伴う相方、控えめな上方注意を伴う視聴者の違いと、各案の沈み・持ち直し・終端余白を確認した。視聴者は大きく仰ぎ見ず、目線主体の小さな上向きとしている。
