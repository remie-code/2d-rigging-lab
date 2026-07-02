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

## Round 2（2026-07-02）— Wave103 実装 wave（実装・オーケストレーション・レビュー全層）

| 委任 | モデル | 結果 | 採点 |
|---|---|---|---|
| Gnome ×2（host CLI / rasterizer） | opus | 両ドメインともループ 1 回・レビュー 3 レーン一発 pass | **実装品質十分**。設計判断の迷い（4 件）を独自解釈せず質問として報告に載せる規律も遵守 |
| Review-Sylph ×7 レーン | opus | 全レーン pass、blocking 0 | **全レーンが独立再現・実証ベース**。golden 値のオウム返し検出、byte-exact 照合、L0 分類の独立裏取り、上流報告の誤記補正（lockfile 行番号）まで。「品質は Review-Sylph が握る」を裏付け |
| Orch-Sylph ×3 | opus | 全ドメイン完遂。ただしハンドリング規則確立前は「背景起動→通知待ち」アンチパターンを 3 者とも踏んだ | 規則確立後は精密な運転に転換。**問題はモデル能力ではなくハーネス手順知識**であり、SKILL.md への規則明文化（2026-07-02）で解決 |

- 教訓: 実装 wave は opus 帯で品質十分。fable の委任使用は引き続き不要（L0 判断・対話・実験に温存）。
- 運用系の教訓は `.claude/skills/implementation-orchestration/SKILL.md` の「サブエージェント・ハンドリング規則」に恒久化済み。

## Round 3（2026-07-03）— Wave104 実装 wave

| 層 | モデル | 結果 |
|---|---|---|
| Orch-Sylph ×4 | opus | 全ドメイン完遂。ハンドリング規則下で待機報告・孤児ゼロ・重複起動ゼロの規律運転 |
| Gnome ×3 + 修正 3 回 | opus | 全ドメイン一発実装（修正はレビュー起因のみ、全て 1 ループ収束）。escalate 規律も機能（Domain C の §3.4 escalate は模範例） |
| Review-Sylph 9 レーン + 再検証 4 + final clean | opus | **本物の品質ゲートとして 2 度機能**: ①Domain A フィクスチャ無変形（自前プローブで検出、実装と他 2 レーンは素通し）②Domain C 型負債 10 件。「品質は Review-Sylph が握る」を再々実証 |

- ハーネス実測（SKILL.md 規則 1-3 の 2026-07-03 改訂に反映済み）: ①L1 の子起動はフォアグラウンド指定でも async 化される → 「起動 → 待機報告 → L0 中継」が実効プロトコル ②子→親の SendMessage は届かない（報告は L0 に浮上し中継される）③ツール呼び出しが本文テキスト化してターンが切れる事故 1 件（resume で回復）④install 必要時に Gnome が escalate せず自前配線 → 規則 8 に「回避工作禁止」を追記。
- モデル結論: 実装 wave は全層 opus で品質十分（fable 委任ゼロ継続、sonnet は本 wave では不使用）。L0（fable）の実仕事は裁定 3 件 + 中継 ~15 回 + 計画改訂 3 箇所。

## Round 1 の教訓（運用更新）

- **sonnet は機械的追跡に足る。ただし条件付き**: ①問いを狭く切る ②確認済みアンカーパスから開始させる ③履歴調査（git 考古学）を明示的に禁止する。この 3 点を委任文に含めること。
- 広い問い × sonnet は「騒がしい失敗」（confabulation）を起こした。方針文書の「曖昧な問い × 安いモデル」リスクの実例。
- 解釈的調査への opus は適正。fable を使う必要は現時点で認められない。
- サブエージェント報告は必ず L0 で安価に裏取りしてから採用する（Round 1 では git log + ls の 1 コマンドで confabulation を検出できた）。
