# Workspace Activity Refresh — Expo / Public Surfaces / Research Archives

基準日: 2026-08-08 (Asia/Tokyo)。現在の HEAD は `af5839452f0968a005cb6cd13c62b714aa4e6d4e`（`docs: refresh discussion maps`）。
この報告では `discussion/reports/workspace-activity-refresh/audit-contract.md`、`discussion/_conventions.md`、`discussion/_map.md` を先に読み、外部検索は行わず、リポジトリ内の map、成果物、source、Git履歴、read-only 検証だけを照合した。採択・公開許諾などの外部状態は `external-unverified` として扱う。

## 1. Scope / inspected entry points

### Map entry points

- `discussion/expo/_map.md`
- `discussion/expo/genai-expo-2026/_map.md`
- `discussion/demo/_map.md`
- `discussion/proposal/_map.md`
- `discussion/reports/_map.md`
- `discussion/reports/cmo3-moc3-format-spec/_map.md`
- `discussion/reports/cubism-sdk-runtime-structure/_map.md`
- `discussion/reports/deformer-structure-technology/_map.md`
- `discussion/reports/viewer-preview-reference/_map.md`
- `discussion/reports/runtime-evaluation-semantics-reference/_map.md`
- `discussion/reports/rights-risk-cleanup/_map.md`
- `discussion/reports/editor-render-performance/_map.md`
- `discussion/reports/psd-import-fidelity/_map.md`

監査生成物 `discussion/reports/map-freshness-audit/**` は、workspace-activity の外部提示・archive状態を照合するために参照したが、map種類の集計対象からは除外した。

### Artifacts / policy / history inspected

- Expo: `poster-design.md`, `sheet-plan.md`, `source-facts.md`, `judgment-and-layers.md`, `sheets/*.html`, `out/*.pdf`, `assets/*.png`
- Surface boundaries: `discussion/demo/streaming-demo-policy.md`, `discussion/proposal/live2d-feature-proposal-template.md`
- Rights/preflight policy: `discussion/development_convention/demo-rights-ip-policy.md`, `discussion/tests/policies/demo-safe-test-policy.md`, `discussion/tests/policies/rights-provenance-test-design.md`
- Archive boundary: `discussion/reports/rights-risk-cleanup/cleanup-report.md`, report child maps and current-owner table in `discussion/reports/_map.md`
- Git history: Expo commits `a3335f1`, `0a89c45`, `1ed12b2`, `cd693ea`, `3c3669e`; current map refresh `af58394`

## 2. Executive summary

1. Expo repository output is complete at the file/format level: six live HTML sheets and six corresponding A2 one-page PDFs exist. Each HTML contains A2 CSS dimensions and each PDF has one `/Page` token with MediaBox `0 0 1191.12 1684.08` (A2-equivalent points).
2. The Expo map correctly records completion, but acceptance remains a workbench-recorded waiting state and is not externally verified. No acceptance notice, proof-print result, or public permission record is present in the repository.
3. The post-acceptance proof print remains blocked on that external state; the documented checks are approximately 64 dpi for panel ③ and 88 dpi for panel ② (`poster-design.md:210-212`).
4. Expo, Streaming Demo Surface, Live2D Feature Proposal, and Future Public Clean Subset are separate tracks (`discussion/_conventions.md:192-203`, `discussion/concept/modified_concept.md:46-49`). Expo is an event artifact, not the Demo policy or a proposal package.
5. Streaming Demo and Proposal maps/policies are current as policy indexes, but their operational gates are not closed: rights-clean fixture/capture selection, preflight evidence, final disclaimer placement, first proposal target, and proposal review remain open (`discussion/demo/_map.md:20-30`, `discussion/proposal/_map.md:20-31`). No generated demo/proposal preflight artifacts are present under `generated/demo`, `generated/rights`, or `generated/proposal`.
6. Rights/provenance policy requires metadata, forbidden-term scan, redaction, and human review before capture/publication/proposal export (`demo-rights-ip-policy.md:70-170`, `:346-427`). Expo assets are fourteen PNGs with no rights/provenance sidecar or Expo-local manifest; `sheet-plan.md:95` still marks display rights as unresolved.
7. Research report maps now distinguish historical evidence from current owners. Cubism/SDK/deformer/viewer/runtime reports are intentionally historical; `rights-risk-cleanup` is the current legal/scope gate; current performance/runtime/design/PSD owners are linked from `reports/_map.md:15-26,38-45`.
8. A stale browser-title and historical headers remain outside this report's write scope: `sheets/04-ai-builds-body.html:2` still says the superseded title, `poster-design.md:3` still says physical production is not started, and `sheet-plan.md:3` still calls sheet contents unagreed while its progress table says all six PDFs are complete. These are metadata/history inconsistencies, not evidence that the six files are absent.

## 3. What was built or investigated

### Expo output set

| Panel | HTML | PDF | Repository state |
|---|---|---|---|
| 01 overview | `sheets/01-overview.html` | `out/01-overview.pdf` | present |
| 02 modeling result | `sheets/02-modeling-result.html` | `out/02-modeling-result.pdf` | present |
| 03 recipe / hand-eye | `sheets/03-recipe-hand-eye.html` | `out/03-recipe-hand-eye.pdf` | present |
| 04 AI builds body | `sheets/04-ai-builds-body.html` | `out/04-ai-builds-body.pdf` | present |
| 05 live operation | `sheets/05-live-operation.html` | `out/05-live-operation.pdf` | present |
| 06 human / AI | `sheets/06-human-and-ai.html` | `out/06-human-and-ai.pdf` | present |

The six-panel content and role assignment are recorded in `sheet-plan.md:28-33`; the current map records six HTML and six A2 one-page PDFs in `discussion/expo/genai-expo-2026/_map.md:14-20,24-33`.

The HTML surfaces are text/vector-led layouts with embedded PNG assets. The visible vocabulary is generally project-defined (`Private 2D Rigging Lab`, `自作エディタ`, `Player`, `AITuber`), but some claims require the human/public wording gate described in §9 below.

### Streaming Demo Surface

`discussion/demo/streaming-demo-policy.md:8-33` permits only rights-clean high-level results and UX, and forbids internal paths/schema, Cubism format names, compatibility claims, SDK/Core details, private research notes, and legal-certainty claims. Its preflight checklist is policy-only at `:35-46`; the map still lists implementation of automated checks and selection of a rights-clean capture scene as future work (`discussion/demo/_map.md:20-30`).

### Live2D Feature Proposal

The proposal map/template are current indexes (`discussion/proposal/_map.md:7-31`). The template permits problem framing, UX requests, and demo-safe before/after material, while excluding compatibility implementation, format handling, SDK/Core replacement, existing-model analysis, and legal conclusions (`live2d-feature-proposal-template.md:1-11,37-87`). No concrete proposal draft, target, submission destination, or proposal-review artifact exists in the inspected tree.

### Historical research archives

The report root explicitly routes current readers to performance, Runtime, design, and PSD owners and keeps Cubism archive restart behind permission/legal/scope review (`discussion/reports/_map.md:15-26,48-60`). The child maps are intentionally historical evidence indexes:

- CMO3/MOC3 format and Cubism SDK/runtime maps preserve exclusion evidence and do not serve as implementation/runtime or fixture oracles (`reports/cmo3-moc3-format-spec/_map.md:7-13,19-48`; `reports/cubism-sdk-runtime-structure/_map.md:7-28,38-48`).
- Deformer, Viewer/Preview, and Runtime semantics maps preserve old observations while routing current meaning to accepted project-defined contracts (`reports/deformer-structure-technology/_map.md:7-28,41-54`; `reports/viewer-preview-reference/_map.md:7-28,40-55`; `reports/runtime-evaluation-semantics-reference/_map.md:7-28,40-55`).
- `rights-risk-cleanup` is the current legal/scope gate (`reports/rights-risk-cleanup/_map.md:5-18`), while `editor-render-performance` is a dated pre-Perf Wave 2 snapshot and `psd-import-fidelity` records H1 plus the implemented `8640d12` UV remap (`reports/editor-render-performance/_map.md:1-37`; `reports/psd-import-fidelity/_map.md:15-25`).

## 4. Current repository state

### Map classification and verdict

| Map | Type | Verdict at 2026-08-08 | Current reading |
|---|---|---|---|
| `discussion/expo/_map.md` | living-index | Current | Six-panel output exists; acceptance external-unverified; proof print follows acceptance (`:11-21`). |
| `discussion/expo/genai-expo-2026/_map.md` | living-current-state + living-index | Current | Six HTML/PDF files and stop conditions are indexed; acceptance and rights gates remain open (`:12-36`). |
| `discussion/demo/_map.md` | living-index | Current | Policy index is current; demo preflight/fixture/disclaimer gates are incomplete (`:15-30`). |
| `discussion/proposal/_map.md` | living-index | Current | Template exists; first proposal target and submission scope are user decisions (`:15-31`). |
| `discussion/reports/_map.md` | living-index | Current | Archive/current-owner boundary is explicit (`:15-60`). |
| `reports/cmo3-moc3-format-spec/_map.md` | historical-evidence-index | Intentionally historical | Current exclusion is explicit; restart requires separate review (`:7-13,35-48`). |
| `reports/cubism-sdk-runtime-structure/_map.md` | historical-evidence-index | Intentionally historical | Inspector experiment is not in the base tree and is not current work (`:15-28,38-48`). |
| `reports/deformer-structure-technology/_map.md` | historical-evidence-index | Intentionally historical | Current `rotation2d` / `warpLattice2d` contract is linked; old candidates are historical (`:17-28,41-54`). |
| `reports/viewer-preview-reference/_map.md` | historical-evidence-index | Intentionally historical | Current Preview/Viewer/Runtime owners are linked; Cubism Viewer compatibility remains out of scope (`:17-28,40-55`). |
| `reports/runtime-evaluation-semantics-reference/_map.md` | historical-evidence-index | Intentionally historical | Runtime semantics route to accepted runtime contract; old pipeline choices are not current work (`:17-28,40-55`). |
| `reports/rights-risk-cleanup/_map.md` | living-index | Current | Current legal/scope gate and cleanup report (`:5-18`). |
| `reports/editor-render-performance/_map.md` | historical-evidence-index | Intentionally historical | Pre-Perf Wave 2 baseline; current owner is `render-performance/` (`:1-37`). |
| `reports/psd-import-fidelity/_map.md` | living-current-state | Current | H1 and `8640d12` remap evidence are indexed; source/design owners are linked (`:15-37`). |

### Output and metadata snapshot

- `sheets/`: 6 HTML files; file sizes 6,063–15,659 bytes; timestamps 2026-07-26.
- `out/`: 6 PDF files; file sizes 226,402–3,256,993 bytes; timestamps 2026-07-26.
- `assets/`: 14 PNG files. Read-only Pillow inspection found dimensions from `613×674` to `2,172×2,896`; no rights/provenance manifest or sidecar exists inside the Expo directory.
- `discussion/expo.zip`: untracked, 640,109 bytes, SHA-256 `69C9156E504C0C5F03BEE279172B162A6D4F1DDD63A85D731A5D39786311C4E5`, dated 2026-07-26. Its purpose was not inferred and it is not counted as an Expo panel artifact.
- `generated/demo`, `generated/rights`, and `generated/proposal` are absent; only `generated/.gitkeep` and `generated/dependencies/dependency-registry.json` were found under `generated/`.

## 5. Information-type separation

| Information type | This report's treatment |
|---|---|
| Official fact | No external official source was queried. Event name/URL and panel dimensions are repository records (`poster-design.md:8`, `expo/_map.md:15`), not independently verified acceptance or permission facts. |
| Repository fact | Files, paths, counts, byte sizes, hashes, current HEAD, map text, and absence of generated rights/preflight artifacts. |
| Accepted design/policy decision | Four-track separation, outcome-centered Expo basis, Demo/Proposal Hygiene, rights/preflight requirements, and Cubism exclusion. |
| Historical evidence | Expo Git commits and report archive maps; historical text is not reused as current implementation truth. |
| Experiment/verification result | HTML CSS regex, PDF byte page/MediaBox scan, PNG dimension inspection, file/hash/status commands. |
| Inference | Header/title inconsistencies and presentation wording risks are flagged as review candidates, not silently repaired. |
| Unresolved gate | Acceptance, proof print, display rights, demo preflight, proposal target/review, and any archive restart permission. |

## 6. Accepted decisions and boundaries

1. The four tracks remain separate: Private Prototype, Streaming Demo Surface, Live2D Feature Proposal, and Future Public Clean Subset (`discussion/_map.md:13-18`; `discussion/concept/modified_concept.md:46-49,66-104`).
2. Expo is an event-specific external presentation track, distinct from Streaming Demo hygiene; the Expo map applies Demo and Proposal Hygiene as a boundary (`discussion/expo/_map.md:5-9`, `discussion/_conventions.md:136-146`).
3. The poster is outcome-centered; general methodology is a separate handout/slide track (`poster-design.md:16-31`, `sheet-plan.md:39-43`).
4. Cubism/Live2D compatibility, format handling, SDK/Core dependency, existing-model loading, and replacement claims remain excluded (`discussion/_conventions.md:192-203`; `discussion/concept/modified_concept.md:25-38,66-100`).
5. Demo/proposal surfaces must use rights-clean or explicitly permitted assets, run preflight, redact private details, and avoid forbidden terms/compatibility implications (`demo-rights-ip-policy.md:70-170,346-427`; `demo-safe-test-policy.md:32-39,132-167`).
6. Historical research maps are evidence only. Current runtime/design/performance/PSD truth belongs to their linked current owners (`discussion/reports/_map.md:15-26,38-45`).

## 7. Verification and experiment evidence

All commands in this section were read-only.

### Artifact counts and dimensions

```text
Get-ChildItem discussion/expo/genai-expo-2026/sheets -Filter *.html: html_count=6
Get-ChildItem discussion/expo/genai-expo-2026/out -Filter *.pdf: pdf_count=6
Get-ChildItem discussion/expo/genai-expo-2026/assets -Filter *.png: asset_count=14
```

For each HTML, a PowerShell regex check returned `pageA2=True rootA2=True` for `@page { size: 420mm 594mm }` and `width: 420mm; height: 594mm`.

A Python standard-library byte check over each PDF found exactly one `/Type /Page` token and MediaBox `0 0 1191.12 1684.08` in all six files. This verifies file/page geometry only; it does not prove visual readability or print quality.

### Git evidence

| Commit | Date | Evidence |
|---|---|---|
| `a3335f1` | 2026-07-25 | Expo discussion, source-facts, initial poster plan added. |
| `0a89c45` | 2026-07-26 | Outcome-centered poster basis accepted; methodology moved to a separate handout track. |
| `1ed12b2` | 2026-07-26 | Six HTML/CSS panels and six A2 PDFs produced; print/PDF checks and layout rules recorded. |
| `cd693ea` | 2026-07-26 | Panel wording revised toward factual, non-victory phrasing. |
| `3c3669e` | 2026-07-26 | Three superseded drafts deleted; six live sheets retained; work stopped pending acceptance/proof print. |
| `af58394` | 2026-08-08 | Discussion maps refreshed with current-owner/archive and Expo gate labels. |

### Policy/artifact cross-checks

- `rg` search found no generated demo-safe preflight, rights/provenance, redaction, or proposal-review report under their required `generated/**` paths.
- Expo-local asset listing contains PNGs only; no `rights`, `provenance`, `license`, `permission`, or manifest file was found.
- `rg` over Expo/demo/proposal/maps records acceptance as waiting/external-unverified and does not provide a repository acceptance notice.
- No external website or inbox was queried; official event acceptance and permission remain outside repository verification.

## 8. Historical progression / turning points

1. **2026-07-25 — external memory created (`a3335f1`)**: the event topic, source-facts, initial panel plan, and explicit “do not claim” lines were recorded.
2. **2026-07-26 — basis narrowed (`0a89c45`)**: the poster was narrowed to the built artifact; general LLM methodology moved to a separate handout/slide track.
3. **2026-07-26 — production completed (`1ed12b2`)**: six HTML/CSS sheets and six A2 PDFs were produced; the commit records repeated page-count checks after `overflow:hidden` failed to prevent PDF page splitting.
4. **2026-07-26 — wording and cleanup (`cd693ea`, `3c3669e`)**: wording was changed from victory claims toward observable operation; three obsolete drafts were deleted and the six-sheet set was frozen pending acceptance/proof print.
5. **2026-08-08 — map refresh (`af58394`)**: Expo completion, external-unverified acceptance, proof-print gate, current-owner links, and historical archive boundaries were made explicit.

## 9. Open gates, debts, and uncertainties

### External / human / legal gates

- Individual acceptance notification: **external-unverified / waiting**. The repository contains no acceptance notice or official per-submission status.
- Real-size proof print: blocked until acceptance; panel ③ approximate 64 dpi and panel ② approximate 88 dpi need human readability check (`poster-design.md:208-212`).
- Public display rights: unresolved. `sheet-plan.md:95` leaves asset/name/live-screen permission open; Expo assets have no local rights manifest. This report does not infer that generated or captured images are cleared.
- Demo-safe capture: required preflight, rights/provenance, redaction, and disclaimer evidence are absent from generated output paths. Policy is not a completed gate.
- Proposal package: no first target, submission destination, public scope, or proposal-review artifact is recorded (`discussion/proposal/_map.md:20-31`).
- Cubism/archive publication or experiment restart: outside current work and requires permission/legal/scope review (`discussion/reports/_map.md:26,58-60`; `cleanup-report.md:164-184`).

### Historical or wording inconsistencies

- `discussion/expo/genai-expo-2026/poster-design.md:3` says physical production is not started, while six HTML/PDF outputs exist. `:260` also describes restarting production after agreement. These lines are historical headers/notes, not current artifact counts.
- `discussion/expo/genai-expo-2026/sheet-plan.md:3` calls all sheet contents unagreed while `:28-33` says all six panels reached PDF. The file is still useful as the register for unresolved content/rights questions, but the header is time-qualified.
- `discussion/expo/genai-expo-2026/sheets/04-ai-builds-body.html:2` has a superseded `<title>` (“01 …自分の体を作らせてみた”) while the visible H1 at `:126` is “自分用のモデルを組ませた”.
- `sheets/02-modeling-result.html:112` compresses mesh/deformation/physics creation into “AI gave” wording. `source-facts.md:122-125` distinguishes deterministic mesh generation and warns against overstating AI authorship or superiority; public wording needs human review.
- `sheets/03-recipe-hand-eye.html:150,171-180` describes direct API editing and AI multi-pose evaluation. `source-facts.md:22-31,60-64` supports the CLI/measurement story but keeps human quality judgment as a separate gate; no public preflight evidence is attached.
- `sheets/05-live-operation.html:210-211` reports 1h40 stable operation. `source-facts.md:99-101` records this as a user-run observation, not an independently rerun acceptance test.
- `poster-design.md:11` names model families/providers, while `source-facts.md:129` says the repository lacks a reliable mapping for those names. Names remain an unresolved presentation decision, not a repository fact.

## 10. Candidate next work (facts-derived; no recommendation)

1. Receive/record the external acceptance notice, if any, without converting the workbench note into a verified external fact.
2. After acceptance, run the documented physical proof print and record panel ②/③ readability observations.
3. Create a rights/provenance manifest for every Expo asset and capture, with display/redistribution scope and human reviewer, before public use.
4. Run the required demo-safe preflight/redaction/forbidden-term checks on any capture or proposal attachment; keep generated reports under the policy paths.
5. Resolve or time-qualify stale HTML title and poster/sheet headers in a separately authorized docs update; this report does not modify them.
6. If a Live2D Feature Proposal is desired, select a first problem statement and scope, then produce a proposal-review artifact using only preflighted demo-safe material.
7. If any historical Cubism archive is to be reopened or published, first create the separate permission/legal/scope review record; do not use archive text as current implementation or UX oracle.

## 11. Evidence index

| Evidence | Type | Key location / command |
|---|---|---|
| Six-panel map state | Repository fact | `discussion/expo/genai-expo-2026/_map.md:12-33` |
| Panel progress rows | Repository/design record | `discussion/expo/genai-expo-2026/sheet-plan.md:28-33` |
| A2 CSS dimensions | Verification result | PowerShell regex over `sheets/*.html`, all six true |
| One-page A2 PDF geometry | Verification result | Python byte scan over `out/*.pdf`, all six `1 page`, MediaBox `1191.12×1684.08 pt` |
| Artifact metadata | Repository fact | `Get-ChildItem` / `Get-FileHash` over `assets`, `sheets`, `out` |
| Acceptance/proof-print gate | Accepted/workbench decision + unresolved external state | `expo/_map.md:15-21`; `genai-expo-2026/_map.md:26-33`; `poster-design.md:208-212` |
| Demo boundary | Accepted policy | `discussion/demo/streaming-demo-policy.md:8-90`; `discussion/development_convention/demo-rights-ip-policy.md:70-170,346-427` |
| Proposal boundary | Accepted template/policy | `discussion/proposal/live2d-feature-proposal-template.md:1-11,37-87`; `demo-rights-ip-policy.md:138-153,327-379` |
| Current archive boundary | Current map integration | `discussion/reports/_map.md:15-26,38-60` |
| Historical archive evidence | Historical maps | Child paths listed in §4, with `Historical evidence index` labels |
| Untracked ZIP | Repository/worktree fact | `Get-Item`, `Get-FileHash`, `git status --short -- discussion/expo.zip`; purpose intentionally unknown |
| Git turning points | Historical evidence | commits `a3335f1`, `0a89c45`, `1ed12b2`, `cd693ea`, `3c3669e`, `af58394` |

## 12. Limitations

- No external web, email, event system, or submission portal was queried. Acceptance, permission, and public-display status are therefore not verified.
- PDF inspection used a byte-level page/media-box check; no rasterized visual or real-size print inspection was performed.
- No legal conclusion was made. Rights policy and unresolved asset metadata are evidence gates, not legal clearance.
- No demo/proposal capture was created or rerun; absence of generated reports means “not evidenced,” not necessarily “never run elsewhere.”
- Historical archive text was not reinterpreted as current behavior; current owners in `reports/_map.md` remain authoritative.
- Existing maps, source, tests, settings, and other reports were not edited. Only this report is owned by this task; no stage/commit was performed.
