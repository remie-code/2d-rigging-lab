# Current Capability / Backlog 改稿レビュー - 2026-06-04

## 判定

`pass`

## レビュー範囲

- rewrite 対象:
  - `discussion/implementation/current-capability-map.md`
  - `discussion/implementation/remaining-work-backlog.md`
- 根拠と reports:
  - `discussion/implementation/reports/current-capability-backlog-inventory-2026-06-04.md`
  - `discussion/implementation/reports/current-capability-backlog-rewrite-summary-2026-06-04.md`
  - `discussion/implementation/waves/wave39/wave39-final-report.md`
  - `discussion/implementation/reviews/wave39/wave39-clean-integration-review.md`
  - `discussion/implementation/_map.md`
  - `discussion/implementation/orchestration/_map.md`
- Doc-Orch-Sylph から提供された受理済み AI/Codex boundary。
- Git diff/status と local Markdown link/path plausibility checks。

## 所見

blocking findings なし。

## 評価基準の確認

- Capability-map bloat: pass。`current-capability-map.md` は Wave update chronology ではなく、82行の current capability map になっている。
- Backlog concision/classification: pass。`remaining-work-backlog.md` は accepted decisions、repository facts、no-extra-decision candidates、user-decision gates、dependency/security/rights/UX gates、explicit non-goals、documentation/quality debt を分離している。
- AI/Codex boundary: pass。rewritten docs は、inference、repair design、natural-language judgment、repair candidate generation/ranking が Codex の責務であり、repo は deterministic intake/read/validation/dry-run/diff/approval/transcript/evidence surface を持つと記述している。repo-side LLM、auto-fix、candidate generation、candidate ranking は主張していない。
- Truthfulness: pass。Product Preflight v0 は session-generated/read-only で Wave39 により implementation-proven と位置付けられ、parser/decode/archive/filesystem/renderer/pixel/Cubism/AI repair support は unsupported または future scope のまま。
- Link/path usefulness: pass。rewritten docs と summary の local Markdown links は解決する。
- Scope: pass。確認された changed scope は rewrite 対象2件と inventory/summary reports を含む。この review は許可された review artifact のみを追加した。

## 非ブロッキングのメモ

- `discussion/implementation/orchestration/_map.md` には、Wave40 が deterministic repair candidates を追加するという記述がまだ残っている。rewritten backlog と summary はこれを follow-up AI-boundary reconciliation work として正しく記録しているため、Doc-Gnome rewrite の blocker ではない。
- `discussion/implementation/_map.md` には、backlog entry と Wave40 selection 周辺に古い map wording がまだ残っている。rewritten backlog も map refresh を follow-up として記録しているため、この rewrite で target-doc change は不要。

## 実施した検証

- `git diff --check -- discussion/implementation/current-capability-map.md discussion/implementation/remaining-work-backlog.md discussion/implementation/reports/current-capability-backlog-rewrite-summary-2026-06-04.md discussion/implementation/reviews/current-capability-backlog-rewrite-review-2026-06-04.md`: pass; Git は tracked rewritten files 2件についてのみ LF-to-CRLF working-copy warnings を報告した。
- `git status --short -uall discussion/implementation/current-capability-map.md discussion/implementation/remaining-work-backlog.md discussion/implementation/reports discussion/implementation/reviews`: reviewed。
- `git diff -- discussion/implementation/current-capability-map.md discussion/implementation/remaining-work-backlog.md discussion/implementation/reports/current-capability-backlog-rewrite-summary-2026-06-04.md`: reviewed。
- rewritten targets と rewrite summary 全体の Markdown link/path existence check: pass。
- rewritten docs、summary、implementation map、orchestration map 全体の targeted AI-boundary wording scan: reviewed。
- rewrite 対象2件の Wave-bloat scan: reviewed。簡潔な Wave39 references のみが残っている。

## ユーザー判断点

- この rewrite を受け入れるために必要な判断はない。
- 将来の map/plan reconciliation では、Wave40 が計画として残るかを確認するべき。残る場合は repo-side repair candidate generation ではなく、Codex-proposed candidate intake と deterministic repo-side validation/diff/approval/evidence を中心に再構成するべき。

## 今後の対応項目

- Wave40 を implementation basis として使う前に、`discussion/implementation/orchestration/_map.md` と `discussion/implementation/orchestration/wave40-plan.md` を受理済み AI/Codex boundary と整合させる。
- Wave40 authority decision の後、`discussion/implementation/_map.md` の backlog/Wave40 wording を refresh する。
