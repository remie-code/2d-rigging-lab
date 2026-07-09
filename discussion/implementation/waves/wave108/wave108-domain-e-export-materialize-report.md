# Wave108 Domain E Report — `wave108-export-materialize` (Option E, Batch 3 / D-export)

Role: Gnome (implementation), delegated by Orch-Sylph. Batch 3, Domain E (D-export).

Verdict: **green** — focused suites + typecheck all pass. **Materialization source logic is
unchanged and proven correct**; the only source edit is a test-only `export` of an
already-correct private function. The three-way consistency (editor atlasRuntime = export =
runtime) is asserted numerically by a new focused test.

Design oracles: `discussion/design/mesh-rendering/boundary-transparent-margin-design.md`
(§3.2 no UV range check, §4 cross-bleed [必達], §5 mechanism, §6 three-way consistency,
§7 D-export); `discussion/implementation/orchestration/wave108-plan.md` §9 Domain E;
D-atlas申し送り `wave108-domain-c-atlas-transparent-gutter-report.md` §3 / §8-2 (`uvRect`
= content sub-rect, single source of truth — no re-inset).

## 1. Changed files (absolute paths)

Implementation (Domain E allowed scope):
- `C:\workspace\remie\code\ai-native-live2d-editor\packages\authoring-core\src\runtime-export-materialization.ts`
  — **logic unchanged.** The sole diff is adding `export` (plus an explanatory comment) to
  `mapSourceUvToAtlasUv` so its numeric behaviour can be asserted by a unit test. The
  function body is byte-for-byte identical. This is the "named export for unit testing"
  explicitly permitted by the delegation, not a behaviour change.

Tests (new):
- `C:\workspace\remie\code\ai-native-live2d-editor\packages\authoring-core\src\runtime-export-materialization.test.ts`

Report:
- `C:\workspace\remie\code\ai-native-live2d-editor\discussion\implementation\waves\wave108\wave108-domain-e-export-materialize-report.md`

**Not changed (in allowed write scope but deliberately left untouched):**
- `packages\package-format\src\runtime-export.ts` — `RuntimeExportMeshSchema.atlasUvs`
  (`Vec2Schema`, finite-only, no range constraint) is **left as-is** (see §4 range policy).
- `packages\authoring-core\src\index.ts` — I did **not** add a public re-export of
  `mapSourceUvToAtlasUv`. The test imports it directly from the module path, so no public
  surface expansion is needed. (The `index.ts` modification shown in `git status` is from a
  different Batch domain, not mine.)

> Scope note: the working tree carries parallel uncommitted changes from the other Batch
> domains (D-gen `mesh-generation-*`, D-texprep `psd-source-evidence` / `texture-atlas.ts`
> schema, D-atlas `texture-atlas-packing/binary/targets` + their tests). Those are **not
> mine**; I read them (read-only) and modified none. My tracked edit is exactly one source
> line-region (the `export` on `mapSourceUvToAtlasUv`) plus the one new test file.

## 2. Source is unchanged-and-correct — the maths (facts 1–3)

`mapSourceUvToAtlasUv` (runtime-export-materialization.ts :558-577):

```
sourcePixelX = uv.x · sourceTextureSize.width
localX       = (sourcePixelX − sourceRectPixels.x) / sourceRectPixels.width
atlasUv.x    = uvRect.topLeft.x + localX · (uvRect.bottomRight.x − uvRect.topLeft.x)
```

**Fact 1 — identity local-normalization.** D-atlas sets `sourceRectPixels = (0, 0,
sourceTextureSize)` (packing.ts :572-577). Substituting `sourceRectPixels.x = 0` and
`sourceRectPixels.width = sourceTextureSize.width`:

```
localX = (uv.x · W − 0) / W = uv.x                         (identity)
atlasUv.x = uvRect.topLeft.x + uv.x · (uvRect span_x)
```

So the mapping reduces to a single linear consume of `uvRect`, with **no inset re-applied**
(the inset is already folded into `uvRect` by D-atlas; re-insetting here would double-correct
— it is not, and must not be, done).

**Fact 2 — export ≡ editor atlasRuntime remap.** The editor's
`remapUvIntoPlacement` (`apps/editor/src/workspace/viewer/viewer-render-source.ts:507-520`)
computes `left + uv.x · (bottomRight.x − left)` with `left = uvRect.topLeft.x`. This is the
**exact same** expression as Fact 1's reduced form, reading the **same** `uvRect` as the
single source. Therefore export materialization and editor atlasRuntime produce identical
atlas UV — the necessary condition for §6 three-way consistency (runtime uses the same
materialized UV that export writes). The test transcribes `remapUvIntoPlacement` verbatim as
a reference oracle and asserts equality to 12 decimals for interior and overshoot UV, on two
tiles of different inset P.

**Fact 3 — non-clamped overshoot stays in the tile's own transparent band.** With
`uvRect` = content sub-rect (raster inset by `inset` on each side) and content span `C`:
- `u=0` → content left edge = `rasterX + inset` (inset px inside the raster);
- `u=1` → content right edge = `rasterX + inset + C`;
- max overshoot `u = 1 + inset/C` → `rasterX + inset + (1+inset/C)·C = rasterX + C + 2·inset`
  = **exactly the raster's outer edge** (the outermost pixel of the transparent band);
- min overshoot `u = −inset/C` → `rasterX` = raster's outer left edge.

So for the full non-clamped layer-local UV range `u ∈ [−inset/C, 1+inset/C]`, the atlas pixel
stays within `[rasterX, rasterX + rasterW]` = the tile's own `contentRectPixels` (raster
placement). Because D-atlas packs padded rasters with a gutter between them, that raster
placement is disjoint from every neighbouring placement, so overshoot **never reaches a
neighbour** (§4 cross-bleed avoidance). Materialized UV also stays within the atlas page
`[0,1]` (the raster placement is on-page). The test asserts all of this numerically.

## 3. New test file — asserted numeric facts

`packages/authoring-core/src/runtime-export-materialization.test.ts` (4 tests). It builds
`TextureAtlasPlacementDto` fixtures **exactly as D-atlas `createTextureAtlasPlacement`
constructs them** (padded raster = content + 2·inset; `sourceRectPixels = (0,0,padded)`;
`uvRect` = content sub-rect, page-normalized), for two tiles on one page:
- **Tile A "mouth_u-like" (small, low inset):** content 17, inset 3 → raster 23×23 at (4,4),
  spanning atlas x ∈ [4,27]. (Mirrors the frozen `mouth_u` 17×16 boundary case.)
- **Tile B "large v7" (big, high inset):** content 40, inset 17 → raster 74×74 at (31,4),
  spanning x ∈ [31,105]; a 4px gutter separates it from Tile A.

Tests and the facts they assert:
1. `reduces to identity local-normalization and the linear uvRect consume` — Fact 1:
   `atlasUv = uvRect.topLeft + uv·span`; ground-truth `uv=(0.3,0.7)` → x = 12.1/128, y =
   (7+0.7·17)/96. Also pins `uvRect` = content sub-rect ([7/128, 24/128]).
2. `agrees exactly with the editor atlasRuntime remap on the shared uvRect` — Fact 2:
   export == inline `remapUvIntoPlacement` oracle to 1e-12, for both tiles and 5 UVs
   including `(-0.3,1.2)` and `(1.4,-0.15)` overshoot.
3. `maps u=0 and u=1 to the content edges (inset px inside the raster)` — u=0 → 7px, u=1 →
   24px (content edges sit `inset` px inside the raster).
4. `keeps max non-clamped overshoot inside the tile's own transparent band, off the
   neighbour` — Fact 3: for `u,v ∈ {−inset/C, 0, 1, 1+inset/C}` every mapped point stays in
   `[0,1]` page-space AND inside that tile's own `contentRectPixels`; Tile A max overshoot →
   exactly raster edge 27px, strictly `< 31` (Tile B raster left) → no cross-bleed; Tile B max
   overshoot → exactly 105px, strictly `>` Tile A raster right → clear of the neighbour.

## 4. atlasUvs range policy (Orch-Sylph decision, implemented)

**`RuntimeExportMeshSchema.atlasUvs` (`packages/package-format/src/runtime-export.ts:346-350`,
`Vec2Schema` = finite-only) is left unchanged — no `[0,1]` hard range validation added.**
Rationale (per delegation + design):
- Design §4 forbids over-rejection: layer-local UV legitimately exceeds `[0,1]` (covering
  margin overshoot). A hard range check would kill valid overshoot.
- Cross-bleed is prevented by D-atlas's **geometric transparent-band guarantee** (overshoot
  ≤ inset px lands in the tile's own band, proven in §2 Fact 3), not by schema validation.
  §3.2 ("no UV range check exists") / §4 ("no rejecting validation") are inherited; the
  per-texture `CLAMP_TO_EDGE` safety net is replaced by the transparent band on the atlas path.
- Instead of a schema hard-fail, the new test **asserts** (as an in-band/in-page/off-neighbour
  assertion) that materialized UV is safe. This is the §4-consistent choice: prove safety by
  geometry + test, do not strangle legitimate overshoot at the schema.

`package-format` suite remains 28 files / 141 passed, confirming the schema is untouched.

## 5. Test results

- `pnpm.cmd exec vitest run packages/authoring-core/src` — **40 files / 309 tests passed**
  (was 305 in the D-atlas report; +4 from the new `runtime-export-materialization.test.ts`).
  Includes the three-way-consistency regression `runtime-export-assembly.test.ts`
  "materializes mesh UVs in atlas page coordinates" (:305-321) — **green, unchanged**.
- `pnpm.cmd exec vitest run packages/package-format/src` — **28 files / 141 tests passed**
  (schema untouched; confirms §4 range policy left `atlasUvs` as-is with no regression).
- `pnpm.cmd typecheck` (`tsc --noEmit`) — **clean, no errors**.

Stray-`.js` shadowing hazard flagged in the D-atlas report §8-1: I re-checked
`packages/authoring-core/src/*.js` — only the **2 tracked** hand-written runtime files
(`mesh-generation-v6b/v7-constrainautor-runtime.js`) are present; no stale emit shadowing my
source. My test therefore ran against the current `.ts`.

## 6. Discretionary decisions

1. **Named-export over assembly-path testing.** The delegation allowed either. I chose to
   `export mapSourceUvToAtlasUv` and unit-test it directly, because it lets me express Facts
   1–3 as exact numeric equalities on hand-built placements with controlled inset P (small +
   large tile), including the extreme `u = 1 + inset/C`, which an end-to-end `assembleRuntime
   Export` fixture (fixed 2×2 textures, no baked inset) cannot exercise. The change is
   test-only visibility; function logic is unchanged.
2. **No public re-export via `index.ts`.** The test imports the module path directly; adding
   a package-public export would needlessly widen the surface. Minimal.
3. **Source left otherwise untouched.** Per §1/§2 the mapping is already correct against
   D-atlas placements (identity normalization + single-source `uvRect`); I added no logic and
   explicitly did **not** re-inset from `placement`-derived content-inset (would double-correct
   — D-atlas's explicit prohibition). "無改変で正当" holds.
4. **atlasUvs schema range check not added** (§4) — Orch-Sylph decision implemented as
   written.

## 7. Questions / escalate

None blocking. One confirmation for the record: this domain assumes D-atlas's申し送り holds
(`sourceRectPixels = (0,0,padded)` and `uvRect` = content sub-rect). I verified both directly
in the current working tree (`texture-atlas-packing.ts` :536-577) and my fixtures reproduce
that geometry, so the assumption is grounded, not taken on faith. If a later change to D-atlas
were to make `sourceRectPixels` a strict sub-rect of `sourceTextureSize`, Fact 1's identity
would no longer hold and this domain would need revisiting — but that is not the current state.

## 8. Injection

No prompt-injection encountered in any file, tool output, or other-agent artifact read during
this task. All followed instructions came from the delegation body and the Basis design/plan/
D-atlas-report documents only. Reporting language and format kept to normal Japanese/standard
operation as instructed.

DOMAIN-E-REPORT-COMPLETE (Option E)
