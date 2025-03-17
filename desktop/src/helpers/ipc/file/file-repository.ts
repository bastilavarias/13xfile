import {
  FileDownload,
  FileRepositoryState,
  FileTypeCategory,
  RawFile,
} from "@/types/core";
import { uploadFile as ipfsUploadFile } from "../../../lib/ipfs";
import FileHTTP from "../../http/file";
import {
  convertArrayBufferToFile,
  extractFileObject,
} from "../../file_helpers";
import http from "../../../lib/http";

export const state: FileRepositoryState = {
  downloads: [],
};

export const uploadFile = async (
  rawFile: RawFile,
  onStateUpdate: (state: FileRepositoryState) => void,
) => {
  try {
    const file = convertArrayBufferToFile(
      rawFile.file,
      rawFile.metadata.name,
      rawFile.metadata.extension,
    );
    const metadata = extractFileObject(file);
    const downloadIndex = state.downloads.length + 1;
    state.downloads = [
      ...state.downloads,
      {
        index: downloadIndex,
        progress: 0,
        name: metadata.name,
      },
    ];
    onStateUpdate(state);
    const fileCategory: FileTypeCategory = await http.get(
      `/api/file/category?mimetype=${metadata.type}&extension=${metadata.extension}`,
    );
    state.downloads = updateDownload({
      index: downloadIndex,
      progress: 10,
      progressMessage: "Fetching file category...",
      category: fileCategory,
    });
    onStateUpdate(state);
    const cid = await ipfsUploadFile(
      rawFile.file,
      (progress: number, progressMessage: string) => {
        state.downloads = updateDownload({
          index: downloadIndex,
          progress: progress,
          progressMessage: progressMessage,
        });
        onStateUpdate(state);
      },
    );
    if (cid) {
      return await FileHTTP.store(
        { cid: cid, metadata },
        (progress: number, progressMessage: string) => {
          state.downloads = updateDownload({
            index: downloadIndex,
            progress: progress,
            progressMessage: progressMessage,
          });
          onStateUpdate(state);
        },
      );
    }
    return null;
  } catch (error) {
    console.error("Upload failed:", error);
    return null;
  }
};

const updateDownload = ({
  index,
  progress,
  progressMessage,
  category,
}: FileDownload) => {
  return state.downloads.map((download) => {
    if (download.index === index) {
      download = Object.assign({
        ...download,
        index,
        progress,
        progressMessage,
        category: category ? category : download.category || null,
      });
    }

    return download;
  });
};
