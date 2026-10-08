# Material authoring commands

These commands operate on a saved editable `open-model-package-v1` directory. They preserve a separate candidate and its original package snapshot. The Editor can open the applied package through its normal Open Workspace flow; reload after applying and avoid overwriting it with an older unsaved Editor session.

Use Node with TypeScript transform support from the repository root:

```powershell
node --experimental-transform-types --no-warnings --import ./apps/authoring-host/register-workspace-source-resolver.mjs ./apps/authoring-host/src/cli.ts --package-dir C:/work/model --state-dir C:/work/material-state --command-file C:/work/command.json
```

Omit `--command-file` to read one JSON command from stdin. Keep the same state directory for subsequent candidate commands. It must be outside the package directory. The CLI returns JSON and exits with 0 only for completed commands, 2 for rejection (including package busy), and 1 for failure. Only completed `applyMaterialCandidate` sets `saved=true` and material `baseChanged=true`. Saving a candidate is not saving the base.

All commands use the existing envelope:

```json
{
  "schemaVersion": "ai-command-request-v1",
  "commandId": "cmd_material_001",
  "session": { "agentId": "author", "capabilities": ["read", "render", "commitWithApproval"] },
  "command": "inspectMaterialCandidate",
  "payload": { "candidateId": "material_ID_FROM_REGISTER" }
}
```

`inspectMaterialCandidate` requires `read`; extraction and previews require `render`; candidate changes require `commitWithApproval`. These are existing host capabilities. Internal candidate approval is an explicit tool state, not a request for a new human approval step.

## Workflow and payloads

| Command | Payload |
| --- | --- |
| `extractMaterialSource` | `drawableId`, `viewport` |
| `registerMaterialCandidate` | absolute `imagePath` (PNG), optional `expectedOriginalFileSha256`, `placement`, `restPose`, `intent`, `provenanceNote` |
| `setMaterialPlacement` | `candidateId`, `expectedCandidateRevision`, `alignment: {placement}` or `{correspondences}` |
| `inspectMaterialCandidate` | `candidateId` |
| `previewMaterialCandidate` | `candidateId`, `mode: placement/working`, `viewport`, optional `parameterOverrides` and `variantSelections` for working mode |
| `buildMaterialCandidate` | `candidateId`, `expectedCandidateRevision` |
| `editMaterialCandidate` | `candidateId`, `expectedCandidateRevision`, `operation` (normal OperationRequest with `dryRun=false` and current working package revision) |
| `approveMaterialCandidate` | `candidateId`, `expectedCandidateRevision`; records the envelope agent as approver |
| `applyMaterialCandidate` | `candidateId`, `expectedCandidateRevision` |
| `discardMaterialCandidate` | `candidateId`, `expectedCandidateRevision` |

Start with extract → register → place → placement preview → build → candidate edits → working preview → approve → apply. `payload.result.candidate` returns the new revision after each mutation; inspection returns `payload.candidate`. The original texture PNG, source mapping and surrounding composite are returned by extraction. All artifact paths are absolute.

Placement explicitly maps source pixel edges to rest-stage coordinates, with positive uniform scale:

```json
{
  "from": "source-image-pixel-edge-v1",
  "to": "rest-stage-canvas-y-down-v1",
  "scale": 2,
  "translation": { "x": 10, "y": 20 }
}
```

Each correspondence is `{ "pixel": {"space":"source-image-pixel-edge-v1","x":0,"y":0}, "stage": {"space":"rest-stage-canvas-y-down-v1","x":10,"y":20} }`. Supply at least two nondegenerate points. Fit results include numerical residuals; they do not judge visual naturalness. Transparent margins retain their source pixel positions.

`restPose` is `{ "kind":"undeformed-rest", "coordinateSystem":"canvas-y-down-v1", "keyedDeformation":false, "dynamics":false }`. It describes the source artwork. Use a genuine rest image to avoid applying rig deformation twice.

`viewport` fixes comparison coordinates and scale, for example `{ "stageRect":{"space":"rest-stage-canvas-y-down-v1","x":0,"y":0,"width":512,"height":512}, "outputWidth":512,"outputHeight":512 }`. Output and stage aspect ratios must match. `comparisonAbsolutePath` is a standalone HTML file with Base/Candidate buttons using the same image frame. Placement renders the full alpha in the layer order without clipping to the previous mesh. Working mode runs the real mesh/rig renderer; its `evaluatedRender` and `baseEvaluatedRender` sidecars record evaluated parameters and variants separately from source rest metadata. Parameters absent from the original base are omitted from the base evaluation and recorded only in the candidate evaluation.

Replacement intent:

```json
{"kind":"replace","drawableId":"draw_target","preserveLogicalDrawableId":true,"geometryReset":{"scope":"target-direct-geometry-keyforms","keyformSetIds":[]},"preserveExistingDeformers":true,"sharedControlPolicy":"reject-shared-control-key-parameter-deletion"}
```

List the exact direct geometry keyform IDs to reset; no automatic old mesh/key migration occurs. Shared textures and other drawable references are preserved. Existing deformers are preserved for explicit re-editing. Source mapping, generated provenance and raw RGBA texture references are rebuilt together. Generated rights remain `needs_review`, with `redistributionAllowed=false`.

Addition intent:

```json
{"kind":"add","drawableId":"draw_new","displayName":"New part","parentPartId":"part_body","insertion":{"position":"last"},"rigControlIds":[],"maskBindings":[],"runtimeVisibility":true,"defaultOpacity":1}
```

Insertion may be `first`, `last`, or `before/after` with `sibling:{kind:drawable,drawableId:...}` or `sibling:{kind:part,partId:...}`. The sibling must be a direct child of that Part. Part hierarchy is independent from motion membership. A mask binding is `{maskRelationId:...,role:target/maskSource}`.

Normal candidate editing example:

```json
{
  "candidateId":"material_ID_FROM_REGISTER","expectedCandidateRevision":2,
  "operation":{
    "schemaVersion":"operation-request-v1","operationId":"op_material_remesh",
    "actor":"ai","surface":"structuredApi","dryRun":false,"basePackageRevision":12,
    "operationType":"generateMesh","payload":{"drawableId":"draw_target","method":"auto-grid-v1","densityHint":"low"}
  }
}
```

Use the candidate's `workingPackage.packageRevision` in the nested operation. Ordinary operations run on a deep clone; their normal validation and the material shared-reference guard must both pass before saving. Rig controls follow create → bind to target → edit. Parameters follow create → associate a target keyform → edit. Unbound existing controls/parameters cannot be edited or deleted, including ones just created by the candidate. Deleting shared controls, parameters or keys is rejected. All successful edits invalidate previous approval and advance candidate revision.

`setMaterialPlacement` invalidates the working package and approval, requiring another build. Approval binds the exact working fingerprint. Apply rejects a changed base revision or any changed file bytes, retains a stale candidate, and permits inspection/preview/discard; rebasing is not provided. The stored original base supports comparisons even after the live base changes. Discard is terminal and does not alter base bytes.

Package operations share a lock independent of state directory. A busy command returns a retryable rejection. Do not delete a lock while another command is running. Snapshot/working artifacts are retained outside the base. Ordinary apply failures roll back the directory and candidate pointer; if filesystem rollback itself fails, the error names the retained original backup for recovery. Cleanup failure after a completed apply may leave an extra backup. OS crash durability and abandoned-lock recovery are not claimed.

PNG intake currently rejects unsupported ICC/color metadata instead of silently relabeling color space. Atlas source signatures are not refreshed to hide material changes: previous atlas previews become stale and must be rebuilt through the existing atlas workflow.
