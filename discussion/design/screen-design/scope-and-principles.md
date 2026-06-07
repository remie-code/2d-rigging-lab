# Editor UX 画面設計のスコープと原則

> 状態: Active design basis。GUI Editorの画面設計体系の入口文書であり、特定wave専用の実装計画ではない。

## 1. 目的

この画面設計トピックは、Editor UX の方向性を画面仕様レベルで定めるために行う。

このフェーズで決めたいことは次の通り。

- Editor の簡単な画面遷移 / view 構造
- 各画面にどのような主要領域を置くか
- パーツツリー、キャンバス / プレビュー、ツール入口、インスペクタ、検証結果、操作履歴、debug / evidence 詳細をどこに置くか
- どの情報を人間向けUIに常時表示し、どの情報を必要時だけ表示し、どの情報を通常UIから外すか

粒度は、ボタン単位のUI設計ではなく、画面と領域の仕様である。たとえば「パーツツリーはワークスペース左側に置く」「PSD import の詳細は import tool panel の奥に置く」といった判断は対象だが、すべてのボタン、アイコン、余白、コンポーネントpropsまで決める必要はない。

## 2. 非ゴール

この discussion フェーズでは UI 実装を行わない。

また、次のものはこのフェーズでは決めない。

- 詳細な見た目、色、余白、タイポグラフィ、アイコン、個別コンポーネント状態
- modal の最終実装詳細
- toolbox コンポーネントの最終設計
- renderer / Photoshop compositing 挙動
- semantic recognition、smart suggestion UI、auto-rigging、deformer / keyform / physics generation、proposal generation
- 画面仕様discussionと棚卸が終わる前の後続 implementation wave 範囲

preset-based initial mesh generationは、この非ゴールには含めない。これは意味推定や提案ではなく、ユーザーまたはCodexが明示したdrawableとpresetに基づく決定的geometry生成であり、Editor UX上の必須候補として扱う。

texture atlasのsimple deterministic packingも、この非ゴールには含めない。これはvisible drawable、page size、padding、source boundsに基づく決定的な配置処理であり、semantic recognitionやsmart suggestionではない。

## 2.1 Wave51 実装状況メモ

Wave51 は、この screen-design 方針を実装へ移す最初の負債解消waveとして開始済みである。Wave51 Domains A-E の `pass` 記録で主張できる範囲は次に限定する。

- PSD import-plan / structural scaffold の production `data-testid` behavior coupling は対象箇所で除去済み。
- App Shell には task/view を分類する minimal surface metadata が入ったが、既存の一ページhostとpanel append orderは維持されている。
- PSD Import Task structured observation projector は prepared 状態で、UI / E2E / Codex-facing read API からは未使用。
- production `data-testid` guard は standalone script と fixture self-test として存在するが、package scripts には未統合。

Wave51 は full visual redesign、full panel migration、final toolbox/modal/window framework、Diagnostics / Evidence View の完成、Codex / Automation View の完成、Mesh / Atlas / Parameter / Variant UI 実装を完了していない。

## 3. 現在の問題設定

現在の Editor は起動でき、基本機能も揃い始めている。一方で、人間向けUXはまだ弱い。

現在感じているプロダクト上の問題は次の通り。

- すべての機能が巨大な1ページに詰め込まれている
- 人間ユーザーが、どこにどの機能があるのか把握しづらい
- 機械向け / debug / evidence の詳細情報が、人間向け操作UIと一緒に表示されている
- 視認性が悪く、必要な情報を走査しづらい
- この形のまま機能を追加すると、発見性と可読性がさらに悪化する可能性が高い

このままだと、機能としてはできることが増えても、実際の authoring 作業では扱いづらく非効率な Editor になるリスクがある。

## 4. 必要な棚卸テーマ

画面仕様を決める前に、少なくとも2つの棚卸が必要である。

### 4.1 表示情報の棚卸

各情報を、次のどれに置くべきか整理する。

- 人間向けの primary 情報として表示するもの
- secondary / 展開時の詳細として表示するもの
- debug / evidence view へ移すもの
- Codex / operation / validation 向けの機械可読surfaceだけに出すもの
- 通常UIから隠すもの

確認すべきリスク:

- Codex やテストが、機械可読情報源として可視DOMテキストに依存している場合、レイアウト整理によって Codex-facing 挙動を壊す可能性がある。
- 望ましい方向性は、Codex-facing state を明示的API、operation evidence、validation report、command host、構造化された test id などに置き、人間向けの debug text に依存させないことである。

### 4.2 体験 / 導線の棚卸

正とするユーザー体験を整理する。

棚卸と議論の対象:

- primary workspace view は何か
- キャンバス / プレビューをどこに置くか
- パーツツリーをどこに置くか
- ツール入口をどこに置くか
- toolbox 的な概念を採用するか
- ツール実行時に modal 風のtask window、side panel、inspector、専用view のどれを使うか
- PSD import、structural scaffold、validation、operation history、Codex command surface を人間にどう見せるか
- どのflowを常時見える高速導線にし、どのflowを必要時に呼び出す形にするか

現時点のユーザー案として、「機能一覧を持つ toolbox 的なものがあり、機能を選択すると、その機能に必要な情報だけを持つ window / modal が開く」という方向性がある。これは候補であり、まだ確定設計ではない。

## 5. Codex-facing structural command parity との関係

Codex-facing structural command parity は、次の実装候補として重要である。

ただし、UX整理と関係する可能性がある。

- 構造的PSD import の機械向け詳細が、Codex / テストが観測するためだけにメインUIへ表示されているなら、正しい対応は人間向けUIと機械可読surfaceを先に分離することかもしれない。
- Codex-facing command parity が人間向けレイアウトと独立して実装できるなら、このdiscussion後の通常の実装waveとして扱える。
- parity 作業によって人間向けUIと機械向けevidenceの絡み合いが見つかるなら、実装前にこの画面仕様discussionで境界を定義するべきである。

現時点の仮定:

- 人間向けUIは authoring と inspection に最適化する
- Codex-facing behavior は deterministic API、operation evidence、validation、approval、commit、test surface で支える
- 詳細な evidence は存在してよいが、通常の人間向けUIを支配しない
- Editorが持つ自動処理は、意味推定ではなく明示入力に基づく決定的処理に限定する。preset-based initial mesh generationとtexture atlas simple packingはこの範囲に入る。

この仮定は、棚卸とユーザー議論の中で検証する。

## 6. 設計体系の作り方

画面設計体系は、チャット上のドラフト議論を経て、次の文書群として完成させる。

1. `overview.md`: 大まかな画面体系とGlobal UX Flowを定義する。
2. `screens/*.md`: 各画面固有のレイアウト、内部遷移、表示情報、非表示情報を定義する。
3. `inventories/*.md`: 画面設計の根拠となる現状棚卸を保持する。
4. 必要に応じて、未決事項を画面別文書または `_map.md` に集約する。

Undine は、現在のUI / source / test を広く棚卸ししない。Undine の root context を守るため、棚卸は bounded question として委譲する。

## 7. ユーザー判断が必要な論点

次の論点はユーザー判断が必要になる見込み。

- 通常時の Editor workspace は何か
- Editor を「1つの workspace + 呼び出し式tool」で構成するか、複数の専用画面で構成するか
- 主要toolを modal task window、side panel、inspector、separate view のどれとして開くか
- どの情報が human primary で、どの情報が debug / evidence / machine-only か
- 通常の authoring 中に常時表示すべきものは何か
- 診断が必要な時だけ表示すべきものは何か
- operation / validation / evidence の詳細を通常Editorにどの程度表示するか
- 実装に安全に進む前に、最低限どこまで画面仕様を決める必要があるか

## 8. 画面設計体系の期待成果物

最終的には、軽量だが継続的に参照できる画面設計体系を作る。

含めるもの:

- screen / view list
- 簡単な遷移モデル
- 各画面の主要領域
- 各領域に置く情報カテゴリ
- 通常の人間向けUIから外すべき情報一覧
- 未決のままなら後続 implementation wave から外すべき論点
- 推奨する後続 screen-design implementation 範囲

この成果物は、完全なvisual design systemやボタン単位の仕様なしに、後続waveを計画できる程度の内容を目指す。

## 9. 次のステップ

次は、Wave51で作った基盤を前提に、Workspace Layout Migration、PSD Import Task Migration、Diagnostics / Evidence View Separation、Codex / Automation View Separationを別waveとして計画する。`overview.md` と `screens/*.md` の未決事項は、各wave planning gateで必要分だけ閉じていく。
