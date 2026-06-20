# Runtime Player Screens Map

> Runtime Player / Capture Host appの画面責務とUX設計メモ。

## Files

| Path | Status | Content |
|---|---|---|
| [initial-runtime-player-screen.md](initial-runtime-player-screen.md) | Draft / initial UX captured | 起動直後の未ロード画面、モデルロード後のLive/Setup画面、通常表示に載せない情報 |

## Current Screen Principles

- Runtime PlayerはEditorではなく、完成モデルをtracking inputでライブ表示するアプリである。
- 主画面はClean Stageであり、Parameter一覧、Mesh、Deformer、Editor treeは通常表示しない。
- Stage WindowとControl Windowを分離する。Stage Windowはtransparentでmodel only、Control WindowはRuntime Export、tracking input、calibration、display setupを扱う。
- Debug UIは必要だが、通常UXでは折りたたむ。
- Startup時は前回Runtime Exportを自動復元する。recent listはfuture扱い。

## Next Questions

1. Stage Windowを常時別windowとして開くか、モデルload後に開くか。
2. Stage Windowの位置・サイズ・always-on-top・クリック透過をv0でどこまで扱うか。
3. iFacialMocap handshake送信に必要なiPhone IP入力を必須にするか、passive listen中心にするか。
4. Transparent Window実装のapp stack制約をどう扱うか。
