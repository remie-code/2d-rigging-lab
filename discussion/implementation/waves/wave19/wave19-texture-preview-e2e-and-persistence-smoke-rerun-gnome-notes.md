# Wave19 Domain G Rerun Gnome Notes

- Target: `wave19-texture-preview-e2e-and-persistence-smoke-rerun`
- Status: `escalate`
- Date: 2026-05-31
- Agent/context id: not exposed in this subagent context

## Summary

Domain G e2e support was updated to use the now-accepted deterministic
`data:image/(png|jpeg|webp);base64,...` Source Intake path instead of the
package-local fallback path.

Needs-fix follow-up addressed Review-Sylph's broken-payload oracle finding:

- The deterministic data URL fixture now uses a valid tiny 1x1 PNG.
- The texture preview oracle now loads the same SVG image `href` through
  `new Image()` and `decode()` or load/error fallback inside the browser.
- `textureEvidence` includes `imageDecode.loaded`, `width`, `height`, and
  `reason`, and the expected success requires `loaded: true`, `width: 1`,
  and `height: 1`.

The desktop browser smoke reaches:

Source Intake form -> deterministic data URL texture preview reference ->
`importSplitPngSourceAsset` -> imported source handoff -> `createDrawable` ->
`generateMesh` -> SVG preview texture pattern -> browser image decode pass.

The rerun cannot be marked pass because the mobile viewport fails the existing
horizontal overflow check after Source Intake commit. With the valid tiny PNG
data URL, the same overflow is now visible in the desktop viewport too. The
e2e harness records that overflow and throws it only after the desktop texture
preview/decode oracle has run, so the remaining failure is still the layout
blocker rather than texture payload validity.

## Files Changed

- `apps/editor/e2e/source-intake-smoke.mjs`
- `apps/editor/e2e/smoke-checks.mjs`
- `discussion/implementation/waves/wave19/wave19-texture-preview-e2e-and-persistence-smoke-rerun-gnome-notes.md`

## E2E Assertions Added

- Source Intake form now fills a deterministic data URL texture preview reference.
- Source Intake form now fills an explicit layer `textureId` and `targetPartId`.
- Source Intake accessible-name checks now include:
  - Texture preview reference
  - Texture ID
  - Target part ID
- Saved browser-local package state now checks:
  - imported source mapping to the created drawable
  - drawable `textureId`
  - drawable `partId`
  - texture atlas file
  - texture atlas source asset / source layer relation
  - preview asset id
  - deterministic data URL reference kind and value
  - import operation targets include source asset, source layer, and texture id
- Preview success now requires:
  - `data-texture-render="texture_pattern"`
  - `data-texture-status="resolved"`
  - expected `data-texture-id`
  - expected `data-texture-preview-asset-id`
  - SVG pattern image with `data-texture-reference-kind="deterministic-data-url-v1"`
  - no `texture_pattern` shape without a deterministic data URL image reference
  - browser image decode success for the exact SVG image `href`
  - decoded image dimensions `1 x 1`
- After browser load, the smoke re-shows the loaded drawable and rechecks the same
  texture-backed preview oracle.

## Verification

| Command | Result | Notes |
|---|---|---|
| `node --check apps/editor/e2e/source-intake-smoke.mjs` | pass | Rerun after valid PNG fixture update. |
| `node --check apps/editor/e2e/smoke-checks.mjs` | pass | Rerun after browser image decode oracle update. |
| `pnpm.cmd install` | incomplete in sandbox | Network metadata fetch failed in sandbox. |
| `pnpm.cmd install` escalated | pass | Reported lockfile up to date, but did not repair missing Vite dependency. |
| `pnpm.cmd install --force` escalated | pass | Rebuilt/relinked `node_modules`; required for Vite e2e. |
| `pnpm.cmd test:e2e` in sandbox | fail | Sandbox could not read pnpm node_modules files. |
| `pnpm.cmd test:e2e` escalated | fail | Latest rerun reached the desktop texture pattern + image decode oracle, then failed on the recorded `desktop post-source-intake` horizontal overflow before mobile. |
| `pnpm.cmd typecheck` in sandbox | fail | Sandbox `EPERM` reading TypeScript. |
| `pnpm.cmd typecheck` escalated | pass | Root and editor typecheck passed. |
| `pnpm.cmd run check:source` | pass | Source organization guard passed. |
| `git diff --check -- apps/editor/e2e/source-intake-smoke.mjs apps/editor/e2e/smoke-checks.mjs discussion/implementation/waves/wave19` | pass | CRLF warnings only. |

## Blocker

E2E fails after Source Intake commit once the deterministic fixture is a valid
tiny PNG data URL:

```text
desktop post-source-intake horizontal overflow was {"label":"desktop post-source-intake","count":54,"viewportWidth":1265,"documentScrollWidth":1312,...}; expected 0.
```

The representative overflowing elements are inside `sourceIntake.panel`, with
left/right bounds like `left=43`, `right=1312`, `width=1269` for a desktop
viewport. The likely cause is the imported source diagnostics text containing
the unbroken texture preview diagnostic with the valid PNG data URL:

```text
splitPng.layerTexturePreview:l:data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=
```

The earlier shortest textual data URL avoided desktop overflow but was not a
proved decodable image. The valid tiny PNG fixes that review finding and
exposes the same underlying layout problem more broadly.

## Escalation Reason

Passing Domain G now appears to require a small UI/CSS layout fix so imported
source diagnostics and/or source intake panel content can wrap within a mobile
viewport. That is outside this rerun's allowed source write scope, which permits
e2e/tests/fixtures and only narrow test id / aria tweaks in UI files.

The preview oracle itself is not flaky and browser storage preserved the
deterministic data URL metadata on the desktop path. The current desktop rerun
proves the valid PNG payload is browser-decodable before failing on the deferred
overflow assertion.

## User Decision Points For Orch-Sylph / Undine

- Allow a narrow layout fix in `apps/editor/src/styles/editor.css` or the
  Source Intake imported diagnostics markup so long texture diagnostics wrap on
  mobile.
- Alternatively, relax the Domain G mobile layout acceptance criteria, though
  that would weaken the stated basic layout evidence.
