import FileData from "@/data/file";
import { CoreFile, RawFile } from "@/types/core";

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
  async create(raw: RawFile): Promise<CoreFile | null> {
    try {
      const cid = await window.ipfs.store(
        await raw.file.arrayBuffer(),
        (progress: number) => {},
      );
      if (cid) {
        const metadata = extractFileObject(raw.file);
        const createdFile = await FileData.store(
          { cid: cid, metadata },
          (progress) =>
            window.download.add({
              index: downloadIndex,
              progress: 95,
            }),
        );
        window.download.add({
          index: downloadIndex,
          progress: 100,
        });

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
