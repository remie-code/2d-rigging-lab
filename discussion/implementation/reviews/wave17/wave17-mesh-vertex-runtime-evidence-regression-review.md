# Wave 17 Domain B Review: mesh vertex runtime evidence regression

- verdict: `pass`
- reviewer: Review-Sylph, separate context
- target: `wave17-mesh-vertex-runtime-evidence-regression`
- review lanes: Design / Development Compliance Review, Test Adequacy Review

## Review Context Separation Evidence

本レビューは、Gnome 実装担当とは別コンテキストの Review-Sylph として実施した。source implementation files / tests は編集せず、親から明示委譲されたこの review report のみ作成した。

Separation evidence:

- Gnome implementation context: `019e7884-7107-74d1-9244-9fe8a7a9fbb7` (`Gnome the 11th`)
- Review-Sylph context: `019e788e-7587-7eb0-b066-9fa817b2924e` (`Sylph the 12th`)。Gnome summary だけに依存せず、basis documents、diff、test、fixture を直接確認した。

## Basis Documents Used

- `.agents/skills/implementation-orchestration/SKILL.md`
- `C:/Users/remie/.codex/skills/subagent-context-hygiene/SKILL.md`
- `discussion/implementation/orchestration/wave17-plan.md`
- `discussion/implementation/current-capability-map.md`
- `discussion/implementation/waves/wave16/wave16-final-report.md`
- `discussion/implementation/waves/wave17/wave17-mesh-vertex-operation-foundation-completion.md`
- `discussion/implementation/reviews/wave17/wave17-mesh-vertex-operation-foundation-review.md`
- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/design/module-contracts/operation-contracts.md`
- `discussion/design/module-contracts/runtime-core-contract.md`
- `discussion/implementation/waves/wave17/wave17-mesh-vertex-runtime-evidence-regression-completion.md`

## Changed Files / Evidence Reviewed

Tracked diff reviewed:

- `packages/runtime-core/src/snapshot.ts`
- `fixtures/contracts/created-drawable-runtime-evidence/expected/created-drawable-runtime-evidence-summary.json`

Untracked/new Domain B files read directly:

- `packages/operation-core/src/mesh-vertex-runtime-evidence.test.ts`
- `fixtures/contracts/mesh-vertex-runtime-evidence/fixture-manifest.json`
- `fixtures/contracts/mesh-vertex-runtime-evidence/request/create-drawable-commit.request.json`
- `fixtures/contracts/mesh-vertex-runtime-evidence/request/generate-mesh-commit.request.json`
- `fixtures/contracts/mesh-vertex-runtime-evidence/request/move-mesh-vertex-commit.request.json`
- `fixtures/contracts/mesh-vertex-runtime-evidence/expected/mesh-vertex-runtime-evidence-summary.json`
- `discussion/implementation/waves/wave17/wave17-mesh-vertex-runtime-evidence-regression-completion.md`

Worktree also contains Domain A and Domain C/editor changes. Domain C/app editor changes were treated as outside Domain B write scope and were not reviewed as Domain B implementation.

## Findings

Blocking Domain B findings: none.

Escalation finding, resolved:

- 初回レビュー時点では `pnpm.cmd typecheck` が Wave/required full gate として未通過だった。Gnome 報告では root typecheck 通過後、forbidden/out-of-scope の Domain C file `apps/editor/src/editor-state/mesh-edit-state.ts(43,33)` で `string` not assignable to `MeshId` により editor typecheck が失敗していた。これは Domain B source/test defect ではなかった。
- Domain C completion 後、Orch-Sylph が full `pnpm.cmd typecheck` を再実行し、sandbox EPERM 後の escalated rerun で root typecheck と editor typecheck が両方 pass した。これにより escalation 理由は解消済み。

## Design / Development Compliance Review

Domain B stayed within the allowed write scope. The production source change is limited to `packages/runtime-core/src/snapshot.ts`, which Wave 17 Domain B allows only for a test-discovered runtime bug fix. The rest of the Domain B work is operation evidence test code, compact contract fixtures, fixture expected output, and the completion report.

The runtime snapshot hash fix is minimal and evidence-backed. `snapshot.ts` now imports the existing geometry hash helper and uses it only when `NormalizedDrawable.vertices` exists; otherwise it preserves the old drawable-id/count fallback (`packages/runtime-core/src/snapshot.ts:289`, `packages/runtime-core/src/snapshot.ts:371`). The helper itself is already deterministic over normalized vertex coordinates and vertex count (`packages/runtime-core/src/drawable-geometry.ts:34`). This directly addresses the Domain B need for vertex edits to change runtime snapshot geometry metadata.

Runtime diff observation through existing `drawableChanges` satisfies the Domain B requirement without shared contract redesign. The Wave 17 plan explicitly permits a dedicated field or an existing diff field. Existing snapshot comparison emits `drawableChanges` when bounds, vertex hash, or runtime state changes (`packages/runtime-core/src/snapshot-comparison.ts:75`, `packages/runtime-core/src/snapshot-comparison.ts:95`). The fixture fixes `boundsChanged: true` and before/after vertex hashes for the moved mesh (`fixtures/contracts/mesh-vertex-runtime-evidence/expected/mesh-vertex-runtime-evidence-summary.json:96`).

No `index.ts` implementation logic was introduced. `packages/operation-core/src/index.ts` and `packages/runtime-core/src/index.ts` remain barrel-only export surfaces. No new catch-all production source file was introduced. The new test file is integration-style and focused on one contract fixture.

The update to the existing created-drawable runtime evidence expected summary is consistent with the new geometry-based hash semantics: empty generated vertices now use `vhash_811c9dc5_0`, and generated 4-vertex geometry uses `vhash_327bd044_4` (`fixtures/contracts/created-drawable-runtime-evidence/expected/created-drawable-runtime-evidence-summary.json:29`, `fixtures/contracts/created-drawable-runtime-evidence/expected/created-drawable-runtime-evidence-summary.json:153`).

## Test Adequacy Review

The compact fixture proves the intended operation sequence. The request fixtures commit `createDrawable` at revision 0, `generateMesh` at revision 1, then `moveMeshVertex` at revision 2 with stable vertex id `vtx_mesh_vertex_oracle_1_1` and delta `{ x: 4, y: 6 }` (`fixtures/contracts/mesh-vertex-runtime-evidence/request/create-drawable-commit.request.json:7`, `fixtures/contracts/mesh-vertex-runtime-evidence/request/generate-mesh-commit.request.json:7`, `fixtures/contracts/mesh-vertex-runtime-evidence/request/move-mesh-vertex-commit.request.json:11`).

Runtime snapshot evidence is adequate. The test asserts full-detail baseline vertices/bounds/hash and candidate vertices/bounds/hash after the move (`packages/operation-core/src/mesh-vertex-runtime-evidence.test.ts:107`, `packages/operation-core/src/mesh-vertex-runtime-evidence.test.ts:117`). The expected fixture preserves the same oracle with package revision 2 before the move and revision 3 after it (`fixtures/contracts/mesh-vertex-runtime-evidence/expected/mesh-vertex-runtime-evidence-summary.json:30`, `fixtures/contracts/mesh-vertex-runtime-evidence/expected/mesh-vertex-runtime-evidence-summary.json:63`).

Runtime diff evidence is adequate for this domain. The test asserts `drawableChanges` with `boundsChanged: true`, `vertexHashBefore`, and `vertexHashAfter`, and also asserts the committed operation log carries the same runtime diff (`packages/operation-core/src/mesh-vertex-runtime-evidence.test.ts:127`, `packages/operation-core/src/mesh-vertex-runtime-evidence.test.ts:135`).

Validation report evidence is adequate at the current validator evidence level. The evidence provider creates baseline/candidate runtime evidence reports, marks candidate operation log evidence present, records runtime snapshot ids, materializes validation artifacts, and returns generated validation report ids to the operation result (`packages/operation-core/src/mesh-vertex-runtime-evidence.test.ts:277`, `packages/operation-core/src/mesh-vertex-runtime-evidence.test.ts:285`, `packages/operation-core/src/mesh-vertex-runtime-evidence.test.ts:314`). The expected summary fixes `candidateStatus: "pass"`, operation log path, runtime snapshot ids, and zero validation diff changes (`fixtures/contracts/mesh-vertex-runtime-evidence/expected/mesh-vertex-runtime-evidence-summary.json:110`).

Operation result and operation log evidence are adequate. The summarizer records result runtime snapshot ids, result validation report ids, result runtime diff drawable changes, log entry snapshot/report ids, log entry runtime diff, payload `vertexDeltas`, and final runtime state ref (`packages/operation-core/src/mesh-vertex-runtime-evidence.test.ts:426`). The expected fixture fixes all of those values (`fixtures/contracts/mesh-vertex-runtime-evidence/expected/mesh-vertex-runtime-evidence-summary.json:129`).

Fixture size and determinism are reasonable. The fixture consists of three request JSON files, one manifest, one expected summary, and a focused test. It uses fixed operation ids, idempotency keys, timestamp, package hash, snapshot ids, validation report ids, and exact vertex coordinates.

## Verification Considered

Gnome verification considered:

- Focused mesh/runtime/evidence tests: pass after sandbox escalation, 6 files / 14 tests.
- Validator evidence tests: pass after sandbox escalation, 2 files / 9 tests.
- `pnpm.cmd run typecheck:root`: pass after sandbox escalation.
- `pnpm.cmd run check:source`: pass.
- `git diff --check -- packages/operation-core/src packages/runtime-core/src packages/validator-core/src fixtures/contracts discussion/implementation/waves/wave17/wave17-mesh-vertex-runtime-evidence-regression-completion.md`: pass, LF/CRLF warnings only.
- Required full `pnpm.cmd typecheck`: fail after root pass due forbidden-scope untracked `apps/editor/src/editor-state/mesh-edit-state.ts(43,33)` string-to-`MeshId` error.
- Domain C completion 後の Orch-Sylph 再実行:
  - `pnpm.cmd typecheck`
  - sandbox: TypeScript `node_modules` read が `EPERM`
  - escalated rerun: pass。root typecheck と editor typecheck の両方が通過。

Independent review inspection performed:

- Read basis documents and Domain B completion report.
- Inspected `git diff -- packages/runtime-core/src/snapshot.ts fixtures/contracts/created-drawable-runtime-evidence/expected/created-drawable-runtime-evidence-summary.json`.
- Read `packages/operation-core/src/mesh-vertex-runtime-evidence.test.ts`.
- Read the new fixture manifest, request files, and expected summary.
- Checked existing runtime comparison behavior and hash helper source references.
- Checked `index.ts` files remain barrel-only by content inspection.

I did not rerun the escalated test/typecheck commands in this review context; the review verdict is based on direct source/fixture inspection plus the reported Gnome verification results.

## Remaining Risks / Open Verification Items

- 初回時点の external Domain C/app editor type error は Domain C completion 後に解消済み。Domain B の追加 source 修正は不要だった。
- Runtime diff uses existing `drawableChanges` rather than a dedicated mesh-vertex diff field. This is acceptable for Domain B, but future contract work may still choose a more granular mesh diff if UI/debug workflows need it.
- Validator evidence currently proves edited mesh runtime evidence is accepted by the existing runtime evidence report path. It does not add deeper mesh topology or triangle semantic validation, which remains future validator expansion.

## Needs-Fix Loop Recommendation

Do not send Domain B back to Gnome for a needs-fix loop. Domain B design/development compliance and test adequacy pass under the assigned rubric. Domain C completion 後に required full `pnpm.cmd typecheck` gate も pass したため、Domain B status は `pass` とする。
