# AI Cohost Implementation Screens Map

> ai-cohost実装フェーズの画面責務とUX定義(runtime-playerのscreens/流儀)。wave化の前に定義を要するのはC1/C3/C4の3画面のみ([../closed-problem-decomposition.md](../closed-problem-decomposition.md) §5)。

## Files

| Path | Status | Content |
|---|---|---|
| [c1-role-skeleton.md](c1-role-skeleton.md) | 振る舞い・見せ方ともAccepted(2026-07-10)。§7.7にC1実装反映 | 三枚の扉と玄関、閉扉の作法と招待の木、ランタイム独立の不変条件、C1ゲートとの対応、見せ方(役割バッジ/Companionカード/トレイ/閉扉ダイアログ/玄関) |
| [c3-physiology-profile.md](c3-physiology-profile.md) | Accepted(2026-07-11)。§3.1にキャプション12本(追撃F実装済み) | `Physiology` ページ: Stage=常時プレビュー(プレビューボタン不在)、質感語スライダー(Blink/Gaze/Head/Posture/Stage Presence)、Dynamics Tune方式の自動保存、既定Offトグル(Stage Presence)、「無いもの」リスト、空状態2つ |
| [c4-channel-diagnostics.md](c4-channel-diagnostics.md) | Accepted(2026-07-11) | `Channel` ページ(開閉スイッチ・Copy URL・Active overlays+TTL・イベントログ)、自律ホスト版Overview(カード3枚、サブシステム有無data方式)、degradedページ解消(Input/Mapping空状態・Motion Safety誘導・Header Drive表示) |

C1〜C4のUX定義が揃った(閉問題分解§5の指定3枚+C4は自律Control整備を含む)。

## Next Questions

1. C4のcontext-check → 棚卸し → wave計画。
