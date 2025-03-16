import {
  IPFS_STORE,
  IPFS_RETRIEVE,
  IPFS_CHECK_STATUS,
  IPFS_RUNNING,
  IPFS_EVENT_UPLOAD_PROGRESS,
} from "./ipfs-channels";

export function exposeIPFSContext() {
  const { contextBridge, ipcRenderer } = window.require("electron");
  contextBridge.exposeInMainWorld("ipfs", {
    isRunning: () => ipcRenderer.invoke(IPFS_RUNNING),
    store: async (
      file: ArrayBuffer,
      onProgress: (progress: number) => void,
    ) => {
      ipcRenderer.on(
        IPFS_EVENT_UPLOAD_PROGRESS,
        (_event: any, progress: number) => onProgress(progress),
      );
      return await ipcRenderer.invoke(IPFS_STORE, file);
    },
    retrieve: async (cid: string) => ipcRenderer.invoke(IPFS_RETRIEVE, cid),
    checkStatus: async (cid: string) =>
      ipcRenderer.invoke(IPFS_CHECK_STATUS, cid),
  });
}
