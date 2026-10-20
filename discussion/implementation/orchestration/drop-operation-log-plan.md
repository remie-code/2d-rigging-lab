# 操作の記録をやめる 実装計画

状態: Draft（ユーザー確認待ち）。2026-10-20。ブランチ `package-format/drop-operation-log`（master 9ddb5c1e から）。
Basis: [../../design/drop-operation-log.md](../../design/drop-operation-log.md)（判断）。棚卸し: 2026-10-20 の Sylph 調査 2 本（計測、参照箇所の地図）。

## 進め方

- 軽量方式で進める。各 wave で Gnome 1 名がテスト込みで実装・自己検証し、wave の終わりに Sylph（sonnet）1 レーンで突き合わせる。
- Gnome はコミットしない。L0 が wave ごとにコミットする。`pnpm install`・新規依存・lockfile の変更は禁止。
- wave は直列で進め、各 wave の終わりで全テストが通る状態を保つ。
- レビューは `discussion/implementation/reviews/drop-operation-log/` に置く。

## Wave 1: テクスチャ判定の無駄な複製をなくす（packages/package-format）

- `package-binary-file-set.ts` の `readPackageBinaryFileEntry` / `verifyPackageBinaryAssetBytes`（必要なら `computePackageBinarySha256Digest`、`getPackageBinaryByteLength`）が、呼ぶたびに全エントリを複製しないようにする。
- 現在は副作用として、未正規化の配列に対するパスの安全性と重複の検査を行っている。これを維持する（一度だけ検査する、検査済みの集合を受け取る、など）。
- 返すバイトを呼び出し側の変更から隔離する性質も、必要なところでは維持する。
- `workspace-save-plan.ts` の候補ごとの判定で、全集合の複製が起きないこと。
- 関連テスト（`package-binary-file-set.test.ts` など 18 ファイル）を通す。複製が二乗にならないことを確かめるテスト（呼び出し回数や計算量の上限）を 1 本追加する。
- **完了条件:** `pnpm check` 相当（typecheck、test:unit、check:deps、check:soul-zone）、`pnpm typecheck:authoring-host`、`pnpm test:authoring-host` が通る。既知の担当外失敗 2 件（`state-directory-guard` と check:source の runtime-player）は除く。

## Wave 2: 記録という概念を撤去する（コードとテスト用データ）

- **operation-core**
  - 撤去するもの:
    - `operation-log-entry.ts`、`operation-log.ts`、`operation-log-jsonl.ts`
    - commit の記録生成・追記（同期・非同期の両方）
    - `CommitOperationOutcome.logEntry` / `operationLogLength`
    - `OperationCore.operationLog` / `initialOperationLogEntries`
    - 記録のためだけの transactionId と precondition 集計
    - tutorial recipe の `operationLogEntries`
  - result と modelDiff は残す。
- **package-format:** manifest schema から `operationLog` を削る。`package-file-set.ts` の `operationLogText` を撤去する。
- **authoring-core:** 新規 manifest の `operationLog`（`package-document-from-authoring-session.ts`、`tutorial-mini-model-seed.ts`）を撤去する。
- **apps/authoring-host:**
  - 読み込み・保存・host から記録を撤去する（`package-directory-io.ts`、`run-authoring-host-command.ts`、`authoring-host-command-host.ts`）。
  - 既存の `operations/log.jsonl` は読まない、書かない、消さない。
  - `MATERIAL_COMMANDS.md` の記録への言及を直す。
- **ai-interface:**
  - `getOperationLog`（コマンド名、payload、response、`ai-operation-log-query.ts`、read command の dispatch、executor）を撤去する。
  - `evidenceRefs` の `operations/log.jsonl#<id>` を撤去する。
  - `operationLogPresent` の受け渡しと、codex-proposal の lifecycle の記録参照を撤去する。
- **contracts:** codex-proposal の artifactRef / evidenceKind の `operationLog`、product-preflight の artifactKind `operationLog` を撤去する。
- **validator-core:**
  - `evidence.operationLogPresent` / `operationLogPath`、`CANONICAL_OPERATION_LOG_PATH` を撤去する。
  - `evidence.guiOperationLogMissing`（check catalog）と `requiresGuiOperationLog`（profile）を撤去する。
  - tutorial-readiness と product-preflight の記録参照を撤去する。
- **apps/editor:** texture-atlas テストの `logEntry` 検査を直す。
- **テストと期待値:**
  - 記録に依存するテスト（約 50 ファイル）を直す。
  - `fixtures/` の期待値（約 60 ファイル）を更新する。
  - `package-normalization.ts` の記録の扱いを直す。
- **撤去の確認:** apps / packages / fixtures に記録の概念（`operationLog`、`log.jsonl`、`OperationLogEntry`、`getOperationLog` 等）が残っていないことを grep で確かめる。
- **新しいテスト:**
  - 記録ファイルと manifest 欄を持つ既存パッケージを開いて保存できる。記録ファイルは読まれず、バイトが変わらず残る。manifest からは欄が消える。
  - 記録ファイルの無いパッケージを新規作成・保存できる。
- **完了条件:**
  - Wave 1 と同じテスト群が通る。
  - 実モデルを**一時ディレクトリへ複製したもの**（元は変更しない）で、`addDrawableFromImage` の dry-run と API の commit の所要時間を計測し、記録する（目安: それぞれ 5 秒前後）。
  - API の commit 後、`operations/log.jsonl` が変化していないこと。

## Wave 3: 文書（L0）

- **直接改めるもの**（判断 7）:
  - 受け入れ基準 AC-ROOT-002 から「operation log」を外す。
  - `development_convention/operation-policy.md` の DEC-OP-001 / 002 / 004 / 006 と、必須（Commit must append…）・禁止（Commit without operation log）の項目。
  - `model-authoring/premises/operating-policies.md` の git の節の記述。
- **Superseded 注記を入れるもの:**
  - `module-boundary-policy.md`、`schema-and-id-conventions.md`、`diagnostic-policy.md`
  - GUI・テスト・E2E・AI assistant・review・runtime の各実装ポリシー
  - `basis/`
  - `design/mvp-authoring-runtime/01-open-model-package-design.md`
  - `design/module-contracts/`（package-file-format、operation、ai-command、gui-operation、validator、fixtures、traceability）
  - `discussion/tests/` の該当箇所
  - README の operation-core の一行
- 各 `_map.md` を更新する（design、implementation/orchestration、reviews）。
- completion を `discussion/implementation/waves/drop-operation-log/completion.md` に置く。

## 後続（この計画の外）

1. technique-catalog ブランチを master にリベースする。
2. 顎下の影の続き（首でクリッピング、描画順の確認、正面と上向きの比較）を行う。
