# 一緒に笑うモーションの受け入れ基準

[登録計画](../../orchestration/shared-laughter-registration-plan.md)と、[視聴者・ゲーム画面向けの原本](../../../experiments/speech-motion-shared-laughter-v2/README.md)、[相方向けの原本](../../../experiments/speech-motion-shared-laughter-partner-v1/README.md)に従う。

- 演技と注意対象の独立判定で `shared-laughter` を選べる。相方は相方版、視聴者とゲーム画面は共通版を引く。対象不明の記録と音声先行を維持する。
- 2本の顔・体・笑顔・Stage Yの曲線を原本と照合する。演技中の瞳XYは0、まぶたの開度は原本どおりに固定し、閉眼の形は `param_shared_laughter` で出す。実音声用の口パクを重ねて確認する。
- 通常終了後の完走、割り込み後の解除、旧モデル・他モデルでの適用拒否を確認する。r804の既存6組と、新Exportでの同じ6組を検証する。
- 採用済みr824の形を保ってatlasを更新する。従来のExportを復元できるように保存し、新Exportで正面・笑顔の移行・閉眼・左右・口パクを比較する。
- 独立レビュー後、普段の通常版とportableを更新する。隔離プロファイルと実WebSocketを使い、同一ビルドから新Exportと新3組の再生を確認する。

本人確認は更新版での実会話。相方・視聴者・画面を意識した笑いと、閉眼中および開眼に戻るときの目元の自然さを見る。
