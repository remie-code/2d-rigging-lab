# Wave 5 Integration Review

> Wave: `package-persistence-and-operation-log-foundation`
> 日付: 2026-05-29
> Reviewer: Undine / integration review
> Verdict: `pass`

## 1. Scope

Wave 5 は Wave 4 の runtime / validation evidence foundation を、保存・再読込可能な package-relative artifact foundation へ接続した。

この integration review は次を確認した。

- package revision policy と operation log JSONL。
- `AuthoringSession` から `PackageDocumentDto` への保存 adapter。
- deterministic package file set serializer / parser。
- runtime snapshot / state / state-sequence artifact materializer。
- validation report artifact materializer。
- createParameter commit から persisted package file set / generated evidence / reload summary まで通る fixture。

## 2. Domain Gate

| Domain | Implementation | Review | Verdict |
|---|---|---|---|
| `wave5-operation-revision-log-jsonl-foundation` | pass | pass | pass |
| `wave5-authoring-package-document-adapter-foundation` | pass | pass | pass |
| `wave5-package-file-set-writer-foundation` | pass | pass | pass |
| `wave5-runtime-evidence-artifact-materializer` | pass | pass | pass |
| `wave5-validation-report-artifact-materializer` | pass | pass | pass |
| `wave5-persisted-operation-evidence-fixture` | pass | pass | pass |

Blocking review finding はなし。

## 3. Integration Findings

Blocking:

- なし。

Non-blocking:

- `packageHash` は mutated package body から再計算せず、既存 minimal fixture の `sha256:minimal-valid-package-v1` を流用している。hash policy は filesystem / archive writer wave で再検討する。
- Runtime snapshot ID / artifact path collision の一般問題は happy path fixture では網羅していない。現 fixture は generated path の presence / uniqueness を固定する。
- Operation catalog はまだ `createParameter` の vertical slice が中心であり、複数 operation append、rollback、migration、undo/redo は未実装。
- OS filesystem writer、browser save adapter、zip/archive writer は未実装。Wave 5 の durable boundary は package-relative in-memory file set まで。

## 4. Boundary Review

| Boundary | Result |
|---|---|
| `package-format` does not import `authoring-core` / `operation-core` / `runtime-core` / `validator-core` | pass |
| `runtime-core` production source does not import package IO / `package-format` / `authoring-core` / `operation-core` / `validator-core` | pass |
| `operation-core` production source does not import `package-format` / `runtime-core` / `validator-core` / GUI / AI / renderer / transport | pass |
| `validator-core` does not import `authoring-core` / `operation-core` / GUI / AI | pass |
| `index.ts` files remain barrel-only | pass |
| Generated artifacts remain in-memory package-relative entries | pass |

## 5. Verification

| Command | Result |
|---|---|
| `pnpm install` | pass。lockfile up to date。 |
| `pnpm exec vitest run packages/operation-core/src packages/package-format/src packages/authoring-core/src packages/runtime-core/src packages/validator-core/src` | pass。sandbox EPERM 後、外部権限で 25 files / 74 tests pass。 |
| `pnpm typecheck` | pass。 |
| `pnpm check:source` | pass。 |
| `pnpm check:deps` | pass。 |
| `pnpm check` | pass。sandbox EPERM 後、外部権限で 32 files / 152 tests pass。 |
| forbidden import searches | pass。no matches。runtime-core fs/package IO search も no matches。 |
| `git diff --check -- . ':!pnpm-lock.yaml'` | pass。CRLF warning のみ。 |

## 6. Pass Criteria

| Criteria | Result |
|---|---|
| Domain A-E pass | pass |
| Domain F persisted fixture pass | pass |
| Integration review pass | pass |
| full verification pass | pass |
| `index.ts` bloat absent | pass |
| committed operation can produce package file set and operation log JSONL | pass |
| runtime / validation evidence refs align with generated artifact paths | pass |
| reloaded package document keeps committed revision and new parameter | pass |

## 7. Decision

Wave 5 can be marked complete.

The next implementation wave may start from the assumption that operation evidence can be produced, serialized into package-relative text artifacts, and reloaded through package-format.
