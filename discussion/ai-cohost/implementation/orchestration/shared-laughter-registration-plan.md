# 一緒に笑う — 採用済みモーションの登録

2026-11-12。ユーザーが相方版を「これでいこう」と採用し、笑みモーションの登録を依頼した。既存の演技×注意対象方式に追加し、普段のRuntime Playerへ反映する。Orch以下は従来指定どおりGPT-6.1 Sol。演技の再創作は行わない。

到達: 実装・独立レビュー・配布確認合格。現用モデルはr825、普段の通常exe/portableを更新し9組の実再生を確認。[完了記録](../waves/shared-laughter-registration/completion.md)。本人の実会話確認はこれから。

## 合意済み体験と境界

- 自由な意図と発話・文脈から「一緒に笑う／つられて笑う」が選ばれ、相方には相方版、視聴者・ゲーム画面には共通v2を再生する。演技と注意対象の独立二問、および未対応記録の既存方針を保つ。
- 原本: `experiments/speech-motion-shared-laughter-v2`（視聴者/画面）と`experiments/speech-motion-shared-laughter-partner-v1`（相方）。笑顔sourceはsaved-r824。両演技・閉眼笑顔は本人採用済み。
- 目元は演技で制作した位置に固定する。少なくともこの笑いの演技中は、通常瞬きと自律視線に閉眼の形を崩させない。口は既存の実音声リップシンクに任せ、試作の仮口パクを本番の口へ焼き込まない。
- 採用済みの顔・上体・Stage二拍・笑顔の時間曲線を保持する。通常終了で自然な終わりまで続け、中断時は既存方針で解除。終了後は表情・視線・瞬きの制御が通常状態へ戻る。
- 発話はDecisionやモーションを待たない。既存演技・他モデルを壊さない。笑顔パラメータを持たない旧モデルへ無条件に再生しない。
- 最終配布先は普段の `apps/runtime-player/dist/win-unpacked/Runtime Player.exe` とportable。採用笑顔を含むastra-chan Exportも利用可能にする。source更新が必要なら現状を確認し、未保存成果を消さず、更新前のExportを戻せる形で保持する。
- 本人は更新版で会話し、笑いと目元の自然さを判断する。内部試験合格を実会話・美的受領と扱わない。

## 進め方

単一Orchの順次実装と独立レビューで閉じる小規模構成。モデルExportと再生が依存するので並列実装しない。Orch自身は実装せずGnomeへ委譲し、別Review-Sylphで確認する。

1. 現在のsource/Export/モデル識別・registry・上書き経路・配布手順を限定棚卸し。r824は新素材によるatlas未更新と既知diagnosticsがある。正規のatlas再生成・Export経路と影響を確認し、必要以上の診断抑制やengine改変をしない。予想外の造形変更が必要ならrootへ報告。
2. 採用された笑顔を含むExportを生成し、正面・笑顔移行・閉眼・左右と口パクを描画して原本と照合。新revisionに対する既存クリップの互換性を実証して登録に反映し、r804専用条件を無根拠に解除しない。
3. shared-laughter演技と3対象のlookupを登録（2種類の原本）。表情パラメータ、瞳固定・瞬き抑制、完走・解除を実再生経路へ通す。判定の説明は共有する笑いの意味を示し、安堵や単なる肯定と区別し、noneを保つ。
4. 原本から実行定義への対応、再生中の目元、既存演技回帰、未知モデル、通常終了・割込み、実送受信を対象に確認。現在の広い未コミット変更をbaselineとして保持。無関係な修正・commit/pushはしない。
5. 独立レビュー後にWindows配布物を更新し、いつものexeとportableの中身および隔離起動で新モデル・3対象を確認。ユーザーの稼働中セッションを無断終了しない。

## 担当と記録

Orchが`implementation/waves/shared-laughter-registration/`にbasis/completion、Reviewerが`implementation/reviews/shared-laughter-registration/`に記録する。rootはこの計画、採用記録とmapを担当。既存performance-attention計画・完了記録を導線にして大規模な再調査を避ける。

残る本人確認は配布版での会話。Exportの生成/ロードに障害がある場合、登録だけで完了としない。具体的な残差を報告する。
