# Runtime Player Research Map

> Runtime Player / Capture Host appの外部仕様・入力ソース・成立性調査。

## Files

| Path | Status | Content |
|---|---|---|
| [ifacialmocap-input-adapter-research.md](ifacialmocap-input-adapter-research.md) | Draft / initial research captured | iFacialMocapのUDP/TCP/VMC関連仕様、desktop host必要性、adapter設計含意 |

## Current Research Basis

- iFacialMocap公式developer pageに、PCソフトを介さないUDP/TCP受信仕様がある。
- Warudo documentationは、iFacialMocap / FaceMotion3DをARKit系face tracking sourceとして扱っている。
- Browser-only runtimeは任意UDP/TCP受信に向かないため、desktop hostが必要になる可能性が高い。

## Next Research

1. 現行iOS版iFacialMocapでの実設定画面とhandshake挙動を実機で確認する。
2. UDP/TCPの安定性、遅延、長時間運用時の挙動を実験する。
3. Runtime Player app stackの候補を比較する。
