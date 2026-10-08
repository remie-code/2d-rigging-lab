# S5 Domain A レビュー（test レーン）

> レーン: **test**（テストの質・網羅・実行）。レビュアー: Review-Sylph。呼び出し元: Orch-Sylph（S5 Domain A 実行責任者）。
> 対象: `apps/soul/agent`（`node --test`）／新器官 `src/eyes/`（powershell-exec / window-capture / window-list）。日付: 2026-07-13。
> 読み取り専任・自分で再実行した生数字を根拠にする。install/commit は一切実行していない。
> 総合判定: **PASS**（blocking ゼロ・non-blocking 2 件は軽微観察）。

## 0. 自分で再実行した `node --test` 生数字（tail）

`cd apps/soul/agent && node --test`（1 回で緑・空/interrupted なし・再試行不要）:

```
1..372
# tests 372
# suites 0
# pass 372
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 1452.3481
```

- Claim（domain-a.md §8: tests 372 / pass 372 / fail 0 / cancelled 0 / skipped 0 / todo 0）と**完全一致**。
- skipped 0 / todo 0 のため、緑の偽装（skip/todo 隠し）は無い。

## 1. 実行と数字の一致・内訳照合 — **PASS**

- 上記生数字が Claim と一致。生数字は自分の実行から採取。
- Claim: S4 前ベースライン 331 → 372（+41）。内訳 `powershell-exec.test.mjs` 9 / `window-capture.test.mjs` 20 / `window-list.test.mjs` 12。
- 各ファイルの `test(...)` 出現行を自分で数えて照合:
  - `powershell-exec.test.mjs`: L35/48/55/73/107/120/132/152/170 = **9 本**（Claim と一致）。
  - `window-capture.test.mjs`: L33/38/47/55/65/70/75/80/88/95/102/109/119/127/147/156/165/174/186/209 = **20 本**（Claim と一致）。
  - `window-list.test.mjs`: L23/32/46/52/56/60/65/74/86/95/107/125 = **12 本**（Claim と一致）。
  - 合計 9+20+12=41、331+41=372 で自分の実行結果と整合。

## 2. 既存テストの無退行（wave-plan §4-1・要件6） — **PASS**

- `git status --porcelain -- apps/soul/agent` の新規追加は `apps/soul/agent/scripts/preflight-eyes.mjs` と `apps/soul/agent/src/eyes/` のみ（自分で確認）。
- `git diff --stat` で既存テストファイル（`src/eyes/` 以外）の差分ゼロを確認。既存 331 本を 1 本も変更・削除・緩めていない。
- `git diff --stat -- apps/runtime-player packages` / `git diff --stat -- pnpm-lock.yaml apps/soul/agent/package.json` いずれも差分ゼロ（自分で確認・器コード・lockfile・package.json 完全不変）。

## 3. fake 徹底（wave-plan §4-2 blocking） — **PASS**

- 3 テストファイルとも `import` に `node:fs` を含まない（自分で grep 確認・テストがディスクに画像/ファイルを書いていない）。
- `spawnImpl` 注入回数: `powershell-exec.test.mjs` 14 / `window-capture.test.mjs` 8 / `window-list.test.mjs` 5（自分で grep 確認）。純関数テスト（`escapePsSingleQuoted`/`buildCaptureScriptText`/`parseCaptureStdout`/`buildListScriptText`/`parseListStdout` など、計 12+7=19 本相当）は spawn 自体を経由しない設計であり、それ以外の全実行系テストは fake spawn を経由している。
- `captureWindow("")`/`captureWindow(undefined)`/`captureWindow(123)` の TypeError テスト（`window-capture.test.mjs` L119–125）は `spawnImpl` を渡さずに呼んでいるが、実装側 `window-capture.mjs` L209–210 で `typeof title !== "string" || title.length === 0` を spawn 呼び出しより前に同期チェックしていることを実装コードで確認済み。実 spawn には到達しない設計であり、テストが通っていること自体が「実 powershell.exe を起動していない」ことの傍証になる。
- 実マイク・実キャプチャ・実 SDK・実窓を引く機械テストは 3 ファイルとも無い（`makeFakeChild` は `EventEmitter` ベースの純フェイクで、コメントにも「実 powershell.exe は一切起動しない」と明記）。

## 4. 失敗全分岐の fake 固定（wave-plan §4-3 blocking） — **PASS**

- `captureWindow` 経由（fake spawn）での kind 別テスト: notFound（L147–154）／minimized（L156–163）／failed＝PrintWindow 失敗（L165–172）／failed＝非 0 終了+stdout 空（L174–184）／timeout（L186–207）／白紙成功マーカー（L209–218）を確認。
- `parseCaptureStdout` 純関数レベルでの追加固定: 未知 kind → failed フォールバック（L80–86、message に元の kind 文字列を含むことも assert）／CAPTURE_OK だが寸法不正（NaN）→ failed（L102–107）／白紙成功マーカー（100 文字未満 base64）→ failed（L109–115、message に "implausibly short" を含むことも assert）／空 stdout・認識不能な先頭行 → failed（L88–100）。
- TypeError 早期弾き（L119–125）: `""`/`undefined`/`123` の 3 パターンで `assert.rejects(..., TypeError)` を確認。
- window-list 側は kind が `failed`/`timeout` の 2 種のみ（notFound/minimized の概念なし、契約通り）で、非 0 終了+stdout 空 → failed（L95–105）を確認。

## 5. タイムアウト分岐（レビュー観点2） — **PASS**

- `powershell-exec.test.mjs` L132–150: 即時発火 fake `setTimeoutImpl` で `timedOut:true` かつ `fakeChild.wasKilled()===true` を確認。L152–168 で「タイムアウト確定後に遅れて exit が来ても二重解決しない（例外にならない）」を確認（settled ガード）。
- `window-capture.test.mjs` L186–207: `killed` フラグを独自に張り直して `captureWindow` のタイムアウトで `kind:"timeout"` かつ `killed===true` を確認。message に timeoutMs 値（999）を含むことも assert。
- `window-list.test.mjs` L107–123: 同様に `kind:"timeout"` かつ message に timeoutMs 値（1234）を含むことを確認。
- いずれも実時間を待たない fake timer（`setTimeoutImpl` が同期的に即時発火）であり、`node --test` の実測 `duration_ms` が 372 本合計 1452ms（1 本あたり平均 4ms 未満）であることからも実待機が無いことを裏付ける。

## 6. window-list テスト網羅（レビュー観点4） — **PASS**

- JSON パース正規化: 複数件配列（L32–44）／単一オブジェクト（PowerShell 5.1 の 1 件配列崩れ、L46–50）／空配列 `"[]"`（L52–54）／`"null"`（L56–58）／空文字列・空白のみ（L60–63）／壊れた JSON（L65–70）をすべて確認。
- 0 件を失敗にしない: `listWindows` 経由で空配列成功を確認（L86–93、`{ windows: [] }`）。
- タイムアウト分岐: L107–123（上記 5 節）。
- 既定タイムアウト値の固定: L125–132（`DEFAULT_LIST_TIMEOUT_MS === 3000`）。

## 7. powershell-exec テスト網羅（レビュー観点5） — **PASS**

- 正常終了: L73–105（stdout/stderr/code/elapsedMs 集約・`timedOut:false`）。
- spawn error: L120–130（`code:null`・stderr にメッセージ）。
- タイムアウト: L132–150、二重解決防止: L152–168。
- クリーンアップ: L104 で `fakeChild.wasKilled()===true`（成功時も kill されることを直接 assert）。L170–187 で `clearTimeoutImpl` が正常終了時に呼ばれることを直接 assert。
- UTF-8 前置き差し込み固定: L48–53（`withUtf8OutputPrelude` 純関数）／L55–69（`runPowerShellScript` が実際に渡すスクリプト文字列に前置きが含まれることを fake spawn 経由で確認）。
- 起動引数組み立て: L35–46（`buildPowerShellInvocationArgs` の `-NoProfile -NonInteractive -NoLogo -ExecutionPolicy Bypass -Command` を固定）。

## non-blocking（軽微観察・修正不要）

1. **destroy/unref の呼び出し自体は直接 assert されていない**: `powershell-exec.mjs`（L108–115）は `kill()` → `stdout.destroy()` / `stderr.destroy()` / `stdin.destroy()` → `unref()` の順でクリーンアップするが、テストで直接 assert されているのは `kill()`（`wasKilled()`、L104）のみ。`destroy`/`unref` は `makeFakeChild` の no-op スタブが例外なく完了することでしか間接的に検証されていない（呼ばれた回数・タイミングをテストが確認していない）。実害は薄い（例外を投げれば `node --test` が拾うため無音の失敗にはならない）が、委任要件「クリーンアップ（kill/destroy/unref）」の直接検証としては kill のみがカバーされている。
2. **白紙成功マーカー／未知 kind フォールバック／寸法不正 failed は `captureWindow`（fake spawn）経由と純関数（`parseCaptureStdout`）経由が混在**: 白紙マーカーは両方（純関数 L109–115、captureWindow 経由 L209–218）で固定されているが、未知 kind フォールバック（L80–86）と寸法不正 failed（L102–107）は `parseCaptureStdout` の純関数レベルのみで、`captureWindow` 経由（fake spawn 縦検証）のテストは無い。`captureWindow` が内部で `parseCaptureStdout` をそのまま呼ぶ実装であれば実害はないが、呼び出し配線自体を通した確認ではない。

## 総合判定

**PASS**（blocking ゼロ）。自分で実行した生数字 372/372/0（cancelled 0 / skipped 0 / todo 0）は Claim と完全一致・1 回で緑。内訳（9+20+12=41）を自分で数えたテスト実数と照合し一致。既存 331 本は無退行（git diff で確認）。fake 徹底（fs 非使用・spawnImpl 注入・実 powershell.exe 非起動）、失敗全分岐（notFound/minimized/failed×2/timeout/白紙マーカー/未知kind/寸法不正/TypeError）の fake 固定、タイムアウト分岐（kind:timeout かつ kill 検証・実時間非待機）、window-list の JSON 正規化網羅（複数件/単一オブジェクト/空/null/壊れ）と 0 件正常、powershell-exec の正常系/異常系/クリーンアップ/UTF-8 前置き、すべて実在テストで確認した。non-blocking 2 件はいずれも修正不要の軽微観察（destroy/unref の直接 assert 不足、未知kind/寸法不正の captureWindow 経由テスト不在）。

## §質問（Orch への申し送り）

- 上記 non-blocking 2 件は blocking 基準（wave-plan §4）のいずれにも抵触しないと判断したが、次ドメイン（B/C）で `captureWindow`/`runPowerShellScript` の内部実装を変更する際は、destroy/unref の呼び出し確認テストが無い分、リグレッションを静かに通す余地がある点を留意してほしい。
