import { ipcMain } from "electron";
import { uploadFile, checkFileStatus, isRunning } from "../../../lib/ipfs";
import {
  IPFS_STORE,
  IPFS_CHECK_STATUS,
  IPFS_RUNNING,
  IPFS_EVENT_UPLOAD_PROGRESS,
} from "./ipfs-channels";

/**
 * Register IPC handlers
 */
export function addIPFSEventListeners() {
  ipcMain.handle(IPFS_RUNNING, async (_event) => isRunning());
  ipcMain.handle(
    IPFS_STORE,
    async (_event, file: ArrayBuffer) =>
      await uploadFile(file, (progress) =>
        _event.sender.send(IPFS_EVENT_UPLOAD_PROGRESS, progress),
      ),
  );
  ipcMain.handle(
    IPFS_CHECK_STATUS,
    async (_event, cid: string) => await checkFileStatus(cid),
  );
}
