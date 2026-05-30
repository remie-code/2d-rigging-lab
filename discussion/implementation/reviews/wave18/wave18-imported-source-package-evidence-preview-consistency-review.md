# Wave 18 Domain E レビュー: Imported Source Package Evidence / Preview Consistency

## Verdict

`pass`

Blocking findings: なし。

## レビュー識別

- Role: Review-Sylph for `wave18-imported-source-package-evidence-preview-consistency`
- 実装 agent id: `019e78e0-501c-7783-9046-b9663a56c4b6` (`Gnome the 29th`)
- 分離証跡: 実装は Gnome 別コンテキスト。Orch-Sylph は source implementation files を編集していない。Review-Sylph は source / tests / fixtures を編集せず、この review report のみを書いた。
- Date: 2026-05-30

## 使用した根拠

- `.agents/skills/implementation-orchestration/SKILL.md`
- `C:/Users/remie/.codex/skills/subagent-context-hygiene/SKILL.md`
- `discussion/implementation/orchestration/wave18-plan.md`
- `discussion/implementation/current-capability-map.md`
- `discussion/implementation/waves/wave17/wave17-final-report.md`
- `discussion/implementation/waves/wave18/wave18-split-png-import-operation-foundation-completion.md`
- `discussion/implementation/reviews/wave18/wave18-split-png-import-operation-foundation-review.md`
- `discussion/implementation/waves/wave18/wave18-asset-rights-provenance-validator-evidence-completion.md`
- `discussion/implementation/reviews/wave18/wave18-asset-rights-provenance-validator-evidence-review.md`
- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/design/module-contracts/package-file-format-contract.md`
- `discussion/design/module-contracts/operation-contracts.md`
- `discussion/design/module-contracts/runtime-core-contract.md`
- `discussion/implementation/waves/wave18/wave18-imported-source-package-evidence-preview-consistency-completion.md`
- 対象 source / fixture / test の静的確認

## Scope Reviewed

- `packages/authoring-core/src/package-document-assets.ts`
- `packages/operation-core/src/imported-source-package-evidence-preview-consistency.test.ts`
- `fixtures/contracts/imported-source-package-evidence-preview-consistency/**`
- `discussion/implementation/waves/wave18/wave18-imported-source-package-evidence-preview-consistency-completion.md`

他の Wave18 A/B/C/D 変更は、Domain E の package evidence / operation evidence / preview truthfulness に直接関わる範囲だけ参照した。

## Verification Reviewed

提供された検証結果を確認した。

- `pnpm.cmd exec vitest run packages/operation-core/src/imported-source-package-evidence-preview-consistency.test.ts`: pass, 1 file / 2 tests。
- `pnpm.cmd exec vitest run packages/operation-core/src/imported-source-package-evidence-preview-consistency.test.ts packages/authoring-core/src/package-document-adapter.test.ts packages/package-format/src/source-asset-rights-fixture.test.ts packages/validator-core/src/source-asset-rights-provenance.test.ts`: pass, 4 files / 18 tests。
- `pnpm.cmd typecheck`: pass。Orch-Sylph が 2026-05-30 に root + editor typecheck pass を確認。
- `pnpm.cmd run check:source`: pass。
- `git diff --check -- packages/operation-core/src/imported-source-package-evidence-preview-consistency.test.ts packages/authoring-core/src/package-document-assets.ts fixtures/contracts/imported-source-package-evidence-preview-consistency discussion/implementation/waves/wave18/wave18-imported-source-package-evidence-preview-consistency-completion.md`: Review-Sylph でも再確認し、CRLF normalization warning のみで whitespace error なし。

この Review-Sylph は Vitest / typecheck / source guard を再実行していない。上記の提供結果と対象差分の静的確認、および `git diff --check` の再確認で判定した。

## Findings

Blocking findings: なし。

### 1. Source / Package Evidence Review

Pass.

- `buildPackageDocumentAssets` は session graph から `sourceManifest`、`provenance`、`rights` を反映し、base package に `textureAtlas` がある場合だけ clone して保持する。Domain B の残リスクだった optional `textureAtlas` preservation は、最小差分で package file set evidence に接続されている (`packages/authoring-core/src/package-document-assets.ts:9`, `packages/authoring-core/src/package-document-assets.ts:13`, `packages/authoring-core/src/package-document-assets.ts:20`)。
- fixture は split PNG import request に source asset、manifest path、layer metadata、bounds、rights、provenance を含めている (`fixtures/contracts/imported-source-package-evidence-preview-consistency/request/import-split-png-source-commit.request.json:8`, `fixtures/contracts/imported-source-package-evidence-preview-consistency/request/import-split-png-source-commit.request.json:16`, `fixtures/contracts/imported-source-package-evidence-preview-consistency/request/import-split-png-source-commit.request.json:37`, `fixtures/contracts/imported-source-package-evidence-preview-consistency/request/import-split-png-source-commit.request.json:42`)。
- test は import -> `createDrawable` -> `generateMesh` を同一 session で commit し、operation log JSONL roundtrip、package document roundtrip、texture atlas preservation、source/provenance/rights/log file materialization、final validator pass を確認している (`packages/operation-core/src/imported-source-package-evidence-preview-consistency.test.ts:127`, `packages/operation-core/src/imported-source-package-evidence-preview-consistency.test.ts:139`, `packages/operation-core/src/imported-source-package-evidence-preview-consistency.test.ts:149`, `packages/operation-core/src/imported-source-package-evidence-preview-consistency.test.ts:156`, `packages/operation-core/src/imported-source-package-evidence-preview-consistency.test.ts:163`, `packages/operation-core/src/imported-source-package-evidence-preview-consistency.test.ts:164`, `packages/operation-core/src/imported-source-package-evidence-preview-consistency.test.ts:171`)。
- package summary は source layer mapping、texture ref、rights を fixture expected に固定している (`fixtures/contracts/imported-source-package-evidence-preview-consistency/expected/imported-source-package-evidence-preview-consistency-summary.json:112`, `fixtures/contracts/imported-source-package-evidence-preview-consistency/expected/imported-source-package-evidence-preview-consistency-summary.json:125`, `fixtures/contracts/imported-source-package-evidence-preview-consistency/expected/imported-source-package-evidence-preview-consistency-summary.json:136`)。
- operation evidence provider の出力は `OperationResult` に merge され、その result から operation log entry の runtime / validation artifact ids が作られる既存 lifecycle と一致している (`packages/operation-core/src/lifecycle/evidence.ts:41`, `packages/operation-core/src/lifecycle/evidence.ts:45`, `packages/operation-core/src/lifecycle/evidence.ts:59`, `packages/operation-core/src/lifecycle/commit.ts:77`, `packages/operation-core/src/lifecycle/commit.ts:89`, `packages/operation-core/src/operation-log.ts:55`)。

### 2. Preview Truthfulness Review

Pass.

- preview summary は `createDrawable` と `generateMesh` の candidate runtime snapshots だけを対象にし、`textureBitmapRendered: false` と `semantics: "current-svg-geometry-preview"` を明示している (`packages/operation-core/src/imported-source-package-evidence-preview-consistency.test.ts:452`, `packages/operation-core/src/imported-source-package-evidence-preview-consistency.test.ts:462`, `packages/operation-core/src/imported-source-package-evidence-preview-consistency.test.ts:463`)。
- SVG shape は full runtime snapshot の vertices の有無から `rect` / `polygon` を判定しており、PNG bitmap decode / real texture rendering を oracle にしていない (`packages/operation-core/src/imported-source-package-evidence-preview-consistency.test.ts:616`, `packages/operation-core/src/imported-source-package-evidence-preview-consistency.test.ts:630`)。
- expected summary は `createDrawable` 後を rect / 0 vertices、`generateMesh` 後を polygon / 4 vertices として固定し、source/texture/provenance refs と矛盾しない (`fixtures/contracts/imported-source-package-evidence-preview-consistency/expected/imported-source-package-evidence-preview-consistency-summary.json:143`, `fixtures/contracts/imported-source-package-evidence-preview-consistency/expected/imported-source-package-evidence-preview-consistency-summary.json:164`, `fixtures/contracts/imported-source-package-evidence-preview-consistency/expected/imported-source-package-evidence-preview-consistency-summary.json:195`)。

### 3. Test Adequacy Review

Pass.

- DTO parse test は3つの request fixture が operation-core schema を通ることを確認している (`packages/operation-core/src/imported-source-package-evidence-preview-consistency.test.ts:72`, `packages/operation-core/src/imported-source-package-evidence-preview-consistency.test.ts:83`, `packages/operation-core/src/imported-source-package-evidence-preview-consistency.test.ts:98`, `packages/operation-core/src/imported-source-package-evidence-preview-consistency.test.ts:107`)。
- main test は3 commit、operation log serialization、file set serialization/reload、final validation report、materialized runtime / validation artifact parse を一つの compact oracle で確認している (`packages/operation-core/src/imported-source-package-evidence-preview-consistency.test.ts:118`, `packages/operation-core/src/imported-source-package-evidence-preview-consistency.test.ts:139`, `packages/operation-core/src/imported-source-package-evidence-preview-consistency.test.ts:145`, `packages/operation-core/src/imported-source-package-evidence-preview-consistency.test.ts:150`, `packages/operation-core/src/imported-source-package-evidence-preview-consistency.test.ts:173`, `packages/operation-core/src/imported-source-package-evidence-preview-consistency.test.ts:667`, `packages/operation-core/src/imported-source-package-evidence-preview-consistency.test.ts:687`)。
- expected summary は partial match だが、Domain E の主リスクである source import chain、source layer mapping、package file set paths、texture atlas presence、current SVG preview semantics、final validation pass を押さえている。operation result/log artifact ID の一般経路は既存 lifecycle/evidence tests とこの test の log roundtripで補完されており、blocking gap とは判定しない。

### 4. Development Compliance Review

Pass.

- Domain E で source production change は `package-document-assets.ts` の small targeted change のみ。巨大 source file / catch-all source file は増えていない (`packages/authoring-core/src/package-document-assets.ts:5`, `packages/authoring-core/src/package-document-assets.ts:26`)。
- `index.ts` は Domain E では編集されていない。現在の `packages/authoring-core/src/index.ts` は re-export のみで barrel-only を維持している (`packages/authoring-core/src/index.ts:1`, `packages/authoring-core/src/index.ts:26`)。
- `packages/authoring-core/src/package-document-assets.ts` は Wave18 plan の Domain E write scope からはやや外れるが、今回の target review scope に明示され、completion report でも Domain B 残リスクへの最小 persistence fix として説明されている (`discussion/implementation/waves/wave18/wave18-imported-source-package-evidence-preview-consistency-completion.md:18`, `discussion/implementation/waves/wave18/wave18-imported-source-package-evidence-preview-consistency-completion.md:34`)。差分は optional atlas preservation に限定され、scope exception として非ブロッキング。

## Remaining Risks / Open Verification Items

- Domain E は texture atlas を生成しない。既存 package document の optional `textureAtlas` を保持し、source / layer / texture refs の整合を fixture で確認する範囲に限定されている。
- Texture asset 自体の rights / provenance validator は Domain B と同じく future scope。今回の pass は source asset rights/provenance、drawable provenance、visible drawable texture reference existence まで。
- expected summary は意図的に compact / partial oracle であり、operation result/log のすべての nested evidence fields を fixture JSON で完全固定してはいない。将来この fixtureを acceptance oracle に格上げする場合は、`operationEvidence` と `provenanceByAsset` も expected に含めるとさらに強くなる。

## User Decision Points

なし。
