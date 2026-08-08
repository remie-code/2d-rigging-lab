# 出展・外向け紹介の地図

> `discussion/expo/` の地図。この作業場の成果を外部イベントで紹介するための議論・裁定・出典を保持する。

## この階層の役割

**外向けの成果紹介物**(ポスター、展示、発表資料)を作るための場所。実装トピックではなく、リポジトリ全体の事実を集めて「何を、どう見せるか」を決める。

`demo/`(Streaming Demo Surface の表示範囲・preflight・disclaimer)とは別トラック——`demo/` は配信で映してよい範囲の衛生規約、`expo/` は特定イベントへの出展物そのものの設計。ただし §7 Demo and Proposal Hygiene([../_conventions.md](../_conventions.md))は expo/ にも同様に効く(Cubism 互換・Live2D 代替の主張をしない等)。

## 出展

| Path | Event | Status |
|---|---|---|
| [genai-expo-2026/](genai-expo-2026/_map.md) | 生成AI EXPO(<https://www.genai-expo.com/>)。ポスター展示・パネル 180×90cm | 応募済み・**採択待ち（作業場記録／個別結果は外部未検証）**。**6面HTML + 6面A2 PDF完成**。採択後に実寸試し刷り |

## 未決事項

- `expo/` というトピック名・位置づけの最終確認(L0 提案。[../_conventions.md](../_conventions.md) §4 の表に追記済み)。
- 各出展の未決は、その出展ディレクトリ内の register に委ねる(本地図は列挙しない)。
- 出展の採択通知は外部状態のため本地図では検証済みとしない。採択後の実寸試し刷りと公開前の権利・スコープ確認は子 map の停止条件に従う。
