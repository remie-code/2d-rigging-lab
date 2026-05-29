# Wave 12 Integration Review

> Wave: `runtime-keyform-evaluation-foundation`
> Date: 2026-05-29
> Reviewer: Orch-Sylph / Domain G integration review
> Verdict: `pass`

## 1. Scope

Wave 12 connects Wave 11 authored keyforms to runtime evaluation. It adds keyform identity preservation, effective parameter resolution, 1D and Grid2D sampling, target application for mesh and drawable runtime state, snapshot/diff integration, runtime evidence regressions, and a compact contract fixture.

The integrated diff does not add UI implementation, external HTTP/WebSocket/MCP transport, or new product features outside the runtime keyform foundation.

## 2. Domain Gate

| Domain | Completion | Review | Verdict |
|---|---|---|---|
| `wave12-runtime-keyform-binding-identity-and-parameter-resolution` | pass | pass | pass |
| `wave12-runtime-keyform-sampling-foundation` | pass | pass | pass |
| `wave12-runtime-keyform-target-application` | pass | needs_changes -> pass | pass |
| `wave12-runtime-snapshot-keyform-integration` | pass | pass | pass |
| `wave12-runtime-evidence-keyform-regression` | pass | pass | pass |
| `wave12-runtime-keyform-fixture` | pass | needs_changes -> pass | pass |

## 3. Design / Contract Compliance

| Requirement | Result |
|---|---|
| Runtime graph keeps keyform identity | pass: `KeyformBinding` includes `keyformSetId`, and authoring runtime graph conversion preserves it. |
| Effective parameter resolution is shared by snapshot and sampling | pass: `resolveEffectiveParameterValues` returns snapshot parameter rows and the effective value map used by sampling. |
| `linear-1d-v1` sampling foundation | pass: exact, interpolation, endpoint clamp, unsupported shape, and incompatible shape paths are covered. |
| `parameter-grid-2d-v1` sampling foundation | pass: exact, bilinear interpolation, missing surrounding key diagnostics, duplicate coordinate diagnostics, and coordinate clamp paths exist. |
| Runtime target application | pass: mesh vertices and drawable opacity / visibility / draw order are applied with diagnostics for unsupported targets and invalid patches. |
| Runtime snapshot and evidence visibility | pass: snapshots contain non-empty `keyformSamples`; runtime/evidence/editor/AI tests assert runtime-visible mesh changes. |
| Compact fixture | pass: fixture fixes a 1D mesh vertices oracle and records Grid2D omission as covered by runtime-core unit tests. |

## 4. Development Compliance

| Boundary | Result |
|---|---|
| No UI implementation | pass |
| No external transport implementation | pass |
| No giant or implementation-heavy `index.ts` | pass: no `index.ts` is in the Wave 12 source diff, and `pnpm.cmd run check:source` passed. |
| Source files have clear ownership | pass: new runtime files are split by parameter resolution, sampling, interpolation, target application, and geometry. |
| No unrelated reversion observed | pass: `git status --short -uall` shows expected Wave 12 source, fixture, test, report, and map changes only. |
| Report/map duplication | pass: six completion reports and six review reports exist; Domain G added the missing Wave 12 wave/review maps and no conflicting duplicate final report was present. |

## 5. Test Adequacy

| Coverage Area | Result |
|---|---|
| Unit coverage | pass: interpolation, sampling, target application, geometry, parameter resolution, and snapshot comparison tests are present. |
| Integration coverage | pass: runtime snapshot integration tests cover keyform samples, target application, diagnostics, trace phases, keyform-less compatibility, and comparison. |
| Evidence coverage | pass: runtime evidence, editor session persistence, and AI command host regressions assert keyform samples plus runtime-visible drawable changes. |
| Fixture coverage | pass: compact fixture locks baseline/evaluated snapshots and runtime comparison output. |
| Full repo verification | pass: typecheck, full tests, source guard, whitespace checks, and final status were run in Domain G. |

## 6. Cross-Domain Consistency

- Domain B sample output includes `targetMetadata`, `statePatch`, composition mode/order, and sample metadata.
- Domain C accepts both flattened target fields and Domain B `targetMetadata` shape.
- Domain D preserves Domain B order by sampling bindings in `compositionOrder` plus original order, then applies samples one at a time through Domain C.
- Domain E verifies runtime-visible evidence through runtime-core, editor session, and AI host paths without production source changes.
- Domain F fixture aligns with Domain D snapshot output and records why Grid2D stays in unit coverage for this compact fixture.

## 7. Verification

| Command | Outcome |
|---|---|
| `pnpm.cmd typecheck` | Initial sandbox run failed with `EPERM` opening TypeScript in `node_modules`; escalated rerun passed. |
| `pnpm.cmd test` | Initial sandbox run failed with `EPERM` opening Vitest in `node_modules`; escalated rerun passed, 62 files / 296 tests. |
| `pnpm.cmd run check:source` | passed; source organization guard passed. |
| `git diff --check -- .` | passed for tracked changes; emitted only CRLF working-copy warnings. |
| PowerShell untracked whitespace check below | passed for 43 untracked files; no whitespace errors. |
| `git status --short -uall` | completed; status shows expected Wave 12 modified and untracked files. |

Exact untracked whitespace command:

```powershell
$files = @(git ls-files --others --exclude-standard); $errors = @(); foreach ($file in $files) { $output = @(git diff --check --no-index -- NUL $file 2>&1); $bad = @($output | Where-Object { $_ -ne '' -and $_ -notmatch '^warning: in the working copy' }); if ($bad.Count -gt 0) { $errors += "[$file]"; $errors += $bad } }; if ($errors.Count -gt 0) { $errors; exit 1 } else { "Checked $($files.Count) untracked files with git diff --check --no-index; no whitespace errors." }
```

## 8. Known Residuals

- Runtime diff has no dedicated drawList / opacity / visibility / draw order change fields; Wave 12 uses existing `drawableChanges` and a coarse `/drawList` parameterChanges entry.
- Grid2D compact fixture is intentionally omitted; Grid2D is covered by runtime-core unit tests and a fixture coverage note.
- Additional non-blocking diagnostic hardening tests remain useful for duplicate key/coordinate, missing parameter, unsupported evaluator, and key-range clamp paths.
- AI-host `addKeyformGrid2d` runtime evidence remains outside Wave 12 required scope.
- `rigControl` keyform target application remains unsupported future scope and emits diagnostics.

## 9. Decision

Wave 12 can be marked complete with verdict `pass`.
