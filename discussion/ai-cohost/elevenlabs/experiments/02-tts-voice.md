# Experiment 02 — TTS の声選びと手触り

> Status: 実施(2026-10-18)。目的は乗り換えの判断ではなく「どのくらいの手触りか試す」(ユーザー 2026-10-18)。
>
> 結論(ユーザー合意 2026-10-18):
> - 声は Voice Design で作った **「案3」**(`Ona22sJYfzcps6cE1jVk`、マイボイスに保存済み)。その後の手直しでは超えなかった。
> - 案3の印象が保たれるのは `eleven_v4` と `eleven_v4_turbo` だけ。`eleven_v3` と `eleven_flash_v2_5` は別の声に聞こえ、Flash は日本語として崩れる台詞もある。
> - 日本語の台詞の頭に英語の音声タグを付けると効く。タグの文字は読み上げられない。
> - 短い相槌も v4 / v4 Turbo では自然に聞こえる。

## 1. 声選びの経過

1. **共有ボイスから10人**(Kano、Nao、Romaco、Mitsuki、Kuon、Irohauta、Akari、Miki、Haru、Suzu。プレビュー音声で聞いた)。
   - ユーザーの評価は「もうちょっと明るい感じがいい」。
   - 今の AivisSpeech の声(まお、ID 888753760)の印象が強いので、それに寄せたい。
   - 10人の中では Nao が近いが、もう少し声が高い印象がほしい。
2. **まおの声をクローンする案は見送った。**
   - まおは ACML 1.0(作者はオズチャットさんら)。商用を含めて使えて、クレジットは任意。
   - ただし、生成した音声を別のサービスの学習やクローンに使ってよいかは書かれていない。ElevenLabs のクローンは声を使う権利が前提で、元の話者さんの同意は確かめられない。
3. **Nao の Remix はできなかった。** 共有ボイスは 400 `Only your own custom voices can be remixed.` で断られる。Remix できるのは自分で作った声だけ。
4. **Voice Design**(`POST /v1/text-to-voice/design`、`eleven_ttv_v3`)で、試し文105文字を付けて3案を作った。ユーザーは案3を選んだ。注文文は次のとおり。
   > A young Japanese girl in her late teens with a high-pitched, bright, sparkling voice. Cute, sweet and playful, a little teasing, very cheerful and energetic, bouncy anime-style delivery with lively intonation and frequent smiles in the voice. Clear, crisp articulation, light and airy tone, not breathy, not childish. Natural, fluent Japanese.
5. 案3を保存(`POST /v1/text-to-voice`)したうえで、`POST /v1/text-to-voice/{voice_id}/remix` で3回直した。どれも元の案3を超えなかった。
   - 「幼さを少し減らす」→ 元の方がいい。
   - 「ほんの少し少年っぽさ・中性的さ」→ 元の方がいい。ユーザーいわく、言いたいことの伝え方が違っていた。
   - 「声をほんの少し低く」→ 元の方がいい。「これ以上になることはなさそう」(ユーザー)。

## 2. 手触り(案3 × 台詞6本 × モデル4つ)

- 台詞の内訳:
  - 相槌2本(「うんうん！」「へぇー、そうなんだ！」)
  - 普通の返事1本
  - タグ付き3本(`[laughs]` `[excited]` `[whispers]` を日本語の台詞の頭に付けた)
- 呼び方: `POST /v1/text-to-speech/{voice_id}/stream`、`language_code=ja`、`mp3_44100_128`。時間は日本から、リクエストを出してから測った。
- `eleven_flash_v2_5` はタグが効かないので、タグを外して読ませた。

| モデル | 鳴り始め | 全体 | 案3の印象 |
|---|---|---|---|
| `eleven_v4_turbo` | 約0.17〜0.20秒 | 0.3〜0.6秒 | v4 とほぼ同じ |
| `eleven_flash_v2_5` | 約0.17秒 | 0.2〜0.3秒 | 別の声。日本語として成立しない台詞もある |
| `eleven_v4` | 約0.6秒 | 0.8〜1.2秒 | 案3のまま |
| `eleven_v3` | 約0.7秒 | 1.2〜2.2秒 | 別の声 |

- 表の数字は、各モデルの最初の1本を除いた値。最初の1本だけ遅かった(v4 4.0秒、v3 2.2秒、Flash 2.0秒、v4 Turbo は遅くならなかった)。接続か、サーバー側の立ち上がりの分と見ている。配信では、事前に1回鳴らして温めておく必要がありそう。
- **`eleven_v4_turbo` は普通の TTS HTTP(stream)で動いた。** [../research/tts-controls-2026-10.md](../research/tts-controls-2026-10.md) で「要実機確認」にしていた点が解けた。
- タグ: 笑い・はしゃぎ・ささやきになっていて、タグの文字は読み上げられない(ユーザー確認)。
- 相槌(「うんうん！」「へぇー、そうなんだ！」): v4 / v4 Turbo で自然(ユーザー確認)。

## 3. クレジット

- 声選びから手触りまでで、使用量は 4,383 → 5,020 以上になった(Starter の枠 34,526)。手触りの回の分はまだ反映されていない。
- 反映は数十秒〜1回分遅れる。Voice Design・Remix は1回(3案)あたり約100。

## 4. 記録の扱い

- 音声と生成スクリプトは `tmp/elevenlabs-tts/`(gitignore)と作業用の一時フォルダにだけ置き、リポジトリには入れない。
- 保存した声は ElevenLabs のマイボイスに「Chappy trial (design-01 #3)」として残っている。Remix の案は保存していない。

## 5. 残り

- 口の動き: ElevenLabs は文字ごとの時刻を返すが、今の口の形はモーラの時刻から作っている。ここの対応付けが一番の山。
- 繋ぎ方: 返事を文ごとに区切って送るか、WebSocket で流し込むか。声の設定(`voice_settings`)とタグの付け方を誰が決めるか(Decisions API で決める案。[../_map.md](../_map.md) §4)。
