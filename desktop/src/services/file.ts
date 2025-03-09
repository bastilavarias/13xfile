import FileData from "@/data/file";
import { CoreFile, RawHTTPFile } from "@/types/core";

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
      const helia = await import("../helia");
      onProgress(10);
      const cid = await helia.uploadFile(raw.file, (progress: number) => {
        onProgress(progress * 0.7);
      });
      if (cid) {
        onProgress(80);
        const metadata = extractFileObject(raw.file);
        const createdFile = await FileData.store(
          { cid: cid.cid, metadata },
          (progress) => onProgress(80 + progress * 0.2),
        );
        onProgress(100);
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
