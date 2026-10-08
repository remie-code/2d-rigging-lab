# S5 Domain A レビュー（design レーン）

> レビュアー: Review-Sylph（design レーン）。呼び出し元: Orch-Sylph。読み取り専任。
> 日付: 2026-07-13。対象: `apps/soul/agent`（S5 Domain A「目の器官」実装）。
> 総合判定: **PASS-with-nonblocking**。blocking なし。

観点は純部品分離・終了処理・PowerShell プロトコルの健全性・既存器官との一貫性・設計上の弱点。`node --test` は自分で 1 回実行し生数字を採取した。器 diff・追加ファイル一覧も自分で `git status`/`git diff --stat` を実行して確認した（Gnome の報告値をそのまま転記していない）。

---

## 0. 自分で再実行した機械ゲート

```
cd apps/soul/agent && node --test
# tests 372
# pass  372
# fail  0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 1158.2011
```

Claim（domain-a.md §8）の `372/372/0` と一致。1 回目の実行で安定（interrupted/空なし・再試行不要）。

```
git status --porcelain -- apps/runtime-player packages pnpm-lock.yaml apps/soul/agent/package.json
git diff --stat -- apps/runtime-player packages pnpm-lock.yaml apps/soul/agent/package.json
```
いずれも出力なし（クリーン）。器コード・契約 JSON・lockfile・`apps/soul/agent/package.json` は完全不変を自分で確認した。

```
git status --porcelain apps/soul/agent
```
新規は `apps/soul/agent/scripts/preflight-eyes.mjs` と `apps/soul/agent/src/eyes/` のみ。claim と一致。

```
grep -rn "eyes" apps/soul/agent/src --include=*.mjs -l | grep -v "/eyes/"
```
ヒットなし。Domain B（fire-orchestrator/mind/channel/cockpit）から `eyes` への参照はゼロ＝claim「呼び出し側を一切触っていない」を裏付ける。

---

## 1. 純部品分離 — PASS

- `powershell-exec.mjs`: `buildPowerShellInvocationArgs`（`:34-36`）・`withUtf8OutputPrelude`（`:53-55`）は spawn せず呼べる純関数。`runPowerShellScript`（`:73-149`）が唯一の spawn 注入点（`options.spawnImpl ?? spawn`、`:74`）。`ffmpeg-capture.mjs` の `spawnImpl` 注入パターン（`buildFfmpegArgs` 純関数 + `createFfmpegCapture` 内 `spawnImpl` 差し替え、`ffmpeg-capture.mjs:44,108,124`）と同型。
- `window-capture.mjs`: コマンド組み立て `buildCaptureScriptText`（`:66-143`）と stdout パース `parseCaptureStdout`（`:153-188`）が両方とも powershell を起動せずテスト可能な純関数として分離されている。本体 `captureWindow`（`:208-246`）はこの 2 つ + `runPowerShellScript` を組み合わせるだけの薄い接着層。
- `window-list.mjs`: 同型に `buildListScriptText`（`:32-43`）/ `parseListStdout`（`:53-80`）/ `listWindows`（`:97-124`）に分離。
- fake exec テスト: 3 ファイルとも `EventEmitter` ベースの `makeFakeChild()`（各 test.mjs 冒頭）で実 `powershell.exe` を一切起動せずに往復を検証している。実機は `preflight-eyes.mjs` のみが担う——ears/voice の「機械テストは無音（実プロセス不使用）・実機検証は別スクリプト」という規律と一致。

## 2. 終了処理・タイムアウト — PASS

- `runPowerShellScript` の `cleanupChild()`（`powershell-exec.mjs:101-119`）は kill → stdout/stderr/stdin destroy → unref を **1 箇所** に集約し、`finish()`（`:122-133`）内の `settled` ガード（`:84,123-124`）により正常終了・タイムアウト・spawn error のどの経路からも一度しか呼ばれない。`ffmpeg-capture.mjs` の `dispose()`（kill→stdio destroy→unref、`:194-207`）と骨格が一致し、`runPowerShellScript` はさらに `unref` 自体も `try/catch` で包む（`:114-118`）——ffmpeg-capture より一段防御的だが方向性は同じ。
- タイマ注入: `setTimeoutImpl`/`clearTimeoutImpl`/`nowImpl` がすべて注入可能（`:74-79`）。`let timer` を先に `undefined` 初期化してから代入するコメント付きの回避（`:90-93`）は、同期発火する fake タイマーが代入完了前に `clearTimeoutImpl(timer)` を呼んで TDZ ReferenceError になる実際のバグを踏んだ跡が読み取れる——テスト駆動で発見・修正された形跡として設計品質のプラス材料。
- 二重解決防止はテストで直接固定されている: `powershell-exec.test.mjs:152-168`「タイムアウト後に exit が来ても二重解決しない」。タイムアウト経路での kill も `powershell-exec.test.mjs:132-150`・`window-capture.test.mjs:186-207`・`window-list.test.mjs:107-123` の 3 層すべてで確認済み。
- 正常終了時も cleanup が走ることをテストで明示的に固定（`powershell-exec.test.mjs:104` `assert.equal(fakeChild.wasKilled(), true); // 終了処理は成功時も後始末する`）——PowerShell プロセスが自然終了していても kill を打つのは冪等な best-effort（`try{}catch{}`）なので無害。

## 3. PowerShell プロトコルの健全性 — PASS

- マーカー判定: `CAPTURE_OK`/`CAPTURE_FAIL` は 1 行目、`kind` は 2 行目のみで判定（`parseCaptureStdout` `window-capture.mjs:159,178`）。message は残り行を `join("\n")`（`:180`）——改行を含む例外メッセージでも壊れない。未知 kind は `failed` へフォールバック（`:184`、テスト `window-capture.test.mjs:80-86`）し成功に化けない。
- 白紙成功ガード: `MIN_PLAUSIBLE_BASE64_LENGTH=100`（`window-capture.mjs:46`）による形式チェックが `CAPTURE_OK` 経路でも適用され（`:166-174`）、テスト（`window-capture.test.mjs:109-115,209-218`）で固定。ドキュメント（`window-capture.mjs:43-46`、domain-a.md §2 注記）が「画素解析ではない形式的下限」と限界を自己申告している点は誠実。
- UTF-8 前置き: `withUtf8OutputPrelude` は `runPowerShellScript` 内で **一括**適用（`:80`）され、`buildCaptureScriptText`/`buildListScriptText` 自体には重複して埋め込まれていない。単一箇所への集約により「一部のスクリプトだけ前置き漏れ」という事故を構造的に防いでいる。実機で踏んだ文字化け地雷（domain-a.md §6）に対する筋の良い直り方。
- エスケープ: `escapePsSingleQuoted`（`window-capture.mjs:54-56`）は `'` → `''` のみ。シングルクォート文字列は変数展開されないため（コメントで明記・`:49-51`）これで注入耐性として十分——`$title` はエスケープ済みの単一引用符文字列に代入されるだけで、後続の比較・文字列展開（`"window not found: $title"` 等）は PowerShell 変数参照であり生テキストの再埋め込みではないため二重展開の穴もない。テスト（`window-capture.test.mjs:33-45`）で反映を確認。
- System.Drawing リソース解放: 正常系・PrintWindow 失敗系（`:112-118`）は `Dispose()` を明示的に呼んでいる。ただし例外系（`GetHdc()` 後 `ReleaseHdc()`/`Dispose()` 前に例外が飛ぶ場合、`$resized` 生成後 `$bitmap.Dispose()` 前後で例外が飛ぶ場合）は `catch` ブロック（`:137-141`）が `Dispose()` を呼ばずにメッセージだけ出力する。→ non-blocking #1（powershell.exe は 1 回起動→1 回実行→終了する使い捨てプロセスのため OS が終了時に GDI ハンドルを回収し実害はないが、明示的解放の網羅性としては穴がある）。

## 4. 既存器官との一貫性 — PASS

- 4 ファイルすべて `// @ts-check` 先頭 + JSDoc（`@param`/`@returns` 型注釈込み）+ 日本語コメントで構成され、`ffmpeg-capture.mjs`・`audio-player.mjs` と同じ「タイトル行 → 概要段落 → `── 見出し ──` 区切りのセクションコメント」の文書構造を踏襲している（`powershell-exec.mjs:1-20`・`window-capture.mjs:1-24` を `ffmpeg-capture.mjs:1-24` と比較）。
- `package.json`（`apps/soul/agent/package.json`）に typecheck スクリプトは無く、`@ts-check` は既存器官同様「エディタ支援・ドキュメント目的の慣習」の位置づけで揃っている（このドメインが新たに導入した差ではない）。
- ディレクトリ構成: `src/{channel,cli,cockpit,ears,eyes,mind,test-support,voice}` の並びに `eyes` が対等な 1 器官として追加されている。他器官への import はゼロ（§0 grep で確認）——ears/voice/mind/channel/cockpit と同格の独立性を保っている。

## 5. 設計上の弱点・改善余地

- **数値の局在**: `DEFAULT_MAX_SIDE`/`DEFAULT_JPEG_QUALITY`/`DEFAULT_CAPTURE_TIMEOUT_MS`/`MIN_PLAUSIBLE_BASE64_LENGTH` は `window-capture.mjs` に、`DEFAULT_LIST_TIMEOUT_MS` は `window-list.mjs` に、それぞれ 1 箇所ずつ集約。S4 レビューと同じ基準で PASS。
- **v0「ツマミなし」裁定との整合**: `captureWindow(title, { maxSide, jpegQuality, timeoutMs })` は options でこれらを上書き可能——UI/CLI には一切出していない（cockpit/AHK は本 Domain の範囲外で未実装）ため wave-plan §2 の「調整UIは作らない」という裁定には反していない。ただし関数シグネチャとしては将来 Domain C が安易にここへツマミを生やす余地を残す。→ non-blocking #2（現状は問題ないが、Domain C レビュー時に「UI 露出なし」を再確認する価値がある）。
- **options の値検証なし**: `maxSide`/`jpegQuality` に範囲外値（負数・101 以上等）を渡した場合の検証がコード側になく、PowerShell 側の `EncoderParameter`/`Bitmap` コンストラクタが例外を投げれば `catch` 経由で `failed` に落ちる想定（構造的には安全に倒れる）が、明示的なテストは無い。→ non-blocking #3（v0 は既定値のみ使う想定のため実害は薄い）。
- **minimized 判定の設計**: `IsIconic` を `PrintWindow` 呼び出し**前**に判定する設計（`window-capture.mjs:94-99`、domain-a.md §7-1 で Gnome 自身が「PrintWindow 自体の最小化時挙動は未検証」と申し送り済み）は、design レーンの観点からは「未検証の懸念に対する安全側の予防的分岐」として妥当な設計判断。実機検証は人間ゲートの領分であり本レビューの対象外。

---

## blocking / non-blocking

### blocking
- なし。

### non-blocking（提案・任意）
1. **System.Drawing リソース例外系の Dispose 漏れ**（`window-capture.mjs:100-141`）: `GetHdc()`〜`ReleaseHdc()`間、または `$resized` 生成後〜`$bitmap.Dispose()` 前後で例外が発生した場合、`catch` ブロックが `Dispose()` を呼ばずに終わる。powershell.exe は 1 回のスクリプト実行で終了する使い捨てプロセスのため OS が終了時にハンドルを回収し実害は無いが、`finally`（PowerShell の `try/finally`）で確実に `Dispose()` する形にすれば構造としてより堅牢。
2. **captureWindow の options が「ツマミなし」裁定に対する将来の抜け道になりうる**（`window-capture.mjs:195-197`）: 現状は UI/CLI 未接続のため裁定違反ではないが、Domain C で操縦席 UI を作る際にこの options をそのまま公開しないよう再確認する価値がある。
3. **maxSide/jpegQuality の値検証なし**（`window-capture.mjs:66-69`）: 範囲外値は PowerShell 側の例外→`failed` へ構造的に安全に倒れるが、専用テストはない。v0 は既定値のみ使う想定のため実害は薄い。

---

## 総合判定

**PASS-with-nonblocking**。純部品分離（exec 層の spawn 注入 + コマンド組み立て/stdout パースの純関数化）は `ffmpeg-capture.mjs` の `spawnImpl` パターンと一貫しており、fake exec のみで全分岐（成功/notFound/minimized/failed/timeout/白紙ガード/未知kind/JSON崩れ）がテストで固定されている。終了処理は kill→destroy→unref の一元化 + `settled` 二重解決防止ガードが機能し、タイムアウト経路の kill も 3 層のテストで確認済み。PowerShell プロトコルはマーカー1行判定+改行対応メッセージ+白紙成功ガード+UTF-8前置きの一括適用+エスケープの妥当性、いずれも根拠つきで健全。既存器官（ears/voice）とのドキュメント構造・独立性も一致。blocking 指摘なし。non-blocking 3 件（GDI 例外系 Dispose 漏れ・「ツマミなし」裁定の将来的抜け道・options 値検証欠如）はいずれも v0 の実害が薄い任意提案であり、Domain B/C・S5 全体の進行を妨げない。

`node --test` 372/372/0（自分で再実行・claim と一致）。器コード・契約 JSON・lockfile・package.json 差分ゼロ（自分で確認）。
