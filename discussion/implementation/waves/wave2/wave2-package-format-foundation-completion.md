# Wave 2 Package Format Foundation Completion

> Domain: `wave2-package-format-foundation`  
> Verdict: pass  
> 作成日: 2026-05-29

## Basis Documents Used

- `discussion/implementation/orchestration/wave2-plan.md`
- `discussion/implementation/waves/wave1/wave1-final-report.md`
- `discussion/design/module-contracts/package-file-format-contract.md`
- `discussion/design/module-contracts/module-boundaries.md`
- `discussion/development_convention/source-file-organization-policy.md`
- `packages/contracts/src/index.ts` と公開 contract source

## Changed Files Grouped By Responsibility

### Package Manifest DTO

- `packages/package-format/src/package-manifest.ts`

### Source Manifest DTO

- `packages/package-format/src/source-manifest.ts`

### Model Graph DTO

- `packages/package-format/src/model-graph.ts`

### Model Authored File DTOs

- `packages/package-format/src/model-files.ts`

### Asset Metadata DTOs

- `packages/package-format/src/asset-metadata.ts`

### Parse Result / In-memory Document Assembly

- `packages/package-format/src/parse-result.ts`
- `packages/package-format/src/package-document.ts`

### Public Barrel / Package Manifest / Tests

- `packages/package-format/src/index.ts`
- `packages/package-format/package.json`
- `packages/package-format/src/package-document.test.ts`

## Implementation Summary

- Package manifest、source manifest、model graph、model authored files、asset provenance/rights の Wave 2 foundation 用 Zod schema を追加した。
- `PackageDocumentSchema` と `parsePackageDocument` を追加し、filesystem IO なしで manifest / model / assets をまとめた in-memory package document を parse できるようにした。
- PSD parser、PNG parser、archive reader/writer、package filesystem reader/writer は実装していない。
- `package-format` は `contracts` と `zod` のみへ依存し、`runtime-core` / `validator-core` への import は追加していない。

## Tests / Verification

| Command | Result |
|---|---|
| `pnpm exec vitest run packages/package-format/src` | pass。1 file / 4 tests pass。初回は sandbox の `node_modules` 読み取り EPERM、依存 link 未更新による `zod` resolution error、途中 install timeout 後の `vite` link 欠落があったが、`pnpm install --lockfile=false --offline --force` による lockfile 非更新の link 再構成後に pass。 |
| `pnpm typecheck` | pass |
| `pnpm check:source` | pass。Source organization guard passed。 |
| `rg "runtime-core|validator-core|operation-core" packages/package-format/src packages/package-format/package.json` | match なし。 |

テストでは次を確認した。

- valid minimal in-memory package document parse。
- invalid `schemaVersion` と required field 欠落の failure。
- split PNG fallback と generated fixture source asset kind の parse。
- public barrel から `parsePackageDocument` を import して使えること。

## Source Organization Notes

- `packages/package-format/src/index.ts` は re-export のみで、barrel-only を維持した。
- schema は責務別ファイルに分割した。
- `model-files.ts` は authored model file DTO 群をまとめている。Wave 2 foundation としては責務が同一だが、keyform / dynamics / rig control が拡張される次 wave では追加分割候補。

## Dependency Follow-up Needed

- `packages/package-format/package.json` に direct dependency として `zod` と `@private-2d-rigging-lab/contracts` を追加した。
- この domain の指示により `pnpm-lock.yaml` と `generated/dependencies/dependency-registry.json` は更新していない。
- Integration domain で lockfile と dependency registry の同期が必要。

## Remaining Issues

- `generated/dependencies/dependency-registry.json` と `pnpm-lock.yaml` は domain 指示により未更新。integration domain で同期が必要。

## User-decision Points

- なし。

## Early Escape Triggers

- なし。
