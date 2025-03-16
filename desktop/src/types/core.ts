import { FileTypeCategory } from "@/types/color";

export interface CoreFile {
  cid: string;
  category: FileTypeCategory;
  name: string;
  size: number;
  visibility?: string;
}

export type RawFile = {
  file: File;
  description: string;
  visibility: string;
};

export type FileMetadata = {
  name: string;
  size: number;
  extension: string;
  type: string;
};

export interface FileDownload extends CoreFile {
  index?: number;
  progress: number;
}
