# 口数配線+コーディ語彙登録 wave Domain B レビュー（test レーン）

> レーン: **test**（追加テストが要求を実際に固定しているか・トートロジーでないか・全緑の独立確認・
> テストの規律＝fake専任/実ネット不使用/try-finally復元/タイムアウト）。
> レビュアー: Review-Sylph。呼び出し元: Orch-Sylph（口数配線+コーディ語彙登録 wave 実行責任者）。
> 再委任の背景: 前回の test レーンが成果物未生成で異常終了したための再委任。
> 対象: `apps/soul/agent/src/ears/whisper-inference.test.mjs`（8 本＝既存 3+新規 5）・
> `src/ears/ear-pipeline.test.mjs`（11 本＝既存 10+新規 1）・`scripts/bench-name-prompt.test.mjs`（新規 12 本）。
> 実装本体: `src/ears/whisper-inference.mjs`（変更）・`src/ears/ear-pipeline.mjs`（無改変・確認済み）・
> `scripts/bench-name-prompt.mjs`（新規・書くだけ・実走せず）。
> 契約の正: [../../orchestration/verbosity-vocab-wave-plan.md](../../orchestration/verbosity-vocab-wave-plan.md)
> §3 Domain B・§4（blocking 基準・特に §4-3） /
> [../../orchestration/verbosity-vocab-inventory.md](../../orchestration/verbosity-vocab-inventory.md) §B-2 /
> Claim: [../../waves/verbosity-vocab/domain-b.md](../../waves/verbosity-vocab/domain-b.md) §4。
> 日付: 2026-07-14。読み取り専任・自分で再実行した生数字を根拠にする。コード変更・
> `git commit`/`push`・`pnpm`/`npm install`・`scripts/bench-name-prompt.mjs` の実走は一切していない。
> `.tmp/facex-*`・`packages/authoring-core` は不干渉（`git status` で確認・本レビューは無関係な
> 未追跡ファイルのみでそれらに触れていない）。
> **総合判定: PASS（blocking ゼロ・non-blocking 4 件＝すべて修正不要の観察または既知の表記誤り）。**

## 0. 自分で再実行した機械ゲート生数字

`cd apps/soul/agent && node --test`（全テスト・タイムアウト 300s・1 回で緑・空/interrupted なし・再試行不要）:

```
1..724
# tests 724
# pass 724
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 1595.8006
```

domain-b.md §4 の Claim「724/724/0」と**一致**。

個別 3 ファイル一括実行（`node --test src/ears/whisper-inference.test.mjs src/ears/ear-pipeline.test.mjs
scripts/bench-name-prompt.test.mjs`・1 回で緑）:

```
1..31
# tests 31
# pass 31
# fail 0
# duration_ms 451.4877
```

本数の機械照合（`^test(` の行数を自分で `grep` で数えた・実装後＝現版）:

| ファイル | 現版本数（grep 実測） | node --test 個別実行 |
|---|---|---|
| `src/ears/whisper-inference.test.mjs` | **8** | 緑（同ファイル内訳: 8/8） |
| `src/ears/ear-pipeline.test.mjs` | **11** | 緑（同ファイル内訳: 11/11） |
| `scripts/bench-name-prompt.test.mjs` | **12** | 緑（同ファイル内訳: 12/12） |
| 合計 | **31** | 一致（`1..31`） |

## 1. ear-pipeline.test.mjs「実装前」列の誤記 — 独立確認（委任プロンプト指摘の裏取り）

`git show HEAD:apps/soul/agent/src/ears/ear-pipeline.test.mjs` を取得し `^test(` を自分で `grep -c` した:

```
git show HEAD:.../ear-pipeline.test.mjs | grep -c '^test(' → 10
```

現版（上表）は **11**。よって実装前=10・実装後=11・追加=+1 が実測。

domain-b.md §4 の表は「実装前 11・実装後 12・追加 +1」と記載しており、**実装前セルと実装後セルの両方が
実測より 1 大きい誤記**（追加数 +1 自体・全体合計 706→724/+18 は正しい）。委任プロンプトが述べた
「先行の spec/design レーンが検出済み」の指摘と**私の独立測定も完全に一致**する（先行 2 レーンの
レビューファイル `domain-b-review-spec.md:23-25,48,57,62` にも同じ実測 10/11/+1 が記録されている）。

参考までに `whisper-inference.test.mjs` の HEAD も確認: `git show HEAD:...whisper-inference.test.mjs |
grep -c '^test(' → 3`（現版 8・追加 +5）。こちらは domain-b.md §4 の表記と一致（誤記なし）。
`bench-name-prompt.test.mjs` は HEAD に存在しない（新規ファイル・`git show HEAD:...` は
`fatal: path ... exists on disk, but not in 'HEAD'` で確認）ので実装前=0・実装後=12・追加=+12 は
自明に正しい。

**判定: non-blocking**（表内セルの数値誤記のみ。差分内容・追加数合計・全体 724 の正しさには影響しない）。

## 2. 追加テストの網羅照合（トートロジー判定込み）

### 2-1. whisper-inference.test.mjs 新規 5 本（:99-174）

| テスト | 検証内容 | 判定 |
|---|---|---|
| `options.prompt 省略時は DEFAULT_WHISPER_PROMPT が常時注入される`（:99） | fake fetch の呼び出し記録から `calls[0].init.body.get("prompt")` を直接読み `DEFAULT_WHISPER_PROMPT` と一致確認。**form の実送信内容を検証**しており実装をなぞるだけのトートロジーではない。 | PASS |
| `options.prompt にカスタム文字列を渡すとそれが form に乗る`（:113） | カスタム文字列で上書きし同様に form を検証。 | PASS |
| `options.prompt に空文字を明示指定すると prompt field は不送出`（:127） | 空文字で `if (prompt)` が偽になり `form.get("prompt")===null` を確認（無効化の逃げ道が機能することの直接証拠）。 | PASS |
| `prompt 注入は転写正本を汚さない（返り値はサーバ応答のテキストのみ由来）`（:141） | **blocking §4-3 の核心**。fake 応答テキストに意図的に「コーディ」を含めない文字列を用意し、`result.rawText`/`result.text` が fake 応答と厳密一致（`assert.equal`）することに加え `!result.text.includes("コーディ")`/`!result.rawText.includes("コーディ")` を明示 assert。実装（`whisper-inference.mjs:148-150`）は `json.text` のみから `{text, rawText}` を組み立てており、prompt を混入させる経路が構造上存在しないため、fake 応答からの厳密一致 assert がそのまま「正本はサーバ応答のみ由来」の直接証拠になっている。将来 prompt を結果へ混入させる回帰が入れば確実に落ちる設計＝**トートロジーではなく退行防止として実効的**。 | PASS |
| `audio_ctx 省略時の既存挙動は prompt 追加後も無退行（prompt に非干渉）`（:161） | 既存アサート（`audio_ctx===null`）を維持しつつ `prompt` も同時検証＝audio_ctx と prompt の非干渉を直接固定。 | PASS |

### 2-2. ear-pipeline.test.mjs 新規 1 本（:154-223）

`transcribeImpl 未指定時は本番経路の whisper-inference が既定 prompt を常時注入する` —
`options.transcribeImpl` を渡さず `pipeline.start()` を実行し、`ear-pipeline.mjs:387-392` の
`options.transcribeImpl == null` 分岐（本番の `createWhisperInference({ baseUrl, timeoutMs })` 呼び出し・
`options.prompt` 省略）を実際に通す。`globalThis.fetch` を一時差し替え（:159 で保存・:220 で
`finally` 内復元＝`try/finally` で必ず戻る設計を実物で確認）、fake capture/VAD/whisper-server 経由で
合成 PCM を流し、fetch に届いた multipart form の `form.get("prompt")` が `DEFAULT_WHISPER_PROMPT` と
一致することを確認。実 whisper-server/実マイク/実ネット不使用。委任プロンプトが要求する「実際に
`pipeline.start()` を通し fetch に届いた form の prompt を検証」を満たしている。**PASS**。

`ear-pipeline.mjs` 自体は無改変であることを自分でも確認（`git diff -- apps/soul/agent/src/ears/ear-pipeline.mjs`
→ 出力なし）。

### 2-3. bench-name-prompt.test.mjs 新規 12 本（全読・実装 `bench-name-prompt.mjs` と突き合わせ）

| テスト | 検証内容 | 判定 |
|---|---|---|
| `containsNameVariant`: 部分文字列一致（既定 variants） | 揺れ集合 5 表記の HIT・非該当（見送り表記「コーピー」）・非文字列 false（throw しない）を fixture 固定。 | PASS |
| `containsNameVariant`: variants 明示指定 | 既定と別集合を渡した際の照合先切替を確認。 | PASS |
| `scoreNameHitRate`: 集計 | 空配列 rate=0・部分ヒット・全ヒット・非配列 throw を fixture 固定。 | PASS |
| `summarizeSweep`: prompt 有無対比の形 | named/unnamed × withPrompt/withoutPrompt の 4 象限を fixture 値で固定・null throw。 | PASS |
| `inference`: prompt/audio_ctx 注入（fake fetch） | form の実送信内容を検証（`form.get("prompt")`/`form.get("audio_ctx")`）。 | PASS |
| `inference`: 省略時不送出（fake fetch） | 上と対の後方互換確認。 | PASS |
| `inference`: 非 200 throw | エラーメッセージに本文込みで throw することを確認。 | PASS |
| `synthesizeVariants`: `synthetic=true` | 実 TTS 不使用で 1 本の WAV（正弦波フォールバック）を返すことを確認＝**実 TTS 不使用の直接証拠**。 | PASS |
| `synthesizeVariants`: fake `ttsClientFactory` | `PARAM_VARIATIONS_V0.length`（7）分だけ `audioQuery`/`synthesis` が呼ばれ、各 `query` に `speedScale`/`pitchScale`/`intonationScale` が正しく設定されることを確認。 | PASS |
| `runSweep`: fake synthesize/inference 注入で prompt 有無対比が組める構造 | **最重要**。fake `inference` が「名前入り文＝prompt 有のときのみ名前を拾う」「名前なし文＝prompt 有のときに幻聴混入する」という模擬応答を返すよう設計され、`runSweep` の内部実装（`runGroup` 内で `inferenceImpl(url, wav, {prompt: DEFAULT_WHISPER_PROMPT})` と `inferenceImpl(url, wav, {prompt: ""})` を両方呼ぶ・`bench-name-prompt.mjs:259-260`）が正しくその 2 系統を呼び分けていることを、`summarizeSweep` の 4 象限の rate 値（1/0/1/0）で間接検証している。**トートロジーではない**（実装が prompt 有無を取り違えれば必ず rate が入れ替わって落ちる）。実ネット/実 TTS 不使用。 | PASS |
| `runSweep`: baseUrl 欠落 throw | 引数契約の防御を確認。 | PASS |
| 既定素材の非空確認 | `NAMED_SENTENCES_V0`/`UNNAMED_SENTENCES_V0`/`NAME_MATCH_VARIANTS_V0`/`PARAM_VARIATIONS_V0` が空でないことの前提確認（軽量だが妥当）。 | PASS |

**bench-name-prompt.mjs を実走せずにテストが回っている**ことを自分で確認: `node --check
scripts/bench-name-prompt.mjs` で構文健全性のみ確認（`SYNTAX_OK`・プロセス起動なし＝実走に該当しない
静的チェック）。上記 12 本のテストはいずれも `synthesizeImpl`/`inferenceImpl`/`ttsClientFactory` を
注入したうえで呼んでおり、`main()`（実 whisper-server 起動・実 TTS 呼び出し）を経由しない。
`main()` は `pathToFileURL` ベースの direct execution ガード（`bench-name-prompt.mjs:321-327`）で
import 時に走らない設計になっており、node --test 全体が 1.6 秒で完走している事実（実ネット待ちの
兆候なし）が間接的にもこれを裏付ける。

## 3. テストの規律（fake 専任・実ネット不使用・復元・タイムアウト）

- **fake 専任**: 3 ファイルとも `globalThis.fetch`/`fetchImpl` を fake に固定するか、fake
  capture/VAD/serverFactory/ttsClientFactory を注入。実 SDK・実マイク・実 whisper-server・実 TTS・
  実ネットワークへの到達は grep・目視双方で確認できず（`node --test` 全体 1595.8ms で完走＝
  実ネット待ちの兆候なし）。
- **`globalThis.fetch` の復元**: `ear-pipeline.test.mjs`（:159 保存 → :220 `finally` 内で
  `globalThis.fetch = originalFetch` に復元、同じ `finally` 内で `pipeline.dispose()` も実行）を
  実物で確認。他の 2 ファイルは `fetchImpl` 注入のみで `globalThis.fetch` 自体を書き換えていない
  （書き換え不要な設計）。
- **タイムアウト**: `ear-pipeline.test.mjs` の `until()` ヘルパーは既定 3000ms で必ず throw する
  有界待ち（新規テストもこの既存ヘルパーを再利用）。`whisper-inference.test.mjs`/
  `bench-name-prompt.test.mjs` は同期的 fake 実装のみで無期限待ちが発生する経路がない。
- **終了処理**: `ear-pipeline.test.mjs` 新規テストは `try/finally` で確実に `pipeline.dispose()` と
  fetch 復元を行う。他 2 ファイルは長命リソース（サーバ・タイマ）を生成しないため終了処理は不要。

## 4. blocking / non-blocking の分離

**blocking: 0 件**

wave-plan §4-3（「prompt 注入が転写バッファ/セグメンタ/VAD を通らない＝正本不変であることをテストで
固定・prompt 無指定の後方互換・スイープスクリプトは実ネット/実マイク不出」）はすべて §2-1・§2-3 で
実行を伴って固定されていることを確認した。§4-1（器コード・契約 JSON・lockfile・package.json 不変・
新規依存ゼロ）・§4-4（3 チェック無退行）は本 test レーンの読み取り対象（3 つの test.mjs）の外にあり、
本レビューでは独立再実行していない——domain-b.md §4 の `git diff --stat` 結果（器・契約・lockfile・
package.json 出力なし）と先行 spec/design レーンの確認に依拠する（§5 の質問参照）。

**non-blocking（すべて修正不要の観察または既知の表記誤り）:**

1. **domain-b.md §4 表の `ear-pipeline.test.mjs`「実装前」セルの誤記**（記載 11・実測 10。「実装後」
   セルも連動して 12→実測 11 の誤記。追加数 +1・全体 706→724/+18 は正しい）。§1 で独立確認済み。
   先行 spec/design レーンも同一の誤記を検出済み（`domain-b-review-spec.md` 参照）で三者一致。
2. **ear-pipeline.test.mjs 新規テストは `prompt` フィールドのみ検証し `audio_ctx` フィールドとの
   共存は未検証**（本番経路テストは prompt 単体の form.get のみ assert）。既存の縦貫通テスト
   （`makeHarness` 経由・:120-152）では `audioCtx` を fake `transcribeImpl` 経由で検証しているが
   そちらは prompt を通らない経路のため、「本番経路で audio_ctx と prompt が同時に正しく乗る」
   ことを直接固定するテストは無い。実装（`whisper-inference.mjs:114-121`）は両フィールドの注入が
   独立した if ブロックで相互に干渉しないため実害は考えにくいが、網羅性としては軽微な抜け。
3. **bench-name-prompt.test.mjs の `summarizeSweep` 不正値テストは `null` のみ**（`named`/`unnamed`
   プロパティ欠落時の挙動は未テスト）。実装は `transcriptSets.named.withPrompt` に直接アクセスする
   ため欠落時は `TypeError`（プロパティアクセス例外）になるはずだが、明示テストがない。軽微。
4. **direct execution ガード自体を検証する専用テストが無い**（import だけでは `main()` が走らない
   ことを、node --test 全体の高速完走という間接証拠のみで確認しており、ガードのロジック自体
   （`pathToFileURL` 比較）を単体で exercise するテストはない）。Windows パス処理の脆さ（バック
   スラッシュ/ドライブレター）を明示的に固定する価値はあるが、本 wave のスコープ外の追加提案。

## 5. §質問（Orch への申し送り）

1. **blocking §4-1/§4-4 の独立確認は本レーンでは実施していない**: 本委任プロンプトの読み取り対象は
   3 つの test.mjs ファイルに限定されており、器コード・契約 JSON・lockfile・package.json の不変性
   （`git diff --stat`）・3 チェックの再実行は domain-b.md §4 と先行 spec/design レーンの確認結果に
   依拠した。Orch 側で spec/design レーンの当該確認が本 test レーンの結論と矛盾しないことを最終
   突き合わせいただきたい（私が把握する限り両レーンとも `git diff --stat` 出力ゼロ・3 チェック
   既知の器側ベースライン違反 1 件のみで一致している）。
2. non-blocking 2（audio_ctx と prompt の本番経路同時検証の抜け）は、blocking 基準に含まれないため
   修正必須ではないが、テストとして 1 本足すコストは低い（fake fetch の record に `audio_ctx` フィールド
   の存在確認を追加するだけ）。次回この経路を触る Domain があれば申し送り事項として引き継ぐ価値がある。
3. non-blocking 1（表記誤り）は domain-b.md 本体の訂正が望ましいが、これは spec/design レーンと
   同一の指摘であり test レーンとして重ねて blocking 化する理由はない（3 レーン一致の観察として
   Orch の最終判定に添えていただきたい）。
