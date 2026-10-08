# 多頭化(頭脳差し替え) Domain A レビュー — レーン: test（テストの実在性・fake 徹底・性質の証明力）

> レビュア: Review-Sylph（サブエージェント委任 / 呼び出し元 Orch-Sylph）。
> 対象: 実装報告 [../../waves/brain-swap/domain-a.md](../../waves/brain-swap/domain-a.md)。
> 基準: [../../orchestration/brain-swap-wave-plan.md](../../orchestration/brain-swap-wave-plan.md) §3 Domain A + §4 blocking 基準（主に #3・関連して #1）。
> 方式: Gnome の報告を鵜呑みにせず、テストコード（`codex-session.test.mjs`/`brains.test.mjs`/`env-guard.test.mjs`）を精読し、アサーションの実質を評価。加えて `node --test` を自分で独立実行し、実行前後で本物の `~/.codex/sessions` のファイル数が不変であることも自分の手で確認した。

## 総合判定: **PASS**

blocking 基準（wave-plan §4 #3・関連 #1）に反する事実は見つからなかった。全 6 検証項目が○。non-blocking の気づきが 3 件（下記、いずれも回帰検知力の軽微なギャップであり blocking 判定には影響しない）。

---

## 検証項目（結果）

### 1.【blocking #3】実消費ゼロ・全 fake — ○
`codex-session.test.mjs` 内の `createCodexSession(...)` 呼び出しは 20 箇所すべてで `sdkImpl: FakeCodex`（`FakeCodex` は `makeFakeSdk()` が返す fake クラス）を渡していることを目視 + grep の両方で確認した（`grep -n "createCodexSession("` の全 20 件を個別確認、複数行呼び出しも含む）。テストファイル中に `@openai/codex-sdk` からの実 import は無い（`grep -rn "@openai/codex-sdk" src/mind/*.test.mjs` → 0 件）。`spawn`/`http.request`/`fetch(`/`https.request` 等の実ネット/実プロセス起動の痕跡もテストファイル中に無い。`codex-session.mjs` 本体は実 SDK を import しているが（`import { Codex as DefaultCodexSdk } from "@openai/codex-sdk"`）、これは `sdkImpl` 未指定時の既定値であり、テストは全箇所で明示的に上書きしているため実消費経路には到達しない。

### 2.【最重要】テストが本物の `~/.codex` に絶対触れない — ○
全 20 テストが `withScratchHome()` ヘルパ（`codex-session.test.mjs:91-99`）経由で `mkdtempSync(path.join(os.tmpdir(), "codex-session-test-home-"))` で作った使い捨て `homeDir` と `ledgerPath` を `createCodexSession()` に明示注入している。`homeDir` 未注入（＝既定の `os.homedir()` が使われる）経路でテストが走っている箇所は無い（grep で全 `createCodexSession` 呼び出しに `homeDir` 引数があることを確認）。`finally` で必ず `rmSync(homeDir, {recursive:true, force:true})` する構造。

**自分で実行した直接証拠**: テスト実行前後で `node scripts/spike-codex-terra.mjs sessions` を実行し、本物の `C:\Users\remie\.codex\sessions` のファイル数を比較した。

- 実行前: `sessions_file_count=4494`
- `node --test`（apps/soul/agent 全体・797 件）実行後: `sessions_file_count=4494`（不変）

Gnome の報告書 §4 が主張する「4494 のまま」を独立に再現・確認した。

### 3.【blocking #1 の証明力】「ユーザー rollout を消さない」性質テスト — ○（強い証明力あり）
5 本の性質テストのアサーションを読み込んだ。いずれも空テストではなく、実際に他人ファイルの生存を `existsSync===true` で個別アサートしている:

- `codex-session.test.mjs:399-429`（起動時 sweep）: 台帳に載らない他人 rollout **12 本**を日付をばらけさせて配置 + 自分の rollout 2 本を台帳記載で配置。sweep 後、自分の 2 本は `existsSync===false`、他人の 12 本は個別に `existsSync===true` を for ループでアサート。台帳が空になることも確認。
- `codex-session.test.mjs:431-459`（dispose）: 他人 rollout 10 本 + `ask()` で確定した自分の thread_id 1 本。dispose 後、自分の 1 本だけ消え他人 10 本は無傷を個別アサート。
- `codex-session.test.mjs:461-484`（見つからない id）: 存在しない thread_id を台帳に仕込んでも throw せず、無関係な他人 rollout 2 本が無傷であることを確認。
- `codex-session.test.mjs:486-503`（sessions dir 自体が無い）: エラーにならないことのみ確認（他人ファイルは存在しないケースなので生存アサートは無いが、これは性質上妥当）。
- `codex-session.test.mjs:505-521`（**部分一致 decoy**）: 台帳 id `"abc"` に対し、ファイル名に `"abc"` を部分文字列として含む decoy（`rollout-...-xxx-abc-yyy.jsonl`）を明示的に配置し、これが消えず残る（`existsSync===true`）ことと、完全一致するファイル（`rollout-...-abc.jsonl`）だけが消える（`existsSync===false`）ことを両方アサート。**これが最も証明力が高いテスト**——正規表現による構造パース＋厳密 `===` 比較という実装の核心（部分一致では絶対に消さない）を直接検証している。

いずれも「ダミーで通るだけの空テスト」ではなく、実際にファイルシステム上の存在有無を確認する強いアサーションになっている。実装側（`codex-session.mjs:116-151` の `deleteRolloutForThreadId`）を読んでも、`glob`/`includes`/`startsWith` 等のパターンマッチ経路は存在せず、`extractThreadIdFromRolloutFilename` の正規表現キャプチャと `===` 比較のみで削除対象を決めている構造と、テストの主張は一致する。

### 4. 画像橋渡しテスト — ○
`codex-session.test.mjs:175-199`（正常系）: fake の `onRun` コールバック内で `existsSync(capturedPath)` を呼び `existedDuringRun=true` を実際に記録してから `ask()` の完了を待ち、その後 `existsSync===false` を確認——「run 中に存在」を演技ではなく実測している（`buildInput` が `writeFileSync` で書き出した後に `runStreamed` が呼ばれ、fake がそのタイミングで存在確認する構造なので、証明として妥当）。
`codex-session.test.mjs:201-224`（`turn.failed` 系）: 失敗イベントを返す fake でも `capturedPath` の `existsSync===false` を確認しており、`finally` での確実な削除を裏取りしている。

### 5. その他の網羅 — ○
以下すべて実在し、意味のあるアサーションを持つことを確認した:
- ask(string) turn1 systemPrompt 前置 / turn2 素通し（:117-138、`capturedInputs[0]`/`[1]` の厳密な文字列一致比較）
- content 配列 text+image マッピング（:142-171、`deepEqual` で配列要素を個別検証、local_image の path が `.jpg` で終わることも確認）
- usage 透過 / ttftMs:null / elapsedMs>0（:228-247、`elapsedMs` は `setTimeout(2ms)` を fake 側に仕込んで確実に正の値になるようにしている——タイミング依存の flaky さを排除する丁寧な設計）
- turn.failed→throw（:251-260、メッセージ内容の正規表現一致まで確認）/ error イベント→throw（:262-277）
- env-guard 発火（:281-311、OPENAI_API_KEY/CODEX_API_KEY 個別、`skipEnvGuard` バイパスも:313-327 で確認）
- dispose 冪等（:331-339）/ dispose 後 ask throw（:341-348）
- ask('')/ask([]) TypeError（:352-360）
- threadIds 公開（:364-373、初回 turn 前は空配列であることも確認）
- ThreadOptions 配線（:377-395、sandboxMode/approvalPolicy/webSearchEnabled/modelReasoningEffort/skipGitRepoCheck/workingDirectory 実在 + dispose 後の workingDirectory 消滅まで確認）
- brains health test（`brains.test.mjs` 全 6 本、registry 形・frozen・エントリ形・credentialPath 末尾）

### 6. env-guard sibling テスト — ○
`env-guard.test.mjs:88-146` の新規 7 本で網羅を確認: 未設定 pass（:90-93）/ OPENAI_API_KEY throw（:95-100）/ CODEX_API_KEY throw（:102-107）/ 両方同時列挙（:109-123）/ OPENAI_BASE_URL warn（:125-132）/ 空文字 pass（:134-141）/ 非オブジェクト TypeError（:143-146）。既存の Anthropic 版 9 本（:11-86）は無変更のまま残っている（diff 差分ではなく併存確認）。

---

## 独立実行した生出力

### `node --test`（apps/soul/agent 全体・自分で実行）
```
1..797
# tests 797
# suites 0
# pass 797
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 1481.6927
```

### `node --test src/mind/*.test.mjs`（mind/ 配下のみ・自分で実行）
```
1..223
# tests 223
# suites 0
# pass 223
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 382.6023
```

### `node --test src/mind/codex-session.test.mjs src/mind/brains.test.mjs src/mind/env-guard.test.mjs`（Domain A 新規/変更分のみ・自分で実行）
```
1..42
# tests 42
# suites 0
# pass 42
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 307.0626
```
内訳: codex-session 20 + brains 6 + env-guard 16（既存9+sibling新規7）= 42。Gnome 報告の「+33（env-guard sibling 7 + brains health test 6 + codex-session test 20）」と算数が一致（既存 env-guard 9 本を加えると 42）。

### 本物の `~/.codex/sessions` ファイル数（テスト実行前後・自分で実行）
```
実行前: sessions_file_count=4494
実行後: sessions_file_count=4494
```
不変を確認。テスト実行が本物の `~/.codex` に一切触れていないことの直接証拠。

---

## non-blocking の気づき

1. **Codex コンストラクタ引数（`forced_login_method`）を検証するテストが無い**: `makeFakeSdk()` は `getLastConstructedOptions()`（`new CodexCtor(options)` に渡された options を捕捉するヘルパ・`codex-session.test.mjs:31,56,66`）を用意しているが、grep 確認の結果**どのテストからも呼ばれていない**（定義のみ、呼び出しゼロ）。`codex-session.mjs:369-372` の `new CodexCtor({config:{forced_login_method:"chatgpt"}})` はモジュールヘッダ JSDoc で「API キー課金への化けを防ぐ」ための固定値と明記されている重要な配線だが、これが将来のリファクタで欠落しても現状のテストスイートは検知できない。`getLastConstructedOptions()` を使い `assert.deepEqual(getLastConstructedOptions(), {config:{forced_login_method:"chatgpt"}})` 相当のテストを 1 本足すことを提案（追加コストは低い・ヘルパは既にある）。
2. **turn2 で content ブロック配列を渡すケースが未テスト**: `buildInput()`（`codex-session.mjs:240-273`）は `isFirstTurn===false` かつ配列入力の場合に systemPrompt 前置ブロックを push しない分岐を持つが、既存テストは「turn2 は string」（:117-138）と「turn1 は array」（:142-171）の組合せのみで、「turn2 が array」の組合せは検証されていない。回帰リスクは低い（分岐自体は単純）が、契約網羅という観点では軽微なギャップ。
3. **`turn.failed`/`error` 時に `threadIds`/台帳が記録されることの直接テストが無い**: `ask()` の実装（`codex-session.mjs:411-422`）は `runTurn` が例外を投げても `finally` で `thread.id` を `threadIds`/台帳へ記録する設計（「turn.failed でも rollout ファイルは作られている可能性がある」ため意図的な安全側動作）。「turn.failed でも画像の一時ファイルは finally で削除される」テスト（:201-224）はこの `finally` 経路を通るが、`threadIds`/`ledgerPath` の中身はアサートしていない。この記録漏れがあると「失敗した turn の rollout が dispose/sweep で掃除されない」事故になりうるため、blocking 基準 #1（掃除の安全性）の周辺として軽微に重要——ただし「記録されない」方向のバグは安全側（余計に消さない）なので blocking 判定を下げるものではないと判断した。

## 質問（Orch 宛て）

特に無し。上記 non-blocking 3 件はいずれも追加テストの提案であり、現状の実装・テストで blocking 基準 #1/#3 は満たされていると判断した。
