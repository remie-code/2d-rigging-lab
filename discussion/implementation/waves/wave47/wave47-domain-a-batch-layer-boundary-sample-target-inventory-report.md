# Wave47 Domain A Report: Batch Layer Boundary / Sample Target Inventory

> Target: `wave47-batch-layer-boundary-sample-target-inventory`
> Role: Gnome
> Verdict candidate: `pass`

## Verdict Candidate

`pass`

Wave47 Domain A can proceed as a bounded design/documentation gate. The v0 scope is explicit user-selected PSD leaf layer batch intake and generated part scaffolding under a selected parent part. This report does not claim all-layer import, recursive group import, drag-drop, archive/filesystem access, Photoshop-style full compositing, renderer/pixel oracle, texture sampling correctness, Cubism compatibility, public demo asset status, or repo-side repair/LLM behavior.

No source implementation, dependency manifest, lockfile, public demo asset, raw visual byte, or sample-derived public asset was created or edited.

## Basis Inspected

- `.agents/skills/implementation-orchestration/SKILL.md`
- `C:/Users/remie/.codex/skills/subagent-context-hygiene/SKILL.md`
- `discussion/implementation/orchestration/wave47-plan.md`
- `discussion/implementation/current-capability-map.md`
- `discussion/implementation/remaining-work-backlog.md`
- Wave46 final report and clean integration review
- Wave46 Domain A-F reports for selected-layer storage, browser materialization, package/operation intake, Editor UX, validator diagnostics, and focused e2e
- `discussion/development_convention/dependency-policy.md`
- `discussion/development_convention/diagnostic-policy.md`
- `discussion/development_convention/schema-and-id-conventions.md`
- `discussion/tests/fixtures/fixture-manifest.md`
- `discussion/tests/traceability/test-traceability-matrix.md`

Narrow implementation-source reads were used only to recover existing Wave46 cap constants and ID helper behavior that the reports referenced but did not fully spell out. No source files were edited.

## PSD Inspection

Approved inspection command run:

```powershell
pnpm.cmd smoke:wave44:psd-parser
```

The command uses `node scripts/wave44-psd-parser-smoke.mjs --psd test_data/sample_model.psd`, an existing Wave44-approved parser script. It did not persist raw RGBA bytes or public demo assets.

Summarized result:

- Parser: `@webtoon/psd` `0.4.0`
- Source: `test_data/sample_model.psd`
- Source byteLength: `22406225`
- Source SHA-256: `44ab43238cd2b2af2fb0ce6a7b5073a60e332d03da7666ea274c02e0462294b5`
- Source provenance: private/local fixture, `publicDemoAsset=false`
- Document: `2048 x 3072`, channelCount `4`, depth `8`, colorMode `3`
- Tree summary: `20` groups, `126` leaf layers, `121` visible leaf layers, `5` hidden leaf layers, maxDepth `3`
- Smoke extraction remains the existing `headwear` layer evidence only; additional batch targets below are chosen from parser layer-tree metadata and must be materialized by Domains B/F to produce per-layer digests.

## Selected Sample Target Set

Default focused e2e target set: three visible materializable leaf layers.

| Order | Layer name | Layer ref | Path / group context | Bounds | Estimated raw RGBA byteLength | Stability reason |
|---:|---|---|---|---|---:|---|
| 1 | `headwear` | `psd:root/layer[0]` | `headwear` at root | left `808`, top `92`, width `400`, height `288`, right `1208`, bottom `380` | `460800` | Existing Wave44-Wave46 stable target; visible leaf; Wave46 e2e already proved selected-layer intake to `part_root`; materialized digest is recorded as `671e6a363745b1ce2e8d29c1a63438170fe9511c8884ea42298cf9b8886e5c1a`. |
| 2 | `eyewear` | `psd:root/layer[3]` | `eyewear` at root | left `862`, top `404`, width `265`, height `110`, right `1127`, bottom `514` | `116600` | Visible root leaf with a unique ASCII name; small raw byte footprint; exercises a second independent root leaf without relying on group recursion. |
| 3 | `tie` | `psd:root/group[6]/layer[0]` | `tie / tie` under group `psd:root/group[6]` | left `941`, top `641`, width `104`, height `560`, right `1045`, bottom `1201` | `232960` | Visible grouped leaf with a small raw byte footprint; exercises path-aware generated IDs and parent scaffold behavior without importing the group recursively. |

Total estimated raw RGBA byteLength for the default set: `810360` bytes.

Non-target observations:

- `psd:root/layer[1]` is a hidden duplicate-name `headwear` layer and should not be part of the default happy-path e2e. It is useful only for hidden-layer or duplicate-name negative coverage if a later domain needs it.
- `psd:root/group[2]`, `psd:root/group[4]`, `psd:root/group[6]`, and other groups are containers. Selecting a group must not expand it into recursive import in Wave47 v0.
- Expression groups under `psd:root/group[4]` include non-ASCII group names and many same-name leaf layers. They are useful future stress coverage, but the default focused e2e should stay on ASCII stable names to keep ID expectations readable.

## Batch Caps

Recommended Wave47 v0 caps:

- Source PSD parse cap: keep the existing Wave45/Wave46 browser parser cap, `32 * 1024 * 1024` bytes per explicit PSD source.
- Per-layer materialized raw RGBA cap: keep the existing Wave46 single-layer guard, `64 * 1024 * 1024` bytes per layer.
- Batch selected leaf cap: `4` explicit unique leaf layer refs per batch.
- Batch total materialized raw RGBA cap: `32 * 1024 * 1024` bytes across successful materialized layer candidates in one batch.

Rationale:

- Wave47 v0 is a browser/session workflow without new workerization, streaming, archive/filesystem, or dependency changes.
- The existing single-layer path already accepts the private/local sample PSD under a `32 MiB` source cap and a `64 MiB` per-layer raw RGBA cap. Batch must not multiply the per-layer cap into an unbounded session memory requirement.
- A `4` layer cap keeps the first result UI, preflight summary, operation evidence, and partial failure handling tractable.
- A `32 MiB` total raw RGBA cap permits a small multi-layer batch and a single document-sized raw RGBA layer for this sample class while still bounding retained current-session bytes.
- The selected sample set is `810360` bytes, well below the proposed total cap.

If a future workflow needs larger batches, workerization, streaming materialization, or higher total byte caps, that is a later product/performance decision, not Domain A scope.

## Batch Input Semantics

Wave47 v0 input is a batch of explicit user-selected leaf layer refs from the current explicit private/local PSD parse session.

- Supported happy path: visible PSD leaf layers with positive bounds and adapter materialization support.
- Groups are not batch-imported recursively. A selected group ref returns per-entry `unsupported` with a group/container reason.
- All-layer import is out of scope. The UI must not present a command that implies "import all", "import group recursively", or "auto-build PSD hierarchy".
- Duplicate layer refs are detected before materialization. The first unique ref may continue; repeated entries return `duplicateSelection` and are not materialized.
- Hidden leaf layer support is provisional. Domain A recommends v0 treats hidden selected leaves as `unsupported` unless Domain B/D deliberately prove and label hidden-layer explicit materialization. The default e2e target set uses visible leaves only.
- Batch preflight should compute unique refs, approximate raw byte totals from bounds when available, and detect obvious unsupported refs before parser materialization.

## Per-Layer Result Semantics

Each selected entry must produce a per-layer result. Silent partial success is forbidden.

| Result | Meaning | Required surfacing |
|---|---|---|
| `success` | Layer was materialized, stored or registered as private/local raw RGBA candidate/asset, and mapped to texture/drawable/part evidence. | Show source layer, digest, byteLength, mediaType, generated IDs, destination part, and provenance. |
| `unsupported` | Ref is a group/container, hidden leaf rejected by v0 policy, zero-size/non-raster layer, unsupported adapter feature, or otherwise not materializable in v0. | Show layer ref/path/name and exact unsupported reason. |
| `duplicateSelection` | Same source layer ref appears more than once in the submitted batch. | Show duplicate ref and the canonical first occurrence; do not materialize the duplicate entry. |
| `missingBytes` | Current PSD source bytes or current materialized bytes required for the operation are unavailable. | Require reupload, reparse, or re-materialization; do not treat saved metadata as current bytes. |
| `staleSource` | Source PSD digest/byteLength, layer ref/path/name, parser identity, extraction options, mediaType, dimension, or candidate identity no longer matches expected evidence. | Require reupload/reparse/re-selection and show mismatch facts. |
| `materializationFailure` | Adapter/parser layer materialization fails or raw RGBA byteLength does not match width * height * 4. | Preserve parser-free failure evidence; do not persist parser objects or raw bytes. |
| `idNameCollision` | Generated texture/drawable/mesh/part ID collides with the package or another batch entry and cannot be deterministically resolved under v0 rules. | Block that entry or the preflight group; show colliding ID/name and required user override/reselection path. |
| `batchCapExceeded` | Unique leaf count or total materialized byte estimate/actual exceeds v0 caps. | Show cap, actual/estimated count or bytes, and entries that must be removed. |

Batch aggregate status:

- `success`: every non-duplicate selected entry that should materialize succeeded.
- `partialFailure`: at least one entry committed or materialized and at least one selected entry failed, was unsupported, duplicated, stale, missing, or collision-blocked.
- `failure`: no selected entry succeeded.
- `preflightBlocked`: preflight found conditions that should prevent any mutation, such as selected count cap exceeded, total cap exceeded before materialization, missing destination parent, or deterministic ID collisions that cannot be resolved.

## Part Scaffold Semantics

Destination is a user-selected parent part plus deterministic generated per-layer scaffold.

- Wave47 default batch behavior should create one generated leaf part per successful selected PSD leaf under the selected parent part.
- For each successful layer, generate or supply deterministic `partId`, `drawableId`, `meshId`, and `textureId`, then map drawable -> generated part and texture -> materialized binary asset.
- Generated display names may use the original PSD layer name, but machine-readable IDs must use sanitized stable tokens with no spaces.
- ID generation should use the full source layer path and, where needed, the source layer ref/index, not only the final display name. This avoids same-name leaves under different groups collapsing to the same ID.
- Existing helpers and patterns should remain the baseline: `createDrawableIdFromDisplayName`, `createTextureIdFromDrawableId`, `createMeshIdFromDrawableId`, `createPartIdFromDisplayName`, and sanitization to `[a-z0-9_-]`-style tokens.
- Example target IDs for the default set may be `part_headwear` / `draw_headwear` / `tex_headwear`, `part_eyewear` / `draw_eyewear` / `tex_eyewear`, and `part_tie_tie` / `draw_tie_tie` / `tex_tie_tie`, subject to Domain C/D's exact existing helper output and collision preflight.

Existing part destination differs from generated part scaffold:

- Existing part destination is the Wave46 behavior: add a selected materialized layer's drawable/texture mapping to an already-existing part such as `part_root`, without creating a child part.
- Generated part scaffold is the Wave47 batch default: selected parent part is the parent, and each successful selected layer receives its own generated child part plus drawable/texture/mesh mapping.
- Batch v0 may keep existing-part mode as an explicit compatibility path, but it must not be the only multi-layer behavior if Wave47 is to exercise part scaffolding.

Collision behavior:

- Preflight must reserve all generated target IDs for the batch before mutation.
- Collisions within the batch or with existing package IDs must be reported as `idNameCollision`.
- v0 should not silently append random or order-dependent suffixes. If suffixing is needed, it must be deterministic from source layer path/ref and visible in the result evidence.
- User-supplied overrides may be allowed by Domains C/D, but they must be explicit and validated before commit.

## Atomicity And Truthfulness

All-or-nothing transaction semantics are not required for Wave47 v0.

Required truthfulness:

- Run preflight before mutation for selected refs, duplicate refs, destination parent availability, obvious cap failures, and deterministic ID reservations.
- If preflight is blocked, do not mutate and return `preflightBlocked` with per-entry reasons.
- If implementation commits per layer and a later layer fails, report `partialFailure` with exact committed operation/evidence refs and exact failed entries.
- UI and validator surfaces must never summarize a partially committed batch as simple success.
- Do not claim rollback, transactionality, or all-or-nothing behavior unless the operation layer actually provides it.
- Save/load truthfulness remains Wave46-compatible: committed materialized private/local bytes may be restored only through existing project binary byte storage or portable JSON boundary after digest/byteLength verification; source PSD bytes and raw parser objects are not project persistence capabilities.

## Evidence Requirements For Domains B/C/D/E/F

Every per-layer result passed downstream must include or preserve:

- Batch identity: batch operation/request id, source PSD source asset id, selected entry order, unique layer ref key, and per-layer status.
- Source PSD identity: file name/path label, mediaType when declared, SHA-256 digest, byteLength, intake kind, current-byte availability, private/local provenance, `publicDemoAsset=false`.
- Source layer identity: layer ref, original name, full source layer path, kind `layer`, visible/hidden flag, bounds, width, height, opacity/composedOpacity when available.
- Parser identity: parser name/package/version, adapter name/version, runtime, private-shape policy.
- Extraction options: `selectedLayerRasterV1`, `Layer.composite(false, false)` or exact adapter equivalent, effects disabled, composed/full-document composition disabled, hidden-layer inclusion policy, outputEncoding `raw-rgba`, channel order `rgba`, pixelFormat `rgba8`.
- Raw RGBA materialization: mediaType `application/vnd.ai-native-live2d.raw-rgba; pixelFormat=rgba8`, width, height, byteLength, digest, byte availability, and raw byteLength consistency with width * height * 4.
- Storage/provenance: package-local binary asset ref when committed, browser-local storage evidence when restored, private/local provenance, `notPublicDistributable`, `publicDemoAsset=false`, and no persisted raw parser object/source PSD bytes.
- Destination mapping: selected parent part id, destination kind (`generatedPartScaffold` or explicit existing-part mode), generated part/drawable/mesh/texture IDs and display names, binary asset ref, operation id, and mapping evidence from source layer -> materialized asset -> texture -> drawable -> part.
- Failure evidence: unsupported reason, duplicate canonical ref, missing/stale facts, cap facts, collision facts, or materialization failure facts.

Domains B/C/D/E/F should treat missing evidence as a blocking result or diagnostic, not as absent data to ignore.

## Files Changed

- `discussion/implementation/waves/wave47/wave47-domain-a-batch-layer-boundary-sample-target-inventory-report.md`

No `apps/**`, `packages/**`, `scripts/**`, dependency manifest, lockfile, fixture byte, public demo asset, or raw visual byte file was edited.

## Verification Performed

- `pnpm.cmd smoke:wave44:psd-parser`
  - Passed. Summary recorded in "PSD Inspection".
- `git diff --check -- discussion/implementation/waves/wave47/wave47-domain-a-batch-layer-boundary-sample-target-inventory-report.md`
  - Passed with no whitespace findings.

## Remaining Issues

- Domains B/C/D/E/F must compute actual per-layer materialized digests for `eyewear` and `tie/tie`; Domain A only selected them from approved layer-tree metadata and raw byte estimates.
- If implementation requires direct parser imports outside the approved Editor/browser adapter or Wave44 scripts, a new dependency/parser boundary decision is required and the domain should return `escalate`.
- If package/operation cannot represent batch per-layer evidence without a public schema-breaking change, Domain C should return `escalate`.
- If product direction changes to all-layer import, recursive group import, drag-drop/filesystem, full compositing, renderer/pixel oracle, or public sample/demo asset distribution, Wave47 Domain A should be superseded by a new plan.

## User-Decision Points

None required for Domain A pass.

Optional future decisions outside Domain A:

- Raise the v0 selected layer count above `4` or the total materialized byte cap above `32 MiB`.
- Support hidden leaf layer materialization as an explicit batch feature instead of returning `unsupported`.
- Require all-or-nothing batch transaction semantics rather than truthful preflight plus per-layer partial result reporting.
