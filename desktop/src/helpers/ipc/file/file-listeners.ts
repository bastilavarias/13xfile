import { ipcMain } from "electron";
import {
  FILE_CHECK_STATUS,
  FILE_LIST,
  FILE_ON_STATE_UPDATE,
  FILE_STATE,
  FILE_UPLOAD,
} from "./file-channels";
import {
  state,
  uploadFile,
  listFiles,
  checkFileStatus,
} from "./file-repository";
import { FileRepositoryState, RawFile } from "@/types/core";

/**
 * Register IPC handlers
 */
export function addFileEventListeners() {
  ipcMain.handle(FILE_STATE, () => state);
  ipcMain.handle(FILE_UPLOAD, async (_event, rawFile: RawFile) =>
    uploadFile(rawFile, (state: FileRepositoryState) =>
      _event.sender.send(FILE_ON_STATE_UPDATE, state),
    ),
  );
  ipcMain.handle(FILE_LIST, async () => await listFiles());
  ipcMain.handle(
    FILE_CHECK_STATUS,
    async (_event, cid: string) => await checkFileStatus(cid),
  );
}
