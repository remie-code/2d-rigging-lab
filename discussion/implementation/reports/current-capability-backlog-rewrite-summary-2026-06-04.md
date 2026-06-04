# Current Capability / Backlog 改稿サマリー - 2026-06-04

## 範囲

改稿対象:

- `discussion/implementation/current-capability-map.md`
- `discussion/implementation/remaining-work-backlog.md`

この簡潔な summary は、許可された report scope の中で作成した。

## 根拠

- `discussion/implementation/reports/current-capability-backlog-inventory-2026-06-04.md`
- `discussion/implementation/waves/wave39/wave39-final-report.md`
- `discussion/implementation/reviews/wave39/wave39-clean-integration-review.md`
- `discussion/implementation/_map.md`
- `discussion/implementation/orchestration/_map.md`
- タスクで指定された discussion/orchestration skills。

## 適用した境界

この rewrite は、受理済みの AI/Codex 責務分担を適用した。

- inference、natural-language judgment、repair design、repair proposal generation/ranking は Codex の責務。
- repo/tool の責務は deterministic Codex-facing state read、operation catalog、proposal validation、dry-run、diff surface、rerun validation surface、approval-gated commit、transcript、evidence recording。
- docs では、repo-side AI repair candidate generation を実装済み capability または planned capability として記述しないようにした。

## 変更内容

- `current-capability-map.md` を wave-update chronology から current product capability map に変換した。構成は product purpose、authoring/editor、rigging/mesh/deformation/dynamics、validator/Product Preflight、package/persistence/transport、asset I/O、AI/Codex-facing API、Viewer/Preview、future scope、non-goals、evidence links。
- `remaining-work-backlog.md` を completed-wave history から concise residual-work index に変換した。no-extra-decision candidates、user-decision gates、dependency/security/rights/UX gates、future scope/non-goals、documentation/quality debt を分けている。
- Wave39 completion state を維持しつつ、unsupported parser/decode/archive/filesystem/renderer/pixel/Cubism/AI-inference claims を明示したままにした。
- 汎用的な AI repair wording を、Codex-proposed operation intake / validation / dry-run / diff / rerun validation / approval / transcript wording に置き換えた。

## 今後の対応項目

- Wave40 が計画として残る場合、`discussion/implementation/orchestration/wave40-plan.md` は受理済み AI/Codex boundary と整合させる必要がある。
- `discussion/implementation/orchestration/_map.md` も同じ Wave40 wording と整合させる必要がある。
- Wave40 authority が確認された後、`discussion/implementation/_map.md` は短い status refresh が必要になる可能性がある。

## 検証

- `git diff --check -- discussion/implementation/current-capability-map.md discussion/implementation/remaining-work-backlog.md discussion/implementation/reports/current-capability-backlog-rewrite-summary-2026-06-04.md`: pass; Git は tracked rewritten files 2件についてのみ LF-to-CRLF working-copy warnings を報告した。
- 3つの rewritten/created files 全体に対する local Markdown link/path existence check: pass。
- untracked summary file を含む3つの rewritten/created files 全体に対する追加 trailing-whitespace scan: pass。
