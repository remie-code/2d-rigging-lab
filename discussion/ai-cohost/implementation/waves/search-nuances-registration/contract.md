# セマンティクスとニュアンスを持つ演技資産

Playerは起動時に `speech-motions` からバージョン1と2のJSONを読む。バージョン2のルートは `version: 2`、`id`、`description`、`nuances`、`clips`。親のIDと説明は共通するセマンティクスを表す。`nuances` はニュアンスIDをキーとし、それぞれに `description` と `targets` を置く。`targets` は `game`・`partner`・`viewers` のうち制作済みの対象をルートの `clips` に対応付ける。全クリップは一つ以上の対象から参照する。クリップの項目と再生規則はバージョン1と共通。 [クリップの仕様](../external-motion-assets/wave1-contract.md#演技とクリップ)

各ニュアンスは `<親ID>--<ニュアンスID>` と親・子の説明を改行で連結した説明を持つ一候補になる。親ID、ニュアンスID、連結後の選択IDは1～96文字で、先頭は半角英数字、残りは半角英数字・アンダースコア・ハイフン。`constructor` などの `Object.prototype` 自身のプロパティ名は無効とする。親IDの `none` は予約済み。親IDが重複する場合や、展開後の選択IDがバージョン1または別の親の選択IDと衝突する場合は、競合したファイルを候補と再生解決から除く。連結後の説明は1,000文字まで。

Decisionには各候補と `none` をまとめて渡し、対象は同じリクエスト内の独立した質問で選ぶ。対象の不明や未制作の組は既存の扱いに従う。対応済みPlayerでは、資産ファイルの編集・追加は再起動で反映する。 [外部資産の編集と起動](../external-motion-assets/human-gate.md)

区間記録の `decision.performanceId` から選んだ組を読み、`definition.sha256` で保存された親定義を開く。同じ親ファイルを展開した候補は親定義のSHA-256を共有する。保存定義の `id` と区切りの `--` を選択IDの先頭から取り除くと `nuances` のキーになる。`definition.clipId` がある場合は、同じ保存定義の `clips` でその曲線を開ける。 [区間記録を探し、演技の版を開く手順](../all-motion-recording/human-gate.md)
