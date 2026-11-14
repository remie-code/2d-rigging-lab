# 演技資産の外部化と苦笑登録 — 2 Wave計画

2026-11-13。ユーザーと設計の価値・責務を合意し、context-checkとWave構成の相談後、「計画を書いて起動」を承認。両Waveと配布後の独立レビューが合格。通常版/portable、現用workspace/Export r844、外部7演技13組を配布済み。2026-11-14に本人から笑み・困り顔の実運用動作確認を受領。[Wave 1完了](../waves/external-motion-assets/wave1-completion.md)・[契約](../waves/external-motion-assets/wave1-contract.md)・[Wave 2完了](../waves/external-motion-assets/wave2-completion.md)・[起動と編集手順](../waves/external-motion-assets/human-gate.md)。

## 目的と受領する体験

通常のモーション追加・削除、Decision候補の説明変更を、外部の演技資産の変更とアプリ再起動で行えるようにする。これらの操作でsource実装変更やexe再ビルドを要求しない。起動中の即時反映は不要。モデルに新しい表情が必要ならモデル編集/Export更新は別途必要だが、アプリ再ビルドとは区別する。

既存の採用演技を移行し、採用済み「苦笑しながら小さく首を振る」を画面・視聴者共通版として新方式へ追加する。相方版は未制作のまま。普段のRuntime Player通常版/portableと現用astra-chan Exportまで反映し、実会話で本人が見え方を確認できる状態へ届ける。

最終的には、固定した配布実行物に対し外部資産の追加→再起動→候補/再生の出現、説明変更→再起動→Decision入力の更新、削除→再起動→両一覧から消失を実証する。exeだけでなくapp.asarなど実行コードのhash不変も確認する。

## 合意事項 — 後続担当が変更しない前提

1. 一つの意味を持つ演技を管理単位とする。意味、対象別の版、動きの順序/タイミング/強さ、必要なパラメータ、制御条件を入口から理解できる構造。複数対象から同一クリップを参照可。
2. Decision候補と再生内容は同じ演技資産に由来する。演技説明と候補を二重手書き管理しない。自由な意図タグと本文/文脈を尊重し、演技/対象の独立二問を維持する。none、unknown、未制作ペアを無理に埋めず文脈とともに記録する。
3. モデルにはパラメータ名と値の意味の共通契約を要求し、直接指定する。新たな「苦笑という意味→モデル固有パラメータ」対応表は作らない。通常0/表情最大1、方向などの意味も契約に含める。同名/所定条件のパラメータを持てば再生でき、見た目の正しさはモデルの責務。package ID/revision/atlas hash/美的検証実績を再生の必須条件にしない。
4. モデルのキーフォーム造形はモデルが所有。演技はパラメータの時間変化を所有する。Stage上下/拡縮は表示側の操作として同じ時間進行で扱う。原本で採用した動きを保持する。
5. 動かす・固定する・普段の制御へ任せる内容を機械可読で表す。演技名に基づく個別分岐で実現しない。目の固定/通常blinkやgazeとの競合、音声lip syncの維持、他表情との干渉を明示して扱う。
6. 開始/解除は共通の滑らかな接続を基本とする。通常発話終了では自然に完走し、中断/次区間/切断では通常制御へ返す。現在姿勢から飛ばない。既存の問いかけの保持など、採用挙動を黙って失わない。
7. 説明に使ったYAML、animate/hold等の項目名や例の数値は確定仕様ではない。データ形式/制御表現/必要パラメータ一覧の導出方式はWave 1で意味を満たす具体仕様として策定する。
8. 制作履歴の導線はdiscussion-managementで扱う。実行用資産へ別の履歴管理機構を作らない。
9. モーションの追加に任意のコード/スクリプト実行を要求しない。既存の表現に必要な共通機能をデータで使えることが目的。無関係な機能追加やEditor管理UIの新設は含めない。

## 現状の根拠と調査結果

- 既存登録: 6演技11組9クリップ。receive/interest/askは正規化slot preset、安堵3・笑い2・驚き1はモデル値クリップ。入口 `apps/runtime-player/src/main/control-channel/speech-motion-state.ts`、`contract/speech-motion-registry.json` と関連clip JSON。
- 初期3本はmapping範囲/反転/強度、body slotからStageへの間接作用、askの終了後保持がある。単純にJSONを移すだけでは等価にならない。既存の採用動作との照合を移行要件とする。任意の旧設定との完全互換まで無根拠に保証しない。意味が変わる判断が必要ならrootへ報告する。
- 現在Soulはmodule評価時に静的JSONからQUESTIONSを生成し、Playerはbundle内JSONを読む。起動snapshotの共有はない。Player起動snapshotを接続先Soulへ供給する案は有力だが未確定。実装前に一覧の権威と接続ライフサイクルを具体化する。
- モデルparameter ID/min/max/default等はRuntime payloadから取得可。既存rawモーションは通常制御の値をモデルへ解決した後に該当paramを上書きする。
- 個別依存: revision/atlas/slot bindingのgate、laughter.fixedParametersをsource保有クリップで流用する固定眼、驚きクリップ名に依存するStage depth時計。これらを最終経路へ残さない。
- 前回の基準/実績: [驚き登録完了](../waves/startled-recoil-registration/completion.md)、[独立レビュー](../reviews/startled-recoil-registration/review.md)。前回はモデルr840・普段のexe/portableへ配布済み。
- 現sourceは苦笑眉修正版r843、現用Exportはr840。苦笑表情と首振りは現在の会話で本人採用・登録依頼済み。古い文書の「評価待ち」を本人採用の否定に使わない。
- 苦笑原本: `discussion/ai-cohost/experiments/speech-motion-wry-headshake-v1/`。表情: `C:/workspace/remie/rigging/astra-chan/workspace-notes/wry-smile-expression-v2/saved-r843`。姿勢/表情全曲線、固定目、笑い/驚き0の指定あり。試作の静止口を本番口パクへ焼き込まない。

## Wave 1 — 共通基盤と代表演技

単一Orchが順次進める。source実装は別Gnome、独立レビューは別Review-Sylph。最初に限定棚卸しから具体契約を文書化し、rootへ要点を返す。説明用サンプルをそのまま承認済みschemaと扱わない。通常の技術詳細は担当が決めて根拠を残し、価値/UX/スコープが変わる場合はrootへ相談する。

1. 外部資産の配置/形式/版参照/値と制御条件、ロードと検査、起動時のsnapshot共有、無効な資産や不足能力の診断方法を具体化する。独立レビューで契約と実装を照合できるbasisを作る。
2. 外部ロードと共通再生経路、Decision一覧供給を実装。静的import・名前別処理を一般化し、パラメータ契約で適否を判断する。Stage Presence Offでも演技の上下/拡縮は使え、自律設定を勝手に変えない。
3. 初期演技/笑い/驚きを代表として、値の解釈、目元制御、Stage、開始/終了/中断を確認する。Wave 2のデータだけの移行が可能になるだけの契約を閉じる。
4. 必要な基盤テスト、型/境界チェック、独立レビュー。名前に依存した分岐が不要なこと、パラメータ欠落等を黙って部分演技にしないこと、候補の共有を実経路でも確認する。

成果は `implementation/waves/external-motion-assets/wave1-basis.md`、`wave1-contract.md`、`wave1-completion.md`。レビューは `implementation/reviews/external-motion-assets/wave1.md`。Wave 2へ渡す具体契約、移行手順、残作業、コードと検証の入口をコンパクトに残す。

## Wave 2 — 全移行・苦笑追加・配布実証

Wave 1独立合格をrootが受領後、新しいOrchコンテキストを起動する。

1. 既存6演技11組を新方式へ移し、必要な既存動作/保持/Stage/制御を照合する。旧経路/候補一覧の重複を整理し、通常運用を旧ハードコードに依存させない。
2. 基盤の動くビルドを固定し、苦笑を外部データの追加だけで登録する。苦笑専用再生コードが必要ならWave 1基盤不足として修正/レビューに戻し、改めて固定buildで実証する。
3. 採用sourceを保持して苦笑を含む正規atlas/Exportを生成。モデルの保存/再読込と採用描画・旧演技互換を確認。モデルExport更新は許容するが、普通のモーション追加のためのexe buildと混同しない。
4. 固定実行コードで追加/説明変更/削除/再起動を試し、実際のDecision入力と再生可能一覧の両方を確認する。必要param欠落は再生不可と理由を示し、同じ契約を持つ別revision/hash等は拒否しない。接続/再接続でも選択側と再生側が同じ起動snapshotを使うことを確認する。
5. 独立レビュー後、普段の通常exe/portable・外部資産・現用Exportを配布。実配布先から隔離起動してNative/Browserの再生、口パク、通常完走/中断/復帰を確認する。データ配置と再起動手順をユーザーへ説明できる状態にする。

成果は同waves配下のwave2-basis/completionとhuman-gate、reviewはwave2.md。本人の最終確認は普段の会話で苦笑の自然さと口パク/復帰を見ること。内部合格を本人受領と置き換えない。

## オーケストレーションと作業境界

- 2 Wave順次、各Wave単一Orch→Gnome実装→別Review-Sylph。今回は通常のレビュー厚みとし、価値/責務/実装/対象テスト/配布実験を照合する。担当人数のための並列化はしない。
- Orch以下はGPT-6.1 Sol。Astraは今回新たな演技造形を担当しない。
- Orch-Sylph自身は実装担当ではない。source implementation は必ず別コンテキストの Gnome に委譲し、レビューは必ず別コンテキストの Review-Sylph に委譲すること。これを分離できない場合は実装せず escalate / blocked として報告すること。
- rootは合意/計画/Wave gate/map/ユーザーへの報告を所有し、domain source・tests・大規模diffへ潜らない。
- 全担当は共同作業中と認識し、広い未コミット成果をbaselineとして保持。他の変更を戻さず、無関係な清掃・commit/pushをしない。
- 外部model/Export/通常exeの更新前に戻せるbackupを残す。外部書込は正規承認経路を使う。ユーザーの稼働中アプリを無断終了しない。
- 普段の配布先は `C:/workspace/remie/code/ai-native-live2d-editor/apps/runtime-player/dist/win-unpacked/Runtime Player.exe` と `dist/Runtime Player 0.0.0.exe`。現model/Exportは `C:/workspace/remie/rigging/astra-chan/workspace` と `exports/astra-chan-runtime`。

## 合格判断

外部資産と再起動のみで候補/再生の追加・変更・削除が追従し、演技単位で意味と挙動を理解でき、既存演技および採用苦笑が共通の再生器で動くこと。直接パラメータ契約、通常制御との競合/解除、未対応記録、発話速度優先を保つ。静的importの置換だけ、開発実行のみ、登録だけで普段のexeに反映されない状態は完了としない。
