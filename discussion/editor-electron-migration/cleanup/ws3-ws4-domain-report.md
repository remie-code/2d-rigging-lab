# WS3+WS4 domain report: Web 退役 + E2E `_electron` 化

> Orch-Sylph 主管の cleanup ドメイン 1 ループ実装報告。権威: [ws3-ws4-plan.md](ws3-ws4-plan.md)。
> 実装 = Gnome(opus)、レビュー = Review-Sylph(opus, clean-context)。判定 = **approve-with-nits**([ws3-ws4-review.md](ws3-ws4-review.md))。

## 1. 実装サマリ(計画 §5 に忠実)

### WS4(E2E `_electron` 化)
- `apps/editor/playwright.config.ts`: `use.baseURL` と `webServer` ブロックを除去。`testDir`/`timeout`(90000)/`expect.timeout`(30000)は残置。
- `apps/editor/e2e/psd-import.e2e.spec.ts`: `_electron` 駆動へ移行。
  - `base.extend<{ page: Page }>` で `page` fixture を上書き。`_electron.launch({ args: [mainEntryPath], env: createElectronLaunchEnv() })` → `firstWindow()` で `page` 取得 → `finally { app.close() }` で teardown。**テストごとに fresh app** を得るため状態分離を維持。
  - `mainEntryPath = path.resolve(e2eDir, "../out/main/main.js")`(package.json `"main": "./out/main/main.js"` と整合)。
  - `createElectronLaunchEnv()` は `process.env` から **`ELECTRON_RENDERER_URL` を除外**。未設定により main は `renderer-entry.ts`/`editor-window.ts` の分岐でビルド済み `out/renderer/index.html` を `loadFile` する(= web サーバ不要)。
  - `page.goto("/")` を 2 箇所(冒頭テスト + helper `importFixturePsd`)とも除去し、UI 可視待ち(`Authoring Workspace` テキスト / `Import PSD` ボタン可視)に置換。`setInputFiles` は不変。
- `apps/editor/e2e/portable-project-save-load.e2e.spec.ts`: **完全削除**(portable 廃止 + web goto 依存)。
- `apps/editor/package.json` の `test:e2e:psd-import`: `"pnpm run electron:build && playwright test -c playwright.config.ts"` へ repoint(**build 前段**で out/ 生成を担保。globalSetup ではなく script 前段方式)。

### WS3(web 退役)
- `apps/editor/package.json`: `dev`/`build`/`preview`(vite 系)を削除。`typecheck`/`test`/`test:unit`/`electron:*`/`test:e2e:psd-import` は残置。緑ゲートは `electron:build` に一本化(計画 §2)。
- `apps/editor/vite.config.ts`: 削除。`tsconfig.json` の include からも除去。repo 全体で `vite.config` 実参照ゼロを確認。`electron.vite.config.ts` は非依存のまま無傷。

### WS3(portable 除去・editor feature 層のみ)
- 削除: `src/features/project-storage/model/{browser-portable-project-transfer,editor-project-storage,editor-project-storage.test,project-storage-state}.ts`、`src/workspace/project-storage/project-storage-screen.{tsx,test.ts}`。
- `src/workspace/app-bar.tsx`: portable UI(Export/Import ボタン・input)、`createOpenProjectFileChangeHandler`、`openProjectInputRef`、`projectStorage` destructure、関連 props/配線を除去。`storageBusy` を `isWorkspaceStorageBusy(workspaceStorage)` に単純化。**workspace 保存/開く(WS2 node:fs)経路は無傷**(Save/Open/Create Workspace 配線保持)。
- `src/features/editor-session/editor-session-context.tsx`: portable import、`exportPortableProject`/`openProjectFromPortableBundle`/`openProjectFile`、`projectStorage` state、context 型/値の `projectStorage`/`projectIdentityLabel`/`projectSaveStatusLabel` を除去。
- モック修正 5 件: `app-bar.test.ts`、`atlas/texture-atlas-task-screen.test.ts`、`diagnostics/diagnostics-screen.test.ts`、`viewer/viewer-runtime-screen.test.ts`、`runtime-export/runtime-export-task-screen.test.ts`。

### 計画スコープ外だった必須補完(2 件・Review D で妥当と裁定)
- `src/features/editor-session/editor-session-context-history.test.ts`: 実 provider を render し削除済みメンバ(`openProjectFromPortableBundle`/`projectStorage`/`projectSaveStatusLabel`)を使用。**portable 専用テスト 5 件を削除**(import-cancel / bundle-load / invalid-bundle / missing-payload / digest-mismatch)、legit な workspace-save テストのラベル参照を `projectSaveStatusLabel`→`workspaceSaveStatusLabel`(値等価と確認)に付替、未使用 import を除去。生きた `saveProject` フローのカバレッジは残置。
- `src/workspace/authoring-workspace.test.ts`: no-workspace ゲートテストの `"Import Portable JSON"` 文字列アサート 1 行を削除(他アサートは残置、portable UI 除去の正当な帰結)。

## 2. 自動ゲート結果

| ゲート | コマンド | 結果 |
|---|---|---|
| typecheck | `pnpm --filter @private-2d-rigging-lab/editor typecheck` | **新規エラーゼロ**。先在赤(`task_c8fc5155` の brand 型/exactOptionalPropertyTypes 系)は編集ファイル外に集中。Gnome=22件申告 / Review 実測=21件(portable 削除ファイルが先在赤を 1 含んでいた等で説明可・新規増加ゼロと整合)。**編集ファイル起因ゼロ**。 |
| test:unit | `pnpm --filter @private-2d-rigging-lab/editor test:unit` | **新規失敗ゼロ**。先在失敗 4 件のみ(`diagnostics-jump-actions.test.ts`)。clean-tree stash 実測で 4=4 一致。Review は編集 7 テストファイルを個別 vitest → 82 tests 全 pass。 |
| electron:build | `pnpm --filter @private-2d-rigging-lab/editor electron:build` | **緑**。`out/main/main.js`(9.53kB)/`out/preload/preload.mjs`/`out/renderer/index.html` 生成。E2E launch パスと renderer フォールバックの実在を裏付け。 |
| check:deps | `pnpm run check:deps` | **pass**(Gnome 実行)。 |
| check:source | `pnpm run check:source` | **pass**(Gnome 実行)。 |

先在赤/先在失敗の切り分けは Gnome が clean-tree stash 実測、Review が独立に typecheck/electron:build/対象テスト実行で二重裏取り。

## 3. Forbidden 非改変の確認

- **下層 portable(dormant 温存)**: authoring-core `portable-project-bundle.ts`、package-format `portable-package-bundle-v0`、`exportAuthoringSessionPortableBundle` 実体 — `git status` の変更は全て `apps/editor/` 配下のみで、`packages/` への変更ゼロ。**厳守**。
- WS1/WS2 の殻・preload・永続化(`src/main/workspace-fs/*`)・renderer の workspace 保存経路・保存形式・共有エントリ(`index.html`/`main.tsx`)無改変。
- 先在債務 `task_c8fc5155` 領域(viewer/mesh/variant/diagnostics)は未編集。

## 4. ユーザー実機 E2E 手順(§6 ゲート — agent 環境では実行不可)

`_electron` の Electron GUI 起動は agent 環境で確実に回せないため、**実緑確認はユーザー実機**に残す。配線の静的妥当性と `electron:build` による out/ 産物実在は Gnome/Review で担保済み。

1. **psd-import E2E 実行**:
   ```
   pnpm --filter @private-2d-rigging-lab/editor test:e2e:psd-import
   ```
   前段で `electron:build` が `out/{main,preload,renderer}` を再生成 → `playwright test` が `_electron.launch(["out/main/main.js"])` でビルド済み UI を起動。psd-import 全 10 テストが fresh app 上で走る。
   - 想定パス: main `apps/editor/out/main/main.js`、renderer `apps/editor/out/renderer/index.html`、fixture `test_data/sample_model.psd`。

2. **挙動パリティ確認**(§6): PSD import の review→commit が Electron 下(WS2 workspace bridge 配線・`requireOpenWorkspace` ガード)で web と同様に通るか 1 回確認。

## 5. Residual / 申し送り

- **E2E 実機ゲート未消化**(上記 §4)。これがクローズすれば cleanup フェーズ = 移行完了。
- 計画ドキュメントの継続性向上のための注記候補(機能齟齬なし、行番号/baseline のドリフトのみ — 詳細は [ws3-ws4-review.md](ws3-ws4-review.md) 末尾および本 Orch の Undine 向け報告):
  - §5 の行番号参照は inventory 時点のスナップショットで実 diff の行位置と細部ズレ(除去対象の同定は正しい)。
  - §5 の `playwright.config.ts` timeout はコメント上の期待(30000)と実値(90000, expect は別途 30000)が食い違う既存値。
  - typecheck 先在赤 baseline は最新実測 **21 件**(次回計測との整合のため)。
- `EditorSessionContextValue` の `DirtyWorkspaceReplacementReason` 型は `"import-portable-json"` を保持(message 分岐が死枝化するが `"open-workspace"` 経路は活き、型/ビルド健全)。UI ロジック改変は out of scope のため未着手。
