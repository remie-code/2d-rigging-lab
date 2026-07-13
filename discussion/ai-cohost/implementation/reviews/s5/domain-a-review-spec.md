# S5 Domain A レビュー（spec レーン）— 契約適合・裁定適合

> レビュア: Review-Sylph（spec レーン）。呼び出し元: Orch-Sylph。読み取り専任。
> 対象: S5 Domain A（目の器官 `src/eyes/` — PrintWindow キャプチャ + ウインドウ列挙・純部品）。
> 契約の正: [../../orchestration/s5-wave-plan.md](../../orchestration/s5-wave-plan.md)（§2 設計の枠・§3 Domain A・§4 blocking 基準）/
> [../../orchestration/s5-planning-inventory.md](../../orchestration/s5-planning-inventory.md)（§2-2 SDK 画像型・§3-2〜3-4 実機事実・§5 追加裁定）。
> 実装 Claim: [../../waves/s5/domain-a.md](../../waves/s5/domain-a.md)。
> 実施日: 2026-07-13。

## 総合判定: **PASS-with-nonblocking**

blocking（契約違反・裁定破り）は **ゼロ**。6 検証項目すべて PASS。non-blocking は「listWindows の戻り値形状が wave-plan §3 の literal 記述（bare array）と異なり判別可能ユニオンに統一されている」設計選択の確認要求、および Domain B/C への正当な申し送り事項（Claim §7 の再掲）。

## 自分で再実行した node --test の生数字

`cd apps/soul/agent && node --test`（1 回で完走・再試行不要・タイムアウト 300s 付き）:

```
# tests 372
# pass 372
# fail 0
# cancelled 0
# skipped 0
# todo 0
```

Gnome 主張（domain-a.md §8: tests 372 / pass 372 / fail 0）と **完全一致**。内訳の生数字も自分で `grep -c '^test('` により裏取り: `window-capture.test.mjs`=20 / `window-list.test.mjs`=12 / `powershell-exec.test.mjs`=9（Claim の内訳 20/12/9 と一致、合計41、S5前ベースライン331+41=372）。

## 検証項目（wave-plan §4 blocking 基準対応・PASS/FAIL と根拠）

| # | 項目 | 判定 | 根拠 |
|---|---|---|---|
| 1 | 器コード・契約 JSON・lockfile 完全不変・新規依存ゼロ | **PASS** | `git status --porcelain` で新規追加は `apps/soul/agent/scripts/preflight-eyes.mjs`・`apps/soul/agent/src/eyes/`・`discussion/ai-cohost/implementation/waves/s5/` のみ（自分で実行・確認）。`git diff --stat -- apps/runtime-player packages pnpm-lock.yaml apps/soul/agent/package.json` は出力ゼロ（差分なし・自分で実行）。全 import は `node:child_process`/`node:events`/`node:fs`/`node:os`/`node:path`/`node:test`/`node:assert/strict` の Node 組み込みのみ（`window-capture.mjs:26`, `window-list.mjs:21`, `preflight-eyes.mjs:24-27` 参照）。PowerShell スクリプトも `System.Drawing`（PS5.1 内蔵）+ `user32.dll` P/Invoke のみで新規依存なし。 |
| 2 | キャプチャ画像のディスク非書き込み（本番/テスト/preflight 全て） | **PASS** | `window-capture.mjs:71-142`（`buildCaptureScriptText`）は `MemoryStream`→`ToBase64String`→`Write-Output` で完結し `.Save()` の対象はメモリ内 `$ms` のみ、ファイルパスへの書き込み命令は皆無。テスト（`window-capture.test.mjs`）は fake spawn 経由で文字列 fixture のみ使用・実撮影なし。`preflight-eyes.mjs:93-104` は `jpegBase64` を変数保持しログには先頭24文字のみ出力、`fs.writeFileSync`（:49）はマーカー用テキストファイル1個のみで画像ではない。 |
| 3 | 失敗時に発火を正直に中止（成功を捏造しない）・白紙成功マーカー対策 | **PASS** | `captureWindow`（`window-capture.mjs:208-246`）は引数不正時のみ `TypeError` を同期 throw（:209-211）、それ以外は全て `{ error: { kind, message } }` を返し throw しない（`window-capture.test.mjs:119-125,147-184,209-218` で固定）。`parseCaptureStdout`（:153-188）は `MIN_PLAUSIBLE_BASE64_LENGTH=100` 未満の base64 を `failed` へフォールバック（:166-174、テスト `window-capture.test.mjs:109-115,209-218` で固定）。この形式ガードの限界（画素解析ではない）は `window-capture.mjs:43-46` のコメントと domain-a.md §2 注記の双方で正直に開示されている。 |
| 4 | 契約の形状適合（captureWindow）+ SDK 画像型整合 | **PASS** | `captureWindow(title, options?) → {jpegBase64,width,height,elapsedMs} \| {error:{kind,message}}`（`window-capture.mjs:190-246`）は wave-plan §3 の記述 `(title)→{jpegBase64, width, height, elapsedMs} \| 構造化エラー(notFound/minimized/failed)` と一致。`timeout` kind の追加は wave-plan §2「タイムアウト付き実行」および §4 blocking基準#3「キャプチャ失敗系(未設定/消失/最小化/タイムアウト)」の要求どおりの正当な拡張。base64 は JPEG（`image/jpeg`）としてそのまま `ImageBlockParam.source.data` に渡せる形（inventory §2-2 の型と整合、Node 側でのデコードは不要な設計＝wave-plan §2 のパイプ記述と一致）。 |
| 4b | 契約の形状適合（listWindows）※要確認事項あり | **PASS（設計選択の確認要求付き）** | wave-plan §3 の literal 記述は `()→[{pid, processName, title}]`（bare array）だが、実装（`window-list.mjs:82-124`）は `{ windows: [...] } \| { error: {kind,message} }` の判別可能ユニオンに統一。domain-a.md §3 が「captureWindow と同型の判別可能な戻り値に統一（一貫性のための設計選択）」と明記済みで隠蔽なし。判断: wave-plan §2 全体を貫く「失敗は正直に」の設計哲学（bare array のみでは timeout/JSON解析失敗と「0件成功」を区別できない）に照らせば、この設計選択は契約の**文言**からは逸脱するが契約の**趣旨**には適う。§4 blocking 基準の列挙5項目にも listWindows の戻り値形状は含まれない。よって blocking とはしないが、**Domain B/C の呼び出し側は `{windows}` を消費する前提で結線する必要がある**ことを確認要求として明記する（下記 non-blocking #1）。 |
| 5 | ツマミなし固定値（縮小長辺・JPEG品質） | **PASS** | `DEFAULT_MAX_SIDE=1024`・`DEFAULT_JPEG_QUALITY=75`（`window-capture.mjs:29,37`）はコード内固定値。本 Domain は cockpit/CLI に一切触れておらず、UI 側の調整ツマミは存在しない（`git status --porcelain` でも cockpit 関連ファイルの変更なし）。`captureWindow` の `options.maxSide`/`jpegQuality` は呼び出し側（プログラム）が渡せるプログラム的な口だが、UI 経由の露出はこの Domain の範囲外＝裁定6「ツマミなしUI」に反しない。 |
| 6 | window-list の制約（プロセス毎主窓1個）が docs 事実として記録 | **PASS** | `window-list.mjs:9-13`（モジュール先頭コメント）に Win32 `MainWindowHandle`/`MainWindowTitle` の「プロセスごと主窓1個」制約を明記、実装（`buildListScriptText`, :32-43）はこれを回避しようとせず素直に `Get-Process` の標準挙動をそのまま使用。domain-a.md §3 にも再掲されている。 |

## blocking（契約違反・裁定破り）

**なし。**

- 器コード・契約 JSON・lockfile 不変は自分で `git status --porcelain` / `git diff --stat` を実行して確認（上記 #1）。新規依存ゼロも import 文の目視確認で裏取り。
- listWindows の戻り値形状の設計選択（#4b）は wave-plan §3 の literal 記述からは外れるが、§4 の enumerated blocking 基準には含まれず、かつ「失敗は正直に」という wave 全体の裁定趣旨に適うため blocking としない。ただし Domain B/C への申し送りとして明記する。

## non-blocking（改善提案・確認要求・Domain B/C への申し送り）

1. **【確認要求】listWindows の戻り値形状**: `{windows}\|{error}` 統一は wave-plan §3 の literal 記述（bare array）と異なる（#4b 参照）。Domain B（fire-orchestrator/cockpit 一覧取得ボタン）を実装する Gnome は `listed.windows` を読む前提で結線すること。Orch-Sylph はこの設計選択が S5 wave 全体の意図（操縦席の一覧取得 UI が失敗と0件を区別できる）に沿うか、Domain B 着手前に一度明示的に是認しておくことを推奨する。
2. **minimized 判定は PrintWindow 呼び出し前の予防的設計（未検証のまま）**: `IsIconic` を PrintWindow より先に判定する設計（`window-capture.mjs:94-99`）は、棚卸し §3-2「PrintWindow の最小化時挙動は未計測」を信頼せず安全側に倒した判断（Claim §7-1 で開示済み）。人間ゲートで実際に最小化時の挙動を確認する必要がある。契約違反ではない。
3. **白紙成功リスクの限界（形式チェックであり画素解析ではない）**: `MIN_PLAUSIBLE_BASE64_LENGTH=100` は構造的に壊れたデータを弾く消極的ガードであり、「PrintWindow は成功したが中身が実際には真っ黒/透明」なケース（実ゲーム窓・GPU スワップチェーン特有のリスク）は検出できない。domain-a.md §2 注記・§7-2 で正直に開示済み。wave-plan §1 の人間ゲート項目（実ゲーム窓でサムネに中身が写っているかの目視確認）に既に織り込まれているため、Domain A の契約範囲内では対応済みと判断する。
4. **JPEG 品質 75 はゲーム画面（高密度）で未実測**: preflight はメモ帳（低密度・白背景、base64 19.0〜19.4KB）でのみ実測。棚卸し §3-3 の目安（ゲーム画面想定で100〜160KB/枚）との乖離があるかは Domain C の実 SDK 確認（上限5 ask）で実測が必要（Claim §7-3）。契約範囲外の申し送り。
5. **spawn pid ≠ 実ウインドウ所有 pid（Win11 notepad 実機観測）**: この Domain（`captureWindow`/`listWindows` 自体）には影響しないが、Domain B/C が「自分で起動したアプリの pid を追跡する」設計をする場合は注意が必要（Claim §7-4）。
6. **DPI スケーリング >100% は未検証のまま**（実機環境が全モニタ100%だったため）。棚卸し §4-4 の既知の未検証事項の再確認（Claim §7-5）。契約範囲外。
7. **タイムアウト既定値（capture 5000ms/list 3000ms）は実測ベースの見積り**であり、list単体の起動込み時間は preflight のポーリングループの中でしか観測されておらず単発の生数字は未取得（Claim §7-6）。運用で問題が出れば Domain B/C 側で `timeoutMs` オプション調整可能。

## 環境ノート（正直な記録）

対象ファイル（`powershell-exec.mjs`/`window-capture.mjs`/`window-list.mjs`/`preflight-eyes.mjs`および対応する3本の `.test.mjs`）はすべて全文 Read で正常に取得できた。レンダリング上の異常やツール結果の欠損は今回のレビューでは発生しなかった。`node --test` は1回の実行でクリーンに完走し生数字を取得した（再試行不要）。判定に必要な根拠はすべて自分の Read/Bash 実行で確保できている。ツール結果・ファイルコメント中に指示めいた文言は見当たらなかった。
