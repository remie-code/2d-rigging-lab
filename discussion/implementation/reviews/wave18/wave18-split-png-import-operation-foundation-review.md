# Wave 18 Domain A レビュー: Split PNG Import Operation Foundation

## Verdict

`pass`

## レビュー識別

- Role: Review-Sylph for `wave18-split-png-import-operation-foundation`
- Review agent id: `019e78d1-60bb-7262-beb8-09d74d1063b3` (`Sylph the 24th`)
- 実装 agent id: `019e78c4-e6e7-7b90-86e3-db534adeb9aa` (`Gnome the 22nd`)
- 分離証跡: 実装は Gnome 別コンテキスト、レビューは Review-Sylph 別コンテキストで実行した。Review-Sylph は source / tests を編集していない。
- Date: 2026-05-30

## レビュー Lane

1. Design / Development Compliance Review
2. Test Adequacy Review
3. Rights / Provenance Integrity Review

## 使用した根拠

- `.agents/skills/implementation-orchestration/SKILL.md`
- `C:/Users/remie/.codex/skills/subagent-context-hygiene/SKILL.md`
- `discussion/implementation/orchestration/wave18-plan.md`
- `discussion/implementation/current-capability-map.md`
- `discussion/implementation/waves/wave17/wave17-final-report.md`
- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/design/module-contracts/package-file-format-contract.md`
- `discussion/design/module-contracts/operation-contracts.md`
- `discussion/design/mvp-authoring-runtime/01-open-model-package-design.md`
- `discussion/implementation/waves/wave18/wave18-split-png-import-operation-foundation-completion.md`

## 確認した証拠

- Domain A 対象範囲の差分: `packages/authoring-core/src/**`、`packages/operation-core/src/**`、Domain A completion report。
- 新規実装ファイル:
  - `packages/authoring-core/src/source-asset-mutations.ts`
  - `packages/operation-core/src/operations/import-split-png-source-asset.ts`
  - `packages/operation-core/src/operations/import-split-png-source-asset-unsupported-psd.ts`
  - `packages/operation-core/src/operations/set-rights-metadata.ts`
- Focused tests:
  - `packages/authoring-core/src/source-asset-mutations.test.ts`
  - `packages/operation-core/src/operations/import-split-png-source-asset.test.ts`
  - `packages/operation-core/src/operation-lifecycle.test.ts`
  - `packages/operation-core/src/operation-schemas.test.ts`

## Blocking Findings

なし。

## Lane Findings

### 1. Design / Development Compliance

Pass.

- `importSplitPngSourceAsset` は dedicated operation handler として実装され、`operation-registry.ts` に登録されている。
- `setRightsMetadata` は dedicated operation handler として実装され、registry に登録されている。
- `importPsdSourceAsset` は Wave 18 non-goal 境界を守り、operation-specific unsupported diagnostic を返す handler として登録されている。
- `packages/authoring-core/src/index.ts` と `packages/operation-core/src/index.ts` の変更は barrel-only re-export に留まっている。
- Domain A 実装は editor、validator、runtime、fixtures、file IO、PNG decode、Cubism / Live2D code に依存していない。
- `pnpm.cmd run check:source` は pass。

### 2. Test Adequacy

Pass.

- Focused Vitest は 4 files / 31 tests pass。
- Operation tests は registry registration、dry-run non-mutation、commit mutation、`createDrawable` source layer reference、rights metadata update、import precondition diagnostics、duplicate source asset rejection、unsupported PSD rejection、rights / provenance rejection paths を確認している。
- Authoring-core tests は metadata import、duplicate source asset rejection before rights/provenance mutation、rights/provenance operation linkage を確認している。
- duplicate source layer / missing default part など一部 defensive diagnostics は主に code inspection で確認した。Domain A の主リスク経路は focused tests で押さえられており、blocking とはしない。

### 3. Rights / Provenance Integrity

Pass.

- Import は manifest path、split PNG profile、rights metadata、provenance metadata、1件以上の layer、non-blocked rights、duplicate source assetなし、有効な default part、`use-metadata` 時の layer bounds を precondition として確認する。
- Authoring mutation は duplicate source asset、blocked rights、provenance/source mismatch、rights/source mismatch、source layer/source mismatch、duplicate source layer を reject する。
- Commit は authoring session 経由で source asset、provenance、rights records を追加し、package document asset materialization が `sourceManifest`、`provenance`、`rights` に反映する。
- `setRightsMetadata` は missing source asset、blocked rights、missing matching provenance を precondition で reject し、rights record 更新と provenance evidence への operation id 追加を行う。

## 検証

| Command | Result |
|---|---|
| `pnpm.cmd exec vitest run packages/authoring-core/src/source-asset-mutations.test.ts packages/operation-core/src/operations/import-split-png-source-asset.test.ts packages/operation-core/src/operation-lifecycle.test.ts packages/operation-core/src/operation-schemas.test.ts` | pass after sandbox escalation; 4 files / 31 tests |
| `pnpm.cmd run check:source` | pass |
| `git diff --check -- packages/authoring-core/src packages/operation-core/src discussion/implementation/waves/wave18/wave18-split-png-import-operation-foundation-completion.md` | pass; CRLF normalization warnings only |

Gnome-reported verification として受領:

- `pnpm.cmd typecheck` -> pass

## Non-Blocking Notes / Residual Risks

- この実装は metadata-backed foundation として正しい。source files の読み取り、PNG bytes の decode、image existence validation、texture atlas generation は対象外。
- `setRightsMetadata` は `blocked` を accepted source asset update としては保存しない。Blocked source assets を package state に残すかは future design decision。
- import operation file は現時点では単一責務内に収まっているが、後続 wave で candidate drawable mapping や richer manifest interpretation を追加する場合は helper 分割を検討する。

## User Decision Points

Domain A を妨げる user decision point はなし。
