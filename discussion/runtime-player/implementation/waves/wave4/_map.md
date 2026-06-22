# Runtime Player Wave4 Wave Reports Map

> Runtime Player Wave4 completion reports for iFacialMocap UDP receive, parse/normalize, and Control diagnostics.

## Status

- Wave: `runtime-player-ifacialmocap-receive-tracking-debug`
- Verdict: pass
- Final report: [runtime-player-wave4-final-integration-report.md](runtime-player-wave4-final-integration-report.md)
- Final review: [../../reviews/wave4/runtime-player-wave4-final-clean-integration-review.md](../../reviews/wave4/runtime-player-wave4-final-clean-integration-review.md)

## Reports

| Path | Status | Content |
|---|---|---|
| [runtime-player-wave4-domain-a-input-contract-parser-normalizer-report.md](runtime-player-wave4-domain-a-input-contract-parser-normalizer-report.md) | Pass | Domain A report for the input bridge contract, iFacialMocap parser, normalized `TrackingFrame`, normalizer, and focused parser/normalizer tests. |
| [runtime-player-wave4-domain-b-udp-receiver-control-diagnostics-report.md](runtime-player-wave4-domain-b-udp-receiver-control-diagnostics-report.md) | Pass | Domain B report for UDP receive lifecycle, optional iPhone start request, main-owned diagnostics state, 10Hz renderer diagnostics throttle, Control diagnostics UI, Copy diagnostics, and tests. |
| [runtime-player-wave4-final-integration-report.md](runtime-player-wave4-final-integration-report.md) | Pass | Domain C final integration report and closeout evidence for Wave4. |

## Manual Verification Remaining

- Run Runtime Player and perform the loopback UDP check to `127.0.0.1:49983`.
- Run Runtime Player with a real iFacialMocap iOS device on the same network.
- Confirm passive listen, optional start request, remote endpoint, FPS, packet count, raw/parsed/normalized diagnostics, and Copy diagnostics.
- Confirm Stage Window remains capture-clean and does not move from tracking input.
- Capture real-device evidence for blendshape names/ranges, axis signs, head position units, firewall/iOS permission behavior, multi-NIC behavior, and passive-vs-handshake behavior.
