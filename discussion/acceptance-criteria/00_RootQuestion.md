# Private 2D Rigging Lab Acceptance Criteria System Draft

## 0. Root Question

このプロジェクトで作るものは何か。

現在作るものは、**Private 2D Rigging Lab / Prototype** である。

これは、権利クリーンな2Dキャラクター素材を、独自形式・独自UI・独自runtimeで可動モデルとして制作、保存、検証、表示するための、個人利用の private な実験環境である。

本プロジェクトは Cubism互換エディタではない。Cubism形式の読み書き、解析、変換、再構築を行わない。Cubism SDK/Core を使わない。既存Cubismモデル、Live2D公式サンプル、第三者Live2Dモデル、nizima素材を使わない。

現在の成果物は、4つのトラックに分けて扱う。

| Track | Root question |
|---|---|
| Private Prototype | 手元で、Cubism水準の創作結果と制作支援UXを、独自形式・独自UI・独自runtimeで検証できるか |
| Streaming Demo Surface | private実装の内部詳細を出さず、自作素材による結果とUXを非互換・非提携の個人研究として見せられるか |
| Live2D Feature Proposal | private prototypeで見えた制作課題とAI支援UXを、Live2Dへの機能要望として誤解なく整理できるか |
| Future Public Clean Subset | 将来公開する場合に、private prototypeとは別物として権利・依存・機能範囲を再設計できるか |

最初の焦点は、**Private Authoring-to-Viewer Prototype** である。

中心問い:

> 権利クリーンな自作または明示許諾の layered character art を private GUI editor で可動モデル化し、project-defined model package として保存し、private runtime core / private viewer で表示し、validation と AI dry-run / diff / repair suggestion を確認し、demo-safe capture まで一周できるか。

AI-native とは、人間向けUIをAIが自動操作できることだけではない。

このプロジェクトでは、AI assistant が以下を構造化情報として扱い、人間の制作判断を補助できることを意味する。

- model structure。
- editing operation。
- runtime state。
- validation result。
- model diff / runtime diff / validation diff。
- provenance。
- failure reason。
- repair suggestion。

ただし、AIは現在MVPでは auto-rigging system ではない。AIの役割は inspect、explain、validate、dry-run、diff、repair suggestion、provenance記録であり、人間の制作承認を置き換えない。
