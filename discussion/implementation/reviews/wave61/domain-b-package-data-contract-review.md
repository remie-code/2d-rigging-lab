# Wave61 Domain B Package / Visibility Semantics / Data Contract Review

Verdict: `pass`

## Scope Reviewed

- PSD adapter and editor import planning/commit data flow:
  - `apps/editor/src/editor-workflow/browser-psd-parser-adapter.ts`
  - `apps/editor/src/features/psd-import/model/psd-import-planner.ts`
  - `apps/editor/src/features/psd-import/model/psd-import-commit.ts`
  - `apps/editor/src/features/psd-import/model/psd-import-types.ts`
  - `apps/editor/src/features/psd-import/model/psd-import-preview.ts`
  - focused hidden-part session/canvas bridge in `apps/editor/src/features/editor-session/**` and `apps/editor/src/workspace/canvas/canvas-projection.ts`
- Package/source/profile/scaffold/evidence contracts:
  - `packages/package-format/src/source-manifest.ts`
  - `packages/package-format/src/psd-structural-scaffold-evidence.ts`
  - `packages/operation-core/src/payloads/import-source.ts`
  - `packages/operation-core/src/psd-structural-scaffold-evidence.ts`
- Operation-core PSD import/materialization/scaffold paths:
  - `packages/operation-core/src/operations/import-psd-layer-materialization.ts`
  - `packages/operation-core/src/operations/import-psd-source-asset-materialization.ts`
  - `packages/operation-core/src/operations/import-psd-source-asset-diagnostics.ts`
  - `packages/operation-core/src/operations/import-psd-structural-scaffold.ts`
- Validator and fixtures:
  - `packages/validator-core/src/validators/psd-source-profile-structured.ts`
  - `packages/validator-core/src/validators/psd-structural-scaffold-diagnostics.ts`
  - focused tests and `fixtures/contracts/psd-unsupported-layer/expected/validation-report.json`
- Domain A order-helper usage around `reorderChildrenBySourceOrder`.

## Basis Documents Used

- `discussion/implementation/orchestration/wave61-plan.md`
- `discussion/implementation/waves/wave61/domain-a-gnome-report.md`
- `discussion/implementation/reviews/wave61/domain-a-package-data-contract-review.md`
- `discussion/design/screen-design/screens/psd-import-task.md`
- `discussion/design/screen-design/components/part-container-inspector.md`
- `discussion/design/screen-design/components/parts-tree.md`
- `discussion/development_convention/ux-backed-package-logic-authority.md`
- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/development_convention/dependency-policy.md`
- `discussion/development_convention/operation-policy.md`
- `discussion/development_convention/schema-and-id-conventions.md`
- `.github/skills/implementation-orchestration/SKILL.md`
- `discussion/implementation/waves/wave61/domain-b-gnome-report.md`

## Findings

なし。

## Contract Checks

- Local and effective PSD visibility are separated at the adapter boundary while `visibleInSource` remains the effective-visibility compatibility field. The browser adapter computes `localVisibleInSource` from the node's own hidden state and `effectiveVisibleInSource` from parent visibility plus local visibility for layers and groups (`apps/editor/src/editor-workflow/browser-psd-parser-adapter.ts:218`, `apps/editor/src/editor-workflow/browser-psd-parser-adapter.ts:235`, `apps/editor/src/editor-workflow/browser-psd-parser-adapter.ts:248`, `apps/editor/src/editor-workflow/browser-psd-parser-adapter.ts:270`).
- Planner copies local/effective visibility into group and leaf scaffold DTOs, initializes leaf `initialRuntimeVisibility` from local source visibility, and records locally hidden groups as editor-hidden Part Containers (`apps/editor/src/features/psd-import/model/psd-import-planner.ts:287`, `apps/editor/src/features/psd-import/model/psd-import-planner.ts:333`, `apps/editor/src/features/psd-import/model/psd-import-planner.ts:347`, `apps/editor/src/features/psd-import/model/psd-import-planner.ts:577`).
- Hidden PSD groups stay editor-only. Commit result carries `editorHiddenPartIds`, and editor session state unions those IDs into `editorHiddenPartIds` instead of adding model/package/runtime part visibility semantics (`apps/editor/src/features/psd-import/model/psd-import-commit.ts:24`, `apps/editor/src/features/psd-import/model/psd-import-commit.ts:71`, `apps/editor/src/features/editor-session/editor-session-context.tsx:159`).
- Part Container gates affect editor projections without mutating child Drawable runtime visibility. Session tree and Canvas projection compute `hiddenByPart` / `effectiveHidden` from editor state and ancestors, while preserving `drawable.runtimeVisibility` as the leaf runtime field (`apps/editor/src/features/editor-session/model/session-tree.ts:125`, `apps/editor/src/features/editor-session/model/session-tree.ts:174`, `apps/editor/src/workspace/canvas/canvas-projection.ts:133`, `apps/editor/src/workspace/canvas/canvas-projection.ts:158`).
- Package-format and operation-core schemas accept local/effective visibility on PSD source/profile/scaffold surfaces. Leaf scaffold schema validation requires runtime initialization to match local source visibility, not effective source visibility (`packages/package-format/src/source-manifest.ts:153`, `packages/package-format/src/source-manifest.ts:230`, `packages/package-format/src/psd-structural-scaffold-evidence.ts:76`, `packages/package-format/src/psd-structural-scaffold-evidence.ts:112`, `packages/operation-core/src/payloads/import-source.ts:229`).
- Structural scaffold commit only applies `setRuntimeVisibility(false)` for leaves whose `initialRuntimeVisibility` is false. Parent-hidden/local-visible leaves remain runtime-visible, while locally hidden leaves initialize runtime-hidden (`packages/operation-core/src/operations/import-psd-layer-materialization.ts:270`, `packages/operation-core/src/operations/import-psd-structural-scaffold.ts:183`, `packages/operation-core/src/operations/import-psd-structural-scaffold.ts:1100`, `packages/operation-core/src/operations/import-psd-structural-scaffold.ts:1539`).
- Domain A order contract is respected. Structural import converts generated groups/leaves to mixed ordered child entries and calls `reorderChildrenBySourceOrder(session, entries)`, which works on `part.children` and syncs draw order. This avoids reverting to `childPartIds`-then-`drawableIds` read order (`packages/operation-core/src/operations/import-psd-structural-scaffold.ts:211`, `packages/operation-core/src/operations/import-psd-structural-scaffold.ts:1942`, `packages/authoring-core/src/structure-order-mutations.ts:146`).
- Validator checks compare local/effective visibility for groups and leaves, validate leaf runtime visibility against `initialRuntimeVisibility`, and report hidden leaf count separately from effective hidden leaf count (`packages/validator-core/src/validators/psd-structural-scaffold-diagnostics.ts:934`, `packages/validator-core/src/validators/psd-structural-scaffold-diagnostics.ts:1193`, `packages/validator-core/src/validators/psd-structural-scaffold-diagnostics.ts:1351`, `packages/validator-core/src/validators/psd-structural-scaffold-diagnostics.ts:1701`).
- The reviewed diff did not introduce raw PSD durable persistence, dependency changes, group-as-drawable generation, runtime/export part visibility semantics, or PSD clipping/pixel-oracle claims. Structural evidence keeps `rawParserObjectPersistence: "notPersisted"`, `sourcePsdBytePersistence: "metadataOnlyNoRawBytes"`, `groupDrawableTextureMeshRefs: "forbidden"`, and `initialGridMeshGeneration: "notProvided"` (`apps/editor/src/features/psd-import/model/psd-import-planner.ts:141`, `packages/operation-core/src/operations/import-psd-structural-scaffold.ts:1684`).

## Evidence Checked

- Directly inspected the basis docs, Domain A order contract/report, Domain B Gnome report, actual source/test diffs, current source files, and fixture expectations listed above.
- Checked focused tests proving:
  - parent-hidden/local-visible leaves remain runtime-visible;
  - locally hidden leaves initialize runtime-hidden;
  - schema accepts effective-hidden/local-visible leaves;
  - validator separates `hiddenLeafCount`, `effectiveHiddenLeafCount`, and `runtimeHiddenDrawableCount`;
  - preview filtering uses effective visibility while retaining local/effective distinction.
- Reviewed Gnome-reported full verification:
  - `pnpm --dir apps/editor typecheck`: pass
  - `pnpm --dir apps/editor build`: pass
  - root `pnpm run typecheck`: pass
  - root `pnpm run test:unit`: pass
  - root `pnpm run check`: pass
  - focused Playwright PSD import E2E: pass
  - broad `git diff --check`: pass with LF/CRLF warnings only

## Verification Performed

- Ran focused tests:
  - Sandbox run failed to load Vitest config with Vite/esbuild `spawn EPERM`.
  - Escalated rerun passed:
    - `pnpm.cmd exec vitest run apps/editor/src/features/psd-import/model/psd-import-preview.test.ts packages/package-format/src/psd-structural-scaffold-evidence.test.ts packages/operation-core/src/psd-structural-scaffold-contracts.test.ts packages/operation-core/src/operations/import-psd-structural-scaffold.test.ts packages/validator-core/src/psd-structural-scaffold-diagnostics.test.ts`
    - Result: 5 files / 32 tests passed.
- Ran targeted whitespace check:
  - `git diff --check --` focused Domain B package/data files, fixture, and this report.
  - Result: exit 0; LF/CRLF replacement warnings only.
- Did not rerun full root `pnpm run check`; Domain B Gnome report records it as passed after escalated rerun.

## Remaining Risks / User-Decision Points

- The compatibility field `visibleInSource` intentionally remains effective visibility. Consumers that need leaf runtime initialization must use `localVisibleInSource` when present.
- `psd-source-profile-structured` evidence currently emits `visibleInSource` and `localVisibleInSource`, but not a separate `effectiveVisibleInSource` evidence line (`packages/validator-core/src/validators/psd-source-profile-structured.ts:375`, `packages/validator-core/src/validators/psd-source-profile-structured.ts:386`). This is non-blocking because the source/profile schemas, structural scaffold evidence, operation preflight, and structural validator all preserve and compare `effectiveVisibleInSource`; `visibleInSource` remains the retained effective-visibility compatibility field.
- Worktree contains unrelated Domain A/C dirty changes; this review did not normalize or revert them.
- User-decision points: none.
