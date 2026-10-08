# Runtime Player Wave2 Final Clean Integration Review

Verdict: `pass`

Target: `runtime-player-wave2-final-integration-clean-review`  
Date: 2026-06-22

## Scope / Basis Inspected

- `discussion/runtime-player/implementation/orchestration/player-wave2-plan.md`
- Domain A/B completion reports under `discussion/runtime-player/implementation/waves/wave2/`
- Domain A/B review reports under `discussion/runtime-player/implementation/reviews/wave2/`
- `discussion/runtime-player/screens/initial-runtime-player-screen.md`
- `discussion/runtime-player/architecture/technology-stack-decision.md`
- `discussion/runtime-player/architecture/runtime-player-development-policy.md`
- `discussion/development_convention/source-file-organization-policy.md`
- Runtime Player source and tests under `apps/runtime-player/src/**`
- `apps/runtime-player/package.json`
- `pnpm-lock.yaml`

## Findings

No blocking or needs-fix findings.

### Info: GUI screenshot smoke is still absent

Automated verification covers typecheck, unit tests, source organization,
dependency policy, diff whitespace, and source-level boundary checks. It does
not prove an Electron Stage screenshot is nonblank, transparent, centered, or
visually correct for the user's real Runtime Export. This is acceptable for
Wave2 closure because manual verification steps are explicit, but it remains a
real residual risk.

### Info: Large IPC payload size is unmeasured

`RuntimeExportLoadedPayload` includes manifest/model/atlas DTOs plus raw RGBA
texture bytes, and main sends the loaded payload to Stage over IPC. This keeps
the renderer away from filesystem access and is acceptable for Wave2, but the
largest real export may expose serialization or copy cost. Manual verification
should observe load responsiveness.

### Info: Runtime Export UV-space label mismatch remains documented

Domain B preserves numeric `model.meshes[].atlasUvs` in `RenderMesh.uvs`, but
render-core currently labels the UV space as `layer-local-top-left-0-1-v1`.
This does not block Wave2 because the numeric atlas UVs are used directly, but
the naming mismatch should be resolved before future code treats the label as a
semantic oracle.

## Compliance Notes

- Domain A and Domain B reports exist and both record final `pass`.
- All required review lanes exist. Domain A's initial findings were fixed and
  the post-install typecheck follow-up review records `pass`; Domain B's three
  review lanes record `pass`.
- Runtime Export validity is based on `runtime-export.json` and parsed artifact
  contents, not the selected directory name or suffix.
- Main owns native directory picker and filesystem reads. Preload exposes typed
  methods. Control requests open/load and displays status/errors. Stage receives
  payload/status and renders.
- Runtime Export is read as an immutable external artifact; production code does
  not write to the selected directory.
- Stage renders through the existing render-core/render-webgl2 path on a
  transparent canvas and has no visible setup/debug UI.
- Wave2 did not add iFacialMocap input receiving, parameter runtime,
  parameter sliders, dynamics progression, previous export restore, recent
  export list, or Runtime Export generation/mutation.
- Control loaded/error status is useful: it includes status, directory, model
  display name, texture dimensions, drawable/mesh counts, and readable error
  details.
- Stage clears on loading/error/empty status, so an invalid load after a
  successful load does not keep the previous model visible.

## Verification

Passed:

- `pnpm.cmd --filter @private-2d-rigging-lab/runtime-player typecheck`
- `pnpm.cmd --filter @private-2d-rigging-lab/runtime-player test:unit`
  - Sandboxed run failed with Vitest/esbuild `spawn EPERM`.
  - Elevated rerun passed: 6 test files / 30 tests.
- `node scripts/check-source-organization.mjs`
- `node scripts/check-dependencies.mjs`
- `git diff --check`
  - Exit code 0 with LF-to-CRLF working-copy warnings only.

Inspected:

- Runtime Player renderer forbidden import searches.
- Stage UI leak searches for setup/debug/placeholder controls.
- Runtime Export loader source for read-only validation, artifact path
  containment, digest/byte-length checks, and no directory-name oracle.

## Remaining Risks / User Verification

Manual command:

```powershell
pnpm.cmd --filter @private-2d-rigging-lab/runtime-player dev
```

Checklist:

1. Open a real Runtime Export directory containing `runtime-export.json`.
2. Confirm the directory name is arbitrary and not required to end with
   `.runtime-export`.
3. Confirm Control shows loaded status, path, model name, texture dimensions,
   and drawable/mesh counts.
4. Confirm Stage shows only the model on transparent background.
5. Confirm Stage has no placeholder, controls, parameter sliders, setup UI, or
   debug text.
6. Resize Stage and confirm the model remains centered/fitted.
7. Open an invalid directory after a successful load and confirm Stage clears
   while Control shows a readable error.
8. Visually check masked/clipped areas and alpha edges.
9. Note load time/responsiveness for large real exports to evaluate the current
   raw RGBA IPC payload contract.
