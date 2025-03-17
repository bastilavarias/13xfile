import { FILE_ON_STATE_UPDATE, FILE_STATE, FILE_UPLOAD } from "./file-channels";
import { FileRepositoryState, RawFile } from "@/types/core";

export function exposeFileContext() {
  const { contextBridge, ipcRenderer } = window.require("electron");
  contextBridge.exposeInMainWorld("file", {
    state: ipcRenderer.invoke(FILE_STATE),
    upload: (rawFile: RawFile) => ipcRenderer.invoke(FILE_UPLOAD, rawFile),
    onStateUpdate: (callback: (state: FileRepositoryState) => void) =>
      ipcRenderer.on(
        FILE_ON_STATE_UPDATE,
        (_event, state: FileRepositoryState) => callback(state),
      ),
  });
}
