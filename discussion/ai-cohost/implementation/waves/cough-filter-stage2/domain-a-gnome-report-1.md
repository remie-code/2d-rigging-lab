# 咳払いの落とし(段階 2)Domain A — Gnome 報告 1(子の側)

> 2026-11-06・Gnome(Orch-Sylph からの委任)。ブランチ `ai-cohost/cough-experiment`(切り替えなし・コミットなし)。
> 計画: [../../orchestration/cough-filter-stage2-plan.md](../../orchestration/cough-filter-stage2-plan.md) §1・§2(1・2・3・7)・§4 A の 1 と 7・§5。

## 1. 結果

- `apps/soul/agent` で `node --test`: **2363 / 2363 pass**(着手前 2345 + 新しいテスト 18)。
- リポジトリの根で `pnpm run check:soul-zone`: **pass**(1638 files scanned・違反なし)。
- 親の側(`ear-pipeline.mjs` の比較と落とし・discard の口・SSE・設定キー・場の警告・Discord)は触っていない。

## 2. 作成・変更したファイル(すべて `apps/soul/agent/` の下)

| ファイル | 種別 | 内容 |
|---|---|---|
| `src/ears/local-stt/audio-tagging.mjs` | 新規 | CED-tiny の置き場の決まりと判定の純関数(sherpa を import しない) |
| `src/ears/local-stt/audio-tagging.test.mjs` | 新規 | 上の純関数・実験の lib が同じものを re-export していることの固定 |
| `src/ears/local-stt/local-stt-worker-core.mjs` | 変更 | init で AudioTagging を作る(失敗しても fatal にしない)・transcribe で判定・ready / result に項目を足す・ヘッダの IPC 説明 |
| `src/ears/local-stt/local-stt-worker-core.test.mjs` | 変更 | 既存の deepEqual 2 か所を新しい形に追随・判定のテスト 8 件 |
| `src/ears/local-stt/local-stt-client.mjs` | 変更 | オプション `audioTaggingMaxChars` / `existsImpl`・init に載せる・ready と transcribe の戻りに通す・`planAudioTagging` を export |
| `src/ears/local-stt/local-stt-client.test.mjs` | 変更 | 既存の deepEqual 3 か所を新しい形に追随・判定の通しのテスト 5 件 |
| `src/ears/local-stt/no-sherpa-in-parent.test.mjs` | 変更 | 実行時チェックの `PARENT_MODULES` に `audio-tagging.mjs` を足す(縛りは緩めていない。「sherpa を読むのは子の入口 2 つだけ」はそのまま) |
| `scripts/cough-experiment-lib.mjs` | 変更 | 置き場・純関数を本番から import して re-export。実験の文言の `checkCedTinyModel`・`CED_TINY_FETCH_COMMAND`・`summarizeAudioEvents`・`sanitizeTagMessage` は実験側に残す |
| `scripts/fetch-local-stt-models.mjs` | 変更 | 置き場を本番から import・`--only` なし(空)の既定で CED-tiny も plan に載せる・ヘッダ |
| `scripts/fetch-local-stt-models.test.mjs` | 変更 | 既定の plan の期待を `["parakeet","zipformer","ced-tiny"]` に・揃っているものは載らない・`--only parakeet,zipformer` は CED を取らない |

触っていない: `ear-pipeline.mjs`・`transcript-buffer.mjs`・`cockpit-*`・`local-stt-engines.mjs`・`local-stt-worker.mjs`(入口。新しい import は不要だった)・実験の子と親(`cough-experiment-worker*.mjs`・`cough-experiment.mjs`)・固定の文面のテスト。

## 3. 確定した IPC の形(`local-stt-worker-core.mjs` のヘッダにも同じ記述)

### 親 → 子 `init`(足した項目)

```
{ type: "init", engine, files, threads, hotwords, hotwordsScore,
  audioTagging?: { model: string, labels: string, maxChars: number, threads?: number } }
```

- `audioTagging` が無い・null → 判定なし(reason `"not configured"`)。
- `maxChars` が正の整数でない(0 など)→ 判定なし(reason `"disabled (max chars is 0)"`)。AudioTagging も作らない。
- `model` / `labels` が空・文字列でない → 判定なし(reason `"model paths are missing"`)。
- `threads` は省略時 1(実験と同じ)。topK はラベルの表の行数(読めなければ 527)。

### 子 → 親 `ready`(足した項目)

```
{ type: "ready", loadMs, decodingMethod, hotwordsUsed, hotwordsDropped,
  audioTagging: { enabled: boolean, reason: string | null, loadMs: number | null } }
```

- AudioTagging の作成に失敗しても **fatal にしない**。認識器は作って ready を返し、`enabled:false`・reason `"failed to load: <エラーの 1 行・200 字まで>"`。sherpa に `AudioTagging` が無いときも同じ扱い。
- 認識器の作成失敗は今までどおり `fatal` → exit(1)。
- sherpa の読み込み(`deps.loadSherpa()`)は 1 回で、認識器と判定で同じものを使う。

### 子 → 親 `result`(足した項目・常に載る)

```
{ type: "result", id, text, ms, tagged: boolean, speech: number | null, tagMs: number | null }
```

- `tagged`: 判定にかけたか。判定あり、かつ `countChars(text)` が 1 以上で maxChars 以下のときだけ true。
- `speech`: Speech(AudioSet の番号 0)の確率。判定にかけないときは null。判定にかけて失敗したとき(compute が throw・結果が配列でない・番号 0 が無い・数でない)も null。
- `tagMs`: 判定にかかった時間。判定にかけないときは null。
- 判定の失敗では `error` にも `fatal` にもしない。文字起こしの結果は必ず返す。文字起こしの失敗は今までどおり `error`(判定はしない)。
- 判定に渡す音は区間の pcm そのまま(余白込み)を Float32 にしたものを、`padToDuration` で 0 を足して 5 秒にのばしたもの(認識器に渡すものと同じ配列が元)。
- 子はログにも stderr にも何も書かない(本文・確率とも。今の流儀のまま)。

## 4. client のオプションと戻り(`local-stt-client.mjs`)

### 足したオプション

| オプション | 型 | 意味 |
|---|---|---|
| `audioTaggingMaxChars` | `number?` | 判定にかける文字数の上限。正の整数のときだけ判定を試す。省略なら判定なし(`"not configured"`)。0・負・整数でない値なら判定なし(`"disabled (max chars is 0)"`) |
| `existsImpl` | `(p) => boolean`? | テストで差し込む CED-tiny のファイルの有無。既定は「ファイルがあり 0 byte でない」 |

- CED-tiny のパスは **client が解決する**: 既存の `modelsDir`(既定 `vendor/models`)の下の `ced-tiny-audio-tagging-2024-04-19-int8/`(`checkCedTinyModel`)。
- 揃っていれば init に `audioTagging: { model, labels, maxChars }` を載せる。揃っていなければ載せず、判定なしで fork する。どちらでも ready(Start)は失敗しない。
- 純関数 `planAudioTagging(options)` → `{ init: {model, labels, maxChars} | null, reason: string | null }` を export(テスト用。2 回目で使ってもよい)。

### `ready` / `onReady` の info(足した項目)

```
{ loadMs, decodingMethod, hotwordsUsed, hotwordsDropped,
  audioTagging: { enabled: boolean, reason: string | null } }
```

**呼び出し側の受け取り方**: `await client.ready` の戻りか、`onReady(info)` の `info.audioTagging`。

- `enabled:true` → reason は null。
- client が init に載せなかったとき → 子の返事に関係なく、client の理由が入る。理由は `"not configured"`、`"disabled (max chars is 0)"`、`"audio tagging model not found (missing model.int8.onnx[, class_labels_indices.csv])"` のどれか。
- 載せたのに子が作れなかったとき → 子の理由(`"failed to load: …"` など)。
- 子が `audioTagging` を返さないとき(古い子・偽物の子)→ `"worker did not report audio tagging"`。
- 理由はどれも英語の 1 行で、文字起こしの文字は入らない。**置き場のフォルダ(利用者のパス)も入れていない**(ファイル名だけ)。

### `transcribe(wavBytes)` の戻り

```
{ text: string, rawText: string, ms: number, tagged: boolean, speech: number | null, tagMs: number | null }
```

- `text` は今までどおり `trim()` 済み。
- `speech` / `tagMs` は、`tagged` が true で値が有限の数のときだけ数になり、それ以外は null。

## 5. 新しい本番モジュール `src/ears/local-stt/audio-tagging.mjs` の export

| export | 内容 |
|---|---|
| `CED_TINY_MODEL_LAYOUT` | `{ dir: "ced-tiny-audio-tagging-2024-04-19-int8", files: { model: "model.int8.onnx", labels: "class_labels_indices.csv" } }`(実験と同じ値) |
| `resolveCedTinyModel({ modelsDir? })` | `{ dir, files: { model, labels } }`(既定 `DEFAULT_LOCAL_STT_MODELS_DIR`) |
| `checkCedTinyModel({ modelsDir?, existsImpl? })` | `{ ok: true, files }` か `{ ok: false, missing, reason }`。reason は英語 1 行で、フォルダは含めない |
| `AUDIO_TAGGING_LABEL_INDEX` | `{ speech: 0, cough: 47, throatClearing: 48 }` |
| `AUDIOSET_CLASS_COUNT` | 527 |
| `AUDIO_TAGGING_TARGET_MS` | 5000 |
| `AUDIO_TAGGING_THREADS` | 1 |
| `countLabels(text)` | ラベルの表の行数 |
| `buildAudioTaggingConfig(files, { threads, topK })` | sherpa の AudioTagging の設定(CED) |
| `countChars(text)` | 空白を除いたコードポイントの数(実験と同じ定義・同じ関数) |
| `shouldTagTranscript(text, maxChars)` | `maxChars` が正の整数で、`1 <= countChars(text) <= maxChars` のとき true |
| `padToDuration(samples, targetMs?, sampleRate?)` | 前後に同じだけ 0 を足して 5 秒にのばす |
| `speechProbability(events)` | 番号 0 の確率。取れなければ null |

実験の lib(`scripts/cough-experiment-lib.mjs`)は `CED_TINY_MODEL_LAYOUT`・`resolveCedTinyModel`・`countChars`・`countLabels`・`padToDuration`・`buildAudioTaggingConfig`・`AUDIO_TAGGING_LABEL_INDEX`・`AUDIO_TAGGING_TARGET_MS`・`AUDIOSET_CLASS_COUNT` を re-export している。これらは本番と同一の参照で、テストで固定した。実験のテストは変えずに全部通る。

## 6. 取得スクリプト(§4 A の 7)

- `planLocalSttModelFetch`: `only` が無いか空なら、Parakeet・Zipformer・CED-tiny のうち足りないものを載せる。`only` があれば、挙がったものだけを載せる。
  - `--only ced-tiny` は CED だけ。
  - `--only parakeet,zipformer` は CED を取らない。
- テストは plan だけを確かめた(`existsImpl` を差し込む。取得はしていない)。取得スクリプトは実際には走らせていない。

## 7. 裁量判断

1. **0 文字(空・空白だけ)は判定しない**: どうせ親が `blank` で落とすので、判定にかけても意味がない。指示のとおり。
2. **`result` には判定の 3 項目を常に載せる**(`tagged:false, speech:null, tagMs:null` を含む): 形が揃い、親で欠けた場合を考えずに済む。そのため既存のテストの deepEqual 5 か所を新しい形に直した(worker-core 2 か所、client 3 か所)。
3. **`tagMs` を足した**: 判定の時間の実測が未確認(棚卸し §7 の 6)なので、数だけを返す。診断に出すかどうかは 2 回目の裁量。
4. **判定の失敗を表す欄は別に作らなかった**: `tagged:true` かつ `speech:null` で失敗と分かる。エラーの文言は親へ送らない。
5. **CED のパスは client が解決し、事前に存在を確かめる**: 棚卸し §7 の 5 の (a) と (b) を両方とった。
   - 揃っていなければ init に載せない(理由は `"model not found"`)。
   - 揃っていても作成に失敗したら、子が握りつぶさずに理由を返す(`"failed to load"`)。
   - 呼び出し側から個別のパスを受ける口は作っていない(`modelsDir` だけ)。
6. **client の判定は「明示したときだけ」**: `audioTaggingMaxChars` を省略すると判定なしにした。
   - 既定 4 を client に持たせなかった。既定は設定の正規化(2 回目の `LOCAL_STT_DEFAULTS` など)が持つ前提。
   - こうしたので、今の実験の道具の振る舞いは変わらない。
7. **`checkCedTinyModel` は本番と実験で 2 つ**:
   - 本番は英語の 1 行で、フォルダを入れない。
   - 実験は今の日本語の文言(取得のコマンドつき)のまま。こちらは実験の lib に残し、本番の `resolveCedTinyModel` の上に作った。
   - `CED_TINY_FETCH_COMMAND` は実験の lib に残した。
8. **`summarizeAudioEvents` は実験に残した**: cough / throatClearing / top を出す実験専用の要約なので。本番は Speech だけを引く `speechProbability` を新しく作った。こちらは引けなければ null を返し、落とさない側に倒す。
9. **確率の範囲は確かめない**: 有限の数であれば通す(0〜1 に収めることはしない)。

## 8. 2 回目(親の側)への申し送り

- **つなぎ方**: `ear-pipeline.mjs` の `localSttFactory({...})` に `audioTaggingMaxChars: <localSttCoughMaxChars>` を足す。戻りの `speech` / `tagged` は `transcribe` から `transcribeAndAppend` に届く。
  - 今の `transcribe` の型は `{text, rawText}`(棚卸し §3)なので、型を広げる必要がある。
- **場の警告**: `await localStt.ready` の戻り(または `onReady` の info)の `audioTagging.enabled === false && reason` を使う。
  - `"not configured"` と `"disabled (max chars is 0)"` は、利用者が判定を切った結果なので、警告にしない方が自然【推測】。
  - 今の `onReady` の診断 `localSttReady` には `audioTagging` を載せていない(ear-pipeline は触っていない)。
- **実験の道具に注意**: 実験も `createEarPipeline` を通る。2 回目で ear-pipeline が既定で `audioTaggingMaxChars` を client に渡すようにすると、次の 2 つが起きる。
  - 実験の子の内側の本番の中身でも AudioTagging が作られる(読み込みが 2 重になる)。
  - 実験で親の落としが効く。ただし実験は `onDiscard` も区間として記録するので、記録は残る【推測】。
  - 対策: 実験の `stt.local` に上限 0 を渡す。なお ear-pipeline では `options.stt.local.client` の spread が明示の項目より先なので、client の上書きでは消せない。
- **Discord**: 子は人ごとに 1 つで、各子が AudioTagging を読む(1 つ約 6MB)。`ready` の理由は人ごとに来るので、警告は場で 1 回にまとめる(計画 §2 の 6)。

## 9. 残課題・リスク

- 本物の sherpa の `AudioTagging` での動作は確かめていない(指示どおり偽物だけ)。
  - 作り方と compute の呼び方は実験の子と同じなので、段階 1 で本物で動いたのと同じ経路。
  - ただし本番の子では、認識器のあとに AudioTagging を作る順になっている(実験は判定が先)。順でぶつかる可能性は低いと見ている【推測】。人のゲート(計画 §6)で確かめることになる。
- `compute` は同期なので、判定の間は子のイベントループが塞がる(棚卸し §3)。判定にかけるのは 4 文字以下の区間だけ。
- 判定なしの理由 `"failed to load: …"` には sherpa のエラーの文言がそのまま入る。文字起こしの文字は入らないが、sherpa がエラーにモデルのパスを含めると、利用者のパスが理由に出うる。2 回目で警告に出すときに、reason を出すか固定の文言にするかを決めてほしい。

## 10. 質問

1. 場の警告に出す対象: `ready.audioTagging.reason` が `"not configured"` や `"disabled (max chars is 0)"` のときは警告しない(利用者が切った)、という扱いでよいか。2 回目の裁量でよければそのまま進めてよい。
2. 警告の文言に子の reason(sherpa のエラーの 1 行)を入れてよいか、固定の文言にするか(§9 の 3 つ目)。
