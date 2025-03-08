import {
  WIN_MINIMIZE_CHANNEL,
  WIN_MAXIMIZE_CHANNEL,
  WIN_CLOSE_CHANNEL,
} from "./window-channels";

export function exposeWindowContext() {
  const { contextBridge, ipcRenderer } = window.require("electron");
  contextBridge.exposeInMainWorld("electronWindow", {
    minimize: () => ipcRenderer.invoke(WIN_MINIMIZE_CHANNEL),
    maximize: () => ipcRenderer.invoke(WIN_MAXIMIZE_CHANNEL),
    close: () => ipcRenderer.invoke(WIN_CLOSE_CHANNEL),
    saveFile: (data: { filename: string; content: string }) =>
      ipcRenderer.send("save-file", data),
    onSaveSuccess: (callback: (filePath: string) => void) =>
      ipcRenderer.on("save-file-success", (_: any, filePath: string) =>
        callback(filePath),
      ),
    onSaveError: (callback: (error: string) => void) =>
      ipcRenderer.on("save-file-error", (_: any, error: string) =>
        callback(error),
      ),
  });
}
