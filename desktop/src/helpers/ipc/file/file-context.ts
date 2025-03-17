import {
  FILE_CHECK_STATUS,
  FILE_LIST,
  FILE_ON_STATE_UPDATE,
  FILE_STATE,
  FILE_UPLOAD,
} from "./file-channels";
import { FileRepositoryState, RawFile } from "@/types/core";

export function exposeFileContext() {
  const { contextBridge, ipcRenderer } = window.require("electron");
  contextBridge.exposeInMainWorld("file", {
    state: ipcRenderer.invoke(FILE_STATE),
    upload: async (rawFile: RawFile) =>
      await ipcRenderer.invoke(FILE_UPLOAD, rawFile),
    list: async () => await ipcRenderer.invoke(FILE_LIST),
    checkStatus: async (cid: string) =>
      await ipcRenderer.invoke(FILE_CHECK_STATUS, cid),

    onStateUpdate: (callback: (state: FileRepositoryState) => void) =>
      ipcRenderer.on(
        FILE_ON_STATE_UPDATE,
        (_event, state: FileRepositoryState) => callback(state),
      ),
  });
}
