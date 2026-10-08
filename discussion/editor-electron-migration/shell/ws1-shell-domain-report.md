# WS1 shell / Domain A 完了報告

> 状態: **完了 / pass**(2026-07-08)。実機観測ゲート緑(ユーザー確認)。
> 権威計画: [ws1-shell-plan.md](ws1-shell-plan.md)。写経元: apps/runtime-player。closeout 検証: [ws1-shell-review.md](ws1-shell-review.md)。

## 0. 完了サマリ

既存 renderer を無改造で Electron 殻に配線。`electron-vite build` 緑(renderer 2314 modules 変換成功)、新設 shell テスト緑、実機 smoke 緑(単窓起動・パラメータスライダーで drawable 変形・ワークスペース保存/ロード動作、ユーザー確認)。**de-risk 実証: 既存 renderer は Electron で無改造に載る。**

## 1. 実装内容(Domain A: shell)

apps/editor に Electron 殻を新設し、既存 renderer を electron-vite の renderer として**無改造**で配線。単窓・IPC なし・security 姿勢入り。runtime-player の多窓構成を単窓に簡約して写経。

### 新規作成
| Path | 要点 |
|---|---|
| `apps/editor/electron.vite.config.ts` | main/preload/renderer の3ブロック。`renderer.root = packageRoot`(ルート index.html 温存)、単一エントリ。既存 `vite.config.ts` の `define.global` / `optimizeDeps` / `plugins:[react(),tailwindcss()]` を移植。main は workspace パッケージを import しないため `externalizeDeps` 無し。 |
| `apps/editor/src/main/main.ts` | 薄い起動。`startEditorMain()` を呼ぶだけ。 |
| `apps/editor/src/main/editor-main.ts` | orchestration。`app.whenReady → createEditorWindow → loadEditorWindow`、`window-all-closed`(非 darwin で quit)、`activate`。状態管理・tray・IPC 無し。 |
| `apps/editor/src/main/window-management/editor-window-options.ts` | pure 関数。security 姿勢の所在: `nodeIntegration:false` / `contextIsolation:true` / `sandbox:false`。既定 1280x800 / min 960x600。 |
| `apps/editor/src/main/window-management/renderer-entry.ts` | preload/html パス解決、dev URL 出し分け。 |
| `apps/editor/src/main/window-management/editor-window.ts` | `createEditorWindow()`(ready-to-show で show)+ `loadEditorWindow()`(dev url / prod loadFile)。 |
| `apps/editor/src/preload/preload.ts` | 最小(`export {}` のみ。IPC なし)。 |
| `apps/editor/src/editor-shell-boundary.test.ts` | boundary-guard。renderer プロダクションが `electron` / `node:` / `ipcRenderer` / `BrowserWindow` を import しないことを assert。 |
| `apps/editor/src/main/window-management/editor-window-options.test.ts` | security 姿勢・既定値・単一 entry 解決の pure-logic unit test。 |
| `apps/editor/vitest.config.ts` | runtime-player 同型(`include:["src/**/*.test.ts"]`)。 |
| `apps/editor/.gitignore` | `out/` を無視(新規)。 |

### 変更(非破壊)
| Path | 要点 |
|---|---|
| `apps/editor/package.json` | 既存 scripts 温存。追加: `electron:dev/build/preview` / `test` / `test:unit`、`"main":"./out/main/main.js"`。devDeps 追加: `electron@^42.4.1` / `electron-vite@^5.0.0` / `@types/node@22.15.29`(root/runtime-player に一致)。 |
| `apps/editor/tsconfig.json` | `types` に `node`/`vitest` 追加、`include` に config 2ファイル追加(additive・非破壊)。 |

`git diff --stat`: 上記のみ。**renderer アプリコード(`src/app/**`, `src/main.tsx`, `src/styles/**`, `src/workspace/**`)は1バイトも変更なし**(Undine 独立確認)。

## 2. 自動ゲート結果(Undine L0 が install 後に取り直し)

- `node scripts/check-source-organization.mjs` → **passed**
- `git diff --check` → clean(LF→CRLF info warning のみ)
- 新設 shell テスト(`vitest run -c vitest.config.ts`)→ `editor-shell-boundary`(2)+ `editor-window-options`(4)**全緑**
- **`electron:build`(electron-vite build)→ 緑**: main 2.25kB / preload 空チャンク(想定通り)/ **renderer 2314 modules 変換成功**(index.html + css + js 出力)。**核心 de-risk の実証。**
- **`typecheck`(tsc)→ 赤、ただし 100% 先在**: エラーは全て `src/features/**`・`src/workspace/**`(renderer/test)。**WS1 ファイルにエラーゼロ**。`git diff HEAD -- apps/editor/tsconfig.json` により WS1 は `src` 網羅も strictness も不変 = renderer 無改造ゆえ先在確定。§5 で別タスク化。

## 3. 実機観測ゲート(手動 smoke)→ pass

ユーザーが `pnpm --filter @private-2d-rigging-lab/editor run electron:dev` を実行し観測:
- Electron 窓が開く ✓
- パラメータスライダーで drawable が変形(評価/描画パイプライン動作)✓
- 既存ワークスペースの保存・ロード ✓(FS Access 経由 → 永続化 WS1 未タッチの実証)
→ ユーザー判定「大丈夫」。

## 4. 逸脱(承認済み)

- **tsconfig.json 変更**: Undine 承認済み(必要逸脱、additive・非破壊)。Review 確認: runtime-player と同じ単一 tsconfig パターンで整合(分割不要)。
- **.gitignore 新規作成**: editor に不在だったため新規(out/ 無視)。

## 5. Residual risks / 別タスク

- **先在の型/テスト債務(WS1 スコープ外)**: editor の `typecheck` は元から赤(renderer/test に型エラー多数、プロダクション .tsx 含む)、`test:unit` に先在4件失敗(`diagnostics-jump-actions.test.ts`)。WS1 が敷いたゲートで露見しただけで原因ではない。→ 別タスク `task_c8fc5155` に切り出し済み。**WS1 の完了判定はこれらを含めない**(緩和側: build 緑 + shell テスト緑 + 新規エラーゼロ + 実機 smoke 緑)。
- 非ブロッキング: preload 空モジュールは electron-vite build で空チャンク出力を確認済み(問題なし)。

## 6. プロセス注記(透明性)

Orch-Sylph は判定 pass を返した直後に API 異常終了(response stalled mid-stream)し、finalize が未完だった(review 未作成・本報告 INTERIM・_map 未更新)。かつ Orch の「gates 再実行済み」主張は不完全(typecheck 未実行だった)。よって **Undine(L0)が自動ゲートを取り直し**(build/tests 緑、typecheck 赤=先在確定)、**ユーザーが実機 smoke を実施**して、検証済みの事実に基づき pass 判定とした。

## 7. 次

WS1 クローズ。次は WS2(永続化 node:fs/IPC 化)の設計。着手前に save-plan の atomicity 契約(authoring-core が `createWritable` に依存する範囲)を確認。
