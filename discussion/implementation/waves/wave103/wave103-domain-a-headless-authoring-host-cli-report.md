# Wave103 Domain A Report: Headless Authoring Host CLI

- Domain id: `wave103-headless-authoring-host-cli`
- Status: **pass**
- Orchestrator: Orch-Sylph (opus) / Implementer: Gnome (opus) / Reviewers: Review-Sylph x3 (opus)
- Date: 2026-07-02
- Source of truth: [../../orchestration/wave103-plan.md](../../orchestration/wave103-plan.md) §3.1, §6, §9

## 1. Outcome Summary

open-model-package-v1 をディスクから読み、ai-interface の `AiCommandExecutor` 経由で operation を dry-run → 自動承認 → commit し、ディスクへ保存し直すワンショット CLI ホスト `apps/authoring-host` を新設した。実装ループ 1 回（修正再委任 0 回）、レビュー 3 レーン全 pass。

**最重要実証（api-requirements.md の残不確実性の解消）**: keyform set 未存在からの `editKeyformKey action:"createEndsCenter"` 単独実行は**動作する（committed）**。事前 `keyformSets: []` を明示アサート → 単独実行 → 新規 keyformSet 1 件・3 キー（parameter の min/default/max に対応する `[{-1,0},{0,0.5},{1,1}]`）生成をアサートするテストで実証（`apps/authoring-host/src/closed-problem-01-smoke.test.ts:132-181`）。前提条件として parameter の min/default/max は相異なる値である必要がある（同値は `operation.editKeyformKey.duplicateKey` で reject。既存仕様どおりの重複キー防御であり欠陥ではない）。

## 2. Changed / Added Files

新規 `apps/authoring-host/`:

- `package.json`, `tsconfig.json`, `vitest.config.ts`
- `workspace-source-resolver.mjs`, `register-workspace-source-resolver.mjs`（install なしで workspace ソース + hoisted zod を解決する node resolver hook）
- `src/cli.ts`（ワンショット CLI エントリ: JSON in（ファイル/stdin）→ JSON out（stdout）、exit code: success=0 / error=1 / rejected=2）
- `src/cli-arguments.ts`
- `src/run-authoring-host-command.ts`（load → executor → 自動承認 → commit → save のオーケストレーション）
- `src/authoring-host-command-host.ts`（`AiOperationCommandHost` 実装: AuthoringSession 構築 + operation-core registry 経由 dryRun/commit）
- `src/authoring-host-response.ts`, `src/host-state-store.ts`（`--state-dir` への承認状態 / transcript 永続化）, `src/package-directory-io.ts`（Node fs load/save: テキスト JSON 群 + バイナリアセット）
- `src/test-support/authoring-host-fixtures.ts`（rights-clean 合成フィクスチャ）, `src/test-support/command-builders.ts`, `src/test-support/package-normalization.ts`
- テスト 3 本: `src/run-authoring-host-command.test.ts`, `src/cli-cross-process.test.ts`, `src/closed-problem-01-smoke.test.ts`

`packages/ai-interface/`（allowed scope 内の狭い追加のみ）:

- `src/ai-auto-approval-policy.ts`（新規: `DiagnosticGatedAutoApprovalPolicy` — ブロッキング診断なしの場合のみ機械承認。`humanApprovalOperationTypes` による人間承認ダイヤル維持）
- `src/ai-auto-approval-policy.test.ts`（新規）
- `src/index.ts`（barrel 1 行追加のみ）

ルート `package.json`: scripts 2 行追加のみ（`test:authoring-host`, `typecheck:authoring-host`）。依存追加なし・lockfile 無変更（git diff 0）。

Conditional write scope（package-format / authoring-core / operation-core）は**未使用**（read のみ）。Forbidden scope への書き込みなし。

## 3. Test Results（Orch-Sylph が独立再現済み）

- `pnpm run test:authoring-host`: **3 files / 8 tests 全パス**
- `npx vitest run packages/ai-interface`: **14 files / 88 tests 全パス**（dependency-boundary.test.ts 含む・無変更・非緩和）
- `tsc --noEmit`（root）+ `tsc --noEmit -p apps/authoring-host/tsconfig.json`: pass
- `node scripts/check-source-organization.mjs`: pass
- `node scripts/check-dependencies.mjs`: fail — ただし `pnpm-lock.yaml:2452` の sha512 integrity ハッシュ内の部分文字列 `cmo3` による**既存の偽陽性**（lockfile は本ドメイン無変更、3 commit 前から存在）。Domain C / ガード保守側の別件。

Required tests 7 項目の充足（Test Adequacy レビューで全項目「実装済み・実質的」と判定）:

| # | Required test | 状態 |
|---|---|---|
| 1 | load → save 往復 | pass（正規化は時刻系のみ） |
| 2 | createParameter dry-run → 自動承認 → commit → save → reload | pass |
| 3 | 不正 payload → 診断・非承認・commit `needs_approval` 拒否 | pass |
| 4 | 別プロセス跨ぎの承認引継ぎ | pass（実 `child_process.spawn` による別 OS プロセス、成功系 + 拒否系） |
| 5 | 閉問題 01 スモーク（5 operation）+ createEndsCenter 単独実証 | pass |
| 6 | 決定論（同一入力 2 回 → 正規化後一致） | pass |
| 7 | transcript / 承認状態がパッケージ外 | pass（パッケージ内不存在の否定アサート付き） |

正規化した非決定フィールド一覧: `manifest.json` の `updatedAt` / `createdAt`、`workspace.json` の `updatedAt` / `createdAt`、`operations/log.jsonl` 各エントリの `timestamp`。バイナリはバイト長要約で比較。CLI 実行自体は `now` 固定（既定 `2026-07-02T00:00:00.000Z`）で決定化可能。

## 4. Review Verdicts（3 独立レーン、すべて Review-Sylph / opus / 最終状態のソースに対して実施）

| Lane | Verdict | Blocking | Major | Report |
|---|---|---|---|---|
| Spec Compliance | pass | 0 | 0 | [../../reviews/wave103/wave103-domain-a-spec-compliance-review.md](../../reviews/wave103/wave103-domain-a-spec-compliance-review.md) |
| Design / Development | pass | 0 | 0 | [../../reviews/wave103/wave103-domain-a-design-development-review.md](../../reviews/wave103/wave103-domain-a-design-development-review.md) |
| Test Adequacy | pass | 0 | 0 | [../../reviews/wave103/wave103-domain-a-test-adequacy-review.md](../../reviews/wave103/wave103-domain-a-test-adequacy-review.md) |

§9 の Domain A 明示確認 5 項目（ライフサイクル非緩和 / 自動承認 = ブロッキング診断なしの場合のみ / パッケージ外 state のプロセス跨ぎ / 01 スモーク + createEndsCenter 実証 / dependency-boundary 非緩和）はすべて証拠パス付きで PASS。

## 5. Orchestration Loop Record

- 実装委任: 1 回成立（+ 起動不成立と誤認した再試行 2 回、下記 §6）。修正ループ: 0 回（レビュー 3 レーンとも needs_changes なし）。
- Escalate 事由: 発生なし（createEndsCenter は動作、package-format / authoring-core / operation-core の挙動変更不要、バイナリ load 形態は Editor 保存物と一致）。

## 6. Concurrency Incident Record（衝突の有無と対処）

- Gnome の起動が 2 回「不成立」と観測され（トランスクリプト出力 0 バイト、コーディネーター側でも子が非観測）、L0 指示によりフォアグラウンドで 3 回目を起動した。実際には先行バックグラウンド 2 体は稼働しており、`apps/authoring-host/**` と `ai-auto-approval-policy.{ts,test.ts}` の初期実装（mtime 22:08-22:17 の書き込み）は先行分の成果だった。両先行エージェントは停止済み。
- フォアグラウンド Gnome（正）は先行分の上でテスト・fixtures・配線修正を行い全件グリーンに到達。Gnome 自身も作業中に「ディレクトリ消滅→再出現」を観測したが、最終状態は安定。
- 対処: フォアグラウンド分を正とし、作業ツリーを突合検査（想定外ファイルなし、`node_modules` は vitest キャッシュのみ、lockfile 無変更）。レビュー 3 レーンは書き込み静止後の最終状態に対して実施。実害（重複実装・矛盾コンテンツ）は残っていない。

## 7. Discretionary Decisions（裁量判断）

- **zod の hoisted 解決**（DEV-A-1, minor）: authoring-host は `pnpm install` されない制約下のため、tsconfig paths / vitest alias / node resolver hook の 3 経路で `packages/ai-interface/node_modules/zod` へ解決。依存追加・lockfile 変更なし。Design レビューは「制約下の意図的手段として妥当、ただし脆さは残る」と判定（非 blocking）。正規化（app を install 対象にする）は将来 wave のユーザー/Undine 判断事項。
- 自動承認ポリシーを `packages/ai-interface` に配置（承認ポリシーは ai-interface の責務。fs 依存なし、dependency-boundary ガード下）。
- createDrawable は displayName 由来の id 導出のため、スモークは生成 id を fixture 戻り値経由で参照。明示 id 運用は createParameter 等 id 指定可能な operation で担保。

## 8. Residual Risks / Follow-ups

- (minor A-1/A-2) 存在しないパッケージパスの負ケース、CLI error outcome（exit 1）の実プロセス検証が未整備（error 経路実装済み・単体レベルでは検証済み）。
- (minor A-3) `--state-dir` がパッケージディレクトリ内を指す誤用へのガードが実装・テストともに無い（既定運用は §3.1 遵守）。Wave104 以降でガード追加を推奨。
- (minor DEV-A-1) zod resolver 配線の脆さ（バージョンピン・3 箇所分散）。将来 install 判断で正規化可能。
- (info DEV-A-2/A-3) host-state-store の承認シリアライズが ai-interface ヘルパーと一部重複、transcript ハイドレートの一部が非 zod 検証キャスト。
- (別件) `check-dependencies.mjs` の lockfile 偽陽性（sha512 内 `cmo3`）は Domain C / ガード保守で扱うべき既存問題。

## 9. Basis Coverage

Gnome の Basis Coverage Self-Report を確認済み: operating-policies（ディスク=唯一の真実、パッケージ外 state、ワンショット CLI）、api-requirements（6 操作の呼び出し形、createEndsCenter 実証）、source-file-organization / dependency / operation / schema-and-id 各規約に準拠（ガード + レビューで裏取り）。Deferred: `MESH_GENERATION_METHOD_IDS` 値集合と横幅スケール専用プロパティの確定（Wave104 の知覚/測量面）、判定の梯子 段 3-5（Domain B / Wave104 スコープ）。
