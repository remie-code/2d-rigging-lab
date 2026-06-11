# Wave60 Domain A Test Adequacy / E2E Oracle Review

- Verdict: `pass`
- Target: `wave60-parts-tree-inspector-editing-dnd-boundary-probe-v0`
- Lane: Domain A test adequacy / E2E oracle
- Review pass: fix loop 1 re-review

## Scope Reviewed

- Updated Gnome report:
  - `discussion/implementation/waves/wave60/domain-a-gnome-report.md`
- Previous review:
  - `discussion/implementation/reviews/wave60/domain-a-test-e2e-review.md`
- Basis docs:
  - `discussion/implementation/orchestration/wave60-plan.md`
  - `discussion/design/screen-design/e2e-oracle.md`
  - `discussion/design/screen-design/react-editor-foundation-oracle.md`
  - `discussion/design/screen-design/components/parts-tree.md`
  - `discussion/design/screen-design/components/part-container-inspector.md`
  - `discussion/design/screen-design/components/drawable-inspector.md`
  - `discussion/design/screen-design/components/canvas-preview.md`
  - `C:/Users/remie/.codex/skills/implementation-orchestration/SKILL.md`
- Re-reviewed tests/source:
  - `apps/editor/src/features/editor-session/model/editor-session-commands.test.ts`
  - `apps/editor/src/features/editor-session/model/editor-session-commands.ts`
  - `apps/editor/src/features/editor-session/model/session-tree.test.ts`
  - `apps/editor/src/features/editor-session/model/session-tree.ts`
  - `apps/editor/e2e/psd-import.e2e.spec.ts`
  - `apps/editor/src/workspace/panels/structure-tree-panel.tsx`
  - `apps/editor/src/workspace/panels/inspector-panel.tsx`
  - `apps/editor/src/workspace/panels/canvas-preview-panel.tsx`
  - `packages/authoring-core/src/drawable-mutations.test.ts`
  - `packages/operation-core/src/operations/update-drawable.test.ts`
  - `packages/operation-core/src/operation-schemas.test.ts`

## Findings

No remaining actionable findings for this lane.

The previous DnD reparent coverage finding is resolved by structured editor-command tests that exercise the same command bridge used by the Parts Tree drop handlers:

- Drawable reparent keeps projected Tree order and Canvas/global draw order aligned: `apps/editor/src/features/editor-session/model/editor-session-commands.test.ts:32`
- Cross-part drawable reorder reparents to the target drawable's part and preserves top-row-is-front order: `apps/editor/src/features/editor-session/model/editor-session-commands.test.ts:43`
- Part reparent resyncs Canvas/global draw order to the new subtree order: `apps/editor/src/features/editor-session/model/editor-session-commands.test.ts:53`

The implementation path is connected through `StructureTreePanel` drop handlers for drawable reorder, drawable reparent, and part reparent (`apps/editor/src/workspace/panels/structure-tree-panel.tsx:107`, `apps/editor/src/workspace/panels/structure-tree-panel.tsx:116`, `apps/editor/src/workspace/panels/structure-tree-panel.tsx:121`) into `commitDrawableReorder`, `commitDrawableReparent`, and `commitPartReparent` (`apps/editor/src/features/editor-session/model/editor-session-commands.ts:157`, `apps/editor/src/features/editor-session/model/editor-session-commands.ts:214`, `apps/editor/src/features/editor-session/model/editor-session-commands.ts:236`).

## E2E Oracle Assessment

- Playwright E2E still covers the main import -> select -> Inspector edit -> Canvas/Tree reflection path in `apps/editor/e2e/psd-import.e2e.spec.ts:83`.
- Browser DnD reorder remains covered by `apps/editor/e2e/psd-import.e2e.spec.ts:159`.
- Reparent DnD is covered by equivalent editor-path structured tests rather than browser pointer choreography, which is acceptable under the Wave60 pass criterion allowing focused E2E or equivalent structured verification.
- `rg` checks found no `toHaveScreenshot`, screenshot comparison, pixel oracle, visual regression, CSS class/style assertion, or exact styling assertion in the E2E.
- The normal UI uses non-visible test hooks/state attributes such as `data-renderable-drawable-count` and `data-row-kind`; I found no visible test-only debug/evidence text added for convenience.

## DnD Test Finding

DnD coverage is adequate for the Wave60 boundary probe:

- Browser-level E2E covers drawable row reorder.
- Structured editor-command tests cover drawable reparent, cross-part reorder/reparent, and part reparent draw-order reconciliation.
- The remaining residual risk is acceptable: native browser DnD reparent pointer choreography is not separately covered, but the model/session transition behind the exposed drop handlers is covered directly.

## Verification Performed

Read-only checks performed during this re-review:

- `git status --short -uall`
- direct reads of the updated Gnome report, previous review report, updated command tests, command source, E2E spec, and relevant UI/source files
- `git diff -- apps/editor/src/features/editor-session/model/editor-session-commands.ts apps/editor/src/features/editor-session/model/session-tree.ts apps/editor/src/features/editor-session/model/editor-session-commands.test.ts`
- `git diff -- apps/editor/e2e/psd-import.e2e.spec.ts apps/editor/src/workspace/panels/structure-tree-panel.tsx apps/editor/src/workspace/panels/canvas-preview-panel.tsx apps/editor/src/workspace/panels/inspector-panel.tsx`
- `rg` checks for DnD/reparent coverage and E2E oracle violations
- `netstat -ano`
- `Get-Process -Id 1084`
- `Invoke-WebRequest http://127.0.0.1:4173` with timeout
- `Invoke-WebRequest http://127.0.0.1:5173` with timeout

I did not rerun Vitest or Playwright. The updated Gnome report records credible fix-loop verification:

- focused Vitest including `editor-session-commands.test.ts`: pass, 4 files / 17 tests
- `pnpm.cmd --dir apps/editor typecheck`: pass
- `pnpm.cmd run typecheck`: pass
- `pnpm.cmd --dir apps/editor test:e2e:psd-import`: pass, 3 tests
- `pnpm.cmd --dir apps/editor build`: pass with existing large chunk warning
- `pnpm.cmd run test:unit`: pass, 186 files / 948 tests
- `pnpm.cmd run check`: pass
- `git diff --check -- apps packages scripts package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.json discussion`: pass, LF-to-CRLF warnings only

## Dev Server Check

Playwright's managed verification server is configured for `127.0.0.1:4173`; current checks found no listener/HTTP response on that port.

`127.0.0.1:5173` remains active under PID `1084`, `node.exe`, start time `2026/06/11 19:27:53`. This is the same PID/start time recorded in the previous review before fix loop 1, and it is not the Playwright-managed verification port. Because command-line inspection is denied locally, it remains unattributed, but it is adequately separated from the fix-loop Playwright verification server for this lane.

## Residual Risks / Open Questions

- Native browser DnD reparent choreography is not separately covered by Playwright. The editor-path structured tests cover the underlying state transition and draw-order invariants, which is sufficient for Wave60.
- The persistent `5173` dev server should be handled outside this lane if the parent orchestrator requires a completely clean local process list, but it is not evidence of a leftover Playwright-managed verification server.
