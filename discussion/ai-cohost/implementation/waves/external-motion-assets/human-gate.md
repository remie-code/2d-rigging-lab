# 外部演技資産を編集して会話で確かめる

## 普段の起動と配置

リポジトリ直下の PowerShell から、普段使う方の Player を自律ホストとして起動する。

```powershell
# 通常版
& '.\apps\runtime-player\dist\win-unpacked\Runtime Player.exe' --role=autonomousHost

# portable
& '.\apps\runtime-player\dist\Runtime Player 0.0.0.exe' --role=autonomousHost
```

どちらも同じ `autonomous-default` スロットを使う。`--profile=NAME` を付ける場合は、下のパスで `autonomous-default` を指定した名前へ置き換える。使用中のスロットを再起動するには、先にその Player を閉じる。

- 実際に編集するフォルダは `C:\Users\remie\AppData\Roaming\@private-2d-rigging-lab\runtime-player\slots\autonomous-default\speech-motions`。
- 別スロットへの初期配置や復元には [リポジトリ内の配布用JSON](../../../../../apps/runtime-player/assets/speech-motions) を使う。
- 起動時に読んだ絶対パスと資産の検査結果は、同じスロットの `ai-cohost-fire-diagnostics\runtime-player\control-channel.jsonl` の `speech_motion.assets` を確認する。

Control Window に `C:\workspace\remie\rigging\astra-chan\exports\astra-chan-runtime` のモデルが表示されていることを確かめ、いつもの手順で操縦席を接続する。[モデルを開いて操縦席を接続する手順](../intent-motion/human-gate.md#起動)

## 追加・説明変更・削除

1. 追加する場合は、有効なクリップを含むJSONを実際の `speech-motions` フォルダ直下に置く。新しい `id` と `description` を設定し、対応させたい対象を `targets` からクリップへ結び付ける。利用するモデルにはクリップが要求するパラメータが必要になる。[形式と値の契約](wave1-contract.md#演技とクリップ)
2. 説明を変える場合は、そのフォルダ内の演技JSONの `description` を保存する。候補と再生の両方から外す場合は、そのJSONをフォルダから移動する。
3. Player を再起動して操縦席を接続する。再接続時に新しい候補を受け取る。起動中はその起動時点の一覧を使う。フォルダから移動したJSONは、Player の再起動後もフォルダに戻らない。

## 本人が実会話で見るところ

共に困った状況を少しおかしがる会話で、画面や視聴者へ向けた苦笑と小さな首振りを見る。表情と発話中の口パクが自然に重なり、通常の表情や視線へ戻るかを確認する。相方へ向ける意図が出た場合は、対応するクリップが未制作として記録されるかを確認する。

2026-11-14、ユーザーから「ちゃんと笑みとか困り顔も動いてた」と実運用での動作確認を受領した。口パクの細部や中断時の復帰を個別に評価したとの報告ではないため、それらは内部検証の結果と区別する。
