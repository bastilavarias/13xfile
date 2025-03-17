import { FileTypeCategory } from "@/types/color";

export interface CoreFile {
  cid: string;
  category: FileTypeCategory;
  name: string;
  size: number;
  visibility?: string;
}

export type RawFile = {
  file: ArrayBuffer;
  description: string;
  visibility: string;
};

export type FileMetadata = {
  name: string;
  size: number;
  extension: string;
  type: string;
};

export interface FileDownload extends RawFile {
  index?: number;
  progress: number;
  progressMessage?: string;
}

export interface FileRepositoryState {
  downloads: Array<FileDownload>;
}
