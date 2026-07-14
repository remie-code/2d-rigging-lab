# 口数配線+コーディ語彙登録 wave Domain B: コーディ語彙登録（Whisper initial prompt）

> Status: 実装完了・機械ゲート緑（2026-07-14）。魂の耳（whisper /inference）へ AI 相方の名前
> 「コーディ」の刷り込み prompt をリクエスト毎に注入し、転写での名前認識を上げる配線を追加した。
> スイープ計測スクリプトは新規に用意したが**実走はしていない**（人間ゲート/計測の領分）。
> 担当: Gnome（Orch-Sylph 委任）。対象パッケージ: `apps/soul/agent`（独立 npm・workspace glob 外＝
> lockfile 不変）。
> 契約の正: [../../orchestration/verbosity-vocab-wave-plan.md](../../orchestration/verbosity-vocab-wave-plan.md) §2（裁定B）・§3 Domain B・§4（blocking 基準・特に §4-3） /
> [../../orchestration/verbosity-vocab-inventory.md](../../orchestration/verbosity-vocab-inventory.md) §B-1（確定事実）・§B-2（裁定と検証） /
> 出自: [../s6/s6-followup.md](../s6/s6-followup.md) §2（転写側の用語登録＝Whisper initial prompt）。

## 1. 実装/変更ファイル一覧

| ファイル | 種別 | 役割 |
|---|---|---|
| `src/ears/whisper-inference.mjs` | 変更（既存ファイル） | `DEFAULT_WHISPER_PROMPT` 定数 export + `createWhisperInference` の `options.prompt` 読み取り + `transcribe` 内で非空 prompt を form へ常時注入。 |
| `src/ears/whisper-inference.test.mjs` | 変更（既存ファイル） | prompt 注入の純ロジックテスト 6 本を追加（既定注入・カスタム・無効化・正本不変・audio_ctx 非干渉）。 |
| `src/ears/ear-pipeline.test.mjs` | 変更（既存ファイル） | `transcribeImpl` 未指定（本番経路）で既定 prompt が自動注入されることを固定するテスト 1 本を追加。`ear-pipeline.mjs` 自体は**無改変**。 |
| `scripts/bench-name-prompt.mjs` | 新規 | prompt 有無のスイープ計測スクリプト（bench-asr.mjs 部品を再利用）。**書くだけ・実走していない**。 |
| `scripts/bench-name-prompt.test.mjs` | 新規 | スコアリング純関数（`containsNameVariant`/`scoreNameHitRate`/`summarizeSweep`）+ `inference`/`synthesizeVariants`/`runSweep` の fake 注入テスト 12 本。 |
| `discussion/ai-cohost/experiments/name-prompt.md` | 新規 | スイープ結果の記録先テンプレート（実測値は空欄）。 |
| `discussion/ai-cohost/implementation/waves/s6/s6-followup.md` | 変更（既存ファイル・追記のみ） | §2 末尾に実施記録を追記（既存本文は無改変）。 |

**器コード（`apps/runtime-player/**`・`packages/**`）・契約 JSON・`pnpm-lock.yaml`・
`apps/soul/agent/package.json` は完全不変**（§4 の `git diff --stat` で確認・新規依存ゼロ）。
`ear-pipeline.mjs` 本体は 1 バイトも変えていない（B-2 裁定どおり）。

## 2. 設計裁定の実装箇所（file:line）

### B-1. whisper-inference.mjs

- **`DEFAULT_WHISPER_PROMPT`**（`src/ears/whisper-inference.mjs:49`・`export const`）: v0 値
  「こーでぃー、コーディ。」。直前のコメント（:40-48）に「Whisper の initial prompt はデコード前の
  語彙バイアス・転写バッファ/セグメンタ/VAD は一切通らない＝正本の形不変」を明記。
- **option 読み取り**（:89）: `const prompt = typeof options.prompt === "string" ? options.prompt : DEFAULT_WHISPER_PROMPT;`。
  `options.prompt` 省略時は常に既定定数が乗る。`""`（空文字）を明示指定すると `if (prompt)` が偽
  になり無効化できる（テスト用の逃げ道・タスク指示どおり）。
- **form 注入**（:117-121）: `audio_ctx` 注入ブロック（:114-116）の直後に
  `if (prompt) { form.append("prompt", prompt); }`（非空 prompt をリクエスト毎に常時注入）。
- **JSDoc**（:74-75）: `@param {string} [options.prompt=DEFAULT_WHISPER_PROMPT]` を追記。

### B-2. ear-pipeline.mjs は無改変（既定 prompt が自動で乗る）

- `ear-pipeline.mjs:387-392` の `createWhisperInference({ baseUrl: server.baseUrl, timeoutMs: asrOptions.timeoutMs })`
  は `options.prompt` を省略しているため、**`DEFAULT_WHISPER_PROMPT` が自動で乗る**（1 行も変更して
  いない・inventory §B-2「ツマミにしない・コード内定数の流儀」）。
- この「既定 prompt が本番経路に自動で乗る」ことは `ear-pipeline.test.mjs:154-223` の新規テストで
  実際に `pipeline.start()` を呼び、`globalThis.fetch` を一時差し替え（try/finally で必ず復元）して
  `transcribeImpl` 未指定分岐（＝本番の `createWhisperInference` 呼び出し）を実際に通し、fetch に届いた
  multipart form の `prompt` フィールドが `DEFAULT_WHISPER_PROMPT` と一致することを直接検証した
  （fake capture/VAD/whisper-server・実マイク/実ネット/実 whisper-server 不使用）。

### B-3. scripts/bench-name-prompt.mjs（新規・書くだけ・実走せず）

- **素材**: `NAMED_SENTENCES_V0`（:42-46・名前入り 3 文）/ `UNNAMED_SENTENCES_V0`（:49-53・名前なし
  3 文・幻聴混入判定用）/ `PARAM_VARIATIONS_V0`（:61-69・話速/ピッチ/抑揚の振り 7 パターン: base +
  各軸 low/high。直積にすると合成数が爆発するため base+1 軸変化の設計）。
- **名前揺れ集合**: `NAME_MATCH_VARIANTS_V0`（:78-84） = `コーディー`/`コーディ`/`コーティー`/
  `コーティ`/`こーでぃー`（fire-scheduler.mjs の `NAME_VARIANTS_V0` と同じ 4 表記 + ひらがな明示追加。
  fire-scheduler.mjs には依存させない設計判断・§3 質問1）。
- **スコアリング純関数（export・fixture テスト対象）**: `containsNameVariant`（:94-97）/
  `scoreNameHitRate`（:106-114）/ `summarizeSweep`（:123-138）。fetch/TTS 非依存。
- **TTS 合成**（bench-asr.mjs:55-76 写経）: `synthesizeVariants`（:161-186）。`ttsClientFactory` 注入
  可能（既定 `createTtsClient`）。`args.synthetic` で正弦波フォールバック（bench-asr と同型）。
- **/inference 直投**（bench-asr.mjs:78-93 写経 + prompt 1 行）: `inference`（:199-217）。
  `form.append("prompt", opts.prompt)` を `audio_ctx` 注入の隣に追加・`fetchImpl` 注入可能。
- **スイープ中核ロジック**（テスト可能化のための新規切り出し）: `runSweep`（:237-273）。
  `synthesizeImpl`/`inferenceImpl` を注入できるため、実ネット/実 TTS なしで「prompt 有無の対比が
  組める構造」を機械テストできる（タスクの「テスタビリティ」要求）。
- **direct execution ガード**（ファイル末尾）: `import.meta.url === pathToFileURL(process.argv[1]).href`
  で `main()` を「直接実行されたときのみ」走らせる。node:test から `import` しても `main()`（実
  whisper-server 起動 + 実 TTS 呼び出し）は走らない——bench-asr.mjs 等の既存スクリプトには無い
  ガードだが、本スクリプトは node:test から純関数/`runSweep` を import する必要があるため新規に
  導入した（§3 質問2）。

### B-4. docs

- `discussion/ai-cohost/experiments/name-prompt.md`（新規）: s2-ears.md の体裁を踏襲。走らせ方
  （§1・前提=whisper-server+AivisSpeech 起動）・記録する指標（§2・名前正答率/幻聴混入率を prompt
  有無で対比する表）・判定基準（§3・wave-plan §1 人間ゲート B）・実測記録（§4・**空欄のまま**）。
- `discussion/ai-cohost/implementation/waves/s6/s6-followup.md` §2 末尾（追記のみ・既存本文は無改変）:
  実施記録（実配線済み・スイープ実走は未実施・記録先を明記）を追加。

## 3. §質問（迷った裁定点・スイープ計測の実走状況・人間ゲート申し送り）

1. **`NAME_MATCH_VARIANTS_V0` を fire-scheduler.mjs から独立させた設計判断**: fire-scheduler.mjs は
   `NAME_VARIANTS_V0`/`normalizeForMatch`（NFKC + かな→カナ + 濁点剥がし）を既に持っているが、
   `bench-name-prompt.mjs` はこれを import せず、独自に単純な部分文字列一致の揺れ集合を定義した。
   理由: (a) Domain A（口数）の fire-scheduler.mjs にこの Domain B のスクリプトを依存させたくない
   （独立性優先）、(b) whisper 出力はカタカナ/漢字混じりが主で、v0 の実用粒度としては正規化なしの
   単純一致で足りると判断。二重管理（揺れ集合の値そのものは 4 表記が重複）のトレードオフがある。
   fire-scheduler 側の集合を再利用する方が良ければ見直しを。
2. **bench-name-prompt.mjs に direct execution ガードを新設した**: bench-asr.mjs/probe-long-utterance.mjs
   等の既存スクリプトは無条件で末尾に `main().catch(...)` を書いており import 時に即実行される
   （テスト非対象だったため問題なかった）。本スクリプトは「スコアリング純関数 + `runSweep` を
   node:test から import してテストする」というタスク要求があるため、`pathToFileURL` ベースの
   direct execution ガードを新規に導入し、import だけでは `main()`（実 whisper-server 起動を含む）
   が走らないようにした。既存スクリプト群には遡って適用していない（本 Domain のスコープ外・
   既存スクリプトのテスト非対象という前提を変えていない）。
3. **audio_query の `speedScale`/`pitchScale`/`intonationScale` フィールド名は実機未検証**: VOICEVOX/
   AivisSpeech 系 API の一般的なスキーマ前提でこのフィールド名を採用したが、`fixtures.mjs` の実機
   固定値（`GOLDEN_MORAS_KONNICHIWA` 等）にはこれらのフィールドの実測記録が無く、本スクリプトは
   実走していないため独立検証できていない。人間が実走した際にフィールド名が違えば
   `synthesizeVariants` の該当箇所（:161 隣の 3 行）を直す必要がある。
4. **スイープ計測は実走していない（最重要の申し送り）**: タスク規律どおり、`scripts/bench-name-prompt.mjs`
   は書くだけで一度も実行していない。`discussion/ai-cohost/experiments/name-prompt.md` の実測欄は
   すべて空欄のまま。人間ゲートでの走らせ方は同ファイル §1（`node scripts/bench-name-prompt.mjs
   [--runs N] [--port N] [--synthetic]`・前提: whisper-server + AivisSpeech engine 起動）。記録先は
   同ファイル §4。判定基準は wave-plan §1 人間ゲート B（「promptで名前正答率が上がり・幻聴混入が
   許容内」+実発話での呼びかけ改善の体感確認）。
5. **人間ゲート申し送り**: 全器官起動→実発話で「コーディ」と呼びかけて拾われやすくなったかを体感
   確認してください。スイープ計測（§4 の手順）を回して数字で prompt の効果を確認することも判定に
   含まれます。

## 4. 機械ゲート生数字（実行済み・タイムアウト付き）

### `cd apps/soul/agent && node --test`（全テスト・タイムアウト 300s）

```
# tests 724
# pass  724
# fail  0
```

**Domain A 完了後のベースライン 706/706/0 → Domain B 実装後 724/724/0（+18・全緑）**。追加内訳
（ファイル別）:

| ファイル | 実装前 | 実装後 | 追加 |
|---|---|---|---|
| `src/ears/whisper-inference.test.mjs` | 3 | 8 | +5 |
| `src/ears/ear-pipeline.test.mjs` | 10 | 11 | +1 |
| `scripts/bench-name-prompt.test.mjs`（新規） | 0 | 12 | +12 |
| **合計** | **706** | **724** | **+18** |

`node --test src/ears/whisper-inference.test.mjs src/ears/ear-pipeline.test.mjs scripts/bench-name-prompt.test.mjs`
の個別実行でも全緑を確認済み（`# fail 0`）。`node --check scripts/bench-name-prompt.mjs` で構文健全性のみ
確認済み（実行はしていない）。

### 3 チェック（リポジトリルートで実行・タイムアウト付き）

```
node scripts/check-dependencies.mjs
→ Dependency guard passed.
→ EXIT=0

node scripts/check-soul-zone-boundary.mjs
→ Soul zone boundary guard passed: 1379 source files scanned; no 器→魂 imports and no 魂→器 code imports.
→ EXIT=0（Domain A 後 1377 files → 本 Domain で新設 2 ファイル〔bench-name-prompt.mjs +
  bench-name-prompt.test.mjs〕により 1379。越境 import なし）

node scripts/check-source-organization.mjs
→ Source organization violations found:
  - apps/runtime-player/src/main/physiology/index.ts: index.ts must remain a barrel-only entrypoint
→ EXIT=1（唯一の既知違反=器側ベースライン・本 Domain の変更は全て .mjs のため source-org 検査は
  非対象・無退行）
```

### `git diff --stat`（器不変・依存不変の確認）

```
git diff --stat -- apps/runtime-player packages pnpm-lock.yaml apps/soul/agent/package.json discussion/ai-cohost/contracts
→ 出力なし（器コード・契約 JSON・lockfile・package.json 完全不変）
```

本 Domain が変更/新規作成したファイル（`git status --porcelain` 抜粋）:

```
 M apps/soul/agent/src/ears/ear-pipeline.test.mjs
 M apps/soul/agent/src/ears/whisper-inference.mjs
 M apps/soul/agent/src/ears/whisper-inference.test.mjs
 M discussion/ai-cohost/implementation/waves/s6/s6-followup.md
?? apps/soul/agent/scripts/bench-name-prompt.mjs
?? apps/soul/agent/scripts/bench-name-prompt.test.mjs
?? discussion/ai-cohost/experiments/name-prompt.md
?? discussion/ai-cohost/implementation/waves/verbosity-vocab/domain-b.md
```

（同じワーキングツリーには Domain A の既存差分 13 ファイルも存在するが、本 Domain では一切
触れていない。`discussion/ai-cohost/implementation/reviews/verbosity-vocab/` も本 Domain の作成物
ではない未追跡ディレクトリで不干渉。）

### SDK/実マイク/実ネット/実 whisper-server/実 TTS 不使用

全テストは fake fetch（node:test 内・実 HTTP 不出）/ fake VAD・fake capture・fake whisper-server
factory（ear-pipeline.test.mjs 既存の流儀）のみ。`scripts/bench-name-prompt.mjs` は書いただけで一度も
実行していない（`node --check` による構文チェックのみ）。実 SDK・実マイク・実 YouTube・実
whisper-server・実 AivisSpeech は一切起動していない。
