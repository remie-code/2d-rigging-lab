# ローカルの文字起こし 人間ゲート

> Status: **合格(ユーザー 2026-10-28、約 2 時間の実配信)**。計画は [../../orchestration/local-stt-wave-plan.md](../../orchestration/local-stt-wave-plan.md) §2。

## 0. 準備

- 器(runtime-player)は変えていないので、作り直しは不要。
- モデルは `apps/soul/agent/vendor/models/` に配置済み。作り直すときは `node apps/soul/agent/scripts/fetch-local-stt-models.mjs`(README に手順)。
  - Parakeet の取得元は、sherpa-onnx の作者(csukuangfj)の Hugging Face。
  - Zipformer の取得元は、k2-fsa/sherpa-onnx の GitHub Releases。
- 操縦席を、今までどおり管理者で起動する。設定の入出力タブで、文字起こしを「Zipformer(ローカル)」にして Start する。モデルの読み込みに数秒かかる(Zipformer 約 4 秒、Parakeet 約 2.3 秒)。

## 1. 確かめる 6 点

| # | やること | 合格の目安 |
|---|---|---|
| 1 | Zipformer でしゃべる | 転写が出る。遅延バーの「文字起こし」の区間が、ElevenLabs と同じかそれより短い |
| 2 | ゲームと OBS を動かしながら続ける | 遅れや重さが気にならない |
| 3 | 「よし、」などで始まる発話 | 文の頭が欠けていない。欠けるなら設定ファイルの `localSttPreRollMs`(既定 200)を詰める |
| 4 | 「チャッピー」と呼ぶ | 反応する(名前の聞き取りの強さは `localSttHotwordsScore`、既定 1.5) |
| 5 | Parakeet に切り替えて Stop → Start | 動く |
| 6 | 配信のあと | ElevenLabs の残量が、文字起こしの分だけ減っていない |

## 2. 記録(ユーザー 2026-10-28)

- 約 2 時間の配信を Zipformer で行い、「特に問題なかった」(ユーザー)。6 点を 1 つずつ分けた報告は受けていない。
- 精度は ElevenLabs の方が圧倒的に高い(ユーザー)。ただし頭(gpt-6.1-sol)が前後の文脈で補い、差を感じさせなかった。
  - 例: 「2,3回」が「二十三回」と書き起こされたが、チャッピーは文脈から書き起こしの誤りだと分かり、「2,3回」として会話した。
- 遅れは気にならなかった(ユーザー)。
- 2 時間の使用量: Codex は週の枠の約 25%、ElevenLabs は月の枠の約 5%(ユーザー)。「十分満足な値」。
