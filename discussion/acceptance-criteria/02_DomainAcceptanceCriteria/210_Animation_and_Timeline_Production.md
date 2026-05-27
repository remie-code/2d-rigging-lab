# DOMAIN-10: Animation and Timeline Production

> Status: Optional / not required for current MVP.

## 問い

Private Prototypeは、将来の簡易animationやtimelineをどう扱えるとよいか。

## 方針

Current MVPはauthoring-to-viewerの一周を優先する。Timeline editor、motion asset export、production animation workflowはMVP外であり、必要になった時点で別途設計する。

### AC-ANIM-001: モデルを時間軸上に配置できること

将来機能として、project-defined packageのparameter stateを時間軸上に配置できること。

### AC-ANIM-002: タイムライン上でパラメータ変化を記録できること

将来機能として、parameter変化をkeyframe列として記録できること。

### AC-ANIM-003: キーフレーム間の変化を再生できること

将来機能として、private runtime coreでtimeline playbackを確認できること。

### AC-ANIM-004: モーション資産を出力できること

将来機能として、project-defined motion dataを保存できること。外部形式互換は現在MVP外である。

### AC-ANIM-005: アニメーション品質を検証できること

将来機能として、過大変形、snap、欠落keyframe、runtime再現性をvalidatorで確認できること。
