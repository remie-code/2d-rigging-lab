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
| [workspace-package-bundling-decision.md](workspace-package-bundling-decision.md) | Accepted short-term / long-term migration required | 開発中はworkspace packageをElectron bundleへ含め、長期的にはbuild済みJS exportsへ移行する判断 |
| [tracking-input-mapping-baseline.md](tracking-input-mapping-baseline.md) | Draft baseline | iFacialMocapなどのtracking inputをRuntime Export parameterへ割り当てる初期mapping方針 |

## 3. Current Architecture Decisions

- Runtime Playerは、Editorとは別のdesktop appとして `apps/runtime-player` に置く想定。
- App shellはElectronに固定する。
- 言語はTypeScript-firstとする。
- Build/dev toolは `electron-vite` を採用する。
- Renderer UIは既存Editorと同じ React / Vite / Tailwind CSS / Radix UI / lucide-react / Zustand 系へ寄せる。
- 描画は新規renderer libraryを入れず、既存の `runtime-core` / `render-webgl2` を再利用する。
- Tracking inputはElectron main process側で受け、rendererへはpreload API / IPCで渡す。
- Tracking input adapterとparameter mapping / calibrationは分ける。
- iFacialMocap連携ではhead rotationだけでなくhead positionも取得し、後続のbody follow / Stage motionに備える。
- OBS等でcaptureされる表示はtransparent Stage Windowに分離する。
- Runtime Player開発では、process boundary、runtime hot path、IPC contract、state ownership、file splitを明示的なreview対象にする。
- Runtime Dynamics Tune ProfileはRuntime Player-owned stateとしてElectron `userData`へ保存し、effective tuningだけをNative Stage / Browser Sourceへ渡す。Runtime Export artifactやpackage-format schemaは変更しない。
- 開発中はRuntime Player main/preloadで使うworkspace packageをElectron bundleへ含める。長期的には `packages/**` をbuild済みJS exportsへ移行する。

## 4. Next Reads

1. Runtime Playerの起動画面・Control Window・Stage Window UXは [../screens/initial-runtime-player-screen.md](../screens/initial-runtime-player-screen.md) を読む。
2. iFacialMocap入力仕様とadapter境界は [../research/ifacialmocap-input-adapter-research.md](../research/ifacialmocap-input-adapter-research.md) を読む。
3. iFacialMocapや将来input sourceをRuntime parameterへ割り当てる場合は [tracking-input-mapping-baseline.md](tracking-input-mapping-baseline.md) を読む。
4. Runtime Dynamics Tune Profileやeffective tuningのstate ownershipを確認する場合は [runtime-player-development-policy.md](runtime-player-development-policy.md) と [../screens/dynamics-tune-profile.md](../screens/dynamics-tune-profile.md) を読む。
5. 実装計画を作る場合は [technology-stack-decision.md](technology-stack-decision.md) と [runtime-player-development-policy.md](runtime-player-development-policy.md) をbasisにする。
6. workspace packageをElectron main/preloadから使う場合は [workspace-package-bundling-decision.md](workspace-package-bundling-decision.md) を読む。

## 5. Open Questions

- Stage Windowのposition / size / always-on-top / click-through をv0でどこまで扱うか。
- iFacialMocap handshake送信に必要なiPhone IP入力を必須にするか、passive listen中心にするか。
- Runtime Exportのpackage contractをPlayer側でどこまで再検証するか。
- Wave4でbrow mappingまで含めるか、face / eyes / mouthに絞るか。
