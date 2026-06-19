# Wave85 Domain C Spec Compliance Review

## Verdict

pass

## Basis reviewed

- `discussion/implementation/orchestration/wave85-plan.md`
- `discussion/design/screen-design/screens/diagnostics-evidence-view.md`
- `discussion/design/screen-design/components/dynamics-tool.md`
- `discussion/implementation/remaining-work-backlog.md`
- `discussion/implementation/waves/wave85/wave85-domain-a-editor-local-diagnostics-projection-report.md`
- `apps/editor/src/features/editor-session/model/editor-diagnostics-state.ts`
- `discussion/implementation/waves/wave85/wave85-domain-c-inline-tree-diagnostics-integration-report.md`
- Domain C changed source/tests listed in the original review request, including the untracked tree component tests.
- Post-fix re-review files:
  - `apps/editor/src/workspace/panels/mesh-tool-inspector.tsx`
  - `apps/editor/src/workspace/panels/mesh-tool-inspector.test.ts`
  - `discussion/implementation/waves/wave85/wave85-domain-c-inline-tree-diagnostics-integration-report.md`

No independent test command was rerun for this review or post-fix re-review. This is a source/test/report compliance review.

## Post-Fix Re-Review

Fix Loop 1 resolves the prior blocking finding.

- `MeshToolInspector` now passes `draftsForTarget` into diagnostic derivation at `apps/editor/src/workspace/panels/mesh-tool-inspector.tsx:184`.
- Generation failure diagnostics still take precedence when the current target contains the failing Drawable at `apps/editor/src/workspace/panels/mesh-tool-inspector.tsx:597`.
- Single `currentDraft` diagnostics are used first when available at `apps/editor/src/workspace/panels/mesh-tool-inspector.tsx:608`.
- If the single current draft is absent or has no diagnostic, `createFirstMeshDiagnosticViewFromDrafts()` scans target drafts and returns the first fallback / 0-triangle diagnostic at `apps/editor/src/workspace/panels/mesh-tool-inspector.tsx:612`.
- New focused tests cover drawable-set fallback diagnostics at `apps/editor/src/workspace/panels/mesh-tool-inspector.test.ts:119` and drawable-set 0-triangle diagnostics at `apps/editor/src/workspace/panels/mesh-tool-inspector.test.ts:159`.
- The Domain C report records Fix Loop 1 and states that batch fallback / zero-triangle target drafts now reach the existing inline card.

## Findings

No open spec-compliance findings after Fix Loop 1.

### Resolved: Mesh batch fallback and 0-triangle drafts now get an inline diagnostic card

Original finding: `apps/editor/src/workspace/panels/mesh-tool-inspector.tsx:61` computed `draftsForTarget`, but `currentDraft` was only set for `target.kind === "drawable"` at `apps/editor/src/workspace/panels/mesh-tool-inspector.tsx:62`. For `drawableSet` batch mode it was always `null`.

Post-fix result: the inline diagnostic helper now receives `draftsForTarget`, preserves generation failure and current-draft precedence, and scans target drafts when needed. Batch preview drafts that carry fallback metadata or 0 triangles are now surfaced through the existing card.

Classification: resolved / pass.

## Spec Coverage Notes

### Mesh

- Pass: transient generation failure state is editor-local React context state and is not session graph/history persistence; see `apps/editor/src/features/editor-session/editor-session-context.tsx:483`, `apps/editor/src/features/editor-session/editor-session-context.tsx:1176`, and `apps/editor/src/features/editor-session/editor-session-context.tsx:1916`.
- Pass: single-drawable fallback and 0-triangle diagnostics are converted from draft metadata at `apps/editor/src/workspace/panels/mesh-tool-inspector.tsx:641`.
- Pass: card has short reason, compact details, and copy payload at `apps/editor/src/workspace/panels/mesh-tool-inspector.tsx:545` and `apps/editor/src/workspace/panels/mesh-tool-inspector.tsx:739`.
- Pass: batch fallback / 0-triangle drafts are surfaced by scanning `draftsForTarget` when no higher-priority diagnostic applies.
- Pass: no mesh generation algorithm source was changed; Domain C only calls existing `createGeneratedMeshForDrawable()` at `apps/editor/src/features/editor-session/editor-session-context.tsx:1896`.

### Dynamics

- Pass: create/edit draft validation remains in `validateDynamicsToolDraft()` and duplicate output ownership remains blocking at `apps/editor/src/features/editor-session/model/dynamics-tool-state.ts:449`.
- Pass: existing group summaries consume Domain A diagnostics via `createEditorDiagnosticsProjection()` at `apps/editor/src/features/editor-session/model/dynamics-tool-state.ts:501`.
- Pass: duplicate loaded-output diagnostics are mapped to groups through Domain A action hints at `apps/editor/src/features/editor-session/model/dynamics-tool-state.ts:1126`.
- Pass: `dynamics.outputKeyformMissing` comes from Domain A/v0 projection at `apps/editor/src/features/editor-session/model/editor-diagnostics-state.ts:393`.
- Pass: group list and inspector surface warning summaries at `apps/editor/src/workspace/panels/dynamics-tool-inspector.tsx:370` and `apps/editor/src/workspace/panels/dynamics-tool-inspector.tsx:1399`.

### Tree

- Pass: Parts Tree warning metadata is limited to Domain A `mesh.drawableMeshMissing` at `apps/editor/src/features/editor-session/model/session-tree.ts:233`.
- Pass: Parts Tree rows retain their normal `name` / `detail` and render only a compact warning icon at `apps/editor/src/workspace/panels/structure-tree-panel.tsx:248`.
- Pass: Deformer Tree bound drawable rows and drawable-pool rows receive the same compact warning metadata at `apps/editor/src/features/editor-session/model/rig-tool-state.ts:538` and `apps/editor/src/features/editor-session/model/rig-tool-state.ts:587`.
- Pass: Deformer Tree UI renders compact icons without visible verbose row text at `apps/editor/src/workspace/panels/deformer-tree-view.tsx:200` and `apps/editor/src/workspace/panels/deformer-tree-view.tsx:384`.

### Viewer Exclusion

- Pass: Domain C changed files do not implement Viewer diagnostics, Viewer badges, Viewer warning content, or Viewer controls. Forbidden-surface search over Domain C paths found no Viewer/Validate/Preflight/repair/scoring/proposal additions.

### Must-Nots

- Pass: no Validate screen or App Bar / Toolbox badge implementation in Domain C paths.
- Pass: no Product Preflight wholesale migration.
- Pass: no auto-fix, repair, proposal, completion score, or quality judgement controls.
- Pass: no Dynamics schema or operation payload changes.
- Pass: no mesh generation algorithm changes.

## Residual Risks / User-Decision Points

- Mesh generation failure reason remains coarse when `createGeneratedMeshForDrawable()` returns `undefined`; this is acceptable for Domain C because generator refactoring is forbidden.
- Browser visual QA was not run by this review; the evidence is focused source/model/DOM tests and the Domain C report.
- No user-decision point remains for this spec-compliance lane.
