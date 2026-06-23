import { Menu, Tray, nativeImage } from "electron";
import type {
  MenuItemConstructorOptions,
  Menu as ElectronMenu,
  NativeImage
} from "electron";

export type RuntimePlayerTrayMenuActions = {
  readonly showControl: () => boolean;
  readonly focusStage: () => boolean;
  readonly disableClickThrough: () => boolean;
  readonly quit: () => void;
};

export type RuntimePlayerClickThroughRecoveryState = {
  readonly enabled: boolean;
};

export type RuntimePlayerTrayMenuOptions = {
  readonly actions: RuntimePlayerTrayMenuActions;
  readonly getClickThroughRecoveryState?: () => RuntimePlayerClickThroughRecoveryState;
  readonly electron?: RuntimePlayerTrayMenuElectron;
};

export type RuntimePlayerTrayMenuRegistration = {
  readonly tray: RuntimePlayerTrayLike;
  refresh(): void;
  dispose(): void;
};

export type RuntimePlayerTrayMenuElectron = {
  readonly createNativeImageFromDataUrl: (dataUrl: string) => NativeImage;
  readonly createTray: (image: NativeImage) => RuntimePlayerTrayLike;
  readonly buildMenu: (
    template: MenuItemConstructorOptions[]
  ) => ElectronMenu;
  readonly setApplicationMenu: (menu: ElectronMenu | null) => void;
};

export type RuntimePlayerTrayLike = {
  setToolTip(toolTip: string): void;
  setContextMenu(menu: ElectronMenu): void;
  on(event: "click", listener: () => void): void;
  destroy(): void;
};

const runtimePlayerTrayIconPngDataUrl =
  "data:image/png;base64," +
  "iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAP0lEQVR4nGMQEBL5TwlmGFwGiOxYhhNTbMCPX3/AmH4GoCuEGYBuCFEuoLoByIbQzgUUhwEuAyiOhUGeF8jBAB8ptUTEPfOcAAAAAElFTkSuQmCC";

export function registerRuntimePlayerTrayMenu(
  options: RuntimePlayerTrayMenuOptions
): RuntimePlayerTrayMenuRegistration {
  const electron = options.electron ?? createDefaultElectronAdapter();
  const trayIcon = electron.createNativeImageFromDataUrl(
    runtimePlayerTrayIconPngDataUrl
  );

  if (trayIcon.isEmpty()) {
    throw new Error("Runtime Player tray icon PNG failed to load.");
  }

  const tray = electron.createTray(trayIcon);

  const buildContextMenu = (): ElectronMenu =>
    electron.buildMenu(createRuntimePlayerTrayMenuTemplate(options));
  const refresh = (): void => {
    const contextMenu = buildContextMenu();
    tray.setContextMenu(contextMenu);
    electron.setApplicationMenu(
      electron.buildMenu(createRuntimePlayerApplicationMenuTemplate(options))
    );
  };

  tray.setToolTip("Runtime Player");
  tray.on("click", () => {
    options.actions.showControl();
  });
  refresh();

  return {
    tray,
    refresh,
    dispose: () => {
      electron.setApplicationMenu(null);
      tray.destroy();
    }
  };
}

export function createRuntimePlayerTrayMenuTemplate(
  options: RuntimePlayerTrayMenuOptions
): MenuItemConstructorOptions[] {
  const clickThroughState = getClickThroughRecoveryState(options);

  return [
    {
      label: "Show Control Window",
      click: () => {
        options.actions.showControl();
      }
    },
    {
      label: "Focus Stage",
      click: () => {
        options.actions.focusStage();
      }
    },
    {
      label: "Disable Click-through",
      enabled: clickThroughState.enabled,
      click: () => {
        if (getClickThroughRecoveryState(options).enabled) {
          options.actions.disableClickThrough();
        }
      }
    },
    {
      type: "separator"
    },
    {
      label: "Quit Runtime Player",
      click: () => {
        options.actions.quit();
      }
    }
  ];
}

export function createRuntimePlayerApplicationMenuTemplate(
  options: RuntimePlayerTrayMenuOptions
): MenuItemConstructorOptions[] {
  return [
    {
      label: "Runtime Player",
      submenu: createRuntimePlayerTrayMenuTemplate(options)
    }
  ];
}

function getClickThroughRecoveryState(
  options: RuntimePlayerTrayMenuOptions
): RuntimePlayerClickThroughRecoveryState {
  return options.getClickThroughRecoveryState?.() ?? { enabled: false };
}

function createDefaultElectronAdapter(): RuntimePlayerTrayMenuElectron {
  return {
    createNativeImageFromDataUrl: (dataUrl) =>
      nativeImage.createFromDataURL(dataUrl),
    createTray: (image) => new Tray(image),
    buildMenu: (template) => Menu.buildFromTemplate(template),
    setApplicationMenu: (menu) => {
      Menu.setApplicationMenu(menu);
    }
  };
}
