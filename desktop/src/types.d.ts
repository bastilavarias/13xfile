// This allows TypeScript to pick up the magic constants that's auto-generated by Forge's Vite
// plugin that tells the Electron app where to look for the Vite-bundled app code (depending on
// whether you're running in development or production).

import { CoreFile, FileRepositoryState, RawFile } from "@/types/core";

declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string;
declare const MAIN_WINDOW_VITE_NAME: string;

// Preload types
interface ThemeModeContext {
  toggle: () => Promise<boolean>;
  dark: () => Promise<void>;
  light: () => Promise<void>;
  system: () => Promise<boolean>;
  current: () => Promise<"dark" | "light" | "system">;
}

interface ElectronWindow {
  minimize: () => Promise<void>;
  maximize: () => Promise<void>;
  close: () => Promise<void>;
}

interface IPFSContext {
  isRunning: () => boolean;
  store: (
    file: ArrayBuffer,
    onProgress: (progress: number) => void,
  ) => Promise<string>;
  retrieve: (cid: string) => Promise<File>;
  checkStatus: (cid: string) => Promise<boolean>;
}

interface FileContext {
  state: () => FileRepositoryState;
  upload: (file: RawFile) => CoreFile;
}

declare interface Window {
  themeMode: ThemeModeContext;
  electronWindow: ElectronWindow;
  ipfs: IPFSContext;
  file: FileContext;
}
