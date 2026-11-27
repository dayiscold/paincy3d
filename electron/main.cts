import { app, BrowserWindow, Menu, protocol, session } from "electron";
import { join } from "node:path";

const gameURL = "paincy://game/index.html";
const profile = app.commandLine.getSwitchValue("user-data-dir") ||
  join(app.getPath("appData"), "Paincy3D");
app.setPath("userData", profile);
app.setPath("sessionData", profile);
app.setAppUserModelId("games.paincy.milkwars");
protocol.registerSchemesAsPrivileged([{
  scheme: "paincy",
  privileges: { standard: true, secure: true, supportFetchAPI: true },
}]);

async function openGame() {
  await app.whenReady();
  protocol.registerSource("paincy", {
    routes: [{
      match: { host: "game" },
      source: {
        type: "directory",
        root: join(app.getAppPath(), "dist"),
        headers: {
          "Content-Security-Policy": "default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; object-src 'none'; base-uri 'none'; frame-src 'none'",
        },
      },
    }],
  });
  const ses = session.defaultSession;
  ses.setPermissionRequestHandler((contents, permission, reply) =>
    reply(permission === "pointerLock" && contents.getURL() === gameURL));
  ses.setPermissionCheckHandler((contents, permission) =>
    permission === "pointerLock" && contents?.getURL() === gameURL);
  Menu.setApplicationMenu(null);
  const window = new BrowserWindow({
    title: "Паинцы 3D",
    width: 1280, height: 720, fullscreen: true,
    backgroundColor: "#0c1817",
    webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false },
  });
  window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  window.webContents.on("will-navigate", (event) => event.preventDefault());
  window.webContents.on("before-input-event", (event, input) => {
    if (input.alt && input.key === "Enter") {
      event.preventDefault();
      if (input.type === "keyDown" && !input.isAutoRepeat)
        window.setFullScreen(!window.isFullScreen());
    }
  });
  app.on("second-instance", () => {
    if (window.isMinimized()) window.restore();
    window.focus();
  });
  await window.loadURL(gameURL);
}
if (app.requestSingleInstanceLock()) {
  app.on("window-all-closed", () => app.quit());
  void openGame();
} else {
  app.quit();
}
