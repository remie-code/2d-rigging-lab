# AI Cohost Implementation Screens Map

> ai-cohost実装フェーズの画面責務とUX定義(runtime-playerのscreens/流儀)。C1/C3/C4/S2.5 の定義に加え、S8以降の操縦席改定を現在の入口として索引する。

## Files

| Path | Status | Content |
|---|---|---|
| [c1-role-skeleton.md](c1-role-skeleton.md) | 振る舞い・見せ方ともAccepted(2026-07-10)。§7.7にC1実装反映 | 三枚の扉と玄関、閉扉の作法と招待の木、ランタイム独立の不変条件、C1ゲートとの対応、見せ方(役割バッジ/Companionカード/トレイ/閉扉ダイアログ/玄関) |
| [c3-physiology-profile.md](c3-physiology-profile.md) | Accepted(2026-07-11)。§3.1にキャプション12本(追撃F実装済み) | `Physiology` ページ: Stage=常時プレビュー(プレビューボタン不在)、質感語スライダー(Blink/Gaze/Head/Posture/Stage Presence)、Dynamics Tune方式の自動保存、既定Offトグル(Stage Presence)、「無いもの」リスト、空状態2つ |
| [c4-channel-diagnostics.md](c4-channel-diagnostics.md) | Accepted(2026-07-11) | `Channel` ページ(開閉スイッチ・Copy URL・Active overlays+TTL・イベントログ)、自律ホスト版Overview(カード3枚、サブシステム有無data方式)、degradedページ解消(Input/Mapping空状態・Motion Safety誘導・Header Drive表示) |
| [soul-cockpit.md](soul-cockpit.md) | Accepted(2026-07-12)。S2.5実装のsource of truth | 魂のローカルWeb操縦席。S3以降のFire/Channel/タイムライン拡張と、C4/S7までの運用面を索引する。 |
| [cockpit-redesign.md](cockpit-redesign.md) | モック承認・実装反映(2026-07-14)。本文のDraft表記は設計履歴 | 観測/運転/設定の三層IA、常駐運転バー、畳める設定引き出し。preact+htm standaloneの現在UI source。 |

C1〜C4のUX定義が揃った(閉問題分解§5の指定3枚+C4は自律Control整備を含む)。

## Next Questions

1. S8 KILL 状態・通常発話無退行の人間ゲートは [../orchestration/s8-wave-plan.md](../orchestration/s8-wave-plan.md) を参照。
2. 多頭化・配信間記憶の設定/観測面は実装済み。最終人間ゲートの記録は [../orchestration/brain-swap-wave-plan.md](../orchestration/brain-swap-wave-plan.md) / [../orchestration/stream-memory-wave-plan.md](../orchestration/stream-memory-wave-plan.md) に残す。
