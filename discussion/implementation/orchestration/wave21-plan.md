# Wave 21 Plan: PSD Structured Profile Persistence Hardening

> Wave 21 で実装すべき domain、依存順、Orch-Sylph 並列投入方針を固定する計画。
> 実装起動時はこの文書と `.agents/skills/implementation-orchestration/SKILL.md` を最小基準にする。

## 1. 状態

- Status: Planned
- Target wave: Wave 21
- Wave name: `psd-structured-profile-persistence-hardening`
- Primary objective: Wave 20 の parser-free PSD adapter/profile import を、平坦な `diagnostics: string[]` / `sourceLayer.unsupportedFeatures: string[]` 依存から、structured PSD profile persistence へ引き上げる。

## 2. 次Wave選定

Wave 20 は PSD parser ではなく、trusted adapter が返す `psd-adapter-result-v1` を `importPsdSourceAsset` が受け取り、source manifest、texture preview、part mapping、validator、editor intake、save/load に流せるところまで証明した。

ただし、PSD の情報はまだ current package/source manifest surface に合わせてかなり平坦化されている。具体的には、adapter / canvas / group / layer / unsupported feature / diagnostic / sample characterization 由来の情報が、主に `diagnostics: string[]` と `sourceLayer.unsupportedFeatures: string[]` に寄っている。このまま real PSD parser や binary storage に進むと、parser output と package persistence の境界が曖昧になりやすい。

そのため Wave 21 は、real PSD parser / file picker / binary storage へは進まず、PSD を本命 source として扱うための structured persistence を先に固める。

- PSD profile/group/layer/adapter evidence を package source manifest 上で structured に保持する。
- Wave 20 の parser-free truthfulness を維持する。
- 既存の flattened diagnostics / unsupportedFeatures 互換を壊さない。
- operation / validator / fixtures / editor projection が structured profile を読めるようにする。
- split PNG path は重要度を下げつつ、既存互換は壊さない。

これは実PSD parserへの移行ではなく、parserへ進む前の契約強化 wave である。

## 3. Undine コンテキスト保護の復元規約

Wave 21 でも、Undine は実装詳細を直接抱え込まない。

- Undine は wave objective、domain split、依存順、統合判断、ユーザー質問、最終報告だけを持つ。
- Undine は domain ごとに Orch-Sylph を起動し、Orch-Sylph に domain 内の Gnome 実装、Review-Sylph レビュー、needs_fix loop、domain completion report を完結させる。
- Orch-Sylph 自身は実装担当ではない。source実装は必ず Gnome、レビューは必ず別コンテキストの Review-Sylph に分ける。
- Orch-Sylph が Gnome / Review-Sylph の分離を実行できない場合、Orch-Sylph 自身で実装せず `escalate` / `blocked` として報告する。
- Review-Sylph は implementation notes だけでなく、basis docs、changed files/diff、検証結果を根拠にする。
- 長時間待機になっても、Undine は Orch-Sylph / subagent 処理を打ち切らない。
- 各 source implementation domain には `discussion/development_convention/source-file-organization-policy.md` を渡し、巨大 source file / catch-all `index.ts` を防ぐ。

## 4. Repository Facts

- Wave 20 は `Completed / implementation-proven`。
- `importPsdSourceAsset` は adapter result present の場合に commit 可能。
- Editor Source Intake は manual PSD adapter/profile metadata entry を持つ。
- PSD mode は parser-free metadata entry であり、PSD bytes parsing、decode、raster extraction、file picker ではない。
- Wave 20 の residual risk は、PSD details が `diagnostics: string[]` と `sourceLayer.unsupportedFeatures: string[]` に平坦化されている点。
- `PackageFileSet` は text entry 中心であり、binary asset storage は未設計。
- Wave 20 final report は next-wave candidate として real asset I/O boundary design も挙げているが、現時点の実利用優先度は PSD source path の品質向上である。
- `test_data/sample_model.psd` は rights-cleared sample として参照可能だが、Wave 21 でもコピー・fixture化・binary parsing は行わない。

## 5. Design Decisions

- Wave 21 は structured PSD profile persistence に限定する。
- `psd-source-v1` / `layered-character-psd-profile-v1` の source manifest 表現を、adapter evidence / canvas / groups / layers / unsupported features / diagnostics を structured に表現できる形へ拡張する。
- Existing flattened fields は互換維持する。既存 fixtures / editor save-load / validation が壊れる migration は禁止。
- Structured profile は package-format に属する永続表現であり、runtime-core に PSD固有構造を漏らさない。
- Operation-core は adapter result から structured source profile を materialize する。
- Validator-core は structured profile を優先して読み、flattened fallback も診断互換として扱う。
- Editor は imported source summary / evidence / AI inspection projection で structured profile を表示または要約できるようにする。ただし UI は actual PSD parsing 済みと誤認させない。
- Public `index.ts` は barrel-only を維持する。

## 6. Non-Goals

- Actual PSD binary parser。
- PSD bytes read / channel decode / raster extraction。
- Photoshop-compatible compositing、mask/effect/text/smart object rendering。
- OS file picker、archive import/export、binary package storage。
- External PSD / image dependency。
- `test_data/sample_model.psd` のコピー、fixture化、再配布。
- Real PNG bytes pipeline の実装。
- Runtime-core への PSD-specific DTO 導入。
- Full layer tree editor、mask/clipping editor、opacity editor。

## 7. Basis Documents

Undine が保持する最小 basis:

- `.agents/skills/implementation-orchestration/SKILL.md`
- `C:/Users/remie/.codex/skills/subagent-context-hygiene/SKILL.md`
- `discussion/implementation/orchestration/wave21-plan.md`
- `discussion/implementation/current-capability-map.md`
- `discussion/implementation/waves/wave20/wave20-final-report.md`
- `discussion/implementation/reviews/wave20/wave20-clean-integration-review.md`

各 Orch-Sylph に渡す domain basis:

- `discussion/development_convention/source-file-organization-policy.md`
- `discussion/development_convention/dependency-policy.md`
- `discussion/design/module-contracts/package-file-format-contract.md`
- `discussion/design/module-contracts/operation-contracts.md`
- `discussion/design/module-contracts/validator-contract.md`
- `discussion/design/module-contracts/fixtures-and-contract-tests.md`
- `discussion/design/mvp-authoring-runtime/01-open-model-package-design.md`
- `discussion/implementation/waves/wave20/wave20-psd-spec-field-matrix.md`
- `discussion/implementation/waves/wave20/wave20-psd-sample-characterization.md`
- `discussion/implementation/waves/wave20/wave20-final-report.md`
- domain ごとの target source files
- domain ごとの既存 tests / fixtures

Undine は全規約や PSD 仕様全文を自分で読み込まない。詳細規約と仕様は Orch-Sylph が domain 必要分だけ読み、Gnome / Review-Sylph へ狭く渡す。

## 8. Dependency / Parallel Design

Structured persistence は package-format schema が upstream bottleneck になる。Domain A が pass するまで B/C/E は開始しない。Domain A 後は operation と validator を並列化し、両方が pass したら fixtures と editor projection を並列化する。

| Batch | Domain | Parallelism | Dependency | Purpose |
|---|---|---|---|---|
| 1 | A. PSD structured source manifest contract | Solo | Wave 20 complete | package-format に structured PSD profile persistence を追加し、互換方針を固定する |
| 2 | B. PSD operation structured materialization | Parallel with C | A | `importPsdSourceAsset` が adapter result から structured profile を materialize する |
| 2 | C. PSD validator structured diagnostics | Parallel with B | A | validator が structured profile を読んで diagnostics を出す |
| 3 | D. PSD structured contract fixtures | Parallel with E | B + C | Wave20 fixtures を structured persistence evidence に更新・追加する |
| 3 | E. Editor PSD structured projection | Parallel with D | B + C | editor summary / evidence / save-load projection が structured profile を扱う |
| 4 | F. PSD structured persistence e2e and compatibility smoke | Solo | D + E | PSD structured path と split PNG互換の smoke を確認する |
| 5 | G. Integration review and final report | Solo | F | final verification、clean integration review、map更新、final report |

安全上の制約:

- A は `packages/package-format/src/source-manifest.ts` と package-format focused tests を独占する。
- B は operation-core / authoring-core の materialization を担当し、validator 実装には触らない。
- C は validator-core を担当し、operation materialization には触らない。
- D は fixtures/contracts と fixture tests を担当し、editor UI には触らない。
- E は editor projection / UI summary / save-load tests を担当し、fixtures/contracts には触らない。
- F は e2e / smoke に限定する。広い source fix が必要なら該当 domain へ差し戻す。
- External dependency、PSD parser、binary storage、file picker が必要になったら止めて `escalate` する。

## 9. Domain Assignments

### A. `wave21-psd-structured-source-manifest-contract`

Purpose:

- `psd-source-v1` / `layered-character-psd-profile-v1` の source manifest に structured PSD profile persistence を追加する。
- Adapter evidence、canvas、source groups、source layers、bounds、opacity、visibility、blend mode metadata、target part / texture relation、unsupported feature details、adapter diagnostics を表現できるようにする。
- Existing flattened `diagnostics` / `unsupportedFeatures` との互換方針を決める。

Write scope:

- `packages/package-format/src/source-manifest.ts`
- `packages/package-format/src/*source-manifest*.test.ts`
- package-format fixtures/tests の最小更新
- discussion completion / review reports

Forbidden:

- Operation handler implementation
- Validator implementation
- Editor UI implementation
- Runtime-core PSD DTO
- External parser / dependency
- `index.ts` implementation logic

Pass evidence:

- Structured PSD profile DTO can represent Wave20 adapter result without lossy flattening.
- Existing split PNG and existing Wave20 PSD fixture manifests remain loadable or have explicit compatibility tests.
- Flattened diagnostics fallback policy is documented in tests or completion report.
- Source file organization review passes.

Early escape:

- Source manifest contract cannot be extended without migration design beyond one wave.
- Structured profile requires binary storage or actual PSD parsing.
- Existing package-file contract conflicts with structured profile persistence.

### B. `wave21-psd-operation-structured-materialization`

Purpose:

- `importPsdSourceAsset` が adapter result から structured PSD profile を source manifest / authoring asset metadata へ materialize する。
- Wave20 の deterministic diagnostics と parser-free truthfulness を維持する。
- Existing flattened fields は backward compatibility と summary用途で残す。

Write scope:

- `packages/operation-core/src/operations/import-psd-source-asset*.ts`
- `packages/operation-core/src/payloads/import-source.ts` は Domain A contract に必要な最小調整のみ
- `packages/authoring-core/src/source-asset-mutations.ts`
- `packages/authoring-core/src/texture-asset-mutations.ts` は必要時のみ
- focused operation / authoring tests
- discussion completion / review reports

Forbidden:

- Validator implementation
- Editor UI implementation
- PSD bytes read / decode / raster extraction
- External parser dependency
- Runtime-core PSD-specific changes
- `index.ts` implementation logic

Pass evidence:

- Adapter-present `importPsdSourceAsset` commit writes structured PSD profile.
- Missing adapter result and unsupported feature diagnostics remain deterministic.
- Texture preview / part mapping relation remains traceable.
- Old flattened consumers still see compatible summaries.

Early escape:

- Operation materialization cannot write structured profile without broader authoring-core redesign.
- Structured profile causes source layer / texture relation ambiguity.

### C. `wave21-psd-validator-structured-diagnostics`

Purpose:

- Validator が structured PSD profile を読み、group/layer/adapter diagnostics を AI-readable に出す。
- Flattened fallback も互換として扱う。
- Runtime-core へ PSD-specific structure を漏らさない。

Write scope:

- `packages/validator-core/src/**`
- focused validator tests
- discussion completion / review reports

Forbidden:

- Operation handler implementation
- Editor UI implementation
- External parser dependency
- Runtime-core PSD schema
- `index.ts` implementation logic beyond barrel-only export if needed

Pass evidence:

- Structured PSD profile happy path validates.
- Missing structured profile / conflicting flattened fields / unsupported feature detail are deterministic diagnostics.
- Split PNG and Wave20 flattened PSD fixtures remain compatible.

Early escape:

- Validator contract cannot express structured source diagnostics without broader report redesign.
- Severity of new PSD diagnostics needs product decision.

### D. `wave21-psd-structured-contract-fixtures`

Purpose:

- `psd-import-happy-path` / `psd-unsupported-layer` fixtures を structured profile evidence に更新または追加する。
- Expected operation result、source manifest、validation report、texture relation evidence を固定する。
- No PSD bytes / image bytes の truthfulness を維持する。

Write scope:

- `fixtures/contracts/psd-import-happy-path/**`
- `fixtures/contracts/psd-unsupported-layer/**`
- new focused fixture under `fixtures/contracts/**` if needed
- fixture/contract tests under package / operation / validator packages
- discussion completion / review reports

Forbidden:

- Actual PSD binary fixture
- `test_data/sample_model.psd` のコピー
- Editor UI implementation
- External parser dependency

Pass evidence:

- Happy path fixture includes structured PSD profile persistence evidence.
- Unsupported-layer fixture includes structured unsupported feature evidence.
- Expected validation report proves structured diagnostics.
- Fixture labels do not imply actual PSD bytes were parsed.

Early escape:

- Fixture update would require binary PSD/image bytes.
- Existing fixtures cannot be migrated without breaking backward compatibility expectations.

### E. `wave21-editor-psd-structured-projection`

Purpose:

- Editor の imported source summary / evidence provider / AI inspection projection が structured PSD profile を読めるようにする。
- UI 上で adapter / canvas / group / layer / unsupported feature を truthful に要約する。
- Save/load 後も structured profile の projection が保たれることを確認する。

Write scope:

- `apps/editor/src/editor-session/evidence-provider.ts`
- `apps/editor/src/editor-workflow/source-intake-workflow.ts`
- `apps/editor/src/editor-state/source-intake-*.ts`
- `apps/editor/src/ui/source-assets/**`
- `apps/editor/src/ai-command-host/**` は inspection projection が必要な場合のみ
- focused editor tests
- discussion completion / review reports

Forbidden:

- OS file picker
- PSD parser / image decode / raster extraction
- Broad app shell redesign
- Contract fixture ownership
- Operation handler broad changes
- `index.ts` implementation logic

Pass evidence:

- Editor can summarize structured PSD profile without claiming parsing.
- Existing manual PSD adapter/profile input still works.
- Split PNG source intake remains compatible.
- Long structured diagnostics wrap cleanly and accessible labels remain coherent.

Early escape:

- UI wording cannot avoid implying actual PSD parsing.
- Projection requires broad app shell redesign.

### F. `wave21-psd-structured-e2e-and-compatibility-smoke`

Purpose:

- Browser smoke で structured PSD profile persistence -> preview -> save/load -> projection を固定する。
- Split PNG focused compatibility smoke を足し、Wave20でPSD中心になった root e2e の互換リスクを下げる。

Write scope:

- `apps/editor/e2e/**`
- `apps/editor/tests/**`
- `fixtures/e2e/**`
- narrow test id / aria tweaks in UI files only if needed
- discussion completion / review reports

Forbidden:

- PSD parser / file picker / image decode / raster extraction
- Broad editor UI redesign
- Contract schema changes
- Operation/validator broad fixes without domain差し戻し

Pass evidence:

- PSD structured profile path survives save/load in desktop/mobile smoke.
- Preview relation remains truthful.
- Split PNG source intake compatibility is still covered.
- No actual PSD parsing/file-picker wording appears in e2e-visible UI.

Early escape:

- E2E requires binary file storage or file picker.
- Structured profile persistence does not survive browser save/load.

### G. `wave21-integration-review-and-final-report`

Purpose:

- Domain A-F completion reports を統合し、final verification と clean integration review を行う。
- Wave21 final report、current capability map、implementation maps を更新する。

Write scope:

- `discussion/implementation/waves/wave21/**`
- `discussion/implementation/reviews/wave21/**`
- `discussion/implementation/current-capability-map.md`
- `discussion/implementation/_map.md`
- `discussion/implementation/orchestration/_map.md`

Forbidden:

- Source code edits。source fix が必要な場合は該当 domain へ差し戻す。

Pass evidence:

- Final verification が typecheck / unit / e2e / source guard / diff check を含む。
- Clean integration review が structured persistence、truthfulness、compatibility、test adequacy、orchestration compliance を確認する。
- No parser/dependency/file-picker claim remains.

## 10. Subagent / Orch-Sylph Execution Policy

Wave 21 起動時の実行単位は domain ごとの Orch-Sylph である。

1. Undine は Domain A の Orch-Sylph を単独投入し、completion report を待つ。
2. Domain A が `pass` したら、Undine は Domain B / C の Orch-Sylph を並列投入する。
3. Domain B / C が `pass` したら、Undine は Domain D / E の Orch-Sylph を並列投入する。
4. Domain D / E が `pass` したら、Undine は Domain F を Orch-Sylph に委譲する。
5. Domain F が `pass` したら、Undine は Domain G を Orch-Sylph に委譲する。
6. 各 Orch-Sylph は自分でsource実装せず、domain内で Gnome 実装と Review-Sylph レビューを別コンテキストに分離する。
7. Review-Sylph は clean context で、implementation notes ではなく basis docs、target files、diff、tests を根拠にレビューする。
8. Subagent からユーザーへ直接質問してはならない。質問は Orch-Sylph が集約し、Undine が重複排除してユーザーへ確認する。
9. Undine は completion report が `pass` でない domain を wave gate 通過扱いにしない。
10. 長時間処理でも、Undine は待機を理由に subagent を打ち切らない。

各 Orch-Sylph assignment には、必ず次の文を含める。

```text
Orch-Sylph自身は実装担当ではない。source implementation は必ず別コンテキストの Gnome に委譲し、レビューは必ず別コンテキストの Review-Sylph に委譲すること。これを分離できない場合は実装せず escalate / blocked として報告すること。
```

## 11. Review Lanes

各 domain completion 前に最低限以下を確認する。

- Structured Persistence: PSD profile/group/layer/adapter evidence が structured に永続化されるか。
- Backward Compatibility: Wave20 flattened diagnostics / unsupportedFeatures consumer を壊していないか。
- PSD Profile Truthfulness: actual PSD binary parse と adapter-result persistence を混同していないか。
- Dependency Policy Compliance: PSD / image parser dependency を追加していないか。
- Source Layer Mapping: source layer -> textureId -> partId -> drawable の関係が追跡可能か。
- Texture Preview Persistence: preview metadata / save-load 経路を壊していないか。
- Validator Evidence: structured profile diagnostics が AI-readable か。
- UI / Accessibility: editor projection が truthful で、desktop/mobile layout と label が破綻していないか。
- Development Compliance: source file organization、barrel-only `index.ts`、単一責務、write scope 非逸脱を満たすか。
- Test Adequacy: unit / operation / validator / fixture / editor / e2e が domain risk に見合うか。
- Orchestration Compliance: Orch-Sylph 自身が実装せず、Gnome実装とReview-Sylphレビューが分離されているか。

## 12. Verification Plan

Domain ごとの最小 verification:

- Domain A: package-format focused tests、source manifest compatibility tests、typecheck
- Domain B: operation-core / authoring-core focused tests、typecheck
- Domain C: validator focused tests
- Domain D: fixture / contract focused tests
- Domain E: editor state / projection / UI focused tests、editor typecheck
- Domain F: editor e2e smoke、split PNG compatibility smoke、a11y/layout smoke
- Domain G: `pnpm typecheck`、`pnpm test:unit`、`pnpm test:e2e`、`pnpm run check:source`

最終 verification:

- `pnpm typecheck`
- `pnpm test:unit`
- `pnpm test:e2e`
- `pnpm run check:source`
- `git diff --check -- <Wave21 scope>`
- dependency manifest diff check
- parser/file-picker/decode/raster scan over changed production files

## 13. Early Escape / User Decision Points

Orch-Sylph は次の場合、独断で大きな設計変更をせず `escalate` する。

- Structured PSD profile requires package migration beyond one wave.
- Existing source manifest contract conflicts with structured profile persistence.
- External PSD parser / image library が必要になる。
- Dependency manifest / lockfile change が必要になる。
- Actual PSD bytes / raster extraction / binary package storage が必要になる。
- UI が actual PSD parsing 済みと誤認される。
- Runtime-core へ PSD-specific DTO を入れないと成立しない。
- Parallel domains が同じ files を編集する必要を発見した。

現時点では、structured source manifest / operation materialization / validator / fixtures / editor projection / e2e に限定するなら、追加のユーザー判断は不要。binary storage、file picker、real parser、image decode は別wave判断が必要。

## 14. Pass Criteria

Wave 21 は次を満たしたとき pass とする。

- Source manifest が structured PSD profile/group/layer/adapter evidence を永続化できる。
- `importPsdSourceAsset` が adapter result から structured profile を materialize できる。
- Validator が structured PSD profile を読み、unsupported features / missing provenance / mismatch を structured diagnostics として観測できる。
- Fixtures が structured persistence evidence を固定し、actual PSD bytes parsed とは主張していない。
- Editor が structured PSD profile を truthful に要約し、save/load 後も projection が残る。
- Split PNG source intake compatibility が壊れていない。
- No external PSD/image dependency、no file picker、no binary storage、no raster extraction。
- `index.ts` は barrel-only のままで、巨大 source file / catch-all source file が増えていない。
- Domain completion、clean integration review、final report が `discussion/implementation/` 配下に残る。
