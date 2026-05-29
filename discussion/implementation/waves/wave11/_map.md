# Wave 11 Map

> Wave: `ai-operation-catalog-expansion-keyform-foundation`
> Status: Completed / implementation-proven
> Date: 2026-05-29

## Files

| Path | Role | Status |
|---|---|---|
| [wave11-domain-completion-report.md](wave11-domain-completion-report.md) | Domain A-G の統合 completion report | pass |
| [integration-review.md](integration-review.md) | Wave-level integration review | pass |
| [wave11-final-report.md](wave11-final-report.md) | Wave 11 final report | pass |

## Summary

Wave 11 は AI operation catalog を `createParameter` から keyform foundation へ拡張した。

実装済みの範囲:

- authoring-core keyform mutation / selector foundation。
- `addKeyform` operation handler。
- `addKeyformGrid2d` operation handler。
- operation registry / lifecycle integration。
- operation result `checkedTargetRefs` preservation。
- editor evidence support for keyform operations。
- AI host regression for `addKeyform` dry-run / approval / commit / inspect / validate / operation-log。

UI keyform editor、external HTTP/WebSocket/MCP transport、runtime-visible keyform deformation、dynamics operations、rig-control operations、repair generation は実装していない。

## Next

推奨 next wave: `runtime-keyform-evaluation-foundation`。

Wave 11 で keyform は authoring/package/operation-log/evidence に永続化されるようになった。一方で runtime snapshot はまだ keyform patch を drawable/mesh へ反映しない。次は、実装済みの keyform data path を runtime evaluation へ接続するのが自然。

