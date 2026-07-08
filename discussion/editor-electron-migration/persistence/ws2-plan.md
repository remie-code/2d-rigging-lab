# WS2 wave-plan: 永続化の node:fs/IPC 化

> 既存の永続化ポートの裏に node:fs-backed アダプタを実装し、IPC 越しに main の fs を叩く。谷埋めの本丸。
> 権威設計: [ws2-design.md](ws2-design.md)。上位: [../01-decomposition.md](../01-decomposition.md)(WS2)。写経元: apps/runtime-player。挙動リファレンス: `apps/editor/src/features/workspace-storage/model/fake-workspace-directory.ts`。

## 1. Status / Planning Gate

- Status: **Draft**。
- Planning Gate: **Plan directly**。契約レベルのコード調査(2026-07-08)で factual uncertainty は low。着手前提だった atomicity 契約は解決済み(保存はクロスファイル非トランザクション = validate-then-write、`workspace-session-storage.ts:170-180`)。3設計判断はユーザー確定済み。

## 2. Accepted Decisions / Oracles

- **設計判断(確定)**: ①per-file temp+rename 採用 ②runtime-export も同アダプタ ③main 側パス境界二重化。
- ポートは無改造、消費側(`workspace-session-storage.ts` / `runtime-export-directory.ts`)も無改造。差し替えるのは**ポート実装(picker 注入)と IPC/main の fs 実体**のみ。
- digest は renderer 側(Web Crypto)に残す。IPC/fs 層は bytes を運ぶだけ。
- 写経元 = runtime-player の型付き IPC 5層 + fs store + dialog。fake が満たすべき契約の最小実装例。

## 3. Primary Basis(Gnome / Review へ配る)

- 設計: [ws2-design.md](ws2-design.md)(契約・IPC・プロトコル・判断)。
- 対象/リファレンス: `apps/editor/src/features/workspace-storage/model/{workspace-directory-io.ts, fake-workspace-directory.ts, workspace-session-storage.ts}`、`editor-session-context.tsx:578-605`(注入口)、`runtime-export-directory.ts`。
- 写経元: runtime-player の `src/preload/*bridge-channels.ts` / `*bridge-contract.ts` / `runtime-player-bridge.ts`、`src/main/*bridge-handlers.ts`、fs store(`model-mapping-profile-store.ts` 等)、`dialog.showOpenDialog` 使用箇所、`browser-window-options.ts`。
- 規約: `discussion/development_convention/{source-file-organization-policy.md, testing-and-acceptance-policy.md}`。

## 4. Review Policy(WS1 より厚め・実ロジックあり)

WS2 は実ロジック + セキュリティ面があるため 2 レーン(clean-context)+ final clean integration 兼任:

- **Lane A: 契約・正しさ** — node アダプタがポート意味論を満たすか(fake と同じ契約テストを通す)、エラー正規化(`ENOENT`→`NotFoundError` 相当が `isMissingHandleError` に握られる)、temp+rename、round-trip(save→open で同一 PackageDocument)、stale 非削除・全 upsert の踏襲。
- **Lane B: IPC・セキュリティ境界** — main 側 root prefix パス境界(traversal 拒否)、`contextIsolation:true`/`nodeIntegration:false` 維持、renderer が preload ブリッジ以外で node に触れないこと(boundary guard 維持)、preload が最小 API のみ露出。
- 判定: `pass` / `needs_fix` / `blocked`。fix ループ上限5。

## 5. Wave Strategy

1波・1実装ドメイン(**Domain A: persistence-over-ipc**)。アダプタ + preload ブリッジ + main ハンドラ + picker 注入配線は密結合のため 1 Gnome に集約。分割は調整コスト過多。

## 6. Domain A: persistence-over-ipc

**Purpose**: `workspace-directory-io` のポートを node:fs-backed で実装し、Electron 版 picker を Provider に注入。Electron 上で新規/既存ワークスペースの保存・ロードが node:fs 経由で回る状態にする。

**Allowed write scope**:
- 新規: node:fs-backed の `WorkspaceDirectoryHandleLike` ツリーアダプタ(renderer 側)、IPC ブリッジ(channels/contract/preload 露出/main ハンドラ)、main の fs 実体(readdir/readFile/writeFile+mkdir+temp-rename/dialog/パス境界)。
- 変更: WS1 の最小 preload(`src/preload/preload.ts`)へ IPC ブリッジ露出を追加。**composition-root の picker 注入配線**(Electron コンテキスト検出 → `workspaceDirectoryPicker` に Electron picker を注入。Provider 自体・その内部ロジックは変えない)。
- テスト: アダプタ契約テスト、round-trip(save→open 同一性)、temp+rename の中断シミュレーション(部分 `.tmp` が本ファイルを壊さない)、パス traversal 拒否、IPC ハンドラの pure-logic テスト。

**Forbidden write scope**:
- `workspace-session-storage.ts` / `runtime-export-directory.ts` の**消費側ロジック**、save-plan / digest / package-format。
- Provider の内部ロジック、renderer UI(`src/app/**`・`src/workspace/**` のアプリコード)、保存形式。
- FS Access の web 経路の**除去**(WS3)、portable(WS3)、E2E(WS4)、再起動後の自動復帰(スコープ外)。

**Required tests / evidence**:
- node アダプタが fake と同じポート契約テストを通過。
- round-trip: 保存 → 別ハンドルで開く → PackageDocument 同一。
- temp+rename: 書き込み中断で本ファイルが旧内容のまま(または新内容)、ゴミ半端にならない。
- パス境界: root 外への `..` traversal を main が拒否。
- 自動ゲート: `typecheck`(WS2 新規ファイルにエラーゼロ。既存の先在赤は `task_c8fc5155`)/ `electron:build` / `test:unit`(WS2 新規テスト緑)/ source-organization / dep-check。

**Early escape triggers**:
- 消費側(`workspace-session-storage.ts` 等)が picker 注入以外の改変を要求する → 無改造前提の破れ、停止。
- save-plan がクロスファイル atomicity に依存すると判明(調査結論と矛盾)→ 停止・再設計。
- ポートのメソッドに node で満たせない意味論が出る → 停止・エスカレーション。

## 7. 実機観測ゲート(手動 smoke ・ユーザー)

`pnpm --filter @private-2d-rigging-lab/editor run electron:dev` で:
1. **新規ワークスペースを選択ディレクトリに保存** → OS のディレクトリダイアログが開く(FS Access のブラウザピッカーでない)。
2. 保存先を**OS のファイラで確認** → `workspace.json` + package ファイル群 + バイナリが**実ファイル**として存在。
3. エディタを閉じ、**同ディレクトリから開き直す** → 同じモデルが復元、パラメータ編集も保持。
4. 既存(WS1 時に FS Access で作った)ワークスペースも開ける。
5. コンソールエラーなし、boundary guard 緑。

## 8. Install 境界

新規依存は原則不要(electron/node は WS1 で導入済み)。もし要れば Undine(L0)が `pnpm install`。

## 9. Expected Persistent Artifacts

- `persistence/ws2-domain-report.md`(実装 / 自動ゲート / 実機観測手順 / residual)
- `persistence/ws2-review.md`(Lane A/B + final clean integration)
- `persistence/_map.md` status 更新。

## 10. Orchestration Policy(薄い契約)

- **Undine**: 計画・判定を所有、在席ポーリング、**source を書かない**。install は L0 が実行。
- **Orch-Sylph**: persistence ドメインのループを1本。実装を Gnome、レビューを Review-Sylph ×2 へ委任。自分で実装・レビューしない。
- **Gnome**: 実装のみ。環境操作(install)はエスカレーション。
- **Review-Sylph**: 計画 + 設計 + 写経元 + diff + テスト証拠のみで検証(clean context)。
- `Agent` の `model` は毎回明示。

## 11. Out of Scope

FS Access web 経路の除去(WS3)、portable 廃止(WS3)、E2E `_electron` 化(WS4)、再起動後の自動復帰、保存形式変更、renderer UI 変更。
