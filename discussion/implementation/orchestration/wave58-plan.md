# Wave 58 Plan: PSD Import E2E v0

> PSDを選択し、Import Reviewで作成予定Parts構造を確認し、Import後にWorkspaceのParts Treeへ実構造を反映する縦切り実装計画。画像previewはplaceholderでよい。

## 1. 状態

- Status: Planned
- Target wave: Wave58
- Wave name: `psd-import-e2e-v0`
- Primary objective: React Editor上で、PSD Importの主要ユーザー導線を実装する。`Import PSD` からmodalを開き、PSDを選択し、Import Reviewで作成予定Parts構造を確認し、Import後にWorkspaceのParts Treeへimport済み構造を表示する。

## 2. Planning Gate Result

Planning Gate result before this plan: `Inventory first` -> `Plan directly`.

Inventory basis:

- Sylph inventory verdict: `Mostly` possible. Domain commit/schema pieces exist, but the current React app is static shell and browser PSD parser/import-plan bridge is missing.
- Important facts:
  - `apps/editor/src/state/editor-ui-store.ts` currently owns only UI labels / active tool / active entry.
  - Parts Tree and Inspector are static from `apps/editor/src/workspace/workspace-data.ts`.
  - PSD parser exists in Node smoke scripts, but browser PSD adapter / file input bridge is absent from current React app.
  - Structural scaffold DTOs are usable for planned rows: `PsdStructuralScaffoldGroupPartDto` and `PsdStructuralScaffoldLeafDrawableDto`.
  - Issue DTOs can be reduced to row-level `hasIssue` + tooltip, but a UI row issue index must be created.
  - Commit operation exists through `importPsdStructuralScaffold`, but React must own and update session state after commit.

Accepted user decisions:

- The wave should not be cut too conservatively.
- One Gnome may own a large implementation task; excessive micro-splitting wastes time and tokens.
- Image preview can be a placeholder in this wave.
- Import Review must show the planned Editor Parts structure, not a PSD tree.
- Issue is binary: problem exists or does not exist. Row-level badge + tooltip is enough.
- User actions in Review are `Import` and `Cancel`.
- `Choose another file` is not a required action; cancel and reopen is sufficient.
- Initial/no selection imports to project root. Part selection imports under selected part. Drawable selection imports under drawable parent part.
- Import destination picker is not required in v0.
- Import Summary in Inspector is not required and should not be a dedicated post-import section.
- Import completion must render the imported tree structure in Workspace `Parts / Structure Tree`.
- Playwright E2E checks path completion and state reflection only; layout/visual quality is confirmed by the user/human.

Primary basis:

- [PSD Import Task Screen](../../design/screen-design/screens/psd-import-task.md)
- [Authoring Workspace Screen](../../design/screen-design/screens/authoring-workspace.md)
- [Playwright E2E Oracle](../../design/screen-design/e2e-oracle.md)
- [Screen Design Overview](../../design/screen-design/overview.md)
- [React Editor Foundation Oracle](../../design/screen-design/react-editor-foundation-oracle.md)
- [Editor Rebuild / Purge Policy](../../design/screen-design/editor-rebuild-purge-policy.md)
- [Toolbox Component](../../design/screen-design/components/toolbox.md)
- [Parts Tree Component](../../design/screen-design/components/parts-tree.md)
- `discussion/development_convention/source-file-organization-policy.md`
- `.github/skills/implementation-orchestration/SKILL.md`

## 3. UX Acceptance Criteria

Wave58 must satisfy this user-visible path:

```text
empty Authoring Workspace
  -> Import PSD
  -> PSD Import modal opens
  -> user selects a PSD fixture/file
  -> Import Review appears
  -> Review shows planned Parts structure
  -> Review shows PSD preview placeholder
  -> rows can show binary Issue badge with tooltip details
  -> user clicks Import
  -> modal closes
  -> Workspace Parts Tree shows the imported structure
  -> generated import root / part group is selected
  -> Inspector shows normal selected part/group information
```

The imported Workspace Parts Tree is a structural tree, not an image preview.

Required planned row kinds:

- `Part Container` for PSD group-derived part containers.
- `Drawable` for visible PSD leaf layer-derived drawables.
- `Hidden Drawable` for hidden PSD leaf layer-derived drawables.

Required non-goals:

- Real PSD image preview rendering.
- Photoshop compositing / pixel oracle.
- Canvas rendering of imported artwork.
- Layer-by-layer user approval, rename, or exclusion.
- Destination picker.
- Dedicated Import Summary section in Inspector.
- Warning count / issue category summary as normal UI.
- Raw diagnostics, evidence paths, operation IDs, generated refs, parser payloads in normal UI.
- Semantic recognition, auto-rigging, proposal generation, auto-fix, external transport, Cubism compatibility.

## 4. E2E Oracle Boundary

Wave58 may add Playwright E2E, but only under [Playwright E2E Oracle](../../design/screen-design/e2e-oracle.md).

E2E should verify:

- Authoring Workspace loads.
- Import PSD opens the modal.
- Fixture PSD selection reaches Import Review.
- Planned Parts structure is visible.
- Import closes the modal.
- Workspace Parts Tree shows imported structure.
- Generated import root / part group is selected.

E2E must not verify:

- Layout quality, pixel position, size, spacing, density, or visual polish.
- Screenshot/pixel regression.
- Canvas image correctness.
- Parser internal correctness.
- DTO full-field correctness.
- Tooltip full text.
- Raw diagnostics/evidence.
- CSS class or internal store shape.

E2E must not force user-unnecessary debug text into the product UI.

## 5. Domain Design

Wave58 intentionally uses fewer, larger domains.

| Batch | Domain | Parallelism | Dependency | Purpose |
|---|---|---|---|---|
| 1 | A. PSD Import E2E v0 implementation | One large implementation domain | Wave57 React Editor foundation + Wave58 UX basis | Implement the PSD Import vertical slice end to end |
| 2 | B. Final integration / clean review / map closeout | After A | A pass | Verify integration, update maps, record concise closeout |

Do not split Domain A into many micro-domains merely because it has several internal parts. One primary Gnome should own the vertical slice so parser boundary, review model, session state, commit integration, Parts Tree rendering, and E2E stay coherent.

Domain A may only split support work if a boundary is genuinely independent and the split reduces risk without creating coordination overhead. If split, each child must have disjoint write scope and a single owner remains accountable for the vertical slice.

## 6. Domain A: `wave58-psd-import-e2e-v0-implementation`

Purpose:

- Implement the PSD Import user path from file selection through Workspace Parts Tree reflection.

Required implementation areas:

1. PSD intake / parser boundary
   - Add PSD file input flow from `Import PSD`.
   - Read browser file bytes through an approved adapter boundary.
   - Keep parser raw objects and source bytes out of durable React state.
   - Repair or replace stale parser-boundary guard expectations.

2. Import planning / review model
   - Produce a UI review model from PSD / structural scaffold data.
   - Represent planned rows as `Part Container`, `Drawable`, and `Hidden Drawable`.
   - Determine destination from current selection.
   - Build row-level `hasIssue` and tooltip details from available issue/status data.

3. PSD Import modal UX
   - Use a large modal over Authoring Workspace.
   - Support file-not-selected, parsing, review, error, importing states as needed.
   - Show planned Parts structure as the primary content.
   - Show PSD preview placeholder as secondary content.
   - Provide only `Import` and `Cancel` as required actions.
   - Avoid verbose diagnostics in normal UI.

4. Editor session / selection / workspace state
   - Add React editor session/project state sufficient for this vertical slice.
   - Replace static Parts Tree rows with session-derived rows.
   - Replace static Inspector-only behavior where needed so selected imported part/group can be reflected.
   - Preserve source structure discipline from the React Editor Foundation Oracle.

5. Commit integration
   - Connect import to the existing operation/structural scaffold commit path where possible.
   - If a missing production plan-builder is the only blocker, implement the smallest project-local bridge needed for the agreed UX or escalate with concrete evidence.
   - Domain A does not pass with modal-only behavior. It must either commit and reflect imported structure in Workspace Parts Tree, or escalate as blocked.

6. Workspace Parts Tree rendering
   - After Import, close the modal.
   - Insert the import result under the resolved destination.
   - Render actual imported structure in `Parts / Structure Tree`.
   - Select generated import root / part group.
   - Inspector should show normal selected part/group information, not a dedicated Import Summary.

7. Playwright E2E
   - Add the minimal Playwright E2E path permitted by the oracle.
   - Keep suite small, ideally one happy path plus optional cancel path.
   - Do not add screenshot or visual regression assertions.
   - Use rights-clean fixture PSD. If no suitable fixture exists, escalate before inventing a questionable fixture.

Allowed write scope:

- `apps/editor/**`
- focused package files needed to expose existing PSD/operation APIs to the React editor
- parser boundary guard scripts if stale
- minimal focused tests / fixtures needed for this vertical slice
- `package.json`, `pnpm-lock.yaml`, workspace config if needed for Playwright or adapter dependencies
- `discussion/implementation/waves/wave58/**`
- `discussion/implementation/reviews/wave58/**`

Forbidden write scope:

- Recreating old GUI/e2e/testid/focused registry architecture wholesale.
- Reintroducing legacy debug/evidence-heavy normal panels.
- Broad refactors outside the PSD Import vertical slice.
- Canvas renderer implementation.
- Real PSD compositing preview.
- Visual regression tooling.
- Public/demo asset additions.
- Cubism / Live2D format compatibility work.

Dependency policy:

- Adding Playwright for explicit E2E is allowed by this plan if needed, but it must stay scoped to E2E path verification.
- Do not add visual regression tooling.
- Do not add large UI component frameworks.
- Escalate before adding a renderer/canvas engine, external transport, or broad data-fetching architecture.

Required verification:

- `pnpm --dir apps/editor typecheck`
- `pnpm --dir apps/editor build`
- root `pnpm run typecheck`
- root `pnpm run test:unit`
- root `pnpm run check`
- PSD parser smoke if still relevant / available: `pnpm run smoke:wave44:psd-parser`
- New explicit Playwright E2E command for the minimal PSD import path
- `git diff --check -- apps/editor package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.json scripts discussion`

Domain A review gates:

- Review-Sylph 1: UX / design / source-structure compliance.
  - Confirm the user path matches this plan and screen-design docs.
  - Confirm Import Review focuses on planned Editor Parts structure.
  - Confirm Workspace Parts Tree reflects imported structure after Import.
  - Confirm no dedicated Import Summary section is introduced.
  - Confirm normal UI is not polluted with diagnostics/evidence/test text.
  - Confirm source structure remains intentional and not flat.
- Review-Sylph 2: test adequacy / process hygiene.
  - Confirm required validation passed or blockers are concrete.
  - Confirm E2E follows the oracle and does not test visual layout/pixels.
  - Confirm parser/operation correctness remains in unit/headless coverage.
  - Confirm no old e2e/focused/testid registry architecture was restored wholesale.
  - Confirm no long-running dev server process is left alive.

## 7. Domain B: `wave58-final-integration-clean-review-map-closeout`

Purpose:

- Integrate Domain A reports and reviews.
- Update maps to mark Wave58 status.
- Record a concise closeout and clean integration review.

Allowed write scope:

- `discussion/design/screen-design/**` only for small map/status corrections.
- `discussion/implementation/_map.md`
- `discussion/implementation/orchestration/_map.md`
- `discussion/implementation/waves/wave58/**`
- `discussion/implementation/reviews/wave58/**`

Forbidden:

- Source implementation.
- Retrying Domain A implementation directly.
- Long narrative final report unless needed to record a blocker.

Required verification:

- Confirm Domain A report and both review lanes exist.
- Confirm required validation results are recorded.
- Confirm E2E oracle boundary is cited in review evidence.
- Confirm unresolved blockers, if any, are explicit and not hidden as pass.

## 8. Subagent / Orch-Sylph Execution Policy

Wave58 follows the implementation orchestration skill.

1. Undine launches Orch-Sylph per domain.
2. Orch-Sylph must not implement source itself.
3. Source implementation must be delegated to Gnome.
4. Review must be delegated to independent Review-Sylph.
5. Orch-Sylph must wait for delegated agents to reach final state.
6. Do not stop, cancel, close, or mark child agents failed merely because they are waiting or a wait call times out.
7. A wait timeout is polling timeout, not failure.
8. Subagents must not ask the user directly.
9. Undine must not inspect broad source/diff/test details directly.
10. Domain A must not be fragmented into micro-domains unless an Orch-Sylph records a concrete reason.

Each assignment must include:

```text
Orch-Sylph自身は実装担当ではない。source implementation は必ず別コンテキストの Gnome に委譲し、レビューは必ず別コンテキストの Review-Sylph に委譲すること。これを分離できない場合は実装せず escalate / blocked として報告すること。
```

## 9. Pass Criteria

Wave58 passes when:

- `Import PSD` opens a large PSD Import modal.
- PSD file selection reaches Import Review.
- Import Review shows planned Editor Parts structure.
- Planned rows distinguish `Part Container`, `Drawable`, and `Hidden Drawable`.
- Issue state is binary and shown as row-level badge + tooltip.
- PSD preview area exists as a placeholder.
- Review required actions are limited to `Import` and `Cancel`.
- Import commits or otherwise validly creates the agreed project structure.
- Modal closes after Import.
- Workspace `Parts / Structure Tree` renders the imported structure.
- Generated import root / part group is selected.
- Inspector shows normal selected part/group information, not a dedicated Import Summary.
- Minimal Playwright E2E validates the main path without visual/pixel assertions.
- Required validation commands pass or a concrete blocker is escalated.
- Domain A report/reviews and Domain B clean integration evidence are recorded.
