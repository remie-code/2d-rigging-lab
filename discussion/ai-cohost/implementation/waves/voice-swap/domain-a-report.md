# 声の差し替え Wave 1 / Domain A — 器の流し込みの約束 完了報告

> Gnome → Undine(2026-10-18)。計画: [../../orchestration/voice-swap-wave-plan.md](../../orchestration/voice-swap-wave-plan.md) §1 Domain A。コミットはしていない。

## 1. 変更ファイル

器(`apps/runtime-player/src/main/control-channel/`):

- `contract/channel-intent-speech-stream-payload-schema.json`(新規)— 新 kind の payload スキーマ
- `contract/channel-protocol-contract.ts` — supportedKinds に `intent.speechStream`、op の語彙、発話全体の上限 4096、payload 型
- `contract/channel-envelope-schema.json` / `contract/channel-exchange-examples.json` — supportedKinds(4 種)、`speechStreamPath` の例
- `speech-timeline-state.ts` — 評価に `awaitingEnd` / `endAtMs` / `onsetAtMs` を足した
- `control-channel-overlay-store.ts` — 開いている発話(`#stream`)の管理、open/append/end、`setSpeech` を糖衣に置き換え
- `channel-intent-validation.ts` / `channel-request-dispatch.ts` / `channel-server.ts` — 検証、振り分け、配線
- テスト: `speech-timeline-state.test.ts` / `control-channel-overlay-store.test.ts` / `channel-intent-validation.test.ts` / `channel-request-dispatch.test.ts` / `channel-server.test.ts` / `contract/channel-protocol-contract.test.ts`

魂:

- `apps/soul/agent/src/channel/channel-client.mjs` — `openSpeech` / `appendSpeech` / `endSpeech`、必須 kind に `intent.speechStream` を追加
- `apps/soul/agent/src/test-support/ws-double.mjs` — 既定で 4 種を広告する。`onSpeechStream` 判定を追加
- `apps/soul/agent/src/channel/channel-client.test.mjs` — 4 件追加

`voice/` と `mind/` には触れていない。

## 2. 契約の最終形(`kind: "intent.speechStream"`)

| op | フィールド | 拒否 |
|---|---|---|
| `open` | `utteranceId`(空でない文字列) | 形が不正 → invalidPayload。口のグループが書けない → slotNotWritable |
| `append` | `utteranceId`、`timeline`(1〜512 件。要素は intent.speech と同じ `{timeMs, vowel, s}`) | 形が不正、続きになっていない(先頭が前回の最後以下)、発話全体で 4096 件を超える → invalidPayload。s が範囲外 → slotValueOutOfRange。書けない → slotNotWritable |
| `end` | `utteranceId` | 形が不正 → invalidPayload(書き込みの可否は見ない) |

- 拒否コードは増やしていない。
- 開いている発話以外の utteranceId を名指す append/end は、`accepted` を返したうえで何もしない。
- 例外として、続きの照合と上限の照合は開いている発話にだけ行う。

## 3. 評価の振る舞い

- **t=0**: open を受理した時刻。open だけでは口を動かさない。前の口の動きがあれば、それが続く。
- **最初の append**: このとき口の主になる(今の setSpeech と同じ手順)。
  - 6 スロットにかかっている個別の曲線を外す。
  - 今の開き(案B)から onset を始める。onset の起点は、append を受理した時刻(`onsetAtMs`)にした。
  - 時刻は t=0 からの相対で置く。
- **end の前**: データが尽きたら最後の母音を保ち続ける。done にはならない。
- **end の後**: 今と同じ終端(最後の間隔ぶん保持 → 400ms で閉じる)。
  - データが尽きてから end が届いた場合は、閉じ始めを end の時刻より前にしない(`endAtMs`)。保持している母音から連続して閉じる。
- **新しい open**: 前の発話を置き換える。
  - 前の発話がまだ end を待っていたら、その時点で end 扱いにする。これで、自然に閉じながら次の発話の最初の append を待つ。
- **停止**: 発話の流し込みを止め、その後に来る append/end は無視する。きっかけは次のどれか。
  - 口のスロットに届いた個別の intent(`intent.set mouth-open=0`)
  - releaseAll(切断・close)
  - clearAll
  - append がまだ来ていない発話も、同じように止まる。
- **intent.speech**: open + append + end を同時刻に流す糖衣にした。結果は今と同じ値になる。
  - 既存のテストは、期待値を変えずに全部通った。凸恒等式・onset・golden・reference-driver を含む。
  - 新しいテストで、すべての tick で `toStrictEqual` が一致することも確かめた。

## 4. テスト結果

- runtime-player の vitest: 142 ファイル、969 件すべて成功(934 → +35)。typecheck も成功。
- apps/soul/agent の `node --test`: 1399 件すべて成功(channel-client +4。Domain B の追加分も含む)。
- `check:soul-zone`: 成功。
- 参考:
  - 着手前の 1 回目の実行で、channel-server の WS open が 1 回だけ失敗した。負荷による偶発で、再実行では通った。
  - `check:source` は `physiology/index.ts` の既存違反で落ちる。今回触れていないファイル。

## 5. 裁量判断

1. **既存テストの期待値を 2 か所だけ変えた。**
   - `server.hello` の kind 一覧をそのまま固定していた 2 か所(contract test / channel-server test)で、3 種を 4 種に直した。
   - 計画 §1 の「hello の supportedKinds を揃える」の必然の帰結であり、凸恒等式・onset・golden とは関係がない。
2. **古い発話への append/end は accepted で黙って捨てる。**
   - accepted の応答スキーマは `additionalProperties:false` なので、「無視した」という印は付けていない。
3. **onset の起点は最初の append の受理時刻にした。**
   - 最初のデータが t=0 より遅れて届くと、起点を open にしたままでは口が飛ぶ。それを避けるため。
4. **最初の append まで口を前の発話に預けておく。**
   - open の時点で口を外すと、前の口がスナップして見えるため。
5. **遅れて届いた end は、その時刻から閉じ始める。**
   - 計画には書かれていないが、この形にしないと口がスナップする。
6. **Recent Events への accepted は、実際に効いた append だけで出す。**
   - 表示は mouth-open と先頭の s。open/end と無視した append では出さない。
7. **utteranceId の長さに上限を設けていない。** 64KiB のフレーム上限で抑えられる。
8. **同じ id で open し直した場合も、新しい発話として扱う。**
9. **魂の 3 メソッドは、sendSpeech と同じく async にした。**
   - 送信前のサイズ上限(64KiB)の失敗も reject として返る。

## 6. 質問

1. **end が来ないと、口が開いたまま残る。**
   - end の前は保持を続けるので、魂が end を送らないまま生きていると、口が開いたままになる。
   - 計画どおり、自動で閉じる時限は入れていない。止める手段は、mouth-open=0 か切断。
   - 安全のための時限(例: データが尽きて N 秒経ったら閉じる)が要るかを決めてほしい。
2. **データ不足のあとに続きが届くと、口の形が少し跳ぶ。**
   - 再生がデータに追いついたあとで続きが届くと、時刻は t=0 基準なので、口の形がその時刻の位置へ跳ぶ。
   - 届き方は再生の約 9 倍速なので、まず起きない想定。そのままでよいか。
