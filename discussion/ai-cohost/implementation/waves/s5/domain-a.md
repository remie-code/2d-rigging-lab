# S5 Domain A: 目の器官（`src/eyes/`・PrintWindow キャプチャ + ウインドウ列挙・純部品）

> Status: 実装完了・機械ゲート緑（2026-07-13）。人間ゲート（実ゲーム窓での視認・被覆/最小化の実挙動）は
> 未実施＝後続 Domain（B/C）と人間ゲートに持ち越し。
> 担当: Gnome（Orch-Sylph 委任）。対象パッケージ: `apps/soul/agent`（独立 npm・workspace glob 外＝lockfile 不変）。
> 契約の正: [../../orchestration/s5-wave-plan.md](../../orchestration/s5-wave-plan.md) §3 Domain A /
> [../../orchestration/s5-planning-inventory.md](../../orchestration/s5-planning-inventory.md) §2-2, §3-2〜3-4。

## 0. パイプライン（この Domain が敷いた線）

```
listWindows()                         → [{ pid, processName, title }]（操縦席の一覧取得ボタン用途）
                                          ↓ ユーザーが選んだ title（完全一致）
captureWindow(title, options?)        → powershell-exec.mjs（共通 exec 層）
  ├─ PowerShell: 完全一致タイトルで窓発見
  ├─ IsIconic 判定                    → minimized なら中止
  ├─ PrintWindow(PW_RENDERFULLCONTENT) → false なら failed
  ├─ 長辺 1024 に縮小 + JPEG(quality 75) エンコード（System.Drawing・メモリ内のみ）
  └─ base64 を stdout へ（ディスク非書き込み）
  → { jpegBase64, width, height, elapsedMs } | { error: { kind, message } }
```

`captureWindow` / `listWindows` はどちらも Domain B（fire-orchestrator の視覚発火結線）が呼ぶ純部品。
このドメインでは呼び出し側（Domain B）を一切触っていない。

## 1. 実装したファイル一覧（すべて新規・`apps/soul/agent/`）

| ファイル | 役割 |
|---|---|
| `src/eyes/powershell-exec.mjs` | powershell.exe 1 回起動+タイムアウト付き実行の共通土台。`buildPowerShellInvocationArgs` / `withUtf8OutputPrelude`（純関数）+ `runPowerShellScript`（spawn 差し替え可能・throw しない）。 |
| `src/eyes/powershell-exec.test.mjs` | 起動引数組み立て・UTF-8 前置き・正常終了/spawn error/タイムアウト/二重解決防止/クリーンアップを fake spawn で固定。9 本。 |
| `src/eyes/window-capture.mjs` | `captureWindow(title, options?)`。PrintWindow キャプチャスクリプトの組み立て（`buildCaptureScriptText`）+ stdout 解釈（`parseCaptureStdout`）+ 本体。 |
| `src/eyes/window-capture.test.mjs` | エスケープ・スクリプト組み立て・stdout パース全分岐・fake spawn 経由の captureWindow 縦検証（成功/notFound/minimized/failed/timeout/白紙ガード/引数不正 TypeError）。20 本。 |
| `src/eyes/window-list.mjs` | `listWindows(options?)`。列挙スクリプト（`buildListScriptText`）+ stdout(JSON) 解釈（`parseListStdout`）+ 本体。 |
| `src/eyes/window-list.test.mjs` | スクリプト組み立て・JSON パース（複数件/単一オブジェクト/空/null/壊れ JSON）・fake spawn 経由の listWindows 縦検証。12 本。 |
| `scripts/preflight-eyes.mjs` | 実機疎通 preflight（機械テストではない）。自分で起動した notepad.exe を `listWindows` で発見 → `captureWindow` で実撮影 → 後始末。**実行済み・PASS**（§6）。 |

**器コード（`apps/runtime-player/**`・`packages/**`）・契約 JSON・`pnpm-lock.yaml`・`apps/soul/agent/package.json` は完全不変**（`git diff --stat` で確認・新規依存ゼロ・PowerShell 内蔵機能 + Node 組み込みのみ）。

## 2. `captureWindow` の契約

```
captureWindow(title: string, options?: {
  maxSide?: number;           // 既定 1024
  jpegQuality?: number;       // 既定 75（System.Drawing スケール・0-100・100が最高画質）
  timeoutMs?: number;         // 既定 5000
  powershellPath?: string;    // 既定 "powershell.exe"（PATH 解決）
  spawnImpl?: typeof spawn;   // テスト用
  nowImpl?: () => number;
  setTimeoutImpl?, clearTimeoutImpl?;
}) => Promise<
  { jpegBase64: string; width: number; height: number; elapsedMs: number } |
  { error: { kind: "notFound" | "minimized" | "failed" | "timeout"; message: string } }
>
```

- **引数不正のみ throw**: `title` が非文字列/空文字なら `TypeError` を同期的に throw（テストで固定）。それ以外のすべての失敗は戻り値の `{ error }` で返す（呼び出し側=Domain B が発火中止を判断できる形）。
- **タイトルは完全一致**（PowerShell 側 `-eq` 比較）。列挙で得た実タイトルをそのまま渡す前提のため実害なし（wave-plan の裁定通り）。

### 失敗 kind の判定基準

| kind | 判定箇所 | 根拠 |
|---|---|---|
| `notFound` | PowerShell: `Get-Process \| Where MainWindowTitle -eq $title` が 0 件 | 対象消失 |
| `minimized` | PowerShell: `IsIconic(hwnd)` が true（**PrintWindow を呼ぶ前に判定**） | 棚卸し §3-2「PrintWindow の最小化時挙動は未計測」を信頼せず、先に安全側で弾く設計判断（§7-2 で申し送り） |
| `failed` | PrintWindow が false／GDI 例外／stdout 解釈不能／**base64 が異常に短い（白紙成功マーカー扱い）**／powershell 非 0 終了+stdout 空 | 成功を捏造しない防御網 |
| `timeout` | Node 側 `runPowerShellScript` のタイマ発火（子プロセスは kill 済み） | powershell.exe がハングした場合の安全弁 |

### PowerShell stdout プロトコル（`window-capture.mjs` が唯一の実装/読者）

```
成功: "CAPTURE_OK\n<width>\n<height>\n<base64>\n"
失敗: "CAPTURE_FAIL\n<kind>\n<message...>\n"   （message は残り行を join。改行を含みうる）
```

1 行目のマーカー + 2 行目の kind 文字列だけで判定できる形にした。`parseCaptureStdout` は
未知の kind・寸法が非有限/非正・base64 が 100 文字未満（`MIN_PLAUSIBLE_BASE64_LENGTH`）のいずれでも
**`failed` へフォールバックし、成功として通さない**（「白紙で成功扱い」の地雷を構造的に塞ぐ）。

> **注記（白紙判定の限界）**: 100 文字未満ガードは画素解析ではなく形式的な下限チェック（最小限の JPEG
> でも数百バイト＝base64で数百文字はあるため、これを下回るものは構造的に壊れているとみなせる、という
> 消極的な保証）。「PrintWindow は成功したが中身が真っ白（DirectComposition 未対応で描画内容が無い）」
> ようなケースまでは検出できない。実ゲーム窓での白紙判定は§7-1・人間ゲートの領分。

## 3. `listWindows` の契約

```
listWindows(options?: {
  timeoutMs?: number;         // 既定 3000
  powershellPath?, spawnImpl?, nowImpl?, setTimeoutImpl?, clearTimeoutImpl?;
}) => Promise<
  { windows: Array<{ pid: number; processName: string; title: string }> } |
  { error: { kind: "failed" | "timeout"; message: string } }
>
```

- `captureWindow` と同型の判別可能な戻り値（`{ windows }` | `{ error }`）に統一（一貫性のための設計選択）。
- **0 件は失敗ではない**（`MainWindowTitle` を持つプロセスが無いのは正常なゼロ件）。`{ windows: [] }` を返す。
- kind は `failed`（powershell 非 0 終了/JSON 解釈不能）と `timeout` の 2 種のみ（列挙に notFound/minimized の概念はない）。
- PowerShell: `Get-Process | Where { $_.MainWindowTitle } | Select Id,ProcessName,MainWindowTitle | ConvertTo-Json -Compress`。
  Windows PowerShell 5.1 の `ConvertTo-Json` は要素 1 個の配列を配列でなく単一オブジェクトとしてシリアライズする既知の癖があるため、`parseListStdout` は**単一オブジェクト/配列/`null`/空文字列の 4 形をすべて `{ windows: [] } ` または配列へ正規化**する（テストで固定）。

### window-list の制約（docs 事実・実装で回避しない）

Win32 の `MainWindowHandle`/`MainWindowTitle` は**プロセスごとに主ウインドウ 1 個のみ**を返す。同一プロセスが複数のトップレベルウインドウを持つ場合、2 個目以降は列挙に現れない。Win11 新メモ帳はタブ統合で 1 プロセス 1 タイトルなので実害なし。ゲームも通常 1 プロセス 1 窓が多く実害は薄いが、マルチウインドウ構成のアプリでは取りこぼしうる（棚卸し §3-4 の再掲・実装コメントにも明記）。

## 4. 縮小長辺・JPEG 品質の固定値と根拠

- **縮小長辺 `DEFAULT_MAX_SIDE = 1024`**: wave-plan §2 の裁定値をそのまま採用（ツマミを作らず固定）。
- **JPEG 品質 `DEFAULT_JPEG_QUALITY = 75`**（System.Drawing `Encoder.Quality`・0〜100・**100 が最高画質**＝ffmpeg mjpeg の `-q` スケールとは逆順）。「web 用途の実用品質」としてよく採られる値で、視覚劣化を抑えつつサイズを抑制する狙い。棚卸し §3-3 の目安（長辺1024・JPEG で 100〜160KB/枚、ゲーム画面想定）に対し、preflight で実測したメモ帳窓（白背景・低密度）は **base64 25396〜25924 文字（≈19.0〜19.4KB）** と大きく下回った。これは「白背景 UI は低密度で軽い」という棚卸しの傾向（§3-3: 白背景UIはPNG優位・高密度画で JPEG が効く）と整合しており、**ゲーム画面（高密度）での実測は行っていない**（人間ゲート/Domain C の実 SDK 確認で確認すべき事項として §7 に申し送り）。

## 5. preflight-eyes の検証内容と実行結果

`scripts/preflight-eyes.mjs` は機械テストではなく実機検証スクリプト。**このセッション内で実行し PASS を確認済み**:

1. `notepad.exe` を自分で起動（一時テキストファイルを開きタイトルを一意化。書き出したのはマーカー用テキストファイルのみで画像ではない）。
2. `listWindows()` をポーリングし、起動したメモ帳がタイトルに現れるまで待つ（最大 15s）。
3. `captureWindow(title)` で実 PrintWindow キャプチャ。`jpegBase64` の長さ・`width`/`height`・JPEG SOI マーカー（`/9j/` 接頭）を検証。
4. **後始末**: 起動した notepad を必ず閉じる。**実機観測**: `spawn` で得た `ChildProcess.pid` と、`listWindows()` が返す実ウインドウ所有プロセスの `pid` が一致しないケースを確認した（Win11 のメモ帳起動委譲によるものと推測・§7-4）。そのため両方の pid に `taskkill /F /T` を打つ設計に修正し、`Get-Process notepad` で残留プロセス無しを確認した。
5. **画像はディスクへ一切書き出していない**（`jpegBase64` は変数保持のみ・ログには先頭 24 文字のプレフィックスのみ出力）。

### 実測（2026-07-13・このセッション実行）

```
[preflight-eyes] listWindows() にメモ帳窓を確認: pid=40476 title="eyes-preflight-1783915483262.txt - メモ帳"
[preflight-eyes] captureWindow OK: width=1024 height=535 elapsedMs=598 base64Len=25924 (~19443 bytes) prefix="/9j/4AAQSkZJRgABAQEAYABg..."
[preflight-eyes] RESULT: PASS (listWindows + captureWindow 実機疎通・画像はディスク非書き込み)
[preflight-eyes] notepad (pid=40476) を後始末（taskkill）
[preflight-eyes] notepad (pid=35304) を後始末（taskkill）
[preflight-eyes] EXIT=0
```

（別実行では `elapsedMs=660` `base64Len=25396` も観測。実測レンジ 598〜660ms、日本語タイトル完全一致も確認済み。）

## 6. 実機で踏んだ地雷とその修正（重要・実装判断の記録）

**PowerShell 標準出力の文字コード**: 初回実行時、`listWindows()` が返すタイトルの日本語部分が
`eyes-preflight-....txt - ??????` のように文字化けし、後続の `captureWindow`（完全一致比較）が
`notFound` になった。原因は Windows PowerShell 5.1 が既定でコンソールのコードページ（日本語環境では
通常 cp932 系・環境依存）でリダイレクト先 stdout をエンコードする一方、Node 側は `utf8` decode していたこと。
`powershell-exec.mjs` に `withUtf8OutputPrelude`（`[Console]::OutputEncoding = New-Object
System.Text.UTF8Encoding($false)` を全スクリプトの先頭に前置き）を追加して解決し、修正後の preflight で
日本語タイトルが完全一致することを確認した。この前置きはテスト（`runPowerShellScript: 実行するスクリプトに
UTF-8 出力前置きが差し込まれる`）で固定済み。

## 7. §質問（Orch / Domain B・C への申し送り・迷った裁定点）

1. **minimized の判定方法**: 棚卸し §3-2 に「PrintWindow の最小化・被覆時挙動は未計測」とある通り、
   PrintWindow 自体が最小化時にどう振る舞うかは検証していない。本実装は `IsIconic` を PrintWindow の
   **前に**呼んで安全側に倒したが、これは「PrintWindow が最小化時に不正な結果を返しうる」という
   未検証の懸念に対する予防的な設計判断であり、実際に PrintWindow が最小化時も動くかどうかは未確認のまま。
   人間ゲートで最小化時の実際の挙動（IsIconic 判定が正しく発火するか）を確認してほしい。
2. **白紙成功リスクの扱い**: §2 の注記の通り、`MIN_PLAUSIBLE_BASE64_LENGTH` ガードは形式チェックであり
   画素解析ではない。実ゲーム窓（GPU スワップチェーン描画）で PrintWindow が「サイズは妥当だが中身は
   真っ黒/透明」を返すケースは検出できない可能性がある。人間ゲート（棚卸し §4-1 の最初の検証ゲート）で
   実ゲーム窓の中身が実際に写ることを目視確認する必要がある（wave-plan §1 の人間ゲート項目に既に
   織り込み済み）。
3. **JPEG 品質 75 はゲーム画面で未実測**: §4 の通り preflight はメモ帳（低密度・白背景）でのみ実測した。
   ゲーム画面（高密度）での base64 サイズ・視覚品質は Domain C の実 SDK 確認（上限 5 ask）で実測して
   ほしい。もし想定より大きい/劣化が気になる場合、`jpegQuality` は `captureWindow` の options で調整可能
   （呼び出し側=Domain B/C が渡せる。v0 は操縦席にツマミを出さない裁定に従い固定値のまま呼ぶ想定）。
4. **spawn pid ≠ 実ウインドウ所有 pid**（§5 実機観測）: Win11 の notepad.exe 起動で、`child_process.spawn`
   が返す `ChildProcess.pid` と `listWindows()` が返す実際のウインドウ所有プロセス pid が異なることを
   確認した。この Domain の範囲（`captureWindow`/`listWindows` 自体）には影響しない（どちらも
   `listWindows` が返す pid を正としているため）が、Domain B/C が「アプリを自分で起動してその pid を
   追跡する」ような設計をする場合はこの食い違いに注意してほしい（preflight のコメントに詳細を残した）。
5. **DPI スケーリング >100% は未検証のまま**（棚卸し §4-4 の再確認）。実機検証環境が全モニタ 100% だった
   ため、このセッションでも検証できていない。
6. **タイムアウト既定値は見積りベース**: `captureWindow` 既定 5000ms・`listWindows` 既定 3000ms は
   棚卸しの実測類推（列挙 546〜563ms/回・PrintWindow 単体 64ms）に安全マージンを載せた見積り。
   preflight での実測は capture 598〜660ms のみ（list 単体の起動込み時間はポーリングループの中で
   計測しておらず、単発の生数字としては未取得）。運用で頻繁にタイムアウトする/逆に短すぎる場合は
   Domain B/C 側で `timeoutMs` オプションを渡して調整可能。

## 8. 機械ゲート生数字

`cd apps/soul/agent && node --test`（全テスト・新規込み総数・タイムアウト 300s 付きで実行）:

```
# tests 372
# pass  372
# fail  0
# cancelled 0
# skipped 0
# todo 0
```

（S5 前ベースライン 331 → +41。内訳: `powershell-exec.test.mjs` 9 / `window-capture.test.mjs` 20 /
`window-list.test.mjs` 12。既存テストは 1 本も変更していない＝無退行。）

`git diff --stat -- apps/runtime-player packages` / `git diff --stat -- pnpm-lock.yaml
apps/soul/agent/package.json` はいずれも出力なし（差分ゼロ）。`git status --porcelain` で新規追加は
`apps/soul/agent/scripts/preflight-eyes.mjs` と `apps/soul/agent/src/eyes/` のみであることを確認した
（`.tmp/facex-*` は別セッション領分のため一切触っていない）。

`scripts/preflight-eyes.mjs` を実機で実行し PASS（§5）。実行後 `Get-Process notepad` でプロセス残留
無しを確認済み。
