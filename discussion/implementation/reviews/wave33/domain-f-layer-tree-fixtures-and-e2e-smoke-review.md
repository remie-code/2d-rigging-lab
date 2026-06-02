# Wave33 Domain F Review: Layer Tree Fixtures And E2E Smoke

Date: 2026-06-02

Reviewer: Review-Sylph

Verdict: `pass`

## Scope Reviewed

- `fixtures/contracts/wave33-layer-tree-direct-manipulation-contract-fixtures/**`
- `packages/operation-core/src/wave33-layer-tree-direct-manipulation-contract-fixtures.test.ts`
- `apps/editor/e2e/test-ids.mjs`
- `apps/editor/e2e/layer-tree-direct-manipulation-smoke.mjs`
- `apps/editor/e2e/smoke-checks.mjs`
- `discussion/tests/fixtures/fixture-manifest.md`
- `discussion/tests/traceability/test-traceability-matrix.md`
- `discussion/implementation/waves/wave33/domain-f-layer-tree-fixtures-and-e2e-smoke-gnome-report.md`

## Basis Used

- `.agents/skills/implementation-orchestration/SKILL.md`
- `C:/Users/remie/.codex/skills/subagent-context-hygiene/SKILL.md`
- `discussion/implementation/orchestration/wave33-plan.md`
- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/development_convention/dependency-policy.md`
- `discussion/development_convention/schema-and-id-conventions.md`
- `discussion/tests/fixtures/fixture-manifest.md`
- `discussion/tests/traceability/test-traceability-matrix.md`
- Wave33 Domain A-E reports and review artifacts under `discussion/implementation/waves/wave33/` and `discussion/implementation/reviews/wave33/`

## Findings

No blocking or non-blocking findings.

## Review Evidence

- Fixture determinism and rights-clean boundary pass. The fixture manifest declares semantic JSON expected artifacts and invalid cases, including non-empty delete and pending-delete preflight diagnostics, in `fixtures/contracts/wave33-layer-tree-direct-manipulation-contract-fixtures/fixture-manifest.json:23`, `fixtures/contracts/wave33-layer-tree-direct-manipulation-contract-fixtures/fixture-manifest.json:31`, and `fixtures/contracts/wave33-layer-tree-direct-manipulation-contract-fixtures/fixture-manifest.json:63`. Its semantic boundary explicitly disables real image bytes, parser, renderer, pixel, Cubism, native drag/drop, and external dependency oracles at `fixtures/contracts/wave33-layer-tree-direct-manipulation-contract-fixtures/fixture-manifest.json:77`.
- Operation/package/runtime/viewer/validator evidence is pinned by the focused test against expected JSON rather than only existence checks: `packages/operation-core/src/wave33-layer-tree-direct-manipulation-contract-fixtures.test.ts:176`, `packages/operation-core/src/wave33-layer-tree-direct-manipulation-contract-fixtures.test.ts:179`, `packages/operation-core/src/wave33-layer-tree-direct-manipulation-contract-fixtures.test.ts:182`, and `packages/operation-core/src/wave33-layer-tree-direct-manipulation-contract-fixtures.test.ts:185`.
- Rename, reparent, drawable reassignment, texture assignment, empty-leaf delete, and non-empty delete rejection are represented in expected operation/package summaries: `fixtures/contracts/wave33-layer-tree-direct-manipulation-contract-fixtures/expected/operation-chain-summary.json:4`, `fixtures/contracts/wave33-layer-tree-direct-manipulation-contract-fixtures/expected/operation-chain-summary.json:16`, `fixtures/contracts/wave33-layer-tree-direct-manipulation-contract-fixtures/expected/operation-chain-summary.json:40`, `fixtures/contracts/wave33-layer-tree-direct-manipulation-contract-fixtures/expected/operation-chain-summary.json:63`, `fixtures/contracts/wave33-layer-tree-direct-manipulation-contract-fixtures/expected/operation-chain-summary.json:81`, and `fixtures/contracts/wave33-layer-tree-direct-manipulation-contract-fixtures/expected/operation-chain-summary.json:107`.
- Save/load reinspection and pending-delete preflight contract coverage are present in fixture expected artifacts and focused test assertions: `fixtures/contracts/wave33-layer-tree-direct-manipulation-contract-fixtures/expected/editor-persistence-reinspection-summary.json:4`, `fixtures/contracts/wave33-layer-tree-direct-manipulation-contract-fixtures/expected/editor-persistence-reinspection-summary.json:15`, `fixtures/contracts/wave33-layer-tree-direct-manipulation-contract-fixtures/expected/editor-pending-delete-preflight-summary.json:4`, and `packages/operation-core/src/wave33-layer-tree-direct-manipulation-contract-fixtures.test.ts:206`.
- Desktop/mobile e2e smoke drives the production Layer Tree controls, commits the pass path, reinspects Preview/Viewer, saves, reloads, and reinspects again at `apps/editor/e2e/layer-tree-direct-manipulation-smoke.mjs:78`, `apps/editor/e2e/layer-tree-direct-manipulation-smoke.mjs:105`, `apps/editor/e2e/layer-tree-direct-manipulation-smoke.mjs:113`, and `apps/editor/e2e/layer-tree-direct-manipulation-smoke.mjs:121`.
- E2E evidence is specific enough for the scoped risks: pass-path state checks assert the empty part is absent, the parent delete button is disabled for a non-empty part, the drawable is reassigned, and texture status is resolved at `apps/editor/e2e/layer-tree-direct-manipulation-smoke.mjs:293`; Preview semantic evidence is checked at `apps/editor/e2e/layer-tree-direct-manipulation-smoke.mjs:309`; Viewer part/drawable/validation evidence is checked at `apps/editor/e2e/layer-tree-direct-manipulation-smoke.mjs:363`; saved package graph, operation log, texture atlas, and generated runtime/validation artifact presence are checked at `apps/editor/e2e/layer-tree-direct-manipulation-smoke.mjs:392`.
- Domain E pending-delete preflight is covered through production UI behavior: e2e drafts drawable assignment to a pending-delete part, verifies the option is disabled, commits, then asserts operation log count stays at the preflight baseline, the draft remains visible, the pending part remains empty, and the drawable stays on root at `apps/editor/e2e/layer-tree-direct-manipulation-smoke.mjs:567`.
- Integrated e2e includes the new smoke in the standard run at `apps/editor/e2e/smoke-checks.mjs:36` and `apps/editor/e2e/smoke-checks.mjs:207`.
- Fixture registration and traceability are present at `discussion/tests/fixtures/fixture-manifest.md:93`, `discussion/tests/traceability/test-traceability-matrix.md:66`, and `discussion/tests/traceability/test-traceability-matrix.md:248`.

## Verification Run

- `pnpm.cmd exec vitest run packages/operation-core/src/wave33-layer-tree-direct-manipulation-contract-fixtures.test.ts`: passed, 1 file / 2 tests.
- `node apps/editor/e2e/layer-tree-direct-manipulation-smoke.mjs`: passed for desktop and mobile.
- `pnpm.cmd test:e2e`: passed for desktop and mobile integrated smoke.
- `pnpm.cmd typecheck`: passed.
- `git diff --check -- fixtures/contracts/wave33-layer-tree-direct-manipulation-contract-fixtures apps/editor/e2e packages/operation-core/src/wave33-layer-tree-direct-manipulation-contract-fixtures.test.ts discussion/tests/fixtures/fixture-manifest.md discussion/tests/traceability/test-traceability-matrix.md discussion/implementation/waves/wave33`: passed with CRLF normalization warnings only.
- `rg --files fixtures/contracts/wave33-layer-tree-direct-manipulation-contract-fixtures`: fixture directory contains JSON files only; no committed image/binary artifacts found.

## Notes

- The production e2e validation path intentionally observes deterministic metadata-only source-intake diagnostics (`asset.psd.adapterDiagnostic` and `ref.textureSourceLayerMismatch`) while the contract fixture pins a validator pass path for the authored semantic package. I did not treat this as a finding because e2e asserts the exact diagnostics and does not use parser/image/pixel/render output as an oracle.
- The direct e2e captures screenshots and logs their format/length, but no screenshot bytes are committed and no pixel comparison is used as pass/fail evidence.
- No dependency manifest or lockfile changes are in the reviewed Domain F scope.

## User Decision Points

None.

## Gnome / Review-Sylph Separation

Preserved. I inspected the changed files and basis documents directly, ran focused verification myself, and wrote only this review artifact.
