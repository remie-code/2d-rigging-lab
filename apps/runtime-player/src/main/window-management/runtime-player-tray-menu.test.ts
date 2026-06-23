import { describe, expect, it, vi } from "vitest";

import {
  createRuntimePlayerApplicationMenuTemplate,
  createRuntimePlayerTrayMenuTemplate,
  registerRuntimePlayerTrayMenu,
  type RuntimePlayerTrayMenuActions,
  type RuntimePlayerTrayMenuElectron
} from "./runtime-player-tray-menu";

type RuntimePlayerMenuItem =
  ReturnType<typeof createRuntimePlayerTrayMenuTemplate>[number];

describe("Runtime Player tray/menu actions", () => {
  it("wires Show Control, Focus Stage, disabled click-through recovery, and Quit", () => {
    const actions = createActions();
    const template = createRuntimePlayerTrayMenuTemplate({
      actions
    });

    clickMenuItem(getMenuItem(template, "Show Control Window"));
    clickMenuItem(getMenuItem(template, "Focus Stage"));
    clickMenuItem(getMenuItem(template, "Disable Click-through"));
    clickMenuItem(getMenuItem(template, "Quit Runtime Player"));

    expect(actions.showControl).toHaveBeenCalledTimes(1);
    expect(actions.focusStage).toHaveBeenCalledTimes(1);
    expect(actions.disableClickThrough).not.toHaveBeenCalled();
    expect(actions.quit).toHaveBeenCalledTimes(1);
    expect(getMenuItem(template, "Disable Click-through").enabled).toBe(false);
  });

  it("enables Disable Click-through only when the recovery hook reports an active click-through state", () => {
    const actions = createActions();
    const template = createRuntimePlayerTrayMenuTemplate({
      actions,
      getClickThroughRecoveryState: () => ({
        enabled: true
      })
    });

    const disableClickThrough = getMenuItem(
      template,
      "Disable Click-through"
    );
    clickMenuItem(disableClickThrough);

    expect(disableClickThrough.enabled).toBe(true);
    expect(actions.disableClickThrough).toHaveBeenCalledTimes(1);
  });

  it("exposes the same actions through the application menu template", () => {
    const actions = createActions();
    const template = createRuntimePlayerApplicationMenuTemplate({
      actions
    });
    const runtimePlayerMenu = template[0];
    const submenu = runtimePlayerMenu?.submenu as
      | RuntimePlayerMenuItem[]
      | undefined;

    expect(runtimePlayerMenu?.label).toBe("Runtime Player");
    expect(submenu?.map((item) => item.label ?? item.type)).toEqual([
      "Show Control Window",
      "Focus Stage",
      "Disable Click-through",
      "separator",
      "Quit Runtime Player"
    ]);
  });

  it("registers a tray icon, context menu, app menu, click recovery, refresh, and dispose", () => {
    const actions = createActions();
    let clickThroughEnabled = false;
    const clickListeners = new Map<string, () => void>();
    const fakeImage = {
      isEmpty: vi.fn(() => false)
    } as unknown as Parameters<
      RuntimePlayerTrayMenuElectron["createTray"]
    >[0];
    const builtMenus: RuntimePlayerMenuItem[][] = [];
    const fakeContextMenu = {} as ReturnType<
      RuntimePlayerTrayMenuElectron["buildMenu"]
    >;
    const tray = {
      setToolTip: vi.fn(),
      setContextMenu: vi.fn(),
      on: vi.fn((event: "click", listener: () => void) => {
        clickListeners.set(event, listener);
      }),
      destroy: vi.fn()
    };
    const electron: RuntimePlayerTrayMenuElectron = {
      createNativeImageFromDataUrl: vi.fn(() => fakeImage),
      createTray: vi.fn(() => tray),
      buildMenu: vi.fn((template) => {
        builtMenus.push(template);
        return fakeContextMenu;
      }),
      setApplicationMenu: vi.fn()
    };

    const registration = registerRuntimePlayerTrayMenu({
      actions,
      electron,
      getClickThroughRecoveryState: () => ({
        enabled: clickThroughEnabled
      })
    });

    expect(electron.createNativeImageFromDataUrl).toHaveBeenCalledTimes(1);
    expect(
      electron.createNativeImageFromDataUrl
    ).toHaveBeenCalledWith(expect.stringMatching(/^data:image\/png;base64,/));
    expect(fakeImage.isEmpty).toHaveBeenCalledTimes(1);
    expect(electron.createTray).toHaveBeenCalledWith(fakeImage);
    expect(tray.setToolTip).toHaveBeenCalledWith("Runtime Player");
    expect(tray.setContextMenu).toHaveBeenCalledWith(fakeContextMenu);
    expect(electron.setApplicationMenu).toHaveBeenCalledWith(fakeContextMenu);

    clickListeners.get("click")?.();
    expect(actions.showControl).toHaveBeenCalledTimes(1);

    clickThroughEnabled = true;
    registration.refresh();
    expect(tray.setContextMenu).toHaveBeenCalledTimes(2);
    expect(
      getMenuItem(builtMenus.at(-2) ?? [], "Disable Click-through").enabled
    ).toBe(true);

    registration.dispose();
    expect(electron.setApplicationMenu).toHaveBeenLastCalledWith(null);
    expect(tray.destroy).toHaveBeenCalledTimes(1);
  });

  it("rejects an empty tray icon image before exposing tray/menu recovery", () => {
    const actions = createActions();
    const fakeImage = {
      isEmpty: vi.fn(() => true)
    } as unknown as Parameters<
      RuntimePlayerTrayMenuElectron["createTray"]
    >[0];
    const electron: RuntimePlayerTrayMenuElectron = {
      createNativeImageFromDataUrl: vi.fn(() => fakeImage),
      createTray: vi.fn(),
      buildMenu: vi.fn(),
      setApplicationMenu: vi.fn()
    };

    expect(() =>
      registerRuntimePlayerTrayMenu({
        actions,
        electron
      })
    ).toThrow("Runtime Player tray icon PNG failed to load.");
    expect(electron.createNativeImageFromDataUrl).toHaveBeenCalledWith(
      expect.stringMatching(/^data:image\/png;base64,/)
    );
    expect(fakeImage.isEmpty).toHaveBeenCalledTimes(1);
    expect(electron.createTray).not.toHaveBeenCalled();
    expect(electron.setApplicationMenu).not.toHaveBeenCalled();
  });
});

function createActions(): RuntimePlayerTrayMenuActions {
  return {
    showControl: vi.fn(() => true),
    focusStage: vi.fn(() => true),
    disableClickThrough: vi.fn(() => false),
    quit: vi.fn()
  };
}

function getMenuItem(
  template: readonly RuntimePlayerMenuItem[],
  label: string
): RuntimePlayerMenuItem {
  const item = template.find((entry) => entry.label === label);

  expect(item).toBeDefined();

  return item as RuntimePlayerMenuItem;
}

function clickMenuItem(item: RuntimePlayerMenuItem): void {
  expect(item.click).toBeTypeOf("function");
  item.click?.({} as never, undefined, {} as never);
}
