# Wave 2 Minimal Contract Fixture Completion

> Domain: `wave2-minimal-contract-fixture`  
> 実施日: 2026-05-29  
> Verdict: `pass`

## Basis Documents Used

- `discussion/implementation/orchestration/wave2-plan.md`
- `discussion/design/module-contracts/fixtures-and-contract-tests.md`
- `discussion/design/module-contracts/package-file-format-contract.md`
- `discussion/design/module-contracts/runtime-core-contract.md`
- `discussion/design/module-contracts/validator-contract.md`
- `discussion/design/module-contracts/module-boundaries.md`
- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/implementation/waves/wave2/wave2-package-format-foundation-completion.md`
- `discussion/implementation/waves/wave2/wave2-runtime-core-foundation-completion.md`
- `discussion/implementation/waves/wave2/wave2-validator-core-foundation-completion.md`
- `discussion/implementation/reviews/wave2/wave2-validator-core-foundation-review.md`
- public exports:
  - `packages/package-format/src/index.ts`
  - `packages/runtime-core/src/index.ts`
  - `packages/validator-core/src/index.ts`

## Changed Files Grouped By Responsibility

### Contract fixture artifacts

- `fixtures/contracts/minimal-valid-package/fixture-manifest.json`
- `fixtures/contracts/minimal-valid-package/manifest.json`
- `fixtures/contracts/minimal-valid-package/model/graph.json`
- `fixtures/contracts/minimal-valid-package/model/drawables.json`
- `fixtures/contracts/minimal-valid-package/model/meshes.json`
- `fixtures/contracts/minimal-valid-package/model/parameters.json`
- `fixtures/contracts/minimal-valid-package/model/keyforms.json`
- `fixtures/contracts/minimal-valid-package/model/rig-controls.json`
- `fixtures/contracts/minimal-valid-package/model/dynamics.json`
- `fixtures/contracts/minimal-valid-package/model/masks.json`
- `fixtures/contracts/minimal-valid-package/model/draw-order.json`
- `fixtures/contracts/minimal-valid-package/assets/sources/source-manifest.json`
- `fixtures/contracts/minimal-valid-package/assets/provenance.json`
- `fixtures/contracts/minimal-valid-package/assets/rights.json`
- `fixtures/contracts/minimal-valid-package/runtime/snapshots/summary.runtime-snapshot.json`
- `fixtures/contracts/minimal-valid-package/validation/reports/minimal.validation.json`

### Package-format fixture parse test

- `packages/package-format/src/minimal-contract-fixture.test.ts`

### Runtime-core fixture evaluation test

- `packages/runtime-core/src/minimal-contract-fixture.test.ts`

### Validator-core fixture report test

- `packages/validator-core/src/minimal-contract-fixture.test.ts`

### Completion report

- `discussion/implementation/waves/wave2/wave2-minimal-contract-fixture-completion.md`

## Implementation Summary

- `fixtures/contracts/minimal-valid-package/` に text JSON の unpacked package fixture を追加した。
- fixture は generated source kind を使い、PSD / PNG binary、proprietary asset、Cubism asset、compatibility oracle を含めていない。
- package-format test は fixture の `manifest.json` / `model/**` / `assets/**` を Node fs で読み、in-memory `PackageDocumentDto` として `parsePackageDocument` を通す。
- runtime-core test は production adapter を追加せず、test-local の薄い変換で fixture DTO から `NormalizedRuntimeGraph` を組み立て、summary snapshot を評価する。
- validator-core test は fixture package と expected summary snapshot から `validatePackageRuntime` を実行し、expected pass report と semantic に照合する。
- validator review の inline fixture warning には、既存 inline test を増やさず外部 fixture integration test を追加して対応した。
- production source、package manifest、lockfile、dependency registry、`index.ts` は変更していない。

## Tests / Verification

| Command | Result |
|---|---|
| `pnpm exec vitest run packages/package-format/src packages/runtime-core/src packages/validator-core/src` | pass。8 files / 18 tests pass。sandbox 内では `vitest.mjs` 読み取り EPERM が出たため、承認付き外部実行で確認。 |
| `pnpm typecheck` | pass |
| `pnpm check:source` | pass。`Source organization guard passed.` |
| `git diff --check -- fixtures/contracts/minimal-valid-package packages/package-format/src packages/runtime-core/src packages/validator-core/src discussion/implementation/waves/wave2` | pass。既存 upstream の `index.ts` LF/CRLF warning のみ。 |

## Source Organization Notes

- `index.ts` は触っておらず、barrel-only を維持している。
- 新規 TypeScript はすべて test file で、fixture parse / runtime evaluation / validator report の責務別に分割した。
- runtime-core test は `@private-2d-rigging-lab/package-format` を import していないため、runtime-core production boundary を濁していない。
- fixture JSON は text-only artifact と expected artifact に分け、generated source provenance / rights を明示した。

## Remaining Issues

- fixture manifest schema 自体はまだ production 実装されていないため、今回は JSON artifact として配置し、package/runtime/validator の semantic tests で使用した。
- runtime graph 変換は test-local の最小変換。production package reader / runtime adapter は Wave 2 Domain D の範囲外として追加していない。
- lockfile / dependency registry の同期は upstream domain completion reports と同じく integration domain の残作業。

## User-decision Points

- なし。

## Early Escape Triggers

- なし。
