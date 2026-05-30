# Wave19 Domain G Rerun Completion: Texture Preview E2E And Persistence Smoke

- Target: `wave19-texture-preview-e2e-and-persistence-smoke-rerun`
- Status: `escalate`
- Date: 2026-05-31
- Orch-Sylph role: orchestration only; no source implementation edits
- Gnome implementation agent/context id: `019e7afb-d515-70a0-b181-75d820c4222a` (`Gnome the 53rd`)
- Review-Sylph agent/context id: `019e7b0a-165a-71d3-b8ed-e4dcac468656` (`Sylph the 54th`)
- Review artifact: [../../reviews/wave19/wave19-texture-preview-e2e-and-persistence-smoke-rerun-review.md](../../reviews/wave19/wave19-texture-preview-e2e-and-persistence-smoke-rerun-review.md)
- Gnome notes: [wave19-texture-preview-e2e-and-persistence-smoke-rerun-gnome-notes.md](wave19-texture-preview-e2e-and-persistence-smoke-rerun-gnome-notes.md)

## Verdict

`escalate`.

The deterministic data URL Source Intake path is now covered by e2e support and a strengthened preview oracle, but the full desktop/mobile Domain G smoke cannot pass within the rerun write scope. The remaining blocker is horizontal overflow caused by the long imported-source diagnostic that includes the valid data URL texture preview reference. Fixing that requires a narrow CSS or Source Intake diagnostic markup change, which is outside this rerun's allowed source scope.

Review-Sylph accepted the escalation after confirming the e2e-only truthfulness issue was fixed.

## Scope

Allowed source scope for Gnome was limited to:

- `apps/editor/e2e/**`
- `apps/editor/tests/**`
- `fixtures/e2e/**`
- narrow test id / aria tweaks in UI files only if needed for smoke
- discussion notes/reports

No production source implementation files were edited by this rerun.

## Files Changed

Source/e2e support:

- `apps/editor/e2e/source-intake-smoke.mjs`
- `apps/editor/e2e/smoke-checks.mjs`

Reports:

- `discussion/implementation/waves/wave19/wave19-texture-preview-e2e-and-persistence-smoke-rerun-gnome-notes.md`
- `discussion/implementation/reviews/wave19/wave19-texture-preview-e2e-and-persistence-smoke-rerun-review.md`
- `discussion/implementation/waves/wave19/wave19-texture-preview-e2e-and-persistence-smoke-rerun-completion.md`

Other Wave19 files already present in the worktree were treated as context only.

## Implementation Summary

Gnome updated the editor e2e smoke to use the now-unblocked deterministic data URL Source Intake path:

- Source Intake e2e fills a valid deterministic 1x1 PNG `data:image/png;base64,...` texture preview reference.
- Source Intake e2e fills explicit layer `textureId` and `targetPartId` fields and checks their accessible labels.
- Browser-local persistence assertions now inspect source manifest, provenance, rights, texture atlas, drawables, and operation log.
- The saved state assertion checks source-layer mapping, drawable `textureId`, drawable `partId`, texture atlas source asset/layer metadata, preview asset id, deterministic data URL reference kind/value, and import operation targets.
- Preview success now requires `data-texture-render="texture_pattern"`, `data-texture-status="resolved"`, expected texture/preview IDs, deterministic-data-url pattern image metadata, and zero non-deterministic `texture_pattern` shapes.
- The oracle now browser-decodes the exact SVG image `href` via `new Image()` and `decode()` or load/error fallback, requiring `loaded: true` and `1 x 1` dimensions.
- After browser load, the smoke re-shows the loaded drawable and rechecks the same texture-backed preview oracle.

The previous Review-Sylph `needs_changes` finding about `data:image/png;base64,A` was resolved.

## Verification

| Command / Check | Result | Notes |
|---|---|---|
| `node --check apps/editor/e2e/source-intake-smoke.mjs` | pass | Run by Gnome and Review-Sylph after the valid PNG fixture/oracle update. |
| `node --check apps/editor/e2e/smoke-checks.mjs` | pass | Run by Gnome and Review-Sylph after the valid PNG fixture/oracle update. |
| `pnpm.cmd test:e2e` | fail | Escalated run reached desktop texture pattern + browser image decode oracle, then failed on recorded `desktop post-source-intake` horizontal overflow. Earlier run with the shortest textual data URL reached desktop pass and failed mobile overflow, but that fixture was not image-decodable. |
| `pnpm.cmd typecheck` | pass | Reported by Gnome from escalated rerun before the e2e-only follow-up. |
| `pnpm.cmd run check:source` | pass | Reported by Gnome. |
| `git diff --check -- apps/editor/e2e/source-intake-smoke.mjs apps/editor/e2e/smoke-checks.mjs discussion/implementation/waves/wave19/wave19-texture-preview-e2e-and-persistence-smoke-rerun-gnome-notes.md` | pass | Run by Gnome and Review-Sylph; CRLF warnings only. |
| Independent PNG fixture check | pass | Review-Sylph confirmed PNG signature, 68 bytes, width `1`, height `1`. |

## Review Result

- Review-Sylph agent/context id: `019e7b0a-165a-71d3-b8ed-e4dcac468656` (`Sylph the 54th`)
- Review report: [../../reviews/wave19/wave19-texture-preview-e2e-and-persistence-smoke-rerun-review.md](../../reviews/wave19/wave19-texture-preview-e2e-and-persistence-smoke-rerun-review.md)
- Initial review verdict: `needs_changes`
- Final review verdict after Gnome fix: `pass`

Review-Sylph findings:

- The texture preview oracle no longer accepts a broken image payload.
- The remaining horizontal overflow is a valid blocker that requires source UI/CSS scope.
- Persistence and source relation assertions are sufficient for the current schema; direct drawable `sourceLayerId` is not present, so the relation is checked through mapped drawable IDs and texture/preview metadata.

## Escalation Reason

The valid data URL texture preview diagnostic is rendered as a long unbroken token, for example:

```text
splitPng.layerTexturePreview:l:data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=
```

That token causes horizontal overflow in the Source Intake imported-source area. The latest e2e run failed after the desktop texture preview/decode oracle with:

```text
desktop post-source-intake horizontal overflow ... expected 0
```

The earlier short invalid data URL avoided desktop overflow but could not serve as truthful texture rendering evidence. The valid PNG fixture is the correct e2e input, and it exposes a real layout issue.

Fixing the blocker likely requires one of:

- CSS wrapping for imported source diagnostics, likely under `apps/editor/src/styles/editor.css`.
- Source Intake imported diagnostics markup that allows long diagnostic tokens to wrap safely.

Those changes are production UI/layout changes, not e2e support or narrow test id/aria tweaks, so they require Undine authorization or a new/follow-up domain scope.

## Pass Evidence Status

Achieved or partially achieved:

- Source Intake form can submit a deterministic data URL texture preview reference in e2e support.
- Imported source handoff can proceed to createDrawable/generateMesh on the desktop path.
- Preview oracle observes a deterministic data URL `texture_pattern` and browser-decodable image payload.
- Save/load assertions were added for source layer / textureId / partId / preview relation.
- Accessible-name checks were extended for texture preview fields.

Not achieved:

- Full `pnpm.cmd test:e2e` pass.
- Desktop/mobile layout pass with the valid data URL diagnostic.
- Mobile save/load and post-load preview proof in the latest run, because desktop now fails first on the same long-diagnostic overflow.

## Orchestration Compliance

- Source implementation was delegated to Gnome `019e7afb-d515-70a0-b181-75d820c4222a`.
- Independent review was delegated to separate Review-Sylph `019e7b0a-165a-71d3-b8ed-e4dcac468656`.
- Orch-Sylph did not edit source implementation files.
- Orch-Sylph edited only `discussion/implementation/**` artifacts.
- Review-Sylph reviewed basis docs, current files/diff, verification results, and Gnome notes; it did not rely only on implementation summary.

## Remaining Risks

- Domain G cannot pass until the long imported-source diagnostic wraps without horizontal overflow, or the layout acceptance is intentionally relaxed.
- The current preview oracle checks browser decode of the exact SVG image `href`, not pixel-level screenshot/canvas output.
- The latest full e2e run did not reach mobile because desktop overflow now fails first with the valid PNG data URL.

## User-Decision Points For Undine

- Authorize a narrow layout fix in `apps/editor/src/styles/editor.css` or `apps/editor/src/ui/source-assets/source-intake-panel.ts` so long imported-source diagnostics wrap on desktop and mobile.
- Or explicitly relax the Domain G horizontal overflow acceptance, with the tradeoff that Wave19 basic layout evidence becomes weaker.
