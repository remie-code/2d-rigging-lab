# 口数配線+コーディ語彙登録 wave Domain B レビュー（design レーン）

> レビュアー: Review-Sylph（design レーン）。呼び出し元: Orch-Sylph（口数配線+コーディ語彙登録 wave 実行責任者）。読み取り専任（唯一の書き込みは本成果物）。
> 日付: 2026-07-14。対象: Domain B「コーディ語彙登録（Whisper initial prompt）」= `src/ears/whisper-inference.mjs`（変更）+ `src/ears/ear-pipeline.test.mjs`（変更・`ear-pipeline.mjs` 本体は無改変）+ `scripts/bench-name-prompt.mjs`（新規）+ docs 2 本（`discussion/ai-cohost/experiments/name-prompt.md` 新規・`waves/s6/s6-followup.md` §2 追記）。
> 観点: 設計の健全性・回帰リスク（「動くか」でなく「prompt 注入が正本を侵さない構造になっているか」「スイープスクリプトが安全に書けているか」「Gnome の§質問の設計判断は妥当か」）。Gnome 成果物 domain-b.md の主張を転記せず、全対象ファイルと写経元 bench-asr.mjs・fire-scheduler.mjs の該当箇所を自分で読み、テストを自分で再実行して確認した。
> 総合判定: **PASS**（blocking なし。non-blocking 5 件＝いずれも記録/申し送りで解消する軽微事項。domain-b.md §4 の生数字表に 1 件の軽微な誤記あり＝後述）。

---

## 0. 自分で再実行した機械ゲート・器不変確認（生結果）

```
cd apps/soul/agent && node --test
```
→ `# tests 724` `# pass 724` `# fail 0`（1 回で緑）。domain-b.md §4 の申告「724/724/0」と一致。

個別実行（明示ファイル指定・いずれも 1 回で緑）:
- `node --test src/ears/ear-pipeline.test.mjs` → **11/11**。
- `node --test src/ears/whisper-inference.test.mjs` → **8/8**。
- `node --test scripts/bench-name-prompt.test.mjs` → **12/12**。

```
cd apps/soul/agent && node scripts/check-dependencies.mjs        → Dependency guard passed. EXIT=0
node scripts/check-soul-zone-boundary.mjs                        → 1379 source files scanned; no 器→魂/魂→器 imports. EXIT=0
node scripts/check-source-organization.mjs                       → 唯一の既知違反（apps/runtime-player/.../physiology/index.ts）EXIT=1（器側ベースライン・本 Domain は .mjs のみ変更のため対象外・無退行）
```
3 チェックとも domain-b.md §4 の申告と一致。

```
git diff --stat -- apps/runtime-player packages pnpm-lock.yaml apps/soul/agent/package.json discussion/ai-cohost/contracts
```
→ 出力なし（器コード・契約 JSON・lockfile・package.json 完全不変を自分で確認）。

```
git diff -- apps/soul/agent/src/ears/ear-pipeline.mjs
```
→ 出力なし（`ear-pipeline.mjs` 本体が 1 バイトも変わっていないことを diff で直接確認・domain-b.md §1 の申告どおり）。

**生数字の照合で見つけた軽微な誤記（non-blocking・§8-1 参照）**: domain-b.md §4 の表は
`src/ears/ear-pipeline.test.mjs` を「実装前 11 → 実装後 12（+1）」と申告しているが、
`git show HEAD:apps/soul/agent/src/ears/ear-pipeline.test.mjs | grep -c '^test('` で実装前を数えると
**10 本**（`^test(` の出現数）であり、現在は 11 本。つまり正しくは「実装前 10 → 実装後 11（+1）」。
追加本数（+1）・全体の緑判定（724/724/0）はどちらも自分の再実行で正しいと確認できており、
表の絶対数だけが 1 本ずれている（合計 706→724 の内訳表記載ミス）。機械ゲートの合否には影響しない。

---

## 1. prompt 注入設計の健全性 — PASS

`src/ears/whisper-inference.mjs` を全文読み、以下を自分のソース読解で確認した:

- **`DEFAULT_WHISPER_PROMPT`（:49）はコード定数**（`export const`・v0「こーでぃー、コーディ。」）。
  wave-plan §2 裁定B「静的コード定数」/ inventory §B-2「ツマミにしない・コード内定数の流儀」に
  正確に適合。config 面（CLI フラグ・設定ファイル・環境変数）を一切作っていない。
- **意味論（:89）が素直**: `const prompt = typeof options.prompt === "string" ? options.prompt : DEFAULT_WHISPER_PROMPT;`
  — 省略（`undefined`/非文字列も含む）=既定注入・空文字 `""` を**明示的に**渡した場合のみ
  `if (prompt)`（:117）が偽になり無効化・任意の文字列を渡せば上書き、という3値の意味論が
  型チェック1本で簡潔に表現されている。`null` や数値等の異常値も暗黙に既定へフォールバックする
  堅牢な書き方。
- **form.append の位置（:117-121）**: `audio_ctx` 注入ブロック（:114-116 `if (audioCtx != null) { form.append(...) }`）
  の直後に `if (prompt) { form.append("prompt", prompt); }` を配置。既存の条件付き form 注入と
  完全に同型のガード構造で、読み手が「ここが可変フィールドの注入点」と認識しやすい。
- **正本不変をソースで直接確認**: `transcribe` の戻り値（:148-150）は
  `const json = await response.json(); const { text: rawText } = parseInferenceResponse(json); return { text: normalizeTranscript(rawText), rawText };`
  であり、`prompt` 変数は `form.append` にしか現れず、戻り値の構築経路（`parseInferenceResponse`→`normalizeTranscript`）
  には一切関与しない。転写バッファ/セグメンタ/VAD は `ear-pipeline.mjs` 側の別関数群であり、
  `transcribe` はサーバ応答の json のみを受け取る——prompt が正本を汚す経路は構造的に存在しない。
  `whisper-inference.test.mjs` の新規テスト「prompt 注入は転写正本を汚さない」（fake 応答に
  「コーディ」を含めず、`result.text`/`result.rawText` に「コーディ」が含まれないことを直接アサート）
  はこの構造事実を退行検知可能な形で固定しており、質が高い。

## 2. ear-pipeline 無改変で既定 prompt が乗る配線の妥当性 — PASS

- `ear-pipeline.mjs:387-392` を読んだ。`options.transcribeImpl == null` 分岐で
  `createWhisperInference({ baseUrl: server.baseUrl, timeoutMs: asrOptions.timeoutMs })` を呼んでおり、
  `options.prompt` キーは存在しない。§1 で確認した `whisper-inference.mjs` 側の意味論（省略=既定注入）
  により、**この呼び出し側を 1 行も変えずに既定 prompt が本番経路へ自動で乗る**。
- `git diff -- src/ears/ear-pipeline.mjs` の出力が空であることを自分で確認済み（§0）。domain-b.md の
  「ear-pipeline.mjs 自体は無改変」の主張は事実。
- config 面を作らない判断は inventory §B-2 と完全に整合。ear-pipeline.test.mjs の新規テスト
  （:154-223）は `pipeline.start()` を実際に呼び、`globalThis.fetch` を try/finally で一時差し替えて
  `transcribeImpl` 未指定分岐（本番の `createWhisperInference` 呼び出し）を実走させ、fetch に届いた
  multipart form の `prompt` フィールドが `DEFAULT_WHISPER_PROMPT` と一致することを直接検証している
  ——「既定 prompt が本番経路に自動で乗る」という設計主張を、間接推論でなく実測（fake fetch 経由）で
  固定した点は堅牢。

## 3. bench-name-prompt.mjs の設計 — PASS（non-blocking 2 件）

`scripts/bench-name-prompt.mjs` 全文と写経元 `scripts/bench-asr.mjs` 全文を突き合わせて読んだ。

- **部品再利用**: `createTtsClient`（voice/tts-client.mjs）・`encodeWav`（voice/wav-encode.mjs）・
  `sinePcm`/`silencePcm`/`concatInt16`（ears/fixtures-audio.mjs）・
  `parseInferenceResponse`/`normalizeTranscript`（ears/whisper-client.mjs）はすべて `import` による
  直接再利用（コピペでない）。`inference` 関数（:199-217）は bench-asr.mjs の同名ローカル関数
  （:78-93）を「audio_ctx 注入の隣に `form.append("prompt", opts.prompt)` を 1 行追加」した形で
  写経しており、diff の説明（B-3）どおり。
- **スコアリング純関数**（`containsNameVariant`/`scoreNameHitRate`/`summarizeSweep`）は fetch/TTS に
  一切依存しない（import 文・関数本体を確認済み）。fixture テスト（bench-name-prompt.test.mjs:23-55）
  で fetch/TTS を起動せず検証できることを自分でテスト実行して確認した（§0）。
- **`runSweep`（:237-273）の注入設計**: `synthesizeImpl`/`inferenceImpl` を引数で受け取り既定に
  フォールバックする形。node:test 側（test:129-157）は fake 実装を注入して「prompt 有無で正答率/
  幻聴混入率の対比が組める」構造を実ネット・実 TTS なしで検証しており、注入可能設計が実際に
  機能していることをテスト実行で確認済み。
- **ディスク非書き込みの規律**: `bench-name-prompt.mjs` の import 一覧に `node:fs`/`fs/promises` 等の
  書き込み系 API は一切登場しない（`pathToFileURL` は `node:url`）。音声データは `Uint8Array`/`Blob`
  としてメモリ上でのみ受け渡され（`encodeWav`→`Uint8Array`、`inference` の `form.append("file", new Blob(...))`
  はメモリ上の Blob）、ファイルへの書き出し経路が構造上存在しない。
- **direct-execution ガード（:317-335）**: `pathToFileURL(process.argv[1]).href === import.meta.url`
  で `isMainModule` を判定し、真の場合のみ `main()`（実 whisper-server 起動 + 実 TTS 呼び出しを含む）
  を実行する。`bench-name-prompt.test.mjs` が `import { ... } from "./bench-name-prompt.mjs"` する際に
  `main()` が呼ばれていないことをテスト実行結果（12/12 緑・実ネット未使用のまま完走）で間接的に確認
  した——テストファイル自体に `main()` の呼び出しは無く、import だけで完走している事実がガードの
  実効性を裏付ける。Windows パス（バックスラッシュ・ドライブレター）を `pathToFileURL` で吸収する
  実装も適切（本リポジトリは Windows 環境）。

non-blocking（2 件）:
1. **`inference` 関数の重複**: `bench-name-prompt.mjs:199-217` と `bench-asr.mjs:79-93` はほぼ同一の
   ローカル実装（差分は `prompt` フィールド 1 行 + `fetchImpl` 注入口の有無）。両ファイルとも
   コメントで「ベンチ専用のローカル実装」と明示しており独立性優先の意図的判断だが、将来
   `/inference` 呼び出し規約が変わった場合に 2 箇所を同期する必要がある。共有ヘルパー化
   （例: `scripts/bench-lib.mjs`）の余地はあるが、本 wave のスコープでは実害なし。
2. **実走コストの見積りが docs に無い**: `PARAM_VARIATIONS_V0`（7 パターン）×
   `NAMED_SENTENCES_V0`+`UNNAMED_SENTENCES_V0`（計 6 文）で TTS 合成 42 回、prompt 有無 2 系統で
   `inference` 呼び出し 84 回（`--runs` 既定 1 の場合）が発生する。`experiments/name-prompt.md` §1
   にはコマンドと前提起動のみで所要時間の目安が書かれておらず、人間ゲート実行者が初回に
   想定より長くかかることに驚く可能性がある。記録のみ（blocking にするほどではない）。

## 4. Gnome §質問の設計妥当性評価

1. **`NAME_MATCH_VARIANTS_V0` を fire-scheduler.mjs から独立させた判断 — 妥当（non-blocking 記録）**:
   `fire-scheduler.mjs:157` の `NAME_VARIANTS_V0`（4 表記）は `normalizeForMatch`（:175 NFKC+かな→カナ+
   濁点剥がし）とセットで使う設計であり、これを再利用しようとすると `normalizeForMatch` も import
   することになり Domain A（口数）の fire-scheduler.mjs へ Domain B が依存する形になる。
   独立性優先の判断は wave がドメイン分割で進める方針（wave-plan §3）と整合し、whisper 出力の
   実用粒度としては単純部分一致で足りるという判断も一次情報（両ファイルとも実装済みで検証可能）
   から見て不合理ではない。トレードオフ（4 表記の値そのものが重複＝二重管理）は Gnome 自身が
   §質問で正直に申告しており、隠蔽していない。記録のみ・見直しは任意（Orch 判断）。
2. **direct execution ガード新設 — 妥当**: 既存スクリプト（bench-asr.mjs 等）へ遡及適用しないという
   スコープ限定は「本 Domain のスコープ外・既存スクリプトのテスト非対象という前提を変えない」
   と明記されており、変更範囲の最小化として健全。新規スクリプトのみに導入する判断もテスタビリティ
   要求（wave-plan §3 Domain B）に対する直接対応であり妥当。
3. **audio_query の `speedScale`/`pitchScale`/`intonationScale` フィールド名が実機未検証 — non-blocking**:
   本スクリプトは書くだけで実走していないため、フィールド名の誤りは現時点で実害を及ぼしていない
   （§質問で Gnome 自身も認識・修正手順も明記済み）。blocking にする理由がない——実走して判明する
   類の情報であり、機械ゲート（構文健全性・注入可能設計）はこのフィールド名に依存しない。
   人間ゲート実行時に最初に確認すべき項目として、Orch から実行者への申し送りに含めるのが妥当
   （§8-2 参照）。
4. **スイープ計測の実走状況**: `git status`/`grep` で `experiments/name-prompt.md` §4 が空欄のまま
   であることを自分で確認した（Read 済み）。設計レーンとして見るべき点はここでは「実走していない
   ことが正直に記録されているか」のみであり、これは満たされている。

## 5. 回帰リスク評価 — PASS

- **whisper-client.mjs（preflight 専用）**: 本 Domain の diff は `whisper-inference.mjs`/
  `ear-pipeline.test.mjs`/新規 scripts のみで、`whisper-client.mjs` への変更は無い（`git diff --stat`
  でファイル一覧を確認済み・§0）。
- **ear-pipeline.mjs 転写経路本体**: 無改変を diff で直接確認済み（§0・§2）。
- **セグメンタ/VAD**: `whisper-inference.mjs` の変更は `transcribe` 関数内の form 構築にのみ閉じており、
  セグメンタ/VAD は `ear-pipeline.mjs` 側の別関数（本 Domain 無改変）にある。prompt が
  セグメンタ/VAD のコードパスに触れる経路は存在しない。
- **器境界**: `check-soul-zone-boundary.mjs` を自分で再実行し「1379 source files scanned; no 器→魂/
  魂→器 imports」を確認済み（§0）。新規 2 ファイル（bench-name-prompt.mjs/.test.mjs）分の増加
  （1377→1379）も domain-b.md の申告と一致。
- **既存テストへの非破壊**: `whisper-inference.test.mjs` の新規テスト「audio_ctx 省略時の既存挙動は
  prompt 追加後も無退行」（既存アサート `calls[0].init.body.get("audio_ctx"), null` を維持しつつ
  `prompt` の常時注入を追加でアサート）が既存挙動保存を直接固定しており良い設計。

---

## 6. docs 2 本の確認

- `discussion/ai-cohost/experiments/name-prompt.md`（新規）: 全文読了。§4「実測記録」が空欄のまま
  であることを確認（「実測していない数字を書かない規律」の遵守）。§1 の走らせ方・§2 の指標・§3 の
  判定基準（wave-plan §1 人間ゲート B）は wave-plan/inventory の記述と整合。
- `discussion/ai-cohost/implementation/waves/s6/s6-followup.md` §2: `git diff` で確認した差分は
  末尾への追記のみ（`+` 行のみ・既存本文への変更なし）。実施記録の内容（実配線済み・スイープ実走
  未実施・記録先明記）は domain-b.md/name-prompt.md の内容と整合。

---

## 7. blocking / non-blocking の総括

**blocking: なし。**

**non-blocking（5 件・記録/申し送りで解消）**:
1. domain-b.md §4 の生数字表: `ear-pipeline.test.mjs` の「実装前 11」は実際には「実装前 10」
   （`git show HEAD:...` で `^test(` を数えて確認）。追加本数（+1）・全体緑判定（724/724/0）は
   正しい。表の訂正を推奨（軽微・機械ゲートの合否に影響しない）。
2. `bench-name-prompt.mjs` の `inference` 関数が `bench-asr.mjs` の同名関数とほぼ重複（prompt
   フィールド追加分のみの差分）。意図的な独立設計だが将来の同期コストとして記録。
3. `NAME_MATCH_VARIANTS_V0` と `fire-scheduler.mjs` の `NAME_VARIANTS_V0` の値の二重管理（4 表記が
   重複）。Gnome §質問1で認識済みのトレードオフ・見直しは任意。
4. `PARAM_VARIATIONS_V0` × 素材文 × runs による実走コスト（TTS 42 回・inference 84 回相当）の目安が
   `experiments/name-prompt.md` に無い。実行者への申し送りとして所要時間の目安を添えるとよい。
5. `audio_query` のフィールド名（speedScale 等）実機未検証（Gnome §質問3）。実走前に最初に確認す
   べき項目として人間ゲート実行者への申し送りに含めること。

## 8. Orch への申し送り

1. **人間ゲート実行者への申し送り事項**（上記 non-blocking 4・5 を反映): (a) `scripts/bench-name-prompt.mjs`
   実走前に AivisSpeech の `audio_query` レスポンスに `speedScale`/`pitchScale`/`intonationScale`
   フィールドが実在するか最初に確認し、無ければ `synthesizeVariants`（:161 隣の 3 行）を実機に
   合わせて直すこと。(b) 実走は TTS 合成 42 回 + inference 84 回相当（`--runs` 既定 1）のため、
   初回は所要時間にある程度の余裕を見ること。
2. domain-b.md §4 の生数字表（ear-pipeline.test.mjs 実装前後の絶対数）に軽微な誤記があるため、
   記録として訂正推奨（§7-1）。
3. Gnome §質問1（NAME_MATCH_VARIANTS_V0 独立）・§質問2（direct-execution ガード新設）は design
   観点で妥当と判定。見直しの要否は Orch 判断に委ねる。

## 9. §質問（Orch への確認事項）

1. domain-b.md §4 の生数字表の訂正（ear-pipeline.test.mjs 実装前 11→正しくは 10）は、Orch 側で
   domain-b.md を直接修正するか、本レビュー内の記録のみに留めるか——判定に迷ったため確認したい
   （blocking ではないので後者でも支障はないと考えるが、正本の正確性を優先するなら前者が望ましい）。
2. `NAME_MATCH_VARIANTS_V0` と `fire-scheduler.mjs` 側の二重管理を将来 followup で解消するか、
   このまま独立設計を正とするかは Orch/ユーザー判断に委ねたい（design レーンとしてはどちらでも
   blocking にはならないと判断した）。

---

**総合判定: PASS。** blocking なし。prompt 注入設計の意味論・正本不変・ear-pipeline 無改変配線・
bench-name-prompt.mjs のテスタビリティ/規律遵守・Gnome §質問への設計判断のいずれも健全。
non-blocking 5 件（うち 1 件は domain-b.md の生数字表の軽微な誤記）と申し送り事項を Orch へ引き継ぐ。
