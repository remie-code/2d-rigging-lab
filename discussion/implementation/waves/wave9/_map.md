# Wave 9 Map

> Wave: `ai-command-approval-ui-and-transcript-persistence`
> Status: Completed / implementation-proven
> Date: 2026-05-29

## Files

| Path | Role | Status |
|---|---|---|
| [wave9-domain-completion-report.md](wave9-domain-completion-report.md) | Domain A-H の統合 completion report | pass |
| [integration-review.md](integration-review.md) | Wave-level integration review | pass |
| [wave9-final-report.md](wave9-final-report.md) | Wave 9 final report | pass |

## Summary

Wave 9 は Wave 8 の AI command semantics を変えずに、editor UI 上へ visible AI approval workflow を追加した。

実装済みの範囲:

- deterministic AI `createParameter` dry-run。
- UI 上の approve / reject-clear / commit。
- approval-gated commit through `aiCommandHost` / `operation-core`。
- AI command transcript document の project persistence。
- load 後の transcript history 復元。
- load 後に actionable pending / approved operation を復元しない安全境界。
- desktop / mobile e2e smoke による approval UI、transcript persistence、horizontal overflow 検証。

## Next

推奨 next wave: `ai-command-transport-adapter-foundation`。

外部 caller がまだ不要な場合は、代替として visible AI operation catalog を `createParameter` 以外へ広げる wave を検討できる。
