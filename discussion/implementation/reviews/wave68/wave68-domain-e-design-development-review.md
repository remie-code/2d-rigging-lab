# Wave68 Domain E Design / Development Compliance Re-Review

## Verdict

`pass`

Fix Loop 1 resolves the prior blocking finding. Preview fallback / quality provenance now flows from Mesh Tool draft state through the Editor command wrapper into the `generateMesh` operation payload, then into Operation Core provenance output. I found no new architecture, module-boundary, source-organization, operation-boundary, UI-isolation, or forbidden-scope regressions introduced by the vertical fix.

## Scope Reviewed

Initial Domain E surface:

- `apps/editor/src/workspace/panels/mesh-tool-inspector.tsx`
- `apps/editor/src/features/editor-session/model/mesh-tool-state.ts`
- `apps/editor/src/features/editor-session/model/mesh-tool-state.test.ts`
- `apps/editor/src/features/editor-session/editor-session-context.tsx`
- `apps/editor/src/features/editor-session/model/editor-session-commands.test.ts`
- `apps/editor/e2e/psd-import.e2e.spec.ts`

Fix Loop 1 vertical change surface:

- `apps/editor/src/features/editor-session/editor-session-context.tsx`
- `apps/editor/src/features/editor-session/model/editor-session-commands.ts`
- `apps/editor/src/features/editor-session/model/editor-session-commands.test.ts`
- `packages/operation-core/src/payloads/model-edit.ts`
- `packages/operation-core/src/operations/generate-mesh.ts`
- `packages/operation-core/src/operations/generate-mesh.test.ts`

Policies / basis rechecked where relevant:

- `discussion/implementation/orchestration/wave68-plan.md`
- `discussion/design/screen-design/components/mesh-tool.md`
- `discussion/design/mesh-generation/auto-outline-v6-alpha-constrained-delaunay.md`
- `discussion/design/mesh-generation/auto-outline-v6b-constrainautor.md`
- `discussion/design/mesh-generation/auto-outline-v6c-poly2tri.md`
- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/development_convention/operation-policy.md`
- `discussion/development_convention/schema-and-id-conventions.md`
- `discussion/development_convention/ux-backed-package-logic-authority.md`

## Delta Findings

### Resolved: Applied preview provenance drops fallback / quality metadata

Previous severity: `needs_changes`

Status: `resolved`

Evidence:

- Mesh Tool Apply now passes a `previewProvenance` object with `source`, `fallbackReason`, `fallbackSteps`, and `qualityMetrics` to `commitGenerateMesh` at `apps/editor/src/features/editor-session/editor-session-context.tsx:698` through `:709`.
- The Editor command wrapper now accepts and forwards `previewProvenance` through the Operation Core request payload at `apps/editor/src/features/editor-session/model/editor-session-commands.ts:274` through `:290`.
- `GenerateMeshPayloadSchema` now validates `previewProvenance` shape and rejects provenance without `previewMesh` at `packages/operation-core/src/payloads/model-edit.ts:255` through `:274`.
- The schema now validates v6 shared metrics and v6B/v6C diagnostic shapes at `packages/operation-core/src/payloads/model-edit.ts:176` through `:232`.
- Operation Core now reads preview provenance in the preview-commit branch at `packages/operation-core/src/operations/generate-mesh.ts:105` through `:114`, passes it into provenance creation at `:147` through `:157`, records `previewMeshSource` at `:326` through `:329`, and records v6 output/fallback/diagnostic metrics at `:487` through `:563`.
- Tests now cover committed preview provenance for backend output and fallback output, including `previewMeshSource` and `meshQuality:v6Output`, in `apps/editor/src/features/editor-session/model/editor-session-commands.test.ts:686` through `:737` and `packages/operation-core/src/operations/generate-mesh.test.ts:638` through `:729`.

Result:

- Applied v6 previews can now preserve `meshSource:previewMesh` while also preserving the original preview source, fallback steps/reason, and v6 output classification.
- The committed provenance can distinguish successful backend output from fallback output after Apply.

### New Blocking Findings

None.

## Compliance Notes

- Operation boundary remains intact. The UI calls `commitGenerateMesh`; the command wrapper builds an Operation Core request, and the actual mesh replacement remains inside `generateMeshOperationHandler` / `replaceDrawableMesh`.
- No direct graph mutation was added to the Mesh Tool Apply path. The graph reads in editor command code are precondition/projection style; mutation still routes through Operation Core.
- Backend selector isolation remains intact. The product-facing preset controls are still separate from the temporary experimental backend selector.
- Default behavior remains v2.6 unless a backend option is explicitly selected. The Fix Loop did not change the default selector behavior.
- Type/import boundaries remain package-public. The reviewed files import from `@private-2d-rigging-lab/authoring-core`, not backend implementation subpaths.
- The vertical payload/schema fix is appropriately located in `packages/operation-core/src/payloads/model-edit.ts` and `packages/operation-core/src/operations/generate-mesh.ts`, which already own the `generateMesh` payload and operation behavior.
- No WebGL/rendering feature work, semantic backend auto-selection, package manifest edit, lockfile edit, generated dependency registry edit, or backend algorithm implementation was introduced by Fix Loop 1.
- Source organization remained acceptable: `node scripts/check-source-organization.mjs` passed in this re-review.

## Dirty Worktree Classification

Domain E / Fix Loop 1 in-scope:

- `apps/editor/src/workspace/panels/mesh-tool-inspector.tsx`
- `apps/editor/src/features/editor-session/model/mesh-tool-state.ts`
- `apps/editor/src/features/editor-session/model/mesh-tool-state.test.ts`
- `apps/editor/src/features/editor-session/editor-session-context.tsx`
- `apps/editor/src/features/editor-session/model/editor-session-commands.ts`
- `apps/editor/src/features/editor-session/model/editor-session-commands.test.ts`
- `apps/editor/e2e/psd-import.e2e.spec.ts`
- `packages/operation-core/src/payloads/model-edit.ts`
- `packages/operation-core/src/operations/generate-mesh.ts`
- `packages/operation-core/src/operations/generate-mesh.test.ts`

Pre-existing / unrelated editor dirty files, not attributed to Domain E:

- `apps/editor/src/workspace/canvas/canvas-render-scene-adapter.ts`
- `apps/editor/src/workspace/canvas/canvas-render-scene-adapter.test.ts`
- `apps/editor/src/workspace/canvas/canvas-renderer.test.ts`

Wave68 other-domain or shared-contract dirty files, not attributed to Domain E in this review:

- `packages/authoring-core/**`
- `packages/authoring-core/package.json`
- `pnpm-lock.yaml`
- `generated/dependencies/dependency-registry.json`
- `discussion/design/mesh-generation/**`
- `discussion/implementation/orchestration/**`
- `discussion/implementation/waves/wave68/**`

This review artifact:

- `discussion/implementation/reviews/wave68/wave68-domain-e-design-development-review.md`

## Verification Considered / Performed

Performed in this re-review:

- Source and diff inspection for all Fix Loop 1 files.
- Operation boundary inspection from Mesh Tool Apply through `commitGenerateMesh` and Operation Core.
- Payload/schema inspection for `previewProvenance` and v6B/v6C diagnostic shape validation.
- Public import boundary scan for reviewed files.
- Forbidden-scope keyword scan for semantic auto-selection and rendering/WebGL work in Fix Loop 1 files.
- `node scripts/check-source-organization.mjs` -> passed.
- Scoped `git diff --check` for Fix Loop 1 files -> exit 0; CRLF replacement warnings only.

Considered from parent verification:

- Focused Vitest Domain E/fix set passed after sandbox rerun: 3 files / 43 tests.
- `pnpm.cmd typecheck` passed.
- Editor Vite build passed after sandbox rerun; temp output removed.
- `node scripts/check-source-organization.mjs` passed.
- Scoped `git diff --check` had CRLF warnings only.

Not rerun here:

- Full typecheck/build/Vitest/e2e. Parent verification covers the heavier checks; this lane re-reviewed architecture and source compliance.

## Residual Risk / Follow-Up

- `previewProvenance` shape is validated, and UI-generated provenance is now carried through Apply. Operation Core does not deeply prove every semantic pairing between `method`, `previewProvenance.source`, and `qualityMetrics.v6Metrics.methodId`; current tests cover the intended UI-generated backend-output and fallback paths. This is not blocking for Domain E, but future hardening could reject inconsistent caller-supplied preview provenance.
- Domain F should still independently classify package manifest, lockfile, generated dependency registry, backend implementation files, and old algorithm file changes because they remain dirty in the shared worktree and are outside Domain E ownership.
