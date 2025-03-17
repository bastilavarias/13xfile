import { FILE_TYPE_CATEGORY_ICONS } from "@/constants";
import { FileTypeCategory, FileTypeCategoryIcon } from "@/types/color";
import { Ban } from "lucide-react";

export const getFileTypeCategoryIcon = (
  type: FileTypeCategory,
): FileTypeCategoryIcon => {
  const fileType = FILE_TYPE_CATEGORY_ICONS.find((item) => item.type === type);

  return (
    fileType ?? {
      type: "default",
      color: "#000000",
      bgColor: "#f3f4f6",
      icon: Ban,
    }
  );
};
