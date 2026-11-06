# 咳払いの落とし(段階 2)Domain A — Gnome 報告 2(親の側)

> 2026-11-06・Gnome(Orch-Sylph からの委任)。ブランチ `ai-cohost/cough-experiment`(切り替えなし・コミットなし)。
> 計画: [../../orchestration/cough-filter-stage2-plan.md](../../orchestration/cough-filter-stage2-plan.md) §1・§2・§4 A の 2〜6・8・§5。
> 前提: [domain-a-gnome-report-1.md](domain-a-gnome-report-1.md)(子の側)。子の側は作り直していない(手直しもなし)。

## 1. 結果

- `apps/soul/agent` で `node --test`: **2382 / 2382 pass**(1 回目のあと 2363 + 新しいテスト 19)。
- リポジトリの根で `pnpm run check:soul-zone`: **pass**(1639 files scanned・違反なし)。
- 依存と lockfile は変えていない。画面(`src/cockpit/ui/`・`view-logic/`・`styles.mjs`)は触っていない。固定の文面のテスト(`src/mind/` など)は触っていない。sherpa の import は増えていない(`audio-tagging.mjs` は 1 回目で `no-sherpa-in-parent` の対象に入っている。ear-pipeline はそこから純関数 `shouldTagTranscript` を読むだけ)。

## 2. 作成・変更したファイル(すべて `apps/soul/agent/` の下)

| ファイル | 種別 | 内容 |
|---|---|---|
| `src/ears/local-stt/local-stt-engines.mjs` | 変更 | `LOCAL_STT_DEFAULTS` / `LOCAL_STT_LIMITS` / `normalizeLocalSttSettings` に `coughMaxChars` / `coughSpeechThreshold` |
| `src/ears/local-stt/local-stt-engines.test.mjs` | 変更 | 既存の deepEqual 3 か所を新しい形に追随・新テスト 1 件 |
| `src/cockpit/cockpit-settings-store.mjs` | 変更 | `getLocalStt` がファイルのキー `localSttCoughMaxChars` / `localSttCoughSpeechThreshold` を読む・ヘッダと型 |
| `src/cockpit/cockpit-settings-store.test.mjs` | 変更 | 既存の deepEqual 3 か所を追随・新テスト 1 件 |
| `src/ears/transcript-buffer.mjs` | 変更 | 理由つきの破棄の口 `discard({startMs, endMs, text, reason:"cough", speech})`・`DiscardInfo` 型・ヘッダ |
| `src/ears/transcript-buffer.test.mjs` | 変更 | 新テスト 2 件 |
| `src/ears/ear-pipeline.mjs` | 変更 | 純関数 `coughSpeechToDrop` / `audioTaggingOffCause`(export)・`transcribeAndAppend` の比較と落とし(`dropCough`)・client へ `audioTaggingMaxChars`・診断 `audioTaggingOff`・`localSttReady.audioTagging`(真偽)・カウンタ `coughDropped`・ヘッダ |
| `src/ears/ear-pipeline.test.mjs` | 変更 | 新テスト 8 件 |
| `src/cockpit/cockpit-server.mjs` | 変更 | SSE `discard` に cough のときだけ `text`/`speech`・警告 `cough-filter-off`(場ごとに 1 回)・export `COUGH_FILTER_OFF_WARNING_ID` / `COUGH_FILTER_OFF_WARNINGS` |
| `src/cockpit/cockpit-server-cough.test.mjs` | 新規 | 場の結線のテスト 6 件(配信・Discord 2 人・漏れ・警告) |
| `scripts/cough-experiment.mjs` | 変更 | 実験の `stt.local` に `coughMaxChars: 0`・`coughSpeechThreshold: 0`(設定の spread のあと) |
| `scripts/cough-experiment.test.mjs` | 変更 | 新テスト 1 件 |

触っていない: 子の側(`local-stt-worker-core.mjs`・`local-stt-client.mjs`・`audio-tagging.mjs`・入口)・`discord-experience.mjs`(`speakerTranscriptMouth` は `{...buffer}` の展開で `discard` がそのまま各耳に渡るので変更不要)・`scripts/cockpit.mjs`(`settings.getLocalStt()` がそのまま新しい 2 つを運ぶので変更不要)・`src/cli/ears-cli.mjs`・`warnings.mjs`・画面。

## 3. 設定(§4 A の 6)

| ファイルのキー(`cockpit-settings.local.json`) | 正規化後の名前(`stt.local`) | 型・範囲 | 既定 | 0 のとき |
|---|---|---|---|---|
| `localSttCoughMaxChars` | `coughMaxChars` | 整数 0〜10 | 4 | 判定しない(client に 0 → 子は AudioTagging を作らない) |
| `localSttCoughSpeechThreshold` | `coughSpeechThreshold` | 有限の数 0〜1 | 0.1 | 落とさない |

- 範囲外・型違い(文字列・NaN・整数でない上限・null)は既定。名前は計画のとおり(変えていない)。
- 経路(Start ごと): `getLocalStt()` → `scripts/cockpit.mjs` の `localSttSettings`(ロールの hotwords だけ上書き)→ `checkEarEngine` → `earPlan.localStt.local` → `buildEarPipeline` の `stt.local` → `createEarPipeline` の `normalizeLocalSttSettings`。上限は `localSttFactory({... audioTaggingMaxChars: coughMaxChars})`(`client` の spread より後なので client の上書きでは消えない)、線は親の比較へ。
- 画面の設定(操縦席の UI・設定モーダル)には出していない。

## 4. 親の比較と落とし(§4 A の 2)

`ear-pipeline.mjs` の `transcribeAndAppend` で、`transcribe` が返ったあと・`disposed` の確かめのあと・`buffer.append` の前に、**ローカルのときだけ** `coughSpeechToDrop(transcribed, localSettings)` を呼ぶ。落とすのは次をすべて満たすとき:

1. 線 `coughSpeechThreshold` > 0
2. `speech` が有限の数(子が判定にかけた)
3. `shouldTagTranscript(text, coughMaxChars)`(子と同じ数え方で 1〜上限文字。上限超え・上限 0・空は通す側)
4. `speech < 線`(**線ちょうどは通す**)

落としたら `dropCough`: カウンタ `coughDropped` を足し、`buffer.discard({ startMs, endMs, text, reason: "cough", speech })`(listener の throw は `listenerError` の診断に落とす = append と同じ扱い)、診断 `transcriptDiscarded { type, reason: "cough", startMs, endMs, latencyMs }`(**文字・確率なし**)。`onTranscript` は呼ばない。発話としては成功(`asrDone`)。

- whisper(`useLocal` が偽)は比べない。`transcribeImpl` が `speech` を返しても積む(テストで固定)。ElevenLabs は `handleCommit` の経路で今までどおり(テストで固定)。
- 正本が `discard` を持たない場合(古い偽物)は、数えずに落とすだけ(積まない)。

## 5. discard の口の方式(§2 の 4)

**正本(`transcript-buffer.mjs`)に理由つきの破棄の口 `discard` を足した**(診断の変換ではない)。

- `discard(input)` は `discarded` を 1 足し、`onDiscard` の購読者へ `Object.freeze({ startMs, endMs, text, reason: "cough", speech })` を渡し、`{ appended: false, entry: null, reason: "cough" }` を返す。
- 理由は `"cough"` だけ受ける(`"blank"` は今までどおり `append` が決める)。`startMs`/`endMs`/`text`/`speech`(有限の数)を検証し、不正なら throw して何も数えない。
- 空転写の info の形(`{startMs, endMs, text, reason:"blank"}`)は変えていない。
- Discord: `speakerTranscriptMouth` は `{...buffer}` を展開して `append` だけを包むので、`discard` は場の正本のものがそのまま渡る。人の名前・id は渡らない。
- 結果として、`stats().discarded`・snapshot の `discarded`・SSE `transcript` の `discarded`・SSE `discard`・(画面の)ゴースト行が同じ道に乗る。画面の `diagnosticGhostLabel` は `transcriptDiscarded` / `audioTaggingOff` を知らない型として null(行を作らない)なので、ゴースト行は二重にならない(読んで確かめた・画面は触っていない)。

## 6. 確定した SSE `discard` の形(§4 A の 3)

```
// reason "blank"(今のまま・文字を載せない)
{ startMs, endMs, reason: "blank", appended, discarded }

// reason "cough"(足した 2 つは末尾)
{ startMs, endMs, reason: "cough", appended, discarded, text: string, speech: number }
```

- `text` は耳が正本に積むはずだった文字(client の `text`・`trim()` 済み)、`speech` は Speech の確率(数)。
- 誰の咳か(名前・人の番号・Discord の id・耳の key)は載せない(Discord 2 人のテストで固定)。
- `appended` / `discarded` は場の正本の数(咳の分が `discarded` に入る)。

## 7. 文字の漏れ(§4 A の 4)

文字と確率が出るのは SSE `discard`(reason cough)だけ。確かめたこと:

- **診断**: ear-pipeline の診断(= `onDiagnostic` の中身・ears-cli が丸ごと stderr に出すもの)に文字・確率が無い(`transcriptDiscarded` のキーは `type/reason/startMs/endMs/latencyMs` だけ・`audioTaggingOff` は決まった語だけ)。SSE `diagnostic` にも出ない。
- **警告**: `warningBoard`(SSE `warnings`・snapshot の `warnings`)に出ない。警告の文言は固定で、子の理由(sherpa のエラー文・パス)も入れない。
- **`[cockpit]` の行**: 標準出力 / 標準エラーを拾って文字が無いこと。`[cockpit] stt latency` の材料(`onSttLatency`)は積まれた行の分だけ呼ばれ、落とした咳では呼ばれない(方式と数だけ)。
- **snapshot・正本**: `/api/state`・`getTranscript()` に落とした文字が無い。
- **ファイル**: 製品のコードで正本の `onDiscard` を購読しているのは `src/cockpit/cockpit-server.mjs`(SSE の放送)と `scripts/cough-experiment.mjs`(実験の道具・利用者が走らせたときだけ・実験の正本)だけ、という固定のテストを足した(新しい購読者=新しいファイル・ログへの道ができたら落ちる)。`[cockpit]` の行と診断の出口はファイルに書く経路を持たない(棚卸し §5 のとおり)。

## 8. モデルが無いとき(§4 A の 5)と警告

- Start は止めない: `checkEarEngine` は CED-tiny を見ない(子の側の client が `modelsDir` 下で確かめ、無ければ判定なしで fork する)。テストで、判定なしの ready でも Start 200・`listening`。
- 耳 → 場: ear-pipeline が `onReady` で `info.audioTagging.enabled !== true` なら診断 `{ type: "audioTaggingOff", engine, reason }` を出す。reason は `audioTaggingOffCause` で決まった 4 語に写す(子の文言そのものは出さない):
  - `"not configured"` → `not-configured`
  - `"disabled …"` → `disabled`
  - `"audio tagging model not found …"` → `model-not-found`
  - それ以外(`"failed to load: …"`・`"worker did not report audio tagging"`・不明)→ `failed-to-load`
- 場(`cockpit-server.mjs` の `handleDiagnostic` → `warnCoughFilterOff`):
  - `model-not-found` / `failed-to-load` だけを警告にする。`not-configured` / `disabled` は警告しない(Orch-Sylph の判断どおり)。決まった語でない reason も警告しない。
  - **まとめ方**: 場ごとのフラグ `coughFilterOffWarned`。`openVenueTranscript`(場が開くとき)で false に戻し、最初の 1 回だけ `warningBoard.pushEvent("cough-filter-off", …)`。同じ場で何本の耳(Discord の人数ぶん)が知らせても 1 回。一回きりの出来事なので 60 秒で消える(上の帯の既定)。
- 警告のキーと文言(`COUGH_FILTER_OFF_WARNINGS`・export):

| reason | id / kind | severity | message | detail |
|---|---|---|---|---|
| `model-not-found` | `cough-filter-off` | warn | `Cough filter is off: audio tagging model not found` | `Fetch it with: node apps/soul/agent/scripts/fetch-local-stt-models.mjs --only ced-tiny` |
| `failed-to-load` | `cough-filter-off` | warn | `Cough filter is off: audio tagging model failed to load` | null |

  `source` は `zipformer` / `parakeet`(ローカルの方式のときだけ)。

## 9. 実験の道具(申し送り 8)

`scripts/cough-experiment.mjs` の `stt.local` に、設定ファイルの値の spread のあとで `coughMaxChars: 0`・`coughSpeechThreshold: 0` を置いた。

- 内側の本番の中身に AudioTagging が二重に作られない(client は `"disabled (max chars is 0)"` で init に載せない)。
- 親で落とさないので、区間の記録は段階 1 のまま。
- ear-pipeline は `audioTaggingOff`(reason `disabled`)を出すが、実験の `onDiagnostic` は知らない型を読み捨てる。
- 実験のテストは全部通る。新テストで「設定ファイルに書いてあっても 0 になる」ことを固定した。

## 10. 追加したテスト

| テスト(ファイル: 名前の頭) | §4 A |
|---|---|
| `local-stt-engines.test.mjs`: 咳払いの落としの 2 つの数(上限 整数 0〜10・既定 4 / 線 0〜1・既定 0.1)・範囲外と型違いは既定 | 6 |
| `cockpit-settings-store.test.mjs`: getLocalStt は咳払いの落としの 2 つの数を読む・範囲外と型違いは既定・他のキーの set で消えない | 6 |
| `transcript-buffer.test.mjs`: discard(cough): 積まずに discarded を数え、onDiscard に reason cough と speech を流す | 2・3 |
| `transcript-buffer.test.mjs`: discard: 不正な入力は throw して何も数えない | 2 |
| `ear-pipeline.test.mjs`: coughSpeechToDrop: 線より低いときだけ落とす(線ちょうど・null・線 0・上限超え・上限 0 は通す) | 2 |
| `ear-pipeline.test.mjs`: audioTaggingOffCause: 子の理由 → 決まった語 | 5・4 |
| `ear-pipeline.test.mjs`: (local・咳) 文字数の上限と線が子の係へ・既定 4 / 範囲外は既定 / 0 は 0 | 6 |
| `ear-pipeline.test.mjs`: (local・咳) Speech が線より低ければ落とす(cough・discarded・診断に文字と確率を載せない) | 2・3・4 |
| `ear-pipeline.test.mjs`: (local・咳) 境界 — 線ちょうど・null・線 0・上限超え・上限 0 は積む | 2 |
| `ear-pipeline.test.mjs`: (local・咳) 外から渡された正本(場・Discord)でも同じ口で落ちる | 2・8 |
| `ear-pipeline.test.mjs`: (whisper・ElevenLabs) 咳の比べはしない | 2 |
| `ear-pipeline.test.mjs`: (local・咳) 判定なしでも Start は成功・audioTaggingOff は決まった語だけ | 5・4 |
| `cockpit-server-cough.test.mjs`: 咳の SSE discard: cough のときだけ text と speech・blank の形は今のまま・discarded に咳の分 | 3 |
| `cockpit-server-cough.test.mjs`: 配信の耳(本物の createEarPipeline): 設定は Start ごと・咳は落ちて SSE discard だけに文字と確率 | 2・3・4・6 |
| `cockpit-server-cough.test.mjs`: 判定なし: Start は成功・警告は場ごとに 1 回・切ったときは警告しない | 5 |
| `cockpit-server-cough.test.mjs`: Discord(2 人・人ごとの本物の耳): どちらの咳も落ちて同じ SSE discard・誰の咳かは載せない | 8・3・4 |
| `cockpit-server-cough.test.mjs`: Discord(2 人): どちらの耳も「判定なし」でも警告は 1 回 | 5・8 |
| `cockpit-server-cough.test.mjs`: 落とした文字の行き先: onDiscard の購読者は場の放送と実験の道具だけ | 4 |
| `cough-experiment.test.mjs`: 本番の咳払いの落としは実験では切る(上限 0・線 0) | (申し送り 8) |

- どのテストも偽物の部品だけを使う。本物の sherpa・CED-tiny・マイク・Discord・LLM・外部 API は使わない。
- Discord のテストは既存の `cockpit-server-discord-d.test.mjs` の流儀に合わせた。本物の server・本物の Discord の体験の口・偽の Discord・本物の opusscript・本物の耳に、偽の VAD と偽のローカルの文字起こしの係を差す。設定は OS の一時フォルダの設定ファイル。

## 11. 裁量判断

1. **discard の口は正本に足した**(計画 §2 の 4 の「既存に近い」方)。診断から変換する方式は、`handleDiagnostic` の許可リストに文字を通す必要が出るので避けた。
2. **親でも文字数を数え直す**(`shouldTagTranscript`)。子が上限超えを判定しない約束に加えて、親でも上限超え・上限 0 を通す側に倒した。偽物や将来の子が上限超えで `speech` を返しても落ちない。
3. **判定なしの理由は決まった 4 語に写して診断に出す**(1 回目の質問 2 への答え)。子の文言(sherpa のエラー文・パスを含みうる)は耳の外へ出さない。警告は固定の英語の文言 2 種。
4. **警告は「一回きりの出来事」(pushEvent・60 秒で消える)で、場ごとのフラグで 1 回に絞った。** 状態の警告(setCondition)にすると、Stop まで出っぱなしになる。計画は「場ごとに 1 回だけ出す」と言っているので、出来事の方が合うと判断した。新しい場ではまた 1 回出る。
5. **警告の文言は英語**(指示と計画 §2 の 6 のとおり)。ただし既存の警告の文言は日本語なので、上の帯で 1 つだけ英語になる(§13 の質問 1)。
6. **`localSttReady` の診断に `audioTagging`(真偽だけ)を足した。** 画面の `diagnostic` の放送は許可リストなので、この欄は流れない。耳の CLI・実験で見える。
7. **`tagMs` は診断に出していない。** 数だけなので出してもよいが、今回の合格の条件に無いので見送った(§12)。
8. **カウンタ `coughDropped`** を耳の `stats()` に足した(数だけ)。

## 12. 残課題・リスク

- 本物の sherpa の `AudioTagging` での通しは確かめていない(指示どおり)。人のゲート(計画 §6)で確かめる。
- 判定の時間(`tagMs`)の実測は未確認(棚卸し §7 の 6)。必要なら次で診断の数として出す。
- 画面(wave 2・Domain B)は `discard` の `reason:"cough"`・`text`・`speech` を受けて札とゴースト行のラベルを作る。今の画面は reason を見ずに `(discarded)` のゴースト行を出すので、咳の分も今は `(discarded)` と出る。
- 画面の警告の表示が未知の `kind`(`cough-filter-off`)をどう描くかは読んでいない(画面は範囲外)。`message` をそのまま出す作りなら問題ない【推測】。
- 既存の診断 `localSttReady` の `hotwordsDropped` は hotwords の語(ロールの名前の手がかり)を配列で載せている。これは今回の変更の前からある(触っていない)。

## 13. 質問

1. 警告の文言は英語で固定した(指示どおり)。既存の上の帯の警告は日本語の短い文言なので、表示の揃いを優先して日本語にするか(例「咳の判定が止まっている(モデルが無い)」)。画面の wave で判断してよいか。
2. 警告は一回きりの出来事(60 秒で消える)にした。「判定なし」を場が開いている間ずっと出す(状態の警告)方がよいか。
