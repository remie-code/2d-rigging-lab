# Discord VC Map

> ai-cohost の子トピック: チャッピーが**配信の外で**、仲間内の Discord VC に参加者として入る。魂(apps/soul/agent)を共有するので ai-cohost の下に置く。

## 1. Key Files

| Path | Content |
|---|---|
| [scope.md](scope.md) | 目標像・場面・決めたこと(Bot として同列の参加者、話者付きの文字起こし、判定 API で口を出す、仲間の事前の許可) |
| [layer-sketch.md](layer-sketch.md) | 語彙で描き直した絵のたたき台(5 段の並び、固く絡んだ 3 か所)。体験の形ではないため、ユーザーには合わなかった(scope §11) |
| [experience-sketch.md](experience-sketch.md) | Discord 参加モードの体験の流れ: あなたがどう出会うか(場面 0〜7)。ユーザーの返事で直し済み、★が一部残る |
| [probe-setup.md](probe-setup.md) | 受信の試しの準備: ユーザーが Bot を作り、鍵のファイルを置き、試し用のサーバーに招待する手順 |
| [stream-experience-sketch.md](stream-experience-sketch.md) | 配信モードの体験の流れ: 今(調査の事実)と新しい語彙での形を場面ごとに並べ、全場面決定。変わる画面のまとめ |
| [research/discord-voice-bot-2026-10.md](research/discord-voice-bot-2026-10.md) | 外部調査: Bot の音声受信(非公式・DAVE 必須・受信の不具合)、Node の `@discordjs/voice`、規約上の義務、先例 |
| [research/soul-inventory-2026-10.md](research/soul-inventory-2026-10.md) | 棚卸し: 今の魂の耳(1 本前提)・話者ラベル(3 値)・口(器が必須)・判定(配信の語が直書き)の差し替え点 |
| [research/layer-classification-2026-10.md](research/layer-classification-2026-10.md) | 仕分け: 今の魂の機能を体験・ロール・芯・入口出口に振り分けた表、固い結び目、どの層にも入らないもの(場・名簿・操作する人など)、今のロールの置き場 |
| [research/cockpit-today-2026-10.md](research/cockpit-today-2026-10.md) | 今の操縦席を配信者の目で: 起動から終わりまでの流れ、画面とタブごとの全操作(保存先・効く時・層の候補)、操縦席の外の作業、引っかかり、文書とのずれ |
| [research/probe-repo-inventory-2026-10.md](research/probe-repo-inventory-2026-10.md) | 受信の試しのための棚卸し: 特区憲章の条文、試しのスクリプトの前例、鍵の読み方、依存の入れ方、ログの決まりの散らばり |
| [research/probe-external-2026-10.md](research/probe-external-2026-10.md) | 受信の試しのための外部調査: Windows + Node 24 で入る版、復号失敗の数え方、#11653 の今、名前の取り方、ビープの流し方、プライバシーポリシーの義務 |
| [research/restructure-cockpit-map-2026-10.md](research/restructure-cockpit-map-2026-10.md) | 組み直しのための地図: cockpit.mjs と cockpit-server.mjs の塊ごとの責務、場の始まりと終わりの散らばり、器なしで声を出すための止まる所 4 段、画面の部品の仕分け、観測の記録 |
| [research/restructure-role-state-2026-10.md](research/restructure-role-state-2026-10.md) | 組み直しのための棚卸し: 記憶の置き場(定数 1 つ・②④の文面にパスなし・git と種の注意)、設定のキーの型、頭と名前の表、声の話者、名前の手がかり、文書の決まり |

## 2. Current State Summary

- 2026-10-30 に話し始め。当面の問いは「参加させることができるか」。TRPG の NPC は将来の願いで、当面は扱わない。
- 調査: Bot として入って 1 人ずつ聞き、しゃべり返すことはできる見込み。弱点は受信(非公式・DAVE 下の不具合が開いている)。魂は耳 1 本・話者 3 値・器が必須という配信向けの作り。
- 語彙と体験の整理は一区切り(scope §5〜§14): 配信と Discord 参加は別の体験で、芯を共有する。体験を選ぶ → ロールを入れる → 場が開く。記憶はロールごと。順番は、配信で結び目をほどいてから Discord を足す(§11)。
- 配信モードの新しい形は stream-experience-sketch.md で全場面決定。
- 開発の的と進め方を決めた(scope §15)。
- 受信の試しは合格(2026-10-31、[../experiments/discord-receive-probe.md](../experiments/discord-receive-probe.md))。

## 3. Next Actions

1. 進め方は決定(scope §15): 受信の試し(済み・合格) → 配信の組み直し → Discord を足す。
2. 組み直しの設計のたたき台: [../architecture/stream-restructure.md](../architecture/stream-restructure.md)(前提は scope §18〜§20)。確認済み。次は wave の計画。

## 4. Unresolved Questions

- [scope.md](scope.md) §4 を参照。
