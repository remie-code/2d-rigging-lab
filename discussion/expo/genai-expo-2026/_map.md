# 生成AI EXPO 2026 出展の地図

> `discussion/expo/genai-expo-2026/` の地図。ポスター展示(パネル 180cm × 90cm)の設計と、その裏付けとなる出典事実を保持する。

## この階層の役割

外向けの成果紹介物(ポスター)を作るための議論・裁定・出典を保存する。**実装トピックではない**——リポジトリの事実を集めて「何を、どう見せるか」を決める場所。

## ファイル

| Path | Content | Status |
|---|---|---|
| [poster-design.md](poster-design.md) | 出展前提・読者像・伝えるべきことの核・印刷形態(A2×6)・6枚の割り当て・素材リスト・未決事項 | In discussion(骨子合意・版面未着手) |
| [source-facts.md](source-facts.md) | ポスターに書く一行の裏付け(file:line 付きリポジトリ事実)+**書けない線**(誇張防止リスト) | Recorded(2026-07-25) |

## 現在地(短く)

- 応募済み・**採択待ち**。パネル 180×90cm のポスター展示。
- 構成は **A2×6枚(2列×3行)** に決定。6枚の割り当ては骨子合意まで到達([poster-design.md](poster-design.md) §5)。
- **版面(HTML/CSS)の実制作は未着手**。先走って作った大判1枚版 `poster.html` は構成が旧案のため破棄済み。
- 調査は完了(Sylph 二体を Editor/Player 側と model-authoring 側へ派遣)。**「AI は Editor を触っていない・AI の経路は authoring-host」という重要な訂正**を含む([source-facts.md](source-facts.md) §1)。

## 次の作業候補

1. [poster-design.md](poster-design.md) §8 の未決 9 件をユーザーと詰める(特に ②の絵の選択・人間の役割の書き方の温度・Cubism 名指しの可否)。
2. 素材(キャラ2体の絵・配信画面・Editor/操縦席のスクショ)の用意。リポジトリ内に既存の画像素材あり([source-facts.md](source-facts.md) §6)。
3. 版面を HTML/CSS で組む(A2 = 420mm × 594mm × 6 面)。PDF 化は headless Chrome。

## 未決事項

[poster-design.md](poster-design.md) §8 に集約(9 件)。特にユーザー裁定を要するもの:

- キャラ2体を最上段に置く案の最終確認(配信の画をどこへ置くか)
- 「人間がやっていないこと」を書き出す温度
- Cubism を名指しするか(`concept/modified_concept.md:36` の禁止条項との整合)
- モデル実名の対応(リポジトリ内は抽象名のみ・申込概要の出所確認)
