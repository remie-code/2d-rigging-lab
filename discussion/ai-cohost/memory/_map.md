# Memory Map

> ai-cohost の子トピック: チャッピーの**配信をまたぐ記憶**(何を残し、どう整理し、どう思い出すか)。
> 配信中の記憶(頭の会話・圧縮)は [../research/context-growth-2026-10.md](../research/context-growth-2026-10.md) が受け持つ。ここは配信をまたぐ側。

## 1. Why(ユーザー 2026-10-21)

- 今は起動時に直近 3 件のまとめを全部読む。昨日アークナイツ、今日エルデンリングだと、関係ないアークナイツを思い出してしまう。望ましいのは「エルデンリングの思い出はまだないね」と分かっている状態。
- 話したい相手は「AI が演じるキャラクター」ではなく「AI」。人間のふりは目指さない。「探すからちょっと待ってね」はむしろ自然。チャッピー自身が自然に感じたことは残してよいが、キャラとして演じる方向は求めない。
- 一番覚えていてほしいのは、前の配信の出来事(どのゲームのどこまで、何があったか)。

## 2. Key Files

| Path | Content |
|---|---|
| [../soul/stream-memory.md](../soul/stream-memory.md) | 今の配信間記憶の設計(1 配信 1 まとめ・起動時に直近 3 件を搭載・視聴者名は残さない・OFF の止水栓) |
| [../implementation/orchestration/stream-memory-wave-plan.md](../implementation/orchestration/stream-memory-wave-plan.md) | 今の配信間記憶の実装計画。人間ゲート 4 点は記録上「未確認」 |
| [../implementation/waves/stream-memory/followup.md](../implementation/waves/stream-memory/followup.md) | 持ち越し(日記への合本、記憶の個別選択 UI など) |
| [../decisions/research/talk-avatar-patterns-2026-10.md](../decisions/research/talk-avatar-patterns-2026-10.md) | 知人のトークアバターの判定の組み立て方(参考) |
| [recall-flow.md](recall-flow.md) | 記憶の役(①チャッピー・②書き出し役・③整理役・④思い出し役)、置き場、思い出す流れ、直近の範囲、git 管理と目印の書式。context-check 前の合意 |
| [conventions-draft.md](conventions-draft.md) | 記憶の置き場の決まり(`memories/_conventions.md`)の本文。ユーザー確認済み |
| [../implementation/orchestration/memory-recall-wave-plan.md](../implementation/orchestration/memory-recall-wave-plan.md) | 実装の wave 計画(実装済み・人間ゲート待ち) |
| [research/associative-recall-literature-2026-10.md](research/associative-recall-literature-2026-10.md) | 文献調査: 人間はなぜ話題をまたいで思い出せるか(手がかり・表面と構造の類似・きっかけ)と、LLM エージェントの記憶設計の事例 |
| [research/brain-tools-2026-10.md](research/brain-tools-2026-10.md) | 棚卸し: 頭のツール制限(Codex は read-only + never、Claude は tools:[])と、独自ツールを足す手段(Claude SDK の in-process MCP、Codex の dynamicTools) |

## 3. Current State Summary

- 今の仕組み(棚卸し 2026-10-21):
  - 保存: 1 配信 1 つの md まとめを `apps/soul/agent/memories/` に置く(現在 8 件、全部残っている)。20 分ごと・手動・Ctrl+C で保存。
  - 搭載: 起動時に直近 3 件(4500 字まで)を人格の指示の後ろに付けて、頭の最初のメッセージで渡す。配信中に作ったまとめは、その配信では使われない。
  - 穴: 耳を Stop すると文字起こしの帳面が消え、Stop 後の終了では最後のまとめが作られない。
- 記憶とは(うちの言い方・ユーザー OK): 整理を通って残ったもの。中身は「出来事の本体」「話題ごとの地図」「話題をまたぐ索引」の 3 つ。思い出すとは「きっかけ → 索引 → 本体」をたどること。
- discussion-management の「地図と本体を分ける」考え方を、記憶の構造に当てはめる方針(ユーザーも有用と見ている)。

## 4. Decisions(ユーザー 2026-10-21)

- **直近でやる**
  1. 記憶の構造化: トピック(ゲーム)ごとに分け、目次(地図)と本体を分ける。
  2. 思い出すのをオンデマンドにする: 起動時に全部読むのをやめ、頼まれたとき・頭が目次で気づいたときに取りに行く。頭のツール制限の見直しが要る。
  - 配信前は、動作確認の対話で配信者が「思い出して」と明示する。今日のゲームを選ぶ仕組みは作らない。
- **長い目でやる**
  3. きっかけで思い出す: 基本は「索引を頭が見て自分で気づく」。連想係(Decisions API などで横から連想を判定する)は今のところ過剰。
  4. 記憶の整理の段階: 配信の終わりに、専用の会話で整理する。3 が自然にできるかは、ここの整理の仕方に大きくかかる。
- 配信中に自分から思い出して話題に出すのは歓迎。ただし自然な形で本当に可能かは要検討。
- 耳の Stop でも記憶を残すようにする(対応候補)。Stop → Start 後の「新しい分だけ渡す」の空振りは、運用上ほぼ起きないので気にしない。

## 5. Next Actions

1. 人間ゲート([../implementation/waves/memory-recall/human-gate.md](../implementation/waves/memory-recall/human-gate.md))。実装は 3 wave とも済み(2026-10-21)。

## 6. Unresolved Questions

- 何をもって「似ている」とするか: 文献では、人間も自然には話題をまたがず、構図で思い出すには整理の段階で抽象的な索引を付ける必要がある。この割り切りでよい(ユーザー)。どの観点で索引するかは未決。
- 自分から思い出して話題に出すのを、自然な形で実現できるか。
- 目次・索引をどこまで配信前に読ませるか(地図が育ったときの大きさ)。
- 記憶の整理を誰がどう行うか(専用の会話の中身・頻度)。
