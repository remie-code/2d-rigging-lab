# Runtime Player Research Map

> Runtime Player / Capture Host appの外部仕様・入力ソース・成立性調査。

## Files

| Path | Status | Content |
|---|---|---|
| [ifacialmocap-input-adapter-research.md](ifacialmocap-input-adapter-research.md) | Draft / initial research captured | iFacialMocapのUDP/TCP/VMC関連仕様、desktop host必要性、adapter設計含意 |
| [broadcast-capture-paths.md](broadcast-capture-paths.md) | Direction updated through Wave19; bounded cadence evidence recorded, product-confidence checks pending | OBS Browser Sourceをfixed primary broadcast pathとし、native Stage Windowはlocal preview/fallback、Spout2はBrowser Sourceのcritical failureまでdeferredとする方針。Wave10 suspension/resync境界とWave19 OBS/Chrome/Edge cadence observationを反映 |

## Current Research Basis

- iFacialMocap公式developer pageに、PCソフトを介さないUDP/TCP受信仕様がある。
- Warudo documentationは、iFacialMocap / FaceMotion3DをARKit系face tracking sourceとして扱っている。
- Browser-only runtimeは任意UDP/TCP受信に向かないため、desktop hostが必要になる可能性が高い。
- Broadcast outputはWave10後、Browser Source fixed primary pathである。Runtime Playerは`127.0.0.1` loopback server、tokenized Browser Source URL、token-gated Runtime Export/live parameter transport、transparent model-only Browser Source Stage client、Control diagnosticsを実装済み。
- Native Stage Windowは`Local Preview / Fallback`として残る。Wave8のWindow/Game Capture-first assumptionはprimary pathとしてはsuperseded。
- Browser Source client接続中はnative local preview live renderingだけをsuspendする。Browser Source rendering、input processing、mapping、body follow、dynamics、Runtime Export state、Stage transform syncはactiveのまま維持する。
- Controlはlocal preview suspensionを表示し、live-frame statusとrepeated renderer diagnosticsをsampleしつつ、server/client/export/renderの重要transitionを即時に反映する。
- Browser Source Runtime Export resyncは同一payload適用をde-duplicateし、replacement payload、reload、reconnectを維持する。
- Waves11–18 add Stage Motion, Variant switching, frame pacing, evaluation cache, compiled/render-frame fast paths, and lightweight product diagnostics. Wave18 removes product deep-profile transport; internal deep profiling is developer/test-only.
- Wave19 tracked captures compare OBS/CEF with Chrome/Edge and Native Stage. They are objective cadence evidence only; platform/URL provenance, alpha/WebGL2/model parity, subjective smoothness, and real iFacialMocap motion remain unverified product gates.
- Wave21 Runtime Dynamics Tune is Domain A/B pass with Domain C parity/persistence/reset/isolation/artifact checks pending. Waves22/23 source/test/review pass but real vowel-rig speech behavior remains pending.
- Spout2、obs-websocket、automatic OBS source creation、automatic OBS capture verificationは未実装でout of scope。

## Next Research

1. Real Runtime Export + OBS Browser SourceでURL、alpha、WebGL2、model/live motion、body follow/dynamics, Stage Motion/Variant parity、local preview suspension/resume、reload/resync、audio meterを実機確認する。Wave19 logs remain objective evidence, not acceptance.
2. Real iFacialMocap + vowel-rigでWave22/23 gate（closed-vowel coupling, transition smoothness, “e” parasitism, “u” jitter, unsmoothed-step acceptability）を確認する。
3. Packaged/dev Electron lifecycle smoke（Control close quit, direct Stage close recovery, Focus Stage reopen）とWave21 Dynamics Tune persistence/reset/isolation/artifact immutabilityを確認する。
4. Browser Source manual probeがcritical failureした場合だけ、Spout2 sender feasibilityを別wave候補として調査する。
5. 現行iOS版iFacialMocapでの実設定画面とhandshake挙動、UDP/TCPの安定性・遅延・長時間運用時の挙動を実機で確認する。
