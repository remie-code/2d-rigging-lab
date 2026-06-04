# 残作業 Backlog

> 状態: 2026-06-04 / Wave40 完了。
> 目的: 次の実装境界を選ぶための、残作業と decision gate の簡潔な index。完了済み wave 履歴は final report と map に置き、この backlog には置かない。

## 受理済み判断

- Wave39 Product Preflight v0 は、Editor run/read/save/load/rerun evidence を持つ truthful で session-generated な read-only product report として `implementation-proven`。
- Wave40 Codex-facing proposal API / diff validation surface は、Codex-submitted proposal の deterministic operation catalog、schema/catalog/preflight validation、dry-run diff preview、rerun validation / Product Preflight、approval-gated commit、transcript/evidence recording、Editor review workflow、fixtures、desktop/mobile e2e smoke として `implementation-proven`。
- AI inference と repair proposal generation は Codex 側の責務。
- repo/tool 側の責務は Codex-facing API、state/preflight read、operation catalog、proposal validation、dry-run、diff surface、rerun validation surface、approval-gated commit、transcript、evidence recording。
- repo-side repair candidate generation、candidate ranking、natural-language repair、LLM provider integration、auto-fix は主張しない。
- parser/decode/archive/filesystem/renderer/pixel/Cubism support は、将来の wave がその境界を明示的に変更しない限り unsupported のまま。

## リポジトリ事実

- browser-local project persistence、same-origin IndexedDB byte restore、project-defined portable JSON bundle v0 は実装済み。
- bounded topology/UV direct edit は実装済み。advanced/freeform topology、unwrap、atlas、texture sampling correctness は未実装。
- parser-free PSD adapter/profile metadata は存在する。real PSD/PNG parse/decode/raster extraction/materialization は存在しない。
- Editor Viewer/Preview は semantic inspection/runtime evidence であり、full renderer や pixel oracle ではない。
- AI command support は deterministic read/inspect/validate/dry-run/commit/log/transcript、Product Preflight observation helper/schema、Codex proposal operation catalog、proposal validation、diff preview/rerun validation bridge、approval lifecycle bridge。inference と proposal generation は実行しない。

## 追加判断なしで進められる候補

これらは、現在のプロダクト方針を変えずに implementation task または documentation task として scope できる。

| 候補 | Scope boundary（範囲境界） | 補足 |
|---|---|---|
| Product Preflight follow-up: read/diff/report ergonomics | 既存の Product Preflight v0 に対して、deterministic report comparison、evidence navigation、validation rerun affordance を改善する。 | persistence/export が別途承認されない限り、v0 は session-generated のままにする。 |
| Documentation/map consistency refresh | `discussion/implementation/_map.md`、`discussion/implementation/orchestration/_map.md`、`discussion/implementation/current-capability-map.md`、`discussion/implementation/remaining-work-backlog.md` は Wave40 final report に合わせて同期済み。今後のwave報告時も同じ非目標境界を維持する。 | 次 wave 完了時に final report / maps / backlog へ反映する。 |
| Quality gate tightening | Fresh checkout replay、`check:source` blind spots、e2e decomposition、traceability/doc refresh、validator contract doc refresh、schema cleanup、runtime/viewer naming cleanup、dynamics create-flow atomicity。 | 変更は小さく、file-scoped に保つ。 |
| Product Preflight fixture/traceability sync | warning-gated markdown rows に machine-readable mirror が後で必要になった場合、Wave40 / Wave39 とそれ以前の比較可能な rows をまとめて backfill する。 | 現在の Wave40 / Wave39 review では JSON mirror update なしが受理済み。 |

## ユーザー判断が必要

| 判断 | 方向付けが必要な理由 |
|---|---|
| Wave40 後の次の product priority | 実行可能な候補が focus を取り合う: Product Preflight acceptance gates、Product Preflight durability/export、archive/filesystem、real parser/decode、renderer/pixel oracle、advanced topology/UV、layer tree UX、public/demo assets、Cubism policy reconsideration。 |
| Product Preflight durability | v0 を session-only のままにするか、persisted/exported package artifact と possible release/demo gate input にするかを決める必要がある。 |
| Public/demo asset policy | real rights-clean public assets をいつ許可するか、private/local fixtures を distributable demo assets からどう分離するかを決める必要がある。 |
| Archive/filesystem implementation | project-defined JSON bundle で当面十分か、ZIP/archive、File System Access API、directory picker、drag-drop、native filesystem、cloud/cross-profile persistence を実装するかを決める必要がある。 |
| Real image/PSD pipeline | real PSD/PNG layer/raster/materialization work の前に、parser/decode dependencies、security posture、fixture policy、acceptance oracle を決める必要がある。 |
| Renderer/viewer direction | semantic editor-internal Viewer/Preview を維持するか、standalone/full-renderer/pixel-oracle work を始めるかを決める必要がある。 |
| Cubism compatibility policy | 現在の方針では Cubism SDK/Core、import/export、`.moc3`、`.model3.json`、Cubism Physics は non-goals。compatibility 方向には明示的な承認が必要。 |

## 依存関係 / セキュリティ / 権利 / UX Gate

| Gate | 適用対象 |
|---|---|
| Dependency/license/provenance review | ZIP/archive libraries、PSD/PNG/image decode libraries、renderer libraries、media sniffing utilities。 |
| Malicious file and parser trust boundaries | real PSD/PNG parsing、media signature/header decode、archive import、user-provided binary processing。 |
| Browser permission and UX design | File System Access API、directory picker、drag-drop、native filesystem affordances、persistent storage recovery states。 |
| Rights and fixture policy | public tutorial/demo assets、local sample PSD usage、distributable fixture manifests、public/private asset split。 |
| Storage guarantees | cross-profile/cloud persistence、quota limits、private-browsing behavior、same-origin IndexedDB failure/corruption modes。 |
| Destructive authoring semantics | recursive delete、delete-with-reassign、multi-select bulk changes、group transform、drag/drop reparenting。 |
| Test oracle design | renderer/pixel oracle、texture sampling correctness、automatic triangulation/retopology correctness、atlas/UV unwrap validation。 |

## 明示的な将来範囲 / 非目標

- Cubism SDK/Core integration、Cubism import/export/load compatibility、`.moc3`、`.model3.json`、Cubism Physics compatibility。
- full renderer、standalone viewer app、render target、texture sampling correctness、pixel oracle。
- real PSD/PNG parser/decode/raster extraction/texture materialization/compositing。
- ZIP/archive/native filesystem/cloud transport と drag-drop implementation。
- LLM/provider/prompt integration、repo-side repair reasoning、repair candidate generation/ranking、natural-language repair、auto-fix、automatic commit。
- direct vertex physics、cloth/collision/IK、full timeline bake、motion export、lip sync、video editor、marketplace/registry/plugin distribution、public SDK。

## 文書 / 品質負債

- Wave40 Codex-facing proposal intake と deterministic repo-side validation/diff/approval/transcript 境界は final report、map、capability map へ同期済み。
- Validator contract prose は、新しい byte availability、portable bundle、transport、topology/UV、warp lattice、Product Preflight diagnostics を適切な粒度で列挙するよう refresh するべき。
- E2E smoke coverage は広い。将来の wave が shared Editor workflow に触れる場合は、分解を継続するべき。
- Source organization と `check:source` guardrails は、blind spots が見つかった場所で broad refactor なしに tighten するべき。
- Schema cleanup と runtime/viewer evidence naming cleanup は compatibility-sensitive なため、適切な schema wave まで待つべき。
- Dynamics create-flow atomicity は advanced dynamics expansion の前に再検討するべき。

## Evidence リンクと使い方

| Evidence | リンク |
|---|---|
| Current capability map | [current-capability-map.md](current-capability-map.md) |
| 2026-06-04 inventory report | [reports/current-capability-backlog-inventory-2026-06-04.md](reports/current-capability-backlog-inventory-2026-06-04.md) |
| Implementation map | [_map.md](_map.md) |
| Orchestration map | [orchestration/_map.md](orchestration/_map.md) |
| Wave39 final report | [waves/wave39/wave39-final-report.md](waves/wave39/wave39-final-report.md) |
| Wave39 clean integration review | [reviews/wave39/wave39-clean-integration-review.md](reviews/wave39/wave39-clean-integration-review.md) |
| Wave40 final report | [waves/wave40/wave40-final-report.md](waves/wave40/wave40-final-report.md) |
| Wave40 clean integration review | [reviews/wave40/wave40-clean-integration-review.md](reviews/wave40/wave40-clean-integration-review.md) |

この backlog は [current-capability-map.md](current-capability-map.md) と一緒に使う。wave ごとに decision boundary を1つ選び、完了済み履歴はリンク先 reports に置き、unsupported claims は明示し続ける。
