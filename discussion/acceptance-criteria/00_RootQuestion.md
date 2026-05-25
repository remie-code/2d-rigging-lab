# Open Live2D Stack Acceptance Criteria System Draft

## 0. Root Question

このプロジェクトで作るものは何か。

Open Live2D Stack とは、静的な2Dイラストを、パラメータ駆動で変形・表示・配信・組み込み利用できる可動モデルとして扱うための、オープンかつ AI-native な制作・実行基盤である。

本プロジェクトの対象は Editor 単体ではない。

Open Live2D Stack は、少なくとも以下を含む。

- Open Model Format
- Open Runtime / Core
- Open Viewer
- Open Editor
- Open SDK
- Open VTuber App
- Open Package Validator
- Open External API
- Open AI Agent Interface
- Open Sample Model Set
- Documentation / Tutorial / AC System

Cubism Editor、Cubism Core、Cubism SDK、VTube Studio、nizima LIVE などは、Live2D 的表現と周辺ワークフローを理解するための参照オラクルである。

ただし、本プロジェクトの目的は Cubism 互換実装ではない。

本プロジェクトの正は、Open Live2D Stack 自身の model format、runtime behavior、AC、仕様、シナリオである。

AI-native とは、人間向けUIをAIが自動操作できることだけではない。

AIエージェントが以下を構造化情報として扱えることを意味する。

- モデル構造
- 編集操作
- runtime state
- 検証結果
- 差分
- provenance
- 失敗理由
- 修復候補

最初の焦点は、Open Model Format と Open Runtime / Viewer を成立させ、権利的にクリーンな最小サンプルモデルを読み込み、表示し、パラメータ操作し、検証できる状態を作ることである。
