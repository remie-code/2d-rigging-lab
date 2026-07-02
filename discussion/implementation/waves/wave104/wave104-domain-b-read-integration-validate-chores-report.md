# Wave104 Domain B Report: Read Integration / Validate / Chores

- Domain id: `wave104-read-integration-validate-chores`
- Status: **complete / pass**（レビュー 3 レーン + 再検証 2 本の全 pass 確定）
- Orchestrator: Orch-Sylph（opus）/ Implementer: Gnome（opus）/ Reviewers: Review-Sylph（opus、独立コンテキスト x5）
- Date: 2026-07-03
- Source of truth: [../../orchestration/wave104-plan.md](../../orchestration/wave104-plan.md) §7（§3.1-2 / §3.7 / §10 / §13 併用）
- Primary basis: [../../../model-authoring/research/evaluation-and-read-path-survey.md](../../../model-authoring/research/evaluation-and-read-path-survey.md) D 節、[../wave103/wave103-final-integration-report.md](../wave103/wave103-final-integration-report.md) §5 A-3 / B-1

## 1. 実装成果の要約

### 1.1 executor read 統合（計画 §3.1-2 の L0 裁定どおり、再実装なし）

- `packages/ai-interface/src/ai-command-executor.ts`: `AiCommandExecutorOptions.readHost?`（optional）を追加し、read 系 9 コマンドのうち `executeAiReadCommand` がサポートする 5 コマンド（getEditorState / inspectModel / inspectTarget / validatePackage / getOperationLog）を孤立機構 `ai-read-command.ts` へディスパッチ。PSD import plan 系 4 コマンドは従来どおり `#unsupportedReadCommand`（not_implemented）へルーティング（read host を通さない）。
- transcript 二重記録の回避: executor は自身の transcript を `executeAiReadCommand` に渡し、executor 側で重ねて記録しない（レビューで「exactly once」を assert するテストを確認済み）。
- read host 未注入時は legacy not_implemented payload にフォールバック（一貫性維持）。
- `packages/ai-interface/src/ai-read-command.ts`: getEditorState / getOperationLog の optional メソッド化拡張のみ。capability チェック（validatePackage=`validate`、他 read=`read`）・承認系は無変更。
- **dryRunOperation / commitOperation / 承認ポリシー / dependency-boundary は一切無変更**（Spec Compliance レーンが diff で実証）。

### 1.2 validatePackage host 実装（document-only オーケストレーション）

- `apps/authoring-host/src/validate-package-document.ts`: PackageDocumentDto に対して実行可能な document-only バリデータ 10 本（validator-core の公開 API のみ消費、editor ロジック非依存）を実行し `buildValidationReport` で `{reportId, report}` に集約。profile は payload の `ValidationProfileSchema` に従う。
- evidence は `createDefaultEvidence()` により runtime 証拠なし（`operationLogPresent: false` / `runtimeSnapshotIds: []`）を**明示**——runtime snapshot 証拠を要するバリデータ（viewer-evidence / runtime-evidence 系）は Domain B スコープ外であり、カバレッジを正直に表現する。
- `apps/authoring-host/src/authoring-host-command-host.ts`: `AiReadCommandHost` の `validatePackage` を実装。他 read メソッドは未実装のまま（機構が not_implemented を返すことをテストで確認）。
- disk 書き込みの副作用なし（validate は dry-run / commit / save をしない——before/after スナップショット一致テストで実証）。
- CLI からの validate 到達: exit code / JSON 応答で成立（`validate-package-command.test.ts`）。

### 1.3 state-dir ガード（Wave103 引き継ぎ A-3）

- `apps/authoring-host/src/state-directory-guard.ts`: 純関数のパス正規化ガード（同一 / 子孫を reject。win32 では case-insensitive 比較）。
- 二層検査: cli-arguments parse 時 + `run-authoring-host-command.ts` 冒頭（IO 前 reject）。CLI では exit code 1 + error outcome。
- テストは reject（同一 / 浅い・深い子孫 / 相対表記ゆらぎ）と許容（兄弟 / prefix 共有非 nested / 親）の両方向を網羅。

### 1.4 B-1 テスト（Wave103 引き継ぎ、render-software テストのみ）

- `packages/render-software/src/raster/out-of-range-triangle-index.test.ts`（4 tests）: 負 index / vertexCount 超過 / 全 index 無効 / 有効+無効混在をピクセルレベルで決定論的に検証。混在ケースは vacuous pass 防止の sanity assert 付き。**描画コードは無変更**。

### 1.5 変更・追加ファイル（Domain B 分）

| ファイル | 種別 |
|---|---|
| `packages/ai-interface/src/ai-command-executor.ts` | M（read dispatch 追加。承認系無変更） |
| `packages/ai-interface/src/ai-read-command.ts` | M（optional メソッド化拡張） |
| `packages/ai-interface/src/ai-executor-read-integration.test.ts` | 新規（統合テスト 6） |
| `packages/ai-interface/src/index.ts` | M（barrel、B 関連分） |
| `apps/authoring-host/src/authoring-host-command-host.ts` | M（AiReadCommandHost 実装） |
| `apps/authoring-host/src/run-authoring-host-command.ts` | M（read host 注入 + ガード、B 関連分） |
| `apps/authoring-host/src/cli-arguments.ts` | M（state-dir ガード配線） |
| `apps/authoring-host/src/test-support/command-builders.ts` | M（B 関連分） |
| `apps/authoring-host/src/state-directory-guard.ts` / `.test.ts` | 新規（ガード + 11 tests） |
| `apps/authoring-host/src/validate-package-document.ts` / `.test.ts` | 新規（オーケストレーション + 3 tests） |
| `apps/authoring-host/src/validate-package-command.test.ts` | 新規（CLI/host 経路 4 tests） |
| `apps/authoring-host/package.json` | M（workspace 依存 4 件追加、B 関連分） |
| `packages/render-software/src/raster/out-of-range-triangle-index.test.ts` | 新規（B-1、4 tests） |

注: `ai-command-executor.ts` / `run-authoring-host-command.ts` / `apps/authoring-host/tsconfig.json` / `package.json` には並行 Batch 1 の Domain A（perception / renderView 系）の変更が共存する。本報告とレビューは Domain B 変更分のみを対象とし、全体整合は Domain D の管轄（L0 裁定 2、§4 参照）。

## 2. テスト結果（既存テスト非退行の明示）

install 解消後の確定値（再検証レーン実測、Orch-Sylph は原本レポートで確認）:

| スイート | 結果 | 非退行 |
|---|---|---|
| `packages/ai-interface` | 101 passed / 16 files / 0 failed | **既存 88 全 pass・テストファイル無改変**（git diff で実証）。承認ライフサイクル系（approval-lifecycle 6 / ai-operation-command 11）全 pass。dependency-boundary テスト無変更・pass。101 = 既存 88 + Domain B 新規 6 + Domain A 新規 7 |
| `apps/authoring-host`（root から `npx vitest run --root apps/authoring-host`） | 9 files / 37 tests 全 pass | 既存 8 tests 非退行（cli-cross-process の dry-run approval carry / commit refusal 含む）。37 = 既存 8 + Domain B 18 + Domain A 11 |
| `packages/render-software` | 37 passed / 7 files | 既存 33 非退行 + B-1 4 |
| `npx tsc --noEmit`（root） | exit 0 | install 後も維持 |

authoring-host 全体 typecheck（app tsconfig）は Domain A 未完了ファイル由来の exit 2 が残るが、L0 裁定 1 により Domain B の判定基準は「Domain B 所有ファイルの型健全性 + root tsc exit 0」であり満たしている（Batch 2/D で全体確認）。

## 3. 環境問題の経緯と解消（needs_fix 2 件の実体）

- **事象**: 初回レビューで Spec Compliance（B-BLOCK-1）と Design・Development（B-DEV-BLOCK-01）が needs_fix。実体は同一の環境問題——`apps/authoring-host/package.json` への workspace 依存 4 件追加が lockfile 未反映で、root config からの vitest 実行が依存解決失敗（8 suites load error / Domain B テスト 0 実行）。**コード欠陥は 3 レーンとも未検出**。
- **root/app 実行差の真相**: `apps/authoring-host/vitest.config.ts` は workspace パッケージを TS entrypoint に alias しており、app ディレクトリ内実行では従来から green。Gnome の「26 passed」申告はこの経路の実測であり**正当だった**（Test Adequacy レーンが実証。26 = Domain B 18 + 既存 8 と完全一致）。
- **解消**: L0（Undine）が統制下で `pnpm install` を実行（規則上、環境操作は L0/ユーザー統制）。lockfile diff は 12 行追加のみ・全て `apps/authoring-host` importer への `workspace:*` / `link:` 登録で、**外部依存の新規解決追加ゼロ**（Wave103 §3 分類 3 と同じ承認済み分類。再検証 2 レーンが独立に diff を分類確認）。
- install 後、root から 9 files / 37 tests 全 pass を両再検証レーンが再現し、初回保留だった実行証跡（transcript 永続化 / report スキーマ適合 / state-dir reject）を回収。両 blocking を解消して pass 確定。

## 4. レビュー判定一覧

| レーン | 初回 | 再検証後 | アーティファクト |
|---|---|---|---|
| Spec Compliance | needs_fix（B-BLOCK-1 = テスト実行不能。コード欠陥なし） | **pass** | [../../reviews/wave104/wave104-domain-b-spec-compliance-review.md](../../reviews/wave104/wave104-domain-b-spec-compliance-review.md)（再検証セクション追記済み） |
| Design・Development | needs_fix（B-DEV-BLOCK-01 = 同上） | **pass** | [../../reviews/wave104/wave104-domain-b-design-development-review.md](../../reviews/wave104/wave104-domain-b-design-development-review.md)（同上） |
| Test Adequacy | **pass**（blocking 0） | —（再検証不要） | [../../reviews/wave104/wave104-domain-b-test-adequacy-review.md](../../reviews/wave104/wave104-domain-b-test-adequacy-review.md) |

計画 §10 Domain B 明示確認項目の全達成: 承認ライフサイクル・dry-run 強制の非緩和（diff + 非退行テストで実証）/ transcript の read 系記録継続（exactly-once 検証）/ validatePackage report の validator-core スキーマ適合 / state-dir ガード / 既存テスト非退行。

L0 裁定 2 件の適用: ①app tsconfig 全体 typecheck の Domain A 由来エラーは Domain B の blocking にしない（Batch 2/D で確認）②共有ファイルは Domain B 変更分のみ判定、Domain A 作業中コードは対象外。

## 5. プロセス所見（Wave 運用へのフィードバック）

- **Gnome は workspace 依存追加により install が必要になった時点で escalate すべきだった。** 実際には app-local の vitest alias 配線で自前解決して先へ進み、その結果「Gnome 環境では green / レビュー環境（root 実行）では実行不能」という環境差がレビューで初めて露呈し、blocking 2 件と再検証 2 本のコストが発生した。環境操作（install）の必要性検知は、代替配線で凌ぐのではなく即 escalate が正しい（計画 §13 / SKILL ハンドリング規則どおり）。今後の Gnome 委任文では「依存追加で install が必要になる場合は、代替配線で回避せず escalate せよ」を明示すると再発を防げる。

## 6. 残リスク・フォロー候補（すべて非ブロッキング）

Test Adequacy レーンの non-blocking 3 件:

1. **PSD import plan 4 コマンドの not_implemented 明示回帰テストが統合テストファイルに無い**（既存 `ai-psd-import-plan-command.test.ts` 無改変・pass と executor の明示ルーティングで実質担保）。
2. **capability 区別のネガティブ対称ケースが統合層に無い**（非 validatePackage read コマンドを `validate` capability のみで叩く permission_denied。read 機構単体テストで担保済み）。
3. **state-dir ガードの win32 case-insensitive 分岐（`toLowerCase()` 比較）がテスト未網羅**（プラットフォーム依存。低優先度）。

Design・Development レーンの non-blocking: B-DEV-N-01（`cli-arguments.ts` の import 文位置が慣例と異なる。可読性のみ）ほか記録 1 件（レポート原本参照）。

ドメイン間調整事項（Domain D へ）: app tsconfig 全体 typecheck のクリーン確認、共有ファイル（executor / run-authoring-host-command / tsconfig / package.json）の A+B 統合整合。

## 7. Expected Persistent Artifacts

| Artifact | 状態 |
|---|---|
| 本報告書 | 作成済み |
| reviews/wave104/wave104-domain-b-{spec-compliance,design-development,test-adequacy}-review.md | 存在 / 全 pass（再検証追記含む） |
