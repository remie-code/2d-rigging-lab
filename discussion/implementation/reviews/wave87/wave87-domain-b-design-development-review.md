# Wave87 Domain B Design / Development Compliance Review

## Verdict

escalate

Domain B is mostly compliant on routing, source organization, dependency containment, hidden Drawable handling, and Domain A API usage. The escalation is limited to the user-facing Apply mutation boundary: `Apply Atlas` commits package-changing atlas state through an editor-session hook that bypasses Operation Core. Under the accepted `operation-policy.md`, this cannot be accepted as a mere Domain B residual risk without an explicit exception or a scope decision to add an Operation Core operation.

## Scope Reviewed

- Wave87 Domain B: `wave87-texture-atlas-task-ui-routing-preview`
- Review lane: Design / Development Compliance Review
- Source/tests inspected directly:
  - `apps/editor/src/workspace/authoring-workspace.tsx`
  - `apps/editor/src/workspace/atlas/atlas-task-projection.ts`
  - `apps/editor/src/workspace/atlas/texture-atlas-task-screen.tsx`
  - `apps/editor/src/workspace/atlas/texture-atlas-task-screen.test.ts`
  - `apps/editor/src/features/editor-session/editor-session-context.tsx`
  - `apps/editor/src/features/editor-session/model/texture-atlas-session-command.ts`
  - Domain A APIs in `packages/authoring-core/src/texture-atlas-targets.ts`, `packages/authoring-core/src/texture-atlas-packing.ts`, and `packages/authoring-core/src/texture-atlas-mutations.ts`

## Basis Used

- `discussion/implementation/orchestration/wave87-plan.md`
- `discussion/design/screen-design/screens/texture-atlas-task.md`
- `discussion/implementation/waves/wave87/wave87-domain-a-atlas-core-schema-apply-mutation-report.md`
- `discussion/implementation/reviews/wave87/wave87-domain-a-design-development-review.md`
- `discussion/implementation/waves/wave87/wave87-domain-b-texture-atlas-task-ui-routing-preview-report.md`
- `discussion/development_convention/ux-backed-package-logic-authority.md`
- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/development_convention/dependency-policy.md`
- `discussion/development_convention/operation-policy.md`
- `discussion/development_convention/schema-and-id-conventions.md`

## Findings

| Severity | Finding | Evidence | Recommendation |
|---|---|---|---|
| blocking / escalation | User-facing `Apply Atlas` bypasses Operation Core. The screen calls `applyTextureAtlasPreview(projection.preview)` from the Apply button path, the provider records editor history directly, and the command helper clones the session then calls Domain A `applyTextureAtlasPreviewMutation()` directly. The accepted operation policy says all GUI package mutation must pass through Operation Core, every mutating workflow must produce operation result/diff/validation/log evidence, and direct GUI model package mutation outside Operation Core is forbidden. | UI Apply call: `apps/editor/src/workspace/atlas/texture-atlas-task-screen.tsx:68` and `apps/editor/src/workspace/atlas/texture-atlas-task-screen.tsx:74`; provider commit/history path: `apps/editor/src/features/editor-session/editor-session-context.tsx:790`, `apps/editor/src/features/editor-session/editor-session-context.tsx:812`, `apps/editor/src/features/editor-session/editor-session-context.tsx:817`; direct authoring-core mutation: `apps/editor/src/features/editor-session/model/texture-atlas-session-command.ts:23`, `apps/editor/src/features/editor-session/model/texture-atlas-session-command.ts:27`, `apps/editor/src/features/editor-session/model/texture-atlas-session-command.ts:28`; policy: `discussion/development_convention/operation-policy.md:87`, `discussion/development_convention/operation-policy.md:101`, `discussion/development_convention/operation-policy.md:350`, `discussion/development_convention/operation-policy.md:365`; no atlas operation type exists in `packages/operation-core/src/operation-type.ts:3`. Existing editor session commands show the intended Operation Core pattern at `apps/editor/src/features/editor-session/model/editor-session-commands.ts:527` and `apps/editor/src/features/editor-session/model/editor-session-commands.ts:537`. | Escalate to Orch-Sylph / Undine. Either add an approved Operation Core atlas apply operation and route the UI through it, or record an explicit Wave87 exception that accepts this direct authoring-core mutation path with known missing operation evidence. Without that decision, Domain B should not pass this lane. |

## Design / Development Compliance Evidence

### Source Organization

- New atlas UI files have focused responsibilities:
  - `atlas-task-projection.ts` owns UI projection, labels, preview state, and stale signature construction.
  - `texture-atlas-task-screen.tsx` owns the dedicated task screen rendering and UI event wiring.
  - `texture-atlas-task-screen.test.ts` owns focused task screen and projection tests.
  - `texture-atlas-session-command.ts` is narrowly scoped to committing a Domain A preview into editor-session state.
- No new `index.ts`, catch-all `types.ts`, `schemas.ts`, `utils.ts`, or `helpers.ts` file was added.
- Domain A's `packages/authoring-core/src/index.ts` remains a barrel export surface for atlas APIs at `packages/authoring-core/src/index.ts:45`.
- `editor-session-context.tsx` is already a large existing integration file. Domain B added a narrow context method/interface surface at `apps/editor/src/features/editor-session/editor-session-context.tsx:439`, implementation at `apps/editor/src/features/editor-session/editor-session-context.tsx:790`, and provider exposure at `apps/editor/src/features/editor-session/editor-session-context.tsx:1827`. This is acceptable for routing state through the existing provider, apart from the Operation Core escalation above.

### Dependency / Policy Containment

- No `package.json`, `apps/editor/package.json`, or `pnpm-lock.yaml` diff was present for Domain B.
- `node scripts/check-dependencies.mjs` passed.
- No new dependency, Cubism SDK/Core, proprietary parser, forbidden model format, binary asset, or compatibility claim was found in the reviewed Domain B files.
- A forbidden-term search only returned existing `Inspector` workspace references, not an Atlas UI placed inside Inspector.

### Scope Containment

- The existing workspace route now renders a dedicated Texture Atlas task when `activeEntry === "atlas"`: `apps/editor/src/workspace/authoring-workspace.tsx:38`, `apps/editor/src/workspace/authoring-workspace.tsx:48`, `apps/editor/src/workspace/authoring-workspace.tsx:49`.
- Parameter Bar is suppressed on the Atlas task, matching dedicated screen behavior: `apps/editor/src/workspace/authoring-workspace.tsx:91`.
- I found no Inspector Atlas UI, manual placement editor, workspace directory export, image export, ZIP/archive/File System Access API, camera controls, or unrelated Viewer/Dynamics/Mesh/Deformer feature work in the reviewed Domain B files.

### Domain A Source Of Truth

- UI projection imports and calls Domain A `selectTextureAtlasTargets()` and `createTextureAtlasPreview()`: `apps/editor/src/workspace/atlas/atlas-task-projection.ts:10`, `apps/editor/src/workspace/atlas/atlas-task-projection.ts:109`, `apps/editor/src/workspace/atlas/atlas-task-projection.ts:176`.
- Apply delegates to Domain A `applyTextureAtlasPreview()` in the narrow command helper: `apps/editor/src/features/editor-session/model/texture-atlas-session-command.ts:7`, `apps/editor/src/features/editor-session/model/texture-atlas-session-command.ts:28`.
- I found no UI-local atlas target selection or packing algorithm. UI code maps Domain A selections and placements into display rows/percent rectangles only: `apps/editor/src/workspace/atlas/atlas-task-projection.ts:150`, `apps/editor/src/workspace/atlas/atlas-task-projection.ts:159`, `apps/editor/src/workspace/atlas/atlas-task-projection.ts:332`.
- Domain A remains the selection oracle: bound drawables are included, unbound Drawable Pool drawables are excluded, and hidden status is metadata rather than an exclusion at `packages/authoring-core/src/texture-atlas-targets.ts:119`, `packages/authoring-core/src/texture-atlas-targets.ts:130`, `packages/authoring-core/src/texture-atlas-targets.ts:134`.

### Hidden Bound Drawable Handling

- The Atlas screen reads `editorHiddenPartIds` from the editor session: `apps/editor/src/workspace/atlas/texture-atlas-task-screen.tsx:35`, `apps/editor/src/workspace/atlas/texture-atlas-task-screen.tsx:37`.
- It passes editor hidden state into both projection and preview generation: `apps/editor/src/workspace/atlas/texture-atlas-task-screen.tsx:50`, `apps/editor/src/workspace/atlas/texture-atlas-task-screen.tsx:61`.
- The projection forwards that state to Domain A target selection/preview: `apps/editor/src/workspace/atlas/atlas-task-projection.ts:109`, `apps/editor/src/workspace/atlas/atlas-task-projection.ts:111`, `apps/editor/src/workspace/atlas/atlas-task-projection.ts:176`, `apps/editor/src/workspace/atlas/atlas-task-projection.ts:177`.
- Focused tests assert hidden bound drawables stay included and unbound pool drawables stay excluded: `apps/editor/src/workspace/atlas/texture-atlas-task-screen.test.ts:152`, `apps/editor/src/workspace/atlas/texture-atlas-task-screen.test.ts:160`, `apps/editor/src/workspace/atlas/texture-atlas-task-screen.test.ts:167`, `apps/editor/src/workspace/atlas/texture-atlas-task-screen.test.ts:172`.

### Stale Guard

- Projection computes a signature over authoring/package revisions, editor hidden part IDs, settings, included/excluded/warnings summaries, packable mesh UVs, texture sizes, and sampled texture bytes: `apps/editor/src/workspace/atlas/atlas-task-projection.ts:207`, `apps/editor/src/workspace/atlas/atlas-task-projection.ts:231`, `apps/editor/src/workspace/atlas/atlas-task-projection.ts:237`.
- A stale preview changes status, warning rows, and `canApply`: `apps/editor/src/workspace/atlas/atlas-task-projection.ts:120`, `apps/editor/src/workspace/atlas/atlas-task-projection.ts:123`, `apps/editor/src/workspace/atlas/atlas-task-projection.ts:127`, `apps/editor/src/workspace/atlas/atlas-task-projection.ts:140`.
- The Apply button is disabled from `projection.canApply`: `apps/editor/src/workspace/atlas/texture-atlas-task-screen.tsx:129`.
- The provider has an additional async race guard that rejects if the current editor session changed before the commit result is accepted: `apps/editor/src/features/editor-session/editor-session-context.tsx:802`.
- Tests cover stale settings and target input drift: `apps/editor/src/workspace/atlas/texture-atlas-task-screen.test.ts:181`, `apps/editor/src/workspace/atlas/texture-atlas-task-screen.test.ts:208`, `apps/editor/src/workspace/atlas/texture-atlas-task-screen.test.ts:224`.

### Test-Facing Hooks

- `data-testid` hooks are used for screen, counts, buttons, preview, and form controls, while product behavior remains normal button/select/checkbox UI: `apps/editor/src/workspace/atlas/texture-atlas-task-screen.tsx:94`, `apps/editor/src/workspace/atlas/texture-atlas-task-screen.tsx:121`, `apps/editor/src/workspace/atlas/texture-atlas-task-screen.tsx:128`, `apps/editor/src/workspace/atlas/texture-atlas-task-screen.tsx:187`, `apps/editor/src/workspace/atlas/texture-atlas-task-screen.tsx:294`, `apps/editor/src/workspace/atlas/texture-atlas-task-screen.tsx:314`.
- I found no test ID replacing product state or behavior.

## Verification Considered

Review-side checks run:

- `node scripts/check-source-organization.mjs`: passed.
- `node scripts/check-dependencies.mjs`: passed.
- `git diff --check -- <Domain B files>`: no whitespace errors; Git reported LF-to-CRLF working-copy warnings only.
- `rg` forbidden/scope search across Domain B files: no Cubism/proprietary format claims, workspace export, manual placement, archive, or File System Access implementation. `Inspector` hits were pre-existing workspace/session references.
- `rg` UI-local atlas algorithm search: production UI hits were Domain A calls, preview placement display, and stale-signature byte sampling. `rigControls` / `childDrawableIds` hits were in test fixture construction only.

I did not rerun Vitest or typecheck in this review lane. The Domain B report records escalated passes for the focused Atlas UI test, related workspace tests, `pnpm typecheck`, source organization, dependency guard, and `git diff --check`.

## Residual Risks / User-Decision Points

- Main decision: either implement/approve an Operation Core mutation path for `Apply Atlas`, or explicitly accept a Wave87 v0 exception for the direct authoring-core mutation hook. Without that decision this review remains `escalate`.
- DOM preview renders layout rectangles and labels, not generated atlas pixels. This is within Domain B v0 design scope, but final integration should still verify Canvas/Viewer behavior after Apply.
- The UI stale signature samples texture bytes for performance. Normal editor mutations should also change revision, and Domain A guards texture-id/UV drift, but an in-place byte mutation with unchanged revision and unchanged sampled bytes remains a residual edge case.
- `editor-session-context.tsx` is an existing large integration surface. Domain B's addition is narrow, but future Atlas workflow growth should move more behavior into focused model/command files rather than expanding the context body further.
