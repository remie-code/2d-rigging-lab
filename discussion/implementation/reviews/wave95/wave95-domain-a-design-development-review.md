# Wave95 Domain A Design / Development Compliance Review

## verdict

pass

## loop

2

## scope reviewed

- `packages/authoring-core/src/mesh-generation-v6-alpha-islands.ts`
- `packages/authoring-core/src/mesh-generation-v6d-adaptive-contour-constrainautor.ts`
- `packages/authoring-core/src/mesh-generation.test.ts`
- `discussion/implementation/waves/wave95/wave95-domain-a-authoring-core-multi-island-mesh-generation-report.md`
- Current diff/status for forbidden scope, dependency, lockfile, package-format, runtime, atlas/editor/provenance drift.

## basis documents used

- `discussion/implementation/orchestration/wave95-plan.md`
- `discussion/design/mesh-generation/auto-outline-v6d-adaptive-contour-constrainautor.md`
- `discussion/design/mesh-generation/auto-outline-v6g-contour-band-support-rings.md`
- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/development_convention/dependency-policy.md`
- `discussion/development_convention/operation-policy.md`

## findings ordered by severity

### Blocking findings

None.

### Non-blocking observations

1. `packages/authoring-core/src/mesh-generation-v6d-adaptive-contour-constrainautor.ts` is large at 1626 lines after adding multi-island dispatch, merge, fallback, and diagnostics. This remains a named method-responsibility file rather than a catch-all or `index.ts` entrypoint, and the raw island detection/filter/budget responsibility is split into `packages/authoring-core/src/mesh-generation-v6-alpha-islands.ts`. `node scripts/check-source-organization.mjs` passes. Future changes should avoid further growth here without splitting merge/diagnostic helpers.
2. The runtime `multiIslandDiagnostics` payload is emitted from Domain A, but `MeshGenerationV6Metrics` was not formally extended because `packages/authoring-core/src/mesh-quality-metrics.ts` was outside the delegated write scope. This is documented as a deferred item in the implementation report and should be owned by Domain B if operation/editor surfaces need typed access.

## compliance checks

- Connected component detection occurs before soft/support expansion: pass. The public V6D adaptive entrypoint calls `detectV6RawAlphaIslands(...)` before filtering, single-kept/multi-island routing, virtual padding, and contour pipeline execution (`packages/authoring-core/src/mesh-generation-v6d-adaptive-contour-constrainautor.ts:107`, `packages/authoring-core/src/mesh-generation-v6d-adaptive-contour-constrainautor.ts:110`, `packages/authoring-core/src/mesh-generation-v6d-adaptive-contour-constrainautor.ts:119`, `packages/authoring-core/src/mesh-generation-v6d-adaptive-contour-constrainautor.ts:148`). The detector reads raw alpha bytes directly and labels components before any blur or mask expansion (`packages/authoring-core/src/mesh-generation-v6-alpha-islands.ts:55`, `packages/authoring-core/src/mesh-generation-v6-alpha-islands.ts:75`, `packages/authoring-core/src/mesh-generation-v6-alpha-islands.ts:93`, `packages/authoring-core/src/mesh-generation-v6-alpha-islands.ts:194`).
- Per-island generation prevents soft/support processing from seeing or merging other islands: pass. Multi-island generation creates a full-size isolated RGBA buffer for each kept component and passes that into the existing single-island V6D generator (`packages/authoring-core/src/mesh-generation-v6d-adaptive-contour-constrainautor.ts:373`, `packages/authoring-core/src/mesh-generation-v6d-adaptive-contour-constrainautor.ts:380`). The isolation helper copies only the island's pixel indices (`packages/authoring-core/src/mesh-generation-v6-alpha-islands.ts:124`, `packages/authoring-core/src/mesh-generation-v6-alpha-islands.ts:139`). The single-kept-after-noise path also isolates the kept island before generation (`packages/authoring-core/src/mesh-generation-v6d-adaptive-contour-constrainautor.ts:300`).
- Budget allocation is global per Drawable and deterministic: pass. Multi-island generation resolves one global density budget from the kept-island total pixel count and union pixel bounds, then allocates caps across kept islands (`packages/authoring-core/src/mesh-generation-v6d-adaptive-contour-constrainautor.ts:351`, `packages/authoring-core/src/mesh-generation-v6d-adaptive-contour-constrainautor.ts:356`, `packages/authoring-core/src/mesh-generation-v6d-adaptive-contour-constrainautor.ts:364`). Allocation uses deterministic component weights, integer floors, and deterministic fractional tie-breaks (`packages/authoring-core/src/mesh-generation-v6-alpha-islands.ts:150`, `packages/authoring-core/src/mesh-generation-v6-alpha-islands.ts:281`, `packages/authoring-core/src/mesh-generation-v6-alpha-islands.ts:288`, `packages/authoring-core/src/mesh-generation-v6-alpha-islands.ts:326`). The remaining cap-floor exception is narrow and explicitly reported via `multiIslandDiagnostics.budgetPolicy` (`packages/authoring-core/src/mesh-generation-v6d-adaptive-contour-constrainautor.ts:1522`, `packages/authoring-core/src/mesh-generation-v6d-adaptive-contour-constrainautor.ts:1537`).
- Loop 2 all-kept-island fallback fix: pass. If every kept-island output is fallback, merge is bypassed and `createWholeDrawableMultiIslandFallback(...)` is used (`packages/authoring-core/src/mesh-generation-v6d-adaptive-contour-constrainautor.ts:636`, `packages/authoring-core/src/mesh-generation-v6d-adaptive-contour-constrainautor.ts:638`). That fallback builds an alpha-aware fallback from the original `input.rgbaBytes`, not from island-isolated RGBA buffers (`packages/authoring-core/src/mesh-generation-v6d-adaptive-contour-constrainautor.ts:821`, `packages/authoring-core/src/mesh-generation-v6d-adaptive-contour-constrainautor.ts:827`). Provenance records both all-islands fallback and whole-drawable fallback markers (`packages/authoring-core/src/mesh-generation-v6d-adaptive-contour-constrainautor.ts:1580`, `packages/authoring-core/src/mesh-generation-v6d-adaptive-contour-constrainautor.ts:1591`).
- UVs stay in original texture space: pass. Per-island RGBA preserves original texture dimensions, and merged UVs are concatenated from those outputs without island-local remapping (`packages/authoring-core/src/mesh-generation-v6d-adaptive-contour-constrainautor.ts:373`, `packages/authoring-core/src/mesh-generation-v6d-adaptive-contour-constrainautor.ts:647`, `packages/authoring-core/src/mesh-generation-v6d-adaptive-contour-constrainautor.ts:655`). The V6D mapping subtracts virtual padding and divides by the original texture size (`packages/authoring-core/src/mesh-generation-v6d-adaptive-contour-constrainautor.ts:1036`, `packages/authoring-core/src/mesh-generation-v6d-adaptive-contour-constrainautor.ts:1043`, `packages/authoring-core/src/mesh-generation-v6d-adaptive-contour-constrainautor.ts:1190`).
- Stable vertex/triangle IDs do not collide after merge: pass. Merge order is sorted by component order, triangle indices are offset by each output's vertex offset, and stable vertex/triangle IDs are island-scoped when multiple outputs are merged (`packages/authoring-core/src/mesh-generation-v6d-adaptive-contour-constrainautor.ts:632`, `packages/authoring-core/src/mesh-generation-v6d-adaptive-contour-constrainautor.ts:653`, `packages/authoring-core/src/mesh-generation-v6d-adaptive-contour-constrainautor.ts:661`, `packages/authoring-core/src/mesh-generation-v6d-adaptive-contour-constrainautor.ts:672`, `packages/authoring-core/src/mesh-generation-v6d-adaptive-contour-constrainautor.ts:1605`). Tests assert no duplicate stable IDs on the two-island case (`packages/authoring-core/src/mesh-generation.test.ts:2155`, `packages/authoring-core/src/mesh-generation.test.ts:4657`).
- Authoring-core owns generation; no editor/provenance surface work in Domain A: pass. The reviewed implementation imports authoring-core helpers plus type-only contracts/package-format types (`packages/authoring-core/src/mesh-generation-v6d-adaptive-contour-constrainautor.ts:1`, `packages/authoring-core/src/mesh-generation-v6d-adaptive-contour-constrainautor.ts:4`, `packages/authoring-core/src/mesh-generation-v6-alpha-islands.ts:1`). `git status --short -uall -- packages/package-format packages/runtime-core apps/runtime-player apps/editor packages/operation-core packages/validator-core pnpm-lock.yaml package.json pnpm-workspace.yaml packages/authoring-core/package.json packages/authoring-core/src/mesh-quality-metrics.ts` returned no changed files.
- No package-format schema, runtime export, atlas algorithm, renderer/runtime, lockfile, or dependency drift: pass. No changed files were present in the forbidden scopes above. `node scripts/check-dependencies.mjs` passed.
- Source organization is acceptable: pass with observation. The new helper has a focused raw-alpha-island responsibility. No `index.ts` or catch-all source file was introduced. `node scripts/check-source-organization.mjs` passed.
- Conditional scope was not used without justification: pass. The implementation report records `Conditional Scope Justification: none` (`discussion/implementation/waves/wave95/wave95-domain-a-authoring-core-multi-island-mesh-generation-report.md:178`), and forbidden/conditional source-scope status checks were empty.
- Implementation report includes required sections: pass. The report contains `Basis Coverage Self-Report`, `Deferred Basis Items`, and Loop 2 fix notes (`discussion/implementation/waves/wave95/wave95-domain-a-authoring-core-multi-island-mesh-generation-report.md:143`, `discussion/implementation/waves/wave95/wave95-domain-a-authoring-core-multi-island-mesh-generation-report.md:157`, `discussion/implementation/waves/wave95/wave95-domain-a-authoring-core-multi-island-mesh-generation-report.md:163`).

## evidence / tests inspected or run

- Inspected source implementation directly, especially raw-alpha detection/filtering, per-island isolated RGBA generation, global budget allocation, all-kept whole-drawable fallback, diagnostics, merge index offsets, stable ID scoping, and UV mapping.
- Inspected Wave95 tests directly:
  - two separated islands, disconnected topology, no cross-gap triangles, source-space UV ranges, deterministic output, stable IDs, and global budget diagnostics (`packages/authoring-core/src/mesh-generation.test.ts:2119`, `packages/authoring-core/src/mesh-generation.test.ts:2155`, `packages/authoring-core/src/mesh-generation.test.ts:2160`, `packages/authoring-core/src/mesh-generation.test.ts:2195`);
  - tiny noise skip with no geometry in noise bbox (`packages/authoring-core/src/mesh-generation.test.ts:2217`);
  - all-noise/no-valid fallback (`packages/authoring-core/src/mesh-generation.test.ts:2265`);
  - small-but-valid separated island retained (`packages/authoring-core/src/mesh-generation.test.ts:2323`);
  - helper assertions for connected components, cross-gap triangles, stable IDs, and UV ranges (`packages/authoring-core/src/mesh-generation.test.ts:4657`, `packages/authoring-core/src/mesh-generation.test.ts:4668`, `packages/authoring-core/src/mesh-generation.test.ts:4718`, `packages/authoring-core/src/mesh-generation.test.ts:4773`).
- Ran `pnpm.cmd exec vitest run packages/authoring-core/src/mesh-generation.test.ts`: initial sandbox run failed with `spawn EPERM` while loading Vite/esbuild; rerun with approved escalation passed, 76 tests.
- Ran `pnpm.cmd typecheck`: passed.
- Ran `node scripts/check-source-organization.mjs`: passed.
- Ran `node scripts/check-dependencies.mjs`: passed.
- Ran `git diff --check -- packages/authoring-core/src/mesh-generation-v6d-adaptive-contour-constrainautor.ts packages/authoring-core/src/mesh-generation.test.ts discussion/implementation/waves/wave95 discussion/implementation/reviews/wave95/wave95-domain-a-design-development-review.md`: passed with LF-to-CRLF warnings only for tracked diffs.
- Checked trailing whitespace in new/untracked helper/report files with `rg -n "[ \t]+$"`: no matches.
- Checked forbidden-scope status for package-format, runtime-core, runtime-player, editor, operation-core, validator-core, package manifests, lockfile, and `mesh-quality-metrics.ts`: no changed files.

## unresolved questions / user-decision points

None for Domain A design/development compliance.

Domain B still owns operation provenance / editor inspector surfacing and should decide whether to formalize `multiIslandDiagnostics` in the public TypeScript metrics interface.
