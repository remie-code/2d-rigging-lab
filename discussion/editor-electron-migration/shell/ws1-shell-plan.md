# WS1 wave-plan: Electron 殻 & 既存 renderer 配線

> apps/editor を Electron デスクトップ化する第一手。**既存 renderer を無改造で Electron 殻に載せ、dev 起動で実機観測する**最小 de-risk スライス。
> 上位文脈: [../01-decomposition.md](../01-decomposition.md)(WS1 / 第一手 節)、[../00-agreement.md](../00-agreement.md)。
> 本計画は wave80-plan の縮約版。1波・1実装ドメイン。

## 1. Status / Planning Gate

- Status: **Draft**(実装未着手)。
- Planning Gate: **Plan directly**。factual uncertainty は3系統コード調査(2026-07-08)で low に落ちている。de-risk 条件 a/b/c(FS権限ゼロ起動 / 本番 base は electron-vite 自動解決 / Tailwind は Chromium で稼働)はいずれも充足済み(01-decomposition 参照)。

## 2. Accepted Decisions / Oracles(ユーザー確定事項)

- **単窓**。ダイアログは DOM 内。OS ウィンドウは増やさない。
- **packaging(electron-builder)は WS1 に含めない**。`electron-vite dev` 起動のみを対象。electron-builder は将来の別作業。
- **renderer は無改造**。既存 React UI(`apps/editor/src/**` のアプリコード)は 1 バイトも変えない。
- 写経元 = **apps/runtime-player** の Electron 構成。
- 観測ゲート = **人間(ユーザー)による実機起動観測**(§7)。
- 成果物は `shell/` にフラット配置。`implementation/` 器の正式化と背骨判断は WS1 通過後(01-decomposition 未決)。

## 3. Primary Basis(Gnome / Review へ配る文書)

- 写経元(runtime-player): `apps/runtime-player/electron.vite.config.ts`、`src/main/main.ts` + `runtime-player-main.ts`、`src/main/window-management/{browser-window-options.ts, renderer-entry-url.ts, runtime-player-windows.ts}`、`src/preload/preload.ts`、`package.json`(scripts / `main` フィールド / electron・electron-vite devDeps)、`src/runtime-player-boundary.test.ts`。
- 対象 renderer の起動経路(無改造で載る根拠): `apps/editor/index.html`、`src/main.tsx`、`src/app/editor-app.tsx`。
- 開発規約: `discussion/development_convention/source-file-organization-policy.md`(index.ts/catch-all blocking + `scripts/check-source-organization.mjs`)、`discussion/development_convention/testing-and-acceptance-policy.md`(evidence / pass-fail-needs_review)。

## 4. Review Policy(緩和側・1レーン)

WS1 は AC が薄く(「空窓が起動し既存 UI が従来通り載る」)テスト設計もほぼ無いため、二層分離の**緩和側**に置く(ユーザー sanction 済み)。

- **Review-Sylph 1本**(clean-context)。確認項目:
  1. **写経忠実性**: config/main/preload の構造が runtime-player と整合。security 姿勢(`contextIsolation:true` / `nodeIntegration:false` / `sandbox:false`)が入っている。
  2. **renderer 無改造**: diff が `apps/editor/src/**` のアプリコードに触れていない。
  3. **起動結合ゼロ維持**: 新たな Web 結合を持ち込んでいない。boundary-guard テストが存在し「renderer が node/electron を import しない」を assert している。
  4. **source-organization**: `index.ts` に実ロジック混入なし、catch-all 命名なし(`check-source-organization.mjs` 素通り)。
- この1本が final clean integration review を兼ねる。
- 判定: `pass` / `needs_fix` / `blocked`。fix ループ上限5(0〜1で収束見込み)。

## 5. Wave Strategy

1波・1実装ドメイン(**Domain A: shell**)。runtime-player Wave1 と同じく「初回殻は 1 Gnome に集約」(config・main・preload・package.json を一緒に触るため分割は益が薄い)。多波分割は不要(依存背骨は WS1 が唯一のゲート)。

## 6. Domain A: shell

**Purpose**: apps/editor に Electron 殻を新設し、既存 renderer を electron-vite の renderer として無改造で配線。`electron-vite dev` で単窓 Electron が起動し、既存 UI が従来通り描画・操作できる状態にする。

**Allowed write scope**:
- 新規作成: `apps/editor/electron.vite.config.ts`(renderer ブロックは既存 `vite.config.ts` の設定を移植 + 単一エントリ)、`apps/editor/src/main/**`(`main.ts` + window-management 相当。単窓)、`apps/editor/src/preload/**`(**最小/空でよい** — WS1 は IPC 不要)、boundary-guard テスト。
- 変更: `apps/editor/package.json`(electron 起動 scripts 追加、`main` フィールド追加、`electron`・`electron-vite` を devDeps に**宣言のみ**)、`.gitignore`(`out/` 無視)。
- **非破壊制約**: 既存の web vite 経路(`vite.config.ts`、ルート `index.html`、直接 `vite` 起動)は**壊さず温存**する。E2E は現状 `pnpm exec vite` を直接叩くため、WS1 中は緑のまま(web 退役=WS3 / E2E 移設=WS4 で別途扱う)。

**Forbidden write scope**:
- `apps/editor/src/**` の **renderer アプリコード改変**(React UI)。
- `packages/**`、save/load schema、永続化ロジック(WS2)。
- `apps/editor/e2e/**`、`playwright.config.ts`(WS4)。
- electron-builder / packaging 設定(WS1 対象外)。
- portable 関連の除去(WS3)。

**Required tests / evidence**:
- boundary-guard テスト(renderer が node/electron を import しないこと)。
- 既存の window-options 相当を足すなら pure-logic ユニットテスト(runtime-player の `browser-window-options.test.ts` 型)。
- 自動ゲート: `typecheck`、`test:unit`、`node scripts/check-source-organization.mjs`、`node scripts/check-dependencies.mjs`、`git diff --check`、electron-vite `build`。
- **実機観測記録**(§7)を completion report に残す(手動確認のみを恒久証拠にしない配慮)。

**Early escape triggers(崩れたら即停止・エスカレーション)**:
- 既存 renderer が**無改造で載らない**(path / CSP / vite base / asset ロードの齟齬)→ de-risk 条件 b 崩壊。停止。
- 未検出の Web 結合(SW / `import.meta.env` / 絶対 URL 等)が起動を阻む → 停止。
- renderer を載せるのに `apps/editor/src/**` の改変が必要になる → 無改造前提の破れ。スコープ判断のため停止・エスカレーション。
- 依存が config だけで解決できず、ユーザーの `pnpm install` 以外の環境操作が要る → エスカレーション。

## 7. 実機観測ゲート(手動 smoke ・自動判定の外)

Electron GUI の実起動は agent 環境で確実に回せないため、**wave 完了判定の外側の手動ゲート**として分離する。completion report に起動コマンドと下記観測項目を明記し、**ユーザーが実行して観測**する。

観測項目:
1. Electron デスクトップ窓が**1枚**開く。
2. editor の主編集ビュー(Toolbox / StructureTree / Canvas / Inspector / ParameterBar)が web と同様に描画される。
3. 代表操作が通る: タスク画面切替(parameters / variants / atlas / viewer)、PSD インポートモーダル表示、Canvas 描画・ズーム。
4. **ワークスペース保存/開くが従来通り動く**(Electron Chromium の FS Access `showDirectoryPicker` 経由 → 永続化を WS1 で触っていないことの実証)。
5. 起動時にコンソールエラーなし。boundary-guard テストが緑(renderer が electron/node を掴んでいない)。

## 8. Install 境界の扱い

- Gnome は `electron` / `electron-vite` を `apps/editor/package.json` devDeps に**宣言する**(バージョンは runtime-player に合わせる: `electron@^42` / `electron-vite@^5`)。実装エージェントは env を汚さない衛生上、install 自体は実装ドメインの外で行う。
- **install は Claude Code では制約なし**。旧「エージェントは install しない/ユーザーが打つ」は **Codex + sandbox 環境固有の制約**であり、本環境には当てはまらない。Orch-Sylph が install 待ちで停止したら、**Undine(L0)が `pnpm install` を実行**して Orch を再開させる。ユーザーの手は不要。
- install 後に typecheck / build / test を確認する。

## 9. Expected Persistent Artifacts

- `shell/ws1-shell-domain-report.md` — Domain A 完了報告(実装内容 / 自動ゲート結果 / 実機観測手順 / residual risks)。
- `shell/ws1-shell-review.md` — Review-Sylph 判定。
- `shell/_map.md` の status 更新。

## 10. Orchestration Policy(薄い契約)

- **Root / Undine**: 本計画・依存・最終判定を所有。在席ポーリングで待つ。**source を書かない**。
- **Orch-Sylph**: shell ドメインのループを1本抱える。実装を Gnome、レビューを Review-Sylph へ委任。**自分で実装・レビューしない**。環境操作(install)はエスカレーション。
- **Gnome**: 実装のみ。`pnpm install` 等の環境操作を打たない。回避工作もしない。詰まれば escalate。
- **Review-Sylph**: 計画 + 写経元 + diff + テスト証拠のみで検証(clean context、会話文脈を渡さない)。
- `Agent` の `model` は毎回明示。

## 11. Out of Scope

packaging / electron-builder、WS2(永続化 node:fs/IPC 化)、WS3(Web 退役)、WS4(E2E `_electron` 化)、portable 除去、あらゆる renderer / UI 改変。
