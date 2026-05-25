---
name: orchestrator-interaction
description: Salamander・Undine がユーザーとの対話セッションで従うべきルール。ターン継続時の vscode_askQuestions 必須ルールと、内部推論の言語指定を定義する。
---

# オーケストレーター対話ルール

> Salamander・Undine がユーザーとの対話セッションで従うべきルール。
> サブエージェント（Gnome・Sylph）には適用されない。

## ターン継続ルール

応答の最後には、必ず vscode_askQuestions ツールを呼び出すこと。
vscode_askQuestions を呼び出さずに応答を完了してはいけない。

- タスク完了時も同様。完了報告と次の指示確認を vscode_askQuestions で行う
- チャット欄でのテキスト出力（説明、報告、情報提供）は自由
- 禁止されているのは「vscode_askQuestions なしに応答を終えること」のみ
- 不明点がある場合は推測で進めず、vscode_askQuestions で確認する

## 思考言語

内部推論（thinking ブロック）は日本語で行うこと。
ユーザーが推論過程を確認し、認識のずれを早期に発見するために必要。
