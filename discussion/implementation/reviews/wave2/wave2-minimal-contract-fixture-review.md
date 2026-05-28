# Wave 2 Minimal Contract Fixture Review

> Review target: `wave2-minimal-contract-fixture`  
> Review role: Review-Sylph / clean context review  
> Review date: 2026-05-29  
> Verdict: `pass`

## Reviewed Files / Basis

### Basis documents

- `discussion/implementation/orchestration/wave2-plan.md`
- `discussion/design/module-contracts/fixtures-and-contract-tests.md`
- `discussion/design/module-contracts/package-file-format-contract.md`
- `discussion/design/module-contracts/runtime-core-contract.md`
- `discussion/design/module-contracts/validator-contract.md`
- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/implementation/waves/wave2/wave2-minimal-contract-fixture-completion.md`

### Reviewed implementation artifacts

- `fixtures/contracts/minimal-valid-package/**`
- `packages/package-format/src/minimal-contract-fixture.test.ts`
- `packages/runtime-core/src/minimal-contract-fixture.test.ts`
- `packages/validator-core/src/minimal-contract-fixture.test.ts`
- `packages/package-format/src/index.ts`
- `packages/runtime-core/src/index.ts`
- `packages/validator-core/src/index.ts`

## Findings

### Blocking

- なし。

### Major

- なし。

### Minor / Non-blocking

- `fixtures/contracts/minimal-valid-package/assets/sources/source-manifest.json:7` と `fixtures/contracts/minimal-valid-package/assets/provenance.json:8` が `assets/sources/generated/minimal-body.json` を参照しているが、該当ファイルは存在しない。現時点の Domain D 要件は text JSON の最小 package JSON 群、summary runtime snapshot、pass validation report であり、package-format / runtime-core / validator-core の対象テストもこの source body の存在を要求していないため blocker ではない。将来の package reference validation が source asset file existence を検査する場合は、同ファイルを text JSON artifact として追加するか、generated fixture source が virtual reference であることを契約側に明記する必要がある。
- `fixtures/contracts/minimal-valid-package/assets/sources/source-manifest.json:9` は `generated-fixture-profile-v1` を使っている。一方、basis document の sketch は `discussion/design/module-contracts/package-file-format-contract.md:284` で PSD / split PNG profile のみを示している。実装 schema 側は `packages/package-format/src/source-manifest.ts:19` でこの値を許容しており、同契約文書も `generated-fixture-v1` source kind 自体は `discussion/design/module-contracts/package-file-format-contract.md:260` で示しているため、Domain D の blocker ではない。Integration 側では generated fixture profile を正式契約に寄せるか、sketch の記述を更新するとよい。

## Design / Development Compliance Assessment

- `fixtures/contracts/minimal-valid-package/fixture-manifest.json:2` から `:47` は `minimal-valid-package`、input artifacts、expected runtime snapshot、expected validation report、`requires-contract-review` update rule を明示している。
- `fixtures/contracts/minimal-valid-package/manifest.json:2` から `:35` は package manifest の必須構造、model file refs、asset index、rights / provenance summary を持つ。
- fixture 配下の実ファイルはすべて `.json` で、JSON parse は全件 pass。非 JSON ファイルは検出されなかった。
- proprietary / Cubism / PSD / PNG 系の実体ファイルは検出されなかった。該当語は `fixtures/contracts/minimal-valid-package/assets/rights.json:9` の否定的説明だけだった。
- Domain D completion report は production source、package manifest、lockfile、dependency registry、`index.ts` を変更していないと記録している。今回レビューした D 対象ファイルにも production logic 変更はない。

## Test Adequacy Assessment

- package-format test は `packages/package-format/src/minimal-contract-fixture.test.ts:12` で fixture package document を `parsePackageDocument` に通し、`parsed.success`、package ID、drawable 数、generated fixture source kind を確認している。
- runtime-core test は `packages/runtime-core/src/minimal-contract-fixture.test.ts:33` で `evaluateRuntimeFrame` を実行し、`drawList`、`drawables`、diagnostics absence、snapshot identity を expected summary snapshot と照合している。
- validator-core test は `packages/validator-core/src/minimal-contract-fixture.test.ts:12` で `validatePackageRuntime` を実行し、summary、empty checks、evidence、report identity を expected validation report と照合している。
- このため、Wave 2 Domain D の required tests である package-format parse、runtime summary snapshot、validator pass report は満たしている。
- runtime test は package-format を import せず test-local 変換で `NormalizedRuntimeGraph` を作るため、module boundary を崩していない。一方で production package reader / runtime adapter の検証は未実装で、これは Domain D の範囲外の残リスク。

## Source Organization Assessment

- `packages/package-format/src/index.ts`、`packages/runtime-core/src/index.ts`、`packages/validator-core/src/index.ts` は re-export のみで、`index.ts` に実装ロジックはない。
- 新規 TypeScript は fixture integration test のみで、package parse / runtime evaluation / validator report の責務ごとに分かれている。
- `pnpm check:source` は pass し、`Source organization guard passed.` を確認した。

## Verification

| Command / check | Result |
|---|---|
| fixture JSON parse for `fixtures/contracts/minimal-valid-package/**` | pass |
| non-JSON file scan under `fixtures/contracts/minimal-valid-package/**` | pass: none |
| forbidden/proprietary/Cubism asset keyword scan | pass: no actual asset hit; only rights note says no PSD/PNG/Cubism/proprietary asset |
| `pnpm exec vitest run packages/package-format/src packages/runtime-core/src packages/validator-core/src` | first sandbox run failed with EPERM reading `node_modules/.../vitest.mjs`; approved external rerun pass: 8 files / 18 tests |
| `pnpm check:source` | pass |

## Remaining Risks

- `fixture-manifest.json` 自体を parse する production schema はまだ見当たらない。現状は fixture JSON artifact と各 module の semantic tests で担保している。
- generated fixture source の `filePath` は未配置ファイルを指す。将来の reference validator が file existence を required にすると、追加対応が必要になる。
- runtime graph 変換は test-local の薄い変換であり、production package -> runtime adapter の保証ではない。

## User-decision Points

- なし。上記は integration / future-wave で処理できる残リスクであり、現時点で user decision は不要。
