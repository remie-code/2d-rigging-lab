# WS3+WS4 review: Web 退役 + E2E `_electron` 化

> Review-Sylph(opus, clean-context)による判定。根拠は計画 [ws3-ws4-plan.md](ws3-ws4-plan.md) + 実 diff + 自己実行ゲート。会話文脈は不供給。
> 実装報告: [ws3-ws4-domain-report.md](ws3-ws4-domain-report.md)。

## 総合判定: **approve-with-nits**(再実装不要)

WS3/WS4 実装は計画 §5 の Allowed/Forbidden scope・Required tests に忠実。機械的除去は完全で隠れ依存を残さず、`_electron` 配線も静的検証・ビルド産物の両面で妥当。nit は全て情報提供レベル(要修正なし)。

## 観点別所見

### A. WS4 `_electron` E2E 配線 — PASS(7 点裏取り)
1. `playwright.config.ts`: `use.baseURL`・`webServer` 除去、`testDir`/`timeout:90000`/`expect.timeout:30000` 残存。
2. `_electron.launch({args:[mainEntryPath], env: createElectronLaunchEnv()})`。`createElectronLaunchEnv` が `ELECTRON_RENDERER_URL` を明示除外 → `renderer-entry.ts` の `getEditorRendererDevUrl()` が undefined → `editor-window.ts` が `loadFile(out/renderer/index.html)` 分岐。`mainEntryPath` は `package.json` `"main"` と整合(electron:build で実生成確認)。
3. `page` fixture 上書きで各テストが fresh app + `finally { app.close() }` teardown。状態汚染なし。
4. `page.goto("/")` 2 箇所とも除去、UI 可視待ちに置換(Import 前の renderer マウント保証)。
5. `setInputFiles` 保持。
6. `test:e2e:psd-import` に `electron:build` 前段あり — out/ 欠落による launch 失敗を担保。
7. `portable-project-save-load.e2e.spec.ts` 完全削除(`git status` deleted 確認)。

### B. WS3 web 退役 — PASS
`package.json` の dev/build/preview 除去・必要 script 残存。`vite.config.ts` 削除 + `tsconfig.json` include 除去。repo grep で `vite.config` 実参照ゼロ(唯一のヒットは untracked ログの過去行)。`electron.vite.config.ts` 無傷。

### C. WS3 portable 除去 — PASS
feature 層 6 ファイル削除。`app-bar.tsx` の portable UI/配線除去・`storageBusy` 単純化・WS2 保存経路無傷。`editor-session-context.tsx` の portable メンバ除去・残存参照ゼロ(grep + typecheck 編集ファイル 0 エラー)。モック 5 件は該当フィールドのみ除去。

### D. スコープ外補完 2 件 — PASS(過剰除去なし)
1. `editor-session-context-history.test.ts`: 削除 5 テストは全て `openProjectFromPortableBundle`/`projectStorage` を叩く portable 専用。workspace 保存カバレッジの巻き添えなし。`projectSaveStatusLabel`→`workspaceSaveStatusLabel` は値等価(削除前 context で `const projectSaveStatusLabel = workspaceSaveStatusLabel` を diff 確認)。
2. `authoring-workspace.test.ts`: `"Import Portable JSON"` アサート 1 行のみ削除、Create/Open Workspace 等の生きたアサート残存。

### E. Forbidden 非改変 — PASS(重大確認クリア)
`git status` の変更は全て `apps/editor/` 配下 + 親 `_map.md`(対象外)のみ。`packages/`(下層 portable bundle・`exportAuthoringSessionPortableBundle` 実体)への変更ゼロ = dormant 温存厳守。`src/main/workspace-fs/*`・preload・`index.html`・`main.tsx` 無改変。`task_c8fc5155` 領域未編集。

### F. 自動ゲート(Review 自己実行)
- `typecheck`: exit 2、`error TS` 21 件、全て編集ファイル外(task_c8fc5155 の brand 型/exactOptionalPropertyTypes 系)。編集ファイル起因ゼロ → §5「新規エラーゼロ」充足。
- `electron:build`: GREEN。`out/{main,preload,renderer}` 生成。
- 編集 7 テストファイルの `vitest run`(sandbox 無効化): 7 files / 82 tests 全 pass。
- `check:deps`/`check:source`: 未実行(実装者申告 pass を採用)。

## 残存懸念・申し送り
1. **E2E 実機ゲート未消化**: `_electron.launch` の実 E2E は未実行(§6 でユーザー実機指定)。配線静的妥当性 + out/ 産物実在は確認済み。実緑と PSD import review→commit パリティはユーザー実機確認要。起動: `pnpm --filter @private-2d-rigging-lab/editor test:e2e:psd-import`。
2. **nit(要修正なし)**: 先在赤 Gnome 申告 22 / Review 実測 21 — portable 削除ファイルが先在赤 1 を含んでいた等で説明可、新規増加ゼロと整合。
3. **nit(要修正なし)**: untracked `apps/editor/.dev-server.err.log` に削除済み `vite.config.ts` の過去参照行が残るが実コード/config 参照ではない。

## 計画ドキュメント継続性メモ(機能齟齬なし・ドリフトのみ)
- §5 の行番号参照は inventory 時点スナップショットで実 diff と細部ズレ(除去対象の同定は正しい)→「行番号は参考値」注記が安全。
- §5 の `playwright.config.ts` timeout はコメント期待(30000)と実値(90000/expect 30000)が食い違う既存値。
- typecheck 先在赤 baseline は最新実測 **21 件**に更新推奨。
- 「計画が削除と書いた対象が実は別対応だった」といった本質的ズレは**なし**。
