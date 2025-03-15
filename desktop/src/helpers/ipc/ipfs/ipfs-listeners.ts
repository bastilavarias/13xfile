import { ipcMain } from "electron";
import { uploadFile, checkFileStatus, isRunning } from "../../../lib/ipfs";
import { IPFS_STORE, IPFS_CHECK_STATUS, IPFS_RUNNING } from "./ipfs-channels";

/**
 * Register IPC handlers
 */
export function addIPFSEventListeners() {
  ipcMain.handle(IPFS_RUNNING, async (_event) => isRunning());
  ipcMain.handle(
    IPFS_STORE,
    async (_event, file: ArrayBuffer) => await uploadFile(file),
  );
  ipcMain.handle(
    IPFS_CHECK_STATUS,
    async (_event, cid: string) => await checkFileStatus(cid),
  );
}
