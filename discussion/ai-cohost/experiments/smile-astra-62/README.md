# 相方への笑みを同じ台詞で見比べる

左はコミット `4caa13b8` の登録版、右は今回の[試作](performance.json)。相方は画面左。両側に同じr843モデル、閉じ目の笑顔、台詞、仮音声と簡易口パクを使う。右側は[全28本の比較後に採用・配置済み](../motion-library-astra-62/README.md)。

| 台詞 | 登録版 | 新作で試したこと |
|---|---|---|
| やった！ ちゃんと隙を見つけて倒したね。 | 嬉しさが弾む（02-joy） | 「やった！」は画面を見たまま思わず笑い、次の言葉は隙を見つけた相方に届ける。上体が少し遅れてついていく。 |
| あ、作るの僕だった。楽しみに待つ側になってた。 | 照れ笑いの採用改訂版（shy-v2） | 自分の勘違いに気づく間を置き、顎を引いて笑いをこぼす。後半は照れが残ったまま相方に向き直って話す。 |

台詞は[元の笑み比較](../speech-motion-smile-nuances-v1/README.md)の代表発話を使った。目の閉開は笑顔のキーフォームに任せ、通常の瞬きや眼球移動は重ねない。二世代の動画は同時に始め、短い演技は正面に戻ってから相手側の終了まで待つ。

## 再生と再生成

出力は `tmp/speech-motion/astra-62-smile-joy/comparison.mp4` と `tmp/speech-motion/astra-62-smile-shy/comparison.mp4`。[前回の比較](../game-curiosity-astra-62/README.md)と同じ環境で、リポジトリのルートから実行できる。

```powershell
python discussion/ai-cohost/experiments/game-curiosity-astra-62/preview.py discussion/ai-cohost/experiments/smile-astra-62/joy.json
python discussion/ai-cohost/experiments/game-curiosity-astra-62/preview.py discussion/ai-cohost/experiments/smile-astra-62/shy.json
```
