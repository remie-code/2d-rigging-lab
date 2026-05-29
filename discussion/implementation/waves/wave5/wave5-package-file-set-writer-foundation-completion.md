# Wave 5 Domain C Completion: package file set writer foundation

> Wave: `package-persistence-and-operation-log-foundation`
> Domain: `wave5-package-file-set-writer-foundation`
> Main module: `packages/package-format`
> Verdict: `pass`

## 1. 変更ファイル

- `packages/package-format/src/package-file-paths.ts`
  - package-relative path validation と authored package file path 定義。
- `packages/package-format/src/package-json-serialization.ts`
  - deterministic JSON stringify と trailing newline 付与。
- `packages/package-format/src/package-file-set.ts`
  - `serializePackageDocumentToFileSet` / `parsePackageDocumentFromFileSet`。
- `packages/package-format/src/package-file-set.test.ts`
  - file set roundtrip、path、deterministic JSON、unsafe path、dependency boundary のテスト。
- `packages/package-format/src/index.ts`
  - barrel re-export のみ追加。
- `discussion/implementation/waves/wave5/wave5-package-file-set-writer-foundation-completion.md`
  - この完了報告。

## 2. 実装サマリ

- `PackageDocumentDto` を in-memory の package-relative text file entries に展開する serializer を追加した。
- serializer は `manifest.json`、manifest の `modelFiles`、`assets/sources/source-manifest.json`、`assets/provenance.json`、`assets/rights.json` を deterministic JSON text として出力する。
- optional の `operations/log.jsonl` と generated artifact entries は text entry として path validation だけ行い、operation / runtime / validator schema parse はしていない。
- parser は file set 全体の package-relative path を検証した上で required authored JSON files を読み、最後に `PackageDocumentSchema` で parse する。
- path validation は空 path、absolute path、Windows drive absolute path、backslash、empty segment、`.` / `..` traversal segment、duplicate path を拒否する。
- production 実装は OS filesystem IO を持たない。fixture 読み込みと source import boundary 検査は test 内だけで行っている。

## 3. Tests Run

| Command | Result |
|---|---|
| `pnpm exec vitest run packages/package-format/src` | pass。sandbox では `node_modules/.../vitest.mjs` 読み取りが EPERM になったため、外部権限で再実行。3 files / 11 tests pass。 |
| `pnpm typecheck` | fail。`packages/runtime-core/src/runtime-state-sequence-artifacts.ts(111,48)` の `label: string \| undefined` exact optional property error。Domain C の許可範囲外かつ parallel-domain 由来と判断。 |
| `pnpm check:source` | pass。 |
| `pnpm check:deps` | pass。 |
| `rg '@private-2d-rigging-lab/(authoring-core\|operation-core\|runtime-core\|validator-core)' packages/package-format/src -n` | pass。no matches。 |
| `git diff --check -- packages/package-format/src discussion/implementation/waves/wave5` | pass。LF/CRLF warning のみ。 |
| `git diff --check --no-index -- /dev/null <new package-format files>` | pass。untracked new files に whitespace error なし。 |

## 4. Boundary Checks

- `package-format` production source は `authoring-core` / `operation-core` / `runtime-core` / `validator-core` を import していない。
- operation log JSONL の schema parse はしていない。
- runtime snapshot / runtime state / validation report generated artifact の schema parse はしていない。
- OS filesystem / zip writer / browser filesystem adapter は実装していない。
- external dependency 追加なし。`pnpm-lock.yaml` 変更なし。

## 5. Source Organization Notes

- `index.ts` は re-export のみ。
- responsibility split:
  - path policy: `package-file-paths.ts`
  - JSON serialization: `package-json-serialization.ts`
  - file set codec: `package-file-set.ts`
  - focused tests: `package-file-set.test.ts`
- catch-all `utils.ts` / `helpers.ts` / `types.ts` は追加していない。

## 6. Remaining Risks

- global `pnpm typecheck` は parallel-domain の `runtime-core` error で完走していない。Domain C の targeted tests と source/dependency guards は pass。
- `parsePackageDocumentFromFileSet` は intentional に operation log / generated artifact の存在や内容を要求しない。統合 fixture 側で operation/runtime/validation owner module の artifact materialization と合わせて検証する必要がある。
- package hash / archive writer / filesystem adapter は Wave 5 Domain C の非目標として未実装。
