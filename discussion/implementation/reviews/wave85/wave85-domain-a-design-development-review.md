# Wave85 Domain A Design / Development Compliance Review

## Verdict

pass

## Scope reviewed

- Wave: Wave85 `validation-diagnostics-v0`
- Domain: `wave85-editor-local-diagnostics-projection`
- Lane: Design / Development Compliance Review
- Reviewed changed implementation source:
  - `apps/editor/src/features/editor-session/model/editor-diagnostics-state.ts`
  - `apps/editor/src/features/editor-session/model/editor-diagnostics-state.test.ts`
- Reviewed for source organization, dependency policy, operation policy, schema/ID convention, allowed/forbidden write scope, and design compliance.

Note: `git status --short -uall` also showed dirty planning/design discussion files outside this lane's source/test target. This review treats those as orchestration/design context, not Domain A authored source changes. Scoped status for `package.json`, `pnpm-lock.yaml`, `apps`, and `packages` showed only the two new model files.

## Basis documents used

- `discussion/implementation/orchestration/wave85-plan.md`
  - Diagnostics projection requirements and must-not scope: lines 234-262.
  - Domain A purpose, allowed scope, and forbidden scope: lines 381-410.
  - Wave-level forbidden scope: auto-fix, global mesh history, Viewer diagnostics, and new dependencies: lines 699-715.
- `discussion/design/screen-design/screens/diagnostics-evidence-view.md`
  - v0 is deterministic diagnostics, not score/quality judgement: lines 3-7.
  - Viewer exclusion and no auto-fix/AI repair: lines 21-25.
  - Read-only list and non-mutating jump action guidance: lines 283-286.
- `discussion/development_convention/source-file-organization-policy.md`
  - `index.ts` must remain barrel-only and god files are forbidden: lines 9, 35, 51-65, 69-72, 92-96.
  - Guard evidence requirement: line 123.
- `discussion/development_convention/dependency-policy.md`
  - Dependency guard and forbidden dependency scan: lines 43-50.
  - New dependency approval requirement: line 96.
  - Forbidden Cubism/proprietary dependencies and lockfile drift rules: lines 113, 333-346, 390-401.
- `discussion/development_convention/operation-policy.md`
  - Operation Core as mutation gateway: lines 79-87 and 350-365.
  - Machine-readable operation/target IDs contain no spaces: line 361.
- `discussion/development_convention/schema-and-id-conventions.md`
  - Machine-readable IDs contain no spaces: lines 123-151 and 502-504.
  - Diagnostic IDs use dot-separated lower camelCase segments: line 161.
  - Local duplicate external DTO/schema definitions are forbidden: lines 584-585.
- `discussion/implementation/waves/wave85/wave85-domain-a-editor-local-diagnostics-projection-report.md`
- Source and test files listed above, read directly with line numbers.

## Findings

| Severity | File/line refs | Issue | Recommendation |
|---|---|---|---|
| none | N/A | No design/development compliance findings found. The implementation stays inside an Editor-local read-only projection, uses stable machine-readable diagnostic codes, adds no dependencies, and does not introduce UI, Viewer, mesh algorithm, Dynamics schema, Product Preflight, auto-fix, or repair behavior. | Keep later UI/jump execution in Wave85 Domain B/C files. Do not add navigation execution, repair actions, or inline tool state to `editor-diagnostics-state.ts`. |

## Compliance checklist

- Source organization: pass.
  - New source is a named responsibility file, not `index.ts`, `types.ts`, `utils.ts`, or another catch-all.
  - `editor-diagnostics-state.ts` owns the Editor-local diagnostics projection and related item types (`apps/editor/src/features/editor-session/model/editor-diagnostics-state.ts:6-83`).
  - The focused test mirrors the same responsibility (`apps/editor/src/features/editor-session/model/editor-diagnostics-state.test.ts:53-230`).
  - `node scripts/check-source-organization.mjs` passed.
- Dependency policy: pass.
  - No package manifest or lockfile changes were present in scoped status.
  - Source imports only existing local/package types and helpers (`editor-diagnostics-state.ts:1-4`).
  - `node scripts/check-dependencies.mjs` passed.
- Operation policy: pass.
  - Projection computes arrays from `AuthoringSession` and returns a count; it does not call Operation Core, apply operations, or mutate package data (`editor-diagnostics-state.ts:66-83`).
  - Action hints are metadata-only structures (`editor-diagnostics-state.ts:26-41`, `123-132`, `180-188`, `240-248`, `354-359`, `411-416`, `446-449`).
  - Test coverage includes a no-mutation assertion for the mesh diagnostic path (`editor-diagnostics-state.test.ts:74-100`).
- Schema / ID convention: pass.
  - Diagnostic codes are dot-separated machine-readable strings with no spaces (`editor-diagnostics-state.ts:8-19`).
  - Diagnostic IDs use a stable `editorDiagnostics.<code>.<segments>` composition and sanitize non-safe characters (`editor-diagnostics-state.ts:684-687`).
  - The implementation defines internal editor projection types only; it does not duplicate an external DTO/schema boundary.
- Allowed / forbidden write scope: pass for reviewed source/test changes.
  - Changed source/test files are under `apps/editor/src/features/editor-session/model/**`.
  - No React UI, Viewer, mesh generation algorithm, Dynamics schema/payload, Product Preflight migration, auto-fix, or repair files were changed for Domain A source/test scope.
- Design compliance: pass.
  - Projection covers Editor-local deterministic diagnostics and warning count (`editor-diagnostics-state.ts:66-83`, `85-454`).
  - Mesh generation failure history is not added; Domain A only reports missing meshes from current session graph (`editor-diagnostics-state.ts:85-137`).
  - Dynamics output-keyform-missing uses the v0 session/keyformSet existence rule (`editor-diagnostics-state.ts:324-418`).
  - Action hints remain non-mutating metadata for later UI domains.

## Verification reviewed

- `pnpm.cmd exec vitest run apps/editor/src/features/editor-session/model/editor-diagnostics-state.test.ts`
  - Sandbox run failed with esbuild `spawn EPERM`.
  - Escalated rerun passed: 1 test file, 5 tests.
- `pnpm.cmd typecheck`: passed.
- `node scripts/check-source-organization.mjs`: passed.
- `node scripts/check-dependencies.mjs`: passed.
- `git diff --check -- apps/editor/src/features/editor-session/model/editor-diagnostics-state.ts apps/editor/src/features/editor-session/model/editor-diagnostics-state.test.ts`: passed.
- `git status --short -uall -- package.json pnpm-lock.yaml apps packages`: only the two new Domain A model files were reported.

## Residual risks / user-decision points

- No user decision is required for Domain A pass.
- `editor-diagnostics-state.ts` is already a medium-large projection file. It is cohesive for Domain A, but future domains should split UI grouping, jump execution, inline Mesh Tool state, and tree warning adaptation into their own responsibility files instead of growing this model projection into a catch-all.
- This lane did not review Domain B/C obligations such as rendering the Validate screen, app/toolbox badge, executable jump actions, tree warning icons, Mesh Tool inline failure details, or Viewer negative UI coverage.
