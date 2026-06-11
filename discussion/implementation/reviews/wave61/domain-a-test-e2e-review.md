# Wave61 Domain A Test / E2E Review

verdict: pass

## Scope Reviewed

- Target: `wave61-mixed-ordered-children-structure-order-foundation`.
- Review lane: test adequacy / E2E oracle.
- Re-reviewed updated Gnome report, prior lane 3 report, basis docs, changed tests, related implementation, E2E coverage, schema tests, and fixture expectation diffs.
- This review did not modify source, docs, tests, fixtures, or implementation files outside this report.

## Basis Documents Used

- `discussion/implementation/orchestration/wave61-plan.md`
- `discussion/design/screen-design/components/parts-tree.md`
- `discussion/design/screen-design/components/canvas-preview.md`
- `discussion/design/screen-design/screens/authoring-workspace.md`
- `discussion/design/screen-design/e2e-oracle.md`
- `discussion/development_convention/ux-backed-package-logic-authority.md`
- `discussion/development_convention/operation-policy.md`
- `.github/skills/implementation-orchestration/SKILL.md`
- `discussion/implementation/waves/wave61/domain-a-gnome-report.md`
- Prior report: `discussion/implementation/reviews/wave61/domain-a-test-e2e-review.md`

## Findings

### 1. Blocking test adequacy findings are closed

Severity: none

The prior high-severity mixed DnD matrix gap is closed at the authoring mutation oracle level. `packages/authoring-core/src/structure-order-mutations.test.ts` now parameterizes all required combinations: Drawable before/after Drawable, Drawable before/after Part Container, Drawable inside Part Container, Part Container before/after Drawable, Part Container before/after Part Container, and Part Container inside Part Container (`:120`, `:132`, `:144`, `:156`, `:168`, `:183`, `:195`, `:207`, `:219`, `:231`). The same test also covers root-part drawable membership, cycle / illegal root part rejection, and drawable no-op rejection (`:263`, `:296`), with assertions for ordered children and flattened draw order.

Operation-level coverage is now a defensible oracle for the mixed move contract. `packages/operation-core/src/operations/move-structure-child.test.ts:106` commits representative mixed item drops through the operation contract, and `:163` covers cyclic part nesting and no-op rejection. Schema registration is covered by `packages/operation-core/src/operation-schemas.test.ts:206` and `:361`.

### 2. Validator ordered-children branch coverage is closed

Severity: none

The prior validator gap is closed. `packages/validator-core/src/part-texture-layer-diagnostics.test.ts` now covers accepted mixed ordered children (`:258`), duplicates and membership mismatches (`:293`), missing ordered-child targets (`:385`, `:416`, `:457`), and deterministic parent mismatch evidence for both parts and drawables (`:502`, `:544`). This is adequate for the new durable `children` authority and fixture/schema consistency checks.

### 3. Canvas projection nested Part Container coverage is closed

Severity: none

The prior Canvas projection gap is closed. `apps/editor/src/workspace/canvas/canvas-projection.test.ts` adds a nested Part Container fixture (`:25`, `:418`) and verifies flattened Canvas draw order, selected drawable sets, nested-part selection, and hit-test topmost behavior (`:108`, `:115`, `:122`, `:125`, `:131`). This covers the Canvas projection alignment required by Domain A without a pixel or screenshot oracle.

### 4. Mixed Playwright E2E remains absent, but is not a blocker for this lane

Severity: residual risk

There is still no dedicated Playwright test for mixed Part Container / Drawable before, after, and inside DnD. The existing E2E remains the prior drawable-to-drawable reorder path at `apps/editor/e2e/psd-import.e2e.spec.ts:159`. However, the updated review request explicitly allows passing without new mixed Playwright E2E when unit/operation coverage is a defensible oracle and residual risk is documented.

That condition is met: the full semantic matrix is covered in authoring-core, representative operation commits cover the operation contract, editor-session tests cover before/after/inside drop intent creation at `apps/editor/src/features/editor-session/model/session-tree.test.ts:121`, and the UI panel wires `createStructureMoveDrop` to `moveStructureChild` through non-pixel drop placement state at `apps/editor/src/workspace/panels/structure-tree-panel.tsx:88`, `:135`, and `:137`. Remaining risk is limited to browser pointer-zone integration for mixed rows, not the structure-order algorithm or package/runtime oracle.

## Operation / Fixture Consistency

- `packages/authoring-core/src/draw-order-mutations.test.ts` covers normalized draw-order updates, duplicate rejection, no-op rejection, and mismatch repair (`:19`, `:74`, `:92`, `:108`).
- `packages/operation-core/src/operations/set-draw-order.test.ts:205` rejects `setDrawOrder` payloads that cross Part Container block boundaries, keeping structural moves under `moveStructureChild`.
- `apps/editor/src/features/editor-session/model/editor-session-commands.test.ts` covers drawable reparent, cross-part drawable reorder, and part reparent resyncing Canvas draw order to projected tree order (`:32`, `:43`, `:53`).
- Fixture expectation diffs under `fixtures/contracts/**/expected/*.json` were inspected. They consistently add `children` diff paths, update Wave30 operation counts/revisions for three `moveStructureChild` operations, and normalize base draw order evidence. No fixture-only inconsistency was found.

## Verification Performed

- `pnpm.cmd exec vitest run packages/authoring-core/src/structure-order-mutations.test.ts packages/operation-core/src/operations/move-structure-child.test.ts packages/operation-core/src/operations/set-draw-order.test.ts apps/editor/src/features/editor-session/model/session-tree.test.ts apps/editor/src/features/editor-session/model/editor-session-commands.test.ts apps/editor/src/workspace/canvas/canvas-projection.test.ts packages/validator-core/src/part-texture-layer-diagnostics.test.ts`
  - Sandbox result: failed with Vite/esbuild `spawn EPERM`.
  - Escalated rerun: pass, 7 files / 58 tests.
- `git diff --check -- apps packages scripts package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.json discussion fixtures`
  - Pass / exit 0. CRLF replacement warnings only.

I did not rerun root `pnpm run typecheck`, root `pnpm run test:unit`, root `pnpm run check`, app build, or the existing Playwright E2E in this re-review. The updated Gnome report records those broader checks as passing, including `pnpm.cmd --dir apps/editor test:e2e:psd-import` with 3 tests passing. Direct inspection was sufficient for the remaining E2E-oracle question because no new mixed Playwright test exists and the acceptance decision rests on the strengthened unit/operation oracle.

## Remaining Risks / Constraints

- Mixed Part Container / Drawable browser DnD before/after/inside is not covered by a dedicated Playwright user-path test. This should be considered a residual integration risk, not a blocking Domain A test adequacy gap after the added unit/operation coverage.
- Root `ModelPart` direct Drawable membership is treated as legal by the current tests and Gnome report. If another review lane rejects that contract, lane 3 should be revisited, but no lane 3 user decision is required now.
- E2E oracle compliance is maintained: no screenshot or pixel oracle was introduced.

## User-Decision Points

- None.
