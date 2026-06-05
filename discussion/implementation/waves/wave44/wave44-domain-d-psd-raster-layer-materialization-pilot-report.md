# Wave44 Domain D Report: PSD Raster Layer Materialization Pilot

> Target: `wave44-psd-raster-layer-materialization-pilot`
> Drafted by: Gnome implementation agent
> Status: implementation complete, pending independent review

## Verdict

`pass`

Domain D added a Node-first selected layer materialization pilot that reads `test_data/sample_model.psd` by explicit path, resolves `psd:root/layer[0]` / `headwear`, calls `Layer.composite(false, false)`, verifies deterministic raw RGBA bytes, and writes compact private/local materialization evidence JSON.

The script imports `@webtoon/psd` only from `scripts/**`. No production package source under `packages/**` and no Editor source under `apps/**` was changed or given a direct parser import.

## Files Changed

- `scripts/wave44-psd-layer-materialization.mjs`
- `test_data/derived/wave44/psd-layer-materialization/headwear.raw-rgba.materialization-evidence.json`
- `discussion/implementation/waves/wave44/wave44-domain-d-psd-raster-layer-materialization-pilot-report.md`

## Materialization Command

```text
node scripts/wave44-psd-layer-materialization.mjs --psd test_data/sample_model.psd --out test_data/derived/wave44/psd-layer-materialization/headwear.raw-rgba.materialization-evidence.json
```

Result: passed.

The script asserts the known sample PSD byte length and SHA-256 before parsing, asserts the selected layer reference/name, and asserts the raw RGBA output byte length and SHA-256 before writing evidence.

## Materialization Evidence Summary

| Field | Value |
|---|---|
| Evidence schema | `wave44-psd-layer-materialization-pilot-v1` wrapper with `psd-layer-materialization-evidence-v1` materialization evidence |
| Source PSD | `test_data/sample_model.psd` |
| Source byteLength | `22406225` |
| Source SHA-256 | `44ab43238cd2b2af2fb0ce6a7b5073a60e332d03da7666ea274c02e0462294b5` |
| Parser | `@webtoon/psd@0.4.0` |
| Parser runtime | `node` |
| Source layer ref | `psd:root/layer[0]` |
| Source layer name | `headwear` |
| Bounds | left `808`, top `92`, width `400`, height `288`, right `1208`, bottom `380` |
| Media type | `application/vnd.private-2d-rigging-lab.raw-rgba` |
| Derived byteLength | `460800` |
| Derived SHA-256 | `671e6a363745b1ce2e8d29c1a63438170fe9511c8884ea42298cf9b8886e5c1a` |
| Extraction method | `Layer.composite(false, false)` |
| Extraction options | `effect=false`, `composed=false`, `outputEncoding=raw-rgba`, `rawChannelOrder=rgba`, `bytesPersisted=false` |
| Privacy label | `privateLocalFixture` |
| Public distribution | `notPublicDistributable` |

## Persisted Derived Artifacts

- Persisted compact evidence JSON:
  - `test_data/derived/wave44/psd-layer-materialization/headwear.raw-rgba.materialization-evidence.json`
- Did not persist raw RGBA bytes or visual image bytes.
- The evidence records the source PSD hash/length and marks the fixture as private/local and not a public demo asset.

## Unsupported / Not-Evaluated Boundary

The evidence explicitly keeps these outside Domain D:

- Photoshop-style final compositing: `notEvaluated`
- Renderer pixel oracle: `notEvaluated`
- Texture sampling correctness: `notEvaluated`
- Public demo distribution: `notSupported`

No claim is made that this raw selected-layer materialization matches Photoshop final compositing or a renderer output.

## Verification Performed

| Command/check | Result |
|---|---|
| `node scripts/wave44-psd-layer-materialization.mjs --psd test_data/sample_model.psd --out test_data/derived/wave44/psd-layer-materialization/headwear.raw-rgba.materialization-evidence.json` | passed |
| `pnpm.cmd smoke:wave44:psd-parser` | passed |
| `pnpm.cmd typecheck` | passed |
| `pnpm.cmd run check:source` | passed |
| `pnpm.cmd run check:deps` | passed |
| fixed parser import search for `from "@webtoon/psd"`, `import("@webtoon/psd")`, `from "ag-psd"`, and `import("ag-psd")` under `packages apps` | no matches |
| `git diff --check --no-index -- NUL scripts/wave44-psd-layer-materialization.mjs` | no whitespace findings; Git reported LF-to-CRLF working-copy warning only and exited nonzero because this is a new file no-index comparison |
| `git diff --check --no-index -- NUL test_data/derived/wave44/psd-layer-materialization/headwear.raw-rgba.materialization-evidence.json` | no whitespace findings; Git reported LF-to-CRLF working-copy warning only and exited nonzero because this is a new file no-index comparison |
| `git diff --check --no-index -- NUL discussion/implementation/waves/wave44/wave44-domain-d-psd-raster-layer-materialization-pilot-report.md` | no whitespace findings; Git reported LF-to-CRLF working-copy warning only and exited nonzero because this is a new file no-index comparison |

## Remaining Issues

- Domain E still owns validator/Product Preflight diagnostics for parsed PSD/materialization evidence.
- Domain F may later register this private evidence fixture in broader Wave44 regression/traceability artifacts.

## User-Decision Points

- None required for Domain D.
- Future user decision remains required before any `test_data/sample_model.psd` derived visual or raw bytes are treated as public distributable demo material.

## Early Escape

No early escape trigger was hit.
