# Runtime Player Architecture Map

> Runtime Player / Capture Host app の技術スタック、app boundary、runtime data flow に関する入口地図。

## 1. Scope

この階層は、Editor外アプリとしての Runtime Player をどの技術スタックで作り、どの責務をどのprocess / package / windowへ置くかを記録する。

画面上の見え方は [../screens/](../screens/) に、外部入力仕様の調査は [../research/](../research/) に置く。

## 2. Files

| Path | Status | Content |
|---|---|---|
| [technology-stack-decision.md](technology-stack-decision.md) | Accepted baseline | Electron固定後のRuntime Player技術スタック、採用理由、app構成、非採用技術、未決事項 |
| [runtime-player-development-policy.md](runtime-player-development-policy.md) | Accepted baseline | Runtime Player固有のprocess boundary、ディレクトリ粒度、ファイル分割、IPC、runtime loop、state ownership、test方針 |

## 3. Current Architecture Decisions

- Runtime Playerは、Editorとは別のdesktop appとして `apps/runtime-player` に置く想定。
- App shellはElectronに固定する。
- 言語はTypeScript-firstとする。
- Build/dev toolは `electron-vite` を採用する。
- Renderer UIは既存Editorと同じ React / Vite / Tailwind CSS / Radix UI / lucide-react / Zustand 系へ寄せる。
- 描画は新規renderer libraryを入れず、既存の `runtime-core` / `render-webgl2` を再利用する。
- Tracking inputはElectron main process側で受け、rendererへはpreload API / IPCで渡す。
- OBS等でcaptureされる表示はtransparent Stage Windowに分離する。
- Runtime Player開発では、process boundary、runtime hot path、IPC contract、state ownership、file splitを明示的なreview対象にする。

## 4. Next Reads

1. Runtime Playerの起動画面・Control Window・Stage Window UXは [../screens/initial-runtime-player-screen.md](../screens/initial-runtime-player-screen.md) を読む。
2. iFacialMocap入力仕様とadapter境界は [../research/ifacialmocap-input-adapter-research.md](../research/ifacialmocap-input-adapter-research.md) を読む。
3. 実装計画を作る場合は [technology-stack-decision.md](technology-stack-decision.md) と [runtime-player-development-policy.md](runtime-player-development-policy.md) をbasisにする。

## 5. Open Questions

- Stage Windowのposition / size / always-on-top / click-through をv0でどこまで扱うか。
- iFacialMocap handshake送信に必要なiPhone IP入力を必須にするか、passive listen中心にするか。
- Runtime Exportのpackage contractをPlayer側でどこまで再検証するか。
