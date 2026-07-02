# Delegation Calibration Log

> [../premises/model-allocation-policy.md](../premises/model-allocation-policy.md) の較正ループの記録。委任ごとに L0（Fable）が報告品質を採点する。

## Round 1（2026-07-02）— 01-eyeball-x API 調査

| 委任 | モデル | 問いの性質 | 結果 | 採点 |
|---|---|---|---|---|
| Sylph B（知覚経路） | opus | 解釈的（存否の見立て + 特徴づけ） | 88k tokens / 281s | **高品質**。証拠パス精密、「問いの外の気づき」4 件が全て急所（特に `RendererBackend.render(): void` の構造指摘）、推測と事実の分離が律儀 |
| Sylph A（6 操作 + ライフサイクル） | sonnet | 機械的追跡だが**問いが広かった** | 122k tokens / 823s | **失敗混じり**。長走中の内部 compaction 起因とみられる confabulation（実在しない「前回セッション」への言及、「リポジトリが作り替えられた」誤報。L0 の git/ls 裏取りで反証済み）。ただし事実の芯（createEndsCenter、createParameter、dryRun/commit）は正確で救済可能だった。報告構成も委任した問いと不一致 |
| Sylph A2（未回収 5 点） | sonnet | 機械的追跡、**狭い問い + アンカーパス指定 + git 考古学禁止** | 115k tokens / 134s | **高品質**。ギャップ 3 件（host 不在 / Validate 入口無し / CLI 無し）の発見を含む。問いの外の気づきも的確 |
| Sylph A3（host 実装の apps/ 内探索） | sonnet | 機械的追跡、単一の問い | 36k tokens / 39s | **高品質・低コスト**。「無い」の確定 + 副産物（Editor は operation-core 直叩き）が分岐議論の核心になった |
| Sylph B2（Export 変換パス） | sonnet | 機械的追跡、単一の問い | 97k tokens / 86s | **高品質**。変換ロジックの Node 実行可能性を層別に確定し、分岐 2 を偽の二択と見抜く材料を提供 |

## Round 1 の教訓（運用更新）

- **sonnet は機械的追跡に足る。ただし条件付き**: ①問いを狭く切る ②確認済みアンカーパスから開始させる ③履歴調査（git 考古学）を明示的に禁止する。この 3 点を委任文に含めること。
- 広い問い × sonnet は「騒がしい失敗」（confabulation）を起こした。方針文書の「曖昧な問い × 安いモデル」リスクの実例。
- 解釈的調査への opus は適正。fable を使う必要は現時点で認められない。
- サブエージェント報告は必ず L0 で安価に裏取りしてから採用する（Round 1 では git log + ls の 1 コマンドで confabulation を検出できた）。
