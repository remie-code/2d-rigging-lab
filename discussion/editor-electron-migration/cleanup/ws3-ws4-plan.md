# WS3+WS4 wave-plan: Web 退役 + E2E `_electron` 化(掃除フェーズ)

> 移行の本丸(WS1 殻 + WS2 永続化)完了後の掃除。Web ターゲットを退役させ、E2E を `_electron` 駆動へ移し、portable の editor 経路を除去する。
> 上位: [../01-decomposition.md](../01-decomposition.md)(WS3/WS4)。除去面は 3系統目 inventory(2026-07-08)から確定。

## 1. Status / Planning Gate

- Status: **Draft**。
- Planning Gate: **Plan directly**。inventory が除去境界・`_electron` 配線・sequencing を確定。ユーザー判断で塞ぐ穴なし。

## 2. Accepted Decisions

- **portable 廃止 = editor feature 層のみ除去**。下層(authoring-core `portable-project-bundle.ts` / package-format `portable-package-bundle-v0`)は**複数パッケージのテスト土台として dormant 温存**(ユーザー了承 2026-07-08)。
- **`build`(vite build)除去 → 緑ゲートは `electron:build` に一本化**(`typecheck` は独立で残す。`pnpm --filter editor build` を叩く CI/script は無しと確認済み)。
- Web ターゲット廃棄、E2E は `_electron` へ。

## 3. Sequencing(結合で決まる)

1. **WS4 先行(E2E `_electron` 化)** — 現 E2E は `pnpm exec vite`(=vite.config.ts)依存。これを外す前に web を消すと E2E が壊れる。
2. **WS3 web-script 除去** — `dev`/`build`/`preview` 削除 → 参照ゼロの `vite.config.ts` 削除。
3. **WS3 portable 除去** — editor feature 層。1・2 と独立(並行可、独立コミット推奨)。

## 4. Wave Strategy

1波・1実装ドメイン(**cleanup**)。機械的除去 + 1点の新規(`_electron` E2E 配線)。1 Gnome に集約。

## 5. Domain: cleanup

**Purpose**: Web ターゲットを退役させ E2E を `_electron` へ移し、portable の editor 経路を除去。editor は Electron 専一のアプリになる。

### Allowed write scope

**WS4(E2E)**:
- `apps/editor/playwright.config.ts`: `webServer`(:14-19)・`use.baseURL`(:10)削除。ビルドは `globalSetup`(一度だけ `electron-vite build`)か `test:e2e` script 前段に。
- `apps/editor/e2e/psd-import.e2e.spec.ts`: `_electron.launch({args:[<out/main/main.js>], env: ELECTRON_RENDERER_URL 抜き})` → `firstWindow()` で page 取得 → `page.goto("/")` 除去し UI 可視待ちに置換 → `app.close()` teardown。`setInputFiles` はそのまま。
- `apps/editor/e2e/portable-project-save-load.e2e.spec.ts`: **削除**(portable 廃止 + web goto 依存)。
- `package.json` の `test:e2e:psd-import`: `_electron` 前提へ repoint(build 前段 or globalSetup)。

**WS3(web 退役)**:
- `apps/editor/package.json`: `dev` / `build` / `preview`(vite 系)削除。`typecheck` / `test` / `test:unit` / `electron:*` は残す。
- `apps/editor/vite.config.ts`: 参照ゼロ確認後**削除**(electron.vite.config.ts は自前に設定コピー済みで非依存)。

**WS3(portable 除去・editor feature 層)**:
- 削除: `src/features/project-storage/model/{browser-portable-project-transfer,editor-project-storage,project-storage-state,editor-project-storage.test}.ts`、`src/workspace/project-storage/project-storage-screen.tsx`(+ `.test`、既にオーファン)。
- `src/workspace/app-bar.tsx`: WorkspaceMenu の "Export/Import Portable JSON" 入力+2ボタン(:211-218,:251-265)、`exportPortableProject`/`openProjectFile` の props・配線(:31,33,59,159-161,182,197)、`createOpenProjectFileChangeHandler`(:173-183)、`openProjectInputRef`、`projectStorage` destructure(:34)を除去。`storageBusy`(:46-49)を `isWorkspaceStorageBusy(workspaceStorage)` のみに単純化。→ workspace 保存/開く(WS2 node:fs)は無傷。
- `src/features/editor-session/editor-session-context.tsx`: portable 関連 import(:56-63)、`exportPortableProject`(:1156-1177)/`openProjectFromPortableBundle`(:1179-1243)/`openProjectFile`(:1245-1262)、`projectStorage` state(:651-652)、context 型/値の `projectStorage`/`projectIdentityLabel`/`projectSaveStatusLabel`(型:378-380、値:2433-2435,2595-2601)を除去。
- モック修正: `exportPortableProject`/`openProjectFile` の欠落フィールドを削除 — `app-bar.test.ts`(:20,22,116-117,172,185-202)、`texture-atlas-task-screen.test.ts`(:513,515)、`diagnostics-screen.test.ts`(:221,223)、`viewer-runtime-screen.test.ts`(:42,44,195)、`runtime-export-task-screen.test.ts`(:367,384,411,413)。

### Forbidden write scope
- **下層 portable(dormant 温存)**: authoring-core `portable-project-bundle.ts`、package-format `portable-package-bundle-v0`。
- WS1/WS2 の殻・preload・永続化(node:fs)コード、renderer の workspace 保存経路、保存形式、`index.html`/`main.tsx`(共有エントリ)。
- 先在債務(`task_c8fc5155`)。

### Required tests / evidence
- `typecheck`: **WS3/WS4 で新規エラーゼロ**(先在赤 `task_c8fc5155` は不変)。portable 除去で型/import が壊れないこと。
- `test:unit`: モック修正後、**新規失敗ゼロ**(失敗は既知の先在4件のみ)。
- `electron:build` 緑、`check-source-organization` / `check-dependencies`。
- **psd-import E2E が `_electron` で緑**(§6 のユーザーゲート)。

### Early escape triggers
- portable 除去で型/ビルドが壊れる(下層への隠れ依存)→ 停止・報告。
- `vite.config.ts` 削除で何かが壊れる(未検出参照)→ 停止。
- `_electron.launch` が out/ 構成(`main`=`./out/main/main.js`)で起動しない → 停止・エスカレーション。

## 6. E2E 実行ゲート(ユーザー / 手動)

`_electron` の Electron 起動は agent 環境で確実に回せない可能性 → **psd-import E2E の緑確認はユーザーの実機**で(agent が試みて不可なら起動コマンドを報告に明記)。
加えて**挙動パリティ**: PSD import の review→commit が Electron 下(WS2 の workspace bridge 配線あり、`requireOpenWorkspace` ガード)で web と同様に通るか、1回確認。

## 7. Expected Persistent Artifacts

- `cleanup/ws3-ws4-domain-report.md`、`cleanup/ws3-ws4-review.md`、`cleanup/_map.md` 更新。

## 8. Orchestration Policy(薄い契約)

- **Undine**: 計画・判定を所有、在席、source を書かない。install は L0。
- **Orch-Sylph**: cleanup ドメインのループ1本。実装を Gnome、レビューを Review-Sylph へ委任。自分で実装・レビューしない。
- **Gnome**: 実装のみ。環境操作エスカレーション。
- **Review-Sylph**: 1本(clean-context)。機械的除去の完全性(隠れ依存を残していないか)+ `_electron` E2E 配線の妥当性 + Forbidden(下層 portable)非改変を確認。final clean integration 兼任。
- `Agent` の `model` は毎回明示。

## 9. Out of Scope

下層 portable 除去、先在債務 `task_c8fc5155`、再起動後の自動復帰、保存形式変更、UI ロジック改変(portable 除去に伴う配線整理を除く)。
