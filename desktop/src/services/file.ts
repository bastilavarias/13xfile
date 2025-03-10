import FileData from "@/data/file";
import { CoreFile, RawHTTPFile } from "@/types/core";
import { uploadFileToIPFS } from "@/helpers/ipfs-helpers";

type FileMetadata = {
  name: string;
  size: number;
  extension: string;
  type: string;
};

function extractFileObject(file: File): FileMetadata {
  const name = file.name;
  const size = file.size; // in bytes
  const type = file.type || "Unknown"; // MIME type
  const extension = name.includes(".")
    ? name.split(".").pop() || "Unknown"
    : "Unknown";

  return { name, size, extension, type };
}

const fileService = {
  async create(
    raw: RawHTTPFile,
    onProgress: (progress: number) => void,
  ): Promise<CoreFile | null> {
    try {
      const cid = await uploadFileToIPFS(raw.file);
      if (cid) {
        onProgress(80);
        const metadata = extractFileObject(raw.file);
        const createdFile = await FileData.store(
          { cid: cid, metadata },
          (progress) => onProgress(80 + progress * 0.2),
        );
        onProgress(100);
        console.log(createdFile);
        return createdFile;
      }
      return null;
    } catch (error) {
      console.error("Upload failed:", error);
      return null;
    }
  },

  async list(): Promise<CoreFile[] | []> {
    return FileData.index();
  },
};

export default fileService;
