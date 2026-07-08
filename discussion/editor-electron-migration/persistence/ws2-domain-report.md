# WS2 persistence / Domain A 完了報告

> 状態: **完了 / pass**(2026-07-08)。自動ゲート緑 + レビュー2本 pass + 実機 smoke 緑(ユーザー確認: 保存・読み込み動作)。
> 権威計画: [ws2-plan.md](ws2-plan.md)。設計: [ws2-design.md](ws2-design.md)。レビュー: [ws2-review.md](ws2-review.md)。

## 1. 実装内容(Domain A: persistence-over-ipc)

既存ポート `WorkspaceDirectoryHandleLike` の裏に node:fs-backed アダプタを実装し、IPC 越しに main の fs を叩く。消費側・save-plan・digest・renderer UI は無改造。

### 新規
| Path | 要点 |
|---|---|
| `src/features/workspace-storage/model/node-fs-backed-directory-handle.ts`(+ `.test.ts` / `-roundtrip.test.ts` / `node-fs-bridge-in-memory.test-support.ts`) | ポートのツリーアダプタ。root+相対パスを保持し各操作を IPC へ。契約/round-trip テスト |
| `.../electron-workspace-directory-picker.ts` | Electron 版 picker(IPC ダイアログ → node:fs-backed handle) |
| `.../node-fs-workspace-error.ts` | エラー正規化(`ENOENT`→`NotFoundError` 相当) |
| `src/main/workspace-fs/`(store / handlers / path-boundary / request-validation) | main 側 fs 実体 + root prefix パス境界 + request 検証 |
| `src/preload/workspace-fs-bridge-{channels,contract,bridge}.ts` | 型付き IPC 5層 |

### 変更(配線・Allowed 内)
| Path | 要点 |
|---|---|
| `src/app/editor-app.tsx` | composition-root で Electron picker を `workspaceDirectoryPicker` に注入(Electron 検出時)。Provider 内部・UI は不変 |
| `src/main/editor-main.ts` | main fs ハンドラ登録 |
| `src/preload/preload.ts` | WS1 の空 preload にブリッジ露出を追加 |

消費側(`workspace-session-storage.ts` 等)・save-plan・package-format・renderer アプリコードは **git diff で変更ゼロ**(Lane A 確認)。

## 2. 自動ゲート結果(Undine L0 再確認)

- `electron:build` → **緑**(main 10 modules / preload 1.24kB / renderer 2317 modules)。
- `test:unit` → WS2 新規テスト全緑、失敗は**既知の先在4件のみ**(`diagnostics-jump-actions.test.ts`, `task_c8fc5155`)。
- `typecheck` → **WS2 新規ファイルにエラーゼロ**(先在の赤は不変)。
- `check-source-organization` / `check-dependencies` → passed(Lane 検証)。

## 3. レビュー → pass / pass

Lane A(契約・正しさ)/ Lane B(IPC・セキュリティ境界)とも独立 clean-context で **pass**。詳細と残差は [ws2-review.md](ws2-review.md)。

## 4. 実機観測ゲート(手動 smoke ・ユーザー)

`pnpm --filter @private-2d-rigging-lab/editor run electron:dev` で:
1. **新規ワークスペースを選択ディレクトリに保存** → OS のディレクトリダイアログが開く(ブラウザピッカーでない)。
2. 保存先を**OS ファイラで確認** → `workspace.json` + package ファイル群 + バイナリが**実ファイル**で存在。
3. 閉じて**同ディレクトリから開き直す** → 同じモデルが復元、パラメータ編集も保持。
4. 既存(WS1 時に FS Access で作った)ワークスペースも開ける。
5. コンソールエラーなし、boundary guard 緑。

→ **pass**(2026-07-08、ユーザー確認: Electron アプリ起動 → 保存・読み込み動作)。

## 5. 残差(非ブロッキング)

- 設計残差(accepted): symlink(realpath 非使用)/ 種別衝突(同名 dir → missing 丸め)。
- テスト強化候補(任意): 非 ENOENT 伝播の反証 / rename 前クラッシュ直接注入 / 実 IPC structured-clone 往復 / Windows UNC・drive-relative 境界。
- 詳細は [ws2-review.md](ws2-review.md)。

## 6. プロセス注記

最初の Orch-Sylph はレビュー2本を放った直後に裁定前終了(ターン枯渇)。その2レビュー子は生き残り独立 pass/pass。Undine が起こした recovery Orch は冗長のため停止。**Undine(L0)が両判定を裁定 + 自動ゲートを再確認**して確定。

## 7. 次

実機 smoke 通過で WS2 クローズ。以後 WS3(Web 退役)/ WS4(E2E `_electron` 化)が並行可能。
