# Wave61 Domain B Gnome Report

Verdict: done

## Changed files summary

- `apps/editor/src/editor-workflow/browser-psd-parser-adapter.ts`
  - PSD parser adapter now emits local/effective visibility separately for groups/layers.
  - `visibleInSource` remains effective visibility for compatibility.
- `apps/editor/src/features/psd-import/**`
  - Added selected-PSD-only preview projection and React canvas rendering.
  - Added preview stable hooks: `data-testid="psd-import-preview"`, `data-preview-ready`, `data-visible-layer-count`, canvas size, per-layer source/order/opacity attributes.
  - Import plan now carries `editorHiddenPartIds`, local/effective row metadata, and local-only runtime visibility initialization.
  - Commit result returns editor hidden part IDs for session state initialization.
- `apps/editor/src/features/editor-session/editor-session-context.tsx`
  - Focused update: PSD import commit unions imported hidden Part Container IDs into existing editor-only hidden part state.
  - Note: this file also contains unrelated pre-existing worktree changes outside Domain B.
- `apps/editor/e2e/psd-import.e2e.spec.ts`
  - Replaced preview placeholder assertion with structured preview-ready/count checks.
- `packages/operation-core/**`, `packages/package-format/**`, `packages/validator-core/**`
  - Added `localVisibleInSource` / `effectiveVisibleInSource` support to PSD adapter/source/profile/scaffold schemas and materialization mapping.
  - Structural scaffold initial runtime visibility now follows leaf local visibility, not parent-effective visibility.
  - Structural import/validator checks compare local/effective visibility and preserve parent-hidden child runtime visibility.
- `fixtures/contracts/psd-unsupported-layer/expected/validation-report.json`
  - Updated source diagnostics fixture for local visibility evidence.

## AC coverage

- PSD Import Review now renders selected PSD-only preview from materialized layer bytes and PSD canvas bounds.
- Preview filters to effective visible layers; hidden layers and hidden group descendants are omitted.
- Layer opacity is reflected through layer opacity and parent group opacity multiplication where available.
- Clipping preview was not implemented, per accepted AC.
- Local/effective visibility are separated in adapter result, scaffold evidence, review rows, and validator evidence.
- Hidden PSD groups initialize editor-only hidden Part Container gates.
- Parent hidden groups do not mutate child Drawable runtime visibility; only locally hidden leaves initialize runtime hidden.
- Runtime/export part visibility semantics were not introduced.
- Source-order insertion remains on Domain A helpers via existing `reorderChildrenBySourceOrder(session, entries)`.

## Verification

- `pnpm.cmd exec vitest run apps/editor/src/features/psd-import/model/psd-import-preview.test.ts packages/package-format/src/psd-structural-scaffold-evidence.test.ts packages/operation-core/src/psd-structural-scaffold-contracts.test.ts packages/operation-core/src/operations/import-psd-structural-scaffold.test.ts packages/validator-core/src/psd-structural-scaffold-diagnostics.test.ts`
  - Pass: 5 files, 32 tests.
  - Initial sandbox run failed with `spawn EPERM`; escalated rerun passed.
- `pnpm.cmd --dir apps/editor typecheck`
  - Pass.
- `pnpm.cmd --dir apps/editor build`
  - Pass after escalated rerun.
  - Initial sandbox run failed with Vite/esbuild `spawn EPERM`; final run had only existing chunk-size warning.
- `pnpm.cmd run typecheck`
  - Pass.
- `pnpm.cmd run test:unit`
  - Pass after fixture update: 189 files, 982 tests.
  - Initial sandbox run failed with Vite/esbuild `spawn EPERM`.
- `pnpm.cmd run check`
  - Pass after escalated rerun: typecheck, unit tests, dependency guard, source organization guard.
  - Initial sandbox run failed with Vite/esbuild `spawn EPERM`.
- `pnpm.cmd --dir apps/editor test:e2e:psd-import`
  - Pass after escalated rerun and a short wait for port `4173` TIME_WAIT: 4 tests.
  - Initial sandbox run failed with `spawn EPERM`; first escalated run hit transient port-in-use.
- `git diff --check -- apps packages scripts package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.json discussion`
  - Pass; output contained LF/CRLF warnings only.

## Escalations / assumptions

- No user/design escalation required.
- Assumption kept for compatibility: existing `visibleInSource` remains effective source visibility; new local/effective fields provide the distinction.
- Hidden Part Container gate remains editor-only session state. No runtime/export part visibility semantics or raw PSD durable persistence were added.

## Notes for reviewers

- Stable preview hooks are structural, not pixel-based.
- Focused tests added/updated around:
  - PSD import preview effective visibility filtering.
  - parent-hidden local-visible leaves staying runtime-visible.
  - structural scaffold schema allowing effective-hidden/local-visible leaves.
  - validator evidence/counts for local vs effective hidden leaves.

## Focused review fix update

Review lane 3 findings addressed:

- D-B-T1: fixed.
  - Added `apps/editor/src/features/psd-import/model/psd-import-hidden-part-bridge.test.ts`.
  - The test mocks a hidden-group PSD adapter result, builds the import plan, commits it, and verifies:
    - `plan.editorHiddenPartIds` contains the locally hidden PSD group Part Container.
    - `commitPsdImportPlan` returns the same hidden Part IDs.
    - `mergeEditorHiddenPartIds` unions those IDs into existing editor-only hidden state.
    - The child Drawable under the hidden group remains `runtimeVisibility: true`.
    - session tree projection marks the Part Container editor-hidden and the child Drawable effectively hidden only via the editor Part gate.
  - Added `apps/editor/src/features/editor-session/model/editor-hidden-part-state.ts` and wired `EditorSessionProvider` to use the same helper, so the tested merge is the production session bridge logic.
- D-B-T2: fixed with focused assertions.
  - Updated `packages/operation-core/src/operations/import-psd-structural-scaffold.test.ts` to assert mixed `children` order on imported parent parts.
  - The same test now asserts `modelDiff.changed` includes `/model/graph/parts/{partId}/children` and `/model/drawOrder/entries`, covering the Domain A source-order integration point from the PSD import operation.

Focused fix verification:

- `pnpm.cmd exec vitest run apps/editor/src/features/psd-import/model/psd-import-hidden-part-bridge.test.ts packages/operation-core/src/operations/import-psd-structural-scaffold.test.ts`
  - sandbox: failed with Vite/esbuild `spawn EPERM`.
  - escalated rerun after fixes: passed, 2 files / 12 tests.
- `pnpm.cmd --dir apps/editor typecheck`
  - failed once on a branded `ProvenanceId` fixture value in the new test.
  - fixed with `ProvenanceIdSchema.parse(...)`, rerun passed.
- `pnpm.cmd run typecheck`
  - passed.
- `pnpm.cmd run check:source`
  - passed.
- `git diff --check -- apps/editor/src/features/editor-session/model/editor-hidden-part-state.ts apps/editor/src/features/editor-session/editor-session-context.tsx apps/editor/src/features/psd-import/model/psd-import-hidden-part-bridge.test.ts packages/operation-core/src/operations/import-psd-structural-scaffold.test.ts discussion/implementation/waves/wave61/domain-b-gnome-report.md`
  - passed; output contained LF/CRLF warnings only.

No user/design escalation was required for the focused fix.
