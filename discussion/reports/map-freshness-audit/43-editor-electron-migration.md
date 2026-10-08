# Editor Electron 移行 map 鮮度監査

> 基準点: `3c3669eefcc375c62d1ec6b4d77a000d7cbbb61c` / 2026-08-08 (Asia/Tokyo)。既存 map は変更せず、担当レポートだけを作成した。

## 1. 担当範囲と確認対象

確認した map は次の5件である。

1. `discussion/editor-electron-migration/_map.md`
2. `discussion/editor-electron-migration/shell/_map.md`
3. `discussion/editor-electron-migration/persistence/_map.md`
4. `discussion/editor-electron-migration/cleanup/_map.md`
5. `discussion/editor-electron-migration/packaging/_map.md`

照合先は、同ディレクトリの `00-agreement.md`、`01-decomposition.md`、WS1〜WS4の plan/domain-report/review、`apps/editor` の Electron/Vite/IPC/packaging設定、unit/E2Eテスト、基準点までの Git 履歴 (`1d03bfe`、`a872da7`、`d9f3f1d`、`4dde084`、`4349168`、`e9113ab`、`d1b2348`、`2ef467f`) である。

## 2. map 別判定

| map | 種類 | 判定 | 要点 |
|---|---|---|---|
| `editor-electron-migration/_map.md` | `living-current-state` + `living-index` | **Current** | WS1〜WS4、packaging の完了、stale E2E、type/test 債務を現在の入口として索引している。 |
| `shell/_map.md` | `living-current-state` + `living-index` | **Partially stale** | WS1 の pass は正しいが、`次: WS2` が完了後も残る。リンク先 plan は `Draft/実装未着手` のままで、map の `Accepted` と矛盾する。 |
| `persistence/_map.md` | `living-current-state` + `living-index` | **Partially stale** | WS2 pass と残差は正しいが、`次: WS3/WS4` が完了後も残る。リンク先 `ws2-plan.md` の `Draft` と map の `Accepted` が不整合。 |
| `cleanup/_map.md` | `living-current-state` + `living-index` | **Partially stale** | Web退役・`_electron`配線・editor側 portable 除去は現行事実。ただし「現E2Eがvite web-server依存」「packagingは別フェーズ」「全ゲート緑」の表現が現状を誤誘導し、portable のユーザー向け死枝も残る。 |
| `packaging/_map.md` | `living-current-state` + `living-index` | **Partially stale** | package設定・portable exe生成は確認できるが、`未決事項: なし` が packaging report の `description/author` 警告を落としている。アイコン差替え後の report の元画像名は歴史的記述。 |

## 3. 現行事実と根拠

### WS1 shell

- `apps/editor/package.json:6-12` に Electron の `main`、`electron:dev/build/preview` がある。
- `apps/editor/electron.vite.config.ts:11-50` は main/preload/renderer の3入口を定義し、`apps/editor/src/main/editor-main.ts:9-36` が単窓起動・activate・終了を担う。
- security posture は `apps/editor/src/main/window-management/editor-window-options.ts:24-37` の `nodeIntegration:false`、`contextIsolation:true`、`sandbox:false`。
- WS1実装は Git `d9f3f1d`。domain report/review は pass（`shell/ws1-shell-domain-report.md:3-8,42-60`、`shell/ws1-shell-review.md:3-24`）。
- したがって `shell/_map.md:5,17` の完了/pass は現行事実だが、`shell/_map.md:21` の「次: WS2」は obsolete。`shell/ws1-shell-plan.md:9` の `Draft(実装未着手)` も実装後の計画文書ドリフトである。

### WS2 persistence

- main 側の IPC handler は `apps/editor/src/main/workspace-fs/workspace-fs-bridge-handlers.ts:25-67`、picker は同 `:71-87`。preload は `apps/editor/src/preload/preload.ts:1-5` と `workspace-fs-bridge.ts:1-40` で5操作だけを露出する。
- node:fs 実体は `apps/editor/src/main/workspace-fs/workspace-fs-store.ts:1-101`。`path` 境界検査、utf8/binary read、同一ディレクトリ temp+rename write を行う。
- 実装は `4dde084`、完了裁定・map更新は `4349168`。`persistence/_map.md:5,20-22` と `ws2-review.md:25-47` の pass/accepted residual（symlink、種別衝突、任意テスト強化）は整合する。
- ただし `persistence/_map.md:26` の「実機 smoke 通過で…WS3/WS4が並行可能」は完了前の next 文であり、`persistence/ws2-plan.md:8` の `Draft` と map `Accepted` もドリフト。

### WS3 Web退役 / WS4 E2E

- `apps/editor/vite.config.ts` と `apps/editor/e2e/portable-project-save-load.e2e.spec.ts` は不存在。`apps/editor/package.json:9-15` に残るのは Electron build/preview、E2E は build 前段付きである。
- `apps/editor/playwright.config.ts:4-9` は `testDir`/timeout のみ。`apps/editor/e2e/psd-import.e2e.spec.ts:1-33` は `_electron.launch`、`out/main/main.js`、`ELECTRON_RENDERER_URL` 除外、fresh app/close を使用する。
- portable の editor feature 層は `e9113ab` で削除され、下層の `packages/authoring-core/src/portable-project-bundle.ts` と `packages/package-format/src/portable-package-bundle.ts` は tests/contract の土台として残る（設計判断は `01-decomposition.md:46-60`）。
- 実際の未解消ゲートは、現 E2E helper `apps/editor/e2e/psd-import.e2e.spec.ts:753-765` が workspace を作成/開放せず `Import PSD` へ直行すること。Playwright artifact の aria は `Create Workspace`、`Open Workspace`、`No workspace is open` を示し、11テストすべてがこの stale assertion で止まるという map/report の説明 (`cleanup/_map.md:5,24`) と一致する。フル再実行は GUI 待ちが長いため途中停止したが、現行 artifact と初回失敗は同じ。
- よって cleanup の機能的結論は「Web→Electron配線・editor portable除去は完了、実機E2Eは未クローズ」の二層で保持すべきである。`cleanup/_map.md:3`（現E2Eがvite web-server依存）と `:28`（packaging は別フェーズ）は現状説明として stale。

### portable 残留と Web retirement の debt

- editor production code の portable UI/transport は除去済みだが、`apps/editor/src/features/workspace-storage/model/workspace-storage-state.ts:46` は依然「Portable JSON export remains available」と表示する。これは廃止決定と矛盾するユーザー向け死枝である。
- `apps/editor/src/features/editor-session/editor-session-context.tsx:557,946-948` の `import-portable-json` reason/message も、現行 call site が `open-workspace` のみの死枝。domain report もこれを residual と記録している（`cleanup/ws3-ws4-domain-report.md:70`）が、cleanup map には明示されていない。

### packaging

- `apps/editor/package.json:45-73` は `electron-builder ^26.0.12`、`png-to-ico ^3.0.0`、`dist:win`、portable x64、`build/icon.ico` を定義する。`apps/editor/dist/builder-effective-config.yaml`（生成物）も同じ appId/productName/target/icon を示す。
- `pnpm.cmd --filter @private-2d-rigging-lab/editor electron:build` を実行し、main/preload/renderer の build は pass（sandbox の子プロセス制限のため escalated 実行）。dist には `Private 2D Rigging Lab 0.0.0.exe` (94,560,207 bytes) が存在する。
- packaging 実装は `d1b2348`、アイコン差替えは `2ef467f`。現 `icon.ico` の read-only header は4層 (48/32/16/256, 32bpp) で、packaging map の生成主張は維持される。ただし report `packaging-report.md:55` の元画像ファイル名/7月8日記述は `2ef467f` 後の履歴として更新されていない。
- `packaging-report.md:79` の `description`/`author` 欠落警告は非ブロッキングだが、`packaging/_map.md:27-29` の「未決事項なし」はこの debt を索引していない。`dist:win` は typecheck を含まない（`package.json:14`、report `:91`）ため、typecheck debt と配布ビルドは独立である。

## 4. ゲートと残債（検証結果）

| 項目 | 現行結果 | 情報種別 / 根拠 |
|---|---|---|
| Electron build | pass。main 9.53kB、preload 1.24kB、renderer 2316 modules | 実験結果。`pnpm.cmd --filter @private-2d-rigging-lab/editor electron:build`（2026-08-08） |
| typecheck | exit 2、21件。brand/exactOptionalPropertyTypes 等で WS1〜WS4の変更外 | 実験結果。`pnpm.cmd --filter @private-2d-rigging-lab/editor typecheck`、既知 debt `task_c8fc5155`。 |
| unit | 62 files pass / 1 file (`diagnostics-jump-actions.test.ts`) 4 failures / 493 pass + 4 skipped | 実験結果。`pnpm.cmd --filter @private-2d-rigging-lab/editor test:unit`。失敗は workspace→import の stale 期待値で、移行差分外。 |
| `_electron` E2E | harness起動・描画は実証済みだが PSD import 11件は workspace precondition 不足で未緑 | 実験結果 + repo artifact。ユーザー実機で Create/Open Workspace と temp-dir picker 注入を含む再確認が必要。 |
| WS2 security residual | symlink の `realpath` 未使用、同名 directory/file の種別丸め、任意テスト強化4件 | 設計判断/accepted residual。`persistence/ws2-review.md:31-45`。 |
| packaging metadata | `description`/`author` warning | 実験結果。`packaging/packaging-report.md:78-79`。ユーザー判断不要の任意補完。 |

## 5. 親 map へ反映する短い結論

- `discussion/_map.md:43` は「第一手=WS1(shell)未着手」を **WS1〜WS4 + packaging 完了、E2E stale gate/task debt 残り**へ更新する必要がある。
- `discussion/_map.md:71` は完了済み移行を記載しているが「次フェーズ=パッケージング」が obsolete。`discussion/_map.md:86` の「第一手は WS1 実装→実機観測」も完了済み手順である。
- editor-electron-migration の親 map 自体は完了状態を正しく索引している。ただし child shell/persistence/cleanup map の obsolete next と portable residual を反映する場合は、子 map → 親 map の順で更新する。
- 「移行完了」は Web target 廃止・Electron shell・node:fs/IPC・E2E `_electron` 配線・portable editor feature 層除去までを指す。「配布可能」は packaging 完了を指す。「全ゲート緑」は誤りで、typecheck/unit/E2E に既知の独立 debt がある。

## 6. 未解決事項 / ユーザー判断点

1. `task_2d91b388` 相当の stale E2E 修正（workspace 作成と native picker 回避 hook）をいつ実施するか。
2. `task_c8fc5155` の typecheck 21件・unit 4件を Electron 移行の完了条件に含めるか、独立 debt のまま扱うか（現 docs は後者）。
3. portable 廃止後の `workspace-storage-state.ts:46` と `import-portable-json` dead branch を削除するか。削除は移行の機能成立には不要だが、現在のユーザー向け文言の正確性には必要。
4. packaging の `description`/`author` を補完するか（portable build のブロッカーではない）。

## 7. 調査できなかった範囲

- Electron GUI のユーザー実機 smoke と PSD import review→commit parity はこの監査環境では完了判定できない。
- `task_2d91b388` / `task_c8fc5155` はリポジトリ内の issue tracker ではなく、外部タスク ID の実完了状態は検証不能。
- 既存 map や source/config/test は監査契約に従い変更していない。
