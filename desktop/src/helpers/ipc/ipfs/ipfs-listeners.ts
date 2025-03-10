import { ipcMain } from "electron";
import { uploadFile, checkFileStatus, getInstance } from "../../../ipfs";
import {
  IPFS_STORE,
  IPFS_CHECK_STATUS,
  IPFS_GET_INSTANCE,
} from "./ipfs-channels";

/**
 * Register IPC handlers
 */
export function addIPFSEventListeners() {
  ipcMain.handle(IPFS_GET_INSTANCE, async (_event) => getInstance());
  ipcMain.handle(
    IPFS_STORE,
    async (_event, file: ArrayBuffer) => await uploadFile(file),
  );
  ipcMain.handle(
    IPFS_CHECK_STATUS,
    async (_event, cid: string) => await checkFileStatus(cid),
  );
}
