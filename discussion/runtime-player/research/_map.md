# Runtime Player Research Map

> Runtime Player / Capture Host appの外部仕様・入力ソース・成立性調査。

## Files

| Path | Status | Content |
|---|---|---|
| [ifacialmocap-input-adapter-research.md](ifacialmocap-input-adapter-research.md) | Draft / initial research captured | iFacialMocapのUDP/TCP/VMC関連仕様、desktop host必要性、adapter設計含意 |
| [broadcast-capture-paths.md](broadcast-capture-paths.md) | Direction updated by Wave9 source/tests; manual OBS probe pending | OBS Browser Sourceをprimary broadcast candidateとしてprobeし、native Stage Windowはlocal preview/fallback、Spout2はBrowser Sourceのcritical failureまでdeferredとする方針 |

## Current Research Basis

- iFacialMocap公式developer pageに、PCソフトを介さないUDP/TCP受信仕様がある。
- Warudo documentationは、iFacialMocap / FaceMotion3DをARKit系face tracking sourceとして扱っている。
- Browser-only runtimeは任意UDP/TCP受信に向かないため、desktop hostが必要になる可能性が高い。
- Broadcast outputはWave9でBrowser Source-first probeへ更新済み。Runtime Playerは`127.0.0.1` loopback server、tokenized Browser Source URL、token-gated Runtime Export/live parameter transport、transparent model-only Browser Source Stage client、Control diagnosticsを実装済み。
- Native Stage Windowはlocal preview / fallbackとして残る。Wave8のWindow/Game Capture-first assumptionはprimary pathとしてはsuperseded。
- Spout2、obs-websocket、automatic OBS source creation、automatic OBS capture verificationは未実装でout of scope。

## Next Research

1. OBS Browser SourceでRuntime Player URL、alpha、WebGL2、live motion、reload/resync、audio meterを実機確認する。
2. Browser Source manual probeがcritical failureした場合だけ、Spout2 sender feasibilityを別wave候補として調査する。
3. 現行iOS版iFacialMocapでの実設定画面とhandshake挙動を実機で確認する。
4. UDP/TCPの安定性、遅延、長時間運用時の挙動を実験する。
