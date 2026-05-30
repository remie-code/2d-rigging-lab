# Wave19 Domain G Rerun Review: Texture Preview E2E And Persistence Smoke

- Target: `wave19-texture-preview-e2e-and-persistence-smoke-rerun`
- Verdict: `pass`
- Review-Sylph: clean re-review
- Gnome implementation agent/context id from parent: `019e7afb-d515-70a0-b181-75d820c4222a` (`Gnome the 53rd`)
- Date: 2026-05-31

## Verdict

`pass`.

The previous `needs_changes` finding is fixed. The e2e fixture now uses a valid deterministic 1x1 PNG data URL, and the preview oracle proves browser image decode success for the exact SVG image `href` before accepting `texture_pattern` evidence.

The remaining e2e failure is horizontal overflow from the long imported-source diagnostic containing the valid data URL. Fixing that requires CSS or Source Intake diagnostic markup changes, not e2e-only changes or narrow test id/aria tweaks, so escalation is appropriate for this Domain G rerun.

## Findings

### Resolved: texture preview oracle no longer accepts a broken image payload

- Evidence: `apps/editor/e2e/source-intake-smoke.mjs:10-11` now uses a valid deterministic PNG data URL instead of `data:image/png;base64,A`.
- Evidence: `apps/editor/e2e/smoke-checks.mjs:356-390` reads the SVG pattern image `href`, counts texture-pattern shapes, excludes non-deterministic `texture_pattern` shapes, and includes `imageDecode` in the returned evidence.
- Evidence: `apps/editor/e2e/smoke-checks.mjs:393-430` loads the exact `href` with browser `new Image()` and `decode()` or load/error fallback.
- Evidence: `apps/editor/e2e/smoke-checks.mjs:439-454` requires `imageDecode: { loaded: true, width: 1, height: 1, reason: null }`.
- Independent check: the fixture data decodes as PNG bytes with signature `89-50-4E-47-0D-0A-1A-0A`, width `1`, height `1`.

This satisfies the requested e2e-only fix. It still does not prove full visual paint pixel output, but it is no longer a DOM-attribute-only oracle and is sufficient for the current SVG-pattern smoke.

### Accepted blocker: horizontal overflow requires source UI/CSS scope

- Evidence: `apps/editor/e2e/smoke-checks.mjs:71-82` records post-source-intake overflow before createDrawable, runs the texture/decode oracle, then asserts the recorded overflow evidence. The layout failure is not hidden.
- Evidence: `apps/editor/e2e/smoke-checks.mjs:959-1003` reports document and element overflow details through `readHorizontalOverflow` / `assertNoHorizontalOverflowEvidence`.
- Evidence: Gnome notes record the current failure as `desktop post-source-intake` overflow with the valid PNG diagnostic token at `discussion/implementation/waves/wave19/wave19-texture-preview-e2e-and-persistence-smoke-rerun-gnome-notes.md:89-107`.
- Evidence: imported source diagnostics are joined into one long text label at `apps/editor/src/editor-state/source-intake-view-model.ts:147-148` and rendered as paragraph text at `apps/editor/src/ui/source-assets/source-intake-panel.ts:117-119`.

The remaining fix is likely a narrow wrap/layout fix in `apps/editor/src/styles/editor.css` or Source Intake imported diagnostics markup. That is outside the rerun write scope, which permits `apps/editor/e2e/**`, `apps/editor/tests/**`, `fixtures/e2e/**`, and narrow test id/aria tweaks only.

### No blocking issue: persistence and source relation assertions are sufficient

- Evidence: `apps/editor/e2e/source-intake-smoke.mjs:87-152` reads saved source manifest, provenance, rights, texture atlas, drawables, and operation log from browser-local package state.
- Evidence: `apps/editor/e2e/source-intake-smoke.mjs:177-208` expects mapped drawable IDs, drawable `textureId`, drawable `partId`, texture atlas schema/file path, texture source asset/layer, preview asset ID, deterministic data URL reference kind/value, preview source asset/layer, and import operation targets.
- Evidence: `apps/editor/e2e/smoke-checks.mjs:347-353` re-shows the loaded drawable and rechecks the same texture-backed preview oracle after reload.

Drawable files do not currently store `sourceLayerId` directly; the source-layer relation is checked through source manifest `mappedDrawableIds` plus texture/preview source-layer metadata.

## Verification Reviewed / Performed

- Reviewed the updated diffs for `apps/editor/e2e/source-intake-smoke.mjs`, `apps/editor/e2e/smoke-checks.mjs`, and `discussion/implementation/waves/wave19/wave19-texture-preview-e2e-and-persistence-smoke-rerun-gnome-notes.md`.
- Performed `node --check apps/editor/e2e/source-intake-smoke.mjs`: pass.
- Performed `node --check apps/editor/e2e/smoke-checks.mjs`: pass.
- Performed `git diff --check -- apps/editor/e2e/source-intake-smoke.mjs apps/editor/e2e/smoke-checks.mjs discussion/implementation/waves/wave19/wave19-texture-preview-e2e-and-persistence-smoke-rerun-gnome-notes.md`: pass, CRLF warnings only.
- Performed an independent PNG header/dimension check on the fixture data URL: 68 bytes, PNG signature, width 1, height 1.
- Reviewed Gnome-reported verification: escalated `pnpm.cmd test:e2e` reaches desktop texture pattern + image decode oracle, then fails on recorded `desktop post-source-intake` horizontal overflow; node syntax checks and diff check pass. I did not rerun full e2e in this review.

## User-Decision Points For Undine

- Authorize a narrow layout fix in `apps/editor/src/styles/editor.css` or `apps/editor/src/ui/source-assets/source-intake-panel.ts` so long imported-source diagnostics wrap on desktop and mobile.
- Alternatively, explicitly relax the Domain G horizontal overflow acceptance, though that would weaken the Wave19 basic layout evidence.

## Remaining Risks

- Domain G still cannot pass full desktop/mobile e2e until the imported-source diagnostics overflow is fixed or the layout acceptance is intentionally changed.
- Mobile no longer reaches later save/load and post-load checks in the reported run because desktop now fails first on the same underlying long-diagnostic overflow.
- The preview oracle verifies browser decode of the exact SVG image `href`, not pixel-level rendered output. That is acceptable for this smoke but remains less strong than screenshot/canvas pixel verification.
- No source organization issue was found in the touched rerun files; production source files were not modified by this rerun.
