# Wave 5 Domain E レビュー: Validation Report Artifact Materializer

> Review target: `wave5-validation-report-artifact-materializer`
> Completion report: `discussion/implementation/waves/wave5/wave5-validation-report-artifact-materializer-completion.md`
> Reviewer: Review-Sylph
> Review date: 2026-05-29
> Verdict: `pass`、非ブロッキングの test coverage note あり

## 所見

### Blocking

なし。

### Non-blocking

1. `reportId` 不正値の reject を明示する negative test がない。
   - 根拠: `packages/validator-core/src/validation-report-artifacts.ts:31` は `ValidationReportIdSchema` で `reportId` を検証している。さらに `packages/contracts/src/ids.ts:24-27` / `packages/contracts/src/ids.ts:43` により ID は `val_[A-Za-z0-9_-]+` に制限され、`/`、`\`、`..` などの traversal token は通らない。
   - Coverage gap: `packages/validator-core/src/validation-report-artifacts.test.ts:28-31` は正常系の artifact path を確認しているが、`createValidationReportArtifactPath("bad/id")` や `val_` prefix なし ID が throw されることは直接確認していない。
   - 影響: production code は shared schema parse を通しているため非ブロッキング。将来 package writer 統合点として使われる場合は focused negative test を追加するとよい。

## Design / Development Compliance Review

判定: pass。

- Artifact path は `validation/reports/<reportId>.validation.json` の package-relative path になっている: `packages/validator-core/src/validation-report-artifacts.ts:16-18`、`packages/validator-core/src/validation-report-artifacts.ts:28-33`。
- Path 構築前に `ValidationReportIdSchema.parse` で report ID を検証している: `packages/validator-core/src/validation-report-artifacts.ts:31`。
- Artifact content は `ValidationReportSchema.parse` 後に生成される: `packages/validator-core/src/validation-report-artifacts.ts:39`、`packages/validator-core/src/validation-report-artifacts.ts:51`。
- `operationLogPresent=true` の report で canonical `operations/log.jsonl` evidence path を保持できる: `packages/validator-core/src/validation-report-artifacts.ts:18`、`packages/validator-core/src/validation-report-artifacts.test.ts:45-51`。
- JSON output は parsed DTO に対して deterministic。object key を再帰的に sort し、末尾 newline を付ける: `packages/validator-core/src/validation-report-artifacts.ts:53-86`。coverage は `packages/validator-core/src/validation-report-artifacts.test.ts:53-67`。
- Production materializer に package IO はない。production file の import は contracts と validator-core 内 schema に閉じ、戻り値は in-memory `{ path, content, report }`: `packages/validator-core/src/validation-report-artifacts.ts:41-45`。
- `index.ts` は barrel-only を維持している。変更は re-export 1 行のみ: `packages/validator-core/src/index.ts:10`。

## Test Adequacy Review

判定: pass。ただし上記の non-blocking coverage gap あり。

確認済み coverage:

- Report ID に基づく path generation: `packages/validator-core/src/validation-report-artifacts.test.ts:28-31`。
- Artifact content が `ValidationReportSchema` で parse できること: `packages/validator-core/src/validation-report-artifacts.test.ts:34-43`。
- Canonical operation log evidence path の保持: `packages/validator-core/src/validation-report-artifacts.test.ts:45-51`。
- key order が異なる evidence object でも deterministic serialization になること: `packages/validator-core/src/validation-report-artifacts.test.ts:53-67`。
- forbidden implementation/app imports の source scan: `packages/validator-core/src/validation-report-artifacts.test.ts:70-81`。

実行した verification:

| Command | Result |
|---|---|
| `pnpm exec vitest run packages/validator-core/src` | pass。sandbox EPERM 後に権限外で再実行し、4 files / 15 tests passed |
| `pnpm typecheck` | pass。sandbox EPERM 後に権限外で再実行 |
| `git diff --check -- packages/validator-core/src discussion/implementation/waves/wave5/wave5-validation-report-artifact-materializer-completion.md` | pass。`packages/validator-core/src/index.ts` の LF-to-CRLF warning のみ |
| `rg -n "[ \t]+$" packages/validator-core/src/validation-report-artifacts.ts packages/validator-core/src/validation-report-artifacts.test.ts discussion/implementation/waves/wave5/wave5-validation-report-artifact-materializer-completion.md` | trailing whitespace match なし |
| `rg -n "from .*@private-2d-rigging-lab/(authoring-core\|operation-core)\|from .*editor-ui\|from .*ai-interface" packages/validator-core/src` | actual forbidden import match なし |

## Source Organization Notes

- `validation-report-artifacts.ts` は validation report artifact path generation、deterministic JSON serialization、in-memory materialization の単一責務に収まっている。
- `validation-report-artifacts.test.ts` は同じ責務境界を対象にしている。
- `index.ts` は barrel のままで、実装ロジックを含まない。
- broad catch-all file や package writer abstraction は追加されていない。

## 残リスク

- `ValidationReportEvidenceSchema.operationLogPath` は `packages/validator-core/src/validation-report.ts:56-60` で `z.string().optional()` のまま。Wave 5 Domain E の要求は canonical path を保持できることであり、schema enforcement ではないため本レビューでは許容する。将来 `operations/log.jsonl` 以外を禁止するなら contract/schema 更新が必要。
- Deterministic output は `checks`、`repairCandidates`、evidence arrays の DTO array order を保持する。同じ parsed DTO には deterministic だが、配列順が異なる semantically equivalent report を canonical sort する実装ではない。
