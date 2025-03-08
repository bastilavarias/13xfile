import { app, BrowserWindow, ipcMain } from "electron";
import registerListeners from "./helpers/ipc/listeners-register";
// "electron-squirrel-startup" seems broken when packaging with vite
//import started from "electron-squirrel-startup";
import path from "path";
import {
  installExtension,
  REACT_DEVELOPER_TOOLS,
} from "electron-devtools-installer";
import fs from "fs";

const inDevelopment = process.env.NODE_ENV === "development";

function createWindow() {
  const preload = path.join(__dirname, "preload.js");
  const mainWindow = new BrowserWindow({
    width: 1080,
    height: 1050,
    webPreferences: {
      devTools: inDevelopment,
      contextIsolation: true,
      nodeIntegration: true,
      nodeIntegrationInSubFrames: false,

      preload: preload,
    },
    titleBarStyle: "hidden",
  });
  registerListeners(mainWindow);

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`),
    );
  }

  ipcMain.on("save-file", async (_event, data) => {
    try {
      const filePath = path.join(app.getPath("downloads"), data.filename);
      fs.writeFileSync(filePath, data.content);
      _event.reply("save-file-success", filePath);
      console.log("File saved at:", filePath);
    } catch (error) {
      _event.reply("save-file-error", error.message);
      console.error("Error saving file:", error);
    }
  });
}

async function installExtensions() {
  try {
    const result = await installExtension(REACT_DEVELOPER_TOOLS);
    console.log(`Extensions installed successfully: ${result.name}`);
  } catch {
    console.error("Failed to install extensions");
  }
}

async function bootHelia() {
  try {
    const helia = await import("./helia"); // Dynamic import fixes ESM issue
    const node = await helia.getHelia();
    console.log("Using Helia instance:", node.helia.libp2p.peerId.toString());
  } catch (err) {
    console.error("Helia boot error:", err);
  }
}

app.whenReady().then(createWindow).then(installExtensions).then(bootHelia);

//osX only
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

//osX only ends
