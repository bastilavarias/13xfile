import { BrowserWindow } from "electron";
import { addThemeEventListeners } from "./theme/theme-listeners";
import { addWindowEventListeners } from "./window/window-listeners";
import { addIPFSEventListeners } from "./ipfs/ipfs-listeners";
import { addDownloadEventListeners } from "./download/download-listeners";

export default function registerListeners(mainWindow: BrowserWindow) {
  addWindowEventListeners(mainWindow);
  addThemeEventListeners();
  addIPFSEventListeners();
  addDownloadEventListeners();
}
