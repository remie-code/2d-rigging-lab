# Open Live2D Stack Acceptance Criteria System Draft

# 1. Root Acceptance Criteria

## AC-ROOT-001: Open Live2D Stack として成立すること

Open Live2D Stack は、2Dイラストを可動モデルとして制作・保存・読み込み・表示・検証・配信・組み込み利用するための基盤であること。

ここでいう Stack は、Editor 単体ではなく、Model Format、Runtime、Viewer、SDK、VTuber App、Validator、External API、AI Agent Interface、Sample Model、Documentation を含む。


## AC-ROOT-002: Open Model Format を第一級の正とすること

Open Live2D Stack は、Cubism の `.cmo3` / `.moc3` / `.model3.json` ではなく、独自のオープンな model format を中核仕様として持つこと。

Open Model Format は、少なくとも以下を表現できること。

- texture
- drawable
- mesh
- vertex / uv / triangle index
- part
- draw order
- clipping / mask
- parameter
- keyform
- deformer 相当の変形構造
- expression
- physics
- motion
- metadata
- AI向けの構造化情報


## AC-ROOT-003: Open Runtime / Viewer がモデルを評価・表示できること

Open Runtime / Viewer は、Open Model Format を読み込み、parameter 値に応じてモデル状態を評価し、描画結果を生成できること。

Runtime は内部状態、評価結果、描画対象、検証結果を、人間およびAIエージェントが観測できる構造として提供すること。


## AC-ROOT-004: Open Editor がモデルを制作・編集できること

Open Editor は、入力素材または Open Model Package からモデルを制作・編集・検証し、Open Model Format として保存できること。

Cubism Editor の画面構成、メニュー配置、ショートカット、UI挙動の模倣は目的ではない。

再構築すべきものは、Live2D 的な制作成果を作る能力である。


## AC-ROOT-005: AI-native な観測・操作・検証が Stack 全体で成立すること

Open Live2D Stack は、人間のGUI操作だけでなく、AIエージェントが構造化された観測・操作・検証を行えること。

AIエージェントは少なくとも以下を行えること。

- モデル状態を構造化データとして観測する
- 編集操作を明示的な操作単位として実行する
- runtime state を取得する
- 操作前後の差分を取得する
- 操作結果をACまたはシナリオに照らして検証する
- 失敗理由と影響範囲を特定する
- 修復候補または次の編集判断に利用できる情報を得る


## AC-ROOT-006: Cubism 非依存であること

Open Live2D Stack は、主要工程を Cubism Editor、Cubism Core、Cubism SDK、`.cmo3`、`.moc3` に依存せず完結できること。

Cubism 関連資産は、参照元、比較対象、移行元、調査対象として扱ってよい。

ただし、`.moc3` 互換出力や `.cmo3` 内部構造復元を初期成功条件に置かない。


## AC-ROOT-007: Open Source 公開可能な権利境界を持つこと

Open Live2D Stack は、将来的な Open Source 公開を前提として、依存関係、サンプル資産、仕様、生成物、検証データの権利関係をクリーンに保てること。

公式Live2Dサンプル、商用モデル、Cubism SDK/Core など、再配布条件に制約がある資産を、公開リポジトリの必須資産にしない。


## AC-ROOT-008: 仕様体系が行動可能な正解であること

このプロジェクトで抽出・定義されるAC、仕様、シナリオは、説明文ではなく、後続エージェントの行動可能な正解であること。

すなわち、Undine が仕様・シナリオを起こし、Gnome が実装し、Sylph がレビューする際に、何を作るべきか、何を満たせば正しいか、何を根拠に合否判断するかを示すものでなければならない。
