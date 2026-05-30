# Wave 18 Domain B Final Review: asset rights / provenance validator evidence

- verdict: `pass`
- source fixes required: none
- report-only fixes required: none
- date: 2026-05-30
- reviewer role: Review-Sylph for `wave18-asset-rights-provenance-validator-evidence`
- implementation agent: `019e78c5-cd7b-7622-b05c-b791d44d719c` (`Gnome the 23rd`)
- review loop: 1 fix loop completed

## Basis Documents Used

- `.agents/skills/implementation-orchestration/SKILL.md`
- `C:/Users/remie/.codex/skills/subagent-context-hygiene/SKILL.md`
- `discussion/implementation/orchestration/wave18-plan.md`
- `discussion/implementation/current-capability-map.md`
- `discussion/implementation/waves/wave17/wave17-final-report.md`
- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/design/module-contracts/package-file-format-contract.md`
- `discussion/design/module-contracts/validator-contract.md`
- `discussion/design/mvp-authoring-runtime/01-open-model-package-design.md`
- `discussion/implementation/waves/wave18/wave18-asset-rights-provenance-validator-evidence-completion.md`

## Scope Reviewed

Domain B の対象ファイルだけを再レビューした。

- `packages/package-format/src/index.ts`
- `packages/package-format/src/package-document.ts`
- `packages/package-format/src/package-file-paths.ts`
- `packages/package-format/src/package-file-set.ts`
- `packages/package-format/src/texture-atlas.ts`
- `packages/package-format/src/source-asset-rights-fixture.test.ts`
- `packages/validator-core/src/check-catalog.ts`
- `packages/validator-core/src/index.ts`
- `packages/validator-core/src/validators/package-runtime.ts`
- `packages/validator-core/src/validators/asset-rights.ts`
- `packages/validator-core/src/validators/drawable-provenance.ts`
- `packages/validator-core/src/validators/drawable-references.ts`
- `packages/validator-core/src/source-asset-rights-provenance.test.ts`
- `fixtures/contracts/source-asset-rights-provenance-validator/**`
- `discussion/implementation/waves/wave18/wave18-asset-rights-provenance-validator-evidence-completion.md`

`apps/editor/**`, `packages/authoring-core/**`, `packages/operation-core/**` の並行 Wave18 変更は Domain B 対象外として扱った。

## Verification Reviewed

Orch-Sylph の修正後rerun結果を確認した。

- `pnpm.cmd exec vitest run packages/validator-core/src/source-asset-rights-provenance.test.ts packages/validator-core/src/validator-core.test.ts packages/validator-core/src/minimal-contract-fixture.test.ts packages/package-format/src/source-asset-rights-fixture.test.ts packages/package-format/src/package-file-set.test.ts packages/package-format/src/minimal-contract-fixture.test.ts`: pass, 6 files / 25 tests.
- `pnpm.cmd typecheck`: pass after sandbox EPERM was avoided by escalated run.
- `pnpm.cmd run check:source`: pass.
- `git diff --check -- packages/validator-core/src packages/package-format/src fixtures/contracts discussion/implementation/waves/wave18/wave18-asset-rights-provenance-validator-evidence-completion.md discussion/implementation/reviews/wave18/wave18-asset-rights-provenance-validator-evidence-review.md`: pass with CRLF normalization warnings only.

この Review-Sylph はテストを再実行せず、提供されたrerun結果と修正後ソースの静的確認で判定した。

## Findings

Blocking findings: none.

Source fix required: none.

### Closed Finding 1: visible missing-texture oracle was too narrow

修正済み。`validateDrawableReferences` は visible drawable について原則 texture reference を検証し、例外を `generated-fixture-v1` かつ `assets.textureAtlas` 未導入の legacy/generated fixture だけに限定している (`packages/validator-core/src/validators/drawable-references.ts:39`, `packages/validator-core/src/validators/drawable-references.ts:48`, `packages/validator-core/src/validators/drawable-references.ts:51`, `packages/validator-core/src/validators/drawable-references.ts:55`)。

テストは atlas entry 削除、split PNG の atlas 欠落、PSD source-backed drawable の atlas 欠落、generated fixture の no-atlas 例外を分けて確認している (`packages/validator-core/src/source-asset-rights-provenance.test.ts:119`, `packages/validator-core/src/source-asset-rights-provenance.test.ts:148`, `packages/validator-core/src/source-asset-rights-provenance.test.ts:173`, `packages/validator-core/src/source-asset-rights-provenance.test.ts:194`)。

### Closed Finding 2: drawable `sourceProvenanceId` was not validated

修正済み。`validateDrawableProvenanceReferences` が drawable の `sourceProvenanceId` を provenance record に解決し、欠落を `rights.drawableProvenanceMissing`、別 asset への紐付き違いを `rights.drawableProvenanceMismatch` として構造化診断にする (`packages/validator-core/src/validators/drawable-provenance.ts:10`, `packages/validator-core/src/validators/drawable-provenance.ts:24`, `packages/validator-core/src/validators/drawable-provenance.ts:29`, `packages/validator-core/src/validators/drawable-provenance.ts:43`, `packages/validator-core/src/validators/drawable-provenance.ts:74`)。

package runtime validator への統合も確認した。source rights / drawable provenance / drawable references が package reference checks として report に入る (`packages/validator-core/src/validators/package-runtime.ts:21`, `packages/validator-core/src/validators/package-runtime.ts:25`)。

テストは missing `sourceProvenanceId` の structured diagnostic を確認している (`packages/validator-core/src/source-asset-rights-provenance.test.ts:204`, `packages/validator-core/src/source-asset-rights-provenance.test.ts:211`, `packages/validator-core/src/source-asset-rights-provenance.test.ts:213`, `packages/validator-core/src/source-asset-rights-provenance.test.ts:226`)。mismatch branch は catalog / implementation の静的確認までで、専用 oracle case はないが、Domain B の compact oracle としては blocking gap ではない。

### Closed Finding 3: completion report was stale

修正済み。completion report は `pass` に更新され、Review-Sylph findings 1-3 の対応、修正後 verification、remaining risks が現在状態に揃っている (`discussion/implementation/waves/wave18/wave18-asset-rights-provenance-validator-evidence-completion.md:3`, `discussion/implementation/waves/wave18/wave18-asset-rights-provenance-validator-evidence-completion.md:5`, `discussion/implementation/waves/wave18/wave18-asset-rights-provenance-validator-evidence-completion.md:59`, `discussion/implementation/waves/wave18/wave18-asset-rights-provenance-validator-evidence-completion.md:65`)。

## Lane Assessment

### 1. Design / Development Compliance Review

Pass.

- Domain B の変更は許可範囲内に収まっている。レビュー対象では `apps/editor/**`, `packages/authoring-core/**`, `packages/operation-core/**`, `packages/runtime-core/**`, `packages/contracts/**` への Domain B 実装変更はない。
- `packages/package-format/src/index.ts` と `packages/validator-core/src/index.ts` は barrel-only re-export のまま (`packages/package-format/src/index.ts:4`, `packages/validator-core/src/index.ts:11`, `packages/validator-core/src/index.ts:12`, `packages/validator-core/src/index.ts:13`)。
- `texture-atlas.ts`, `asset-rights.ts`, `drawable-provenance.ts`, `drawable-references.ts` は責務別ファイルとして分割されており、catch-all / oversized source file にはなっていない。
- `package-format` 側の変更は optional `texture-atlas-v1` DTO と file-set parse/serialize support に限定され、schema/file-set support の最小差分として妥当。

### 2. Test Adequacy Review

Pass.

- compact oracle は cleared / needs_review / blocked / missing source provenance / missing texture / missing drawable provenance を確認している (`fixtures/contracts/source-asset-rights-provenance-validator/expected/source-validation-oracle-summary.json:5`, `fixtures/contracts/source-asset-rights-provenance-validator/expected/source-validation-oracle-summary.json:9`, `fixtures/contracts/source-asset-rights-provenance-validator/expected/source-validation-oracle-summary.json:15`, `fixtures/contracts/source-asset-rights-provenance-validator/expected/source-validation-oracle-summary.json:21`, `fixtures/contracts/source-asset-rights-provenance-validator/expected/source-validation-oracle-summary.json:28`, `fixtures/contracts/source-asset-rights-provenance-validator/expected/source-validation-oracle-summary.json:50`)。
- Tests assert structured diagnostics with `checkId`, `status`, `severity`, `target`, `targetPath`, `evidence`, `relatedAC`, `relatedScenarios`, and `impact` for rights/provenance/texture paths (`packages/validator-core/src/source-asset-rights-provenance.test.ts:45`, `packages/validator-core/src/source-asset-rights-provenance.test.ts:58`, `packages/validator-core/src/source-asset-rights-provenance.test.ts:99`, `packages/validator-core/src/source-asset-rights-provenance.test.ts:111`, `packages/validator-core/src/source-asset-rights-provenance.test.ts:127`, `packages/validator-core/src/source-asset-rights-provenance.test.ts:139`, `packages/validator-core/src/source-asset-rights-provenance.test.ts:212`, `packages/validator-core/src/source-asset-rights-provenance.test.ts:226`)。
- Package-format parse and file-set roundtrip behavior for optional texture atlas remains covered by `source-asset-rights-fixture.test.ts`.
- `minimal-contract-fixture.test.ts` passing with no checks confirms the explicit `generated-fixture-v1` no-atlas exception protects existing generated fixture semantics (`packages/validator-core/src/minimal-contract-fixture.test.ts:18`, `packages/validator-core/src/minimal-contract-fixture.test.ts:19`)。

### 3. Rights / Validator Oracle Review

Pass.

- Cleared source asset passes with no checks (`packages/validator-core/src/source-asset-rights-provenance.test.ts:27`, `packages/validator-core/src/source-asset-rights-provenance.test.ts:33`, `packages/validator-core/src/source-asset-rights-provenance.test.ts:34`)。
- `needs_review` is observable and does not silently pass: check status is `needs_review`, summary status is `needs_review`, and evidence includes `rightsStatus=needs_review` (`packages/validator-core/src/source-asset-rights-provenance.test.ts:37`, `packages/validator-core/src/source-asset-rights-provenance.test.ts:44`, `packages/validator-core/src/source-asset-rights-provenance.test.ts:46`, `packages/validator-core/src/source-asset-rights-provenance.test.ts:58`)。
- Blocked rights is a structured blocking failure (`packages/validator-core/src/source-asset-rights-provenance.test.ts:66`, `packages/validator-core/src/source-asset-rights-provenance.test.ts:73`, `packages/validator-core/src/source-asset-rights-provenance.test.ts:75`, `packages/validator-core/src/source-asset-rights-provenance.test.ts:84`)。
- Missing source provenance now reports both source-level provenance missing and drawable-level provenance missing in the expected summary, which is consistent with the added drawable provenance validator (`fixtures/contracts/source-asset-rights-provenance-validator/expected/source-validation-oracle-summary.json:21`, `fixtures/contracts/source-asset-rights-provenance-validator/expected/source-validation-oracle-summary.json:24`, `fixtures/contracts/source-asset-rights-provenance-validator/expected/source-validation-oracle-summary.json:25`)。
- Visible drawable missing texture is detected for atlas entry removal and atlas absence, including PSD source-backed drawables (`packages/validator-core/src/source-asset-rights-provenance.test.ts:119`, `packages/validator-core/src/source-asset-rights-provenance.test.ts:148`, `packages/validator-core/src/source-asset-rights-provenance.test.ts:173`)。
- Validation report can track source asset / rights / provenance through source-level and drawable-level diagnostic targets and evidence.

## Remaining Risks / Open Verification Items

- `texture-atlas-v1` remains optional to preserve existing package documents and generated fixtures. Future persistence/import domains should decide when authored packages must always materialize `assets/textures/texture-atlas.json`.
- `toPackageDocument` in `authoring-core` does not preserve optional `textureAtlas` yet. Domain B correctly did not edit `packages/authoring-core/**`.
- Texture asset rights/provenance are represented in the fixture, but Domain B validates source asset rights/provenance, drawable provenance, and drawable texture reference existence only.
- `rights.drawableProvenanceMismatch` is implemented and cataloged, but not covered by a dedicated compact oracle case. This is acceptable for this Domain B pass because the primary previous blocker, unresolved drawable provenance, is covered; add a mismatch fixture later if provenance branch coverage is expanded.

## User Decision Points

None for Domain B.
