import { FileMetadata, FileRepositoryState, RawFile } from "@/types/core";
import { uploadFile as ipfsUploadFile } from "../../../lib/ipfs";
import FileHTTP from "../../http/file";

export const state: FileRepositoryState = {
  downloads: [],
};

export const uploadFile = async (
  rawFile: RawFile,
  onStateUpdate: (state: FileRepositoryState) => void,
) => {
  try {
    const downloadIndex = state.downloads.length + 1;
    state.downloads = [
      ...state.downloads,
      {
        index: downloadIndex,
        progress: 0,
        ...rawFile,
      },
    ];
    onStateUpdate(state);
    const cid = await ipfsUploadFile(
      rawFile.file,
      (progress: number, progressMessage: string) => {
        state.downloads = state.downloads.map((download) => {
          if (downloadIndex === download.index) {
            download.progress = progress;
            download.progressMessage = progressMessage;
          }

          return download;
        });
      },
    );
    if (cid) {
      const metadata = extractFileObject(rawFile.file);
      const createdFile = await FileHTTP.store(
        { cid: cid, metadata },
        (progress: number, progressMessage: string) => {
          state.downloads = state.downloads.map((download) => {
            if (downloadIndex === download.index) {
              download.progress = progress;
              download.progressMessage = progressMessage;
            }

            return download;
          });
        },
      );

      console.log(createdFile);
      return createdFile;
    }
    return null;
  } catch (error) {
    console.error("Upload failed:", error);
    return null;
  }
};

const extractFileObject = (file: File): FileMetadata => {
  const name = file.name;
  const size = file.size; // in bytes
  const type = file.type || "Unknown"; // MIME type
  const extension = name.includes(".")
    ? name.split(".").pop() || "Unknown"
    : "Unknown";

  return { name, size, extension, type };
};
