# Wave 5 Domain C Review: package file set writer foundation

> Review target: `wave5-package-file-set-writer-foundation`
> Reviewer: Review-Sylph
> Review date: 2026-05-29
> Verdict: `pass`（非ブロッキングの test adequacy note あり）

## Findings

### Blocking

- なし。

### Non-blocking

- [T-1] unsafe path rejection の明示テストが一部不足している。`packages/package-format/src/package-file-set.test.ts:67` からのテストは traversal と backslash を直接確認しているが、absolute path と duplicate path の明示ケースはない。実装上は absolute path を `packages/package-format/src/package-file-paths.ts:79` で拒否し、duplicate path を `packages/package-format/src/package-file-paths.ts:56` および `packages/package-format/src/package-file-set.ts:105` から拒否しているため、現時点ではブロッキングではない。将来の regression 防止として、`/abs.json`、`C:/abs.json`、同一 path 重複のテストを追加するとよい。

## Design / Development Compliance Review

- `serializePackageDocumentToFileSet` は `PackageDocumentSchema.parse` 済み document を使い、`manifest.json`、manifest の required model files、optional editor state、asset files を固定順で text entries にしている（`packages/package-format/src/package-file-set.ts:33`、`packages/package-format/src/package-file-set.ts:40`）。
- JSON は key sort と trailing newline 付きで deterministic に出力される（`packages/package-format/src/package-json-serialization.ts:1`）。
- `parsePackageDocumentFromFileSet` は file set 全体を path validate / duplicate reject してから required files を読み、最終的に `PackageDocumentSchema.parse` へ戻している（`packages/package-format/src/package-file-set.ts:74`、`packages/package-format/src/package-file-set.ts:94`）。
- `operationLogText` と `generatedArtifacts` は text entry として path validation だけを通しており、operation / runtime / validator schema parse はしていない（`packages/package-format/src/package-file-set.ts:60`、`packages/package-format/src/package-file-set.ts:64`）。
- production `package-format` に `authoring-core` / `operation-core` / `runtime-core` / `validator-core` import は見つからなかった。
- `packages/package-format/src/index.ts:1` は re-export のみで、barrel-only 要件を満たしている。

## Test Adequacy Review

- `minimal-valid-package` の serialize / parse roundtrip は `packages/package-format/src/package-file-set.test.ts:18` で確認されている。
- manifest 由来の required package paths は `packages/package-format/src/package-file-set.test.ts:26` で確認されている。
- deterministic JSON と trailing newline は `packages/package-format/src/package-file-set.test.ts:48` で確認されている。
- operation log / generated artifact content を schema parse しないことは `packages/package-format/src/package-file-set.test.ts:89` で確認されている。
- unsafe path の直接テストは traversal / backslash に偏っているため、absolute / duplicate は上記 T-1 の follow-up 推奨。

## Verification

| Command | Result |
|---|---|
| `pnpm exec vitest run packages/package-format/src` | pass: 3 files / 11 tests。sandbox では `node_modules/.../vitest.mjs` の EPERM が出たため、権限付きで再実行。 |
| `pnpm typecheck` | pass。completion report に記載された runtime-core の typecheck error は今回の review 実行では再現しなかった。 |
| `git diff --check -- packages/package-format/src discussion/implementation/waves/wave5/wave5-package-file-set-writer-foundation-completion.md` | pass。CRLF warning のみ。 |
| `rg '@private-2d-rigging-lab/(authoring-core\|operation-core\|runtime-core\|validator-core)' packages/package-format/src -g '!*.test.ts'` | pass: no matches。 |

## Source Organization Notes

- responsibility split は明確: path policy は `package-file-paths.ts`、JSON serialization は `package-json-serialization.ts`、file set codec は `package-file-set.ts`、tests は `package-file-set.test.ts`。
- catch-all `utils.ts` / `helpers.ts` / `types.ts` は追加されていない。
- `index.ts` に実装ロジックはない。

## Residual Risks

- operation log と generated artifacts の内容検証は意図的に owner module 側へ残されている。Domain F / integration fixture で operation-runtime-validation evidence の存在と owner schema parse を確認する必要がある。
- duplicate path は case-sensitive に扱われる。将来 filesystem / archive adapter を追加するときは、case-insensitive filesystem 上の衝突方針を別途決める必要がある。
- generated artifact の sort は `localeCompare`（`packages/package-format/src/package-file-set.ts:66`）を使っている。現状の要求範囲ではブロッキングではないが、環境非依存の byte-for-byte ordering を強く要求する場合は単純な codepoint 比較に寄せる余地がある。
