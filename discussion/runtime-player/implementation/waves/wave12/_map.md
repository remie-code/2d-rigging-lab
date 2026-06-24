# Runtime Player Wave12 Report Map

> Live Controller Variant Switching implementation reports.

## Files

| Path | Status | Content |
|---|---|---|
| [wave12-final-integration-report.md](wave12-final-integration-report.md) | Pass | Final integration, docs alignment, clean review result, verification matrix, residual manual checks |

## Implementation Facts

- Control Window includes `Overview / Live Controller / Input / Mapping / Stage`.
- Live Controller lists Runtime Export Variant Groups when present.
- `singleSelect` groups keep exactly one active Variant; `multiToggle` groups allow zero or more active Variants.
- `Reset to Model Default` restores Runtime Export default active selections.
- Runtime visibility for new exports uses `drawable.baseVisible && variantVisibilityPredicate(activeSelection, drawableId)`.
- Legacy Runtime Exports without complete drawable `baseVisible` still load, but Variant switching is disabled with re-export guidance.
- Native Stage Window and OBS Browser Source use the same session active Variant selection.
- Browser Source reload/resync receives current active Variant selection.
- Browser Source receives sanitized active Variant selection only, not raw tracking/debug/calibration data.
- Look Forward, Center Model, and Stage Motion On/Off reuse existing ownership.
- Wave10 native local preview live rendering suspension remains effective.
- Active Variant selection is session-only and is not persisted.
- Runtime Export schema/materialization, authoring-core, package manifests, workspace manifest, and lockfile were not changed by Player Wave12.

## Remaining Manual Verification

- Load a new Runtime Export that includes Variants and drawable `baseVisible`.
- Open `Live Controller`.
- Switch expression/outfit Variants and toggle an accessory Variant where available.
- Confirm native Stage Window and OBS Browser Source show the same visible result.
- Click `Reset to Model Default`.
- Click `Look Forward` while input is live.
- Click `Center Model`.
- Toggle `Stage Motion` Off/On and confirm it matches Stage page behavior.
- Reload OBS Browser Source and confirm current session active Variant selection remains.
- Restart Runtime Player and confirm Variant selection resets to model defaults.
- Smoke-test a legacy export without `baseVisible` and confirm controls are disabled with re-export guidance.
