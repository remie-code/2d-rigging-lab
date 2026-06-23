# Runtime Player Research Map

> Runtime Player / Capture Host appの外部仕様・入力ソース・成立性調査。

## Files

| Path | Status | Content |
|---|---|---|
| [ifacialmocap-input-adapter-research.md](ifacialmocap-input-adapter-research.md) | Draft / initial research captured | iFacialMocapのUDP/TCP/VMC関連仕様、desktop host必要性、adapter設計含意 |
| [broadcast-capture-paths.md](broadcast-capture-paths.md) | Direction accepted and implemented by Wave8 source/tests | OBS Window/Game Captureを先に扱い、Spoutは近い将来のfeasibility trackとして残す方針。Wave8はStage Window capture-target UXを実装済み |

## Current Research Basis

- iFacialMocap公式developer pageに、PCソフトを介さないUDP/TCP受信仕様がある。
- Warudo documentationは、iFacialMocap / FaceMotion3DをARKit系face tracking sourceとして扱っている。
- Browser-only runtimeは任意UDP/TCP受信に向かないため、desktop hostが必要になる可能性が高い。
- Broadcast Stage v0では、既存Stage Windowをcapture targetにする方針をWave8で実装済み。Spoutは配信用outputとして有力だが、native/GPU texture sharing・OBS plugin・packagingの重さがあるため、まずfeasibility investigationに分ける。
- Wave8はOBS automation/source creation/readiness detectionを実装していない。Capture Target checklistはRuntime Player内のlocal readinessのみを示す。

## Next Research

1. OBS Window Capture / Game CaptureでStage Window title selection、alpha、capture安定性を実機確認する。
2. Spout sender feasibilityを別wave候補として調査する。
3. 現行iOS版iFacialMocapでの実設定画面とhandshake挙動を実機で確認する。
4. UDP/TCPの安定性、遅延、長時間運用時の挙動を実験する。
