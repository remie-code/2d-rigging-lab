# 咳払いの聞き取り実験（段階 1）の試作の道具 — Gnome 報告

> 計画: [../../orchestration/cough-experiment-plan.md](../../orchestration/cough-experiment-plan.md)。ブランチ `ai-cohost/cough-experiment`（コミット・ブランチ操作はしていない）。

## 1. 作ったファイル・変えたファイル

新しく作ったもの（すべて `apps/soul/agent/` の下）:

- `scripts/cough-experiment.mjs`: 道具の親。マイク、本番の耳 `createEarPipeline`、記録、まとめを受け持つ。CLI の入口でもある。
- `scripts/cough-experiment-worker.mjs`: 実験の子の入口。sherpa-onnx-node を読み込むのはここだけ。
- `scripts/cough-experiment-worker-core.mjs`: 実験の子の中身。本番の子の中身を包み、`AudioTagging` を足している。
- `scripts/cough-experiment-lib.mjs`: 純関数。CED-tiny の置き場と在否の確認、のばし方、判定結果の要約、合図の順、合図の進め方（状態機械）、記録の形、まとめ。
- テスト:
  - `scripts/cough-experiment-lib.test.mjs`（12 件）
  - `scripts/cough-experiment-worker-core.test.mjs`（5 件）
  - `scripts/cough-experiment.test.mjs`（7 件）
- `src/test-support/fake-cough-experiment.mjs`: テスト用の偽物。中身は次の 4 つ。
  - 偽物の sherpa（`OfflineRecognizer` と `AudioTagging`）
  - 同じプロセスの中で実験の子の中身を動かす偽物の fork
  - 偽物のマイク
  - 偽物の VAD

変えたもの:

- `scripts/fetch-local-stt-models.mjs`: CED-tiny の取得を足した（§3）。
- `scripts/fetch-local-stt-models.test.mjs`: CED-tiny のテストを 1 件足し、`--only` の確認を 1 行足した。
- `src/ears/local-stt/no-sherpa-in-parent.test.mjs`: 許可を最小限に広げた（§2.1）。
- `.gitignore`: 末尾に `/cough-experiments/` を足した。先頭の `/` で直下だけに留め、既存の `/roles/` と同じ書き方にした。

**本番の耳のファイルは 1 つも変えていない。** `ear-pipeline.mjs`、`local-stt-worker-core.mjs`、`local-stt-client.mjs`、`local-stt-engines.mjs`、`local-stt-worker.mjs`、操縦席のどれにも触っていない。新しい export も足していない。使ったのは既存の注入口だけ。

`fetch-local-stt-models.mjs` は取得の道具で、耳の本番の流れには入っていない。それでも、次の理由で振る舞いは変わっていない。

- `--only` なしの既定は、今までどおり Parakeet と Zipformer だけを見る（`LOCAL_STT_ENGINES` の絞り込みはそのまま）。CED-tiny は `--only ced-tiny` のときだけ計画に入る。
- Zipformer の展開は、CED-tiny と共通の手順にまとめ直した（`ARCHIVES` の表を引く形）。配布元の URL、中のフォルダ名、あれば取り出す README.md、一時フォルダの名前の頭（`soul-zipformer-`）、ログの文言（`zipformer: アーカイブを取得中…`）は同じ値のまま。
- `--only` の確認先を `LOCAL_STT_ENGINES` から `FETCH_TARGETS`（その 2 つと `ced-tiny`）に広げた。既存の値はそのまま通り、`whisper` などは今までどおり throw する。

## 2. 設計の要点

### 2.1 親と子の分け方・IPC（sherpa を親で読まない）

親の `cough-experiment.mjs` は、本番の `createEarPipeline` をそのまま使う。

- 渡すのは `stt: { engine: "zipformer", local: {...設定ファイルの localStt, modelsDir, client} }`。
- `stt.local.client` は耳の既存の注入口で、`createLocalSttClient` にそのまま渡る。ここで次の 3 つだけを差し替えた。
  - `workerPath`: 実験の子 `cough-experiment-worker.mjs`
  - `workerArgs`: `--ced-model <model.int8.onnx> --ced-labels <class_labels_indices.csv> --ced-threads 1`
  - `forkImpl`: 本物の fork を包み、`message` の受け口を 1 つ足したもの（下の `tags` を読む）
- そのため、耳の部品はすべて本番のまま動く。対象は ffmpeg の取り込み、フレーマ、Silero VAD、区切り、リング、本物の音を前に 200ms、作り物の無音を前後に 300ms、ASR の直列キュー、見張り、fork の係。

子の中身 `cough-experiment-worker-core.mjs` は、本番の子の中身 `createLocalSttWorkerCore` を包む。文字起こしの設定の組み立て、hotwords、decodeAsync、直列化は本番のコードそのものが行う。外側で足したのは次の 2 つ。

- **init**: 先に `new sherpa.AudioTagging({ model: { ced, numThreads: 1, provider: "cpu", debug: 0 }, labels, topK })` を作る。topK はラベルの表の行数（527）。失敗したら `fatal` を送って exit(1) し、そのあと init を本番の中身へ渡す。`ready` には `taggerLoadMs` を足して返す。
- **transcribe**: 本番の中身が `result` を送るとき、それを横取りする。同じ pcm を約 5 秒にのばして `compute(stream, topK)` にかけ、`{ type: "tags", id, speech, cough, throatClearing, topLabel, topIndex, topProb, tagMs, taggedMs }` を `result` の前に送る。判定が失敗したときは `tags` に `error` を載せ、`result` はそのまま返す。
- 本番の `createLocalSttClient` は知らない種類の知らせを読み捨てる。`tags` を読むのは、親が fork に足した受け口だけ。IPC は順序を保ち、耳の転写は直列なので、「最後に来た tags」を次に積まれる区間に結びつければよい。

`no-sherpa-in-parent.test.mjs` の変更点（最小限）:

- sherpa を読み込んでよいソースを、`[local-stt-worker.mjs]` から `[local-stt-worker.mjs, scripts/cough-experiment-worker.mjs]` に広げた。実験の子の入口を名指しで 1 つ足しただけ。
- `PARENT_MODULES` に `scripts/cough-experiment.mjs`、`scripts/cough-experiment-lib.mjs`、`scripts/cough-experiment-worker-core.mjs` を足した。実行時の hook で、これらを読んでも sherpa の解決が起きないことを固定する。
- 静的な import のたどり方の入口にも `scripts/cough-experiment.mjs` を足した。たどった先に sherpa も、本番と実験の子の入口も無いことを固定する。

広げた理由: 本番の子を変えずに、本番と同じ文字起こしに判定を足すには、sherpa を読む実験専用の子が要る（計画 §3 の 1 の推奨形）。親の道具は耳の VAD（onnxruntime-node）を読むので、sherpa を読ませない。

### 2.2 のばし方

- `padToDuration(samples, 5000ms)` で、前後に同じだけ 0 を足して 5 秒にする。もとから 5 秒以上ならそのまま。
- 判定に渡すのは、耳が文字起こしに渡すのと同じ音。区間に、本物の音を前に 200ms、作り物の無音を前後に 300ms 含んだものになる。文字数に関係なく、全区間を判定する。
- 前後の両側に足すか片側に足すかは調査に書かれていなかったので、両側に分けた（§5 の裁量）。

### 2.3 合図の流れ

- `buildCuePlan`: 4 種類（`throat_clear` 咳払い・`un`「うん」・`uun`「うーん」・`light_cough` 軽い咳）を 10 回ずつ並べ、Fisher–Yates で混ぜる。乱数は注入でき、`--seed` で再現できる（mulberry32）。
- 開始前に短い説明とマイクを表示し、モデルを読み込む。そのあと「Enter で始める」を待つ。合図は `[7/40] 咳払いを 1 回してください` の形で出す。
- 区間の結びつけ（`createCueSession`）:
  - 区間は「話し始めた（speechStart）ときに出ていた合図」のもの。
  - 区切り（speechEnd）の `endMs` で、あとから来る文字起こしの結果と突き合わせる。耳の転写の `endMs` と同じ値になる。
  - 合図の前に話し始めた区間は記録しない。
- 次の合図へ進む条件:
  - 話していない
  - その合図の区間の結果が全部来た
  - 最後の動きから 1.5 秒静か
  - そのうえで、区間が 1 つ以上来たか、合図から 8 秒たった
- 30 秒たったら必ず進む。区間が 1 つも無いまま進むときは「区間なし」を記録する。
- 1 つの合図の間に区間が複数来たら、全部その合図の印で記録する。
- 文字起こしの失敗（`asrFailure` / `emptyCut` / `asrSkipped` / `asrDropped`）も、その合図の区間として `outcome: "failed"` で記録する。
- Ctrl+C（AbortSignal）で合図を止め、耳を畳み、そこまでの分でまとめを出す。記録は 1 件ごとにファイルへ足しているので、それまでの分は残る。2 回目の Ctrl+C は即座に終わる。

### 2.4 記録の形（1 行 1 件の JSONL・音は書かない）

```
{"cue":"throat_clear","cueLabel":"咳払い","round":3,"seq":7,"outcome":"segment","text":"うん","chars":2,"durationMs":420,
 "speech":0.31,"cough":0.02,"throatClearing":0.44,"topLabel":"Throat clearing","topProb":0.44,"at":"2026-11-06T…Z"}
```

- 各欄の意味:
  - `round`: その種類の何回目か
  - `seq`: 通しの何回目か
  - `chars`: 空白を除いた文字数
  - `durationMs`: 耳の区切りの範囲の長さ。前後の余白は含めない
  - 確率: 小数 4 桁
- `outcome` は 3 種類。
  - `segment`: 空の文字起こしも含む（`text: ""`）
  - `no_segment`: 区間なし。文字と確率は null
  - `failed`: `reason` に失敗の種類を入れる
- 書く値は文字・数・null だけ。テストでは、欄が決まったものだけであること、値が配列や物でないこと、ファイルが小さいこと、置き場に JSONL 以外のファイルを作らないことを固定した。
- 置き場は `apps/soul/agent/cough-experiments/<ローカル日時>.jsonl`（例 `2026-11-06T21-05-09.jsonl`）。`/cough-experiments/` は git から外してある。
- 声は保存しない。
  - 音は耳のリングと IPC のメモリの中だけにある。一時ファイルも書かない。
  - 子から返す判定の知らせ（`tags`）にも、音のサンプルは載せない。
  - 親は `sanitizeTagMessage` で、数と短い文字列以外を落とす。

### 2.5 終わりのまとめ

- 合図の種類ごとに、次をターミナルに出す。
  - 合図の回数、区間の数、区間なしの数、失敗の数
  - 文字の内訳（例 `「うん」×6、「ん」×3、（空）×2`）
  - Speech / Cough / Throat clearing の最小・中央・最大（件数つき）
- 最後に結果のファイルの場所と件数を出す。

### 2.6 本番に揃えたところ

- マイク: 操縦席と同じく、設定ファイルの `lastDevice`（操縦席で最後に選んだマイク）を使う。dshow なら `audio=` を付ける（`normalizeDevice`）。`--device` で上書きできる。dshow でマイクが決まっていなければ 1 行出して止まる。
- 文字起こしの設定: 設定ファイルの `localStt*`（`settings.getLocalStt()`）を使う。
- 区切り・VAD: 道具は上書きしない。本番の `EAR_DEFAULTS` と、Silero VAD の既定のモデルのまま。テストで固定した。
- 実データの設定ファイルを読むのは、CLI の入口（`isMain`）が動いたときだけ。設定の係は動的 import で読む。テストは設定を注入し、実データには触れない。

## 3. コマンドと場所

- モデルを取る（約 28.5MB のアーカイブから 2 つだけ取り出す。Undine がユーザーの OK のもとで走らせる）:
  `node apps/soul/agent/scripts/fetch-local-stt-models.mjs --only ced-tiny`
  - 置き場: `apps/soul/agent/vendor/models/ced-tiny-audio-tagging-2024-04-19-int8/`。中身は `model.int8.onnx` と `class_labels_indices.csv` で、README.md はあれば取り出す。
  - 取る前に確かめるだけなら `--dry-run` を付ける。
  - Zipformer がまだ無ければ `--only zipformer,ced-tiny` で両方取れる。
- 道具を走らせる（ユーザー）:
  `node apps/soul/agent/scripts/cough-experiment.mjs`
  - マイクを指定するときは `--device "マイクの名前"` を付ける。
  - 短く試すときは `--per-kind 2`、順を再現するときは `--seed 1`。
  - `--out-dir <dir>` と `--models-dir <dir>` も使える。
  - モデルが無いときは、取得のコマンドを含む 1 行を出して、終了コード 1 で止まる。
- 結果: `apps/soul/agent/cough-experiments/<日時>.jsonl`

## 4. テスト結果

- `apps/soul/agent` で `node --test`: **tests 2345 / pass 2345 / fail 0**（cancelled 0）。着手前の土台は 2320 件で、足したのは 25 件。
- リポジトリの根で `pnpm run check:soul-zone`: **pass**（「Soul zone boundary guard passed: 1636 source files scanned」）。
- そのほかに確かめたこと:
  - `node scripts/fetch-local-stt-models.mjs --dry-run --only ced-tiny --models-dir <スクラッチ>`: 計画を表示するだけで、取得もフォルダの作成もしない。
  - 新しいファイルを tsc の `--checkJs --noEmit` で確かめ、型の誤りは無かった（補助の確認。機械ゲートではない）。
- 走らせていないもの: 本物のマイク、ffmpeg、本物の sherpa、操縦席、モデルの取得（ダウンロード）。
- 読んでいないもの: 実データの設定ファイル、`vendor/models/` の中身。

## 5. 裁量判断

1. **本番の子の中身を包む形にした**。新しく recognizer を作る代わりに、本番の子の中身 `createLocalSttWorkerCore` を包んで、本番と同じ文字起こしを保証した。fork の係も、本番の `createLocalSttClient` を、既存の注入口 `stt.local.client` で使い回した。本番のファイルには何も足していない。
2. **区間の数え方**: 空の文字起こし（転写バッファが捨てる行）も区間として記録した（`text: ""`。まとめでは「（空）」）。区切りの音が切り出せなかったり、文字起こしが失敗したりした区間は `failed` にした。
3. **のばし方**: 5 秒に足りない分を前後に半分ずつ足した。5 秒以上ならそのまま。
4. **合図の進め方の時間**: 区間が来なければ 8 秒で「区間なし」、最後の動きから 1.5 秒静かなら次へ、30 秒で必ず次へ。どれも定数で、`timing` で変えられる。
5. **Enter で始める**: 説明とモデルの読み込みのあと、Enter を待つ。
6. **`--per-kind` と `--seed`**: 短い試しと順の再現のために足した。既定は 10 回で、乱数は Math.random。
7. **CED-tiny は既定では取らない**: `--only ced-tiny` のときだけ取る。耳の本番で使わないものを、既定の取得に混ぜないため。
8. 判定のスレッドは 1（調査 §4: tiny の 1 スレッドで、5 秒の入力が約 15ms）。

## 6. 質問・残るリスク

1. **hotwords の出どころ**: 本番の操縦席は、設定ファイルの `localStt*` に、今のロールの `nameHints.hotwords` を重ねている（`cockpit.mjs` の `applyRoleHotwords`）。道具はロール（`roles/`、実データ）を読まず、設定ファイルの値だけを使う（既定は「チャッピー」「コーディ」）。どちらも hotwords があれば `modified_beam_search` になるので、大きな違いは無いと見ている。ただ、ロールの hotwords まで本番と同じにしたいなら、道具で roles を読む必要がある。それでよいか。
2. **配布物の名前**: アーカイブの名前とサイズ（`sherpa-onnx-ced-tiny-audio-tagging-2024-04-19.tar.bz2`、28,531,989 bytes）は、GitHub の Releases API のアセット一覧で確かめた。中のフォルダ名（`sherpa-onnx-ced-tiny-audio-tagging-2024-04-19/`）と、ファイル名（`model.int8.onnx`、`class_labels_indices.csv`）は、公式の例 `test_audio_tagging_ced.js`（ced-mini のフォルダ）と、調査の実測（tiny と mini で同じ並び）からの推定。中身を開いて確かめてはいない。違っていたら、取得のときに `tar failed for …` か `archive did not contain …` で止まり、揃った扱いにはならない。
3. **topK**: `compute(stream, topK)` に、ラベルの表の行数（527）を渡して全種類を受け取っている。sherpa の C++ 側で topK がラベル数を超えたときの扱いは確かめていない（等しい値なので問題ないと見ている）。結果に無い番号の確率は 0 として記録する。
4. **Ctrl+C**: Windows のターミナルでは、Ctrl+C が子プロセス（実験の子・ffmpeg）にも届く。中断のあとの子の終了は「落ちた」扱いにせず、終了コード 0 で記録を残して終わるようにした。本物のターミナルでは確かめていない（走らせるのはユーザー）。
5. **30 秒で次へ進んだとき**: 結果がまだ来ていない区間はあとから元の合図で記録する。ただ、その結果が来なければ、その合図には記録が 1 件も残らない（区間なしにもならない）。起きるのは、文字起こしが 30 秒以上かかるときだけ。
