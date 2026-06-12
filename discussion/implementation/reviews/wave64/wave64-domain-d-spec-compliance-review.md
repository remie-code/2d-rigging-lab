# Wave64 Domain D Spec Compliance Review

## Verdict

pass

Domain D now satisfies the Wave64 Parameter Manager v0 spec. The initial blocking finding is resolved: Manager usage/delete safety includes `dynamicsGroups` driver source refs and output target refs, so a dynamics-only Custom parameter is no longer projected as unused or safe to delete.

This review treats Wave64 plan section 12 as the v0 scoping authority where it narrows broader draft screen-spec items. Broader draft items not included in the Wave64 v0 acceptance are classified explicitly below rather than treated as silent future scope.

## Scope Reviewed

Basis inspected directly:

- `discussion/implementation/orchestration/wave64-plan.md`
- `discussion/implementation/waves/wave64/wave64-domain-a-parameter-keyform-package-operation-foundation-report.md`
- `discussion/design/screen-design/screens/parameter-manager.md`
- `discussion/design/screen-design/components/parameter-keyform.md`
- `discussion/design/parameter-preset-ecosystem.md`
- `discussion/design/screen-design/screens/authoring-workspace.md`

Domain D artifacts/source/tests inspected directly:

- `discussion/implementation/waves/wave64/wave64-domain-d-parameter-manager-v0-report.md`
- `apps/editor/src/features/editor-session/model/parameter-manager-projection.ts`
- `apps/editor/src/features/editor-session/model/parameter-manager-projection.test.ts`
- `apps/editor/src/features/editor-session/model/parameter-definition-commands.ts`
- `apps/editor/src/features/editor-session/model/parameter-definition-commands.test.ts`
- `apps/editor/src/workspace/parameter-manager/parameter-manager-screen.tsx`
- `apps/editor/src/workspace/parameter-manager/parameter-manager-screen.test.ts`
- `apps/editor/src/workspace/authoring-workspace.tsx`
- `apps/editor/src/features/editor-session/editor-session-context.tsx`

Additional contract evidence inspected:

- `packages/authoring-core/src/parameter-mutations.ts`
- `packages/operation-core/src/operations/parameter-definition.ts`
- `apps/editor/src/workspace/panels/parameter-bar.tsx`
- `apps/editor/src/workspace/workspace-data.ts`
- `packages/validator-core/src/validators/dynamics-semantic.ts`

## Requirement Classification

| Basis requirement | Classification | Evidence / note |
|---|---:|---|
| Independent Spec Compliance artifact classifies basis requirements | implemented | This file is the required review artifact. |
| Manager is a dedicated parameter definition/usage screen, not current-value/keyform authoring | implemented | Manager edits definitions/usage/active selection; keyform/current-value UI remains in Parameter Bar/Inspector scope. `parameter-manager-screen.tsx:124`, `parameter-keyform.md` basis. |
| Route/screen reachable from existing Parameters entry | implemented | Workspace renders Manager for `activeEntry === "parameters"` at `authoring-workspace.tsx:30-38`; entry exists at `workspace-data.ts:44`. |
| Route reachable from Parameter Bar Manage | implemented | `parameter-bar.tsx:92-97` calls `openParameterManager`; provider sets `activeEntry` to `parameters` at `editor-session-context.tsx:462-463`. |
| Close returns to Authoring Workspace | implemented | Close calls `setActiveEntry("import")` without opening PSD modal at `parameter-manager-screen.tsx:139-141`; workspace body returns because only `parameters` shows Manager. |
| Header has `+ Custom` and Close | implemented | Header/action buttons at `parameter-manager-screen.tsx:124-145`. |
| No `+ From Preset` flow | implemented | Source/test search found no Manager `From Preset`; route test asserts absence at `parameter-manager-screen.test.ts:59`. |
| Group label filters All / Face / Eyes / Mouth / Brow/Cheek / Body / Secondary / Custom | implemented | Filter constants at `parameter-manager-projection.ts:12-24`; rendered at `parameter-manager-screen.tsx:151`. |
| Search filter | implemented | Search input at `parameter-manager-screen.tsx:166-180`; projection filters by display name/id/kind/group/role at `parameter-manager-projection.ts:169-182`. |
| Draft-only warnings filter toggle | deferred by plan | `parameter-manager.md` includes an only-warnings toggle, but Wave64 Domain D acceptance only requires group and search filtering. |
| No left Group tree | implemented | Manager uses top filter row; no tree UI in target screen. |
| Table columns Name / Kind / Range / Used; no Role column | implemented | Exact column constant at `parameter-manager-projection.ts:26`; rendered at `parameter-manager-screen.tsx:316`; table test covers no Role column. |
| Draft Warning column/badge | deferred by plan | Wave64 plan explicitly narrows primary columns to Name / Kind / Range / Used and forbids Role column. Warning summary is in Check Strip. |
| Preset parameters visible from initial state | implemented | Projection uses `listInitializedParameters(session.graph)` at `parameter-manager-projection.ts:74`; empty-project test covers `param_face_angle_x` at `parameter-manager-projection.test.ts:13`. |
| Preset Details show locked role / stable id / group / range / sign convention summary | implemented | Preset details rows at `parameter-manager-screen.tsx:539-553`. |
| Preset locked and delete unavailable | implemented | Preset path renders catalog-locked delete text at `parameter-manager-screen.tsx:527-531`; Domain A delete rejects presets. |
| Unused Preset is not warning | implemented | Unused warning is custom-only at `parameter-manager-projection.ts:284-290`; empty-project test expects no checks. |
| Custom parameter has no role | implemented | Custom details show disabled `Role` value `none` at `parameter-manager-screen.tsx:590-593`; create/read projection omits preset role for custom rows. |
| Custom create flow | implemented | Create form submit path at `parameter-manager-screen.tsx:101-117`, parse payload at `parameter-manager-screen.tsx:775-810`, command wrapper at `parameter-definition-commands.ts:21-29`; command test covers creation. |
| Custom edit display name/min/default/max/UI step according to Domain A support | implemented | Edit form at `parameter-manager-screen.tsx:573-630`; update command wrapper at `parameter-definition-commands.ts:31-39`; command test covers update. |
| Custom stable id refactor according to Domain A support | implemented | Disabled with explicit reason because Domain A v0 does not support ref migration: `parameter-manager-screen.tsx:580-588`, `parameter-manager-screen.tsx:633-639`. |
| Custom type mutation according to Domain A support | implemented | Disabled with explicit reason because Domain A v0 supports scalar only: `parameter-manager-screen.tsx:585-588`. |
| Custom delete only when Domain A safe operation supports it; otherwise disabled with clear reason | implemented | Delete enabled only for custom rows with `usageCount === 0` at `parameter-manager-screen.tsx:416`; usage now includes keyform and dynamics refs at `parameter-manager-projection.ts:208-238`; disabled/available reason mentions keyforms and dynamics at `parameter-manager-screen.tsx:515-525`. |
| Usage summary + View Usage details | implemented | `usageSummary` is derived from all indexed usage at `parameter-manager-projection.ts:154`; View Usage renders details at `parameter-manager-screen.tsx:487-502` and `parameter-manager-screen.tsx:643-659`. |
| Usage details are human-readable, not raw payload/evidence | implemented | Keyform labels are formatted in `createKeyformUsageItem`; dynamics labels are `Dynamics: <group>`, driver/output labels at `parameter-manager-projection.ts:223-238`. |
| Dynamics driver/output refs participate in usage/delete safety | implemented | Manager adds driver `sourceParameterId` and output `targetParameterId` usage at `parameter-manager-projection.ts:223-238`; Domain A delete reference universe includes the same dynamics refs at `parameter-mutations.ts:160-184`. |
| Dynamics-only Custom parameter is not unused and delete is disabled | implemented | Projection regression at `parameter-manager-projection.test.ts:100-190`; UI regression at `parameter-manager-screen.test.ts:62-129`. |
| Check Strip summary for warnings/errors | implemented | Duplicate stored ids, invalid/default range, missing keyform parameter refs, out-of-range keyforms, and unused custom checks are created at `parameter-manager-projection.ts:254-370`; strip renders summary at `parameter-manager-screen.tsx:661-692`. |
| Full validator/evidence/raw payload surface | explicit non-goal | Wave64 plan forbids full usage/evidence/raw payload surface; Manager Check Strip is a summary, not Product Preflight or Diagnostics/Evidence View. |
| Dynamics semantic validator parity in Manager Check Strip | deferred by plan | Existing validator has missing dynamics driver/output checks (`dynamics-semantic.ts:407`, `dynamics-semantic.ts:482`), but Domain D v0 only required Manager warning/error summary and delete/usage safety, not full dynamics validator mirroring. Keep as integration risk below. |
| Set Active from Manager and Parameter Bar reflection/handoff | implemented | Manager calls `setActiveParameterId` at `parameter-manager-screen.tsx:280`; provider projection uses active id at `editor-session-context.tsx:246-248`; tests cover projection sharing at `parameter-manager-projection.test.ts:199-209` and `parameter-manager-screen.test.ts:132-154`. |
| Parameter Bar remains active-parameter/current-value home | implemented | Parameter Bar stays mounted in workspace at `authoring-workspace.tsx:73`; Manager does not add current-value sliders/keyform actions. |
| Parameter Control Palette, all-parameter runtime controls | deferred by plan | Component spec describes broader future UI; not in Wave64 Domain D acceptance. |
| Keyform add/update/delete loop, Inspector lock state, runtime/canvas evaluation | not relevant | Domain B scope except for thin active-parameter/navigation contract. |
| Mesh V3 envelope sidecar | not relevant | Domain C scope. |
| Camera Capture Facade, external runtime API, export facade, LLM provider integration | explicit non-goal | Forbidden/out-of-scope in Wave64 plan. |
| Preset role schema redesign | explicit non-goal | Forbidden in Domain D. |
| Custom role assignment UI | explicit non-goal | Forbidden in Domain D and disabled in UI. |
| Physics/dynamics expansion | explicit non-goal | Wave64 out-of-scope; D only consumes existing dynamics refs for usage/delete safety. |

No requirement remains `unclear`.

## Fix-Loop Finding Resolution

Initial blocking finding:

- Manager usage/delete safety looked only at `keyformSets`; Domain A delete also refuses dynamics driver/output refs. A dynamics-only Custom parameter could be shown as unused and deletable.

Resolution evidence:

- Manager usage index includes `session.graph.dynamicsGroups` drivers and outputs: `parameter-manager-projection.ts:223-238`.
- Domain A delete safety includes matching dynamics refs: `parameter-mutations.ts:160-184`.
- Delete is disabled whenever indexed usage exists and the user-facing reason now names keyforms or dynamics: `parameter-manager-screen.tsx:416`, `parameter-manager-screen.tsx:515-525`.
- Projection regression covers dynamics-only driver/output refs, usage details, and absence of `unusedCustom`: `parameter-manager-projection.test.ts:100-190`.
- UI regression renders a dynamics-only custom parameter Details panel with Delete disabled and human-readable dynamics usage: `parameter-manager-screen.test.ts:62-129`.
- Command regression confirms Domain A/operation delete rejection for dynamics-referenced custom parameters: `parameter-definition-commands.test.ts:96-152`.

Finding status: resolved.

## Blocking Findings

None.

## Non-Blocking Risks

- Manager Check Strip is a v0 local summary, not a full validator mirror. Existing dynamics semantic validator checks for missing dynamics driver/output parameters are not projected into the Manager strip; final integration should decide whether Product Preflight alone is the correct home or whether Manager should add a lightweight summary later.
- Browser visual verification was not reproduced in this review. The Domain D report records that the in-app Browser runtime exposed no available browser targets; this lane relied on source inspection, server-rendered component tests, focused model tests, and typecheck.
- `apps/editor/src/features/editor-session/editor-session-context.tsx` and other editor files include concurrent Domain B active-parameter/keyform work. This review passes only the D-owned Manager/navigation/parameter-definition/shared active parameter contract and does not certify the full Domain B editing loop.

## Verification

Reviewer-run commands:

```text
pnpm.cmd exec vitest run apps/editor/src/features/editor-session/model/parameter-manager-projection.test.ts apps/editor/src/features/editor-session/model/parameter-definition-commands.test.ts apps/editor/src/workspace/parameter-manager/parameter-manager-screen.test.ts
```

Result: initial sandbox run failed with Vite/esbuild `spawn EPERM`; rerun with approved escalation passed: 3 test files, 14 tests.

```text
pnpm.cmd typecheck
```

Result: pass.

```text
git diff --check -- apps/editor/src/features/editor-session/model/parameter-manager-projection.ts apps/editor/src/features/editor-session/model/parameter-manager-projection.test.ts apps/editor/src/features/editor-session/model/parameter-definition-commands.ts apps/editor/src/features/editor-session/model/parameter-definition-commands.test.ts apps/editor/src/workspace/parameter-manager/parameter-manager-screen.tsx apps/editor/src/workspace/parameter-manager/parameter-manager-screen.test.ts apps/editor/src/workspace/authoring-workspace.tsx apps/editor/src/features/editor-session/editor-session-context.tsx discussion/implementation/waves/wave64/wave64-domain-d-parameter-manager-v0-report.md
```

Result: pass; Git emitted LF-to-CRLF warnings for tracked editor files only.

```text
node scripts/check-source-organization.mjs
```

Result: pass.

```text
node scripts/check-dependencies.mjs
```

Result: pass.

Additional evidence inspected:

- `git status --short -uall` for target files and concurrent editor changes.
- `Select-String` line probes for Manager route, table columns, dynamics usage, delete gating, provider active parameter contract, and Domain A delete refs.
