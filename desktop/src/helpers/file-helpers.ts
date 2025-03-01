import { FILE_TYPES } from "@/constants";
import { FileType, FileTypeIcon } from "@/types/color";
import { Ban } from "lucide-react";

export const getFileType = (type: FileType): FileTypeIcon => {
  const fileType = FILE_TYPES.find((item) => item.type === type);

  return (
    fileType ?? {
      type: "default",
      color: "#000000",
      bgColor: "#f3f4f6",
      icon: Ban,
    }
  ); // Default to black if not found
};
