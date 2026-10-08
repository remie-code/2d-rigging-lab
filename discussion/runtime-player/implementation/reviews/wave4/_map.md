# Runtime Player Wave4 Reviews Map

> Review reports for Runtime Player Wave4: iFacialMocap UDP receive, parser/normalizer, and Control diagnostics/debug.

## Status

- Wave: `runtime-player-ifacialmocap-receive-tracking-debug`
- Overall review verdict: pass
- Final clean integration review: [runtime-player-wave4-final-clean-integration-review.md](runtime-player-wave4-final-clean-integration-review.md)

## Review Reports

| Path | Verdict | Lane |
|---|---|---|
| [runtime-player-wave4-domain-a-spec-compliance-review.md](runtime-player-wave4-domain-a-spec-compliance-review.md) | Pass | Domain A spec compliance |
| [runtime-player-wave4-domain-a-design-development-review.md](runtime-player-wave4-domain-a-design-development-review.md) | Pass | Domain A design / development compliance |
| [runtime-player-wave4-domain-a-test-adequacy-review.md](runtime-player-wave4-domain-a-test-adequacy-review.md) | Pass | Domain A test adequacy |
| [runtime-player-wave4-domain-b-spec-compliance-review.md](runtime-player-wave4-domain-b-spec-compliance-review.md) | Pass | Domain B spec compliance |
| [runtime-player-wave4-domain-b-design-development-review.md](runtime-player-wave4-domain-b-design-development-review.md) | Pass | Domain B design / development compliance |
| [runtime-player-wave4-domain-b-test-adequacy-review.md](runtime-player-wave4-domain-b-test-adequacy-review.md) | Pass | Domain B test adequacy |
| [runtime-player-wave4-final-clean-integration-review.md](runtime-player-wave4-final-clean-integration-review.md) | Pass | Final clean integration review |

## Non-Blocking Follow-Up Items

- Real-device iFacialMocap verification remains required for firewall, iOS local network permission, multi-NIC behavior, passive-vs-handshake behavior, axis signs, and head position units.
- Socket error forwarding through the main bridge is source-reviewed but can receive an additional focused automated test.
- Control diagnostics are source-reviewed/manual-checklisted rather than covered by React UI tests.
- Control Window input source code should be split before adding more Control features.
- NIC selection, persisted iPhone IP/receive port, TCP transport, and runtime parameter mapping remain later-wave decisions.
