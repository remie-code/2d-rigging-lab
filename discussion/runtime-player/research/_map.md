# Runtime Player Research Map

> Runtime Player / Capture Host appの外部仕様・入力ソース・成立性調査。

## Files

| Path | Status | Content |
|---|---|---|
| [ifacialmocap-input-adapter-research.md](ifacialmocap-input-adapter-research.md) | Draft / initial research captured | iFacialMocapのUDP/TCP/VMC関連仕様、desktop host必要性、adapter設計含意 |
| [broadcast-capture-paths.md](broadcast-capture-paths.md) | Direction updated through Wave10 source/tests; manual OBS product-confidence checks pending | OBS Browser Sourceをfixed primary broadcast pathとし、native Stage Windowはlocal preview/fallback、Spout2はBrowser Sourceのcritical failureまでdeferredとする方針。Wave10はduplicate native local preview live renderingをsuspendし、diagnostics samplingとresync de-duplicationを追加 |

## Current Research Basis

- iFacialMocap公式developer pageに、PCソフトを介さないUDP/TCP受信仕様がある。
- Warudo documentationは、iFacialMocap / FaceMotion3DをARKit系face tracking sourceとして扱っている。
- Browser-only runtimeは任意UDP/TCP受信に向かないため、desktop hostが必要になる可能性が高い。
- Broadcast outputはWave10後、Browser Source fixed primary pathである。Runtime Playerは`127.0.0.1` loopback server、tokenized Browser Source URL、token-gated Runtime Export/live parameter transport、transparent model-only Browser Source Stage client、Control diagnosticsを実装済み。
- Native Stage Windowは`Local Preview / Fallback`として残る。Wave8のWindow/Game Capture-first assumptionはprimary pathとしてはsuperseded。
- Browser Source client接続中はnative local preview live renderingだけをsuspendする。Browser Source rendering、input processing、mapping、body follow、dynamics、Runtime Export state、Stage transform syncはactiveのまま維持する。
- Controlはlocal preview suspensionを表示し、live-frame statusとrepeated renderer diagnosticsをsampleしつつ、server/client/export/renderの重要transitionを即時に反映する。
- Browser Source Runtime Export resyncは同一payload適用をde-duplicateし、replacement payload、reload、reconnectを維持する。
- Spout2、obs-websocket、automatic OBS source creation、automatic OBS capture verificationは未実装でout of scope。

## Next Research

1. post-Wave10 manual OBS Browser Source checklistでRuntime Player URL、alpha、WebGL2、live motion、body follow/dynamics、Stage transform sync、local preview suspension/resume、reload/resync、perceived performance、audio meterを実機確認する。
2. Browser Source manual probeがcritical failureした場合だけ、Spout2 sender feasibilityを別wave候補として調査する。
3. 現行iOS版iFacialMocapでの実設定画面とhandshake挙動を実機で確認する。
4. UDP/TCPの安定性、遅延、長時間運用時の挙動を実験する。
