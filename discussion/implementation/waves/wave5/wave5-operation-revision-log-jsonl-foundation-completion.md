# Wave 5 Domain A Completion: operation revision log JSONL foundation

> Wave: `package-persistence-and-operation-log-foundation`
> Domain: `wave5-operation-revision-log-jsonl-foundation`
> Main module: `packages/operation-core`
> 日付: 2026-05-29
> Verdict: `pass`

## 1. 変更ファイル

- `packages/operation-core/src/package-revision.ts`
  - package revision policy helper を追加。
- `packages/operation-core/src/operation-log-jsonl.ts`
  - `OperationLogEntryDto` の JSONL serialize / parse codec を追加。
- `packages/operation-core/src/lifecycle/commit.ts`
  - committed mutation 成功後、evidence provider / operation log entry 作成前に `session.packageRevision` を 1 回だけ increment。
- `packages/operation-core/src/lifecycle/dry-run.ts`
  - dry-run candidate session に temporary `basePackageRevision + 1` を適用し、original session は変更しない。
- `packages/operation-core/src/index.ts`
  - public barrel re-export のみ追加。
- `packages/operation-core/src/operation-lifecycle.test.ts`
  - commit / dry-run / stale base revision / duplicate rejection / unsupported operation の revision and log behavior を検証。
- `packages/operation-core/src/operation-evidence.test.ts`
  - evidence provider が dry-run / commit candidate revision `base + 1` を受け取ることを検証。
- `packages/operation-core/src/operation-log-jsonl.test.ts`
  - JSONL roundtrip、empty log、invalid JSON、schema invalid line、blank line rejection を検証。
- `packages/operation-core/src/minimal-operation-fixture.test.ts`
  - fixture commit 後の package revision increment を検証。
- `packages/operation-core/src/runtime-validation-evidence-fixture.test.ts`
  - Wave 5 revision policy に合わせて runtime evidence candidate artifact refs を `r1` として検証。
- `discussion/implementation/waves/wave5/wave5-operation-revision-log-jsonl-foundation-completion.md`
  - この完了報告。

## 2. 実装サマリ

- `incrementCommittedPackageRevision(session, basePackageRevision)` を追加し、commit 成功 path で `session.packageRevision` を `base + 1` に進めるようにした。
- increment は handler の committed mutation 成功後、`applyOperationEvidence` と `createOperationLogEntry` より前に実行する。
- rejected request、unsupported operation、precondition failure は revision increment と log append の前に return するため、package revision / authoring revision / operation log を変更しない。
- `applyDryRunCandidatePackageRevision` は dry-run candidate session のみ `base + 1` にし、original session と同一 object には適用しない guard を持つ。
- `serializeOperationLogEntriesToJsonl` は 1 entry = 1 JSON line として末尾 newline 付きで出力する。empty log は empty string。
- `parseOperationLogEntriesFromJsonl` は各 line を `JSON.parse` 後に `OperationLogEntrySchema.safeParse` へ通し、invalid JSON、schema invalid line、blank line を拒否する。

## 3. テストと検証

| Command | Result |
|---|---|
| `pnpm exec vitest run packages/operation-core/src` | pass。sandbox では `node_modules/.../vitest.mjs` 読み取りが EPERM になったため、外部権限で再実行。7 files / 25 tests pass。 |
| `pnpm typecheck` | fail。`packages/runtime-core/src/index.ts(13,1)` の `RuntimeEvaluationContextInput` / `RuntimeSequenceFrameInput` re-export ambiguity と、`packages/runtime-core/src/runtime-state-sequence-artifacts.ts(111,48)` の `label: string \| undefined` exact optional property error。Domain A 許可範囲外かつ parallel domain 由来のため未修正。 |
| `pnpm check:source` | pass。 |
| `pnpm check:deps` | pass。 |
| `git diff --check -- packages/operation-core/src discussion/implementation/waves/wave5/wave5-operation-revision-log-jsonl-foundation-completion.md` | pass。LF/CRLF warning のみ。untracked new files は trailing whitespace `rg` でも no matches。 |
| `rg '@private-2d-rigging-lab/(package-format\|runtime-core\|validator-core\|editor-ui\|viewer-ui\|renderer-adapter\|ai-interface)' packages/operation-core/src -n` | pass。no matches。 |
| `rg '../../(package-format\|runtime-core\|validator-core\|apps\|editor-ui\|viewer-ui\|renderer-adapter\|ai-interface)' packages/operation-core/src -n` | 既存 Wave 4 fixture test の `runtime-core` / `validator-core` relative imports を検出。production source への追加 import ではない。 |

## 4. Boundary Checks

- production `operation-core` は `package-format` / `runtime-core` / `validator-core` / GUI / AI / renderer / transport を import していない。
- `operation-core` は package file writing、filesystem IO、zip/archive、package-format schema parse を行っていない。
- JSONL codec は operation log DTO owner として `OperationLogEntrySchema` だけを使う。
- `packages/package-format/**`、`packages/authoring-core/**`、`packages/runtime-core/**`、`packages/validator-core/**`、`packages/contracts/**`、`fixtures/**`、`apps/**`、`pnpm-lock.yaml` は編集していない。
- `runtime-validation-evidence-fixture.test.ts` の relative runtime / validator imports は Wave 4 から存在する test-only integration fixture 境界で、今回 production dependency は増やしていない。

## 5. Source Organization Notes

- `index.ts` は re-export のみを維持。
- package revision policy は `package-revision.ts`、operation log JSONL codec は `operation-log-jsonl.ts` に分離。
- lifecycle は既存の `lifecycle/commit.ts` / `lifecycle/dry-run.ts` に順序変更だけを追加。
- JSONL tests は codec 専用、revision lifecycle tests は lifecycle / evidence fixture に分けた。
- catch-all `utils.ts` / `helpers.ts` / broad schema file は追加していない。

## 6. 残リスク

- global `pnpm typecheck` は parallel domain の `runtime-core` error で未完走。Domain A の targeted tests、source guard、dependency guard は pass。
- `fixtures/contracts/minimal-operation-runtime-evidence` の expected JSON は forbidden scope のため更新していない。operation-core test 側で Wave 5 の temporary / committed candidate revision `base + 1` に合わせて期待値を補正している。後続 Domain F の persisted fixture で durable artifact expected を固定する必要がある。
- JSONL codec は in-memory string codec まで。`operations/log.jsonl` への package file set 接続は package-format / integration fixture 側の責務として未実装。
