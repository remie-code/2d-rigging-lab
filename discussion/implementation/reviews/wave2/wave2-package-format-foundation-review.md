# Wave 2 Package Format Foundation Review

> Domain: `wave2-package-format-foundation`  
> Reviewer: Review-Sylph  
> Date: 2026-05-29  
> Verdict: `pass`

## Reviewed Files / Basis

- `discussion/implementation/orchestration/wave2-plan.md`
- `discussion/design/module-contracts/package-file-format-contract.md`
- `discussion/design/module-contracts/module-boundaries.md`
- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/implementation/waves/wave2/wave2-package-format-foundation-completion.md`
- `packages/package-format/package.json`
- `packages/package-format/src/index.ts`
- `packages/package-format/src/package-manifest.ts`
- `packages/package-format/src/source-manifest.ts`
- `packages/package-format/src/model-graph.ts`
- `packages/package-format/src/model-files.ts`
- `packages/package-format/src/asset-metadata.ts`
- `packages/package-format/src/parse-result.ts`
- `packages/package-format/src/package-document.ts`
- `packages/package-format/src/package-document.test.ts`
- `packages/contracts/src/ids.ts`
- `packages/contracts/src/primitives.ts`
- `packages/contracts/src/index.ts`

## Findings

### Blocking

- なし。

### Warning / Follow-up

- `packages/package-format/src/model-files.ts:19` 以降は drawables / meshes / parameters / keyforms / dynamics / rig controls / masks / draw order / editor-state の authored model file DTO 群をまとめている。Wave 2 plan の推奨例に含まれる `model-files.ts` としては許容範囲で、`pnpm.cmd check:source` も pass しているため blocker ではない。ただし keyform / dynamics / rig control が拡張される次 wave では責務別分割を再評価するべき。
- `packages/package-format/package.json:9` で `@private-2d-rigging-lab/contracts` と `zod` が direct dependency になっている一方、`pnpm-lock.yaml:29` の `packages/package-format` importer はまだ `{}` で、`generated/dependencies/dependency-registry.json:28` の `zod` scope も `runtime:packages/contracts` のまま。完了報告に integration domain の follow-up として記録済みなので、この Domain A review では blocker 扱いしない。

## Design / Development Compliance

- `packages/package-format/src/index.ts:1`-`8` は re-export のみで、barrel-only 要件を満たしている。
- `package-format` の production source は package manifest、source manifest、model graph、model authored files、asset metadata、parse result、in-memory document assembly に分割されている。
- `packages/package-format/src/package-document.ts:41`-`50` は `PackageDocumentSchema` と `parsePackageDocument` に限定され、filesystem reader / writer は実装していない。
- 禁止依存検索 `rg -n "runtime-core|validator-core|operation-core" packages/package-format/src packages/package-format/package.json` は no matches。`package-format` は `runtime-core` / `validator-core` / `operation-core` を import していない。
- IO / parser / archive 依存の検索では `node:fs`、`fs/promises`、`readFile`、`writeFile`、archive / zip library の使用は見つからなかった。`psd` 文字列は `source-manifest.ts` と test の schema literal / diagnostic literal のみ。
- Zod schemas は `packages/contracts/src/ids.ts:29`-`46` と `packages/contracts/src/primitives.ts:26`-`28` の public schemas を利用しており、package file format contract の最小 DTO parse 範囲と整合している。

## Test Adequacy

- `packages/package-format/src/package-document.test.ts:118`-`123` が valid minimal in-memory package document parse を確認している。
- `packages/package-format/src/package-document.test.ts:125`-`137` が invalid `schemaVersion` と required field 欠落の failure を確認している。
- `packages/package-format/src/package-document.test.ts:139`-`164` が `split-png-set-v1` と `generated-fixture-v1` の source asset kind parse を確認している。
- `packages/package-format/src/package-document.test.ts:166`-`173` が public barrel 経由の `parsePackageDocument` 利用を確認している。
- Wave 2 Domain A の期待範囲は DTO parse と in-memory assembly であり、cross-file semantic validation、filesystem package loading、PSD / PNG parsing、archive handling の未実装は scope 内の不足ではない。

## Verification

| Command | Result |
|---|---|
| `pnpm.cmd exec vitest run packages/package-format/src` | sandbox 内では `node_modules` の `vitest.mjs` 読み取りが EPERM。承認済み外部実行で pass。1 file / 4 tests pass。 |
| `pnpm.cmd check:source` | pass。`Source organization guard passed.` |
| `pnpm.cmd check:deps` | pass。`Dependency guard passed.` |
| `pnpm.cmd typecheck` | sandbox 内では TypeScript `tsc` 読み取りが EPERM。承認済み外部実行で pass。 |
| `rg -n "runtime-core|validator-core|operation-core" packages/package-format/src packages/package-format/package.json` | no matches。 |
| `git diff --check -- packages/package-format` | exit 0。whitespace error なし。Git の LF/CRLF warning のみ。 |

## Remaining Risks

- dependency registry と lockfile の同期は integration domain で必要。現時点では完了報告に記録済みで、rubric 上も non-blocker。
- `model-files.ts` は現在は review 可能な大きさだが、今後の DTO 拡張で catch-all 化しやすい。
- テストは schema-level foundation と public export smoke に集中している。semantic reference validation は validator-core / fixture integration 側で追加確認が必要。

## User-decision Points

- なし。

## Verdict

`pass`。Wave 2 Domain A の package-format foundation は、barrel-only、責務分割、禁止依存、Wave 2 scope、Zod schema alignment、要求テストの観点で合格。残る dependency 同期と `model-files.ts` の将来分割は integration / next wave の follow-up として扱える。
