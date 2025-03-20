import {
  FileDownload,
  FileRepositoryState,
  FileTypeCategory,
  RawFile,
} from "@/types/core";
import {
  uploadFile as ipfsUploadFile,
  checkFileStatus as checkIPFSFileStatus,
} from "../../../lib/ipfs";
import {
  convertArrayBufferToFile,
  extractFileObject,
} from "../../file_helpers";
import http from "../../../lib/http";

export const state: FileRepositoryState = {
  files: [],
  downloads: [],
};

export const uploadFile = async (
  rawFile: RawFile,
  onStateUpdate: (state: FileRepositoryState) => void,
) => {
  const downloadIndex = state.downloads.length + 1;

  try {
    const file = convertArrayBufferToFile(
      rawFile.file,
      rawFile.metadata.name,
      rawFile.metadata.extension,
    );
    const metadata = extractFileObject(file);
    state.downloads.push({
      index: downloadIndex,
      progressMessage: "Preparing your file...",
      progress: 0,
      name: metadata.name,
      status: "in-progress",
    });
    onStateUpdate(state);
    let fileCategory: string;
    try {
      const getFileCategoryResponse: FileTypeCategory = await http.get(
        `/api/file/category?mimetype=${metadata.type}&extension=${metadata.extension}`,
      );
      const { data } = getFileCategoryResponse;
      fileCategory = data || "unknown";
    } catch (e) {
      throw new Error("Cant get file category.");
    }
    state.downloads = updateDownload({
      index: downloadIndex,
      progress: 10,
      progressMessage: "Fetching file category...",
      category: fileCategory,
    });
    onStateUpdate(state);
    let cid: string;
    try {
      //@ts-ignore
      cid = await ipfsUploadFile(
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
    } catch (e) {
      throw new Error("Cant upload file to the IPFS network.");
    }
    if (cid) {
      try {
        const { data } = await http.post("/api/file", {
          cid: cid,
          metadata,
          category: fileCategory,
          description: rawFile.description,
        });
        if (data) {
          // @ts-ignore
          state.files = [data, ...state.files];
          state.downloads = updateDownload({
            index: downloadIndex,
            progress: 100,
            progressMessage: "File is ready for sharing!",
            status: "done",
          });
          onStateUpdate(state);
        }
      } catch (e) {
        throw new Error("Cant save the file to the indexer network.");
      }
    }
    return null;
  } catch (error) {
    console.error("Upload failed:", error);
    state.downloads = updateDownload({
      index: downloadIndex,
      progress: 0,
      progressMessage: "Upload failed. Try again later.",
      status: "error",
    });
    onStateUpdate(state);
    return null;
  }
};

export const listFiles = async () => {
  try {
    const { data } = await http.get("/api/file");
    if (data) {
      state.files = [
        ...new Map(
          [...state.files, ...data].map((file) => [file.id, file]),
        ).values(),
      ];
    }

    return state.files;
  } catch (e) {
    console.error(e);
    return [];
  }
};

export const checkFileStatus = async (cid: string) => {
  return await checkIPFSFileStatus(cid);
};

const updateDownload = ({
  index,
  progress,
  progressMessage,
  category,
  status,
}: FileDownload) => {
  return state.downloads.map((download) => {
    if (download.index === index) {
      download = Object.assign({
        ...download,
        index,
        progress,
        progressMessage,
        category: category ? category : download.category || null,
        status: status ? status : download.status || null,
      });
    }

    return download;
  });
};
