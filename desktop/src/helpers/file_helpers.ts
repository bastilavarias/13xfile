import { FileMetadata } from "@/types/core";

export const extractFileObject = (file: File): FileMetadata => {
  const name = file.name;
  const size = file.size; // in bytes
  const type = file.type || "Unknown"; // MIME type
  const extension = name.includes(".")
    ? name.split(".").pop() || "Unknown"
    : "Unknown";

  return { name, size, extension, type };
};

export const convertArrayBufferToFile = (
  arrayBuffer: ArrayBuffer,
  fileName: string,
  mimeType: string,
) => {
  const blob = new Blob([arrayBuffer], { type: mimeType });
  return new File([blob], fileName, { type: mimeType });
};
