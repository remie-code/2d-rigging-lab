# 口数配線+コーディ語彙登録 wave Domain B レビュー — spec レーン（設計契約への適合）

> Reviewer: Review-Sylph（spec レーン）。呼び出し元: Orch-Sylph（口数配線+コーディ語彙登録 wave 実行責任者）。
> **読み取り専任**（コード変更なし）。日付: 2026-07-14。根拠: 契約文書・対象ファイルの実物・working tree の
> `git diff`／`git status`・自分で実行した `node --test`（タイムアウト300s）・3チェック（すべて自分で実行、
> Gnome の説明のみに依存しない）。
> 契約の正: [../../orchestration/verbosity-vocab-wave-plan.md](../../orchestration/verbosity-vocab-wave-plan.md)
> §2（裁定B）・§3 Domain B・§4（blocking 基準・特に §4-3） /
> [../../orchestration/verbosity-vocab-inventory.md](../../orchestration/verbosity-vocab-inventory.md)
> §B-1（確定事実）・§B-2（裁定と検証） /
> [../../waves/verbosity-vocab/domain-b.md](../../waves/verbosity-vocab/domain-b.md)（Gnome の Claim）。
> 対象コミット状態: Domain B は未コミット・working tree に存在。同じ working tree に Domain A（口数モード
> 実配線）の変更も共存するが、本レビューは Domain B 該当ファイルのみを対象とする
> （`src/ears/whisper-inference.mjs`＋test・`src/ears/ear-pipeline.test.mjs`・`scripts/bench-name-prompt.mjs`＋test・
> `discussion/ai-cohost/experiments/name-prompt.md`・`s6-followup.md` 追記分）。

## 総合判定: **PASS-with-nonblocking**

wave-plan §2 裁定B・§3 Domain B の要求はすべて実装に反映されている。§4 の blocking 基準（器/契約/lockfile/
package.json 不変・新規依存ゼロ、正本不変のテスト固定、後方互換、3 チェック無退行）はすべて満たす。
Gnome の Claim（domain-b.md）の主要数字 —— 全体 724/724/0、器/契約/lockfile/package.json 完全不変、
3 チェックの結果 —— は自分の再実行と一致した。**non-blocking 指摘は 1 件のみ**: domain-b.md §4 の
「追加内訳」表で `ear-pipeline.test.mjs` の「実装前」列が `11` と記載されているが、自分で `git show HEAD` と
突き合わせた実測では `10`（実装後 `11`・追加 `+1` 自体は正しい）。合計 `706 → 724`／`+18` は
`724 - 18 = 706` の逆算で整合しており、blocking 判定には影響しない単なる表内セルの誤記。

スイープ計測スクリプト（`scripts/bench-name-prompt.mjs`）は契約どおり**書くだけで実走していない**ことを、
`discussion/ai-cohost/experiments/name-prompt.md` §4 の実測欄が空欄のままであることで直接確認した。

---

## 自分で走らせた生数字（すべて Review-Sylph が実行・タイムアウト付き・1 回で成功）

### `cd apps/soul/agent && node --test`（全テスト・タイムアウト 300s）

```
# tests 724
# pass  724
# fail  0
```

→ **Claim（domain-b.md §4）の 724/724/0 と一致**。

### 個別実行（自分で実行）

```
node --test src/ears/whisper-inference.test.mjs   → # tests 8  / pass 8  / fail 0
node --test src/ears/ear-pipeline.test.mjs        → # tests 11 / pass 11 / fail 0
node --test scripts/bench-name-prompt.test.mjs    → # tests 12 / pass 12 / fail 0
```

`test(` 実数の HEAD 比較（`git show HEAD:<path> | grep -c '^test('`、自分で実行）:

| ファイル | HEAD（実装前・自分の実測） | 現在（実装後） | 追加 | Claim の「実装前」列 |
|---|---|---|---|---|
| `src/ears/whisper-inference.test.mjs` | 3 | 8 | +5 | 3（一致） |
| `src/ears/ear-pipeline.test.mjs` | **10** | 11 | +1 | **11（不一致・誤記）** |
| `scripts/bench-name-prompt.test.mjs`（新規・HEAD に存在せず） | 0 | 12 | +12 | 0（一致） |
| 合計 | — | — | **+18** | Claim と一致 |

→ 追加数 `+5/+1/+12=+18` は Claim と一致。合計 `706/724` も `724-18=706` の逆算で整合。**ただし
`ear-pipeline.test.mjs` の「実装前」個別セルのみ `11` ではなく `10` が正しい**（non-blocking・数値表記の
瑕疵のみで結論に影響なし）。

### 器/契約/lockfile/package.json 不変（自分で実行）

```
git diff --stat -- apps/runtime-player packages pnpm-lock.yaml apps/soul/agent/package.json discussion/ai-cohost/contracts
→ 出力なし
git diff -- apps/soul/agent/src/ears/ear-pipeline.mjs
→ 出力なし（ear-pipeline.mjs 本体 1 バイトも無改変を確認）
```

`bench-name-prompt.mjs` の import は `node:url` と既存モジュール（`whisper-server.mjs`/`tts-client.mjs`/
`wav-encode.mjs`/`fixtures-audio.mjs`/`whisper-client.mjs`/`whisper-inference.mjs`）のみで新規 npm 依存なし
（package.json diff ゼロと整合）。

### 3 チェック（リポジトリルートで自分で実行）

```
node scripts/check-dependencies.mjs
→ Dependency guard passed. EXIT=0

node scripts/check-soul-zone-boundary.mjs
→ Soul zone boundary guard passed: 1379 source files scanned; no 器→魂 imports and no 魂→器 code imports. EXIT=0

node scripts/check-source-organization.mjs
→ Source organization violations found:
  - apps/runtime-player/src/main/physiology/index.ts: index.ts must remain a barrel-only entrypoint
EXIT=1
```

→ **Claim と完全一致**。唯一の違反ファイル `apps/runtime-player/src/main/physiology/index.ts` は
`git diff --stat -- apps/runtime-player` が出力ゼロ（＝完全不変）であることから、Domain B が触れていない
器側の既存ベースライン違反であると自分で確認した（無退行）。

### スイープ実走規律（自分で確認）

```
discussion/ai-cohost/experiments/name-prompt.md §4 実測記録
→ 「(人間ゲート後にここへ実測値・生ログ抜粋・判定結果…を追記する。…実測していない数字を書かない規律。)」
  のみ・数値記載なし（空欄を直接確認）
```

`scripts/bench-name-prompt.mjs` に `node:fs` 等のファイル書き込み API import なし（grep 確認・0 件）。
末尾の direct execution ガード（`import.meta.url === pathToFileURL(process.argv[1]).href`）により、
`node:test` からの import では `main()`（実 whisper-server 起動・実 AivisSpeech 呼び出し）が走らないことを
ソースで確認（実際に `bench-name-prompt.test.mjs` が該当関数を import して緑になっていることでも間接確認）。

---

## spec 検証項目（逐条照合・PASS/FAIL + 根拠 file:line）

### 1. wave-plan §2 裁定B / §3 Domain B の要求が実装に反映されているか

| 項目 | 判定 | 根拠 |
|---|---|---|
| (a) `form.append("prompt", prompt)` が audio_ctx 注入の隣・リクエスト毎 | **PASS** | `whisper-inference.mjs:114-116`（audio_ctx 注入）の直後 `:117-121` に `if (prompt) { form.append("prompt", prompt); }`。`transcribe` 呼び出し毎に評価される非分岐コード（常時注入）。 |
| (b) PROMPT が静的コード定数・ツマミ化していない | **PASS** | `whisper-inference.mjs:49` `export const DEFAULT_WHISPER_PROMPT = "こーでぃー、コーディ。";`。settings/CLI/UI からの変更経路は存在しない。`options.prompt` の受け口は契約 §3「`prompt`受け口(既定=定数)」が明示的に許可する設計であり、テスト用の依存性注入であって運用ツマミではない。 |
| (c) ear-pipeline 経由で既定 prompt が本番経路に自動で乗る（ear-pipeline.mjs 無改変） | **PASS** | `git diff -- .../ear-pipeline.mjs` 出力ゼロ（自分で実行）。`ear-pipeline.mjs:388-391` の `createWhisperInference({ baseUrl, timeoutMs })` は `options.prompt` を渡していない＝`DEFAULT_WHISPER_PROMPT` が自動採用。`ear-pipeline.test.mjs` の新規テスト（:154-223）が `pipeline.start()` を実際に通し、fetch に届いた form の `prompt` フィールドが `DEFAULT_WHISPER_PROMPT` と一致することを実行して確認（自分で `node --test` 実行・緑）。 |
| (d) スイープスクリプトが bench-asr 部品再利用で①名前正答率②幻聴混入率を prompt 有無で集計する構造 | **PASS** | `bench-name-prompt.mjs`: `synthesizeVariants`（:161-186、`bench-asr.mjs:55-76 acquireWav` 写経）・`inference`（:199-217、`bench-asr.mjs:78-93` 写経＋`prompt`1行）・`runSweep`（:237-273）が `NAMED_SENTENCES_V0`/`UNNAMED_SENTENCES_V0` それぞれに prompt 有無で `inference` を呼び、`summarizeSweep`（:123-138）が `nameAccuracy`/`hallucination` の 2 軸で集計。`bench-asr.mjs` の該当行番号を自分で読み実物一致を確認済み。 |
| (e) docs（experiments/name-prompt.md 記録先テンプレ + s6-followup §2 実施記録） | **PASS** | `experiments/name-prompt.md` は §1 走らせ方・§2 記録指標・§3 判定基準・§4 実測記録（空欄）の体裁。`s6-followup.md` は `git diff` で確認済みの追記のみ（既存本文は 1 行も変更されていない・末尾に実施記録を追加）。 |

### 2. blocking 基準（wave-plan §4）の逐条充足

| 基準 | 判定 | 根拠 |
|---|---|---|
| §4-1 器コード・契約 JSON・lockfile・package.json 完全不変・新規依存ゼロ | **PASS** | 上記「自分で走らせた生数字」節の `git diff --stat` 出力ゼロを確認。import は全て既存モジュールのみ。 |
| §4-3前半 prompt 注入が転写バッファ/セグメンタ/VAD を通らない（正本不変）ことをテストで固定 | **PASS** | `whisper-inference.test.mjs`「prompt 注入は転写正本を汚さない」テスト（fake 応答テキストに prompt の断片を含めず、`result.text`/`result.rawText` がサーバ応答由来のみであることをアサート・自分で実行し緑を確認）。 |
| §4-3中 prompt 無指定の後方互換 | **PASS** | `whisper-inference.test.mjs`「options.prompt 省略時は DEFAULT_WHISPER_PROMPT が常時注入される」テスト＋ `ear-pipeline.test.mjs` 新規テスト（本番経路で prompt 省略時に既定が自動採用）。両方緑。 |
| §4-3後半 スイープスクリプトは実ネット/実マイク不出の構造（TTS合成+ローカルwhisper-serverのみ・音声非保存） | **PASS** | direct execution ガードで import 時は `main()` 不実行。`fs` 系 import なし（grep 0 件）。ネットワーク発生源は `main()` 内の `createWhisperServer`/`createTtsClient` のみで、人間が直接実行した場合に限る。 |
| §4-4 3 チェック無退行 | **PASS** | 自分で実行し Claim と完全一致（上記節）。 |

### 3. 後方互換

**PASS**。`options.prompt` 省略時は常に `DEFAULT_WHISPER_PROMPT` が乗る（`whisper-inference.mjs:89`）。
既存の audio_ctx アサート（「multipart に audio_ctx フィールドを積む（省略時は積まない）」テスト）は無改変で
存在し緑のまま。加えて新規テスト「audio_ctx 省略時の既存挙動は prompt 追加後も無退行」が
`audio_ctx` 省略時に `null`・`prompt` は常時注入、の両方を同時にアサートして二重に固定している
（`whisper-inference.test.mjs` 末尾）。既存の耳テスト全体も無退行（`node --test` 全体 724/724/0）。

### 4. スイープの実走規律

**PASS**。`experiments/name-prompt.md` §4 の実測欄が空欄のままであることを自分で確認（Gnome が実測値を
捏造していないことの直接証拠）。`bench-name-prompt.mjs` に `fs` 書き込み API の import なし。実ネットは
`main()`（人間の直接実行時のみ）に閉じ込められており、`node --check scripts/bench-name-prompt.mjs` 相当の
構文健全性は `node --test scripts/bench-name-prompt.test.mjs` が import に成功して緑であることで間接確認
（このテストファイル自体を実行することが「実走していない」の規律に反しないことも direct execution ガードの
構造で担保されている）。

### 5. 成果物主張の正直性

domain-b.md の全数字を自分で node --test（タイムアウト300s）・git diff で再実行・再計算して照合した。

- 724/724/0（全体）: **一致**。
- 追加内訳 +5/+1/+12=+18: **一致**（HEAD 比較で自分で再計算）。ただし表内 `ear-pipeline.test.mjs` の
  「実装前」個別セルは `11` ではなく実測 `10` — **non-blocking の表記誤り**（差分・合計には影響なし）。
- git diff --stat（器/契約/lockfile/package.json 不変）: **一致**（自分で実行・出力ゼロ）。
- Domain A 完了後ベースライン 706/706/0: 直接の再実行はしていない（Domain A の変更を working tree から
  分離する破壊的操作を避けたため）。ただし `724 - 18 = 706` の逆算により Domain B 起因の追加分とだけ
  整合することを確認した。
- 3 チェックの唯一の違反 `apps/runtime-player/src/main/physiology/index.ts`: **器側ベースライン（不変）で
  あることを確認**（`git diff --stat -- apps/runtime-player` 出力ゼロ）。

---

## Gnome の §質問への spec 判定（domain-b.md §3）

1. **`NAME_MATCH_VARIANTS_V0` を fire-scheduler.mjs から独立させた設計判断**: wave-plan/inventory はこの
   揺れ集合の再利用を要求も禁止もしていない（inventory §B-2 が挙げる部品は `bench-asr.mjs`/
   `probe-long-utterance` のみ）。spec 契約違反ではない。二重管理のトレードオフは design レーンの判断領域。
2. **direct execution ガードの新設**: wave-plan §3 Domain B「テスト:transcribeがpromptをform注入する純ロジック
   （…）」というテスト可能性要求を満たすために必要な構造であり、契約違反ではない。既存スクリプトへの
   遡及適用をしていない点もスコープ外として正直に開示されている。
3. **audio_query フィールド名の実機未検証**: スイープスクリプト自体が実走していないことの一部であり、
   §質問で正直に申告済み。spec 上の懸念ではなく、人間ゲートでの実走時に確認すべき事項として妥当。
4. **スイープ計測は実走していない**: 契約 §4-3「機械テストはfakeまで」と完全に整合。実測欄空欄を自分で
   確認済み（上述）。
5. **人間ゲート申し送り**: 内容は wave-plan §1 人間ゲート B・§5 choke point B と整合しており妥当。

---

## Orch への申し送り

- **non-blocking**: `discussion/ai-cohost/implementation/waves/verbosity-vocab/domain-b.md` §4 の追加内訳表
  における `ear-pipeline.test.mjs` の「実装前」列を `11` → `10` に訂正するのが望ましい（`+1`・合計 `+18`・
  `706/724` はいずれも正しいため、修正は記録の精度のみに関わる。blocking 要件には影響しないため wave の
  進行を止める理由にはならない）。
- 人間ゲート実施時に確認すべき事項（Gnome §質問3 と同一）: `PARAM_VARIATIONS_V0` の
  `speedScale`/`pitchScale`/`intonationScale` フィールド名が AivisSpeech の実 API と一致するか。不一致の
  場合は `synthesizeVariants`（`bench-name-prompt.mjs:161` 隣の3行）の修正が必要（Gnome 側でも申告済み）。
- スイープ計測（`scripts/bench-name-prompt.mjs`）は一度も実行されていない。人間ゲートでの実走・
  `experiments/name-prompt.md` §4 への記録が次の作業。

## §質問（Review-Sylph からの申し送り）

- `ear-pipeline.test.mjs` の「実装前」表記誤り（11→10）について、domain-b.md 本体を訂正するか、
  この review 文書の指摘のみで留め置くかは Orch 判断に委ねます。blocking ではないため、wave 全体の
  判定（PASS-with-nonblocking）には影響させていません。
- Domain A 完了後ベースライン 706/706/0 について、working tree から Domain A の変更を分離した直接の
  再実行はしていません（stash 等の破壊的操作を読み取り専任の規律上避けたため）。`724-18=706` の逆算での
  整合確認に留まる点、ご承知おきください。
