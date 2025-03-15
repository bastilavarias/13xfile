import { CoreFile, FileMetadata } from "@/types/core";

type CreateFileRequestPayload = {
  cid: string;
  metadata: FileMetadata;
};

const FileData = {
  async store(
    payload: CreateFileRequestPayload,
    onProgress: (progress: number) => void, // Progress callback
  ): Promise<CoreFile | null> {
    try {
      return await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", "http://localhost:3333/files", true);
        xhr.setRequestHeader("Content-Type", "application/json");
        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            onProgress(event.loaded / event.total);
          }
        };
        xhr.onload = () => {
          onProgress(1); // Mark as 100% complete
          resolve(JSON.parse(xhr.responseText));
        };
        xhr.onerror = reject;
        xhr.send(JSON.stringify(payload));
      });
    } catch (error) {
      return null;
    }
  },

  async index(): Promise<CoreFile[] | []> {
    try {
      const response = await fetch("http://localhost:3333/api/file", {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer YOUR_ACCESS_TOKEN",
        },
      });
      if (!response.ok)
        throw new Error(`HTTP error! Status: ${response.status}`);

      return response.json().then((data) => data.data);
    } catch (error) {
      return [];
    }
  },
};

export default FileData;
