# Demo-safe Test Policy

> P1 policy for preflight tests that keep Streaming Demo Surface separate from the private implementation.

## 1. Purpose

Demo-safe tests prove that screenshots, videos, streams, proposal attachments, and demo UI surfaces show only rights-clean high-level results and do not expose private implementation details, forbidden claims, unsafe terms, or non-demo-safe assets.

This policy does not provide legal clearance. It defines preflight evidence for the project test gate.

## 2. Basis

### Official Facts

No external official facts are used as test oracles in this policy.

### Repository Facts

- `AC-MVP-015` requires demo-safe capture separated from private implementation.
- `AC-RIGHTS-004` requires demo/proposal hygiene rules.
- `streaming-demo-policy.md` defines allowed and avoided surfaces for Streaming Demo Surface.
- `live2d-feature-proposal-template.md` separates feature proposals from compatibility, SDK/Core replacement, and existing model analysis.
- `test-strategy.md` requires demo-safe preflight reports as evidence.

### Assumptions

- Demo preflight can scan a finite set of capture surfaces, UI text, filenames, visible logs, AI output, and metadata before capture.
- Some non-affiliation disclaimers may mention forbidden ecosystem names in an allowed context.

## 3. Policy Decisions

- `demo-preflight-report.json` is the required artifact for demo-safe tests.
- Demo-safe tests are context-aware. A term in an approved non-affiliation disclaimer can be allowed, while the same term in a feature claim, file tree, debug panel, operation log, or UI label can fail.
- Private implementation details, internal schema, source paths, terminal output, private research archive, and solver details are forbidden on demo capture surfaces.
- Dynamics may be shown only as high-level secondary motion, driver/output UI, and visible result. Solver equations, internal state structure, and compatibility comparisons are forbidden.
- Demo-safe preflight must be paired with rights/provenance evidence for displayed assets.
- Demo/proposal surfaces must not use Cubism formats, SDK/Core, Viewer matching, Physics compatibility, existing Cubism models, official samples, third-party Live2D models, nizima materials, or commercial models as evidence.

## 4. Demo Preflight Report

| Field | Required | Meaning |
|-------|----------|---------|
| `schemaVersion` | yes | Literal policy version, currently `demo-preflight-report-v1`. |
| `reportId` | yes | Stable ID without spaces. |
| `testId` | yes | Test ID without spaces. |
| `fixtureId` | yes | Fixture ID without spaces. |
| `scanProfile` | yes | Profile such as `demo-safe-v1` or `proposal-package-v1`. |
| `captureSurfaceId` | yes | Surface being checked. |
| `sourceArtifactRefs` | yes | Captures, UI snapshots, text dumps, or proposal artifacts scanned. |
| `checkedSurfaces` | yes | Surface inventory and status. |
| `unsafeTermFindings` | yes | Context-aware forbidden or warning terms. |
| `forbiddenSurfaceFindings` | yes | Visible forbidden panels, logs, paths, or internal details. |
| `rightsStatus` | yes | Aggregate `cleared`, `needs_review`, or `blocked`. |
| `rightsProvenanceReportRef` | yes | Rights/provenance report for displayed assets. |
| `redactedFields` | yes | Fields hidden before capture. |
| `hiddenFields` | yes | Fields that must not appear on the surface. |
| `recommendedDisclaimer` | yes | Disclaimer text or reference used for the capture. |
| `allowedToCapture` | yes | Boolean final preflight result. |
| `status` | yes | `pass`, `fail`, or `needs_review`. |

## 5. Surface Inventory

| Surface | Demo-safe rule |
|---------|----------------|
| `privateViewerScene` | Allowed when assets are cleared and no internal details are visible. |
| `editorHighLevelUi` | Allowed for general editing flow, stable public-facing labels, and high-level validation/AI summaries. |
| `aiSummaryPanel` | Allowed when output is metadata-based, no legal certainty claim, and no forbidden conversion/compatibility claim. |
| `validatorSummaryPanel` | Allowed only as redacted summary. Internal paths, schema, and private package details must be hidden. |
| `dynamicsHighLevelPanel` | Allowed for driver/output values and visible secondary motion result. Solver formula and internal state are hidden. |
| `fileExplorer` | Forbidden in demo capture. |
| `debugPanel` | Forbidden unless explicitly redacted to high-level demo fields. |
| `terminal` | Forbidden in demo capture. |
| `privateResearchArchive` | Forbidden in demo capture. |
| `sourcePathDisplay` | Forbidden in demo capture. |
| `internalSchemaView` | Forbidden in demo capture. |

## 6. Forbidden And Context-restricted Terms

The preflight scanner classifies terms by surface and context.

### Fail on Demo UI, Capture, File Tree, Logs, or AI Feature Claims

- `.moc3`
- `.cmo3`
- `model3.json`
- `physics3.json`
- `motion3.json`
- `pose3.json`
- `Cubism SDK`
- `Cubism Core`
- `Cubism Physics`
- `Cubism Viewer`
- `Cubism Editor Physics`
- `Live2D compatible`
- `Cubism compatible`
- `Live2D互換`
- `Cubism互換`
- `Cubism replacement`
- `Live2D代替`
- `format import`
- `format export`
- `existing model import`
- `SDK/Core replacement`
- `VTube Studio compatibility`

### Needs Review on Demo UI or Proposal Material

- `Glue`
- `ArtMesh`
- `Deformer`
- `official sample`
- `third-party model`
- `nizima`
- `commercial model`
- `legal safe`
- `patent clear`
- `rights cleared` when not backed by metadata

### Allowed Only in Approved Disclaimer or Non-goal Context

- `Live2D`
- `Cubism`
- `not compatible with Cubism`
- `does not read, write, convert, or reconstruct Cubism model formats`

Approved disclaimers must be short, non-promotional, and must not appear next to feature claims that imply compatibility.

## 7. Required Checks

| Check ID | Gate | Failure condition |
|----------|------|-------------------|
| `demo.preflight.reportRequired` | `mvp-blocking` | Capture/proposal artifact has no preflight report. |
| `demo.surface.forbiddenVisible` | `mvp-blocking` | Forbidden surface such as terminal, file explorer, internal schema, or private research archive is visible. |
| `demo.term.forbiddenVisible` | `mvp-blocking` | Fail-class term appears outside an approved disclaimer/non-goal context. |
| `demo.rights.blockedAssetVisible` | `mvp-blocking` | Blocked or unknown-rights asset appears in capture. |
| `demo.redaction.required` | `p1-blocking` | Source paths, internal schema, or private package details are visible. |
| `demo.dynamics.highLevelOnly` | `mvp-blocking` | Dynamics demo reveals solver formula, internal state structure, or compatibility comparison. |
| `demo.proposal.trackSeparated` | `p1-blocking` | Proposal material implies the private prototype is a compatibility implementation or SDK/Core replacement. |
| `demo.disclaimer.present` | `p1-blocking` | Capture/proposal lacks required private prototype and non-compatibility disclaimer. |

## 8. Test Cases

| Test ID | Fixture ID | Required result |
|---------|------------|-----------------|
| `TC-DEMO-001-PREFLIGHT-PASS` | `demo-safe-viewer-capture` | Preflight passes with cleared assets, redacted UI, and disclaimer. |
| `TC-DEMO-002-UNSAFE-TERM` | `demo-unsafe-cubism-term` | Forbidden term is detected outside disclaimer context and capture is blocked. |
| `TC-DEMO-003-FORBIDDEN-SURFACE` | `demo-unsafe-internal-name` | File path, schema, debug, or private research surface blocks capture. |
| `TC-DEMO-004-RIGHTS-BLOCK` | `rights-provenance-missing` | Missing or blocked rights metadata prevents capture. |
| `TC-DEMO-005-REDACTION` | `demo-safe-viewer-capture` | Redacted fields are hidden and recorded. |
| `TC-DEMO-006-DYNAMICS-HIGH-LEVEL` | `demo-safe-dynamics-capture` | Dynamics capture shows high-level result only. |
| `TC-DEMO-007-PROPOSAL-SEPARATION` | `demo-safe-dynamics-capture` | Proposal package avoids compatibility, SDK/Core replacement, and internal implementation claims. |

## 9. Preflight Flow

1. Collect source capture artifacts, UI text, visible filenames, AI output, validator summary, and proposal text.
2. Load rights/provenance report for all displayed assets.
3. Scan checked surfaces for forbidden panels, debug data, source paths, and internal schema.
4. Scan terms using context-aware allowlist rules.
5. Verify required redactions and hidden fields.
6. Attach or reference the approved disclaimer.
7. Return `allowedToCapture: true` only when all blocking checks pass.

## 10. Pass / Fail Rules

- `pass`: all blocking checks pass, rights status is `cleared`, and disclaimer/redaction evidence is present.
- `needs_review`: only warning-class terms or incomplete non-blocking metadata remain, with capture held or marked review-only.
- `fail`: any forbidden surface, forbidden term, blocked asset, missing preflight, hidden compatibility oracle, or unsafe rights claim appears.

## 11. Open Questions

| Question | Impact | Status |
|----------|--------|--------|
| Whether disclaimer is always visible in UI or attached in stream description | can-defer | Preflight records the chosen location. |
| Minimum capture scene for first public-facing demo | can-defer | This policy defines checks, not content selection. |
| Whether proposal package scans share the same term thresholds as demo scans | can-defer | `proposal-package-v1` may later tune warnings. |
