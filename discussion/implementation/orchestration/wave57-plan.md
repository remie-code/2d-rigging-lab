# Wave 57 Plan: React Editor Foundation / Workspace Placeholder v0

> React + Vite + Tailwind + Radixを採用し、`apps/editor` を再削除・再作成して、起動直後のAuthoring Workspace placeholderを構築する計画。

## 1. 状態

- Status: Planned
- Target wave: Wave57
- Wave name: `react-editor-foundation-workspace-placeholder-v0`
- Primary objective: 破棄されたWave56のvanilla TypeScript scaffoldを削除し、合意済みReact Editor Foundation Oracleに従って `apps/editor` をReactベースで再構築する。初期UXは、起動直後に見えるAuthoring Workspace placeholderとし、機能本体は実装しない。

## 2. Planning Gate Result

Planning Gate result before this plan: `Discuss first` -> `Plan directly`.

Accepted user decisions:

- Wave56は破棄する。
- Wave56 Domain B/Cで完了したheadless baseline / package分離だけは後続事実として引き継ぐ。
- 現在の `apps/editor` は再度まるごと削除する。
- `apps/editor` はReact stackで新規作成する。
- 技術スタックは [React Editor Foundation Oracle](../../design/screen-design/react-editor-foundation-oracle.md) の通り確定する。
- `src/` 直下や `components/` 配下に大量のファイルをフラットに並べることは禁止する。
- validationは肥大化させない。dev server / browser e2e / visual regressionはWave57では原則行わない。

Primary basis:

- [React Editor Foundation Oracle](../../design/screen-design/react-editor-foundation-oracle.md)
- [Editor Rebuild / Purge Policy](../../design/screen-design/editor-rebuild-purge-policy.md)
- [Screen Design Scope and Principles](../../design/screen-design/scope-and-principles.md)
- [Screen Design Overview](../../design/screen-design/overview.md)
- [Authoring Workspace Screen](../../design/screen-design/screens/authoring-workspace.md)
- [Toolbox Component](../../design/screen-design/components/toolbox.md)
- [Codex-Friendly Automation Policy](../../design/codex-friendly-automation-policy.md)
- `discussion/development_convention/source-file-organization-policy.md`
- `.github/skills/implementation-orchestration/SKILL.md`

## 3. Wave56 Handling

Wave56 is abandoned as an implementation wave.

Carry forward:

- Headless baseline / package separation completed by Wave56 Domain B/C.

Do not carry forward:

- Wave56 vanilla TypeScript `apps/editor` scaffold.
- Wave56 Domain D/E source direction.
- Wave56 plan as the active implementation basis.

Wave57 Domain A must delete current `apps/editor` before creating the React app.

## 4. Adopted Stack

Wave57 must introduce only the agreed initial dependencies:

- `react`
- `react-dom`
- `@vitejs/plugin-react`
- `tailwindcss`
- `@tailwindcss/vite`
- `lucide-react`
- `@radix-ui/react-dialog`
- `@radix-ui/react-tooltip`
- `@radix-ui/react-tabs`
- `@radix-ui/react-popover`
- `react-resizable-panels`
- `zustand`
- `clsx`

Do not add:

- `shadcn/ui`
- MUI / Mantine
- PixiJS
- browser e2e frameworks
- visual regression tooling
- additional state/form/data libraries

## 5. Initial Source Structure

Wave57 must create `apps/editor/src/` with intentional directories.

Required top-level structure:

```text
src/
  app/
  workspace/
  features/
  components/
  ui/
  state/
  styles/
  lib/
```

Rules:

- `src/` must not become a flat file pile.
- `components/` must not become a flat dumping ground.
- If a directory starts accumulating unrelated files, split it immediately by purpose.
- `index.ts` files, if used, must stay barrel-only.

## 6. Initial UX Target

The first screen must be an Authoring Workspace placeholder.

Required visible regions:

- App Bar
- Toolbox
- Parts / Structure Tree
- Canvas / Preview
- Inspector
- Parameter Bar
- Task / View entry points

Required behavior:

- Render immediately on app launch.
- Communicate where future functions will live.
- Keep all feature bodies as placeholders.
- Use restrained, work-focused visual design.
- Avoid landing-page or marketing composition.

Forbidden visible content:

- `Task Summary`
- raw refs
- operation IDs
- diagnostic IDs
- evidence paths
- command payloads
- visible test ids
- old panel names as UI content
- Codex/debug/evidence-heavy normal panels
- claims of semantic recognition, proposal generation, auto-rigging, or auto-fix

## 7. Validation Scope

Required final validation:

- `pnpm run typecheck`
- `pnpm run test:unit`
- `pnpm run check`
- `pnpm --filter @private-2d-rigging-lab/editor typecheck`
- `pnpm --filter @private-2d-rigging-lab/editor build`
- `git diff --check -- apps/editor package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.json discussion`

Optional, only if implemented without long-running server:

- component/static test verifying major workspace regions exist.

Forbidden / non-required in Wave57:

- dev server verification
- browser e2e
- screenshot validation
- visual regression
- long-running process validation

If an agent starts a dev server during this wave, it must be treated as a process hygiene issue unless explicitly authorized by Undine after a new user discussion.

## 8. Dependency / Parallel Design

Wave57 is intentionally compact and should not over-parallelize. This wave does not have a dedicated final-report domain.

| Batch | Domain | Parallelism | Dependency | Purpose |
|---|---|---|---|---|
| 1 | A. React stack app reset | Solo first | Oracle + Wave56 B/C baseline | Delete current `apps/editor`, add dependencies, create React/Vite/Tailwind scaffold |
| 2 | B. Workspace placeholder composition | Solo after A | A | Build Authoring Workspace placeholder with proper source structure |
| 3 | C. Validation / source-structure review | Solo after B | B | Run minimal validation and check structure/forbidden content |
| 4 | D. Map closeout / final clean review | Solo after C | C | Update only required maps, add short closeout, and produce final clean review |

Do not split out a final report phase. The closeout should be short and should live in Domain D's report/map updates.

## 9. Domain Assignments

### A. `wave57-react-stack-app-reset`

Purpose:

- Delete current `apps/editor` entirely.
- Add agreed React stack dependencies.
- Recreate fresh `apps/editor` React + Vite + Tailwind app scaffold.
- Preserve Wave56 B/C headless baseline.

Allowed write scope:

- `apps/editor/**`
- `package.json`
- `pnpm-lock.yaml`
- `pnpm-workspace.yaml` if needed
- root/package TypeScript or Vite config only if needed
- `discussion/implementation/waves/wave57/**`
- `discussion/implementation/reviews/wave57/**`

Forbidden:

- old `apps/editor` source reuse
- old e2e/testid/focused registry recreation
- feature implementation beyond scaffold
- adding dependencies outside the agreed stack

Required verification:

- install/update lockfile as needed
- `pnpm --filter @private-2d-rigging-lab/editor typecheck`
- `pnpm --filter @private-2d-rigging-lab/editor build`
- `pnpm run typecheck`
- `pnpm run check`

### B. `wave57-workspace-placeholder-composition`

Purpose:

- Build the Authoring Workspace placeholder using React components and the required source structure.

Allowed write scope:

- `apps/editor/**`
- focused component/static tests if added
- `discussion/implementation/waves/wave57/**`
- `discussion/implementation/reviews/wave57/**`

Forbidden:

- domain feature implementation
- old visible strings or debug/evidence surfaces
- flat `src/` / flat `components/` growth
- dev server/browser e2e validation

Required verification:

- `pnpm --filter @private-2d-rigging-lab/editor typecheck`
- `pnpm --filter @private-2d-rigging-lab/editor build`
- forbidden string/source scan over `apps/editor/src/**`

### C. `wave57-validation-source-structure-review`

Purpose:

- Run minimal final validation and source-structure checks.

Allowed write scope:

- narrow non-e2e validation scripts if needed
- `discussion/implementation/waves/wave57/**`
- `discussion/implementation/reviews/wave57/**`

Required verification:

- required validation from section 7
- no `apps/editor/e2e/**`
- no old e2e/focused/testid standard path
- source structure matches oracle
- no forbidden visible/content strings

### D. `wave57-map-closeout-final-clean-review`

Purpose:

- Update only the required maps to reflect Wave56 abandoned / Wave57 active.
- Register React Editor Foundation Oracle as accepted basis.
- Record a short closeout: completed scope, validation passed, dependencies added, explicit non-goals, and next discussion point.
- Produce final clean Review-Sylph review for the wave.

Allowed write scope:

- `discussion/design/screen-design/**`
- `discussion/implementation/_map.md`
- `discussion/implementation/orchestration/_map.md`
- `discussion/implementation/waves/wave57/**`
- `discussion/implementation/reviews/wave57/**`

Forbidden:

- source implementation
- unsupported capability claims
- restoring Wave56 as active plan
- broad capability/backlog rewrite unless C found a blocking map inconsistency
- long final-report style narrative

## 10. Subagent / Orch-Sylph Execution Policy

Wave57 uses the same orchestration contract as prior implementation waves.

1. Undine launches one Orch-Sylph per domain.
2. Orch-Sylph must not implement source itself.
3. Source implementation must be delegated to Gnome.
4. Review must be delegated to independent Review-Sylph.
5. Orch-Sylph must wait for delegated agents to reach final state.
6. Do not stop, cancel, close, or mark child agents failed merely because they are waiting or a wait call times out.
7. A wait timeout is polling timeout, not failure.
8. Subagents must not ask the user directly.
9. Undine must not inspect broad source/diff/test details directly.
10. Wave57 final reporting is intentionally lightweight. Do not create a separate final-report domain or long final report unless the plan is explicitly replaced.

Each assignment must include:

```text
Orch-Sylph自身は実装担当ではない。source implementation は必ず別コンテキストの Gnome に委譲し、レビューは必ず別コンテキストの Review-Sylph に委譲すること。これを分離できない場合は実装せず escalate / blocked として報告すること。
```

## 11. Pass Criteria

Wave57 passes when:

- Current `apps/editor` is deleted and recreated as a React + Vite + Tailwind app.
- Agreed dependencies are installed and no extra UI stack is added.
- `apps/editor/src/` uses the oracle source structure.
- Authoring Workspace placeholder renders as the startup screen.
- Required regions exist: App Bar, Toolbox, Parts / Structure Tree, Canvas / Preview, Inspector, Parameter Bar, Task / View entry points.
- No forbidden old/debug/evidence/Codex-heavy content is introduced.
- Standard headless baseline remains intact.
- Required validation commands pass.
- No dev server/browser e2e/visual regression validation is introduced.
- Domain A-C reports/reviews, Domain D closeout, and final clean review are recorded.
