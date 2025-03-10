import {
  IPFS_STORE,
  IPFS_RETRIEVE,
  IPFS_CHECK_STATUS,
  IPFS_GET_INSTANCE,
} from "./ipfs-channels";

export function exposeIPFSContext() {
  const { contextBridge, ipcRenderer } = window.require("electron");
  contextBridge.exposeInMainWorld("ipfs", {
    getInstance: () => ipcRenderer.invoke(IPFS_GET_INSTANCE),
    store: async (file: ArrayBuffer) =>
      await ipcRenderer.invoke(IPFS_STORE, file),
    retrieve: async (cid: string) => ipcRenderer.invoke(IPFS_RETRIEVE, cid),
    checkStatus: async (cid: string) =>
      ipcRenderer.invoke(IPFS_CHECK_STATUS, cid),
  });
}
