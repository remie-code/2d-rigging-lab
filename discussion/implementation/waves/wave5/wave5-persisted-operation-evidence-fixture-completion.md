# Wave 5 Domain F Completion: persisted operation evidence fixture

> Wave: `package-persistence-and-operation-log-foundation`
> Domain: `wave5-persisted-operation-evidence-fixture`
> 日付: 2026-05-29
> Verdict: `pass`

## 1. 変更ファイル

- `fixtures/contracts/minimal-operation-persisted-package/**`
  - createParameter commit から package file set / operation log JSONL / runtime artifact / validation artifact / reload summary までを固定する text-only fixture を追加。
- `packages/operation-core/src/persisted-operation-evidence-fixture.test.ts`
  - A-E の public API を統合する focused integration test を追加。
- `packages/package-format/src/package-file-set.test.ts`
  - Domain C review の non-blocking note に対応し、absolute path と duplicate path rejection の明示テストを追加。
- `discussion/implementation/waves/wave5/wave5-persisted-operation-evidence-fixture-completion.md`
  - この完了報告。

## 2. Fixture 構造

`fixtures/contracts/minimal-operation-persisted-package/` は次の要約 fixture だけを持つ。

- `fixture-manifest.json`
- `baseline-authoring-input.json`
- `request/create-parameter-commit.request.json`
- `expected/operation-log-jsonl-summary.json`
- `expected/package-file-set-summary.json`
- `expected/runtime-artifact-summary.json`
- `expected/validation-artifact-summary.json`
- `expected/reload-summary.json`

巨大な生成 JSON は fixture に複製せず、package-relative path、ID、entry count、reload 後の parameter / revision だけを expected summary として保持した。

## 3. 統合パス

`packages/operation-core/src/persisted-operation-evidence-fixture.test.ts` で次を接続した。

- `createOperationCore` の `createParameter` commit。
- `serializeOperationLogEntriesToJsonl` / `parseOperationLogEntriesFromJsonl`。
- `toPackageDocument` による committed session -> `PackageDocumentDto` 変換。
- `serializePackageDocumentToFileSet` / `parsePackageDocumentFromFileSet` の package file set roundtrip。
- `toRuntimeGraph`、`buildRuntimeEvidence`、`materializeRuntimeEvidenceArtifacts`。
- `buildRuntimeEvidenceReport`、`materializeValidationReportArtifact`。

確認した主な結果:

- reloaded package document は `param_persisted_smile` と `packageRevision=1` を保持する。
- operation log JSONL entry は runtime snapshot IDs と validation report IDs を保持し、result 側の generated IDs と一致する。
- package file set には `operations/log.jsonl`、runtime snapshot/state/state-sequence artifacts、validation report artifacts が入る。
- runtime generated artifact paths は重複せず、Domain D review の duplicate/missing generated path risk をこの fixture では隠していない。
- package-format の absolute / duplicate unsafe path rejection を test scope で補強した。

## 4. Tests Run

| Command | Result |
|---|---|
| `pnpm exec vitest run packages/operation-core/src/persisted-operation-evidence-fixture.test.ts` | pass。1 file / 1 test。sandbox では Vitest の `node_modules` 読み取りが EPERM のため、権限外で実行。 |
| `pnpm exec vitest run packages/package-format/src/package-file-set.test.ts` | pass。1 file / 6 tests。 |
| `pnpm exec vitest run packages/operation-core/src packages/package-format/src packages/authoring-core/src packages/runtime-core/src packages/validator-core/src` | pass。25 files / 74 tests。 |
| `pnpm typecheck` | pass。 |
| `pnpm check:source` | pass。 |
| `pnpm check:deps` | pass。 |
| `git diff --check -- fixtures/contracts/minimal-operation-persisted-package packages/operation-core/src packages/package-format/src` | pass。LF/CRLF warning のみ。 |
| `rg -n '[ \t]+$' fixtures/contracts/minimal-operation-persisted-package packages/operation-core/src/persisted-operation-evidence-fixture.test.ts packages/package-format/src/package-file-set.test.ts` | pass。末尾 whitespace なし。 |

## 5. Source Organization Notes

- production source は変更していない。
- `index.ts` は触っていない。
- 統合 test は operation-core 側に 1 本追加し、A-E の public API を fixture 境界で束ねる責務に限定した。
- package-format の追加は既存 `package-file-set.test.ts` の path policy regression test だけで、production path logic は変更していない。
- catch-all file、binary asset、proprietary / Cubism asset は追加していない。

## 6. 残リスク

- Fixture は createParameter の最小 happy path を固定する。複数 operation の log append、rollback、migration、archive/OS filesystem writer は Wave 5 Domain F の範囲外。
- `packageHash` は既存 minimal fixture の `sha256:minimal-valid-package-v1` を runtime/validation evidence に流用している。将来、mutated package body から hash を再計算する policy を採用する場合は expected summary 更新が必要。
- `package-format` の generated artifact sort は既存 `localeCompare` の実順を fixture 化している。byte-order canonical sort 方針に変える場合は Domain C 側の contract/implementation 判断が必要。
